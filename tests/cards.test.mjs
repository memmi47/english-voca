// Flashcard prototype (cards/): deck rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Run, newState, planRun, gradeOf, gradeCounts, verifyRate, addDays, mulberry32, CFG, INTERVALS } from '../cards/js/deck.js';

const WORDS = JSON.parse(fs.readFileSync('cards/data/words.json', 'utf8')).words;
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

test('K1: deck has 60 words with unique ids and Korean glosses', () => {
  assert.equal(WORDS.length, 60); assert.equal(new Set(WORDS.map((w) => w.id)).size, 60);
  assert.equal(new Set(WORDS.map((w) => w.ko)).size, 60); assert.ok(WORDS.every((w) => /^[a-z]+$/.test(w.form) && w.ko));
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
