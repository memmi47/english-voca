// Flashcard prototype (cards/): deck rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Run, newState, planRun, gradeOf, gradeCounts, verifyRate, addDays, mulberry32, CFG, INTERVALS, bunchLeft } from '../cards/js/deck.js';
import { reviewPrompt } from '../cards/js/study_prompts.js';
import { ensureMap, settleRun, chooseBag, takeBag, dueCount, overdueCount, batState, tileDue, Lightning, settleLightning, batPool, MONSTER_AT, ITEMS, BAT, RULES, TRIAGE, triagePlan, triageScope, auditPick, setHardness, checkPick } from '../cards/js/map.js';
import { indexWorlds, worldView, atlasView, currentWorld, nodeRun, finaleRun, settleWorld, enterWorld, stampGame, worldWords, worldOpen, reach, crowned, FINALE, setLeftOutKinds, leftOutKinds, startTile, sortView, sortPage, FINAL, finishCastle, finishFinale, examPending } from '../cards/js/world.js';
// The castle word games (FINAL, docs/MINIGAMES.md 7) are tested in their own section (CF*); the older castle tests pass on the exam alone.
FINAL.on = false;

// The demo set: 86 cards (80 with a Korean gloss, 6 function words), two continents, three worlds (tools/make_cards_demo.py).
const WORDS = JSON.parse(fs.readFileSync('cards/data/demo/catalog.json', 'utf8')).words; const DOC = JSON.parse(fs.readFileSync('cards/data/demo/worlds.json', 'utf8'));
const IX = indexWorlds(DOC); const W1 = IX.byId['d1-01'], W2 = IX.byId['d1-02'], W3 = IX.byId['d2-01'];
const D1 = '2026-11-12';
const mk = (state, today = D1, opt = {}) => new Run({ state, words: WORDS, today, rng: opt.rng || mulberry32(opt.seed || 1), now: opt.now, cfg: { ...CFG, ...(opt.cfg || {}) } });
// Plays a run. knows(id) -> does the child really know the word; claim(id) -> what the child says on a judge card.
function play(run, knows, claim = knows) {
  const seen = []; let guard = 0;
  while (run.current && guard++ < 500) {
    const it = run.show(); seen.push({ ...it });
    let res = it.form === 'judge' ? run.judge(it.role === 'relearn' || it.role === 'practice' ? true : claim(it.id)) : null;
    if (!res || res.next === 'verify') {
      const idx = it.options.findIndex((o) => o.id === it.id);
      const really = it.role === 'relearn' || knows(it.id);
      res = run.pick(really ? idx : (idx + 1) % 3);
    }
    run.advance();
  }
  assert.ok(guard < 500); return seen;
}

test('C022 R1: comparison rejects overlapping glosses in both directions and excludes hear/listen', () => {
  const prompt = (a, b, koA, koB) => {
    const left = { id: a, form: a, ko: koA };
    const right = { id: b, form: b, ko: koB };
    return reviewPrompt({ id: a, form: 'check', role: 'review', options: [left, right, { id: 'other', ko: '집' }] }, {
      byId: { [a]: left, [b]: right }, byForm: new Map([[a, left], [b, right]]),
      words: { [b]: {} }, turn: 0, slot: 1, allowReverse: false,
    });
  };
  assert.equal(prompt('ship', 'sheep', '큰 배', '양')?.type, 'similar-words');
  assert.equal(prompt('ship', 'sheep', '큰 배', '커다란 큰배'), null);
  assert.equal(prompt('sheep', 'ship', '커다란 큰배', '큰 배'), null);
  assert.equal(prompt('ship', 'sheep', '큰 배', '큰배'), null);
  assert.equal(prompt('hear', 'listen', '들리다', '귀 기울이다'), null);
  assert.equal(prompt('listen', 'hear', '귀 기울이다', '들리다'), null);
});

test('C022 F1: new formats also ride on village, sample and retry checks; never on castle, bat, practice or self-judged cards', () => {
  const bread = { id: 'bread', form: 'bread', ko: '빵', pos: '명사' }, cake = { id: 'cake', form: 'cake', ko: '케이크', pos: '명사' }, milk = { id: 'milk', form: 'milk', ko: '우유', pos: '명사' };
  const ask = (role, form = 'check') => reviewPrompt({ id: 'bread', form, role, options: [bread, cake, milk] }, {
    byId: { bread, cake, milk }, byForm: new Map(), words: {}, turn: 0, slot: 0, allowReverse: true })?.type ?? null;
  for (const role of ['review', 'likely', 'spot', 'audit', 'retry']) assert.equal(ask(role), 'meaning-to-word', role);
  for (const role of ['castle', 'practice', 'new', 'relearn']) assert.equal(ask(role), null, role);
  assert.equal(ask('review', 'judge'), null);
});

