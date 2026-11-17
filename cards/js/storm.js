// Word-form cards ("find the base word": went -> go) and the whirlwind that brings them to the child (card T-007,
// docs/LEARNING_VALUE_SPEC.md 2.6). Pure: no DOM, no storage, no clock (today / now / rng are injected).
//
// The whirlwind lives in one world's map graph (the world file's edges, both ways). It appears after a finished run on the
// tile farthest from the delivery rider (the child's place, `map.worlds[world].here`) and comes one step closer after every
// finished run. When it reaches the rider, tile, monster and review runs of that world wait until a storm run is played.
// Nothing here writes to a word record, a tile bunch or the bat gauge: the answers only go to `state.forms`, and the stars
// it pays never feed back into deck.js.
import { shuffle } from './deck.js';
import { ensureMap, batState } from './map.js';

// on: false = no whirlwind. cards: cards in one storm run. need: forms that can be asked before one appears.
// chance: chance per finished run. perDay: whirlwinds per day. doneAt: right answers in a row (on different days) that finish a form.
export const STORM = { on: true, cards: 5, need: 5, chance: 0.35, perDay: 3, doneAt: 2 };
const LOG_CAP = 5000;

// Index the forms file (cards/data/forms.json). Forms whose changed spelling is another card's base word (`clash`) are left
// out for good. No file (null) = no whirlwind.
export function indexForms(doc) {
  if (!doc || !Array.isArray(doc.forms)) return null;
  const forms = doc.forms.filter((f) => f && f.id && f.base && f.baseForm && f.form && !(Array.isArray(f.clash) && f.clash.length));
  const byId = Object.fromEntries(forms.map((f) => [f.id, f])); const byBase = {};
  for (const f of forms) (byBase[f.base] ||= []).push(f);
  return { forms, byId, byBase };
}

// A form's record: { n: times asked, ok: right answers in a row (one per day at most), last: day, at: ms }.
export const formDone = (r) => !!r && (r.ok || 0) >= STORM.doneAt;
const okToday = (r, today) => !!r && r.last === today && (r.ok || 0) > 0;
// Forms that can be asked: the base word has a record (met in any world), the form is not finished, not answered right today.
export function formPool(state, fx, today) {
  if (!fx) return []; const rec = state.forms || {};
  return fx.forms.filter((f) => state.words[f.base] && !formDone(rec[f.id]) && !okToday(rec[f.id], today));
}
// One answer to a form. A second right answer on the same day does not count again; a wrong one starts the row again.
export function recordForm(state, id, ok, today, at) {
  const forms = (state.forms ||= {}); const r = forms[id] || { n: 0, ok: 0, last: null, at: null };
  const row = ok ? (r.last === today && (r.ok || 0) > 0 ? r.ok : (r.ok || 0) + 1) : 0;
  forms[id] = { n: (r.n || 0) + 1, ok: row, last: today, at };
  return forms[id];
}

