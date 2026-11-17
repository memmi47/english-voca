"""Original General MIDI scores for C-010. Legacy chip assets are immutable fallbacks.
Run with --render-dir DIR to also write three-cycle temporary rendering MIDI.
"""
from pathlib import Path
import argparse, hashlib, json, re, struct
ROOT = Path(__file__).resolve().parent.parent
MID = ROOT / 'assets/post-office/v3/midi'
OUT = ROOT / 'cards/assets/postal/music-gm'
WORLD = {'meadow': ['G4:.5 C5:1 E5:.5 D5:1 G4:1', 'A4:1 C5:.5 F5:.5 E5:1 C5:1', 'E5:1.5 C5:.5 A4:1 B4:1', 'D5:.5 B4:.5 G4:1 A4:1 R:1', 'B4:1 E5:1 G5:.5 E5:.5 D5:1', 'C5:.5 A4:.5 C5:1 F5:1 E5:1', 'F5:1 E5:.5 D5:.5 A4:1 C5:1', 'B4:1 D5:.5 G5:.5 D5:1 R:1', 'C5:1 E5:.5 A5:.5 G5:1 E5:1', 'G5:.5 B4:.5 E5:1 D5:1 B4:1', 'A4:1 C5:1 F5:1 G5:.5 A5:.5', 'G5:1 E5:1 D5:.5 C5:.5 G4:1', 'A4:.5 D5:.5 F5:1 E5:1 D5:1', 'E5:1 C5:1 A4:.5 C5:.5 E5:1', 'F5:1 C5:.5 A4:.5 C5:1 D5:1', 'D5:1 B4:.5 A4:.5 G4:1 R:1', 'B4:1 D5:.5 G4:.5 A4:1 R:1'], 'sea': ['D5:1 B4:.5 A4:.5 G4:1 D5:1', 'E5:1.5 G5:.5 E5:1 C5:1', 'B4:.5 E5:1 G5:.5 F#5:1 E5:1', 'F#5:1 D5:1 A4:.5 D5:.5 R:1', 'C5:1 E5:.5 A5:.5 G5:1 E5:1', 'G5:1 E5:1 D5:.5 C5:.5 E5:1', 'D5:.5 B4:.5 G4:1 B4:1 D5:1', 'A4:1 D5:1 F#5:1 R:1', 'E5:.5 B4:.5 E5:1 G5:1 B5:1', 'G5:1.5 E5:.5 C5:1 D5:1', 'E5:1 A4:1 C5:.5 E5:.5 G5:1', 'F#5:1 E5:.5 D5:.5 A4:1 R:1', 'B4:1 D5:1 G5:.5 A5:.5 B5:1', 'G5:.5 E5:.5 B4:1 E5:1 F#5:1', 'E5:1 C5:1 G4:.5 C5:.5 E5:1', 'F#5:1 A5:.5 F#5:.5 D5:1 R:1', 'F#5:1 E5:.5 D5:.5 A4:1 R:1'], 'sky': ['A4:1 D5:2 F#5:1', 'G5:1 D5:1 B4:1 R:1', 'F#5:1.5 D5:.5 B4:2', 'E5:1 C#5:1 A4:1 R:1', 'B4:1 E5:2 G5:1', 'D5:1 B4:1 G4:1 A4:1', 'F#5:1 E5:1 D5:1 A4:1', 'C#5:2 E5:1 R:1', 'D5:1 F#5:1 B5:2', 'G5:1 E5:2 B4:1', 'B4:1 D5:1 G5:1 A5:1', 'E5:2 C#5:1 R:1', 'F#5:1 A5:1 D6:1 A5:1', 'F#5:1 D5:1 B4:2', 'E5:1 G5:1 F#5:1 E5:1', 'C#5:1 E5:1 A4:1 R:1', 'C#5:1 E5:1 A4:1 R:1']}
SCREEN = {'study': ['C4:2 E4:1 R:1', 'E4:1 C4:2 R:1', 'A3:2 C4:1 R:1', 'B3:1 D4:1 G3:1 R:1'], 'castle': ['A4:.5 D5:.5 F5:1 E5:1 D5:1', 'F5:1 D5:.5 Bb4:.5 C5:1 D5:1', 'D5:.5 G5:.5 Bb5:1 A5:1 G5:1', 'E5:1 C#5:1 A4:1 R:1'], 'continent-castle': ['D4:1 A4:.5 F4:.5 D5:2', 'Bb4:1 G4:1 D5:1 G4:1', 'F4:1 Bb4:1 D5:1 F5:1', 'E5:1 C#5:1 A4:1 R:1'], 'play': ['C5:.5 F5:.5 A5:.5 G5:.5 F5:1 C5:1', 'F5:.5 D5:.5 A4:1 D5:.5 F5:.5 A5:1', 'D5:1 F5:.5 Bb5:.5 A5:.5 F5:.5 D5:1', 'E5:.5 G5:.5 C6:1 G5:1 R:1'], 'storm': ['E5:.5 A4:.5 C5:.5 E5:.5 D5:.5 C5:.5 A4:1', 'F5:.5 D5:.5 A4:.5 D5:.5 E5:1 F5:1', 'C5:.5 F5:.5 A5:.5 G5:.5 F5:.5 E5:.5 C5:1', 'B4:.5 E5:.5 G#5:1 E5:1 R:1']}
CHORDS = {'meadow': 'C F Am G Em F Dm G Am Em F C Dm Am F G', 'sea':'G C Em D Am C G D Em C Am D G Em C D', 'sky':'D G Bm A Em G D A Bm Em G A D Bm Em A', 'study':'C Am F G', 'castle':'Dm Bb Gm A', 'continent-castle':'Dm Gm Bb A', 'play':'F Dm Bb C', 'storm':'Am Dm F E'}
PROGRAMS = {'meadow':[12,24,32,45,73], 'sea':[114,11,33,48,24], 'sky':[8,10,32,89,52], 'study':[4,24,32,45], 'castle':[71,45,42,60], 'continent-castle':[60,48,43,61,47], 'play':[13,0,33,7], 'storm':[73,12,34,45]}
BPM = dict(zip(PROGRAMS,[108,96,88,76,112,104,132,124]))
TITLES = dict(zip(PROGRAMS,['풀잎 우편길','물결 사이 편지','별가루 보관함','책상 위 작은 길','돌문 앞의 약속','큰 문을 여는 날','주머니 속 놀이','빙글 도는 배달길']))
JINGLES = {'clear':(144,[12,24,32,45],'C','G4:.5 C5:.5 D5:.5 E5:.5 C5:1'), 'victory':(120,[60,48,43,61],'D','A4:.5 D5:1 F#5:.5 E5:.5 A5:.5 F#5:1 D5:2'), 'key':(144,[8,10,32,11],'G','B4:.25 D5:.25 A5:.5 G5:1'), 'item':(152,[11,12,33,24],'F','C5:.25 A4:.25 D5:.5 F5:1'), 'grade':(150,[73,45,32,12],'C','G4:.25 D5:.25 E5:.5 C5:1'), 'bat':(116,[71,45,42,12],'Dm','A4:.5 F4:.5 E4:.25 F4:.25 D4:1'), 'storm-caught':(132,[73,12,34,45],'Am','E5:.25 A5:.25 G5:.25 E5:.25 C5:.5 B4:.5 A4:1')}
def pitch(s):
 m=re.fullmatch(r'([A-G])([#b]?)(-?\d)',s); return (int(m[3])+1)*12+{'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[m[1]]+{'':0,'#':1,'b':-1}[m[2]]
def parse(s):
 t=0; out=[]
 for token in s.split():
  n,d=token.split(':'); d=float(d)
  if n!='R': out.append((t,d,pitch(n)))
  t+=d
 return out,t
def triad(s,octave):
 r=pitch(s.rstrip('m')+str(octave)); return [r,r+(3 if s.endswith('m') else 4),r+7]
def add(track,t,d,n,v=64,hold=.85): track.append((t,d*hold,n,v))
def compose(scene,j=0):
 isworld=scene in WORLD; programs=PROGRAMS[scene][:]; transpose=[0,1,-1,2,-2][j%5] if isworld else 0
 if isworld: programs[0]={'meadow':[12,73,24,45],'sea':[114,11,73,24],'sky':[8,10,11,73]}[scene][j%4]
 tempo=round(60000000/(BPM[scene]*([1,.96,1.04,.98,1.02][j%5] if isworld else 1)))
 drum=scene not in ('sky','study') and (not isworld or j%3!=1)
 bars=32 if isworld else 16; tracks=[[] for _ in programs]; channels=list(range(len(programs)))
 if drum: tracks.append([]);channels.append(9)
 melody=[]
 for b in range(bars):
  if isworld: line=WORLD[scene][16] if b==31 else WORLD[scene][b%16]
  else: line=SCREEN[scene][b%4]
  notes,total=parse(line); assert total==4,(scene,b,line)
  if not isworld and b//4 in (1,3) and len(notes)>=2:
   a=list(notes[0]); z=list(notes[1]);a[2],z[2]=z[2],a[2];notes[0],notes[1]=tuple(a),tuple(z)
  if not isworld and b==15: notes=[(t,min(d,3-t),n) for t,d,n in notes if t<3]
  melody.append(notes)
  for t,d,n in notes: add(tracks[0],b*4+t,d,n,70-(6 if 16<=b<24 else 0))
  chord=CHORDS[scene].split()[b%len(CHORDS[scene].split())]; a,c,f=triad(chord,3 if scene=='sky' else 4); r,_,fbase=triad(chord,2)
  while r<36:r+=12;fbase+=12
  p=(j%2)^(1 if isworld and 16<=b<24 else (b//4)%2 if not isworld else 0)
  if p==0:
   for k,n in enumerate([a,c,f,c]):
    if scene not in ('sky','study') or k%2==0:add(tracks[1],b*4+k,.7,n,48)
   add(tracks[2],b*4,1.7,r,62);add(tracks[2],b*4+2,1.7,fbase,60)
  else:
   for k in (0,2):
    for n in (a,c,f):add(tracks[1],b*4+k,1.4,n,44)
   for k in (1.5,3.5):add(tracks[1],b*4+k,.35,f,46)
   for t,d,n in [(0,1.2,r),(1.5,.35,fbase),(2.5,1,r)]:add(tracks[2],b*4+t,d,n,62)
  if scene!='study' or b%4==3:
   ns=[c,f]; ns=[n-12 for n in ns] if 28<=b<30 else ns
   for n in ns:
    for t in ([0,2] if programs[3]==45 else [0]):add(tracks[3],b*4+t,.4 if programs[3]==45 else 3.6,n,42,.85 if programs[3]==45 else .95)
  if len(programs)>4:
   if scene=='continent-castle':
    for t in (0,2):add(tracks[4],b*4+t,.7,r+12,62)
   elif b in (3,7,11,15,17,19,21):
    tail=notes[-2:]
    for k,(_,_,n) in enumerate(tail):add(tracks[4],b*4+2+k,1,n-12,45,1 if scene=='sky' and k==0 else .95 if scene=='sky' else .85)
  if drum:
   for t,n,v in [(0,36,50),(2,36,46),(1,37,44),(3,37,44)]:add(tracks[-1],b*4+t,.08*1000000/tempo,n,v,1)
   hats=[.5,2.5] if scene=='meadow' else [.5,1.5,2.5,3.5]
   if scene in ('play','storm'):hats=[k*.5 for k in range(8)]
   for t in hats:add(tracks[-1],b*4+t,.08*1000000/tempo,42,38,1)
   if scene=='sea' and b%4==3:add(tracks[-1],b*4+3.5,.08*1000000/tempo,54,42,1)
 for i,tr in enumerate(tracks):
  if channels[i]!=9:
   tracks[i]=[(t,d,n+transpose,v) for t,d,n,v in tr]
   if i==0:
    delta=0
    while min(n+delta for _,_,n,_ in tracks[i])<55:delta+=12
    while max(n+delta for _,_,n,_ in tracks[i])>88:delta-=12
    tracks[i]=[(t,d,n+delta,v) for t,d,n,v in tracks[i]]
 return {'scene':scene,'kind':'loop','bars':bars,'beatsPerBar':4,'tempoUs':tempo,'bpm':60000000/tempo,'transpose':transpose,'leadProgram':programs[0],'accompaniment':'P'+str(j%2),'drums':drum,'programs':programs,'channels':[x+1 for x in channels],'title':TITLES[scene]},tracks,channels

def vlq(n):
 out=[n&127];n>>=7
 while n:out.insert(0,(n&127)|128);n>>=7
 return bytes(out)
def chunk(events,end):
 data=b'';last=0
 for t,order,msg in sorted(events,key=lambda x:(x[0],x[1])):data+=vlq(t-last)+msg;last=t
 data+=vlq(max(0,end-last))+b'\xff\x2f\x00';return b'MTrk'+struct.pack('>I',len(data))+data

def write_midi(path,meta,tracks,channels,cycles=1):
 beats=meta['bars']*4; end=round((beats*cycles+4)*480)
 chunks=[chunk([(0,0,b'\xff\x51\x03'+meta['tempoUs'].to_bytes(3,'big'))],end)]
 for i,(notes,ch) in enumerate(zip(tracks,channels)):
  pg=0 if ch==9 else meta['programs'][i]
  events=[(0,0,bytes([0xb0|ch,cc,val])) for cc,val in [(0,0),(32,0),(7,100),(10,64 if i==2 or ch==9 else 48 if i==1 else 80 if i==3 else 64),(11,100)]]+[(0,0,bytes([0xc0|ch,pg]))]
  for cycle in range(cycles):
   for t,d,n,v in notes:
    tick=round((cycle*beats+t)*480);off=round((cycle*beats+min(t+d,beats))*480)
    events.extend([(tick,2,bytes([0x90|ch,n,v])),(off,1,bytes([0x80|ch,n,0]))])
  chunks.append(chunk(events,end))
 path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(chunks),480)+b''.join(chunks))
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--render-dir',type=Path);args=parser.parse_args();MID.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
 if args.render_dir:args.render_dir.mkdir(parents=True,exist_ok=True)
 entries={};scores={}
 for scene,count in [('meadow',8),('sea',15),('sky',7)]:
  base=compose(scene)
  if not args.render_dir:write_midi(MID/(scene+'.mid'),*base)
  for j in range(count):scores[f'p{["meadow","sea","sky"].index(scene)+1}-{j+1:02d}']=compose(scene,j)
 for scene in SCREEN:scores[scene]=compose(scene)
 for id,(bpm,programs,chord,line) in JINGLES.items():
  lead,beats=parse(line);parts=[[],[],[],[]];a,c,f=triad(chord,4);r=triad(chord,3)[0];last=lead[-1]
  for t,d,n in lead:add(parts[0],t,d,n,74)
  for n in [c,f]:add(parts[1],0,.3,n,50);add(parts[1],last[0],last[1],n,50)
  add(parts[2],0,.5,r,62);add(parts[2],max(0,beats-1),min(1,beats),r,62);add(parts[3],last[0],last[1],a+12,44)
  scores[id]=({'scene':id,'kind':'jingle','bars':beats/4,'beatsPerBar':4,'tempoUs':round(60000000/bpm),'bpm':bpm,'programs':programs,'channels':[1,2,3,4]},parts,[0,1,2,3])
 for id,(meta,tracks,channels) in scores.items():
  if not args.render_dir:write_midi(MID/(id+'.mid'),meta,tracks,channels)
  if args.render_dir:write_midi(args.render_dir/(id+'.mid'),meta,tracks,channels,3 if meta['kind']=='loop' else 1)
  entry={**meta,'file':id+'.m4a','gain':1,'sampleRate':44100,'loopSamples':round(meta['bars']*4*meta['tempoUs']*44100/1000000),'preRollSamples':round(4*meta['tempoUs']*44100/1000000) if meta['kind']=='loop' else 0, 'sourceMidiSha256':hashlib.sha256((MID/(id+'.mid')).read_bytes()).hexdigest()}
  entry['tailSamples']=round(4*meta['tempoUs']*44100/1000000)
  entries[id]=entry
 aliases={'meadow':'p1-01','sea':'p2-01','sky':'p3-01','d1-01':'p1-01','d1-02':'p1-02','d2-01':'p2-01'}
 manifest={'schemaVersion':1,'sampleRate':44100,'soundfont':{'name':'GeneralUser GS','version':'2.0.3','sha256':'9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe','source':'https://www.schristiancollins.com/generaluser','license':'GeneralUser GS License v2.0'},'aliases':aliases,'tracks':entries}
 # Preserve measured recording metadata on a deterministic score rebuild.
 target=OUT/'manifest.json'
 if target.exists():
  old=json.loads(target.read_text())
  for id,entry in entries.items():
   prev=old.get('tracks',{}).get(id,{})
   if prev.get('sourceMidiSha256')==entry['sourceMidiSha256']:
    for k,v in prev.items():
     if k not in entry or k == 'tailSamples':entry[k]=v
  if old.get('rendering') and all(old.get('tracks',{}).get(id,{}).get('sourceMidiSha256')==entry['sourceMidiSha256'] for id,entry in entries.items()):manifest['rendering']=old['rendering']
 if not args.render_dir:target.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(entries)} original GM recordings, {len(entries)+3} MIDI sources')
if __name__=='__main__':main()
