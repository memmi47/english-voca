// Flashcard prototype: record sharing between devices (cards/js/sync.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sync, mergeCards, mergeMeta } from '../cards/js/sync.js';
import { Run, newState, mulberry32, addDays } from '../cards/js/deck.js';

function memoryStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }
// In-memory stand-in for tools/serve_cards.py (same contract: rev check, 404, 409).
function fakeServer() {
  const docs = {}; let down = false;
  const res = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const fetchImpl = async (url, opt = {}) => {
    if (down) throw new Error('network');
    if (url.endsWith('ping')) return res(200, { ok: true, store: true });
    const name = url.split('doc/')[1];
    if (!opt.method) return docs[name] ? res(200, JSON.parse(JSON.stringify(docs[name]))) : res(404, {});
    const req = JSON.parse(opt.body); const rev = docs[name]?.rev || 0;
    if (req.baseRev !== rev) return res(409, JSON.parse(JSON.stringify(docs[name] || { rev: 0, data: null })));
    docs[name] = { rev: rev + 1, data: req.data }; return res(200, { rev: rev + 1 });
  };
  return { docs, fetchImpl, setDown: (v) => { down = v; } };
}
const device = (srv) => { const st = memoryStorage(); const merged = []; return { st, merged, sync: new Sync({ storage: st, fetchImpl: srv.fetchImpl, onMerged: (n) => merged.push(n) }) }; };
const put = (d, name, data) => { d.st.setItem('cards.v0.' + name, JSON.stringify(data)); d.sync.changed(name); };
const get = (d, name) => JSON.parse(d.st.getItem('cards.v0.' + name));
const settle = async (d) => { for (let i = 0; i < 5; i++) { await Promise.all(Object.values(d.sync.inFlight)); await new Promise((r) => setTimeout(r, 0)); } };

const word = (o = {}) => ({ st: 'review', step: 0, due: '2026-11-13', firstDay: '2026-11-12', lastDay: '2026-11-12', lapses: 0, ...o });
const run = (n, at, o = {}) => ({ day: at.slice(0, 10), n, tag: 'A1', cards: 20, wall: 60000, endedAt: at, ...o });
const state = (o = {}) => ({ v: 0, id: 'son', words: {}, verify: [], runs: [], log: [], ...o });
const logE = (t, id) => ({ t, day: t.slice(0, 10), id, role: 'new', form: 'judge', ok: true, ms: 800 });

test('S1: words: the later lastDay wins; on the same day the more advanced state wins; order of merge does not matter', () => {
  const a = state({ words: { w1: word({ step: 1, lastDay: '2026-11-13' }), w2: word({ st: 'learn', lastDay: '2026-11-13' }), w3: word({ st: 'done' }) } });
  const b = state({ words: { w1: word({ step: 0, lastDay: '2026-11-12' }), w2: word({ st: 'review', step: 2, lastDay: '2026-11-13' }), w3: word({ st: 'likely' }), w4: word() } });
  for (const m of [mergeCards(a, b), mergeCards(b, a)]) {
    assert.equal(m.words.w1.step, 1);            // later day
    assert.equal(m.words.w2.step, 2);            // same day: review step 2 is further than learn
    assert.equal(m.words.w3.st, 'done');         // same day: done beats likely
    assert.ok(m.words.w4);                       // only on one side
  }
});

test('S2: runs and log entries are united without duplicates, in time order', () => {
  const a = state({ runs: [run(1, '2026-11-12T10:00:00Z'), run(2, '2026-11-12T11:00:00Z')], log: [logE('2026-11-12T10:00:01Z', 'w1'), logE('2026-11-12T10:00:02Z', 'w2')] });
  const b = state({ runs: [run(1, '2026-11-12T10:00:00Z'), run(1, '2026-11-12T12:00:00Z', { tag: 'B1' })], log: [logE('2026-11-12T10:00:02Z', 'w2'), logE('2026-11-12T12:00:00Z', 'w3')] });
  const m = mergeCards(a, b);
  assert.deepEqual(m.runs.map((r) => r.endedAt), ['2026-11-12T10:00:00Z', '2026-11-12T11:00:00Z', '2026-11-12T12:00:00Z']);
  assert.deepEqual(m.log.map((e) => e.id), ['w1', 'w2', 'w3']);
});

