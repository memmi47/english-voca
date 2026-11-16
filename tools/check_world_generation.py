"""Contract/regression tests for real vocabulary allocation. No runtime/state mutations."""
import copy, unittest, importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('make_worlds',Path(__file__).with_name('make_worlds.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Generation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config=m.read(m.ROOT/'tools/worlds/config.json');cls.overrides=m.read(m.ROOT/'tools/worlds/overrides.json');cls.manual=m.read(m.ROOT/'tools/worlds/confusions.json')
        cls.art=m.read(m.ROOT/'cards/data/world-art.json');cls.db=m.read(m.SOURCE);cls.sha=m.digest(m.SOURCE.read_bytes())
        cls.result,cls.catalogue,cls.audit=cls.make()
    @classmethod
    def make(cls,**kwargs):
        args=dict(config=cls.config,overrides=cls.overrides,manual=cls.manual,art=cls.art,db=cls.db,source_sha=cls.sha);args.update(kwargs);return m.generate(**args)
    def test_exact_source_coverage(self):
        expected={c['card_id'] for c in self.db['cards'] if c['kind']=='기본' and c['sense_order']==1 and c['lemma_link'] in {l['id'] for l in self.db['lemmas'] if l['track'] in ('vocab','sight') and l['old_priority'] in m.BANDS}}
        self.assertEqual(expected,{c['id'] for c in self.catalogue['words']});self.assertEqual(len(expected),4610)
    def test_deterministic_output(self):self.assertEqual(self.result,self.make()[0])
    def test_phrases_embedded_and_sight_separate(self):
        self.assertEqual(sum(a['phrase'] for a in self.audit),386);self.assertEqual(sum(a['sight'] for a in self.audit),0)
        self.assertEqual(self.result['counts']['assignedCards'],4489);self.assertEqual(self.result['counts']['excludedCards'],121)
        self.assertEqual(len(self.result['excluded'][0]['cardIds']),121)
        self.assertTrue(all(not w['sideActivities'] for co in self.result['continents'] for w in co['worlds']))
        self.assertTrue(all(a['vocab']>0 for a in self.audit));self.assertTrue(all(a['phrase']>0 for a in self.audit[:23]))
        self.assertTrue(all(c['answerMode']=='listen-spelling' for c in self.catalogue['words'] if c['learningKind']=='sight'))
    def test_no_forced_route_balance(self):self.assertTrue(all(a['minTiles']<a['maxTiles'] and a['minCards']<a['maxCards'] for a in self.audit))
    def test_missing_continent_setting_does_not_open_gate(self):
        cfg=copy.deepcopy(self.config);cfg['continentCastle']=None;r,_,_=self.make(config=cfg)
        self.assertFalse(r['playable']);self.assertIn('continent-castle-config',r['pending'])
        self.assertTrue(all(c['finale']['required'] and c['finale']['cards'] is None for c in r['continents']))
    def test_settings_propagate_and_reallocate(self):
        cfg=copy.deepcopy(self.config);cfg.update(maxCardsPerTile=5,worldCastle={'cards':6,'passRate':.7},continentCastle={'cards':24,'passRate':.75})
        r,c,a=self.make(config=cfg);self.assertNotEqual(r['assignmentSha256'],self.result['assignmentSha256'])
        self.assertTrue(all(w['castleRule']['cards']==6 and w['castleRule']['passRate']==.7 for co in r['continents'] for w in co['worlds']))
        self.assertTrue(all(co['finale']['cards']==24 and co['finale']['passRate']==.75 for co in r['continents']));m.validate_output(r,c,5)
    def test_one_card_tiles(self):
        cfg=copy.deepcopy(self.config);cfg.update(maxCardsPerTile=1,worldCastle={'cards':2,'passRate':.8})
        r,c,_=self.make(config=cfg);m.validate_output(r,c,1)
    def test_bad_config_rejected(self):
        for key,value in [('maxCardsPerTile',0),('maxCardsPerTile',True),('maxCardsPerTile',11),('worldCastle',{'cards':12,'passRate':1.1}),('continentGate','none')]:
            with self.subTest(key=key,value=value):
                cfg=copy.deepcopy(self.config);cfg[key]=value
                with self.assertRaises(ValueError):self.make(config=cfg)
    def test_castle_cannot_ask_unseen_cards(self):
        cfg=copy.deepcopy(self.config);cfg['worldCastle']['cards']=100
        with self.assertRaisesRegex(ValueError,'shortest route'):self.make(config=cfg)
    def test_source_change_rejected(self):
        with self.assertRaisesRegex(ValueError,'reference DB changed'):self.make(source_sha='0'*64)
    def test_parent_override_requires_approval(self):
        overrides={'version':'test','entries':[{'lemmaId':'W2093','cardId':'W2093:기본:light:2','reason':'test only','approvedByParent':False}]}
        with self.assertRaisesRegex(ValueError,'parent approval'):self.make(overrides=overrides)
    def test_approved_same_lemma_override_keeps_coverage(self):
        overrides={'version':'test-not-production','entries':[{'lemmaId':'W2093','cardId':'W2093:기본:light:2','reason':'synthetic test only','approvedByParent':True}]}
        r,c,_=self.make(overrides=overrides);ids={x['id'] for x in c['words']};self.assertIn('W2093:기본:light:2',ids);self.assertNotIn('W2093:기본:light:1',ids);self.assertEqual(len(ids),4610)
        overrides['entries'][0]['cardId']='W4122:기본:water:2'
        with self.assertRaisesRegex(ValueError,'same lemma'):self.make(overrides=overrides)
    def test_duplicate_coverage_rejected(self):
        r=copy.deepcopy(self.result);tiles=[n for n in r['continents'][0]['worlds'][0]['map']['nodes'] if n['kind']=='tile'];tiles[1]['words'][0]=tiles[0]['words'][0]
        with self.assertRaises((ValueError,AssertionError)):m.validate_output(r,self.catalogue,self.config['maxCardsPerTile'])
    def test_confusable_cards_share_no_tile(self):
        tags={c['id']:set(c['confusionGroups']) for c in self.catalogue['words']}
        for co in self.result['continents']:
            for w in co['worlds']:
                for t in [n for n in w['map']['nodes'] if n['kind']=='tile']+[t for a in w['sideActivities'] for t in a['tiles']]:
                    for i,cid in enumerate(t['words']):
                        for other in t['words'][i+1:]:self.assertFalse(tags[cid]&tags[other])
    def test_unreachable_tile_rejected(self):
        r=copy.deepcopy(self.result);w=r['continents'][0]['worlds'][0];tid=next(n['id'] for n in w['map']['nodes'] if n['kind']=='tile');w['map']['edges']=[e for e in w['map']['edges'] if tid not in e.values()]
        with self.assertRaises(AssertionError):m.validate_output(r,self.catalogue,self.config['maxCardsPerTile'])
    def test_free_castle_bypass_rejected(self):
        r=copy.deepcopy(self.result);w=r['continents'][0]['worlds'][0];w['map']['edges'].append({'from':w['map']['startNodeId'],'to':w['map']['castleNodeId']})
        with self.assertRaises(AssertionError):m.validate_output(r,self.catalogue,self.config['maxCardsPerTile'])
if __name__=='__main__':unittest.main(verbosity=2)
