// Word-form cards and the whirlwind (cards/js/storm.js, card T-007). Uses the real forms file and the demo worlds.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path';
import { SCHEMA, newState, mulberry32, addDays } from '../cards/js/deck.js';
import { migrate, totals } from '../cards/js/store.js';
import { mergeCards } from '../cards/js/sync.js';
import { ensureMap, batState } from '../cards/js/map.js';
import { indexWorlds, worldView, nodeRun } from '../cards/js/world.js';
import { STORM, indexForms, formPool, formDone, recordForm, hereOf, stormBlocks, stormRelease, stormTick, StormRun, settleStorm } from '../cards/js/storm.js';

const FORMS = JSON.parse(fs.readFileSync('cards/data/forms.json', 'utf8')); const FX = indexForms(FORMS);
const CAT = JSON.parse(fs.readFileSync('cards/data/catalog.json', 'utf8')).words;                 // the base words' Korean glosses
const DEMO = JSON.parse(fs.readFileSync('cards/data/demo/catalog.json', 'utf8')).words;
const IX = indexWorlds(JSON.parse(fs.readFileSync('cards/data/demo/worlds.json', 'utf8'))); const W1 = IX.byId['d1-01'];
const SAVES = 'tests/fixtures/saves';
const D = '2026-11-20';
const TILE = { wid: 'd1-01', kind: 'tile', reason: 'done' };
const rec = (o = {}) => ({ st: 'review', step: 1, due: '2027-01-30', firstDay: '2026-11-10', lastDay: '2026-11-12', lapses: 0, ...o });
// Base words that have exactly one form that can be asked: meeting n of them gives exactly n forms in the pool.
const SINGLE = Object.keys(FX.byBase).filter((b) => FX.byBase[b].length === 1);
const meet = (s, bases) => { for (const b of bases) s.words[b] = rec(); return s; };
const withForms = (n) => meet(newState('son'), SINGLE.slice(0, n));
const always = () => 0;                                                                           // passes every chance
const bfs = (w, from) => { const d = { [from]: 0 }; const q = [from]; while (q.length) { const v = q.shift(); for (const e of w.map.edges) for (const [x, y] of [[e.from, e.to], [e.to, e.from]]) if (x === v && !(y in d)) { d[y] = d[v] + 1; q.push(y); } } return d; };
// Plays a storm run. right(card, again) -> answer right?
function playStorm(run, right) {
  const seen = []; let g = 0;
  while (run.current && g++ < 50) { const c = run.show(); const again = run.queue[run.i].again; seen.push({ id: c.id, again, options: c.options.slice() });
    const idx = right(c, again) ? c.options.indexOf(c.baseForm) : c.options.findIndex((o) => o !== c.baseForm); run.pick(idx); run.advance(); }
  assert.ok(g < 50); return seen;
}

test('ST1: forms with a clash are never asked; forms whose base word was never met are never asked', () => {
  const clash = FORMS.forms.filter((f) => f.clash.length); assert.equal(clash.length, 4); assert.equal(FX.forms.length, 127); assert.equal(Object.keys(FX.byBase).length, 102);
  const all = meet(newState('son'), [...new Set(FORMS.forms.map((f) => f.base))]);                 // every base met, the clashing ones too
  const pool = formPool(all, FX, D); assert.equal(pool.length, 127); assert.ok(pool.every((f) => !f.clash.length));
  for (const f of clash) { assert.equal(FX.byId[f.id], undefined); assert.ok(all.words[f.base]); }
  const asked = new Set(); for (let seed = 1; seed <= 40; seed++) { const s = JSON.parse(JSON.stringify(all)); playStorm(new StormRun({ state: s, fx: FX, words: CAT, today: D, rng: mulberry32(seed) }), () => true).forEach((x) => asked.add(x.id)); }
  assert.ok(clash.every((f) => !asked.has(f.id)), 'no clashing form in 40 storm runs'); assert.ok(asked.size > 50);
  const some = withForms(3); const met = new Set(SINGLE.slice(0, 3));
  assert.deepEqual(formPool(some, FX, D).map((f) => f.base).sort(), [...met].sort());
  const run = new StormRun({ state: some, fx: FX, words: CAT, today: D, rng: mulberry32(1) }); assert.equal(run.cards.length, 3); assert.ok(run.cards.every((c) => met.has(c.base)));
  assert.deepEqual(formPool(newState('son'), FX, D), []); assert.equal(indexForms(null), null); assert.deepEqual(formPool(all, null, D), []);
  assert.deepEqual(stormTick(all, IX, null, TILE, D, always), { event: null, node: null }, 'no forms file: no whirlwind');
});

