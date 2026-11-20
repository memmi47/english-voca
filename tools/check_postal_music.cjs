// Renders every track and effect with cards/js/chip.js in headless Chromium and measures them.
//   node tools/check_postal_music.cjs [outDir] [--calibrate]
// Prints level, clipping and silence per piece. With --calibrate it also rewrites "norm" in the track JSON so every
// loop lands near the target loudness (music RMS -24 dBFS, jingles peak -8 dBFS). WAV renders go to outDir for listening.
const { chromium } = require('playwright');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const PORT = 8099; const BASE = `http://localhost:${PORT}/`;
const OUT = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(require('os').tmpdir(), 'postal-music');
let browser;
const CAL = process.argv.includes('--calibrate'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn('python3', [path.join(ROOT, 'tools', 'serve_cards.py'), '--port', String(PORT), '--state-dir', fs.mkdtempSync(path.join(require('os').tmpdir(), 'pm-'))], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wav = (samples, sr) => { const b = Buffer.alloc(44 + samples.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40); samples.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2)); return b; };
(async () => {
  for (let i = 0; i < 50; i++) { if (await fetch(BASE).then((r) => r.ok, () => false)) break; await sleep(100); }
  browser = await chromium.launch({ args: ['--no-sandbox'] }); const page = await browser.newPage(); await page.goto(BASE + 'index.html?nosync=1');
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
  // GM assets are decoded one at a time; never return PCM arrays to Node.
  const gmDir = path.join(ROOT, 'cards/assets/postal/music-gm');
  const gm = JSON.parse(fs.readFileSync(path.join(gmDir, 'manifest.json')));
  const assert = require('node:assert/strict'), { execFileSync } = require('child_process'), crypto = require('crypto');
  const expected = [...Array.from({length:8},(_,i)=>`p1-${String(i+1).padStart(2,'0')}`), ...Array.from({length:15},(_,i)=>`p2-${String(i+1).padStart(2,'0')}`), ...Array.from({length:7},(_,i)=>`p3-${String(i+1).padStart(2,'0')}`), 'study','castle','continent-castle','play','storm','clear','victory','key','item','grade','bat','storm-caught','world-fanfare','continent-fanfare'];
  assert.deepEqual(Object.keys(gm.tracks).sort(), expected.sort());
  assert.equal(fs.readdirSync(gmDir).filter(f=>f.endsWith('.m4a')).length,44);assert.equal(gm.rendering.bitrate,96000);assert.deepEqual(gm.aliases,{meadow:'p1-01',sea:'p2-01',sky:'p3-01','d1-01':'p1-01','d1-02':'p1-02','d2-01':'p2-01'});
  // Preserve the measured C-010 entries and their referenced MIDI/AAC hashes exactly.
  const canonical = x => x && typeof x === 'object' ? Array.isArray(x) ? x.map(canonical) : Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])) : x;
  const legacy = Object.fromEntries(Object.entries(gm.tracks).filter(([id])=>!['world-fanfare','continent-fanfare'].includes(id)));
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(canonical(legacy))).digest('hex'), 'f8079b504d2eb180d73cae6dc25155bd8eeb7babbb680f4dfd11c252ec656f48', '42 original measured entries unchanged');
  for(const scene of ['meadow','sea','sky']) { const variants=Object.values(gm.tracks).filter(e=>e.scene===scene);assert.equal(new Set(variants.map(e=>JSON.stringify([e.leadProgram,e.accompaniment,e.transpose,e.tempoUs,e.drums]))).size,variants.length); }
  for (const [alias,target] of Object.entries(gm.aliases)) { assert(gm.tracks[target], `alias ${alias}`); }
  let bytes = 0; const summaries = [];
  for (const [id,e] of Object.entries(gm.tracks)) {
    assert.equal(e.rendered,true); assert(/^[a-z0-9-]+\.m4a$/.test(e.file)); const media = path.join(gmDir,e.file); const mediaBytes = fs.statSync(media).size; bytes += mediaBytes; assert.equal(mediaBytes,e.bytes); assert.equal(crypto.createHash('sha256').update(fs.readFileSync(media)).digest('hex'),e.audioSha256,`${id} audio hash`);
    const info = JSON.parse(execFileSync(process.env.FFPROBE || 'ffprobe',['-v','error','-show_streams','-show_format','-of','json',media],{encoding:'utf8'})); const audio = info.streams[0];
    if (id==='world-fanfare' || id==='continent-fanfare') {
      const continent=id==='continent-fanfare';
      assert.equal(e.kind,'jingle');assert.equal(e.bpm,120);assert.equal(e.preRollSamples,0);
      assert.equal(e.loopSamples,continent?352800:176400);assert.equal(e.tailSamples,continent?88200:44100);
      assert.equal(e.frames,continent?441000:220500);assert.equal(Number(audio.duration_ts),e.frames);
      assert.equal(e.loopStart,0);assert.equal(e.loopEnd,null);assert.equal(e.startOffset,0);
      assert.deepEqual(e.programs,continent?[60,48,43,61]:[60,48,42,11]);assert.deepEqual(e.channels,[1,2,3,4]);
    }
    assert.equal(audio.codec_name,'aac'); assert.equal(audio.profile,'LC'); assert.equal(Number(audio.sample_rate),44100); assert.equal(audio.channels,2); assert(Math.abs(Number(audio.bit_rate)-96000)<16000);
    const midi = fs.readFileSync(path.join(ROOT,'assets/post-office/v3/midi',id+'.mid'));
    assert.equal(crypto.createHash('sha256').update(midi).digest('hex'),e.sourceMidiSha256, `${id} source hash`);
    assert.equal(midi.toString('ascii',0,4),'MThd'); assert.equal(midi.readUInt16BE(8),1); assert.equal(midi.readUInt16BE(12),480);
    const nt=midi.readUInt16BE(10);assert(nt>=5 && nt<=8,`${id} track count`);assert.equal(nt,e.channels.length+1);
    let offset=14, sounding=0;
    for(let track=0;track<nt;track++) {
      assert.equal(midi.toString('ascii',offset,offset+4),'MTrk');const end=offset+8+midi.readUInt32BE(offset+4);let pos=offset+8,notes=0,program=false;
      const vlq=()=>{let n=0,b;do{b=midi[pos++];n=(n<<7)|(b&127);}while(b&128);return n;};
      while(pos<end){vlq();const status=midi[pos++];if(status===255){const type=midi[pos++],len=vlq();pos+=len;continue;} if(status===240||status===247){pos+=vlq();continue;}const kind=status&240,ch=status&15;assert(status>=128);if(kind===192){const pg=midi[pos++];program=true;assert(ch===9?pg===0:e.programs.includes(pg));}else{const a=midi[pos++],b=midi[pos++];if(kind===144&&b>0){notes++;assert(e.channels.includes(ch+1));if(ch===9)assert([36,37,38,42,54].includes(a));}}}
      if(notes){sounding++;assert(program,`${id} explicit program`);}offset=end;
    }
    assert(sounding>=4&&sounding<=7,`${id} sounding tracks`);
    if(/^p[123]-/.test(id)){assert.equal(e.bars,32);const base={meadow:108,sea:96,sky:88}[e.scene];assert(Math.abs(e.bpm/base-1)<=.08);assert(Math.abs(e.transpose)<=2);const n=Number(id.slice(3));if(n>1){const previous=gm.tracks[id.slice(0,3)+String(n-1).padStart(2,'0')];assert.notEqual(previous.leadProgram,e.leadProgram);assert.notEqual(previous.accompaniment,e.accompaniment);}}
    const st = await page.evaluate(async ({entry,id})=>{
      const ctx=new AudioContext({sampleRate:44100});try{
        const buffer=await ctx.decodeAudioData(await (await fetch('assets/postal/music-gm/'+entry.file)).arrayBuffer());
        const sr=buffer.sampleRate,from=entry.kind==='loop'?Math.round(entry.loopStart*sr):0,to=entry.kind==='loop'?Math.round(entry.loopEnd*sr):entry.loopSamples;
        let sum=0,peak=0,clipped=0,n=0;const seam=[];
        for(let ch=0;ch<buffer.numberOfChannels;ch++){
          const d=buffer.getChannelData(ch);for(let i=from;i<to;i++){const v=d[i];sum+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=.999)clipped++;n++;}
          if(entry.kind==='loop'){
            const win=441;let a=0,b=0;const diffs=[];for(let k=0;k<win;k++){a+=d[from+k]**2;b+=d[to-win+k]**2;if(k)diffs.push(Math.abs(d[from+k]-d[from+k-1]),Math.abs(d[to-win+k]-d[to-win+k-1]));}diffs.sort((a,b)=>a-b);
            seam.push({rmsDelta:Math.abs(10*Math.log10((a+1e-15)/(b+1e-15))),jump:Math.abs(d[from]-d[to-1]),limit:Math.max(.01,2*diffs[Math.floor(diffs.length*.99)])});
          }
        }
        return {id,frames:buffer.length,duration:buffer.duration,sampleRate:sr,peakDb:20*Math.log10(peak||1e-12),rmsDb:10*Math.log10(sum/n||1e-12),clipped,seam};
      }finally{await ctx.close();}
    },{entry:e,id});
    assert.equal(st.frames,e.frames,`${id} browser frames`); assert.equal(st.sampleRate,44100); assert.equal(st.clipped,0); assert(st.peakDb<=-5.8,`${id} peak ${st.peakDb}`);
    if(e.kind==='loop'){
      assert(e.loopStart>=0&&e.loopEnd>e.loopStart&&e.loopEnd<=st.duration);assert(Number.isFinite(e.startOffset)&&e.startOffset>=0&&e.startOffset<=e.loopStart);assert(Math.abs((e.loopEnd-e.loopStart)*44100-e.loopSamples)<=1);assert(Math.abs((e.loopStart-e.startOffset)*44100-e.loopPhaseSamples)<=1);assert(e.loopPhaseSamples>=0&&e.loopPhaseSamples<e.preRollSamples);assert(e.tailSamples>=e.preRollSamples);assert((st.duration-e.loopEnd)*44100>=e.tailSamples-1);
      assert(Math.abs(e.loudnessLufs-(id==='study'?-27:-24))<=1,`${id} loudness ${e.loudnessLufs}`);for(const seam of st.seam){assert(seam.rmsDelta<=6,`${id} seam RMS ${seam.rmsDelta}`);assert(seam.jump<=seam.limit,`${id} seam jump ${seam.jump}/${seam.limit}`);}
    }else assert(Math.abs(st.rmsDb+24)<=1,`${id} jingle RMS ${st.rmsDb}`);
    const meter = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-hide_banner','-nostats','-i',media,'-af',`atrim=start=${e.kind==='loop'?e.loopStart:0}:end=${e.kind==='loop'?e.loopEnd:e.loopSamples/44100},ebur128=peak=true`,'-f','null','-'], {encoding:'utf8'});
    assert.equal(meter.status,0); const measuredI = [...meter.stderr.matchAll(/I:\s*(-?[0-9.]+) LUFS/g)].at(-1), measuredPeak = [...meter.stderr.matchAll(/Peak:\s*(-?[0-9.]+) dBFS/g)].at(-1);
    assert(measuredPeak && Number(measuredPeak[1])<=-5.95,`${id} measured true peak`);
    if(e.kind==='loop') assert(measuredI && Math.abs(Number(measuredI[1])-(id==='study'?-27:-24))<=1,`${id} measured LUFS`);
    assert(e.truePeakDb<=-6,`${id} true peak`);assert(Number.isInteger(e.encodedDelaySamples));assert(Number.isInteger(e.decodedOffsetSamples));
    summaries.push(st);console.log(`GM ${id}: ${st.duration.toFixed(3)}s peak ${st.peakDb.toFixed(2)} RMS ${st.rmsDb.toFixed(2)} seam ${JSON.stringify(st.seam)}`);
  }
  assert(bytes<=40*1024*1024,'GM media exceeds 40MB');console.log(`44 GM recordings validated, ${bytes} bytes`);

  await browser.close(); server.kill();
  const f = (x) => (Math.round(x * 10) / 10).toString().padStart(6);
  console.log('piece        secs   peak dB   rms dB  clipped  silent%  norm   loop seam (start/end dB)');
  for (const id of Object.keys(index)) { const r = res[id]; console.log(id.padEnd(10), f(r.secs), f(r.peakDb), f(r.rmsDb), String(r.clip).padStart(7), f(r.silentPct), String(r.norm).padStart(7), ' ', f(r.seam.startDb), f(r.seam.endDb)); fs.writeFileSync(path.join(OUT, id + '.wav'), wav(r.samples, 22050)); if (CAL) fs.writeFileSync(path.join(ROOT, 'cards/assets/postal/music', id + '.json'), JSON.stringify(r.track)); }
  console.log('\nsfx          secs   peak dB   rms dB  clipped'); const all = []; for (const [n, r] of Object.entries(res.sfx)) { console.log(n.padEnd(14), f(r.secs), f(r.peakDb), f(r.rmsDb), String(r.clip).padStart(7)); all.push(...r.samples, ...new Array(11025).fill(0)); }
  fs.writeFileSync(path.join(OUT, 'sfx-all.wav'), wav(all, 22050));   // every effect in order, 0.5 s apart, for listening
  if (CAL) fs.writeFileSync(path.join(ROOT, 'cards/assets/postal/sfx.json'), JSON.stringify(res.sfxJson));
  const bad = Object.entries(res).filter(([k, r]) => k !== 'sfx' && k !== 'sfxJson' && r.clip > 0).length + Object.values(res.sfx).filter((r) => r.clip > 0).length;
  console.log(bad ? `\n${bad} piece(s) clip` : '\nno clipping'); process.exit(bad ? 1 : 0);
})().catch(async (e) => { console.error(e); try { await browser?.close(); } catch {} try { server.kill(); } catch {} process.exit(2); });
