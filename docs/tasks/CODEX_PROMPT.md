# Codex에 넘기는 프롬프트

아래 상자의 내용을 Codex(Astra)에 그대로 붙여 넣는다. Astra가 카드별로 Sol·Terra에 나눠 맡긴다. 카드 하나만 시키려면 맨 아래의 짧은 프롬프트를 쓴다.

## 전체 (Astra에게)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다.

먼저 읽을 것 (이 순서로):
1. docs/ORCHESTRATION.md   역할, 점검 지점, 층을 올리는 기준
2. docs/tasks/BOARD.md     작업판. "Codex 쪽" 표의 카드 다섯 장이 이번 일이다
3. docs/DATA_SAFETY.md 4절  기록 보호 규칙 (어느 작업자든 지킨다)
4. docs/LEARNING_VALUE_SPEC.md   카드들의 배경

할 일: docs/tasks/C-001.md ~ C-005.md 를 수행한다.
- 카드에 적힌 담당 층대로 맡긴다. C-001·C-003·C-004는 Terra, C-002는 Astra가 선별 규칙과 검증 방법을 먼저 정한 뒤 Sol이 구현, C-005는 Astra가 최고 노력 모드로 직접 한다.
- 다섯 장은 서로 다른 파일을 고치므로 동시에 진행해도 된다. 카드 하나가 브랜치 하나, PR 하나다. 브랜치 이름은 카드에 있다. PR의 대상(base)은 claude/modest-mccarthy-3gadjk, Draft로 연다.
- 카드의 "고칠 수 있는 파일" 밖은 고치지 않는다. cards/js/*, cards/css/*, tests/* 는 Claude 담당이다. 고쳐야 할 것이 보이면 카드의 "결과"에 적는다.
- 카드에 없는 결정이 필요하면 추측하지 말고 멈춘 뒤, 카드의 "막히면" 아래에 질문을 적고 그 카드를 "보류"로 둔다. 나머지 카드는 계속한다.
- 완료 기준의 명령을 실제로 실행하고, 통과 수를 카드의 "결과"에 적는다. 실행하지 못한 것은 "확인하지 못함"으로 적는다. 테스트를 건너뛰거나 끄지 않는다.
- 끝나면 카드의 상태와 docs/tasks/BOARD.md 의 표를 고친다. docs/WORKLOG.md 8절에는 PR마다 한 줄만 덧붙인다(다른 줄은 고치지 않는다. 충돌을 줄이기 위해서다).
- 유료 크레딧 도구는 쓰지 않는다. reference/ 원본은 읽기만 한다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.

우선순위: C-005(교차 검토)와 C-001을 먼저 끝낸다. C-002는 양이 많으니 Astra의 선별 규칙을 먼저 PR 설명에 올리고 구현에 들어간다.

끝난 뒤 보고: 카드별로 한 줄씩 (PR 번호, 통과한 검사, 확인하지 못한 것, 사용자나 Claude에게 넘기는 질문).
```

## 카드 하나만 (예: C-001)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk.
docs/ORCHESTRATION.md 와 docs/DATA_SAFETY.md 4절을 읽은 뒤 docs/tasks/C-001.md 를 수행한다.
카드의 "고칠 수 있는 파일" 밖은 고치지 않는다. 카드에 없는 결정이 필요하면 멈추고 카드에 질문을 적는다.
완료 기준의 명령을 실행해 통과 수를 카드의 "결과"에 적고, 카드에 적힌 브랜치로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다.
```

## C-006 (2026-11-17, Sol에게)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk.
docs/ORCHESTRATION.md 와 docs/tasks/T-006.md(앞선 작업과 그 검토)를 읽은 뒤 docs/tasks/C-006.md 를 수행한다.
- 이 카드에 한해 cards/js/deck.js 와 tests/cards.test.mjs 를 고친다. 카드의 "고칠 수 있는 파일" 밖은 고치지 않는다.
- 규칙은 카드의 "규칙" 1~6 그대로다. 카드에 없는 결정이 필요하면 멈추고 카드의 "막히면"에 질문을 적는다.
- 완료 기준의 세 명령을 실제로 실행하고 통과 수를 카드의 "결과"에 적는다. node tools/check_sim_baseline.mjs 가 실패하면 --update 로 기준 파일을 고치지 말고 달라진 줄을 적고 멈춘다.
- 새 검사 O5~O8 을 추가하고, O8 에서 센 두 수치를 결과에 적는다. 기존 검사는 지우거나 약하게 하지 않는다.
- 브랜치 codex/pos-option 으로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드의 상태와 docs/tasks/BOARD.md 의 표를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다.
- 유료 크레딧 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, 세 명령의 통과 수, O8 의 두 수치, 바꾼 기존 검사와 이유, 확인하지 못한 것.
```

## C-007 ~ C-009 (2026-11-17, Astra에게)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다.

먼저 읽을 것: docs/ORCHESTRATION.md, docs/tasks/BOARD.md, docs/DATA_SAFETY.md 4절.

할 일: docs/tasks/C-007.md, C-008.md, C-009.md 를 수행한다.
- C-007(교차 검토)은 Astra가 최고 노력 모드로 직접 한다. 코드와 검사는 고치지 않고 docs/reviews/C-007.md 보고서만 낸다. 가장 중요하다.
- C-008(회오리 빈도 측정)은 Terra. 규칙 코드를 불러 재기만 하고 cards/js/* 는 고치지 않는다.
- C-009(가끔 실패하는 브라우저 검사)는 Terra. 원인이 검사 쪽일 때만 tests/cards_e2e.cjs 를 고치고, 게임 코드 쪽이면 고치지 말고 결과에 적는다. 20번 돌려 한 번도 실패하지 않으면 그대로 적고 끝낸다.
- 세 카드는 서로 다른 파일을 고치므로 동시에 진행해도 된다. 카드 하나가 브랜치 하나, PR 하나다. 브랜치 이름은 카드에 있다. PR의 대상(base)은 claude/modest-mccarthy-3gadjk, Draft로 연다.
- 카드의 "고칠 수 있는 파일" 밖은 고치지 않는다. 카드에 없는 결정이 필요하면 추측하지 말고 멈춘 뒤 카드의 "막히면"에 질문을 적고 그 카드를 "보류"로 둔다. 나머지 카드는 계속한다.
- 완료 기준의 명령을 실제로 실행하고 통과 수를 카드의 "결과"에 적는다. 실행하지 못한 것은 "확인하지 못함"으로 적는다. 검사를 건너뛰거나 끄지 않는다. node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 끝나면 카드의 상태와 docs/tasks/BOARD.md 의 표를 고치고, docs/WORKLOG.md 8절에 PR마다 한 줄만 덧붙인다.
- 유료 크레딧 도구는 쓰지 않는다. reference/ 원본은 읽기만 한다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.

끝난 뒤 보고: 카드별 한 줄(PR 번호, 통과한 검사, 확인하지 못한 것). C-007은 심각도별 문제 수와 가장 심각한 것 하나를 덧붙인다.
```

## C-010 (2026-11-17, Astra에게)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다.
docs/ORCHESTRATION.md 를 읽은 뒤 docs/tasks/C-010.md 를 수행한다.
- Astra가 먼저 곡 구성과 악기 배정, 세계별 변화 규칙, 사운드폰트 선택과 그 라이선스 근거를 docs/research/music_gm.md 에 정하고 PR 설명에 올린다. 그다음 Sol이 생성기, 녹음 스크립트, 재생 코드를 구현한다.
- 모든 곡은 새로 쓴다. 실제 게임·방송·광고 음악을 흉내 내지 않는다.
- 이 카드에 한해 cards/js/sound.js 와 cards/js/main.js(음악 고르는 줄만), tests/cards_e2e.cjs(검사 추가만)를 고친다. 카드의 "고칠 수 있는 파일" 밖은 고치지 않는다. 규칙 코드와 저장 형식은 건드리지 않는다.
- 사운드폰트는 녹음 결과의 배포가 허용된 무료 것만 쓰고, 파일 자체는 저장소에 넣지 않는다. 유료 도구·음원은 쓰지 않는다.
- 녹음 파일이 없거나 못 읽으면 지금 칩튠으로 돌아가야 한다. 칩튠 자료와 chip.js 는 지우지 않는다.
- 이 환경에서 사운드폰트나 FluidSynth를 받을 수 없으면 카드의 "막히면" 첫 항목대로 녹음 전까지만 하고 그 사실을 적는다.
- 완료 기준의 명령을 실제로 실행해 결과에 적는다. 새 브라우저 검사 네 개를 넣는다. 기존 검사는 지우거나 약하게 하지 않는다. node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 브랜치 codex/gm-music 으로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다.
- 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, 쓴 사운드폰트와 라이선스, 곡 목록(세계 판 포함 개수), 음악 폴더 크기, 각 명령의 통과 수, 확인하지 못한 것.
```

## C-011 (2026-11-17, Astra에게)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다.
docs/ORCHESTRATION.md 와 docs/DATA_SAFETY.md 4절을 읽은 뒤 docs/tasks/C-011.md 를 수행한다.
- Astra가 먼저 화면 흐름(몬스터, 성 통과 연출, 세계 지도의 문, 선물 단계와 그 근거)을 정해 PR 설명에 올리고, 그다음 Sol이 구현한다.
- 이 카드에 한해 cards/js/main.js, cards/css/app.css, cards/js/sound.js(음악 기본값과 빵빠레 재생만), 그림·음악 생성기와 그 출력, tests/cards_e2e.cjs 를 고친다. 규칙 코드(deck.js, map.js, world.js, store.js, sync.js, storm.js)와 저장 형식, 아이 기록의 저장 키는 바꾸지 않는다. 저장 형식을 바꾸지 않고는 할 수 없는 것이 나오면 멈추고 카드에 질문을 적는다.
- 보상(별·열쇠·선물·꾸미기)이 복습 일정이나 카드 등급을 바꾸게 하지 않는다. 형제를 비교하는 화면은 만들지 않는다.
- 새 그림과 곡은 모두 새로 만든다. 실제 게임의 캐릭터·그림·음악을 흉내 내지 않는다. 이모지를 그림으로 쓰지 않는다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고, 새 브라우저 검사 다섯 개와 화면 캡처 네 장의 경로를 적는다. 기존 검사는 지우거나 약하게 하지 않는다(음악 기본값 검사 한 개만 이유를 적고 기대값을 바꾼다). node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 브랜치 codex/play-feedback-1 로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다.
- 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, 선물 단계와 그 근거, 각 명령의 통과 수, 화면 캡처 경로, 확인하지 못한 것.
```

## C-012 (2026-11-17, Sol에게)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다.
docs/ORCHESTRATION.md 와 docs/DATA_SAFETY.md 를 읽은 뒤 docs/tasks/C-012.md 를 수행한다.
- 카드의 "고칠 수 있는 파일" 밖은 고치지 않는다. tools/serve_cards.py, tools/backup_state.sh, cards/* 는 고치지 않는다.
- 어떤 경우에도 기록 폴더, state-cards/, 백업 저장소의 파일을 지우거나 덮어쓰지 않는다. 옮기지 않고 복사한다. sudo 와 시스템 설정 변경은 쓰지 않는다.
- 이 환경에서 실제 LaunchAgent 를 등록하지 않는다. 검사는 임시 HOME 과 가짜 launchctl·scutil 로 스크립트를 실제 실행해서 한다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고 새 검사 여섯 개를 넣는다. 기존 검사는 지우거나 약하게 하지 않는다.
- 카드에 없는 결정이 필요하면 멈추고 카드의 "막히면"에 질문을 적는다.
- 브랜치 codex/mac-setup 으로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다.
- 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, 각 명령의 통과 수, 확인하지 못한 것(실제 macOS 실행 포함).
```

## C-013 (2026-11-17, Astra에게. C-011 병합 뒤)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다. C-011 PR이 병합된 뒤 시작한다.
docs/ORCHESTRATION.md, docs/DATA_SAFETY.md 4절, docs/WORLD_SCHEMA.md 를 읽은 뒤 docs/tasks/C-013.md 를 수행한다.
- Astra가 먼저 K(세계 성 최소 마을 수)와 R(대륙 성 마을 비율)의 값, 세계마다 우표 두 장의 배치 규칙을 정해 PR 설명에 올리고, 그다음 Sol이 생성기·규칙(cards/js/world.js)·화면을 구현한다.
- 이 카드에 한해 cards/js/world.js 를 고친다. 다른 규칙 파일(deck.js, map.js, store.js, sync.js, storm.js)과 저장 형식, 카드·세계·칸 id, 카드 배정은 바꾸지 않는다. 우표는 저장하지 않고 칸이 깨졌는지로 계산한다.
- 지도는 갈래가 있는 세계 지도로 둔다. 다른 게임의 이름·캐릭터·그림·음악·지도 모양을 흉내 내지 않는다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고, 새 단위 검사 여섯 개와 브라우저 검사를 넣는다. 기존 검사는 지우거나 약하게 하지 않는다(대륙 성의 왕관 조건 검사만 이유를 적고 새 규칙에 맞게 바꾼다). node tools/check_sim_baseline.mjs 가 바뀌면 --update 하지 말고 멈춘다.
- 카드에 없는 결정이 필요하면 멈추고 카드의 "막히면"에 질문을 적는다.
- 브랜치 codex/world-gates 로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다.
- 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, K·R 값과 근거, 대륙별 최소로 만나는 단어 수와 비율, 각 명령의 통과 수, 확인하지 못한 것.
```

## C-014 (2026-11-17, Astra에게. C-011 위에 쌓거나 병합 뒤)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다.
docs/ORCHESTRATION.md 를 읽은 뒤 docs/tasks/C-014.md 를 수행한다. C-011이 아직 병합 전이면 codex/play-feedback-1 브랜치에서 갈라 codex/motion-and-home 을 만들고, PR 설명 첫 줄에 "C-011(PR #번호) 위에 쌓은 브랜치"라고 적는다. C-013 브랜치와 같은 파일을 고치므로 C-013보다 먼저 끝났다면 C-013 쪽에서 merge 로 반영한다(rebase·force push 금지).
- Astra가 먼저 움직임 목록(새로 그릴 그림과 CSS로만 움직일 것의 구분)과 첫 화면 성과 배치, 협동 목표 값을 정해 PR 설명에 올리고, 그다음 Sol이 구현한다.
- 이 카드에 한해 cards/js/main.js, cards/css/app.css, 그림 생성기와 그 출력, tests/cards_e2e.cjs 를 고친다. 규칙 코드, 저장 형식, 아이 기록의 저장 키는 바꾸지 않는다. 첫 화면 성과는 기록에서 계산만 하고 쓰지 않는다.
- 어떤 움직임도 입력이나 다음 카드를 막지 않는다. 순위 표시("1등", 왕관)는 넣지 않는다.
- 새 그림은 모두 새로 그린다. 다른 게임의 캐릭터·그림·동작을 흉내 내지 않는다. 이모지를 그림으로 쓰지 않는다. mushroom·fire-flower 그림은 id를 두고 그림만 바꾼다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고, 새 브라우저 검사 다섯 개와 화면 캡처 경로, 카드 한 장 평균 시간(도입 전후)을 적는다. 기존 검사는 지우거나 약하게 하지 않는다. node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 카드에 없는 결정이 필요하면 멈추고 카드의 "막히면"에 질문을 적는다.
- 브랜치 codex/motion-and-home 으로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다.
- 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, 새 그림 목록, 각 명령의 통과 수, 카드 한 장 평균 시간 전후, 화면 캡처 경로, 확인하지 못한 것.
```

## C-014 → C-015 (2026-11-18, Astra에게. 한 채팅에서 순서대로)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다. C-011과 C-013은 이미 병합됐다.
docs/ORCHESTRATION.md 를 읽은 뒤 순서대로 한다.
1. docs/tasks/C-014.md 를 수행한다. 지시는 docs/tasks/CODEX_PROMPT.md 의 "C-014" 절 그대로이되, 기준은 이제 claude/modest-mccarthy-3gadjk 이다(C-011 위에 쌓을 필요 없음). 브랜치 codex/motion-and-home.
2. C-014 PR을 연 뒤 병합을 기다리지 말고 codex/motion-and-home 에서 갈라 codex/visual-pass-1 을 만들어 docs/tasks/C-015.md 를 수행한다. PR 설명 첫 줄에 "C-014(PR #번호) 위에 쌓은 브랜치. C-014를 먼저 병합해야 함"이라고 적는다. C-014에 고칠 점이 생기면 codex/motion-and-home 에 고치고 codex/visual-pass-1 에는 merge 로 반영한다(rebase·force push 금지).
- 두 카드 모두 화면 파일(cards/js/main.js, cards/css/app.css), 그림 생성기와 그 출력, tests/cards_e2e.cjs 만 고친다. 규칙 코드, 저장 형식, 저장 키, id 는 바꾸지 않는다.
- 새 그림은 모두 새로 그린다. 다른 게임의 지도·캐릭터·그림·동작을 흉내 내지 않는다. 이모지를 그림으로 쓰지 않는다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고, 카드마다 새 브라우저 검사와 화면 캡처 경로를 적는다. 기존 검사는 지우거나 약하게 하지 않는다. node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 카드에 없는 결정이 필요하면 그 카드만 멈추고 카드의 "막히면"에 질문을 적는다.
- 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 PR마다 한 줄만 덧붙인다. 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: 카드별 PR 번호, 각 명령의 통과 수, 화면 캡처 경로, 확인하지 못한 것.
```

## C-016 (2026-11-18, Astra에게. C-015 위에 쌓거나 병합 뒤)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다.
docs/ORCHESTRATION.md, docs/WORLD_SCHEMA.md 를 읽은 뒤 docs/tasks/C-016.md 를 수행한다. C-015가 아직 병합 전이면 codex/visual-pass-1 에서 갈라 codex/explore-rewards 를 만들고 PR 설명 첫 줄에 "C-015(PR #번호) 위에 쌓은 브랜치"라고 적는다. 앞 브랜치의 수정은 merge 로 반영한다(rebase·force push 금지).
- Astra가 먼저 아이템 목록(칸·이름·그림 설명·여는 조건)과 별 색 단계, 우표 배치 계산을 정해 PR 설명에 올리고, 그다음 Sol이 구현한다.
- 화면 파일, 그림 생성기와 그 출력, 세계 생성기와 그 출력(우표 위치만), 카드에 적힌 검사·문서만 고친다. 규칙 코드, 저장 형식, 아이 기록의 저장 키, 카드·세계·칸 id, 카드 배정은 바꾸지 않는다. 이미 연 선물을 다시 잠그지 않는다.
- 배달부 그림은 층(몸→옷→가방→머리→모자)으로 나눠, 나중에 아들·딸의 머리 모양을 다르게 해도 아이템이 덮지 않게 한다.
- 새 그림은 모두 새로 그린다. 다른 게임의 캐릭터·탈것·동물·지도를 흉내 내지 않는다. 이모지를 그림으로 쓰지 않는다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고, 아이템 전체 목록, 우표 깊이 분포(전후), 화면 캡처 경로를 적는다. 기존 검사는 지우거나 약하게 하지 않는다. node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 카드에 없는 결정이 필요하면 멈추고 카드의 "막히면"에 질문을 적는다.
- 브랜치 codex/explore-rewards 로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다. 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, 아이템 수(칸별), 우표 깊이 전후, 각 명령의 통과 수, 화면 캡처 경로, 확인하지 못한 것.
```

## C-017 (2026-11-18, Sol에게. C-016 위에 쌓거나 병합 뒤)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다.
docs/ORCHESTRATION.md 를 읽은 뒤 docs/tasks/C-017.md 를 수행한다. C-016이 아직 병합 전이면 codex/explore-rewards 에서 갈라 codex/kid-looks 를 만들고 PR 설명 첫 줄에 "C-016(PR #번호) 위에 쌓은 브랜치"라고 적는다. 앞 브랜치의 수정은 merge 로 반영한다(rebase·force push 금지).
- 카드의 "정한 모습" 표를 그대로 따른다. 픽셀은 다듬어도 되지만 윤곽·위치·색과 움직임 크기(두 아이 모두 2~3px, 차이 1px 이하)는 지킨다.
- 그림 생성기와 그 출력, 화면 파일(아이별 움직임 적용만), 검사만 고친다. 규칙 코드, 저장 형식, 저장 키는 바꾸지 않는다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고, 새 브라우저 검사 네 개와 화면 캡처 경로를 적는다. 기존 검사는 지우거나 약하게 하지 않는다. node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 카드에 없는 결정이 필요하면 멈추고 카드의 "막히면"에 질문을 적는다.
- 브랜치 codex/kid-looks 로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다. 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, 각 명령의 통과 수, 화면 캡처 경로, 확인하지 못한 것.
```

## C-018 (2026-11-18, Terra에게)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다. C-014~C-017은 병합됐다.
docs/ORCHESTRATION.md 를 읽은 뒤 docs/tasks/C-018.md 를 수행한다.
- 첫 화면의 "익힌 단어"와 "이번 주 +N", 반려동물 해금은 cards/js/deck.js 의 firmCount 로 센다(Claude가 고쳐 둠). 이 기준을 바꾸지 않는다.
- 카드의 "고칠 수 있는 파일" 밖은 고치지 않는다. 규칙 코드, 저장 형식, 아이 기록의 저장 키, 아이템 id 는 바꾸지 않는다. 이미 열린 아이템을 다시 잠그지 않는다.
- 새 그림은 모두 새로 그린다. 다른 게임을 흉내 내지 않는다. 이모지를 그림으로 쓰지 않는다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고, 새 브라우저 검사 네 개와 화면 캡처 경로를 적는다. 기존 검사는 지우거나 약하게 하지 않는다. node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 카드에 없는 결정이 필요하면 멈추고 카드의 "막히면"에 질문을 적는다.
- 브랜치 codex/visual-pass-2 로 Draft PR(base: claude/modest-mccarthy-3gadjk)을 연다. 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 한 줄만 덧붙인다. 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고: PR 번호, 각 명령의 통과 수, 화면 캡처 경로, 확인하지 못한 것.
```

## C-018 → C-019 (2026-11-18, Astra에게. 한 채팅에서 순서대로)

```text
저장소 memmi47/english-voca, 기준 브랜치 claude/modest-mccarthy-3gadjk 에서 작업한다. C-014~C-017은 병합됐다.
docs/ORCHESTRATION.md 를 읽은 뒤 순서대로 한다.
1. docs/tasks/C-018.md 를 수행한다. 지시는 docs/tasks/CODEX_PROMPT.md 의 "C-018" 절 그대로다. 브랜치 codex/visual-pass-2.
2. C-018 PR을 연 뒤 codex/visual-pass-2 에서 갈라 codex/item-tiers 를 만들어 docs/tasks/C-019.md 를 수행한다. PR 설명 첫 줄에 "C-018(PR #번호) 위에 쌓은 브랜치. C-018을 먼저 병합해야 함"이라고 적는다. 앞 브랜치의 수정은 merge 로 반영한다(rebase·force push 금지).
   - C-019는 카드의 "3. 확인 단계"대로 한다: Astra가 아이템 표와 시안 한 장을 만들어 PR 설명과 카드 결과에 올리고 "사용자 확인 대기"로 멈춘 뒤, 이 채팅에서 사용자에게 시안 경로를 알리고 확인을 받는다. 확인을 받은 뒤에만 나머지를 구현한다.
- 첫 화면의 "익힌 단어"·"이번 주 +N"·반려동물 해금은 cards/js/deck.js 의 firmCount 로 센다. 이 기준을 바꾸지 않는다.
- 카드의 "고칠 수 있는 파일" 밖은 고치지 않는다. 규칙 코드, 저장 형식, 아이 기록의 저장 키, 세계·칸 id 는 바꾸지 않는다. 이미 열린 아이템을 다시 잠그지 않는다.
- 같은 칸의 아이템은 윤곽과 주색이 달라야 한다(색만 다른 아이템 금지). 옷은 대륙 2부터, 반짝임은 대륙 3 아이템만.
- 새 그림은 모두 새로 그린다. 다른 게임의 아이템·캐릭터를 흉내 내지 않는다. 이모지를 그림으로 쓰지 않는다.
- 완료 기준의 명령을 실제로 실행해 결과에 적고, 카드마다 새 검사와 화면 캡처 경로를 적는다. 기존 검사는 지우거나 약하게 하지 않는다. node tools/check_sim_baseline.mjs 의 --update 는 쓰지 않는다.
- 카드에 없는 결정이 필요하면 그 카드만 멈추고 "막히면"에 질문을 적는다.
- 카드 상태와 docs/tasks/BOARD.md 를 고치고 docs/WORKLOG.md 8절에 PR마다 한 줄만 덧붙인다. 유료 도구는 쓰지 않는다. 파일을 지우거나 git 기록을 다시 쓰지 않는다.
끝난 뒤 보고(카드별): PR 번호, 각 명령의 통과 수, 화면 캡처 경로, 확인하지 못한 것. C-019는 아이템 표, 가장 비슷한 아이템 쌍의 차이 수치, 예전 아이템 → 새 아이템 대응표.
```

