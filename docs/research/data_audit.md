# vocabulary.json 데이터 감사 (읽기 전용)

대상: `reference/weekly-tool/vocabulary.json` (cards 6,591장, starter 500장, pictures 323개, 2026-11-11 기준).
방법: `python3 -I` 스크립트로 전수 집계. 아래 "휴리스틱" 표시는 사람이 확인해야 하는 추정이다.
전체 윤곽: kind = 기본 6,485 / 불규칙 과거형 84 / 감정 형용사 18 / 패턴 4. track = vocab 6,394 / sight 121 / curriculum 72 / wordplay 2 / compound 2. starter 500장은 전부 sense_order 1.

## 1. 동형이의어(homograph) 키 점검

오디오가 card_id 기준이므로 "의미/시제별 카드 분리"와 "ipa_us 정확성"을 따로 본다. 요청한 7개 모두 카드는 분리되어 있고 IPA도 의도와 일치한다. 단 `wind:1`만 starter가 아니다.

| 단어 | card_id | 뜻 | kind | ipa_us | starter | 판정 |
|---|---|---|---|---|---|---|
| present | W2816:기본:present:1 | 선물 | 기본 | /ˈpɹɛzənt/ | 261 | OK |
| | present:2 현재의 / :3 출석한 | | 기본 | /ˈpɹɛzənt/ | - | OK (형용사도 앞강세) |
| | present:4 | 제시하다 | 기본 | /pɹɪˈzɛnt/ | - | OK 동사 |
| read | W2963:기본:read:1 | 읽다 | 기본 | /ɹid/ | 63 | OK |
| | W2963:불규칙 과거형:read:1 | 읽었다 | 불규칙 과거형 | /ɹɛd/ | - | OK, card_id 분리됨 |
| live | live:1 살다 /lɪv/ ; :2 살아 있는 /laɪv/ ; :3 생방송의 /laɪv/ | | 기본 | | 61 | OK |
| wind | W4197:기본:wind:1 | 바람 | 기본 | /wɪnd/ | - | OK |
| | wind:2 | 감다 | 기본 | /waɪnd/ | - | OK |
| tear | W3753 tear:1 눈물 /tɪɹ/ ; :2 찢다 /tɛɹ/ | | 기본 | | - | OK |
| close | W0695 close:1 닫다 /kloʊz/ ; :2 가까운 /kloʊs/ | | 기본 | | 215 | OK |
| record | W2981 record:1 기록 /ˈɹɛkɚd/ ; :2 기록하다 /ɹɪˈkɔɹd/ | | 기본 | | 350 | OK |

관찰:
- 카드_form이 같은 것을 표기 철자(`card_form`)로 찾으면 모호하다. 1,608개 form이 카드 2장 이상이고, 서로 다른 lemma_link가 같은 form을 쓰는 경우가 4건이다: left(W2062 past of leave / W2064 왼쪽), bit(W0354 조금 / W0355 bite 과거), rose(W3099 / W3125 꽃), saw(W3252 보다 / W3194 톱). 키는 반드시 card_id로 잡아야 한다.
- 과거형 카드의 card_form이 기본형과 동일한 것이 6개(cut, hit, hurt, let, put, read). 철자 타일/매칭에서 구별 불가.
- **더 큰 문제(발견)**: ipa_us가 다른 동형이의어는 위 7개 form뿐이다 (자동 추출이 form 단위라서 7개만 수작업 보정된 것으로 보인다). 같은 형태의 명사/동사 발음 차이가 있는 단어는 전부 한 발음으로 뭉쳐 있다. starter 안의 실제 오류:
  - use (starter 32, W4034:기본:use:1 사용하다) /jus/ -> 동사는 /juz/. 명사 use:2만 /jus/가 맞다.
  - lead (218, 이끌다) /lɛd/ -> /lid/. (금속 lead의 발음. led와 동음.)
  - minute (371, 분) /ˈmɪnut/ -> /ˈmɪnɪt/. ("미세한" 발음을 가져옴)
  - produce (441, 생산하다) /ˈpɹoʊdus/ -> 동사 /pɹəˈdus/. (농산물 produce:2만 맞음)
  - increase (201, 늘다) /ˈɪnˈkɹis/ -> 동사 /ɪnˈkɹis/. 명사 /ˈɪŋkɹis/와 구별 없음
  - sometimes (367) /səmˈtaɪmz/ -> /ˈsʌmtaɪmz/ (명백한 오추출)
  - starter 밖: excuse(동사 /ɪkˈskjuz/), object/project/permit/contract/estimate/separate 동사형, desert(버리다 /dɪˈzɝt/), content(만족하는 /kənˈtɛnt/), wound(둘 다 /waʊnd/ -> /wund/), bow(리본/활 /boʊ/ vs 절하다 /baʊ/), row(줄 /ɹoʊ/ vs 말다툼 /ɹaʊ/), refuse /ˈɹɛˈfjus/ -> /ɹɪˈfjuz/.
