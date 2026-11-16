"""Build the small demo set (tests and offline try-out) from the reference vocabulary DB (read-only).
Writes cards/data/demo/catalog.json and cards/data/demo/worlds.json (schemaVersion 3: two continents, three worlds).
The game loads it with ?set=demo. The full game uses cards/data/catalog.json + worlds(.fixture).json (tools/make_cards_data.py).
Usage: python3 -I tools/make_cards_demo.py
"""
import json, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
db = json.loads((ROOT / 'reference/weekly-tool/vocabulary.json').read_text(encoding='utf-8'))

# Hand-picked from P1: 15 that most early readers know, 45 that many do not. No loanword giveaways
# (cookie, pizza), no words whose first sense is odd, no homophones, no shared Korean gloss.
EASY = 'animal bird horse hand door eat sing swim family happy school morning music give again'.split()
THINGS = 'butterfly frog snake wing finger knee shoulder voice clothes bread breakfast cheese castle village garden kitchen pocket rope wheel forest island noise'.split()
ACTIONS = 'arrive forget imagine pretend protect pull push remember shout breathe giggle peek'.split()
OTHERS = 'dangerous difficult hungry safe strong famous heavy quiet already carefully yesterday'.split()
SIGHT = 'the and because what where they'.split()          # function words: no Korean gloss, "hear it, pick the spelling"

# Pictures the DB does not have. Shown on the back of the card only (never as answer choices).
EXTRA = {'animal': '🐾', 'bird': '🐦', 'hand': '✋', 'eat': '🍽️', 'sing': '🎤', 'swim': '🏊', 'family': '👨‍👩‍👧', 'morning': '🌅',
         'music': '🎵', 'forest': '🌲', 'village': '🏘️', 'strong': '💪', 'quiet': '🤫', 'giggle': '🤭', 'dangerous': '⚠️'}
lemma = {x['id']: x for x in db['lemmas']}
prim = {}
for c in db['cards']:
    if c['sense_order'] == 1 and c['kind'] == '기본': prim.setdefault(c['card_form'], c)
gloss = collections.Counter(c['single_meaning_ko'] for c in prim.values() if c['track'] == 'vocab')
ipa = collections.Counter(c['ipa_us'] for c in db['cards'] if c['ipa_us'])

def card(form, group, band='P1'):
    c = prim[form]; lm = lemma[c['lemma_link']]
    assert lm['old_priority'] == band, form
    if c['track'] == 'sight':
        assert not c['single_meaning_ko'], form
        return {'id': c['card_id'], 'form': form, 'ko': '', 'type': c['image_type'], 'band': band, 'track': 'sight', 'ipa': c['ipa_us'], 'group': group}
    assert c['single_meaning_ko'] and gloss[c['single_meaning_ko']] == 1, (form, 'gloss not unique')
    assert ipa[c['ipa_us']] == 1, (form, 'homophone')
    w = {'id': c['card_id'], 'form': form, 'ko': c['single_meaning_ko'], 'type': c['image_type'], 'band': band, 'track': 'vocab', 'theme': lm['theme'], 'group': group}
    em = db['pictures'].get(form) or EXTRA.get(form, '')
    if em: w['emoji'] = em
    return w

groups = [[card(f, 'easy') for f in EASY], [card(f, 'thing') for f in THINGS], [card(f, 'action') for f in ACTIONS], [card(f, 'other') for f in OTHERS]]
# Deck order: one easy word, then three harder ones, so every run mixes known and unknown words.
hard = []
for i in range(max(len(g) for g in groups[1:])):
    for g in groups[1:]:
        if i < len(g): hard.append(g[i])
order = []; e = list(groups[0])
while e or hard:
    if e: order.append(e.pop(0))
    for _ in range(3):
        if hard: order.append(hard.pop(0))
assert len(order) == 60 and len({w['id'] for w in order}) == 60

# More words for the second world and the second continent: the first plain single words in DB order that pass the same checks.
def more(band, n, taken):
    out = []
    for lm in db['lemmas']:
        if len(out) == n: break
        f = lm['form']; c = prim.get(f)
        if lm['old_priority'] != band or lm['track'] != 'vocab' or not c or f in taken or not f.isalpha() or not f.islower() or lm['pos'] == '표현': continue
        if not c['single_meaning_ko'] or gloss[c['single_meaning_ko']] != 1 or ipa[c['ipa_us']] != 1 or len(f) < 4: continue
        out.append(card(f, 'more', band)); taken.add(f)
    assert len(out) == n; return out
