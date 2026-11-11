"""Static server for game/ with HTTP Range support and a small state store.

  python3 tools/serve.py [--port 8077] [--host 0.0.0.0] [--state-dir state]

- Range (206) is needed by iOS Safari for <audio>.
- /api/doc/<name> keeps each child's progress on this Mac so that it survives a browser
  clearing its own storage and is shared between the Mac and the iPad.
    GET  -> {"rev": n, "data": {...}}                (404 if never saved)
    PUT  {"baseRev": n, "data": {...}} -> {"rev": n+1}   (409 + current doc if baseRev is stale)
  Names are whitelisted. Every write is atomic and the previous versions are kept in
  <state-dir>/backup/. Standard library only. Family LAN use; no authentication.
"""
import argparse, json, os, re, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

DOCS = {'meta', 'p.son', 'p.daughter'}
MAX_BODY = 8 * 1024 * 1024
KEEP_BACKUPS = 30
LOCK = threading.Lock()

class H(SimpleHTTPRequestHandler):
    state_dir = 'state'

    # ---- state store ----
    def _doc_name(self):
        m = re.fullmatch(r'/api/doc/([a-z.]+)', self.path.split('?')[0])
        return m.group(1) if m and m.group(1) in DOCS else None
    def _doc_path(self, name): return os.path.join(self.state_dir, name + '.json')
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def _load(self, name):
        try:
            with open(self._doc_path(name), encoding='utf-8') as f: return json.load(f)
        except FileNotFoundError: return None
    def do_GET(self):
        if self.path.startswith('/api/'):
            if self.path.split('?')[0] == '/api/ping': return self._json(200, {'ok': True, 'store': True})
            name = self._doc_name()
            if not name: return self._json(404, {'error': 'unknown doc'})
            with LOCK: doc = self._load(name)
            return self._json(200, doc) if doc else self._json(404, {'error': 'not saved yet'})
        return super().do_GET()
    def do_PUT(self):
        name = self._doc_name()
        if not name: return self._json(404, {'error': 'unknown doc'})
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if not 0 < n <= MAX_BODY: return self._json(413, {'error': 'body size'})
            req = json.loads(self.rfile.read(n).decode('utf-8'))
            data, base = req['data'], int(req.get('baseRev') or 0)
            if not isinstance(data, dict): raise ValueError('data must be an object')
        except (ValueError, KeyError, TypeError) as e:
            return self._json(400, {'error': 'bad request: ' + str(e)})
        with LOCK:
            cur = self._load(name); rev = cur['rev'] if cur else 0
            if base != rev: return self._json(409, cur or {'rev': 0, 'data': None})
            os.makedirs(os.path.join(self.state_dir, 'backup'), exist_ok=True)
            if cur:                                    # keep the version being replaced
                with open(os.path.join(self.state_dir, 'backup', f'{name}.{rev:08d}.json'), 'w', encoding='utf-8') as f:
                    json.dump(cur, f, ensure_ascii=False)
                olds = sorted(x for x in os.listdir(os.path.join(self.state_dir, 'backup')) if x.startswith(name + '.'))
                for x in olds[:-KEEP_BACKUPS]: os.remove(os.path.join(self.state_dir, 'backup', x))
            tmp = self._doc_path(name) + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump({'rev': rev + 1, 'data': data}, f, ensure_ascii=False); f.flush(); os.fsync(f.fileno())
            os.replace(tmp, self._doc_path(name))
        return self._json(200, {'rev': rev + 1})

    # ---- static files with Range ----
    def send_head(self):
        rng = self.headers.get('Range'); path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)$', rng.strip())
        size = os.path.getsize(path)
        if not m or (m.group(1) == '' and m.group(2) == ''):
            return super().send_head()
        a, b = m.groups()
        start, end = (size - int(b), size - 1) if a == '' else (int(a), int(b) if b else size - 1)
        start = max(start, 0); end = min(end, size - 1)
        if start > end or start >= size:
            self.send_error(416); return None
        f = open(path, 'rb'); f.seek(start); self._left = end - start + 1
        self.send_response(206); self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}'); self.send_header('Content-Length', str(self._left))
        self.end_headers(); return f
    def copyfile(self, source, outputfile):
        left = getattr(self, '_left', None)
        if left is None: return super().copyfile(source, outputfile)
        self._left = None
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk: break
            outputfile.write(chunk); left -= len(chunk)
    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes'); self.send_header('Cache-Control', 'no-cache'); super().end_headers()
    def log_message(self, *a): pass

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=8077); ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--state-dir', default=os.path.join(here, '..', 'state'))
    a = ap.parse_args(); H.state_dir = os.path.abspath(a.state_dir); os.makedirs(H.state_dir, exist_ok=True)
    print(f'serving game/ on http://{a.host}:{a.port}/  state in {H.state_dir}  (Ctrl+C to stop)')
    ThreadingHTTPServer((a.host, a.port), partial(H, directory=os.path.join(here, '..', 'game'))).serve_forever()
