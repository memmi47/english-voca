// Flashcard prototype (cards/): deck rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Run, newState, planRun, gradeOf, gradeCounts, verifyRate, addDays, mulberry32, CFG, INTERVALS } from '../cards/js/deck.js';
import { ensureMap, settleRun, chooseBag, takeBag, dueCount, overdueCount, batState, tileDue, Lightning, settleLightning, batPool, MONSTER_AT, ITEMS, BAT, RULES } from '../cards/js/map.js';
import { indexWorlds, worldView, atlasView, currentWorld, nodeRun, finaleRun, settleWorld, enterWorld, stampGame, worldWords, worldOpen, reach, crowned, FINALE, setLeftOutKinds, leftOutKinds } from '../cards/js/world.js';

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

legacyTest('W2: at the start the tiles next to the start are open, the rest locked; castle, playhouses and the house are locked', () => {
  const s = newState('son'); const v = view(s);
  assert.deepEqual(['A1', 'B1', 'C1', 'A2', 'B2', 'C2'].map((id) => status(v, id)), ['open', 'open', 'open', 'locked', 'locked', 'locked']);
  assert.deepEqual([v.castle.status, status(v, 'G1'), status(v, 'G2'), status(v, 'H1')], ['locked', 'locked', 'locked', 'locked']);
  assert.equal(v.monster.present, false); assert.equal(v.bonus.status, 'locked'); assert.equal(v.firstVisit, true);
  assert.equal(nodeRun(IX, v, 'A2', s, WORDS, mulberry32(1)), null); assert.equal(nodeRun(IX, v, 'castle', s, WORDS, mulberry32(1)), null);
  clear(s, 'A1'); const v2 = view(s); assert.deepEqual([status(v2, 'A1'), status(v2, 'A2'), status(v2, 'H1'), v2.castle.status], ['cleared', 'open', 'open', 'locked']);
});

test('W3: a tile run introduces exactly that tile\'s words; clearing needs every word seen; stars are counted', () => {
  const s = newState('son'); const node = nodeRun(IX, view(s), 'B1', s, WORDS, mulberry32(1));
  assert.deepEqual([node.kind, node.scope.newIds.length, node.wid], ['tile', 10, 'd1-01']);
  const r = clear(s, 'B1'); assert.deepEqual(new Set(Object.keys(s.words)), new Set(W1._nodes.B1.words)); assert.equal(r.cleared, true); assert.ok(r.stars > 0);
  assert.equal(ensureMap(s).stars, r.stars); assert.equal(ensureMap(s).worlds['d1-01'].cleared.B1, D1);
});

test('W4: an early exit leaves the tile uncleared; the unseen words are drawn again next time', () => {
  const s = newState('son'); const node = nodeRun(IX, view(s), 'A1', s, WORDS, mulberry32(1));
  const run = mkRun(s, node); run.show(); run.judge(true); run.advance(); const rec = run.finish('left'); const r = settle(s, node, run, rec, D1);
  assert.equal(r.cleared, false); assert.equal(status(view(s), 'A1'), 'open');
  assert.equal(nodeRun(IX, view(s, addDays(D1, 1)), 'A1', s, WORDS, mulberry32(1)).scope.newIds.length, 10);
});

test('W5: the castle opens as soon as a path reaches it (free nodes are walked through); a short path is enough', () => {
  const s = newState('son'); clear(s, 'C1'); assert.equal(view(s).castle.status, 'locked');           // C2 still stands between the start and the square
  clear(s, 'C2'); const v = view(s); assert.equal(v.castle.status, 'open'); assert.equal(status(v, 'G2'), 'open');   // the playhouse hangs on C2
  assert.deepEqual(['A1', 'B1', 'A2', 'B2'].map((id) => status(v, id)), ['open', 'open', 'open', 'open']);          // from the square the child can also walk back into the other paths
  const r = reach(W1, s); assert.ok(r.reached.has('plaza') && r.castle);
});

legacyTest('W6: castle: 12 check cards from this world\'s met words; 80% gives the key and opens the next world; leftovers pay double; no crown yet', () => {
  const s = newState('son'); clear(s, 'A1'); clear(s, 'A2');
  assert.equal(worldOpen(IX, W2, s), false);
  const node = nodeRun(IX, view(s), 'castle', s, WORDS, mulberry32(1)); const run = mkRun(s, node);
  assert.ok(run.queue.length === 12 && run.queue.every((q) => q.role === 'castle' && q.form === 'check' && worldWords(W1).includes(q.id) && s.words[q.id]));
  play(run, () => true); const rec = run.finish(); const r = settle(s, node, run, rec, D1);
  assert.deepEqual([r.key, r.castle.pass, r.castle.ok, r.castle.total, r.crown, r.nextWorld.id], [true, true, 12, 12, false, 'd1-02']);
  const v = view(s); assert.deepEqual([v.castle.status, v.keys, v.crown], ['cleared', 1, false]); assert.equal(worldOpen(IX, W2, s), true);
  assert.ok(v.nodes.filter((n) => n.kind === 'tile' && n.status !== 'cleared').every((n) => n.bonus)); assert.equal(v.houses[0].bonus, true);
  assert.equal(clear(s, 'B1').mult, 2);
});