taken = {w['form'] for w in order}
w2 = more('P1', 10, taken); w3 = more('P2', 10, taken); sight = [card(f, 'sight') for f in SIGHT]
words = order + w2 + w3 + sight
assert len({w['id'] for w in words}) == len(words) == 86 and len({w['ko'] for w in words if w['ko']}) == 80

by = {w['form']: w['id'] for w in words}
def ids(forms): return [by[f] for f in forms]
T = THINGS; A = ACTIONS; O = OTHERS; E = EASY
tile = lambda i, x, y, forms: {'id': i, 'kind': 'tile', 'x': x, 'y': y, 'words': ids(forms)}
node = lambda i, k, x, y, **kw: {'id': i, 'kind': k, 'x': x, 'y': y, **kw}
edge = lambda a, b: {'from': a, 'to': b}
game = lambda i, x, y, t, anchor: node(i, 'minigame', x, y, gameType=t, anchorNodeId=anchor, optional=True, reward={'type': 'postcard-stamp', 'id': i})
W1 = {'id': 'd1-01', 'name': '단어 마을', 'title': '단어 마을', 'concept': '첫 편지를 찾아 마을 길을 걷는다.', 'palette': {'sky': '#DFF3FF', 'ground': '#8FCB83', 'path': '#72644A'},
      'bossEmoji': ['🌱', '🌷', '🌻', '🌼', '🌹', '🍀'], 'castle': {'name': '꽃마루 성', 'emoji': '🌼'}, 'key': {'name': '장미 열쇠', 'emoji': '🌹'},
      'intro': '첫 편지가 꽃 사이에 있어. 작은 길부터 걸어 보자!', 'outro': '꽃마루 문이 열렸어. 첫 친구가 손을 흔들어!', 'story': '언덕 너머로 편지가 팔랑거려.',
      'routes': [{'name': '새싹 길', 'icon': '🌱'}, {'name': '꽃잎 길', 'icon': '🌷'}, {'name': '햇살 길', 'icon': '🌻'}],
      'map': {'startNodeId': 'start', 'castleNodeId': 'castle', 'landscape': '들판 산책로', 'nodes': [
          node('start', 'start', 70, 300), tile('A1', 260, 120, T[:10]), tile('A2', 500, 120, T[10:20]),
          tile('B1', 260, 300, A[:6] + E[:3] + T[20:21]), tile('B2', 500, 300, A[6:] + E[3:6] + T[21:22]),
          tile('C1', 260, 480, O[:6] + E[6:10]), tile('C2', 500, 480, O[6:] + E[10:15]),
          node('plaza', 'junction', 720, 300), node('castle', 'castle', 920, 300),
          game('G1', 380, 210, 'memory', 'B1'), game('G2', 640, 500, 'mail', 'C2')],
          'edges': [edge('start', 'A1'), edge('A1', 'A2'), edge('A2', 'plaza'), edge('start', 'B1'), edge('B1', 'B2'), edge('B2', 'plaza'),
                    edge('start', 'C1'), edge('C1', 'C2'), edge('C2', 'plaza'), edge('plaza', 'castle'), edge('B1', 'G1'), edge('C2', 'G2')]},
      'castleRule': {'type': 'reach', 'nodeId': 'castle', 'cards': 12, 'passRate': 0.8},
      'sideActivities': [{'id': 'H1', 'name': '빨리 읽기 집', 'icon': '📖', 'kind': 'sight', 'requiredForCrown': True, 'anchorNodeId': 'A1', 'tiles': [{'id': 'H1-1', 'words': ids(SIGHT)}], 'status': 'ready'}],
      'nextWorldId': 'd1-02', 'status': 'ready'}
