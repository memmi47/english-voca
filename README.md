# english-voca

초등 저학년 남매의 영어 원서 어휘 캐치업 게임 (프로토타입). 설계는 `docs/DESIGN.md`, 시험 결과는 `docs/TEST_REPORT.md`.

## 실행

```sh
python3 tools/serve.py                      # http://127.0.0.1:8077  (Mac에서 확인)
python3 tools/serve.py --host 0.0.0.0       # iPad에서: http://Mac의-사설-IP:8077
```

기본 `python3 -m http.server`는 Range 요청을 처리하지 못해 iPad Safari에서 음원이 재생되지 않을 수 있으므로 위 서버를 사용한다. `file://`로는 열 수 없다.

진도는 브라우저와 Mac의 `state/` 폴더 양쪽에 저장된다. `state/`와 `state/backup/`(직전 30개 버전)을 보관하면 브라우저 기록이 지워져도 복원되고, Mac과 iPad가 같은 진도를 쓴다. `state/`는 git에 올리지 않는다. 인증이 없으므로 가정 내 Wi-Fi에서만 `--host 0.0.0.0`을 사용한다. iPad에서는 Safari 공유 메뉴의 "홈 화면에 추가"로 여는 것을 권한다.

1. 첫 화면 아래 "부모 메뉴" (덧셈 문제) → "데모 팩 불러오기" → 처음으로 → 아이 선택 → "소리 켜고 시작".
2. 실제 주차: 주간 도구 `app.py`의 `/export?profile=son` 및 `daughter` JSON을 부모 메뉴에서 아이별로 가져온다.
3. 날짜 시험용 쿼리: `?today=2026-11-12&seed=3&speed=60`.

## 단어 카드 시제품 (`cards/`)

`game/`과 별개인 플래시카드 시제품이다. 기획은 `docs/PLAN_DB_PROGRAM.md`, 단어는 DB의 P1에서 고른 60개.

```sh
python3 tools/serve_cards.py                 # http://127.0.0.1:8090  (기록은 state-cards/ 에도 저장)
python3 tools/serve_cards.py --host 0.0.0.0  # iPad에서: http://Mac의-사설-IP:8090
bash tools/cards_say_audio.sh                # (Mac에서 한 번) say 음성으로 음원 60개 생성. 안 만들면 기기의 시스템 음성으로 읽는다
```

- 아이 선택 → 지도에서 길과 칸을 고른다(길 3개 × 칸 2개 → 성). 단어와 소리가 나오면 "알아요" 또는 "몰라요".
- 기록 공유: 기록은 그 기기의 브라우저와 Mac의 `state-cards/` 폴더(서버 사본) 양쪽에 저장된다. 맥미니와 iPad가 같은 서버(`python3 tools/serve_cards.py --host 0.0.0.0`)에 접속하면 같은 기록을 본다. 서버에 닿지 않으면 그 기기에만 저장하고 첫 화면에 표시하며, 닿으면 밀린 기록을 올린다. `state-cards/`와 `state-cards/backup/`(직전 30개 버전)을 보관하면 브라우저 기록이 지워져도 복원된다. 한 기기에서 "기록 지우기"를 해도 서버 사본은 남아 다시 불러온다. 인증이 없으므로 집 Wi-Fi에서만 쓴다.
- 지도: 복습이 8장 이상 쌓이면 몬스터가 길을 막는다. 두 길을 깨면 성(확인 카드 시험)이 열리고 열쇠를 준다. 보너스 집은 번개 라운드 1분. 별·방패 버섯·불꽃 꽃은 가방에 한 칸 넣어 다음 판에 쓴다. 보상은 복습 일정과 카드 등급을 바꾸지 않는다.
- 첫 화면의 "부모 기록"에 판별 카드 수, 분당 카드, "알아요" 확인 정답률이 있다.
- 글꼴: 화면 틀은 Galmuri11(OFL, `cards/fonts/`), 영어 단어는 둥근 글꼴.
- 날짜 시험용 쿼리: `?today=2026-11-13`. 음성을 바꾸려면 `VOICE="Ava (Premium)" bash tools/cards_say_audio.sh`.

## 테스트

```sh
node --test tests/*.test.mjs                 # 규칙·오디오·동기화·카드 규칙 단위 테스트
node tests/e2e.cjs                          # Chromium 통합 테스트 (자체 서버를 8078 포트에 띄움, Playwright 필요)
node tests/cards_e2e.cjs                    # 단어 카드 시제품 통합 테스트 (8091 포트, 임시 state 폴더 사용)
```

## 재생성

```sh
python3 -I tools/build_catalog.py           # reference 어휘 JSON -> game/data/catalog.json
python3 -I tools/make_demo.py               # 자작 데모 장면·팩·음원 목록
python3 -I tools/audio_tool.py build        # 개발용 합성 음원 (status dev_tts)
python3 -I tools/make_cards_demo.py         # 단어 카드 시제품의 60단어 (cards/data/words.json)
```

원본 `index.html`(초기 버전)은 그대로 두었다.