test('C022 R4: WORKLOG section 3 first rule records the approved prompt exception', () => {
  const worklog = fs.readFileSync(new URL('../docs/WORKLOG.md', import.meta.url), 'utf8');
  assert.match(worklog, /^## 3\. [^\r\n]+\r?\n\r?\n- 답을 먼저 보여 주지 않는다\.[^\r\n]*사용자가 승인한 C-022 예외로 뜻→영어와 문장 속 뜻 형식은 각각 뜻과 문장을 먼저 보이며, 발음은 답을 고른 뒤에 들려준다\./m);
});

test('K1: deck has 86 cards with unique ids; 80 have a Korean gloss of their own, 6 are function words without one', () => {
  assert.equal(WORDS.length, 86); assert.equal(new Set(WORDS.map((w) => w.id)).size, 86); const vocab = WORDS.filter((w) => w.ko);
  assert.equal(vocab.length, 80); assert.equal(new Set(vocab.map((w) => w.ko)).size, 80); assert.ok(WORDS.every((w) => /^[a-z]+$/.test(w.form)));
  assert.ok(WORDS.filter((w) => !w.ko).every((w) => w.track === 'sight' && w.ipa));
});

test('K2: a first run draws 7 new words; the queue starts with a judge card and no answer is shown first', () => {
  const s = newState('son'); const run = mk(s);
  assert.equal(run.queue.length, 7); assert.ok(run.queue.every((q) => q.role === 'new' && q.form === 'judge'));
  assert.equal(run.show().options, undefined);
});

test('K3: "know" at first sight -> likely (silver), checked again after 7 and then 30 days, then gold', () => {
  const s = newState('son'); play(mk(s), () => true);
  const ids = WORDS.slice(0, 7).map((w) => w.id);
  for (const id of ids) { assert.equal(s.words[id].st, 'likely'); assert.equal(s.words[id].due, addDays(D1, 7)); assert.equal(gradeOf(s.words[id]), 2); }
  assert.equal(planRun(s, WORDS, addDays(D1, 6)).due.length, 0);
  const d8 = addDays(D1, 7); const r2 = mk(s, d8, { cfg: { newPerRun: 0 } });
  assert.ok(r2.queue.every((q) => q.role === 'likely' && q.form === 'check'));   // never self-judgement at this stage
  play(r2, () => true);
  for (const id of ids) assert.equal(s.words[id].due, addDays(d8, 30));
  play(mk(s, addDays(d8, 30), { cfg: { newPerRun: 0 } }), () => true);
  for (const id of ids) assert.equal(s.words[id].st, 'done');
  assert.equal(gradeCounts(s, WORDS)[3], 7);
});

test('K4: "don\'t know" -> shown again 3 cards later, again, and as a check at the end; passing puts it on the 1-day review', () => {
  const s = newState('son'); const run = mk(s, D1, { cfg: { newPerRun: 14 } }); const first = run.queue[0].id;
  const seen = play(run, (id) => id !== first);
  const idx = seen.map((x, i) => (x.id === first ? i : -1)).filter((i) => i >= 0);
  assert.equal(idx.length, 4); assert.equal(idx[1] - idx[0], 4);                 // 3 other cards in between
  assert.ok(idx[2] - idx[1] >= 3); assert.equal(idx[3], seen.length - 1);
  assert.equal(seen[idx[3]].form, 'check'); assert.equal(seen[idx[3]].final, true);
  // in a short run the later appearances merge, but the last one is still the check
  const s7 = newState('son'); const short = mk(s7); const f7 = short.queue[0].id; const seen7 = play(short, (id) => id !== f7);
  const i7 = seen7.filter((x) => x.id === f7); assert.equal(i7.length, 3); assert.equal(i7[2].final, true);
  assert.deepEqual([s.words[first].st, s.words[first].step, s.words[first].due], ['review', 0, addDays(D1, 1)]);
  assert.equal(gradeOf(s.words[first]), 1);
  assert.equal(run.stats.unknown, 1); assert.equal(run.stats.learned, 1);
});

test('K5: reviews follow 1, 3, 7, 14, 30 days; from the 7-day step they are check cards; then gold', () => {
  const s = newState('son'); const id = WORDS[0].id; let day = D1;
  s.words[id] = { st: 'review', step: 0, due: D1, firstDay: D1, lastDay: '2026-11-11', lapses: 0 };
  const forms = [];
  for (let k = 0; k < 5; k++) {
    const run = mk(s, day, { cfg: { newPerRun: 0 } }); forms.push(run.queue[0].form); play(run, () => true);
    if (k < 4) { assert.equal(s.words[id].step, k + 1); assert.equal(s.words[id].due, addDays(day, INTERVALS[k + 1])); day = s.words[id].due; }
  }
  assert.deepEqual(forms, ['judge', 'judge', 'check', 'check', 'check']); assert.equal(s.words[id].st, 'done');
});

test('K6: a missed review resets to step 0 (current rule) or drops one step (option); it is practised again in the run', () => {
  for (const [lapse, want] of [['reset', 0], ['stepback', 2]]) {
    const s = newState('son'); const id = WORDS[0].id;
    s.words[id] = { st: 'review', step: 3, due: D1, firstDay: '2026-11-01', lastDay: '2026-11-05', lapses: 0 };
    const run = mk(s, D1, { cfg: { newPerRun: 3, lapse } }); const seen = play(run, (x) => x !== id);
    assert.deepEqual([s.words[id].step, s.words[id].due, s.words[id].lapses], [want, addDays(D1, 1), 1]);
    assert.ok(seen.some((x) => x.id === id && x.role === 'practice'));
  }
});

test('K7: the same card is scored at most once a day', () => {
  const s = newState('son'); play(mk(s), () => false);
  const again = planRun(s, WORDS, D1);
  assert.ok(again.news.every((id) => !s.words[id]));                             // the second run of the day draws other words
  const tomorrow = planRun(s, WORDS, addDays(D1, 1));
  assert.equal(tomorrow.due.length, 7);
});

test('K8: a false "know" is caught by verification: combo resets, no damage, word becomes a learning word', () => {
  const s = newState('son'); const run = mk(s, D1, { rng: () => 0 });           // rng 0 -> every claim is verified
  run.show(); run.judge(true); run.pick(run.current.options.findIndex((o) => o.id === run.current.id)); run.advance();
  assert.equal(run.combo, 1);
  const it = run.show(); const v = run.judge(true); assert.equal(v.next, 'verify'); assert.equal(v.options.length, 3);
  const wrong = (it.options.findIndex((o) => o.id === it.id) + 1) % 3; const res = run.pick(wrong);
  assert.deepEqual([res.ok, res.dmg, res.combo], [false, 0, 0]);
  assert.equal(s.words[it.id].st, 'learn'); assert.deepEqual(s.verify, [true, false]);
  // an honest "몰라요" keeps the combo
  run.advance(); const before = run.combo; run.show(); const r2 = run.judge(false); assert.equal(r2.combo, before);
});

test('K9: verification rate adapts: 1/3 at start, 1/6 when honest, every time when claims fail', () => {
  const s = newState('son'); assert.equal(verifyRate(s), 1 / 3);
  s.verify = Array(10).fill(true); assert.equal(verifyRate(s), 1 / 6);
  s.verify = [true, false, false, true]; assert.equal(verifyRate(s), 1);
});

test('K10: verified answers hit harder than unverified ones; bosses fall and carry over', () => {
  const s = newState('son'); const run = mk(s, D1, { rng: () => 0, cfg: { newPerRun: 7, bossHp: 5 } });
  play(run, () => true);
  assert.equal(run.stats.verifies, 7); assert.ok(run.stats.bosses >= 4, 'bosses=' + run.stats.bosses);   // 3+3+3+3+4+4+4 = 24 damage / 5 hp
  const s2 = newState('son'); const soft = mk(s2, D1, { rng: () => 0.99, cfg: { newPerRun: 7, bossHp: 5 } }); play(soft, () => true);
  assert.equal(soft.stats.verifies, 0); assert.ok(soft.stats.bosses < run.stats.bosses);
});

test('K11: a word not learned today returns tomorrow as a check card, and passing it gives bronze, not silver', () => {
  const s = newState('son'); const run = mk(s, D1, { cfg: { newPerRun: 1 } }); const id = run.queue[0].id;
  run.show(); run.judge(false); run.advance();                                   // single card: the re-check comes right away
  const it = run.show(); assert.equal(it.final, true); run.pick((it.options.findIndex((o) => o.id === id) + 1) % 3); run.advance();
  assert.deepEqual([s.words[id].st, s.words[id].due], ['learn', addDays(D1, 1)]);
  const r2 = mk(s, addDays(D1, 1), { cfg: { newPerRun: 1 } });
  assert.deepEqual([r2.queue[0].id, r2.queue[0].role, r2.queue[0].form], [id, 'retry', 'check']);
  play(r2, () => true);
  assert.deepEqual([s.words[id].st, s.words[id].step, gradeOf(s.words[id])], ['review', 0, 1]);
});

test('K12: run record keeps the numbers the gate needs (cards, time, claims, verification accuracy)', () => {
  let t = 0; const s = newState('son'); const run = mk(s, D1, { now: () => (t += 2000) });
  play(run, (id) => WORDS.findIndex((w) => w.id === id) % 2 === 0);
  const rec = run.finish();
  assert.equal(s.runs.length, 1); assert.equal(rec.n, 1); assert.equal(rec.cards, run.queue.length);
  assert.ok(rec.ms > 0 && rec.fresh === 7 && rec.known + rec.unknown === 7);
  assert.ok(s.log.every((e) => e.day === D1 && typeof e.ms === 'number'));
});

// ---- deck rules found while scaling to the full deck ----
test('K13: a word that was not learned comes back even after its tile is cleared (in other tile runs and in review runs)', () => {
  const s = newState('son'); const [t1, t2] = [W1._nodes.A1, W1._nodes.B1];
  for (const id of t1.words) s.words[id] = { st: 'review', step: 0, due: '2026-11-20', lastDay: D1, firstDay: D1, lapses: 0 };
  const stuck = t1.words[0]; s.words[stuck] = { st: 'learn', due: addDays(D1, 1), lastDay: D1, firstDay: D1, lapses: 0 };
  const d = addDays(D1, 1);
  const other = new Run({ state: s, words: WORDS, today: d, rng: mulberry32(1), scope: { newIds: t2.words, newPerRun: 10, duePerRun: 8 } });
  const it = other.queue.find((q) => q.id === stuck); assert.deepEqual([it.role, it.form], ['retry', 'check']);
  const mon = new Run({ state: s, words: WORDS, today: d, rng: mulberry32(1), scope: { noNew: true, duePerRun: 14 } });
  assert.ok(mon.queue.some((q) => q.id === stuck && q.role === 'retry'));
  const many = newState('son'); for (const w of WORDS.slice(0, 9)) many.words[w.id] = { st: 'learn', due: D1, lastDay: '2026-11-01', firstDay: '2026-11-01', lapses: 0 };
  assert.equal(planRun(many, WORDS, D1, CFG, { newIds: t2.words }).retries.length, CFG.retryPerRun);   // a few per run, not all at once
});

test('K14: when more cards are due than a run takes, the latest due dates go first (the bat test takes the oldest)', () => {
  const s = newState('son'); const ids = WORDS.slice(0, 6).map((w) => w.id);
  ids.forEach((id, i) => { s.words[id] = { st: 'review', step: 1, due: addDays(D1, -10 + i), lastDay: '2026-10-01', firstDay: '2026-10-01', lapses: 0 }; });
  assert.equal(CFG.dueOrder, 'recent');
  assert.deepEqual(planRun(s, WORDS, D1, CFG, { duePerRun: 2 }).due, [ids[5], ids[4]]);
  assert.deepEqual(planRun(s, WORDS, D1, { ...CFG, dueOrder: 'oldest' }, { duePerRun: 2 }).due, [ids[0], ids[1]]);
  assert.deepEqual(planRun(s, WORDS, D1, { ...CFG, dueOrder: 'mixed' }, { duePerRun: 3 }).due, [ids[0], ids[5], ids[1]]);
  assert.deepEqual(batPool(s, D1).due.slice(0, 2), [ids[0], ids[1]]);
});

test('K15: a check card offers three different choices, the right one among them, never a function word for a meaning', () => {
  const s = newState('son'); const run = mk(s, D1, { seed: 5 });
  for (const w of WORDS.filter((x) => x.ko)) { const o = run._options(w.id); assert.equal(o.length, 3); assert.equal(new Set(o.map((x) => x.ko)).size, 3); assert.ok(o.some((x) => x.id === w.id)); assert.ok(o.every((x) => x.ko)); }
});

test('K16: a function word is a hear-and-pick card: its choices are spellings, it is never self-judged at first sight or at a review', () => {
  const s = newState('son'); const sight = WORDS.filter((w) => w.track === 'sight'); const ids = sight.map((w) => w.id);
  const run = new Run({ state: s, words: WORDS, today: D1, rng: mulberry32(2), scope: { newIds: ids, newPerRun: ids.length, duePerRun: 0 } });
  assert.ok(run.queue.every((q) => q.role === 'new' && q.form === 'check'));
  let it = run.show(); const forms = sight.map((w) => w.form);
  assert.equal(it.options.length, 3); assert.ok(it.options.every((o) => forms.includes(o.ko))); assert.ok(it.options.some((o) => o.id === it.id));
  const first = it.id; let res = run.pick(it.options.findIndex((o) => o.id === it.id)); assert.equal(res.ok, true); assert.equal(s.words[first].st, 'likely');   // heard it and picked it: known
  run.advance(); it = run.show(); const second = it.id; res = run.pick((it.options.findIndex((o) => o.id === it.id) + 1) % 3);
  assert.deepEqual([res.ok, s.words[second].st], [false, 'learn']); assert.ok(run.queue.some((q) => q.id === second && q.role === 'relearn'));
  const later = new Run({ state: { ...newState('x'), words: { [first]: { st: 'review', step: 0, due: D1, lastDay: '2026-11-01', firstDay: '2026-11-01', lapses: 0 } } }, words: WORDS, today: D1, rng: mulberry32(1), scope: { noNew: true } });
  assert.equal(later.queue[0].form, 'check');
  const ff = [{ id: 'a', form: 'for', ko: '', track: 'sight', ipa: '/fɔɹ/' }, { id: 'b', form: 'four', ko: '', track: 'sight', ipa: '/fɔɹ/' }, { id: 'c', form: 'from', ko: '', track: 'sight', ipa: '/fɹʌm/' }, { id: 'd', form: 'of', ko: '', track: 'sight', ipa: '/ʌv/' }];
  const r2 = new Run({ state: newState('y'), words: ff, today: D1, rng: mulberry32(3) }); for (let k = 0; k < 20; k++) assert.ok(!r2._options('a').some((o) => o.id === 'b'), 'a word that sounds the same is never offered');
});

// ---- worlds (schemaVersion 3) ----
const view = (state, today = D1, w = W1) => worldView(IX, w, state, today);
// Runs a test with the hear-and-pick houses back on the learning path (the setting emptied), then restores the default.
const legacyTest = (name, fn) => test(name, () => { setLeftOutKinds([]); indexWorlds(DOC); try { fn(); } finally { setLeftOutKinds(['sight']); indexWorlds(DOC); } });
// Tile runs as they were before the word list (TRIAGE.on = false): these tests play every new word one card at a time.
const triageOff = (fn) => () => { TRIAGE.on = false; try { return fn(); } finally { TRIAGE.on = true; } };
const oldTest = (name, fn) => test(name, triageOff(fn)); const oldLegacy = (name, fn) => legacyTest(name, triageOff(fn));
const status = (v, id) => (v.nodes.find((n) => n.id === id) || v.houses.find((h) => h.id === id)).status;
const mkRun = (state, node, today = D1, seed = 3) => new Run({ state, words: WORDS, today, rng: mulberry32(seed), scope: node.scope, items: node.items || {}, tag: node.tag });
const settle = (state, node, run, rec, today) => ({ ...settleRun(state, node, run, rec, today, mulberry32(2)), ...settleWorld(IX, state, node, rec, today) });
function clear(state, id, today = D1, w = W1) {              // the child plays a tile (or the next tile of a house) honestly and knows everything
  const node = nodeRun(IX, view(state, today, w), id, state, WORDS, mulberry32(1)); assert.ok(node, 'open: ' + id);
  const run = mkRun(state, node, today); play(run, () => true); const rec = run.finish(); return settle(state, node, run, rec, today);
}
// Takes a check-only run (castle, continent castle, bat test). knows(id) decides which cards are answered correctly.
function exam(state, node, today, knows = () => true, reason = 'done') {
  const run = mkRun(state, node, today); let n = 0;
  while (run.current && (reason === 'done' || n++ < 2)) { const it = run.show(); if (it.form === 'judge') run.judge(true); else { const ans = it.options.findIndex((o) => o.id === it.id); run.pick(knows(it.id) || it.role === 'practice' ? ans : (ans + 1) % 3); } run.advance(); if (run.i > 500) break; }
  const rec = run.finish(reason); return { run, rec, node, out: settle(state, node, run, rec, today) };
}
const batTest = (state, today, knows, reason) => { const node = nodeRun(IX, view(state, today), 'bat', state, WORDS, mulberry32(7)); assert.ok(node, 'bat test available'); return exam(state, node, today, knows, reason); };
const meetAll = (state, w, day = '2026-11-01') => { for (const id of worldWords(w)) state.words[id] ||= { st: 'done', due: null, firstDay: day, lastDay: day, lapses: 0 }; };

legacyTest('W1: the world file is version 3; every card of the deck sits in exactly one tile or house; other versions are refused', () => {
  assert.equal(DOC.schemaVersion, 3); const all = IX.worlds.flatMap(worldWords);
  assert.equal(all.length, WORDS.length); assert.equal(new Set(all).size, WORDS.length); assert.ok(all.every((id) => WORDS.some((w) => w.id === id)));
  assert.ok(IX.worlds.every((w) => w.map.nodes.filter((n) => n.kind === 'tile').every((n) => n.words.length >= 1 && n.words.length <= 10)));
  assert.throws(() => indexWorlds({ schemaVersion: 2, continents: [] }), /버전/); assert.throws(() => indexWorlds({ schemaVersion: 4, continents: [] }), /버전/);
});

oldLegacy('W2: at the start the tiles next to the start are open, the rest locked; castle, playhouses and the house are locked', () => {
  const s = newState('son'); const v = view(s);
  assert.deepEqual(['A1', 'B1', 'C1', 'A2', 'B2', 'C2'].map((id) => status(v, id)), ['open', 'open', 'open', 'locked', 'locked', 'locked']);
  assert.deepEqual([v.castle.status, status(v, 'G1'), status(v, 'G2'), status(v, 'H1')], ['locked', 'locked', 'locked', 'locked']);
  assert.equal(v.monster.present, false); assert.equal(v.bonus.status, 'locked'); assert.equal(v.firstVisit, true);
  assert.equal(nodeRun(IX, v, 'A2', s, WORDS, mulberry32(1)), null); assert.equal(nodeRun(IX, v, 'castle', s, WORDS, mulberry32(1)), null);
  clear(s, 'A1'); const v2 = view(s); assert.deepEqual([status(v2, 'A1'), status(v2, 'A2'), status(v2, 'H1'), v2.castle.status], ['cleared', 'open', 'open', 'locked']);
});

oldTest('W3: a tile run introduces exactly that tile\'s words; clearing needs every word seen; stars are counted', () => {
  const s = newState('son'); const node = nodeRun(IX, view(s), 'B1', s, WORDS, mulberry32(1));
  assert.deepEqual([node.kind, node.scope.newIds.length, node.wid], ['tile', 10, 'd1-01']);
  const r = clear(s, 'B1'); assert.deepEqual(new Set(Object.keys(s.words)), new Set(W1._nodes.B1.words)); assert.equal(r.cleared, true); assert.ok(r.stars > 0);
  assert.equal(ensureMap(s).stars, r.stars); assert.equal(ensureMap(s).worlds['d1-01'].cleared.B1, D1);
});

oldTest('W4: an early exit leaves the tile uncleared; the unseen words are drawn again next time', () => {
  const s = newState('son'); const node = nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1));
  const run = mkRun(s, node); run.show(); run.judge(true); run.advance(); const rec = run.finish('left'); const r = settle(s, node, run, rec, D1);
  assert.equal(r.cleared, false); assert.equal(status(view(s), 'A1'), 'open');
  assert.equal(nodeRun(IX, view(s, addDays(D1, 1)), 'A1', s, WORDS, mulberry32(1)).scope.newIds.length, 10);
});

oldTest('W5: reaching the castle is necessary but the minimum villages and both stamps are also required', () => {
  const s = newState('son'); ensureMap(s).bat.cap = 80;
  clear(s, 'C1'); assert.equal(view(s).castle.status, 'locked');
  clear(s, 'C2'); assert.equal(view(s).castle.status, 'locked'); assert.equal(status(view(s), 'G2'), 'open');
  clear(s, 'A2'); let v = view(s); assert.equal(v.gate.reachable, true); assert.equal(v.gate.tilesDone, 3); assert.equal(v.castle.status, 'locked');
  clear(s, 'B1'); v = view(s); assert.equal(v.castle.status, 'open'); assert.equal(v.gate.ready, true);
  assert.deepEqual(['A1', 'B1', 'A2', 'B2'].map((id) => status(v, id)), ['open', 'cleared', 'cleared', 'open']);
  const r = reach(W1, s); assert.ok(r.reached.has('plaza') && r.castle);
});

oldLegacy('W6: castle: 12 check cards from this world\'s met words; 80% gives the key and opens the next world; leftovers pay double; no crown yet', () => {
  const s = newState('son'); ensureMap(s).bat.cap = 80; for (const id of ['A1', 'A2', 'B1', 'C1']) clear(s, id);
  assert.equal(view(s).gate.ready, true); assert.equal(worldOpen(IX, W2, s), false);
  const node = nodeRun(IX, view(s), 'castle', s, WORDS, mulberry32(1)); const run = mkRun(s, node);
  assert.ok(run.queue.length === 12 && run.queue.every((q) => q.role === 'castle' && q.form === 'check' && worldWords(W1).includes(q.id) && s.words[q.id]));
  play(run, () => true); const rec = run.finish(); const r = settle(s, node, run, rec, D1);
  assert.deepEqual([r.key, r.castle.pass, r.castle.ok, r.castle.total, r.crown, r.nextWorld.id], [true, true, 12, 12, false, 'd1-02']);
  const v = view(s); assert.deepEqual([v.castle.status, v.keys, v.crown], ['cleared', 1, false]); assert.equal(worldOpen(IX, W2, s), true);
  assert.ok(v.nodes.filter((n) => n.kind === 'tile' && n.status !== 'cleared').every((n) => n.bonus)); assert.equal(v.houses[0].bonus, true);
  assert.equal(clear(s, 'B2').mult, 2);
});

oldTest('W7: a failed castle card is not known: back to learning, due tomorrow; below the pass rate there is no key and the castle stays open', () => {
  const s = newState('son'); ensureMap(s).bat.cap = 80; for (const id of ['A1', 'A2', 'B1', 'C1']) clear(s, id); const node = nodeRun(IX, view(s), 'castle', s, WORDS, mulberry32(1)); const run = mkRun(s, node);
  const missed = []; let n = 0;
  while (run.current) { const it = run.show(); const ans = it.options.findIndex((o) => o.id === it.id); const miss = n++ < 4; if (miss) missed.push(it.id); run.pick(miss ? (ans + 1) % 3 : ans); run.advance(); }
  const rec = run.finish(); const r = settle(s, node, run, rec, D1);
  assert.deepEqual([r.key, r.castle.pass, r.castle.ok, r.castle.need], [false, false, 8, 0.8]);
  for (const id of missed) assert.deepEqual([s.words[id].st, s.words[id].due], ['learn', addDays(D1, 1)]);
  assert.equal(view(s).castle.status, 'open'); assert.equal(worldOpen(IX, W2, s), false);
});

legacyTest('W8: the crown needs every tile, the house and the castle; playhouse stamps never count', () => {
  const s = newState('son'); meetAll(s, W1); ensureMap(s).bat.fill = 0;
  let v = view(s); assert.equal(v.crown, false); assert.equal(v.castle.status, 'open'); assert.equal(v.unitsDone, v.units);
  const r = exam(s, nodeRun(IX, v, 'castle', s, WORDS, mulberry32(1)), D1); assert.deepEqual([r.out.key, r.out.crown], [true, true]);
  v = view(s); assert.equal(v.crown, true); assert.deepEqual(Object.keys(ensureMap(s).worlds['d1-01'].stamps), []);
  const t = newState('son'); meetAll(t, W1); delete t.words[W1.sideActivities[0].tiles[0].words[0]];                 // one function word not met
  exam(t, nodeRun(IX, view(t), 'castle', t, WORDS, mulberry32(1)), D1); assert.equal(crowned(W1, t), false);
});