test('S3: map: per world, cleared tiles / castle / stamps united (earliest day); keys counted from castles; best only grows; items take the larger', () => {
  const W = (o) => ({ castle: null, seen: null, cleared: {}, stamps: {}, ...o });
  const a = state({ map: { stars: 10, keys: 0, best: 12, items: { shield: 1, flame: 0 }, bag: null, at: 'w1', monsterDay: '2026-11-12', monsterN: 3, bonusDay: null,
    worlds: { w1: W({ cleared: { A1: '2026-11-12' }, stamps: { G1: '2026-11-12' }, seen: '2026-11-12' }) }, conts: {} } });
  const b = state({ map: { stars: 25, keys: 2, best: 9, items: { shield: 0, flame: 2 }, bag: 'flame', at: 'w2', monsterDay: '2026-11-12', monsterN: 1, bonusDay: '2026-11-13',
    worlds: { w1: W({ cleared: { A1: '2026-11-13', B1: '2026-11-13' }, castle: '2026-11-13', seen: '2026-11-13' }), w2: W({ castle: '2026-11-14', stamps: { G9: '2026-11-14' } }) }, conts: { c1: { castle: '2026-11-15' } } } });
  for (const m of [mergeCards(a, b).map, mergeCards(b, a).map]) {
    assert.deepEqual(m.worlds.w1, { castle: '2026-11-13', seen: '2026-11-12', cleared: { A1: '2026-11-12', B1: '2026-11-13' }, stamps: { G1: '2026-11-12' } });
    assert.deepEqual(m.worlds.w2, { castle: '2026-11-14', seen: null, cleared: {}, stamps: { G9: '2026-11-14' } });
    assert.deepEqual(m.conts, { c1: { castle: '2026-11-15' } });
    assert.deepEqual([m.stars, m.keys, m.best, m.monsterDay, m.monsterN, m.bonusDay], [25, 2, 12, '2026-11-12', 3, '2026-11-13']);
    assert.deepEqual(m.items, { shield: 1, flame: 2 });
  }
  assert.equal(mergeCards(a, b).map.at, 'w1'); assert.equal(mergeCards(b, a).map.at, 'w2');                       // where each device stands is its own
});

test('S4: the adaptive check history follows the device that played last; meta keeps local names when local is newer', () => {
  const a = state({ verify: [true, true], runs: [run(1, '2026-11-12T10:00:00Z')] }); const b = state({ verify: [false], runs: [run(1, '2026-11-12T12:00:00Z')] });
  assert.deepEqual(mergeCards(a, b).verify, [false]); assert.deepEqual(mergeCards(b, a).verify, [false]);
  assert.deepEqual(mergeMeta({ names: { son: 'A' } }, { names: { son: 'B' } }, true).names, { son: 'A' });
  assert.deepEqual(mergeMeta({ names: { son: 'A' } }, { names: { son: 'B' } }, false).names, { son: 'B' });
});

test('S5: first device uploads; a second device (empty browser) receives the progress', async () => {
  const srv = fakeServer(); const mac = device(srv); await mac.sync.init();
  put(mac, 'p.son', state({ words: { w1: word() }, runs: [run(1, '2026-11-12T10:00:00Z')] })); await settle(mac);
  assert.equal(srv.docs['p.son'].data.runs.length, 1);
  const ipad = device(srv); await ipad.sync.init();
  assert.deepEqual(Object.keys(get(ipad, 'p.son').words), ['w1']); assert.deepEqual(ipad.sync.pending, []);
});

