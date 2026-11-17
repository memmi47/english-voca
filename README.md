# english-voca

초등 저학년 남매의 영어 원서 어휘 캐치업 게임. 작업 이력과 계획은 `docs/WORKLOG.md`(모든 작업자가 먼저 읽는 문서), 기획의 근거는 `docs/PLAN_DB_PROGRAM.md`, 기록 보호와 복원 방법은 `docs/DATA_SAFETY.md`, 복습 규칙 값의 근거는 `docs/research/learning_load_sim.md`.

## 실행

```sh
python3 tools/serve_cards.py                 # http://127.0.0.1:8090  (기록은 state-cards/ 에도 저장)
python3 tools/serve_cards.py --host 0.0.0.0  # iPad에서: http://Mac의-사설-IP:8090
LIMIT=300 bash tools/cards_say_audio.sh      # (Mac에서) say 음성으로 첫 300장의 음원 생성. LIMIT 없이 실행하면 4,610장 전부
```

기본 `python3 -m http.server`는 Range 요청을 처리하지 못해 iPad Safari에서 음원이 재생되지 않을 수 있으므로 위 서버를 사용한다. `file://`로는 열 수 없다. 음원을 만들지 않은 카드는 기기의 시스템 음성으로 읽는다. 음원 스크립트는 이미 있는 파일을 건너뛰므로 중간에 멈췄다가 다시 실행해도 된다.
회오리 판의 변신 단어(ate, babies 등 127개) 음원도 같은 스크립트가 `cards/audio/forms.tsv`를 읽어 `f001.m4a`처럼 만든다(LIMIT와 상관없이 전부). 파일이 없는 형태는 소리 없이 넘어간다(기기 음성으로 읽지 않는다).

- 아이 선택 → 그 아이가 있는 세계의 지도. 출발점에서 이어진 칸을 골라 깨며 성까지 간다. 단어와 소리가 나오면 "알아요" 또는 "몰라요". 깬 칸은 지나다닐 수 있고, 긴 길 옆에는 놀이집(공부와 무관한 짧은 놀이)이 있다.
- 세계: 대륙 3개, 세계 30개, 카드 4,610장. 성(확인 카드 12장, 80%)을 통과하면 열쇠를 받고 다음 세계가 열린다. 그 세계의 모든 칸과 집, 성을 마치면 왕관. 대륙의 왕관을 모두 모으면 큰 성(40장, 75%)이 열리고 통과하면 다음 대륙으로 간다. "세계 지도" 버튼으로 열린 세계를 오간다.
- 세계 파일: `cards/data/worlds.json`(카드 목록은 `catalogue.json`)만 쓴다. 읽지 못하면 임시 파일로 넘어가지 않고 "열 수 없어요" 화면에 이유를 보여 준다. 작은 체험판은 주소 뒤에 `?set=demo`.
- 칸에 들어가면 그 칸의 새 단어를 한 화면에서 훑고 모르는 것만 누른다. 누른 단어만 카드로 배우고, 넘긴 단어는 한두 장만 바로 확인한 뒤 30일 뒤에 묶음에서 3장을 뽑아 다시 확인한다.
- 복습: 1·3·7·14·30일. 칸 한 판에 복습이 8~20장 섞인다. 복습이 8장 이상이면 선택 사항인 몬스터가 나타난다(별 2배). 박쥐 게이지는 새 단어를 만나면 차고 복습하면 줄며, 복습을 미뤄도 찬다. 가득 차면 박쥐 시험(25장)이 먼저다. 하루 시간·새 단어 상한은 없다. 보상(별·아이템·열쇠·도장)은 복습 일정과 카드 등급을 바꾸지 않는다.
- 기능어(the, and 등 121개)는 뜻 대신 "소리를 듣고 글자 고르기" 카드로 나온다.
- 기록 공유: 기록은 그 기기의 브라우저와 Mac의 `state-cards/` 폴더(서버 사본) 양쪽에 저장된다. 맥미니와 iPad가 같은 서버에 접속하면 같은 기록을 본다. 서버에 닿지 않으면 그 기기에만 저장하고 첫 화면에 표시하며, 닿으면 밀린 기록을 올린다. `state-cards/`와 `state-cards/backup/`(직전 30개 버전)을 보관하면 브라우저 기록이 지워져도 복원된다. 한 기기에서 "기록 지우기"를 해도 서버 사본은 남아 다시 불러온다. 인증이 없으므로 집 Wi-Fi에서만 쓴다.
- 첫 화면의 "부모 기록"에 열쇠·왕관, 판별 카드 수, 분당 카드, "알아요" 확인 정답률, 복습 정답률, 밀린 복습, 박쥐 게이지가 있다.
- 소리: 음악은 기본 꺼짐, 효과음은 켜짐. 지도 위쪽에서 바꾼다. 음악은 새로 작곡한 General MIDI 곡을 AAC로 녹음해 재생하며, 불러오지 못하면 기존 칩튠으로 돌아간다. 효과음은 프로그램이 합성한다.
- 글꼴: 화면 틀은 Galmuri11(OFL, `cards/fonts/`), 영어 단어는 둥근 글꼴.
- 날짜 시험용 쿼리: `?today=2026-11-13`. 음성을 바꾸려면 기존 `.m4a`를 옮긴 뒤 `VOICE="Ava (Premium)" bash tools/cards_say_audio.sh`.
- Mac 상시 서버 설치·업데이트·제거와 iPad 접속은 [Mac 설치 안내](docs/SETUP_MAC.md)를 따른다.

