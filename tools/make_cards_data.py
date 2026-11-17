"""Build the data files the cards game loads, from the reference vocabulary DB (read-only).

  cards/data/catalog.json          every study card (4,610): id, form, Korean gloss, picture type, band, track, emoji
  cards/audio/words.tsv, forms.tsv the audio lists for tools/cards_say_audio.sh (cards, and word forms from cards/data/forms.json)

The game reads only the real world file cards/data/worlds.json (docs/WORLD_SCHEMA.md); this script no longer writes a
stand-in world file. The provisional assignment below is still computed in memory, because the order of cards/audio/words.tsv
(and so the audio file numbers' order) comes from it; its maps come from tools/preview_world_maps.py.

Usage: python3 -I tools/make_cards_data.py
"""
import json, hashlib, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'reference/weekly-tool/vocabulary.json'
raw = SRC.read_bytes(); db = json.loads(raw); sha = hashlib.sha256(raw).hexdigest()

prim = {}
for c in db['cards']:
    if c['kind'] == '기본' and c['sense_order'] == 1: prim.setdefault(c['lemma_link'], c)
BIG = 10 ** 9
CAM = {'Starters': 0, 'Movers': 1, 'Flyers': 2}
def freq(l):  # children's-text rank, then general rank, then Cambridge level, then nothing (stable on DB order)
    return (l['ndl'] if l['ndl'] is not None else BIG, l['ngsl'] if l['ngsl'] is not None else BIG, CAM.get(l['cam'], 3))

words = []
for l in db['lemmas']:
    if l.get('track') not in ('vocab', 'sight') or l.get('old_priority') not in ('P1', 'P2', 'P3'): continue
    c = prim[l['id']]
    w = {'id': c['card_id'], 'form': c['card_form'], 'ko': c['single_meaning_ko'], 'type': c['image_type'], 'band': l['old_priority'], 'track': l['track']}
    if l['pos'] == '표현': w['phrase'] = True
    if l['track'] == 'sight': w['ipa'] = c['ipa_us']          # hear-and-pick cards must not offer a word that sounds the same
    if db['pictures'].get(c['card_form']): w['emoji'] = db['pictures'][c['card_form']]
    w['_f'] = freq(l); words.append(w)
assert len(words) == 4610 and len({w['id'] for w in words}) == 4610
assert all(w['ko'] for w in words if w['track'] == 'vocab') and all(not w['ko'] for w in words if w['track'] == 'sight')

out = ROOT / 'cards/data'; out.mkdir(parents=True, exist_ok=True)
cat = {'note': '학습 카드 전체. 원본 DB의 대표 카드(kind=기본, sense_order=1)에서 만든 파생 파일. 고칠 때는 원본이 아니라 이 스크립트를 다시 실행한다.',
       'source': {'path': 'reference/weekly-tool/vocabulary.json', 'sha256': sha}, 'count': len(words),
       'words': [{k: v for k, v in w.items() if k != '_f'} for w in words]}
