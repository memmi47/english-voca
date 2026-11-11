"""Audio manifest tool.
  build         create dev TTS clips (ffmpeg flite, voice slt) for tools/audio_sources.json and write game/audio/manifest.json.
                Dev clips are status 'dev_tts'. Existing human approvals are kept ONLY if the file hash is unchanged.
  apply-review  merge a review log exported from the in-app review page (#/review). Approval needs a matching sha256.
  status        counts by status
Never marks anything human_approved on its own.
"""
import json, sys, hashlib, subprocess, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'game/audio'; MAN = A / 'manifest.json'; SRC = ROOT / 'tools/audio_sources.json'

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def load():
    return json.loads(MAN.read_text(encoding='utf-8')) if MAN.exists() else {'schema': 1, 'entries': {}}

def build():
    src = json.loads(SRC.read_text(encoding='utf-8'))
    src['__soundcheck'] = {'kind': 'system', 'text': 'Sound check. Can you hear me?', 'tts_text': 'Sound check. Can you hear me?'}
    man = load(); (A / 'dev').mkdir(parents=True, exist_ok=True)
    for key, s in src.items():
        name = re.sub(r'[^a-z0-9]+', '_', key.lower()).strip('_')[:40] + '_' + hashlib.sha1(key.encode()).hexdigest()[:6] + '.mp3'
        rel = 'dev/' + name; out = A / rel
        old = man['entries'].get(key)
        if old and old.get('status') == 'human_approved' and old.get('file') != rel:
            print('keep approved (different file):', key); continue   # never overwrite a human-approved clip
        tts = s['tts_text'].replace("'", "\\'").replace(':', '\\:')
        cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', f"flite=text='{tts}':voice=slt",
               '-ar', '22050', '-ac', '1', '-b:a', '48k', str(out)]
        subprocess.run(cmd, check=True)
        man['entries'][key] = {'file': rel, 'status': 'dev_tts', 'kind': s['kind'], 'text': s['text'],
                               'engine': 'ffmpeg flite slt (dev only)', 'sha256': sha(out)}
    MAN.write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding='utf-8'); status()

def apply_review(path):
    log = json.loads(Path(path).read_text(encoding='utf-8')); man = load(); ok = rej = 0
    for r in log.get('reviews', []):
        e = man['entries'].get(r['key'])
        if not e: print('unknown key', r['key']); continue
        f = A / e['file']
        if not f.exists() or sha(f) != r.get('sha256'):
            print('hash mismatch, approval dropped:', r['key']); continue
        if r['verdict'] == 'approve' and r.get('reviewer'):
            e.update(status='human_approved', reviewer=r['reviewer'], approved_at=r.get('at'), sha256=r['sha256']); ok += 1
        else:
            e.update(status='rejected' if r['verdict'] == 'reject' else e['status'], note=r.get('note', '')); rej += 1
    # invalidate approvals whose file changed after approval
    for k, e in man['entries'].items():
        if e.get('status') == 'human_approved' and (A / e['file']).exists() and sha(A / e['file']) != e.get('sha256'):
            e['status'] = 'candidate'; e.pop('approved_at', None); print('file changed after approval ->', k)
    MAN.write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding='utf-8'); print('approved', ok, 'other', rej); status()

def status():
    c = {}
    for e in load()['entries'].values(): c[e['status']] = c.get(e['status'], 0) + 1
    print('manifest', c)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    {'build': build, 'status': status}.get(cmd, lambda: apply_review(sys.argv[2]))()
