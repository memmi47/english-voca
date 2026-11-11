// Per-profile persistence. Storage is injectable (localStorage in browser, Map in tests).
// Imports are merge-only: progress fields are never reset by re-importing a pack.
export const PROFILES = ['son', 'daughter'];
const META_KEY = 'catchup.v1.meta';
const pkey = (p) => `catchup.v1.p.${p}`;
const LOG_CAP = 3000;

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }, _map: m };
}

export function fingerprint(rows) {
  const s = JSON.stringify(rows);
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export class Store {
  constructor(storage) { this.s = storage; this.lastError = null; }
  _read(k, fallback) {
    try { const v = this.s.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch (e) { this.lastError = 'read:' + e.message; return fallback; }
  }
  _write(k, v) {
    try { this.s.setItem(k, JSON.stringify(v)); this.lastError = null; return true; }
    catch (e) { this.lastError = 'write:' + e.message; return false; }
  }
  meta() {
    const m = this._read(META_KEY, null) || {};
    return { v: 1, names: { son: '아들', daughter: '딸' }, settings: {}, ...m,
      settings: { newPerSession: 5, reviewMax: 25, sessionMinutes: 15, ...(m.settings || {}) } };
  }
  saveMeta(m) { return this._write(META_KEY, m); }
  profile(id) {
    if (!PROFILES.includes(id)) throw new Error('unknown profile ' + id);
    const p = this._read(pkey(id), null);
    return p || { v: 1, id, packs: {}, cards: {}, localCards: {}, log: [], sessions: [], audioIssues: [] };
  }
  saveProfile(p) {
    if (p.log.length > LOG_CAP) p.log = p.log.slice(-LOG_CAP);
    return this._write(pkey(p.id), p);
  }
  clearSample(id) {
    const p = this.profile(id);
    for (const [k, c] of Object.entries(p.cards)) if (c.sample) delete p.cards[k];
    for (const [k, c] of Object.entries(p.packs)) if (c.sample) delete p.packs[k];
    p.log = p.log.filter((e) => !e.sample); p.sessions = p.sessions.filter((e) => !e.sample);
    return this.saveProfile(p);
  }

  // Import a per-child export in the weekly tool's format (app.py /export?profile=...).
  importPack(expectedProfile, data, opts = {}) {
    if (!data || typeof data !== 'object') throw new Error('JSON 형식이 아닙니다.');
    if (!PROFILES.includes(data.profile)) throw new Error('profile 값이 son/daughter가 아닙니다.');
    if (expectedProfile && data.profile !== expectedProfile)
      throw new Error(`이 파일은 '${data.profile}'의 기록입니다. 선택한 아이와 다릅니다.`);
    if (!Array.isArray(data.approved_packs)) throw new Error('approved_packs가 없습니다.');
    const p = this.profile(data.profile);
    const sample = !!(opts.sample || data._sample);
    const byBook = {};
    for (const r of data.approved_packs) {
      if (r.profile && r.profile !== data.profile) throw new Error('다른 아이의 승인 팩이 섞여 있습니다.');
      if (!r.card) throw new Error('card 필드가 없는 항목이 있습니다.');
      (byBook[r.book] ||= []).push(r);
    }
    for (const lc of data.local_cards || []) p.localCards[lc.card_id] = lc;
    const report = { added: 0, updated: 0, unchanged: 0, packs: [], skippedKnown: 0 };
    const states = data.card_states || {};
    for (const [book, rows] of Object.entries(byBook)) {
      const norm = rows.map((r) => [r.card, r.tier, r.depth_target, r.context, r.page]).sort();
      const fp = fingerprint(norm);
      const old = p.packs[book];
      if (old && old.fingerprint === fp) { report.unchanged += rows.length; report.packs.push({ book, status: 'same' }); continue; }
      p.packs[book] = { book, fingerprint: fp, sample, imported_at: opts.now || new Date().toISOString(),
        scene: data._scene || old?.scene || null, count: rows.length, order: rows.map((r) => r.card) };
      for (const r of rows) {
        const ex = p.cards[r.card];
        const st = states[r.card];
        const base = { pack: book, tier: r.tier, depthTarget: r.depth_target || 2, context: r.context || '',
          page: r.page || '', sample, observed: r.observed_count || 0 };
        if (ex) { Object.assign(ex, base); report.updated++; continue; }
        const rec = { ...base, introduced: null, depthDone: 0, known: '미확인', origin: '', streak: 0, due: null,
          lastScoredDay: null, lastOutcome: null, lights: 0 };
        if (st && st[0] === '앎' && String(st[1] || '').startsWith('진단 구간')) {
          rec.known = '앎'; rec.origin = st[1]; rec.inferred = true;   // estimate, not a direct answer
        } else if (st && st[0] === '앎') { rec.known = '앎'; rec.origin = st[1] || ''; rec.streak = st[3] || 0; rec.due = st[2] || null; report.skippedKnown++; }
        p.cards[r.card] = rec; report.added++;
      }
      report.packs.push({ book, status: old ? 'merged' : 'new' });
    }
    if (data.reviewed_audio) p.reviewedAudio = { ...(p.reviewedAudio || {}), ...data.reviewed_audio };
    if (!this.saveProfile(p)) throw new Error('저장 실패: ' + this.lastError);
    return report;
  }

  exportProfile(id) {
    const p = this.profile(id);
    const card_states = {};
    for (const [k, c] of Object.entries(p.cards)) if (!c.sample)
      card_states[k] = [c.known, c.origin, c.due, c.streak];
    return { profile: id, exported_from: 'catchup-game', card_states_note: '[known, origin, due, streak] - game results are sound-assisted',
      card_states, cards_detail: p.cards, sessions: p.sessions, log: p.log, packs: p.packs, localCards: p.localCards };
  }
}