- starter 내 동음이의(IPA 완전 동일) 쌍: right/write (53, 81), hear/here (116, 25), see/sea (9, 247). 전체 starter 중 다른 카드와 IPA가 같은 카드는 40장(red/read(과거), blue/blew, new/knew, week/weak, sun/son, meet/meat, wait/weight, whole/hole 등). 소리->그림(depth 1) 과제의 오답 보기에 같이 넣으면 정답이 둘이 된다.

## 2. IPA 인공물

- 주강세 ˈ가 2개 이상인 카드: **693장** (2개 688, 3개 5). 서로 다른 lemma 585개. **starter 500 중 15장**.
  - Flite가 부강세를 전부 ˈ로 찍은 결과다. 예: shadow W3285 `/ˈʃæˈdoʊ/`(올바른 값 /ˈʃædoʊ/), cobweb W0713 `/ˈkɑbˈwɛb/`, classmate W0673, grandfather W1610, robot W3113 `/ˈɹoʊˈbɑt/`, taekwondo/nobody/dragonfly(ˈ 3개).
  - starter 15장: understand(222), upbeat(293), almost(302), always(149), however(173), birthday(475), classroom(483), information(184), photo(140), program(217), increase(201), although(265), process(272), situation(462), require(424).
  - 강세 위치까지 틀린 것: refuse `/ˈɹɛˈfjus/`, require `/ˈɹiˈkwaɪɚ/`(정답 /ɹɪˈkwaɪɚ/), realize `/ˈɹiˈlaɪz/`, sometimes(위 참조).
- ipa_us 빈 카드: 461장 (starter 0). 구성은 표현 카드(공백 포함 form) 455 + 패턴 3 + 기타. 철자 안내용이므로 starter에는 영향 없음.
- 보조 기호: `ɹ` 사용(미국 /r/ 표기 변형, 일관됨), `ˌ`(부강세) 기호는 전체 0회. pronunciation_ko(한글 발음)는 120장만 있고(starter 108) 나머지는 비어 있음.

## 3. 불규칙 과거형 (kind == '불규칙 과거형')

- 총 **84장**, 전부 image_type 동작 / depth_target 2, **starter 0장** (그러나 starter 기본형 64개가 과거형 카드를 가짐: be, have, do, say, go, see, get, make, know, ... rise).
- single_meaning_ko가 기본형 뜻과 **동일: 75장 / 84** (89%). 과거 뜻이 다른 것은 9장뿐: was/were `~이었다`, read `읽었다`, fell `떨어졌다`, sank `가라앉았다`, rang `울렸다`, crept `살금살금 움직였다`, laid `놓았다`, left `떠났다`.
- 예시 10건 (card_id 접두 `W..:불규칙 과거형:`):
  1. W3286 shook = 흔들다 (기본 shake: 흔들다)
  2. W0426 broke = 깨다
  3. W0490 bought = 사다
  4. W0737 came = 오다
  5. W1567 gave = 주다
  6. W1584 went = 가다
  7. W1171 ate = 먹다
  8. W3730 took = 가지고 가다
  9. W3367 sat = 앉다
  10. W3359 sang = 노래하다
