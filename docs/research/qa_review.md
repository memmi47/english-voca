# QA 검토: Catch-up 어휘 게임 프로토타입 (game/)

범위: js/srs.js, store.js, questions.js, session.js, audio.js, main.js, data/*.json, css. 기존 tests/unit.test.mjs, tests/e2e.cjs가 이미 덮는 항목(SRS 간격, 재가져오기 멱등, 아이 분리, 오답 재도전, 소리 실패 시 잠금, 시간 종료)은 제외했다.
재현 스크립트: /tmp/claude-0/-home-user-english-voca/3ec6c0ce-eea1-5252-9759-68c5b7da9562/scratchpad/qa/ (r1~r5.mjs 순수 로직, b2~b5.cjs Playwright, 포트 8091 임시 서버, 종료함). 소스는 수정하지 않았다.
심각도: A = 첫 실사용을 막음, B = 고쳐야 함, C = 경미.

## A. 첫 실사용을 막는 결함

### A1. 도입만 되고 채점되지 않은 카드는 영구히 사라진다 (진도 유실)
- 위치: session.js:318-323 (`completeLearn`이 `introduced`를 즉시 기록), session.js:253 (복습은 `r.due` 필요), session.js:260 (신규는 `!r.introduced`), session.js:364-370 (`skipNoAudio`), main.js:296 (`home`), main.js:235-237 (`next`의 시간 종료)
- 재현 (r1.mjs): 새 카드 5개 `completeLearn` 후 세션 중단(홈 버튼, 15분 종료, 새로고침, 앱 종료) -> 다음 날/한 달 뒤에도 `plan.newIds=0, reviews=0`, 5개 모두 `introduced`인데 `due=null`. 기대: 다음 날 복습이나 재도입.
- 같은 뿌리의 다른 경로: 점수 문항(round B)에서 부모가 "소리 없이 넘기기"를 누르면 (`skipNoAudio`가 `scoring:false` 복사본만 뒤에 붙임) 세션을 끝까지 마쳐도 `lastScoredDay=null, due=null`로 남아 영구 유실 (r1.mjs R7: next day reviews=false, new=false).
- 학습 5화면 -> A라운드 5문항 -> B라운드 5문항 순서라, 학습 직후 이탈은 흔한 경로다. 시간 제한(15분)이 학습 단계에서 만료돼도 같다 (main.js:236 `G.timeUp && t.kind==='learn'`).
- 수정 방향: `introduced`는 첫 채점 시점에 기록하거나, 계획 시 `introduced && !lastScoredDay && !due`인 T1/T2를 신규 후보나 복습 후보로 되돌린다. `skipNoAudio`는 점수 문항이면 `scoring`을 유지한 채 재큐잉.

### A2. 데모 팩 가져오기가 실제 카드를 덮어쓰고, 데모 삭제가 실제 진도를 지운다 (데이터 손실)
- 위치: store.js:130 (`Object.assign(ex, base)`가 `sample, pack, tier, context, depthTarget` 덮어씀), store.js:92-98 (`clearSample`), main.js:313 (`demo`)
- 재현 (r2.mjs): 실제 팩에 ghost(streak 3, due 11-20) 있는 프로필에 데모 팩 가져오기 -> ghost가 `sample=true, pack=DEMO-HOUSE, context="The ghost said, \"Boo!\""`로 변경. 이어서 "데모 삭제" -> 실제 ghost 카드가 통째로 삭제됨 (`exists=false`).
- 데모 팩은 실제 catalog의 카드 ID(ghost, owl, shadow 등)를 쓰므로 실제 책 단어와 겹칠 확률이 높다. 반대로 데모를 먼저 하고 실제 팩을 가져오면 데모 진도가 실제 진도(`sample=false`)로 승격돼 export된다.
- 수정 방향: 기존 카드의 `sample` 플래그는 덮어쓰지 않고, 데모 가져오기는 이미 있는 실제 카드를 건드리지 않는다. 데모 카드는 카드 ID 충돌 시 거부한다.

### A3. 그림 문항(sound-pic)이 보기 1~2개로 출제된다 (정답이 그대로 보임)
- 위치: questions.js:209-212 (`distractors(..., hasArt, true)`로 그림 있는 카드만 후보, 개수 검증 없음)
- 재현 (r3.mjs): 그림(이모지)이 있는 카드는 starter 500 중 39개뿐이다. 8단어 팩에서 그림 카드가 2개면 보기 2개(50% 찍기), 1개면 보기 1개 (`options 1`)로, 정답 그림 하나만 화면에 표시되고 눌러서 `independent`로 채점된다.
- 정답이 회상 전에 보이는 문제이자 채점 오염이다. 실제 팩(대부분 추상어)에서 흔하다.
- 수정 방향: 보기 < 4이면 sound-meaning으로 대체(텍스트 보기). 최소 보기 수를 `makeQuestion`에서 강제.

## B. 고쳐야 할 결함

### B1. 날짜가 부팅 시 한 번만 계산된다 (밤새 열어 둔 iPad)
- 위치: main.js:13 (`today: todayISO()`를 모듈 로드 때 1회). 이후 갱신 코드 없음.
- 증상: 탭을 자정 넘겨 열어 두면 `G.today`는 어제 날짜 -> 오늘 만기 복습이 계획에 안 잡히고, "하루 1회 채점", 15분 합산(`usedToday`), 세션 `day`, 로그 `day`가 모두 어제 기준이다. 어제 이미 15분을 썼다면 시작 버튼이 비활성(`left<=0`).
- 수정 방향: `profileView`/`startSession`마다 `todayISO()` 재계산.
- 같은 위치 부가: `?today=`, `?speed=`, `?seed=`와 `window.__cu`가 운영 빌드에서도 활성이다 (URL을 고치면 15분 제한과 일정 우회 가능). 경미(C).

### B2. 세션 시간이 세션 종료 시에만 저장된다 (15분 상한 우회)
- 위치: main.js:223, 296 (`p.sessions.push`는 `endSession`/`home`에서만). 진행 중 `save()`는 `sessions`를 건드리지 않음.
- 재현: 세션 중 새로고침/탭 종료/iOS의 백그라운드 탭 폐기 -> `G.ms`가 사라져 `usedToday`에 반영 안 됨. 반복하면 15분 상한이 사실상 없다. 같은 이유로 main.js:`parent()`가 `G.sess=null`로 세션을 버리는 경로(해시 이동)도 시간 미기록.
- 수정 방향: 주기적으로(예: 문항마다) 현재 세션의 누적 ms를 프로필에 저장.

### B3. 소리 재생이 확인되기 전 답이 채점된다 / 소리 비의존 문항은 실패해도 채점된다
- 위치: session.js:340 (`needsSound && t.audioFailed`만 차단), main.js:68 (`lock`은 실패 후에만), questions.js:222 (word-meaning `needsSound:false`)
- 재현 1 (b5.cjs, 오디오 요청을 지연): sound-pic 표시 300ms 후 `locked=[false x4]`, 배너 없음. 바로 정답을 누르면 `outcome=independent, audioOk=true, assist=audio`로 기록. 소리는 한 번도 나지 않았다. 재생 시도가 진행 중인 최대 5초(timeout) 동안 무음 응답이 채점된다. 이후 피드백 재생이 이전 재생을 stale 처리해 실패 신호도 사라진다.
- 재현 2 (r3.mjs R6): word-meaning에서 `audioFailed()` 후 `submit` -> `{correct, outcome:'independent'}`, 로그 `audioOk:false, assist:'audio'`, 카드 `origin='게임 인출(소리 동반)'`, streak+1. 소리 없이도 "소리 동반"으로 표기됨.
- 수정 방향: 문항 렌더 후 재생 성공(또는 확정 실패) 전까지 보기 잠금. 오디오 없이 채점한 경우 `assist`/`origin`을 구분.

### B4. 빈칸(cloze) 문항에서 정답이 문장 안에 남는 경우
- 위치: questions.js:167-173 (`clozeParts`는 첫 일치만 가림)
- 재현 (r2.mjs R5): `clozeParts('A ghost is not a ghost.','ghost')` -> `after=' is not a ghost.'`, `'Ghost, ghost! Boo!'`도 두 번째가 노출. 같은 단어가 두 번 나오는 예문은 정답이 그대로 보인다.
- 수정 방향: 일치하는 모든 위치를 가리거나, 2회 이상 나오는 예문은 depth 3에서 제외(`availableDepths`).

### B5. 가져온 "이미 아는 카드"는 복습되지 않고, 티어가 올라간 카드도 일정이 없다
- 위치: store.js:135 (`known='앎'`, `due`, `streak` 복사하지만 `introduced=null`), session.js:253 (복습은 `introduced` 필요), 260 (신규에서도 제외), store.js:130 (재가져오기로 T3 -> T1 승격 시 `due` 미생성)
- 재현 (r2.mjs R4): `card_states={ghost:['앎','직접 인출','2026-11-05',2]}` 가져오기 후 오늘 11-11 -> `reviews=false, new=false`. 도입된 T3 카드를 재가져오기로 T1으로 올림 -> `due=null`, 2026-12-31에도 `reviews=0`.
- 주간 도구의 만기 정보가 게임에서 조용히 무시된다 ("진도 유지" 문구와 어긋남).

### B6. depth 1 첫 시도 오답이 일정에 반영되지 않는다
- 위치: session.js:305 (`scoring: eff<=1`; 대부분 round A는 비채점), session.js:345-351
- 재현 (r3.mjs R11): 같은 날 A(그림) 오답 -> B(단어->뜻) 정답이면 `streak 1, due +1일, known 앎, lastOutcome independent`. 같은 날 한 번 틀렸고 재도전도 오답(`retry_wrong`)이지만 "혼자 맞힌 단어"에 들어가고 간격이 늘어난다. 또 A의 비채점 오답이 `stats.wrong`에만 더해져(세션 요약 통계) 카드 상태와 불일치.
- 설계 문서(3절)에 명시 없는 공백. 최소한 같은 날 depth 1 오답이 있으면 B의 독립 성공을 `hinted` 수준으로 낮추는 규칙이 필요.

### B7. 가져오기 검증 허점 (r4.mjs)
- store.js:111-139. 모두 성공 응답(오류 없음)으로 저장됨:
  - `tier` 누락/임의값(`T9`): 카드가 만들어지지만 `isLong=false`라 일정 없음. 거부 없음.
  - `book` 누락: 팩 이름이 문자열 `"undefined"`.
  - catalog와 local_cards 어디에도 없는 카드 ID: `added`에 집계되고 `pack.count`에 포함되지만 계획에서 조용히 빠짐(보고 없음). 홈의 "오늘 새 단어" 수(`fresh`)에는 포함돼 표시와 실제 출제가 다름.
  - `approved_packs: [null]`: `Cannot read properties of null` 원문 오류. `local_cards`가 객체면 `object is not iterable` 원문 오류. `local_cards` 항목에 `card_id` 없으면 `localCards["undefined"]` 생성.
  - `depth_target: "abc"/99`, `reviewed_audio: "abc"` 그대로 저장.
  - 카드 ID가 `constructor`면 `p.cards['constructor']`가 `Object` 생성자라 `Object.assign(Object, base)`가 실행되어 전역 `Object`에 `pack/tier/...` 속성이 생김 (확인: `typeof Object.pack === 'string'`). 현실 가능성은 낮지만 `Object.create(null)`/`Object.hasOwn` 필요.
  - 같은 카드가 두 책에 있으면 두 번째 가져오기가 `pack/tier/context`를 덮어쓴다 (T1 -> T3, context 빈 문자열로 소실).
  - 팩 개정에서 빠진 카드는 `cards`에 남지만 `pack.order`에는 없어 영영 출제되지 않음(홈 집계에는 계속 포함).

### B8. 손상된 저장 데이터가 조용히 빈 프로필로 대체되고 다음 저장 때 덮어쓴다
- 위치: store.js:69-72 (`_read`가 파싱 실패 시 fallback), store.js:83-87
- 재현 (r2.mjs R3): 프로필 JSON 일부 손상 -> `profile()`은 빈 프로필 반환(`lastError`만 설정, UI는 안 봄) -> 다음 가져오기/세션 저장 시 원본(`BROKEN`)이 사라짐. 복구용 백업 키나 경고가 없다.
- 수정 방향: 파싱 실패 시 원문을 `...corrupt.<ts>` 키로 보관하고 UI에 경고.

### B9. `clearSample`이 실제 세션 기록까지 지운다
- 위치: main.js:223, 296 (세션 `sample`을 "프로필에 데모 카드가 하나라도 있으면 true"로 기록), store.js:96
- 재현 (r2.mjs R2b): 실제 카드와 데모 카드가 섞인 프로필에서 실제로 한 세션(600초)이 `sample:true`로 저장 -> "데모 삭제" 후 세션 0개. 그날 `usedToday`가 0으로 돌아가 15분 상한이 초기화된다.

### B10. 철자(spell) 힌트가 입력 중인 글자를 망친다
- 위치: main.js:315-317 (`hint`가 첫 글자 타일을 `click()`)
- 재현 (b4.cjs): ghost에서 아이가 `h`를 먼저 누른 뒤 힌트 -> 칸이 `hg___`. 이후 `hgost`로 채점 `wrong`. 힌트는 사용 처리됨. 첫 글자 타일이 이미 쓰였으면 아무것도 안 일어나는데 `hint=true`만 기록된다.
- 수정 방향: 힌트는 입력 칸을 비우고 첫 글자를 0번 칸에 고정.

### B11. 피드백 소리 실패 후 "소리 없이 넘기기"가 이미 채점된 문항을 복제한다
- 위치: session.js:328-331, 364-370, main.js:307
- 재현 (r5.mjs): 오답 제출(채점됨) -> 피드백 재생 실패(`audioFailed`) -> 부모가 넘기기 -> 로그 `wrong, skipped_no_audio`, 과제 15 -> 16(비채점 복제 추가), 정상 간격 재도전(`advance`의 +4 위치)은 건너뜀.

## C. 경미 / 명세 공백

- 보기 잠금이 `opacity`만 (css/app.css:30 `.opt.locked`). 클릭 차단은 JS(`classList.contains('locked')`)에 의존.
- 복귀(visibilitychange) 처리: main.js:45-51는 `view==='question'`에서만 배너를 띄운다. 학습 화면(learn)은 복귀 후 안내 없음, 정답 피드백 단계에서도 "소리를 다시 들어요" 배너가 뜬다. 복귀 시 해당 문항 소리를 못 들었음을 세션에 기록하지 않는다(잠금 없음).
- 오래된 재생 결과의 오귀속: learn 화면의 재생 결과가 뒤늦게 실패로 도착하고 다음 문항이 소리 없는 cloze면 `audioFailed()`가 cloze 문항에 기록되고 배너가 남는다 (engine에 `stop()`이 `next()`에서 호출되지 않음, session.js:329는 "현재 과제"에 귀속).
- 저장 실패 배너(main.js:`save`)는 다음 소리 재생 성공 시 `hideBanner()`로 가려진다.
- 로그는 3000건 초과 시 오래된 것부터 말없이 삭제 (store.js:89).
- 설정 입력 범위(3~10, 5~30, 5~15)는 HTML 속성뿐이라 검증이 없다 (main.js:314 `save-settings`, 예: 600분 입력 가능). "하루 새 단어"로 표기되지만 실제는 세션당(`newPerSession`) 5개라 같은 날 두 번째 세션에 5개가 더 나온다.
- cloze는 목표 단어가 보기로 표시되는데 자동 재생이 없다 (문장 소리는 정답 노출 때문에 의도적). 명세 "목표 단어 등장마다 자동 재생"과 설계 의도의 충돌이므로 결정 사항으로 문서화 필요.
- "소리 도움 표기": 아이 화면의 "혼자 맞힌 단어", "불이 켜진 물건은 혼자 맞힌 단어예요"에는 소리 도움 표기가 없고 내보내기 JSON의 `origin`/주석에만 있다. 부모 메뉴 현황에도 결과 요약이 없다.
- 형제 비교: 홈의 "우리 집에 켜진 불" 합계만 있고 아이별 비교 점수는 노출되지 않음(결함 아님, 확인). 합계에 데모 카드가 포함된다.
- `exportProfile`의 `cards_detail/log/sessions`에 데모 항목이 포함된다 (`card_states`만 제외).
- 두 탭 동시 사용 시 마지막 저장이 이긴다 (세션 시작 시점의 프로필 스냅샷 전체를 저장, main.js:`G.sessProfile`).

## 확인했으나 결함 아님
- 같은 카드 하루 1회 채점: 세션 내에서는 채점 과제가 카드당 하나라 중복 없음. 교차 세션도 `lastScoredDay`로 막힘.
- 힌트 성공은 `hinted`로 분리, streak 유지, 다음 날 재출제 (설계 가정과 일치).
- 오디오 엔진의 토큰 기반 stale 처리, 중복 억제(ctx 포함), 실패 시 문항 유지는 설계대로 동작 (B3의 지연 구간 제외).
- 시간 측정은 `document.hidden`일 때 증가하지 않고 tick당 3초 상한이 있다.