// ---- the map ----
// Where the rider stands in a world: the last tile cleared by a run that reached its end (world.settleWorld), else the start.
export function hereOf(state, w) { const h = ensureMap(state).worlds[w.id]?.here; return h && w._nodes[h] ? h : w.map.startNodeId; }
// Steps from one node to every node it is joined to, along the world file's edges (both ways).
export function distances(w, from) {
  const d = { [from]: 0 }; const q = [from];
  while (q.length) { const v = q.shift(); for (const x of w._adj[v] || []) if (!(x in d)) { d[x] = d[v] + 1; q.push(x); } }
  return d;
}
// The whirlwind, if it points at a node that exists; anything else is treated as no whirlwind.
export function stormOf(state, ix) {
  const s = ensureMap(state).storm; const w = s && ix && ix.byId[s.wid];
  return w && w._nodes[s.node] ? s : null;
}
// True while the whirlwind stands on the rider's node: tile, monster and review runs of that world cannot start (world.nodeRun).
// With whirlwinds switched off (STORM.on false: the forms file could not be read, or a test) nothing is ever blocked.
export function stormBlocks(state, wid, ix) {
  if (!STORM.on) return false;
  const s = stormOf(state, ix); if (!s || s.wid !== wid) return false;
  return s.node === hereOf(state, ix.byId[wid]);
}
// A whirlwind with nothing left to ask (every form finished or answered right today, or no forms file) goes away at once,
// so it can never hold the rider with an empty storm run. The screen calls this before it shows a map. -> true when it left.
export function stormRelease(state, ix, fx, today) {
  const m = ensureMap(state); if (!m.storm) return false;
  if (STORM.on && fx && stormOf(state, ix) && formPool(state, fx, today).length) return false;
  m.storm = null; return true;
}
// Called once after every run, after map.settleRun and world.settleWorld. run = { wid, kind, reason } of the run that ended.
// -> { event: null | 'spawn' | 'move' | 'caught' | 'gone', node }
export function stormTick(state, ix, fx, { wid, kind, reason } = {}, today, rng) {
  const m = ensureMap(state); const cur = () => ({ node: m.storm ? m.storm.node : null });
  if (!STORM.on || !fx || !ix) return { event: null, ...cur() };
  if (kind === 'bat' || kind === 'storm' || reason !== 'done') return { event: null, ...cur() };
  if (batState(state, today).full) return { event: null, ...cur() };            // the bat test comes first; the whirlwind waits
  const w = ix.byId[wid]; if (!w) return { event: null, ...cur() };              // a run outside any world (continent castle)
  const gone = () => { const node = m.storm ? m.storm.node : null; m.storm = null; return { event: 'gone', node }; };
  if (m.storm && !stormOf(state, ix)) return gone();                             // points at a node no world file has
  if (m.storm && m.storm.wid !== wid) return gone();                             // the child played elsewhere: it leaves quietly
  const pool = formPool(state, fx, today); const here = hereOf(state, w);
  if (m.storm) {
    if (!pool.length) return gone();
    const s = m.storm; if (s.node === here) return { event: null, node: s.node };   // already caught: it waits for the storm run
    const d = distances(w, here); if (!(s.node in d)) return gone();             // cannot reach the rider
    const next = w._adj[s.node].find((x) => d[x] === d[s.node] - 1);              // one step along a shortest way (first in the file's edge order)
    m.storm = { ...s, node: next };
    return { event: next === here ? 'caught' : 'move', node: next };
  }
  const n = m.stormDay === today ? m.stormN || 0 : 0;
  if (pool.length < STORM.need || n >= STORM.perDay) return { event: null, node: null };
  if (!(rng() < STORM.chance)) return { event: null, node: null };
  const d = distances(w, here); let far = 0; let at = [];
  for (const node of w.map.nodes) { if (node.kind !== 'tile' || !(node.id in d) || d[node.id] === 0) continue;   // any tile, locked ones too
    if (d[node.id] > far) { far = d[node.id]; at = [node.id]; } else if (d[node.id] === far) at.push(node.id); }
  if (!at.length) return { event: null, node: null };
  const node = at[Math.floor(rng() * at.length)];
  m.storm = { wid: w.id, node, day: today }; m.stormDay = today; m.stormN = n + 1;
  return { event: 'spawn', node };
}

