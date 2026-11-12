"""Static server for the flashcard prototype in cards/ (HTTP Range support, needed by iPad Safari for audio)
plus the small state store that lets the Mac and the iPad share progress.

  python3 tools/serve_cards.py [--port 8090] [--host 0.0.0.0] [--state-dir state-cards]

Reuses the request handler of tools/serve.py without changing it (Range requests, /api/doc/<name> with
version checks, atomic writes, 30 backups). The state goes to its own folder so it never mixes with the
older game's state/. Family LAN use; no authentication.
"""
import argparse, os, sys
from functools import partial
from http.server import ThreadingHTTPServer
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from serve import H  # noqa: E402

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=8090); ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--state-dir', default=os.path.join(here, '..', 'state-cards'))
    a = ap.parse_args(); H.state_dir = os.path.abspath(a.state_dir); os.makedirs(H.state_dir, exist_ok=True)
    print(f'serving cards/ on http://{a.host}:{a.port}/  state in {H.state_dir}  (Ctrl+C to stop)')
    ThreadingHTTPServer((a.host, a.port), partial(H, directory=os.path.join(here, '..', 'cards'))).serve_forever()
