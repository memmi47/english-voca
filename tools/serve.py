"""Static server for game/ with HTTP Range support (iOS Safari needs 206 for <audio>).
Usage: python3 tools/serve.py [--port 8077] [--host 0.0.0.0]
Standard library only. Family LAN use; no authentication.
"""
import argparse, os, re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

class H(SimpleHTTPRequestHandler):
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
        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_error(416); return None
        f = open(path, 'rb'); f.seek(start); self._left = end - start + 1
        self.send_response(206); self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}'); self.send_header('Content-Length', str(self._left))
        self.send_header('Accept-Ranges', 'bytes'); self.end_headers(); return f
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
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=8077); ap.add_argument('--host', default='127.0.0.1')
    a = ap.parse_args(); root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'game')
    print(f'serving game/ on http://{a.host}:{a.port}/  (Ctrl+C to stop)')
    ThreadingHTTPServer((a.host, a.port), partial(H, directory=root)).serve_forever()
