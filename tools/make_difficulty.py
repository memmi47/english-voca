"""Writes cards/data/difficulty.json: one number per card, higher = harder for a child (rarer word).
Used to pick the hardest passed words for the spot check on the word list (cards/js/map.js triagePlan).

Source (read only): reference/weekly-tool/vocabulary.json, fields per lemma:
  ngsl  rank in the New General Service List (1 = most common)
  ndl   rank in the New Dolch List
  cam   Cambridge Young Learners level (Starters < Movers < Flyers)
Score [heuristic, not a measured difficulty]:
  base = ngsl rank, else 2800 + ndl rank, else 5000 (in neither list: rare)
  a Cambridge level caps it: Starters 600, Movers 1200, Flyers 2000 (children's book words are easier than their general rank)
Run: python3 -I tools/make_difficulty.py          (writes)   --check   (fails if the file would change)
"""
import json, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = json.loads((ROOT / 'reference/weekly-tool/vocabulary.json').read_text(encoding='utf-8'))
lemmas = {x['id']: x for x in src['lemmas']}
CAP = {'Starters': 600, 'Movers': 1200, 'Flyers': 2000}

def score(lemma_id):
    x = lemmas.get(lemma_id) or {}
    base = x['ngsl'] if isinstance(x.get('ngsl'), int) else 2800 + x['ndl'] if isinstance(x.get('ndl'), int) else 5000
    cap = CAP.get(x.get('cam') or '')
    return min(base, cap) if cap else base

ids = set()
for path in ('cards/data/catalogue.json', 'cards/data/demo/catalog.json'):
    for w in json.loads((ROOT / path).read_text(encoding='utf-8'))['words']: ids.add(w['id'])
out = {'note': 'higher = harder (heuristic from NGSL/NDL rank and Cambridge YL level); tools/make_difficulty.py', 'score': {i: score(i.split(':')[0]) for i in sorted(ids)}}
text = json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n'
dest = ROOT / 'cards/data/difficulty.json'
if '--check' in sys.argv:
    if not dest.exists() or dest.read_text(encoding='utf-8') != text: sys.exit('difficulty.json is out of date: run python3 -I tools/make_difficulty.py')
    print('difficulty.json up to date,', len(out['score']), 'cards')
else:
    dest.write_text(text, encoding='utf-8'); print('wrote', dest.relative_to(ROOT), len(out['score']), 'cards')
