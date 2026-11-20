#!/usr/bin/env python3
"""Reproducible, read-only catalogue audit; suggestions require human review."""
import argparse
import collections
import csv
import io
import itertools
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS = json.loads((ROOT / 'cards/data/catalogue.json').read_text(encoding='utf-8'))['words']
OUT = ROOT / 'docs/research'


def render():
    words = sorted(WORDS, key=lambda w: w['id'])
    buckets = collections.defaultdict(list)
    for w in words:
        buckets[(w.get('theme') or '', w.get('pos') or '')].append(w)
    lines = ['# 주제·품사 자료 점검', '',
             '자료: `cards/data/catalogue.json`. 전체 4,610장과 뜻 고르기 4,489장을 별도로 센다. 카드 ID마다 1장, 품사 복합 표기는 분해하지 않고 문자열 전체가 같을 때만 같은 품사로 센다. 대역은 후보 제한이 아니라 집계 열이다.', '',
             '## 주제·품사별 수', '',
             '각 행은 주제와 품사 문자열이 같은 카드의 수이며 P1/P2/P3는 그 행의 대역별 카드 수, 뜻은 answerMode가 meaning인 카드 수다.', '',
             '| 주제 | 품사 | 전체 | P1 | P2 | P3 | 뜻 |', '|---|---|---:|---:|---:|---:|---:|']
    for (theme, pos), group in sorted(buckets.items()):
        bands = collections.Counter(w['band'] for w in group)
        lines.append(f"| {theme or '(빈값)'} | {pos or '(빈값)'} | {len(group)} | {bands['P1']} | {bands['P2']} | {bands['P3']} | {sum(w['answerMode']=='meaning' for w in group)} |")
    broad = [w for w in words if not w.get('theme') or any(s in w['theme'] for s in ('기타', '보완'))]
    meaning = [w for w in words if w['answerMode'] == 'meaning']
    low = []
    for w in words:
        groups = set(w.get('confusionGroups', []))
        # Only meaning cards can offer a Korean answer; exclude equal displayed answers too.
        candidates = [v for v in buckets[(w.get('theme') or '', w.get('pos') or '')]
                      if v['id'] != w['id'] and v['answerMode'] == 'meaning' and v.get('ko')
                      and not groups.intersection(v.get('confusionGroups', []))
                      and v.get('ko') != w.get('ko')]
        if len(candidates) < 5:
            low.append((w, len(candidates)))
    # Deterministic exact-answer detection plus explicit conservative lexical pairs.
    similar = [('큰', '커다란'), ('작은', '조그만'), ('빠른', '신속한'), ('빠른', '재빠른'), ('화난', '몹시 화난'), ('사나운', '매우 사나운'), ('비슷한', '서로 비슷한'), ('같은', '똑같은'), ('친구', '친한 친구')]
    pairs = []
    for theme in sorted({w.get('theme') or '' for w in words}):
        group = [w for w in words if (w.get('theme') or '') == theme and w.get('ko')]
        for a, b in itertools.combinations(group, 2):
            ka, kb = a['ko'].strip(), b['ko'].strip()
            reason = '동일 뜻' if ka == kb else ('유사어 수동 규칙' if (ka, kb) in similar or (kb, ka) in similar else '')
            if reason:
                pairs.append((a, b, reason, bool(set(a.get('confusionGroups', [])) & set(b.get('confusionGroups', [])))))
    rows = io.StringIO(newline='')
    writer = csv.writer(rows, lineterminator='\n')
    writer.writerow(['분류','주제','품사','대역','카드 ID','영어','뜻','후보 수','상대 ID','상대 영어','상대 뜻','근거','기존 혼동 묶음 공유'])
    for w in broad:
        writer.writerow(['빈값·보완',w.get('theme',''),w.get('pos',''),w['band'],w['id'],w['form'],w.get('ko',''),'','','','',''])
    for w, n in low:
        writer.writerow(['후보 5 미만',w.get('theme',''),w.get('pos',''),w['band'],w['id'],w['form'],w.get('ko',''),n,'','','',''])
    for a,b,reason,shared in pairs:
        writer.writerow(['뜻 검토 쌍',a.get('theme',''),a.get('pos',''),a['band'],a['id'],a['form'],a['ko'],'',b['id'],b['form'],b['ko'],reason,'예' if shared else '아니오'])
    nmeaning = sum(w['answerMode']=='meaning' for w,n in low)
    new = sum(not x[3] for x in pairs)
    lines += ['', '## 검토 목록', '',
              f'- 빈 주제 또는 기타류: **{len(broad)}장**. 빈 값, 이름에 `기타` 또는 `보완`이 들어가는 주제를 기계적으로 선택했다. CSV의 `빈값·보완` 행에 카드별로 적었다. 명칭 기준이므로 광범위한 다른 주제는 포함하지 않는다.',
              f'- 후보 5개 미만: 전체 **{len(low)}장**, 그중 뜻 고르기 **{nmeaning}장**. 같은 주제·정확히 같은 품사 문자열에서 자기 자신, 뜻이 없는 카드, 듣기 전용 카드, 공유 혼동 묶음이 있는 카드, 표시 한글 뜻이 정확히 같은 카드를 제외한 나머지를 센다. 대역은 제한하지 않는다. CSV에 카드와 후보 수를 적었다. 실제 게임의 추가 필터는 적용하지 않았으므로 상한에 가깝다.',
              f'- 같은 주제 뜻 검토: **{len(pairs)}쌍**, 그중 기존 혼동 묶음을 공유하지 않는 **{new}쌍**. 서로 다른 카드의 한글 뜻을 양끝 공백 제거 후 정확히 비교하고, 코드에 명시한 아홉 수동 유사어 쌍도 비교했다. 품사와 대역은 제한하지 않는다. CSV에 양쪽 카드·근거·기존 묶음 공유 여부를 적었다. 기계적 후보일 뿐 문맥상 동의어 여부는 사람이 확인해야 하며, 이 방법은 유사어 전수 검사가 아니다.', '',
              '## 제안', '',
              '현재 주제·품사만으로 모든 카드에 다섯 후보를 보장할 수 없으므로 그대로 일괄 적용하기보다 후보가 부족할 때 기존 방식으로 되돌리는 방안을 T-006에서 검토한다. 주제를 일괄 합치면 관계없는 보기가 늘 수 있어 현재 수치만으로 합칠 군을 결정하기 어렵다. CSV의 부족 목록과 뜻 검토 쌍을 사람이 확인하고, 혼동 묶음 추가와 군 통합은 별도 결정한다. 실제 정답률과 추가 필터에 따른 후보 수는 아직 확인하지 못했다.', '']
    return {'theme_audit.md': '\n'.join(lines), 'theme_audit.csv': rows.getvalue()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = render()
    if args.check:
        stale = [name for name, data in outputs.items() if not (OUT / name).exists() or (OUT / name).read_bytes() != data.encode('utf-8')]
        if stale:
            print('다름: ' + ', '.join(stale))
            raise SystemExit(1)
        print(f'재현 일치: {len(outputs)}/{len(outputs)} 파일')
    else:
        for name, data in outputs.items():
            (OUT / name).write_bytes(data.encode('utf-8'))
        print(f'생성: {len(outputs)} 파일')

if __name__ == '__main__':
    main()
