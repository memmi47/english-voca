# english-voca

초등 저학년 남매의 영어 원서 어휘 캐치업 게임 (프로토타입). 작업 이력과 계획은 `docs/WORKLOG.md`(모든 작업자가 먼저 읽는 문서), 기획의 근거는 `docs/PLAN_DB_PROGRAM.md`.

## 실행

```sh
python3 tools/serve_cards.py                 # http://127.0.0.1:8090  (기록은 state-cards/ 에도 저장)
python3 tools/serve_cards.py --host 0.0.0.0  # iPad에서: http://Mac의-사설-IP:8090
bash tools/cards_say_audio.sh                # (Mac에서 한 번) say 음성으로 음원 60개 생성. 안 만들면 기기의 시스템 음성으로 읽는다
```

기본 `python3 -m http.server`는 Range 요청을 처리하지 못해 iPad Safari에서 음원이 재생되지 않을 수 있으므로 위 서버를 사용한다. `file://`로는 열 수 없다.

- 아이 선택 → 지도에서 길과 칸을 고른다(길 3개 × 칸 2개 → 성). 단어와 소리가 나오면 "알아요" 또는 "몰라요".
- 기록 공유: 기록은 그 기기의 브라우저와 Mac의 `state-cards/` 폴더(서버 사본) 양쪽에 저장된다. 맥미니와 iPad가 같은 서버에 접속하면 같은 기록을 본다. 서버에 닿지 않으면 그 기기에만 저장하고 첫 화면에 표시하며, 닿으면 밀린 기록을 올린다. `state-cards/`와 `state-cards/backup/`(직전 30개 버전)을 보관하면 브라우저 기록이 지워져도 복원된다. 한 기기에서 "기록 지우기"를 해도 서버 사본은 남아 다시 불러온다. 인증이 없으므로 집 Wi-Fi에서만 쓴다.
- 지도: 복습이 8장 이상 쌓이면 선택 사항인 몬스터가 나타난다(별 2배, 칸은 막지 않음). 박쥐 게이지는 새 단어를 만나면 차고 복습하면 줄며, 가득 차면 판이 끝난 직후 박쥐 시험(복습·방금 훑은 단어 25장)이 열려 그동안 다른 칸은 못 간다. 하루 시간·새 단어 상한은 없다. 두 길을 깨면 성(확인 카드 시험)이 열리고 열쇠를 준다. 보상(별·아이템·열쇠)은 복습 일정과 카드 등급을 바꾸지 않는다.
- 첫 화면의 "부모 기록"에 판별 카드 수, 분당 카드, "알아요" 확인 정답률, 밀린 복습, 박쥐 게이지가 있다.
- 글꼴: 화면 틀은 Galmuri11(OFL, `cards/fonts/`), 영어 단어는 둥근 글꼴.
- 날짜 시험용 쿼리: `?today=2026-11-13`. 음성을 바꾸려면 `VOICE="Ava (Premium)" bash tools/cards_say_audio.sh`.

## 테스트

```sh
node --test tests/*.test.mjs                 # 카드 규칙·지도·기록 공유 단위 테스트
node tests/cards_e2e.cjs                    # Chromium 통합 테스트 (8091 포트, 임시 state 폴더 사용, Playwright 필요)
```

## 재생성

```sh
python3 -I tools/make_cards_demo.py         # 단어 카드 시제품의 60단어와 세계 (cards/data/words.json)
```

원본 `index.html`(초기 버전)은 그대로 두었다. 이전 프로토타입(`game/`)은 삭제했다. 복구 방법은 `docs/WORKLOG.md`.