oldLegacy('W9: the house (function words) opens when its anchor tile is done; its run uses hear-and-pick cards; it is needed for the crown', () => {
  const s = newState('son'); assert.equal(nodeRun(IX, view(s), 'H1', s, WORDS, mulberry32(1)), null);
  clear(s, 'A1'); const node = nodeRun(IX, view(s), 'H1', s, WORDS, mulberry32(1)); assert.deepEqual([node.kind, node.unit, node.scope.newIds.length], ['tile', 'H1-1', 6]);
  const run = mkRun(s, node); assert.ok(run.queue.filter((q) => q.role === 'new').every((q) => q.form === 'check'));
  const r = clear(s, 'H1'); assert.equal(r.cleared, true); const v = view(s); assert.deepEqual([v.houses[0].status, v.houses[0].done, v.houses[0].total], ['cleared', 1, 1]);
  const again = nodeRun(IX, v, 'H1', s, WORDS, mulberry32(1)); assert.equal(again.kind, 'practice', 'a cleared house is played again as practice (user request 2026-11-18)');
});

oldTest('W10: playhouses: open when their anchor tile is done; a stamp is given once and changes nothing else', () => {
  const s = newState('son'); assert.equal(status(view(s), 'G1'), 'locked'); clear(s, 'B1');
  let v = view(s); const g = v.nodes.find((n) => n.id === 'G1'); assert.deepEqual([g.status, g.playable, g.gameType], ['open', true, 'memory']);
  const before = JSON.stringify([s.words, ensureMap(s).stars, ensureMap(s).bat, ensureMap(s).keys]);
  assert.equal(stampGame(s, W1, 'G1', D1), true); assert.equal(stampGame(s, W1, 'G1', addDays(D1, 1)), false);
  assert.equal(JSON.stringify([s.words, ensureMap(s).stars, ensureMap(s).bat, ensureMap(s).keys]), before);
  v = view(s); assert.equal(status(v, 'G1'), 'cleared'); assert.equal(v.crown, false); assert.equal(ensureMap(s).worlds['d1-01'].stamps.G1, D1);
  assert.equal(nodeRun(IX, v, 'G1', s, WORDS, mulberry32(1)), null);                                              // a playhouse never starts a card run
});

test('W11: worlds open in order: the next world needs the castle before it, the next continent needs the continent castle', () => {
  const s = newState('son'); assert.deepEqual(IX.worlds.map((w) => worldOpen(IX, w, s)), [true, false, false]); assert.equal(currentWorld(IX, s).id, 'd1-01');
  ensureMap(s); s.map.worlds['d1-01'] = { castle: D1, cleared: {}, stamps: {}, seen: D1 };
  assert.deepEqual(IX.worlds.map((w) => worldOpen(IX, w, s)), [true, true, false]); assert.equal(currentWorld(IX, s).id, 'd1-02');   // first open world without a key
  s.map.at = 'd1-01'; assert.equal(currentWorld(IX, s).id, 'd1-01');                                               // the child may go back
  s.map.at = 'd2-01'; assert.equal(currentWorld(IX, s).id, 'd1-02');                                               // a closed world is not entered
  assert.equal(enterWorld(s, W2, D1), true); assert.equal(enterWorld(s, W2, D1), false); assert.equal(s.map.at, 'd1-02');
  const a = atlasView(IX, s); assert.deepEqual(a.map((c) => [c.id, c.crowns, c.total, c.finale.status]), [['d1', 0, 2, 'locked'], ['d2', 0, 1, 'locked']]);
});

test('W12: the continent castle needs all world castles and the village ratio; it draws met cards evenly from every world; passing opens the next continent', () => {
  const s = newState('son'); meetAll(s, W1); meetAll(s, W2); const m = ensureMap(s);
  m.worlds['d1-01'] = { castle: D1, cleared: {}, stamps: {}, seen: D1 }; assert.equal(atlasView(IX, s)[0].finale.status, 'locked'); assert.equal(finaleRun(IX, DOC.continents[0], s, D1, mulberry32(1)), null);
  m.worlds['d1-02'] = { castle: D1, cleared: {}, stamps: {}, seen: D1 }; const a = atlasView(IX, s)[0]; assert.deepEqual([a.crowns, a.finale.status, a.finale.cards, a.finale.pass], [2, 'open', 10, 0.7]);
  const node = finaleRun(IX, DOC.continents[0], s, D1, mulberry32(1)); assert.deepEqual([node.kind, node.cid, node.scope.castle.length], ['finale', 'd1', 10]);
  const from = (w) => node.scope.castle.filter((id) => worldWords(w).includes(id)).length; assert.deepEqual([from(W1), from(W2)], [5, 5]);
  const fail = exam(s, node, D1, () => false); assert.deepEqual([fail.out.finale.pass, worldOpen(IX, W3, s)], [false, false]);
  const d2 = addDays(D1, 1); const pass = exam(s, finaleRun(IX, DOC.continents[0], s, d2, mulberry32(2)), d2, (id) => !fail.node.scope.castle.slice(0, 3).includes(id));
  assert.equal(pass.out.finale.pass, true); assert.equal(pass.out.nextContinent.id, 'd2'); assert.equal(worldOpen(IX, W3, s), true); assert.equal(atlasView(IX, s)[0].finale.status, 'cleared');
  assert.equal(FINALE.pass, 0.75);                                                                                 // the default when a file gives none
});

// ---- review load, items, lightning ----
oldTest('M5: 8 or more due reviews put an optional monster on the map: it does not block; beating it drops an item; more than one a day', () => {
  const s = newState('son'); clear(s, 'A1'); clear(s, 'B1'); clear(s, 'C1');
  const d = addDays(D1, 7); assert.ok(dueCount(s, d) >= 2 * MONSTER_AT, 'due=' + dueCount(s, d));
  let v = view(s, d); assert.equal(v.monster.present, true); assert.equal(status(v, 'A2'), 'open');
  assert.ok(nodeRun(IX, v, 'A2', s, WORDS, mulberry32(1)), 'a new tile can start with the monster standing');
  const node = nodeRun(IX, v, 'monster', s, WORDS, mulberry32(1)); assert.deepEqual([node.scope.noNew, node.kind], [true, 'monster']);
  const run = mkRun(s, node, d); assert.ok(run.queue.length === 14 && run.queue.every((q) => q.role === 'likely' || q.role === 'review'));
  play(run, () => true); const rec = run.finish(); const r = settle(s, node, run, rec, d);
  assert.deepEqual([r.monster, r.mult], [true, 2]); assert.ok(['shield', 'flame'].includes(r.item));
  assert.equal(view(s, d).monster.present, true); assert.equal(ensureMap(s).monsterN, 1);                          // reviews are left, so another monster stands
});

oldTest('M8: items: shield absorbs one wrong check and comes back if unused; flame doubles boss damage; both come from the bag only', () => {
  const s = newState('son'); const m = ensureMap(s); m.items.shield = 1; m.items.flame = 1;
  assert.equal(chooseBag(s, 'shield'), 'shield'); assert.equal(chooseBag(s, 'shield'), null); chooseBag(s, 'shield');
  const used = takeBag(s); assert.deepEqual([used.shield, m.items.shield, m.bag], [1, 0, null]);
  const [a, b] = WORDS.slice(0, 2).map((w) => w.id);                             // two due words -> two check cards (a "likely" word is always checked)
  for (const id of [a, b]) s.words[id] = { st: 'likely', lstep: 0, due: D1, firstDay: '2026-11-05', lastDay: '2026-11-05', lapses: 0 };
  const node = { kind: 'monster', tag: 'monster', scope: { noNew: true, duePerRun: 14 } };
  const run = mkRun(s, { ...node, items: used }); run.combo = 4;
  let it = run.show(); assert.equal(it.form, 'check');
  const wrong = (x) => (x.options.findIndex((o) => o.id === x.id) + 1) % 3;
  run.pick(wrong(it)); assert.deepEqual([run.combo, run.items.shield, run.shieldUsed], [4, 0, 1]);   // the shield took the hit
  run.advance(); it = run.show(); run.pick(wrong(it)); assert.equal(run.combo, 0);                    // no shield left
  const s3 = newState('son'); ensureMap(s3).items.shield = 1; chooseBag(s3, 'shield'); const kept = takeBag(s3);   // an unused shield returns when the run is settled
  const n3 = nodeRun(IX, view(s3), 'A1', s3, WORDS, mulberry32(1)); const r3 = mkRun(s3, { ...n3, items: kept }); r3.finish('left');
  settle(s3, n3, r3, r3.ended, D1); assert.equal(s3.map.items.shield, 1);
  const s2 = newState('son'); ensureMap(s2).items.flame = 1; chooseBag(s2, 'flame'); const it3 = takeBag(s2);       // flame doubles damage
  const n2 = nodeRun(IX, view(s2), 'A1', s2, WORDS, mulberry32(1)); const r2 = mkRun(s2, { ...n2, items: it3 }); r2.show(); r2.judge(true);
  assert.equal(r2.boss.hp, CFG.bossHp - 2); assert.equal(chooseBag(s2, 'shield'), null);
});

oldLegacy('M9: nothing on the map changes a word\'s schedule; the lightning round touches no word and never asks a function word', () => {
  const s = newState('son'); for (const id of ['A1', 'B1', 'H1']) clear(s, id);
  const before = JSON.stringify(s.words); const d = addDays(D1, 8);
  const lt = new Lightning({ state: s, words: WORDS, rng: mulberry32(4) }); assert.ok(lt.ready);
  for (let k = 0; k < 40; k++) { const c = lt.next(); const w = WORDS.find((x) => x.id === c.id); assert.ok(w.ko && c.ko); assert.equal(c.ko === w.ko, c.truth); lt.answer(c.truth); }
  assert.equal(lt.score, 40); assert.equal(JSON.stringify(s.words), before);
  const lt2 = new Lightning({ state: s, words: WORDS, rng: mulberry32(5) }); const c = lt2.next(); assert.equal(lt2.answer(!c.truth), false);
  const r = settleLightning(s, lt, d); assert.deepEqual([r.first, r.newBest, ensureMap(s).best], [true, true, 40]); assert.ok(r.item);
  assert.equal(settleLightning(s, lt2, d).item, null);                           // one item a day
  assert.equal(JSON.stringify(s.words), before); assert.equal(view(s, d).bonus.status, 'used');
});

oldTest('M10: the bonus house stays locked until 6 words are ripe', () => {
  const s = newState('son'); assert.equal(view(s).bonus.status, 'locked'); clear(s, 'A1'); assert.equal(view(s).bonus.status, 'open');
});

// ---- bat gauge ----
oldTest('G1: the gauge gains 1 per new word and loses 1 per review answered, never below 0', () => {
  const s = newState('son'); assert.deepEqual([ensureMap(s).bat.fill, ensureMap(s).bat.cap], [0, BAT.cap]);
  clear(s, 'A1'); assert.equal(s.map.bat.fill, 10); assert.equal(s.map.bat.met.length, 10);
  const s2 = newState('son'); ensureMap(s2).bat.fill = 3; const n2 = { kind: 'monster', tag: 'monster', scope: { noNew: true } };
  const r2 = mkRun(s2, n2); r2.finish(); settleRun(s2, n2, r2, { ...r2.ended, reviews: 2, fresh: 0 }, D1, mulberry32(2)); assert.equal(s2.map.bat.fill, 1);
  settleRun(s2, n2, r2, { ...r2.ended, reviews: 5, fresh: 0 }, D1, mulberry32(2)); assert.equal(s2.map.bat.fill, 0);
});

oldLegacy('G2: a full gauge stops everything but the bat test; with nothing to ask it is not "full"', () => {
  const s = newState('son'); clear(s, 'A1'); clear(s, 'A2'); clear(s, 'B1'); assert.equal(view(s).bat.full, false);
  clear(s, 'B2'); const v = view(s); assert.deepEqual([v.bat.fill, v.bat.cap, v.bat.full, v.bat.byDebt], [40, 40, true, false]);
  assert.deepEqual([status(v, 'C1'), v.castle.status, status(v, 'H1'), status(v, 'C2'), status(v, 'G1')], ['blocked', 'locked', 'blocked', 'blocked', 'open']);   // missing stamp keeps castle locked; play is not blocked
  const ready = structuredClone(s); for (const id of W1._nodes.C1.words) ready.words[id] = { st: 'done', due: null }; assert.equal(view(ready).gate.ready, true); assert.equal(view(ready).castle.status, 'blocked'); assert.equal(nodeRun(IX, view(ready), 'castle', ready, WORDS, mulberry32(1)), null);
  for (const id of ['C1', 'castle', 'monster', 'H1']) assert.equal(nodeRun(IX, v, id, s, WORDS, mulberry32(1)), null, id);
  assert.ok(nodeRun(IX, v, 'bat', s, WORDS, mulberry32(1)));
  const empty = newState('son'); ensureMap(empty).bat.fill = 99; assert.equal(view(empty).bat.full, false);   // gauge full but no word to ask about
});

oldTest('G3: the bat test asks overdue reviews first (oldest first), then words met since the last test; all check cards, 25 at most', () => {
  const s = newState('son'); for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id);
  const d = addDays(D1, 8);                                                       // the known words of day 1 are due again after 7 days
  const pool = batPool(s, d); assert.ok(pool.due.length > 0 && pool.due.length + pool.fresh.length <= BAT.test);
  const dues = pool.due.map((id) => s.words[id].due); assert.deepEqual(dues, [...dues].sort());
  const node = nodeRun(IX, view(s, d), 'bat', s, WORDS, mulberry32(1)); const run = mkRun(s, node, d);
  assert.ok(run.queue.length <= BAT.test && run.queue.every((q) => q.form === 'check')); assert.ok(run.queue.slice(0, pool.due.length).every((q) => q.role === 'review' || q.role === 'likely'));
  const fresh = batPool(s, D1); assert.equal(fresh.due.length, 0); assert.equal(fresh.fresh.length, BAT.test);   // day 1: nothing due, so it asks about words met today
});

oldTest('G4: the test result moves the capacity (90%+ up, under 70% down, bounded); the gauge empties; leaving keeps it full; no stars', () => {
  const fill = (s) => { for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id); };
  const hi = newState('son'); fill(hi); const r1 = batTest(hi, D1, () => true);
  assert.deepEqual([r1.out.bat.done, r1.out.bat.acc, hi.map.bat.cap, hi.map.bat.fill, hi.map.bat.met.length], [true, 1, BAT.cap + BAT.step, 0, 0]);
  assert.equal(r1.out.stars, 0);
  const lo = newState('son'); fill(lo); const r2 = batTest(lo, D1, () => false);
  assert.ok(r2.out.bat.acc < BAT.down); assert.equal(lo.map.bat.cap, BAT.cap - BAT.step); assert.equal(lo.map.bat.fill, 0);
  const mid = newState('son'); fill(mid); let k = 0; batTest(mid, D1, () => k++ % 5 !== 0);                  // 80% right
  assert.equal(mid.map.bat.cap, BAT.cap);
  const top = newState('son'); fill(top); top.map.bat.cap = BAT.max; top.map.bat.fill = BAT.max; batTest(top, D1, () => true); assert.equal(top.map.bat.cap, BAT.max);
  const bot = newState('son'); fill(bot); bot.map.bat.cap = BAT.min; ensureMap(bot).bat.fill = BAT.min + 5; batTest(bot, D1, () => false); assert.equal(bot.map.bat.cap, BAT.min);
  const left = newState('son'); fill(left); const r3 = batTest(left, D1, () => true, 'left');
  assert.equal(r3.out.bat.done, false); assert.equal(view(left).bat.full, true); assert.equal(left.map.bat.cap, BAT.cap);
});

