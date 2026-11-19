"""Static server for the cards game in cards/ with HTTP Range support and a small state store.

  python3 tools/serve_cards.py [--port 8090] [--host 0.0.0.0] [--state-dir state-cards]

- Range (206) is needed by iOS Safari for <audio>.
- /api/doc/<name> keeps each child's progress on this Mac so that it survives a browser
  clearing its own storage and is shared between the Mac and the iPad.
    GET  -> {"rev": n, "data": {...}}                (404 if never saved)
    PUT  {"baseRev": n, "data": {...}} -> {"rev": n+1}   (409 + current doc if baseRev is stale)
  Names are whitelisted. Every write is atomic.
- Progress is never thrown away by a write (docs/DATA_SAFETY.md):
    <state-dir>/backup/    the 30 versions before the current one
    <state-dir>/daily/     the last version of every day that was played (kept 400 days; without the per-card log)
    <state-dir>/rejected/  writes that were refused: a record with clearly fewer words than the stored one, or one saved
                           by an older program version than the stored one. The answer is 409 with the stored doc, so
                           a normal client merges and tries again.
    GET /api/snapshots/<name> -> {"days": [...]}     GET /api/snapshot/<name>/<day> -> {"rev", "data"}
  /api/ping also reports the newest daily copy and the last off-site backup (written by tools/backup_state.sh).
Standard library only. Family LAN use; no authentication.
(Code carried over from the earlier game's tools/serve.py, which was removed; last version in commit 8acc013.)
"""
import argparse, datetime, gzip, io, json, os, re, threading, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

DOCS = {'meta', 'p.son', 'p.daughter'}
MAX_BODY = 16 * 1024 * 1024
KEEP_BACKUPS = 30
KEEP_DAILY = 400
KEEP_REJECTED = 20
SHRINK_MIN, SHRINK_RATIO = 10, 0.9          # a child's record with 10+ words may not drop below 90% of its words
LOCK = threading.Lock()