- 추가 이상: W0961 dealt = `약속` (명사 뜻이 과거형 카드에 들어감, 정답은 "다뤘다/거래했다" 계열)(기본형 뜻이 여러 개인 경우 대부분 첫 뜻만 복사됨).
- 결론: depth 2 "단어->뜻"에서 과거형 카드가 기본형 카드와 동일한 한글 뜻을 가져 구별 불가. 과거 표지("~했다")가 필요하다.

## 4. Starter 500의 sense_order 1 문제 (휴리스틱)

starter는 sense_order 1만 쓰므로 sense 1 선택이 곧 아이가 처음 배우는 뜻이다. 아이에게 더 기본인 뜻이 뒤에 있는 대표 사례 15건:

| starter | form | 현재 sense 1 | 더 기본인 뜻 | 이유 |
|---|---|---|---|---|
| 310 | light | 불을 붙이다 (:2 빛, :3 가벼운) | 빛 | 동사 "불붙이다"는 8세 어휘에 드묾 |
| 103 | water | 물을 주다 (:2 물) | 물 | 가장 일상적 명사가 2순위 |
| 113 | color | 색칠하다 (:2 색) | 색 | 명사가 기본 |
| 82 | name | 이름을 붙이다 (:2 이름) | 이름 | 동일 |
| 238 | reason | 추론하다 (:2 이유) | 이유 | "추론하다"는 사실상 쓰이지 않음 |
| 415 | free | 풀어주다 (:2 자유로운, :3 무료의) | 무료의/자유로운 | 동사 용법이 희귀 |
| 378 | top | 팽이 (:2 꼭대기) | 꼭대기 | 장난감 뜻이 앞섬 |
| 108 | question | 질문하다 (:2 질문) | 질문 | 명사가 기본 |
| 205 / 336 | plan / test | 계획하다 / 시험하다 | 계획 / 시험 | 아이가 접하는 것은 명사 |
| 327 | plant | 심다 (:2 식물) | 식물 | 동사가 앞섬 |
| 490 | stick | 붙이다 (:3 막대기) | 막대기 | 초등 기본은 명사 |
| 321 | deal | 약속 | 거래 / 다루다 | 번역 오류 가능("약속"은 promise) |
| 432 | surprise | 놀라게 하다 (:2 놀라움, :3 깜짝 선물) | 깜짝 선물/놀라움 | 아이 맥락은 명사 |
| 485 | orange | 주황색의 (:2 오렌지) | 오렌지(과일) | 그림(pictures)은 과일이고 sense 1은 색 |
| 431 | step | 발을 내딛다 (:2 걸음) | 걸음 | 명사 |

경계 사례(검토 권장): face 마주하다 vs 얼굴(180), circle 동그라미 치다 vs 원(227), product 곱 vs 제품(298), area 넓이 vs 지역(174), state 주 vs 상태(167), note 음표 vs 메모(400), mind 꺼리다 vs 마음(345), correct 고치다 vs 올바른(396), clear 맑은/분명한/명확한(381, 뜻 중복), type 타자를 치다 vs 종류(407), interest 흥미를 끌다 vs 관심(106).
그림과 뜻이 어긋나는 사례(pictures는 단어 단위 키): fly(232, 날다)는 파리 그림, watch(148, 지켜보다)는 손목시계 그림, ring(452, 울리다)은 반지 그림, orange(485, 주황색)은 오렌지 그림.

## 5. kind / image_type 오분류

감정 image_type 카드는 18장이며 전부 kind '감정 형용사'. 감정이 아닌 것(사람/사물 상태를 묘사):

- haunted W1703 `귀신이 나오는` (장소 상태) - 감정 아님
- terrifying W3775 `몹시 무서운` (사물 성질; terrified는 감정)
- exciting W1285, interesting W1910, boring W0396, amazing W0102, disgusting W1070 (모두 -ing형, 감정을 일으키는 대상)
- 감정 맞음: tired, worried, excited, scared, surprised, bored, confused, embarrassed, frightened, terrified, interested (11장)

