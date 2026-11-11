"""Load a parent-curated list of sample pages from a JSON manifest."""
import argparse, json
from pathlib import Path
import core

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('manifest',type=Path)
    ap.add_argument('--db',type=Path,default=core.ROOT/'family_state.sqlite3')
    a=ap.parse_args()
    books=json.loads(a.manifest.read_text(encoding='utf-8'))
    with core.db(a.db) as c:
        for b in books:
            if not 1<=len(b['pages'])<=20:raise ValueError('책별 표본 1~20쪽을 준비하세요.')
            items=[]
            for p in b['pages']:
                source=a.manifest.parent/p['file']
                text=source.read_text(encoding='utf-8') if source.suffix.lower()=='.txt' else core.ocr(source.name,source.read_bytes())
                items.append((str(p['page']),text))
            core.save_book(c,b['id'],b['title'],items)
            print(b['id'],b['title'],len(items))

if __name__=='__main__':main()