test('W7: a failed castle card is not known: back to learning, due tomorrow; below the pass rate there is no key and the castle stays open', () => {
  const s = newState('son'); clear(s, 'A1'); clear(s, 'A2'); const node = nodeRun(IX, view(s), 'castle', s, WORDS, mulberry32(1)); const run = mkRun(s, node);
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

legacyTest('W9: the house (function words) opens when its anchor tile is done; its run uses hear-and-pick cards; it is needed for the crown', () => {
  const s = newState('son'); assert.equal(nodeRun(IX, view(s), 'H1', s, WORDS, mulberry32(1)), null);
  clear(s, 'A1'); const node = nodeRun(IX, view(s), 'H1', s, WORDS, mulberry32(1)); assert.deepEqual([node.kind, node.unit, node.scope.newIds.length], ['tile', 'H1-1', 6]);
  const run = mkRun(s, node); assert.ok(run.queue.filter((q) => q.role === 'new').every((q) => q.form === 'check'));
  const r = clear(s, 'H1'); assert.equal(r.cleared, true); const v = view(s); assert.deepEqual([v.houses[0].status, v.houses[0].done, v.houses[0].total], ['cleared', 1, 1]);
  assert.equal(nodeRun(IX, v, 'H1', s, WORDS, mulberry32(1)), null);
});

test('W10: playhouses: open when their anchor tile is done; a stamp is given once and changes nothing else', () => {
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

test('W12: the continent castle opens only with every crown; it draws met cards evenly from every world; passing opens the next continent', () => {
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
test('M5: 8 or more due reviews put an optional monster on the map: it does not block; beating it drops an item; more than one a day', () => {
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

test('M8: items: shield absorbs one wrong check and comes back if unused; flame doubles boss damage; both come from the bag only', () => {
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

legacyTest('M9: nothing on the map changes a word\'s schedule; the lightning round touches no word and never asks a function word', () => {
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

test('M10: the bonus house stays locked until 6 words are ripe', () => {
  const s = newState('son'); assert.equal(view(s).bonus.status, 'locked'); clear(s, 'A1'); assert.equal(view(s).bonus.status, 'open');
});

// ---- bat gauge ----
test('G1: the gauge gains 1 per new word and loses 1 per review answered, never below 0', () => {
  const s = newState('son'); assert.deepEqual([ensureMap(s).bat.fill, ensureMap(s).bat.cap], [0, BAT.cap]);
  clear(s, 'A1'); assert.equal(s.map.bat.fill, 10); assert.equal(s.map.bat.met.length, 10);
  const s2 = newState('son'); ensureMap(s2).bat.fill = 3; const n2 = { kind: 'monster', tag: 'monster', scope: { noNew: true } };
  const r2 = mkRun(s2, n2); r2.finish(); settleRun(s2, n2, r2, { ...r2.ended, reviews: 2, fresh: 0 }, D1, mulberry32(2)); assert.equal(s2.map.bat.fill, 1);
  settleRun(s2, n2, r2, { ...r2.ended, reviews: 5, fresh: 0 }, D1, mulberry32(2)); assert.equal(s2.map.bat.fill, 0);
});

legacyTest('G2: a full gauge stops everything but the bat test; with nothing to ask it is not "full"', () => {
  const s = newState('son'); clear(s, 'A1'); clear(s, 'A2'); clear(s, 'B1'); assert.equal(view(s).bat.full, false);
  clear(s, 'B2'); const v = view(s); assert.deepEqual([v.bat.fill, v.bat.cap, v.bat.full, v.bat.byDebt], [40, 40, true, false]);
  assert.deepEqual([status(v, 'C1'), v.castle.status, status(v, 'H1'), status(v, 'C2'), status(v, 'G1')], ['blocked', 'blocked', 'blocked', 'blocked', 'open']);   // play is not blocked
  for (const id of ['C1', 'castle', 'monster', 'H1']) assert.equal(nodeRun(IX, v, id, s, WORDS, mulberry32(1)), null, id);
  assert.ok(nodeRun(IX, v, 'bat', s, WORDS, mulberry32(1)));
  const empty = newState('son'); ensureMap(empty).bat.fill = 99; assert.equal(view(empty).bat.full, false);   // gauge full but no word to ask about
});

test('G3: the bat test asks overdue reviews first (oldest first), then words met since the last test; all check cards, 25 at most', () => {
  const s = newState('son'); for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id);
  const d = addDays(D1, 8);                                                       // the known words of day 1 are due again after 7 days
  const pool = batPool(s, d); assert.ok(pool.due.length > 0 && pool.due.length + pool.fresh.length <= BAT.test);
  const dues = pool.due.map((id) => s.words[id].due); assert.deepEqual(dues, [...dues].sort());
  const node = nodeRun(IX, view(s, d), 'bat', s, WORDS, mulberry32(1)); const run = mkRun(s, node, d);
  assert.ok(run.queue.length <= BAT.test && run.queue.every((q) => q.form === 'check')); assert.ok(run.queue.slice(0, pool.due.length).every((q) => q.role === 'review' || q.role === 'likely'));
  const fresh = batPool(s, D1); assert.equal(fresh.due.length, 0); assert.equal(fresh.fresh.length, BAT.test);   // day 1: nothing due, so it asks about words met today
});

test('G4: the test result moves the capacity (90%+ up, under 70% down, bounded); the gauge empties; leaving keeps it full; no stars', () => {
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

test('G5: a miss in the bat test follows the normal rules: overdue word back to tomorrow, new word back to learning', () => {
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

test('G7: a tile run carries more reviews when more are waiting: half of the backlog, between 8 and 20', () => {
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
