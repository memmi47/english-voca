# 세계 설계 dry-run

재현: `python3 -I tools/audit_world_design.py > docs/research/world_design_dry_run.md`. 출력만 하는 읽기 전용 검사이며 세계 생성기가 아니다.

원본 SHA-256: `38b97c372feb8585eed6b9458194294039b4f8a62990ed44b6dfffb91e123130`

> 이 1절의 독립 품사 길·mixed 안은 이전 설계 이력이다. 현행은 WORLD_SCHEMA v2의 연결 그래프와 world_map_routes.md를 따른다. 표현·팔레트 집계는 계속 참고한다.

## 1. 품사 쏠림과 길 대안 (이전 안)

[verified] 명시한 정렬·임시 품사 규칙을 실제 DB에 적용한 결과. [estimate] 품사는 lemma.pos 첫 항목이며 첫 뜻의 품사 검수가 아니다. 마지막 집단의 주제 순환도 적용했다. 칸 수는 충돌 분리 전 최소치다.

원안은 명사 70장 초과 시 두 길로 나눈다. 수정안은 모든 순수 품사 길이 21~70장이면 유지하고, 아니면 같은 세계의 빈도순 단어를 세 길에 번갈아 넣어 균등한 mixed 길로 만든다. 세계 사이 이동은 없다.

| 세계 | 명사 | 동사 | 꾸밈 | 원안 길별 최소 칸 | 수정안 길별 장수 | mixed |
|---|---:|---:|---:|---|---|---|
| p1-01 | 44 | 64 | 34 | 5 / 7 / 4 | 44 / 64 / 34 | 없음 |
| p1-02 | 60 | 43 | 39 | 6 / 5 / 4 | 60 / 43 / 39 | 없음 |
| p1-03 | 70 | 45 | 27 | 7 / 5 / 3 | 70 / 45 / 27 | 없음 |
| p1-04 | 64 | 48 | 30 | 7 / 5 / 3 | 64 / 48 / 30 | 없음 |
| p1-05 | 81 | 33 | 27 | 5 / 4 / 4 / 3 | 41 / 40 / 33 / 27 | 없음 |
| p1-06 | 116 | 12 | 13 | 6 / 6 / 2 / 2 | 47 / 47 / 47 | 3길 |
| p2-01 | 82 | 35 | 38 | 5 / 5 / 4 / 4 | 41 / 41 / 35 / 38 | 없음 |
| p2-02 | 81 | 40 | 34 | 5 / 4 / 4 / 4 | 41 / 40 / 40 / 34 | 없음 |
| p2-03 | 80 | 44 | 31 | 4 / 4 / 5 / 4 | 40 / 40 / 44 / 31 | 없음 |
| p2-04 | 72 | 45 | 38 | 4 / 4 / 5 / 4 | 36 / 36 / 45 / 38 | 없음 |
| p2-05 | 67 | 37 | 51 | 7 / 4 / 6 | 67 / 37 / 51 | 없음 |
| p2-06 | 66 | 44 | 45 | 7 / 5 / 5 | 66 / 44 / 45 | 없음 |
| p2-07 | 77 | 44 | 34 | 4 / 4 / 5 / 4 | 39 / 38 / 44 / 34 | 없음 |
| p2-08 | 86 | 29 | 40 | 5 / 5 / 3 / 4 | 43 / 43 / 29 / 40 | 없음 |
| p2-09 | 119 | 9 | 27 | 6 / 6 / 1 / 3 | 52 / 52 / 51 | 3길 |
| p2-10 | 67 | 34 | 54 | 7 / 4 / 6 | 67 / 34 / 54 | 없음 |
| p2-11 | 73 | 29 | 53 | 4 / 4 / 3 / 6 | 37 / 36 / 29 / 53 | 없음 |
| p2-12 | 96 | 11 | 48 | 5 / 5 / 2 / 5 | 52 / 52 / 51 | 3길 |
| p2-13 | 107 | 0 | 48 | 6 / 6 / 0 / 5 | 52 / 52 / 51 | 3길 |
| p2-14 | 140 | 0 | 15 | 7 / 7 / 0 / 2 | 52 / 52 / 51 | 3길 |
| p3-01 | 85 | 44 | 26 | 5 / 5 / 5 / 3 | 43 / 42 / 44 / 26 | 없음 |
| p3-02 | 91 | 38 | 26 | 5 / 5 / 4 / 3 | 46 / 45 / 38 / 26 | 없음 |
| p3-03 | 96 | 41 | 18 | 5 / 5 / 5 / 2 | 52 / 52 / 51 | 3길 |
| p3-04 | 88 | 51 | 16 | 5 / 5 / 6 / 2 | 52 / 52 / 51 | 3길 |
| p3-05 | 83 | 54 | 18 | 5 / 5 / 6 / 2 | 52 / 52 / 51 | 3길 |
| p3-06 | 92 | 62 | 0 | 5 / 5 / 7 / 0 | 52 / 51 / 51 | 3길 |
| p3-07 | 120 | 34 | 0 | 6 / 6 / 4 / 0 | 52 / 51 / 51 | 3길 |