test('ST2: four forms that can be asked make no whirlwind; five do when the chance passes; at most three a day', () => {
  for (let seed = 1; seed <= 60; seed++) { const s = withForms(4); assert.equal(stormTick(s, IX, FX, TILE, D, mulberry32(seed)).event, null); assert.equal(ensureMap(s).storm ?? null, null); }
  let spawned = 0, quiet = 0;
  for (let seed = 1; seed <= 60; seed++) { const s = withForms(5); const passes = mulberry32(seed)() < STORM.chance; const r = stormTick(s, IX, FX, TILE, D, mulberry32(seed));
    assert.equal(r.event, passes ? 'spawn' : null, 'seed ' + seed); if (passes) spawned++; else quiet++; }
  assert.ok(spawned > 0 && quiet > 0);
  const s = withForms(5); let n = 0;
  for (let i = 0; i < 10; i++) { if (stormTick(s, IX, FX, TILE, D, always).event === 'spawn') { n++; ensureMap(s).storm = null; } }   // each one taken away at once
  assert.equal(n, STORM.perDay); assert.deepEqual([ensureMap(s).stormDay, ensureMap(s).stormN], [D, 3]);
  assert.equal(stormTick(s, IX, FX, TILE, addDays(D, 1), always).event, 'spawn', 'a new day'); assert.equal(ensureMap(s).stormN, 1);
  for (const other of [{ ...TILE, kind: 'bat' }, { ...TILE, kind: 'storm' }, { ...TILE, reason: 'quit' }]) assert.equal(stormTick(withForms(5), IX, FX, other, D, always).event, null, JSON.stringify(other));
});

test('ST3: it appears on the tile farthest from the rider along the map\'s edges, comes one step closer per run and catches the rider', () => {
  for (const [here, seed] of [[null, 7], ['A1', 8], ['A1', 9], ['C2', 12], ['plaza', 7]]) {                            // seeds whose first draw passes the chance
    const s = withForms(6); if (here) ensureMap(s).worlds['d1-01'] = { castle: null, cleared: {}, stamps: {}, seen: null, here };
    const start = hereOf(s, W1); assert.equal(start, here || W1.map.startNodeId); const d = bfs(W1, start);
    const tiles = W1.map.nodes.filter((n) => n.kind === 'tile' && d[n.id] > 0); const far = Math.max(...tiles.map((n) => d[n.id]));
    const r = stormTick(s, IX, FX, TILE, D, mulberry32(seed)); const first = mulberry32(seed)() < STORM.chance;
    assert.ok(first, 'seed ' + seed);
    assert.equal(r.event, 'spawn'); assert.equal(d[r.node], far, `${here}: ${r.node} is ${d[r.node]} away, the farthest tile is ${far}`); assert.equal(W1._nodes[r.node].kind, 'tile');
    let at = r.node, runs = 0, last = null;
    while (runs < 20) { runs++; last = stormTick(s, IX, FX, TILE, D, always); assert.equal(d[last.node], d[at] - 1, 'one step closer'); assert.ok(W1._adj[at].includes(last.node), 'along an edge'); at = last.node; if (last.event === 'caught') break; assert.equal(last.event, 'move'); }
    assert.equal(last.event, 'caught'); assert.equal(runs, far); assert.equal(ensureMap(s).storm.node, start);
  }
  // A loop s-T1-T2-T4-T3-s; T4's first listed edge goes to T2, which is no closer to s than T4 itself: the step must go to T3.
  const LOOP = indexWorlds({ schemaVersion: 3, continents: [{ id: 'x', name: 'x', worlds: [{ id: 'x1', name: 'x', sideActivities: [], map: { startNodeId: 's',
    nodes: [{ id: 's', kind: 'start' }, ...['T1', 'T2', 'T3', 'T4'].map((id) => ({ id, kind: 'tile', words: [id] }))], edges: [{ from: 'T2', to: 'T4' }, { from: 's', to: 'T1' }, { from: 'T1', to: 'T2' }, { from: 's', to: 'T3' }, { from: 'T3', to: 'T4' }] } }] }] });
  const ls = withForms(6); ensureMap(ls).storm = { wid: 'x1', node: 'T4', day: D }; const lt = { wid: 'x1', kind: 'tile', reason: 'done' };
  assert.deepEqual(stormTick(ls, LOOP, FX, lt, D, always), { event: 'move', node: 'T3' }); assert.deepEqual(stormTick(ls, LOOP, FX, lt, D, always), { event: 'caught', node: 's' });
  const tied = withForms(6); ensureMap(tied).worlds['d1-01'] = { castle: null, cleared: {}, stamps: {}, seen: null, here: 'A1' }; const spots = new Set();
  for (let k = 0; k < 20; k++) { const s = JSON.parse(JSON.stringify(tied)); const vals = [0, k / 20]; let i = 0; spots.add(stormTick(s, IX, FX, TILE, D, () => vals[i++]).node); }
  assert.deepEqual([...spots].sort(), ['B1', 'B2', 'C1', 'C2'], 'four tiles equally far: any one, at random');
});

