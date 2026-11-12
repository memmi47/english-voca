"""Build an offline design atlas, not production worlds or vocabulary assignments.
Usage: python3 -I tools/preview_world_maps.py --output /workspace/scratch/world-atlas-v2
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

def layout(wid,n):
 k=math.ceil(n/30);q,rem=divmod(n,3*k);nodes=[];edges=[]
 for i in range(k+1):
  role='start' if i==0 else 'castle' if i==k else 'plaza' if i==k//2 else 'junction'
  nodes.append(dict(id=f'{wid}-j{i}',kind=role,x=70+860*i/k,y=275))
 for c in range(k):
  for lane in range(3):
   count=q+int(c*3+lane<rem);tid=f'{wid}-s{c+1}-{lane+1}'
   nodes.append(dict(id=tid,kind='tile',stage=c+1,lane=lane,cardCount=count,x=70+860*(c+.5)/k,y=[155,275,395][lane]))
   edges.extend([[f'{wid}-j{c}',tid],[tid,f'{wid}-j{c+1}']])
 return dict(version=2,stages=k,startNodeId=f'{wid}-j0',castleNodeId=f'{wid}-j{k}',nodes=nodes,edges=edges)

def route_audit(g):
 # Enumerate real paths in the graph, never assume the layout is correct.
 adj={n['id']:[] for n in g['nodes']};by={n['id']:n for n in g['nodes']}
 for a,b in g['edges']:
  assert a in adj and b in adj and b not in adj[a]
  adj[a].append(b);adj[b].append(a)
 paths=[]
 def walk(v,seen,cost,tiles):
  if v==g['castleNodeId']:paths.append((cost,tiles));return
  for dst in adj[v]:
   if dst not in seen:
    n=by[dst];walk(dst,seen|{dst},cost+n.get('cardCount',0),tiles+[dst] if n['kind']=='tile' else tiles)
 walk(g['startNodeId'],{g['startNodeId']},0,[])
 assert paths
 assert len(paths)==3**g['stages']
 assert len(adj)==len(g['nodes'])
 reached={g['startNodeId']};todo=list(reached)
 while todo:
  for dst in adj[todo.pop()]:
   if dst not in reached:reached.add(dst);todo.append(dst)
 assert reached==set(adj)
 assert all(len(t)==g['stages'] for _,t in paths)
 assert all({by[x]['stage'] for x in t}==set(range(1,g['stages']+1)) for _,t in paths)
 lo=min(p[0] for p in paths);hi=max(p[0] for p in paths)
 assert hi-lo<=1
 assert set(adj)==set([g['startNodeId']]+[x for _,t in paths for x in t]+[n['id'] for n in g['nodes'] if n['kind']!='tile'])
 assert all(1<=n['cardCount']<=10 for n in g['nodes'] if n['kind']=='tile')
 return dict(paths=len(paths),minCards=lo,maxCards=hi,tiles=g['stages'])

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
 bad=copy.deepcopy(g);bad['edges'].append([bad['startNodeId'],bad['castleNodeId']]);cases.append(bad)
 bad=copy.deepcopy(g);tid=next(n['id'] for n in bad['nodes'] if n['kind']=='tile');bad['edges']=[e for e in bad['edges'] if tid not in e];cases.append(bad)
 bad=copy.deepcopy(g);next(n for n in bad['nodes'] if n['kind']=='tile')['cardCount']=1;cases.append(bad)
 bad=copy.deepcopy(g);bad['edges'].append(bad['edges'][0]);cases.append(bad)
 for bad in cases:
  try:route_audit(bad)
  except AssertionError:pass
  else:raise AssertionError('invalid graph was accepted')
 print('PASS: shortcut, unreachable tile, uneven route cost, duplicate edge rejected')
font=base64.b64encode((ROOT/'cards/fonts/Galmuri11.woff2').read_bytes()).decode()
css='''
*{box-sizing:border-box} @font-face{font-family:Galmuri;src:url(data:font/woff2;base64,FONT) format('woff2')}
:root{color-scheme:light}body{margin:0;background:#f5f2e9;color:#24322c;font-family:Galmuri,system-ui,sans-serif}.wrap{max-width:1600px;margin:auto;padding:40px 30px}header{margin-bottom:28px}.eyebrow{font-size:13px;color:#53645a;letter-spacing:2px}h1{font-size:34px;line-height:1.5;margin:8px 0}p{line-height:1.8}header p{max-width:850px;font-family:system-ui,sans-serif;color:#53645a;font-size:15px}.controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;position:sticky;top:0;z-index:4;padding:12px 0;background:#f5f2e9}button,select{border:1px solid #bbc3b6;border-radius:9px;background:#fffef8;padding:10px 16px;font:inherit;color:inherit;cursor:pointer}button.active{background:#263d31;color:#fff}button:hover{border-color:#263d31}.spacer{flex:1}.continent{margin:34px 0 18px;border-bottom:2px solid #cdd1c4;padding-bottom:14px;display:flex;justify-content:space-between;align-items:baseline}.continent h2{font-size:24px;margin:0}.continent small{color:#617066}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.world{background:#fffef9;border:1px solid #d2d7c9;border-radius:16px;overflow:hidden;box-shadow:0 4px 0 #dfe2d7;scroll-margin-top:80px}.world-head{padding:18px 22px 10px;display:flex;align-items:center;justify-content:space-between;gap:12px}.code{font-family:system-ui,sans-serif;font-size:12px;color:#627367;letter-spacing:1px}.world h3{font-size:22px;margin:5px 0}.count{font-family:system-ui,sans-serif;white-space:nowrap;font-size:13px;background:#eff1e8;border-radius:7px;padding:7px 9px}.intro{padding:0 22px 12px;margin:0;font-size:13px;min-height:42px;line-height:1.65}.map{width:100%;display:block}svg text{font-family:Galmuri,system-ui,sans-serif}.emoji{font-family:'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif}.common{display:flex;gap:12px;flex-wrap:wrap;padding:12px 20px;background:#f5f4ec;border-top:1px solid #d8ddcf;font-size:12px}.common span{display:inline-flex;gap:5px;align-items:center}.bosses{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 20px;font-size:12px}.bosses .emojis{font-size:21px;letter-spacing:5px}.key{padding:0 20px 14px;font-size:12px;color:#53645a;display:flex;justify-content:space-between;gap:10px}.footer{font-family:system-ui,sans-serif;font-size:13px;color:#657064;line-height:1.8;padding:32px 0}.detail .grid{grid-template-columns:1fr;max-width:1100px;margin:auto}.detail .map{max-height:560px}.detail .intro{font-size:17px}.hidden{display:none!important}dialog{width:min(1120px,95vw);max-height:94vh;padding:0;border:1px solid #aebaa9;border-radius:16px;background:#f5f2e9}dialog::backdrop{background:#192c26b8}.dialogbar{display:flex;gap:12px;align-items:center;padding:12px}.dialogbar span{flex:1}.dialogbody{padding:0 16px 18px}.storyline{font-size:14px;line-height:1.8;padding:20px}.world:focus-visible{outline:4px solid #3d6a4e}.world[data-open]{cursor:zoom-in}.sheet{padding:25px 28px;max-width:none}.sheet .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.sheet h1{font-size:28px}.sheet .world-head{padding:12px 14px 5px}.sheet h3{font-size:18px}.sheet .intro{font-size:11px;padding:0 14px 8px;min-height:40px}.sheet .common{font-size:10px;padding:8px 12px;gap:8px}.sheet .bosses{padding:8px 12px;font-size:10px}.sheet .bosses .emojis{font-size:17px;letter-spacing:3px}.sheet .key{font-size:10px;padding:0 12px 10px}.sheet .code,.sheet .count{font-size:10px}.printonly{display:none}@media(max-width:850px){.wrap{padding:20px 14px}.grid{grid-template-columns:1fr}h1{font-size:26px}.continent{display:block}.continent small{display:block;margin-top:8px}}@media print{@page{size:A4 landscape;margin:10mm}body{background:white}.wrap{padding:0;max-width:none}header,.controls,.continent,.footer,dialog{display:none!important}.grid,.detail .grid{display:block;max-width:none}.world{break-inside:avoid;break-after:page;border:0;border-radius:0;box-shadow:none;cursor:default!important}.world h3{font-size:23px}.world-head{padding:8px 12px}.intro{min-height:0;padding:0 12px 8px}.map{width:100%;height:125mm}.common{padding:8px 12px}.bosses{padding:8px 12px}.key{padding:0 12px 8px}.printonly{display:inline;font-size:10px}.world.hidden{display:none!important}}
'''.replace('FONT',font)
css+='''\n.maptile{cursor:pointer}.maptile.locked{opacity:.35;cursor:default}.maptile.done circle{fill:#d4eb97;stroke:#183c24;stroke-width:5}.maptile:focus{outline:none}.maptile:focus-visible circle{stroke:#006cff;stroke-width:5}.trial{display:flex;gap:15px;align-items:center;padding:15px;font-size:15px;line-height:1.7}@media(max-width:700px){.trial{display:block}.trial span{display:block;margin-top:10px}}\n'''
def esc(s):return html.escape(str(s))
def svg(w):
 g=w['graph'];sky,ground,path=w['sky'],w['ground'],w['path'];by={n['id']:n for n in g['nodes']}
 a=[f'<svg class="map" viewBox="0 0 1000 490" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{esc(w["name"])}의 연결 지도"><rect width="1000" height="490" fill="{ground}"/><rect width="1000" height="90" fill="{sky}"/>']
 for i,road in enumerate(w['roads']):
  x=175+i*300
  a.append(f'<text x="{x}" y="50" text-anchor="middle" font-size="19" fill="#24322c"><tspan class="emoji">{road["icon"]}</tspan> {esc(road["name"])}</text>')
 for n in g['nodes']:
  if n['kind']=='tile' and n['lane']==0:a.append(f'<text x="{n["x"]}" y="108" text-anchor="middle" font-size="14" fill="#24322c">{n["stage"]}구간</text>')
 for src,dst in g['edges']:
  u,v=by[src],by[dst];a.append(f'<path d="M{u["x"]} {u["y"]} L{v["x"]} {v["y"]}" fill="none" stroke="{path}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>')
 for n in g['nodes']:
  x,y=n['x'],n['y'];kind=n['kind']
  if kind=='tile':
   a.append(f'<g class="maptile" data-tile="{n["id"]}" tabindex="0" role="button" aria-label="{n["stage"]}구간 {n["lane"]+1}번 길 {n["cardCount"]}장"><title>클릭해서 경로 체험: {n["stage"]}구간 / {n["cardCount"]}장</title><circle cx="{x}" cy="{y}" r="24" fill="#fffef9" stroke="#344b3c" stroke-width="3"/><text class="emoji" x="{x}" y="{y+7}" text-anchor="middle" font-size="23">{w["roads"][n["lane"]]["icon"]}</text><rect x="{x-25}" y="{y+30}" width="50" height="23" rx="5" fill="#fffef9"/><text x="{x}" y="{y+47}" text-anchor="middle" font-size="15" fill="#24322c">{n["cardCount"]}장</text></g>')
  elif kind in ('start','castle'):
   em='🚩' if kind=='start' else w['castle'].rsplit(' ',1)[1];label='출발' if kind=='start' else w['castle'].rsplit(' ',1)[0]
   a.append(f'<rect x="{x-32}" y="{y-32}" width="64" height="64" rx="13" fill="#fffef9" stroke="#344b3c" stroke-width="3"/><text class="emoji" x="{x}" y="{y+12}" font-size="36" text-anchor="middle">{em}</text><rect x="{x-62}" y="{y+40}" width="124" height="26" rx="5" fill="#fffef9"/><text x="{x}" y="{y+58}" text-anchor="middle" font-size="15">{label}</text>')
  else:
   r=17 if kind=='plaza' else 9
   a.append(f'<g data-junction="{n["id"]}"><circle cx="{x}" cy="{y}" r="{r}" fill="#fffef9" stroke="#344b3c" stroke-width="3"/>')
   if kind=='plaza':a.append(f'<text class="emoji" x="{x}" y="{y+6}" text-anchor="middle" font-size="17">⛲</text><rect x="{x-33}" y="{y+23}" width="66" height="24" rx="5" fill="#fffef9"/><text x="{x}" y="{y+41}" text-anchor="middle" font-size="14">광장</text>')
   a.append('</g>')
 a.append('<rect x="20" y="457" width="960" height="25" rx="5" fill="#fffef9"/><text x="35" y="475" font-size="14" fill="#344b3c">작은 원에서 다른 길로 갈아타요 · 한 구간에서 한 칸씩 지나면 성 도착 · 남은 칸도 다시 갈 수 있어요</text></svg>')
 return ''.join(a)
def card(w):
 cost=str(w['audit']['minCards']) if w['audit']['minCards']==w['audit']['maxCards'] else f"{w['audit']['minCards']}~{w['audit']['maxCards']}"
 side=''.join(f'<span>{x["icon"]} {x["name"]} {x["count"]}장</span>' for x in w['side'])
 return f'''<article class="world" id="{w['id']}" data-open="{w['id']}" tabindex="0" aria-label="{esc(w['name'])} 크게 보기"><div class="world-head"><div><div class="code">{w['id'].upper()} · {w['graph']['stages']}구간 · 매번 3갈래</div><h3>{esc(w['name'])}</h3></div><span class="count">{w['total']}장</span></div><p class="intro">{esc(w['intro'])}</p>{svg(w)}<div class="common"><span>🏡 번개 집</span><span>👾 선택 복습</span><span>🦇 박쥐 시험</span>{side}</div><div class="bosses"><span>이 세계의 보스</span><span class="emojis">{''.join(w['bosses'])}</span></div><div class="key"><span>{esc(w['key'])}</span><span>성까지 {w['audit']['tiles']}칸 · {cost}장</span></div></article>'''
continents=[('p1','새싹 들판','가까운 친구들을 만나 배를 준비해요',8),('p2','굽이굽이 바다','섬과 섬을 이으며 하늘길을 찾아요',15),('p3','별빛 하늘','남은 편지를 전하고 집으로 돌아와요',7)]
head='''<header><div class="eyebrow">바람 우체국과 돌아오는 길 · 지도 시안</div><h1>세 대륙, 서른 개의 길</h1><p>지도를 누르면 크게 볼 수 있습니다. 각 구간을 지날 때마다 다른 길로 갈아탈 수 있습니다. 확대 화면에서 칸을 눌러 경로를 체험해 보세요. 성까지 카드 수 차이는 최대 한 장입니다. 실제 단어 분리 배정과 게임 화면 연결은 아직 하지 않았습니다.</p></header>'''
controls='''<nav class="controls" aria-label="지도 보기"><button class="active" data-band="all">전체 30</button><button data-band="p1">P1 · 들판 8</button><button data-band="p2">P2 · 바다 15</button><button data-band="p3">P3 · 하늘 7</button><span class="spacer"></span><button id="view">한 장씩 크게</button><button onclick="window.print()">인쇄 / PDF</button></nav>'''
sections=''
for band,name,desc,n in continents:sections+=f'<section class="section" data-continent="{band}"><div class="continent"><h2>{name}</h2><small>{desc} · {n}세계</small></div><div class="grid">'+''.join(card(w) for w in worlds if w['id'].startswith(band))+'</div></section>'
footer='<div class="footer">연결 지도 v2 · 검토용 시안<br>복습 일정·아이 기록과 연결되지 않습니다. 칸별 숫자는 배정 목표입니다. 실제 어휘·뜻·동음 분리 검증 뒤 경로 균형도 다시 검사해야 합니다.</div>'
script="""<script>
const worlds=DATA;let current=0;const dialog=document.querySelector('dialog');let cleared=new Set();
function openNodes(w){const g=w.graph;const by=Object.fromEntries(g.nodes.map(n=>[n.id,n]));const adj=Object.fromEntries(g.nodes.map(n=>[n.id,[]]));g.edges.forEach(([a,b])=>{adj[a].push(b);adj[b].push(a)});const reached=new Set([g.startNodeId]),queue=[g.startNodeId],available=new Set();while(queue.length){const v=queue.shift();for(const dst of adj[v]){const n=by[dst];if(n.kind==='tile'&&!cleared.has(dst)){available.add(dst);continue}if(!reached.has(dst)){reached.add(dst);queue.push(dst)}}}return {available,reached};}
function paint(){const w=worlds[current],st=openNodes(w);let count=0;for(const n of w.graph.nodes)if(cleared.has(n.id))count+=n.cardCount||0;document.querySelectorAll('.dialogbody [data-tile]').forEach(el=>{const id=el.dataset.tile,done=cleared.has(id),open=st.available.has(id);el.classList.toggle('done',done);el.classList.toggle('locked',!done&&!open);el.setAttribute('aria-disabled',String(!done&&!open));});const stages=new Set(w.graph.nodes.filter(n=>cleared.has(n.id)).map(n=>n.stage));document.querySelector('#routeStatus').textContent=st.reached.has(w.graph.castleNodeId)?'성 도착! '+count+'장 경로를 지났어요. 남긴 칸도 눌러 보세요.':'경로 체험: '+stages.size+' / '+w.graph.stages+'구간 · '+count+'장. 밝은 칸 중 하나를 골라요.';}
function show(i){current=(i+worlds.length)%worlds.length;cleared=new Set();const w=worlds[current];document.querySelector('.dialogbody').innerHTML=document.querySelector('#'+w.id).outerHTML+'<div class="trial"><button id="resetRoute">체험 초기화</button><span id="routeStatus" role="status"></span></div><div class="storyline">체험만 하는 화면입니다. 실제 학습 기록은 저장하지 않아요.<br>성을 지나면: '+w.outro+'<br>다음 이야기: '+w.story+'</div>';document.querySelector('#position').textContent=(current+1)+' / 30';dialog.querySelector('.world').removeAttribute('data-open');dialog.querySelector('.world').removeAttribute('id');document.querySelector('#resetRoute').onclick=()=>{cleared=new Set();paint()};paint();if(!dialog.open)dialog.showModal();}
document.querySelectorAll('[data-open]').forEach(a=>{a.addEventListener('click',()=>show(worlds.findIndex(w=>w.id===a.dataset.open)));a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();a.click()}})});
document.querySelector('.dialogbody').addEventListener('click',e=>{const el=e.target.closest('[data-tile]');if(!el)return;const id=el.dataset.tile;if(openNodes(worlds[current]).available.has(id)){cleared.add(id);paint()}});
document.querySelector('.dialogbody').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-tile]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
document.querySelectorAll('[data-band]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-band]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.section').forEach(s=>s.classList.toggle('hidden',b.dataset.band!=='all'&&s.dataset.continent!==b.dataset.band));});
document.querySelector('#view').onclick=e=>{document.body.classList.toggle('detail');e.target.textContent=document.body.classList.contains('detail')?'모아 보기':'한 장씩 크게'};
document.querySelector('#prev').onclick=()=>show(current-1);document.querySelector('#next').onclick=()=>show(current+1);document.querySelector('#close').onclick=()=>dialog.close();dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(current-1);if(e.key==='ArrowRight')show(current+1)});
</script>""".replace('DATA',json.dumps(worlds,ensure_ascii=False))
htmlhead='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>바람 우체국 · 30세계 지도 모음</title><style>'+css+'</style>'
(OUT/'index.html').write_text(htmlhead+'<body><main class="wrap">'+head+controls+sections+footer+'</main><dialog><div class="dialogbar"><button id="prev" aria-label="이전 지도">←</button><span id="position"></span><button id="next" aria-label="다음 지도">→</button><button id="close">닫기</button></div><div class="dialogbody"></div></dialog>'+script+'</body></html>')
for band,name,desc,n in continents:
 sheet=f'<main class="wrap sheet"><header><div class="eyebrow">바람 우체국 · 지도 시안</div><h1>{name} · {n}세계</h1><p>{desc} · 실제 단어 배정 전의 검토용 지도</p></header><div class="grid">'+''.join(card(w) for w in worlds if w['id'].startswith(band))+'</div></main>'
 (OUT/(band+'.html')).write_text(htmlhead+'<body>'+sheet+'</body>')
(OUT/'atlas-data.json').write_text(json.dumps(worlds,ensure_ascii=False,indent=2))
report=['# 연결 지도 경로 검사 v2','', '재현: `python3 -I tools/preview_world_maps.py --output /tmp/world-atlas-v2` → `route-audit.md`.', '', '[verified] 아래는 실제 그래프의 모든 단순 출발→성 경로를 열거한 결과다. [estimate] 칸별 카드 수는 배정 목표이며 단어 ID를 배정한 결과가 아니다. 오답 재도전·만기 복습·박쥐 시험은 비용에서 제외하므로 소요 시간이나 실제 제시 카드 수가 같다는 뜻은 아니다.', '', '| 세계 | 전체 주 지도 카드 | 구간 | 학습 칸 | 출발→성 경로 수 | 경로 최소 카드 | 경로 최대 카드 | 차이 |','|---|---:|---:|---:|---:|---:|---:|---:|']
for w in worlds:
 a=w['audit'];report.append(f"| {w['id']} | {sizes[w['id']]} | {a['tiles']} | {3*a['tiles']} | {a['paths']} | {a['minCards']} | {a['maxCards']} | {a['maxCards']-a['minCards']} |")
report+=['','모든 경로가 각 구간을 한 번씩 통과하고 카드 수 차이가 최대 1임을 검사했다. 모든 학습 칸이 어떤 출발→성 경로에 포함된다. 이미 완료한 칸과 무료 합류점만 통과하는 도달 집합으로 다음 칸을 열면 구간 건너뛰기는 불가능하며, 되돌아가 남긴 칸을 방문할 수 있다.','', '기능어 121개와 P3 표현 2개는 주 지도 비용과 별도인 필수 집이다. 전체 배정 목표는 4,610개를 유지한다. 전체 왕관에는 남긴 모든 학습 칸과 필수 집이 필요하다. 성 입장과 왕관을 구분한다.']
(OUT/'route-audit.md').write_text('\n'.join(report)+'\n')
print('PASS: 30 woven maps, every route audited, total planned cards 4610')
