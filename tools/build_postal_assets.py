"""Build original pixel SVG sprites and short synthesized audio; no third-party images.
Run: python3 -I tools/build_postal_assets.py
Requires ffmpeg for the two browser-ready AAC music loops. SVG, WAV and MIDI use stdlib.
"""
from pathlib import Path
import array, json, math, struct, subprocess, tempfile, wave
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/post-office/v1';OUT.mkdir(parents=True,exist_ok=True);(OUT/'audio').mkdir(exist_ok=True)
C={'ink':'#233F3A','teal':'#387D74','light':'#77B4A0','cream':'#FFF0CA','coral':'#CC6651','gold':'#EAB65C','skin':'#E8B78B','brown':'#98664B','water':'#7BC4D0'}
def rect(x,y,w,h,c):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{C.get(c,c)}"/>'
def path(d,c):return f'<path d="{d}" fill="{C.get(c,c)}"/>'
def pixel(points):return ''.join(rect(*v) for v in points)
symbols={}
def add(id,size,s,role):symbols[id]={'size':size,'body':s,'role':role}
def hero(frame,cap='teal'):
 dy=-1 if frame in ('walk1','happy') else 0
 s=rect(10,40,25,3,'#D8D7BA')
 feet=[(12,35,7,5),(25,35,7,5)] if frame!='walk2' else [(10,34,7,5),(27,36,7,5)]
 for x,y,w,h in feet:s+=rect(x,y,w,h,'ink')
 s+=pixel([(14,29,6,8,'teal'),(24,29,6,8,'teal'),(10,20+dy,24,13,'ink'),(12,21+dy,20,10,'cream'),(13,22+dy,5,9,cap),(27,22+dy,4,9,cap)])
 s+=pixel([(11,9+dy,22,14,'ink'),(13,10+dy,18,12,'skin'),(16,14+dy,2,3,'ink'),(26,14+dy,2,3,'ink'),(20,19+dy,5,1,'brown'),(12,3+dy,20,7,'ink'),(14,4+dy,16,6,cap),(9,9+dy,27,3,'ink'),(10,9+dy,25,2,cap),(19,5+dy,8,4,'cream'),(20,6+dy,6,1,'gold')])
 for i in range(5):s+=rect(14+i*3,22+i,3,2,'brown')
 s+=pixel([(28,26,10,10,'ink'),(29,27,8,8,'brown'),(29,27,8,3,'gold'),(32,30,2,2,'cream')])
 if frame=='wave':s+=pixel([(7,18,5,7,'ink'),(6,14,5,5,'skin'),(8,12,2,4,'skin')])
 elif frame=='happy':s+=pixel([(6,18,5,5,'skin'),(34,17,5,5,'skin'),(7,15,3,4,'skin'),(35,14,3,4,'skin')])+rect(16,14+dy,3,1,'ink')+rect(25,14+dy,3,1,'ink')
 else:s+=pixel([(8,24+dy,4,8,'ink'),(8,25+dy,3,6,'skin')])
 return s
for variant,cap in [('teal','teal'),('gold','gold')]:
 for frame in ('idle','walk1','walk2','happy','wave'):add(f'courier-{variant}-{frame}',48,hero(frame,cap),'character')
