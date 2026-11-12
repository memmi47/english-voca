"""Build an offline design atlas, not production worlds or vocabulary assignments.
Usage: python3 -I tools/preview_world_maps.py --output /workspace/scratch/world-atlas-v3
"""
from pathlib import Path
import re,json,math,base64,html,argparse,copy
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--check',action='store_true');args=parser.parse_args();OUT=args.output.resolve();OUT.mkdir(parents=True,exist_ok=True)
b=(ROOT/'docs/WORLD_BIBLE.md').read_text()
def table(section):
 s=b.split('### 4.'+str(section))[1].split('### 4.')[0].split('## 5.')[0]
 return [[x.strip() for x in line.split('|')[1:-1]] for line in s.splitlines() if re.match(r'\| p[123]-\d{2} \|',line)]
look={r[0]:r for r in table(2)};stories={r[0]:r for r in table(3)}
sizes={**{f'p1-{i:02}':142 if i<=4 else 141 for i in range(1,7)},**{f'p2-{i:02}':155 for i in range(1,15)},**{f'p3-{i:02}':155 if i<=5 else 154 for i in range(1,8)},'p1-07':122,'p1-08':122,'p2-15':140}

# Each template is a planar geographic sketch: start, main trail, castle,
# and three reconnecting detours. Shortest paths are deliberately unequal.
TEMPLATES=[
 ('들판 산책로',(65,350),[(230,350),(420,300),(590,330),(750,295),(870,190)],(930,90),[(0,2,[(90,190),(210,125),(350,170)]),(1,3,[(250,490),(400,515),(530,470)]),(3,5,[(630,485),(800,510),(910,420)])],[(290,230),(820,405)]),
 ('섬과 다리',(65,330),[(250,380),(440,420),(650,340),(800,200)],(930,100),[(0,2,[(120,165),(285,110),(420,220)]),(1,3,[(190,510),(420,540),(580,470)]),(3,5,[(790,485),(940,370)])],[(260,215),(825,395)]),
 ('마을 고리길',(70,300),[(155,170),(350,140),(525,200),(650,320),(785,350),(875,230)],(935,100),[(1,4,[(210,355),(410,395)]),(2,6,[(370,50),(625,60),(810,100)]),(4,6,[(630,510),(830,515),(940,420)])],[(300,275),(785,445)]),
 ('계곡길',(70,470),[(180,350),(360,390),(480,250),(660,270),(780,150)],(925,75),[(0,3,[(85,205),(230,90),(360,155)]),(1,4,[(240,525),(445,515)]),(4,6,[(760,450),(930,420)])],[(245,205),(800,340)]),
 ('숨은 정원',(65,250),[(200,330),(490,320),(800,300)],(935,160),[(0,2,[(80,150),(200,70),(380,100)]),(1,2,[(210,495),(400,525)]),(2,4,[(650,500),(865,505),(945,350)])],[(280,195),(805,410)]),
 ('하늘길',(70,400),[(180,260),(400,230),(600,340),(800,240)],(935,110),[(0,2,[(100,115),(285,65)]),(1,3,[(210,465),(410,520),(560,465)]),(2,5,[(510,100),(760,65),(880,90)])],[(245,155),(730,150)])
]
FAMILIES=[0,2,3,0,1,3,2,1, 1,1,2,2,5,0,4,3,2,3,2,2,3,4,1, 5,4,5,3,2,5,0]
ORDER=[f'p{band}-{i:02}' for band,n in [(1,8),(2,15),(3,7)] for i in range(1,n+1)]

def interpolate(points,n):
 lengths=[math.dist(a,b) for a,b in zip(points,points[1:])];total=sum(lengths);out=[]
 for k in range(1,n+1):
  d=total*k/(n+1)
  for a,b,length in zip(points,points[1:],lengths):
   if d<=length:
    t=d/length;out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])));break
   d-=length
 return out

