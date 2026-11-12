// Flashcard prototype (cards/): deck rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Run, newState, planRun, gradeOf, gradeCounts, verifyRate, addDays, mulberry32, CFG, INTERVALS } from '../cards/js/deck.js';
import { ensureMap, mapView, nodeRun, settleRun, chooseBag, takeBag, dueCount, Lightning, settleLightning, batPool, MONSTER_AT, ITEMS, BAT } from '../cards/js/map.js';

const DATA = JSON.parse(fs.readFileSync('cards/data/words.json', 'utf8')); const WORDS = DATA.words; const WORLD = DATA.world;
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

// ---- map ----
const TILE = (id) => WORLD.roads.flatMap((r) => r.tiles).find((t) => t.id === id);
const mkRun = (state, node, today = D1, seed = 3) => new Run({ state, words: WORDS, today, rng: mulberry32(seed), scope: node.scope, items: node.items || {}, tag: node.tag });
function clear(state, tileId, today = D1) {              // child plays a tile honestly and knows everything
  const node = nodeRun(WORLD, mapView(WORLD, state, today), tileId, state, WORDS, mulberry32(1)); assert.ok(node, 'tile open: ' + tileId);
  const run = mkRun(state, node, today); play(run, () => true); const rec = run.finish(); return settleRun(WORLD, state, node, run, rec, today, mulberry32(2));
}

// The child takes the bat test; knows(id) decides which cards are answered correctly.
function batTest(state, today, knows = () => true, reason = 'done') {
  const node = nodeRun(WORLD, mapView(WORLD, state, today), 'bat', state, WORDS, mulberry32(7)); assert.ok(node, 'bat test available');
  const run = mkRun(state, node, today); let n = 0;
  while (run.current && (reason === 'done' || n++ < 2)) { const it = run.show(); const ans = it.options.findIndex((o) => o.id === it.id); run.pick(knows(it.id) || it.role === 'practice' ? ans : (ans + 1) % 3); run.advance(); }
  const rec = run.finish(reason); return { run, rec, out: settleRun(WORLD, state, node, run, rec, today, mulberry32(2)), node };
}

test('M1: world has 3 roads x 2 tiles, every deck word in exactly one tile', () => {
  assert.equal(WORLD.roads.length, 3); const all = WORLD.roads.flatMap((r) => r.tiles.flatMap((t) => t.words));
  assert.equal(all.length, 60); assert.equal(new Set(all).size, 60); assert.ok(WORLD.roads.every((r) => r.tiles.length === 2));
});

test('M2: first tile of each road is open, second is locked until the first is cleared; castle is locked', () => {
  const s = newState('son'); const v = mapView(WORLD, s, D1);
  assert.deepEqual(v.roads.map((r) => r.tiles.map((t) => t.status)), [['open', 'locked'], ['open', 'locked'], ['open', 'locked']]);
  assert.equal(v.castle.status, 'locked'); assert.equal(v.monster.present, false); assert.equal(v.bonus.status, 'locked');
  assert.equal(nodeRun(WORLD, v, 'A2', s, WORDS, mulberry32(1)), null);
  clear(s, 'A1'); assert.equal(mapView(WORLD, s, D1).roads[0].tiles[1].status, 'open');
});

test('M3: a tile run introduces exactly that tile\'s words; clearing needs every word seen; stars are counted', () => {
  const s = newState('son'); const node = nodeRun(WORLD, mapView(WORLD, s, D1), 'B1', s, WORDS, mulberry32(1));
  assert.equal(node.scope.newIds.length, 9);
  const r = clear(s, 'B1'); const seen = Object.keys(s.words);
  assert.deepEqual(new Set(seen), new Set(TILE('B1').words)); assert.equal(r.cleared, true); assert.ok(r.stars > 0);
  assert.equal(ensureMap(s).stars, r.stars); assert.equal(ensureMap(s).cleared.B1, D1);
});

test('M4: an early exit leaves the tile uncleared; the unseen words are drawn again next time', () => {
  const s = newState('son'); const node = nodeRun(WORLD, mapView(WORLD, s, D1), 'A1', s, WORDS, mulberry32(1));
  const run = mkRun(s, node); const it = run.show(); run.judge(true); run.advance(); const rec = run.finish('left');
  const r = settleRun(WORLD, s, node, run, rec, D1, mulberry32(2));
  assert.equal(r.cleared, false); assert.equal(mapView(WORLD, s, D1).roads[0].tiles[0].status, 'open');
  const again = nodeRun(WORLD, mapView(WORLD, s, addDays(D1, 1)), 'A1', s, WORDS, mulberry32(1));
  assert.equal(again.scope.newIds.length, 11);
});