add('tree',64,path('M28 2H40V8H48V15H55V29H60V40H48V45H18V40H5V28H10V15H19V7H28Z','ink')+path('M28 6H38V12H47V20H52V31H56V37H44V41H20V37H9V29H14V18H23V10H28Z','teal')+pixel([(20,12,8,5,'light'),(14,24,9,5,'light'),(31,8,7,4,'light'),(39,25,11,5,'#4A9983'),(26,42,12,19,'ink'),(29,44,7,15,'brown'),(34,46,2,9,'gold')]),'scenery')
add('bush',48,path('M5 24H10V16H18V12H31V16H38V23H43V37H5Z','ink')+pixel([(8,25,32,9,'teal'),(12,19,23,14,'teal'),(19,15,10,12,'teal'),(12,21,6,4,'light'),(26,18,6,4,'light'),(32,28,5,3,'gold')]),'scenery')
add('flowers',48,pixel([(11,20,3,18,'teal'),(30,25,3,13,'teal'),(5,12,16,9,'coral'),(9,8,8,17,'coral'),(11,13,4,5,'gold'),(25,19,14,8,'cream'),(29,15,6,16,'cream'),(29,20,6,5,'gold'),(5,31,8,3,'teal'),(32,31,8,3,'teal')]),'scenery')
add('rock',48,path('M10 22H16V14H31V19H37V25H42V36H7V29H10Z','ink')+path('M12 24H18V17H29V22H35V28H39V33H10V29H12Z','#A7B7AC')+pixel([(18,21,10,4,'#D8E0D1'),(12,30,9,3,'#7C9487'),(31,28,6,5,'#7C9487')]),'scenery')
add('reeds',48,pixel([(9,18,3,24,'teal'),(21,10,3,32,'teal'),(34,17,3,25,'teal'),(8,9,5,14,'brown'),(20,3,5,14,'brown'),(33,10,5,13,'brown'),(13,28,3,10,'light'),(29,27,3,12,'light')]),'scenery')
add('lily',48,path('M12 15H35V20H41V32H34V38H12V33H6V22H12Z','teal')+path('M14 18H33V23H38V29H32V35H13V30H9V23H14Z','light')+pixel([(20,12,11,15,'cream'),(16,17,19,7,'cream'),(23,16,5,6,'gold')]),'scenery')
add('bridge',64,pixel([(0,17,64,30,'ink'),(3,20,58,24,'brown'),(0,13,64,5,'cream'),(0,47,64,5,'cream'),(4,10,4,46,'ink'),(56,10,4,46,'ink')])+''.join(rect(x,21,3,21,'gold') for x in range(9,56,9)),'terrain')
add('grass-tile',64,rect(0,0,64,64,'#86B682')+pixel([(5,12,3,2,'#AED099'),(7,9,2,4,'#AED099'),(30,34,3,2,'#AED099'),(32,30,2,5,'#AED099'),(51,53,4,2,'#5C976E'),(53,49,2,5,'#5C976E')]),'terrain')
add('water-tile',64,rect(0,0,64,64,'water')+pixel([(5,15,13,2,'#BDE4DD'),(20,17,6,2,'#BDE4DD'),(35,41,16,2,'#BDE4DD'),(50,39,7,2,'#BDE4DD')]),'terrain')
add('path-tile',64,rect(0,0,64,64,'#DEC995')+pixel([(5,13,4,3,'#BEAA79'),(28,45,3,3,'#BEAA79'),(49,24,6,3,'#F3E0B0'),(20,20,4,2,'#F3E0B0')]),'terrain')
def building(kind):
 s=pixel([(7,29,50,30,'ink'),(10,30,44,26,'cream'),(12,36,10,10,'teal'),(42,36,10,10,'teal'),(26,35,13,24,'ink'),(28,38,9,19,'brown'),(34,45,2,2,'gold'),(4,57,56,5,'brown')])
 if kind=='post-office':s+=path('M5 28V23H11V18H18V12H26V8H38V12H46V18H53V23H59V29Z','ink')+path('M9 25V23H16V18H23V13H41V18H48V23H55V25Z','coral')+pixel([(25,23,15,9,'cream'),(27,25,11,5,'teal'),(28,26,9,1,'cream'),(30,27,5,1,'cream'),(14,4,3,12,'ink'),(17,4,11,6,'gold')])
 elif kind=='playhouse':s=path('M8 29H56V58H8Z','ink')+rect(11,30,42,25,'cream')+path('M3 29L14 18H20V12H28V6H36V12H44V18H50L61 29Z','ink')+path('M8 26L19 16H24V11H31L31 26Z','coral')+path('M32 11H35V15H40V19H46L56 26H32Z','gold')+pixel([(20,30,6,25,'coral'),(38,30,6,25,'coral'),(27,39,10,19,'teal'),(8,56,48,5,'brown'),(30,1,3,7,'ink'),(33,1,12,5,'coral')])
 elif kind=='gate':s=path('M5 17H20V26H44V17H59V59H5Z','ink')+pixel([(8,20,9,36,'cream'),(47,20,9,36,'cream'),(17,29,30,8,'cream'),(21,36,22,5,'cream'),(27,41,10,17,'teal'),(7,10,12,8,'teal'),(46,10,12,8,'teal'),(2,57,60,5,'brown'),(27,10,10,19,'coral'),(22,15,20,9,'coral'),(29,16,6,6,'gold')])
 return s
