"""Generate the self-authored demo scene, demo packs (in the weekly tool's export format) and the
audio source list. Demo content is sample data (_sample: true), never real book content.
Usage: python3 -I tools/make_demo.py
"""
import json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
D = ROOT / 'game/data'

def local_id(lemma_link, form, gloss):
    return 'B' + hashlib.sha1((lemma_link + '|' + form + '|' + gloss).encode()).hexdigest()[:18]

CH = local_id('local:chandelier', 'chandelier', '샹들리에')
# Scene objects are tap targets 17% of the scene width: keep centres >=17% apart in x or >=27% in y.
CARDS = [  # (card_id, form, art, depth_target, sentence(self-authored), x%, y%)
    ('W1559:기본:ghost:1', 'ghost', 'ghost', 4, 'The ghost said, "Boo!"', 30, 44),
    ('W2555:기본:owl:1', 'owl', 'owl', 4, 'Hoot, hoot! The owl is awake.', 80, 17),
    ('W3285:기본:shadow:1', 'shadow', 'shadow', 3, 'On the wall, I saw my own shadow.', 48, 72),
    ('W3506:기본:spider:1', 'spider', 'spider', 3, 'The spider has eight legs.', 14, 16),
    ('W0713:기본:cobweb:1', 'cobweb', 'cobweb', 3, 'A fly got stuck in the cobweb.', 90, 50),
    ('W0877:불규칙 과거형:crept:1', 'crept', 'crept', 2, 'Lena crept into the room very quietly.', 14, 74),
    ('W4197:기본:wind:1', 'wind', 'wind', 3, 'The leaves flew away in the strong wind.', 70, 44),
    ('W4198:기본:window:1', 'window', 'window', 4, 'Lena looked out of the window.', 50, 42),
    (CH, 'chandelier', 'chandelier', 3, 'A shiny chandelier hung from the ceiling.', 46, 15),
]
local_cards = [{
    'card_id': CH, 'card_form': 'chandelier', 'lemma_link': 'local:chandelier', 'lemma': 'chandelier',
    'single_meaning_ko': '샹들리에', 'track': 'vocab', 'kind': '본문 표기', 'image_type': '구체명사',
    'depth_target': 3, 'example_sentence': CARDS[-1][4], 'example_source': 'DEMO-HOUSE p.9 (자작)',
    'audio_checked': False, 'audio_file': '', 'sense_order': 1}]

def pack(profile, rows):
    return {'profile': profile, '_sample': True, '_scene': 'haunted-house',
            '_note': '자작 데모 팩. 실제 학원 책 본문이 아님. 주간 도구 /export 형식을 따름.',
            'card_states': {}, 'corpus': {},
            'approved_packs': [{'book': 'DEMO-HOUSE', 'profile': profile, 'card': c[0], 'tier': tier, 'context': c[4],
                                'page': str(i + 1), 'observed_count': 1, 'card_form': c[1], 'depth_target': dt}
                               for i, (c, tier, dt) in enumerate(rows)],
            'local_cards': [x for x in local_cards if any(r[0][0] == x['card_id'] for r in rows)],
            'reviewed_audio': {}}

son = [(c, 'T1', c[3]) for c in CARDS]
daughter = []
for c in CARDS:
    if c[1] == 'chandelier': continue
    tier, dt = ('T2', 3) if c[1] == 'spider' else ('T3', 2) if c[1] == 'cobweb' else ('T1', c[3])
    daughter.append((c, tier, min(dt, c[3])))
(D / 'demo_pack_son.json').write_text(json.dumps(pack('son', son), ensure_ascii=False, indent=1), encoding='utf-8')
(D / 'demo_pack_daughter.json').write_text(json.dumps(pack('daughter', daughter), ensure_ascii=False, indent=1), encoding='utf-8')
# Case text for the detective layer (self-authored). Korean only: it must not pair an English word with its meaning.
CASE = {'title': '유령의 집 사건',
        'brief': '언덕 위 낡은 집에서 밤마다 이상한 소리가 난대요. 집 안을 조사해서 단서를 모으고, 소리의 정체를 밝혀요.',
        'solved': '소리의 정체를 알아냈어요. 범인은 유령이 아니었어요. 열린 창문으로 들어온 바람이 샹들리에를 흔들었던 거예요.',
        'closed': '금고가 열렸어요. 안에는 이 집에 살던 아이의 일기장이 있었어요. 사건 종결!'}
scenes = {'haunted-house': {'title': '유령의 집', 'sample': True,
          'items': [{'card': c[0], 'art': c[2], 'x': c[5], 'y': c[6]} for c in CARDS], 'case': CASE}}
(D / 'scenes.json').write_text(json.dumps(scenes, ensure_ascii=False, indent=1), encoding='utf-8')

# audio source list: one word clip + one sentence clip per card. tts_text lets dev TTS be steered
# (it is NOT a pronunciation claim). Homograph senses must keep distinct keys.
src = {}
for c in CARDS:
    src[c[0]] = {'kind': 'word', 'text': c[1], 'tts_text': c[1]}
    src[c[0] + '#s'] = {'kind': 'sentence', 'text': c[4], 'tts_text': c[4]}
# Homograph key check set: distinct keys for sense/tense. Dev clips only for the demo word 'wind' noun
# plus a respelled verb sense to show the key split; tts_text respelling is a dev hack, not a verdict.
src['W4197:기본:wind:2'] = {'kind': 'word', 'text': 'wind (감다)', 'tts_text': 'wined'}
(ROOT / 'tools/audio_sources.json').write_text(json.dumps(src, ensure_ascii=False, indent=1), encoding='utf-8')
print('demo written', len(son), len(daughter), len(src), 'audio keys')
