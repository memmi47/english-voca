#!/usr/bin/env bash
# Render the original C-010 MIDI with the separately obtained, verified GeneralUser GS font.
# macOS: brew install fluidsynth ffmpeg; bash tools/render_music.sh /path/to/GeneralUser-GS.sf2
# Add only new recordings without re-encoding existing files:
# GM_TRACKS=world-fanfare,continent-fanfare bash tools/render_music.sh /path/to/GeneralUser-GS.sf2
set -euo pipefail
GM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GM_SF="${1:-${SOUNDFONT:-}}"
[ -n "$GM_SF" ] || { echo 'Usage: bash tools/render_music.sh <GeneralUser GS 2.0.3 .sf2>' >&2; exit 2; }
python3 -I - "$GM_ROOT" "$GM_SF" "${FLUIDSYNTH:-fluidsynth}" "${FFMPEG:-ffmpeg}" "${FFPROBE:-ffprobe}" <<'PY'
import array, copy, hashlib, json, math, os, re, shutil, statistics, struct, subprocess, sys, tempfile
from pathlib import Path
ROOT, SF = Path(sys.argv[1]), Path(sys.argv[2]).expanduser().resolve()
FLUID, FFMPEG, FFPROBE = sys.argv[3:6]
SR, FRAME, LIMIT = 44100, 8, 40_000_000
OUT = ROOT/'cards/assets/postal/music-gm'
for tool in (FLUID, FFMPEG, FFPROBE):
    if not shutil.which(tool): raise SystemExit('Missing free tool: '+tool)
if not SF.is_file(): raise SystemExit('SoundFont not found: '+str(SF))
m = json.loads((OUT/'manifest.json').read_text())
if hashlib.sha256(SF.read_bytes()).hexdigest() != m['soundfont']['sha256']:
    raise SystemExit('SoundFont hash differs from the licensed/pinned GeneralUser GS 2.0.3. See docs/research/music_gm.md.')
if len(m['tracks']) != 44: raise SystemExit('Expected 44 recordings (42 existing + 2 fanfares)')
requested = os.environ.get('GM_TRACKS', '').strip()
selected = set(requested.split(',')) if requested else set(m['tracks'])
if not selected or selected - set(m['tracks']):
    raise SystemExit('Unknown or empty GM_TRACKS selection: '+requested)
try:
    import numpy as np
except ImportError:
    np = None # Optional acceleration; the renderer also works with standard Python.

