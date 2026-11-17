"""Contract/regression tests for real vocabulary allocation. No runtime/state mutations."""
import copy, math, unittest, importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('make_worlds',Path(__file__).with_name('make_worlds.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def independent_gate(world):
    # Bellman relaxation rather than the generator's heap-based search.
    mp=world['map'];nodes={n['id']:n for n in mp['nodes'] if n['kind']!='minigame'}
    edges=[(e['from'],e['to']) for e in mp['edges'] if e['from'] in nodes and e['to'] in nodes]
    weight={i:int(n['kind']=='tile') for i,n in nodes.items()}
    def distances(source):
        d={i:math.inf for i in nodes};d[source]=weight[source]
        for _ in nodes:
            changed=False
            for a,b in edges:
                for u,v in ((a,b),(b,a)):
                    if d[u]+weight[v]<d[v]:d[v]=d[u]+weight[v];changed=True
            if not changed:break
        return d
    ds,dc=distances(mp['startNodeId']),distances(mp['castleNodeId']);length=ds[mp['castleNodeId']]
    shortest={i for i in nodes if ds[i]+dc[i]-weight[i]==length}
    components=[];unseen=set(nodes)-shortest
    while unseen:
        group={min(unseen)}
        while True:
            expanded=group|{v for a,b in edges for u,v in ((a,b),(b,a)) if u in group and v in unseen}
            if expanded==group:break
            group=expanded
        unseen-=group
        tiles=[i for i in group if weight[i]]
        if tiles:components.append(sorted(tiles,key=lambda i:(1-dc[i],i)))
    candidates=sorted([g[0] for g in components],key=lambda i:(1-dc[i],i))
    return length,shortest,components,candidates,ds,dc

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
    def test_exploration_placement_independent_all_real_and_demo_worlds(self):
        demo=m.read(m.ROOT/'cards/data/demo/worlds.json');worlds=[w for doc in (self.result,demo) for c in doc['continents'] for w in c['worlds']]
        self.assertEqual(len(worlds),33)
        for w in worlds:
            with self.subTest(world=w['id']):
                length,shortest,components,candidates,ds,dc=independent_gate(w)
                rule=w['castleRule'];n=sum(t['kind']=='tile' for t in w['map']['nodes']);k=rule['minTiles']
                self.assertEqual(rule['type'],'explore');self.assertEqual(rule['nodeId'],w['map']['castleNodeId'])
                self.assertEqual(k,max(math.ceil(3*n/5),length+2));self.assertGreaterEqual(k,math.ceil(n/2));self.assertLessEqual(k,math.floor(7*n/10))
                self.assertEqual([s['id'] for s in rule['stamps']],['A','B']);actual=[s['nodeId'] for s in rule['stamps']]
                self.assertEqual(actual,candidates[:2]);self.assertEqual(len(set(actual)),2)
                self.assertTrue(set(actual).isdisjoint(shortest));self.assertTrue(all(math.isfinite(ds[i]) for i in actual))
                self.assertFalse(any(set(actual)<=set(component) for component in components))
                reordered=copy.deepcopy(w);reordered['map']['nodes'].reverse();reordered['map']['edges'].reverse()
                self.assertEqual(m.exploration_rule(reordered,self.config['worldGate']),rule,'node/edge order must not change A/B or K')
    def test_real_assignment_fingerprint_and_graphs_unchanged(self):
        self.assertEqual(self.result['assignmentSha256'],'ea675ce1747c6abc1242bec8aa091c4bd2ad0f5e7f7e6e84df9c21b6f2c954dd')
        # Pin the pre-C013 graph as well: the assignment hash does not include
        # edges or coordinates, which this card must also preserve exactly.
        maps=[w['map'] for c in self.result['continents'] for w in c['worlds']]
        self.assertEqual(m.digest(m.dump(maps).encode()),'319f321d43985dadfdc69cf35aedf89b5b06646edfbccdf7052f122ece7d4d81')
        # The published output must match this regenerated map too.
        published=m.read(m.ROOT/'cards/data/worlds.json')
        self.assertEqual(maps,[w['map'] for c in published['continents'] for w in c['worlds']])
    def test_stamp_on_shortest_path_or_same_branch_rejected(self):
        for change in ('shortest','same','wrong-k'):
            r=copy.deepcopy(self.result);w=r['continents'][0]['worlds'][0]
            if change=='shortest':
                _,shortest,_,_,_,_=independent_gate(w)
                w['castleRule']['stamps'][0]['nodeId']=next(n['id'] for n in w['map']['nodes'] if n['kind']=='tile' and n['id'] in shortest)
            elif change=='same':w['castleRule']['stamps'][1]['nodeId']=w['castleRule']['stamps'][0]['nodeId']
            else:w['castleRule']['minTiles']=1
            with self.subTest(change=change),self.assertRaises(ValueError):m.validate_output(r,self.catalogue,self.config['maxCardsPerTile'])
    def test_gate_configuration_rejects_missing_or_invalid_values(self):
        for key,value in [('worldGate',None),('worldGate',{'targetTileRate':.8,'minExtraTiles':2,'stampPlacement':'off-all-shortest-farthest-v1'}),('continentTileRate',None),('continentTileRate',True),('continentTileRate',.59),('continentTileRate',.81)]:
            cfg=copy.deepcopy(self.config);cfg[key]=value
            with self.subTest(key=key,value=value),self.assertRaises(ValueError):self.make(config=cfg)
    def test_continent_tile_ratio_propagates_without_changing_assignment(self):
        cfg=copy.deepcopy(self.config);cfg['continentTileRate']=.8;r,_,_=self.make(config=cfg)
        self.assertEqual(r['assignmentSha256'],self.result['assignmentSha256']);self.assertNotEqual(r['configSha256'],self.result['configSha256'])
        self.assertTrue(all(c['finale']['minTileRate']==.8 and c['finale']['unlock']=='all-world-castles-and-tile-ratio' for c in r['continents']))
    def test_all_shortest_paths_are_excluded_not_only_the_main_trail(self):
        w=self.result['continents'][0]['worlds'][1];_,shortest,_,_,_,_=independent_gate(w)
        extra=[n['id'] for n in w['map']['nodes'] if n['kind']=='tile' and n['id'] in shortest and '-detour-' in n['id']]
        self.assertTrue(extra,'tied shortest detour must be included');self.assertTrue(set(extra).isdisjoint(s['nodeId'] for s in w['castleRule']['stamps']))
if __name__=='__main__':unittest.main(verbosity=2)
