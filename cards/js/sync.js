// Keeps a copy of each document (meta, p.son, p.daughter) on the home server (tools/serve_cards.py).
// localStorage stays the working copy; the server copy lets the Mac mini and the iPad share progress and
// survives the browser clearing its storage. Without a server the cards work on this device only.
// Adapted from the earlier game's sync.js (removed; commit 8acc013); only the document shapes and the merge rules differ.
import { SCHEMA } from './deck.js';
import { migrate, setAside } from './store.js';
const SYNC_KEY = 'cards.v0.sync';
const LOG_CAP = 5000;
export const DOCS = ['meta', 'p.son', 'p.daughter'];
const localKey = (name) => 'cards.v0.' + name;

// How far a word has got. When both records carry the time of their last change (`at`, deck.Run._set), the later change
// wins, so a miss later on the same day is kept. Otherwise a later lastDay wins; on the same day the more advanced state wins.
const rank = (r) => (r.st === 'done' ? 100 : r.st === 'review' ? 10 + (r.step || 0) : r.st === 'likely' ? 5 + (r.lstep || 0) : 1);
const evidence = (r) => [r.lastDay || '', r.firstDay || '', String(rank(r)).padStart(3, '0')];
const stamped = (r) => Number.isFinite(r.at);
const newer = (x, y) => { if (stamped(x) && stamped(y) && x.at !== y.at) return y.at > x.at ? y : x;
  const a = evidence(x), b = evidence(y); for (let i = 0; i < a.length; i++) { if (a[i] === b[i]) continue; return b[i] > a[i] ? y : x; } return x; };
const uniq = (arr, key) => { const seen = new Set(); return arr.filter((e) => { const k = key(e); if (seen.has(k)) return false; seen.add(k); return true; }); };
const last = (runs) => (runs || []).reduce((m, r) => (String(r.endedAt || '') > m ? String(r.endedAt || '') : m), '');
const maxStr = (x, y) => (x == null ? y : y == null ? x : String(x) >= String(y) ? x : y);
const minStr = (x, y) => (x == null ? y : y == null ? x : String(x) <= String(y) ? x : y);

// Map progress only ever grows (cleared tiles, castles, stamps, continent castles), so it is merged by union and the
// earliest day. Keys are counted from the merged castles. Stars and items cannot be summed without knowing the common
// base, so the larger value is kept: if both devices earned stars while apart, the smaller earning is lost. None of
// this touches a word's schedule.
// `open` marks tile runs that were started and not finished (world.startTile): united too, but a tile cleared on either
// side is finished, so its mark goes. The key is left out when no mark is left (records without marks keep their shape).
const early = (x, y) => { const out = { ...(y || {}) }; for (const [k, d] of Object.entries(x || {})) out[k] = minStr(out[k], d); return out; };
function mergeWorlds(a = {}, b = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[id] || {}, y = b[id] || {};
    const cleared = early(x.cleared, y.cleared), open = early(x.open, y.open); for (const k of Object.keys(cleared)) delete open[k];
    out[id] = { castle: minStr(x.castle, y.castle) ?? null, seen: minStr(x.seen, y.seen) ?? null, cleared, stamps: early(x.stamps, y.stamps) };
    if (Object.keys(open).length) out[id].open = open; }
  return out;
}
function mergeMap(a, b) {
  if (!a) return b; if (!b) return a;
  const worlds = mergeWorlds(a.worlds, b.worlds); const conts = {};
  for (const id of new Set([...Object.keys(a.conts || {}), ...Object.keys(b.conts || {})])) conts[id] = { castle: minStr(a.conts?.[id]?.castle, b.conts?.[id]?.castle) ?? null };
  const monsterDay = maxStr(a.monsterDay, b.monsterDay);
  const monsterN = Math.max(a.monsterDay === monsterDay ? a.monsterN || 1 : 0, b.monsterDay === monsterDay ? b.monsterN || 1 : 0);
  return { stars: Math.max(a.stars || 0, b.stars || 0), keys: Object.values(worlds).filter((w) => w.castle).length, best: Math.max(a.best || 0, b.best || 0),
    items: { shield: Math.max(a.items?.shield || 0, b.items?.shield || 0), flame: Math.max(a.items?.flame || 0, b.items?.flame || 0) },
    bag: a.bag ?? b.bag ?? null, worlds, conts, at: a.at ?? b.at ?? null, monsterDay, monsterN, bonusDay: maxStr(a.bonusDay, b.bonusDay), bat: mergeBat(a.bat, b.bat) };
}
// Bat gauge: the side that took the latest test has already emptied it, so it wins; otherwise the fuller gauge and the union of met words.
function mergeBat(a, b) {
  if (!a) return b; if (!b) return a;
  if ((a.last || '') !== (b.last || '')) return (a.last || '') > (b.last || '') ? a : b;
  return { fill: Math.max(a.fill || 0, b.fill || 0), cap: a.cap ?? b.cap, last: a.last ?? null, met: uniq([...(a.met || []), ...(b.met || [])], (x) => x).slice(-200) };
}