def words_in(data): return len(data.get('words') or {}) if isinstance(data, dict) else 0
def version_of(data): return int(data.get('v') or 0) if isinstance(data, dict) and isinstance(data.get('v'), (int, float)) else 0

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
    def _sub(self, kind):
        d = os.path.join(self.state_dir, kind); os.makedirs(d, exist_ok=True); return d
    def _keep(self, kind, name, n):
        d = self._sub(kind); olds = sorted(x for x in os.listdir(d) if x.startswith(name + '.'))
        for x in olds[:-n]: os.remove(os.path.join(d, x))
    def _days(self, name):
        d = self._sub('daily'); return sorted(x[len(name) + 1:-5] for x in os.listdir(d) if x.startswith(name + '.') and x.endswith('.json'))
    def do_GET(self):
        path = self.path.split('?')[0]
        if path.startswith('/api/'):
            if path == '/api/ping':
                with LOCK:
                    days = sorted({d for n in DOCS for d in self._days(n)}); off = None
                    try:
                        with open(os.path.join(self.state_dir, 'offsite.json'), encoding='utf-8') as f: off = json.load(f)
                    except (OSError, ValueError): pass
                return self._json(200, {'ok': True, 'store': True, 'daily': len(days), 'lastDaily': days[-1] if days else None, 'offsite': off})
            m = re.fullmatch(r'/api/snapshots/([a-z.]+)', path)
            if m and m.group(1) in DOCS:
                with LOCK: return self._json(200, {'days': self._days(m.group(1))})
            m = re.fullmatch(r'/api/snapshot/([a-z.]+)/(\d{4}-\d{2}-\d{2})', path)
            if m and m.group(1) in DOCS:
                try:
                    with open(os.path.join(self._sub('daily'), f'{m.group(1)}.{m.group(2)}.json'), encoding='utf-8') as f: return self._json(200, json.load(f))
                except FileNotFoundError: return self._json(404, {'error': 'no copy for that day'})
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
            if cur and name.startswith('p.'):          # a write may add to a child's record, never take it away
                had, got = words_in(cur['data']), words_in(data)
                why = 'older-format' if version_of(data) < version_of(cur['data']) else 'shrink' if had >= SHRINK_MIN and got < had * SHRINK_RATIO else None
                if why:
                    with open(os.path.join(self._sub('rejected'), f'{name}.{int(time.time() * 1000)}.{why}.json'), 'w', encoding='utf-8') as f:
                        json.dump({'baseRev': base, 'data': data}, f, ensure_ascii=False)
                    self._keep('rejected', name, KEEP_REJECTED)
                    return self._json(409, {**cur, 'refused': why})
            if cur:                                    # keep the version being replaced
                with open(os.path.join(self._sub('backup'), f'{name}.{rev:08d}.json'), 'w', encoding='utf-8') as f:
                    json.dump(cur, f, ensure_ascii=False)
                self._keep('backup', name, KEEP_BACKUPS)
            doc = {'rev': rev + 1, 'data': data}
            tmp = self._doc_path(name) + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(doc, f, ensure_ascii=False); f.flush(); os.fsync(f.fileno())
            os.replace(tmp, self._doc_path(name))
            # the last version of each day, without the per-card log (diagnostics only; it would triple the size)
            day = datetime.date.today().isoformat(); slim = {'rev': rev + 1, 'data': {k: v for k, v in data.items() if k != 'log'}}
            dtmp = os.path.join(self._sub('daily'), f'{name}.{day}.json.tmp')
            with open(dtmp, 'w', encoding='utf-8') as f: json.dump(slim, f, ensure_ascii=False)
            os.replace(dtmp, dtmp[:-4]); self._keep('daily', name, KEEP_DAILY)
        return self._json(200, {'rev': rev + 1})

    # ---- static files with Range ----
    # Text files (the 2 MB card list, sprite sheets, scripts) are sent gzip-compressed when the browser accepts it: on an iPad
    # over Wi-Fi this is most of the start-up time. Compressed bytes are kept in memory per file version; ETag revalidation
    # (Cache-Control: no-cache) answers 304 when nothing changed, so an update is still seen at once.
    GZIP_TYPES = ('.json', '.svg', '.js', '.css', '.html', '.tsv', '.txt')
    _gz = {}
    def _send_gzip(self, path):
        st = os.stat(path); tag = f'"{st.st_mtime_ns:x}-{st.st_size:x}-gz"'
        if self.headers.get('If-None-Match') == tag:
            self.send_response(304); self.send_header('ETag', tag); self.send_header('Vary', 'Accept-Encoding'); self.end_headers(); return None
        key = (path, st.st_mtime_ns, st.st_size); body = H._gz.get(key)
        if body is None:
            with open(path, 'rb') as f: body = gzip.compress(f.read(), 6)
            H._gz = {k: v for k, v in H._gz.items() if k[0] != path}; H._gz[key] = body
        self.send_response(200); self.send_header('Content-Type', self.guess_type(path)); self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(body))); self.send_header('ETag', tag); self.send_header('Vary', 'Accept-Encoding')
        self.end_headers(); return io.BytesIO(body)
    def send_head(self):
        rng = self.headers.get('Range'); path = self.translate_path(self.path)
        if not rng and os.path.isfile(path) and path.endswith(H.GZIP_TYPES) and 'gzip' in (self.headers.get('Accept-Encoding') or ''):
            return self._send_gzip(path)
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

# The browser asks for a dozen game files at once, each on its own connection. Python's default waiting line holds 5: on
# macOS a 6th connection is refused outright (Linux makes it wait), so a script failed on the Mac and the game did not
# start (user screenshot 2026-11-20: main, deck, map, world, store loaded; sync, sound, storm "Failed to fetch").
class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=8090); ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--state-dir', default=os.environ.get('CARDS_STATE_DIR') or os.path.join(here, '..', 'state-cards'))
    a = ap.parse_args(); H.state_dir = os.path.abspath(a.state_dir); os.makedirs(H.state_dir, exist_ok=True)
    print(f'serving cards/ on http://{a.host}:{a.port}/  state in {H.state_dir}  (Ctrl+C to stop)')
    Server((a.host, a.port), partial(H, directory=os.path.join(here, '..', 'cards'))).serve_forever()