oldTest('G5: a miss in the bat test follows the normal rules: overdue word back to tomorrow, new word back to learning', () => {
  const s = newState('son'); for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id); const d = addDays(D1, 8);
  const node = nodeRun(IX, view(s, d), 'bat', s, WORDS, mulberry32(1)); const dueIds = batPool(s, d).due; assert.ok(dueIds.length > 0); const was = Object.fromEntries(dueIds.map((id) => [id, s.words[id].st]));
  exam(s, node, d, () => false);                                                  // a miss adds "once more" cards, so the queue grows
  for (const id of dueIds) assert.deepEqual([s.words[id].st, s.words[id].due], [was[id] === 'likely' ? 'learn' : 'review', addDays(d, 1)]);   // a missed "likely" word is not known after all
  for (const id of node.scope.bat.fresh) assert.equal(s.words[id].st, 'learn');
});

test('G6: reviews put off also bring the bat: overdue cards as many as the capacity fill the gauge even with no new word', () => {
  const s = newState('son'); const m = ensureMap(s); m.bat.cap = 20; const d = addDays(D1, 3);
  WORDS.slice(0, 19).forEach((w) => { s.words[w.id] = { st: 'review', step: 1, due: addDays(D1, 1), lastDay: D1, firstDay: D1, lapses: 0 }; });
  let b = batState(s, d); assert.deepEqual([overdueCount(s, d), b.limit, b.full, b.byDebt, b.fill], [19, 20, false, false, 19]);
  s.words[WORDS[19].id] = { st: 'learn', due: addDays(D1, 1), lastDay: D1, firstDay: D1, lapses: 0 };            // a word still to learn counts too
  b = batState(s, d); assert.deepEqual([b.overdue, b.full, b.byDebt, b.fill, m.bat.fill], [20, true, true, 20, 0]);
  assert.equal(batState(s, addDays(D1, 1)).full, false);                                                           // due today is not overdue yet
  const v = view(s, d); assert.equal(status(v, 'A1'), 'blocked'); const node = nodeRun(IX, v, 'bat', s, WORDS, mulberry32(1));
  assert.ok(node.scope.bat.due.includes(WORDS[19].id)); const r = exam(s, node, d);
  assert.equal(r.out.bat.done, true); assert.equal(batState(s, d).full, false); assert.equal(s.words[WORDS[19].id].st, 'review');   // the test worked the debt off
  const off = { ...RULES }; RULES.batOverdue = 0; const s2 = newState('x'); WORDS.slice(0, 60).forEach((w) => { s2.words[w.id] = { st: 'review', step: 1, due: D1, lastDay: '2026-11-01', firstDay: '2026-11-01', lapses: 0 }; });
  assert.equal(batState(s2, d).full, false); Object.assign(RULES, off);                                            // the rule can be switched off
});

oldTest('G7: a tile run carries more reviews when more are waiting: half of the backlog, between 8 and 20', () => {
  assert.deepEqual([0, 10, 16, 17, 30, 40, 500].map(tileDue), [8, 8, 8, 9, 15, 20, 20]);
  const s = newState('son'); WORDS.slice(20, 60).forEach((w) => { s.words[w.id] = { st: 'review', step: 1, due: D1, lastDay: '2026-11-01', firstDay: '2026-11-01', lapses: 0 }; });
  ensureMap(s).bat.cap = 80; const node = nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1)); assert.equal(node.scope.duePerRun, 20);
  const run = mkRun(s, node); assert.equal(run.queue.filter((q) => q.role === 'review').length, 20);
});

test('K17: cards a catalogue marks as confusable with each other are never offered as wrong answers for one another', async () => {
  const { confusable } = await import('../cards/js/deck.js');
  const deck = [{ id: 'a', form: 'big', ko: '큰', type: 't', groups: ['g1'] }, { id: 'b', form: 'large', ko: '커다란', type: 't', groups: ['g1', 'g2'] },
    { id: 'c', form: 'huge', ko: '거대한', type: 't', groups: ['g2'] }, { id: 'd', form: 'red', ko: '빨간', type: 't' }, { id: 'e', form: 'blue', ko: '파란', type: 't', groups: [] }, { id: 'f', form: 'green', ko: '초록', type: 't' }];
  assert.deepEqual([confusable(deck[0], deck[1]), confusable(deck[0], deck[2]), confusable(deck[1], deck[2]), confusable(deck[0], deck[3]), confusable(deck[3], deck[4])], [true, false, true, false, false]);
  const run = new Run({ state: newState('x'), words: deck, today: D1, rng: mulberry32(4) });
  for (let k = 0; k < 40; k++) { assert.ok(!run._options('a').some((o) => o.id === 'b')); assert.ok(!run._options('b').some((o) => o.id === 'a' || o.id === 'c')); }
  const s = newState('y'); for (const w of deck) s.words[w.id] = { st: 'done', due: null, firstDay: D1, lastDay: D1, lapses: 0 };
  const lt = new Lightning({ state: s, words: deck, rng: mulberry32(6) });
  for (let k = 0; k < 200; k++) { const c = lt.next(); if (c.id === 'a') assert.notEqual(c.ko, '커다란'); if (c.id === 'b') assert.ok(c.ko !== '큰' && c.ko !== '거대한'); }
});

test('W13: by default the function-word house is off the learning path: not on the map, not needed for the crown, not in the castle', () => {
  const sight = new Set(WORDS.filter((w) => w.track === 'sight').map((w) => w.id)); assert.equal(sight.size, 6);
  const s = newState('son'); let v = view(s); assert.deepEqual(v.houses, []); assert.equal(nodeRun(IX, v, 'H1', s, WORDS, mulberry32(1)), null);
  assert.ok(worldWords(W1).every((id) => !sight.has(id))); assert.equal(worldWords(W1).length, 60);
  for (const id of worldWords(W1)) s.words[id] = { st: 'done', due: null, firstDay: '2026-11-01', lastDay: '2026-11-01', lapses: 0 };   // every tile met, no function word
  v = view(s); assert.equal(v.unitsDone, v.units); const node = nodeRun(IX, v, 'castle', s, WORDS, mulberry32(1));
  assert.ok(node.scope.castle.every((id) => !sight.has(id)));
  const r = exam(s, node, D1); assert.deepEqual([r.out.key, r.out.crown], [true, true]); assert.ok(Object.keys(s.words).every((id) => !sight.has(id)));
  assert.equal(atlasView(IX, s)[0].worlds[0].total, 60);
  setLeftOutKinds([]); try { const v2 = view(s); assert.equal(v2.houses.length, 1); assert.equal(v2.crown, false); assert.equal(worldWords(W1).length, 66); } finally { setLeftOutKinds(['sight']); }
  assert.equal(view(s).crown, true);
});

// ---- tile triage and bunch checks (card T-003; TRIAGE on, the default) ----
// The tile word list (TRIAGE.sort = false): the rules of a tile's passed words, spot checks and bunches. World sorting reuses them.
const tileTest = (name, fn) => test(name, () => { TRIAGE.sort = false; try { return fn(); } finally { TRIAGE.sort = true; } });
// The child looks over a tile's new words and taps `unknown`. -> { node, run }; making the run records the passed words.
function triageRun(state, id, unknown = [], today = D1, seed = 1) {
  const node = nodeRun(IX, view(state, today), id, state, WORDS, mulberry32(seed)); assert.ok(node && node.triage, 'word list for ' + id);
  const rng = mulberry32(seed + 1); triageScope(node, triagePlan(node.triage, unknown, rng), today);
  return { node, run: new Run({ state, words: WORDS, today, rng, scope: node.scope, tag: node.tag }) };
}
// Plays a run the way the screen allows: a taught card only has "뜻 보기" (judge(false)); knows(id) decides every check.
function playT(run, knows = () => true) {
  const seen = []; let g = 0;
  while (run.current && g++ < 500) {
    const it = run.show(); seen.push({ ...it }); const right = () => it.options.findIndex((o) => o.id === it.id);
    if (it.form === 'judge') { const r = run.judge(it.taught ? false : true); if (r.next === 'verify') run.pick(knows(it.id) ? right() : (right() + 1) % 3); }
    else run.pick(it.role === 'relearn' || knows(it.id) ? right() : (right() + 1) % 3);
    run.advance();
  }
  assert.ok(g < 500); return seen;
}
const finishT = (state, t, today = D1, reason = 'done') => { const rec = t.run.finish(reason); return { rec, out: settle(state, t.node, t.run, rec, today) }; };
const D30 = addDays(D1, 30);

tileTest('T1: passed words are recorded as silver with no date in the tile\'s bunch; the bunch is due in 30 days; the gauge does not rise; the tile clears', () => {
  const s = newState('son'); const t = triageRun(s, 'A1'); const words = W1._nodes.A1.words; const spot = t.node.scope.triage.spot;
  assert.equal(spot.length, 3); assert.deepEqual(t.run.queue.map((q) => q.role), ['spot', 'spot', 'spot']);   // 3 checks since 2026-11-18 (was 2)
  for (const id of words.filter((x) => !spot.includes(x))) { const { at, ...r } = s.words[id]; assert.deepEqual(r, { firstDay: D1, lapses: 0, st: 'likely', lstep: 0, due: null, bunch: 'A1', lastDay: D1 }); assert.ok(Number.isFinite(at)); }   // `at`: time of the change (F9)
  assert.deepEqual(s.bunches.A1, { due: addDays(D1, 30), done: null }); assert.equal(gradeOf(s.words[words.find((x) => !spot.includes(x))]), 2);
  playT(t.run); const r = finishT(s, t);
  assert.ok(words.every((id) => s.words[id] && s.words[id].st === 'likely' && s.words[id].due === null && s.words[id].bunch === 'A1'));
  assert.deepEqual([r.out.cleared, ensureMap(s).bat.fill, ensureMap(s).bat.met.length, r.rec.fresh, r.rec.reviews], [true, 0, 0, 0, 0]); assert.ok(r.rec.stars > 0);
  const u = newState('son'); const tu = triageRun(u, 'B1', W1._nodes.B1.words.slice(0, 3)); playT(tu.run); finishT(u, tu);
  assert.equal(u.map.bat.fill, 3); assert.equal(status(view(u), 'B1'), 'cleared');           // only the three words met on cards fill the gauge
  const none = newState('son'); const tn = triageRun(none, 'C1', W1._nodes.C1.words); assert.deepEqual(none.bunches, {}); assert.equal(tn.run.queue.filter((q) => q.role === 'spot').length, 0);   // nothing passed: no bunch
});

tileTest('T2: spot checks: 0 / 1 / 3 cards for 0 / 1-3 / 4+ passed words, first in the run; right = passed, wrong = learning word that comes back; state.verify keeps both', () => {
  const ids = W1._nodes.A1.words;
  for (let n = 0; n <= 10; n++) { const p = triagePlan(ids, ids.slice(n), mulberry32(n)); assert.equal(p.passed.length, n); assert.equal(p.spot.length, n === 0 ? 0 : n < 4 ? 1 : 3, 'passed ' + n); assert.ok(p.spot.every((x) => p.passed.includes(x))); }
  const s = newState('son'); const t = triageRun(s, 'A1', ids.slice(0, 2)); const [a, b] = t.node.scope.triage.spot;
  assert.deepEqual(t.run.queue.slice(0, 2).map((q) => [q.id, q.role, q.form]), [[a, 'spot', 'check'], [b, 'spot', 'check']]);
  let it = t.run.show(); assert.equal(s.words[a], undefined); t.run.pick(it.options.findIndex((o) => o.id === a)); t.run.advance();
  assert.deepEqual([s.words[a].st, s.words[a].due, s.words[a].bunch, t.run.combo], ['likely', null, 'A1', 1]);
  it = t.run.show(); const res = t.run.pick((it.options.findIndex((o) => o.id === b) + 1) % 3);
  assert.deepEqual([res.ok, t.run.combo, s.words[b].st, s.words[b].due], [false, 0, 'learn', addDays(D1, 1)]); assert.deepEqual(s.verify, [true, false]);
  assert.ok(t.run.queue.some((q) => q.id === b && q.role === 'relearn' && q.final)); t.run.advance();
  const seen = playT(t.run); assert.ok(seen.some((q) => q.id === b && q.role === 'relearn'));
  assert.deepEqual([s.words[b].st, s.words[b].step, s.words[b].due, s.words[b].bunch], ['review', 0, addDays(D1, 1), undefined]);
  const rec = t.run.finish(); assert.deepEqual([rec.spots, rec.spotOk], [3, 2]);   // the third check (answered by playT) is right
  const d = newState('son'); const td = triageRun(d, 'A1', ids.slice(0, 9)); const only = td.run.show(); assert.equal(only.role, 'spot'); td.run.pick(-1);   // "몰라요" on a spot check
  assert.deepEqual([d.words[only.id].st, d.verify], ['learn', [false]]);
});

tileTest('T3: tapped words are taught: front, then one button that acts as "몰라요" (judge(false)); they end on the 1-day review', () => {
  const s = newState('son'); const ids = W1._nodes.B1.words; const tapped = ids.slice(0, 4); const t = triageRun(s, 'B1', tapped);
  const news = t.run.queue.filter((q) => q.role === 'new'); assert.deepEqual(news.map((q) => q.id).sort(), tapped.slice().sort());
  assert.ok(news.every((q) => q.taught && q.form === 'judge')); assert.ok(t.run.queue.filter((q) => q.role === 'spot').every((q) => !tapped.includes(q.id)));
  while (t.run.current.role === 'spot') { const it = t.run.show(); t.run.pick(it.options.findIndex((o) => o.id === it.id)); t.run.advance(); }
  const it = t.run.show(); assert.equal(it.taught, true); const res = t.run.judge(false); assert.equal(res.next, 'reveal'); assert.equal(s.words[it.id].st, 'learn');
  assert.equal(t.run.stats.claims, 0); t.run.advance(); playT(t.run); const rec = t.run.finish();
  for (const id of tapped) assert.deepEqual([s.words[id].st, s.words[id].step, s.words[id].due], ['review', 0, addDays(D1, 1)]);
  assert.deepEqual([rec.unknown, rec.learned, rec.fresh], [4, 4, 4]);
});

