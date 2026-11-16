# 실제 세계 배정 생성기 인계

WORKLOG 2026-11-15 결정과 요청 12번을 반영했다. 대표 카드 4,610개 중 4,489개를 30세계에 배정하고 표현 386개를 일반 세계의 표현 칸으로 섞는다. 기능어 121개는 카탈로그에 남기고 학습 경로에서 제외한다. 지도·학습·동기화 실행 코드는 Claude 담당이며 이번 변경에 포함하지 않았다.

## 파일과 상태

| 파일 | 역할 |
|---|---|
| `cards/data/world-art.json` | 30세계 색·도안·문구 원본, presentation-only, 0장 |
| `cards/data/worlds.json` | schemaVersion 3 실제 graph/words·성 규칙·다음 세계·대륙 관문, 배정 4,489장과 제외 121장 |
| `cards/data/catalogue.json` | words 4,610개와 오답 보기 제외 그룹 401개; id/form/ko/type/theme/band/learningKind/answerMode/ipa/confusionGroups |
| `tools/worlds/config.json` | 칸당 최대 카드 수, 세계·대륙 성 장수와 통과율, 표현 배치/선행 정책 |
| `tools/worlds/overrides.json` | 부모가 승인한 대표 카드 변경만 적용. 현재 entries 비어 있음 |
| `tools/worlds/confusions.json` | 기존 감사에서 확인 대상으로 명시한 동음 후보의 보수적 분리 목록 |
| `docs/research/world_generation.md` | 세계별 실제 어휘 수·표현 칸 수·성 경로의 최소/최대 카드 수 |
| `docs/research/p1_review.md/json/csv` | P1 1,215개 부모 검토 목록; 자동 변경 없음 |

전체 worlds는 `contentScope=learning-map`, `status=draft`, `playable=false`다. 실제 배정은 완료됐으나 실제 음원·부모 뜻 검토·iPad 확인이 남아 있다. `pending`을 확인하고 런타임에서 임의로 ready로 취급하지 않는다. `catalogue` 경로는 worlds.json 기준 `catalogue.json`, assetPack 경로는 cards 루트 기준이다.

`build_world_pixel_assets.py`는 world-art.json만 생성한다. `make_worlds.py`가 이를 읽고 worlds.json과 catalogue.json을 생성한다. 그림 생성기를 다시 실행해 실제 배정을 덮어쓰는 문제가 없다. 데이터 원본은 SHA-256으로 고정하고 수정하지 않는다. source가 바뀌면 생성기가 실패하므로 재검토 후 기준을 갱신해야 한다.

## 배정 기준

대역(P1/P2/P3)을 유지하고, 각 대역의 일반어·표현을 각각 NDL→NGSL→Cambridge→근거 없는 주제 순환으로 정렬한다. 각 종류를 세계 수 8/15/7에 연속 구간으로 나눠 모든 세계에 일반어가 들어가게 한다. 표현 전용 세계를 없애기 위한 종류별 할당이며 모든 종류를 합친 하나의 빈도순은 아니다. P3 표현 두 개는 첫 두 세계에 한 장씩 들어간다.

세계 안에서는 일반어/표현을 별도 칸으로 묶고, 동일 한글 뜻(NFC·공백 정규화), 동일 철자, 동일 자동 IPA, 명시 동음 후보가 같은 칸에 들어가지 않게 배정한다. 같은 세계 안에서 칸을 늘릴 수 있지만 단어를 버리거나 대역 밖으로 이동하지 않는다. 같은 품사/주제만 모이지 않도록 나눠 배치한다. 실제 생성 결과에서 배정 4,489개와 제외 121개의 ID 집합·중복·대역·모든 경로를 검사한다.

이 검사는 자동 IPA의 정확성이나 유사어 전체에 대한 언어 전문가 검수를 뜻하지 않는다. 자동 IPA 오류 때문에 불필요하게 분리될 수도 있다. `catalogue.confusionGroups`를 **오답 보기에서도 제외**하는 연결은 Claude가 해야 한다. `words[].confusionGroups`가 하나라도 겹치는 카드를 정답의 오답 후보로 고르지 않는다. 전체 그룹은 401개이며 동일한 쌍이 다른 기준 그룹에 함께 있을 수 있다.

