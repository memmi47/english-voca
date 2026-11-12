"""Read-only design dry-run; prints Markdown, never writes decks or worlds.
Run: python3 -I tools/audit_world_design.py > docs/research/world_design_dry_run.md
POS and component matching are heuristics, not reviewed linguistic annotations.
"""
import collections
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'reference/weekly-tool/vocabulary.json'

def rank(x):
    def positive(v):
        return v if isinstance(v, int) and not isinstance(v, bool) and v > 0 else math.inf
    n, g = positive(x['ndl']), positive(x['ngsl'])
    c = {'Starters': 0, 'Movers': 1, 'Flyers': 2}.get(x['cam'], math.inf)
    if n < math.inf: return (0, n, g, c, x['id'])
    if g < math.inf: return (1, g, c, x['id'])
    if c < math.inf: return (2, c, x['id'])
    return (3, x['id'])

def ordered(rows):
    known = sorted((x for x in rows if rank(x)[0] < 3), key=rank)
    themes = collections.defaultdict(list)
    for x in sorted(rows, key=lambda x: x['id']):
        if rank(x)[0] == 3: themes[x['theme']].append(x)
    for i in range(max(map(len, themes.values()), default=0)):
        for theme in sorted(themes):
            if i < len(themes[theme]): known.append(themes[theme][i])
    return known

def pos(x):
    first = x['pos'].split('·')[0]
    return 'noun' if first in ('명사', '고유명사') else 'verb' if first == '동사' else 'modifier'

def luminance(h):
    rgb = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(a*b for a,b in zip(linear, (.2126, .7152, .0722)))

def contrast(a, b):
    x, y = sorted((luminance(a), luminance(b)))
    return (y + .05) / (x + .05)

def palettes(text):
    return [(r.split('|')[1].strip(), re.findall(r'#[0-9A-Fa-f]{6}', r))
            for r in text.splitlines() if re.match(r'\| p[123]-\d{2} \|', r) and len(re.findall(r'#[0-9A-Fa-f]{6}', r)) == 3]

