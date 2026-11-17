"""Build the presentation-only worlds catalogue and original pixel asset pack.
No vocabulary allocation, runtime code, state or audio is read/written.
python3 -I tools/build_world_pixel_assets.py [--check]
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, re, sys
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
    for name,label,coat,bag in outfits:
        ids=[f'c011-look-{name}-{frame}' for frame in ('idle','walk1')]
        for frame,sid in zip(('idle','walk1'),ids):
            p=art.Pixels();p.rect(5,2,6,4,'y');p.rect(4,1,8,2,'u' if name=='night-cap' else 't');p.rect(3,3,9,1,'u' if name=='night-cap' else 't');p.dot(9,4,'k');p.rect(5,7,6,5,coat);p.rect(4,7,2,4,'y');p.rect(9,8,4,4,bag);p.line(6,7,10,10,'g');p.rect(6,12,2,2,'b');p.rect(9,12,2,2,'b')
            if frame=='walk1':p.rect(5,13,3,1,'k');p.rect(10,12,2,2,'k');p.dot(12,9,'g')
            else:p.rect(6,14,2,1,'k');p.rect(9,14,2,1,'k')
            if name=='leaf-cap':p.rect(6,0,2,1,'l');p.rect(8,0,1,2,'l')
            if name=='sun-bag':p.rect(10,9,2,2,'y');p.dot(9,10,'w');p.dot(12,10,'w')
            if name=='sea-coat':p.line(6,8,8,8,'w');p.line(6,10,8,10,'w')
            if name=='night-cap':p.rect(6,1,3,1,'y');p.dot(7,0,'y');p.dot(7,2,'y')
            if name=='letter-bag':p.rect(10,9,2,2,'w');p.dot(11,9,'r')
            if name=='festival-coat':p.dot(7,8,'g');p.dot(7,10,'g');p.rect(5,11,5,1,'u')
            store(sid,label+(' · 걷기' if frame=='walk1' else ' · 서기'),p,'courier',ids)
    assert len(sprites)==22
    manifest=dict(version='postal-feedback-1',license='Original project pixel artwork; no external artwork or emoji rasterization.',sheet='sprites.svg',grid=16,palette=art.PAL,symbols=sprites)
    symbols=''.join(f'<symbol id="{sid}" viewBox="0 0 16 16">{runs(s["pixels"])}</symbol>\n' for sid,s in sprites.items())
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

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    files=build() | feedback_assets() | stamp_assets()
    for path,content in files.items():
        full=ROOT/path
        if args.check:
            if not full.exists() or full.read_text(encoding='utf-8')!=content:raise SystemExit(f'Stale asset: {path}')
        else:full.parent.mkdir(parents=True,exist_ok=True);full.write_text(content,encoding='utf-8')
    print(('CHECK' if args.check else 'BUILT')+': 30 palettes, 180 distinct boss drawings, 6 scenery aliases, 0 assigned cards')
if __name__=='__main__':main()
