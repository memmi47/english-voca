// Keeps a copy of each document (meta, p.son, p.daughter) on the home server (tools/serve.py).
// localStorage stays the working copy; the server copy protects against the browser clearing
// its storage and lets the Mac and the iPad share progress. Without a server the game works
// exactly as before, on this device only.
import { PROFILES } from './store.js';

const SYNC_KEY = 'catchup.v1.sync';
const LOG_CAP = 3000;
export const DOCS = ['meta', ...PROFILES.map((p) => 'p.' + p)];
const localKey = (name) => 'catchup.v1.' + name;

const evidence = (r) => [r.lastScoredDay || '', r.introduced || '', r.streak || 0, r.due || ''];
const newer = (x, y) => {                      // which card record carries later evidence (field by field)
  const a = evidence(x), b = evidence(y);
  for (let i = 0; i < a.length; i++) { if (a[i] === b[i]) continue; return b[i] > a[i] ? y : x; }
  return x;
};
const uniq = (arr, key) => { const seen = new Set(); return arr.filter((e) => { const k = key(e); if (seen.has(k)) return false; seen.add(k); return true; }); };

// Pure and symmetric enough for two devices that both changed the same child's record.
export function mergeProfiles(a, b) {
  if (!a) return b; if (!b) return a;
  const out = { ...b, ...a, v: 1, id: a.id || b.id };
  out.cards = { ...b.cards };
  for (const [id, r] of Object.entries(a.cards || {})) out.cards[id] = out.cards[id] ? newer(out.cards[id], r) : r;
  out.packs = { ...b.packs };
  for (const [k, p] of Object.entries(a.packs || {})) if (!out.packs[k] || String(p.imported_at) > String(out.packs[k].imported_at)) out.packs[k] = p;
  out.localCards = { ...(b.localCards || {}), ...(a.localCards || {}) };
  out.reviewedAudio = { ...(b.reviewedAudio || {}), ...(a.reviewedAudio || {}) };
  out.log = uniq([...(a.log || []), ...(b.log || [])], (e) => [e.t, e.card, e.type, e.outcome, e.depth].join('|'))
    .sort((x, y) => String(x.t).localeCompare(String(y.t))).slice(-LOG_CAP);
  out.sessions = uniq([...(a.sessions || []), ...(b.sessions || [])], (e) => JSON.stringify(e))
    .sort((x, y) => String(x.endedAt || x.day).localeCompare(String(y.endedAt || y.day)));
  out.audioIssues = uniq([...(a.audioIssues || []), ...(b.audioIssues || [])], (e) => JSON.stringify(e));
  const act = [a.activeSession, b.activeSession].filter(Boolean).sort((x, y) => (y.day === x.day ? y.ms - x.ms : (y.day > x.day ? 1 : -1)))[0];
  if (act) out.activeSession = act; else delete out.activeSession;
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
  _merge(name, local, remote) { return name === 'meta' ? mergeMeta(local, remote, !!this.state.dirty[name]) : mergeProfiles(local, remote); }
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
    clearTimeout(this.timers[name]);                      // coalesce the per-answer saves of a session
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
  // Retry everything that is still only on this device (called on focus / before a session).
  async flush() {
    if (!this.available) { await this.init(); return; }
    for (const n of this.pending) { clearTimeout(this.timers[n]); await this.push(n); }
  }
}
