"""Package a self-contained review board, with no HTTP/font dependencies."""
from pathlib import Path
import argparse,json
ROOT=Path(__file__).resolve().parents[1]
def package():
    page=ROOT/'cards/art-review'
    data=json.loads((ROOT/'cards/data/world-art.json').read_text())
    assets=ROOT/'cards/assets/postal'
    bundle=dict(data=data,manifest=json.loads((assets/'world-pixels/manifest.json').read_text()),
                sheet=(assets/'world-pixels/sprites.svg').read_text(),terrain=(assets/'sprites.svg').read_text())
    embedded=json.dumps(bundle,ensure_ascii=False).replace('<','\\u003c')
    html=(page/'index.html').read_text().replace('<link rel="stylesheet" href="style.css">','<style>'+(page/'style.css').read_text()+'</style>')
    return html.replace('<script src="app.js"></script>','<script id="review-data" type="application/json">'+embedded+'</script><script>'+(page/'app.js').read_text()+'</script>')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(package(),encoding='utf-8');print(args.output)
