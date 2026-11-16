# 변신 형태 자료 설계 인계 — C-002 보류

작성: 2026-11-16, Astra. 기준 커밋: `8ee40b41b3d46c6799ca77ad241911f94de8f65f`.

현재 카드의 필수 포함 조건과 자료 계약이 충돌한다. 아래 선별·검증 설계를 먼저 Draft PR 설명에 공개하며, 질문이 해결되기 전에는 Sol 구현과 `forms.json` 배포를 시작하지 않는다. 원형 카드·뜻·저장 ID는 수정하지 않았다.

## 1. 확인한 입력과 구현 중단 근거

| 확인 대상 | 실제 결과 |
|---|---|
| DB의 `kind == "불규칙 과거형"` | 84장, P1 71 / P2 13, 원형 83개 |
| DB 과거형 → catalogue | `lemma_link` → `lemmaId`로 84/84 연결, 모두 `learningKind: "vocab"` |
| 과거형과 원형의 철자가 동일 | cut, hit, hurt, let, put, read: 6장 |
| 동일한 `(base, kind)`의 서로 다른 형태 | be → was / were: 2장, 원형 1개 |
| 카드에 명시한 불규칙 복수 목록 | 25/25 원형이 catalogue에 있음 |
| 일반 복수가 단수와 동일 | sheep, fish, deer: 3개 |
| 과거형 DB의 말뭉치 수치 | `corpus_token_count > 0`: 0/84, `corpus_book_count > 0`: 0/84 |
| 기존 뜻과 변형 품사의 충돌 사례 | half: `형용사·명사`, `절반의`; deal: `명사·동사`, `약속` |

입력 SHA-256:

- `reference/weekly-tool/vocabulary.json`: `38b97c372feb8585eed6b9458194294039b4f8a62990ed44b6dfffb91e123130`
- `cards/data/catalogue.json`: `1e27bde0334788bf4aaea2d9a764c3dc705faf37efd7e2f791a280813f3d85e9`

필수 복수 원형 25개는 카드 그대로 고정한다: child, man, woman, foot, tooth, mouse, goose, person, leaf, knife, wolf, life, wife, shelf, thief, half, sheep, fish, deer, ox, scarf, elf, calf, hoof, cactus. 생성하기 쉬운 항목으로 바꾸거나 몰래 누락하지 않는다.

## 2. 사용자·Claude 설계 층에 넘기는 결정

아래는 제안이며 승인된 예외가 아니다. 카드의 기존 완료 조건은 그대로 남겨 두었다.

1. **철자 동일 형태**: 과거형 6장과 복수 3개를 필수 포함하면서 `form != baseForm`을 지킬 수 없다. 이 9개는 검수표에 이유와 함께 전부 기록하고 게임용 목록에서는 제외하며, 완료 기준의 “빠짐없이 들어감”을 “포함·제외 사유까지 전수 추적”으로 바꾸어도 되는가? 현재 규칙으로 새 과거분사를 검토할 때도 come/run처럼 원형과 같은 과거분사는 제외 대상이다. fish를 무조건 fishes로 바꾸어 조건을 우회하지 않는다.
2. **be의 두 과거형**: `was`와 `were` 모두 넣으면 `F:<base>:past`가 충돌하고 `(base, kind)`도 중복된다. 둘을 별도 학습 대상으로 유지하려면 변형 구분을 포함하는 ID·고유성 계약을 명시적으로 확정해야 한다. 예를 들어 `F:<base>:past:was`와 `F:<base>:past:were`를 허용할지, 아니면 하나만 선택할지 결정이 필요하다. 슬래시로 합친 가짜 단어 `was/were`나 임의의 새 `kind`는 만들지 않는다.
3. **필수 목록의 품사·뜻**: `W1669:기본:half:1`의 현재 뜻은 `절반의`, `W0961:기본:deal:1`은 `약속`이다. 각각 halves·dealt의 설명에 그대로 쓰면 품사·뜻이 어긋난다. 두 항목을 검수표에 보류하고 Claude가 원형 뜻을 검토할 때까지 게임 목록에서 제외해도 되는가? C-002 범위에서는 catalogue·DB 뜻을 고치거나 새 뜻을 만들 수 없다. [기존 DB 감사](research/data_audit.md)에도 deal 뜻 문제가 기록돼 있다.

