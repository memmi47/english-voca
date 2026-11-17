// Progress must survive program updates, damaged storage and bad writes (docs/DATA_SAFETY.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { SCHEMA, newState, Run, mulberry32 } from '../cards/js/deck.js';
import { migrate, compact, totals, loadRecord, readBackup } from '../cards/js/store.js';
import { mergeCards, Sync } from '../cards/js/sync.js';
import { ensureMap } from '../cards/js/map.js';
import { indexWorlds, worldView } from '../cards/js/world.js';

const SAVES = 'tests/fixtures/saves';
const WORDS = JSON.parse(fs.readFileSync('cards/data/demo/catalog.json', 'utf8')).words; const IX = indexWorlds(JSON.parse(fs.readFileSync('cards/data/demo/worlds.json', 'utf8')));
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, _m: m }; };
const word = (o = {}) => ({ st: 'review', step: 1, due: '2026-11-20', firstDay: '2026-11-10', lastDay: '2026-11-12', lapses: 0, ...o });
const run = (i, o = {}) => ({ day: '2026-11-12', n: i, tag: 'A1', cards: 10, wall: 60000, claims: 3, verifies: 1, verifyOk: 1, reviews: 2, reviewOk: 2, fresh: 5, known: 3, unknown: 2, learned: 2, lapses: 0, bosses: 1, stars: 12, endedAt: `2026-11-12T10:${String(i % 60).padStart(2, '0')}:${String(Math.floor(i / 60)).padStart(2, '0')}Z`, ...o });

test('D1: every record ever saved by an older program opens with the current one, with every word kept', () => {
  const files = fs.readdirSync(SAVES).filter((f) => f.endsWith('.json')); assert.ok(files.length >= 2, 'fixtures for the old formats exist');
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(SAVES, f), 'utf8')); const before = JSON.stringify(raw.words); const nWords = Object.keys(raw.words).length;
    const m = migrate(JSON.parse(JSON.stringify(raw)), raw.id); assert.equal(m.newer, false, f); assert.equal(m.state.v, SCHEMA, f);
    assert.equal(JSON.stringify(m.state.words), before, f + ': word records are untouched'); assert.equal(Object.keys(m.state.words).length, nWords);
    assert.equal(m.state.runs.length, raw.runs.length); assert.equal(m.state.id, raw.id);
    const m2 = migrate(JSON.parse(JSON.stringify(m.state)), raw.id); assert.deepEqual(m2.state, m.state, f + ': upgrading twice changes nothing');
    const v = worldView(IX, IX.worlds[0], m.state, '2026-12-01'); assert.ok(v.nodes.length > 0, f + ': the map opens');                       // the game can use it
    const r = new Run({ state: m.state, words: WORDS, today: '2026-12-01', rng: mulberry32(1), scope: { noNew: true, duePerRun: 5 } }); assert.ok(r.queue.length >= 0);
    assert.equal(ensureMap(m.state).stars, raw.map?.stars ?? 0, f + ': stars kept');
  }
});

test('D2: the prototype format (one world, tiles at the top of the map) is upgraded without losing what it held', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(SAVES, 'v0-prototype.json'), 'utf8')); assert.equal(raw.v, 0); assert.ok(raw.map.cleared.A1);
  const s = migrate(raw, 'son').state; assert.equal(s.v, SCHEMA); assert.deepEqual(s.map.legacy.cleared, { A1: '2026-11-12', B1: '2026-11-12' }); assert.equal(s.map.legacy.castle, null);
  assert.ok(!('cleared' in s.map) && !('castle' in s.map)); assert.deepEqual([s.map.stars, s.map.bat.fill, s.map.items.shield], [77, 20, 1]);
  assert.deepEqual(migrate(null, 'son').state, newState('son')); assert.equal(migrate([], 'x').from, null);
});