test('M5: 8 or more due reviews put an optional monster on the map: it no longer blocks; beating it drops an item', () => {
  const s = newState('son'); clear(s, 'A1'); clear(s, 'B1');
  const d = addDays(D1, 8); assert.ok(dueCount(s, d) >= MONSTER_AT, 'due=' + dueCount(s, d));
  let v = mapView(WORLD, s, d); assert.equal(v.monster.present, true);
  assert.ok(v.roads[0].tiles[1].status === 'open', 'the road is still open');
  assert.ok(nodeRun(WORLD, v, 'A2', s, WORDS, mulberry32(1)), 'a new tile can start with the monster standing');
  const node = nodeRun(WORLD, v, 'monster', s, WORDS, mulberry32(1)); assert.deepEqual([node.scope.noNew, node.kind], [true, 'monster']);
  const run = mkRun(s, node, d); assert.ok(run.queue.every((q) => q.role === 'likely' || q.role === 'review'));
  play(run, () => true); const rec = run.finish(); const r = settleRun(WORLD, s, node, run, rec, d, mulberry32(2));
  assert.deepEqual([r.cleared, r.mult], [true, 2]); assert.ok(['shield', 'flame'].includes(r.item));
  assert.equal(mapView(WORLD, s, d).monster.present, false);
});

test('M6: four tiles fill the bat gauge; after the bat test the castle opens: check-only run, key, leftover road is bonus', () => {
  const s = newState('son'); for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id);
  let v = mapView(WORLD, s, D1); assert.equal(v.roadsDone, 2); assert.equal(v.bat.full, true); assert.equal(v.castle.status, 'blocked');
  assert.equal(nodeRun(WORLD, v, 'castle', s, WORDS, mulberry32(1)), null);
  batTest(s, D1);
  v = mapView(WORLD, s, D1); assert.equal(v.castle.status, 'open'); assert.equal(v.roads[2].tiles[0].bonus, false);
  const node = nodeRun(WORLD, v, 'castle', s, WORDS, mulberry32(1)); const run = mkRun(s, node);
  assert.ok(run.queue.length === 12 && run.queue.every((q) => q.role === 'castle' && q.form === 'check'));
  play(run, () => true); const rec = run.finish(); const r = settleRun(WORLD, s, node, run, rec, D1, mulberry32(2));
  assert.deepEqual([r.key, r.castle.pass, r.castle.ok, r.castle.total], [true, true, 12, 12]);
  v = mapView(WORLD, s, D1); assert.equal(v.castle.status, 'cleared'); assert.equal(v.keys, 1);
  assert.deepEqual(v.roads[2].tiles.map((t) => t.bonus), [true, true]);
  const bonus = clear(s, 'C1'); assert.equal(bonus.mult, 2);
});

test('M7: a failed castle card is not known: it goes back to learning, due tomorrow; below 80% gives no key', () => {
  const s = newState('son'); for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id); batTest(s, D1);
  const node = nodeRun(WORLD, mapView(WORLD, s, D1), 'castle', s, WORDS, mulberry32(1)); const run = mkRun(s, node);
  const missed = []; let n = 0;
  while (run.current) { const it = run.show(); const ans = it.options.findIndex((o) => o.id === it.id); const miss = n++ < 4; if (miss) missed.push(it.id); run.pick(miss ? (ans + 1) % 3 : ans); run.advance(); }
  const rec = run.finish(); const r = settleRun(WORLD, s, node, run, rec, D1, mulberry32(2));
  assert.deepEqual([r.key, r.castle.pass, r.castle.ok], [false, false, 8]);
  for (const id of missed) assert.deepEqual([s.words[id].st, s.words[id].due], ['learn', addDays(D1, 1)]);
  assert.equal(mapView(WORLD, s, D1).castle.status, 'open');                       // can try again
});