철자 동일 과거형의 DB ID는 `W0927:불규칙 과거형:cut:1`, `W1762:불규칙 과거형:hit:1`, `W1825:불규칙 과거형:hurt:1`, `W2078:불규칙 과거형:let:1`, `W2896:불규칙 과거형:put:1`, `W2963:불규칙 과거형:read:1`이다. be의 DB ID는 `W0296:불규칙 과거형:was:1` / `W0296:불규칙 과거형:were:1`이다.

## 3. 충돌하지 않는 선별 규칙

이 절은 Astra가 정한 보수적인 구현 기준이다. 2절의 예외 결정을 대신하지 않는다.

- **원형**: catalogue의 `learningKind == "vocab"`이고 영어 알파벳 한 토큰인 카드만 받는다. 표현·기능어·하이픈·공백·기호가 있는 후보는 제외 사유를 남긴다. `base`와 `baseForm`은 catalogue의 `id`와 `form`을 그대로 복사한다. 한글 뜻은 검수표에 catalogue의 `ko`를 그대로 복사한다.
- **ID**: 단일 형태인 경우 `F:<catalogue의 전체 카드 id>:<kind>`로 고정한다. 정렬 순번, 형태 문자열의 우연한 변경, 생성 시각으로 ID를 만들지 않는다. be처럼 여러 형태가 필요한 경우는 2절 결정 전까지 발급하지 않는다.
- **DB 과거형**: `kind` 필터와 `lemma_link`로 원형을 연결한다. 철자 유사성으로 원형을 추정하지 않는다. `source: "db"`, `rule: "irregular"`, `kind: "past"`로 분류한다. 뜻·품사 충돌은 별도 보류한다.
- **불규칙 목록**: 복수는 명시한 25개를 전수 확인하고, 과거분사는 DB 원형의 과거형과 다른 경우만 후보로 삼는다. `source: "list"`, `rule: "irregular"`로 둔다. 사전에서 원형·품사·형태 관계를 확인한 항목만 채택한다. 뜻·지역에 따른 변형 선택이 불분명하면 제외한다. 단순 철자 규칙으로 f→ves나 과거분사를 추측하지 않는다.
- **규칙 후보의 품사**: 동사형은 품사가 정확히 `동사`, 명사형은 정확히 `명사`인 원형에서 시작한다. 복수 후보는 현재 뜻의 가산성까지 확인한다. 품사가 여럿이거나 뜻을 확인하지 못한 후보, 불가산·복수 전용 명사, 지역별 철자 변형은 제외 사유를 기록한다. 이 제한을 필수 불규칙 목록에 적용해 조용히 누락시키지 않는다.
- **불규칙 우선**: 불규칙 원형·종류에는 규칙 과거형/복수를 덮어쓰지 않는다. 해당 원형의 다른 종류도 별도 근거가 있을 때만 만든다. 후보 수를 늘리기 위해 잘못된 `goed`, `childs` 등을 만들지 않는다.

| 종류 | 규칙 | 후보 생성 범위와 제한 |
|---|---|---|
| ing | e-drop | 끝 e를 떼고 ing. ee/oe/ye/ie 등은 일반식에서 제외하고 개별 사전 근거 필요. make→making 같은 실제 표제의 변형을 대조 |
| past, ing | double | 끝 자음을 겹친 정확한 형태가 공개 사전에 명시된 허용 목록만 사용. CVC 철자나 자동 IPA만으로 강세·음절을 추정하지 않음 |
| past | y-ied | 자음+y → ied 후보. 정확한 동사 형태를 대조하고 불규칙·지역 변형을 먼저 제외 |
| s3, plural | y-ies | 자음+y → ies 후보. 동사·가산명사 구분 및 실제 형태를 대조 |
| s3, plural | es | s/x/z/ch/sh/o 끝의 es 후보. ch 발음, z 겹침, o 예외가 있으므로 접미사만 보고 확정하지 않음 |

