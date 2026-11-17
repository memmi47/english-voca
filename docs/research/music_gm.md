# C-010 General MIDI 음악 설계

작성: 2026-11-17, Astra 설계 단계. 기준: `1467592`, 카드 [C-010](../tasks/C-010.md). 이 문서는 구현 전에 공개할 설계이며, 아래 녹음 목표·검사 계획을 이미 완료한 결과로 읽지 않는다. 구현 담당은 Sol이다.

## 1. 범위와 산출물

새 곡은 모두 이 작업에서 새로 쓴다. 기존 칩튠 선율도 재사용하지 않는다. 실제 게임·방송·광고의 선율, 특징적인 화성 진행, 제목을 참조하거나 모사하지 않는다. 시대감은 GM 음색, 짧은 악구, 절제된 공간감과 악기 조합으로 만든다.

- 대륙 원곡 3개: 각 4/4, 32마디, A–B–A′–B′ 각 8마디. 원곡 MIDI와 세계별 MIDI를 보존한다.
- 세계 판 30개: 실제 자료의 `p1-01..08`, `p2-01..15`, `p3-01..07`에 하나씩 대응한다.
- 화면 반복곡 5개: `study`, `castle`(세계 성·박쥐), `continent-castle`(대륙 성), `play`(놀이집·번개), `storm`.
- 징글 7개: 기존 의미의 `clear`, `victory`, `key`, `item`, `grade`, `bat`, 새 `storm-caught`.
- 최종 AAC 파일 **42개**(세계 30 + 화면 5 + 징글 7). 대륙 기본 id는 첫 세계 녹음에 별칭으로 연결한다. 원곡의 중복 AAC는 만들지 않는다.
- 새 MIDI는 `assets/post-office/v3/midi/`, AAC와 단일 목록은 `cards/assets/postal/music-gm/`에 둔다. 사운드폰트·중간 WAV·측정용 파일은 Git 밖에 둔다.

기존 `cards/assets/postal/music/*.json`, `sfx.json`, `chip.js`, v2 MIDI는 내용까지 보존한다. 현재 생성기는 기존 JSON의 보정된 `norm`을 덮어쓸 수 있으므로 기본 실행을 새 GM 생성 경로로 바꾸고 기존 파일을 다시 쓰지 않는다. 구 자료는 실행 시 폴백이며, 새 생성기가 만들어야 할 음표 자료는 새 manifest의 구조·음악 메타데이터와 MIDI이다. 규칙·저장·세계·단어 자료와 음악 기본값 꺼짐, 설정 키 `cards.v0.pref`는 변경하지 않는다.

## 2. 사운드폰트: 원문 확인과 실제 확보

선택: **S. Christian Collins, GeneralUser GS 2.0.3, License v2.0**. 2026-11-17 저자 저장소의 라이선스 전체를 읽고 파일을 받았다.