test('D3: a record saved by a newer program is never rewritten by an older one: not on reading, not when merging, not when syncing', async () => {
  const future = { v: SCHEMA + 1, id: 'son', words: { a: word() }, runs: [], verify: [], log: [], brandNew: { x: 1 } };
  const m = migrate(JSON.parse(JSON.stringify(future)), 'son'); assert.equal(m.newer, true); assert.deepEqual(m.state, future);
  const st = mem({ k: JSON.stringify(future) }); const rec = loadRecord(st, 'k', 'son'); assert.equal(rec.newer, true); assert.equal(st.getItem('k'), JSON.stringify(future));
  const old = { ...newState('son'), words: { b: word() } };
  assert.deepEqual(mergeCards(old, future), future); assert.deepEqual(mergeCards(future, old), future);
  assert.equal(readBackup(JSON.stringify(future), 'son').ok, false);
  // sync: the server holds the newer record, this page holds an older one -> nothing is written anywhere
  const store = mem({ 'cards.v0.p.son': JSON.stringify(old) }); const puts = [];
  const fetchImpl = async (u, o) => { if (o?.method === 'PUT') { puts.push(u); return { ok: true, status: 200, json: async () => ({ rev: 9 }) }; }
    if (u.endsWith('ping')) return { ok: true, status: 200, json: async () => ({ ok: true, store: true }) };
    if (u.endsWith('doc/p.son')) return { ok: true, status: 200, json: async () => ({ rev: 8, data: future }) }; return { ok: false, status: 404, json: async () => ({}) }; };
  const statuses = []; const sync = new Sync({ storage: store, fetchImpl, onStatus: (s) => statuses.push(s) }); await sync.init();
  assert.equal(sync.stale, true); assert.equal(puts.filter((u) => u.endsWith('p.son')).length, 0); assert.equal(store.getItem('cards.v0.p.son'), JSON.stringify(old)); assert.ok(statuses.at(-1).stale);
});

test('D4: a record that cannot be read is set aside, not overwritten; the three newest damaged copies are kept', () => {
  const st = mem({ k: '{"v":1,"words":{"a":' }); const rec = loadRecord(st, 'k', 'son');
  assert.deepEqual([rec.damaged, rec.newer, Object.keys(rec.state.words).length], [true, false, 0]); assert.equal(st.getItem('k'), null);
  const kept = [...st._m.keys()].filter((k) => k.startsWith('k.damaged.')); assert.equal(kept.length, 1); assert.equal(st.getItem(kept[0]), '{"v":1,"words":{"a":');
  const many = mem({ 'k.damaged.1': 'a', 'k.damaged.2': 'b', 'k.damaged.3': 'c', k: 'not json' }); loadRecord(many, 'k', 'son');
  const left = [...many._m.keys()].filter((k) => k.startsWith('k.damaged.')).sort(); assert.equal(left.length, 3); assert.ok(!left.includes('k.damaged.1'));
  for (const junk of ['null', '[]', '"text"', '42']) assert.equal(loadRecord(mem({ k: junk }), 'k', 'son').damaged, true, junk);   // valid JSON that is not a record
  const none = loadRecord(mem(), 'k', 'son'); assert.deepEqual([none.missing, none.damaged], [true, false]);
  const full = { getItem: () => 'broken', setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('no'); }, key: () => null, length: 0 };
  assert.equal(loadRecord(full, 'k', 'son').damaged, true);                                                        // never throws
});

test('D5: old run records are folded into totals so the record stays small; the totals stay exact; merging does not count twice', () => {
  const s = newState('son'); for (let i = 0; i < 620; i++) s.runs.push(run(i));
  const before = totals(JSON.parse(JSON.stringify(s))); assert.equal(before.n, 620);
  const T = '2027-03-01';                                                          // compact folds only runs older than 30 days before this date (F2)
  assert.equal(compact(s, T), true); assert.equal(s.runs.length, 300); assert.equal(s.past.n, 320); assert.equal(compact(s, T), false);
  assert.deepEqual(totals(s), before);
  const other = JSON.parse(JSON.stringify(s)); other.runs = []; other.past = undefined; for (let i = 0; i < 620; i++) other.runs.push(run(i));   // the same history, not folded, on another device
  other.runs.push(run(700, { endedAt: '2026-11-13T09:00:00Z', day: '2026-11-13' }));
  for (const m of [mergeCards(s, other), mergeCards(other, s)]) { assert.equal(m.past.n, 320); assert.equal(m.runs.length, 301); const t = totals(m); assert.equal(t.n, 621); assert.equal(t.cards, before.cards + 10); }
  const size = JSON.stringify(s).length; for (let i = 0; i < 3000; i++) { s.runs.push(run(1000 + i, { endedAt: `2027-01-01T00:00:${String(i).padStart(5, '0')}Z` })); compact(s, T); }
  assert.ok(s.runs.length <= 500); assert.ok(JSON.stringify(s).length < size * 2, 'three thousand more runs do not grow the record without bound');
});

