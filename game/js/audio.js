// Audio engine: one shared <audio> element unlocked by a user gesture (iPad Safari),
// stale-play cancellation, duplicate suppression, explicit failure reporting.
// Dev TTS clips and speechSynthesis are never reported as human-approved.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export class AudioEngine {
  constructor({ manifest = {}, base = 'audio/', createAudio, speech = null, now = () => Date.now(), timeoutMs = 5000, dedupeMs = 1200 } = {}) {
    this.manifest = manifest; this.base = base; this.createAudio = createAudio || (() => new Audio());
    this.speech = speech; this.now = now; this.timeoutMs = timeoutMs; this.dedupeMs = dedupeMs;
    this.el = null; this.unlocked = false; this.token = 0; this.last = null; this.history = []; this.listeners = new Set();
    this.allowSpeech = true; this.status = 'idle'; this.lastFail = null;
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(e) { e.t = this.now(); this.history.push(e); if (this.history.length > 300) this.history.shift(); this.listeners.forEach((f) => f(e)); }
  badge(key) { const m = this.manifest[key]; return !m ? 'none' : m.status === 'human_approved' ? 'approved' : 'temp'; }

  // Must be called from a click/tap handler.
  async unlock() {
    try { if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback'; } catch {} // iOS 17+: play through the silent switch
    if (!this.el) { this.el = this.createAudio(); this.el.setAttribute?.('playsinline', ''); this.el.preload = 'auto'; }
    try {
      this.el.src = SILENT_WAV; await this.el.play(); this.el.pause();
      this.unlocked = true; this._emit({ type: 'unlock', ok: true }); return true;
    } catch (e) { this.unlocked = false; this._emit({ type: 'unlock', ok: false, reason: e.name || String(e) }); return false; }
  }
  stop() { this.token++; try { this.el?.pause(); } catch {} this.speech?.cancel?.(); this._set('idle'); }
  _set(s) { this.status = s; }

  // Returns {ok, source, reason, deduped, stale}. A failure never throws.
  async play(key, { force = false, ctx = '', text = '' } = {}) {
    const t0 = this.now();
    if (!force && this.last && this.last.key === key && this.last.ctx === ctx && t0 - this.last.t < this.dedupeMs) {
      this._emit({ type: 'dedupe', key }); return { ok: true, deduped: true };
    }
    const my = ++this.token; this.last = { key, ctx, t: t0 };
    try { this.el?.pause(); } catch {} this.speech?.cancel?.();
    const entry = this.manifest[key];
    let res;
    if (entry && entry.file) res = await this._file(key, entry, my);
    else if (this.allowSpeech && this.speech && text) res = await this._speak(key, text, my);
    else res = { ok: false, reason: entry ? 'no_file' : 'no_audio' };
    if (my !== this.token) return { ok: false, stale: true, reason: 'superseded' };
    if (res.ok) { this._set('playing'); this.lastFail = null; this._emit({ type: 'play', key, source: res.source, badge: res.source === 'file' ? this.badge(key) : 'temp' }); }
    else { this._set('failed'); this.lastFail = { key, reason: res.reason }; this._emit({ type: 'fail', key, reason: res.reason }); }
    return res;
  }
  async _file(key, entry, my) {
    if (!this.el) this.el = this.createAudio();
    const el = this.el; const url = this.base + entry.file;
    return new Promise((resolve) => {
      let done = false;
      const fin = (r) => { if (done) return; done = true; clearTimeout(tm); el.removeEventListener?.('error', onErr); resolve(r); };
      const onErr = () => fin({ ok: false, reason: 'load_error' });
      const tm = setTimeout(() => fin({ ok: false, reason: 'timeout' }), this.timeoutMs);
      el.addEventListener?.('error', onErr);
      try {
        el.src = url; el.currentTime = 0;
        const p = el.play();
        if (p && p.then) p.then(() => fin({ ok: true, source: 'file' }), (e) => {
          if (my !== this.token) return fin({ ok: false, stale: true, reason: 'superseded' });
          fin({ ok: false, reason: e && e.name === 'NotAllowedError' ? 'blocked' : (e && e.name === 'AbortError' ? 'aborted' : 'play_error') });
        });
        else fin({ ok: true, source: 'file' });
      } catch (e) { fin({ ok: false, reason: 'play_error' }); }
    });
  }
  _speak(key, text, my) {
    return new Promise((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.85;
        let done = false; const fin = (r) => { if (!done) { done = true; resolve(r); } };
        u.onstart = () => fin({ ok: true, source: 'speech' });
        u.onerror = (ev) => fin({ ok: false, reason: 'speech_' + (ev.error || 'error') });
        setTimeout(() => fin({ ok: false, reason: 'speech_timeout' }), 3000);
        this.speech.speak(u);
      } catch { resolve({ ok: false, reason: 'speech_unavailable' }); }
    });
  }
}