def run(args, data=None):
    p = subprocess.run([str(x) for x in args], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode: raise RuntimeError('Command failed: '+str(args[0])+'\n'+p.stderr.decode(errors='replace')[-4000:])
    return p.stdout, p.stderr.decode(errors='replace')

try:
    version_probe=subprocess.run([FLUID,'-ni','-a','file','-V'],capture_output=True,text=True,timeout=5)
    version_match=re.search(r'FluidSynth executable version ([\d.]+)',version_probe.stdout+version_probe.stderr)
    fluid_version=version_match.group(1) if version_match else 'unknown (version probe unavailable)'
except (OSError,subprocess.TimeoutExpired):
    fluid_version='unknown (version probe unavailable)'

def pcm(path):
    return run([FFMPEG,'-v','error','-i',path,'-ar',SR,'-ac',2,'-f','f32le','-'])[0]

def write_pcm(path, data): path.write_bytes(data)

def measure(raw, start, count, work, stem):
    # Analyse the actual body, never its pre-roll or long release tail.
    args=[FFMPEG,'-hide_banner','-nostats','-f','f32le','-ar',SR,'-ac',2,'-i',raw,'-af',f'atrim=start_sample={start}:end_sample={start+count},ebur128=peak=true,astats=metadata=0:reset=0','-f','null','-']
    _, log=run(args)
    def last(pattern):
        xs=re.findall(pattern,log)
        if not xs: raise RuntimeError('Missing audio measurement '+pattern+' for '+stem)
        return float(xs[-1])
    return {'loudnessLufs':last(r'I:\s+(-?\d+(?:\.\d+)?|-inf) LUFS'),
            'truePeakDb':last(r'Peak:\s+(-?\d+(?:\.\d+)?|-inf) dBFS'),
            'rmsDb':last(r'RMS level dB:\s+(-?\d+(?:\.\d+)?|-inf)'),
            'samplePeakDb':last(r'Peak level dB:\s+(-?\d+(?:\.\d+)?|-inf)')}

def samples(data):
    a=array.array('f');a.frombytes(data)
    if sys.byteorder!='little':a.byteswap()
    return a

def seam(data,start,n):
    a=samples(data) if isinstance(data,bytes) else data;width=441
    rms=[];jumps=[];limits=[]
    for c in (0,1):
        left=[a[2*i+c] for i in range(start+n-width,start+n)]
        right=[a[2*i+c] for i in range(start,start+width)]
        db=lambda x:10*math.log10(sum(v*v for v in x)/len(x)+1e-20)
        rms.append(abs(db(left)-db(right)))
        diffs=sorted(abs(x-y) for seq in (left,right) for x,y in zip(seq,seq[1:]))
        p99=diffs[min(len(diffs)-1,int(.99*len(diffs)))];limits.append(max(.01,p99*2))
        jumps.append(abs(left[-1]-right[0]))
    return {'rmsDifferenceDb':rms,'sampleJump':jumps,'jumpLimit':limits}

def offset(reference, decoded, start,n):
    # Compare three non-silent windows. This measures residual decode delay, not raw packet priming.
    a=samples(reference); b=samples(decoded); lags=[];correlations=[];width=1024;radius=2048
    for fraction in (.18,.47,.76):
        at=start+int(n*fraction)
        ref=list(a[2*at:2*(at+width):2]); refmean=sum(ref)/width;ref=[v-refmean for v in ref]
        refenergy=sum(v*v for v in ref)
        if refenergy<1e-10:continue
        lo=max(0,at-radius);hi=min(len(b)//2-width,at+radius)
        if np is not None:
            ext=np.asarray(b[2*lo:2*(hi+width):2],dtype=np.float64); rr=np.asarray(ref)
            dots=np.correlate(ext,rr,'valid');cs=np.r_[0.,np.cumsum(ext)];cq=np.r_[0.,np.cumsum(ext*ext)]
            sums=cs[width:]-cs[:-width];energy=cq[width:]-cq[:-width]-sums*sums/width
            scores=dots/np.sqrt(np.maximum(energy,1e-30)*refenergy)
            best=float(np.max(scores)); candidates=np.flatnonzero(scores>=best-1e-5)
            pick=min((int(i) for i in candidates),key=lambda i:abs(lo+i-at));lag=lo+pick-at;score=float(scores[pick])
        else:
            best=(-2.,0)
            for pos in range(lo,hi+1):
                window=b[2*pos:2*(pos+width):2]; avg=sum(window)/width
                energy=sum((v-avg)**2 for v in window)
                value=sum(x*y for x,y in zip(ref,window))/math.sqrt(max(energy*refenergy,1e-30))
                if value>best[0]+1e-5 or abs(value-best[0])<=1e-5 and abs(pos-at)<abs(best[1]):best=(value,pos-at)
            score,lag=best
        lags.append(lag);correlations.append(score)
    if not lags or min(correlations)<.80: raise RuntimeError('Cannot measure decoded delay reliably: '+str((lags,correlations)))
    value=int(statistics.median(lags))
    if max(abs(x-value) for x in lags)>2: raise RuntimeError('Inconsistent decoded offsets: '+str(lags))
    return value,lags,correlations

with tempfile.TemporaryDirectory(prefix='postal-gm-render-') as temp:
    work=Path(temp);mid=work/'midi';stage=work/'ready';stage.mkdir()
    run([sys.executable,'-I',ROOT/'tools/build_postal_music.py','--render-dir',mid])
    rendered=copy.deepcopy(m)
    for tid,t in rendered['tracks'].items():
        source=ROOT/'assets/post-office/v3/midi'/f'{tid}.mid'
        if hashlib.sha256(source.read_bytes()).hexdigest()!=t['sourceMidiSha256']:raise RuntimeError('Stale MIDI: '+tid)
        if tid not in selected:
            if not t.get('rendered') or not (OUT/t['file']).is_file():
                raise RuntimeError('Unselected recording is missing: '+tid)
            if hashlib.sha256((OUT/t['file']).read_bytes()).hexdigest()!=t['audioSha256']:
                raise RuntimeError('Unselected recording hash differs: '+tid)
            continue
        wav=work/'current.wav'
        run([FLUID,'-ni','-q','-a','file','-r',SR,'-R','1','-C','0','-g','0.35','-o','synth.cpu-cores=1',
             '-o','synth.reverb.room-size=0.2','-o','synth.reverb.damp=0.4','-o','synth.reverb.width=0.5','-o','synth.reverb.level=0.15',
             '-F',wav,SF,mid/f'{tid}.mid'])
        full=pcm(wav);n=int(t['loopSamples']);p=int(t['preRollSamples']);tail=int(t['tailSamples']);loop=t['kind']=='loop'
        if loop:
            lo=n-p;hi=2*n+tail
            if len(full)//FRAME<hi:raise RuntimeError('Short rendered loop: '+tid)
            body=bytearray(full[n*FRAME:2*n*FRAME]);width=441
            # Join at the continuous following-cycle attack; keep the exact N-frame period.
            for k in range(width):
                weight=k/(width-1)
                for ch in (0,1):
                    j=(2*k+ch)*4;nextj=((2*n+k)*2+ch)*4
                    original=struct.unpack_from('<f',body,j)[0];following=struct.unpack_from('<f',full,nextj)[0]
                    struct.pack_into('<f',body,j,following*(1-weight)+original*weight)
            # An extra bar lets the measured loop boundary move into a sustain.
            # Initial playback still starts at the first downbeat, before loopStart.
            data=bytes(body[-p*FRAME:])+bytes(body)+bytes(body[:2*p*FRAME])
        else:
            need=n+tail
            if len(full)//FRAME<need:raise RuntimeError('Short rendered jingle: '+tid)
            data=full[:need*FRAME]
        raw=work/'crop.raw';raw.write_bytes(data)
        before=measure(raw,p,n,work,tid)
        target=-27. if tid=='study' else -24.
        metric='loudnessLufs' if loop else 'rmsDb'
        if not math.isfinite(before[metric]):raise RuntimeError('Silent body: '+tid)
        gain=target-before[metric]
        if before['truePeakDb']+gain>-6.0:raise RuntimeError(f'{tid}: target loudness conflicts with peak cap; adjust score velocity (gain {gain}, peak {before["truePeakDb"]})')
        normalized=work/'normal.raw'
        run([FFMPEG,'-v','error','-f','f32le','-ar',SR,'-ac',2,'-i',raw,'-af',f'volume={gain}dB','-f','f32le','-y',normalized])
        ref=normalized.read_bytes();dest=stage/t['file']
        run([FFMPEG,'-v','error','-f','f32le','-ar',SR,'-ac',2,'-i',normalized,'-c:a','aac','-profile:a','aac_low','-b:a','96k','-ar',SR,'-ac',2,'-movie_timescale',SR,'-movflags','+faststart','-y',dest])
        dec=pcm(dest);decoded=work/'decoded.raw';decoded.write_bytes(dec)
        delay,window_lags,corr=offset(ref,dec,p,n)
        if delay<0 or p+delay<0:raise RuntimeError('Negative residual decode offset requires investigation: '+tid)
        phase=0
        if loop:
            decoded_samples=samples(dec)
            for phase in range(0,p+1,441):
                se=seam(decoded_samples,p+delay+phase,n)
                if max(se['rmsDifferenceDb'])<=6 and all(a<=b for a,b in zip(se['sampleJump'],se['jumpLimit'])):break
            else:raise RuntimeError('No continuous decoded loop boundary within first bar: '+tid)
            tail=2*p-phase
        st=measure(decoded,p+delay+phase,n,work,tid)
        if abs(st[metric]-target)>1.0 or st['truePeakDb']>-6.0 or st['samplePeakDb']>=0:raise RuntimeError('Encoded audio levels outside contract: '+tid+' '+str(st))
        container=json.loads(run([FFPROBE,'-v','error','-select_streams','a:0','-read_intervals','%+#1','-show_packets','-show_streams','-of','json',dest])[0])
        packet=container['packets'][0]
        skip=next((int(x.get('skip_samples',0)) for x in packet.get('side_data_list',[]) if x.get('side_data_type')=='Skip Samples'),0)
        frames=len(ref)//FRAME
        stream=container['streams'][0]
        if stream['time_base']!='1/44100' or int(stream['duration_ts'])!=frames:
            raise RuntimeError('Container edit duration differs from sample-exact PCM: '+tid)
        t.update(sampleRate=SR,frames=frames,duration=frames/SR,encodedDelaySamples=skip,decodedOffsetSamples=delay,
                 ffmpegDecodedFrames=len(dec)//FRAME,offsetWindowLags=window_lags,offsetCorrelations=[round(x,6) for x in corr],
                 loopStart=(p+phase+delay)/SR if loop else 0,loopEnd=(p+phase+n+delay)/SR if loop else None,
                 loopPhaseSamples=phase,startOffset=(p+delay)/SR if loop else 0,tailSamples=tail,
                 gain=1,rendered=True,audioSha256=hashlib.sha256(dest.read_bytes()).hexdigest(),bytes=dest.stat().st_size,
                 normalizationTarget=target,normalizationMetric=metric,**st)
        if loop:
            t['seam']=se
        print(json.dumps({'id':tid,'bytes':t['bytes'],'offset':delay,'lufs':st['loudnessLufs'],'rms':st['rmsDb'],'truePeak':st['truePeakDb']},ensure_ascii=False),flush=True)
        # Same task-owned temporary filenames are overwritten, not accumulated per song.
    rendered['rendering']={'fluidSynth':fluid_version,
        'sampleRate':SR,'movieTimescale':SR,'channels':2,'codec':'AAC-LC','bitrate':96000,'chorus':False,
        'reverb':{'roomSize':.2,'damp':.4,'width':.5,'level':.15},'sf2Sha256':rendered['soundfont']['sha256'],
        'decodedOffsetMethod':'three-window normalized PCM cross-correlation; no raw-priming assumption'}
    manifest=json.dumps(rendered,ensure_ascii=False,indent=2)+'\n'
    staged={p.name:p for p in stage.iterdir()}
    size=sum(p.stat().st_size for p in staged.values())+len(manifest.encode())
    # Count existing, unselected files as well: a partial render must obey the
    # same complete-folder release limit as a full render.
    size+=sum(p.stat().st_size for p in OUT.iterdir()
              if p.is_file() and p.name not in staged and p.name!='manifest.json')
    if size>LIMIT:raise RuntimeError(f'Music exceeds 40MB: {size} bytes; no release files installed')
    # Publish only once every song passed. Existing source/fallback files are never touched.
    for path in stage.iterdir():os.replace(path,OUT/path.name)
    mf=OUT/'manifest.json.next';mf.write_text(manifest);os.replace(mf,OUT/'manifest.json')
    print(f'RENDERED {len(selected)}/{len(m["tracks"])}; music-gm total {size} bytes (<40,000,000); SoundFont remains outside repository',flush=True)
PY