tileTest('T4: leaving early: words not answered get no record and the tile stays open; next time the list holds only those; the bunch keeps its first date', () => {
  const s = newState('son'); const ids = W1._nodes.A1.words; const t = triageRun(s, 'A1', ids.slice(0, 3)); const [a, ...rest] = t.node.scope.triage.spot;
  const it = t.run.show(); t.run.pick(it.options.findIndex((o) => o.id === a)); t.run.advance(); const r = finishT(s, t, D1, 'left');
  assert.equal(r.out.cleared, false); assert.ok(rest.every((b) => s.words[b] === undefined)); assert.ok(ids.slice(0, 3).every((id) => !s.words[id])); assert.equal(status(view(s), 'A1'), 'open');
  const d2 = addDays(D1, 2); const node = nodeRun(IX, view(s, d2), 'A1', s, WORDS, mulberry32(4)); assert.deepEqual(node.triage.slice().sort(), [...rest, ...ids.slice(0, 3)].sort());
  const t2 = triageRun(s, 'A1', [], d2); playT(t2.run); const r2 = finishT(s, t2, d2);
  assert.equal(r2.out.cleared, true); assert.deepEqual(s.bunches.A1, { due: addDays(D1, 30), done: null }); assert.ok(bunchLeft(s, 'A1').length >= 8);
});

// Three tiles looked over on three days, everything known: bunches A1, B1, C1 due on D1+30, +31, +32.
function bunches3() { const s = newState('son'); ['A1', 'B1', 'C1'].forEach((id, i) => { const d = addDays(D1, i); const t = triageRun(s, id, [], d); playT(t.run); finishT(s, t, d); }); return s; }
tileTest('T5: bunch checks: none before the date; then 3 cards per bunch in tile and monster runs, 2 bunches at most, the oldest first; never in bat or castle tests', () => {
  const s = bunches3(); assert.deepEqual(Object.values(s.bunches).map((b) => b.due), [D30, addDays(D1, 31), addDays(D1, 32)]);
  assert.equal(nodeRun(IX, view(s, addDays(D1, 29)), 'A2', s, WORDS, mulberry32(1)).scope.audit, undefined);
  const one = nodeRun(IX, view(s, D30), 'A2', s, WORDS, mulberry32(1)).scope.audit; assert.deepEqual(one.picks.map((p) => p.bunch), ['A1', 'A1', 'A1']);
  const d = addDays(D1, 40); for (const w of W1._nodes.A2.words.slice(0, 8)) s.words[w] = { st: 'review', step: 1, due: d, firstDay: D1, lastDay: D1, lapses: 0 };   // enough due reviews for a monster
  const v = view(s, d); const tile = nodeRun(IX, v, 'B2', s, WORDS, mulberry32(1)); const mon = nodeRun(IX, v, 'monster', s, WORDS, mulberry32(1));
  for (const n of [tile, mon]) { assert.deepEqual(n.scope.audit.picks.map((p) => p.bunch), ['A1', 'A1', 'A1', 'B1', 'B1', 'B1'], n.kind); assert.equal(new Set(n.scope.audit.picks.map((p) => p.id)).size, 6);
    assert.ok(n.scope.audit.picks.every((p) => bunchLeft(s, p.bunch).includes(p.id))); }
  const mr = mkRun(s, mon, d); assert.equal(mr.queue.filter((q) => q.role === 'audit').length, 6); assert.equal(mr.queue.filter((q) => q.role === 'review').length, 8);
  const tr = triageRun(s, 'B2', [], d); assert.deepEqual(tr.run.queue.slice(0, 2).map((q) => q.role), ['spot', 'spot']); assert.equal(tr.run.queue.filter((q) => q.role === 'audit').length, 6);
  const c = newState('son'); for (const id of ['A1', 'A2', 'B1', 'C1']) { const t = triageRun(c, id); playT(t.run); finishT(c, t); }
  const cv = view(c, D30); const castle = nodeRun(IX, cv, 'castle', c, WORDS, mulberry32(1)); assert.ok(castle && !castle.scope.audit); assert.ok(mkRun(c, castle, D30).queue.every((q) => q.role === 'castle'));
  for (const w of W1._nodes.B1.words.slice(0, 5)) c.words[w] = { st: 'review', step: 1, due: D1, firstDay: D1, lastDay: D1, lapses: 0 }; ensureMap(c).bat.fill = 99;
  const bat = nodeRun(IX, view(c, D30), 'bat', c, WORDS, mulberry32(1)); assert.ok(bat && !bat.scope.audit); assert.ok(mkRun(c, bat, D30).queue.every((q) => q.role !== 'audit'));
});

tileTest('T6: all samples right: every word left in the bunch is gold, bunch "ok"; one wrong: it is learning (tomorrow), the rest get the 7-day check, bunch "split"; leaving early', () => {
  const auditRun = (s, d, seed = 3) => new Run({ state: s, words: WORDS, today: d, rng: mulberry32(seed), scope: { noNew: true, audit: auditPick(s, d, mulberry32(seed)) } });
  const ok = bunches3(); const r = auditRun(ok, D30); assert.equal(r.queue.length, 3); playT(r); const rec = r.finish();
  assert.ok(W1._nodes.A1.words.every((id) => ok.words[id].st === 'done' && ok.words[id].due === null)); assert.deepEqual(ok.bunches.A1, { due: D30, done: D30, result: 'ok' });
  assert.deepEqual([rec.bunchOk, rec.bunchDone, rec.reviews], [1, 1, 0]); assert.ok(rec.stars >= 9); assert.equal(bunchLeft(ok, 'B1').length, 10);
  const sp = bunches3(); const r2 = auditRun(sp, D30); const miss = r2.queue[1].id; playT(r2, (id) => id !== miss); const rec2 = r2.finish();
  assert.deepEqual([sp.words[miss].st, sp.words[miss].due], ['learn', addDays(D30, 1)]);
  for (const id of W1._nodes.A1.words.filter((x) => x !== miss)) assert.deepEqual([sp.words[id].st, sp.words[id].lstep, sp.words[id].due], ['likely', 0, addDays(D30, 7)]);
  assert.deepEqual([sp.bunches.A1.done, sp.bunches.A1.result, rec2.bunchOk, rec2.bunchDone], [D30, 'split', 0, 1]); assert.equal(planRun(sp, WORDS, addDays(D30, 7)).due.length, 9);
  const lm = bunches3(); const r3 = auditRun(lm, D30); let it = r3.show(); r3.pick((it.options.findIndex((o) => o.id === it.id) + 1) % 3); r3.advance(); r3.finish('left');   // a miss, then out
  assert.equal(lm.bunches.A1.result, 'split'); assert.equal(lm.words[it.id].st, 'learn'); assert.equal(bunchLeft(lm, 'A1').length, 0); assert.equal(lm.words[r3.queue[1].id].due, addDays(D30, 7));
  const lo = bunches3(); const before = JSON.stringify(lo.words); const r4 = auditRun(lo, D30); it = r4.show(); r4.pick(it.options.findIndex((o) => o.id === it.id)); r4.advance(); r4.finish('left');   // right, then out
  assert.deepEqual(lo.bunches.A1, { due: D30, done: null }); assert.equal(JSON.stringify(lo.words), before);
  assert.equal(auditPick(lo, addDays(D30, 1), mulberry32(9)).picks.filter((p) => p.bunch === 'A1').length, 3);   // drawn again next time
});

tileTest('T7: a passed word missed in a castle test becomes a learning word and is no longer sampled from its bunch', () => {
  const s = newState('son'); for (const id of ['A1', 'A2', 'B1', 'C1']) { const t = triageRun(s, id); playT(t.run); finishT(s, t); }
  const node = nodeRun(IX, view(s), 'castle', s, WORDS, () => .999); const x = node.scope.castle.find((id) => bunchLeft(s, 'A1').includes(id)); assert.ok(x);
  exam(s, node, D1, (id) => id !== x); assert.deepEqual([s.words[x].st, s.words[x].due, s.words[x].bunch], ['learn', addDays(D1, 1), 'A1']);
  assert.ok(!bunchLeft(s, 'A1').includes(x)); for (let k = 0; k < 30; k++) assert.ok(auditPick(s, D30, mulberry32(k)).picks.every((p) => p.id !== x));
});

tileTest('T8: with TRIAGE.on = false the tile and monster runs are as before: no word list, no spot or bunch cards', () => {
  const s = bunches3(); const d = addDays(D1, 40); for (const w of W1._nodes.A2.words.slice(0, 8)) s.words[w] = { st: 'review', step: 1, due: d, firstDay: D1, lastDay: D1, lapses: 0 };
  TRIAGE.on = false; try {
    const v = view(s, d); const tile = nodeRun(IX, v, 'B2', s, WORDS, mulberry32(1)); const mon = nodeRun(IX, v, 'monster', s, WORDS, mulberry32(1));
    assert.deepEqual([tile.triage, tile.scope.audit, mon.scope.audit, auditPick(s, d, mulberry32(1))], [undefined, undefined, undefined, null]);
    const run = mkRun(s, tile, d); assert.ok(run.queue.every((q) => q.role === 'new' || q.role === 'review')); assert.equal(run.queue.filter((q) => q.role === 'new' && q.form === 'judge' && !q.taught).length, 10);
    const f = newState('son'); clear(f, 'A1'); assert.ok(Object.values(f.words).every((r) => !('bunch' in r) && r.due)); assert.deepEqual(f.bunches, {});
  } finally { TRIAGE.on = true; }
});

tileTest('T10: passed words and bunch checks never change the schedule of any other word', () => {
  const s = newState('son'); const other = worldWords(W2); other.forEach((id, i) => { s.words[id] = { st: i % 3 ? 'review' : 'done', step: i % 5, due: i % 3 ? addDays(D1, 60 + i) : null, firstDay: '2026-11-01', lastDay: '2026-11-01', lapses: 0 }; });
  const before = JSON.stringify(other.map((id) => s.words[id]));
  const ids = W1._nodes.A1.words; const t = triageRun(s, 'A1', ids.slice(0, 2)); const miss = t.node.scope.triage.spot[0]; playT(t.run, (id) => id !== miss); finishT(s, t);
  const t2 = triageRun(s, 'B1', [], addDays(D1, 1)); playT(t2.run); finishT(s, t2, addDays(D1, 1));
  const r = new Run({ state: s, words: WORDS, today: D30, rng: mulberry32(3), scope: { noNew: true, audit: auditPick(s, D30, mulberry32(3)) } }); const m = r.queue[0].id; playT(r, (id) => id !== m); r.finish();
  const r2 = new Run({ state: s, words: WORDS, today: addDays(D1, 31), rng: mulberry32(4), scope: { noNew: true, audit: auditPick(s, addDays(D1, 31), mulberry32(4)) } }); playT(r2); r2.finish();
  assert.deepEqual([s.bunches.A1.result, s.bunches.B1.result], ['split', 'ok']);
  assert.equal(JSON.stringify(other.map((id) => s.words[id])), before);
  assert.ok(Object.keys(s.words).every((id) => other.includes(id) || ids.includes(id) || W1._nodes.B1.words.includes(id)));
});

tileTest('T11: a word passed into a bunch that was already checked gets its own 7-day check; a due bunch with no passed word left is closed', () => {
  const s = newState('son'); const A1 = W1._nodes.A1.words; s.bunches = { A1: { due: D1, done: D1, result: 'ok' } };
  const run = new Run({ state: s, words: WORDS, today: D1, rng: mulberry32(1), scope: { newIds: A1, newPerRun: 10, duePerRun: 0, triage: { bunch: 'A1', passed: A1.slice(0, 3), tapped: [], spot: [], due: addDays(D1, 30) } } });
  for (const id of A1.slice(0, 3)) assert.deepEqual([s.words[id].st, s.words[id].due, s.words[id].bunch], ['likely', addDays(D1, 7), undefined]);
  assert.deepEqual(s.bunches.A1, { due: D1, done: D1, result: 'ok' }); assert.ok(run);
  const e = newState('x'); e.bunches = { B1: { due: D1, done: null }, C1: { due: D1, done: null } }; const C1 = W1._nodes.C1.words;
  for (const id of C1.slice(0, 4)) e.words[id] = { st: 'likely', lstep: 0, due: null, bunch: 'C1', firstDay: '2026-10-01', lastDay: '2026-10-01', lapses: 0 };
  const pick = auditPick(e, D1, mulberry32(2)); assert.deepEqual([e.bunches.B1.done, e.bunches.B1.result], [D1, 'empty']); assert.equal(e.bunches.C1.done, null);
  assert.deepEqual([...new Set(pick.picks.map((p) => p.bunch))], ['C1']); assert.equal(pick.picks.length, 3);
});

// ---- fixes from the cross review C-005 (card T-011) ----
oldTest('F7: a tile run left with only the last re-check to go keeps the tile open and the next tile locked, also after a reload; finishing a run of it clears it', () => {
  const s = newState('son'); const node = nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1)); startTile(s, node, D1);          // the screen marks the tile when the run starts
  const run = new Run({ state: s, words: WORDS, today: D1, rng: () => 0.9, scope: node.scope, tag: node.tag });                 // 0.9: no "know" is checked
  const miss = run.queue[9].id; assert.equal(run.queue.filter((q) => q.role === 'new').length, 10);
  while (run.current.role === 'new') { const it = run.show(); run.judge(it.id !== miss); run.advance(); }                          // nine known, the tenth not: its re-check is left
  assert.deepEqual([run.current.role, run.current.final, run.left], ['relearn', true, 1]);
  const rec = run.finish('left'); const r = settle(s, node, run, rec, D1);
  assert.deepEqual([r.cleared, Object.keys(s.words).length, Object.values(s.words).filter((w) => w.st === 'learn').length, s.map.worlds['d1-01'].open.A1], [false, 10, 1, D1]);
  const looks = (st) => { const v = view(st); assert.deepEqual([status(v, 'A1'), status(v, 'A2'), v.unitsDone, reach(W1, st).open.has('A1'), reach(W1, st).reached.has('A1')], ['open', 'locked', 0, true, false]); assert.equal(nodeRun(IX, v, 'A2', st, WORDS, mulberry32(1)), null); };
  looks(s); looks(JSON.parse(JSON.stringify(s)));                                                                                   // the same after a reload
  const again = nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1)); assert.ok(again); startTile(s, again, D1);
  const r2 = mkRun(s, again); assert.equal(r2.queue.length, 0, 'nothing left to show today: the run ends at once'); const rec2 = r2.finish(); const out = settle(s, again, r2, rec2, D1);
  assert.deepEqual([out.cleared, status(view(s), 'A1'), status(view(s), 'A2'), view(s).unitsDone, s.map.worlds['d1-01'].open.A1], [true, 'cleared', 'open', 1, undefined]);
  const old = newState('son'); for (const id of W1._nodes.A1.words) old.words[id] = { st: 'likely', lstep: 0, due: '2026-11-19', firstDay: D1, lastDay: D1, lapses: 0 };   // saved before the marks: no `open`
  assert.deepEqual([status(view(old), 'A1'), status(view(old), 'A2')], ['cleared', 'open']);
  const c = newState('son'); meetAll(c, W1); ensureMap(c).worlds['d1-01'] = { castle: D1, cleared: {}, stamps: {}, seen: D1, open: { B2: D1 } };    // the crown and the count wait for the unfinished tile
  assert.deepEqual([crowned(W1, c), view(c).crown, view(c).unitsDone, view(c).units, status(view(c), 'B2')], [false, false, 5, 6, 'open']);
});