// ---- the storm run ----
// Up to STORM.cards forms from the pool, forms never asked first. Each card shows the changed form and three base words:
// the right one and two of its look-alikes. A card answered wrong comes back once at the end; only first answers are recorded.
export class StormRun {
  constructor({ state, fx, words = [], today, rng, now = () => Date.now() }) {
    this.s = state; this.today = today; this.rng = rng; this.now = now; this.startedAt = now(); this.t0 = null; this.ended = null;
    const ko = Object.fromEntries(words.map((w) => [w.id, w.ko || '']));
    const pool = formPool(state, fx, today); const rec = state.forms || {};
    const fresh = pool.filter((f) => !(rec[f.id]?.n)), seen = pool.filter((f) => rec[f.id]?.n);
    const picks = shuffle(fresh, rng).concat(shuffle(seen, rng)).slice(0, STORM.cards);
    this.cards = picks.map((f) => ({ id: f.id, form: f.form, base: f.base, baseForm: f.baseForm, ko: ko[f.base] || '', kind: f.kind, options: this._options(f) }));
    this.queue = this.cards.map((c) => ({ card: c, again: false })); this.i = 0; this.first = {};
    this.stats = { cards: 0, formOk: 0, formMiss: 0, again: 0, againOk: 0, ms: 0, stars: 0 };
  }
  _options(f) {
    const others = [...new Set((f.lookalikes || []).filter((x) => x && x !== f.baseForm))];
    return shuffle([f.baseForm, ...shuffle(others, this.rng).slice(0, 2)], this.rng);
  }
  get current() { return this.ended ? null : this.queue[this.i]?.card || null; }
  get left() { return Math.max(0, this.queue.length - this.i); }
  show() { this.t0 = this.now(); return this.current; }
  // idx = option index. -> { ok, answer (the base word), picked, again (this was the second showing), form }
  pick(idx) {
    const q = this.queue[this.i]; if (!q || this.ended) throw new Error('no card');
    const c = q.card; const ok = c.options[idx] === c.baseForm; const ms = this.t0 == null ? 0 : this.now() - this.t0; this.t0 = null;
    this.stats.cards++; this.stats.ms += ms;
    if (!q.again) {
      this.first[c.id] = ok; recordForm(this.s, c.id, ok, this.today, this.now());
      if (ok) { this.stats.formOk++; this.stats.stars++; } else { this.stats.formMiss++; this.queue.push({ card: { ...c, options: shuffle(c.options, this.rng) }, again: true }); }
    } else { this.stats.again++; if (ok) this.stats.againOk++; }
    this.s.log ||= [];
    this.s.log.push({ t: new Date(this.now()).toISOString(), day: this.today, id: c.id, role: 'storm', form: 'base', ok, verified: false, said: 'know', ms, sound: null, again: q.again });
    if (this.s.log.length > LOG_CAP) this.s.log = this.s.log.slice(-LOG_CAP);
    return { ok, answer: c.baseForm, base: c.base, ko: c.ko, picked: idx, again: q.again, form: c.form, kind: c.kind };
  }
  advance() { this.i++; return this.current; }
  // The run record (kind 'storm') joins state.runs. Its counters for new words, reviews and checks are zero, so the parent's
  // totals (store.totals) and run table read it like any other run without counting it as learning.
  finish(reason = 'done') {
    if (this.ended) return this.ended;
    const n = (this.s.runs ||= []).filter((r) => r.day === this.today).length + 1;
    const zero = { claims: 0, verifies: 0, verifyOk: 0, fresh: 0, known: 0, unknown: 0, learned: 0, reviews: 0, reviewOk: 0, lapses: 0, bosses: 0, castleOk: 0, castleMiss: 0, testOk: 0, testMiss: 0, spots: 0, spotOk: 0, bunchOk: 0, bunchDone: 0 };
    this.ended = { day: this.today, n, reason, kind: 'storm', tag: 'storm', ...zero, ...this.stats, changed: 0, wall: this.now() - this.startedAt, endedAt: new Date(this.now()).toISOString() };
    this.s.runs.push(this.ended);
    return this.ended;
  }
}
// After a storm run. Reached its end: the whirlwind goes and the stars (cards right at the first answer) are paid.
// Left early: the whirlwind stays where it is. Items, the bat gauge, word records and bunches are not touched.
export function settleStorm(state, rec, today) {
  const m = ensureMap(state);
  if (!rec || rec.reason !== 'done') return { cleared: false, stars: 0 };
  m.storm = null; const stars = rec.stars || 0; m.stars = (m.stars || 0) + stars;
  return { cleared: true, stars, day: today };
}