test('D6: restoring from a file or a server copy is a merge: nothing on either side is lost; a wrong file is refused with a reason', () => {
  const backup = { v: 0, id: 'son', words: { a: word({ st: 'done', due: null, lastDay: '2026-11-01' }), b: word({ lastDay: '2026-11-01' }) }, runs: [run(1)], verify: [], log: [], map: { stars: 30, keys: 0, best: 4, items: { shield: 2, flame: 0 }, bag: null, cleared: { A1: '2026-11-01' }, castle: null, monsterDay: null, bonusDay: null } };
  const now = { ...newState('son'), words: { b: word({ step: 3, lastDay: '2026-11-20' }), c: word() }, runs: [run(2)], map: { ...ensureMap(newState('x')), stars: 12 } };
  const r = readBackup(JSON.stringify(backup), 'son'); assert.equal(r.ok, true); assert.equal(r.words, 2);
  const m = mergeCards(now, r.state); assert.deepEqual(Object.keys(m.words).sort(), ['a', 'b', 'c']); assert.equal(m.words.b.step, 3); assert.equal(m.words.a.st, 'done'); assert.equal(m.runs.length, 2); assert.equal(m.map.stars, 30); assert.equal(m.v, SCHEMA);
  assert.equal(readBackup(JSON.stringify({ rev: 7, data: backup }), 'son').ok, true);                             // a server copy
  assert.match(readBackup('nope', 'son').why, /JSON/); assert.match(readBackup(JSON.stringify({ names: {} }), 'son').why, /기록 파일이 아니/); assert.match(readBackup(JSON.stringify(backup), 'daughter').why, /다른 아이/);
});

test('D9: format 1 -> 2 (tile bunches): a format-1 record gets an empty bunch list and every word record as it was; the saved format-2 file opens with its bunches', () => {
  assert.equal(SCHEMA, 3);                                                         // the current format (T-007 raised it from 2)
  const v1 = JSON.parse(fs.readFileSync(path.join(SAVES, 'v1-worlds.json'), 'utf8')); assert.equal(v1.v, 1); const words = JSON.stringify(v1.words);
  const m = migrate(JSON.parse(JSON.stringify(v1)), v1.id); assert.deepEqual([m.from, m.state.v, m.state.bunches], [1, SCHEMA, {}]); assert.equal(JSON.stringify(m.state.words), words);
  const raw = JSON.parse(fs.readFileSync(path.join(SAVES, 'v2-bunches.json'), 'utf8')); assert.equal(raw.v, 2);
  const s = migrate(JSON.parse(JSON.stringify(raw)), 'son'); assert.deepEqual([s.from, s.newer], [2, false]); assert.deepEqual(s.state.bunches, raw.bunches); assert.deepEqual(s.state.words, raw.words);
  const res = Object.values(raw.bunches).map((b) => b.result || 'open').sort(); assert.deepEqual(res, ['ok', 'open', 'open', 'split']);
  assert.ok(Object.values(raw.words).some((r) => r.st === 'likely' && r.due === null && r.bunch), 'passed words are in the file');
  const st = mem({ k: JSON.stringify(raw) }); const rec = loadRecord(st, 'k', 'son'); assert.deepEqual([rec.damaged, rec.newer, Object.keys(rec.state.words).length], [false, false, Object.keys(raw.words).length]);
  assert.deepEqual(mergeCards(raw, migrate(JSON.parse(JSON.stringify(v1)), 'son').state).bunches, raw.bunches);   // merging with an older device keeps the bunches
  assert.ok(worldView(IX, IX.worlds[0], s.state, '2026-12-20').nodes.length > 0);
});

// ---- the server ----
async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cards-safe-')); const port = 8093 + Math.floor(Math.random() * 300);
  const srv = spawn('python3', ['tools/serve_cards.py', '--port', String(port), '--state-dir', dir], { stdio: 'ignore' }); const base = `http://127.0.0.1:${port}/api/`;
  try { for (let i = 0; i < 60; i++) { if (await fetch(base + 'ping').then((r) => r.ok, () => false)) break; await new Promise((r) => setTimeout(r, 100)); } await fn(base, dir); } finally { srv.kill(); }
}
const put = (base, name, baseRev, data) => fetch(base + 'doc/' + name, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRev, data }) });
const rec = (n, v = SCHEMA) => ({ v, id: 'son', words: Object.fromEntries(Array.from({ length: n }, (_, i) => ['w' + i, word()])), runs: [], verify: [], log: [{ t: 'x' }] });

