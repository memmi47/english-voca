# 세계 데이터 계약 v1 — 승인 전 제안

상태: **문서만 작성, 생성기·배포 데이터 미생성**. 기준 `d71dc29b88fa15c85f16498973dcffd718e39c0d`. 이야기와 30개 세계 값은 [WORLD_BIBLE.md](WORLD_BIBLE.md). 제안된 출력 경로는 `cards/data/worlds.json`이며 이번 변경에서는 만들지 않는다.

## 1. 확인한 원본과 범위

[verified] `reference/weekly-tool/vocabulary.json`의 SHA-256은 `38b97c372feb8585eed6b9458194294039b4f8a62990ed44b6dfffb91e123130`이다. `stats.source_sha256`는 이전 입력 자료의 값이므로 현재 파일 해시 대신 쓰지 않는다.

대상 집합은 `lemmas[].track in {vocab,sight}`와 `old_priority in {P1,P2,P3}`의 교집합이다. 각 표제어에 `cards[].lemma_link=lemma.id`, `kind=기본`, `sense_order=1`인 카드 한 장을 연결한다. 현재 4,610개 모두 하나씩 연결된다. ID는 철자나 배열 위치로 재생성하지 않고 원본 `card_id`를 그대로 쓴다.

| 대역 | vocab (표현 포함) | sight | 카드 합계 |
|---|---:|---:|---:|
| P1 | 1,094 | 121 | 1,215 |
| P2 | 2,310 | 0 | 2,310 |
| P3 | 1,085 | 0 | 1,085 |

교과 보류 57개, band 없는 패턴 4개, 과거형·감정 파생형·추가 뜻은 별도 범위다. `defer=true`만으로 제외하지 않는다. 학습 범위는 track/band로 결정하고 추가 제외는 검토 기록을 남긴다. 부모 승인 대표 뜻 교체는 `lemma_id → card_id`의 별도 override와 근거로 적용하며 같은 표제어를 중복 배정하지 않는다.

## 2. 최상위와 공통 타입

UTF-8 JSON. `id`는 영문 소문자·숫자·하이픈으로 이루어진 안정적인 ID다(원본 card_id는 예외). 배열 순서가 표시·진행 순서다. 초안 변경 중에도 발행한 ID를 재사용하거나 다른 뜻에 붙이지 않는다. 모든 개수는 정수, 모든 색은 `#RRGGBB`, 문구는 HTML 없는 일반 문자열이다.

| 필드 | 타입 | 계약 |
|---|---|---|
| `schemaVersion` | integer | 최초 `1`. 호환 불가 변경 시 증가. 모르는 버전은 로더가 중단. |
| `contentVersion` | string | 예: `2026-11-12.draft1`. 카드 자리 변경 추적용, 자동 진도 초기화 금지. |
| `status` | `draft` 또는 `ready` | 승인 전·검사 미완료·지원 누락이면 draft. 검증 없이 ready로 올리지 않는다. |
| `source` | object | `path`, `sha256`, `selection`(선정 규칙 식별자), `overrideVersion`(없으면 null). |
| `counts` | object | `lemmas`, `cards`, `continents`, `worlds`, `byBand{P1,P2,P3}`. 생성한 참조와 재계산해 일치해야 함. |
| `continents` | Continent[] | 반드시 P1 → P2 → P3 순서. |

`counts.cards=4610`, `counts.lemmas=4610`, `counts.continents=3`, `counts.worlds=30`은 현재 원본에 대한 완성본 불변식이다. 일부만 생성한 개발 fixture는 `status=draft`이고 실제 부분 개수를 기록한다. 완성본인 것처럼 4,610을 써 넣지 않는다.

## 3. 대륙·세계·길·칸

### Continent

| 필드 | 타입 | 의미 |
|---|---|---|
| `id`, `band`, `name` | string | `c1`, `P1`, `새싹 들판` 등. band는 P1/P2/P3. |
| `story` | string | 대륙 입장 문구, 두 문장 이내. |
| `worlds` | World[] | WORLD_BIBLE 순서, 8 / 15 / 7개. |
| `finale` | Finale | 대륙 성과 다음 대륙 또는 엔딩. |

