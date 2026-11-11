import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage } from '../game/js/store.js';
import { Sync, mergeProfiles } from '../game/js/sync.js';

// In-memory stand-in for tools/serve.py (same contract: rev check, 404, 409).
function fakeServer() {
  const docs = {}; let down = false; const calls = [];
  const res = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const fetchImpl = async (url, opt = {}) => {
    calls.push((opt.method || 'GET') + ' ' + url);
    if (down) throw new Error('network');
    if (url.endsWith('ping')) return res(200, { ok: true, store: true });
    const name = url.split('doc/')[1];
    if (!opt.method) return docs[name] ? res(200, JSON.parse(JSON.stringify(docs[name]))) : res(404, {});
    const req = JSON.parse(opt.body); const rev = docs[name]?.rev || 0;
    if (req.baseRev !== rev) return res(409, JSON.parse(JSON.stringify(docs[name] || { rev: 0, data: null })));
    docs[name] = { rev: rev + 1, data: req.data }; return res(200, { rev: rev + 1 });
  };
  return { docs, fetchImpl, calls, setDown: (v) => { down = v; } };
}
const prof = (o = {}) => ({ v: 1, id: 'son', packs: {}, cards: {}, localCards: {}, log: [], sessions: [], audioIssues: [], ...o });
const card = (o = {}) => ({ tier: 'T1', streak: 0, due: null, introduced: null, lastScoredDay: null, known: '미확인', ...o });
const device = (srv) => { const st = memoryStorage(); const merged = []; return { st, merged, sync: new Sync({ storage: st, fetchImpl: srv.fetchImpl, onMerged: (n, d) => merged.push(n) }) }; };
const put = (d, name, data) => { d.st.setItem('catchup.v1.' + name, JSON.stringify(data)); d.sync.changed(name); };
const get = (d, name) => JSON.parse(d.st.getItem('catchup.v1.' + name));
const settle = async (d) => { for (let i = 0; i < 5; i++) { await Promise.all(Object.values(d.sync.inFlight)); await new Promise((r) => setTimeout(r, 0)); } };

test('first device uploads; second device (empty browser) receives the progress', async () => {
  const srv = fakeServer(); const mac = device(srv); await mac.sync.init();
  put(mac, 'p.son', prof({ cards: { c1: card({ streak: 2, due: '2026-11-20', introduced: '2026-11-11', lastScoredDay: '2026-11-13' }) } })); await settle(mac);
  assert.equal(srv.docs['p.son'].data.cards.c1.streak, 2);
  const ipad = device(srv); await ipad.sync.init();
  assert.equal(get(ipad, 'p.son').cards.c1.streak, 2); assert.deepEqual(ipad.sync.pending, []);
});
test('browser storage wiped (e.g. Safari eviction): progress comes back from the server', async () => {
  const srv = fakeServer(); const mac = device(srv); await mac.sync.init();
  put(mac, 'p.son', prof({ cards: { c1: card({ streak: 3 }) } })); await settle(mac);
  const wiped = device(srv); await wiped.sync.init();                 // same device, storage gone
  assert.equal(get(wiped, 'p.son').cards.c1.streak, 3);
});
test('server down: local saves keep working and are uploaded when it returns', async () => {
  const srv = fakeServer(); const mac = device(srv); await mac.sync.init();
  srv.setDown(true);
  put(mac, 'p.son', prof({ cards: { c1: card({ streak: 1 }) } })); await settle(mac);
  assert.deepEqual(mac.sync.pending, ['p.son']); assert.equal(srv.docs['p.son'], undefined); assert.ok(mac.sync.lastError);
  srv.setDown(false); await mac.sync.flush(); await settle(mac);
  assert.equal(srv.docs['p.son'].data.cards.c1.streak, 1); assert.deepEqual(mac.sync.pending, []);
});
test('two devices changed the same child while apart: both sets of results survive', async () => {
  const srv = fakeServer(); const mac = device(srv); const ipad = device(srv);
  await mac.sync.init(); put(mac, 'p.son', prof({ cards: { c1: card(), c2: card() } })); await settle(mac); await ipad.sync.init();
  const m = get(mac, 'p.son'); m.cards.c1 = card({ streak: 1, lastScoredDay: '2026-11-12', introduced: '2026-11-12' }); m.log.push({ t: '2026-11-12T01:00:00Z', card: 'c1', type: 'word-meaning', outcome: 'independent' });
  m.sessions.push({ day: '2026-11-12', ms: 300000, endedAt: '2026-11-12T01:05:00Z' }); put(mac, 'p.son', m); await settle(mac);
  const i = get(ipad, 'p.son'); i.cards.c2 = card({ streak: 1, lastScoredDay: '2026-11-12', introduced: '2026-11-12' }); i.log.push({ t: '2026-11-12T02:00:00Z', card: 'c2', type: 'word-meaning', outcome: 'independent' });
  i.sessions.push({ day: '2026-11-12', ms: 200000, endedAt: '2026-11-12T02:05:00Z' }); put(ipad, 'p.son', i); await settle(ipad);   // gets 409, merges, retries
  const final = srv.docs['p.son'].data;
  assert.equal(final.cards.c1.streak, 1); assert.equal(final.cards.c2.streak, 1); assert.equal(final.log.length, 2); assert.equal(final.sessions.length, 2);
  assert.ok(ipad.merged.includes('p.son'));
  await mac.sync.reconcile('p.son'); assert.equal(get(mac, 'p.son').cards.c2.streak, 1);
});
test('merge never lets an older record replace a newer one; siblings stay separate documents', async () => {
  const a = prof({ cards: { c1: card({ streak: 4, lastScoredDay: '2026-11-20' }) } });
  const b = prof({ cards: { c1: card({ streak: 0, lastScoredDay: '2026-11-12' }) } });
  assert.equal(mergeProfiles(a, b).cards.c1.streak, 4); assert.equal(mergeProfiles(b, a).cards.c1.streak, 4);
  const blank = prof({ cards: { c1: card() } });                      // an untouched copy must never win
  assert.equal(mergeProfiles(blank, a).cards.c1.streak, 4); assert.equal(mergeProfiles(a, blank).cards.c1.streak, 4);
  const srv = fakeServer(); const mac = device(srv); await mac.sync.init();
  put(mac, 'p.son', prof({ cards: { c1: card({ streak: 2 }) } })); await settle(mac);
  assert.equal(srv.docs['p.daughter'], undefined);
});
test('no server at all: init reports unavailable and nothing throws', async () => {
  const st = memoryStorage(); const s = new Sync({ storage: st, fetchImpl: async () => { throw new Error('x'); } });
  assert.equal(await s.init(200), false); s.changed('p.son'); assert.deepEqual(s.pending, ['p.son']);
});
