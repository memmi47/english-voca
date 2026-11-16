// Scenario sets for tools/sim_learning.mjs (--set name). Each row: { name, opt } where opt goes to simulate().
// OLD  = the rules before the study (one monster a day, 8 reviews in a tile run, the bat only counts new words, oldest due first)
// GAME = the rules chosen from it, as shipped in cards/js/map.js (RULES) and cards/js/deck.js (CFG.dueOrder)
const U = { monsterPerDay: 99 }, A = { tileDueShare: 0.1, tileDueMax: 20 };
const D = (k) => ({ batOverdue: k });
export const CHOSEN = { ...U, tileDueShare: 0.5, tileDueMax: 20, ...D(1) };
const OLD = { rules: {}, dueOrder: 'oldest' }, GAME = { rules: CHOSEN, dueOrder: 'recent' };
const child = (c, o = {}) => ({ child: c, pMonster: 0.5, ...o });
const kids = (base, extra = {}) => ['bear', 'base', 'bull'].flatMap((c) => [0.1, 0.5, 0.9].map((p) => ({ name: `${c} · 몬스터 ${p * 100}%`, opt: child(c, { pMonster: p, ...base, ...extra }) })));
const VARIANTS = [
  ['예전 규칙', {}], ['몬스터 무제한', U], ['칸 복습 확대(밀린 복습의 10%, 최대 20장)', A], ['몬스터 무제한+칸 복습 확대', { ...U, ...A }],
  ['빚 박쥐: 밀린 복습이 용량의 2배', D(2)], ['빚 박쥐: 용량의 1배', D(1)], ['빚 박쥐: 용량의 0.5배', D(0.5)],
  ['셋 다 + 빚 2배', { ...U, ...A, ...D(2) }], ['셋 다 + 빚 1배', { ...U, ...A, ...D(1) }], ['셋 다 + 빚 0.5배', { ...U, ...A, ...D(0.5) }],
  ['정한 규칙(칸 복습 50%·20장, 무제한, 빚 1배)', CHOSEN],
];
export default {
  // 1. the old rules, by child profile and by how often the optional monster is taken
  old: [{ title: '예전 규칙: 아이 유형과 행동별', rows: kids(OLD) }],
  // 2. one lever at a time, base child: one who takes half of the offered monsters, one who almost never does
  rules: [0.5, 0.1].map((p) => ({ title: `규칙 비교 (base, 몬스터 ${p * 100}%, 오래된 것 먼저)`, rows: VARIANTS.map(([name, rules]) => ({ name, opt: child('base', { pMonster: p, rules, dueOrder: 'oldest' }) })) })),
  // 3. fine choice of the tile-run review share and its upper bound
  tune: [0.5, 0.1].map((p) => ({ title: `칸 복습 조정 (base, 몬스터 ${p * 100}%)`, rows: [[0.5, 16], [0.5, 20], [0.5, 24], [0.5, 30], [1, 20], [1, 30]].flatMap(([sh, mx]) => [1, 0.5].map((k) =>
    ({ name: `${sh * 100}%·${mx}장, 빚 ${k}배`, opt: child('base', { pMonster: p, rules: { ...U, tileDueShare: sh, tileDueMax: mx, ...D(k) }, dueOrder: 'oldest' }) }))) })),
  // 4. the chosen rules: every profile and behaviour, then the continent castle odds on arrival for the same runs
  chosen: [{ title: '정한 규칙: 아이 유형과 행동별', rows: kids(GAME) }, { title: '정한 규칙: 대륙 성에 처음 도착했을 때의 정답률과 기준별 통과 확률', cols: 'cont', rows: kids(GAME) }],
  // 5. D4 (what a missed review does) and the order in which due cards are taken
  d4: ['base', 'bear'].flatMap((c) => [0.5, 0.1].map((p) => ({ title: `D4와 복습 순서 (${c}, 몬스터 ${p * 100}%)`, rows: ['reset', 'stepback'].flatMap((lapse) => ['oldest', 'recent', 'mixed'].map((dueOrder) =>
    ({ name: `${lapse === 'reset' ? '처음으로' : '한 단계 아래'} · ${{ oldest: '오래된 것 먼저', recent: '최근 것 먼저', mixed: '번갈아' }[dueOrder]}`, opt: child(c, { pMonster: p, rules: CHOSEN, lapse, dueOrder }) }))) }))),
  // 6. the continent castle really played at each threshold; the last rows are the old rules
  gate: [{ title: '대륙 성 기준별 실제 진행 (40장)', cols: 'gate', rows: [...['bear', 'base'].flatMap((c) => [0.1, 0.5].flatMap((p) => [0.7, 0.75, 0.8].map((g) => ({ name: `${c} · 몬스터 ${p * 100}% · 기준 ${g * 100}%`, opt: child(c, { pMonster: p, ...GAME, contPass: g }) })))),
    ...[0.7, 0.75, 0.8].map((g) => ({ name: `예전 규칙 base · 몬스터 50% · 기준 ${g * 100}%`, opt: child('base', { ...OLD, contPass: g }) }))] }],
  // 7. how much the conclusions move with the assumptions (base child, half of the monsters, chosen rules)
  sens: [{ title: '가정 민감도 (base, 몬스터 50%, 정한 규칙)', rows: [
    ['기준', {}], ['하루 새 단어 부담 없음(loadK 0)', { childOver: { loadK: 0 } }], ['하루 새 단어 부담 2배(loadK 1)', { childOver: { loadK: 1 } }], ['하루 10분', { childOver: { minutes: 10 } }], ['하루 25분', { childOver: { minutes: 25 } }],
    ['주 4일', { childOver: { days: 4 } }], ['칸 6단어', { tileSize: 6 }], ['칸 8단어', { tileSize: 8 }], ['박쥐 시험 15장', { bat: { test: 15 } }], ['박쥐 시험 40장', { bat: { test: 40 } }], ['거짓 "알아요" 30%', { childOver: { falseClaim: 0.3 } }],
    ['빚 기준을 처음 용량(40)에 고정', { rules: { ...CHOSEN, batDebtFixed: true } }], ['첫 기억이 절반(S0 3.1)', { childOver: { S0: 3.1 } }],
  ].map(([name, o]) => ({ name, opt: child('base', { ...GAME, ...o }) })) }],
};
