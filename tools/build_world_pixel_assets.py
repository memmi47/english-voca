"""Build the presentation-only worlds catalogue and original pixel asset pack.
No vocabulary allocation, runtime code, state or audio is read/written.
python3 -I tools/build_world_pixel_assets.py [--check]
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, re, sys, xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('postal_pixel_recipes', Path(__file__).with_name('postal_pixel_recipes.py'))
art = importlib.util.module_from_spec(spec); spec.loader.exec_module(art)
BIBLE = ROOT/'docs/WORLD_BIBLE.md'
ASSETS = Path('cards/assets/postal/world-pixels')
SOURCE = Path('assets/post-office/world-pixels/pixels.json')

def table(n):
    body=BIBLE.read_text(encoding='utf-8').split(f'### 4.{n}')[1].split('### 4.')[0].split('## 5.')[0]
    return [[x.strip() for x in row.split('|')[1:-1]] for row in body.splitlines() if re.match(r'\| p[123]-\d{2} \|',row)]

def mix(a,b,t):
    rgb=[round(int(a[i:i+2],16)*(1-t)+int(b[i:i+2],16)*t) for i in (1,3,5)]
    return '#'+''.join(f'{c:02X}' for c in rgb)

def lum(c):
    rgb=[int(c[i:i+2],16)/255 for i in (1,3,5)]
    return sum((v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4)*k for v,k in zip(rgb,(.2126,.7152,.0722)))

def contrast(a,b):
    hi,lo=sorted((lum(a),lum(b)),reverse=True); return (hi+.05)/(lo+.05)

def variables(palette):
    out={}
    for key,value in palette.items():
        out['--w-'+key]=value
        if key!='sky':out['--w-'+key+'-d']=mix(value,'#233F3A',.22)
        out['--w-'+key+'-l']=mix(value,'#FBF7EA',.22)
    return out

def runs(rows):
    out=[]
    for y,row in enumerate(rows):
        x=0
        while x<16:
            end=x+1
            while end<16 and row[end]==row[x]:end+=1
            if row[x]!='.':out.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{art.PAL[row[x]]}"/>')
            x=end
    return ''.join(out)

def build():
    looks={r[0]:r for r in table(2)};stories={r[0]:r for r in table(3)}
    sprites={};worlds=[]
    for i,(wid,name,concept,colors) in enumerate(table(1)):
        assert wid==list(art.EXPECTED_EMOJI)[i], 'World order changed; reconcile recipes'
        look=looks[wid];emojis=look[2].split();labels=art.LABELS[i].split();assert len(emojis)==len(labels)==6
        assert emojis==art.EXPECTED_EMOJI[wid].split(), f'{wid}: emoji mapping changed; reconcile recipes'
        bosses=[]
        for j,(emoji,label) in enumerate(zip(emojis,labels)):
            sid=f'wb-{wid}-{j+1:02}'
            sprites[sid]={'role':'boss','worldId':wid,'emoji':emoji,'label':label,'pixels':art.draw(i,j)}
            bosses.append(sid)
        palette=dict(zip(('sky','ground','path'),re.findall(r'#[0-9A-F]{6}',colors)))
        routes=[]
        for j,route in enumerate(look[1].split(' / ')):
            title,emoji=route.rsplit(' ',1);routes.append(dict(id=f'{wid}-route-{j+1}',name=title,icon=emoji,spriteId=bosses[emojis.index(emoji)]))
        def marker(raw):
            title,emoji=raw.rsplit(' ',1);return dict(name=title,emoji=emoji,spriteId=bosses[emojis.index(emoji)])
        worlds.append(dict(id=wid,name=name,title=name,concept=concept,status='draft',palette=palette,
                           paletteVars=variables(palette),bossEmoji=emojis,bossSprites=bosses,routes=routes,
                           castle=marker(look[3]),key=marker(look[4]),intro=stories[wid][1],outro=stories[wid][2],story=stories[wid][3]))
    # Named scenery aliases are separate export symbols: reuse the same authored drawing.
    decor={'deco-boat':'wb-p2-01-02','deco-sunflower':'wb-p1-01-03','deco-palm':'wb-p1-04-03',
           'deco-moon':'wb-p3-02-01','deco-shell':'wb-p2-02-01','deco-pear':'wb-p1-02-02'}
    for sid,target in decor.items():
        src=sprites[target];sprites[sid]=dict(role='decoration',sourceSprite=target,label=src['label'],pixels=src['pixels'][:])
    for frame,label in [('a','회오리 첫 프레임'),('b','회오리 둘째 프레임'),('letters','글자 조각 회오리'),('gone','사라지는 바람')]:
        sprites['fx-storm-'+frame]=dict(role='effect',label=label,pixels=art.storm(frame))
    # Requested world palette variables also cover tile highlights/shadows. The contrast
    # guarantee is for base path/ground; the review board includes the textured pair.
    names=['새싹 들판','굽이굽이 바다','별빛 하늘']
    catalogue=dict(schemaVersion=3,contentVersion='postal-world-art-1',status='draft',contentScope='presentation-only',playable=False,
        missing=['map.nodes.words','vocabulary-allocation','sideActivities','finale-rules','progress-migration'],
        source=dict(path='docs/WORLD_BIBLE.md',sha256=hashlib.sha256(BIBLE.read_bytes()).hexdigest()),
        counts=dict(continents=3,worlds=30,bossSprites=180,decorationAliases=6,assignedCards=0),
        assetPack=dict(sheet='assets/postal/world-pixels/sprites.svg',manifest='assets/postal/world-pixels/manifest.json'),
        continents=[dict(id=f'c{i}',band=f'P{i}',name=names[i-1],worlds=[w for w in worlds if w['id'].startswith(f'p{i}-')]) for i in range(1,4)])
    entries={sid:{k:v for k,v in value.items() if k!='pixels'}|dict(size=16,grid=16,frames=[sid]) for sid,value in sprites.items()}
    manifest=dict(version='postal-world-art-1',license='Original project pixel artwork. No platform emoji images included.',
        sheet='sprites.svg',symbols=entries,worldVars=list(variables(worlds[0]['palette'])),
        emojiToSprite={s['emoji']:sid for sid,s in sprites.items() if s['role']=='boss'},
        decorations=decor,deviceVerification=dict(iPadOS='unverified',nativeEmoji='manual-review-required'))
    symbols=''.join(f'<symbol id="{sid}" viewBox="0 0 16 16">{runs(s["pixels"])}</symbol>\n' for sid,s in sprites.items())
    sheet='<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><defs>\n'+symbols+'</defs></svg>\n'
    source=dict(grid=16,palette=art.PAL,sprites=sprites)
    validate(catalogue,source,manifest)
    dump=lambda x:json.dumps(x,ensure_ascii=False,indent=2)+'\n'
    return {Path('cards/data/world-art.json'):dump(catalogue),ASSETS/'manifest.json':dump(manifest),ASSETS/'sprites.svg':sheet,SOURCE:dump(source)}

def validate(catalogue,source,manifest):
    worlds=[w for c in catalogue['continents'] for w in c['worlds']]
    assert len(worlds)==30 and [len(c['worlds']) for c in catalogue['continents']]==[8,15,7]
    assert len({w['id'] for w in worlds})==30
    assert catalogue['status']=='draft' and not catalogue['playable'] and catalogue['counts']['assignedCards']==0
    assert len(manifest['emojiToSprite'])==180
    boss_hashes=set()
    for sid,s in source['sprites'].items():
        rows=s['pixels'];assert len(rows)==16 and all(len(row)==16 for row in rows),sid
        assert set(''.join(rows))<=set(art.PAL)|{'.'} and any(c!='.' for row in rows for c in row),sid
        if s['role']=='boss':boss_hashes.add(''.join(rows))
    assert len(boss_hashes)==180,'Duplicate boss drawing'
    assert {sid for sid,s in source['sprites'].items() if s['role']=='effect'} == {'fx-storm-a','fx-storm-b','fx-storm-letters','fx-storm-gone'}
    required={'--w-ground','--w-ground-d','--w-ground-l','--w-path','--w-path-d','--w-path-l','--w-sky','--w-sky-l'}
    for w in worlds:
        assert set(w['paletteVars'])==required
        assert contrast(w['palette']['ground'],w['palette']['path'])>=3,w['id']
        assert len(w['bossSprites'])==6
        for emoji,sid in zip(w['bossEmoji'],w['bossSprites']):assert manifest['emojiToSprite'][emoji]==sid
        for m in [*w['routes'],w['castle'],w['key']]:assert m['spriteId'] in w['bossSprites']
        assert 'map' not in w # do not disguise an unallocated map as a playable world
    for alias,target in manifest['decorations'].items():assert source['sprites'][alias]['pixels']==source['sprites'][target]['pixels']

def feedback_assets():
    """Original C-011 drawings, independent of the immutable world/boss catalogue."""
    sprites={}
    def store(sid,label,p,role='effect',frames=None):
        rows=p.finish()
        assert len(rows)==16 and all(len(row)==16 for row in rows)
        sprites[sid]=dict(role=role,label=label,pixels=rows,size=16,grid=16,frames=frames or [sid])
    p=art.Pixels();p.rect(4,3,8,9,'u');p.rect(2,6,12,5,'u');p.rect(4,2,2,2,'v');p.rect(10,2,2,2,'v');p.rect(4,12,3,2,'v');p.rect(9,12,3,2,'v');p.rect(5,6,2,2,'w');p.rect(9,6,2,2,'w');p.dot(6,7,'k');p.dot(9,7,'k');p.rect(7,10,2,1,'k');store('c011-monster','편지길 몬스터',p,'boss')
    for opened in (False,True):
        p=art.Pixels();p.rect(3,2,10,12,'b');p.rect(4,3,8,10,'g');p.rect(5,4,6,9,'k');p.rect(5,13,7,1,'y')
        if opened:
            p.poly([(5,4),(9,5),(9,11),(5,13)],'t');p.rect(7,7,1,2,'y')
        else:
            p.rect(5,4,6,9,'t');p.rect(7,6,3,4,'g');p.rect(8,5,1,2,'y');p.dot(8,8,'k')
        store('c011-door-'+('open' if opened else 'locked'),'열린 문' if opened else '자물쇠 문',p,'door')
    for opened in (False,True):
        p=art.Pixels();p.rect(3,7,10,7,'r');p.rect(7,7,2,7,'y');p.rect(2,6,12,2,'g')
        if opened:
            p.rect(2,2,12,2,'g');p.rect(7,2,2,2,'y');p.rect(5,4,6,3,'w');p.dot(3,4,'y');p.dot(12,4,'y')
        else:
            p.rect(5,3,2,3,'y');p.rect(9,3,2,3,'y');p.rect(7,4,2,2,'g')
        store('c011-gift-'+('open' if opened else 'closed'),'열린 선물' if opened else '배달부 선물',p,'gift')
    for large in (False,True):
        p=art.Pixels();p.rect(3,5,10,9,'n');p.rect(2,3,3,11,'l');p.rect(11,3,3,11,'l');p.rect(6,3 if large else 5,4,11 if large else 9,'e');p.rect(7,10,2,4,'t');p.rect(3,6,1,2,'k');p.rect(12,6,1,2,'k')
        for x in (2,4,6,9,11,13):p.rect(x,2 if large else 3,1,2,'g')
        if large:p.rect(7,0,1,3,'b');p.rect(8,0,3,2,'r')
        store('c011-castle-'+('continent' if large else 'world'),'대륙의 큰 성' if large else '편지길 성',p,'castle')
    for kind,label in [('leaf','새싹 대륙'),('wave','물결 대륙'),('star','별빛 대륙')]:
        p=art.Pixels();p.poly([(2,9),(4,6),(11,5),(14,9),(11,13),(4,13)],'b');p.poly([(2,8),(5,4),(10,4),(14,8),(11,11),(5,11)],'l' if kind=='leaf' else 'a' if kind=='wave' else 'u')
        if kind=='leaf':p.rect(7,4,1,5,'t');p.rect(5,4,2,2,'y');p.rect(8,2,2,3,'g')
        if kind=='wave':p.line(4,7,7,7,'w');p.line(7,6,10,6,'w');p.line(6,9,10,9,'e')
        if kind=='star':p.rect(7,3,2,6,'y');p.rect(5,5,6,2,'y');p.dot(4,4,'w');p.dot(12,8,'w')
        store('c011-island-'+kind,label,p,'continent')
    outfits=[('leaf-cap','잎사귀 모자','t','b'),('sun-bag','햇살 가방','t','g'),('sea-coat','물결 옷','a','b'),('night-cap','밤하늘 모자','u','b'),('letter-bag','편지 가방','t','u'),('festival-coat','축제 옷','p','g')]
    # The outfit colours and insignia are new, applied to the original courier
    # outline and poses. All frames keep its 48-unit geometry and foot position.
    master=ET.parse(ROOT/'assets/post-office/v1/sprites.svg')
    original={node.get('id'):node for node in master.iter() if node.get('id')}
    outfit_bodies={}
    for name,label,coat,bag in outfits:
        ids=[f'c011-look-{name}-{frame}' for frame in ('idle','walk1')]
        for frame,sid in zip(('idle','walk1'),ids):
            rects=[]
            for rect in original['courier-teal-'+frame]:
                x,y,w,h=(int(rect.get(k)) for k in ('x','y','width','height'))
                color=rect.get('fill')
                if color=='#387D74':color=art.PAL[coat]
                if x==29 and y==27:color=art.PAL[bag]
                rects.append((x,y,w,h,color))
            badge={
                'leaf-cap':[(21,5,4,2,'l'),(23,4,2,2,'l')],
                'sun-bag':[(31,28,4,4,'y'),(32,27,2,6,'y')],
                'sea-coat':[(13,23,5,2,'a'),(13,27,5,2,'a')],
                'night-cap':[(22,5,2,4,'y'),(21,6,4,2,'y')],
                'letter-bag':[(30,29,6,4,'w'),(32,30,2,1,'r')],
                'festival-coat':[(13,23,2,2,'y'),(13,27,2,2,'y')]
            }[name]
            rects.extend((x,y,w,h,art.PAL[c]) for x,y,w,h,c in badge)
            # Store matching 16-pixel previews alongside higher-resolution bodies.
            palette=art.PAL | {'s':'#E8B78B','h':'#D8D7BA'}
            codes={c:k for k,c in palette.items()}
            grid=[['.']*16 for _ in range(16)]
            for x,y,w,h,color in rects:
                for py in range(16):
                    for px in range(16):
                        if x<=3*px+1<x+w and y<=3*py+1<y+h:
                            grid[py][px]=codes[color]
            sprites[sid]=dict(role='courier',label=label+(' · 걷기' if frame=='walk1' else ' · 서기'),
                pixels=[''.join(row) for row in grid],size=16,grid=16,frames=ids)
            outfit_bodies[sid]='<g transform="scale(0.3333333333)">' + ''.join(
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>' for x,y,w,h,c in rects) + '</g>'
    assert len(sprites)==22
    manifest=dict(version='postal-feedback-1',license='Original project pixel artwork; no external artwork or emoji rasterization.',sheet='sprites.svg',grid=16,palette=palette,symbols=sprites)
    symbols=''.join(f'<symbol id="{sid}" viewBox="0 0 16 16">'+(outfit_bodies[sid] if sid in outfit_bodies else runs(s["pixels"]))+'</symbol>\n' for sid,s in sprites.items())
    sheet='<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><defs>\n'+symbols+'</defs></svg>\n'
    return {Path('cards/assets/postal/feedback/manifest.json'):json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',Path('cards/assets/postal/feedback/sprites.svg'):sheet}

def stamp_assets():
    """Two original, lettered 16-grid gate stamps; separate from playhouse stamps."""
    symbols={}
    letters={'a':['.##.','#..#','#..#','####','#..#','#..#'], 'b':['###.','#..#','###.','#..#','#..#','###.']}
    for key,color in [('a','t'),('b','p')]:
        p=art.Pixels();p.rect(1,1,14,14,'k');p.rect(2,2,12,12,'w');p.rect(3,3,10,10,color)
        for z in (2,6,10,14):p.dot(0,z,'w');p.dot(15,z,'w');p.dot(z,0,'w');p.dot(z,15,'w')
        for y,row in enumerate(letters[key]):
            for x,value in enumerate(row):
                if value=='#':p.dot(x+6,y+5,'w')
        symbols['c013-stamp-'+key]=dict(role='gate-stamp',label='관문 우표 '+key.upper(),size=16,grid=16,pixels=p.finish())
    manifest=dict(version='postal-gate-stamps-1',license='Original project pixel artwork.',sheet='sprites.svg',grid=16,palette=art.PAL,symbols=symbols)
    sheet='<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><defs>\n'+''.join(f'<symbol id="{sid}" viewBox="0 0 16 16">{runs(s["pixels"])}</symbol>\n' for sid,s in symbols.items())+'</defs></svg>\n'
    return {Path('cards/assets/postal/stamps/manifest.json'):json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',Path('cards/assets/postal/stamps/sprites.svg'):sheet}

def wardrobe_assets():
    """Original modular postal couriers and exploration rewards on a 48-unit grid."""
    import html
    parts = []
    ink, skin, cream = '#233F3A', '#E8B78B', '#FFF0CA'
    teal, gold, brown, coral = '#387D74', '#EAB65C', '#98664B', '#CC6651'
    colors = [teal, coral, '#6A5683']
    def rect(x, y, w, h, color):
        return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}"/>'
    def shape(sid, body):
        parts.append(f'<symbol id="{html.escape(sid)}" viewBox="0 0 48 48">{body}</symbol>')
    def pixels(rects):
        return ''.join(rect(*r) for r in rects)
    # The common pose occupies the same head/body bounds as the existing 48-unit courier.
    for variant, cap in [('teal',teal),('gold',gold)]:
        for action in ('idle','walk'):
            for frame in range(4):
                left = [12,11,12,13][frame] if action=='walk' else 12
                right = [25,26,25,24][frame] if action=='walk' else 25
                body=pixels([(10,40,25,3,'#D8D7BA'),(left,35,7,5,ink),(right,35,7,5,ink),
                    (14,29,6,8,teal),(24,29,6,8,teal),(10,20,24,13,ink),(12,21,20,10,cream),
                    (8,24,4,8,ink),(8,25,3,6,skin)])
                if action=='idle' and frame==3: body+=rect(25,34,7,1,gold)
                if action=='walk' and frame==2: body+=rect(13,36,3,1,cream)
                if action=='walk' and frame==3: body+=rect(26,36,3,1,cream)
                shape(f'c016-body-{variant}-{action}{frame}',body)
                face=pixels([(11,9,22,14,ink),(13,10,18,12,skin),(20,19,5,1,brown)])
                if action=='idle' and frame==1:
                    face+=pixels([(16,15,3,1,ink),(26,15,3,1,ink)])
                elif action=='idle' and frame==2:
                    face+=pixels([(18,14,2,3,ink),(28,14,2,3,ink)])
                else:
                    face+=pixels([(16,14,2,3,ink),(26,14,2,3,ink)])
                shape(f'c016-head-{variant}-{action}{frame}',face)
        shape(f'c016-coat-default-{variant}',pixels([(13,22,5,9,cap),(27,22,4,9,cap)]))
        shape(f'c016-bag-default-{variant}',pixels([(14,22,3,2,brown),(17,23,3,2,brown),(20,24,3,2,brown),(23,25,3,2,brown),(26,26,3,2,brown),(28,26,10,10,ink),(29,27,8,8,brown),(29,27,8,3,gold),(32,30,2,2,cream)]))
        shape(f'c016-hat-default-{variant}',pixels([(12,3,20,7,ink),(14,4,16,6,cap),(9,9,27,3,ink),(10,9,25,2,cap),(19,5,8,4,cream),(20,6,6,1,gold)]))

    worlds=[f'p1-{i:02}' for i in range(1,9)]+[f'p2-{i:02}' for i in range(1,16)]+[f'p3-{i:02}' for i in range(1,8)]
    # Repeated motif geometry is combined with ten individually distinct badge patterns per slot.
    motifs=[
        [(16,6,3,2),(19,4,3,3)], [(17,5,2,3),(20,7,4,2)],
        [(15,6,2,2),(18,5,3,2),(22,6,2,2)], [(18,4,5,1),(17,6,7,1)],
        [(16,7,2,2),(19,5,2,3),(22,6,2,2)], [(16,5,6,2),(18,7,2,2)],
        [(16,6,8,1),(18,4,4,2)], [(16,5,2,2),(19,5,2,2),(22,5,2,2)],
        [(18,4,4,4),(17,5,6,2)], [(15,5,3,3),(20,5,3,3)]]
    for index,wid in enumerate(worlds):
        slot=('hat','bag','coat')[index%3]; design=index//3
        for color_index,color in enumerate(colors):
            accent=[gold,cream,'#B4A0C8'][color_index]
            if slot=='hat':
                body=pixels([(12,3,20,7,ink),(14,4,16,6,color),(9,9,27,3,ink),(10,9,25,2,color)])
                body+=pixels([(x,y,ww,hh,accent) for x,y,ww,hh in motifs[design]])
            elif slot=='bag':
                body=pixels([(14,22,3,2,brown),(17,23,3,2,brown),(20,24,3,2,brown),(23,25,3,2,brown),(26,26,3,2,brown),
                    (28,26,10,10,ink),(29,27,8,8,color),(29,27,8,2,accent)])
                body+=pixels([(29+(x-15),29+(y-4),max(1,ww//2),max(1,hh//2),accent) for x,y,ww,hh in motifs[design]])
            else:
                body=pixels([(12,21,20,10,color),(13,22,5,9,color),(27,22,4,9,color),
                    (20,21,2,10,accent)])
                body+=pixels([(13+(x-15),23+(y-4),max(1,ww//2),max(1,hh//2),accent) for x,y,ww,hh in motifs[design]])
            shape(f'c016-{slot}-{wid}-{color_index}',body)
    for legacy,coat,bag in [('leaf-cap',teal,brown),('sun-bag',teal,gold),('sea-coat','#7BC4D0',brown),('night-cap','#927BAB',brown),('letter-bag',teal,'#927BAB'),('festival-coat','#E89AA8',gold)]:
        for color_index in range(3):
            color=[coat,coral,'#6A5683'][color_index]
            body=pixels([(12,21,20,10,color),(13,22,5,9,color),(27,22,4,9,color),(20,21,2,10,bag),(23,24,3,3,cream)])
            shape(f'c016-coat-legacy-{legacy}-{color_index}',body)

    for cid,body in [
        ('c1',pixels([(4,34,12,10,ink),(7,36,6,6,cream),(31,34,12,10,ink),(34,36,6,6,cream),(10,30,25,3,teal),(18,25,4,8,coral),(30,25,4,8,gold)])),
        ('c2',pixels([(3,31,42,5,ink),(6,36,36,5,brown),(10,41,27,3,ink),(18,28,12,4,cream),(22,26,4,3,coral)])),
        ('c3',pixels([(6,24,36,6,ink),(9,25,30,4,coral),(16,30,2,9,brown),(30,30,2,9,brown),(14,39,20,5,ink),(17,40,14,3,gold)]))
    ]:
        shape(f'c016-ride-{cid}-idle',body)
        shape(f'c016-ride-{cid}-move',body+pixels([(3,44,8,1,cream),(35,44,8,1,cream)]))
    for pet in ('snail','lizard','moth'):
        for frame in range(2):
            if pet=='snail':
                body=pixels([(10,27,27,8,ink),(12,26,22,7,teal),(17,17,14,12,ink),(19,19,10,8,gold),(22,21,5,2,coral),(32,22-frame,3,7,ink),(34,20-frame,3,3,cream)])
            elif pet=='lizard':
                body=pixels([(10,26,25,7,ink),(12,25,21,6,'#77B4A0'),(31,21,7,8,teal),(34,22,2,2,cream),(7,24+frame,6,3,coral),(15,32,4,3,ink),(27,32,4,3,ink)])
            else:
                body=pixels([(21,19,6,15,ink),(23,20,2,12,gold),(10,18+frame,11,10,coral),(27,18+frame,11,10,coral),(13,20+frame,6,5,cream),(29,20+frame,6,5,cream),(19,14,2,5,ink),(27,14,2,5,ink)])
            shape(f'c016-pet-{pet}-{frame}',body)
    sheet='<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><defs>'+''.join(parts)+'</defs></svg>\n'
    return {Path('cards/assets/postal/wardrobe/sprites.svg'):sheet}


def atlas_assets():
    """Original three hand-composed continental postage maps."""
    fields = {
        'p1': ('#acd6ce', '#83b89c', '#c8dfa4', [
            '5,26 15,26 15,15 33,15 33,11 44,11 44,22 61,22 61,33 72,33 72,50 60,50 60,59 43,59 43,67 12,67 12,58 5,58',
            '29,61 45,61 45,53 62,53 62,47 75,47 75,30 84,30 84,12 97,12 97,44 89,44 89,63 78,63 78,80 62,80 62,90 37,90 37,82 29,82']),
        'p2': ('#9bc9d1', '#659ba2', '#b7d4af', [
            '3,8 26,8 26,13 47,13 47,8 77,8 77,13 95,13 95,33 78,33 78,39 58,39 58,32 40,32 40,38 22,38 22,32 3,32',
            '6,40 28,40 28,44 48,44 48,37 68,37 68,43 96,43 96,58 78,58 78,65 52,65 52,60 32,60 32,64 17,64 17,76 4,76 4,57 6,57',
            '16,67 35,67 35,62 61,62 61,69 95,69 95,90 75,90 75,95 53,95 53,88 32,88 32,93 16,93']),
        'p3': ('#d0cce7', '#a995bc', '#e4cc9d', [
            '4,59 16,59 16,51 28,51 28,26 42,26 42,14 64,14 64,22 77,22 77,31 86,31 86,40 97,40 97,63 92,63 92,79 84,79 84,89 58,89 58,81 47,81 47,74 35,74 35,85 12,85 12,91 4,91']),
    }
    parts = []
    for band, (water, shore, ground, shapes) in fields.items():
        body = f'<rect width="100" height="100" fill="{water}"/>'
        for y in (6, 21, 38, 55, 73, 91):
            for x in (2, 19, 37, 58, 80, 95):
                body += f'<path d="M{x} {y}h3m-2 2h4" stroke="#fff6dc" opacity=".55" stroke-width=".35"/>'
        for points in shapes:
            body += f'<polygon points="{points}" fill="{shore}" transform="translate(0 2)"/>'
            body += f'<polygon points="{points}" fill="{ground}" stroke="{shore}" stroke-width=".65"/>'
            body += f'<polygon points="{points}" fill="url(#atlas-grain)"/>'
        parts.append(f'<symbol id="c015-atlas-{band}" viewBox="0 0 100 100" preserveAspectRatio="none">{body}</symbol>')
    p=art.Pixels()
    p.rect(1,12,14,2,'b'); p.rect(4,7,8,6,'k'); p.rect(5,8,6,4,'c')
    p.poly([(2,7),(5,4),(8,2),(11,4),(14,7)],'k')
    p.poly([(4,7),(7,4),(9,4),(12,7)],'r')
    p.rect(7,9,2,3,'t'); p.rect(11,8,3,2,'r'); p.dot(12,8,'y')
    parts.append(f'<symbol id="c015-village" viewBox="0 0 16 16">{runs(p.finish())}</symbol>')
    sheet = ('<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><defs>'
             '<pattern id="atlas-grain" width="4" height="5" patternUnits="userSpaceOnUse"><path d="M1 1h.45v.5H1Z M3 4h.3v.35H3Z" fill="#233F3A" opacity=".15"/></pattern>'
             + ''.join(parts) + '</defs></svg>\n')
    return {Path('cards/assets/postal/atlas/sprites.svg'):sheet}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    files=build() | feedback_assets() | stamp_assets() | wardrobe_assets() | atlas_assets()
    for path,content in files.items():
        full=ROOT/path
        if args.check:
            if not full.exists() or full.read_text(encoding='utf-8')!=content:raise SystemExit(f'Stale asset: {path}')
        else:full.parent.mkdir(parents=True,exist_ok=True);full.write_text(content,encoding='utf-8')
    print(('CHECK' if args.check else 'BUILT')+': 30 palettes, 180 distinct boss drawings, 6 scenery aliases, 0 assigned cards')
if __name__=='__main__':main()
