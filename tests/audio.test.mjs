import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../game/js/audio.js';

function fakeAudio({ failWith = null, delay = 0 } = {}) {
  const el = { src: '', currentTime: 0, listeners: {}, plays: [],
    setAttribute() {}, addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }, removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); },
    pause() {}, play() { this.plays.push(this.src); return new Promise((res, rej) => setTimeout(() => (failWith && !this.src.startsWith('data:') ? rej(Object.assign(new Error('x'), { name: failWith })) : res()), delay)); } };
  return el;
}
const man = { a: { file: 'dev/a.mp3', status: 'dev_tts' }, b: { file: 'dev/b.mp3', status: 'human_approved' } };

test('unlock then play; badge distinguishes dev from approved', async () => {
  const el = fakeAudio(); const e = new AudioEngine({ manifest: man, createAudio: () => el });
  assert.equal(await e.unlock(), true);
  assert.equal((await e.play('a')).ok, true); assert.equal(e.badge('a'), 'temp'); assert.equal(e.badge('b'), 'approved'); assert.equal(e.badge('zz'), 'none');
});
test('duplicate play suppressed within window, forced replay not', async () => {
  const el = fakeAudio(); let t = 1000; const e = new AudioEngine({ manifest: man, createAudio: () => el, now: () => t });
  await e.unlock(); await e.play('a', { ctx: 'q1' }); const n = el.plays.length;
  assert.equal((await e.play('a', { ctx: 'q1' })).deduped, true); assert.equal(el.plays.length, n);
  await e.play('a', { ctx: 'q1', force: true }); assert.equal(el.plays.length, n + 1);
  t += 5000; await e.play('a', { ctx: 'q1' }); assert.equal(el.plays.length, n + 2);
});
test('blocked play reports failure and does not throw', async () => {
  const e = new AudioEngine({ manifest: man, createAudio: () => fakeAudio({ failWith: 'NotAllowedError' }) });
  const r = await e.play('a'); assert.equal(r.ok, false); assert.equal(r.reason, 'blocked'); assert.equal(e.status, 'failed');
});
test('missing manifest entry fails (no silent success); speech fallback only with text', async () => {
  const e = new AudioEngine({ manifest: man, createAudio: () => fakeAudio() });
  assert.equal((await e.play('nope')).reason, 'no_audio');
});
test('stale play is superseded by a newer one', async () => {
  const el = fakeAudio({ delay: 30 }); const e = new AudioEngine({ manifest: man, createAudio: () => el });
  const p1 = e.play('a', { ctx: '1' }); const p2 = e.play('b', { ctx: '2' });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.stale, true); assert.equal(r2.ok, true); assert.equal(e.status, 'playing');
});
test('timeout counts as failure', async () => {
  const el = { setAttribute() {}, addEventListener() {}, removeEventListener() {}, pause() {}, play() { return new Promise(() => {}); } };
  const e = new AudioEngine({ manifest: man, createAudio: () => el, timeoutMs: 40 });
  assert.equal((await e.play('a')).reason, 'timeout');
});