역방향 오분류: 진짜 감정어가 '감정'이 아님 - happy(69)/sad(341)/angry(440)는 starter이면서 추상·기능, afraid, hungry, lonely, nervous, proud, shy, jealous, glad, furious 등 20여 개가 추상·기능, upset/calm/fear는 동작. 표정 과제를 쓰려면 happy/sad/angry가 '감정'이어야 한다.
소리 image_type 14장은 대부분 동물/현상 소리라 정상: scream, whisper, thunder, buzz, groan, hiss, hoot, howl, moan (scream/whisper/groan/hoot/moan은 :2 뜻이 소리가 아님).
**구체명사가 다른 type으로 분류**(starter, 휴리스틱): 추상·기능으로 분류된 구체 사물/사람 32개 - student, child, man, woman, boy, girl, mother, father, mom, dad, sister, brother, baby, parent, teacher, doctor, tree, sea, river, mountain, forest, sky, sun, flower, pencil, computer, ball, toy, monster, card, beach, video. 동작으로 분류된 구체 명사 약 12개 - book(115), fish, train, duck, bear, ship, rock, fire, box, park, farm, shop. 진짜 구체명사 태그는 42개뿐이라 실제로는 약 86개가 구체 사물인 셈이다.
패턴 4장(Fabumouse X015, scaredy-mouse X016, ear-splitting X021, spine-chilling X022)은 kind '패턴'이고 형용사/복합어인데 image_type 추상·기능.

## 6. depth_target 점검

- 전체 분포: depth 3 = 4,543 / 2 = 1,902 / 1 = 125 / 4 = 21. tier 비어 있는 카드 6,547장(99.3%): depth1 125, depth2 1,895, depth3 4,506, depth4 21. T2는 44장(depth3 37, depth2 7), T1/T3 값은 데이터에 아예 없음. Game_Handoff에는 "T3 최대 2, T2 최대 3"이라 되어 있으므로 tier 미지정 카드의 depth 3은 승인 팩에서 tier가 정해질 때까지 해석 불가.
- starter 500: depth 3 = 479, depth 4 = 21, depth 1/2 = 0. 

depth 4(철자) 21장 전부 starter 상위 고빈도 동사: ask(24), be(1), can(6), come(21), do(3), find(35), get(10), go(5), have(2), know(13), look(14), make(11), play(28), say(4), see(9), take(22), think(16), use(32), want(17), will(8), work(31).
문제: be/do/go/can/will/have/see는 철자가 2~3자라 철자 과제 가치가 낮고, come/know/say/want/think 같은 불규칙 철자가 6개 이상이라 첫 철자 단계에서 난도가 높다. cat/dog/hat/egg처럼 규칙적이고 그림이 쉬운 명사는 depth 3이라 선정 기준이 의도(철자는 선별한 T1 대상)와 어긋난다.
- depth 1(소리->그림) 125장 전부 sight 121 + wordplay 2 + compound 2 (starter 0). 그중 추상·기능 121 + 동작 4(last, like, own, please). sight 121장은 single_meaning_ko가 빈 값이라 소리->그림 과제 자체가 성립하지 않는다(읽기 트랙으로만 써야 함).
- starter 중 추상·기능 + depth 1은 **0장**. 다만 starter 추상·기능 234장(depth 3)이 depth 1을 거치면 소리->그림이 불가능하므로 ladder가 type별로 단계를 건너뛰는지 확인이 필요하다 (very, there, then, also, just, only, again 등).

## 7. starter 500 안의 유사 의미 군집

같은 한글 뜻(single_meaning_ko)을 가진 starter 쌍이 25개다 (word->뜻 4지선다에서 정답 둘):
big/large 큰 (60, 179), little/small 작은 (39, 104), begin/start 시작하다 (157, 100), maybe/perhaps 아마 (358, 435), say/speak 말하다 (4, 182), see/look 보다 (9, 14), good/nice 좋은 (20, 288), fast/quickly 빠르게 (200, 410), also/too 또한 (36, 40), include/involve 포함하다 (127, 393), offer/suggest 제안하다 (212, 330), class/lesson 수업 (165, 499), home/house 집 (111, 101), job/matter 일 (203, 344), power/force 힘 (334, 352), land/ground 땅 (412, 426), important/major 중요한 (159, 472), quite/rather 꽤 (263, 280), continue/keep 계속하다 (304, 143), year/sun 해 (23, 436), week/state 주 (122, 167), spend/write 쓰다 (241, 81), hour/time 시간 (228, 15), problem/issue 문제 (80, 188), climb/rise 오르다 (390, 500).

