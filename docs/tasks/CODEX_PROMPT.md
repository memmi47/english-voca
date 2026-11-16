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