test('F6: everything finished and 3 words still to learn: the map offers "review 3" and it starts with those cards; no button with a monster or with nothing waiting; a full gauge blocks it', () => {
  const T = '2026-11-16'; const s = newState('son'); const m = ensureMap(s);
  for (const w of IX.worlds) { meetAll(s, w); m.worlds[w.id] = { castle: '2026-11-10', cleared: {}, stamps: {}, seen: '2026-11-01' }; } for (const c of IX.continents) m.conts[c.id] = { castle: '2026-11-10' };
  const learn = WORDS.filter((w) => w.ko).slice(0, 3).map((w) => w.id); for (const id of learn) s.words[id] = { st: 'learn', due: '2026-11-15', firstDay: '2026-11-01', lastDay: '2026-11-14', lapses: 0 };
  for (const w of IX.worlds) { const v = view(s, T, w); assert.deepEqual([v.monster.present, v.bat.full, v.review], [false, false, { present: true, count: 3 }], w.id);
    assert.ok([...v.nodes, ...v.houses].every((n) => { const r = nodeRun(IX, v, n.id, s, WORDS, mulberry32(1)); return !r || r.kind === 'practice'; }), w.id + ': no other run starts (cleared tiles only offer practice)'); }
  assert.ok(IX.continents.every((c) => !finaleRun(IX, c, s, T, mulberry32(1))));
  const v = view(s, T, W3); const node = nodeRun(IX, v, 'review', s, WORDS, mulberry32(1)); assert.deepEqual([node.kind, node.scope.noNew, node.scope.duePerRun], ['review', true, 14]);
  const run = mkRun(s, node, T); assert.deepEqual(run.queue.map((q) => q.role + ':' + q.id).sort(), learn.map((id) => 'retry:' + id).sort());
  play(run, () => true); const rec = run.finish(); const out = settle(s, node, run, rec, T);
  assert.ok(out.stars > 0); assert.deepEqual([out.mult, out.item, out.monster], [1, null, false]); assert.ok(learn.every((id) => s.words[id].st === 'review'));
  assert.equal(view(s, T, W3).review.present, false); assert.equal(nodeRun(IX, view(s, T, W3), 'review', s, WORDS, mulberry32(1)), null);   // scored today: nothing waiting
  const mon = newState('son'); WORDS.slice(0, 8).forEach((w) => { mon.words[w.id] = { st: 'review', step: 1, due: T, firstDay: '2026-11-01', lastDay: '2026-11-05', lapses: 0 }; });
  const mv = view(mon, T); assert.deepEqual([mv.monster.present, mv.review.present], [true, false]); assert.equal(nodeRun(IX, mv, 'review', mon, WORDS, mulberry32(1)), null);
  const few = newState('son'); WORDS.slice(0, 2).forEach((w) => { few.words[w.id] = { st: 'review', step: 1, due: T, firstDay: '2026-11-01', lastDay: '2026-11-05', lapses: 0 }; }); assert.deepEqual(view(few, T).review, { present: true, count: 2 });
  ensureMap(few).bat.fill = 99; const fv = view(few, T); assert.equal(fv.bat.full, true); assert.equal(nodeRun(IX, fv, 'review', few, WORDS, mulberry32(1)), null);
});

test('F8: a continent castle marked pending-config (or with cards / passRate null) is "준비 중": it never starts and never opens the next continent; with values or without a finale it works', () => {
  const ixWith = (f) => { const doc = JSON.parse(JSON.stringify(DOC)); if (f === undefined) delete doc.continents[0].finale; else doc.continents[0].finale = f; return indexWorlds(doc); };
  const crowns = (ix) => { const s = newState('son'); const m = ensureMap(s); for (const w of ix.continents[0].worlds) { meetAll(s, w); m.worlds[w.id] = { castle: D1, cleared: {}, stamps: {}, seen: D1 }; } return s; };
  const pass = (ix, s, node) => settleWorld(ix, s, node, { reason: 'done', castleOk: 40, castleMiss: 0 }, D1);
  for (const f of [{ name: '큰 배 문', cards: null, passRate: null, status: 'pending-config' }, { cards: 40, passRate: 0.75, status: 'pending-config' }, { cards: null, passRate: 0.75 }, { cards: 40, passRate: null }]) {
    const ix = ixWith(f); const s = crowns(ix); const c = ix.continents[0]; const k = JSON.stringify(f);
    assert.deepEqual([atlasView(ix, s)[0].crowns, atlasView(ix, s)[0].finale.status], [2, 'pending'], k); assert.equal(finaleRun(ix, c, s, D1, mulberry32(1)), null, k);
    const out = pass(ix, s, { kind: 'finale', cid: c.id, tag: 'finale:' + c.id, pass: 0.75 }); assert.deepEqual([out.finale.pass, out.nextContinent, worldOpen(ix, ix.byId['d2-01'], s)], [false, null, false], k);
  }
  for (const f of [{ cards: 10, passRate: 0.7, status: 'draft' }, undefined]) {
    const ix = ixWith(f); const s = crowns(ix); const c = ix.continents[0]; assert.equal(atlasView(ix, s)[0].finale.status, 'open');
    const node = finaleRun(ix, c, s, D1, mulberry32(1)); assert.ok(node); assert.equal(node.pass, f ? 0.7 : FINALE.pass);
    const out = pass(ix, s, node); assert.deepEqual([out.finale.pass, out.nextContinent.id, worldOpen(ix, ix.byId['d2-01'], s)], [true, 'd2', true]);
  }
});

// T-006: one wrong answer of a meaning card comes from the same theme and part of speech.
const themed = (n, over = {}, theme = '동물', pos = '명사') => Array.from({ length: n }, (_, i) => ({ id: `${theme}${pos}${i}`, form: `w${theme}${i}`, ko: `${theme}-${i}`, type: 't', theme, pos, ...over }));
const filler = (n) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, form: `fill${i}`, ko: `채움${i}`, type: 't', theme: `딴${i}`, pos: '명사' }));
const optIds = (deck, id, seed, cfg) => { const r = new Run({ state: newState('o'), words: deck, today: D1, rng: mulberry32(seed), cfg: { ...CFG, ...cfg } }); return r._options(id).map((o) => o.id); };
const confusableOf = (a, b) => !!(a.groups && b.groups && a.groups.some((g) => b.groups.includes(g)));

test('O1: a card with 5+ same theme and part of speech candidates always gets at least one wrong answer from them (200 draws)', () => {
  const deck = [...themed(6), ...filler(30)]; const id = deck[0].id; let n = 0;
  for (let k = 1; k <= 200; k++) { const ids = optIds(deck, id, k); assert.equal(ids.length, 3); assert.ok(ids.includes(id));
    assert.ok(ids.some((x) => x !== id && deck.find((w) => w.id === x).theme === '동물'), `seed ${k}`); n++; }
  assert.equal(n, 200);
});

test('O2: with 4 candidates, a theme containing 보완 or 기타, or no theme, the options equal those with themeOption off (same seed)', () => {
  const four = [...themed(5), ...filler(30)];                                     // 4 candidates besides the card itself
  const hole = [...themed(8, {}, '동물(보완)'), ...filler(30)], etc = [...themed(8, {}, '기타'), ...filler(30)];
  const none = [...themed(8).map(({ theme, pos, ...w }) => w), ...filler(30)];
  for (const [deck, id] of [[four, four[0].id], [hole, hole[0].id], [etc, etc[0].id], [none, none[0].id]])
    for (let k = 1; k <= 50; k++) assert.deepEqual(optIds(deck, id, k, { themeOption: true }), optIds(deck, id, k, { themeOption: false }));
  const on = [...themed(8), ...filler(30)]; let differs = false;                  // sanity: with enough candidates, the switch does matter
  for (let k = 1; k <= 50; k++) if (optIds(on, on[0].id, k, { themeOption: true }).join() !== optIds(on, on[0].id, k, { themeOption: false }).join()) differs = true;
  assert.ok(differs);
});

test('O3: a same-theme card that shares a confusion group, or shows the same text, is never offered', () => {
  const deck = [...themed(9), ...filler(20)]; deck[0].groups = ['g']; deck[1].groups = ['g']; deck[2].ko = deck[0].ko;
  for (let k = 1; k <= 200; k++) { const ids = optIds(deck, deck[0].id, k); assert.ok(!ids.includes(deck[1].id) && !ids.includes(deck[2].id), `seed ${k}`); assert.equal(new Set(ids.map((x) => deck.find((w) => w.id === x).ko)).size, 3); }
});

test('O4: in the real catalogue every meaning card gets three options with three different displays (all cards, once each)', () => {
  const cat = JSON.parse(fs.readFileSync('cards/data/catalogue.json', 'utf8'));
  const words = cat.words.map((w) => ({ ...w, track: w.track || (w.answerMode === 'listen-spelling' || w.learningKind === 'sight' ? 'sight' : 'vocab'), groups: w.groups || (w.confusionGroups?.length ? w.confusionGroups : undefined) }));
  const run = new Run({ state: newState('o'), words, today: D1, rng: mulberry32(7) }); let meaning = 0, themeRule = 0;
  const key = (w) => `${w.theme}|${w.pos}`; const byKey = new Map();
  for (const w of words) { const a = byKey.get(key(w)) || []; a.push(w); byKey.set(key(w), a); }
  for (const w of words) { if (w.track === 'sight' || !w.ko) continue; meaning++;
    const o = run._options(w.id); assert.equal(o.length, 3, w.id); assert.equal(new Set(o.map((x) => x.ko)).size, 3, w.id); assert.ok(o.some((x) => x.id === w.id), w.id);
    if (w.theme && w.pos && !/기타|보완/.test(w.theme) && byKey.get(key(w)).filter((x) => x.id !== w.id && x.track !== 'sight' && x.ko && x.ko !== w.ko && !confusableOf(w, x)).length >= 5) themeRule++; }
  console.log(`O4 counts: meaning cards ${meaning}, rule 3 applies ${themeRule}, falls back ${meaning - themeRule}`);
  assert.ok(meaning > 0);
});

// C-006: fill the remaining meaning choices from the exact POS bucket before the old fallback.
test('O5: both wrong answers have the exact POS with and without enough same-theme candidates (200 draws each)', () => {
  assert.equal(CFG.posOption, true);
  for (const hasTheme of [true, false]) {
    const nouns = themed(6).map((w, i) => ({ ...w, type: 'noun-picture', theme: hasTheme ? '동물' : `서로다른주제${i}` }));
    const others = filler(30).map((w) => ({ ...w, pos: '동사', type: 'verb-picture' }));
    nouns[0].type = 'verb-picture'; // Legacy type fallback would choose verbs, so this checks the new source.
    const deck = [...nouns, ...others]; const byId = Object.fromEntries(deck.map((w) => [w.id, w]));
    for (let seed = 1; seed <= 200; seed++) {
      const ids = optIds(deck, nouns[0].id, seed);
      assert.equal(ids.length, 3); assert.ok(ids.includes(nouns[0].id));
      const wrong = ids.filter((id) => id !== nouns[0].id);
      assert.equal(wrong.length, 2); assert.ok(wrong.every((id) => byId[id].pos === nouns[0].pos), `${hasTheme}/${seed}`);
      if (hasTheme) assert.ok(wrong.some((id) => byId[id].theme === nouns[0].theme));
    }
  }
});

test('O6: missing POS or a bucket of four preserves choices and RNG calls with posOption on/off', () => {
  const absent = [...themed(8).map(({ pos, ...w }) => w), ...filler(30)];
  const four = [...themed(4), ...filler(30).map((w) => ({ ...w, pos: '동사' }))];
  for (const deck of [absent, four]) for (let seed = 1; seed <= 200; seed++) {
    const draw = (enabled) => { const random = mulberry32(seed); const trace = [];
      const run = new Run({ state: newState('o'), words: deck, today: D1, cfg: { ...CFG, posOption: enabled }, rng: () => { const n = random(); trace.push(n); return n; } });
      return { options: run._options(deck[0].id), trace }; };
    assert.deepEqual(draw(true), draw(false), `${deck === absent ? 'missing' : 'four'}/${seed}`);
  }
});

test('O7: the POS draw excludes confusion groups, repeated displays, and sight cards, and caps retries at 30', () => {
  const deck = themed(9).map((w, i) => ({ ...w, theme: `별도주제${i}` }));
  deck[0].groups = ['shared']; deck[1].groups = ['shared']; deck[2].ko = deck[0].ko;
  deck[3].ko = '겹친오답'; deck[4].ko = '겹친오답';
  deck.push({ id: 'sight-pos', form: 'the', ko: '', track: 'sight', type: 't', pos: '명사' });
  for (let seed = 1; seed <= 200; seed++) {
    const ids = optIds(deck, deck[0].id, seed);
    assert.equal(ids.length, 3); assert.ok(ids.includes(deck[0].id));
    assert.ok(!ids.some((id) => [deck[1].id, deck[2].id, 'sight-pos'].includes(id)), `seed ${seed}`);
    assert.equal(new Set(ids.map((id) => deck.find((w) => w.id === id).ko)).size, 3);
  }
  // A degenerate RNG keeps hitting the answer. POS stops after 30, then the existing fallback rescues it.
  const bounded = themed(5).map((w, i) => ({ ...w, theme: `単独${i}` }));
  const run = new Run({ state: newState('o'), words: bounded, today: D1, rng: () => 0, cfg: { ...CFG, themeOption: false } });
  const pool = run.ix.byPos.get(bounded[0].pos); let reads = 0;
  run.ix.byPos.set(bounded[0].pos, new Proxy(pool, { get: (target, key) => { if (/^\d+$/.test(String(key))) reads++; return Reflect.get(target, key); } }));
  assert.equal(run._options(bounded[0].id).length, 3); assert.equal(reads, 30);
});