test('D7: server: a write that would take words away, or that comes from an older program, is refused and kept aside; the stored record stays', async () => {
  await withServer(async (base, dir) => {
    assert.equal((await put(base, 'p.son', 0, rec(40))).status, 200);
    const shrink = await put(base, 'p.son', 1, rec(3)); const body = await shrink.json();
    assert.equal(shrink.status, 409); assert.equal(body.refused, 'shrink'); assert.equal(Object.keys(body.data.words).length, 40);
    assert.equal(Object.keys((await (await fetch(base + 'doc/p.son')).json()).data.words).length, 40);
    assert.equal(fs.readdirSync(path.join(dir, 'rejected')).filter((f) => f.includes('shrink')).length, 1);
    assert.equal((await put(base, 'p.son', 1, rec(37))).status, 200, 'a few words fewer is not a reset (two devices can differ a little)');
    assert.equal((await put(base, 'p.son', 2, rec(45))).status, 200);
    const old = await put(base, 'p.son', 3, rec(60, SCHEMA - 1)); assert.equal(old.status, 409); assert.equal((await old.json()).refused, 'older-format');
    assert.equal((await put(base, 'meta', 0, { names: { son: 'a' } })).status, 200); assert.equal((await put(base, 'meta', 1, {})).status, 200);   // the names document is not a record
    const small = await put(base, 'p.daughter', 0, rec(5)); assert.equal(small.status, 200); assert.equal((await put(base, 'p.daughter', 1, rec(1))).status, 200);   // too small to judge
  });
});

test('D8: server: every day that was played leaves a dated copy that can be listed and fetched; previous versions are kept too', async () => {
  await withServer(async (base, dir) => {
    await put(base, 'p.son', 0, rec(12)); await put(base, 'p.son', 1, rec(14)); const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const days = (await (await fetch(base + 'snapshots/p.son')).json()).days; assert.equal(days.length, 1); assert.match(days[0], /^\d{4}-\d{2}-\d{2}$/);
    const snap = await (await fetch(`${base}snapshot/p.son/${days[0]}`)).json(); assert.equal(Object.keys(snap.data.words).length, 14); assert.equal(snap.data.log, undefined, 'the dated copy leaves the per-card log out');
    assert.equal((await fetch(`${base}snapshot/p.son/2001-01-01`)).status, 404); assert.equal((await fetch(`${base}snapshot/p.x/${days[0]}`)).status, 404);
    assert.equal(fs.readdirSync(path.join(dir, 'backup')).length, 1); assert.ok(Math.abs(Date.parse(days[0]) - Date.parse(today)) <= 864e5);
    const ping = await (await fetch(base + 'ping')).json(); assert.deepEqual([ping.store, ping.daily, ping.lastDaily, ping.offsite], [true, 1, days[0], null]);
    assert.equal(readBackup(JSON.stringify(snap), 'son').ok, true);
  });
});

// ---- fixes from the cross review C-005 (card T-011) ----
const ping = { ok: true, status: 200, json: async () => ({ ok: true, store: true }) };
const missing = { ok: false, status: 404, json: async () => ({}) };

test('F1: a record of a newer program saved on this device (another tab) is never sent to the server: not at start, not after a change', async () => {
  const future = { v: SCHEMA + 1, id: 'son', words: { a: word(), futureWord: word() }, runs: [], verify: [], log: [], futureOnly: true }; const text = JSON.stringify(future);
  for (const server of ['none', 'older']) {
    const store = mem({ 'cards.v0.p.son': text }); const puts = [];
    const fetchImpl = async (u, o) => { if (o?.method === 'PUT') { puts.push(u); return { ok: true, status: 200, json: async () => ({ rev: 9 }) }; } if (u.endsWith('ping')) return ping;
      if (u.endsWith('doc/p.son') && server === 'older') return { ok: true, status: 200, json: async () => ({ rev: 3, data: { ...newState('son'), words: { b: word() } } }) }; return missing; };
    const sync = new Sync({ storage: store, fetchImpl }); await sync.init();
    sync.changed('p.son'); await sync.flush(); await new Promise((r) => setTimeout(r, 10));
    assert.equal(puts.filter((u) => u.endsWith('p.son')).length, 0, server); assert.equal(sync.stale, true, server); assert.equal(store.getItem('cards.v0.p.son'), text, server);
  }
});