for name in ['post-office','playhouse','gate']:add(name,64,building(name),'landmark')
add('mailbox',48,pixel([(12,13,25,21,'ink'),(15,16,19,15,'coral'),(18,11,13,5,'coral'),(16,23,16,3,'ink'),(19,34,11,10,'ink'),(20,34,8,8,'brown'),(28,10,3,11,'gold'),(31,10,8,5,'gold')]),'landmark')
add('sign',48,pixel([(20,20,7,26,'ink'),(22,20,3,24,'brown'),(5,7,32,18,'ink'),(8,10,26,12,'cream'),(15,14,15,3,'teal'),(27,11,3,9,'teal')]),'landmark')
add('leaf-boss',48,path('M13 13H23V8H33V14H39V22H43V34H36V40H13V35H7V24H13Z','ink')+path('M15 16H25V11H30V18H36V24H40V31H33V37H15V31H10V25H15Z','light')+pixel([(17,24,3,4,'ink'),(30,24,3,4,'ink'),(22,31,7,2,'teal'),(19,3,3,13,'teal'),(22,2,8,6,'teal')]),'boss')
add('cloud-boss',48,path('M4 24H10V17H18V12H30V17H38V24H44V36H36V41H11V36H4Z','ink')+path('M7 26H13V19H20V15H28V20H35V26H41V33H34V38H13V33H7Z','cream')+pixel([(16,25,3,4,'ink'),(30,25,3,4,'ink'),(22,32,6,2,'coral'),(9,20,5,5,'#DBE4D6')]),'boss')
add('snail-boss',48,path('M4 30H12V20H19V13H31V18H37V34H43V41H4Z','ink')+pixel([(7,32,33,6,'light'),(13,22,21,13,'gold'),(19,16,10,18,'coral'),(19,24,11,4,'cream'),(20,20,4,7,'cream'),(8,24,3,9,'teal'),(6,23,3,3,'ink'),(11,25,3,3,'ink')]),'boss')
add('bat-friend',48,path('M1 15H9V20H17V13H31V20H39V15H47V33H37V38H29V42H19V38H11V33H1Z','ink')+pixel([(4,19,5,10,'#927BAB'),(9,23,10,10,'#927BAB'),(29,23,10,10,'#927BAB'),(39,19,5,10,'#927BAB'),(19,17,10,20,'#B4A0C8'),(19,13,3,7,'#B4A0C8'),(26,13,3,7,'#B4A0C8'),(20,24,2,3,'ink'),(26,24,2,3,'ink')]),'boss')
add('envelope',32,pixel([(3,7,26,19,'ink'),(5,9,22,15,'cream'),(5,10,5,2,'teal'),(10,12,5,2,'teal'),(15,14,3,2,'teal'),(18,12,5,2,'teal'),(23,10,4,2,'teal')]),'ui')
add('star',32,path('M13 2H19V9H26V14H31V20H23V28H17V23H12V28H5V20H1V14H7V9H13Z','ink')+path('M14 6H18V12H25V15H27V18H21V24H18V20H12V24H9V18H5V15H11V12H14Z','gold'),'ui')
add('key',32,pixel([(3,5,13,13,'ink'),(6,8,7,7,'gold'),(15,14,4,5,'ink'),(18,18,9,4,'ink'),(23,19,5,9,'ink'),(15,15,4,3,'gold'),(18,19,8,2,'gold'),(24,21,2,5,'gold')]),'ui')
add('stamp',32,rect(2,2,28,28,'ink')+rect(4,4,24,24,'cream')+rect(7,7,18,18,'teal')+pixel([(10,14,12,4,'gold'),(14,10,4,12,'gold')]),'ui')
add('sound',32,pixel([(4,12,6,9,'ink'),(10,9,4,15,'ink'),(14,6,4,21,'ink'),(21,10,3,4,'teal'),(24,14,3,8,'teal'),(21,22,3,4,'teal')]),'ui')
add('footstep',32,pixel([(7,3,7,10,'brown'),(6,14,9,8,'ink'),(21,12,6,9,'brown'),(20,22,8,7,'ink')]),'ui')
add('flag',32,pixel([(7,2,3,27,'ink'),(10,3,17,12,'coral'),(10,15,7,3,'coral'),(4,27,11,3,'brown')]),'ui')
add('flower-badge',32,pixel([(12,4,8,24,'coral'),(4,12,24,8,'coral'),(11,11,10,10,'gold'),(14,14,4,4,'cream')]),'ui')
svg='<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><defs>'+''.join(f'<symbol id="{id}" viewBox="0 0 {a["size"]} {a["size"]}">{a["body"]}</symbol>' for id,a in symbols.items())+'</defs></svg>'
(OUT/'sprites.svg').write_text(svg)
# Entirely original short chip melodies; MIDI is the editable source.
MELODIES={'meadow':([72,76,79,76,74,72,69,67, 69,72,74,76,74,71,67,0, 72,76,79,81,79,76,74,72, 69,72,71,67,69,71,72,0],108),'play':([76,79,84,79,81,79,76,72, 74,77,81,77,79,77,74,71, 72,76,79,76,81,79,76,74, 72,74,76,79,76,74,72,0],116)}
RATE=16000

def vlq(n):
 b=[n&127];n>>=7
 while n:b.insert(0,(n&127)|128);n>>=7
 return bytes(b)