test('M8: items: shield absorbs one wrong check and comes back if unused; flame doubles boss damage; both come from the bag only', () => {
  const s = newState('son'); const m = ensureMap(s); m.items.shield = 1; m.items.flame = 1;
  assert.equal(chooseBag(s, 'shield'), 'shield'); assert.equal(chooseBag(s, 'shield'), null); chooseBag(s, 'shield');
  const used = takeBag(s); assert.deepEqual([used.shield, m.items.shield, m.bag], [1, 0, null]);
  // two due words -> two check cards (a "likely" word is always checked)
  const [a, b] = WORDS.slice(0, 2).map((w) => w.id);
  for (const id of [a, b]) s.words[id] = { st: 'likely', lstep: 0, due: D1, firstDay: '2026-11-05', lastDay: '2026-11-05', lapses: 0 };
  const node = { kind: 'monster', tag: 'monster', scope: { noNew: true, duePerRun: 14 } };
  const run = mkRun(s, { ...node, items: used }); run.combo = 4;
  let it = run.show(); assert.equal(it.form, 'check');
  const wrong = (x) => (x.options.findIndex((o) => o.id === x.id) + 1) % 3;
  run.pick(wrong(it)); assert.deepEqual([run.combo, run.items.shield, run.shieldUsed], [4, 0, 1]);   // the shield took the hit
  run.advance(); it = run.show(); run.pick(wrong(it)); assert.equal(run.combo, 0);                    // no shield left
  // an unused shield returns to the bag's stock when the run is settled
  const s3 = newState('son'); ensureMap(s3).items.shield = 1; chooseBag(s3, 'shield'); const kept = takeBag(s3);
  const n3 = nodeRun(WORLD, mapView(WORLD, s3, D1), 'A1', s3, WORDS, mulberry32(1)); const r3 = mkRun(s3, { ...n3, items: kept }); r3.finish('left');
  settleRun(WORLD, s3, n3, r3, r3.ended, D1, mulberry32(2)); assert.equal(s3.map.items.shield, 1);
  // flame doubles damage
  const s2 = newState('son'); ensureMap(s2).items.flame = 1; chooseBag(s2, 'flame'); const it3 = takeBag(s2);
  const n2 = nodeRun(WORLD, mapView(WORLD, s2, D1), 'A1', s2, WORDS, mulberry32(1)); const r2 = mkRun(s2, { ...n2, items: it3 }); r2.show(); r2.judge(true);
  assert.equal(r2.boss.hp, CFG.bossHp - 2);                                      // 1 damage doubled
  assert.equal(chooseBag(s2, 'shield'), null);                                   // no shield to choose
});

test('M9: nothing on the map changes a word\'s schedule; the lightning round touches no word', () => {
  const s = newState('son'); for (const id of ['A1', 'B1']) clear(s, id);
  const before = JSON.stringify(s.words); const d = addDays(D1, 8);
  const lt = new Lightning({ state: s, words: WORDS, rng: mulberry32(4) }); assert.ok(lt.ready);
  for (let k = 0; k < 20; k++) { const c = lt.next(); lt.answer(c.truth); }
  assert.equal(lt.score, 20); assert.equal(JSON.stringify(s.words), before);
  const lt2 = new Lightning({ state: s, words: WORDS, rng: mulberry32(5) }); const c = lt2.next(); assert.equal(lt2.answer(!c.truth), false);
  const r = settleLightning(s, lt, d); assert.deepEqual([r.first, r.newBest, ensureMap(s).best], [true, true, 20]); assert.ok(r.item);
  assert.equal(settleLightning(s, lt2, d).item, null);                           // one item a day
  assert.equal(JSON.stringify(s.words), before); assert.equal(mapView(WORLD, s, d).bonus.status, 'used');
});

test('M10: the bonus house stays locked until 6 words are ripe; false pairs never show the right meaning', () => {
  const s = newState('son'); assert.equal(mapView(WORLD, s, D1).bonus.status, 'locked');
  clear(s, 'A1'); assert.equal(mapView(WORLD, s, D1).bonus.status, 'open');
  const lt = new Lightning({ state: s, words: WORDS, rng: mulberry32(9) });
  for (let k = 0; k < 40; k++) { const c = lt.next(); const w = WORDS.find((x) => x.id === c.id); assert.equal(c.ko === w.ko, c.truth); }
});

// ---- bat gauge ----
test('G1: the gauge gains 1 per new word and loses 1 per review answered, never below 0', () => {
  const s = newState('son'); assert.deepEqual([ensureMap(s).bat.fill, ensureMap(s).bat.cap], [0, BAT.cap]);
  clear(s, 'A1'); assert.equal(s.map.bat.fill, 11); assert.equal(s.map.bat.met.length, 11);
  const d = addDays(D1, 8); assert.ok(dueCount(s, d) >= 3);
  const node = nodeRun(WORLD, mapView(WORLD, s, d), 'monster', s, WORDS, mulberry32(1)); const run = mkRun(s, node, d); play(run, () => true);
  const rec = run.finish(); settleRun(WORLD, s, node, run, rec, d, mulberry32(2));
  assert.equal(s.map.bat.fill, Math.max(0, 11 - rec.reviews)); assert.ok(s.map.bat.fill < 11);
  const s2 = newState('son'); ensureMap(s2).bat.fill = 0; const n2 = { kind: 'monster', tag: 'monster', scope: { noNew: true } };
  const r2 = mkRun(s2, n2); r2.finish(); settleRun(WORLD, s2, n2, r2, { ...r2.ended, reviews: 5, fresh: 0 }, D1, mulberry32(2)); assert.equal(s2.map.bat.fill, 0);
});

