"""Shared scenic graph geometry and structural validation (no file I/O)."""
import math

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

def layout(wid,n,max_cards=10,tile_count=None):
 index=ORDER.index(wid) if wid in ORDER else 0
 family=FAMILIES[index];name,start,main,castle,detours,gamepos=TEMPLATES[family]
 # A global affine transform gives each world its own framing without changing topology.
 def xy(pt):
  x,y=pt;s=.94+.01*(index%4);x=500+(x-500)*s;y=300+(y-300)*s+(x-500)*((index%3)-1)*.025
  if (index//3)%2:x=1000-x
  return round(x,1),round(y,1)
 nodes=[];edges=[];nt=tile_count if tile_count is not None else math.ceil(n/max_cards);extra=nt-len(main)
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

def route_audit(g,max_cards=10):
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
 assert all(1<=n['cardCount']<=max_cards for n in g['nodes'] if n['kind']=='tile')
 assert all(n['optional'] and n['extraTiles']>0 and n['anchorNodeId'] in by and len(adj[n['id']])==1 for n in g['nodes'] if n['kind']=='minigame')
 # Enforce a real choice of route length; no equal-cost invariant remains.
 assert min(len(t) for _,t in paths)<max(len(t) for _,t in paths)
 return dict(paths=len(paths),minCards=min(c for c,_ in paths),maxCards=max(c for c,_ in paths),minTiles=min(len(t) for _,t in paths),maxTiles=max(len(t) for _,t in paths),shortestTiles=min(paths,key=lambda p:(p[0],len(p[1])))[1])
