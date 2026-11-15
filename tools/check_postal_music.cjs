// Renders every track and effect with cards/js/chip.js in headless Chromium and measures them.
//   node tools/check_postal_music.cjs [outDir] [--calibrate]
// Prints level, clipping and silence per piece. With --calibrate it also rewrites "norm" in the track JSON so every
// loop lands near the target loudness (music RMS -24 dBFS, jingles peak -8 dBFS). WAV renders go to outDir for listening.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const PORT = 8099; const BASE = `http://localhost:${PORT}/`;
const OUT = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(require('os').tmpdir(), 'postal-music');
const CAL = process.argv.includes('--calibrate'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn('python3', [path.join(ROOT, 'tools', 'serve_cards.py'), '--port', String(PORT), '--state-dir', fs.mkdtempSync(path.join(require('os').tmpdir(), 'pm-'))], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wav = (samples, sr) => { const b = Buffer.alloc(44 + samples.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40); samples.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2)); return b; };
(async () => {
  for (let i = 0; i < 50; i++) { if (await fetch(BASE).then((r) => r.ok, () => false)) break; await sleep(100); }
  const browser = await chromium.launch({ args: ['--no-sandbox'] }); const page = await browser.newPage(); await page.goto(BASE + 'index.html?nosync=1');
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/assets/postal/music/index.json'), 'utf8'));
  const res = await page.evaluate(async ({ ids, cal }) => {
    const chip = await import('./js/chip.js'); const out = {};
    const stats = (d, sr, from, to) => { let peak = 0, sum = 0, clip = 0, n = 0; for (let i = Math.floor(from * sr); i < Math.min(d.length, Math.floor(to * sr)); i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (a >= 0.999) clip++; sum += d[i] * d[i]; n++; } const win = Math.floor(sr * 0.05); let quiet = 0, wins = 0; for (let i = Math.floor(from * sr); i + win < Math.min(d.length, Math.floor(to * sr)); i += win) { let s = 0; for (let k = 0; k < win; k++) s += d[i + k] * d[i + k]; wins++; if (Math.sqrt(s / win) < 0.001) quiet++; } return { peakDb: 20 * Math.log10(peak || 1e-9), rmsDb: 10 * Math.log10(sum / n || 1e-12), clip, silentPct: wins ? 100 * quiet / wins : 0 }; };
    for (const id of ids) {
      const track = await (await fetch(`assets/postal/music/${id}.json`)).json(); const sr = 22050; const secs = totalSecs(track);
      let buf = await chip.renderTrack(track, { sampleRate: sr, loops: track.loop ? 1 : 1, tail: 1.2 }); let d = buf.getChannelData(0);
      let st = stats(d, sr, 0, secs); let norm = track.norm;
      if (cal) { const target = track.loop ? -24 : null; const gain = track.loop ? 10 ** ((target - st.rmsDb) / 20) : 10 ** ((-8 - st.peakDb) / 20); norm = Math.round(gain * 1000) / 1000; track.norm = norm; buf = await chip.renderTrack(track, { sampleRate: sr, loops: 1, tail: 1.2 }); d = buf.getChannelData(0); st = stats(d, sr, 0, secs); }
      const seam = (() => { const a = Math.floor(0.01 * sr); let s1 = 0, s2 = 0; for (let i = 0; i < a; i++) { s1 += d[i] * d[i]; s2 += d[Math.floor(secs * sr) - a + i] * d[Math.floor(secs * sr) - a + i]; } return { startDb: 10 * Math.log10(s1 / a || 1e-12), endDb: 10 * Math.log10(s2 / a || 1e-12) }; })();
      out[id] = { ...st, secs, norm, seam, samples: Array.from(d), track: cal ? track : null };
    }
    const sfx = await (await fetch('assets/postal/sfx.json')).json(); out.sfx = {};
    for (const [name, evs] of Object.entries(sfx)) { const b = await chip.renderSfx(evs, { sampleRate: 22050 }); let d = b.getChannelData(0); let st = stats(d, 22050, 0, b.duration);
      if (cal) { const k = 10 ** ((-6 - st.peakDb) / 20); evs.forEach((e) => { e.g = Math.round(e.g * k * 1e4) / 1e4; }); const b2 = await chip.renderSfx(evs, { sampleRate: 22050 }); d = b2.getChannelData(0); st = stats(d, 22050, 0, b2.duration); }
      out.sfx[name] = { ...st, secs: b.duration, samples: Array.from(d) }; }
    out.sfxJson = cal ? sfx : null;
    function totalSecs(t) { return t.bars * t.beatsPerBar * 60 / t.bpm; }
    return out;
  }, { ids: Object.keys(index), cal: CAL });
  await browser.close(); server.kill();
  const f = (x) => (Math.round(x * 10) / 10).toString().padStart(6);
  console.log('piece        secs   peak dB   rms dB  clipped  silent%  norm   loop seam (start/end dB)');
  for (const id of Object.keys(index)) { const r = res[id]; console.log(id.padEnd(10), f(r.secs), f(r.peakDb), f(r.rmsDb), String(r.clip).padStart(7), f(r.silentPct), String(r.norm).padStart(7), ' ', f(r.seam.startDb), f(r.seam.endDb)); fs.writeFileSync(path.join(OUT, id + '.wav'), wav(r.samples, 22050)); if (CAL) fs.writeFileSync(path.join(ROOT, 'cards/assets/postal/music', id + '.json'), JSON.stringify(r.track)); }
  console.log('\nsfx          secs   peak dB   rms dB  clipped'); const all = []; for (const [n, r] of Object.entries(res.sfx)) { console.log(n.padEnd(14), f(r.secs), f(r.peakDb), f(r.rmsDb), String(r.clip).padStart(7)); all.push(...r.samples, ...new Array(11025).fill(0)); }
  fs.writeFileSync(path.join(OUT, 'sfx-all.wav'), wav(all, 22050));   // every effect in order, 0.5 s apart, for listening
  if (CAL) fs.writeFileSync(path.join(ROOT, 'cards/assets/postal/sfx.json'), JSON.stringify(res.sfxJson));
  const bad = Object.entries(res).filter(([k, r]) => k !== 'sfx' && k !== 'sfxJson' && r.clip > 0).length + Object.values(res.sfx).filter((r) => r.clip > 0).length;
  console.log(bad ? `\n${bad} piece(s) clip` : '\nno clipping'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); try { server.kill(); } catch {} process.exit(2); });