def main():
    db = json.loads(SOURCE.read_text())
    selected = [x for x in db['lemmas'] if x['track'] in ('vocab', 'sight') and x['old_priority'] in ('P1','P2','P3')]
    assert len(selected) == 4610
    primaries = collections.Counter(c['lemma_link'] for c in db['cards'] if c['kind'] == '기본' and c['sense_order'] == 1)
    assert all(primaries[x['id']] == 1 for x in selected)
    print('# 세계 설계 dry-run\n')
    print('재현: `python3 -I tools/audit_world_design.py > docs/research/world_design_dry_run.md`. 출력만 하는 읽기 전용 검사이며 세계 생성기가 아니다.\n')
    print('원본 SHA-256: `' + hashlib.sha256(SOURCE.read_bytes()).hexdigest() + '`\n')
    print('## 1. 품사 쏠림과 길 대안\n')
    print('[verified] 명시한 정렬·임시 품사 규칙을 실제 DB에 적용한 결과. [estimate] 품사는 lemma.pos 첫 항목이며 첫 뜻의 품사 검수가 아니다. 마지막 집단의 주제 순환도 적용했다. 칸 수는 충돌 분리 전 최소치다.\n')
    print('원안은 명사 70장 초과 시 두 길로 나눈다. 수정안은 모든 순수 품사 길이 21~70장이면 유지하고, 아니면 같은 세계의 빈도순 단어를 세 길에 번갈아 넣어 균등한 mixed 길로 만든다. 세계 사이 이동은 없다.\n')
    print('| 세계 | 명사 | 동사 | 꾸밈 | 원안 길별 최소 칸 | 수정안 길별 장수 | mixed |\n|---|---:|---:|---:|---|---|---|')
    mixed = 0; violations = 0
    for band, sizes in [('P1',[142]*4+[141]*2),('P2',[155]*14),('P3',[155]*5+[154]*2)]:
        pool = ordered([x for x in selected if x['old_priority'] == band and x['track'] == 'vocab' and x['pos'] != '표현'])
        assert len(pool) == sum(sizes)
        offset = 0
        for i,n in enumerate(sizes,1):
            rows = pool[offset:offset+n]; offset += n
            counts = collections.Counter(pos(x) for x in rows)
            a,b,c = (counts[k] for k in ('noun','verb','modifier'))
            roads = ([math.ceil(a/2),a//2] if a>70 else [a])+[b,c]
            tiles = [math.ceil(x/10) for x in roads]
            violations += any(t<3 or t>7 for t in tiles)
            fallback = any(x<21 or x>70 for x in roads)
            mixed += fallback
            revised = [len(rows[j::3]) for j in range(3)] if fallback else roads
            print(f'| {band.lower()}-{i:02d} | {a} | {b} | {c} | {" / ".join(map(str,tiles))} | {" / ".join(map(str,revised))} | {"3길" if fallback else "없음"} |')
    print(f'\n일반 세계 27개 중 원안 3~7칸 범위 이탈 **{violations}개**, 수정안 mixed 적용 **{mixed}개**. 표현 전용 3세계는 이 표에서 제외하며 세 phrase 길에 균등 배분한다.\n')
    print('## 2. 표현 구성어 후보 감사\n')
    print('대역을 옮기거나 학습 선행 조건을 만들지 않는 후보 조사다. 소문자 영문 토큰(아포스트로피 포함)을 기본 표제어와 정확히 비교한다. aliases는 참고 후보로만 기록한다. 활용형·뜻·구문을 확정하지 않는다. [verified] 매칭 집계, [estimate] 언어적 해석.\n')
    lookup = collections.defaultdict(list)
    byid = {x['id']:x for x in selected}
    for x in selected:
        if x['pos'] != '표현': lookup[x['form'].lower()].append(x)
    stats = collections.Counter(); flagged = []
    for x in selected:
        if x['pos'] != '표현': continue
        later=[]; unknown=[]; ambiguous=[]
        for token in dict.fromkeys(re.findall(r"[a-z]+(?:'[a-z]+)?", x['form'].lower())):
            candidates=lookup.get(token, [])
            if not candidates:
                aliases=[byid[k]['form'] for k in db['aliases'].get(token,[]) if k in byid]
                unknown.append(token + (' (alias 후보: '+', '.join(aliases)+')' if aliases else ''))
            else:
                bands=sorted({y['old_priority'] for y in candidates})
                if min(bands)>x['old_priority']: later.append(token+'='+','.join(bands))
                if len(candidates)>1: ambiguous.append(token)
        stats[(x['old_priority'],'all')]+=1
        if later:stats[(x['old_priority'],'later')]+=1
        if unknown:stats[(x['old_priority'],'unknown')]+=1
        if later or unknown or ambiguous: flagged.append((x,later,unknown,ambiguous))
    print('| 대역 | 표현 수 | 뒤 대역 구성어가 있는 표현 | 정확히 못 찾은 토큰이 있는 표현 |\n|---|---:|---:|---:|')
    for band in ('P1','P2','P3'):print(f'| {band} | {stats[band,"all"]} | {stats[band,"later"]} | {stats[band,"unknown"]} |')
    print('\n두 결함 열은 겹칠 수 있다. 아래는 후보 전체이며 승인된 선행어 목록이 아니다.\n')
    print('| 표현 ID / 표현 | 대역 | 뒤 대역 토큰 | 미해결 토큰 | 복수 후보 |\n|---|---|---|---|---|')
    for x,l,u,a in flagged:print(f'| {x["id"]} / {x["form"]} | {x["old_priority"]} | {"; ".join(l) or "—"} | {"; ".join(u) or "—"} | {", ".join(a) or "—"} |')
    print('\n## 3. 수정 팔레트\n')
    print('길 면과 땅 면의 sRGB 상대 휘도 명암비. 설계 기준 3:1 이상을 검사한다. 실제 iPad 화면의 선 두께·노드·글자·색각 검증을 대체하지 않는다.\n')
    print('| 세계 | 땅 | 길 | 명암비 |\n|---|---|---|---:|')
    colors=palettes((ROOT/'docs/WORLD_BIBLE.md').read_text())
    assert len(colors)==30
    for wid,(_,ground,path) in colors:
        ratio=contrast(ground,path)
        assert ratio >= 3, (wid,ratio)
        print(f'| {wid} | {ground} | {path} | {ratio:.2f}:1 |')

if __name__ == '__main__':
    main()