일반 세계 27개 중 원안 3~7칸 범위 이탈 **10개**, 수정안 mixed 적용 **10개**. 표현 전용 3세계는 이 표에서 제외하며 세 phrase 길에 균등 배분한다.

## 2. 표현 구성어 후보 감사

대역을 옮기거나 학습 선행 조건을 만들지 않는 후보 조사다. 소문자 영문 토큰(아포스트로피 포함)을 기본 표제어와 정확히 비교한다. aliases는 참고 후보로만 기록한다. 활용형·뜻·구문을 확정하지 않는다. [verified] 매칭 집계, [estimate] 언어적 해석.

| 대역 | 표현 수 | 뒤 대역 구성어가 있는 표현 | 정확히 못 찾은 토큰이 있는 표현 |
|---|---:|---:|---:|
| P1 | 244 | 31 | 22 |
| P2 | 140 | 8 | 44 |
| P3 | 2 | 0 | 1 |

두 결함 열은 겹칠 수 있다. 아래는 후보 전체이며 승인된 선행어 목록이 아니다.

| 표현 ID / 표현 | 대역 | 뒤 대역 토큰 | 미해결 토큰 | 복수 후보 |
|---|---|---|---|---|
| E021 / get lost | P1 | — | lost (alias 후보: lose) | — |
| E022 / get dressed | P1 | — | dressed | — |
| E038 / take turns | P1 | — | turns | — |
| E054 / go ahead | P1 | ahead=P2 | — | — |
| E086 / tidy up | P1 | tidy=P2 | — | — |
| E090 / calm down | P1 | calm=P2 | — | — |
| E095 / fall asleep | P1 | asleep=P2 | — | — |
| E096 / fall apart | P1 | apart=P2 | — | — |
| E115 / make sense | P1 | sense=P2 | — | — |
| E118 / be proud of | P1 | proud=P2 | — | — |
| E119 / be interested in | P1 | — | interested (alias 후보: interest) | — |
| E121 / be supposed to | P1 | — | supposed | — |
| E122 / belong to | P1 | belong=P2 | — | — |
| E123 / depend on | P1 | depend=P2 | — | — |
| E126 / deal with | P1 | deal=P2 | — | — |
| E130 / search for | P1 | search=P2 | — | — |
| E135 / lots of | P1 | — | lots | — |
| E139 / a couple of | P1 | couple=P2 | — | — |
| E143 / all kinds of | P1 | — | kinds | — |
| E154 / instead of | P1 | instead=P2 | — | — |
| E156 / due to | P1 | — | due | — |
| E157 / according to | P1 | — | according | — |
| E159 / except for | P1 | except=P2 | — | — |
| E160 / rather than | P1 | rather=P2 | — | — |
| E165 / at least | P1 | least=P2 | — | — |
| E168 / at times | P1 | — | times | — |
| E172 / in case | P1 | case=P2 | — | — |
| E181 / all of a sudden | P1 | sudden=P2 | — | — |
| E182 / once upon a time | P1 | — | upon | — |
| E191 / for instance | P1 | instance=P2 | — | — |
| E192 / in addition | P1 | addition=P2 | — | — |
| E194 / in other words | P1 | — | words | — |
| E200 / sooner or later | P1 | later=P2 | sooner | — |
| E202 / on purpose | P1 | purpose=P2 | — | — |
| E203 / by accident | P1 | accident=P2 | — | — |
| E204 / by mistake | P1 | mistake=P2 | — | — |
| E210 / upside down | P1 | — | upside | — |
| E212 / back and forth | P1 | — | forth | — |
| E215 / out of breath | P1 | breath=P2 | — | — |
| E216 / out of sight | P1 | sight=P2 | — | — |
| E217 / out of control | P1 | control=P2 | — | — |
| E219 / in danger | P1 | danger=P2 | — | — |
| E221 / in a daze | P1 | — | daze | — |
| E222 / in tears | P1 | — | tears | — |
| E224 / no longer | P1 | — | longer | — |
| E227 / neither ... nor ... | P1 | neither=P2; nor=P2 | — | — |
| E228 / either ... or ... | P1 | either=P2 | — | — |
| E238 / used to | P1 | — | used | — |
| E240 / ought to | P1 | — | ought | — |
| E241 / would rather | P1 | rather=P2 | would (alias 후보: will) | — |
| E242 / had better | P1 | — | had; better | — |
| E247 / dining room | P2 | — | dining | — |
| E249 / washing machine | P2 | — | washing | — |
| E250 / vacuum cleaner | P2 | — | cleaner | — |
| E258 / swimming pool | P2 | — | swimming (alias 후보: swim) | — |
| E263 / jigsaw puzzle | P2 | — | jigsaw | — |
| E266 / polar bear | P2 | — | polar | — |
| E267 / guinea pig | P2 | — | guinea | — |
| E269 / sea turtle | P2 | turtle=P3 | — | — |
| E270 / sea urchin | P2 | urchin=P3 | — | — |
| E271 / hermit crab | P2 | — | hermit | — |
| E272 / praying mantis | P2 | mantis=P3 | praying | — |
| E282 / carbon dioxide | P2 | — | dioxide | — |
| E283 / global warming | P2 | — | global; warming | — |
| E285 / renewable energy | P2 | — | renewable | — |
| E286 / fossil fuel | P2 | fossil=P3 | — | — |
| E288 / supporting detail | P2 | — | supporting | — |
| E293 / table of contents | P2 | — | contents | — |
| E295 / exclamation mark | P2 | — | exclamation | — |
| E307 / fairy tale | P2 | fairy=P3 | — | — |
| E308 / folk tale | P2 | — | folk | — |
| E312 / graphic novel | P2 | — | graphic | — |
| E315 / reading log | P2 | — | reading (alias 후보: read) | — |
| E320 / fill in the blank | P2 | — | blank | — |
| E323 / matching game | P2 | — | matching | — |
| E329 / school supplies | P2 | — | supplies | — |
| E331 / parent-teacher conference | P2 | — | conference | — |
| E332 / first aid | P2 | — | aid | — |
| E339 / roller coaster | P2 | — | roller; coaster | — |
| E340 / Ferris wheel | P2 | — | ferris | — |
| E343 / ice rink | P2 | rink=P3 | — | — |
| E344 / bowling alley | P2 | alley=P3 | — | — |
| E345 / shopping mall | P2 | mall=P3 | shopping | — |
| E346 / department store | P2 | — | department | — |
| E349 / grocery store | P2 | — | grocery | — |
| E352 / takeout food | P2 | — | takeout | — |
| E360 / French fries | P2 | — | french; fries | — |
| E361 / mashed potatoes | P2 | — | mashed; potatoes | — |
| E362 / scrambled eggs | P2 | — | scrambled; eggs | — |
| E363 / boiled egg | P2 | — | boiled | — |
| E364 / fried rice | P2 | — | fried | — |
| E368 / best friend | P2 | — | best | — |
| E371 / well done | P2 | — | done | — |
| E373 / excuse me | P2 | — | me | — |
| E375 / you're welcome | P2 | — | you're | — |
| E377 / don't worry | P2 | — | don't | — |
| E380 / help yourself | P2 | — | yourself | — |
| E381 / take your time | P2 | — | your | — |
| E382 / it's your turn | P2 | — | it's; your | — |
| E383 / give someone the creeps | P3 | — | creeps | — |
| E385 / martial arts | P2 | — | martial; arts | — |
| E386 / o'clock | P2 | — | o'clock | — |

