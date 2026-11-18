"""Deterministic full vocabulary allocation; original reference DB is read-only.
Outputs schema v3 worlds.json + catalogue.json + an allocation report.
Unresolved configuration stays explicit and prevents ready/playable output.
"""
from pathlib import Path
import argparse, collections, copy, hashlib, heapq, importlib.util, json, math, re, unicodedata
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'reference/weekly-tool/vocabulary.json'
EXPECTED_SHA='38b97c372feb8585eed6b9458194294039b4f8a62990ed44b6dfffb91e123130'
BANDS={'P1':(8,1215),'P2':(15,2310),'P3':(7,1085)}
def module(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
GRAPH=module('world_graph');ORDER=module('audit_world_design')
def need(ok,message):
    if not ok:raise ValueError(message)
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def dump(x):return json.dumps(x,ensure_ascii=False,indent=2)+'\n'
def digest(data):return hashlib.sha256(data).hexdigest()
def norm(s):return ' '.join(unicodedata.normalize('NFC',s).split())
def validate_config(c):
    need(type(c.get('version')) is int and c['version']==1,'config version must be 1')
    need(type(c.get('maxCardsPerTile')) is int and 1<=c['maxCardsPerTile']<=10,'maxCardsPerTile must be an integer in 1..10')
    for key in ('worldCastle','continentCastle'):
        rule=c.get(key)
        if key=='continentCastle' and rule is None:continue
        need(isinstance(rule,dict),f'{key} required')
        need(type(rule.get('cards')) is int and rule['cards']>0,f'{key}.cards must be a positive integer')
        need(type(rule.get('passRate')) in (int,float) and math.isfinite(rule['passRate']) and 0<rule['passRate']<=1,f'{key}.passRate must be in (0,1]')
    need(c.get('continentGate')=='all-world-castles-and-tiles-and-continent-castle','continent gate cannot be removed')
    gate=c.get('worldGate',{})
    need(isinstance(gate,dict),'worldGate must be an object')
    need(gate.get('targetTileRate')==.6 and type(gate.get('minExtraTiles')) is int and gate['minExtraTiles']==2 and gate.get('stampPlacement')=='off-all-shortest-farthest-v1','unsupported world gate')
    need(type(c.get('continentTileRate')) in (int,float) and math.isfinite(c['continentTileRate']) and .6<=c['continentTileRate']<=.8,'continentTileRate must be in 0.6..0.8')
    need(c.get('expressionPlacement')=='dedicated-tiles-within-general-worlds','expressions must be embedded in general worlds')
    need(c.get('expressionPrerequisites') in (None,'none'),'unsupported expression prerequisite policy')

def select(db,overrides):
    selected=[x for x in db['lemmas'] if x['track'] in ('vocab','sight') and x['old_priority'] in BANDS]
    need(len(selected)==4610 and len({x['id'] for x in selected})==4610,'selected lemma set changed')
    prim=collections.defaultdict(list);cards={c['card_id']:c for c in db['cards']}
    for card in db['cards']:
        if card['kind']=='기본' and card['sense_order']==1:prim[card['lemma_link']].append(card)
    need(all(len(prim[lm['id']])==1 for lm in selected),'each lemma must have exactly one primary card')
    chosen={lm['id']:prim[lm['id']][0] for lm in selected};seen=set()
    need(isinstance(overrides.get('version'),str) and isinstance(overrides.get('entries'),list),'invalid overrides file')
    for item in overrides['entries']:
        lid=item.get('lemmaId');cid=item.get('cardId')
        need(lid in chosen and lid not in seen and cid in cards,'invalid/duplicate override lemma or card')
        need(item.get('approvedByParent') is True and bool(item.get('reason','').strip()),'override requires recorded parent approval and reason')
        card=cards[cid];need(card['lemma_link']==lid and card['kind']=='기본','override must be a basic sense of the same lemma')
        chosen[lid]=card;seen.add(lid)
    out=[]
    for lm in selected:
        card=chosen[lm['id']];kind='sight' if lm['track']=='sight' else 'phrase' if lm['pos']=='표현' else 'vocab'
        need(kind=='sight' or bool(norm(card['single_meaning_ko'])),f'empty answer: {card["card_id"]}')
        out.append(dict(id=card['card_id'],lemmaId=lm['id'],form=card['card_form'],ko=card['single_meaning_ko'],
            type=card['image_type'],theme=lm['theme'],pos=lm['pos'],band=lm['old_priority'],learningKind=kind,
            answerMode='listen-spelling' if kind=='sight' else 'meaning',ipa=card['ipa_us'],emoji='',
            senseOrder=card['sense_order'],confusionGroups=[],_lemma=lm))
    need(collections.Counter(c['band'] for c in out)=={k:v[1] for k,v in BANDS.items()},'band totals changed')
    return out

def confusion_groups(cards,manual):
    groups=[];byid={c['id']:c for c in cards}
    for field,kind in [('ko','same-gloss'),('form','same-spelling'),('ipa','same-auto-ipa')]:
        bins=collections.defaultdict(list)
        for c in cards:
            key=norm(c[field]).casefold() if field=='form' else norm(c[field])
            if key:bins[key].append(c['id'])
        for key,ids in sorted(bins.items()):
            if len(ids)>1:groups.append(dict(id=kind+'-'+digest(key.encode())[:12],kind=kind,value=key,cardIds=sorted(ids)))
    for entry in manual['groups']:
        ids=sorted(c['id'] for c in cards if c['form'].casefold() in entry['forms'])
        if len(ids)>1:groups.append(dict(id='review-list-'+digest('|'.join(sorted(entry['forms'])).encode())[:12],kind='conservative-list',value=', '.join(entry['forms']),cardIds=ids,reason=entry['reason']))
    need(len({g['id'] for g in groups})==len(groups),'duplicate confusion group')
    for group in groups:
        for cid in group['cardIds']:byid[cid]['confusionGroups'].append(group['id'])
    return groups

def ranked(cards):
    byid={c['lemmaId']:c for c in cards}
    return [byid[lm['id']] for lm in ORDER.ordered([c['_lemma'] for c in cards])]
def divide(rows,n):
    q,r=divmod(len(rows),n);offset=0;out=[]
    for i in range(n):
        size=q+(i<r);out.append(rows[offset:offset+size]);offset+=size
    return out

def pack(cards,cap):
    if not cards:return []
    bins=[[] for _ in range(math.ceil(len(cards)/cap))];groups=[set() for _ in bins]
    frequency=collections.Counter(g for c in cards for g in c['confusionGroups'])
    order={c['id']:i for i,c in enumerate(cards)}
    # Difficult-to-separate words are placed first, with stable frequency order as tie break.
    for card in sorted(cards,key=lambda c:(-sum(frequency[g]-1 for g in c['confusionGroups']),order[c['id']])):
        tags=set(card['confusionGroups'])
        candidates=[i for i,b in enumerate(bins) if len(b)<cap and not tags&groups[i]]
        if not candidates:bins.append([]);groups.append(set());candidates=[len(bins)-1]
        i=min(candidates,key=lambda i:(len(bins[i]),sum(x['theme']==card['theme'] for x in bins[i]),sum(x['pos']==card['pos'] for x in bins[i]),i))
        bins[i].append(card);groups[i]|=tags
    return [sorted(b,key=lambda c:order[c['id']]) for b in bins if b]

def tile_pools(regular,phrases,cap,minimum):
    vocab=pack(regular,cap);phrase=pack(phrases,cap)
    while len(vocab)+len(phrase)<minimum:
        options=[(len(b),-i,i) for i,b in enumerate(vocab) if len(b)>1]
        need(bool(options),'too few cards for scenic map template')
        i=max(options)[2];cut=len(vocab[i])//2;vocab.append(vocab[i][cut:]);vocab[i]=vocab[i][:cut]
    total=len(vocab)+len(phrase);positions={math.floor((i+.5)*total/len(phrase)):b for i,b in enumerate(phrase)} if phrase else {}
    out=[];v=iter(vocab)
    for i in range(total):out.append(('phrase',positions[i]) if i in positions else ('vocab',next(v)))
    return out

def exploration_rule(world, settings, *, deep=False):
    """Place two stamps in distinct components outside ALL cheapest routes.

    Costs count tiles on entry, including the source tile when measuring from a
    tile. Thus dS[v]+dC[v]-weight(v) tests membership in any cheapest route.
    Minigames are dead-end decorations and do not participate in this graph.
    """
    mp=world['map'];nodes={n['id']:n for n in mp['nodes'] if n['kind']!='minigame'}
    adj={i:[] for i in nodes};weight={i:int(n['kind']=='tile') for i,n in nodes.items()}
    for e in mp['edges']:
        a,b=e['from'],e['to']
        if a in nodes and b in nodes:adj[a].append(b);adj[b].append(a)
    def distances(source, *, avoid_castle=False):
        dist={i:math.inf for i in nodes};dist[source]=weight[source];q=[(dist[source],source)]
        while q:
            d,v=heapq.heappop(q)
            if d!=dist[v]:continue
            for u in adj[v]:
                if avoid_castle and u == mp['castleNodeId']:continue
                nd=d+weight[u]
                if nd<dist[u]:dist[u]=nd;heapq.heappush(q,(nd,u))
        return dist
    ds,dc=distances(mp['startNodeId']),distances(mp['castleNodeId'])
    length=ds[mp['castleNodeId']];tiles=[i for i in nodes if weight[i]];n=len(tiles)
    need(all(math.isfinite(ds[i]) for i in nodes),world['id']+': disconnected exploration graph')
    k=max(math.ceil(settings['targetTileRate']*n),int(length)+settings['minExtraTiles'])
    need(math.ceil(n/2)<=k<=math.floor(7*n/10),world['id']+': impossible exploration K range')
    shortest={v for v in nodes if ds[v]+dc[v]-weight[v]==length}
    unseen=set(nodes)-shortest;branches=[]
    while unseen:
        first=min(unseen);unseen.remove(first);component={first};q=[first]
        while q:
            for u in adj[q.pop()]:
                if u in unseen:unseen.remove(u);component.add(u);q.append(u)
        choices=[v for v in component if weight[v]]
        if choices:branches.append(choices)
    need(len(branches)>=2,world['id']+': two off-shortest branches required')
    if deep:
        deepest=max(ds[i] for i in tiles)
        min_a=max(3,(deepest+1)//2)
        min_b=max(4,(7*deepest+9)//10)
        scores=[]
        for i,branch in enumerate(branches):
            for a in branch:
                if ds[a]<min_a:continue
                distances_a=distances(a,avoid_castle=True)
                for j,other in enumerate(branches):
                    if i==j:continue
                    for b in other:
                        separation=distances_a[b]-weight[a]
                        if ds[b]>=min_b and 3<=separation<math.inf:
                            scores.append((-min(ds[a],ds[b]),-ds[a]-ds[b],-separation,-ds[b],a,b))
        need(scores,world['id']+': no deep stamp pair')
        selected=min(scores)[-2:]
    else:
        # The three Demo maps retain their C-013 placement.
        candidates=[min(branch,key=lambda v:(-dc[v],v)) for branch in branches]
        selected=sorted(candidates,key=lambda v:(-dc[v],v))[:2]
    return dict(type='explore',nodeId=mp['castleNodeId'],**{key:world['castleRule'][key] for key in ('cards','passRate')},
        minTiles=k,stamps=[dict(id=label,nodeId=tid) for label,tid in zip(('A','B'),selected)])

def generate(config,overrides,manual,art,db,source_sha):
    validate_config(config);need(source_sha==EXPECTED_SHA,'reference DB changed; review before allocation')
    cards=select(db,overrides);groups=confusion_groups(cards,manual);byid={c['id']:c for c in cards};cap=config['maxCardsPerTile']
    continents=[];audit=[]
    stories=['우체국 문이 활짝 열렸어. 첫 편지를 전하러 가자!','섬마다 기다리는 친구가 있어. 물길을 따라 편지를 전하자!','마지막 편지가 하늘에 있어. 돌아오는 길까지 이어 보자!']
    finales=[('큰 배 문','들판의 길을 모두 돌아봤어. 배를 타기 전에 다시 만나 보자!','배가 바다로 나아가. 새 친구들에게 편지를 전하자!'),('하늘 배 문','섬마다 편지를 전했어. 하늘로 가기 전에 다시 만나 보자!','배가 구름 위로 올라가. 마지막 편지를 찾으러 가자!'),('우리 집 큰 문','돌아오는 길을 모두 이었어. 친구들을 맞을 준비를 하자!','편지가 모두 집에 닿았어. 우리 길에서 다시 만나!')]
    for ci,(band,(amount,total)) in enumerate(BANDS.items()):
        bucket={kind:divide(ranked([c for c in cards if c['band']==band and c['learningKind']==kind]),amount) for kind in ('vocab','phrase','sight')}
        worlds=[]
        for wi,visual in enumerate(art['continents'][ci]['worlds']):
            world=copy.deepcopy(visual);wid=world['id'];regular,phrases,sight=[bucket[kind][wi] for kind in ('vocab','phrase','sight')]
            need(bool(regular),'expression-only worlds are prohibited')
            family=GRAPH.FAMILIES[GRAPH.ORDER.index(wid)];minimum=len(GRAPH.TEMPLATES[family][2])+3
            pools=tile_pools(regular,phrases,cap,minimum);g=GRAPH.layout(wid,len(regular)+len(phrases),max_cards=cap,tile_count=len(pools))
            nodes=[];pi=0
            for n in g['nodes']:
                n=copy.deepcopy(n)
                if n['kind']=='tile':
                    kind,pool=pools[pi];pi+=1;n.pop('cardCount');n['learningKind']=kind;n['words']=[c['id'] for c in pool]
                elif n['kind']=='minigame':
                    n['gameType']='memory' if n['gameType']=='memory' else 'mail';n['reward']={'type':'postcard-stamp','id':wid+'-'+n['id'].rsplit('-',1)[-1]}
                nodes.append(n)
            world['map']={k:g[k] for k in ('startNodeId','castleNodeId','landscape')};world['map']['nodes']=nodes;world['map']['edges']=[dict(fromId=a,toId=b) for a,b in g['edges']]
            # JSON edge contract uses the literal keys from/to.
            world['map']['edges']=[{'from':e['fromId'],'to':e['toId']} for e in world['map']['edges']]
            world['castleRule']=dict(type='reach',nodeId=g['castleNodeId'],**config['worldCastle'])
            world['castleRule']=exploration_rule(world,config['worldGate'],deep=True)
            world['sideActivities']=[]
            world['nextWorldId']=f'{band.lower()}-{wi+2:02}' if wi+1<amount else None
            world['counts']=dict(vocab=len(regular),phrase=len(phrases),sight=0,cards=len(regular)+len(phrases),tiles=len(pools))
            need(config['worldCastle']['cards']<=len(regular)+len(phrases),'world castle exceeds available meaning cards')
            measured=graph_audit(world,cap)
            # Even the shortest route must expose enough meaning cards for the configured castle.
            need(measured['minCards']>=config['worldCastle']['cards'],f'{wid}: shortest route has fewer seen cards than world castle setting')
            audit.append(dict(worldId=wid,**world['counts'],phraseTiles=sum(k=='phrase' for k,_ in pools),minTiles=measured['minTiles'],maxTiles=measured['maxTiles'],minCards=measured['minCards'],maxCards=measured['maxCards'],paths=measured['paths']))
            worlds.append(world)
        fname,intro,outro=finales[ci];rule=config['continentCastle']
        if rule is not None:need(rule['cards']<=sum(w['counts']['vocab']+w['counts']['phrase'] for w in worlds),'continent castle exceeds meaning pool')
        continents.append(dict(id=f'c{ci+1}',band=band,name=art['continents'][ci]['name'],story=stories[ci],worlds=worlds,
            finale=dict(name=fname,intro=intro,outro=outro,required=True,unlock='all-world-castles-and-tile-ratio',minTileRate=config['continentTileRate'],cards=None if rule is None else rule['cards'],
                passRate=None if rule is None else rule['passRate'],status='pending-config' if rule is None else 'draft',nextContinentId=f'c{ci+2}' if ci<2 else None)))
    assignment=[(w['id'],[(n['id'],n.get('words',[])) for n in w['map']['nodes']],w['sideActivities']) for c in continents for w in c['worlds']]
    config_hash=digest(dump(config).encode());assignment_hash=digest(dump(assignment).encode())
    pending=['actual-word-audio-validation','parent-sense-review','iPad-verification']
    if config['continentCastle'] is None:pending.append('continent-castle-config')
    if config['expressionPrerequisites'] is None:pending.append('expression-prerequisite-decision')
    result=dict(schemaVersion=3,contentVersion='postal-allocation-1',status='draft',contentScope='learning-map',playable=False,
        pending=pending,source=dict(path='reference/weekly-tool/vocabulary.json',sha256=source_sha,selection='track vocab|sight, band P1|P2|P3; basic sense 1 unless approved override',overrideVersion=overrides['version']),
        artSource=art['source'],rules=copy.deepcopy(config),configSha256=config_hash,assignmentSha256=assignment_hash,
        progressPolicy=dict(legacyPrototype='w1',mode='fresh-start',importLegacyProgress=False,namespace='postal-v3-first-release',changedAssignmentRequiresReview=True),
        excluded=[dict(reason='function-words',cardIds=sorted(c['id'] for c in cards if c['learningKind']=='sight'))],
        counts=dict(lemmas=len(cards),cards=len(cards),assignedCards=len(cards)-121,excludedCards=121,continents=3,worlds=30,byBand={k:v[1] for k,v in BANDS.items()},phrase=386,sight=121),
        assetPack=art['assetPack'],catalogue='catalogue.json',continents=continents)
    clean=[{k:v for k,v in c.items() if not k.startswith('_')} for c in cards]
    catalogue=dict(schemaVersion=1,contentVersion='postal-catalogue-1',status='draft',source=result['source'],words=clean,confusionGroups=groups,
        exclusionPolicy='Never offer another member of any confusionGroups as a distractor; do not use empty Korean answers for sight cards.',
        warnings=['IPA is an automatic candidate source, not a verified pronunciation lexicon.','Sense changes require explicit parent-approved overrides.','No word recording is supplied or marked verified.','Vocabulary images remain blank until sense-specific review.'])
    validate_output(result,catalogue,cap)
    return result,catalogue,audit

def graph_audit(world,cap):
    m=world['map'];nodes=copy.deepcopy(m['nodes'])
    for n in nodes:
        if n['kind']=='tile':n['cardCount']=len(n['words'])
    return GRAPH.route_audit(dict(startNodeId=m['startNodeId'],castleNodeId=m['castleNodeId'],nodes=nodes,edges=[[e['from'],e['to']] for e in m['edges']]),max_cards=cap)

def validate_output(worlds,catalogue,cap):
    cards={c['id']:c for c in catalogue['words']};need(len(cards)==4610,'catalogue cardinality')
    used=[]
    for continent in worlds['continents']:
        count=0
        for w in continent['worlds']:
            graph_audit(w,cap)
            local=[]
            for tile in [n for n in w['map']['nodes'] if n['kind']=='tile']+[t for a in w['sideActivities'] for t in a['tiles']]:
                ids=tile['words'];need(1<=len(ids)<=cap,'tile size');tags=set()
                for cid in ids:
                    need(cid in cards,'unknown card');c=cards[cid];need(c['band']==continent['band'],'cross-band allocation')
                    need(not tags&set(c['confusionGroups']),'confusable cards share a tile');tags.update(c['confusionGroups'])
                    if 'learningKind' in tile:need(c['learningKind']==tile['learningKind'],'mixed phrase/vocab tile')
                local+=ids
            need(len(set(local))==len(local),'duplicate card within world')
            need(any(cards[cid]['learningKind']=='vocab' for cid in local),'expression-only world')
            need(len(local)==w['counts']['cards'],'world count mismatch');used+=local;count+=len(local)
            need(not w['sideActivities'],'side activities must be empty')
            need(w['castleRule']['cards']==worlds['rules']['worldCastle']['cards'],'castle config not propagated')
            need(w['castleRule']['passRate']==worlds['rules']['worldCastle']['passRate'],'castle rate not propagated')
            need(w['castleRule']==exploration_rule(w,worlds['rules']['worldGate'],deep=True),'exploration gate differs from deterministic placement')
        need(count==sum(c['band']==continent['band'] and c['learningKind']!='sight' for c in cards.values()),'continent total')
        need(continent['finale']['required'] is True,'continent gate was removed')
        need(continent['finale']['unlock']=='all-world-castles-and-tile-ratio' and continent['finale']['minTileRate']==worlds['rules']['continentTileRate'],'continent exploration gate not propagated')
    excluded=worlds['excluded'];need(len(excluded)==1 and excluded[0]['reason']=='function-words','exclusion policy')
    excluded_ids=excluded[0]['cardIds'];sight_ids={cid for cid,c in cards.items() if c['learningKind']=='sight'}
    need(len(excluded_ids)==121 and set(excluded_ids)==sight_ids,'excluded sight coverage')
    need(len(used)==4489 and len(set(used))==4489 and set(used).isdisjoint(excluded_ids) and set(used)|set(excluded_ids)==set(cards),'missing or duplicate coverage')
    need(worlds['counts']['assignedCards']==4489 and worlds['counts']['excludedCards']==121 and worlds['counts']['cards']==4610,'total counts')
    need(sum(c['learningKind']=='phrase' for c in cards.values())==386,'phrase count')
    need(sum(c['learningKind']=='sight' for c in cards.values())==121,'sight count')
    return True

def report(worlds,catalogue,audit):
    lines=['# 전체 세계 생성 결과','',f'원본 SHA-256: `{worlds["source"]["sha256"]}`',f'배정 SHA-256: `{worlds["assignmentSha256"]}`','',
        '[verified] 대표 카드 4,610개 중 4,489개를 중복·누락 없이 30세계에 배정하고 기능어 121개를 제외했다. 표현 386개는 일반 세계 안의 표현 칸에 있다.',
        '',f'설정: 칸 최대 {worlds["rules"]["maxCardsPerTile"]}장; 세계 성 {worlds["rules"]["worldCastle"]["cards"]}장·{worlds["rules"]["worldCastle"]["passRate"]*100:g}%; 대륙 성 '+('미설정(필수 관문 유지)' if worlds['rules']['continentCastle'] is None else json.dumps(worlds['rules']['continentCastle'],ensure_ascii=False))+'.',
        '', '**draft / playable=false.** 남은 항목: '+', '.join(worlds['pending'])+'.',
        '', '세계 멤버는 일반어·표현 각각 NDL→NGSL→Cambridge→근거 없는 주제 순환으로 정렬한 뒤 대륙 안에서 연속 구간으로 나눈다. 표현 전용 세계를 없애기 위해 종류별 세계 할당량을 먼저 나누며, 전체 종류를 합친 단일 빈도 순위와는 다르다. 세계 내부는 동일 뜻/철자/자동 IPA/명시 혼동 목록을 분리하고 품사·주제를 섞는다. 동의어·발음의 사람 전수 검수는 아니다.',
        '',f'오답 보기 제외 그룹 {len(catalogue["confusionGroups"])}개를 catalogue.json에 함께 전달한다. 학습 엔진이 이를 실제 보기 선택에 적용해야 한다. 자동 IPA 오류로 과잉 분리될 수 있다. 빈 뜻의 기능어는 listen-spelling 전용이며 뜻 보기 정답으로 만들지 않는다.',
        '', '| 세계 | 일반어 | 표현 | 기능어 | 전체 | 지도 칸 | 표현 칸 | 성 경로 칸 | 성 경로 카드 |', '|---|---:|---:|---:|---:|---:|---:|---|---|']
    for a in audit:lines.append(f'| {a["worldId"]} | {a["vocab"]} | {a["phrase"]} | {a["sight"]} | {a["cards"]} | {a["tiles"]} | {a["phraseTiles"]} | {a["minTiles"]}–{a["maxTiles"]} | {a["minCards"]}–{a["maxCards"]} |')
    lines+=['','길이는 균등하게 맞추지 않는다. 경로 카드 수는 새 카드 배정 수일 뿐, 오답/복습/놀이가 포함된 학습 시간 예측이 아니다. 모든 세계의 최단 경로 카드 수가 설정된 세계 성 장수 이상인지도 검사한다. 성 풀은 실제로 만난 카드에서만 고르도록 런타임에 요청한다.','','재현: `python3 -I tools/make_worlds.py --check`. 다른 설정은 `--config FILE --output /tmp/worlds-trial --report /tmp/worlds-trial/report.md`. 설정 변경에 따른 재배정은 assignmentSha256로 검출하고 진도를 묵시 이관하지 않는다.','']
    return '\n'.join(lines)

def main():
    p=argparse.ArgumentParser();p.add_argument('--config',type=Path,default=ROOT/'tools/worlds/config.json');p.add_argument('--overrides',type=Path,default=ROOT/'tools/worlds/overrides.json');p.add_argument('--confusions',type=Path,default=ROOT/'tools/worlds/confusions.json');p.add_argument('--output',type=Path,default=ROOT/'cards/data');p.add_argument('--report',type=Path,default=ROOT/'docs/research/world_generation.md');p.add_argument('--check',action='store_true');args=p.parse_args()
    art=read(ROOT/'cards/data/world-art.json');need(art['source']['sha256']==digest((ROOT/'docs/WORLD_BIBLE.md').read_bytes()),'rebuild world art after bible changes')
    data,catalogue,audit=generate(read(args.config),read(args.overrides),read(args.confusions),art,read(SOURCE),digest(SOURCE.read_bytes()))
    outputs={args.output/'worlds.json':dump(data),args.output/'catalogue.json':dump(catalogue),args.report:report(data,catalogue,audit)}
    for path,content in outputs.items():
        need(not path.resolve().is_relative_to((ROOT/'reference').resolve()),'reference is read-only')
        if args.check:need(path.exists() and path.read_text(encoding='utf-8')==content,f'stale generated file: {path}')
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content,encoding='utf-8')
    print(f'{"CHECK" if args.check else "BUILT"}: 4489 assigned + 121 excluded = 4610 unique cards, 30 mixed worlds, 386 phrases; draft; {len(catalogue["confusionGroups"])} exclusion groups')
if __name__=='__main__':main()