// Pure and symmetric enough for two devices that both changed the same child's record.
// Both sides are first brought to the current format. A record saved by a later program than this one is returned
// untouched: this code does not know its fields and must not rewrite them.
export function mergeCards(a, b) {
  if (!a) return b; if (!b) return a;
  const ma = migrate(a), mb = migrate(b); if (ma.newer || mb.newer) return (ma.newer ? ma : mb).state; a = ma.state; b = mb.state;
  const out = { ...b, ...a, v: Math.max(a.v || 0, b.v || 0), id: a.id || b.id };
  out.words = { ...(b.words || {}) };
  for (const [id, r] of Object.entries(a.words || {})) { const o = out.words[id]; if (!o) { out.words[id] = r; continue; } const w = newer(o, r); const other = w === o ? r : o;
    out.words[id] = !('bunch' in w) && other.bunch != null ? { ...w, bunch: other.bunch } : w; }   // the bunch tag is kept whichever side wins
  out.bunches = mergeBunches(a.bunches, b.bunches);
  // Old run records are folded into totals (store.compact). The side that folded further wins; runs it already counted are dropped.
  const past = !a.past ? b.past : !b.past ? a.past : String(a.past.until) >= String(b.past.until) ? a.past : b.past; if (past) out.past = past; else delete out.past;
  out.runs = uniq([...(a.runs || []), ...(b.runs || [])], (r) => [r.endedAt, r.day, r.n, r.tag].join('|')).filter((r) => !past || String(r.endedAt) > String(past.until)).sort((x, y) => String(x.endedAt).localeCompare(String(y.endedAt)));
  out.log = uniq([...(a.log || []), ...(b.log || [])], (e) => [e.t, e.id, e.role, e.form, e.ok].join('|')).sort((x, y) => String(x.t).localeCompare(String(y.t))).slice(-LOG_CAP);
  out.verify = (last(a.runs) >= last(b.runs) ? a.verify : b.verify) || [];       // adaptive check rate: follow the side that played last
  if (a.map || b.map) out.map = mergeMap(a.map, b.map);
  return out;
}
// Tile bunches: a finished check wins (both finished: the earlier one); both open: the earlier due date.
function mergeBunches(a = {}, b = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[id], y = b[id];
    if (!x || !y) { out[id] = { ...(x || y) }; continue; }
    if (x.done || y.done) { out[id] = { ...(!y.done ? x : !x.done ? y : String(x.done) < String(y.done) || (x.done === y.done && String(x.result) <= String(y.result)) ? x : y) }; continue; }
    out[id] = { due: minStr(x.due, y.due) ?? null, done: null }; }
  return out;
}
export function mergeMeta(local, remote, localDirty) {
  if (!local) return remote; if (!remote) return local;
  return localDirty ? { ...remote, ...local } : { ...local, ...remote };
}

export class Sync {
  constructor({ storage, fetchImpl, base = 'api/', onMerged = () => {}, onStatus = () => {}, debounceMs = 0 }) {
    this.s = storage; this.fetch = fetchImpl; this.base = base; this.onMerged = onMerged; this.onStatus = onStatus; this.debounceMs = debounceMs; this.timers = {};
    this.available = null; this.lastError = null; this.inFlight = {}; this.again = {}; this.stale = false;   // stale: the server holds a newer format than this program
    try { this.state = JSON.parse(this.s.getItem(SYNC_KEY)) || {}; } catch { this.state = {}; }
    this.state.revs ||= {}; this.state.dirty ||= {};
  }
  _saveState() { try { this.s.setItem(SYNC_KEY, JSON.stringify(this.state)); } catch {} }
  // A local copy that cannot be read (not JSON, or not an object) is set aside first, like store.loadRecord does, and then
  // counts as missing: the server copy may take the key, the original text is kept under a ".damaged." key.
  _local(name) {
    let v = null; try { v = this.s.getItem(localKey(name)); } catch { return null; }
    if (v == null || v === '') return null;
    let o = null; try { o = JSON.parse(v); } catch {}
    if (o && typeof o === 'object' && !Array.isArray(o)) return o;
    setAside(this.s, localKey(name), v); return null;
  }
  _setLocal(name, data) { this.s.setItem(localKey(name), JSON.stringify(data)); }
  _merge(name, local, remote) { return name === 'meta' ? mergeMeta(local, remote, !!this.state.dirty[name]) : mergeCards(local, remote); }
  get pending() { return Object.keys(this.state.dirty).filter((k) => this.state.dirty[k]); }
  _status() { this.onStatus({ available: this.available, pending: this.pending, error: this.lastError, stale: this.stale }); }
  _newer(name, data) { if (name !== 'meta' && data && Number.isInteger(data.v) && data.v > SCHEMA) { this.stale = true; return true; } return false; }

