#!/usr/bin/env python3
"""Offline C-002 builder. Evidence facts are fixed; unverified proposals never ship."""
import argparse
import collections
import copy
import csv
import hashlib
from functools import lru_cache
import io
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DB = 'reference/weekly-tool/vocabulary.json'
CAT = 'cards/data/catalogue.json'
EVIDENCE = 'tools/forms/evidence.json'
OUTPUTS = ('cards/data/forms.json', 'docs/research/forms_review.csv', 'docs/research/forms_review.md')
KINDS = {'past', 'pp', 'ing', 's3', 'plural'}
RULES = {'irregular', 'e-drop', 'double', 'y-ied', 'es', 'y-ies'}
PLURALS = 'child man woman foot tooth mouse goose person leaf knife wolf life wife shelf thief half sheep fish deer ox scarf elf calf hoof cactus'.split()


def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def eligible(w):
    return w['learningKind'] == 'vocab' and re.fullmatch('[A-Za-z]+', w['form']) is not None


@lru_cache(maxsize=600000)
def distance(a, b):
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        nxt = [i]
        for j, cb in enumerate(b, 1):
            nxt.append(min(nxt[-1] + 1, row[j] + 1, row[j-1] + (ca != cb)))
        row = nxt
    return row[-1]


def form_id(r):
    suffix = ':' + r['variant'] if r.get('variant') else ''
    return f"F:{r['base']}:{r['kind']}{suffix}"


def clashes(r, words):
    return sorted(w['id'] for w in words if w['id'] != r['base'] and w['form'].casefold() == r['form'].casefold())


def choices(r, words, forms):
    base = next(w for w in words if w['id'] == r['base'])
    groups = set(base['confusionGroups'])
    blocked = {r['baseForm'].casefold(), r['form'].casefold()}
    blocked.update(f['baseForm'].casefold() for f in forms if f['form'].casefold() == r['form'].casefold())
    blocked.update(w['form'].casefold() for w in words if groups.intersection(w['confusionGroups']))
    candidates = {}
    for w in words:
        if eligible(w) and w['form'].casefold() not in blocked:
            s = w['form'].casefold()
            candidates[s] = min(candidates.get(s, w['id']), w['id'])
    def rank(s):
        a = r['baseForm'].casefold()
        d = distance(a, s)
        first = a[0] == s[0]
        delta = abs(len(a) - len(s))
        return (0 if first and delta <= 2 and d <= 2 else 1, d, 0 if first else 1, delta, s, candidates[s])
    result = sorted(candidates, key=rank)[:4]
    assert len(result) >= 2, f"Not enough safe choices: {r}"
    return result