def layout(wid,n):
 index=ORDER.index(wid) if wid in ORDER else 0
 family=FAMILIES[index];name,start,main,castle,detours,gamepos=TEMPLATES[family]
 # A global affine transform gives each world its own framing without changing topology.
 def xy(pt):
  x,y=pt;s=.94+.01*(index%4);x=500+(x-500)*s;y=300+(y-300)*s+(x-500)*((index%3)-1)*.025
  if (index//3)%2:x=1000-x
  return round(x,1),round(y,1)
 nodes=[];edges=[];nt=math.ceil(n/10);extra=nt-len(main)
 trail=[start,*main,castle]
 for i,point in enumerate(trail):
  x,y=xy(point);kind='start' if i==0 else 'castle' if i==len(trail)-1 else 'tile'
  nodes.append(dict(id=f'{wid}-main-{i}',kind=kind,x=x,y=y,trail='main'))
  if i:edges.append([nodes[-2]['id'],nodes[-1]['id']])
 detour_sizes=[extra//3+int(j<extra%3) for j in range(3)]
 branches=[]
 for j,((a,b,waypoints),amount) in enumerate(zip(detours,detour_sizes)):
  assert amount>0
  positions=interpolate([trail[a],*waypoints,trail[b]],amount);ids=[];prev=f'{wid}-main-{a}'
  for i,point in enumerate(positions):
   x,y=xy(point);tid=f'{wid}-detour-{j+1}-{i+1}';nodes.append(dict(id=tid,kind='tile',x=x,y=y,trail=f'detour-{j+1}'));edges.append([prev,tid]);prev=tid;ids.append(tid)
  edges.append([prev,f'{wid}-main-{b}']);branches.append(dict(id=f'detour-{j+1}',fromId=f'{wid}-main-{a}',toId=f'{wid}-main-{b}',tileIds=ids,extraTiles=amount-(b-a-1)))
 # Optional, non-blocking playhouses branch off longer trails; finishing is never a gate.
 long=[branch for branch in branches if branch['extraTiles']>0]
 assert long
 for i,branch in enumerate([long[0],long[-1]]):
  anchor=branch['tileIds'][len(branch['tileIds'])//2];x,y=xy(gamepos[i]);gid=f'{wid}-game-{i+1}'
  nodes.append(dict(id=gid,kind='minigame',x=x,y=y,anchorNodeId=anchor,gameType='memory' if i==0 else 'find',optional=True,trail=branch['id'],extraTiles=branch['extraTiles']));edges.append([anchor,gid])
 tiles=[node for node in nodes if node['kind']=='tile'];q,r=divmod(n,len(tiles))
 for i,node in enumerate(tiles):node['cardCount']=q+int(i<r)
 return dict(version=3,family=family,landscape=name,startNodeId=nodes[0]['id'],castleNodeId=f'{wid}-main-{len(trail)-1}',nodes=nodes,edges=edges,detours=branches)

def route_audit(g):
 adj={n['id']:[] for n in g['nodes']};by={n['id']:n for n in g['nodes']};assert len(adj)==len(g['nodes'])
 assert sum(n['kind']=='start' for n in g['nodes'])==sum(n['kind']=='castle' for n in g['nodes'])==1
 for a,b in g['edges']:
  assert a in adj and b in adj and a!=b and b not in adj[a]
  adj[a].append(b);adj[b].append(a)
 reached={g['startNodeId']};todo=list(reached)
 while todo:
  for dst in adj[todo.pop()]:
   if dst not in reached:reached.add(dst);todo.append(dst)
 assert reached==set(adj)
 paths=[]
 def walk(v,seen,cost,tiles):
  if v==g['castleNodeId']:paths.append((cost,tiles));return
  for dst in adj[v]:
   if dst not in seen:
    node=by[dst];walk(dst,seen|{dst},cost+node.get('cardCount',0),tiles+[dst] if node['kind']=='tile' else tiles)
 walk(g['startNodeId'],{g['startNodeId']},0,[])
 def orient(a,b,c):return (b['x']-a['x'])*(c['y']-a['y'])-(b['y']-a['y'])*(c['x']-a['x'])
 for i,e in enumerate(g['edges']):
  for f in g['edges'][i+1:]:
   if set(e)&set(f) or any(by[x]['kind']=='minigame' for x in e+f):continue
   a,b,c,d=[by[x] for x in e+f]
   assert not(orient(a,b,c)*orient(a,b,d)<0 and orient(c,d,a)*orient(c,d,b)<0)
 assert paths and min(len(t) for _,t in paths)>0
 assert {x for _,t in paths for x in t}=={n['id'] for n in g['nodes'] if n['kind']=='tile'}
 assert all(1<=n['cardCount']<=10 for n in g['nodes'] if n['kind']=='tile')
 assert all(n['optional'] and n['extraTiles']>0 and n['anchorNodeId'] in by and len(adj[n['id']])==1 for n in g['nodes'] if n['kind']=='minigame')
 # Enforce a real choice of route length; no equal-cost invariant remains.
 assert min(len(t) for _,t in paths)<max(len(t) for _,t in paths)
 return dict(paths=len(paths),minCards=min(c for c,_ in paths),maxCards=max(c for c,_ in paths),minTiles=min(len(t) for _,t in paths),maxTiles=max(len(t) for _,t in paths),shortestTiles=min(paths,key=lambda p:(p[0],len(p[1])))[1])

worlds=[]
for wid,name,concept,colors in table(1):
 meta=look[wid]; roads=[]
 for label in meta[1].split(' / '):
  nm,emoji=label.rsplit(' ',1);roads.append({'name':nm,'icon':emoji})
 sky,ground,path=re.findall(r'#[0-9A-F]{6}',colors)
 side=[]
 if wid.startswith('p1'):side=[{'name':'빨리 읽기 집','icon':'📖','count':16 if wid=='p1-01' else 15}]
 if wid in ('p3-06','p3-07'):side=[{'name':'표현 카드 집','icon':'✉️','count':1}]
 worlds.append(dict(id=wid,name=name,concept=concept,sky=sky,ground=ground,path=path,roads=roads,bosses=meta[2].split(),castle=meta[3],key=meta[4],intro=stories[wid][1],outro=stories[wid][2],story=stories[wid][3],side=side,total=sizes[wid]+sum(x['count'] for x in side),graph=layout(wid,sizes[wid])))
assert len(worlds)==30 and sum(w['total'] for w in worlds)==4610
for w in worlds:
 w['audit']=route_audit(w['graph'])
 assert sum(n.get('cardCount',0) for n in w['graph']['nodes'])==sizes[w['id']]
if args.check:
 cases=[];g=layout('test',142)
 bad=copy.deepcopy(g);tid=next(n['id'] for n in bad['nodes'] if n['kind']=='tile');bad['edges']=[e for e in bad['edges'] if tid not in e];cases.append(bad)
 bad=copy.deepcopy(g);next(n for n in bad['nodes'] if n['kind']=='tile')['cardCount']=0;cases.append(bad)
 bad=copy.deepcopy(g);bad['edges'].append(bad['edges'][0]);cases.append(bad)
 bad=copy.deepcopy(g);bad['edges'].append([bad['startNodeId'],bad['castleNodeId']]);cases.append(bad)
 for bad in cases:
  try:route_audit(bad)
  except AssertionError:pass
  else:raise AssertionError('invalid graph was accepted')
 print('PASS: unreachable tile, empty tile, duplicate edge, free bypass rejected')
font=base64.b64encode((ROOT/'cards/fonts/Galmuri11.woff2').read_bytes()).decode()
css='''
*{box-sizing:border-box} @font-face{font-family:Galmuri;src:url(data:font/woff2;base64,FONT) format('woff2')}
:root{color-scheme:light}body{margin:0;background:#f5f2e9;color:#24322c;font-family:Galmuri,system-ui,sans-serif}.wrap{max-width:1600px;margin:auto;padding:40px 30px}header{margin-bottom:28px}.eyebrow{font-size:13px;color:#53645a;letter-spacing:2px}h1{font-size:34px;line-height:1.5;margin:8px 0}p{line-height:1.8}header p{max-width:850px;font-family:system-ui,sans-serif;color:#53645a;font-size:15px}.controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;position:sticky;top:0;z-index:4;padding:12px 0;background:#f5f2e9}button,select{border:1px solid #bbc3b6;border-radius:9px;background:#fffef8;padding:10px 16px;font:inherit;color:inherit;cursor:pointer}button.active{background:#263d31;color:#fff}button:hover{border-color:#263d31}.spacer{flex:1}.continent{margin:34px 0 18px;border-bottom:2px solid #cdd1c4;padding-bottom:14px;display:flex;justify-content:space-between;align-items:baseline}.continent h2{font-size:24px;margin:0}.continent small{color:#617066}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.world{background:#fffef9;border:1px solid #d2d7c9;border-radius:16px;overflow:hidden;box-shadow:0 4px 0 #dfe2d7;scroll-margin-top:80px}.world-head{padding:18px 22px 10px;display:flex;align-items:center;justify-content:space-between;gap:12px}.code{font-family:system-ui,sans-serif;font-size:12px;color:#627367;letter-spacing:1px}.world h3{font-size:22px;margin:5px 0}.count{font-family:system-ui,sans-serif;white-space:nowrap;font-size:13px;background:#eff1e8;border-radius:7px;padding:7px 9px}.intro{padding:0 22px 12px;margin:0;font-size:13px;min-height:42px;line-height:1.65}.map{width:100%;display:block}svg text{font-family:Galmuri,system-ui,sans-serif}.emoji{font-family:'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif}.common{display:flex;gap:12px;flex-wrap:wrap;padding:12px 20px;background:#f5f4ec;border-top:1px solid #d8ddcf;font-size:12px}.common span{display:inline-flex;gap:5px;align-items:center}.bosses{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 20px;font-size:12px}.bosses .emojis{font-size:21px;letter-spacing:5px}.key{padding:0 20px 14px;font-size:12px;color:#53645a;display:flex;justify-content:space-between;gap:10px}.footer{font-family:system-ui,sans-serif;font-size:13px;color:#657064;line-height:1.8;padding:32px 0}.detail .grid{grid-template-columns:1fr;max-width:1100px;margin:auto}.detail .map{max-height:560px}.detail .intro{font-size:17px}.hidden{display:none!important}dialog{width:min(1120px,95vw);max-height:94vh;padding:0;border:1px solid #aebaa9;border-radius:16px;background:#f5f2e9}dialog::backdrop{background:#192c26b8}.dialogbar{display:flex;gap:12px;align-items:center;padding:12px}.dialogbar span{flex:1}.dialogbody{padding:0 16px 18px}.storyline{font-size:14px;line-height:1.8;padding:20px}.world:focus-visible{outline:4px solid #3d6a4e}.world[data-open]{cursor:zoom-in}.sheet{padding:25px 28px;max-width:none}.sheet .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.sheet h1{font-size:28px}.sheet .world-head{padding:12px 14px 5px}.sheet h3{font-size:18px}.sheet .intro{font-size:11px;padding:0 14px 8px;min-height:40px}.sheet .common{font-size:10px;padding:8px 12px;gap:8px}.sheet .bosses{padding:8px 12px;font-size:10px}.sheet .bosses .emojis{font-size:17px;letter-spacing:3px}.sheet .key{font-size:10px;padding:0 12px 10px}.sheet .code,.sheet .count{font-size:10px}.printonly{display:none}@media(max-width:850px){.wrap{padding:20px 14px}.grid{grid-template-columns:1fr}h1{font-size:26px}.continent{display:block}.continent small{display:block;margin-top:8px}}@media print{@page{size:A4 landscape;margin:10mm}body{background:white}.wrap{padding:0;max-width:none}header,.controls,.continent,.footer,dialog{display:none!important}.grid,.detail .grid{display:block;max-width:none}.world{break-inside:avoid;break-after:page;border:0;border-radius:0;box-shadow:none;cursor:default!important}.world h3{font-size:23px}.world-head{padding:8px 12px}.intro{min-height:0;padding:0 12px 8px}.map{width:100%;height:125mm}.common{padding:8px 12px}.bosses{padding:8px 12px}.key{padding:0 12px 8px}.printonly{display:inline;font-size:10px}.world.hidden{display:none!important}}
'''.replace('FONT',font)
css+='''\n.numbers{font-family:system-ui,sans-serif;font-size:12px;color:#667064;padding:0 20px 14px}.numbers p{margin-bottom:0}.playhouse{cursor:pointer}.playhouse.locked{opacity:.6}.minibox{margin:14px;padding:22px;background:#fff6d7;border:1px solid #d8c181;border-radius:14px}.minibox h3{margin-top:0}.mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:440px;margin:18px auto}.mini-grid button{font-family:'Noto Color Emoji',sans-serif;font-size:34px;min-height:76px;background:#fffef9}.mini-grid button.matched{background:#dcf0c5}.gamehint{font-family:system-ui,sans-serif;line-height:1.6}.trial{flex-wrap:wrap}.maptile{cursor:pointer}.maptile.locked{opacity:.35;cursor:default}.maptile.done circle{fill:#d4eb97;stroke:#183c24;stroke-width:5}.maptile:focus{outline:none}.maptile:focus-visible circle{stroke:#006cff;stroke-width:5}.trial{display:flex;gap:15px;align-items:center;padding:15px;font-size:15px;line-height:1.7}@media(max-width:700px){.trial{display:block}.trial span{display:block;margin-top:10px}}\n'''
def esc(s):return html.escape(str(s))
def svg(w):
 g=w['graph'];sky,ground,path=w['sky'],w['ground'],w['path'];by={n['id']:n for n in g['nodes']};family=g['family']
 a=[f'<svg class="map" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{esc(w["name"])}의 돌아가는 길 지도"><rect width="1000" height="600" fill="{sky if family in (1,5) else ground}"/>']
 if family in (1,5):
  for n in g['nodes']:
   if n['kind']=='minigame':continue
   x,y=n['x'],n['y'];a.append(f'<ellipse cx="{x}" cy="{y+12}" rx="55" ry="31" fill="{ground}"/><ellipse cx="{x}" cy="{y+20}" rx="54" ry="26" fill="{path}" opacity=".15"/>')
 elif family in (0,4):
  a.append(f'<ellipse cx="520" cy="255" rx="135" ry="110" fill="{sky}" opacity=".9"/><ellipse cx="505" cy="245" rx="108" ry="85" fill="#FFFFFF" opacity=".12"/>')
 elif family==3:
  a.append(f'<path d="M0 0 H265 L205 95 L90 150 L145 245 L0 330Z M1000 600H790L835 515L950 490L935 360L1000 295Z" fill="{path}" opacity=".17"/>')
  a.append(f'<path d="M420 600 Q550 390 500 270 T640 0" stroke="{sky}" stroke-width="45" fill="none" opacity=".55"/>')
 else:
  for x,y in [(90,60),(430,430),(750,150)]:a.append(f'<rect x="{x}" y="{y}" width="140" height="85" rx="10" fill="#FFFFFF" opacity=".14"/>')
 for i,em in enumerate(w['bosses']):
  x,y=[(48,66),(490,60),(945,550),(500,575),(70,550),(947,265)][i]
  a.append(f'<text class="emoji" x="{x}" y="{y}" font-size="27" text-anchor="middle" opacity=".65">{em}</text>')
 for src,dst in g['edges']:
  u,v=by[src],by[dst];mini=u['kind']=='minigame' or v['kind']=='minigame';dash='stroke-dasharray="5 8"' if mini else ''
  a.append(f'<path d="M{u["x"]} {u["y"]} L{v["x"]} {v["y"]}" fill="none" stroke="#fffef9" stroke-width="18" stroke-linecap="round" opacity=".7"/>')
  a.append(f'<path d="M{u["x"]} {u["y"]} L{v["x"]} {v["y"]}" fill="none" stroke="{path}" stroke-width="{4 if mini else 9}" stroke-linecap="round" {dash}/>')
 for i,n in enumerate(g['nodes']):
  x,y=n['x'],n['y'];kind=n['kind']
  if kind=='tile':
   em=w['bosses'][(i-1)%len(w['bosses'])]
   a.append(f'<g class="maptile" data-tile="{n["id"]}" tabindex="0" role="button" aria-label="{esc(w["name"])}의 학습 칸"><title>{esc(w["name"])} · 카드 {n["cardCount"]}장 · 눌러서 경로 체험</title><circle cx="{x}" cy="{y}" r="19" fill="#fffef9" stroke="#344b3c" stroke-width="2.5"/><text class="emoji" x="{x}" y="{y+6}" text-anchor="middle" font-size="22">{em}</text></g>')
  elif kind=='minigame':
   label='짝 맞추기' if n['gameType']=='memory' else '반짝 찾기'
   a.append(f'<g class="playhouse" data-game="{n["id"]}" tabindex="0" role="button" aria-label="{label}"><title>긴 산책길의 선택 놀이집 · {label}</title><rect x="{x-34}" y="{y-28}" width="68" height="56" rx="12" fill="#FFF2AB" stroke="#805C24" stroke-width="3"/><text class="emoji" x="{x}" y="{y+10}" text-anchor="middle" font-size="34">🎪</text><rect x="{x-45}" y="{y+31}" width="90" height="23" rx="5" fill="#fffef9"/><text x="{x}" y="{y+47}" text-anchor="middle" font-size="14" fill="#513F2B">{label}</text></g>')
  else:
   em='🚩' if kind=='start' else w['castle'].rsplit(' ',1)[1];label='출발' if kind=='start' else w['castle'].rsplit(' ',1)[0]
   a.append(f'<rect x="{x-34}" y="{y-32}" width="68" height="64" rx="14" fill="#fffef9" stroke="#344b3c" stroke-width="3"/><text class="emoji" x="{x}" y="{y+12}" font-size="39" text-anchor="middle">{em}</text><rect x="{x-60}" y="{y+37}" width="120" height="25" rx="5" fill="#fffef9"/><text x="{x}" y="{y+55}" text-anchor="middle" font-size="14">{label}</text>')
 a.append('</svg>');return ''.join(a)
def card(w):
 side=''.join(f'<span>{x["icon"]} {x["name"]}</span>' for x in w['side']);a=w['audit']
 return f"""<article class="world" id="{w['id']}" data-open="{w['id']}" tabindex="0" aria-label="{esc(w['name'])} 크게 보기"><div class="world-head"><div><div class="code">{w['id'].upper()} · {w['graph']['landscape']}</div><h3>{esc(w['name'])}</h3></div><span class="count">🎪 놀이집 2곳</span></div><p class="intro">{esc(w['intro'])}</p>{svg(w)}<div class="common"><span>🚩 큰길로 성까지</span><span>🎪 돌아가면 놀이집</span><span>↩ 남긴 길 다시 걷기</span>{side}</div><div class="key"><span>{esc(w['key'])}</span><span>👾 복습 친구 · 🦇 박쥐</span></div><details class="numbers"><summary>설계 수치 보기</summary><p>전체 {w['total']}장 · 성까지 {a['minTiles']}~{a['maxTiles']}칸 / 새 카드 {a['minCards']}~{a['maxCards']}장. 길이는 의도적으로 다릅니다.</p></details></article>"""
continents=[('p1','새싹 들판','가까운 친구들을 만나 배를 준비해요',8),('p2','굽이굽이 바다','섬과 섬을 이으며 하늘길을 찾아요',15),('p3','별빛 하늘','남은 편지를 전하고 집으로 돌아와요',7)]
head='''<header><div class="eyebrow">바람 우체국과 돌아오는 길 · 지도 시안</div><h1>세 대륙, 서른 개의 길</h1><p>지도를 누르면 크게 볼 수 있습니다. 큰길로 성을 향하거나, 옆길로 돌아 놀이집에 들를 수 있습니다. 세계마다 길 모양과 거리가 다릅니다. 확대 화면에서 칸과 놀이집을 눌러 보세요. 실제 단어 분리 배정과 게임 화면 연결은 아직 하지 않았습니다.</p></header>'''
controls='''<nav class="controls" aria-label="지도 보기"><button class="active" data-band="all">전체 30</button><button data-band="p1">P1 · 들판 8</button><button data-band="p2">P2 · 바다 15</button><button data-band="p3">P3 · 하늘 7</button><span class="spacer"></span><button id="view">한 장씩 크게</button><button onclick="window.print()">인쇄 / PDF</button></nav>'''
sections=''
for band,name,desc,n in continents:sections+=f'<section class="section" data-continent="{band}"><div class="continent"><h2>{name}</h2><small>{desc} · {n}세계</small></div><div class="grid">'+''.join(card(w) for w in worlds if w['id'].startswith(band))+'</div></section>'
footer='<div class="footer">돌아가는 지도 v3 · 검토용 시안<br>복습 일정·아이 기록과 연결되지 않습니다. 칸별 숫자는 배정 목표입니다. 실제 어휘·뜻·동음 분리 검증과 iPad 확인은 별도입니다. 놀이 도장은 학습 진도·등급과 무관합니다.</div>'
script="""<script>
const worlds=DATA;let current=0;const dialog=document.querySelector('dialog');let cleared=new Set(),stamps=new Set(),gameState=null;
function openNodes(w){const g=w.graph,by=Object.fromEntries(g.nodes.map(n=>[n.id,n])),adj=Object.fromEntries(g.nodes.map(n=>[n.id,[]]));g.edges.forEach(([a,b])=>{adj[a].push(b);adj[b].push(a)});const reached=new Set([g.startNodeId]),queue=[g.startNodeId],available=new Set();while(queue.length){const v=queue.shift();for(const dst of adj[v]){const n=by[dst];if(n.kind==='tile'&&!cleared.has(dst)){available.add(dst);continue}if(!reached.has(dst)){reached.add(dst);queue.push(dst)}}}return {available,reached};}
function paint(){const w=worlds[current],st=openNodes(w);let count=0;for(const n of w.graph.nodes)if(cleared.has(n.id))count+=n.cardCount||0;document.querySelectorAll('.dialogbody [data-tile]').forEach(el=>{const done=cleared.has(el.dataset.tile),open=st.available.has(el.dataset.tile);el.classList.toggle('done',done);el.classList.toggle('locked',!done&&!open);el.setAttribute('aria-disabled',String(!done&&!open));});document.querySelectorAll('.dialogbody [data-game]').forEach(el=>{el.classList.toggle('locked',!st.reached.has(el.dataset.game));el.setAttribute('aria-disabled',String(!st.reached.has(el.dataset.game)))});document.querySelector('#routeStatus').textContent=(st.reached.has(w.graph.castleNodeId)?'성에 도착했어요! ':'밝은 칸을 따라 가요. ')+cleared.size+'칸 · '+count+'장 지나옴 · 놀이 도장 '+w.graph.nodes.filter(n=>stamps.has(n.id)).length+'/2';}
function show(i){current=(i+worlds.length)%worlds.length;cleared=new Set();gameState=null;const w=worlds[current];document.querySelector('.dialogbody').innerHTML=document.querySelector('#'+w.id).outerHTML+'<div class="trial"><button id="resetRoute">경로 초기화</button><button id="previewGame">미니게임 먼저 체험</button><span id="routeStatus" role="status"></span></div><section id="gamePanel" hidden></section><div class="storyline">이 화면은 경로·놀이 체험입니다. 실제 학습 기록은 저장하지 않아요.<br>다음 이야기: '+w.story+'</div>';document.querySelector('#position').textContent=(current+1)+' / 30';dialog.querySelector('.world').removeAttribute('data-open');dialog.querySelector('.world').removeAttribute('id');document.querySelector('#resetRoute').onclick=()=>{cleared=new Set();gameState=null;document.querySelector('#gamePanel').hidden=true;paint()};document.querySelector('#previewGame').onclick=()=>startGame(w.graph.nodes.find(n=>n.kind==='minigame'));paint();if(!dialog.open)dialog.showModal();}
function startGame(node){const w=worlds[current];gameState={id:node.id,type:node.gameType,flipped:[],matched:new Set(),busy:false,round:0};if(node.gameType==='memory'){const e=w.bosses.slice(0,3);gameState.deck=[e[0],e[1],e[2],e[1],e[0],e[2]];}else gameState.targetIndex=0;renderGame();document.querySelector('#gamePanel').scrollIntoView({block:'nearest',behavior:'instant'});}
function finishGame(){const fresh=!stamps.has(gameState.id);stamps.add(gameState.id);const panel=document.querySelector('#gamePanel');panel.innerHTML='<div class="minibox"><h3>🎉 엽서에 놀이 도장을 찍었어요!</h3><p class="gamehint">'+(fresh?'새 도장 하나를 모았어요.':'이 도장은 이미 모았어요. 다시 놀아도 좋아요!')+' 학습 진도와 카드 등급은 그대로예요.</p><button id="gameAgain">한 번 더</button> <button id="gameBack">지도로 돌아가기</button></div>';document.querySelector('#gameAgain').onclick=()=>startGame(worlds[current].graph.nodes.find(n=>n.id===gameState.id));document.querySelector('#gameBack').onclick=()=>{panel.hidden=true;dialog.querySelector('.map').scrollIntoView({block:'start'})};paint();}
function renderGame(){const panel=document.querySelector('#gamePanel');panel.hidden=false;const mem=gameState.type==='memory';panel.innerHTML='<div class="minibox"><h3>'+(mem?'🎪 그림 짝 맞추기':'✨ 반짝 찾기')+'</h3><p class="gamehint">'+(mem?'두 장씩 뒤집어 같은 그림 세 쌍을 찾아요. 서두르지 않아도 돼요.':'위에 보이는 그림을 찾아 눌러요. 다섯 번 찾으면 도장을 받아요.')+'</p><div id="miniStatus" role="status"></div><div class="mini-grid" id="miniGrid"></div><button id="gameClose">그만 놀고 지도로</button></div>';document.querySelector('#gameClose').onclick=()=>{gameState=null;panel.hidden=true;dialog.querySelector('.map').scrollIntoView({block:'start'})};if(mem)paintMemory();else paintFind();}
function paintMemory(){if(!gameState)return;const st=gameState;document.querySelector('#miniStatus').textContent=st.matched.size/2+' / 3쌍';const grid=document.querySelector('#miniGrid');grid.innerHTML='';st.deck.forEach((em,i)=>{const b=document.createElement('button');b.type='button';b.textContent=st.matched.has(i)||st.flipped.includes(i)?em:'✉️';b.setAttribute('aria-label',(i+1)+'번째 카드');b.classList.toggle('matched',st.matched.has(i));b.disabled=st.matched.has(i)||st.busy;b.onclick=()=>{if(st.busy||st.flipped.includes(i)||st.matched.has(i))return;st.flipped.push(i);if(st.flipped.length===2){const [a,c]=st.flipped;if(st.deck[a]===st.deck[c]){st.matched.add(a);st.matched.add(c);st.flipped=[];if(st.matched.size===6){finishGame();return}}else{st.busy=true;setTimeout(()=>{if(gameState!==st)return;st.flipped=[];st.busy=false;paintMemory()},550)}}paintMemory()};grid.append(b)});}
function paintFind(){const st=gameState,w=worlds[current];st.targetIndex=(st.round*4+current)%9;const target=w.bosses[st.round%6],other=w.bosses[(st.round+1)%6];document.querySelector('#miniStatus').textContent='찾을 그림: '+target+' · '+st.round+' / 5';const grid=document.querySelector('#miniGrid');grid.innerHTML='';for(let i=0;i<9;i++){const b=document.createElement('button');b.type='button';b.textContent=i===st.targetIndex?target:other;b.setAttribute('aria-label',b.textContent);b.onclick=()=>{if(i!==st.targetIndex){document.querySelector('#miniStatus').textContent='한 번 더 살펴봐요. 찾을 그림: '+target;return}st.round++;if(st.round===5)finishGame();else paintFind()};grid.append(b)}}
document.querySelectorAll('[data-open]').forEach(a=>{a.addEventListener('click',()=>show(worlds.findIndex(w=>w.id===a.dataset.open)));a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();a.click()}})});
document.querySelector('.dialogbody').addEventListener('click',e=>{const tile=e.target.closest('[data-tile]');if(tile){if(openNodes(worlds[current]).available.has(tile.dataset.tile)){cleared.add(tile.dataset.tile);paint()}return}const game=e.target.closest('[data-game]');if(game){if(openNodes(worlds[current]).reached.has(game.dataset.game))startGame(worlds[current].graph.nodes.find(n=>n.id===game.dataset.game));else document.querySelector('#routeStatus').textContent='놀이집으로 이어지는 길을 먼저 지나가요.'}});
document.querySelector('.dialogbody').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-tile],[data-game]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
document.querySelectorAll('[data-band]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-band]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.section').forEach(s=>s.classList.toggle('hidden',b.dataset.band!=='all'&&s.dataset.continent!==b.dataset.band));});
document.querySelector('#view').onclick=e=>{document.body.classList.toggle('detail');e.target.textContent=document.body.classList.contains('detail')?'모아 보기':'한 장씩 크게'};
document.querySelector('#prev').onclick=()=>show(current-1);document.querySelector('#next').onclick=()=>show(current+1);document.querySelector('#close').onclick=()=>{gameState=null;dialog.close()};dialog.addEventListener('close',()=>{gameState=null});dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(current-1);if(e.key==='ArrowRight')show(current+1)});
</script>""".replace('DATA',json.dumps(worlds,ensure_ascii=False))
htmlhead='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>바람 우체국 · 30세계 지도 모음</title><style>'+css+'</style>'
(OUT/'index.html').write_text(htmlhead+'<body><main class="wrap">'+head+controls+sections+footer+'</main><dialog><div class="dialogbar"><button id="prev" aria-label="이전 지도">←</button><span id="position"></span><button id="next" aria-label="다음 지도">→</button><button id="close">닫기</button></div><div class="dialogbody"></div></dialog>'+script+'</body></html>')
for band,name,desc,n in continents:
 sheet=f'<main class="wrap sheet"><header><div class="eyebrow">바람 우체국 · 지도 시안</div><h1>{name} · {n}세계</h1><p>{desc} · 실제 단어 배정 전의 검토용 지도</p></header><div class="grid">'+''.join(card(w) for w in worlds if w['id'].startswith(band))+'</div></main>'
 (OUT/(band+'.html')).write_text(htmlhead+'<body>'+sheet+'</body>')
(OUT/'atlas-data.json').write_text(json.dumps(worlds,ensure_ascii=False,indent=2))
report=['# 돌아가는 지도 경로 검사 v3','', '재현: `python3 -I tools/preview_world_maps.py --check --output /tmp/world-atlas-v3` → `route-audit.md`.', '', 'v2의 같은 구간 수·카드 차이≤1 제약은 사용자 요청으로 폐기했다. 아래 수치는 모든 단순 출발→성 경로를 열거한 관측값이며 길이 균등 여부를 통과 기준으로 삼지 않는다. 카드 수는 실제 어휘 배정 전 목표다.', '', '| 세계 | 지형 | 주 지도 카드 | 학습 칸 | 경로 수 | 최단~최장 칸 | 최소~최대 카드 | 선택 놀이집 |','|---|---|---:|---:|---:|---|---|---:|']
for w in worlds:
 a=w['audit'];report.append(f"| {w['id']} | {w['graph']['landscape']} | {sizes[w['id']]} | {sum(n['kind']=='tile' for n in w['graph']['nodes'])} | {a['paths']} | {a['minTiles']}~{a['maxTiles']} | {a['minCards']}~{a['maxCards']} | 2 |")
report+=['','검사: 시작과 성 연결, 모든 학습 칸이 어느 성 경로에 속함, 무료 노드만으로 성 도달 불가, 빈 학습 칸·고립 노드·중복 선 없음, 칸당 1~10장. 놀이집은 직행 구간보다 학습 칸이 많은 우회로에 붙이고, 게임 완료 여부는 성 접근·왕관·복습·등급과 무관하다.','', '기능어 121개와 P3 표현 2개는 별도 필수 집이며 총 배정 목표 4,610개를 유지한다. 모든 어휘를 만나는 왕관에는 학습 칸·필수 집이 필요하지만 미니게임은 포함되지 않는다. 도장은 장식용이며 별·열쇠·단어 등급을 주지 않는다.','', '여섯 지형 틀을 세계에 맞춰 반사·축척·배치해 미리보기를 만든다. 30개를 서로 완전히 다른 손그림으로 만들었다고 주장하지 않는다. 재미와 아이 선호는 실제 사용 전 가설이다.']
(OUT/'route-audit.md').write_text('\n'.join(report)+'\n')
print('PASS: 30 scenic maps, unequal reconnecting routes, optional playhouses, total planned cards 4610')