test('S6: browser storage wiped: progress comes back from the server', async () => {
  const srv = fakeServer(); const mac = device(srv); await mac.sync.init();
  put(mac, 'p.son', state({ words: { w1: word({ st: 'done' }) } })); await settle(mac);
  const wiped = device(srv); await wiped.sync.init();
  assert.equal(get(wiped, 'p.son').words.w1.st, 'done');
});

test('S7: server down: local saves keep working and are uploaded when it returns', async () => {
  const srv = fakeServer(); const mac = device(srv); await mac.sync.init(); srv.setDown(true);
  put(mac, 'p.son', state({ words: { w1: word() } })); await settle(mac);
  assert.deepEqual(mac.sync.pending, ['p.son']); assert.equal(srv.docs['p.son'], undefined);
  srv.setDown(false); await mac.sync.flush(); await settle(mac);
  assert.deepEqual(mac.sync.pending, []); assert.ok(srv.docs['p.son'].data.words.w1);
});

test('S8: two devices change the same child while apart: both sides survive the merge and both end equal', async () => {
  const srv = fakeServer(); const mac = device(srv); const ipad = device(srv); await mac.sync.init(); await ipad.sync.init();
  put(mac, 'p.son', state({ words: { w1: word({ lastDay: '2026-11-12' }) }, runs: [run(1, '2026-11-12T10:00:00Z')], map: { stars: 5, keys: 0, best: 0, items: { shield: 0, flame: 0 }, bag: null, worlds: { w1: { castle: null, seen: null, cleared: { A1: '2026-11-12' }, stamps: {} } }, conts: {}, monsterDay: null, bonusDay: null } })); await settle(mac);
  await ipad.sync.reconcile('p.son');
  srv.setDown(true);                                                          // both play offline
  put(mac, 'p.son', { ...get(mac, 'p.son'), words: { ...get(mac, 'p.son').words, w2: word() }, runs: [...get(mac, 'p.son').runs, run(2, '2026-11-12T11:00:00Z', { tag: 'B1' })] });
  put(ipad, 'p.son', { ...get(ipad, 'p.son'), words: { ...get(ipad, 'p.son').words, w3: word() }, runs: [...get(ipad, 'p.son').runs, run(2, '2026-11-12T11:30:00Z', { tag: 'C1' })] });
  srv.setDown(false); await mac.sync.flush(); await settle(mac); await ipad.sync.flush(); await settle(ipad); await mac.sync.reconcile('p.son'); await settle(mac);
  for (const s of [get(mac, 'p.son'), get(ipad, 'p.son'), srv.docs['p.son'].data]) {      // Mac, iPad and the server copy
    assert.deepEqual(Object.keys(s.words).sort(), ['w1', 'w2', 'w3']); assert.deepEqual(s.runs.map((r) => r.tag), ['A1', 'B1', 'C1']);
  }
  assert.deepEqual(mac.sync.pending, []); assert.deepEqual(ipad.sync.pending, []);
});

test('S9: the second child\'s document is separate; names sync through meta', async () => {
  const srv = fakeServer(); const mac = device(srv); await mac.sync.init();
  put(mac, 'p.son', state({ words: { w1: word() } })); put(mac, 'meta', { names: { son: '민수', daughter: '지수' } }); await settle(mac);
  assert.equal(srv.docs['p.daughter'], undefined);
  const ipad = device(srv); await ipad.sync.init();
  assert.deepEqual(get(ipad, 'meta').names, { son: '민수', daughter: '지수' }); assert.equal(ipad.st.getItem('cards.v0.p.daughter'), null);
});