W2 = {'id': 'd1-02', 'name': '둘째 마을', 'title': '둘째 마을', 'concept': '과일 상자 사이로 편지를 찾는다.', 'palette': {'sky': '#FFF1D6', 'ground': '#E3B45B', 'path': '#6B5136'},
      'bossEmoji': ['🍎', '🍐', '🍊', '🍋', '🍇', '🍓'], 'castle': {'name': '사과 성', 'emoji': '🍎'}, 'key': {'name': '포도 열쇠', 'emoji': '🍇'},
      'intro': '상자 사이에 편지가 숨었어.', 'outro': '사과 성 문이 열렸어!', 'story': '바닷바람이 불어와.', 'routes': [{'name': '상자 길', 'icon': '📦'}],
      'map': {'startNodeId': 's', 'castleNodeId': 'k', 'landscape': '마을 고리길', 'nodes': [node('s', 'start', 100, 300), tile('T1', 380, 300, [w['form'] for w in w2[:5]]), tile('T2', 660, 300, [w['form'] for w in w2[5:]]), node('k', 'castle', 900, 300)],
              'edges': [edge('s', 'T1'), edge('T1', 'T2'), edge('T2', 'k')]},
      'castleRule': {'type': 'reach', 'nodeId': 'k', 'cards': 6, 'passRate': 0.8}, 'sideActivities': [], 'nextWorldId': None, 'status': 'ready'}
W3 = {'id': 'd2-01', 'name': '바다 마을', 'title': '바다 마을', 'concept': '섬 사이로 편지를 나른다.', 'palette': {'sky': '#D8F1FA', 'ground': '#75B7B1', 'path': '#645943'},
      'bossEmoji': ['🐸', '🐢', '🐟', '🐠', '🐡', '🦆'], 'castle': {'name': '줄무늬 성', 'emoji': '🐠'}, 'key': {'name': '동그란 열쇠', 'emoji': '🐡'},
      'intro': '물 위의 편지를 건져야 해.', 'outro': '둑길이 열렸어!', 'story': '하늘에 별이 떠.', 'routes': [{'name': '폴짝 길', 'icon': '🐸'}],
      'map': {'startNodeId': 's', 'castleNodeId': 'k', 'landscape': '섬과 다리', 'nodes': [node('s', 'start', 100, 300), tile('U1', 450, 220, [w['form'] for w in w3[:5]]), tile('U2', 450, 450, [w['form'] for w in w3[5:]]), node('k', 'castle', 880, 220)],
              'edges': [edge('s', 'U1'), edge('U1', 'k'), edge('s', 'U2')]},
      'castleRule': {'type': 'reach', 'nodeId': 'k', 'cards': 5, 'passRate': 0.8}, 'sideActivities': [], 'nextWorldId': None, 'status': 'ready'}
doc = {'schemaVersion': 3, 'contentVersion': 'demo-1', 'status': 'ready', 'note': '시험·체험용 작은 세계(대륙 2, 세계 3, 카드 86). 전체 게임용이 아니다.',
       'source': {'path': 'reference/weekly-tool/vocabulary.json', 'sha256': None, 'selection': 'hand-picked demo', 'overrideVersion': None},
       'counts': {'lemmas': 86, 'cards': 86, 'continents': 2, 'worlds': 3, 'byBand': {'P1': 76, 'P2': 10}},
       'continents': [{'id': 'd1', 'band': 'P1', 'name': '새싹 들판', 'story': '가까운 친구들을 만나요.', 'worlds': [W1, W2], 'finale': {'cards': 10, 'passRate': 0.7}},
                      {'id': 'd2', 'band': 'P2', 'name': '굽이굽이 바다', 'story': '섬과 섬을 이어요.', 'worlds': [W3], 'finale': {'cards': 6, 'passRate': 0.7}}]}
used = [x for c in doc['continents'] for w in c['worlds'] for n in w['map']['nodes'] for x in n.get('words', [])] + [x for c in doc['continents'] for w in c['worlds'] for h in w['sideActivities'] for t in h['tiles'] for x in t['words']]
assert sorted(used) == sorted(w['id'] for w in words), 'every card belongs to exactly one tile or house'
out = ROOT / 'cards/data/demo'; out.mkdir(parents=True, exist_ok=True)
(out / 'catalog.json').write_text(json.dumps({'note': '시험·체험용 86장. 원본 DB에서 선별.', 'count': len(words), 'words': words}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
(out / 'worlds.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print('demo set written:', len(words), 'cards;', sum(1 for w in words if w.get('emoji')), 'with a picture; 3 worlds')