test('O8: all real meaning cards have distinct displays; count both-POS and fallback outcomes', () => {
  const cat = JSON.parse(fs.readFileSync('cards/data/catalogue.json', 'utf8'));
  const words = cat.words.map((w) => ({ ...w, track: w.track || (w.answerMode === 'listen-spelling' || w.learningKind === 'sight' ? 'sight' : 'vocab'), groups: w.groups || (w.confusionGroups?.length ? w.confusionGroups : undefined) }));
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const run = new Run({ state: newState('o'), words, today: D1, rng: mulberry32(7), cfg: { ...CFG, posOption: true } });
  let bothPos = 0, other = 0;
  for (const w of words) {
    if (w.track === 'sight' || !w.ko) continue;
    const options = run._options(w.id); const wrong = options.filter((o) => o.id !== w.id);
    assert.equal(options.length, 3, w.id); assert.equal(wrong.length, 2, w.id);
    assert.equal(new Set(options.map((o) => o.ko)).size, 3, w.id);
    assert.ok(wrong.every((o) => byId[o.id].ko && byId[o.id].track !== 'sight' && !confusableOf(w, byId[o.id])), w.id);
    if (w.pos && wrong.every((o) => byId[o.id].pos === w.pos)) bothPos++; else other++;
  }
  assert.equal(bothPos + other, words.filter((w) => w.track !== 'sight' && w.ko).length);
  assert.ok(bothPos > 0);
  console.log(`O8 counts (seed 7, catalogue order, one draw/card): both wrong answers same POS ${bothPos}; otherwise ${other}; total ${bothPos + other}`);
});

// C-013: gate stamps are computed from tile completion, never saved as prizes.
const meetTiles = (state, world, ids) => {
  for (const tid of ids) for (const id of world._nodes[tid].words)
    state.words[id] = { st: 'done', due: null, firstDay: D1, lastDay: D1, lapses: 0 };
};
test('W14: the shortest route reaches the castle but lacks the village minimum and both stamps', () => {
  const s = newState('son'); meetTiles(s, W1, ['A1', 'A2']); const v = view(s);
  assert.equal(reach(W1, s).castle, true); assert.equal(v.gate.reachable, true);
  assert.deepEqual([v.gate.tilesDone, v.gate.totalTiles, v.gate.minTiles, v.gate.ready], [2, 6, 4, false]);
  assert.deepEqual(v.gate.stamps.map((x) => [x.id, x.collected]), [['A', false], ['B', false]]);
  assert.equal(v.castle.status, 'locked'); assert.equal(nodeRun(IX, v, 'castle', s, WORDS, mulberry32(1)), null);
});
test('W15: K alone is insufficient; both stamps open the castle and an unfinished stamp tile closes even a stale view', () => {
  const s = newState('son'); meetTiles(s, W1, ['A1', 'A2', 'B1', 'B2']); let v = view(s);
  assert.equal(v.gate.tilesDone, 4); assert.deepEqual(v.gate.stamps.map((x) => x.collected), [true, false]); assert.equal(v.castle.status, 'locked');
  for (const id of W1._nodes.B2.words) delete s.words[id]; meetTiles(s, W1, ['C1']); v = view(s);
  assert.equal(v.gate.tilesDone, 4); assert.equal(v.castle.status, 'open'); assert.ok(nodeRun(IX, v, 'castle', s, WORDS, mulberry32(1)));
  const before = JSON.stringify([s.words, s.bunches, s.forms]);
  ensureMap(s).worlds[W1.id].open = { C1: D1 };
  assert.equal(view(s).gate.stamps[1].collected, false); assert.equal(view(s).gate.tilesDone, 3);
  assert.equal(nodeRun(IX, v, 'castle', s, WORDS, mulberry32(1)), null, 'entry must recheck live records');
  assert.deepEqual(ensureMap(s).worlds[W1.id].stamps, {}); assert.equal(JSON.stringify([s.words, s.bunches, s.forms]), before);
});
oldTest('W16: a legal gate and castle pass open the next world while other branch villages stay optional and pay double', () => {
  const s = newState('son'); ensureMap(s).bat.cap = 80;
  for (const id of ['A1', 'A2', 'B1', 'C1']) clear(s, id);
  assert.equal(view(s).gate.ready, true); assert.equal(worldOpen(IX, W2, s), false);
  const result = exam(s, nodeRun(IX, view(s), 'castle', s, WORDS, mulberry32(1)), D1);
  assert.equal(result.out.castle.pass, true); assert.equal(worldOpen(IX, W2, s), true); assert.equal(view(s).crown, false);
  assert.deepEqual(['B2', 'C2'].map((id) => [status(view(s), id), view(s).nodes.find((n) => n.id === id).bonus]), [['open', true], ['open', true]]);
  assert.equal(clear(s, 'B2').mult, 2); assert.equal(view(s).crown, false);
});
test('W17: continent admission requires every world castle and ceil(70% villages), with no crowns; unfinished villages do not count', () => {
  const s = newState('son'); meetTiles(s, W1, ['A1', 'A2', 'B1', 'C1']); meetTiles(s, W2, ['T1', 'T2', 'T4']);
  const m = ensureMap(s); for (const w of [W1, W2]) m.worlds[w.id] = { castle: D1, cleared: {}, stamps: {}, seen: D1 };
  let v = atlasView(IX, s)[0]; assert.deepEqual([v.gate.worldsPassed, v.gate.totalWorlds, v.gate.tilesDone, v.gate.totalTiles, v.gate.minTiles, v.gate.minTileRate], [2, 2, 7, 11, 8, .7]);
  assert.equal(v.finale.status, 'locked'); assert.equal(finaleRun(IX, DOC.continents[0], s, D1, mulberry32(1)), null);
  meetTiles(s, W1, ['B2']); v = atlasView(IX, s)[0]; assert.equal(v.crowns, 0); assert.equal(v.gate.tilesDone, 8); assert.equal(v.finale.status, 'open');
  assert.ok(finaleRun(IX, DOC.continents[0], s, D1, mulberry32(1)));
  m.worlds[W1.id].open = { B2: D1 }; m.worlds[W1.id].cleared.B2 = D1;
  assert.equal(atlasView(IX, s)[0].gate.tilesDone, 7); assert.equal(finaleRun(IX, DOC.continents[0], s, D1, mulberry32(1)), null);
  delete m.worlds[W1.id].open.B2; m.worlds[W2.id].castle = null;
  assert.equal(atlasView(IX, s)[0].gate.tilesDone, 8); assert.equal(finaleRun(IX, DOC.continents[0], s, D1, mulberry32(1)), null);
});
test('W18: previously passed world and continent castles stay cleared even when their new gates are not met', () => {
  const s = newState('son'); const m = ensureMap(s);
  m.worlds[W1.id] = { castle: '2026-11-01', cleared: {}, stamps: {}, seen: '2026-11-01' }; m.conts.d1 = { castle: '2026-11-02' };
  const before = JSON.stringify(s.words); assert.equal(view(s).gate.ready, false); assert.equal(view(s).castle.status, 'cleared');
  assert.equal(worldOpen(IX, W2, s), true); assert.equal(worldOpen(IX, W3, s), true);
  assert.equal(atlasView(IX, s)[0].gate.ready, false); assert.equal(atlasView(IX, s)[0].finale.status, 'cleared');
  assert.equal(m.worlds[W1.id].castle, '2026-11-01'); assert.equal(m.conts.d1.castle, '2026-11-02'); assert.equal(JSON.stringify(s.words), before);
});
test('W19: all 30 real world gates can be satisfied, and only their met cards enter unchanged castle exams', () => {
  const ix = indexWorlds(JSON.parse(fs.readFileSync('cards/data/worlds.json', 'utf8'))); assert.equal(ix.worlds.length, 30);
  for (const w of ix.worlds) {
    const s = newState('son'), tiles = w.map.nodes.filter((n) => n.kind === 'tile'); meetTiles(s, w, tiles.map((n) => n.id));
    const v = worldView(ix, w, s, D1), k = w.castleRule.minTiles;
    assert.ok(k >= Math.ceil(tiles.length / 2) && k <= Math.floor(tiles.length * .7), w.id);
    assert.equal(v.gate.stamps.length, 2); assert.equal(new Set(v.gate.stamps.map((x) => x.nodeId)).size, 2);
    assert.ok(v.gate.stamps.every((x) => x.collected)); assert.equal(v.gate.ready, true); assert.equal(v.castle.status, 'open');
    const before = JSON.stringify(s.words), node = nodeRun(ix, v, w.map.castleNodeId, s, [], mulberry32(1));
    assert.equal(node.scope.castle.length, 12); assert.equal(node.pass, .8); assert.ok(node.scope.castle.every((id) => s.words[id] && worldWords(w).includes(id)));
    assert.equal(JSON.stringify(s.words), before); assert.deepEqual(ensureMap(s).worlds[w.id].stamps, {});
  }
});
test('W20: malformed explicit exploration rules are data errors; absent or reach legacy rules retain physical reach', () => {
  for (const change of [(w) => delete w.castleRule.minTiles, (w) => delete w.castleRule.stamps, (w) => delete w.castleRule.cards, (w) => { w.castleRule.stamps[1].nodeId = w.castleRule.stamps[0].nodeId; }]) {
    const doc = JSON.parse(JSON.stringify(DOC)); change(doc.continents[0].worlds[0]); assert.throws(() => indexWorlds(doc), /우표/);
  }
  const bad = JSON.parse(JSON.stringify(DOC)); delete bad.continents[0].finale.minTileRate; assert.throws(() => indexWorlds(bad), /비율/);
  for (const legacy of [undefined, { type: 'reach', cards: 12, passRate: .8 }]) {
    const doc = JSON.parse(JSON.stringify(DOC)); doc.continents[0].worlds[0].castleRule = legacy; const ix = indexWorlds(doc), w = ix.worlds[0], s = newState('son'); meetTiles(s, w, ['A1', 'A2']);
    assert.equal(worldView(ix, w, s, D1).castle.status, 'open'); assert.ok(nodeRun(ix, worldView(ix, w, s, D1), w.map.castleNodeId, s, WORDS, mulberry32(1)));
  }
});

tileTest('P1: a cleared tile can be played again as practice: check cards of its met words; the schedule, grades, bunches and bat gauge stay; a miss is kept on the word', () => {
  const s = newState('son'); clear(s, 'A1'); const v = view(s); assert.equal(status(v, 'A1'), 'cleared');
  const node = nodeRun(IX, v, 'A1', s, WORDS, mulberry32(3)); assert.equal(node.kind, 'practice'); assert.ok(node.scope.practice.length > 0);
  const tile = W1.map.nodes.find((n) => n.id === 'A1'); assert.ok(node.scope.practice.every((id) => tile.words.includes(id) && s.words[id]));
  const keep = (x) => JSON.stringify(Object.fromEntries(Object.entries(x.words).map(([k, r]) => [k, { st: r.st, step: r.step, lstep: r.lstep, due: r.due }])));
  const before = [keep(s), JSON.stringify(s.bunches), JSON.stringify(ensureMap(s).bat)];
  const run = mkRun(s, node); assert.ok(run.queue.every((q) => q.role === 'practice' && q.form === 'check'));
  let first = null;
  for (let it = run.show(); it; it = run.show()) { const right = it.options.findIndex((o) => o.id === it.id); if (!first) { first = it.id; run.pick((right + 1) % 3); } else run.pick(right); run.advance(); }
  const rec = run.finish('done'); settleRun(s, node, run, rec, D1, mulberry32(1)); settleWorld(IX, s, node, rec, D1);
  assert.deepEqual([keep(s), JSON.stringify(s.bunches), JSON.stringify(ensureMap(s).bat)], before, 'nothing on the schedule moved');
  assert.equal(s.words[first].misses, 1); assert.equal(rec.stars, 0);
  assert.equal(status(view(s), 'A1'), 'cleared', 'still cleared');
});

tileTest('T12: with a difficulty table the spot checks are the hardest passed words; all known on a 10-word tile gives 3 checks', () => {
  const ids = W1._nodes.A1.words; const hard = Object.fromEntries(ids.map((id, i) => [id, i * 10]));
  const p = triagePlan(ids, [], mulberry32(4), (id) => hard[id]); assert.equal(p.spot.length, 3);
  assert.deepEqual([...p.spot].sort(), [...ids].slice(-3).sort());
  const q = triagePlan(ids, ids.slice(-2), mulberry32(4), (id) => hard[id]); assert.deepEqual([...q.spot].sort(), ids.slice(-5, -2).sort(), 'tapped words are not checked');
});

// ---- world sorting at the post office (TRIAGE.sort, the default; user request 2026-11-18) ----
// Sorts every page of W1; known(id) decides what the child taps. -> pages sorted
function sortAll(state, known = () => false, today = D1) { let n = 0; for (let v = sortView(W1, state); v.left && n < 50; v = sortView(W1, state), n++) sortPage(state, W1, v.page.filter(known), today, 1); return n; }

test('S1: the post office shows the world\'s words 10 at a time in world order; no tile run starts before every word was looked at', () => {
  const s = newState('son'); const all = [...new Set(worldWords(W1))]; const v = sortView(W1, s);
  assert.deepEqual([v.total, v.left, v.page], [all.length, all.length, all.slice(0, 10)]);
  assert.deepEqual(nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1)), { kind: 'sort', wid: W1.id });
  const known = v.page.slice(0, 3); assert.equal(sortPage(s, W1, known, D1, 5), 10);
  for (const id of known) { const { at, ...r } = s.words[id]; assert.deepEqual(r, { firstDay: D1, lapses: 0, st: 'likely', lstep: 0, due: null, bunch: W1.map.nodes.find((n) => n.words?.includes(id)).id, lastDay: D1 }); }
  assert.ok(v.page.slice(3).every((id) => !s.words[id])); assert.equal(ensureMap(s).bat.fill, 0);
  const v2 = sortView(W1, s); assert.deepEqual([v2.left, v2.page], [all.length - 10, all.slice(10, 20)]);   // words not tapped are not shown again
  assert.equal(nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1)).kind, 'sort');
  sortAll(s); assert.equal(sortView(W1, s).left, 0); const node = nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1));
  assert.deepEqual([node.kind, node.scope.teach, node.triage], ['tile', true, undefined]);
});

