# P1 부모 검토 목록

원본 SHA-256: `38b97c372feb8585eed6b9458194294039b4f8a62990ed44b6dfffb91e123130`

[verified] P1 **1215개**를 전수 목록화했다. 기존 감사의 첫 뜻 변경 후보 **23개**, P1 원형에 연결된 불규칙 과거 **71장**(첫 뜻과 같은 것 **64장**), P1이 포함된 동일 한글 뜻 **177묶음**, 그림·첫 뜻 검토 **4개**다.

**원본과 대표 뜻은 변경하지 않았다.** 후보는 [estimate] 부모 확인용 제안이며 확정 오류 목록이 아니다. 과거형은 이번 4,610개 대표 카드 배정 밖이다. 전체 P1 1,215개에 대해 사람이 뜻의 적절성을 검수했다는 주장은 하지 않는다.

검토 파일: `p1_review.json`(전체 ID·후보·과거·동일 뜻), `p1_review.csv`(1,215행, 부모 결정란). CSV는 UTF-8 BOM으로 저장해 한글을 보존한다. 현재 결정은 모두 미확인이다.

## 첫 뜻 검토 후보

| 표제어 | 현재 대표 카드 / 뜻 | 제안 카드 / 뜻 |
|---|---|---|
| area | `W0171:기본:area:1` 넓이 | `W0171:기본:area:2` 지역 |
| circle | `W0657:기본:circle:1` 동그라미 치다 | `W0657:기본:circle:2` 원 |
| color | `W0731:기본:color:1` 색칠하다 | `W0731:기본:color:2` 색 |
| correct | `W0828:기본:correct:1` 고치다 | `W0828:기본:correct:2` 올바른 |
| face | `W1320:기본:face:1` 마주하다 | `W1320:기본:face:2` 얼굴 |
| free | `W1485:기본:free:1` 풀어주다 | `W1485:기본:free:2` 자유로운 / `W1485:기본:free:3` 무료의 |
| interest | `W1910:기본:interest:1` 흥미를 끌다 | `W1910:기본:interest:2` 관심 |
| light | `W2093:기본:light:1` 불을 붙이다 | `W2093:기본:light:2` 빛 |
| mind | `W2284:기본:mind:1` 꺼리다 | `W2284:기본:mind:2` 마음 |
| name | `W2380:기본:name:1` 이름을 붙이다 | `W2380:기본:name:2` 이름 |
| note | `W2452:기본:note:1` 음표 | `W2452:기본:note:2` 메모 |
| orange | `W2522:기본:orange:1` 주황색의 | `W2522:기본:orange:2` 오렌지 |
| plan | `W2717:기본:plan:1` 계획하다 | `W2717:기본:plan:2` 계획 |
| plant | `W2720:기본:plant:1` 심다 | `W2720:기본:plant:2` 식물 |
| question | `W2908:기본:question:1` 질문하다 | `W2908:기본:question:2` 질문 |
| reason | `W2969:기본:reason:1` 추론하다 | `W2969:기본:reason:2` 이유 |
| step | `W3583:기본:step:1` 발을 내딛다 | `W3583:기본:step:2` 걸음 |
| stick | `W3586:기본:stick:1` 붙이다 | `W3586:기본:stick:3` 막대기 |
| surprise | `W3685:기본:surprise:1` 놀라게 하다 | `W3685:기본:surprise:2` 놀라움 / `W3685:기본:surprise:3` 깜짝 선물 |
| test | `W3778:기본:test:1` 시험하다 | `W3778:기본:test:2` 시험 |
| top | `W3873:기본:top:1` 팽이 | `W3873:기본:top:2` 꼭대기 |
| type | `W3972:기본:type:1` 타자를 치다 | `W3972:기본:type:2` 종류 |
| water | `W4122:기본:water:1` 물을 주다 | `W4122:기본:water:2` 물 |

제안 중 하나를 부모가 확인하면 `tools/worlds/overrides.json`의 entries에 `lemmaId,cardId,reason,approvedByParent:true`를 기록하고 version을 올린 뒤 세계를 다시 생성한다. 승인 없이 후보를 자동 적용하지 않는다. 새 card_id의 음원도 확인해야 한다.

## 불규칙 과거 검토