- [저자 소개·다운로드 안내](https://www.schristiancollins.com/generaluser): 음악 녹음을 만들어 공개해도 되는지에 명시적으로 긍정하며 동봉 LICENSE를 안내한다.
- [고정한 라이선스 원문](https://github.com/mrbumpy409/GeneralUser-GS/blob/684543d5e5efaef08d02be50dcda8d552478fa60/documentation/LICENSE.txt): 완성된 음악 제작의 사적·상업적 이용을 제한 없이 허용한다. 샘플 조항에도 “including the ability to make profit from musical recordings created with GeneralUser GS.”라고 명시한다. 따라서 이번 AAC 음악 녹음의 배포를 허용하는 근거가 있다.
- 실제 받은 파일 URL: `https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/684543d5e5efaef08d02be50dcda8d552478fa60/GeneralUser-GS.sf2`
- 저자 저장소 고정 커밋: `684543d5e5efaef08d02be50dcda8d552478fa60`.
- SF2: 32,319,396 bytes, SHA-256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`.
- LICENSE.txt: 2,317 bytes, SHA-256 `7b32efefdf95ce38a043799f0659853ddc00fbaa14d8c50f0aca16b9b8b405be`.
- 이 환경의 임시 위치: `/tmp/c010-soundfont/GeneralUser-GS.sf2`, `/tmp/c010-soundfont/LICENSE.txt`. 재현 시 별도로 내려받아 경로를 인자로 넘긴다.

라이선스는 일부 오래된 샘플의 원출처를 저자가 완전히 추적할 수 없다는 설명도 포함한다. 위 허용 조항을 확인한 것이며 모든 샘플의 출처를 독립적으로 감사했다는 뜻은 아니다. 이 설명을 제거하지 않는다. 사이트/README의 이용자용 링크는 저자 안내 페이지로 하고, 위 고정 URL은 재현용 출처 기록이다. 폰트 자체는 앱이나 저장소에 배포하지 않는다. 시스템의 TimGM6mb는 이번 작업에 사용하지 않는다.

FluidSynth 오프라인 렌더링은 실제 확보한 CLI 2.4.4로 가능하다. 이 환경 경로는 `/workspace/scratch/gm-tools/local/usr/bin/fluidsynth`; FFmpeg/FFprobe는 7.1.5이다. 기존 짧은 MIDI로 SF2→44.1kHz stereo WAV 출력 성공을 확인했다. 이 사전 확인은 새 42곡 녹음 완료를 뜻하지 않는다. 도구가 없어 녹음 전체를 생략하는 폴백은 현재 필요 없다.

## 3. 악보 규칙과 악기 배정

아래 번호는 **GM 관용 표기 1–128**, 괄호는 실제 MIDI Program Change **0–127**이다. 채널은 사람 표기 1–16, MIDI 바이트는 0–15. 모든 선율 악기는 bank MSB/LSB 0, 드럼은 채널 10(바이트 9)의 Standard Kit, PC 0이다. GM2/GS 전용 음색은 요구하지 않는다.

SMF format 1, PPQ 480, tempo 메타트랙 + **실제로 음표가 있는 악기 트랙 4–7개**. conductor 메타트랙까지 합쳐 최대 8트랙으로 제한한다. 같은 tick의 note-off를 note-on보다 먼저 기록하고 모든 음을 종료한다. 악기별 CC7·CC10·CC11과 PC를 처음에 명시한다. 무작위 생성이나 실행 시 임의 편곡을 하지 않는다.

| 곡 | ch1 주선율 | ch2 반주 | ch3 베이스 | ch4 응답/지속음 | 추가 트랙 |
|---|---|---|---|---|---|
| meadow | Marimba 13(12) | Nylon Guitar 25(24) | Acoustic Bass 33(32) | Pizzicato Strings 46(45) | ch5 Flute 74(73), ch10 가벼운 드럼 |
| sea | Steel Drums 115(114) | Vibraphone 12(11) | Finger Bass 34(33) | String Ensemble 1 49(48) | ch5 Nylon Guitar 25(24), ch10 드럼 |
| sky | Celesta 9(8) | Music Box 11(10) | Acoustic Bass 33(32) | Warm Pad 90(89) | ch5 Choir Aahs 53(52), 기본 드럼 없음 |
| study | Electric Piano 1 5(4) | Nylon Guitar 25(24) | Acoustic Bass 33(32) | Pizzicato Strings 46(45) | 없음: 4트랙 |
| castle | Clarinet 72(71) | Pizzicato Strings 46(45) | Cello 43(42) | French Horn 61(60) | ch10 가벼운 드럼 |
| continent-castle | French Horn 61(60) | String Ensemble 1 49(48) | Contrabass 44(43) | Brass Section 62(61) | ch5 Timpani 48(47), ch10 드럼 |
| play | Xylophone 14(13) | Piano 1(0) | Finger Bass 34(33) | Clavinet 8(7) | ch10 드럼 |
| storm | Flute 74(73) | Marimba 13(12) | Pick Bass 35(34) | Pizzicato Strings 46(45) | ch10 드럼 |

주선율 velocity 64–84, 반주 40–62, 베이스 54–70, 지속음 36–48, 드럼 38–58. 대륙 성 금관도 86을 넘지 않는다. 팬은 베이스·킥 중앙, 반주 48, 응답 80 정도로 좁게 둔다. 음표 길이는 일반적으로 표기 길이의 85%, 지속음은 95%, 타악기 0.08초. 마지막 음의 note-off를 마디 끝보다 늦추지 않는다. 잔향은 렌더 단계에서 보존한다.

드럼 음번호: kick 36, sidestick 37, snare 38, closed hat 42, tambourine 54. 기본 패턴은 kick 0·2박, sidestick 1·3박, hat 0.5·1.5·2.5·3.5박. meadow는 hat 절반을 생략, sea는 3.5박 tambourine을 4마디마다 추가, play/storm은 hat를 매 반박 사용한다. 드럼을 꺼도 최소 4개 선율 트랙이 남는다. Timpani는 조율 타악기이므로 ch5의 선율 악기이며 ch10으로 옮기지 않는다.

### 원곡 악보

`음:박` 표기, `R`은 쉼표, 각 줄은 4박 한 마디다. 아래 A/B 16마디를 그대로 쓴 뒤 다음 규칙으로 32마디를 완성한다.

- A′(17–24마디): A의 음높이·리듬 유지, 주선율 velocity를 6 낮추고 ch5가 18·20·22마디 마지막 두 음을 한 옥타브 아래에서 응답한다. sky의 ch5 합창은 이 음들을 연결한 2박 지속음으로 쓴다. A′ 반주는 기본 패턴과 반대 패턴이다.
- B′(25–32마디): B의 1–6마디는 그대로, 31마디는 각 곡 B의 7마디, 32마디는 아래 별도 종지. 29–30마디에서 ch4를 한 옥타브 낮추고 마지막 한 박은 주선율 쉼표로 두어 첫 마디로 돌아갈 공간을 확보한다.
- 따라서 단순한 8마디 루프를 길이만 늘리지 않고, 16마디 선율·화성에 응답, 반주 변화, 종지를 가진 32마디 형식이다.

**meadow**, 새 제목 「풀잎 우편길」, C major, 108 BPM. A 화성 `C F Am G | Em F Dm G`, B `Am Em F C | Dm Am F G`.

```text
A: G4:.5 C5:1 E5:.5 D5:1 G4:1
   A4:1 C5:.5 F5:.5 E5:1 C5:1
   E5:1.5 C5:.5 A4:1 B4:1
   D5:.5 B4:.5 G4:1 A4:1 R:1
   B4:1 E5:1 G5:.5 E5:.5 D5:1
   C5:.5 A4:.5 C5:1 F5:1 E5:1
   F5:1 E5:.5 D5:.5 A4:1 C5:1
   B4:1 D5:.5 G5:.5 D5:1 R:1
B: C5:1 E5:.5 A5:.5 G5:1 E5:1
   G5:.5 B4:.5 E5:1 D5:1 B4:1
   A4:1 C5:1 F5:1 G5:.5 A5:.5
   G5:1 E5:1 D5:.5 C5:.5 G4:1
   A4:.5 D5:.5 F5:1 E5:1 D5:1
   E5:1 C5:1 A4:.5 C5:.5 E5:1
   F5:1 C5:.5 A4:.5 C5:1 D5:1
   D5:1 B4:.5 A4:.5 G4:1 R:1
32: B4:1 D5:.5 G4:.5 A4:1 R:1
```

**sea**, 새 제목 「물결 사이 편지」, G major, 96 BPM. A `G C Em D | Am C G D`, B `Em C Am D | G Em C D`.

```text
A: D5:1 B4:.5 A4:.5 G4:1 D5:1
   E5:1.5 G5:.5 E5:1 C5:1
   B4:.5 E5:1 G5:.5 F#5:1 E5:1
   F#5:1 D5:1 A4:.5 D5:.5 R:1
   C5:1 E5:.5 A5:.5 G5:1 E5:1
   G5:1 E5:1 D5:.5 C5:.5 E5:1
   D5:.5 B4:.5 G4:1 B4:1 D5:1
   A4:1 D5:1 F#5:1 R:1
B: E5:.5 B4:.5 E5:1 G5:1 B5:1
   G5:1.5 E5:.5 C5:1 D5:1
   E5:1 A4:1 C5:.5 E5:.5 G5:1
   F#5:1 E5:.5 D5:.5 A4:1 R:1
   B4:1 D5:1 G5:.5 A5:.5 B5:1
   G5:.5 E5:.5 B4:1 E5:1 F#5:1
   E5:1 C5:1 G4:.5 C5:.5 E5:1
   F#5:1 A5:.5 F#5:.5 D5:1 R:1
32: F#5:1 E5:.5 D5:.5 A4:1 R:1
```

**sky**, 새 제목 「별가루 보관함」, D major, 88 BPM. A `D G Bm A | Em G D A`, B `Bm Em G A | D Bm Em A`.

```text
A: A4:1 D5:2 F#5:1
   G5:1 D5:1 B4:1 R:1
   F#5:1.5 D5:.5 B4:2
   E5:1 C#5:1 A4:1 R:1
   B4:1 E5:2 G5:1
   D5:1 B4:1 G4:1 A4:1
   F#5:1 E5:1 D5:1 A4:1
   C#5:2 E5:1 R:1
B: D5:1 F#5:1 B5:2
   G5:1 E5:2 B4:1
   B4:1 D5:1 G5:1 A5:1
   E5:2 C#5:1 R:1
   F#5:1 A5:1 D6:1 A5:1
   F#5:1 D5:1 B4:2
   E5:1 G5:1 F#5:1 E5:1
   C#5:1 E5:1 A4:1 R:1
32: C#5:1 E5:1 A4:1 R:1
```

반복 화성은 B′ 끝의 딸림화음에서 A 첫 으뜸화음으로 돌아온다. 일반 반주는 C3–G5, 주선율은 이동 후 MIDI 55–88, 베이스는 MIDI 36–55에 둔다. 범위를 벗어나면 트랙 전체를 옥타브 단위로 옮기며 선율 중간의 음만 접지 않는다.

반주 P0은 화음의 낮은 root–third–fifth–third를 0·1·2·3박, 각 0.7박으로 친다. P1은 0·2박에 1.4박 화음, 1.5·3.5박에 fifth 단음을 0.35박 친다. 베이스 P0은 root 0박·fifth 2박 각 1.7박, P1은 root 0박 1.2박·fifth 1.5박 0.35박·root 2.5박 1박. ch4는 0박의 third/fifth 3.6박 지속(피치카토는 0·2박 각 0.4박), ch5 응답은 4·8·12·16마디 끝 두 음을 1박씩 한 옥타브 아래에서 연주한다. A′의 추가 응답과 겹치지 않는다. sky는 반주를 한 옥타브 낮추고 P0 음을 0·2박만 친다.

## 4. 세계별 30판의 결정 규칙

`n`은 대륙 안 세계 번호 1부터, `j=n-1`. `worldId`와 논리적 대륙 id가 별개인 점을 유지한다. 실제 존재하는 8/15/7개만 만든다.

- 주선율 프로그램 순환: meadow `[12,73,24,45]`, sea `[114,11,73,24]`, sky `[8,10,11,73]`의 `j mod 4`(여기만 **0 기반 PC**). 이웃한 두 세계는 반드시 다르다.
- 반주: `j mod 2`에 따라 P0/P1. 따라서 모든 이웃 세계는 주선율과 반주라는 두 축이 반드시 다르다.
- 조 옮김: `[0,+1,-1,+2,-2][j mod 5]` 반음. 선율 악기만 이동, 드럼은 이동하지 않는다.
- 템포: 원속도 × `[1,.96,1.04,.98,1.02][j mod 5]`. MIDI에는 `tempoUs = round(60_000_000 / 목표BPM)` 기록. manifest BPM은 실제 `60_000_000/tempoUs`, ±8%를 검사한다.
- 드럼: meadow/sea는 `j mod 3 != 1`, sky는 모든 세계에서 없음. ch5가 5번째 선율 트랙으로 남으므로 최소 트랙 수는 지킨다.
- 같은 대륙의 전체 선택 튜플 `(lead, pattern, transpose, tempo, drums)`은 중복되지 않는다. 이 공식은 n=1..15에서 중복 없이 결정된다.
- `meadow`, `sea`, `sky`는 각각 `p1-01`, `p2-01`, `p3-01` 파일 별칭. 데모 `d1-01`, `d1-02`, `d2-01`도 각각 `p1-01`, `p1-02`, `p2-01`에 명시적으로 매핑한다. 모르는 세계는 그 대륙 기본 별칭으로 간다.

세계마다 전체 파일을 다시 요청하지 않도록 같은 asset id는 캐시하며, 음악이 꺼져 있을 때는 30개 파일을 미리 받지 않는다.

## 5. 화면 곡과 징글

화면곡은 모두 16마디. 아래 4마디 M을 4회 사용하되, 5–8마디는 M의 각 마디에서 첫 두 음의 **음높이만 교환**(길이는 유지), 9–12마디는 M 그대로에 ch4 응답, 13–15마디는 5–7마디와 같고 16마디는 M4 마지막 한 박을 쉼표로 한다. 화성 4마디를 반복하고, 각 4마디 묶음의 반주 P0/P1을 교대한다. 공부곡만 P0을 0·2박으로 축소하고 ch4는 4·8·12·16마디에만 친다.

| id | BPM/조/화성 | 새 제목·역할 |
|---|---|---|
| study | 76 / C / `C Am F G` | 「책상 위 작은 길」, lead C4–E4 중심, 드럼 없음 |
| castle | 112 / D minor / `Dm Bb Gm A` | 「돌문 앞의 약속」, 짧은 목관·현악 응답 |
| continent-castle | 104 / D minor / `Dm Gm Bb A` | 「큰 문을 여는 날」, 금관·팀파니, 음량을 키우지 않고 악기층으로 규모 표현 |
| play | 132 / F / `F Dm Bb C` | 「주머니 속 놀이」, 가벼운 박자 |
| storm | 124 / A minor / `Am Dm F E` | 「빙글 도는 배달길」, 일정한 8분음표·쉼표, 겁주는 불협화음/사이렌 없음 |

```text
study M:
 C4:2 E4:1 R:1 | E4:1 C4:2 R:1 | A3:2 C4:1 R:1 | B3:1 D4:1 G3:1 R:1
castle M:
 A4:.5 D5:.5 F5:1 E5:1 D5:1 | F5:1 D5:.5 Bb4:.5 C5:1 D5:1
 D5:.5 G5:.5 Bb5:1 A5:1 G5:1 | E5:1 C#5:1 A4:1 R:1
continent-castle M:
 D4:1 A4:.5 F4:.5 D5:2 | Bb4:1 G4:1 D5:1 G4:1
 F4:1 Bb4:1 D5:1 F5:1 | E5:1 C#5:1 A4:1 R:1
play M:
 C5:.5 F5:.5 A5:.5 G5:.5 F5:1 C5:1 | F5:.5 D5:.5 A4:1 D5:.5 F5:.5 A5:1
 D5:1 F5:.5 Bb5:.5 A5:.5 F5:.5 D5:1 | E5:.5 G5:.5 C6:1 G5:1 R:1
storm M:
 E5:.5 A4:.5 C5:.5 E5:.5 D5:.5 C5:.5 A4:1 | F5:.5 D5:.5 A4:.5 D5:.5 E5:1 F5:1
 C5:.5 F5:.5 A5:.5 G5:.5 F5:.5 E5:.5 C5:1 | B4:.5 E5:.5 G#5:1 E5:1 R:1
```

징글은 **각각 네 트랙**: ch1 주선율, ch2 짧은 화음 응답, ch3 베이스, ch4 끝 화음의 상성부. 아래 선율과 화음에서 다른 세 파트를 만든다. 베이스는 화음 root C3–B3, 처음·마지막 박을 친다. ch2는 시작 화음 third/fifth를 처음에 0.3박, 끝 화음 third/fifth를 마지막 음 시작에 그 길이만큼 친다. ch4는 마지막 화음 root 한 옥타브 위를 마지막 음 시작부터 친다. 마지막 음이 쉼표이면 직전 유성음 기준이다. 노트가 없는 빈 트랙을 수에 넣지 않는다. 몸통 뒤 1마디 이상의 release tail을 녹음한다.

| id / 새 제목 | BPM | ch1/ch2/ch3/ch4 GM PC(0 기반) | 화성, 새 주선율 |
|---|---:|---|---|
| clear / 한 걸음 도착 | 144 | 12/24/32/45 | C→C, `G4:.5 C5:.5 D5:.5 E5:.5 C5:1` |
| victory / 문을 열었어요 | 120 | 60/48/43/61 | D→D, `A4:.5 D5:1 F#5:.5 E5:.5 A5:.5 F#5:1 D5:2` |
| key / 반짝이는 열쇠 | 144 | 8/10/32/11 | G→G, `B4:.25 D5:.25 A5:.5 G5:1` |
| item / 작은 발견 | 152 | 11/12/33/24 | F→F, `C5:.25 A4:.25 D5:.5 F5:1` |
| grade / 한 칸 더 자람 | 150 | 73/45/32/12 | C→C, `G4:.25 D5:.25 E5:.5 C5:1` |
| bat / 잠깐 돌아봐요 | 116 | 71/45/42/12 | Dm→Dm, `A4:.5 F4:.5 E4:.25 F4:.25 D4:1` |
| storm-caught / 바람의 한 바퀴 | 132 | 73/12/34/45 | Am→Am, `E5:.25 A5:.25 G5:.25 E5:.25 C5:.5 B4:.5 A4:1` |

## 6. 녹음, 음량, 이음매

`tools/render_music.sh [SF2 경로]` 또는 `SOUNDFONT=... bash tools/render_music.sh`. `FLUIDSYNTH`, `FFMPEG`, `FFPROBE` 실행 파일 경로 환경변수를 허용한다. 기본값은 PATH. 유료 도구나 서버 요청은 없다. 없는 도구·잘못된 폰트는 명확히 실패시키며 반쯤 생성한 manifest를 정상 결과로 덮어쓰지 않는다. 임시 폴더에서 전부 검증한 후 파일·manifest를 교체한다. 재실행의 곡 목록과 MIDI 바이트는 같아야 하며 바이너리 코덱 버전이 달라진 AAC 해시까지 같다고 약속하지 않는다.

### 포맷과 음량

- FluidSynth `-ni -q -a file -r 44100 -F ...`로 오프라인 stereo WAV. chorus off, reverb는 작은 room·낮은 level로 고정하며 실제 옵션을 렌더러와 결과에 기록한다. 미세한 랜덤 효과를 피한다.
- FFmpeg AAC-LC, 44,100Hz, stereo, **96kbps**, M4A/MP4, `+faststart`. 용량 여유가 있더라도 기본 96kbps를 유지한다.
- 반복곡의 실제 반복 영역을 기준으로 integrated loudness **−24 LUFS ±1 LU**, study는 말소리 공간을 위해 **−27 LUFS ±1 LU**. 최대 true peak **−6 dBTP 이하**, clipping 0. 먼저 측정하고 동일한 선형 gain으로 전체 PCM을 조절한다. 동적 loudnorm이 루프 안에서 gain을 변화시키게 하지 않는다. peak cap과 loudness 목표가 충돌하면 편곡/velocity를 조정한다.
- 징글은 짧으므로 유성 구간 stereo RMS **−24 dBFS ±1 dB**, true peak **−6 dBTP 이하**. 긴 무음 꼬리를 RMS에 넣지 않는다. 코덱 후 재측정한다.
- 파일 자체에 보정 후 manifest `gain: 1`; 재생 시 기존 `musicVol ?? .5`를 유지한다. `duck(true)`는 기존처럼 음악 gain을 **0.18배**(약 −15dB), 약 0.15초 램프. 징글도 단어 음성이 시작되면 같은 duck 감쇠를 적용해 단어를 가리지 않게 한다. SFX 원음·합성은 바꾸지 않는다.
- 단어 재생을 시작할 때 감쇠가 켜지고, 파일의 ended/error 또는 speech의 end/error에서 풀리게 관리한다. 기존 성공/실패 판정, 말 시작 시 버튼 허용은 그대로다. 겹친 징글/단어의 한 종료 콜백이 다른 duck을 조기에 풀지 않도록 원인별 상태를 합친다. 기기 TTS 음량은 기기마다 다르므로 iPad 실청 확인이 최종이다.

### 반복 구간과 AAC priming: 측정한 사실

2026-11-17 사전 실험: 3초 stereo 44.1kHz 원본(0.5초 이후 chirp)을 FFmpeg 7.1.5의 `aac -b:a 96k -ar 44100 -ac 2 -movflags +faststart`로 인코딩했다. 첫 AAC packet PTS는 **−1024**, `Skip Samples=1024`(23.21995ms). 그러나 원본과 상호상관한 디코딩 파형의 **잔여 앞 지연은 0 samples**였다. FFmpeg decode는 133,120 frames(뒤 padding 포함), Chromium **156.0.8078.79**의 `decodeAudioData`는 정확히 132,300 frames였다. 브라우저도 잔여 앞 지연 0 samples. 즉 raw encoder delay 1024를 loopStart에 무조건 더하면 틀린다. MP4의 skip/edit 메타데이터가 이미 앞 지연을 제거할 수 있다.

이것은 **실험 코덱/브라우저 한 조합의 측정**이다. 완성 음악마다 원 PCM과 디코딩 PCM의 여러 비무음 창을 상호상관하여 잔여 offset을 검증한다. Safari 실청/실측은 아직 하지 않았다. 뒤 padding은 decode 결과마다 달라도 반복 경계 밖이므로 재생에 포함시키지 않는다.

### 재현 가능한 루프 제작 절차

1. 1회 음악 길이를 MIDI 실제 tempo 메타값으로 계산한다. `N = round(bars * 4 * tempoUs * 44100 / 1_000_000)` samples, 한 마디 `P = round(4 * tempoUs * 44100 / 1_000_000)`. BPM 표시값을 다시 반올림해서 쓰지 않는다.
2. 렌더용 임시 MIDI는 같은 32/16마디를 **3회** 연주하고 모든 note-off 뒤 **1마디 이상 release tail**을 둔다. 최종 v3 MIDI 원본은 음악 한 회와 tail이며, 임시 3회본은 Git에 넣지 않는다. 중앙 회차를 이용해 앞 회차 잔향이 첫 박에 이미 존재하게 한다.
3. 중앙 회차의 N samples를 본체로, 앞 한 마디를 pre-roll로, 뒤 한 마디 이상을 여유로 보존한다. 처음/끝에서 강제로 무음으로 fade하여 박자가 꺼지게 하지 않는다.
4. 파형 경계에 불연속이 남으면 **10ms(441 samples) 짧은 오프라인 선형 crossfade**로 본체 첫 10ms를 직전 끝의 자연스러운 다음 10ms와 혼합한다. 첫 sample은 끝의 연속 sample, 441번째부터는 원래 첫 부분이다. 본체 길이 N은 바꾸지 않는다. 필요한 경우 pre-roll 마지막 한 마디를 수정된 본체의 마지막 한 마디로, 뒤 여유 첫 한 마디를 수정된 본체 첫 한 마디로 맞춰 코덱에 연속 문맥을 준다. 잔향을 녹음한 원 PCM은 별도로 확인한다. 한 박/한 마디를 겹쳐 곡 길이를 줄이는 방식은 쓰지 않는다.
5. 보정 PCM을 AAC로 인코딩한다. `encodedDelaySamples`는 packet 정보(실험 1024), `decodedOffsetSamples`는 **상호상관 실측 잔여 앞 지연**(실험 0)으로 별도로 기록한다. `loopStart = (P + decodedOffsetSamples)/44100`, `loopEnd = (P + N + decodedOffsetSamples)/44100`. 별도 decoder가 다른 offset을 보이면 자동으로 추측하지 말고 측정·기록 후 해결한다.
6. `decodeAudioData`한 buffer에서 loopStart/End를 설정하고 `source.start(when, loopStart)`로 첫 박부터 시작한다. pre-roll을 처음에 들려주거나 HTMLAudio `.loop`를 쓰지 않는다. Web Audio가 출력 장치 sample rate로 resample하더라도 경계는 초 단위로 적용한다.
7. 검사에서 AAC를 실제 decode하고 경계 양옆 10ms RMS 차이 6dB 이내, 마지막→첫 sample jump가 각 채널에서 `max(.01, 경계 주변 일반 인접sample차 p99*2)` 이내인지 보고한다. 적어도 3회 연결한 WAV도 Git 밖으로 만들어 듣는다. 이 수치만으로 음악적 이음매를 보증하지 않으므로 iPad/mac 실제 반복 청취 목록은 남긴다.

반복 구간만 약 40–90초, prefix/tail은 각 한 마디 정도다. 42파일 합계는 대략 30–34MB로 예상한다. 이는 예측이며 최종 `du -sh`와 실제 byte 합계를 기록한다. **40MB 초과 시 파일을 숨겨 빼거나 기준을 바꾸지 말고 C-010의 막히면에 결과를 적고 중단한다.**

## 7. manifest와 재생 계약

`manifest.json`은 새 음악 파일 목록의 유일한 원천. 아래 구조를 사용한다(수치는 예시 식이며 실제 렌더 결과로 채운다).

```text
schemaVersion: 1
sampleRate: 44100
soundfont: { name, version, sha256, source, license }
aliases: { meadow: "p1-01", sea: "p2-01", sky: "p3-01",
           "d1-01": "p1-01", "d1-02": "p1-02", "d2-01": "p2-01" }
tracks: {
  "p1-01": { file: "p1-01.m4a", kind: "loop", scene: "meadow",
    bars: 32, beatsPerBar: 4, tempoUs, bpm,
    transpose: 0, leadProgram: 12, accompaniment: "P0", drums: true,
    programs: [12,24,32,45,73], channels: [1,2,3,4,5,10],
    sampleRate: 44100, frames, loopStart, loopEnd, gain: 1,
    encodedDelaySamples, decodedOffsetSamples, preRollSamples, loopSamples,
    tailSamples, duration, loudnessLufs, truePeakDb },
  ...
  "clear": { file: "clear.m4a", kind: "jingle", loopStart: 0,
    loopEnd: null, gain: 1, duration, ...측정 메타데이터 }
}
```

`frames`와 `duration`은 검사한 브라우저 decoded buffer 기준으로 기록하고, 파일 container duration과 뒤 padding 때문에 다를 수 있음을 검사기가 구분한다. 데이터 필드 이름은 저장 형식과 무관한 새 에셋 계약이다. 파일 경로는 이 폴더의 상대경로만, alias cycle/없는 대상은 오류다.

`Sound.scene(id, options = {})`에서 `options.worldId` 또는 `options.variant`만 추가한다. 기존 한 인자 호출은 유효하다.

- 지도: `scene(musicOf(w), {worldId: w.id})`; 모든 지도 복귀·홈의 음악 선택 줄에도 적용한다.
- 세계 성·박쥐: `scene('castle')`. 대륙 성 `node.kind === 'finale'`: `scene('castle', {variant:'continent-castle'})`. 논리 id와 기존 `seen`의 `scene:castle`을 보존하면서 별도 파일을 고른다.
- 공부 `scene('study')`, 놀이집·번개 `scene('play')`, 회오리 판 `scene('storm')`, 잡힌 화면에서 `jingle('storm-caught')`를 추가한다. 기존 `gate` 효과음은 유지한다.
- `seen`에는 기존과 똑같이 **논리 id**가 기록된다. 세계가 바뀌어도 `scene:meadow`이다. `music.track.id`도 논리 id (`meadow`)를 유지해야 기존 e2e가 통과한다. 실제 `assetId`/`file`, `source`, `backend`는 별도 공개 상태로 둬 추가 검사가 녹음 재생 여부를 검증하게 한다.
- `music`는 기존의 `.on`, `.track`, `.duck()`, `.setVolume()`, `.stop()` 계약을 유지한다. 같은 논리 scene여도 assetId가 달라지면 바꾼다. `setMusic(false)`는 요청 세대를 무효화하고 source를 중지하며, 늦게 완료된 fetch가 음악을 다시 켜지 못하게 한다. 켜기에서는 마지막 id와 options를 함께 재사용한다.
- manifest 누락/잘못된 항목/HTTP 실패/decode 실패/범위 밖 loop면 조용히 기존 칩튠으로 돌아간다. 화면 오류·단어 음성 실패 카운트에 영향을 주지 않는다. 폴백: 세계→그 대륙 id, `continent-castle`→`castle`, `storm`→`study`, `storm-caught`→`bat`, 나머지는 같은 id. 폴백도 `seen` 기록을 다시 다른 이름으로 쓰지 않는다.
- scene 호출마다 증가하는 request token으로 늦은 응답을 무효화한다. 재생 중인 이전 곡은 새 곡 또는 폴백이 준비되면 짧은 gain ramp로 정리한다. 같은 asset 재호출은 곡을 처음부터 다시 시작하지 않는다. 꺼짐/scene 전환 시 이전 node·타이머를 정리한다.
- 모바일 메모리를 위해 decoded loop 캐시는 현재 곡 포함 최대 3개(약 100MB 안쪽), LRU 방식. 징글은 작은 별도 캐시. 42개 전체를 decode하지 않는다. 음악/징글은 기존 tap-handler의 unlock된 AudioContext를 공유한다.

`main.js`에서는 위 scene 호출의 인자와 징글 호출만 바꾼다. 화면 구성, 진행 규칙, 저장, 버튼, 타이머, 카드 판정 조건은 건드리지 않는다.

## 8. 검사와 완료 보고

`tools/check_postal_music.cjs`의 기존 칩튠/효과음 검사를 보존하고 새 검사를 추가한다. 기본 명령으로 다음을 모두 확인한다.

- 30세계·5화면·7징글의 정확한 목록, MIDI의 4–7 실음표 트랙(메타 포함 최대 8), GM PC와 ch10, 대륙 32마디, 변주 범위·이웃 악기 차이·두 축 차이·alias 대상.
- 42개 파일 존재, AAC-LC/44.1k/stereo/96kbps 목표, decode 성공, 실제 길이, loopStart<loopEnd≤buffer.duration, 반복 길이 오차는 44.1kHz 기준 1sample 이내, 끝 여유 최소 1마디(디코더 rounding 허용 1sample), 음량·clipping·seam 수치. 뒤 AAC padding을 반복 길이에 넣지 않는다.
- manifest를 읽기만 하며 체크 명령이 옛 `norm`이나 SFX를 재보정하지 않는다. 새 파일이 빠진 완성 PR은 검사 실패이다. 런타임 폴백이 가능하다는 이유로 미완성 배포 파일을 합격시키지 않는다.

`tests/cards_e2e.cjs`는 기존 149개 검사를 삭제/완화하지 않고 **다음 4개 검사만 추가**한다. 실제 `nosound`가 아닌 AudioContext와 실제 AAC decode 경로를 사용한다.

1. 음악을 켜고 데모 대륙 1의 두 지도를 실제 화면 흐름으로 연다. `backend === 'gm'`, 서로 다른 `.file`과 요청, `track.id === 'meadow'`, `seen.has('scene:meadow')`를 확인한다.
2. 신규 context에서 `**/assets/postal/music-gm/*.m4a` 요청을 막아 chip backend가 켜지고 기존 track이 재생되며 오류 화면과 uncaught error가 없는지 확인한다. 캐시된 이전 음원을 이용하지 않는다.
3. 카드 판에서 실제 단어 재생 경로가 호출될 때 음악 `ducked`와 gain 목표가 정상의 0.18배가 되는지 확인한다. 말 종료/정지 뒤 회복도 확인한다. 테스트가 `.duck(true)`를 직접 호출해서 통과시키지 않는다.
4. 실제 재생 중 AudioBufferSourceNode `.loop`, `.loopStart`, `.loopEnd`가 그 파일 manifest 값과 일치하고 source가 loopStart에서 시작되는지 확인한다. 모의 객체의 값만 확인하지 않는다.

카드의 전체 명령을 실행한다: 생성기, 렌더러, 음악 검사, 전체 단위 검사, 전체 브라우저 검사(예상 153), `check_sim_baseline`, 용량. 생성기 재실행 후 기존 JSON/SFX/v2 MIDI와 새 MIDI·목록이 안정적인지 확인한다. 최종 보고에 도구 버전, 폰트 hash, 42곡 수, 용량, 실제 delay/offset 범위, LUFS/peak/seam 결과, 테스트 결과를 적는다. README 음악 절, 카드 결과, BOARD 상태, WORKLOG 8절 한 줄도 허용 범위에서 갱신한다.

## 막히면

현재 추가 사용자 결정이 필요한 항목은 없다. 라이선스와 폰트를 확보했고 오프라인 렌더링 도구도 실제 작동한다. 구현 중 승인된 범위를 넘어서는 선택이 필요하거나 40MB를 넘으면 C-010의 같은 절에 구체적인 질문/측정치를 적고 멈춘다. iPad/mac의 음색·말소리 우선·반복 이음매 청취는 사용자 확인 목록으로 남으며 자동 검사 통과와 혼동하지 않는다.