같은 장면에서 먼저 만날 위험이 큰 쌍(starter_order 차이 20 이하, 같은 주에 노출될 가능성): see/look(5), walk/run(2), also/too(4), sister/brother(6), shout/cry(9), home/house(10), land/ground(14), quite/rather(17), power/force(18). 차이 20~60이어도 같은 뜻이라 한 주에 묶이면 위험: begin/start(57), small/little(65), create/produce(37), hot/cold(37)·warm/hot(25).
군집(참고):
- 말하기: say 4, tell 44, talk 102, speak 182, shout 324, call 66, ask 24, answer 92, explain 411, describe 494, suggest 330, aloud 387. 이 중 say/speak/tell/talk의 한글 뜻이 말하다/말해 주다/이야기하다로 비슷.
- 보기/듣기: see 9, look 14, watch 148, view 282, hear 116, listen 144 (+ here/hear 동음).
- 크기/정도: big 60, large 179, little 39, small 104, long 76, short 445, high 112, low 269.
- 만들기: make 11, build 193, create 404, produce 441, develop 355, design 474.
- 이동: walk 94, run 96, jump 146, climb 390, swim 275, ride 326, drive 406, travel 457, fly 232.
- 감정/무서움: starter에는 fear/scared/afraid/frightened가 **없다**. 가까운 것은 worry 351, concern 297, monster 347, kill 362, fight 461, war 468, cry 333, sad 341, angry 440. 무서움 군집은 starter가 아니라 T2 할로윈 세트에 몰려 있다: scared, frightened, terrified, terrifying, terrify, scream, shudder, startle, flee, haunt/haunted, howl, groan, moan, hoot, whisper, ghost 등 약 35~45장이 한 장면에서 동시에 처음 나올 위험이 가장 크다 (뜻이 겹침: scared 겁먹은 / frightened 겁이 난 / terrified 몹시 겁에 질린).
- 색: blue 186, red 223, green 325, white 338, black 363, yellow 449, orange 485 (7개 동시 노출은 오히려 양호하나 orange sense 문제 있음).
- 가족/사람: mother 169, father 229, mom 204, dad 270, sister 419, brother 425, parent 287, family 137, baby 335, child 26, boy 109, girl 168, man 34, woman 134, person 246.
- 시간 부사: now, then, today, soon, early, late, already, yet, still, ago, once, ever, never, always, usually, often, sometimes, again.

## 8. 게임을 깨뜨릴 수 있는 기타 항목