## 테스트

```sh
node --test tests/*.test.mjs                 # 카드 규칙·세계·복습 부하·기록 공유 단위 테스트 (71건)
node tests/cards_e2e.cjs                     # Chromium 통합 테스트 (127건. 8091 포트, 임시 state 폴더, Playwright 필요)
node tools/check_postal_music.cjs            # 음악·효과음 음량과 클리핑 측정
node tools/sim_learning.mjs --set chosen     # 학습 부하 시뮬레이션 (가정은 docs/research/learning_load_sim.md)
```

## 재생성

```sh
python3 -I tools/make_cards_data.py          # 전체 카드 목록, 음원 목록 (cards/data/catalog.json, cards/audio/words.tsv, forms.tsv)
python3 -I tools/make_cards_demo.py          # 체험·시험용 작은 자료 (cards/data/demo/)
python3 -I tools/build_postal_assets_v2.py   # 스프라이트 시트
python3 -I tools/build_postal_music.py       # 새 GM MIDI와 음악 목록 (기존 칩튠 자료 보존)
```

원본 `reference/`는 읽기 전용이다. 원본 `index.html`(초기 버전)은 그대로 두었다. 이전 프로토타입(`game/`)은 삭제했다. 복구 방법은 `docs/WORKLOG.md`.

### 음악 녹음

세계 30판, 화면 5곡, 징글 7개는 모두 새로 쓴 General MIDI 음악이다. [GeneralUser GS 2.0.3](https://www.schristiancollins.com/generaluser)의 녹음 배포 허용 라이선스를 확인해 사용했으며 사운드폰트 자체는 포함하지 않는다. FluidSynth와 FFmpeg/FFprobe를 설치한 뒤 `bash tools/render_music.sh /path/to/GeneralUser-GS.sf2`로 AAC-LC 44.1kHz stereo 96kbps를 다시 만든다. 도구 경로는 `FLUIDSYNTH`, `FFMPEG`, `FFPROBE`로 지정할 수 있다.

반복 구간은 `cards/assets/postal/music-gm/manifest.json`에 기록하고 Web Audio로 재생한다. 단어 음성이 나올 때 음악과 징글을 줄이며, 음악은 기본 꺼짐이다. 음원·라이선스·편곡·검증 상세는 [음악 설계와 결과](docs/research/music_gm.md)를 참고한다. iPad에서의 음색과 반복 청취는 사용자 확인 목록으로 남는다.