def midi(notes,bpm):
 events=b'\x00\xff\x51\x03'+int(60_000_000/bpm).to_bytes(3,'big')+b'\x00\xc0\x0a'
 for note in notes:
  if note:events+=b'\x00\x90'+bytes([note,72])+vlq(420)+b'\x80'+bytes([note,0])+vlq(60)+b'\xff\x01\x00'
  else:events+=vlq(480)+b'\xff\x01\x00'
 events+=b'\x00\xff\x2f\x00';return b'MThd'+struct.pack('>IHHH',6,0,1,480)+b'MTrk'+struct.pack('>I',len(events))+events

def tone(f,t,d):
 if not f or t>=d:return 0
 envelope=min(1,t/.015)*min(1,(d-t)/.08)*math.exp(-2*t/d)
 return envelope*(.75*math.sin(2*math.pi*f*t)+.16*math.sin(4*math.pi*f*t)+.09*math.sin(6*math.pi*f*t))
def write_wav(p,samples):
 a=array.array('h',(max(-32767,min(32767,round(v*32767))) for v in samples))
 with wave.open(str(p),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(a.tobytes())
for name,(notes,bpm) in MELODIES.items():
 (OUT/'audio'/f'{name}.mid').write_bytes(midi(notes,bpm));beat=60/bpm;duration=len(notes)*beat
 samples=[]
 for i in range(int(duration*RATE)):
  t=i/RATE;beatno=min(len(notes)-1,int(t/beat));nt=t-beatno*beat;note=notes[beatno];f=440*2**((note-69)/12) if note else 0
  bass=[48,45,53,55][(beatno//8)%4];bt=t%(2*beat)
  samples.append(.15*tone(f,nt,.9*beat)+.07*tone(440*2**((bass-69)/12),bt,1.8*beat))
 with tempfile.TemporaryDirectory() as tmp:
  wav=Path(tmp)/'music.wav';write_wav(wav,samples);subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','aac','-b:a','32k','-movflags','+faststart',str(OUT/'audio'/f'{name}.m4a')],check=True)
SFX={'tap':[(520,.06)],'step':[(170,.035),(210,.035)],'flip':[(420,.07),(590,.06)],'correct':[(660,.09),(880,.12)],'retry':[(330,.1),(392,.1)],'stamp':[(660,.09),(784,.09),(988,.18)],'gate':[(523,.12),(659,.12),(784,.12),(1047,.25)],'mail':[(784,.06),(1047,.13)]}
for name,notes in SFX.items():
 samples=[]
 for f,d in notes:samples.extend(.14*tone(f,i/RATE,d) for i in range(int(RATE*d)))
 write_wav(OUT/'audio'/f'{name}.wav',samples)
manifest={'version':'postal-v1','license':'Original project artwork and synthesized music; font uses its separate OFL license.','viewBoxUnits':'integer pixel grid','symbols':{id:{k:v for k,v in a.items() if k!='body'} for id,a in symbols.items()},'animations':{v:{'idle':[f'courier-{v}-idle'],'walk':[f'courier-{v}-walk1',f'courier-{v}-walk2'],'happy':[f'courier-{v}-happy'],'wave':[f'courier-{v}-wave']} for v in ('teal','gold')},'music':{name:{'src':f'audio/{name}.m4a','midi':f'audio/{name}.mid','bpm':v[1],'loop':True} for name,v in MELODIES.items()},'sfx':{name:f'audio/{name}.wav' for name in SFX}}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(OUT/'README.md').write_text('# 우편 여행 공통 에셋 v1\n\n원본: `tools/build_postal_assets.py`. SVG symbol 모음은 정수 좌표·단색 도형으로 제작했다. PNG 자동 절삭이나 타사 게임 이미지를 사용하지 않는다. `<svg><use href="sprites.svg#tree"/></svg>`처럼 symbol을 참조한다. 실제 연결 예시는 `showcase/post-office/`다.\n\n캐릭터는 48, 건물·지형은 64, UI는 32 논리 픽셀이다. 확대는 정수 배율을 우선하고 SVG shape-rendering=crispEdges를 유지한다. 캐릭터 teal/gold는 외모나 성별 대신 가방·모자 색 구분이다.\n\n음악은 두 개의 짧은 원작 AAC 루프와 동일 멜로디의 MIDI 편집 원본이다. 음성 우선, 음악·효과음 개별 설정을 제공한다. MIDI 파일을 브라우저에서 직접 재생하지 않는다. 게임 효과음은 8종 WAV다. 사람 녹음이나 단어 음성이 아니다. 합성 단어 음원 검수 완료로 표시하지 않는다.\n\n이 폴더의 그래픽·짧은 작곡은 이 프로젝트를 위해 새로 작성했다. Galmuri 폰트는 `cards/fonts/OFL-Galmuri.txt`의 별도 라이선스를 보존한다.\n')
print(f'Built {len(symbols)} SVG symbols, 2 MIDI/AAC loops, {len(SFX)} WAV effects')