test('G2: a full gauge stops everything but the bat test; with nothing to ask it is not "full"', () => {
  const s = newState('son'); clear(s, 'A1'); clear(s, 'A2'); clear(s, 'B1'); assert.equal(mapView(WORLD, s, D1).bat.full, false);
  clear(s, 'B2'); const v = mapView(WORLD, s, D1); assert.deepEqual([v.bat.fill, v.bat.cap, v.bat.full], [40, 40, true]);
  assert.ok(v.roads.flatMap((r) => r.tiles).filter((t) => !t.cleared && t.status !== 'locked').every((t) => t.status === 'blocked'));
  for (const id of ['C1', 'castle', 'monster']) assert.equal(nodeRun(WORLD, v, id, s, WORDS, mulberry32(1)), null, id);
  assert.ok(nodeRun(WORLD, v, 'bat', s, WORDS, mulberry32(1)));
  const empty = newState('son'); ensureMap(empty).bat.fill = 99; assert.equal(mapView(WORLD, empty, D1).bat.full, false);   // gauge full but no word to ask about
});

test('G3: the bat test asks overdue reviews first (oldest first), then words met since the last test; all check cards, 25 at most', () => {
  const s = newState('son'); for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id);
  const d = addDays(D1, 8);                                                       // the known words of day 1 are due again after 7 days
  const pool = batPool(s, d); assert.ok(pool.due.length > 0 && pool.due.length + pool.fresh.length <= BAT.test);
  const dues = pool.due.map((id) => s.words[id].due); assert.deepEqual(dues, [...dues].sort());
  const node = nodeRun(WORLD, mapView(WORLD, s, d), 'bat', s, WORDS, mulberry32(1)); const run = mkRun(s, node, d);
  assert.ok(run.queue.length <= BAT.test && run.queue.every((q) => q.form === 'check')); assert.ok(run.queue.slice(0, pool.due.length).every((q) => q.role === 'review' || q.role === 'likely'));
  const fresh = batPool(s, D1); assert.equal(fresh.due.length, 0); assert.equal(fresh.fresh.length, BAT.test);   // day 1: nothing due, so it asks about words met today
});

test('G4: the test result moves the capacity (90%+ up, under 70% down, bounded); the gauge empties; leaving keeps it full', () => {
  const fill = (s) => { for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id); };
  const hi = newState('son'); fill(hi); const r1 = batTest(hi, D1, () => true);
  assert.deepEqual([r1.out.bat.done, r1.out.bat.acc, hi.map.bat.cap, hi.map.bat.fill, hi.map.bat.met.length], [true, 1, BAT.cap + BAT.step, 0, 0]);
  assert.equal(r1.out.stars, 0);                                                 // the forced test pays no stars
  const lo = newState('son'); fill(lo); const r2 = batTest(lo, D1, () => false);
  assert.ok(r2.out.bat.acc < BAT.down); assert.equal(lo.map.bat.cap, BAT.cap - BAT.step); assert.equal(lo.map.bat.fill, 0);
  const mid = newState('son'); fill(mid); let k = 0; batTest(mid, D1, () => k++ % 5 !== 0);                  // 80% right
  assert.equal(mid.map.bat.cap, BAT.cap);
  const top = newState('son'); fill(top); top.map.bat.cap = BAT.max; top.map.bat.fill = BAT.max; batTest(top, D1, () => true); assert.equal(top.map.bat.cap, BAT.max);
  const bot = newState('son'); fill(bot); bot.map.bat.cap = BAT.min; ensureMap(bot).bat.fill = BAT.min + 5; batTest(bot, D1, () => false); assert.equal(bot.map.bat.cap, BAT.min);
  const left = newState('son'); fill(left); const r3 = batTest(left, D1, () => true, 'left');
  assert.equal(r3.out.bat.done, false); assert.equal(mapView(WORLD, left, D1).bat.full, true); assert.equal(left.map.bat.cap, BAT.cap);
});

test('G5: a miss in the bat test follows the normal rules: overdue word back to tomorrow, new word back to learning', () => {
  const s = newState('son'); for (const id of ['A1', 'A2', 'B1', 'B2']) clear(s, id); const d = addDays(D1, 8);
  const node = nodeRun(WORLD, mapView(WORLD, s, d), 'bat', s, WORDS, mulberry32(1)); const run = mkRun(s, node, d);
  const dueIds = batPool(s, d).due; assert.ok(dueIds.length > 0); const was = Object.fromEntries(dueIds.map((id) => [id, s.words[id].st]));
  while (run.current) { const it = run.show(); if (it.form === 'judge') run.judge(true); else { const ans = it.options.findIndex((o) => o.id === it.id); run.pick((ans + 1) % 3); } run.advance(); if (run.i > 400) break; }   // a miss adds "once more" cards, so the queue grows
  for (const id of dueIds) assert.deepEqual([s.words[id].st, s.words[id].due], [was[id] === 'likely' ? 'learn' : 'review', addDays(d, 1)]);   // a missed "likely" word is not known after all
  const freshIds = node.scope.bat.fresh; for (const id of freshIds) assert.equal(s.words[id].st, 'learn');
});
