// Flashcard prototype: record sharing between devices (cards/js/sync.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sync, mergeCards, mergeMeta } from '../cards/js/sync.js';

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

test('S3: map: cleared tiles united (earliest day), keys and best only grow, castle date kept, item counts take the larger', () => {
  const a = state({ map: { stars: 10, keys: 0, best: 12, items: { shield: 1, flame: 0 }, bag: null, cleared: { A1: '2026-11-12' }, castle: null, monsterDay: '2026-11-12', bonusDay: null } });
  const b = state({ map: { stars: 25, keys: 1, best: 9, items: { shield: 0, flame: 2 }, bag: 'flame', cleared: { A1: '2026-11-13', B1: '2026-11-13' }, castle: '2026-11-13', monsterDay: null, bonusDay: '2026-11-13' } });
  for (const m of [mergeCards(a, b).map, mergeCards(b, a).map]) {
    assert.deepEqual(m.cleared, { A1: '2026-11-12', B1: '2026-11-13' });
    assert.deepEqual([m.stars, m.keys, m.best, m.castle, m.monsterDay, m.bonusDay], [25, 1, 12, '2026-11-13', '2026-11-12', '2026-11-13']);
    assert.deepEqual(m.items, { shield: 1, flame: 2 });
  }
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
  put(mac, 'p.son', state({ words: { w1: word({ lastDay: '2026-11-12' }) }, runs: [run(1, '2026-11-12T10:00:00Z')], map: { stars: 5, keys: 0, best: 0, items: { shield: 0, flame: 0 }, bag: null, cleared: { A1: '2026-11-12' }, castle: null, monsterDay: null, bonusDay: null } })); await settle(mac);
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