test('ST4: with the bat gauge full nothing appears and nothing moves; a run finished in another world takes the whirlwind away', () => {
  const s = withForms(6); const m = ensureMap(s); m.bat.fill = m.bat.cap; m.bat.met = [SINGLE[0]]; assert.equal(batState(s, D).full, true);
  assert.deepEqual(stormTick(s, IX, FX, TILE, D, always), { event: null, node: null }); assert.equal(m.storm ?? null, null); assert.equal(m.stormDay ?? null, null);
  m.storm = { wid: 'd1-01', node: 'C2', day: D };
  for (let i = 0; i < 5; i++) assert.deepEqual(stormTick(s, IX, FX, TILE, D, always), { event: null, node: 'C2' });
  assert.deepEqual(m.storm, { wid: 'd1-01', node: 'C2', day: D });
  m.bat.fill = 0; assert.equal(batState(s, D).full, false); assert.equal(stormTick(s, IX, FX, TILE, D, always).event, 'move');
  const away = stormTick(s, IX, FX, { wid: 'd1-02', kind: 'tile', reason: 'done' }, D, always);
  assert.equal(away.event, 'gone'); assert.equal(m.storm, null); assert.equal(m.stars, 0, 'no penalty, no reward');
  const twin = withForms(6); ensureMap(twin).storm = { wid: 'd2-01', node: 'k', day: D };                // d1-02 has a node 'k' too
  assert.equal(stormTick(twin, IX, FX, { wid: 'd1-02', kind: 'tile', reason: 'done' }, D, always).event, 'gone'); assert.equal(ensureMap(twin).storm, null);
  const empty = withForms(5); ensureMap(empty).storm = { wid: 'd1-01', node: 'C2', day: D }; for (const id of Object.keys(empty.words)) recordForm(empty, FX.byBase[id][0].id, true, D, 1);
  assert.equal(formPool(empty, FX, D).length, 0); assert.equal(stormTick(empty, IX, FX, TILE, D, always).event, 'gone', 'nothing left to ask');
});

test('ST5: while caught, stormBlocks is true and tile, monster and review runs of that world do not start; a storm run to the end clears it; leaving early keeps it', () => {
  const s = withForms(6); const m = ensureMap(s); m.storm = { wid: 'd1-01', node: 'start', day: D };
  assert.equal(stormBlocks(s, 'd1-01', IX), true); assert.equal(stormBlocks(s, 'd1-02', IX), false);
  const inW1 = new Set(W1.map.nodes.flatMap((n) => n.words || [])); DEMO.filter((w) => !inW1.has(w.id)).slice(0, 9).forEach((w) => { s.words[w.id] = rec({ due: D }); });   // enough due reviews for a monster
  const v = worldView(IX, W1, s, D); assert.equal(v.monster.present, true);
  for (const id of ['A1', 'B1', 'C1', 'monster', 'review']) assert.equal(nodeRun(IX, v, id, s, DEMO, mulberry32(1)), null, id);
  const quit = new StormRun({ state: s, fx: FX, words: CAT, today: D, rng: mulberry32(5) }); quit.show(); quit.pick(0); quit.advance();
  assert.deepEqual(settleStorm(s, quit.finish('quit'), D), { cleared: false, stars: 0 }); assert.deepEqual(m.storm, { wid: 'd1-01', node: 'start', day: D }); assert.equal(stormBlocks(s, 'd1-01', IX), true);
  const run = new StormRun({ state: s, fx: FX, words: CAT, today: D, rng: mulberry32(6) }); playStorm(run, () => true); const r = run.finish('done');
  const out = settleStorm(s, r, D); assert.deepEqual([out.cleared, out.stars], [true, run.cards.length]); assert.equal(m.storm, null); assert.equal(stormBlocks(s, 'd1-01', IX), false);
  assert.equal(m.stars, run.cards.length); assert.ok(nodeRun(IX, worldView(IX, W1, s, D), 'A1', s, DEMO, mulberry32(1)));
  const before = withForms(6); ensureMap(before).storm = { wid: 'd1-01', node: 'C2', day: D }; assert.equal(stormBlocks(before, 'd1-01', IX), false, 'not caught yet');
  ensureMap(before).storm = { wid: 'd1-01', node: 'nowhere', day: D }; assert.equal(stormBlocks(before, 'd1-01', IX), false, 'a node the world does not have never blocks');
});