## 3. 수정 팔레트

길 면과 땅 면의 sRGB 상대 휘도 명암비. 설계 기준 3:1 이상을 검사한다. 실제 iPad 화면의 선 두께·노드·글자·색각 검증을 대체하지 않는다.

| 세계 | 땅 | 길 | 명암비 |
|---|---|---|---:|
| p1-01 | #8FCB83 | #72644A | 3.03:1 |
| p1-02 | #A8C878 | #836044 | 3.01:1 |
| p1-03 | #79AD79 | #595139 | 3.03:1 |
| p1-04 | #537D62 | #E2CDAC | 3.03:1 |
| p1-05 | #75B7B1 | #645943 | 3.00:1 |
| p1-06 | #B7A08A | #5C5345 | 3.03:1 |
| p1-07 | #B69AAE | #5E5042 | 3.04:1 |
| p1-08 | #C8B879 | #785F38 | 3.03:1 |
| p2-01 | #7EADBC | #615442 | 3.01:1 |
| p2-02 | #6FB9B6 | #65594E | 3.00:1 |
| p2-03 | #CDA47A | #675842 | 3.01:1 |
| p2-04 | #9399BD | #534D43 | 3.00:1 |
| p2-05 | #D4A5BE | #6F5B49 | 3.04:1 |
| p2-06 | #849FB3 | #514D43 | 3.05:1 |
| p2-07 | #A99BC3 | #5F503E | 3.02:1 |
| p2-08 | #8EA9A5 | #61513D | 3.04:1 |
| p2-09 | #8E9CA8 | #5A4A34 | 3.03:1 |
| p2-10 | #A6C7D8 | #6C6974 | 3.01:1 |
| p2-11 | #9B8CAB | #FCFAFC | 3.00:1 |
| p2-12 | #B3A88D | #63563E | 3.04:1 |
| p2-13 | #D1AC76 | #6B5C45 | 3.05:1 |
| p2-14 | #94B9B7 | #655B6E | 3.02:1 |
| p2-15 | #B5A08B | #5E5240 | 3.03:1 |
| p3-01 | #BBCEDB | #777066 | 3.02:1 |
| p3-02 | #838EBA | #F8F7FB | 3.01:1 |
| p3-03 | #9384B8 | #F8F2E5 | 3.02:1 |
| p3-04 | #94B5A5 | #655A47 | 3.03:1 |
| p3-05 | #C4A0BC | #68563F | 3.04:1 |
| p3-06 | #7F90B0 | #F7F7FB | 3.01:1 |
| p3-07 | #B4BC8F | #745F43 | 3.04:1 |