def build():
    db, cat, ev = read(DB), read(CAT), read(EVIDENCE)
    words = cat['words']
    by_lemma = {w['lemmaId']: w for w in words}
    by_form = {w['form']: w for w in words if eligible(w)}
    triples = {t['baseForm']: t for t in ev['irregularTriples']}
    assert ev['requiredPlurals'] == PLURALS
    rows = []
    def add(w, form, kind, rule, source, origin, url='', verified=False, reason='', status='included', variant=''):
        if w['form'] in {'half', 'deal'}:
            status, reason = 'held', 'approved-meaning-hold'
        elif not eligible(w):
            status, reason = 'excluded', 'ineligible-base'
        elif form == w['form']:
            status, reason = 'excluded', 'same-spelling'
        r = dict(base=w['id'], baseForm=w['form'], ko=w['ko'], pos=w['pos'], form=form, kind=kind, rule=rule, source=source,
                 origin=origin, evidence=url, checkedOn=ev['checkedOn'] if verified else '', externalVerified=verified,
                 verification=('external-dictionary' if 'collinsdictionary.com' in url else 'external-educational') if verified else ('db-link-only' if source == 'db' else 'unverified'),
                 posMeaning='catalogue-linked (DB)' if source == 'db' else ('checked' if verified and status == 'included' else 'not-approved'),
                 countability='checked' if kind == 'plural' and verified and status == 'included' else 'not-applicable-or-unapproved',
                 status=status, reason=reason or ('db-linked-form' if source == 'db' and not verified else 'verified-form'), reviewed=False)
        if variant:
            r['variant'] = variant
        r['clash'] = clashes(r, words)
        rows.append(r)
    pasts = [x for x in db['cards'] if x['kind'] == '불규칙 과거형']
    assert len(pasts) == 84 and len({x['card_id'] for x in pasts}) == 84
    irregular_bases = {by_lemma[x['lemma_link']]['id'] for x in pasts}
    for p in pasts:
        w = by_lemma[p['lemma_link']]
        t = triples.get(w['form'])
        verified = bool(t and p['card_form'] in t['past'].split(','))
        add(w, p['card_form'], 'past', 'irregular', 'db', p['card_id'], ev['irregularURL'] if verified else '', verified,
            variant=p['card_form'] if w['form'] == 'be' else '')
    for b in PLURALS:
        w = by_form[b]
        f = ev['pluralPairs'].get(b, ev['unresolvedPlurals'].get(b))
        assert f
        extra = ev.get('pluralExtraEvidence', {}).get(b)
        verified = b in ev['pluralPairs'] or bool(extra)
        if extra:
            assert extra['form'] == f
        reason = 'variant-unresolved' if b in ev['variantUnresolved'] else ('external-evidence-unavailable' if not verified else '')
        add(w, f, 'plural', 'irregular', 'list', 'required-plural:' + b, (extra['url'] if extra else ev['pluralURL']) if verified else '', verified,
            reason, 'excluded' if reason else 'included')
    # Only explicit supported pp pairs different from DB past are candidates; same-base pp is audited excluded.
    for b, t in sorted(triples.items()):
        if b not in by_form or by_form[b]['id'] not in irregular_bases or t['pp'] in t['past'].split(','):
            continue
        w = by_form[b]
        add(w, t['pp'], 'pp', 'irregular', 'list', 'verified-pp:' + b, ev['irregularURL'], True)
    facts = {(f['baseForm'], f['kind'], f['rule']): f for f in ev['regular']}
    seen = set()
    def regular(w, kind, rule, form):
        key = (w['id'], kind, rule)
        if key in seen:
            return
        seen.add(key)
        fact = facts.get((w['form'], kind, rule))
        verified = bool(fact and fact['form'] == form)
        expected = '명사' if kind == 'plural' else '동사'
        reason = ''
        if w['pos'] != expected:
            reason = 'ambiguous-pos'
        elif kind == 'past' and w['id'] in irregular_bases:
            reason = 'irregular-precedence'
        elif kind == 'plural' and w['form'] in PLURALS:
            reason = 'irregular-precedence'
        elif not verified:
            reason = 'external-evidence-unavailable'
        add(w, form, kind, rule, 'rule', 'regular-candidate', fact['url'] if verified else '', verified,
            reason, 'excluded' if reason else 'included')
    # Candidate scope: every single-token vocab with noun/verb POS component and these spelling patterns.
    # CVC is a screening proposal only; no syllable/stress assumption can qualify it for inclusion.
    for w in sorted(words, key=lambda w:w['id']):
        if not eligible(w):
            continue
        b = w['form']
        if '동사' in w['pos']:
            if b.endswith('e'):
                regular(w, 'ing', 'e-drop', b[:-1] + 'ing')
            if re.search('[^aeiou][aeiou][^aeiouwxy]$', b):
                for k, end in [('past','ed'),('ing','ing')]:
                    regular(w, k, 'double', b + b[-1] + end)
            if re.search('[^aeiou]y$', b):
                regular(w, 'past', 'y-ied', b[:-1] + 'ied')
                regular(w, 's3', 'y-ies', b[:-1] + 'ies')
            if re.search('(s|x|z|ch|sh|o)$', b):
                regular(w, 's3', 'es', b + 'es')
        if '명사' in w['pos']:
            if re.search('[^aeiou]y$', b):
                regular(w, 'plural', 'y-ies', b[:-1] + 'ies')
            if re.search('(s|x|z|ch|sh|o)$', b):
                regular(w, 'plural', 'es', b + 'es')
    forms = []
    fields = ['base','baseForm','form','kind','rule','source','clash','reviewed']
    for r in rows:
        if r['status'] == 'included':
            f = {k:r[k] for k in fields}
            if 'variant' in r:
                f['variant'] = r['variant']
            f['id'] = form_id(r)
            forms.append(f)
    forms.sort(key=lambda f:f['id'])
    for f in forms:
        f['lookalikes'] = choices(f, words, forms)
    counts = dict(forms=len(forms), bases=len({f['base'] for f in forms}),
                  byKind=dict(sorted(collections.Counter(f['kind'] for f in forms).items())),
                  byRule=dict(sorted(collections.Counter(f['rule'] for f in forms).items())))
    audit = dict(rows=len(rows), byStatus=dict(sorted(collections.Counter(r['status'] for r in rows).items())),
                 excludedByReason=dict(sorted(collections.Counter(r['reason'] for r in rows if r['status'] != 'included').items())),
                 externalVerified=sum(r['externalVerified'] for r in rows), unverified=sum(not r['externalVerified'] for r in rows),
                 includedExternalVerified=sum(r['externalVerified'] for r in rows if r['status']=='included'),
                 includedDBOnly=sum(not r['externalVerified'] for r in rows if r['status']=='included'),
                 dbTracked=len(pasts), requiredPluralsTracked=len(PLURALS),
                 dbByStatus=dict(sorted(collections.Counter(r['status'] for r in rows if r['source']=='db').items())),
                 requiredPluralsByStatus=dict(sorted(collections.Counter(r['status'] for r in rows if r['origin'].startswith('required-plural:')).items())))
    data = dict(schemaVersion=1,status='draft',source=dict(path=DB,sha256=sha(DB)),
                inputs={p:sha(p) for p in (DB,CAT,EVIDENCE)},counts=counts,audit=audit,forms=forms)
    validate(data, rows, words, pasts)
    rows.sort(key=lambda r:(0 if r['status']!='included' or not r['externalVerified'] else 1 if r['source']=='rule' else 2,r['base'],r['kind'],r['form'],r['origin']))
    columns = ['base','baseForm','ko','pos','form','kind','rule','source','origin','evidence','checkedOn','externalVerified','verification','posMeaning','countability','status','reason','clash','reviewed']
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=columns, extrasaction='ignore',lineterminator='\n')
    writer.writeheader()
    for r in rows:
        writer.writerow({**r,'clash':';'.join(r['clash'])})
    md = ['# 변신 형태 부모 검수표', '', '자동 생성: `python3 -I tools/make_forms.py`. 부모 확인 전 전부 reviewed=false. 한글 뜻은 원본 그대로이며 시제 뜻을 만들지 않았다.', '',
          'DB84·필수 복수25는 포함/제외/보류 전수 추적. DB 연결은 외부 검증과 별개다. 교육 자료의 명시된 형태 예만 외부 대조로 센다. 사전 전수 검증은 수행하지 않았다.', '',
          '규칙 후보 범위: 단일 영어 vocab 중 품사에 동사/명사가 있고 e끝·CVC끝·자음+y·es끝에 해당하는 모든 후보. CVC는 강세/음절 판정이 아닌 제외용 후보 추출이다. 그 밖의 단순 접미사 및 미검증 pp 전체 확장은 하지 않았다.', '',
          '복수 scarf/hoof/cactus는 Collins 본문의 여러 복수 변형 중 선택 미해결로 제외. wolf/shelf/thief/ox/calf는 Collins 본문에서 명시 복수·가산성과 현재 뜻을 대조했다. Cambridge 본문 403·검색 요약은 검증으로 세지 않았다. half/deal의 모든 새 형태는 승인된 뜻 검토 보류다.', '',
          '## 집계', '', '```json', json.dumps({'counts':counts,'audit':audit},ensure_ascii=False,indent=2), '```', '',
          '## 전수 검수표', '', '| 원형 ID | 원형 | 현재 뜻 | 형태 | 종류 | 규칙 | 출처 | 근거 | 대조 | 상태 | 이유 | clash |', '|---|---|---|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        vals = [r[k] for k in ['base','baseForm','ko','form','kind','rule','source']]+[r['evidence'] or r['origin'],r['verification'],r['status'],r['reason'],';'.join(r['clash'])]
        md.append('| '+' | '.join(str(v).replace('|','\\|').replace('\n',' ') for v in vals)+' |')
    return data,rows,words,pasts, [json.dumps(data,ensure_ascii=False,indent=2)+'\n',stream.getvalue(),'\n'.join(md)+'\n']


def validate(data, rows, words, pasts):
    by_id = {w['id']:w for w in words}
    forms = data['forms']
    assert len({f['id'] for f in forms}) == len(forms), 'duplicate id'
    keys = set()
    past_values = collections.defaultdict(set)
    for p in pasts:
        past_values[p['lemma_link']].add(p['card_form'])
    included = [r for r in rows if r['status']=='included']
    assert len(included) == len(forms)
    assert {r['origin'] for r in rows if r['source']=='db'} == {p['card_id'] for p in pasts}
    assert collections.Counter(r['baseForm'] for r in rows if r['origin'].startswith('required-plural:')) == collections.Counter(PLURALS)
    for r in rows:
        w = by_id[r['base']]
        assert (r['baseForm'],r['ko'],r['pos']) == (w['form'],w['ko'],w['pos'])
        assert r['clash'] == clashes(r,words)
        assert r['status'] in {'included','excluded','held'} and r['reason']
        assert r['source'] in {'db','list','rule'} and r['kind'] in KINDS and r['rule'] in RULES
        if r['status']=='included' and r['source']!='db':
            assert r['externalVerified'] and r['evidence'] and r['posMeaning']=='checked'
        if r['baseForm'] in {'half','deal'}:
            assert r['status']=='held'
    approved = {(r['base'], r['kind'], r['form']): r for r in included}
    assert len(approved) == len(included)
    for f in forms:
        assert (f['base'], f['kind'], f['form']) in approved, 'form not approved by evidence'
        r = approved[(f['base'], f['kind'], f['form'])]
        assert all(f[k] == r[k] for k in ['source','rule','baseForm','reviewed']), 'provenance mismatch'
        w = by_id[f['base']]
        assert eligible(w) and f['baseForm'] == w['form'] and f['form'] != w['form']
        assert f['reviewed'] is False and f['id'] == form_id(f)
        assert f['kind'] in KINDS and f['rule'] in RULES
        is_be = w['form']=='be' and f['kind']=='past'
        assert ('variant' in f) == is_be
        if is_be:
            assert f['variant'] == f['form'] and f['variant'] in {'was','were'}
        key = (f['base'],f['kind'],f.get('variant',''))
        assert key not in keys, 'duplicate base-kind'
        keys.add(key)
        if f['source']=='rule':
            assert w['pos'] == ('명사' if f['kind']=='plural' else '동사')
            assert f['form'] not in {w['form']+'s',w['form']+'ed',w['form']+'d',w['form']+'ing'}
            assert not (f['kind']=='past' and w['lemmaId'] in past_values)
        if f['kind']=='pp':
            assert f['form'] not in past_values[w['lemmaId']]
        assert f['clash'] == clashes(f,words)
        assert 2 <= len(f['lookalikes']) <= 4 and len(set(f['lookalikes'])) == len(f['lookalikes'])
        assert f['lookalikes'] == choices(f,words,forms), 'unsafe or nondeterministic choices'
    audit = data['audit']
    assert audit['rows'] == len(rows)
    assert audit['byStatus'] == dict(collections.Counter(r['status'] for r in rows))
    assert audit['excludedByReason'] == dict(collections.Counter(r['reason'] for r in rows if r['status']!='included'))
    assert audit['externalVerified'] == sum(r['externalVerified'] for r in rows)
    assert audit['unverified'] == sum(not r['externalVerified'] for r in rows)
    assert audit['includedExternalVerified'] == sum(r['externalVerified'] for r in included)
    assert audit['includedDBOnly'] == sum(not r['externalVerified'] for r in included)
    assert audit['dbTracked'] == 84 and audit['requiredPluralsTracked'] == 25
    assert audit['dbByStatus'] == dict(collections.Counter(r['status'] for r in rows if r['source']=='db'))
    assert audit['requiredPluralsByStatus'] == dict(collections.Counter(r['status'] for r in rows if r['origin'].startswith('required-plural:')))
    assert data['counts']['forms'] == len(forms)
    assert data['counts']['bases'] == len({f['base'] for f in forms})
    for field,key in [('byKind','kind'),('byRule','rule')]:
        assert data['counts'][field] == dict(collections.Counter(f[key] for f in forms))


def self_test(data, rows, words, pasts):
    mutations = [lambda d:d['forms'].append(copy.deepcopy(d['forms'][0])),
                 lambda d:d['forms'][0].update(baseForm='WRONG'),
                 lambda d:d['forms'][0].update(clash=['fake']),
                 lambda d:d['forms'][0].update(lookalikes=[d['forms'][0]['baseForm']]*2),
                 lambda d:d['forms'][0].update(reviewed=True),
                 lambda d:d['counts'].update(forms=0),
                 lambda d:d['forms'][0].update(form='fabricated'),
                 lambda d:d['forms'][0].update(source='fabricated'),
                 lambda d:next(f for f in d['forms'] if f.get('variant')=='was').pop('variant')]
    for mutate in mutations:
        broken = copy.deepcopy(data)
        mutate(broken)
        try:
            validate(broken,rows,words,pasts)
        except (AssertionError,KeyError):
            continue
        raise AssertionError('negative fixture accepted')
    print(f'negative checks: {len(mutations)}/{len(mutations)} rejected')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='compare all outputs without writing')
    parser.add_argument('--self-test',action='store_true',help='reject mutated data, without writing')
    args = parser.parse_args()
    data,rows,words,pasts,texts = build()
    if args.self_test:
        self_test(data,rows,words,pasts)
    elif args.check:
        for path,text in zip(OUTPUTS,texts):
            assert (ROOT/path).read_bytes() == text.encode('utf-8'), f'stale or modified output: {path}'
        print('check: JSON/CSV/Markdown identical; no files written')
    else:
        for path,text in zip(OUTPUTS,texts):
            (ROOT/path).parent.mkdir(parents=True,exist_ok=True)
            (ROOT/path).write_bytes(text.encode('utf-8'))
    print(json.dumps({'counts':data['counts'],'audit':data['audit']},ensure_ascii=False))


if __name__ == '__main__':
    main()
