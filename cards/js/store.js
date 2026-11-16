// A child's saved record: format version, upgrades from every older format, and the guards that keep a program update
// from ever resetting progress (docs/DATA_SAFETY.md). Pure: storage is passed in.
//
// Rules for whoever changes the saved format:
//   1. Raise SCHEMA and add one step to STEPS that turns the previous format into the new one. Never drop word records.
//   2. Add a file saved by the old program to tests/fixtures/saves/. The tests open every file there with the new code.
//   3. The storage keys (cards.v0.p.<child>) never change: the "v0" in the key is part of the name, not a version.
import { SCHEMA, newState } from './deck.js';

const RUNS_KEEP = 300, RUNS_MAX = 500;      // older run records are folded into totals so the record cannot outgrow the browser's storage
const SUMS = ['cards', 'wall', 'claims', 'verifies', 'verifyOk', 'reviews', 'reviewOk', 'fresh', 'known', 'unknown', 'learned', 'lapses', 'bosses', 'stars', 'spots', 'spotOk', 'bunchOk', 'bunchDone'];

// One step per format change: STEPS[n] upgrades a record of version n to n + 1.
const STEPS = [
  (s) => {                                               // 0 -> 1: the 60-word prototype kept one world's tiles at the top of the map
    s.words ||= {}; s.verify ||= []; s.runs ||= []; s.log ||= [];
    if (s.map && (s.map.cleared || 'castle' in s.map)) { s.map.legacy = { cleared: s.map.cleared || {}, castle: s.map.castle ?? null }; delete s.map.cleared; delete s.map.castle; }
    if (s.map) { s.map.worlds ||= {}; s.map.conts ||= {}; }
    return s;
  },
  (s) => { s.bunches ||= {}; return s; },              // 1 -> 2: tile triage keeps one record per tile bunch (passed words carry `bunch`); word records untouched
];
// -> { state, from, newer }. `newer`: the record was saved by a later program than this one; it must not be changed.
export function migrate(raw, id = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { state: newState(id), from: null, newer: false };
  const from = Number.isInteger(raw.v) ? raw.v : 0;
  if (from > SCHEMA) return { state: raw, from, newer: true };
  let s = raw; for (let v = from; v < SCHEMA; v++) s = STEPS[v](s);
  s.v = SCHEMA; if (id && !s.id) s.id = id; s.words ||= {}; s.verify ||= []; s.runs ||= []; s.log ||= [];
  return { state: s, from, newer: false };
}

// Totals of the run records that were folded away. `until` = endedAt of the newest folded run.
export function compact(state) {
  if ((state.runs || []).length <= RUNS_MAX) return false;
  const runs = state.runs.slice().sort((a, b) => String(a.endedAt).localeCompare(String(b.endedAt))); const old = runs.slice(0, runs.length - RUNS_KEEP);
  const past = (state.past ||= { n: 0, until: '', days: 0 }); const days = new Set(old.map((r) => r.day));
  for (const r of old) { past.n++; for (const k of SUMS) past[k] = (past[k] || 0) + (r[k] || 0); if (String(r.endedAt) > past.until) past.until = String(r.endedAt); }
  past.days += days.size; state.runs = runs.slice(-RUNS_KEEP); return true;
}
// Sum over every run ever played: the folded totals plus the records still kept.
export function totals(state) {
  const t = Object.fromEntries(SUMS.map((k) => [k, state.past?.[k] || 0])); t.n = state.past?.n || 0;
  for (const r of state.runs || []) { t.n++; for (const k of SUMS) t[k] += r[k] || 0; }
  return t;
}

// Reads a child's record. A record that cannot be read is never overwritten silently: its text is kept under a
// "damaged" key (the three newest are kept) and the caller is told.
export function loadRecord(storage, key, id) {
  let text = null; try { text = storage.getItem(key); } catch { return { state: newState(id), damaged: false, newer: false, missing: true }; }
  if (text == null || text === '') return { state: newState(id), damaged: false, newer: false, missing: true };
  try { const m = migrate(JSON.parse(text), id); if (m.from === null) throw new Error('not a record'); return { state: m.state, damaged: false, newer: m.newer, missing: false, from: m.from }; }
  catch {
    try {
      storage.setItem(`${key}.damaged.${Date.now()}`, text);
      const olds = []; for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(key + '.damaged.')) olds.push(k); }
      for (const k of olds.sort().slice(0, -3)) storage.removeItem(k);
      storage.removeItem(key);                           // the copy is safe: the main key is free for the server's record or a new one
    } catch { /* storage full: the damaged text stays under the main key until something valid replaces it */ }
    return { state: newState(id), damaged: true, newer: false, missing: false };
  }
}
// Checks a file a parent chose for "restore": it must be one child's record (or a server snapshot of it).
export function readBackup(text, id) {
  let o; try { o = JSON.parse(text); } catch { return { ok: false, why: '파일을 읽을 수 없어요 (JSON 형식이 아님)' }; }
  if (o && typeof o === 'object' && o.data && 'rev' in o) o = o.data;                 // a server copy: { rev, data }
  if (!o || typeof o !== 'object' || typeof o.words !== 'object') return { ok: false, why: '아이의 기록 파일이 아니에요' };
  if (o.id && id && o.id !== id) return { ok: false, why: '다른 아이의 기록이에요' };
  const m = migrate(o, id); if (m.newer) return { ok: false, why: '이 파일은 더 새로운 프로그램에서 저장됐어요. 프로그램을 먼저 새로 고치세요' };
  return { ok: true, state: m.state, words: Object.keys(m.state.words).length };
}
