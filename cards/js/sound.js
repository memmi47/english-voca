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
    this.files = {}; this.voice = null; this.el = null; this.token = 0; this.ctx = null; this.sfx = true; this.fails = 0; this.musicOn = false; this.chip = null; this.master = null; this.music = null; this.sceneId = null;
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
    try { const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (C && !this.ctx) this.ctx = new C(); this.ctx?.resume?.(); this.chipInit(); } catch {}
    try { if (this.speech) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; this.speech.speak(u); } } catch {}
    if (!this.el) { this.el = this.createAudio(); this.el.preload = 'auto'; }
    try { this.el.src = SILENT; await this.el.play(); this.el.pause(); return true; } catch { return false; }
  }
  stop() { this.token++; clearTimeout(this._dt); this.music?.duck(false); try { this.el?.pause(); } catch {} try { this.speech?.cancel(); } catch {} }
  // -> { ok, source: 'file' | 'speech' | 'off', reason, stale }
  async play(id, text) {
    if (this.off) return { ok: true, source: 'off' };
    const my = ++this.token; try { this.el?.pause(); } catch {} try { this.speech?.cancel(); } catch {}
    this._duckFor(1800);
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
  // ---- chiptune layer (chip.js): sound effects, jingles and looping music, all synthesized ----
  // Preferences: music is off until someone turns it on; effects are on. `log` records every effect name (used by tests).
  async chipInit() {
    if (this.chip) return this.chip;
    try {
      const mod = await import('./chip.js'); const sfx = await (await this.fetchImpl('assets/postal/sfx.json')).json();
      this.chip = { mod, sfx, tracks: {} };
    } catch { this.chip = { mod: null, sfx: {}, tracks: {} }; }
    return this.chip;
  }
  _graph() {                                             // master -> destination, created once the context exists
    if (!this.ctx || this.master) return !!this.master;
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master); this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
    return true;
  }
  _note(n) { (this.seen ||= new Set()).add(n); }                  // names of everything triggered so far (tests read this)
  sfxPlay(name) {
    this._note(name);
    if (this.off || !this.sfx || !this.ctx || !this.chip?.mod || !this._graph()) return;
    try { const ev = this.chip.sfx[name]; if (ev) this.chip.mod.playSfx(this.ctx, this.sfxBus, ev, 1); } catch {}
  }
  async track(id) {
    const c = await this.chipInit(); if (!c.mod) return null;
    if (!c.tracks[id]) { try { c.tracks[id] = await (await this.fetchImpl(`assets/postal/music/${id}.json`)).json(); } catch { return null; } }
    return c.tracks[id];
  }
  jingle(id) {
    this._note('jingle:' + id);
    if (this.off || !this.sfx || !this.ctx) return;
    this.track(id).then((t) => { if (t && this._graph()) { this.music?.duck(true); const len = this.chip.mod.playJingle(this.ctx, this.sfxBus, t, 1); setTimeout(() => this.music?.duck(false), len * 1000 + 100); } });
  }
  // The scene decides which loop plays; it only sounds when music is on.
  async scene(id) {
    this.sceneId = id; this._note('scene:' + id);
    if (this.off || !this.musicOn || !this.ctx) return;
    const t = await this.track(id); if (!t || this.sceneId !== id || !this._graph()) return;
    this.music ||= new this.chip.mod.Music(this.ctx, this.musicBus); this.music.setVolume(this.musicVol ?? 0.5); this.music.play(t);
  }
  setMusic(on) { this.musicOn = on; if (!on) this.music?.stop(); else if (this.sceneId) this.scene(this.sceneId); }
  setSfx(on) { this.sfx = on; }
  _duckFor(ms) { if (!this.music) return; this.music.duck(true); clearTimeout(this._dt); this._dt = setTimeout(() => this.music?.duck(false), ms); }
  // Older names used by main.js, mapped to the new effects.
  blip(kind) { this.sfxPlay({ hit: 'hit', big: 'big-hit', miss: 'miss', boss: 'boss-down' }[kind] || kind); }
}
