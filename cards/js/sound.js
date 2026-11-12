// Word audio for the flashcard prototype.
// 1) a file listed in audio/manifest.json (made on the Mac by tools/cards_say_audio.sh), else
// 2) the device's own en-US system voice (speechSynthesis). Both are synthetic and unreviewed.
// A failure is reported, never swallowed: the card stays locked until the word was played or a parent skips.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const PREFER = ['Ava', 'Samantha', 'Allison', 'Zoe', 'Evan', 'Nathan', 'Joelle', 'Noelle', 'Susan', 'Tom', 'Alex', 'Google US English', 'Aria', 'Jenny'];
const NOVELTY = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Zarvox|Trinoids|Whisper|Jester|Organ|Superstar|Good News|Fred|Junior|Kathy|Ralph|Rocko|Shelley|Sandy|Reed|Flo|Eddy|Grandma|Grandpa/i;

// Best en-US voice on this device: a known natural voice first, premium/enhanced variants above compact ones.
export function pickVoice(voices) {
  const score = (v) => { const i = PREFER.findIndex((n) => v.name.includes(n));
    return (i < 0 ? 0 : 100 - i) + (/Premium/i.test(v.name) ? 40 : /Enhanced/i.test(v.name) ? 30 : 0) + (v.localService ? 1 : 0); };
  return voices.filter((v) => /^en[-_]US/i.test(v.lang) && !NOVELTY.test(v.name)).sort((a, b) => score(b) - score(a))[0] || null;
}

export class Sound {
  constructor({ base = 'audio/', speech = globalThis.speechSynthesis || null, createAudio = () => new Audio(), off = false, timeoutMs = 4000, fetchImpl = (u) => fetch(u) } = {}) {
    this.base = base; this.speech = speech; this.createAudio = createAudio; this.off = off; this.timeoutMs = timeoutMs; this.fetchImpl = fetchImpl;
    this.files = {}; this.voice = null; this.el = null; this.token = 0; this.ctx = null; this.sfx = true; this.fails = 0;
  }
  async init() {
    try { const r = await this.fetchImpl(this.base + 'manifest.json'); if (r.ok) this.files = (await r.json()).files || {}; } catch {}
    const load = () => { try { this.voice = pickVoice(this.speech.getVoices()); } catch {} };
    if (this.speech) { load(); this.speech.addEventListener?.('voiceschanged', load); }
  }
  get source() { return this.off ? '꺼짐(시험용)' : Object.keys(this.files).length ? '음원 파일' : this.voice ? `기기 음성 ${this.voice.name}` : this.speech ? '기기 기본 음성' : '없음'; }
  // Must be called from a tap handler (iPad Safari).
  async unlock() {
    if (this.off) return true;
    try { if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback'; } catch {}
    try { const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (C && !this.ctx) this.ctx = new C(); this.ctx?.resume?.(); } catch {}
    try { if (this.speech) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; this.speech.speak(u); } } catch {}
    if (!this.el) { this.el = this.createAudio(); this.el.preload = 'auto'; }
    try { this.el.src = SILENT; await this.el.play(); this.el.pause(); return true; } catch { return false; }
  }
  stop() { this.token++; try { this.el?.pause(); } catch {} try { this.speech?.cancel(); } catch {} }
  // -> { ok, source: 'file' | 'speech' | 'off', reason, stale }
  async play(id, text) {
    if (this.off) return { ok: true, source: 'off' };
    const my = ++this.token; try { this.el?.pause(); } catch {} try { this.speech?.cancel(); } catch {}
    const res = this.files[id] ? await this._file(this.files[id], my) : this.speech && text ? await this._speak(text, my) : { ok: false, reason: 'no_audio' };
    if (my !== this.token) return { ok: false, stale: true };
    if (!res.ok) this.fails++;
    return res;
  }
  _file(file, my) {
    if (!this.el) this.el = this.createAudio();
    const el = this.el;
    return new Promise((resolve) => {
      let done = false; const fin = (r) => { if (done) return; done = true; clearTimeout(tm); el.removeEventListener?.('error', onErr); resolve(r); };
      const onErr = () => fin({ ok: false, reason: 'load_error' }); const tm = setTimeout(() => fin({ ok: false, reason: 'timeout' }), this.timeoutMs);
      el.addEventListener?.('error', onErr);
      try { el.src = this.base + file; el.currentTime = 0; const p = el.play();
        if (p?.then) p.then(() => fin({ ok: true, source: 'file' }), (e) => fin(my !== this.token ? { ok: false, stale: true } : { ok: false, reason: e?.name === 'NotAllowedError' ? 'blocked' : 'play_error' }));
        else fin({ ok: true, source: 'file' });
      } catch { fin({ ok: false, reason: 'play_error' }); }
    });
  }
  _speak(text, my) {
    return new Promise((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.9; if (this.voice) u.voice = this.voice;
        this._u = u;                                     // keep a reference: some browsers drop events for collected utterances
        let done = false; const fin = (r) => { if (!done) { done = true; clearTimeout(tm); resolve(r); } };
        u.onstart = () => fin({ ok: true, source: 'speech' }); u.onend = () => fin({ ok: true, source: 'speech' });
        u.onerror = (ev) => fin(my !== this.token || ev.error === 'interrupted' || ev.error === 'canceled' ? { ok: false, stale: true } : { ok: false, reason: 'speech_' + (ev.error || 'error') });
        const tm = setTimeout(() => fin(this.speech.speaking ? { ok: true, source: 'speech' } : { ok: false, reason: 'speech_timeout' }), 3000);
        this.speech.speak(u);
      } catch { resolve({ ok: false, reason: 'speech_unavailable' }); }
    });
  }
  // Short effect tones. Decoration only: silent if Web Audio is unavailable or muted by the ringer switch.
  blip(kind) {
    if (this.off || !this.sfx || !this.ctx) return;
    try {
      const t = this.ctx.currentTime; const notes = { hit: [[330, 0, 0.07]], big: [[523, 0, 0.08], [784, 0.07, 0.12]], miss: [[196, 0, 0.12]], boss: [[523, 0, 0.09], [659, 0.09, 0.09], [784, 0.18, 0.09], [1047, 0.27, 0.2]] }[kind] || [];
      for (const [f, at, len] of notes) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = kind === 'miss' ? 'sine' : 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(0.12, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
        o.connect(g).connect(this.ctx.destination); o.start(t + at); o.stop(t + at + len + 0.02);
      }
    } catch {}
  }
}
