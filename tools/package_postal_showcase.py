"""Package the art/play demo as one offline HTML and a source ZIP.
python3 -I tools/package_postal_showcase.py --output /workspace/scratch/postal-showcase
Word files remain external: offline HTML uses device speech and server mode supports --audio-dir.
"""
from pathlib import Path
import argparse,base64,json,re,zipfile
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--reference-image',type=Path);a=p.parse_args();out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
base=ROOT/'assets/post-office/v1';app=ROOT/'showcase/post-office';manifest=json.loads((base/'manifest.json').read_text())
def uri(path,mime):return f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode()
for m in manifest['music'].values():m['src']=uri(base/m['src'],'audio/mp4');m['midi']=uri(base/m['midi'],'audio/midi')
manifest['sfx']={id:uri(base/path,'audio/wav') for id,path in manifest['sfx'].items()}
css=(app/'style.css').read_text()
for name in ['Galmuri11.woff2','Galmuri11-Bold.woff2']:css=css.replace('../../cards/fonts/'+name,uri(ROOT/'cards/fonts'/name,'font/woff2'))
def js_json(v):return json.dumps(v,ensure_ascii=False).replace('<','\\u003c')
bundle='const BUNDLED_SVG='+js_json((base/'sprites.svg').read_text())+';\nconst BUNDLED_MANIFEST='+js_json(manifest)+';\nconst BUNDLED_WORLDS='+js_json(json.loads((app/'worlds-demo.json').read_text()))+';\nconst BUNDLE_DOWNLOADS='+js_json({'manifest':uri(base/'manifest.json','application/json'),'sprites':uri(base/'sprites.svg','image/svg+xml')})+';\n'
for src in [ROOT/'cards/js/deck.js',ROOT/'cards/js/sound.js']:
 bundle+=re.sub(r'^export ','',src.read_text(),flags=re.M)+'\n'
code=re.sub(r'^import .*\n','',(app/'app.js').read_text(),flags=re.M).replace("A='../../assets/post-office/v1/'","A=''")
start=code.index('const [s,m,d]=await Promise.all(');end=code.index(";$('#sprites').innerHTML=s",start)
code=code[:start]+'const [s,m,d]=[BUNDLED_SVG,BUNDLED_MANIFEST,BUNDLED_WORLDS]'+code[end:]
code=code.replace("new Sound({base:'/voice/'})","new Sound({base:'/voice/',fetchImpl:async()=>({ok:false})})")
code=code.replace('${A}audio/meadow.mid','${manifest.music.meadow.midi}').replace('${A}audio/play.mid','${manifest.music.play.midi}').replace('${A}manifest.json','${BUNDLE_DOWNLOADS.manifest}').replace('${A}sprites.svg','${BUNDLE_DOWNLOADS.sprites}')
code=code.replace('Mac에서 준비한 파일은 실행 서버의 --audio-dir 옵션으로 연결할 수 있습니다.','이 단독 HTML은 기기 음성으로 체험합니다. Mac의 준비된 음성 파일은 소스 ZIP의 서버로 연결할 수 있습니다.')
html=(app/'index.html').read_text().replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script type="module" src="app.js"></script>','<script type="module">'+(bundle+code).replace('</script','<\\/script')+'</script>')
# Preserve the font license even when a single HTML is copied independently.
license=(ROOT/'cards/fonts/OFL-Galmuri.txt').read_text();html=html.replace('</body>','<template id="font-license">'+license.replace('&','&amp;').replace('<','&lt;')+'</template></body>')
(out/'postal-demo.html').write_text(html)
paths=[*base.rglob('*'),*app.rglob('*'),ROOT/'cards/js/deck.js',ROOT/'cards/js/sound.js',*list((ROOT/'cards/fonts').glob('*')),ROOT/'tools/serve_art_lab.py',ROOT/'tools/build_postal_assets.py',ROOT/'tools/package_postal_showcase.py',ROOT/'tools/check_postal_showcase.cjs']
for optional in ['docs/ART_ASSET_PIPELINE.md','docs/ART_HANDOFF.md']:
 if (ROOT/optional).exists():paths.append(ROOT/optional)
with zipfile.ZipFile(out/'postal-asset-kit.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
 for f in paths:
  if f.is_file():z.write(f,str(f.relative_to(ROOT)))
 reference=a.reference_image or ROOT/'reference/style-reference.png'
 if reference.exists():z.write(reference,'reference/style-reference.png')
 z.write(out/'postal-demo.html','postal-demo.html')
print('Wrote',out/'postal-demo.html', 'and',out/'postal-asset-kit.zip')