어휘 그림은 의미별 검수 전 `emoji:""`로 둔다. world boss 그림은 단어 뜻과 독립적인 지도 장식이다. 기능어는 한글 뜻이 비어 있고 `answerMode=listen-spelling`이므로 기존 뜻 보기 문항으로 출제하지 않는다. `ipa`는 참고값이며 음원 검수 완료 표시가 아니다. 사용자 Mac 음원은 업로드/수정하지 않았다.

## 설정과 미결 항목

현재 기본: `maxCardsPerTile=10`, `worldCastle={cards:12,passRate:0.8}`. 칸 최대값은 1~10 정수다. 장수는 양의 정수, 통과율은 0 초과 1 이하의 유한 수로 검사한다. 학습 칸 크기를 줄였는데 최단 경로에서 세계 성 장수를 확보할 수 없으면 생성기가 실패한다. 단순히 성에 도달한 것만으로 아직 만나지 않은 카드를 출제하게 만들지 않는다.

대륙 성은 필수 관문이며 40장·75%다. `finale.required=true`, `unlock=all-world-crowns`, `status=draft`이고 세 대륙에 동일하게 반영된다.

표현 구성어 선행 관문은 없으며 `expressionPrerequisites=none`이다.

CLI 시험 예시(숫자는 검사 예시이며 운영 승인값 아님):

```sh
python3 -I tools/make_worlds.py --config /tmp/trial-config.json \
  --output /tmp/worlds-trial --report /tmp/worlds-trial/report.md
```

기본 파일 재현:

```sh
python3 -I tools/build_world_pixel_assets.py
python3 -I tools/make_worlds.py
python3 -I tools/audit_p1_review.py
python3 -I tools/build_world_pixel_assets.py --check
python3 -I tools/make_worlds.py --check
python3 -I tools/audit_p1_review.py --check
python3 -I tools/check_world_generation.py
```

## 런타임 접점

- 지도 edges는 `{from,to}`이며 이동은 start에서 완료 tile/무료 노드를 지나는 BFS frontier로 구한다. 남은 칸은 잠긴 상태로 지나가지 못하고 완료 칸을 무료로 되짚는다. shortest/longest 비용은 관측만 하고 같게 맞추지 않는다.
- `tile.learningKind`는 `vocab|phrase`, `words`는 원본 card_id 목록이다. 문구·팔레트·sprite ID는 world-art와 동일하다. 대표 뜻 변경 시 철자로 ID를 재생성하지 않는다.
- `sideActivities`는 비어 있다. 기능어 121개는 `excluded`에 기록되며 카탈로그에 남는다.
- `minigame`은 optional, memory/mail, anchor에 붙은 막다른 노드다. 놀이 도장·미니게임 통과는 학습 칸·성·왕관 조건을 바꾸지 않는다.
- 세계 성은 `castleRule.type=reach`, 장수/통과율은 설정값. 풀은 해당 세계에서 실제 만난 의미 카드여야 한다. 끝 세계 `nextWorldId=null` 뒤에는 대륙 finale가 다음 대륙 관문이다. 마지막 finale 뒤는 엔딩이다.
- 시제품 w1은 사용자 결정대로 새 시작한다. `progressPolicy.importLegacyProgress=false`이며 기존 state 파일을 삭제하는 코드는 없다. 이름/설정/백업 처리와 초기 전환 UI는 Claude가 맡는다. 이후 배정 변경을 또 자동 초기화하는 정책은 아니다. `assignmentSha256`가 달라지면 별도 검토/이관을 한다.
- 현재 모든 파일은 생성 초안이다. 기존 60단어 words.json이나 런타임을 덮어쓰지 않았다. 새 catalogue 전체 음원 연결도 Claude가 확인한다.

## P1 부모 검토 결과

[verified] 1,215개 전수 목록, 첫 뜻 변경 제안 23개, P1 원형의 불규칙 과거 71장(기본 뜻과 동일 64), P1이 포함된 같은 한글 뜻 177묶음, 그림-뜻 검토 후보 4개를 제공했다. 제안은 모두 미확인이고 원본/대표 카드 변경은 0건이다. 과거형은 현재 4,610개 배정 밖이다.

부모 승인 후에만 overrides의 version과 entries를 갱신한다. 항목은 `{lemmaId,cardId,reason,approvedByParent:true}`이며 같은 lemma의 기본 카드만 허용한다. 빈 뜻/다른 lemma/중복 override/미승인은 생성기가 거부한다. 새 ID의 음원도 별도 확인한다. 자동으로 한국어 과거형을 문자열 치환하지 않는다.
