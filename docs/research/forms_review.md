# 변신 형태 부모 검수표

자동 생성: `python3 -I tools/make_forms.py`. 부모 확인 전 전부 reviewed=false. 한글 뜻은 원본 그대로이며 시제 뜻을 만들지 않았다.

DB84·필수 복수25는 포함/제외/보류 전수 추적. DB 연결은 외부 검증과 별개다. 교육 자료의 명시된 형태 예만 외부 대조로 센다. 사전 전수 검증은 수행하지 않았다.

규칙 후보 범위: 단일 영어 vocab 중 품사에 동사/명사가 있고 e끝·CVC끝·자음+y·es끝에 해당하는 모든 후보. CVC는 강세/음절 판정이 아닌 제외용 후보 추출이다. 그 밖의 단순 접미사 및 미검증 pp 전체 확장은 하지 않았다.

복수 scarf/hoof/cactus는 Collins 본문의 여러 복수 변형 중 선택 미해결로 제외. wolf/shelf/thief/ox/calf는 Collins 본문에서 명시 복수·가산성과 현재 뜻을 대조했다. Cambridge 본문 403·검색 요약은 검증으로 세지 않았다. half/deal의 모든 새 형태는 승인된 뜻 검토 보류다.

## 집계

```json
{
  "counts": {
    "forms": 131,
    "bases": 105,
    "byKind": {
      "ing": 6,
      "past": 79,
      "plural": 23,
      "pp": 16,
      "s3": 7
    },
    "byRule": {
      "double": 3,
      "e-drop": 3,
      "es": 6,
      "irregular": 111,
      "y-ied": 2,
      "y-ies": 6
    }
  },
  "audit": {
    "rows": 1370,
    "byStatus": {
      "excluded": 1237,
      "held": 2,
      "included": 131
    },
    "excludedByReason": {
      "ambiguous-pos": 383,
      "approved-meaning-hold": 2,
      "external-evidence-unavailable": 826,
      "irregular-precedence": 14,
      "same-spelling": 11,
      "variant-unresolved": 3
    },
    "externalVerified": 125,
    "unverified": 1245,
    "includedExternalVerified": 101,
    "includedDBOnly": 30,
    "dbTracked": 84,
    "requiredPluralsTracked": 25,
    "dbByStatus": {
      "excluded": 6,
      "held": 1,
      "included": 77
    },
    "requiredPluralsByStatus": {
      "excluded": 6,
      "held": 1,
      "included": 18
    }
  }
}
```

## 전수 검수표

