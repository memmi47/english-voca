// Chiptune synth for the note data made by tools/build_postal_music.py.
// Voices: pulse 12.5 / 25 / 50 % and triangle (tonal), noise (kick / snare / hat). All Web Audio, no audio files.
//   Music: a looping player with a look-ahead scheduler (no gap at the loop point), master volume and ducking.
//   sfx:   short effects with pitch slides.
//   renderTrack: the same synth into an OfflineAudioContext, used by tools/check_postal_music.cjs to measure loudness.
export const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const DUTY = { p12: 0.125, p25: 0.25, p50: 0.5 };
const caches = new WeakMap();

function cacheFor(ctx) { let c = caches.get(ctx); if (!c) { c = { pulse: {}, noise: null }; caches.set(ctx, c); } return c; }
function pulseWave(ctx, duty) {                                   // Fourier series of a pulse wave with the given duty
  const c = cacheFor(ctx); if (c.pulse[duty]) return c.pulse[duty];
  const N = 40; const real = new Float32Array(N + 1), imag = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) { const a = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty); real[n] = a * Math.cos(n * Math.PI * duty); imag[n] = a * Math.sin(n * Math.PI * duty); }
  return (c.pulse[duty] = ctx.createPeriodicWave(real, imag));
}
function noiseBuf(ctx) {
  const c = cacheFor(ctx); if (c.noise) return c.noise;
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); let s = 12345;
  for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 2147483648) - 1; }   // fixed seed: renders are repeatable
  return (c.noise = b);
}
const env = (g, t, peak, [a, d, s, r], dur) => {                  // attack, decay, sustain level, release
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
  const hold = Math.max(a + 0.002, Math.min(a + d, dur)); g.gain.linearRampToValueAtTime(peak * s, t + hold);
  g.gain.setValueAtTime(peak * s, t + Math.max(hold, dur)); g.gain.linearRampToValueAtTime(0, t + dur + r);
  return t + dur + r + 0.02;
};

function drum(ctx, out, t, kind, gain) {
  if (kind === 0) {                                               // kick: a sine that falls fast
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    g.gain.setValueAtTime(gain * 2.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13); o.connect(g).connect(out); o.start(t); o.stop(t + 0.15); return;
  }
  const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf(ctx); n.loop = true;
  f.type = 'highpass'; f.frequency.value = kind === 1 ? 1100 : 7000;
  const len = kind === 1 ? 0.11 : 0.035;
  g.gain.setValueAtTime(gain * (kind === 1 ? 1.3 : 0.7), t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + len + 0.02);
  if (kind === 1) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 190; og.gain.setValueAtTime(gain * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07); o.connect(og).connect(out); o.start(t); o.stop(t + 0.09); }
}

function note(ctx, out, ch, t, dur, m) {
  if (ch.wave === 'noise') return drum(ctx, out, t, m, ch.gain);
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (ch.wave === 'tri') o.type = 'triangle'; else o.setPeriodicWave(pulseWave(ctx, DUTY[ch.wave]));
  o.frequency.value = hz(m); o.connect(g).connect(out); o.start(t); o.stop(env(g, t, ch.gain, ch.env, dur));
}

// Schedules every note that starts in beats [from, to) of one pass; t0 = context time of beat 0 of that pass.
export function scheduleTrack(ctx, out, track, t0, from, to) {
  const spb = 60 / track.bpm;
  for (const ch of track.channels) for (const [beat, dur, m] of ch.notes) if (beat >= from && beat < to) note(ctx, out, ch, t0 + beat * spb, Math.max(0.03, dur * spb), m);
}
export const totalBeats = (track) => track.bars * track.beatsPerBar;