test('F2: runs of the last 30 days are never folded, even past the limit, so another device\'s offline run survives the merge; older runs fold with exact totals', () => {
  const at = (i) => new Date(Date.parse('2026-11-10T00:00:00Z') + i * 60000).toISOString();
  const a = newState('son'); for (let i = 0; i < 501; i++) a.runs.push(run(i, { day: at(i).slice(0, 10), endedAt: at(i) }));   // the review's case: 501 runs a minute apart
  assert.equal(compact(a, '2026-11-16'), false); assert.deepEqual([a.runs.length, a.past], [501, undefined]);
  const b = newState('son'); b.runs = a.runs.slice(0, 100).map((r) => ({ ...r })); b.runs.push(run(0, { day: '2026-11-10', endedAt: '2026-11-10T01:40:30.000Z', tag: 'offline-other' }));
  for (const m of [mergeCards(a, b), mergeCards(b, a)]) { assert.equal(totals(m).n, 502); assert.ok(m.runs.some((r) => r.tag === 'offline-other')); }
  const o = newState('son'); for (let i = 0; i < 600; i++) { const old = i < 150; o.runs.push(run(i, { day: old ? '2026-09-01' : '2026-11-10', endedAt: old ? `2026-09-01T${at(i).slice(11)}` : at(i) })); }
  const copy = JSON.parse(JSON.stringify(o)); const before = totals(copy);
  assert.equal(compact(o, '2026-11-16'), true); assert.deepEqual([o.past.n, o.runs.length], [150, 450]); assert.ok(o.runs.every((r) => r.day === '2026-11-10'));   // the recent 450 stay although the limit is 500
  assert.deepEqual(totals(o), before); assert.equal(compact(o, '2026-11-16'), false);
  for (const m of [mergeCards(o, copy), mergeCards(copy, o)]) assert.deepEqual([totals(m).n, totals(m).cards], [600, before.cards]);   // the unfolded copy is not counted twice
  assert.equal(compact(JSON.parse(JSON.stringify(copy))), false);                                        // no date given: nothing is folded
});

test('F3: at start the sync finds the local record damaged: it is set aside first, then the server copy takes its place (meta too)', async () => {
  const server = { ...newState('son'), words: { s1: word() } }; const broken = '{"v":1,"words":{"localOnly":';
  const store = mem({ 'cards.v0.p.son': broken, 'cards.v0.meta': '[1,' });
  const fetchImpl = async (u, o) => { if (o?.method === 'PUT') return { ok: true, status: 200, json: async () => ({ rev: 9 }) }; if (u.endsWith('ping')) return ping;
    if (u.endsWith('doc/p.son')) return { ok: true, status: 200, json: async () => ({ rev: 4, data: server }) };
    if (u.endsWith('doc/meta')) return { ok: true, status: 200, json: async () => ({ rev: 2, data: { names: { son: '민수' } } }) }; return missing; };
  await new Sync({ storage: store, fetchImpl }).init();
  const kept = (k) => [...store._m.keys()].filter((x) => x.startsWith(k + '.damaged.'));
  assert.equal(kept('cards.v0.p.son').length, 1); assert.equal(store.getItem(kept('cards.v0.p.son')[0]), broken);
  assert.deepEqual(JSON.parse(store.getItem('cards.v0.p.son')), server);
  assert.equal(kept('cards.v0.meta').length, 1); assert.equal(store.getItem(kept('cards.v0.meta')[0]), '[1,'); assert.deepEqual(JSON.parse(store.getItem('cards.v0.meta')).names, { son: '민수' });
});