test('S10: bat gauge merge: the side that took the latest test wins (it emptied the gauge); otherwise the fuller gauge and united met words', () => {
  const mk = (bat) => state({ map: { stars: 0, keys: 0, best: 0, items: { shield: 0, flame: 0 }, bag: null, worlds: {}, conts: {}, monsterDay: null, bonusDay: null, bat } });
  const a = mk({ fill: 0, cap: 50, met: [], last: '2026-11-12T12:00:00Z' }), b = mk({ fill: 38, cap: 40, met: ['w1', 'w2'], last: null });
  for (const m of [mergeCards(a, b).map.bat, mergeCards(b, a).map.bat]) assert.deepEqual([m.fill, m.cap, m.met.length], [0, 50, 0]);
  const c = mk({ fill: 12, cap: 40, met: ['w1', 'w2'], last: '2026-11-12T12:00:00Z' }), d = mk({ fill: 20, cap: 40, met: ['w2', 'w3'], last: '2026-11-12T12:00:00Z' });
  for (const m of [mergeCards(c, d).map.bat, mergeCards(d, c).map.bat]) assert.deepEqual([m.fill, m.cap, [...m.met].sort()], [20, 40, ['w1', 'w2', 'w3']]);
});

test('S11: tile bunches: a finished check wins (both finished: the earlier day), else the earlier due date; a word keeps its bunch tag; both merge orders agree', () => {
  const pass = (o = {}) => word({ st: 'likely', lstep: 0, due: null, bunch: 'A1', ...o });
  const a = state({ v: 2, words: { w1: pass({ lastDay: '2026-11-14' }), w2: pass(), w3: word({ st: 'done', due: null, lastDay: '2026-12-20', bunch: 'B1' }) },
    bunches: { A1: { due: '2026-12-12', done: null }, B1: { due: '2026-12-13', done: '2026-12-20', result: 'ok' }, C1: { due: '2026-12-14', done: '2026-12-21', result: 'split' }, D1: { due: '2026-12-15', done: null } } });
  const b = state({ v: 2, words: { w1: word({ st: 'likely', lstep: 0, due: null, lastDay: '2026-11-12' }), w2: { ...pass(), bunch: undefined }, w4: pass({ bunch: 'E1' }) },
    bunches: { A1: { due: '2026-12-14', done: null }, B1: { due: '2026-12-13', done: null }, C1: { due: '2026-12-14', done: '2026-12-15', result: 'ok' }, E1: { due: '2026-12-30', done: null } } });
  delete b.words.w2.bunch;                                                          // an older copy of the same word, saved without the tag
  const ab = mergeCards(a, b), ba = mergeCards(b, a);
  for (const m of [ab, ba]) {
    assert.deepEqual(m.bunches, { A1: { due: '2026-12-12', done: null }, B1: { due: '2026-12-13', done: '2026-12-20', result: 'ok' }, C1: { due: '2026-12-14', done: '2026-12-15', result: 'ok' }, D1: { due: '2026-12-15', done: null }, E1: { due: '2026-12-30', done: null } });
    assert.deepEqual(['w1', 'w2', 'w3', 'w4'].map((id) => m.words[id].bunch), ['A1', 'A1', 'B1', 'E1']);
  }
  assert.deepEqual(ab.words, ba.words); assert.deepEqual(ab.bunches, ba.bunches);
});