test('ST6: a storm card offers three different base words with the right one; a missed card comes back once; words, bunches and the bat gauge stay as they were', () => {
  const s = withForms(8); s.bunches = { A1: { due: '2026-12-01', done: null } }; s.words[SINGLE[0]] = rec({ st: 'likely', lstep: 0, due: null, bunch: 'A1' });
  const m = ensureMap(s); m.bat = { fill: 7, cap: 40, met: [SINGLE[1]], last: null }; m.storm = { wid: 'd1-01', node: 'start', day: D };
  const keep = JSON.stringify([s.words, s.bunches, m.bat, m.items]);
  const run = new StormRun({ state: s, fx: FX, words: CAT, today: D, rng: mulberry32(3), now: (() => { let t = 1e12; return () => (t += 1000); })() });
  assert.equal(run.cards.length, STORM.cards);
  for (const c of run.cards) { const f = FX.byId[c.id]; assert.equal(c.options.length, 3); assert.equal(new Set(c.options).size, 3); assert.ok(c.options.includes(f.baseForm));
    assert.ok(c.options.filter((o) => o !== f.baseForm).every((o) => f.lookalikes.includes(o))); assert.deepEqual([c.form, c.base, c.baseForm, c.kind], [f.form, f.base, f.baseForm, f.kind]);
    assert.equal(c.ko, CAT.find((w) => w.id === f.base).ko); assert.ok(c.ko); }
  const missed = new Set(run.cards.slice(0, 2).map((c) => c.id));
  const [m1] = [...missed]; const seen = playStorm(run, (c, again) => !missed.has(c.id) || (again && c.id === m1));   // two missed; the second showing: one right, one missed again
  assert.equal(seen.length, STORM.cards + 2); assert.deepEqual(seen.filter((x) => x.again).map((x) => x.id).sort(), [...missed].sort());
  assert.ok(seen.slice(STORM.cards).every((x) => x.again), 'at the end of the run');
  for (const id of missed) assert.deepEqual([s.forms[id].ok, s.forms[id].n], [0, 1], 'only the first answer is recorded'); assert.equal(Object.values(s.forms).filter((r) => r.ok === 1).length, STORM.cards - 2);
  const r = run.finish('done'); assert.deepEqual([r.kind, r.cards, r.stars, r.fresh, r.reviews], ['storm', STORM.cards + 2, STORM.cards - 2, 0, 0]); assert.ok(r.wall > 0);
  settleStorm(s, r, D);
  assert.equal(JSON.stringify([s.words, s.bunches, m.bat, m.items]), keep, 'to the letter');
  assert.equal(s.log.filter((e) => e.role === 'storm').length, STORM.cards + 2); assert.ok(s.runs.some((x) => x.kind === 'storm'));
  const T = totals(s); assert.deepEqual([T.n, T.cards, T.stars, T.fresh, T.reviews, T.claims, T.verifies], [1, STORM.cards + 2, STORM.cards - 2, 0, 0, 0, 0], 'the parent totals count it as cards and time, not as learning');
  const again = new StormRun({ state: s, fx: FX, words: CAT, today: D, rng: mulberry32(4) });         // missed again: the second showing comes, the run still ends
  playStorm(again, () => false); assert.equal(again.left, 0); assert.equal(again.current, null);
});

