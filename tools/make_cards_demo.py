"""Build the 60-word flashcard prototype deck from the reference vocabulary DB (read-only).
Writes cards/data/words.json and cards/audio/words.tsv (id <TAB> text, input for tools/cards_say_audio.sh).
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

# Pictures the DB does not have. Prototype additions, shown on the back of the card only (never as answer choices).
EXTRA = {'animal': '🐾', 'bird': '🐦', 'hand': '✋', 'eat': '🍽️', 'sing': '🎤', 'swim': '🏊', 'family': '👨‍👩‍👧', 'morning': '🌅',
         'music': '🎵', 'forest': '🌲', 'village': '🏘️', 'strong': '💪', 'quiet': '🤫', 'giggle': '🤭', 'dangerous': '⚠️'}
lemma = {x['id']: x for x in db['lemmas']}
prim = {c['card_form']: c for c in db['cards'] if c['sense_order'] == 1 and c['kind'] == '기본' and c['track'] == 'vocab'}
gloss = collections.Counter(c['single_meaning_ko'] for c in prim.values())
ipa = collections.Counter(c['ipa_us'] for c in db['cards'] if c['ipa_us'])

def card(form, group):
    c = prim[form]; lm = lemma[c['lemma_link']]
    assert lm['old_priority'] == 'P1', form
    assert c['single_meaning_ko'] and gloss[c['single_meaning_ko']] == 1, (form, 'gloss not unique')
    assert ipa[c['ipa_us']] == 1, (form, 'homophone')
    return {'id': c['card_id'], 'form': form, 'ko': c['single_meaning_ko'], 'emoji': db['pictures'].get(form) or EXTRA.get(form, ''),
            'type': c['image_type'], 'theme': lm['theme'], 'group': group}

groups = [[card(f, 'easy') for f in EASY], [card(f, 'thing') for f in THINGS],
          [card(f, 'action') for f in ACTIONS], [card(f, 'other') for f in OTHERS]]
# Queue order: one easy word, then three harder ones, so every run mixes known and unknown words.
hard = []
for i in range(max(len(g) for g in groups[1:])):
    for g in groups[1:]:
        if i < len(g): hard.append(g[i])
order = []
e = list(groups[0])
while e or hard:
    if e: order.append(e.pop(0))
    for _ in range(3):
        if hard: order.append(hard.pop(0))
assert len(order) == 60 and len({w['id'] for w in order}) == 60
# World map: three roads of two tiles each, then the castle. Words are assigned so every tile mixes known and unknown words.
by = {w['form']: w['id'] for w in order}
def ids(forms): return [by[f] for f in forms]
easy, things, acts, others = EASY, THINGS, ACTIONS, OTHERS
ROADS = [
    ('A', '물건·자연 길', '🌲', [things[:11], things[11:]]),
    ('B', '행동 길', '🏃', [acts[:6] + easy[:3], acts[6:] + easy[3:6]]),
    ('C', '느낌·모양 길', '🌈', [others[:6] + easy[6:10], others[6:] + easy[10:]]),
]
world = {'id': 'w1', 'title': '단어 마을', 'castleNeeds': 2, 'roads': [
    {'id': rid, 'name': nm, 'icon': ic, 'tiles': [{'id': f'{rid}{i + 1}', 'words': ids(fs)} for i, fs in enumerate(tiles)]} for rid, nm, ic, tiles in ROADS]}
used = [w for r in world['roads'] for t in r['tiles'] for w in t['words']]
assert sorted(used) == sorted(w['id'] for w in order), 'every word belongs to exactly one tile'
out = ROOT / 'cards/data'; out.mkdir(parents=True, exist_ok=True)
(out / 'words.json').write_text(json.dumps({'note': '시제품용 60단어. 원본 DB의 P1에서 선별.', 'world': world, 'words': order}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
aud = ROOT / 'cards/audio'; aud.mkdir(parents=True, exist_ok=True)
(aud / 'words.tsv').write_text(''.join(f"{i:02d}\t{w['id']}\t{w['form']}\n" for i, w in enumerate(order)), encoding='utf-8')
print('cards deck written:', len(order), 'words;', sum(1 for w in order if w['emoji']), 'with emoji')