### World

| 필드 | 타입 | 의미 |
|---|---|---|
| `id` | string | `p1-01` 등. 문구가 바뀌어도 유지. |
| `name`, `title` | string | 같은 값을 저장. 기존 지도용 `title` 유지. |
| `concept` | string | 제작자용 장소 설명. 아이 화면에 자동 출력하지 않음. |
| `palette` | object | `sky`, `ground`, `path`. 길/땅 면 명암비 3:1 이상. 글자·노드 대비와 실제 기기 검증은 별도. |
| `bossEmoji` | string[] | 6개 이상, 각 항목 하나의 표시 이모지. 세계 간 중복 없음. |
| `castle`, `key` | `{name,emoji}` | 이야기 표기만. 점수·일정 변경값을 넣지 않음. |
| `intro`, `outro`, `story` | string | 각 두 문장 이내. 순서대로 입장 / 세계 성 통과 / 다음 이동. 마지막 story는 대륙 성 안내. |
| `castleNeeds` | integer | 기존 값 `2` 유지. **네 길이어도 두 길**. |
| `nextWorldId` | string 또는 null | 대륙 내부의 다음 세계. 마지막은 null이며 finale로 연결. |
| `status` | `draft` 또는 `ready` | 세계 데이터·음원·해당 활동 지원 상태를 검증한 뒤 ready. |
| `roads` | Road[] | 일반 세계 3~4개, 표현 세계 3개. 빈 길 금지. |
| `sideActivities` | Activity[] | 없으면 `[]`. 기능어 집·P3 표현 2개의 자리를 보존. |

### Road / Tile

| 필드 | 타입 | 의미 |
|---|---|---|
| Road.`id` | string | 전역 고유. 예: `p1-01-n1`, `p1-01-v`, `p1-01-m`. |
| Road.`kind` | enum | `noun`, `verb`, `modifier`, 추가 제안 `phrase`, `mixed`. |
| Road.`name`, `.icon` | string | WORLD_BIBLE의 이름·아이콘. 이름으로 카드 의미를 결정하지 않음. |
| Road.`tiles` | Tile[] | 빈 배열 금지, 앞 칸부터 진행. |
| Tile.`id` | string | 전역 고유, 예: `p1-01-n1-01`. 기존 A1처럼 세계 간 충돌하지 않게 함. |
| Tile.`words` | card_id[] | 서로 다른 1~10개. 전 세계의 배정 집합에서도 중복 없음. |

`modifier`는 형용사·부사·수사 등 남은 일반 어휘다. 명사 두 길은 모두 kind=noun이며 `n1`, `n2`로 구분한다. **수정 제안: 세계의 빈도순 멤버는 고정하고 길만 균형을 맞춘다.** 명사 70장 초과 시 둘로 나눈 뒤 모든 길이 21~70장이면 순수 품사를 유지한다. 하나라도 21장 미만 또는 70장 초과이면 그 세계의 멤버를 빈도순으로 세 길에 한 장씩 순환 배정하고 세 길 모두 `kind=mixed`로 표시한다. 첫 길과 마지막 길의 장수 차이는 최대 1이다. 길 이름에 ‘여러말’을 붙인다.

목표는 길당 3~7칸이며, 충돌 분리 뒤에는 **1~7칸을 허용**한다. 칸당 1~10장 규칙은 유지한다. 분리 규칙을 지키면 7칸을 초과하는 경우에는 draft로 남기고 배정 보고서를 검토한다. 원본을 옮기거나 분리 규칙을 깨서 7칸에 억지로 맞추지 않는다. 이 완화와 mixed 적용은 사용자 승인 대상이다. 실제 dry-run에서는 일반 세계 27개 중 10개에 적용되고 순수 품사는 17개에 유지된다. 세 표현 세계는 세 `phrase` 길에 빈도순으로 순환 배분한다(122장 → 41/41/40, 140장 → 47/47/46). 이는 칸 배정·분리 검증 전의 장수다.