test('ST7: form records: right on two different days finishes a form; twice on the same day counts once; a miss starts the row again', () => {
  const s = withForms(6); const f = formPool(s, FX, D)[0].id; const D2 = addDays(D, 1), D3 = addDays(D, 2);
  recordForm(s, f, true, D, 10); assert.deepEqual(s.forms[f], { n: 1, ok: 1, last: D, at: 10 }); assert.ok(!formPool(s, FX, D).some((x) => x.id === f), 'answered right today: not asked again today');
  recordForm(s, f, true, D, 11); assert.deepEqual(s.forms[f], { n: 2, ok: 1, last: D, at: 11 });
  assert.ok(formPool(s, FX, D2).some((x) => x.id === f)); recordForm(s, f, true, D2, 12); assert.equal(s.forms[f].ok, STORM.doneAt); assert.equal(formDone(s.forms[f]), true);
  assert.ok(!formPool(s, FX, D3).some((x) => x.id === f), 'finished');
  const g = formPool(s, FX, D)[0].id; recordForm(s, g, true, D, 1); recordForm(s, g, false, D2, 2); assert.equal(s.forms[g].ok, 0); assert.ok(formPool(s, FX, D2).some((x) => x.id === g), 'a miss is asked again');
  recordForm(s, g, true, D2, 3); assert.equal(s.forms[g].ok, 1, 'right after a miss on the same day counts'); recordForm(s, g, true, D2, 4); assert.equal(s.forms[g].ok, 1);
  recordForm(s, g, true, D3, 5); assert.equal(formDone(s.forms[g]), true);
  const run = new StormRun({ state: withForms(6), fx: FX, words: CAT, today: D, rng: mulberry32(9) }); const st = run.s; playStorm(run, () => true);
  const fresh = new StormRun({ state: st, fx: FX, words: CAT, today: D, rng: mulberry32(9) }); assert.equal(fresh.cards.length, 1, 'forms right today wait for another day');
  assert.equal(new StormRun({ state: st, fx: FX, words: CAT, today: D2, rng: mulberry32(9) }).cards[0].id, fresh.cards[0].id, 'a form never asked comes first');
});

test('ST8: format 2 -> 3: every older saved file opens with its words as they were and an empty forms list; format-3 records keep failing in old programs (D3, F1)', () => {
  assert.equal(SCHEMA, 3);
  const files = fs.readdirSync(SAVES).filter((f) => f.endsWith('.json')); assert.ok(files.includes('v2-open-at.json')); assert.ok(files.filter((f) => JSON.parse(fs.readFileSync(path.join(SAVES, f), 'utf8')).v === 2).length >= 2);
  for (const f of files) { const raw = JSON.parse(fs.readFileSync(path.join(SAVES, f), 'utf8')); assert.ok(raw.v < 3, f); assert.equal(raw.forms, undefined, f);
    const m = migrate(JSON.parse(JSON.stringify(raw)), raw.id); assert.deepEqual([m.state.v, m.newer], [3, false], f); assert.deepEqual(m.state.forms, {}, f);
    assert.equal(Object.keys(m.state.words).length, Object.keys(raw.words).length, f); assert.equal(JSON.stringify(m.state.words), JSON.stringify(raw.words), f); }
  const raw = JSON.parse(fs.readFileSync(path.join(SAVES, 'v2-open-at.json'), 'utf8')); assert.equal(raw.v, 2);
  assert.ok(Object.values(raw.words).every((r) => Number.isFinite(r.at)), 'word records carry `at`'); assert.deepEqual(raw.map.worlds['d1-01'].open, { B1: '2026-11-16' }); assert.equal(raw.map.worlds['d1-01'].cleared.A1, '2026-11-16');
  const s = migrate(raw, 'son').state; assert.deepEqual(s.map.worlds['d1-01'].open, { B1: '2026-11-16' });
  const v = worldView(IX, W1, s, '2026-11-17'); assert.deepEqual([v.nodes.find((n) => n.id === 'A1').status, v.nodes.find((n) => n.id === 'B1').status], ['cleared', 'open']);
  assert.deepEqual(newState('x').forms, {}); assert.deepEqual(migrate(JSON.parse(JSON.stringify(s)), 'son').state, s);
});