- 중복 card_id: **0**. 카드 id의 form 부분과 card_form 불일치 0. sense_order 결번/중복 0. starter_order 1..500 유일.
- single_meaning_ko 빈 값: **121장** 전부 sight 트랙 (starter 0). 예: W0001:기본:a:1, W0007 about, W0117 and, W2038 last.
- example_sentence 비어 있음: 6,546장(starter 495장). 문장 빈칸(depth 3) 과제의 재료가 사실상 없다 (45장만 있음).
- audio_file: **6,591장 전부 빈 값** (audio 폴더 없음). 오디오는 card_id 기준이라고 했으므로 파일명 규칙이 필요하다.
- **card_id에 공백/한글/콜론 포함**: 한글 kind와 콜론이 모든 id에 들어 있고, 공백이 들어간 id는 **558개**(예: `E001:기본:look at:1`, `E007:기본:look forward to:1`, `E384:기본:pitch-black:1`). 파일명으로 쓰려면 슬러그 변환이 필요하다.
- 다단어 form(공백 포함): **455장**, 전부 vocab 트랙의 구동사/표현 (starter 0). 하이픈 7 (T-shirt, yo-yo, pitch-black, parent-teacher conference, scaredy-mouse, ear-splitting, spine-chilling), 아포스트로피 4 (you're welcome, don't worry, it's your turn, o'clock), 말줄임표 4 (`not only ... but also ...`, `neither ... nor ...`, `either ... or ...`, `both ... and ...`). 철자 타일이 있다면 공백/하이픈/아포스트로피/`...` 처리 규칙이 필요하다.
- 대문자 포함 form: **29장** (요일 7, 월 12, English, Korean 2종, T-shirt, 기타). starter에는 0. 대소문자 구별 없는 비교면 may(starter 57)와 May(월)가 충돌한다.
- starter 한글 뜻 길이: 10자 이상 4건 (must `반드시 ~해야 한다`, ago `지금으로부터 ~전에`, mister `성인 남성을 공손하게 부르는 말`, among `셋 이상의 ~사이에`), `~` 포함 17건(조동사/접속사 등). 카드 UI의 글자 수 제한 확인 필요.
- 이모지(pictures) 커버리지: 총 323개. starter 500 중 그림이 있는 form 39개. starter 구체명사(image_type 구체명사) 42개 중 그림 있는 것은 **12개**(cat, dog, horse, hat, apple, egg, cookie, bed, door, car, bus, house 등)이고 **30개는 그림 없음**: animal, bird, arm, body, eye, finger, foot, hair, hand, head, leg, life, clothes, food, piece, boat, city, country, office, street, town, air, bag, home, paper, room, table, sense, market, position. 추상·기능 태그된 구체 사물(student, mother, sea, river, forest, sky, ball, toy, monster 등)도 그림이 없다. 그림이 있는 pictures 키 중 17개(boar, ram, glasses, telescope 등)는 어떤 card_form과도 연결되지 않는다. 같은 이모지를 공유하는 키 쌍도 5쌍 있다. 그림은 단어 단위라 다의어는 sense와 어긋난다(4절).
- 철자 이슈 없음 확인: starter에는 공백/하이픈/아포스트로피/대문자/마침표 form이 0개.

## 부모가 검수할 데이터 수정 목록 (우선순위)

1. starter 의미 순서 교정: light, water, color, name, reason, free, top, question, plan, test, plant, stick, surprise, orange, step의 sense 1을 아이 기본 뜻으로 (deal은 "약속" 번역 오류 확인).
2. 동일한 한글 뜻 25쌍(big/large, say/speak, see/look, good/nice 등)에 구별 가능한 뜻/설명을 달고 같은 주 배치를 피함.
3. starter 오발음 6건 교정: use(동사 /juz/), lead(/lid/), minute(/ˈmɪnɪt/), produce, increase, sometimes. 필요하면 동사/명사별 카드 분리.
4. 동음이의 쌍(right/write, hear/here, see/sea, red/read, blue/blew 등)은 소리->그림 오답 보기에서 상호 배제.
5. 불규칙 과거형 75장의 뜻에 "~했다" 표지 추가 (shook=흔들었다 등), dealt "약속" 오류 수정.
6. image_type 재분류: 구체 사물 약 44개를 구체명사로, happy/sad/angry 등 진짜 감정어를 감정으로, haunted/terrifying/exciting/interesting/boring/amazing/disgusting을 감정에서 제외.
7. 부강세 ˈ 693장(starter 15장)을 부강세 ˌ로 정리하고 shadow/cobweb 등 자동 추출 오류 수정.
8. 구체명사 starter 30개에 그림(이모지) 보강, fly/watch/ring/orange의 sense 불일치 그림 수정.
9. depth 4(철자) 대상 21개를 철자 학습 가치가 있는 규칙 단어/명사로 재선정할지 결정, 추상·기능 starter 234장의 depth 1 생략 여부 결정.
10. 게임 쪽 정리: 빈 뜻 121장(sight)은 읽기 전용, 예문 495장 보강, card_id를 파일명 슬러그로 변환(공백 558건), 다단어/하이픈/아포스트로피 form의 타일 규칙.
