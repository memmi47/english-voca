// Keeps a copy of each document (meta, p.son, p.daughter) on the home server (tools/serve_cards.py).
// localStorage stays the working copy; the server copy lets the Mac mini and the iPad share progress and
// survives the browser clearing its storage. Without a server the cards work on this device only.
// Adapted from game/js/sync.js (left unchanged); only the document shapes and the merge rules differ.
const SYNC_KEY = 'cards.v0.sync';
const LOG_CAP = 5000;
export const DOCS = ['meta', 'p.son', 'p.daughter'];
const localKey = (name) => 'cards.v0.' + name;

// How far a word has got. A later lastDay wins; on the same day the more advanced state wins.
const rank = (r) => (r.st === 'done' ? 100 : r.st === 'review' ? 10 + (r.step || 0) : r.st === 'likely' ? 5 + (r.lstep || 0) : 1);
const evidence = (r) => [r.lastDay || '', r.firstDay || '', String(rank(r)).padStart(3, '0')];
const newer = (x, y) => { const a = evidence(x), b = evidence(y); for (let i = 0; i < a.length; i++) { if (a[i] === b[i]) continue; return b[i] > a[i] ? y : x; } return x; };
const uniq = (arr, key) => { const seen = new Set(); return arr.filter((e) => { const k = key(e); if (seen.has(k)) return false; seen.add(k); return true; }); };
const last = (runs) => (runs || []).reduce((m, r) => (String(r.endedAt || '') > m ? String(r.endedAt || '') : m), '');
const maxStr = (x, y) => (x == null ? y : y == null ? x : String(x) >= String(y) ? x : y);
const minStr = (x, y) => (x == null ? y : y == null ? x : String(x) <= String(y) ? x : y);

// Map progress: cleared tiles, castle and keys only ever grow, so they are merged by union / max.
// Stars and items cannot be summed without knowing the common base, so the larger value is kept: if both
// devices earned stars while apart, the smaller earning is lost. That never touches a word's schedule.
function mergeMap(a, b) {
  if (!a) return b; if (!b) return a;
  const cleared = { ...(b.cleared || {}) };
  for (const [k, d] of Object.entries(a.cleared || {})) cleared[k] = minStr(cleared[k], d);
  return { stars: Math.max(a.stars || 0, b.stars || 0), keys: Math.max(a.keys || 0, b.keys || 0), best: Math.max(a.best || 0, b.best || 0),
    items: { shield: Math.max(a.items?.shield || 0, b.items?.shield || 0), flame: Math.max(a.items?.flame || 0, b.items?.flame || 0) },
    bag: a.bag ?? b.bag ?? null, cleared, castle: minStr(a.castle, b.castle), monsterDay: maxStr(a.monsterDay, b.monsterDay), bonusDay: maxStr(a.bonusDay, b.bonusDay) };
}

// Pure and symmetric enough for two devices that both changed the same child's record.
export function mergeCards(a, b) {
  if (!a) return b; if (!b) return a;
  const out = { ...b, ...a, v: a.v ?? b.v ?? 0, id: a.id || b.id };
  out.words = { ...(b.words || {}) };
  for (const [id, r] of Object.entries(a.words || {})) out.words[id] = out.words[id] ? newer(out.words[id], r) : r;
  out.runs = uniq([...(a.runs || []), ...(b.runs || [])], (r) => [r.endedAt, r.day, r.n, r.tag].join('|')).sort((x, y) => String(x.endedAt).localeCompare(String(y.endedAt)));
  out.log = uniq([...(a.log || []), ...(b.log || [])], (e) => [e.t, e.id, e.role, e.form, e.ok].join('|')).sort((x, y) => String(x.t).localeCompare(String(y.t))).slice(-LOG_CAP);
  out.verify = (last(a.runs) >= last(b.runs) ? a.verify : b.verify) || [];       // adaptive check rate: follow the side that played last
  if (a.map || b.map) out.map = mergeMap(a.map, b.map);
  return out;
}
export function mergeMeta(local, remote, localDirty) {
  if (!local) return remote; if (!remote) return local;
  return localDirty ? { ...remote, ...local } : { ...local, ...remote };
}

export class Sync {
  constructor({ storage, fetchImpl, base = 'api/', onMerged = () => {}, onStatus = () => {}, debounceMs = 0 }) {
    this.s = storage; this.fetch = fetchImpl; this.base = base; this.onMerged = onMerged; this.onStatus = onStatus; this.debounceMs = debounceMs; this.timers = {};
    this.available = null; this.lastError = null; this.inFlight = {}; this.again = {};
    try { this.state = JSON.parse(this.s.getItem(SYNC_KEY)) || {}; } catch { this.state = {}; }
    this.state.revs ||= {}; this.state.dirty ||= {};
  }
  _saveState() { try { this.s.setItem(SYNC_KEY, JSON.stringify(this.state)); } catch {} }
  _local(name) { try { const v = this.s.getItem(localKey(name)); return v ? JSON.parse(v) : null; } catch { return null; } }
  _setLocal(name, data) { this.s.setItem(localKey(name), JSON.stringify(data)); }
  _merge(name, local, remote) { return name === 'meta' ? mergeMeta(local, remote, !!this.state.dirty[name]) : mergeCards(local, remote); }
  get pending() { return Object.keys(this.state.dirty).filter((k) => this.state.dirty[k]); }
  _status() { this.onStatus({ available: this.available, pending: this.pending, error: this.lastError }); }

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
    if (r.status === 404) { this.state.revs[name] = 0; if (local) return this.push(name); return; }
    if (!r.ok) throw new Error('server ' + r.status);
    const remote = await r.json();
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
          const sent = JSON.stringify(data);
          const r = await this.fetch(this.base + 'doc/' + name, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseRev: this.state.revs[name] || 0, data }) });
          if (r.status === 409) {                       // another device saved first: merge and retry
            const remote = await r.json();
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