test('ST9: merging: both devices\' form records are kept, the later change wins; a whirlwind or rider on a missing node is dropped', () => {
  const base = () => migrate({ v: 2, id: 'son', words: { w1: rec() }, verify: [], runs: [], log: [], bunches: {} }, 'son').state;
  const a = base(), b = base();
  a.forms = { f1: { n: 1, ok: 1, last: '2026-11-20', at: 200 }, f2: { n: 2, ok: 0, last: '2026-11-19', at: 50 }, f4: { n: 1, ok: 1, last: '2026-11-18', at: 5 } };
  b.forms = { f1: { n: 3, ok: 0, last: '2026-11-19', at: 100 }, f3: { n: 1, ok: 1, last: '2026-11-20', at: 300 }, f4: { n: 2, ok: 0, last: '2026-11-18', at: 5 } };
  for (const m of [mergeCards(a, b), mergeCards(b, a)]) { assert.deepEqual(Object.keys(m.forms).sort(), ['f1', 'f2', 'f3', 'f4']);
    assert.deepEqual(m.forms.f1, a.forms.f1, 'later `at` wins over more answers'); assert.deepEqual(m.forms.f4, b.forms.f4, 'same `at`: asked more often'); assert.deepEqual(m.forms.f3, b.forms.f3); }
  const old = { ...newState('son'), v: 2 }; delete old.forms; old.words = { w2: rec() }; assert.deepEqual(mergeCards(a, old).forms, a.forms, 'a format-2 device brings no forms and takes none away');
  const p = base(), q = base(); const run = (t) => ({ day: t.slice(0, 10), n: 1, tag: 'A1', cards: 3, wall: 1000, endedAt: t });
  p.runs = [run('2026-11-20T10:00:00Z')]; q.runs = [run('2026-11-20T09:00:00Z')];
  ensureMap(p).storm = { wid: 'd1-01', node: 'nowhere', day: D }; ensureMap(p).worlds['d1-01'] = { castle: null, cleared: {}, stamps: {}, seen: null, here: 'gone-tile' }; Object.assign(ensureMap(p), { stormDay: D, stormN: 2 });
  ensureMap(q).storm = { wid: 'd1-01', node: 'C2', day: D }; ensureMap(q).worlds['d1-01'] = { castle: null, cleared: {}, stamps: {}, seen: null, here: 'A1' }; Object.assign(ensureMap(q), { stormDay: D, stormN: 1 });
  for (const m of [mergeCards(p, q, IX), mergeCards(q, p, IX)]) { assert.equal(m.map.storm, null, 'p played last; its whirlwind points at no node: dropped');
    assert.equal(m.map.worlds['d1-01'].here, undefined, 'a rider on a missing node is dropped'); assert.deepEqual([m.map.stormDay, m.map.stormN], [D, 2]);
    assert.equal(stormBlocks(m, 'd1-01', IX), false); }
  ensureMap(p).storm = { wid: 'd1-01', node: 'B2', day: D }; ensureMap(p).worlds['d1-01'].here = 'C1';
  for (const m of [mergeCards(p, q, IX), mergeCards(q, p, IX)]) { assert.deepEqual(m.map.storm, { wid: 'd1-01', node: 'B2', day: D }, 'the side that played last'); assert.equal(m.map.worlds['d1-01'].here, 'C1'); }
  ensureMap(p).storm = null;
  for (const m of [mergeCards(p, q, IX), mergeCards(q, p, IX)]) assert.equal(m.map.storm, null, 'the later side already cleared it');
  const noIx = mergeCards(q, base()); assert.deepEqual(noIx.map.storm, { wid: 'd1-01', node: 'C2', day: D }); assert.equal(noIx.map.worlds['d1-01'].here, 'A1');
});

test('ST10: nobody is held by a whirlwind that has nothing to ask: switched off it never blocks; stormRelease takes it away when no form is left', () => {
  const s = withForms(6); const m = ensureMap(s); m.storm = { wid: 'd1-01', node: 'start', day: D };
  assert.equal(stormBlocks(s, 'd1-01', IX), true); assert.equal(stormRelease(s, IX, FX, D), false, 'forms left: it stays'); assert.ok(m.storm);
  STORM.on = false; try { assert.equal(stormBlocks(s, 'd1-01', IX), false); } finally { STORM.on = true; }
  for (const f of formPool(s, FX, D)) recordForm(s, f.id, true, D, 1);                 // every form answered right today: the pool is empty
  assert.equal(formPool(s, FX, D).length, 0); const words = JSON.stringify(s.words);
  assert.equal(new StormRun({ state: s, fx: FX, words: CAT, today: D, rng: mulberry32(1) }).cards.length, 0);
  assert.equal(stormRelease(s, IX, FX, D), true); assert.equal(m.storm, null); assert.equal(stormBlocks(s, 'd1-01', IX), false); assert.equal(JSON.stringify(s.words), words);
  m.storm = { wid: 'd1-01', node: 'start', day: D }; assert.equal(stormRelease(s, IX, null, D), true, 'no forms file'); assert.equal(m.storm, null);
  assert.equal(stormRelease(s, IX, FX, D), false, 'no whirlwind: nothing to do');
});