// ---- tools/backup_state.sh, run for real against throwaway git repositories (no network: CARDS_BACKUP_TEST_HTTP) ----
const GITENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
delete GITENV.CARDS_BACKUP_TEST_HTTP; delete GITENV.CARDS_BACKUP_ASSUME_PRIVATE; delete GITENV.CARDS_BACKUP_REPO; delete GITENV.CARDS_STATE_DIR;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GITENV, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
// A bare repository standing in for the private one, a clone of it (as a parent would make), and a state folder with one record.
function backupSetup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cards-backup-')); const bare = path.join(root, 'remote.git'), dest = path.join(root, 'clone'), state = path.join(root, 'state');
  git(root, 'init', '-q', '--bare', bare); git(root, 'clone', '-q', bare, dest);
  git(dest, 'config', 'user.name', 'Test'); git(dest, 'config', 'user.email', 'test@example.invalid'); git(dest, 'config', 'commit.gpgsign', 'false');
  git(dest, 'commit', '-q', '--allow-empty', '-m', 'start'); git(dest, 'push', '-q', '-u', 'origin', 'HEAD');
  fs.mkdirSync(state); fs.writeFileSync(path.join(state, 'p.son.json'), JSON.stringify({ rev: 1, data: { v: SCHEMA, id: 'son', words: {} } }));
  return { root, bare, dest, state };
}
const backup = (b, env = {}) => { const r = spawnSync('bash', ['tools/backup_state.sh', b.dest], { env: { ...GITENV, CARDS_STATE_DIR: b.state, ...env }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr, off: JSON.parse(fs.readFileSync(path.join(b.state, 'offsite.json'), 'utf8')) }; };
const pushed = (b) => Number(git(b.bare, 'rev-list', '--count', 'HEAD'));
// origin is a GitHub address; git is told to deliver pushes for it to the throwaway bare repository instead.
const onGitHub = (b, url = 'https://github.com/example/cards-state.git') => { git(b.dest, 'remote', 'set-url', 'origin', url); git(b.dest, 'config', `url.${b.bare}.insteadOf`, url); return b; };

test('F4: a backup that cannot be pushed is recorded as failed every time, also on a second run with nothing new', () => {
  const b = backupSetup(); git(b.dest, 'remote', 'set-url', 'origin', path.join(b.root, 'nowhere.git'));   // a folder that does not exist: the push fails
  const r1 = backup(b); assert.deepEqual([r1.code, r1.off.ok], [1, false], r1.out);
  const r2 = backup(b); assert.deepEqual([r2.code, r2.off.ok], [1, false], r2.out); assert.match(r2.out, /git push 실패/);
  assert.equal(Number(git(b.dest, 'rev-list', '--count', 'HEAD')), 2, 'committed in the clone once');
  const c = backupSetup(); const r3 = backup(c); assert.deepEqual([r3.code, r3.off.ok, r3.off.note, pushed(c)], [0, true, '올림', 2], r3.out);   // a reachable folder: pushed
  const r4 = backup(c); assert.deepEqual([r4.code, r4.off.ok, r4.off.note], [0, true, '변경 없음'], r4.out);
});

test('F5: the push target must be private: a public GitHub repository, one that cannot be checked, or another host is refused before anything is copied', () => {
  for (const [code, why] of [['200', /공개 저장소/], ['000', /확인할 수 없습니다/], ['403', /확인할 수 없습니다/]]) {
    const b = onGitHub(backupSetup()); const r = backup(b, { CARDS_BACKUP_TEST_HTTP: code });
    assert.deepEqual([r.code, r.off.ok], [1, false], code); assert.match(r.out, why, code);
    assert.equal(fs.existsSync(path.join(b.dest, 'state-cards')), false, code + ': nothing copied'); assert.equal(pushed(b), 1, code + ': nothing pushed');
  }
  const ssh = backupSetup(); git(ssh.dest, 'remote', 'set-url', 'origin', 'git@github.com:example/cards-state.git');
  const rs = backup(ssh, { CARDS_BACKUP_TEST_HTTP: '200' }); assert.deepEqual([rs.code, fs.existsSync(path.join(ssh.dest, 'state-cards'))], [1, false]); assert.match(rs.out, /example\/cards-state/);
  const other = backupSetup(); git(other.dest, 'remote', 'set-url', 'origin', 'https://git.example.com/x/y.git');
  const ro = backup(other, { CARDS_BACKUP_TEST_HTTP: '404' }); assert.deepEqual([ro.code, fs.existsSync(path.join(other.dest, 'state-cards'))], [1, false]); assert.match(ro.out, /GitHub 저장소나/);
  const priv = onGitHub(backupSetup()); const rp = backup(priv, { CARDS_BACKUP_TEST_HTTP: '404' });          // private: GitHub answers 404 without signing in
  assert.deepEqual([rp.code, rp.off.ok, pushed(priv)], [0, true, 2], rp.out); assert.ok(fs.existsSync(path.join(priv.dest, 'state-cards', 'p.son.json')));
  const local = backupSetup(); const rl = backup(local); assert.deepEqual([rl.code, rl.off.ok, pushed(local)], [0, true, 2], rl.out);   // a folder on this Mac
  const told = onGitHub(backupSetup()); const rt = backup(told, { CARDS_BACKUP_TEST_HTTP: '000', CARDS_BACKUP_ASSUME_PRIVATE: '1' }); assert.deepEqual([rt.code, pushed(told)], [0, 2], rt.out);   // the parent checked it
  const none = backupSetup(); git(none.dest, 'remote', 'remove', 'origin'); const rn = backup(none); assert.deepEqual([rn.code, fs.existsSync(path.join(none.dest, 'state-cards'))], [1, false]);
});
