# english-voca

초등 저학년 남매의 영어 원서 어휘 캐치업 게임 (프로토타입). 설계는 `docs/DESIGN.md`, 시험 결과는 `docs/TEST_REPORT.md`.

## 실행

```sh
python3 tools/serve.py                      # http://127.0.0.1:8077  (Mac에서 확인)
python3 tools/serve.py --host 0.0.0.0       # iPad에서: http://Mac의-사설-IP:8077
```

기본 `python3 -m http.server`는 Range 요청을 처리하지 못해 iPad Safari에서 음원이 재생되지 않을 수 있으므로 위 서버를 사용한다. `file://`로는 열 수 없다.

1. 첫 화면 아래 "부모 메뉴" (덧셈 문제) → "데모 팩 불러오기" → 처음으로 → 아이 선택 → "소리 켜고 시작".
2. 실제 주차: 주간 도구 `app.py`의 `/export?profile=son` 및 `daughter` JSON을 부모 메뉴에서 아이별로 가져온다.
3. 날짜 시험용 쿼리: `?today=2026-11-12&seed=3&speed=60`.

## 테스트

```sh
node --test tests/unit.test.mjs tests/audio.test.mjs   # 규칙·오디오 엔진 단위 테스트
node tests/e2e.cjs                          # Chromium 통합 테스트 (서버 실행 중, Playwright 필요)
```

## 재생성

```sh
python3 -I tools/build_catalog.py           # reference 어휘 JSON -> game/data/catalog.json
python3 -I tools/make_demo.py               # 자작 데모 장면·팩·음원 목록
python3 -I tools/audio_tool.py build        # 개발용 합성 음원 (status dev_tts)
```

원본 `index.html`(초기 버전)은 그대로 두었다.