### Activity (추가 제안)

| 필드 | 타입 | 의미 |
|---|---|---|
| `id`, `name`, `icon` | string | 세계별 고유 ID, 표시 이름, 공통 이모지. |
| `kind` | `sight` 또는 `phrase` | 기능어 / P3 잔여 표현. |
| `requiredForCrown` | boolean | v1은 true. 대륙 전체 범위에서 빠지지 않음. |
| `componentHints` | object[] | 선택 사항. `{token, candidateCardIds, status}`. status는 `candidate` 또는 `reviewed`. 부모용 참고이며 해제 조건이 아님. |
| `status` | `draft` 또는 `ready` | 현재 기능어·표현 특수 활동은 draft. |
| `tiles` | Tile[] | 같은 card_id 유일성·1~10장 제약. |

**수정 제안: 표현은 전체를 하나의 학습 단위로 취급하고 구성어의 선행 학습을 필수 해제 조건으로 삼지 않는다.** P1 표현을 P2로 이동하지 않으므로 원본 대역과 4,610개 배정 합계를 유지한다. ‘같은 대륙 안’으로만 완화하면 P2/P3 구성어가 있는 P1 표현은 여전히 막히므로 그 대안은 채택하지 않는다. 이는 PLAN 18.4의 ‘구성어를 먼저 만난다’ 조건을 바꾸는 명시적인 승인 대상이다.

`requiresCardIds`, `prerequisitesReviewed`는 v1 제안에서 제외한다. 표현 세계에도 선택적 `componentHints`만 둔다. 토큰의 후보는 원형·활용형·뜻을 사람이 확인하기 전까지 `candidate`이며 정답이나 선행어로 확정하지 않는다. 구성어를 모르더라도 표현 전체의 소리 → 응답 → 뜻 공개 → 확인·복습 순서로 배울 수 있게 제안한다. 답을 먼저 보여 주는 구성어 해설 화면은 추가하지 않는다. 표현 지원 전에는 draft이며, 모든 표현의 뜻·음원·확인 보기 품질 검수는 여전히 필요하다. 참고 후보 검토와 학습 해제는 별개다.

기능어의 빈 한글 뜻을 ‘뜻 없음’ 정답으로 만들지 않는다. `sight`는 PLAN의 듣고 글자 고르기 계약이 구현된 뒤에만 실행한다. 현재 deck.js에 억지로 통과시키거나, 121개를 제외한 지도를 4,610개 완료라고 표시하지 않는다.

## 4. 빈도 정렬·분리·생성 계약 (승인 뒤 구현)

