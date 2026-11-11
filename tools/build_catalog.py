"""Build game/data/catalog.json from reference/weekly-tool/vocabulary.json.

The source JSON is never modified. Output keeps only the fields the game needs.
Usage: python3 -I tools/build_catalog.py
"""
import json, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'reference/weekly-tool/vocabulary.json'
OUT = ROOT / 'game/data/catalog.json'

d = json.loads(SRC.read_text(encoding='utf-8'))
cards = {}
for c in d['cards']:
    cards[c['card_id']] = {
        'f': c['card_form'], 'l': c['lemma_link'], 'm': c['single_meaning_ko'],
        'd': c['depth_target'], 'i': c['image_type'], 'k': c['track'], 'kd': c['kind'],
        'ipa': c.get('ipa_us') or '', 'ko': c.get('pronunciation_ko') or '',
        's': c['starter_order'] or 0,
    }
out = {
    'source': 'reference/weekly-tool/vocabulary.json',
    'source_sha256': hashlib.sha256(SRC.read_bytes()).hexdigest(),
    'source_stats_sha256': d['stats'].get('source_sha256'),
    'card_count': len(cards),
    'cards': cards,
    'pictures': d['pictures'],
}
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(OUT, OUT.stat().st_size, 'bytes', len(cards), 'cards')