| 원형 ID | 원형 | 현재 뜻 | 형태 | 종류 | 규칙 | 출처 | 근거 | 대조 | 상태 | 이유 | clash |
|---|---|---|---|---|---|---|---|---|---|---|---|
| W0002:기본:abandon:1 | abandon | 버리다 | abandonning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0002:기본:abandon:1 | abandon | 버리다 | abandonned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0004:기본:ability:1 | ability | 능력 | abilities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0020:기본:accomplish:1 | accomplish | 완수하다 | accomplishes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0024:기본:accuse:1 | accuse | 잘못했다고 비난하다 | accusing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0025:기본:ache:1 | ache | 쑤시는 아픔 | aching | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0026:기본:achieve:1 | achieve | 이루다 | achieving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0029:기본:acquire:1 | acquire | 얻다 | acquiring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0035:기본:activity:1 | activity | 활동 | activities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0037:기본:actress:1 | actress | 여자 배우 | actresses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0043:기본:address:1 | address | 주소 | addresses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0043:기본:address:1 | address | 주소 | addresses | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0046:기본:admire:1 | admire | 감탄하다 | admiring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0047:기본:admit:1 | admit | 인정하다 | admitting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0047:기본:admit:1 | admit | 인정하다 | admitted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0049:기본:adore:1 | adore | 아주 좋아하다 | adoring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0051:기본:advance:1 | advance | 앞으로 나아가다 | advancing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0055:기본:advertise:1 | advertise | 광고하다 | advertising | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0057:기본:advise:1 | advise | 조언하다 | advising | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0069:기본:agree:1 | agree | 동의하다 | agreing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0084:기본:allergy:1 | allergy | 알레르기 | allergies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0102:기본:amaze:1 | amaze | 깜짝 놀라게 하다 | amazing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0106:기본:amble:1 | amble | 느릿느릿 걷다 | ambling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0108:기본:ambush:1 | ambush | 매복 공격하다 | ambushes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0108:기본:ambush:1 | ambush | 매복 공격하다 | ambushes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0112:기본:amuse:1 | amuse | 즐겁게 하다 | amusing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0113:기본:analyze:1 | analyze | 분석하다 | analyzing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0115:기본:anchor:1 | anchor | 닻 | anchorring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0115:기본:anchor:1 | anchor | 닻 | anchorred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0124:기본:anniversary:1 | anniversary | 기념일 | anniversaries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0125:기본:announce:1 | announce | 발표하다 | announcing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0130:기본:answer:1 | answer | 대답하다 | answerring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0130:기본:answer:1 | answer | 대답하다 | answerred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0138:기본:anxiety:1 | anxiety | 불안 | anxieties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0142:기본:anybody:1 | anybody | 누구든 | anybodies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0150:기본:apologize:1 | apologize | 사과하다 | apologizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0151:기본:apology:1 | apology | 사과 | apologies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0160:기본:appreciate:1 | appreciate | 고마워하다 | appreciating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0161:기본:approach:1 | approach | 다가가다 | approaches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0161:기본:approach:1 | approach | 다가가다 | approaches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0167:기본:arch:1 | arch | 아치 | arches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0169:기본:archery:1 | archery | 활쏘기 | archeries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0173:기본:argue:1 | argue | 말다툼하다 | arguing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0176:기본:armadillo:1 | armadillo | 아르마딜로 | armadilloes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0181:기본:arrange:1 | arrange | 정리하다 | arranging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0184:기본:arrive:1 | arrive | 도착하다 | arriving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0191:기본:ash:1 | ash | 재 | ashes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0195:기본:asparagus:1 | asparagus | 아스파라거스 | asparaguses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0197:기본:assemble:1 | assemble | 조립하다 | assembling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0198:기본:assess:1 | assess | 평가하다 | assesses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0202:기본:assume:1 | assume | ~라고 여기다 | assuming | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0204:기본:astonish:1 | astonish | 몹시 놀라게 하다 | astonishes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0210:기본:atlas:1 | atlas | 지도책 | atlases | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0212:기본:attach:1 | attach | 붙이다 | attaches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0225:기본:autobiography:1 | autobiography | 자서전 | autobiographies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0233:기본:avocado:1 | avocado | 아보카도 | avocadoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0235:기본:awake:1 | awake | 깨어 있는 | awaking | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0243:기본:babble:1 | babble | 종알거리다 | babbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0257:기본:bake:1 | bake | 굽다 | baking | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0259:기본:bakery:1 | bakery | 빵집 | bakeries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0260:기본:balance:1 | balance | 균형을 잡다 | balancing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0261:기본:balcony:1 | balcony | 발코니 | balconies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0266:기본:bamboo:1 | bamboo | 대나무 | bambooes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0267:기본:ban:1 | ban | 금지하다 | banning | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0267:기본:ban:1 | ban | 금지하다 | banned | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0270:기본:bandage:1 | bandage | 붕대 | bandaging | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0288:기본:batch:1 | batch | 한 번에 만든 양 | batches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0292:기본:battery:1 | battery | 건전지 | batteries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0293:기본:battle:1 | battle | 전투 | battling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0296:기본:be:1 | be | ~이다 | bing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0297:기본:beach:1 | beach | 해변 | beaches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0307:기본:beckon:1 | beckon | 오라고 손짓하다 | beckonning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0307:기본:beckon:1 | beckon | 오라고 손짓하다 | beckonned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0308:기본:become:1 | become | ~이 되다 | becoming | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0308:기본:become:1 | become | ~이 되다 | became | past | irregular | db | W0308:불규칙 과거형:became:1 | db-link-only | included | db-linked-form |  |
| W0318:기본:beg:1 | beg | 간청하다 | begging | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0318:기본:beg:1 | beg | 간청하다 | begged | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0319:기본:begin:1 | begin | 시작하다 | beginning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0319:기본:begin:1 | begin | 시작하다 | beginned | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W0320:기본:behave:1 | behave | 행동하다 | behaving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0324:기본:believe:1 | believe | 믿다 | believing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0327:기본:belly:1 | belly | 배 | bellies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0331:기본:bench:1 | bench | 긴 의자 | benches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0332:기본:bend:1 | bend | 굽히다 | bent | past | irregular | db | W0332:불규칙 과거형:bent:1 | db-link-only | included | db-linked-form |  |
| W0333:기본:benefit:1 | benefit | 이점 | benefitting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0333:기본:benefit:1 | benefit | 이점 | benefitted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0334:기본:berry:1 | berry | 산딸기류 열매 | berries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0339:기본:bicker:1 | bicker | 사소한 일로 말다툼하다 | bickerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0339:기본:bicker:1 | bicker | 사소한 일로 말다툼하다 | bickerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0347:기본:biography:1 | biography | 전기 | biographies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0348:기본:birch:1 | birch | 자작나무 | birches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0355:기본:bite:1 | bite | 물다 | biting | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0355:기본:bite:1 | bite | 물다 | bit | past | irregular | db | W0355:불규칙 과거형:bit:1 | db-link-only | included | db-linked-form | W0354:기본:bit:1 |
| W0358:기본:blackberry:1 | blackberry | 블랙베리 | blackberries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0360:기본:blame:1 | blame | 탓하다 | blaming | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0371:기본:blossom:1 | blossom | 꽃 | blossomming | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0371:기본:blossom:1 | blossom | 꽃 | blossommed | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0373:기본:blow:1 | blow | 불다 | blew | past | irregular | db | W0373:불규칙 과거형:blew:1 | db-link-only | included | db-linked-form |  |
| W0375:기본:blueberry:1 | blueberry | 블루베리 | blueberries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0378:기본:blush:1 | blush | 얼굴을 붉히다 | blushes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0382:기본:body:1 | body | 몸 | bodies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0387:기본:bonus:1 | bonus | 추가 보상 | bonuses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0396:기본:bore:1 | bore | 지루하게 하다 | boring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0399:기본:boss:1 | boss | 상사 | bosses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0402:기본:bother:1 | bother | 괴롭히다 | botherring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0402:기본:bother:1 | bother | 괴롭히다 | botherred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0406:기본:bounce:1 | bounce | 튀다 | bouncing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0408:기본:boundary:1 | boundary | 경계 | boundaries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0413:기본:box:1 | box | 상자 | boxes | plural | es | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | excluded | ambiguous-pos |  |
| W0413:기본:box:1 | box | 상자 | boxes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0417:기본:brag:1 | brag | 뽐내다 | bragging | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0417:기본:brag:1 | brag | 뽐내다 | bragged | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0420:기본:brake:1 | brake | 브레이크 | braking | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0421:기본:branch:1 | branch | 나뭇가지 | branches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0424:기본:bravery:1 | bravery | 용감함 | braveries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0429:기본:breathe:1 | breathe | 숨 쉬다 | breathing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0448:기본:bruise:1 | bruise | 멍 | bruising | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0449:기본:brush:1 | brush | 솔질하다 | brushes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0449:기본:brush:1 | brush | 솔질하다 | brushes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0450:기본:bubble:1 | bubble | 거품이 일다 | bubbling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0454:기본:buddy:1 | buddy | 친한 친구 | buddies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0456:기본:buffalo:1 | buffalo | 물소 | buffaloes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0465:기본:bully:1 | bully | 괴롭히는 사람 | bullied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0465:기본:bully:1 | bully | 괴롭히는 사람 | bullies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0465:기본:bully:1 | bully | 괴롭히는 사람 | bullies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0470:기본:bunch:1 | bunch | 다발 | bunches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0473:기본:bunny:1 | bunny | 토끼 | bunnies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0481:기본:bush:1 | bush | 덤불 | bushes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0482:기본:business:1 | business | 사업 | businesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0483:기본:bustle:1 | bustle | 바삐 움직이다 | bustling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0488:기본:butterfly:1 | butterfly | 나비 | butterflies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0498:기본:cactus:1 | cactus | 선인장 | cacti | plural | irregular | list | https://www.collinsdictionary.com/dictionary/english/cactus | external-dictionary | excluded | variant-unresolved |  |
| W0498:기본:cactus:1 | cactus | 선인장 | cactuses | plural | es | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W0503:기본:calculate:1 | calculate | 계산하다 | calculating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0511:기본:camouflage:1 | camouflage | 위장하다 | camouflaging | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0515:기본:campus:1 | campus | 교정 | campuses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0516:기본:can:1 | can | ~할 수 있다 | canning | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0516:기본:can:1 | can | ~할 수 있다 | canned | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0518:기본:cancel:1 | cancel | 취소하다 | cancelling | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0518:기본:cancel:1 | cancel | 취소하다 | cancelled | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0520:기본:candy:1 | candy | 사탕 | candies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0524:기본:canvas:1 | canvas | 캔버스 | canvases | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0528:기본:capacity:1 | capacity | 담을 수 있는 양 | capacities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0534:기본:capture:1 | capture | 붙잡다 | capturing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0539:기본:care:1 | care | 신경 쓰다 | caring | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0555:기본:cash:1 | cash | 현금 | cashes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0560:기본:catch:1 | catch | 잡다 | caught | past | irregular | db | W0560:불규칙 과거형:caught:1 | db-link-only | included | db-linked-form |  |
| W0561:기본:categorize:1 | categorize | 범주별로 나누다 | categorizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0562:기본:category:1 | category | 범주 | categories | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0567:기본:cause:1 | cause | 원인 | causing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0574:기본:celebrate:1 | celebrate | 축하하다 | celebrating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0576:기본:celery:1 | celery | 셀러리 | celeries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0579:기본:cello:1 | cello | 첼로 | celloes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0580:기본:cemetery:1 | cemetery | 묘지 | cemeteries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0586:기본:century:1 | century | 세기 | centuries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0588:기본:ceremony:1 | ceremony | 의식 | ceremonies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0594:기본:challenge:1 | challenge | 도전 | challenging | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0599:기본:change:1 | change | 바꾸다 | changing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0601:기본:chaos:1 | chaos | 큰 혼란 | chaoses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0606:기본:charge:1 | charge | 요금 | charging | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0609:기본:charity:1 | charity | 자선 | charities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0612:기본:chase:1 | chase | 뒤쫓다 | chasing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0613:기본:chatter:1 | chatter | 재잘거리다 | chatterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0613:기본:chatter:1 | chatter | 재잘거리다 | chatterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0625:기본:cherry:1 | cherry | 체리 | cherries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0636:기본:chime:1 | chime | 종이 울리다 | chiming | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0646:기본:choke:1 | choke | 숨이 막히다 | choking | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0647:기본:choose:1 | choose | 선택하다 | choosing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0648:기본:chop:1 | chop | 잘게 썰다 | chopping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0648:기본:chop:1 | chop | 잘게 썰다 | chopped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0650:기본:chorus:1 | chorus | 합창 | choruses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0651:기본:chrysalis:1 | chrysalis | 나비의 번데기 | chrysalises | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0653:기본:chuckle:1 | chuckle | 빙그레 웃다 | chuckling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0654:기본:church:1 | church | 교회 | churches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0657:기본:circle:1 | circle | 동그라미 치다 | circling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0661:기본:circus:1 | circus | 서커스 | circuses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0666:기본:clamber:1 | clamber | 기어오르다 | clamberring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0666:기본:clamber:1 | clamber | 기어오르다 | clamberred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0667:기본:clap:1 | clap | 박수를 치다 | clapping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0667:기본:clap:1 | clap | 박수를 치다 | clapped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0670:기본:class:1 | class | 수업 | classes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0672:기본:classify:1 | classify | 분류하다 | classified | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0672:기본:classify:1 | classify | 분류하다 | classifies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0675:기본:clatter:1 | clatter | 달가닥거리다 | clatterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0675:기본:clatter:1 | clatter | 달가닥거리다 | clatterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0681:기본:clench:1 | clench | 주먹·이를 꽉 쥐다 | clenches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0687:기본:climax:1 | climax | 이야기의 절정 | climaxes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0691:기본:clip:1 | clip | 클립 | clipping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0691:기본:clip:1 | clip | 클립 | clipped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0695:기본:close:1 | close | 닫다 | closing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0699:기본:clothes:1 | clothes | 옷 | clotheses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0707:기본:clutch:1 | clutch | 꽉 움켜쥐다 | clutches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0708:기본:coach:1 | coach | 코치 | coaches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0714:기본:cockatoo:1 | cockatoo | 코카투 | cockatooes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0725:기본:collapse:1 | collapse | 무너지다 | collapsing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0730:기본:colony:1 | colony | 동물의 군집 | colonies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0731:기본:color:1 | color | 색칠하다 | colorring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0731:기본:color:1 | color | 색칠하다 | colorred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0736:기본:combine:1 | combine | 결합하다 | combining | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0737:기본:come:1 | come | 오다 | coming | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0737:기본:come:1 | come | 오다 | come | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | excluded | same-spelling |  |
| W0744:기본:commit:1 | commit | 저지르다 | committing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0744:기본:commit:1 | commit | 저지르다 | committed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0746:기본:communicate:1 | communicate | 의사소통하다 | communicating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0747:기본:community:1 | community | 지역 공동체 | communities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0749:기본:company:1 | company | 회사 | companies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0750:기본:compare:1 | compare | 비교하다 | comparing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0752:기본:compass:1 | compass | 나침반 | compasses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0753:기본:compete:1 | compete | 경쟁하다 | competing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0758:기본:complete:1 | complete | 완전한 | completing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0760:기본:complicate:1 | complicate | 복잡하게 하다 | complicating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0765:기본:concentrate:1 | concentrate | 집중하다 | concentrating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0769:기본:conclude:1 | conclude | 결론짓다 | concluding | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0772:기본:condense:1 | condense | 응결하다 | condensing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0778:기본:confess:1 | confess | 고백하다 | confesses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0782:기본:confuse:1 | confuse | 혼란스럽게 하다 | confusing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0790:기본:conserve:1 | conserve | 아끼다 | conserving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0791:기본:consider:1 | consider | 생각해 보다 | considerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0791:기본:consider:1 | consider | 생각해 보다 | considerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0793:기본:console:1 | console | 위로하다 | consoling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0799:기본:contaminate:1 | contaminate | 더럽히다 | contaminating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0804:기본:continue:1 | continue | 계속하다 | continuing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0809:기본:contribute:1 | contribute | 보태다 | contributing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0810:기본:control:1 | control | 통제 | controlling | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0810:기본:control:1 | control | 통제 | controlled | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0814:기본:convince:1 | convince | 확신시키다 | convincing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0819:기본:cooperate:1 | cooperate | 협력하다 | cooperating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0821:기본:cope:1 | cope | 어려움을 감당하다 | coping | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0822:기본:copy:1 | copy | 베끼다 | copied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0822:기본:copy:1 | copy | 베끼다 | copies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0822:기본:copy:1 | copy | 베끼다 | copies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0836:기본:couch:1 | couch | 소파 | couches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0841:기본:country:1 | country | 나라 | countries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0851:기본:cover:1 | cover | 덮다 | coverring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0851:기본:cover:1 | cover | 덮다 | coverred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0853:기본:cower:1 | cower | 겁이 나서 웅크리다 | cowerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0853:기본:cower:1 | cower | 겁이 나서 웅크리다 | cowerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0859:기본:crackle:1 | crackle | 타닥타닥 소리 나다 | crackling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0862:기본:crash:1 | crash | 충돌하다 | crashes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0862:기본:crash:1 | crash | 충돌하다 | crashes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0870:기본:crease:1 | crease | 주름이 생기다 | creasing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0871:기본:create:1 | create | 창조하다 | creating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0874:기본:creativity:1 | creativity | 창의력 | creativities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0877:기본:creep:1 | creep | 살금살금 움직이다 | crept | past | irregular | db | W0877:불규칙 과거형:crept:1 | db-link-only | included | db-linked-form |  |
| W0882:기본:cringe:1 | cringe | 겁먹고 움츠리다 | cringing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0887:기본:cross:1 | cross | 건너다 | crosses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0887:기본:cross:1 | cross | 건너다 | crosses | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0889:기본:crouch:1 | crouch | 몸을 웅크리다 | crouches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0894:기본:cruise:1 | cruise | 배로 유람하다 | cruising | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0896:기본:crumble:1 | crumble | 부스러지다 | crumbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0897:기본:crumple:1 | crumple | 구기다 | crumpling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0898:기본:crunch:1 | crunch | 바삭 소리를 내며 씹다 | crunches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0900:기본:crush:1 | crush | 눌러 부수다 | crushes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0902:기본:crutch:1 | crutch | 목발 | crutches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0903:기본:cry:1 | cry | 울다 | cried | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0903:기본:cry:1 | cry | 울다 | cries | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0906:기본:cuckoo:1 | cuckoo | 뻐꾸기 | cuckooes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0908:기본:cuddle:1 | cuddle | 껴안고 다독이다 | cuddling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0914:기본:cure:1 | cure | 치료하다 | curing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0919:기본:curse:1 | curse | 저주 | cursing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0921:기본:curtsy:1 | curtsy | 무릎을 굽혀 인사하다 | curtsied | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0921:기본:curtsy:1 | curtsy | 무릎을 굽혀 인사하다 | curtsies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0922:기본:curve:1 | curve | 곡선 | curving | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0926:기본:customs:1 | customs | 세관 | customses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0927:기본:cut:1 | cut | 자르다 | cutting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0927:기본:cut:1 | cut | 자르다 | cut | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | excluded | same-spelling |  |
| W0927:기본:cut:1 | cut | 자르다 | cutted | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W0929:기본:cycle:1 | cycle | 자전거를 타다 | cycling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0938:기본:damage:1 | damage | 손상 | damaging | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0940:기본:dance:1 | dance | 춤추다 | dancing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W0945:기본:dangle:1 | dangle | 대롱대롱 매달리다 | dangling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0947:기본:darkness:1 | darkness | 어둠 | darknesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0949:기본:dash:1 | dash | 쏜살같이 달리다 | dashes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0961:기본:deal:1 | deal | 약속 | dealt | past | irregular | db | W0961:불규칙 과거형:dealt:1 | db-link-only | held | approved-meaning-hold |  |
| W0967:기본:deceive:1 | deceive | 속이다 | deceiving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0969:기본:decide:1 | decide | 결정하다 | deciding | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0974:기본:declare:1 | declare | 선언하다 | declaring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0975:기본:decompose:1 | decompose | 썩어 분해되다 | decomposing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0976:기본:decorate:1 | decorate | 장식하다 | decorating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0978:기본:dedicate:1 | dedicate | 바치다 | dedicating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0979:기본:deduce:1 | deduce | 추론하다 | deducing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0982:기본:deer:1 | deer | 사슴 | deer | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | excluded | same-spelling |  |
| W0994:기본:deliver:1 | deliver | 배달하다 | deliverring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0994:기본:deliver:1 | deliver | 배달하다 | deliverred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0996:기본:demonstrate:1 | demonstrate | 보여 주다 | demonstrating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0999:기본:density:1 | density | 밀도 | densities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1001:기본:deny:1 | deny | 부인하다 | denied | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1001:기본:deny:1 | deny | 부인하다 | denies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1009:기본:describe:1 | describe | 묘사하다 | describing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1012:기본:deserve:1 | deserve | ~을 받을 만하다 | deserving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1015:기본:desire:1 | desire | 강한 바람 | desiring | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1021:기본:destiny:1 | destiny | 운명 | destinies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1027:기본:determine:1 | determine | 결정하다 | determining | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1028:기본:develop:1 | develop | 발달하다 | developping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1028:기본:develop:1 | develop | 발달하다 | developped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1031:기본:devote:1 | devote | 시간이나 노력을 쏟다 | devoting | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1037:기본:diary:1 | diary | 일기장 | diaries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1038:기본:dictionary:1 | dictionary | 사전 | dictionaries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1039:기본:die:1 | die | 죽다 | diing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1041:기본:differ:1 | differ | 다르다 | differring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1041:기본:differ:1 | differ | 다르다 | differred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1046:기본:difficulty:1 | difficulty | 어려움 | difficulties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1047:기본:dig:1 | dig | 파다 | digging | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1047:기본:dig:1 | dig | 파다 | digged | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W1047:기본:dig:1 | dig | 파다 | dug | past | irregular | db | W1047:불규칙 과거형:dug:1 | db-link-only | included | db-linked-form |  |
| W1059:기본:disagree:1 | disagree | 동의하지 않다 | disagreing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1066:기본:discover:1 | discover | 발견하다 | discoverring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1066:기본:discover:1 | discover | 발견하다 | discoverred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1067:기본:discovery:1 | discovery | 발견 | discoveries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1069:기본:disguise:1 | disguise | 변장하다 | disguising | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1071:기본:dish:1 | dish | 접시 | dishes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1073:기본:dislike:1 | dislike | 싫어하다 | disliking | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1074:기본:dismantle:1 | dismantle | 분해하다 | dismantling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1078:기본:dissolve:1 | dissolve | 녹다 | dissolving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1081:기본:distinguish:1 | distinguish | 구별하다 | distinguishes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1085:기본:dive:1 | dive | 물속으로 뛰어들다 | diving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1086:기본:divide:1 | divide | 나누다 | dividing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1089:기본:do:1 | do | 하다 | does | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1092:기본:dodge:1 | dodge | 재빨리 피하다 | dodging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1099:기본:donate:1 | donate | 기부하다 | donating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1108:기본:double:1 | double | 두 배로 하다 | doubling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1113:기본:downstairs:1 | downstairs | 아래층에 | downstairses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1117:기본:drag:1 | drag | 끌다 | dragging | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1117:기본:drag:1 | drag | 끌다 | dragged | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1119:기본:dragonfly:1 | dragonfly | 잠자리 | dragonflies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1128:기본:dress:1 | dress | 옷을 입다 | dresses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1128:기본:dress:1 | dress | 옷을 입다 | dresses | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1130:기본:drink:1 | drink | 마시다 | drank | past | irregular | db | W1130:불규칙 과거형:drank:1 | db-link-only | included | db-linked-form |  |
| W1131:기본:drip:1 | drip | 뚝뚝 떨어지다 | dripping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1131:기본:drip:1 | drip | 뚝뚝 떨어지다 | dripped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1132:기본:drive:1 | drive | 운전하다 | driving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1135:기본:drizzle:1 | drizzle | 이슬비 | drizzling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1136:기본:drop:1 | drop | 떨어뜨리다 | dropping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1136:기본:drop:1 | drop | 떨어뜨리다 | dropped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1140:기본:dry:1 | dry | 말리다 | dried | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1140:기본:dry:1 | dry | 말리다 | dries | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1152:기본:duty:1 | duty | 의무 | duties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1161:기본:earphones:1 | earphones | 이어폰 한쪽 | earphoneses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1172:기본:echo:1 | echo | 메아리치다 | echoes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1172:기본:echo:1 | echo | 메아리치다 | echoes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1176:기본:edit:1 | edit | 글을 고치다 | editting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1176:기본:edit:1 | edit | 글을 고치다 | editted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1196:기본:electricity:1 | electricity | 전기 | electricities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1206:기본:embarrass:1 | embarrass | 당황스럽게 하다 | embarrasses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1208:기본:embrace:1 | embrace | 껴안다 | embracing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1209:기본:emerge:1 | emerge | 나오다 | emerging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1210:기본:emergency:1 | emergency | 비상사태 | emergencies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1211:기본:emit:1 | emit | 내보내다 | emitting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1211:기본:emit:1 | emit | 내보내다 | emitted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1213:기본:empathy:1 | empathy | 상대의 감정을 이해하는 공감 | empathies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1217:기본:empress:1 | empress | 여제 | empresses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1218:기본:empty:1 | empty | 비우다 | emptied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1218:기본:empty:1 | empty | 비우다 | empties | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1220:기본:encounter:1 | encounter | 우연히 만나다 | encounterring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1220:기본:encounter:1 | encounter | 우연히 만나다 | encounterred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1221:기본:encourage:1 | encourage | 용기를 주다 | encouraging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1224:기본:endanger:1 | endanger | 위험에 빠뜨리다 | endangerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1224:기본:endanger:1 | endanger | 위험에 빠뜨리다 | endangerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1225:기본:endure:1 | endure | 견디다 | enduring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1226:기본:enemy:1 | enemy | 적 | enemies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1228:기본:energy:1 | energy | 기운 | energies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1231:기본:English:1 | English | 영어 | Englishes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1235:기본:enter:1 | enter | 들어가다 | enterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1235:기본:enter:1 | enter | 들어가다 | enterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1242:기본:envy:1 | envy | 부러움 | envied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1242:기본:envy:1 | envy | 부러움 | envies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1242:기본:envy:1 | envy | 부러움 | envies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1248:기본:erase:1 | erase | 지우다 | erasing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1250:기본:erode:1 | erode | 침식시키다 | eroding | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1254:기본:escape:1 | escape | 탈출하다 | escaping | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1257:기본:estimate:1 | estimate | 어림잡다 | estimating | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1258:기본:evaluate:1 | evaluate | 평가하다 | evaluating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1259:기본:evaporate:1 | evaporate | 증발하다 | evaporating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1274:기본:evolve:1 | evolve | 진화하다 | evolving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1279:기본:examine:1 | examine | 검사하다 | examining | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1284:기본:exchange:1 | exchange | 교환하다 | exchanging | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1285:기본:excite:1 | excite | 신나게 하다 | exciting | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1289:기본:excuse:1 | excuse | 변명 | excusing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1290:기본:exercise:1 | exercise | 운동 | exercising | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1291:기본:exhale:1 | exhale | 숨을 내쉬다 | exhaling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1294:기본:exit:1 | exit | 나가다 | exitting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1294:기본:exit:1 | exit | 나가다 | exitted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1300:기본:experience:1 | experience | 경험 | experiencing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1304:기본:explode:1 | explode | 폭발하다 | exploding | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1305:기본:explore:1 | explore | 탐험하다 | exploring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1308:기본:expose:1 | expose | 드러내다 | exposing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1309:기본:express:1 | express | 표현하다 | expresses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1316:기본:eyelash:1 | eyelash | 속눈썹 | eyelashes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1320:기본:face:1 | face | 마주하다 | facing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1322:기본:factory:1 | factory | 공장 | factories | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1323:기본:fade:1 | fade | 희미해지다 | fading | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1329:기본:fairness:1 | fairness | 공정함 | fairnesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1330:기본:fairy:1 | fairy | 요정 | fairies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1334:기본:fall:1 | fall | 떨어지다 | fell | past | irregular | db | W1334:불규칙 과거형:fell:1 | db-link-only | included | db-linked-form |  |
| W1337:기본:family:1 | family | 가족 | families | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1340:기본:fancy:1 | fancy | 화려한 | fancied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1340:기본:fancy:1 | fancy | 화려한 | fancies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1348:기본:fasten:1 | fasten | 채우다 | fastenning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1348:기본:fasten:1 | fasten | 채우다 | fastenned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1362:기본:February:1 | February | 2월 | Februaries | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1364:기본:feed:1 | feed | 먹이를 주다 | fed | past | irregular | db | W1364:불규칙 과거형:fed:1 | db-link-only | included | db-linked-form |  |
| W1369:기본:fence:1 | fence | 울타리 | fencing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1373:기본:ferry:1 | ferry | 나룻배 | ferries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1384:기본:fight:1 | fight | 싸우다 | fought | past | irregular | db | W1384:불규칙 과거형:fought:1 | db-link-only | included | db-linked-form |  |
| W1385:기본:figure:1 | figure | 숫자 | figuring | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1386:기본:file:1 | file | 파일 | filing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1396:기본:finish:1 | finish | 끝내다 | finishes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1398:기본:fire:1 | fire | 불 | firing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1400:기본:firefly:1 | firefly | 반딧불이 | fireflies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1404:기본:fish:1 | fish | 물고기 | fish | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | excluded | same-spelling |  |
| W1404:기본:fish:1 | fish | 물고기 | fishes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1404:기본:fish:1 | fish | 물고기 | fishes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1406:기본:fit:1 | fit | 맞다 | fitting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1406:기본:fit:1 | fit | 맞다 | fitted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1411:기본:flamingo:1 | flamingo | 플라밍고 | flamingoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1412:기본:flap:1 | flap | 날개를 퍼덕이다 | flapping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1412:기본:flap:1 | flap | 날개를 퍼덕이다 | flapped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1413:기본:flash:1 | flash | 번쩍이다 | flashes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1413:기본:flash:1 | flash | 번쩍이다 | flashes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1419:기본:flee:1 | flee | 달아나다 | fleing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1421:기본:flicker:1 | flicker | 깜박거리다 | flickerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1421:기본:flicker:1 | flicker | 깜박거리다 | flickerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1422:기본:flinch:1 | flinch | 움찔하다 | flinches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1428:기본:flop:1 | flop | 털썩 주저앉다 | flopping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1428:기본:flop:1 | flop | 털썩 주저앉다 | flopped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1429:기본:floss:1 | floss | 치실 | flosses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1430:기본:flounder:1 | flounder | 버둥거리다 | flounderring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1430:기본:flounder:1 | flounder | 버둥거리다 | flounderred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1436:기본:fluster:1 | fluster | 당황하게 하다 | flusterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1436:기본:fluster:1 | fluster | 당황하게 하다 | flusterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1438:기본:flutter:1 | flutter | 가볍게 퍼덕이다 | flutterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1438:기본:flutter:1 | flutter | 가볍게 퍼덕이다 | flutterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1439:기본:fly:1 | fly | 날다 | flew | past | irregular | db | W1439:불규칙 과거형:flew:1 | db-link-only | included | db-linked-form |  |
| W1439:기본:fly:1 | fly | 날다 | flied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1439:기본:fly:1 | fly | 날다 | flies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1439:기본:fly:1 | fly | 날다 | flies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1442:기본:focus:1 | focus | 집중하다 | focussing | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1442:기본:focus:1 | focus | 집중하다 | focussed | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1442:기본:focus:1 | focus | 집중하다 | focuses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1442:기본:focus:1 | focus | 집중하다 | focuses | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1456:기본:forage:1 | forage | 먹이를 찾아다니다 | foraging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1457:기본:forbid:1 | forbid | 금지하다 | forbidding | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1457:기본:forbid:1 | forbid | 금지하다 | forbidded | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1458:기본:force:1 | force | 힘 | forcing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1462:기본:forget:1 | forget | 잊다 | forgetting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1462:기본:forget:1 | forget | 잊다 | forgetted | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W1462:기본:forget:1 | forget | 잊다 | forgot | past | irregular | db | W1462:불규칙 과거형:forgot:1 | db-link-only | included | db-linked-form |  |
| W1463:기본:forgive:1 | forgive | 용서하다 | forgiving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1463:기본:forgive:1 | forgive | 용서하다 | forgave | past | irregular | db | W1463:불규칙 과거형:forgave:1 | db-link-only | included | db-linked-form |  |
| W1464:기본:forgiveness:1 | forgiveness | 용서 | forgivenesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1470:기본:fortress:1 | fortress | 요새 | fortresses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1479:기본:fox:1 | fox | 여우 | foxes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1485:기본:free:1 | free | 풀어주다 | freing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1488:기본:freeze:1 | freeze | 얼다 | freezing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1488:기본:freeze:1 | freeze | 얼다 | froze | past | irregular | db | W1488:불규칙 과거형:froze:1 | db-link-only | included | db-linked-form |  |
| W1498:기본:frighten:1 | frighten | 겁주다 | frightenning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1498:기본:frighten:1 | frighten | 겁주다 | frightenned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1509:기본:fry:1 | fry | 기름에 튀기다 | fried | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1509:기본:fry:1 | fry | 기름에 튀기다 | fries | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1520:기본:fury:1 | fury | 격분 | furies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1524:기본:galaxy:1 | galaxy | 은하 | galaxies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1526:기본:gallery:1 | gallery | 미술관 | galleries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1528:기본:gallop:1 | gallop | 말이 전속력으로 달리다 | gallopping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1528:기본:gallop:1 | gallop | 말이 전속력으로 달리다 | gallopped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1535:기본:gas:1 | gas | 기체 | gases | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1538:기본:gather:1 | gather | 모이다 | gatherring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1538:기본:gather:1 | gather | 모이다 | gatherred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1539:기본:gaze:1 | gaze | 가만히 바라보다 | gazing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1541:기본:gecko:1 | gecko | 도마뱀붙이 | geckoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1544:기본:generate:1 | generate | 만들어 내다 | generating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1546:기본:generosity:1 | generosity | 너그러움 | generosities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1552:기본:geography:1 | geography | 지리 | geographies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1555:기본:germinate:1 | germinate | 씨가 싹트다 | germinating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1557:기본:gesture:1 | gesture | 몸짓하다 | gesturing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1558:기본:get:1 | get | 얻다 | getted | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W1563:기본:giggle:1 | giggle | 킥킥 웃다 | giggling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1567:기본:give:1 | give | 주다 | giving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1570:기본:glance:1 | glance | 힐끗 보다 | glancing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1571:기본:glare:1 | glare | 노려보다 | glaring | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1572:기본:glass:1 | glass | 유리 | glasses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1573:기본:glide:1 | glide | 미끄러지듯 움직이다 | gliding | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1575:기본:glimpse:1 | glimpse | 언뜻 보다 | glimpsing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1576:기본:glitter:1 | glitter | 반짝이다 | glitterring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1576:기본:glitter:1 | glitter | 반짝이다 | glitterred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1582:기본:glue:1 | glue | 풀 | gluing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1587:기본:gobble:1 | gobble | 게걸스럽게 먹다 | gobbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1589:기본:goggles:1 | goggles | 보호 안경 | goggleses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1592:기본:goldfish:1 | goldfish | 금붕어 | goldfishes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1596:기본:goods:1 | goods | 상품 | goodses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1600:기본:gossip:1 | gossip | 소문 | gossipping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1600:기본:gossip:1 | gossip | 소문 | gossipped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1602:기본:grab:1 | grab | 와락 잡다 | grabbing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1602:기본:grab:1 | grab | 와락 잡다 | grabbed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1617:기본:grass:1 | grass | 풀 | grasses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1620:기본:grate:1 | grate | 잘게 갈다 | grating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1625:기본:gravity:1 | gravity | 중력 | gravities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1626:기본:gravy:1 | gravy | 고기 육즙 소스 | gravies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1628:기본:graze:1 | graze | 풀을 뜯다 | grazing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1637:기본:grin:1 | grin | 이를 보이며 웃다 | grinning | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1637:기본:grin:1 | grin | 이를 보이며 웃다 | grinned | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1638:기본:grip:1 | grip | 꽉 잡다 | gripping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1638:기본:grip:1 | grip | 꽉 잡다 | gripped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1643:기본:grow:1 | grow | 자라다 | grew | past | irregular | db | W1643:불규칙 과거형:grew:1 | db-link-only | included | db-linked-form |  |
| W1646:기본:grumble:1 | grumble | 투덜거리다 | grumbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1649:기본:guess:1 | guess | 추측하다 | guesses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1649:기본:guess:1 | guess | 추측하다 | guesses | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1651:기본:guide:1 | guide | 안내자 | guiding | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1663:기본:gymnastics:1 | gymnastics | 체조 | gymnasticses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1669:기본:half:1 | half | 절반의 | halves | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | held | approved-meaning-hold |  |
| W1674:기본:hammer:1 | hammer | 망치 | hammerring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1674:기본:hammer:1 | hammer | 망치 | hammerred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1675:기본:hamper:1 | hamper | 빨래 바구니 | hamperring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1675:기본:hamper:1 | hamper | 빨래 바구니 | hamperred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1679:기본:handle:1 | handle | 손잡이 | handling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1684:기본:happen:1 | happen | 일어나다 | happenning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1684:기본:happen:1 | happen | 일어나다 | happenned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1686:기본:happiness:1 | happiness | 행복 | happinesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1700:기본:hatch:1 | hatch | 알에서 나오다 | hatches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1701:기본:hate:1 | hate | 몹시 싫어하다 | hating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1710:기본:headphones:1 | headphones | 헤드폰 한쪽 | headphoneses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1711:기본:headquarters:1 | headquarters | 본부 | headquarterses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1721:기본:heave:1 | heave | 힘주어 들어 올리다 | heaving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1738:기본:hero:1 | hero | 영웅 | heroes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1741:기본:hesitate:1 | hesitate | 망설이다 | hesitating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1743:기본:hibernate:1 | hibernate | 겨울잠을 자다 | hibernating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1745:기본:hiccup:1 | hiccup | 딸꾹질하다 | hiccupping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1745:기본:hiccup:1 | hiccup | 딸꾹질하다 | hiccupped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1746:기본:hide:1 | hide | 숨다 | hiding | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1746:기본:hide:1 | hide | 숨다 | hid | past | irregular | db | W1746:불규칙 과거형:hid:1 | db-link-only | included | db-linked-form |  |
| W1751:기본:hike:1 | hike | 하이킹하다 | hiking | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1756:기본:hippopotamus:1 | hippopotamus | 하마 | hippopotamuses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1757:기본:hiss:1 | hiss | 쉿 소리 내다 | hisses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1761:기본:history:1 | history | 역사 | histories | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1762:기본:hit:1 | hit | 치다 | hitting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1762:기본:hit:1 | hit | 치다 | hit | past | irregular | db | W1762:불규칙 과거형:hit:1 | db-link-only | excluded | same-spelling |  |
| W1762:기본:hit:1 | hit | 치다 | hitted | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W1764:기본:hoax:1 | hoax | 사기 | hoaxes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1777:기본:honesty:1 | honesty | 정직 | honesties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1781:기본:hoof:1 | hoof | 발굽 | hooves | plural | irregular | list | https://www.collinsdictionary.com/dictionary/english/hoof | external-dictionary | excluded | variant-unresolved |  |
| W1785:기본:hop:1 | hop | 깡충 뛰다 | hopping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1785:기본:hop:1 | hop | 깡충 뛰다 | hopped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1786:기본:hope:1 | hope | 바라다 | hoping | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1803:기본:hover:1 | hover | 공중에 떠 있다 | hoverring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1803:기본:hover:1 | hover | 공중에 떠 있다 | hoverred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1807:기본:huddle:1 | huddle | 몸을 맞대고 모이다 | huddling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1808:기본:hug:1 | hug | 껴안다 | hugging | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1808:기본:hug:1 | hug | 껴안다 | hugged | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1811:기본:hum:1 | hum | 콧노래 부르다 | humming | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1811:기본:hum:1 | hum | 콧노래 부르다 | hummed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1824:기본:hurry:1 | hurry | 서두르다 | hurried | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1824:기본:hurry:1 | hurry | 서두르다 | hurries | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1825:기본:hurt:1 | hurt | 다치게 하다 | hurt | past | irregular | db | W1825:불규칙 과거형:hurt:1 | db-link-only | excluded | same-spelling |  |
| W1831:기본:hypothesis:1 | hypothesis | 가설 | hypothesises | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1840:기본:identify:1 | identify | 무엇인지 알아내다 | identified | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1840:기본:identify:1 | identify | 무엇인지 알아내다 | identifies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1845:기본:illness:1 | illness | 병 | illnesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1846:기본:illustrate:1 | illustrate | 삽화를 그리다 | illustrating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1850:기본:imagine:1 | imagine | 상상하다 | imagining | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1851:기본:imitate:1 | imitate | 흉내 내다 | imitating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1862:기본:impress:1 | impress | 깊은 인상을 주다 | impresses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1864:기본:improve:1 | improve | 개선하다 | improving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1867:기본:inch:1 | inch | 인치 | inches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1868:기본:include:1 | include | 포함하다 | including | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1872:기본:increase:1 | increase | 늘다 | increasing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1876:기본:indicate:1 | indicate | 나타내다 | indicating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1878:기본:industry:1 | industry | 산업 | industries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1881:기본:infer:1 | infer | 미루어 알다 | inferring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1881:기본:infer:1 | infer | 미루어 알다 | inferred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1883:기본:influence:1 | influence | 영향 | influencing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1886:기본:inhabit:1 | inhabit | 살다 | inhabitting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1886:기본:inhabit:1 | inhabit | 살다 | inhabitted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1887:기본:inhale:1 | inhale | 숨을 들이마시다 | inhaling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1889:기본:injure:1 | injure | 다치게 하다 | injuring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1890:기본:injury:1 | injury | 부상 | injuries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1898:기본:inspire:1 | inspire | 의욕을 불어넣다 | inspiring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1905:기본:insulate:1 | insulate | 단열하다 | insulating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1913:기본:interpret:1 | interpret | 해석하다 | interpretting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1913:기본:interpret:1 | interpret | 해석하다 | interpretted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1919:기본:introduce:1 | introduce | 소개하다 | introducing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1924:기본:investigate:1 | investigate | 조사하다 | investigating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1927:기본:invite:1 | invite | 초대하다 | inviting | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1928:기본:involve:1 | involve | 포함하다 | involving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1929:기본:iron:1 | iron | 다리미 | ironning | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1929:기본:iron:1 | iron | 다리미 | ironned | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1934:기본:itch:1 | itch | 가려움 | itches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1934:기본:itch:1 | itch | 가려움 | itches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1936:기본:itinerary:1 | itinerary | 여행 일정 | itineraries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1937:기본:ivy:1 | ivy | 담쟁이덩굴 | ivies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1938:기본:jab:1 | jab | 푹 찌르다 | jabbing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1938:기본:jab:1 | jab | 푹 찌르다 | jabbed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1944:기본:January:1 | January | 1월 | Januaries | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1948:기본:jealousy:1 | jealousy | 질투 | jealousies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1949:기본:jeans:1 | jeans | 청바지 | jeanses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1950:기본:jelly:1 | jelly | 젤리 | jellies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1951:기본:jellyfish:1 | jellyfish | 해파리 | jellyfishes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1955:기본:jewelry:1 | jewelry | 보석류 | jewelries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1957:기본:jog:1 | jog | 천천히 달리다 | jogging | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1957:기본:jog:1 | jog | 천천히 달리다 | jogged | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1960:기본:joke:1 | joke | 농담하다 | joking | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1962:기본:jostle:1 | jostle | 밀치다 | jostling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1968:기본:judge:1 | judge | 판단하다 | judging | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1969:기본:judo:1 | judo | 유도 | judoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1971:기본:juggle:1 | juggle | 공 등을 번갈아 던지고 받다 | juggling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1974:기본:July:1 | July | 7월 | Julies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W1981:기본:kangaroo:1 | kangaroo | 캥거루 | kangarooes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W1998:기본:kindness:1 | kindness | 친절 | kindnesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2001:기본:kiss:1 | kiss | 입 맞추다 | kisses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2001:기본:kiss:1 | kiss | 입 맞추다 | kisses | s3 | es | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | excluded | ambiguous-pos |  |
| W2017:기본:label:1 | label | 이름표 | labelling | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2017:기본:label:1 | label | 이름표 | labelled | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2018:기본:laboratory:1 | laboratory | 실험실 | laboratories | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2022:기본:lady:1 | lady | 여성 | ladies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2039:기본:latch:1 | latch | 걸쇠 | latches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2044:기본:launch:1 | launch | 발사하다 | launches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2045:기본:laundry:1 | laundry | 빨래 | laundries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2050:기본:lay:1 | lay | 놓다 | laid | past | irregular | db | W2050:불규칙 과거형:laid:1 | db-link-only | included | db-linked-form |  |
| W2062:기본:leave:1 | leave | 떠나다 | leaving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2063:기본:leech:1 | leech | 거머리 | leeches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2072:기본:lend:1 | lend | 빌려주다 | lent | past | irregular | db | W2072:불규칙 과거형:lent:1 | db-link-only | included | db-linked-form |  |
| W2078:기본:let:1 | let | ~하게 하다 | letting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2078:기본:let:1 | let | ~하게 하다 | let | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | excluded | same-spelling |  |
| W2078:기본:let:1 | let | ~하게 하다 | letted | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W2084:기본:library:1 | library | 도서관 | libraries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2087:기본:lie:1 | lie | 눕다 | liing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2100:기본:lily:1 | lily | 백합 | lilies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2102:기본:limit:1 | limit | 한계 | limitting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2102:기본:limit:1 | limit | 한계 | limitted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2110:기본:listen:1 | listen | 귀 기울여 듣다 | listenning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2110:기본:listen:1 | listen | 귀 기울여 듣다 | listenned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2115:기본:live:1 | live | 살다 | living | ing | e-drop | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | excluded | ambiguous-pos | W2118:기본:living:1 |
| W2122:기본:loathe:1 | loathe | 몹시 싫어하다 | loathing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2133:기본:loneliness:1 | loneliness | 외로움 | lonelinesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2139:기본:loosen:1 | loosen | 느슨하게 하다 | loosenning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2139:기본:loosen:1 | loosen | 느슨하게 하다 | loosenned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2140:기본:lorry:1 | lorry | 영국식 트럭 | lorries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2141:기본:lose:1 | lose | 잃어버리다 | losing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2143:기본:loss:1 | loss | 상실 | losses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2145:기본:lotus:1 | lotus | 연꽃 | lotuses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2149:기본:love:1 | love | 사랑하다 | loving | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2155:기본:loyalty:1 | loyalty | 충성 | loyalties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2162:기본:lunch:1 | lunch | 점심 식사 | lunches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2165:기본:lunge:1 | lunge | 갑자기 몸을 내밀다 | lunging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2166:기본:lynx:1 | lynx | 스라소니 | lynxes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2181:기본:mailbox:1 | mailbox | 우편함 | mailboxes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2190:기본:manage:1 | manage | 해내다 | managing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2194:기본:mango:1 | mango | 망고 | mangoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2195:기본:mantis:1 | mantis | 사마귀 | mantises | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2202:기본:March:1 | March | 3월 | Marches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2203:기본:march:1 | march | 행진하다 | marches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2208:기본:marry:1 | marry | 결혼하다 | married | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2209:기본:marsh:1 | marsh | 습지 | marshes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2211:기본:marvel:1 | marvel | 몹시 놀라다 | marvelling | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2211:기본:marvel:1 | marvel | 몹시 놀라다 | marvelled | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2213:기본:mash:1 | mash | 으깨다 | mashes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2215:기본:mass:1 | mass | 질량 | masses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2218:기본:master:1 | master | 주인 | masterring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2218:기본:master:1 | master | 주인 | masterred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2220:기본:match:1 | match | 짝을 맞추다 | matches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2220:기본:match:1 | match | 짝을 맞추다 | matches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2223:기본:matter:1 | matter | 일 | matterring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2223:기본:matter:1 | matter | 일 | matterred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2224:기본:mattress:1 | mattress | 매트리스 | mattresses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2225:기본:mature:1 | mature | 성숙한 | maturing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2237:기본:measure:1 | measure | 재다 | measuring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2247:기본:melody:1 | melody | 멜로디 | melodies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2253:기본:memorize:1 | memorize | 외우다 | memorizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2254:기본:memory:1 | memory | 기억 | memories | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2255:기본:menace:1 | menace | 위협하다 | menacing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2260:기본:mercy:1 | mercy | 자비 | mercies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2276:기본:migrate:1 | migrate | 이동하다 | migrating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2283:기본:mimic:1 | mimic | 흉내 내다 | mimiccing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2283:기본:mimic:1 | mimic | 흉내 내다 | mimicced | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2287:기본:minibus:1 | minibus | 소형 버스 | minibuses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2291:기본:minus:1 | minus | 빼기 | minuses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2297:기본:miss:1 | miss | 그리워하다 | misses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2300:기본:mistake:1 | mistake | 실수 | mistaking | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2305:기본:mix:1 | mix | 섞다 | mixes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2314:기본:monastery:1 | monastery | 수도원 | monasteries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2326:기본:mop:1 | mop | 대걸레질하다 | mopping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2326:기본:mop:1 | mop | 대걸레질하다 | mopped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2333:기본:mosquito:1 | mosquito | 모기 | mosquitoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2334:기본:moss:1 | moss | 이끼 | mosses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2348:기본:move:1 | move | 움직이다 | moving | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2358:기본:multiply:1 | multiply | 곱하다 | multiplied | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2358:기본:multiply:1 | multiply | 곱하다 | multiplies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2359:기본:mumble:1 | mumble | 웅얼거리다 | mumbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2360:기본:mummy:1 | mummy | 미라 | mummies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2361:기본:munch:1 | munch | 우적우적 먹다 | munches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2362:기본:murder:1 | murder | 살인 | murderring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2362:기본:murder:1 | murder | 살인 | murderred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2363:기본:murmur:1 | murmur | 작게 중얼거리다 | murmurring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2363:기본:murmur:1 | murmur | 작게 중얼거리다 | murmurred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2373:기본:mutter:1 | mutter | 중얼거리다 | mutterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2373:기본:mutter:1 | mutter | 중얼거리다 | mutterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2377:기본:mystery:1 | mystery | 수수께끼 같은 사건 | mysteries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2380:기본:name:1 | name | 이름을 붙이다 | naming | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2382:기본:narrate:1 | narrate | 이야기를 들려주다 | narrating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2392:기본:navigate:1 | navigate | 길을 찾다 | navigating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2417:기본:news:1 | news | 소식 | newses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2422:기본:nibble:1 | nibble | 조금씩 베어 먹다 | nibbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2432:기본:nobody:1 | nobody | 아무도 ~않다 | nobodies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2434:기본:nod:1 | nod | 고개를 끄덕이다 | nodding | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2434:기본:nod:1 | nod | 고개를 끄덕이다 | nodded | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2452:기본:note:1 | note | 음표 | noting | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2455:기본:notice:1 | notice | 알아차리다 | noticing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2461:기본:nudge:1 | nudge | 팔꿈치로 슬쩍 찌르다 | nudging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2465:기본:nursery:1 | nursery | 묘목장 | nurseries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2469:기본:nuzzle:1 | nuzzle | 코나 얼굴을 비비다 | nuzzling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2472:기본:oasis:1 | oasis | 오아시스 | oasises | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2479:기본:observe:1 | observe | 자세히 관찰하다 | observing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2485:기본:occur:1 | occur | 발생하다 | occurring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2485:기본:occur:1 | occur | 발생하다 | occurred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2489:기본:octopus:1 | octopus | 문어 | octopuses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2494:기본:offer:1 | offer | 제안하다 | offerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2494:기본:offer:1 | offer | 제안하다 | offerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2513:기본:open:1 | open | 열다 | openning | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2513:기본:open:1 | open | 열다 | openned | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2517:기본:opportunity:1 | opportunity | 기회 | opportunities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2524:기본:orbit:1 | orbit | 궤도 | orbitting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2524:기본:orbit:1 | orbit | 궤도 | orbitted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2528:기본:order:1 | order | 주문하다 | orderring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2528:기본:order:1 | order | 주문하다 | orderred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2532:기본:organize:1 | organize | 정리하다 | organizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2536:기본:ostrich:1 | ostrich | 타조 | ostriches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2550:기본:overalls:1 | overalls | 멜빵 작업복 | overallses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2551:기본:overcome:1 | overcome | 극복하다 | overcoming | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2552:기본:overpass:1 | overpass | 고가도로 | overpasses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2553:기본:overtake:1 | overtake | 앞지르다 | overtaking | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2554:기본:owe:1 | owe | 빚지다 | owing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2558:기본:ox:1 | ox | 황소 | oxes | plural | es | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W2563:기본:paddle:1 | paddle | 노를 젓다 | paddling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2570:기본:paintbrush:1 | paintbrush | 붓 | paintbrushes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2573:기본:pajamas:1 | pajamas | 잠옷 | pajamases | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2582:기본:panic:1 | panic | 공황 | paniccing | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2582:기본:panic:1 | panic | 공황 | panicced | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2585:기본:pants:1 | pants | 바지 | pantses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2591:기본:paraphrase:1 | paraphrase | 자기 말로 바꾸어 말하다 | paraphrasing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2594:기본:parenthesis:1 | parenthesis | 소괄호 | parenthesises | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2599:기본:participate:1 | participate | 참여하다 | participating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2604:기본:party:1 | party | 파티 | parties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2605:기본:pass:1 | pass | 지나가다 | passes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2613:기본:pastry:1 | pastry | 페이스트리 | pastries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2615:기본:pat:1 | pat | 가볍게 토닥이다 | patting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2615:기본:pat:1 | pat | 가볍게 토닥이다 | patted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2620:기본:patio:1 | patio | 집에 딸린 야외 테라스 | patioes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2622:기본:pause:1 | pause | 잠시 멈추다 | pausing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2630:기본:peach:1 | peach | 복숭아 | peaches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2638:기본:pedal:1 | pedal | 페달 | pedalling | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2638:기본:pedal:1 | pedal | 페달 | pedalled | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2647:기본:penalty:1 | penalty | 벌점 | penalties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2656:기본:perch:1 | perch | 앉다 | perches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2656:기본:perch:1 | perch | 앉다 | perches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2666:기본:permit:1 | permit | 허락하다 | permitting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2666:기본:permit:1 | permit | 허락하다 | permitted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2673:기본:persuade:1 | persuade | 설득하다 | persuading | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2674:기본:pet:1 | pet | 애완동물 | petting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2674:기본:pet:1 | pet | 애완동물 | petted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2676:기본:petrify:1 | petrify | 몹시 겁먹게 하다 | petrified | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2676:기본:petrify:1 | petrify | 몹시 겁먹게 하다 | petrifies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2677:기본:pharmacy:1 | pharmacy | 약국 | pharmacies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2679:기본:phone:1 | phone | 전화 | phoning | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2680:기본:phonics:1 | phonics | 글자와 소리의 관계를 배우는 학습 | phonicses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2681:기본:photo:1 | photo | 사진 | photoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2686:기본:piano:1 | piano | 피아노 | pianoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2693:기본:pierce:1 | pierce | 뚫다 | piercing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2697:기본:pile:1 | pile | 더미 | piling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2703:기본:pinch:1 | pinch | 꼬집다 | pinches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2703:기본:pinch:1 | pinch | 꼬집다 | pinches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2711:기본:pitch:1 | pitch | 던지다 | pitches | plural | es | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | excluded | ambiguous-pos |  |
| W2711:기본:pitch:1 | pitch | 던지다 | pitches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2713:기본:pity:1 | pity | 연민 | pitied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2713:기본:pity:1 | pity | 연민 | pities | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2713:기본:pity:1 | pity | 연민 | pities | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2715:기본:place:1 | place | 장소 | placing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2717:기본:plan:1 | plan | 계획하다 | planning | ing | double | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | excluded | ambiguous-pos |  |
| W2717:기본:plan:1 | plan | 계획하다 | planned | past | double | rule | https://learnenglishteens.britishcouncil.org/sites/teens/files/gs_past_simple_-_regular_verbs.pdf | external-educational | excluded | ambiguous-pos |  |
| W2732:기본:plenty:1 | plenty | 많음 | plenties | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2733:기본:pliers:1 | pliers | 펜치 | plierses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2734:기본:plod:1 | plod | 터벅터벅 걷다 | plodding | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2734:기본:plod:1 | plod | 터벅터벅 걷다 | plodded | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2736:기본:plug:1 | plug | 플러그 | plugging | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2736:기본:plug:1 | plug | 플러그 | plugged | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2740:기본:plunge:1 | plunge | 갑자기 뛰어들다 | plunging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2742:기본:plus:1 | plus | 더하기 | pluses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2746:기본:poetry:1 | poetry | 시 | poetries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2748:기본:poison:1 | poison | 독 | poisonning | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2748:기본:poison:1 | poison | 독 | poisonned | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2750:기본:poke:1 | poke | 쿡 찌르다 | poking | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2752:기본:polish:1 | polish | 닦아 윤내다 | polishes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2758:기본:pollute:1 | pollute | 오염시키다 | polluting | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2762:기본:pony:1 | pony | 조랑말 | ponies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2766:기본:poppy:1 | poppy | 양귀비 | poppies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2769:기본:porch:1 | porch | 현관 앞 공간 | porches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2779:기본:possess:1 | possess | 소유하다 | possesses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2786:기본:postpone:1 | postpone | 미루다 | postponing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2788:기본:potato:1 | potato | 감자 | potatoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2791:기본:pottery:1 | pottery | 도자기 | potteries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2792:기본:pouch:1 | pouch | 작은 주머니 | pouches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2793:기본:pounce:1 | pounce | 갑자기 덮치다 | pouncing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2796:기본:poverty:1 | poverty | 가난 | poverties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2800:기본:practice:1 | practice | 연습하다 | practicing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2802:기본:praise:1 | praise | 칭찬하다 | praising | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2803:기본:prance:1 | prance | 껑충껑충 뛰다 | prancing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2811:기본:prefer:1 | prefer | 더 좋아하다 | preferring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2811:기본:prefer:1 | prefer | 더 좋아하다 | preferred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2812:기본:prefix:1 | prefix | 접두사 | prefixes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2813:기본:prepare:1 | prepare | 준비하다 | preparing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2817:기본:preserve:1 | preserve | 보존하다 | preserving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2832:기본:princess:1 | princess | 공주 | princesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2842:기본:process:1 | process | 과정 | processes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2842:기본:process:1 | process | 과정 | processes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2843:기본:prod:1 | prod | 쿡쿡 찌르다 | prodding | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2843:기본:prod:1 | prod | 쿡쿡 찌르다 | prodded | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2844:기본:produce:1 | produce | 생산하다 | producing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2850:기본:progress:1 | progress | 진전하다 | progresses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2850:기본:progress:1 | progress | 진전하다 | progresses | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2853:기본:promise:1 | promise | 약속하다 | promising | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2856:기본:pronounce:1 | pronounce | 발음하다 | pronouncing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2863:기본:property:1 | property | 재산 | properties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2869:기본:prove:1 | prove | 증명하다 | proving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2870:기본:provide:1 | provide | 제공하다 | providing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2874:기본:publish:1 | publish | 출판하다 | publishes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2882:기본:punch:1 | punch | 주먹으로 치다 | punches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2882:기본:punch:1 | punch | 주먹으로 치다 | punches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2884:기본:punish:1 | punish | 벌주다 | punishes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2888:기본:puppy:1 | puppy | 강아지 | puppies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2889:기본:purchase:1 | purchase | 구매 | purchasing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2894:기본:pursue:1 | pursue | 뒤쫓다 | pursuing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2895:기본:push:1 | push | 밀다 | pushes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2896:기본:put:1 | put | 놓다 | putting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2896:기본:put:1 | put | 놓다 | put | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | excluded | same-spelling |  |
| W2896:기본:put:1 | put | 놓다 | putted | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W2897:기본:puzzle:1 | puzzle | 어리둥절하게 하다 | puzzling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2902:기본:quality:1 | quality | 품질 | qualities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2903:기본:quantity:1 | quantity | 수량 | quantities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2904:기본:quarrel:1 | quarrel | 다투다 | quarrelling | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2904:기본:quarrel:1 | quarrel | 다투다 | quarrelled | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2905:기본:quaver:1 | quaver | 목소리가 떨리다 | quaverring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2905:기본:quaver:1 | quaver | 목소리가 떨리다 | quaverred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2916:기본:quiver:1 | quiver | 가늘게 떨다 | quiverring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2916:기본:quiver:1 | quiver | 가늘게 떨다 | quiverred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2917:기본:quiz:1 | quiz | 짧은 시험 | quizes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2919:기본:quote:1 | quote | 인용하다 | quoting | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2922:기본:race:1 | race | 경주하다 | racing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2925:기본:radio:1 | radio | 라디오 | radioes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2926:기본:radish:1 | radish | 무 | radishes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2927:기본:radius:1 | radius | 반지름 | radiuses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2939:기본:raise:1 | raise | 들어 올리다 | raising | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2941:기본:rake:1 | rake | 갈퀴 | raking | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2942:기본:ramble:1 | ramble | 장황하게 말하다 | rambling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2945:기본:ranch:1 | ranch | 목장 | ranches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2948:기본:rapids:1 | rapids | 급류 | rapidses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2951:기본:rash:1 | rash | 발진 | rashes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2952:기본:raspberry:1 | raspberry | 라즈베리 | raspberries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2956:기본:ratio:1 | ratio | 비율 | ratioes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2957:기본:rattle:1 | rattle | 달그락거리다 | rattling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2962:기본:reach:1 | reach | 도달하다 | reaches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2963:기본:read:1 | read | 읽다 | read | past | irregular | db | W2963:불규칙 과거형:read:1 | db-link-only | excluded | same-spelling |  |
| W2966:기본:realize:1 | realize | 깨닫다 | realizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2969:기본:reason:1 | reason | 추론하다 | reasonning | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2969:기본:reason:1 | reason | 추론하다 | reasonned | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W2971:기본:reassure:1 | reassure | 안심시키다 | reassuring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2974:기본:receive:1 | receive | 받다 | receiving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2977:기본:recess:1 | recess | 쉬는 시간 | recesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2979:기본:recognize:1 | recognize | 알아보다 | recognizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2983:기본:recover:1 | recover | 회복하다 | recoverring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2983:기본:recover:1 | recover | 회복하다 | recoverred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2984:기본:recovery:1 | recovery | 회복 | recoveries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2986:기본:recycle:1 | recycle | 재활용하다 | recycling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2988:기본:reduce:1 | reduce | 줄이다 | reducing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2990:기본:refer:1 | refer | 가리키다 | referring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2990:기본:refer:1 | refer | 가리키다 | referred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W2999:기본:refuse:1 | refuse | 거절하다 | refusing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3002:기본:regret:1 | regret | 후회하다 | regretting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3002:기본:regret:1 | regret | 후회하다 | regretted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3006:기본:rehearse:1 | rehearse | 예행연습하다 | rehearsing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3009:기본:relate:1 | relate | 관련시키다 | relating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3013:기본:relax:1 | relax | 긴장을 풀다 | relaxes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3014:기본:release:1 | release | 풀어주다 | releasing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3017:기본:relieve:1 | relieve | 고통·걱정을 덜어 주다 | relieving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3021:기본:rely:1 | rely | 믿고 의지하다 | relied | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3021:기본:rely:1 | rely | 믿고 의지하다 | relies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3025:기본:remember:1 | remember | 기억하다 | rememberring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3025:기본:remember:1 | remember | 기억하다 | rememberred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3028:기본:remove:1 | remove | 제거하다 | removing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3035:기본:repel:1 | repel | 밀어내다 | repelling | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3035:기본:repel:1 | repel | 밀어내다 | repelled | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3036:기본:replace:1 | replace | 바꾸다 | replacing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3037:기본:reply:1 | reply | 대답하다 | replied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3037:기본:reply:1 | reply | 대답하다 | replies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3037:기본:reply:1 | reply | 대답하다 | replies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3041:기본:reproduce:1 | reproduce | 번식하다 | reproducing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3045:기본:require:1 | require | 필요로 하다 | requiring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3046:기본:rescue:1 | rescue | 구조하다 | rescuing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3048:기본:research:1 | research | 연구 | researches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3048:기본:research:1 | research | 연구 | researches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3050:기본:resemble:1 | resemble | 닮다 | resembling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3053:기본:reserve:1 | reserve | 보호구역 | reserving | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3063:기본:responsibility:1 | responsibility | 책임 | responsibilities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3067:기본:restore:1 | restore | 복원하다 | restoring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3069:기본:resume:1 | resume | 다시 시작하다 | resuming | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3071:기본:retrace:1 | retrace | 왔던 길을 되짚어 가다 | retracing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3074:기본:reuse:1 | reuse | 다시 사용하다 | reusing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3077:기본:revise:1 | revise | 수정하다 | revising | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3079:기본:revolve:1 | revolve | 주위를 돌다 | revolving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3081:기본:rhinoceros:1 | rhinoceros | 코뿔소 | rhinoceroses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3082:기본:rhyme:1 | rhyme | 운 | rhyming | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3090:기본:ride:1 | ride | 타다 | riding | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3090:기본:ride:1 | ride | 타다 | rode | past | irregular | db | W3090:불규칙 과거형:rode:1 | db-link-only | included | db-linked-form |  |
| W3093:기본:ring:1 | ring | 울리다 | rang | past | irregular | db | W3093:불규칙 과거형:rang:1 | db-link-only | included | db-linked-form |  |
| W3095:기본:rip:1 | rip | 찢다 | ripping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3095:기본:rip:1 | rip | 찢다 | ripped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3097:기본:ripen:1 | ripen | 익다 | ripenning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3097:기본:ripen:1 | ripen | 익다 | ripenned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3098:기본:ripple:1 | ripple | 잔물결 | rippling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3099:기본:rise:1 | rise | 오르다 | rising | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3099:기본:rise:1 | rise | 오르다 | rose | past | irregular | db | W3099:불규칙 과거형:rose:1 | db-link-only | included | db-linked-form | W3125:기본:rose:1 |
| W3108:기본:rob:1 | rob | 빼앗다 | robbing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3108:기본:rob:1 | rob | 빼앗다 | robbed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3110:기본:robbery:1 | robbery | 강도 사건 | robberies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3126:기본:rotate:1 | rotate | 회전하다 | rotating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3137:기본:rub:1 | rub | 문지르다 | rubbing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3137:기본:rub:1 | rub | 문지르다 | rubbed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3139:기본:rubbish:1 | rubbish | 쓰레기 | rubbishes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3144:기본:rugby:1 | rugby | 럭비 | rugbies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3146:기본:rule:1 | rule | 규칙 | ruling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3148:기본:rumble:1 | rumble | 우르릉거리다 | rumbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3150:기본:run:1 | run | 달리다 | running | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3150:기본:run:1 | run | 달리다 | runned | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W3150:기본:run:1 | run | 달리다 | run | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | excluded | same-spelling |  |
| W3152:기본:rush:1 | rush | 급히 가다 | rushes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3153:기본:rustle:1 | rustle | 바스락거리다 | rustling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3156:기본:sacrifice:1 | sacrifice | 희생하다 | sacrificing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3159:기본:sadness:1 | sadness | 슬픔 | sadnesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3162:기본:safety:1 | safety | 안전 | safeties | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3173:기본:salute:1 | salute | 경례하다 | saluting | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3176:기본:sanctuary:1 | sanctuary | 보호구역 | sanctuaries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3179:기본:sandbox:1 | sandbox | 모래 놀이터 | sandboxes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3180:기본:sandwich:1 | sandwich | 샌드위치 | sandwiches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3187:기본:satisfy:1 | satisfy | 만족시키다 | satisfied | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3187:기본:satisfy:1 | satisfy | 만족시키다 | satisfies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3190:기본:saunter:1 | saunter | 느긋하게 걷다 | saunterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3190:기본:saunter:1 | saunter | 느긋하게 걷다 | saunterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3193:기본:save:1 | save | 구하다 | saving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3199:기본:scamper:1 | scamper | 날쌔게 뛰어다니다 | scamperring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3199:기본:scamper:1 | scamper | 날쌔게 뛰어다니다 | scamperred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3202:기본:scare:1 | scare | 겁주다 | scaring | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3203:기본:scarf:1 | scarf | 목도리 | scarves | plural | irregular | list | https://www.collinsdictionary.com/dictionary/english/scarf | external-dictionary | excluded | variant-unresolved |  |
| W3205:기본:scatter:1 | scatter | 흩뿌리다 | scatterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3205:기본:scatter:1 | scatter | 흩뿌리다 | scatterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3208:기본:schedule:1 | schedule | 시간표 | scheduling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3214:기본:scissors:1 | scissors | 가위 | scissorses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3218:기본:score:1 | score | 점수 | scoring | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3221:기본:scrabble:1 | scrabble | 손발을 허둥대며 움직이다 | scrabbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3222:기본:scramble:1 | scramble | 기어오르다 | scrambling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3223:기본:scrape:1 | scrape | 긁어내다 | scraping | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3224:기본:scratch:1 | scratch | 긁다 | scratches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3224:기본:scratch:1 | scratch | 긁다 | scratches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3226:기본:screech:1 | screech | 날카롭게 비명을 지르다 | screeches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3231:기본:scrub:1 | scrub | 문질러 씻다 | scrubbing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3231:기본:scrub:1 | scrub | 문질러 씻다 | scrubbed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3234:기본:scurry:1 | scurry | 종종걸음으로 급히 가다 | scurried | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3234:기본:scurry:1 | scurry | 종종걸음으로 급히 가다 | scurries | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3235:기본:scuttle:1 | scuttle | 급히 종종걸음 치다 | scuttling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3242:기본:search:1 | search | 찾다 | searches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3242:기본:search:1 | search | 찾다 | searches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3243:기본:season:1 | season | 계절 | seasonning | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3243:기본:season:1 | season | 계절 | seasonned | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3248:기본:secretary:1 | secretary | 비서 | secretaries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3252:기본:see:1 | see | 보다 | seing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3258:기본:seize:1 | seize | 붙잡다 | seizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3262:기본:selfishness:1 | selfishness | 이기심 | selfishnesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3270:기본:separate:1 | separate | 분리하다 | separating | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3273:기본:sequence:1 | sequence | 순서 | sequencing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3275:기본:serve:1 | serve | 음식을 내다 | serving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3277:기본:set:1 | set | 한 벌 | setting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos | W3278:기본:setting:1 |
| W3277:기본:set:1 | set | 한 벌 | setted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3279:기본:settle:1 | settle | 자리를 잡다 | settling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3286:기본:shake:1 | shake | 흔들다 | shaking | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3286:기본:shake:1 | shake | 흔들다 | shook | past | irregular | db | W3286:불규칙 과거형:shook:1 | db-link-only | included | db-linked-form |  |
| W3290:기본:shampoo:1 | shampoo | 샴푸 | shampooes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3291:기본:shape:1 | shape | 모양 | shaping | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3292:기본:share:1 | share | 나누다 | sharing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3297:기본:sheep:1 | sheep | 양 | sheep | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | excluded | same-spelling |  |
| W3301:기본:shelter:1 | shelter | 피신처 | shelterring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3301:기본:shelter:1 | shelter | 피신처 | shelterred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3303:기본:shine:1 | shine | 빛나다 | shining | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3305:기본:ship:1 | ship | 큰 배 | shipping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3305:기본:ship:1 | ship | 큰 배 | shipped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3307:기본:shiver:1 | shiver | 추위나 두려움에 떨다 | shiverring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3307:기본:shiver:1 | shiver | 추위나 두려움에 떨다 | shiverred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3311:기본:shoot:1 | shoot | 쏘다 | shot | past | irregular | db | W3311:불규칙 과거형:shot:1 | db-link-only | included | db-linked-form |  |
| W3312:기본:shop:1 | shop | 가게 | shopping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3312:기본:shop:1 | shop | 가게 | shopped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3316:기본:shorts:1 | shorts | 반바지 | shortses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3320:기본:shove:1 | shove | 거칠게 밀다 | shoving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3321:기본:shovel:1 | shovel | 삽으로 퍼내다 | shovelling | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3321:기본:shovel:1 | shovel | 삽으로 퍼내다 | shovelled | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3329:기본:shrug:1 | shrug | 어깨를 으쓱하다 | shrugging | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3329:기본:shrug:1 | shrug | 어깨를 으쓱하다 | shrugged | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3330:기본:shudder:1 | shudder | 몸서리치다 | shudderring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3330:기본:shudder:1 | shudder | 몸서리치다 | shudderred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3331:기본:shut:1 | shut | 닫다 | shutting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3331:기본:shut:1 | shut | 닫다 | shutted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3344:기본:signal:1 | signal | 신호 | signalling | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3344:기본:signal:1 | signal | 신호 | signalled | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3353:기본:similarity:1 | similarity | 비슷함 | similarities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3354:기본:simmer:1 | simmer | 약한 불로 끓이다 | simmerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3354:기본:simmer:1 | simmer | 약한 불로 끓이다 | simmerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3359:기본:sing:1 | sing | 노래하다 | sang | past | irregular | db | W3359:불규칙 과거형:sang:1 | db-link-only | included | db-linked-form |  |
| W3363:기본:sink:1 | sink | 가라앉다 | sank | past | irregular | db | W3363:불규칙 과거형:sank:1 | db-link-only | included | db-linked-form |  |
| W3364:기본:sip:1 | sip | 조금씩 홀짝이다 | sipping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3364:기본:sip:1 | sip | 조금씩 홀짝이다 | sipped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3367:기본:sit:1 | sit | 앉다 | sitted | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W3374:기본:skate:1 | skate | 스케이트 | skating | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3377:기본:sketch:1 | sketch | 스케치 | sketches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3377:기본:sketch:1 | sketch | 스케치 | sketches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3383:기본:skip:1 | skip | 깡충거리며 가다 | skipping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3383:기본:skip:1 | skip | 깡충거리며 가다 | skipped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3387:기본:sky:1 | sky | 하늘 | skies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3388:기본:slam:1 | slam | 쾅 닫다 | slamming | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3388:기본:slam:1 | slam | 쾅 닫다 | slammed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3389:기본:slap:1 | slap | 찰싹 때리다 | slapping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3389:기본:slap:1 | slap | 찰싹 때리다 | slapped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3392:기본:sleep:1 | sleep | 자다 | slept | past | irregular | db | W3392:불규칙 과거형:slept:1 | db-link-only | included | db-linked-form |  |
| W3397:기본:slice:1 | slice | 얇게 자르다 | slicing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3398:기본:slide:1 | slide | 미끄러지다 | sliding | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3401:기본:slip:1 | slip | 미끄러지다 | slipping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3401:기본:slip:1 | slip | 미끄러지다 | slipped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3404:기본:slither:1 | slither | 뱀처럼 미끄러지듯 가다 | slitherring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3404:기본:slither:1 | slither | 뱀처럼 미끄러지듯 가다 | slitherred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3414:기본:smash:1 | smash | 세게 부수다 | smashes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3417:기본:smile:1 | smile | 미소 짓다 | smiling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3418:기본:smoke:1 | smoke | 연기 | smoking | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3425:기본:snap:1 | snap | 뚝 부러지다 | snapping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3425:기본:snap:1 | snap | 뚝 부러지다 | snapped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3427:기본:snatch:1 | snatch | 낚아채다 | snatches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3431:기본:sneeze:1 | sneeze | 재채기하다 | sneezing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3432:기본:snicker:1 | snicker | 킬킬 웃다 | snickerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3432:기본:snicker:1 | snicker | 킬킬 웃다 | snickerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3434:기본:snore:1 | snore | 코를 골다 | snoring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3441:기본:snuggle:1 | snuggle | 아늑하게 파고들다 | snuggling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3445:기본:sob:1 | sob | 흐느껴 울다 | sobbing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3445:기본:sob:1 | sob | 흐느껴 울다 | sobbed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3448:기본:society:1 | society | 사회 | societies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3462:기본:solve:1 | solve | 해결하다 | solving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3464:기본:somebody:1 | somebody | 누군가 | somebodies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3473:기본:soothe:1 | soothe | 달래다 | soothing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3487:기본:spare:1 | spare | 여분의 | sparing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3489:기본:sparkle:1 | sparkle | 반짝거리다 | sparkling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3498:기본:species:1 | species | 종 | specieses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3508:기본:spin:1 | spin | 빙빙 돌다 | spinning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3508:기본:spin:1 | spin | 빙빙 돌다 | spinned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3509:기본:spinach:1 | spinach | 시금치 | spinaches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3513:기본:spit:1 | spit | 뱉다 | spitting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3513:기본:spit:1 | spit | 뱉다 | spitted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3514:기본:splash:1 | splash | 물을 튀기다 | splashes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3514:기본:splash:1 | splash | 물을 튀기다 | splashes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3517:기본:split:1 | split | 나누다 | splitting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3517:기본:split:1 | split | 나누다 | splitted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3523:기본:spot:1 | spot | 점 | spotting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3523:기본:spot:1 | spot | 점 | spotted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3528:기본:sprinkle:1 | sprinkle | 조금씩 뿌리다 | sprinkling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3532:기본:sputter:1 | sputter | 말을 더듬거리다 | sputterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3532:기본:sputter:1 | sputter | 말을 더듬거리다 | sputterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3533:기본:spy:1 | spy | 스파이 | spied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3533:기본:spy:1 | spy | 스파이 | spies | plural | y-ies | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | excluded | ambiguous-pos |  |
| W3533:기본:spy:1 | spy | 스파이 | spies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3534:기본:squabble:1 | squabble | 사소한 일로 다투다 | squabbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3536:기본:squash:1 | squash | 짓누르다 | squashes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3536:기본:squash:1 | squash | 짓누르다 | squashes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3540:기본:squeeze:1 | squeeze | 꼭 짜다 | squeezing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3545:기본:stab:1 | stab | 찌르다 | stabbing | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3545:기본:stab:1 | stab | 찌르다 | stabbed | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3550:기본:stagger:1 | stagger | 비틀거리며 걷다 | staggerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3550:기본:stagger:1 | stagger | 비틀거리며 걷다 | staggerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3556:기본:stammer:1 | stammer | 말을 더듬다 | stammerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3556:기본:stammer:1 | stammer | 말을 더듬다 | stammerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3562:기본:stare:1 | stare | 빤히 보다 | staring | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3563:기본:starfish:1 | starfish | 불가사리 | starfishes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3566:기본:startle:1 | startle | 깜짝 놀라게 하다 | startling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3567:기본:starve:1 | starve | 굶주리다 | starving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3568:기본:state:1 | state | 주 | stating | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3576:기본:steal:1 | steal | 훔치다 | stole | past | irregular | db | W3576:불규칙 과거형:stole:1 | db-link-only | included | db-linked-form |  |
| W3583:기본:step:1 | step | 발을 내딛다 | stepping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3583:기본:step:1 | step | 발을 내딛다 | stepped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3592:기본:stir:1 | stir | 휘젓다 | stirring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3592:기본:stir:1 | stir | 휘젓다 | stirred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3595:기본:stomach:1 | stomach | 위 | stomaches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3601:기본:stop:1 | stop | 멈추다 | stopping | ing | double | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | excluded | ambiguous-pos |  |
| W3601:기본:stop:1 | stop | 멈추다 | stopped | past | double | rule | https://learnenglishteens.britishcouncil.org/sites/teens/files/gs_past_simple_-_regular_verbs.pdf | external-educational | excluded | ambiguous-pos |  |
| W3602:기본:store:1 | store | 가게 | storing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3606:기본:story:1 | story | 이야기 | stories | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3612:기본:strangle:1 | strangle | 목을 조르다 | strangling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3614:기본:strategy:1 | strategy | 전략 | strategies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3615:기본:strawberry:1 | strawberry | 딸기 | strawberries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3619:기본:stretch:1 | stretch | 뻗다 | stretches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3621:기본:stride:1 | stride | 성큼성큼 걷다 | striding | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3624:기본:stroke:1 | stroke | 쓰다듬다 | stroking | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3628:기본:struggle:1 | struggle | 애쓰다 | struggling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3631:기본:study:1 | study | 공부하다 | studied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3631:기본:study:1 | study | 공부하다 | studies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3631:기본:study:1 | study | 공부하다 | studies | s3 | y-ies | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | excluded | ambiguous-pos |  |
| W3633:기본:stumble:1 | stumble | 비틀거리다 | stumbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3637:기본:stutter:1 | stutter | 말을 더듬다 | stutterring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3637:기본:stutter:1 | stutter | 말을 더듬다 | stutterred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3646:기본:success:1 | success | 성공 | successes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3652:기본:suffix:1 | suffix | 접미사 | suffixes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3653:기본:suffocate:1 | suffocate | 질식하다 | suffocating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3661:기본:summarize:1 | summarize | 요약하다 | summarizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3662:기본:summary:1 | summary | 요약 | summaries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3667:기본:sunglasses:1 | sunglasses | 선글라스 | sunglasseses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3676:기본:supply:1 | supply | 준비물 | supplied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3676:기본:supply:1 | supply | 준비물 | supplies | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3676:기본:supply:1 | supply | 준비물 | supplies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3678:기본:suppose:1 | suppose | 생각하다 | supposing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3684:기본:surgery:1 | surgery | 수술 | surgeries | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3685:기본:surprise:1 | surprise | 놀라게 하다 | surprising | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3686:기본:surrender:1 | surrender | 항복하다 | surrenderring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3686:기본:surrender:1 | surrender | 항복하다 | surrenderred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3690:기본:survive:1 | survive | 살아남다 | surviving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3696:기본:swagger:1 | swagger | 뽐내며 걷다 | swaggerring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3696:기본:swagger:1 | swagger | 뽐내며 걷다 | swaggerred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3707:기본:swerve:1 | swerve | 갑자기 방향을 틀다 | swerving | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3709:기본:swim:1 | swim | 수영하다 | swam | past | irregular | db | W3709:불규칙 과거형:swam:1 | db-link-only | included | db-linked-form |  |
| W3709:기본:swim:1 | swim | 수영하다 | swimmed | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W3711:기본:swish:1 | swish | 휙 움직이다 | swishes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3711:기본:swish:1 | swish | 휙 움직이다 | swishes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3712:기본:switch:1 | switch | 스위치 | switches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3712:기본:switch:1 | switch | 스위치 | switches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3716:기본:symbolize:1 | symbolize | 상징하다 | symbolizing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3717:기본:sympathy:1 | sympathy | 동정 | sympathies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3725:기본:tackle:1 | tackle | 문제를 다루다 | tackling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3727:기본:taekwondo:1 | taekwondo | 태권도 | taekwondoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3739:기본:tame:1 | tame | 길들여진 | taming | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3741:기본:tap:1 | tap | 가볍게 두드리다 | tapping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3741:기본:tap:1 | tap | 가볍게 두드리다 | tapped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3745:기본:taste:1 | taste | 맛보다 | tasting | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3749:기본:teach:1 | teach | 가르치다 | teaches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3754:기본:tease:1 | tease | 놀리다 | teasing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3755:기본:teddy:1 | teddy | 곰 인형 | teddies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3766:기본:tennis:1 | tennis | 테니스 | tennises | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3775:기본:terrify:1 | terrify | 몹시 겁주다 | terrified | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3775:기본:terrify:1 | terrify | 몹시 겁주다 | terrifies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3776:기본:territory:1 | territory | 영토 | territories | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3816:기본:threaten:1 | threaten | 위협하다 | threatenning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3816:기본:threaten:1 | threaten | 위협하다 | threatenned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3820:기본:throw:1 | throw | 던지다 | threw | past | irregular | db | W3820:불규칙 과거형:threw:1 | db-link-only | included | db-linked-form |  |
| W3822:기본:thud:1 | thud | 쿵 소리 나다 | thudding | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3822:기본:thud:1 | thud | 쿵 소리 나다 | thudded | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3830:기본:tickle:1 | tickle | 간지럽히다 | tickling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3832:기본:tidy:1 | tidy | 정돈된 | tidied | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3832:기본:tidy:1 | tidy | 정돈된 | tidies | s3 | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3833:기본:tie:1 | tie | 묶다 | tiing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3836:기본:tighten:1 | tighten | 조이다 | tightenning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3836:기본:tighten:1 | tighten | 조이다 | tightenned | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3838:기본:tights:1 | tights | 타이츠 | tightses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3842:기본:tinkle:1 | tinkle | 맑게 딸랑거리다 | tinkling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3845:기본:tiptoe:1 | tiptoe | 발끝으로 살금살금 걷다 | tiptoing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3846:기본:tire:1 | tire | 타이어 | tiring | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3860:기본:tolerate:1 | tolerate | 참다 | tolerating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3862:기본:tomato:1 | tomato | 토마토 | tomatoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3871:기본:toothbrush:1 | toothbrush | 칫솔 | toothbrushes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3875:기본:topple:1 | topple | 기울어 넘어지다 | toppling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3876:기본:torch:1 | torch | 횃불 | torches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3877:기본:tornado:1 | tornado | 토네이도 | tornadoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3879:기본:toss:1 | toss | 가볍게 던지다 | tosses | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3882:기본:touch:1 | touch | 만지다 | touches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3882:기본:touch:1 | touch | 만지다 | touches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3893:기본:trade:1 | trade | 거래 | trading | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3903:기본:transfer:1 | transfer | 옮기다 | transferring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3903:기본:transfer:1 | transfer | 옮기다 | transferred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3905:기본:translate:1 | translate | 번역하다 | translating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3910:기본:trap:1 | trap | 가두다 | trapping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3910:기본:trap:1 | trap | 가두다 | trapped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3911:기본:trash:1 | trash | 쓰레기 | trashes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3912:기본:travel:1 | travel | 여행하다 | travelling | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3912:기본:travel:1 | travel | 여행하다 | travelled | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3915:기본:treasure:1 | treasure | 보물 | treasuring | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3919:기본:trek:1 | trek | 힘든 길을 오래 걷다 | trekking | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3919:기본:trek:1 | trek | 힘든 길을 오래 걷다 | trekked | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3920:기본:tremble:1 | tremble | 몸을 떨다 | trembling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3925:기본:trickle:1 | trickle | 졸졸 흐르다 | trickling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3928:기본:trip:1 | trip | 발이 걸리다 | tripping | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3928:기본:trip:1 | trip | 발이 걸리다 | tripped | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3932:기본:trophy:1 | trophy | 우승컵 | trophies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3933:기본:trot:1 | trot | 종종걸음으로 달리다 | trotting | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3933:기본:trot:1 | trot | 종종걸음으로 달리다 | trotted | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3934:기본:trouble:1 | trouble | 곤란 | troubling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3935:기본:trousers:1 | trousers | 바지 | trouserses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3937:기본:trudge:1 | trudge | 힘겹게 터벅터벅 걷다 | trudging | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3945:기본:try:1 | try | 시도하다 | tries | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3947:기본:tug:1 | tug | 세게 잡아당기다 | tugging | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3947:기본:tug:1 | tug | 세게 잡아당기다 | tugged | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3949:기본:tumble:1 | tumble | 굴러 떨어지다 | tumbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3950:기본:tummy:1 | tummy | 배 | tummies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3953:기본:tune:1 | tune | 곡조 | tuning | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3967:기본:twinkle:1 | twinkle | 반짝반짝 빛나다 | twinkling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3970:기본:twitch:1 | twitch | 씰룩거리다 | twitches | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3972:기본:type:1 | type | 타자를 치다 | typing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W3981:기본:uncover:1 | uncover | 덮개를 벗기다 | uncoverring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3981:기본:uncover:1 | uncover | 덮개를 벗기다 | uncoverred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3984:기본:underline:1 | underline | 밑줄을 긋다 | underlining | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W3985:기본:underpass:1 | underpass | 지하도 | underpasses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4006:기본:university:1 | university | 대학교 | universities | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4021:기본:untie:1 | untie | 매듭을 풀다 | untiing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4025:기본:unwrap:1 | unwrap | 포장을 풀다 | unwrapping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4025:기본:unwrap:1 | unwrap | 포장을 풀다 | unwrapped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4030:기본:upset:1 | upset | 속상하게 하다 | upsetting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4030:기본:upset:1 | upset | 속상하게 하다 | upsetted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4031:기본:upstairs:1 | upstairs | 위층에 | upstairses | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4034:기본:use:1 | use | 사용하다 | using | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4045:기본:value:1 | value | 가치 | valuing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4048:기본:vanish:1 | vanish | 갑자기 사라지다 | vanishes | s3 | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4052:기본:vary:1 | vary | 다양하다 | varied | past | y-ied | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4052:기본:vary:1 | vary | 다양하다 | varies | s3 | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4058:기본:venture:1 | venture | 위험을 무릅쓰고 가다 | venturing | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4065:기본:vibrate:1 | vibrate | 떨리다 | vibrating | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4067:기본:victory:1 | victory | 승리 | victories | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4068:기본:video:1 | video | 영상 | videoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4079:기본:virus:1 | virus | 바이러스 | viruses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4082:기본:visit:1 | visit | 방문하다 | visitting | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4082:기본:visit:1 | visit | 방문하다 | visitted | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4086:기본:volcano:1 | volcano | 화산 | volcanoes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4091:기본:vote:1 | vote | 투표하다 | voting | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4095:기본:waddle:1 | waddle | 뒤뚱뒤뚱 걷다 | waddling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4102:기본:waitress:1 | waitress | 여자 식당 종업원 | waitresses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4103:기본:wake:1 | wake | 잠에서 깨다 | waking | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4106:기본:wallaby:1 | wallaby | 왈라비 | wallabies | plural | y-ies | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4109:기본:walrus:1 | walrus | 바다코끼리 | walruses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4111:기본:wander:1 | wander | 목적 없이 돌아다니다 | wanderring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4111:기본:wander:1 | wander | 목적 없이 돌아다니다 | wanderred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4120:기본:waste:1 | waste | 낭비 | wasting | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4121:기본:watch:1 | watch | 지켜보다 | watches | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4121:기본:watch:1 | watch | 지켜보다 | watches | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4122:기본:water:1 | water | 물을 주다 | waterring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4122:기본:water:1 | water | 물을 주다 | waterred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4125:기본:wave:1 | wave | 손을 흔들다 | waving | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4129:기본:weakness:1 | weakness | 약함 | weaknesses | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4148:기본:welcome:1 | welcome | 환영하다 | welcoming | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4171:기본:whimper:1 | whimper | 낑낑거리다 | whimperring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4171:기본:whimper:1 | whimper | 낑낑거리다 | whimperred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4172:기본:whine:1 | whine | 징징거리다 | whining | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4175:기본:whisper:1 | whisper | 속삭이다 | whisperring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4175:기본:whisper:1 | whisper | 속삭이다 | whisperred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4176:기본:whistle:1 | whistle | 휘파람 불다 | whistling | ing | e-drop | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4196:기본:win:1 | win | 이기다 | winning | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4196:기본:win:1 | win | 이기다 | winned | past | double | rule | regular-candidate | unverified | excluded | irregular-precedence |  |
| W4206:기본:wipe:1 | wipe | 닦다 | wiping | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4210:기본:wish:1 | wish | 바라다 | wishes | plural | es | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | excluded | ambiguous-pos |  |
| W4210:기본:wish:1 | wish | 바라다 | wishes | s3 | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4211:기본:witch:1 | witch | 마녀 | witches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4213:기본:wither:1 | wither | 말라 죽다 | witherring | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4213:기본:wither:1 | wither | 말라 죽다 | witherred | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4217:기본:wobble:1 | wobble | 흔들거리다 | wobbling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4221:기본:wonder:1 | wonder | 궁금해하다 | wonderring | ing | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4221:기본:wonder:1 | wonder | 궁금해하다 | wonderred | past | double | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4236:기본:worry:1 | worry | 걱정하다 | worried | past | y-ied | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4236:기본:worry:1 | worry | 걱정하다 | worries | plural | y-ies | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4236:기본:worry:1 | worry | 걱정하다 | worries | s3 | y-ies | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | excluded | ambiguous-pos |  |
| W4241:기본:wrap:1 | wrap | 싸다 | wrapping | ing | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4241:기본:wrap:1 | wrap | 싸다 | wrapped | past | double | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4242:기본:wrench:1 | wrench | 렌치 | wrenches | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4243:기본:wrestle:1 | wrestle | 레슬링하다 | wrestling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4244:기본:wriggle:1 | wriggle | 꿈틀거리다 | wriggling | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4247:기본:write:1 | write | 쓰다 | writing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4249:기본:writhe:1 | writhe | 고통으로 몸부림치다 | writhing | ing | e-drop | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W4276:기본:zero:1 | zero | 영 | zeroes | plural | es | rule | regular-candidate | unverified | excluded | ambiguous-pos |  |
| W4279:기본:zoo:1 | zoo | 동물원 | zooes | plural | es | rule | regular-candidate | unverified | excluded | external-evidence-unavailable |  |
| W0245:기본:baby:1 | baby | 아기 | babies | plural | y-ies | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W0480:기본:bus:1 | bus | 버스 | buses | plural | es | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W0491:기본:buzz:1 | buzz | 윙윙거리다 | buzzes | s3 | es | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | included | verified-form |  |
| W0551:기본:carry:1 | carry | 나르다 | carried | past | y-ied | rule | https://learnenglishteens.britishcouncil.org/sites/teens/files/gs_past_simple_-_regular_verbs.pdf | external-educational | included | verified-form |  |
| W0551:기본:carry:1 | carry | 나르다 | carries | s3 | y-ies | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | included | verified-form |  |
| W0560:기본:catch:1 | catch | 잡다 | catches | s3 | es | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | included | verified-form |  |
| W0663:기본:city:1 | city | 도시 | cities | plural | y-ies | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W0936:기본:daisy:1 | daisy | 데이지 | daisies | plural | y-ies | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W1408:기본:fix:1 | fix | 고치다 | fixes | s3 | es | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | included | verified-form |  |
| W1558:기본:get:1 | get | 얻다 | getting | ing | double | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | included | verified-form |  |
| W1584:기본:go:1 | go | 가다 | goes | s3 | es | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | included | verified-form |  |
| W1704:기본:have:1 | have | 가지다 | having | ing | e-drop | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | included | verified-form |  |
| W2185:기본:make:1 | make | 만들다 | making | ing | e-drop | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | included | verified-form |  |
| W2208:기본:marry:1 | marry | 결혼하다 | marries | s3 | y-ies | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | included | verified-form |  |
| W2651:기본:penny:1 | penny | 작은 화폐 단위 | pennies | plural | y-ies | rule | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W3367:기본:sit:1 | sit | 앉다 | sitting | ing | double | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | included | verified-form |  |
| W3709:기본:swim:1 | swim | 수영하다 | swimming | ing | double | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | included | verified-form |  |
| W3730:기본:take:1 | take | 가지고 가다 | taking | ing | e-drop | rule | https://www.grammar.cl/Notes/Spelling_ING.htm | external-educational | included | verified-form |  |
| W3945:기본:try:1 | try | 시도하다 | tried | past | y-ied | rule | https://learnenglishteens.britishcouncil.org/sites/teens/files/gs_past_simple_-_regular_verbs.pdf | external-educational | included | verified-form |  |
| W4118:기본:wash:1 | wash | 씻다 | washes | s3 | es | rule | https://www.grammar.cl/Present/Simple.htm | external-educational | included | verified-form |  |
| W0296:기본:be:1 | be | ~이다 | was | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0296:기본:be:1 | be | ~이다 | were | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0296:기본:be:1 | be | ~이다 | been | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0319:기본:begin:1 | begin | 시작하다 | began | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0319:기본:begin:1 | begin | 시작하다 | begun | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0426:기본:break:1 | break | 깨다 | broke | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0426:기본:break:1 | break | 깨다 | broken | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0440:기본:bring:1 | bring | 가져오다 | brought | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0459:기본:build:1 | build | 짓다 | built | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0490:기본:buy:1 | buy | 사다 | bought | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0506:기본:calf:1 | calf | 송아지 | calves | plural | irregular | list | https://www.collinsdictionary.com/dictionary/english/calf | external-dictionary | included | verified-form |  |
| W0633:기본:child:1 | child | 아이 | children | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W0647:기본:choose:1 | choose | 선택하다 | chose | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0647:기본:choose:1 | choose | 선택하다 | chosen | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W0737:기본:come:1 | come | 오다 | came | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1089:기본:do:1 | do | 하다 | did | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1089:기본:do:1 | do | 하다 | done | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1122:기본:draw:1 | draw | 그리다 | drew | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1122:기본:draw:1 | draw | 그리다 | drawn | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1132:기본:drive:1 | drive | 운전하다 | drove | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1132:기본:drive:1 | drive | 운전하다 | driven | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1171:기본:eat:1 | eat | 먹다 | ate | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1171:기본:eat:1 | eat | 먹다 | eaten | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1200:기본:elf:1 | elf | 꼬마 요정 | elves | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W1366:기본:feel:1 | feel | 느끼다 | felt | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1392:기본:find:1 | find | 찾다 | found | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1453:기본:foot:1 | foot | 발 | feet | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W1558:기본:get:1 | get | 얻다 | got | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1567:기본:give:1 | give | 주다 | gave | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1567:기본:give:1 | give | 주다 | given | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1584:기본:go:1 | go | 가다 | went | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1584:기본:go:1 | go | 가다 | gone | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1597:기본:goose:1 | goose | 거위 | geese | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W1704:기본:have:1 | have | 가지다 | had | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1716:기본:hear:1 | hear | 듣다 | heard | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1767:기본:hold:1 | hold | 잡고 있다 | held | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W1985:기본:keep:1 | keep | 계속하다 | kept | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2010:기본:knife:1 | knife | 칼 | knives | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W2013:기본:know:1 | know | 알다 | knew | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2013:기본:know:1 | know | 알다 | known | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2053:기본:lead:1 | lead | 이끌다 | led | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2055:기본:leaf:1 | leaf | 잎 | leaves | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W2062:기본:leave:1 | leave | 떠나다 | left | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form | W2064:기본:left:1 |
| W2088:기본:life:1 | life | 생명 | lives | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W2141:기본:lose:1 | lose | 잃어버리다 | lost | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2185:기본:make:1 | make | 만들다 | made | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2189:기본:man:1 | man | 남자 | men | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W2235:기본:mean:1 | mean | 뜻하다 | meant | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2246:기본:meet:1 | meet | 만나다 | met | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2346:기본:mouse:1 | mouse | 생쥐 | mice | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W2558:기본:ox:1 | ox | 황소 | oxen | plural | irregular | list | https://www.collinsdictionary.com/dictionary/english/ox | external-dictionary | included | verified-form |  |
| W2626:기본:pay:1 | pay | 지불하다 | paid | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W2669:기본:person:1 | person | 사람 | people | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W3150:기본:run:1 | run | 달리다 | ran | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3196:기본:say:1 | say | 말하다 | said | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3252:기본:see:1 | see | 보다 | saw | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form | W3194:기본:saw:1 |
| W3252:기본:see:1 | see | 보다 | seen | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3263:기본:sell:1 | sell | 팔다 | sold | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3265:기본:send:1 | send | 보내다 | sent | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3299:기본:shelf:1 | shelf | 선반 | shelves | plural | irregular | list | https://www.collinsdictionary.com/dictionary/english/shelf | external-dictionary | included | verified-form |  |
| W3367:기본:sit:1 | sit | 앉다 | sat | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3494:기본:speak:1 | speak | 말하다 | spoke | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3494:기본:speak:1 | speak | 말하다 | spoken | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3503:기본:spend:1 | spend | 쓰다 | spent | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3558:기본:stand:1 | stand | 서다 | stood | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3730:기본:take:1 | take | 가지고 가다 | took | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3730:기본:take:1 | take | 가지고 가다 | taken | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3749:기본:teach:1 | teach | 가르치다 | taught | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3759:기본:tell:1 | tell | 말해 주다 | told | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3798:기본:thief:1 | thief | 도둑 | thieves | plural | irregular | list | https://www.collinsdictionary.com/dictionary/english/thief | external-dictionary | included | verified-form |  |
| W3802:기본:think:1 | think | 생각하다 | thought | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W3869:기본:tooth:1 | tooth | 이 | teeth | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W3986:기본:understand:1 | understand | 이해하다 | understood | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W4132:기본:wear:1 | wear | 입고 있다 | wore | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W4132:기본:wear:1 | wear | 입고 있다 | worn | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W4188:기본:wife:1 | wife | 아내 | wives | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W4196:기본:win:1 | win | 이기다 | won | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W4218:기본:wolf:1 | wolf | 늑대 | wolves | plural | irregular | list | https://www.collinsdictionary.com/dictionary/english/wolf | external-dictionary | included | verified-form |  |
| W4219:기본:woman:1 | woman | 여자 | women | plural | irregular | list | https://www.ef.com/wwen/english-resources/english-grammar/singular-and-plural-nouns/ | external-educational | included | verified-form |  |
| W4247:기본:write:1 | write | 쓰다 | wrote | past | irregular | db | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
| W4247:기본:write:1 | write | 쓰다 | written | pp | irregular | list | https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs | external-educational | included | verified-form |  |