(out / 'catalog.json').write_text(json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

# ---- provisional worlds (kept in memory only, not written): Astra's map sketches + a provisional assignment; fixes the order of words.tsv ----
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run([sys.executable, '-I', str(ROOT / 'tools/preview_world_maps.py'), '--output', tmp], check=True, stdout=subprocess.DEVNULL)
    atlas = json.loads((Path(tmp) / 'atlas-data.json').read_text(encoding='utf-8'))

def split_emoji(s):  # '꽃마루 성 🌼' -> name, emoji
    name, _, em = s.rpartition(' '); return {'name': name, 'emoji': em}
pool = {b: sorted([w for w in words if w['band'] == b and w['track'] == 'vocab'], key=lambda w: w['_f']) for b in ('P1', 'P2', 'P3')}
sight = sorted([w for w in words if w['track'] == 'sight'], key=lambda w: w['_f'])
CONT = [('p1', 'P1', '새싹 들판', '가까운 친구들을 만나 배를 준비해요.'), ('p2', 'P2', '굽이굽이 바다', '섬과 섬을 이으며 하늘길을 찾아요.'), ('p3', 'P3', '별빛 하늘', '남은 편지를 전하고 집으로 돌아와요.')]
continents = []; used = set()
for cid, band, cname, cstory in CONT:
    ws = [a for a in atlas if a['id'].startswith(cid)]; worlds = []
    for i, a in enumerate(ws):
        g = a['graph']; nodes = []
        for n in g['nodes']:
            node = {'id': n['id'], 'kind': n['kind'], 'x': n['x'], 'y': n['y']}
            if n['kind'] == 'tile':
                take, pool[band] = pool[band][:n['cardCount']], pool[band][n['cardCount']:]
                node['words'] = [w['id'] for w in take]; assert 1 <= len(take) <= 10
            if n['kind'] == 'minigame':
                node.update(gameType='memory' if n['gameType'] == 'memory' else 'mail', anchorNodeId=n['anchorNodeId'], optional=True, reward={'type': 'postcard-stamp', 'id': n['id']})
            nodes.append(node)
        side = []
        for k, s in enumerate(a['side']):
            kind = 'sight' if '읽기' in s['name'] else 'phrase'
            if kind == 'sight': take, sight = sight[:s['count']], sight[s['count']:]
            else: take, pool[band] = pool[band][:s['count']], pool[band][s['count']:]
            ids = [w['id'] for w in take]; anchor = next(n['id'] for n in g['nodes'] if n['kind'] == 'tile')
            side.append({'id': f"{a['id']}-house-{k + 1}", 'name': s['name'], 'icon': s['icon'], 'kind': kind, 'requiredForCrown': True, 'anchorNodeId': anchor,
                         'tiles': [{'id': f"{a['id']}-house-{k + 1}-{j // 10 + 1}", 'words': ids[j:j + 10]} for j in range(0, len(ids), 10)], 'status': 'draft'})
        got = [x for n in nodes for x in n.get('words', [])] + [x for s in side for t in s['tiles'] for x in t['words']]
        assert len(got) == a['total'], (a['id'], len(got), a['total']); assert not (set(got) & used); used |= set(got)
        worlds.append({'id': a['id'], 'name': a['name'], 'title': a['name'], 'concept': a['concept'], 'palette': {'sky': a['sky'], 'ground': a['ground'], 'path': a['path']},
                       'bossEmoji': a['bosses'], 'castle': split_emoji(a['castle']), 'key': split_emoji(a['key']), 'intro': a['intro'], 'outro': a['outro'], 'story': a['story'], 'routes': a['roads'],
                       'map': {'startNodeId': g['startNodeId'], 'castleNodeId': g['castleNodeId'], 'landscape': g['landscape'], 'nodes': nodes, 'edges': [{'from': x, 'to': y} for x, y in g['edges']]},
                       'castleRule': {'type': 'reach', 'nodeId': g['castleNodeId'], 'cards': 12, 'passRate': 0.8}, 'sideActivities': side,
                       'nextWorldId': ws[i + 1]['id'] if i + 1 < len(ws) else None, 'status': 'draft'})
    continents.append({'id': cid, 'band': band, 'name': cname, 'story': cstory, 'worlds': worlds, 'finale': {'cards': 40, 'passRate': 0.75}})
assert len(used) == 4610 and not sight and not any(pool.values())

# ---- audio list for tools/cards_say_audio.sh: every card in the order the worlds meet them (number, card id, text) ----
# Numbers follow the catalog (DB order), so a file keeps its name when the world assignment changes.
num = {w['id']: i + 1 for i, w in enumerate(words)}; form = {w['id']: w['form'] for w in words}
order = [x for c in continents for w in c['worlds'] for x in [i for n in w['map']['nodes'] for i in n.get('words', [])] + [i for s in w['sideActivities'] for t in s['tiles'] for i in t['words']]]
aud = ROOT / 'cards/audio'; aud.mkdir(parents=True, exist_ok=True)
(aud / 'words.tsv').write_text(''.join(f"{num[i]:04d}\t{i}\t{form[i]}\n" for i in order), encoding='utf-8')
# Word-form audio list (whirlwind cards, card T-008): one line per form that can be asked (forms whose spelling clashes with
# another card's base word are left out, as in cards/js/storm.js). Number = 'f' + place in cards/data/forms.json, so a file
# keeps its name when forms are added or left out later. Read by tools/cards_say_audio.sh next to words.tsv.
forms = json.loads((out / 'forms.json').read_text(encoding='utf-8'))['forms']
askable = [(k + 1, f) for k, f in enumerate(forms) if f.get('id') and f.get('base') and f.get('baseForm') and f.get('form') and not f.get('clash')]
(aud / 'forms.tsv').write_text(''.join(f"f{k:03d}\t{f['id']}\t{f['form']}\n" for k, f in askable), encoding='utf-8')
print('forms:', len(askable), 'word forms in cards/audio/forms.tsv.', end='  ')
print('catalog:', len(words), 'cards;', sum(1 for w in words if 'emoji' in w), 'with a picture.  provisional order: 30 worlds,', sum(1 for c in continents for w in c['worlds'] for n in w['map']['nodes'] if n['kind'] == 'tile'), 'tiles')