| 과거 카드 | 원형 | 현재 뜻 | 원형 첫 뜻과 같음 |
|---|---|---|---|
| `W0296:불규칙 과거형:was:1` (was) | be | ~이었다 | 아니오 |
| `W0296:불규칙 과거형:were:1` (were) | be | ~이었다 | 아니오 |
| `W0308:불규칙 과거형:became:1` (became) | become | ~이 되다 | 예 |
| `W0319:불규칙 과거형:began:1` (began) | begin | 시작하다 | 예 |
| `W0373:불규칙 과거형:blew:1` (blew) | blow | 불다 | 예 |
| `W0426:불규칙 과거형:broke:1` (broke) | break | 깨다 | 예 |
| `W0440:불규칙 과거형:brought:1` (brought) | bring | 가져오다 | 예 |
| `W0459:불규칙 과거형:built:1` (built) | build | 짓다 | 예 |
| `W0490:불규칙 과거형:bought:1` (bought) | buy | 사다 | 예 |
| `W0560:불규칙 과거형:caught:1` (caught) | catch | 잡다 | 예 |
| `W0647:불규칙 과거형:chose:1` (chose) | choose | 선택하다 | 예 |
| `W0737:불규칙 과거형:came:1` (came) | come | 오다 | 예 |
| `W0927:불규칙 과거형:cut:1` (cut) | cut | 자르다 | 예 |
| `W1089:불규칙 과거형:did:1` (did) | do | 하다 | 예 |
| `W1122:불규칙 과거형:drew:1` (drew) | draw | 그리다 | 예 |
| `W1130:불규칙 과거형:drank:1` (drank) | drink | 마시다 | 예 |
| `W1132:불규칙 과거형:drove:1` (drove) | drive | 운전하다 | 예 |
| `W1171:불규칙 과거형:ate:1` (ate) | eat | 먹다 | 예 |
| `W1334:불규칙 과거형:fell:1` (fell) | fall | 떨어졌다 | 아니오 |
| `W1366:불규칙 과거형:felt:1` (felt) | feel | 느끼다 | 예 |
| `W1384:불규칙 과거형:fought:1` (fought) | fight | 싸우다 | 예 |
| `W1392:불규칙 과거형:found:1` (found) | find | 찾다 | 예 |
| `W1439:불규칙 과거형:flew:1` (flew) | fly | 날다 | 예 |
| `W1462:불규칙 과거형:forgot:1` (forgot) | forget | 잊다 | 예 |
| `W1558:불규칙 과거형:got:1` (got) | get | 얻다 | 예 |
| `W1567:불규칙 과거형:gave:1` (gave) | give | 주다 | 예 |
| `W1584:불규칙 과거형:went:1` (went) | go | 가다 | 예 |
| `W1643:불규칙 과거형:grew:1` (grew) | grow | 자라다 | 예 |
| `W1704:불규칙 과거형:had:1` (had) | have | 가지다 | 예 |
| `W1716:불규칙 과거형:heard:1` (heard) | hear | 듣다 | 예 |
| `W1746:불규칙 과거형:hid:1` (hid) | hide | 숨다 | 예 |
| `W1762:불규칙 과거형:hit:1` (hit) | hit | 치다 | 예 |
| `W1767:불규칙 과거형:held:1` (held) | hold | 잡고 있다 | 예 |
| `W1825:불규칙 과거형:hurt:1` (hurt) | hurt | 다치게 하다 | 예 |
| `W1985:불규칙 과거형:kept:1` (kept) | keep | 계속하다 | 예 |
| `W2013:불규칙 과거형:knew:1` (knew) | know | 알다 | 예 |
| `W2050:불규칙 과거형:laid:1` (laid) | lay | 놓았다 | 아니오 |
| `W2053:불규칙 과거형:led:1` (led) | lead | 이끌다 | 예 |
| `W2062:불규칙 과거형:left:1` (left) | leave | 떠났다 | 아니오 |
| `W2078:불규칙 과거형:let:1` (let) | let | ~하게 하다 | 예 |
| `W2141:불규칙 과거형:lost:1` (lost) | lose | 잃어버리다 | 예 |
| `W2185:불규칙 과거형:made:1` (made) | make | 만들다 | 예 |
| `W2235:불규칙 과거형:meant:1` (meant) | mean | 뜻하다 | 예 |
| `W2246:불규칙 과거형:met:1` (met) | meet | 만나다 | 예 |
| `W2626:불규칙 과거형:paid:1` (paid) | pay | 지불하다 | 예 |
| `W2896:불규칙 과거형:put:1` (put) | put | 놓다 | 예 |
| `W2963:불규칙 과거형:read:1` (read) | read | 읽었다 | 아니오 |
| `W3090:불규칙 과거형:rode:1` (rode) | ride | 타다 | 예 |
| `W3093:불규칙 과거형:rang:1` (rang) | ring | 울렸다 | 아니오 |
| `W3150:불규칙 과거형:ran:1` (ran) | run | 달리다 | 예 |
| `W3196:불규칙 과거형:said:1` (said) | say | 말하다 | 예 |
| `W3252:불규칙 과거형:saw:1` (saw) | see | 보다 | 예 |
| `W3263:불규칙 과거형:sold:1` (sold) | sell | 팔다 | 예 |
| `W3265:불규칙 과거형:sent:1` (sent) | send | 보내다 | 예 |
| `W3286:불규칙 과거형:shook:1` (shook) | shake | 흔들다 | 예 |
| `W3359:불규칙 과거형:sang:1` (sang) | sing | 노래하다 | 예 |
| `W3367:불규칙 과거형:sat:1` (sat) | sit | 앉다 | 예 |
| `W3392:불규칙 과거형:slept:1` (slept) | sleep | 자다 | 예 |
| `W3494:불규칙 과거형:spoke:1` (spoke) | speak | 말하다 | 예 |
| `W3503:불규칙 과거형:spent:1` (spent) | spend | 쓰다 | 예 |
| `W3558:불규칙 과거형:stood:1` (stood) | stand | 서다 | 예 |
| `W3709:불규칙 과거형:swam:1` (swam) | swim | 수영하다 | 예 |
| `W3730:불규칙 과거형:took:1` (took) | take | 가지고 가다 | 예 |
| `W3749:불규칙 과거형:taught:1` (taught) | teach | 가르치다 | 예 |
| `W3759:불규칙 과거형:told:1` (told) | tell | 말해 주다 | 예 |
| `W3802:불규칙 과거형:thought:1` (thought) | think | 생각하다 | 예 |
| `W3820:불규칙 과거형:threw:1` (threw) | throw | 던지다 | 예 |
| `W3986:불규칙 과거형:understood:1` (understood) | understand | 이해하다 | 예 |
| `W4132:불규칙 과거형:wore:1` (wore) | wear | 입고 있다 | 예 |
| `W4196:불규칙 과거형:won:1` (won) | win | 이기다 | 예 |
| `W4247:불규칙 과거형:wrote:1` (wrote) | write | 쓰다 | 예 |