규칙형은 사전 대조를 통과해도 `source: "rule"`로 유지한다. `source`는 생성 경로이고 정확성 등급이 아니다. 과거형과 같은 규칙 과거분사는 중복 생성하지 않는다. `walked`, `cats`, e 끝에 d만 붙인 `loved`, e 뒤에 s만 붙인 `makes`처럼 단순히 붙이는 형태는 제외한다. 위 규칙에 정확히 해당하지 않는 종류를 억지로 `plain`이나 `e-drop`으로 분류하지 않는다. `reviewed`는 부모 확인 전 전부 `false`다.

## 4. 무료 출처와 검증 기준

2026-11-16에 다음 무료 공개 교육 자료를 직접 읽었다.

- [British Council — Irregular verbs](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs): be의 두 과거형, 일부 원형·과거·과거분사 관계를 확인했다. DB84 전체 대조가 완료된 것은 아니다. 영국식 목록 하나만 보고 미국식 변형도 동일하다고 간주하지 않는다.
- [EF — Singular and plural nouns](https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/): sheep/fish/deer의 동일 철자 복수와 일부 불규칙 복수, es/ies 후보 규칙을 확인했다. 25개 전체를 대조한 것은 아니다.
- Cambridge의 [Nouns: form](https://dictionary.cambridge.org/grammar/british-grammar/nouns-form)과 [Spelling](https://dictionary.cambridge.org/grammar/british-grammar/consonants)은 검색 결과만 확인했고 본문은 HTTP 403으로 열지 못했다. 이 둘은 개별 형태의 검증 완료 근거로 계산하지 않는다.

Sol은 `tools/forms/*.json`에 각 후보의 원형 카드 ID, 종류, 정확한 형태, 근거 URL 또는 DB 카드 ID, 확인일, 품사·뜻 확인 결과, 제외 사유를 남긴다. 사전의 긴 정의나 예문을 복제하지 않고 형태 사실과 출처만 기록한다. 생성기는 이 고정된 자료와 읽기 전용 DB/catalogue를 입력으로 사용하며 실행 중 네트워크 조회를 하지 않는다.

단어가 웹이나 말뭉치에 존재한다는 것만으로 원형·품사 관계를 검증한 것으로 세지 않는다. DB의 과거형은 DB에 명시된 연결을 근거로 삼되 외부 대조 여부를 별도로 적는다. 복수·과거분사·규칙 후보를 확인할 공개 근거가 없으면 후보와 제외 사유를 검수표 위에 남기고 게임 목록에는 넣지 않는다. 따라서 “생성 경로가 rule”과 “대조하지 못함”은 별도 집계다. 특히 현재 DB84의 말뭉치 수치는 모두 0이므로 독립 대조에 사용할 수 없다.

## 5. 오답 후보·충돌·검수표

- `clash`는 형태와 같은 철자인 catalogue의 **모든 다른 카드 ID**를 빠짐없이 넣어 ID 순으로 정렬한다. 기능어 등을 문제 원형에서 제외했더라도 충돌 검색에서는 빼지 않는다. 철자는 대소문자를 접어 비교한다. 생성기는 충돌 형태를 숨기지 않고 표와 자료에 표시한다.
- `lookalikes`는 catalogue의 한 단어 vocab 원형에서 서로 다른 철자 2~4개를 뽑는다. 정답 원형 철자, 문제에 제시된 형태 자체, 정답과 `confusionGroups`가 겹치는 모든 카드의 철자는 먼저 제외한다. 같은 철자에 카드가 여러 장이면 어느 하나라도 제외 조건에 걸릴 때 그 철자 전체를 제외한다. 같은 제시 형태의 다른 정답 원형도 오답으로 쓰지 않는다.
- 후보 우선순위는 `(첫 글자 같음·길이 차이≤2·Levenshtein 거리≤2를 모두 만족하면 0/아니면 1, 편집 거리, 첫 글자가 같으면 0/아니면 1, 길이 차이, 철자, 카드 ID)`의 오름차순으로 고정한다. 선호 조건을 충족하는 후보가 적으면 나머지 안전 후보를 같은 순위로 사용한다. 안전 후보 자체가 2개 미만이면 생성 실패로 보고하며 의미·혼동 제외를 풀지 않는다.
- 검수표에는 원형 ID·원형·현재 한글 뜻·형태·종류·규칙·생성 출처·대조 근거·검증 상태·포함/제외/보류 이유·clash를 둔다. 보류/미대조, 규칙 생성, 확인된 목록/DB 순으로 놓고, 각 묶음 안에서는 원형 ID·종류·형태로 정렬한다. JSON/CSV/Markdown 사이의 수치가 일치해야 한다.
- 출력은 UTF-8과 고정 정렬을 쓰며 생성 시각·무작위 값을 넣지 않는다. 입력 해시와 고정 근거 자료가 같으면 모든 출력 바이트가 같아야 한다.

## 6. 재개 후 완료 검사 계약

`tools/make_forms.py --check`는 파일을 쓰지 않고 메모리에서 다시 만든 결과를 기존 JSON·CSV·Markdown과 바이트 비교한다. 다음을 모두 검사하며 하나라도 어기면 0이 아닌 종료값을 낸다.

1. 모든 base가 적격 catalogue 카드이며 `baseForm`과 뜻의 복사 값이 원본과 일치한다.
2. ID와 `(base, kind)` 중복이 없고 ID 생성식·enum·`reviewed: false`가 맞다. be 예외는 사용자 결정 후 명시적으로 반영한다.
3. `form != baseForm`, pp는 과거와 다름, 단순 접미사 형태 제외, 품사·가산성·지역 차이·불규칙 우선 규칙을 지킨다.
4. lookalikes가 2~4개의 서로 다른 적격 철자이며 정답·제시 형태·다른 정답·혼동 묶음을 포함하지 않는다. clash가 실제 충돌 집합과 정확히 같다.
5. DB84개 카드 ID와 필수 복수25개 원형을 각각 전수 대조한다. 해결 전의 필수 항목을 제외 목록으로 옮겨 통과한 것처럼 처리하지 않는다. 예외 승인이 나면 승인된 제외 사유를 포함하는 감사 기준을 따로 적는다.
6. counts의 forms/bases/byKind/byRule, 검수표 행 수, 제외 이유별 수, DB 근거·외부 대조·미대조 수를 실제 행에서 재계산한다. 모든 제외 후보는 재현 가능한 이유를 가진다.
7. 생성 뒤 다시 생성해 바이트가 같은지, `--check`가 비수정인지, 허용하지 않은 파일의 diff가 없는지 확인한다.

신규 검사 코드는 허용된 생성기 안에 둔다. `tests/*`, JS, DB, catalogue, worlds, 저장 fixture를 고치지 않는다. 구현·검사 실패를 숨기거나 필수 항목을 삭제하지 않는다.

## 7. 현재 확인 결과와 재현

형태 생성물은 아직 없다. 종류·규칙별 생성 개수, 규칙 후보의 제외 이유별 개수, 전체 외부 대조 완료/미완료 개수는 **미산출**이다. 위의 84/25는 입력 규모이며 배포 가능한 형태 개수가 아니다.

- 아래 입력 감사: **10/10 통과**. 원본 수정 없이 충돌과 누락 없는 연결을 재현한다.
- `python3 -I tools/make_forms.py`와 `python3 -I tools/make_forms.py --check`: 각각 실행을 시도했으나 파일 없음으로 종료 2. 통과 **0/2**, 구현을 보류하여 생성·재현성은 **확인하지 못함**.
- 공통 검사 시도: `node --test tests/*.test.mjs`는 테스트 파일 2개 통과 / 1개 실패. `node tests/cards_safety.test.mjs`를 별도 실행하니 D1~D6 **6/8 통과**, D7·D8은 로컬 서버 연결의 `EPERM`으로 실패했다. `node tests/cards_e2e.cjs`는 Playwright 번들 Chromium 실행 파일 없음으로 시작하지 못했다. 새 자료 검사가 통과한 것으로 간주하지 않는다.
- 위 검사 프로세스는 종료됐으며 C-002 테스트 서버를 남기지 않았다. 실제 기기·부모 검수는 확인하지 못함.

저장소 루트에서 실행:

```sh
python3 -I - <<'PY'
import collections
import json

db = json.load(open('reference/weekly-tool/vocabulary.json'))
catalogue = json.load(open('cards/data/catalogue.json'))
lemmas = {row['id']: row for row in db['lemmas']}
words = {row['lemmaId']: row for row in catalogue['words']}
past = [row for row in db['cards'] if row['kind'] == '불규칙 과거형']
plurals = 'child man woman foot tooth mouse goose person leaf knife wolf life wife shelf thief half sheep fish deer ox scarf elf calf hoof cactus'.split()
checks = [
    len(past) == 84,
    collections.Counter(lemmas[row['lemma_link']]['old_priority'] for row in past) == {'P1': 71, 'P2': 13},
    len({row['lemma_link'] for row in past}) == 83,
    all(row['lemma_link'] in words and words[row['lemma_link']]['learningKind'] == 'vocab' for row in past),
    sorted(row['card_form'] for row in past if row['card_form'] == lemmas[row['lemma_link']]['form']) == ['cut', 'hit', 'hurt', 'let', 'put', 'read'],
    sorted(row['card_form'] for row in past if row['lemma_link'] == 'W0296') == ['was', 'were'],
    len(plurals) == 25 and all(any(word['form'] == form and word['learningKind'] == 'vocab' for word in catalogue['words']) for form in plurals),
    all(row['corpus_token_count'] == 0 and row['corpus_book_count'] == 0 for row in past),
    (words['W1669']['pos'], words['W1669']['ko']) == ('형용사·명사', '절반의'),
    (words['W0961']['pos'], words['W0961']['ko']) == ('명사·동사', '약속'),
]
assert all(checks), checks
print(f'C-002 input audit: {sum(checks)}/{len(checks)} passed')
PY
```

## 8. Sol에게 넘길 순서

1. 지금은 구현하지 않는다. C-002 카드의 질문 세 묶음에 대한 사용자·Claude 설계 결정과 수정된 완료 계약을 먼저 읽는다.
2. 그 결정과 이 문서의 선별·검증 규칙이 Draft PR 설명에 반영됐는지 확인한다. ID 예외는 첫 형태 자료를 내기 전에 확정한다.
3. 허용된 `tools/forms/*.json`에 근거와 제외 목록을 고정하고, `tools/make_forms.py`로 자료·두 검수표를 생성한다. 카드가 허용한 파일만 수정한다.
4. 두 완료 명령을 실제 실행한다. 종류·규칙별 개수, 제외 이유별 개수, 검증·미대조 개수와 명령 종료값을 C-002 결과에 적는다. 부모 검수를 대신해 `reviewed: true`로 바꾸지 않는다.
5. 같은 `codex/word-forms` 브랜치와 Draft PR을 이어 쓴다. 사용자만 병합한다. 완료 시 BOARD의 C-002 한 행과 WORKLOG 8절의 이 PR 한 줄을 갱신한다.