export class Music {
  constructor(ctx, dest) {
    this.ctx = ctx; this.out = ctx.createGain(); this.out.connect(dest); this.track = null; this.timer = null; this.volume = 0.5; this.ducked = false; this.on = false;
    this.mix = ctx.createGain(); this.mix.connect(this.out); this._apply(0);
  }
  _apply(sec = 0.08) { const v = this.ducked ? this.volume * 0.18 : this.volume; this.out.gain.cancelScheduledValues(this.ctx.currentTime); this.out.gain.setTargetAtTime(v, this.ctx.currentTime, sec / 3 + 0.001); }
  setVolume(v) { this.volume = v; this._apply(); }
  duck(on) { this.ducked = on; this._apply(0.15); }                // under the word voice
  play(track) {
    if (this.track && this.track.id === track.id && this.on) return;
    this.stop(); this.track = track; this.on = true; this.mix = this.ctx.createGain(); this.mix.gain.value = track.norm ?? 1; this.mix.connect(this.out);
    this.pass0 = this.ctx.currentTime + 0.08; this.cursor = 0; this.timer = setInterval(() => this._tick(), 90); this._tick();
  }
  _tick() {
    if (!this.on) return; const spb = 60 / this.track.bpm, end = totalBeats(this.track);
    const upto = (this.ctx.currentTime + 0.7 - this.pass0) / spb;
    if (upto > this.cursor) { const to = Math.min(upto, end); scheduleTrack(this.ctx, this.mix, this.track, this.pass0, this.cursor, to); this.cursor = to; }
    if (this.cursor >= end) { if (this.track.loop) { this.pass0 += end * spb; this.cursor = 0; } else { this.on = false; clearInterval(this.timer); this.timer = null; } }
  }
  stop() {
    clearInterval(this.timer); this.timer = null; this.on = false;
    if (this.mix) { const m = this.mix; m.gain.cancelScheduledValues(this.ctx.currentTime); m.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03); setTimeout(() => { try { m.disconnect(); } catch {} }, 600); this.mix = null; }
  }
}

// One-shot jingle on its own gain (not looped). Returns the length in seconds.
export function playJingle(ctx, out, track, volume = 1) {
  const g = ctx.createGain(); g.gain.value = (track.norm ?? 1) * volume; g.connect(out); scheduleTrack(ctx, g, track, ctx.currentTime + 0.02, 0, totalBeats(track));
  return totalBeats(track) * 60 / track.bpm;
}

// Sound effects: [{ t, d, a, b, w, g }] = start s, length s, start MIDI, end MIDI, wave, gain.
export function playSfx(ctx, out, events, volume = 1, when = ctx.currentTime) {
  for (const e of events) {
    const t = when + e.t, g = ctx.createGain();
    if (e.w === 'noise') {
      const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(); n.buffer = noiseBuf(ctx); n.loop = true; f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(hz(e.a), t); f.frequency.exponentialRampToValueAtTime(Math.max(40, hz(e.b)), t + e.d);
      g.gain.setValueAtTime(e.g * volume, t); g.gain.exponentialRampToValueAtTime(0.001, t + e.d); n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + e.d + 0.02);
    } else {
      const o = ctx.createOscillator(); if (e.w === 'tri') o.type = 'triangle'; else o.setPeriodicWave(pulseWave(ctx, DUTY[e.w]));
      o.frequency.setValueAtTime(hz(e.a), t); if (e.b !== e.a) o.frequency.exponentialRampToValueAtTime(hz(e.b), t + e.d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(e.g * volume, t + 0.004); g.gain.setValueAtTime(e.g * volume, t + Math.max(0.004, e.d - 0.03)); g.gain.linearRampToValueAtTime(0, t + e.d);
      o.connect(g).connect(out); o.start(t); o.stop(t + e.d + 0.02);
    }
  }
}

// Offline render for measurements: loops passes of the track plus a short tail.
export async function renderTrack(track, { sampleRate = 22050, loops = 1, tail = 1.5 } = {}) {
  const spb = 60 / track.bpm, len = totalBeats(track) * spb, frames = Math.ceil((len * loops + tail) * sampleRate);
  const ctx = new OfflineAudioContext(1, frames, sampleRate), g = ctx.createGain(); g.gain.value = track.norm ?? 1; g.connect(ctx.destination);
  for (let p = 0; p < loops; p++) scheduleTrack(ctx, g, track, p * len, 0, totalBeats(track));
  return ctx.startRendering();
}
export async function renderSfx(events, { sampleRate = 22050 } = {}) {
  const length = Math.max(...events.map((e) => e.t + e.d)) + 0.3, ctx = new OfflineAudioContext(1, Math.ceil(length * sampleRate), sampleRate);
  playSfx(ctx, ctx.destination, events, 1, 0); return ctx.startRendering();
}