  // Called once at start. Never throws; without a server it just reports unavailable.
  async init(timeoutMs = 2500) {
    try {
      const r = await this._timed(this.fetch(this.base + 'ping'), timeoutMs);
      const j = r.ok ? await r.json() : null; this.available = !!(j && j.store);
    } catch { this.available = false; }
    if (this.available) for (const name of DOCS) { try { await this.reconcile(name); } catch (e) { this.lastError = String(e.message || e); } }
    this._status(); return this.available;
  }
  _timed(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); }

  async reconcile(name) {
    const r = await this.fetch(this.base + 'doc/' + name);
    const local = this._local(name);
    if (this._newer(name, local)) { this._status(); return; }                       // a newer program saved on this device (another tab): this page sends nothing
    if (r.status === 404) { this.state.revs[name] = 0; if (local) return this.push(name); return; }
    if (!r.ok) throw new Error('server ' + r.status);
    const remote = await r.json();
    if (this._newer(name, remote.data)) { this._status(); return; }                 // an old page must not rewrite a newer record: reload first
    if (!local) { this._setLocal(name, remote.data); this.state.revs[name] = remote.rev; this.state.dirty[name] = false; this._saveState(); this.onMerged(name, remote.data); return; }
    if (this.state.revs[name] === remote.rev) { if (this.state.dirty[name]) return this.push(name); return; }
    const merged = this._merge(name, local, remote.data);
    this._setLocal(name, merged); this.state.revs[name] = remote.rev; this.onMerged(name, merged);
    if (JSON.stringify(merged) !== JSON.stringify(remote.data)) { this.state.dirty[name] = true; this._saveState(); return this.push(name); }
    this.state.dirty[name] = false; this._saveState();
  }

  // Local copy changed. Fire-and-forget; failures leave the doc marked dirty for the next attempt.
  changed(name) {
    if (!DOCS.includes(name)) return;
    this.state.dirty[name] = true; this._saveState();
    this._status();
    if (!this.available) return;
    if (!this.debounceMs) { this.push(name).catch(() => {}); return; }
    clearTimeout(this.timers[name]);                      // coalesce the per-card saves of a run
    this.timers[name] = setTimeout(() => this.push(name).catch(() => {}), this.debounceMs);
  }
  async push(name, tries = 3) {
    if (this.inFlight[name]) { this.again[name] = true; return this.inFlight[name]; }
    const run = async () => {
      try {
        for (let i = 0; i < tries; i++) {
          const data = this._local(name); if (!data) return;
          if (this._newer(name, data)) throw new Error('newer program on this device');   // stale is set: reload first
          const sent = JSON.stringify(data);
          const r = await this.fetch(this.base + 'doc/' + name, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseRev: this.state.revs[name] || 0, data }) });
          if (r.status === 409) {                       // another device saved first: merge and retry
            const remote = await r.json();
            if (this._newer(name, remote.data)) throw new Error('newer program on the server');
            const merged = this._merge(name, this._local(name), remote.data);
            this._setLocal(name, merged); this.state.revs[name] = remote.rev; this._saveState(); this.onMerged(name, merged);
            continue;
          }
          if (!r.ok) throw new Error('server ' + r.status);
          this.state.revs[name] = (await r.json()).rev;
          this.state.dirty[name] = JSON.stringify(this._local(name)) !== sent;   // changed again while sending
          this.lastError = null; this._saveState(); return;
        }
        throw new Error('conflict not resolved');
      } catch (e) { this.lastError = String(e.message || e); this.state.dirty[name] = true; this._saveState(); }
    };
    this.inFlight[name] = run().finally(() => {
      delete this.inFlight[name]; this._status();
      if (this.again[name] || (this.state.dirty[name] && !this.lastError)) { this.again[name] = false; return this.push(name); }
    });
    return this.inFlight[name];
  }
  // Retry everything that is still only on this device (called on focus / after a run).
  async flush() {
    if (!this.available) { await this.init(); return; }
    for (const n of this.pending) { clearTimeout(this.timers[n]); await this.push(n); }
  }
}