test('S2: a tile run teaches its new words (no "know?") and mixes in 2 passed words of the world, the hardest first; right = `ck`, wrong = learning word', () => {
  const s = newState('son'); const all = [...new Set(worldWords(W1))]; const hard = Object.fromEntries(all.map((id, i) => [id, i]));
  sortAll(s, (id) => !W1._nodes.A1.words.includes(id)); setHardness((id) => hard[id]);
  let node; try { node = nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1)); } finally { setHardness(null); }
  const passed = all.filter((id) => s.words[id]); const hardest = passed.slice().sort((a, b) => hard[b] - hard[a]).slice(0, 2);
  assert.deepEqual(node.scope.checks, hardest);
  const run = mkRun(s, node); const news = run.queue.filter((q) => q.role === 'new'); const spots = run.queue.filter((q) => q.role === 'spot');
  assert.deepEqual(news.map((q) => q.id).sort(), W1._nodes.A1.words.slice().sort()); assert.ok(news.every((q) => q.taught && q.form === 'judge'));
  assert.deepEqual(spots.map((q) => [q.id, q.form, q.kept]).sort(), hardest.map((id) => [id, 'check', true]).sort());
  const [good, bad] = hardest; const before = { ...s.words[good] }; let g = 0;
  while (run.current && g++ < 300) { const it = run.show(); const right = it.options ? it.options.findIndex((o) => o.id === it.id) : -1;
    if (it.form === 'judge') run.judge(it.taught ? false : true); else run.pick(it.id === bad && it.role === 'spot' ? (right + 1) % 3 : right); run.advance(); }
  const rec = run.finish(); assert.deepEqual([rec.spots, rec.spotOk, rec.claims], [2, 1, 0]);
  const { ck, lastDay, at, ...rest } = s.words[good]; const { lastDay: l0, at: a0, ...rest0 } = before; assert.deepEqual([ck, rest], [D1, rest0]);   // only the check day is added
  assert.equal(s.words[bad].misses, 1); assert.ok(['learn', 'review'].includes(s.words[bad].st)); assert.equal(s.words[bad].due, addDays(D1, 1));
  assert.ok(!checkPick(s, all, mulberry32(9)).includes(good), 'a word checked once is not picked again');
});

test('S3: a tile whose every word was called known still needs one run (open mark); the run is its checks and reviews, then it clears', () => {
  const s = newState('son'); sortAll(s, () => true); const ws = ensureMap(s).worlds[W1.id];
  assert.ok(W1.map.nodes.filter((n) => n.kind === 'tile').every((n) => ws.open[n.id] === D1)); assert.equal(status(view(s), 'A1'), 'open'); assert.equal(view(s).unitsDone, 0);
  const node = nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1)); startTile(s, node, D1); const run = mkRun(s, node);
  assert.ok(run.queue.length >= 1 && run.queue.every((q) => q.role === 'spot')); play(run, () => true); const r = settle(s, node, run, run.finish(), D1);
  assert.equal(r.cleared, true); assert.equal(status(view(s), 'A1'), 'cleared');
});

test('S4: with TRIAGE.on = false there is no post office: tiles start at once and new words are asked one card at a time', () => {
  TRIAGE.on = false; try { const s = newState('son'); const v = view(s); assert.equal(v.sort, null); const node = nodeRun(IX, v, 'A1', s, WORDS, mulberry32(1)); assert.deepEqual([node.kind, node.scope.teach, node.triage], ['tile', undefined, undefined]); } finally { TRIAGE.on = true; }
});

// ---- playhouse games: placement and levels (cards/js/games.js, docs/MINIGAMES.md) ----
import { gamePlan, playLevel, LEVELS, GAME_TYPES, DEBUT, shellSwaps, shellFollow, updownHint, mailPos, inZone, warmth, numEn, numKo, heartsHtml } from '../cards/js/games.js';
const REAL = indexWorlds(JSON.parse(fs.readFileSync('cards/data/worlds.json', 'utf8')));
test('G1: the real 30 worlds: 60 playhouses, the first four worlds bring in 8 games two by two at level 1, every game comes back, never the same pair twice in a row', () => {
  const plan = gamePlan(REAL); const ws = REAL.worlds; const all = ws.flatMap((w) => Object.values(plan[w.id]));
  assert.equal(all.length, 60);
  ws.slice(0, 4).forEach((w, i) => assert.deepEqual(Object.values(plan[w.id]).map((e) => [e.type, e.base]), DEBUT[i].map((t) => [t, 1])));
  for (const t of GAME_TYPES) assert.ok(all.filter((e) => e.type === t).length >= 6, t);
  for (let i = 0; i < ws.length; i++) { const p = Object.values(plan[ws[i].id]).map((e) => e.type); assert.equal(new Set(p).size, p.length, ws[i].id);
    if (i) assert.notDeepEqual(p.slice().sort(), Object.values(plan[ws[i - 1].id]).map((e) => e.type).sort(), ws[i].id); }
  const byC = REAL.continents.map((c) => c.worlds.flatMap((w) => Object.values(plan[w.id]).map((e) => e.base)));
  assert.deepEqual([Math.max(...byC[0]), Math.min(...byC[1]), Math.max(...byC[1]), Math.min(...byC[2])], [2, 2, 3, 4]);
  assert.deepEqual(gamePlan(REAL), plan, 'deterministic');
});
test('G2: level: base, +1 as a challenge once stamped (5 at most), -1 after two failures in a row (1 at least); every game has 5 levels', () => {
  assert.deepEqual([playLevel(1), playLevel(1, { stamped: true }), playLevel(5, { stamped: true }), playLevel(3, { fails: 1 }), playLevel(3, { fails: 2 }), playLevel(1, { fails: 5 }), playLevel(2, { stamped: true, fails: 2 })], [1, 2, 5, 3, 2, 1, 2]);
  for (const t of GAME_TYPES) assert.equal(LEVELS[t].length, 5, t);
  assert.deepEqual(LEVELS.memory.map((l) => l.pairs * 2), [6, 8, 12, 16, 20]);
  assert.deepEqual(LEVELS.mail.map((l) => [l.boxes.length, !!l.together]), [[1, false], [1, false], [2, false], [2, true], [3, true]]);
  for (const l of LEVELS.updown) assert.ok(l.tries >= Math.ceil(Math.log2(l.max + 1)), 'up-down can always be solved by halving: ' + l.max);
});
test('G3: game helpers: a followed box ends where the swaps take it; up-down hints; the mail zone', () => {
  const sw = shellSwaps(4, 50, mulberry32(3)); assert.ok(sw.every(([a, b]) => a !== b && a < 4 && b < 4));
  let slots = [0, 1, 2, 3]; for (const [a, b] of sw) { const i = slots.indexOf(a), j = slots.indexOf(b); slots[i] = b; slots[j] = a; }
  for (let box = 0; box < 4; box++) assert.equal(shellFollow(box, sw), slots[box]);
  assert.deepEqual([updownHint(40, 40), updownHint(40, 10), updownHint(40, 90)], [0, 1, -1]);
  assert.ok(inZone(mailPos(0), 26) && !inZone(mailPos(Math.PI / 2), 26));
});

// ---- castle word games (cards/js/wordgames.js) ----
import { Hangman, hangmanPick, spellable, buildCrossword, crossCells } from '../cards/js/wordgames.js';
test('H1: hangman word: letters only, 5+ letters first, then 4; the castle exam words before other met words; none -> null', () => {
  const W = (form) => ({ id: form, form });
  assert.deepEqual([spellable('apple'), spellable('ice cream'), spellable('t-shirt'), spellable('cat'), spellable('Bread')], [true, false, false, false, true]);
  for (let s = 1; s < 20; s++) assert.equal(hangmanPick([W('cat'), W('bird'), W('apple'), W('look at')], [W('banana')], mulberry32(s)).form, 'apple');
  assert.equal(hangmanPick([W('cat'), W('bird')], [W('banana')], mulberry32(1)).form, 'bird', 'a 4-letter exam word comes before other met words');
  assert.equal(hangmanPick([W('cat'), W('ox')], [W('dogs'), W('banana')], mulberry32(1)).form, 'banana', 'no exam word of 4+: a met word, 5+ first');
  assert.equal(hangmanPick([W('cat')], [W('go on')], mulberry32(1)), null);
});
test('H2: hangman rules: hits, misses, repeats cost nothing, lives run out; several words share the lives; a reveal shows the first letter', () => {
  const h = new Hangman(['apple']); assert.deepEqual([h.guess('p'), h.guess('p'), h.guess('z'), h.shown.join('')], ['hit', 'again', 'miss', 'pp']);
  for (const c of 'qwxyv') h.guess(c); assert.equal(h.lost, true); assert.equal(h.guess('a'), 'again');
  const m = new Hangman(['cat', 'dog'], 8); assert.deepEqual(['c', 'a', 't'].map((c) => m.guess(c)), ['hit', 'hit', 'next']); assert.equal(m.word, 'dog');
  assert.deepEqual(['d', 'o', 'g'].map((c) => m.guess(c)), ['hit', 'hit', 'win']);
  assert.deepEqual(new Hangman(['apple'], 6, 1).shown, ['a', '', '', '', '']);
});
test('H3: crossword: words cross on equal letters, never run side by side, ends free; numbers by position; null when too few fit', () => {
  const words = ['apple', 'banana', 'grape', 'lemon', 'melon', 'orange', 'peach', 'plum'].map((f) => ({ id: f, form: f, ko: f }));
  for (let s = 1; s < 30; s++) { const cw = buildCrossword(words, mulberry32(s)); assert.ok(cw && cw.entries.length >= 4, 'seed ' + s);
    const cells = crossCells(cw); const used = new Map();
    for (const e of cw.entries) for (let i = 0; i < e.word.length; i++) { const k = (e.row + (e.dir === 'd' ? i : 0)) + ',' + (e.col + (e.dir === 'a' ? i : 0)); assert.equal(cells[k], e.word[i]); used.set(k, (used.get(k) || 0) + 1); }
    assert.ok([...used.values()].some((n) => n === 2), 'at least one crossing');
    for (const e of cw.entries) { const before = e.dir === 'a' ? [e.row, e.col - 1] : [e.row - 1, e.col]; const after = e.dir === 'a' ? [e.row, e.col + e.word.length] : [e.row + e.word.length, e.col];
      assert.ok(!cells[before.join(',')] && !cells[after.join(',')], 'ends free ' + e.word); }
    for (let i = 1; i < cw.entries.length; i++) { const a = cw.entries[i - 1], b = cw.entries[i]; assert.ok(a.row < b.row || (a.row === b.row && a.col <= b.col)); assert.ok(b.num >= a.num); } }
  assert.equal(buildCrossword(['cat', 'dog', 'ox'].map((f) => ({ id: f, form: f })), mulberry32(1)), null);
});

// ---- castle word games in the castle flow (FINAL on; docs/MINIGAMES.md 7) ----
const withFinal = (fn) => () => { FINAL.on = true; TRIAGE.on = false; try { return fn(); } finally { FINAL.on = false; TRIAGE.on = true; } };
legacyTest('CF1: a passed castle exam keeps the day and the right answers but gives no key; the castle then starts its word game; winning it gives the key and the next world', withFinal(() => {
  const s = newState('son'); ensureMap(s).bat.cap = 80; for (const id of ['A1', 'A2', 'B1', 'C1']) clear(s, id);
  const node = nodeRun(IX, view(s), 'castle', s, WORDS, mulberry32(1)); const run = mkRun(s, node); play(run, () => true); const rec = run.finish();
  const ok = node.scope.castle.slice(0, 5); const out = settleWorld(IX, s, node, rec, D1, { ok });
  assert.deepEqual([out.castle.pass, out.castle.final, out.key, ensureMap(s).keys, worldOpen(IX, W2, s)], [true, true, false, 0, false]);
  assert.deepEqual(examPending(s, W1.id), { day: D1, words: ok });
  const fin = nodeRun(IX, view(s), 'castle', s, WORDS, mulberry32(1)); assert.deepEqual([fin.kind, fin.wid, fin.words], ['final', W1.id, ok]);
  const d2 = addDays(D1, 1); const won = finishCastle(IX, s, W1.id, d2);
  assert.deepEqual([won.key, won.nextWorld.id, ensureMap(s).keys, ensureMap(s).worlds[W1.id].castle, worldOpen(IX, W2, s), examPending(s, W1.id)], [true, W2.id, 1, d2, true, null]);
  assert.equal(finishCastle(IX, s, W1.id, d2).key, false, 'only once'); assert.equal(nodeRun(IX, view(s, d2), 'castle', s, WORDS, mulberry32(1)), null);
}));
test('CF2: the continent castle the same way: exam pass kept, crossword pending, winning opens the next continent; a failed exam keeps nothing', withFinal(() => {
  const s = newState('son'); meetAll(s, W1); meetAll(s, W2); const m = ensureMap(s);
  m.worlds['d1-01'] = { castle: D1, cleared: {}, stamps: {}, seen: D1 }; m.worlds['d1-02'] = { castle: D1, cleared: {}, stamps: {}, seen: D1 };
  const fail = exam(s, finaleRun(IX, DOC.continents[0], s, D1, mulberry32(1)), D1, () => false); assert.equal(fail.out.finale.pass, false); assert.equal(m.conts.d1?.exam, undefined);
  const node = finaleRun(IX, DOC.continents[0], s, D1, mulberry32(2)); const run = mkRun(s, node); play(run, () => true); const out = settleWorld(IX, s, node, run.finish(), D1, { ok: node.scope.castle });
  assert.deepEqual([out.finale.pass, out.finale.final, out.cleared, worldOpen(IX, W3, s)], [true, true, false, false]);
  const fin = finaleRun(IX, DOC.continents[0], s, D1, mulberry32(3)); assert.deepEqual([fin.kind, fin.cid, fin.words.length], ['finalc', 'd1', node.scope.castle.length]);
  const won = finishFinale(IX, s, 'd1', D1); assert.deepEqual([won.cleared, won.nextContinent.id, worldOpen(IX, W3, s)], [true, 'd2', true]);
}));

test('G4: reworked levels (user 2026-11-20): pairs flip limit 40, bat tap and mailbox with 3 hearts, bat tap not faster than 1 s, house number changes its help, quick draw changes its task, number words', () => {
  assert.equal(LEVELS.memory[4].flips, 40);
  assert.ok(LEVELS.whack.every((l) => l.show >= 1000), 'no level faster than 1 s');
  assert.deepEqual(LEVELS.whack.map((l) => [!!l.armored, !!l.sleepy]), [[false, false], [false, false], [false, false], [true, false], [true, true]]);
  assert.deepEqual(LEVELS.updown.map((l) => [!!l.bar, !!l.history, l.lang || 'hot']), [[true, true, 'ko'], [false, true, 'ko'], [false, true, 'en'], [false, false, 'en'], [false, true, 'hot']]);
  assert.deepEqual(LEVELS.quick.map((l) => l.mode), ['one', 'one', 'side', 'side', 'word']);
  assert.deepEqual(LEVELS.order.map((l) => l.words), [0, 0, 0.3, 0.4, 0.6]);
  assert.deepEqual([warmth(50, 50), warmth(50, 53), warmth(50, 40), warmth(50, 75), warmth(50, 76)], ['found', 'very hot', 'hot', 'warm', 'cold']);
  assert.deepEqual([1, 2, 10, 13, 20, 23, 25].map(numEn), ['one', 'two', 'ten', 'thirteen', 'twenty', 'twenty-three', 'twenty-five']);
  assert.deepEqual([1, 9, 10, 11, 20, 23, 25].map(numKo), ['일', '구', '십', '십일', '이십', '이십삼', '이십오']);
  assert.equal((heartsHtml(2).match(/class="on"/g) || []).length, 2); assert.equal((heartsHtml(2).match(/class="off"/g) || []).length, 1);
});
