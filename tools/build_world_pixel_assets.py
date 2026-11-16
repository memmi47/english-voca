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

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    files=build()
    for path,content in files.items():
        full=ROOT/path
        if args.check:
            if not full.exists() or full.read_text(encoding='utf-8')!=content:raise SystemExit(f'Stale asset: {path}')
        else:full.parent.mkdir(parents=True,exist_ok=True);full.write_text(content,encoding='utf-8')
    print(('CHECK' if args.check else 'BUILT')+': 30 palettes, 180 distinct boss drawings, 6 scenery aliases, 0 assigned cards')
if __name__=='__main__':main()
