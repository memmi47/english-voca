"""Static server for the flashcard prototype in cards/ (HTTP Range support, needed by iPad Safari for audio).

  python3 tools/serve_cards.py [--port 8090] [--host 0.0.0.0]

Reuses the request handler of tools/serve.py without changing it. Family LAN use; no authentication.
"""
import argparse, os, sys
from functools import partial
from http.server import ThreadingHTTPServer
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from serve import H  # noqa: E402

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=8090); ap.add_argument('--host', default='127.0.0.1')
    a = ap.parse_args()
    print(f'serving cards/ on http://{a.host}:{a.port}/  (Ctrl+C to stop)')
    ThreadingHTTPServer((a.host, a.port), partial(H, directory=os.path.join(here, '..', 'cards'))).serve_forever()