같은 뜻을 무조건 문자열 치환하지 않는다. dealt=약속처럼 명사 뜻이 복사된 사례는 원형의 뜻부터 확인해야 한다. 이미 과거형으로 적힌 사례도 함께 표시해 누락을 막는다.

## 같은 한글 뜻 묶음

빈 뜻의 기능어는 동일 뜻 그룹으로 묶지 않는다. 여기서는 P1과 같은 뜻을 가진 P2/P3 대표 카드도 함께 보여 준다. NFC·공백 정규화만 적용했으며 유사한 의미 전부를 찾은 목록은 아니다.

| 뜻 | 대표 카드 |
|---|---|
| ~때문에 | because of (P1, `E155:기본:because of:1`) / due to (P1, `E156:기본:due to:1`) |
| ~옆에 | beside (P2, `W0335:기본:beside:1`) / next to (P1, `E176:기본:next to:1`) |
| ~은 어때 | what about (P1, `E236:기본:what about:1`) / how about (P1, `E237:기본:how about:1`) |
| ~을 돌보다 | look after (P1, `E003:기본:look after:1`) / take care of (P1, `E037:기본:take care of:1`) |
| ~을 제외하고 | except (P2, `W1283:기본:except:1`) / except for (P1, `E159:기본:except for:1`) |
| ~을 찾다 | look for (P1, `E002:기본:look for:1`) / search for (P1, `E130:기본:search for:1`) |
| ~처럼 보이다 | seem (P1, `W3256:기본:seem:1`) / look like (P1, `E008:기본:look like:1`) |
| ~할 수 있다 | can (P1, `W0516:기본:can:1`) / be able to (P1, `E243:기본:be able to:1`) |
| ~해야 한다 | should (P1, `W3317:기본:should:1`) / have to (P1, `E239:기본:have to:1`) / ought to (P1, `E240:기본:ought to:1`) |
| 가게 | shop (P1, `W3312:기본:shop:1`) / store (P1, `W3602:기본:store:1`) |
| 가끔 | occasionally (P2, `W2484:기본:occasionally:1`) / once in a while (P1, `E208:기본:once in a while:1`) |
| 가리키다 | point (P1, `W2747:기본:point:1`) / refer (P2, `W2990:기본:refer:1`) |
| 가운데 | center (P1, `W0582:기본:center:1`) / middle (P1, `W2273:기본:middle:1`) |
| 갑자기 | suddenly (P1, `W3651:기본:suddenly:1`) / abruptly (P3, `W0010:기본:abruptly:1`) / all of a sudden (P1, `E181:기본:all of a sudden:1`) |
| 같은 | same (P1, `W3174:기본:same:1`) / equal (P2, `W1243:기본:equal:1`) |
| 거대한 | giant (P1, `W1560:기본:giant:1`) / enormous (P2, `W1233:기본:enormous:1`) / gigantic (P2, `W1562:기본:gigantic:1`) |
| 거리 | street (P1, `W3617:기본:street:1`) / distance (P2, `W1079:기본:distance:1`) |
| 거의 | almost (P1, `W0090:기본:almost:1`) / nearly (P2, `W2395:기본:nearly:1`) |
| 겁주다 | scare (P1, `W3202:기본:scare:1`) / frighten (P2, `W1498:기본:frighten:1`) |
| 게다가 | besides (P2, `W0336:기본:besides:1`) / in addition (P1, `E192:기본:in addition:1`) |
| 결국 | eventually (P2, `W1264:기본:eventually:1`) / in the end (P1, `E170:기본:in the end:1`) / after all (P1, `E188:기본:after all:1`) |
| 결정하다 | decide (P1, `W0969:기본:decide:1`) / determine (P2, `W1027:기본:determine:1`) |
| 계속하다 | continue (P1, `W0804:기본:continue:1`) / keep (P1, `W1985:기본:keep:1`) / go on (P1, `E052:기본:go on:1`) / carry on (P1, `E073:기본:carry on:1`) / keep on (P1, `E102:기본:keep on:1`) |
| 고치다 | correct (P1, `W0828:기본:correct:1`) / fix (P2, `W1408:기본:fix:1`) |
| 그리워하다 | miss (P1, `W2297:기본:miss:1`) / yearn (P3, `W4260:기본:yearn:1`) |
| 극복하다 | overcome (P2, `W2551:기본:overcome:1`) / get over (P1, `E018:기본:get over:1`) |
| 기다리다 | wait (P1, `W4100:기본:wait:1`) / hang on (P1, `E098:기본:hang on:1`) / hold on (P1, `E099:기본:hold on:1`) |
| 기호 | sign (P1, `W3343:기본:sign:1`) / symbol (P2, `W3715:기본:symbol:1`) |
| 기회 | chance (P1, `W0598:기본:chance:1`) / opportunity (P2, `W2517:기본:opportunity:1`) |
| 깜짝 놀라게 하다 | amaze (P1, `W0102:기본:amaze:1`) / startle (P3, `W3566:기본:startle:1`) |
| 꽃 | flower (P1, `W1433:기본:flower:1`) / blossom (P3, `W0371:기본:blossom:1`) |
| 꽤 | pretty (P1, `W2821:기본:pretty:1`) / quite (P1, `W2915:기본:quite:1`) / fairly (P2, `W1328:기본:fairly:1`) / rather (P2, `W2955:기본:rather:1`) |
| 끔찍한 | terrible (P1, `W3773:기본:terrible:1`) / awful (P2, `W0239:기본:awful:1`) |
| 나가다 | exit (P2, `W1294:기본:exit:1`) / get out (P1, `E012:기본:get out:1`) |
| 나누다 | share (P1, `W3292:기본:share:1`) / divide (P2, `W1086:기본:divide:1`) / split (P2, `W3517:기본:split:1`) |
| 나무 | tree (P1, `W3918:기본:tree:1`) / wood (P1, `W4223:기본:wood:1`) |
| 나오다 | emerge (P2, `W1209:기본:emerge:1`) / come out (P1, `E043:기본:come out:1`) |
| 나타나다 | appear (P2, `W0155:기본:appear:1`) / show up (P1, `E111:기본:show up:1`) |
| 노를 젓다 | row (P1, `W3135:기본:row:1`) / paddle (P2, `W2563:기본:paddle:1`) |
| 놓다 | lay (P1, `W2050:기본:lay:1`) / put (P1, `W2896:기본:put:1`) |
| 눈 | eye (P1, `W1314:기본:eye:1`) / snow (P1, `W3436:기본:snow:1`) |
| 눈에 보이지 않는 | invisible (P2, `W1925:기본:invisible:1`) / out of sight (P1, `E216:기본:out of sight:1`) |
| 눕다 | lie (P1, `W2087:기본:lie:1`) / lie down (P1, `E093:기본:lie down:1`) |
| 다리 | leg (P1, `W2066:기본:leg:1`) / bridge (P1, `W0434:기본:bridge:1`) |
| 다치게 하다 | hurt (P1, `W1825:기본:hurt:1`) / injure (P2, `W1889:기본:injure:1`) |
| 닫다 | close (P1, `W0695:기본:close:1`) / shut (P2, `W3331:기본:shut:1`) |
| 달 | month (P1, `W2319:기본:month:1`) / moon (P1, `W2323:기본:moon:1`) |
| 달아나다 | flee (P3, `W1419:기본:flee:1`) / run away (P1, `E075:기본:run away:1`) |
| 대답하다 | answer (P1, `W0130:기본:answer:1`) / reply (P1, `W3037:기본:reply:1`) / respond (P2, `W3062:기본:respond:1`) |
| 대화 | dialogue (P1, `W1034:기본:dialogue:1`) / conversation (P2, `W0812:기본:conversation:1`) |
| 던지다 | throw (P1, `W3820:기본:throw:1`) / pitch (P2, `W2711:기본:pitch:1`) |
| 돌려주다 | give back (P1, `E024:기본:give back:1`) / bring back (P1, `E106:기본:bring back:1`) |
| 돌아오다 | return (P1, `W3073:기본:return:1`) / get back (P1, `E016:기본:get back:1`) / come back (P1, `E044:기본:come back:1`) |
| 두려워하는 | afraid (P1, `W0061:기본:afraid:1`) / fearful (P2, `W1357:기본:fearful:1`) |
| 뒤돌아보다 | look back (P1, `E010:기본:look back:1`) / turn around (P1, `E063:기본:turn around:1`) |
| 뒤로 | back (P1, `W0246:기본:back:1`) / backward (P2, `W0248:기본:backward:1`) |
| 뒤쫓다 | chase (P2, `W0612:기본:chase:1`) / pursue (P2, `W2894:기본:pursue:1`) / run after (P1, `E078:기본:run after:1`) |
| 들어 올리다 | raise (P1, `W2939:기본:raise:1`) / lift (P2, `W2092:기본:lift:1`) / hold up (P1, `E100:기본:hold up:1`) |
| 따라가다 | follow (P1, `W1448:기본:follow:1`) / keep up (P1, `E103:기본:keep up:1`) |
| 땅 | ground (P1, `W1641:기본:ground:1`) / land (P1, `W2028:기본:land:1`) |
| 때때로 | sometimes (P1, `W3468:기본:sometimes:1`) / at times (P1, `E168:기본:at times:1`) / from time to time (P1, `E184:기본:from time to time:1`) |
| 떠나다 | leave (P1, `W2062:기본:leave:1`) / go away (P1, `E053:기본:go away:1`) |
| 떨어져 | away (P1, `W0238:기본:away:1`) / apart (P2, `W0147:기본:apart:1`) |
| 또한 | also (P1, `W0098:기본:also:1`) / too (P1, `W3867:기본:too:1`) / as well (P1, `E144:기본:as well:1`) |
| 마침내 | finally (P1, `W1391:기본:finally:1`) / at last (P1, `E163:기본:at last:1`) |
| 많은 | a lot of (P1, `E134:기본:a lot of:1`) / lots of (P1, `E135:기본:lots of:1`) |
| 많음 | lot (P1, `W2144:기본:lot:1`) / plenty (P2, `W2732:기본:plenty:1`) |
| 말하다 | say (P1, `W3196:기본:say:1`) / speak (P1, `W3494:기본:speak:1`) / remark (P2, `W3023:기본:remark:1`) |
| 문제 | problem (P1, `W2841:기본:problem:1`) / issue (P2, `W1932:기본:issue:1`) |
| 미루다 | postpone (P3, `W2786:기본:postpone:1`) / put off (P1, `E028:기본:put off:1`) |
| 믿다 | believe (P1, `W0324:기본:believe:1`) / trust (P2, `W3942:기본:trust:1`) |
| 바꾸다 | change (P1, `W0599:기본:change:1`) / replace (P2, `W3036:기본:replace:1`) / convert (P2, `W0813:기본:convert:1`) |
| 바라다 | hope (P1, `W1786:기본:hope:1`) / wish (P1, `W4210:기본:wish:1`) |
| 바지 | trousers (P1, `W3935:기본:trousers:1`) / pants (P2, `W2585:기본:pants:1`) |
| 밤 | night (P1, `W2425:기본:night:1`) / chestnut (P2, `W0627:기본:chestnut:1`) |
| 방 | room (P1, `W3121:기본:room:1`) / chamber (P2, `W0595:기본:chamber:1`) |
| 방법 | way (P1, `W4126:기본:way:1`) / method (P2, `W2269:기본:method:1`) |
| 배 | pear (P1, `W2633:기본:pear:1`) / boat (P1, `W0381:기본:boat:1`) / abdomen (P2, `W0003:기본:abdomen:1`) / belly (P2, `W0327:기본:belly:1`) / tummy (P2, `W3950:기본:tummy:1`) |
| 벌 | bee (P1, `W0312:기본:bee:1`) / punishment (P3, `W2885:기본:punishment:1`) |
| 병 | bottle (P1, `W0403:기본:bottle:1`) / illness (P2, `W1845:기본:illness:1`) |
| 보다 | look (P1, `W2136:기본:look:1`) / see (P1, `W3252:기본:see:1`) |
| 보여 주다 | show (P1, `W3322:기본:show:1`) / demonstrate (P2, `W0996:기본:demonstrate:1`) / display (P2, `W1076:기본:display:1`) |
| 보통 | usually (P1, `W4039:기본:usually:1`) / normally (P2, `W2445:기본:normally:1`) |
| 부분 | part (P1, `W2597:기본:part:1`) / section (P2, `W3250:기본:section:1`) |
| 부유한 | rich (P1, `W3087:기본:rich:1`) / wealthy (P2, `W4131:기본:wealthy:1`) |
| 붙이다 | stick (P1, `W3586:기본:stick:1`) / attach (P2, `W0212:기본:attach:1`) |
| 비록 ~이지만 | although (P2, `W0099:기본:although:1`) / even though (P1, `E150:기본:even though:1`) |
| 비행기 | plane (P1, `W2718:기본:plane:1`) / airplane (P3, `W0076:기본:airplane:1`) |
| 빠르게 | fast (P1, `W1347:기본:fast:1`) / quickly (P1, `W2909:기본:quickly:1`) |
| 뽐내다 | brag (P2, `W0417:기본:brag:1`) / show off (P1, `E112:기본:show off:1`) |
| 사과 | apple (P1, `W0158:기본:apple:1`) / apology (P3, `W0151:기본:apology:1`) |
| 사람 | person (P1, `W2669:기본:person:1`) / guy (P1, `W1660:기본:guy:1`) |
| 사진 | photo (P1, `W2681:기본:photo:1`) / photograph (P2, `W2682:기본:photograph:1`) |
| 살다 | live (P1, `W2115:기본:live:1`) / inhabit (P3, `W1886:기본:inhabit:1`) |
| 생각하다 | think (P1, `W3802:기본:think:1`) / suppose (P2, `W3678:기본:suppose:1`) |
| 서두르다 | hurry (P1, `W1824:기본:hurry:1`) / hurry up (P1, `E088:기본:hurry up:1`) |
| 서로 | each other (P1, `E231:기본:each other:1`) / one another (P1, `E232:기본:one another:1`) |
| 서점 | bookshop (P1, `W0391:기본:bookshop:1`) / bookstore (P3, `W0392:기본:bookstore:1`) |
| 선물 | present (P1, `W2816:기본:present:1`) / gift (P2, `W1561:기본:gift:1`) |
| 선택하다 | choose (P1, `W0647:기본:choose:1`) / select (P2, `W3260:기본:select:1`) |
| 소파 | sofa (P1, `W3452:기본:sofa:1`) / couch (P2, `W0836:기본:couch:1`) |
| 속이다 | trick (P1, `W3924:기본:trick:1`) / fool (P2, `W1451:기본:fool:1`) / deceive (P3, `W0967:기본:deceive:1`) |
| 수업 | class (P1, `W0670:기본:class:1`) / lesson (P1, `W2076:기본:lesson:1`) |
| 시간 | hour (P1, `W1801:기본:hour:1`) / time (P1, `W3839:기본:time:1`) |
| 시도하다 | try (P1, `W3945:기본:try:1`) / attempt (P2, `W0214:기본:attempt:1`) |
| 시작하다 | begin (P1, `W0319:기본:begin:1`) / start (P1, `W3565:기본:start:1`) |
| 식당 | restaurant (P1, `W3066:기본:restaurant:1`) / dining room (P2, `E247:기본:dining room:1`) |
| 쓰다 | spend (P1, `W3503:기본:spend:1`) / write (P1, `W4247:기본:write:1`) |
| 아마 | maybe (P1, `W2229:기본:maybe:1`) / perhaps (P1, `W2661:기본:perhaps:1`) |
| 아이 | child (P1, `W0633:기본:child:1`) / kid (P1, `W1992:기본:kid:1`) |
| 아픈 | sick (P1, `W3336:기본:sick:1`) / ill (P2, `W1843:기본:ill:1`) / sore (P2, `W3474:기본:sore:1`) |
| 앉다 | sit (P1, `W3367:기본:sit:1`) / perch (P3, `W2656:기본:perch:1`) / sit down (P1, `E091:기본:sit down:1`) |
| 알약 | tablet (P1, `W3724:기본:tablet:1`) / pill (P2, `W2698:기본:pill:1`) |
| 양 | sheep (P1, `W3297:기본:sheep:1`) / amount (P2, `W0110:기본:amount:1`) |
| 얻다 | get (P1, `W1558:기본:get:1`) / acquire (P2, `W0029:기본:acquire:1`) / obtain (P3, `W2481:기본:obtain:1`) |
| 엉덩이 | bottom (P1, `W0404:기본:bottom:1`) / hip (P2, `W1755:기본:hip:1`) |
| 영화 | movie (P1, `W2349:기본:movie:1`) / film (P2, `W1388:기본:film:1`) |
| 예를 들어 | for example (P1, `E190:기본:for example:1`) / for instance (P1, `E191:기본:for instance:1`) |
| 오르다 | climb (P1, `W0688:기본:climb:1`) / rise (P2, `W3099:기본:rise:1`) |
| 오토바이 | motorbike (P1, `W2342:기본:motorbike:1`) / motorcycle (P3, `W2343:기본:motorcycle:1`) |
| 옷을 입다 | dress (P1, `W1128:기본:dress:1`) / get dressed (P1, `E022:기본:get dressed:1`) |
| 우스꽝스러운 | silly (P1, `W3350:기본:silly:1`) / ridiculous (P3, `W3091:기본:ridiculous:1`) |
| 우연히 | accidentally (P2, `W0019:기본:accidentally:1`) / by accident (P1, `E203:기본:by accident:1`) |
| 우연히 만나다 | encounter (P2, `W1220:기본:encounter:1`) / run into (P1, `E077:기본:run into:1`) |
| 우주 | space (P1, `W3483:기본:space:1`) / universe (P2, `W4005:기본:universe:1`) |
| 운동 | sport (P1, `W3522:기본:sport:1`) / exercise (P2, `W1290:기본:exercise:1`) |
| 이 | tooth (P1, `W3869:기본:tooth:1`) / louse (P3, `W2148:기본:louse:1`) |
| 이상한 | strange (P1, `W3610:기본:strange:1`) / odd (P2, `W2490:기본:odd:1`) / weird (P2, `W4147:기본:weird:1`) |
| 이야기 | story (P1, `W3606:기본:story:1`) / tale (P2, `W3731:기본:tale:1`) |
| 이해하다 | understand (P1, `W3986:기본:understand:1`) / figure out (P1, `E069:기본:figure out:1`) |
| 일 | job (P1, `W1956:기본:job:1`) / matter (P1, `W2223:기본:matter:1`) |
| 일부러 | deliberately (P2, `W0990:기본:deliberately:1`) / on purpose (P1, `E202:기본:on purpose:1`) |
| 일어나다 | happen (P1, `W1684:기본:happen:1`) / get up (P1, `E011:기본:get up:1`) / take place (P1, `E039:기본:take place:1`) |
| 자동차 | car (P1, `W0535:기본:car:1`) / automobile (P3, `W0227:기본:automobile:1`) |
| 자라다 | grow (P1, `W1643:기본:grow:1`) / grow up (P1, `E084:기본:grow up:1`) |
| 자전거 | bicycle (P1, `W0340:기본:bicycle:1`) / bike (P1, `W0342:기본:bike:1`) |
| 자주 | often (P1, `W2499:기본:often:1`) / frequently (P2, `W1491:기본:frequently:1`) |
| 작은 | little (P1, `W2114:기본:little:1`) / small (P1, `W3411:기본:small:1`) / minor (P2, `W2290:기본:minor:1`) |
| 잠들다 | go to sleep (P1, `E058:기본:go to sleep:1`) / fall asleep (P1, `E095:기본:fall asleep:1`) |
| 잠에서 깨다 | wake (P1, `W4103:기본:wake:1`) / wake up (P1, `E083:기본:wake up:1`) |
| 장소 | place (P1, `W2715:기본:place:1`) / site (P2, `W3368:기본:site:1`) |
| 재료 | material (P1, `W2221:기본:material:1`) / ingredient (P2, `W1885:기본:ingredient:1`) |
| 저녁 식사 | dinner (P1, `W1050:기본:dinner:1`) / supper (P2, `W3675:기본:supper:1`) |
| 정리하다 | arrange (P2, `W0181:기본:arrange:1`) / organize (P2, `W2532:기본:organize:1`) / tidy up (P1, `E086:기본:tidy up:1`) |
| 정말로 | really (P1, `W2967:기본:really:1`) / indeed (P2, `W1874:기본:indeed:1`) |
| 조금 | bit (P1, `W0354:기본:bit:1`) / a little (P1, `E136:기본:a little:1`) / a bit (P1, `E138:기본:a bit:1`) |
| 종 | bell (P1, `W0325:기본:bell:1`) / species (P2, `W3498:기본:species:1`) |
| 좋은 | good (P1, `W1594:기본:good:1`) / nice (P1, `W2423:기본:nice:1`) |
| 주 | week (P1, `W4140:기본:week:1`) / state (P2, `W3568:기본:state:1`) |
| 준비하다 | prepare (P1, `W2813:기본:prepare:1`) / get ready (P1, `E020:기본:get ready:1`) |
| 중요한 | important (P1, `W1860:기본:important:1`) / major (P2, `W2184:기본:major:1`) |
| 즉시 | immediately (P2, `W1854:기본:immediately:1`) / promptly (P3, `W2854:기본:promptly:1`) / at once (P1, `E164:기본:at once:1`) / right away (P1, `E186:기본:right away:1`) |
| 집 | home (P1, `W1771:기본:home:1`) / house (P1, `W1802:기본:house:1`) |
| 짧은 | short (P1, `W3315:기본:short:1`) / brief (P2, `W0435:기본:brief:1`) |
| 참다 | tolerate (P3, `W3860:기본:tolerate:1`) / hold back (P1, `E101:기본:hold back:1`) |
| 참여하다 | join (P1, `W1958:기본:join:1`) / participate (P2, `W2599:기본:participate:1`) |
| 찾다 | find (P1, `W1392:기본:find:1`) / search (P2, `W3242:기본:search:1`) / seek (P2, `W3255:기본:seek:1`) |
| 채우다 | fill (P1, `W1387:기본:fill:1`) / fasten (P2, `W1348:기본:fasten:1`) |
| 추론하다 | reason (P1, `W2969:기본:reason:1`) / deduce (P3, `W0979:기본:deduce:1`) |
| 축제 | festival (P1, `W1374:기본:festival:1`) / carnival (P2, `W0545:기본:carnival:1`) |
| 출발하다 | depart (P3, `W1002:기본:depart:1`) / set off (P1, `E108:기본:set off:1`) / set out (P1, `E110:기본:set out:1`) |
| 치료하다 | treat (P1, `W3916:기본:treat:1`) / cure (P3, `W0914:기본:cure:1`) |
| 친구 | friend (P1, `W1495:기본:friend:1`) / pal (P3, `W2574:기본:pal:1`) |
| 큰 | big (P1, `W0341:기본:big:1`) / large (P1, `W2036:기본:large:1`) |
| 타다 | ride (P1, `W3090:기본:ride:1`) / burn (P2, `W0477:기본:burn:1`) / get on (P1, `E014:기본:get on:1`) |
| 포함하다 | include (P1, `W1868:기본:include:1`) / contain (P2, `W0797:기본:contain:1`) / involve (P2, `W1928:기본:involve:1`) |
| 풀어주다 | free (P1, `W1485:기본:free:1`) / release (P2, `W3014:기본:release:1`) |
| 학생 | student (P1, `W3630:기본:student:1`) / pupil (P2, `W2886:기본:pupil:1`) |
| 한 쌍 | pair (P1, `W2572:기본:pair:1`) / couple (P2, `W0843:기본:couple:1`) |
| 해 | year (P1, `W4258:기본:year:1`) / sun (P1, `W3664:기본:sun:1`) / harm (P2, `W1692:기본:harm:1`) |
| 행동 | action (P1, `W0033:기본:action:1`) / behavior (P2, `W0321:기본:behavior:1`) |
| 행동하다 | act (P1, `W0032:기본:act:1`) / behave (P2, `W0320:기본:behave:1`) |
| 허락하다 | allow (P1, `W0087:기본:allow:1`) / permit (P2, `W2666:기본:permit:1`) |
| 화난 | angry (P1, `W0121:기본:angry:1`) / mad (P2, `W2169:기본:mad:1`) |
| 확인하다 | check (P1, `W0616:기본:check:1`) / make sure (P1, `E114:기본:make sure:1`) |
| 흔들리다 | swing (P1, `W3710:기본:swing:1`) / sway (P3, `W3701:기본:sway:1`) |
| 힘 | power (P1, `W2797:기본:power:1`) / strength (P2, `W3618:기본:strength:1`) / force (P2, `W1458:기본:force:1`) |

## 그림과 학습 연결

fly(날다/파리 그림), watch(지켜보다/손목시계), ring(울리다/반지), orange(주황색의/과일)는 기존 감사의 그림-뜻 불일치 후보다. 새 전체 catalogue는 의미별 확인 전 어휘 이모지를 빈 값으로 둔다. 세계 도안은 별개이며 카드 정답을 미리 드러내는 그림으로 연결하지 않는다.

재현: `python3 -I tools/audit_p1_review.py --check`. 결과는 검토 자료이며 자동 승인 파일이 아니다.