1. 대역을 고정한 뒤 일반 어휘 / 표현 / 기능어를 나눈다. WORLD_BIBLE의 수량에 따라 각각 세계 슬롯을 채운다. 표현을 뒷세계로, 기능어를 집으로 나누므로 ‘대역 내 전체가 한 줄의 빈도순’이라는 주장 대신 **각 트랙 안에서 빈도순**이라고 표시한다. 이는 PLAN 18.2·18.4의 특별 묶음을 택한 제안이다.
2. 트랙 내 정렬 키: NDL가 있으면 `(0, ndl, ngsl 또는 ∞, cam 또는 ∞, lemma_id)`, NDL 없고 NGSL 있으면 `(1, ngsl, cam 또는 ∞, lemma_id)`, 둘 다 없고 Cambridge가 있으면 `(2, Starters=0/Movers=1/Flyers=2, lemma_id)`, 모두 없으면 `(3, …)`이다. 순위는 양의 정수만 유효하다. 마지막 집단은 theme별 큐를 theme 이름 오름차순으로 한 개씩 순환하고 큐 안은 lemma_id순이다. 의미 없는 임의 난수·한글 가나다순 빈도 가정을 쓰지 않는다.
3. 세계의 멤버를 먼저 정하고, 선택한 카드의 품사로 길을 나눈다. 원본 lemma.pos가 ‘명사·동사’ 등 복수이면 **첫 뜻의 품사가 확인된 별도 정비값**을 우선한다. 정비 전에는 pos의 첫 항목을 임시값으로 쓰되 검토 목록에 남기고 ready 승격 전 확정한다. image_type은 품사가 아니다.
4. 위 3절의 수치 기준으로 순수 품사 길 또는 세 mixed 길을 결정한다. 길당 목표 3~7칸, 허용 1~7칸이며 7칸 초과는 검토 오류다. 세계 멤버를 바꾸지 않는다. `audit_world_design.py`의 27세계 보고서로 기준을 재현한다. 최종 생성기는 같은 판정과 함께 실제 충돌 분리 결과를 보고해야 한다.
5. 길 안에서 같은 한글 뜻, 확인된 동음, 같은 표제어·혼동 묶음은 한 칸에서 분리한다. 주제는 가능한 한 섞는다. 빈도순 후보를 가장 이른 안전한 칸에 넣고, 없으면 짧은 칸을 추가한다. 세계 간 이동이나 중복으로 수를 맞추지 않는다.
6. 동일 뜻은 Unicode NFC + 앞뒤 공백 제거 + 연속 공백 축약으로 비교하고 빈 뜻끼리 묶지 않는다. 유사어는 부모 검토한 card_id 묶음, 동음은 검토 목록과 DB IPA의 보수적 충돌 후보를 합친다. 자동 IPA가 불완전하므로 ‘음성이 다름을 검증했다’고 표시하지 않는다. 검토 안 된 후보는 남기고 release 검사에서 다룬다.
7. 배정 완성본은 선정 card_id 집합과 모든 `roads[].tiles[].words` + `sideActivities[].tiles[].words`의 합집합이 정확히 같아야 한다. 표현 386·기능어 121도 별도 대조한다. 누락·중복·알 수 없는 ID·대역 불일치는 모두 오류다.
8. 출력은 결정적이어야 한다. 같은 DB 해시·override·설계 버전으로 같은 순서와 ID를 만들고, 기존 발행판과 달라지면 이동 목록을 낸다. 소스 파일·아이의 저장 기록을 수정하지 않는다.

검사해야 할 것: 개수, ID 유일성, 참조, 빈 길, 칸당 카드 1~10개, 길당 1~7칸, 3~4길, 성 조건, 팔레트 형식과 길/땅 명암비 3:1 이상, 필수 문구, 보스 6개와 세계 간 비중복, 구성어 참고가 해제 조건에 사용되지 않음, 분리 규칙, 음원 지원 상태. 자동 검사는 코드로 확인 가능한 부분이며 의미 유사성·이모지 지원·발음 품질·이야기 가독성은 별도 사람 검토다.

## 5. 형식 예시 — 실재 card_id로 만든 작은 fixture

아래 JSON은 **문서용 3장 fixture**다. 전체 세계의 배정 결과나 빈도 정렬 결과가 아니다. 한 칸 1장도 허용됨을 보인다. 실제 완성본은 30세계이며 p1-01은 기능어 집 포함 158장을 목표로 한다. 원본 ID와 기존 핵심 필드가 살아 있는지 검토하기 위한 예시다.

