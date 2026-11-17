// Word audio for the flashcard prototype.
// 1) a file listed in audio/manifest.json (made on the Mac by tools/cards_say_audio.sh), else
// 2) the device's own en-US system voice (speechSynthesis). Both are synthetic and unreviewed.
// A failure is reported, never swallowed: the card stays locked until the word was played or a parent skips.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
// Recorded GM player exposes the same small interface as chip.Music.
class RecordedMusic {
  constructor(ctx, dest, entry, buffer, id, assetId) {
    this.ctx = ctx; this.entry = entry; this.track = { id }; this.assetId = assetId; this.file = entry.file; this.backend = 'gm'; this.on = true; this.volume = .5; this.ducked = false;
    this.out = ctx.createGain(); this.out.connect(dest); this.source = ctx.createBufferSource(); this.source.buffer = buffer;
    this.source.loop = true; this.source.loopStart = entry.loopStart; this.source.loopEnd = entry.loopEnd;
    this.source.connect(this.out); this.startOffset = entry.startOffset; this.source.start(0, this.startOffset);
  }
  _apply() { this.gainTarget = this.volume * (this.ducked ? .18 : 1) * this.entry.gain; const p = this.out.gain; p.cancelScheduledValues(this.ctx.currentTime); p.setTargetAtTime(this.gainTarget, this.ctx.currentTime, .05); }
  setVolume(v) { this.volume = v; this._apply(); }
  duck(v) { this.ducked = v; this._apply(); }
  stop() { if (!this.on) return; this.on = false; const now = this.ctx.currentTime; this.out.gain.setTargetAtTime(0, now, .015); try { this.source.stop(now + .08); } catch {} this.source.onended = () => { this.source.disconnect(); this.out.disconnect(); }; }
}
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
    this.files = {}; this.voice = null; this.el = null; this.token = 0; this.ctx = null; this.sfx = true; this.fails = 0; this.musicGeneration = 0; this.gmBuffers = new Map(); this.gmJingles = new Map(); this.duckReasons = new Set(); this.jingleNodes = new Set(); this.musicOn = false; this.chip = null; this.master = null; this.music = null; this.sceneId = null;
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
  stop() { this.token++; this._wordRelease?.(); clearTimeout(this._dt); this._duck('word', false); try { this.el?.pause(); } catch {} try { this.speech?.cancel(); } catch {} }
  // -> { ok, source: 'file' | 'speech' | 'off', reason, stale }
  async play(id, text) {
    if (this.off) return { ok: true, source: 'off' };
    this._wordRelease?.(); const my = ++this.token; try { this.el?.pause(); } catch {} try { this.speech?.cancel(); } catch {}
    this._duck('word', true);
    const res = this.files[id] ? await this._file(this.files[id], my) : this.speech && text ? await this._speak(text, my) : { ok: false, reason: 'no_audio' };
    if (my !== this.token) return { ok: false, stale: true };
    if (!res.ok) { this.fails++; this._duck('word', false); }
    return res;
  }
  _file(file, my) {
    if (!this.el) this.el = this.createAudio();
    const el = this.el;
    return new Promise((resolve) => {
      let done = false; const fin = (r) => { if (done) return; done = true; clearTimeout(tm); el.removeEventListener?.('error', onErr); resolve(r); };
      const onErr = () => fin({ ok: false, reason: 'load_error' }); const tm = setTimeout(() => fin({ ok: false, reason: 'timeout' }), this.timeoutMs);
      el.addEventListener?.('error', onErr);
      const release = () => { if (my === this.token) this._duck('word', false); el.removeEventListener?.('ended', release); el.removeEventListener?.('error', release); if (this._wordRelease === release) this._wordRelease = null; }; this._wordRelease = release;
      el.addEventListener?.('ended', release); el.addEventListener?.('error', release);
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
        u.onstart = () => fin({ ok: true, source: 'speech' }); u.onend = () => { if (my === this.token) this._duck('word', false); fin({ ok: true, source: 'speech' }); };
        u.onerror = (ev) => { if (my === this.token) this._duck('word', false); fin(my !== this.token || ev.error === 'interrupted' || ev.error === 'canceled' ? { ok: false, stale: true } : { ok: false, reason: 'speech_' + (ev.error || 'error') }); };
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
  async _gmManifest() {
    if (!this.gmManifestPromise) this.gmManifestPromise = this.fetchImpl('assets/postal/music-gm/manifest.json').then(async (r) => { if (!r.ok) throw Error('manifest'); const m = await r.json(); if (m.schemaVersion !== 1 || !m.tracks || !m.aliases) throw Error('manifest'); return m; }).catch(() => null);
    return this.gmManifestPromise;
  }
  async _recording(id, options = {}, jingle = false, generation = this.musicGeneration) {
    const manifest = await this._gmManifest(); if (!manifest || generation !== this.musicGeneration) return null;
    let assetId = options.variant || options.worldId || id; const visited = new Set();
    while (manifest.aliases[assetId]) { if (visited.has(assetId)) return null; visited.add(assetId); assetId = manifest.aliases[assetId]; }
    if (!manifest.tracks[assetId] && options.worldId) assetId = manifest.aliases[id] || id;
    const entry = manifest.tracks[assetId];
    if (!entry || !/^[a-z0-9-]+\.m4a$/.test(entry.file) || entry.kind !== (jingle ? 'jingle' : 'loop') || !Number.isFinite(entry.gain) || entry.gain < 0) return null;
    const cache = jingle ? this.gmJingles : this.gmBuffers;
    let buffer = cache.get(assetId);
    if (buffer) { cache.delete(assetId); cache.set(assetId, buffer); }
    else { const response = await this.fetchImpl('assets/postal/music-gm/' + entry.file); if (!response.ok) throw Error('recording'); const encoded = await response.arrayBuffer(); if (generation !== this.musicGeneration) return null; buffer = await this.ctx.decodeAudioData(encoded); if (generation !== this.musicGeneration) return null; cache.set(assetId, buffer); while (cache.size > (jingle ? 7 : 2)) cache.delete(cache.keys().next().value); }
    if (!jingle && !(Number.isFinite(entry.loopStart) && Number.isFinite(entry.loopEnd) && entry.loopStart >= 0 && entry.loopEnd > entry.loopStart && entry.loopEnd <= buffer.duration && Number.isFinite(entry.startOffset) && entry.startOffset >= 0 && entry.startOffset <= entry.loopStart)) return null;
    return { entry, buffer, assetId };
  }
  _duck(reason, on) { if (on) this.duckReasons.add(reason); else this.duckReasons.delete(reason); this.music?.duck(this.duckReasons.size > 0); for (const n of this.jingleNodes) { const target = n.gain * (this.duckReasons.has('word') ? .18 : 1); n.out.gain.setTargetAtTime(target, this.ctx.currentTime, .05); } }
  async jingle(id) {
    this._note('jingle:' + id);
    if (this.off || !this.sfx || !this.ctx) return;
    const generation = this.musicGeneration;
    try {
      const rec = await this._recording(id, {}, true);
      if (!this.sfx || generation !== this.musicGeneration) return;
      if (rec && this._graph()) {
        const source = this.ctx.createBufferSource(), out = this.ctx.createGain(); source.buffer = rec.buffer; source.connect(out); out.connect(this.sfxBus);
        const node = { source, out, gain: rec.entry.gain }; this.jingleNodes.add(node); const reason = Symbol('jingle'); this._duck(reason, true);
        out.gain.value = node.gain * (this.duckReasons.has('word') ? .18 : 1);
        source.onended = () => { this.jingleNodes.delete(node); source.disconnect(); out.disconnect(); this._duck(reason, false); }; source.start(); return;
      }
    } catch {}
    const t = await this.track(id === 'storm-caught' ? 'bat' : id);
    if (t && this.sfx && generation === this.musicGeneration && this._graph()) { const reason = Symbol('jingle'), out = this.ctx.createGain(), node = { out, gain: 1 }; out.connect(this.sfxBus); this.jingleNodes.add(node); this._duck(reason, true); out.gain.value = this.duckReasons.has('word') ? .18 : 1; const len = this.chip.mod.playJingle(this.ctx, out, t, 1); setTimeout(() => { this.jingleNodes.delete(node); out.disconnect(); this._duck(reason, false); }, len * 1000 + 100); }
  }
  // Scene ids remain logical names; world variants select separate recorded assets.
  async scene(id, options = {}) {
    this.sceneId = id; this.sceneOptions = { ...options }; this._note('scene:' + id); const generation = ++this.musicGeneration;
    if (this.off || !this.musicOn || !this.ctx) return;
    let recording = null; try { recording = await this._recording(id, options); } catch {}
    if (generation !== this.musicGeneration || !this.musicOn || !this._graph()) return;
    if (recording) {
      if (this.music?.on && this.music.backend === 'gm' && this.music.assetId === recording.assetId) return;
      this.music?.stop(); this.music = new RecordedMusic(this.ctx, this.musicBus, recording.entry, recording.buffer, id, recording.assetId);
    } else {
      const fallback = id === 'storm' ? 'study' : id; const t = await this.track(fallback);
      if (!t || generation !== this.musicGeneration || !this.musicOn) return;
      if (this.music?.backend === 'chip' && this.music.on && this.music.track.id === id) return;
      this.music?.stop(); this.music = new this.chip.mod.Music(this.ctx, this.musicBus); this.music.backend = 'chip'; this.music.assetId = fallback; this.music.file = null; this.music.play({ ...t, id });
    }
    this.music.setVolume(this.musicVol ?? .5); this.music.duck(this.duckReasons.size > 0);
  }
  setMusic(on) { this.musicOn = on; if (!on) { this.musicGeneration++; this.music?.stop(); } else if (this.sceneId) this.scene(this.sceneId, this.sceneOptions); }
  setSfx(on) { this.sfx = on; }
  _duckFor(ms) { this._duck('word', true); clearTimeout(this._dt); this._dt = setTimeout(() => this._duck('word', false), ms); }
  // Older names used by main.js, mapped to the new effects.
  blip(kind) { this.sfxPlay({ hit: 'hit', big: 'big-hit', miss: 'miss', boss: 'boss-down' }[kind] || kind); }
}