test('F9: a miss later on the same day beats an earlier gold in either merge order (`at`, the time of the change); records without `at` keep the old rule', () => {
  const WORDS = JSON.parse(fs.readFileSync('cards/data/demo/catalog.json', 'utf8')).words; const id = WORDS[0].id; const D = '2026-11-16';
  const base = () => ({ ...newState('son'), words: { [id]: { st: 'likely', lstep: 1, due: D, firstDay: '2026-10-01', lastDay: '2026-10-17', lapses: 0 } } });
  const a = base(); const ra = new Run({ state: a, words: WORDS, today: D, rng: mulberry32(1), now: () => 1000, scope: { noNew: true } });   // device A, morning: the last check -> gold
  let it = ra.show(); ra.pick(it.options.findIndex((o) => o.id === id)); assert.deepEqual([a.words[id].st, a.words[id].at], ['done', 1000]);
  const b = base(); const rb = new Run({ state: b, words: WORDS, today: D, rng: mulberry32(1), now: () => 5000, scope: { castle: [id] } });   // device B, later: a castle card missed
  it = rb.show(); rb.pick((it.options.findIndex((o) => o.id === id) + 1) % 3); assert.deepEqual([b.words[id].st, b.words[id].due, b.words[id].at], ['learn', addDays(D, 1), 5000]);
  for (const m of [mergeCards(a, b), mergeCards(b, a)]) assert.deepEqual([m.words[id].st, m.words[id].due], ['learn', addDays(D, 1)]);
  const old = (o) => word({ firstDay: D, lastDay: D, ...o });                                    // saved before `at` existed: same day, the more advanced state wins
  for (const [x, y] of [[old({ st: 'done', due: null }), old({ st: 'learn' })], [old({ st: 'done', due: null, at: 1 }), old({ st: 'learn' })]]) {
    for (const m of [mergeCards(state({ words: { w: x } }), state({ words: { w: y } })), mergeCards(state({ words: { w: y } }), state({ words: { w: x } }))]) assert.equal(m.words.w.st, 'done');
  }
  const tri = newState('son'); const ids = WORDS.slice(0, 4).map((w) => w.id);                    // words passed on the word list get the time too
  new Run({ state: tri, words: WORDS, today: D, rng: mulberry32(1), now: () => 777, scope: { newIds: ids, newPerRun: 4, triage: { bunch: 'A1', passed: ids, tapped: [], spot: [], due: addDays(D, 30) } } });
  assert.ok(ids.every((x) => tri.words[x].at === 777 && tri.words[x].bunch === 'A1'));
});

test('F7: merge: tile marks of unfinished runs are united; a tile cleared on either side drops its mark; no mark, no `open` key', () => {
  const W = (o) => ({ castle: null, seen: null, cleared: {}, stamps: {}, ...o }); const mp = (w) => state({ map: { stars: 0, keys: 0, best: 0, items: { shield: 0, flame: 0 }, bag: null, worlds: { w1: W(w) }, conts: {}, monsterDay: null, bonusDay: null } });
  const a = mp({ open: { A1: '2026-11-12', B1: '2026-11-12' } }), b = mp({ cleared: { A1: '2026-11-13' }, open: { C1: '2026-11-13' } });
  for (const m of [mergeCards(a, b), mergeCards(b, a)]) assert.deepEqual(m.map.worlds.w1.open, { B1: '2026-11-12', C1: '2026-11-13' });
  const c = mp({ open: { A1: '2026-11-12' } }), d = mp({ cleared: { A1: '2026-11-12' } });
  for (const m of [mergeCards(c, d), mergeCards(d, c)]) assert.equal('open' in m.map.worlds.w1, false);
});

test('S12: the prototype tiles kept under map.legacy survive a merge in either order (one side or both carry them)', () => {
  const a = state({ v: 2, words: { w1: word() } }), b = state({ v: 2, words: { w2: word() } });
  a.map = { stars: 3, worlds: {}, conts: {}, legacy: { cleared: { A1: '2026-11-12', B1: '2026-11-13' }, castle: null } };
  b.map = { stars: 1, worlds: {}, conts: {} };
  for (const m of [mergeCards(a, b), mergeCards(b, a)]) assert.deepEqual(m.map.legacy, { cleared: { A1: '2026-11-12', B1: '2026-11-13' }, castle: null });
  b.map.legacy = { cleared: { A1: '2026-11-11', C1: '2026-11-14' }, castle: '2026-11-15' };
  for (const m of [mergeCards(a, b), mergeCards(b, a)]) assert.deepEqual(m.map.legacy, { cleared: { A1: '2026-11-11', B1: '2026-11-13', C1: '2026-11-14' }, castle: '2026-11-15' });
  const c = state({ v: 2, words: {} }), d = state({ v: 2, words: {} }); c.map = { stars: 0, worlds: {}, conts: {} }; d.map = { stars: 0, worlds: {}, conts: {} };
  assert.equal('legacy' in mergeCards(c, d).map, false);
});