```json
{
  "schemaVersion": 1,
  "contentVersion": "2026-11-12.fixture1",
  "status": "draft",
  "source": {
    "path": "reference/weekly-tool/vocabulary.json",
    "sha256": "38b97c372feb8585eed6b9458194294039b4f8a62990ed44b6dfffb91e123130",
    "selection": "primary-vocab-sight-v1",
    "overrideVersion": null
  },
  "counts": {"lemmas": 3, "cards": 3, "continents": 1, "worlds": 1, "byBand": {"P1": 3, "P2": 0, "P3": 0}},
  "continents": [{
    "id": "c1", "band": "P1", "name": "새싹 들판",
    "story": "우체국 문이 활짝 열렸어. 첫 편지를 전하러 가자!",
    "worlds": [{
      "id": "p1-01", "name": "문 앞 꽃밭", "title": "문 앞 꽃밭",
      "concept": "첫 편지가 꽃 사이에 걸렸다. 작은 문부터 연다.",
      "palette": {"sky": "#DFF3FF", "ground": "#8FCB83", "path": "#72644A"},
      "bossEmoji": ["🌱", "🌷", "🌻", "🌼", "🌹", "🍀"],
      "castle": {"name": "꽃마루 성", "emoji": "🌼"},
      "key": {"name": "장미 열쇠", "emoji": "🌹"},
      "intro": "첫 편지가 꽃 사이에 있어. 작은 길부터 걸어 보자!",
      "outro": "꽃마루 문이 열렸어. 첫 친구가 손을 흔들어!",
      "story": "둥근 과일 상자 너머로 편지가 팔랑거려.",
      "castleNeeds": 2, "nextWorldId": null, "status": "draft",
      "roads": [
        {"id": "p1-01-n1", "kind": "noun", "name": "새싹 길", "icon": "🌱",
         "tiles": [{"id": "p1-01-n1-01", "words": ["W0122:기본:animal:1"]}]},
        {"id": "p1-01-v", "kind": "verb", "name": "꽃잎 길", "icon": "🌷",
         "tiles": [{"id": "p1-01-v-01", "words": ["W0184:기본:arrive:1"]}]},
        {"id": "p1-01-m", "kind": "modifier", "name": "햇살 길", "icon": "🌻",
         "tiles": [{"id": "p1-01-m-01", "words": ["W1818:기본:hungry:1"]}]}
      ],
      "sideActivities": []
    }],
    "finale": {
      "id": "c1-finale", "name": "큰 배 문", "emoji": "🚪", "status": "draft",
      "requiresAllCrowns": true, "cards": 40, "passRate": 0.8,
      "intro": "들판의 길을 모두 돌아봤어. 배를 타기 전에 다시 만나 보자!",
      "outro": "배가 바다로 나아가. 새 친구들에게 편지를 전하자!",
      "nextContinentId": null, "ending": false
    }
  }]
}
```

fixture의 null 참조는 생략된 다음 세계·대륙을 뜻한다. fixture finale는 draft라 실행 불가다. 완성본의 p1-01.nextWorldId는 p1-02, c1.finale.nextContinentId는 c2다. 이 축소 예시의 연결을 그대로 배포하면 안 된다.

## 6. 진행과 대륙 성 계약

세계 성과 대륙 성은 구분한다. 세계 성은 기존 `CASTLE_CARDS=12`, `CASTLE_PASS=0.8` [verified: map.js]를 유지한다. 두 길 완료가 성 입장 조건이며 남은 길을 가면 기존 보너스가 적용된다. 네 길 세계에서 두 길이 남는 것도 허용한다. ‘한 길만 남는다’는 설명은 세 길 세계에만 맞는다.

Finale 필드는 `id`, `name`, `emoji`, `status`, `requiresAllCrowns=true`, `cards=40`, `passRate=0.8`, `intro`, `outro`, `nextContinentId`, `ending`이다. 완성본 c1→c2, c2→c3, c3→null이고 마지막만 ending=true다. 카드 수·정답률은 승인 대상 제안이며 현재 앱 설정에 추가하지 않는다.

