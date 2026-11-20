"""Read-only art/play showcase server, including byte ranges for iPad audio.
python3 tools/serve_art_lab.py [--host 0.0.0.0] [--port 8093] [--audio-dir /path/to/word/audio]
No state API, no profile files written. Default word audio path: cards/audio/.
"""
import argparse,os,re
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote,urlsplit
ROOT=Path(__file__).resolve().parents[1]
class H(SimpleHTTPRequestHandler):
    audio_dir=ROOT/'cards/audio'
    def translate_path(self,path):
        route=unquote(urlsplit(path).path)
        if route.startswith('/voice/'):
            p=(self.audio_dir/route.removeprefix('/voice/')).resolve()
            return str(p) if p.is_relative_to(self.audio_dir.resolve()) else str(self.audio_dir/'__blocked__')
        return super().translate_path(path)
    def do_GET(self):
        if urlsplit(self.path).path=='/':
            self.send_response(302);self.send_header('Location','/showcase/post-office/');self.end_headers();return
        super().do_GET()
    def do_PUT(self):self.send_error(405)
    def do_POST(self):self.send_error(405)
    def send_head(self):
        self.left=None
        path=self.translate_path(self.path);rng=self.headers.get('Range')
        if not rng or not os.path.isfile(path):return super().send_head()
        m=re.fullmatch(r'bytes=(\d*)-(\d*)',rng.strip())
        if not m or not any(m.groups()):return super().send_head()
        a,b=m.groups();size=os.path.getsize(path)
        start=max(0,size-int(b)) if not a else int(a);end=size-1 if not a or not b else min(size-1,int(b))
        if start>end or start>=size:self.send_error(416);return None
        f=open(path,'rb');f.seek(start);self.left=end-start+1
        self.send_response(206);self.send_header('Content-Type',self.guess_type(path));self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(self.left));self.end_headers();return f
    def copyfile(self,src,out):
        left=getattr(self,'left',None)
        if left is None:return super().copyfile(src,out)
        self.left=None
        while left:
            buf=src.read(min(65536,left))
            if not buf:break
            out.write(buf);left-=len(buf)
    def end_headers(self):self.send_header('Accept-Ranges','bytes');self.send_header('Cache-Control','no-store');super().end_headers()
    def log_message(self,*args):pass
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--host',default='127.0.0.1');p.add_argument('--port',type=int,default=8093);p.add_argument('--audio-dir',type=Path,default=ROOT/'cards/audio');a=p.parse_args();H.audio_dir=a.audio_dir.resolve();os.chdir(ROOT)
    print(f'Art/play showcase: http://{a.host}:{a.port}/showcase/post-office/  Word audio: {H.audio_dir}',flush=True)
    ThreadingHTTPServer((a.host,a.port),H).serve_forever()