- 세계 왕관: 세계 성 통과 + 모든 길 칸 첫 만남 완료 + requiredForCrown 활동 완료. 세계 성 열쇠만으로 왕관을 주지 않는다.
- 대륙 성: 해당 대륙의 모든 왕관이 있어야 입장. 40장 중 기능어·표현 포함 해당 대륙에서 이미 만난 카드만, 중복 없이 선택한다. 세계마다 먼저 floor(40/세계 수)장씩 뽑고 나머지는 세계 순서대로 한 장씩 더한다. 트랙도 가능한 한 순환하며 각 카드는 자신의 지원된 문항 형식을 따른다. 표본만으로 전 단어 숙달을 판정하지 않는다.
- 기본 풀에서 샘플 수를 못 채우면 중복·뒷대륙·새 카드를 넣지 않고 데이터 오류를 표시한다. 완성본의 실제 세계는 모두 충분한 카드를 가진다.
- 시험 계획(card_id 순서·문항 형식·응답)은 시작 시 저장하고 중간 이탈 시 이어 간다. 재접속으로 새로운 쉬운 표본을 뽑거나 열쇠를 중복 지급하지 않는다. 시험이 끝나도 일정·등급 처리는 기존 학습 엔진에 위임한다. 성의 게임 보상 코드가 별도로 일정을 올려서는 안 된다.
- 실패 후 길·기존 왕관·열쇠는 유지한다. 통과 시 다음 대륙 해제 또는 개인 엔딩을 기록한다. 두 아이의 unlock·왕관·시험은 각각 저장한다.
- 박쥐가 가득 찼을 때는 기존 박쥐 시험이 우선한다. 기능어·표현 경로가 준비되지 않은 대륙은 전체 완료를 허용하지 않는다.

## 7. 기존 시제품과 호환 범위 / Claude 연결 요청

[verified] `cards/data/words.json`은 `{note, world, words}`이며 world 핵심은 `{id,title,castleNeeds,roads[].tiles[].words}`다. 이 계약의 **World 객체는 그 필드를 보존**한다. 최상위는 continents 구조이므로 현재 앱에 파일만 교체해 동작한다는 뜻은 아니다. 새 로더가 선택된 World를 기존 지도 규칙으로 전달해야 한다.

| 현재 구현에서 확인한 점 | 연결 요청 |
|---|---|
| main.js의 지도 POS/LINES는 A1~C2 고정 | 길·칸 수에 따라 배치. card_id를 CSS 선택자로 쓰지 않고 안정 ID 사용. |
| map.js는 `state.map.castle` 하나를 봄 | 세계별 성·열쇠·왕관을 저장. 세계가 바뀌어도 이전 성 통과가 복사되지 않게 함. |
| 성 출제는 전달받은 `words` 중 이미 본 카드를 사용 | 세계 성의 출제 풀을 그 세계에 제한. 복습은 이미 본 전체 카드 유지. |
| words.json에 카드가 60장뿐 | 별도 전체 카드 카탈로그 로더 필요. worlds.json에는 ID만 있고 뜻·음원 데이터는 없음. |
| 새 World에는 theme/palette/bossEmoji가 있음 | 세계별 색·이모지·문구를 연결. 카드 정답은 이야기 레이어에 노출하지 않음. |
| sync.js는 단일 map 구조를 병합 | 세계별 기록·해제·시험 중단 재개를 양 기기에서 검증. 보상 중복 지급 방지. |

새 저장 구조의 권장 형태는 profile.map.worlds[worldId]의 성/왕관/획득 열쇠와 profile.map.continents[continentId]의 finale 기록이다. 별·가방·박쥐는 프로필 공통으로 유지한다. `keys` 총수만으로 세계 개방을 판정하지 말고 이전 성의 최초 통과 사실을 쓴다. 실제 저장 마이그레이션과 병합 구현은 Claude 담당이다.

시제품 w1의 60장은 새 p1-01과 동일하지 않다. 카드 기록은 card_id로 보존하고 새 칸의 첫 만남 여부를 다시 계산한다. 옛 w1 성/열쇠는 이력으로 남기되 새 세계 성을 통과한 것으로 복사하지 않는다. 기존 데이터 삭제·자동 초기화는 하지 않는다. 사용자에게 보여 줄 구체 마이그레이션은 구현 전에 별도 검토한다.

기능어 집, 표현 경로, 대륙 성, 세계별 저장은 **새 제안 또는 미구현 기능**이다. 승인과 지원 전에는 준비 중인 데이터를 실제 학습 경로로 연결하지 않는다. 사용자 승인 뒤 생성기를 만들고, 별도 PR로 UI 담당자가 연결한다.
