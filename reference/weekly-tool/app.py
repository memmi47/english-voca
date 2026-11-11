from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from email.parser import BytesParser
from email.policy import default
from urllib.parse import urlsplit, parse_qs, urlencode, quote
from pathlib import Path
from datetime import date
import argparse, hashlib, hmac, html, json, re, secrets, sys
import core

HERE=Path(__file__).resolve().parent
NAMES={'son':'아들','daughter':'딸'}
STATE=HERE/'family_state.sqlite3'
MAX_BODY=90*1024*1024

def esc(x):
    return html.escape(str(x if x is not None else ''),quote=True)

def link(path,label,**params):
    return '<a href="'+esc(path+('?' + urlencode(params) if params else ''))+'">'+esc(label)+'</a>'

def page(title,body,navigation=True):
    nav=('<nav>'+' '.join(link(path,label) for path,label in [('/','새 책'),('/diagnostic','듣기 진단'),('/audio','음성 검수'),('/learn','카드 기록'),('/export','학습 기록 내보내기')])+'</nav>') if navigation else ''
    return f"""<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><style>
:root{{color-scheme:light;--ink:#193042;--line:#d5dfe4;--blue:#134e6e;--paper:#f4f8fa}}*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,sans-serif}}main{{max-width:960px;margin:auto;padding:24px 16px 48px}}h1{{font-size:1.8rem;margin:.4rem 0 1rem}}h2{{font-size:1.24rem}}nav,fieldset,.panel,article{{background:white;border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0}}nav a{{margin-right:16px}}a{{color:var(--blue)}}input,select,textarea,button{{font:inherit;max-width:100%}}label{{display:block;margin:8px 0}}input[type=text],input[type=password],select,textarea{{padding:7px;border:1px solid #9dabb5;border-radius:6px}}textarea{{width:100%;min-height:100px}}button,.primary{{padding:9px 15px;background:var(--blue);color:white;border:0;border-radius:8px;cursor:pointer}}button:disabled{{opacity:.4}}small,.muted{{color:#52616c}}table{{border-collapse:collapse;width:100%}}td,th{{padding:7px;text-align:left;border-bottom:1px solid var(--line)}}.options{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;max-width:570px}}.options button{{font-size:3.4rem;color:#10222f;background:#e6f1f4;min-height:105px}}.tag{{background:#e6f1f4;padding:2px 6px;border-radius:4px}}.warn{{color:#833419}}.bookcards{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}.bookcards article{{break-inside:avoid;margin:0}}.pic{{font-size:2rem}}@media(max-width:480px){{.bookcards{{grid-template-columns:1fr}}}}@media print{{body{{background:white;color:black}}main{{max-width:none;padding:0}}nav,.no-print{{display:none}}article{{border-color:#aaa}}@page{{size:A4;margin:12mm}}}}
</style><main>{nav}<h1>{esc(title)}</h1>{body}</main></html>"""

def selector(name='profile',selected='son'):
    return '<select name="'+name+'">'+''.join('<option value="'+k+'"'+(' selected' if k==selected else '')+'>'+v+'</option>' for k,v in NAMES.items())+'</select>'

def book_id(s):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,60}',s):
        raise ValueError('책 ID는 영문, 숫자, 밑줄 또는 하이픈으로 1~60자입니다.')
    return s

def require_profile(p):
    if p not in NAMES:raise ValueError('아이 프로필을 선택해 주세요.')
    return p

def get_card(c,i):
    item=core.CARDS.get(i)
    if item:return item
    r=c.execute('SELECT payload FROM custom WHERE id=?',(i,)).fetchone()
    return json.loads(r[0]) if r else None

def dashboard(c):
    books=''.join('<li>'+esc(r['title'])+' · '+link('/review','아들',book=r['id'],profile='son')+' · '+link('/review','딸',book=r['id'],profile='daughter')+'</li>' for r in c.execute('SELECT * FROM books ORDER BY first_seen DESC,rowid DESC'))
    return page('이번 주 학원 책',f"""<form method="post" action="/ingest" enctype="multipart/form-data"><fieldset>
<label>책 ID <input name="book" required placeholder="GS-01"></label><label>책 제목 <input name="title" required></label>
<label>표본 사진 <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple></label>
<p class="muted">첫 장 전체와 무작위 10쪽을 고릅니다. 표본 합계 15~20쪽을 권장합니다. 파일명은 001.jpg처럼 쪽 순서가 보이게 붙여 주세요.</p>
<label>또는 교정한 텍스트 <textarea name="text" placeholder="쪽 사이에 빈 줄과 ===를 넣으세요."></textarea></label>
<button>표본 분석</button></fieldset></form><h2>등록한 책</h2><ul>{books}</ul>""")

def fingerprint(rows):
    return hashlib.sha256(json.dumps(rows,ensure_ascii=False,sort_keys=True).encode()).hexdigest()

def review(c,book,profile):
    r=c.execute('SELECT title FROM books WHERE id=?',(book,)).fetchone()
    if not r:raise ValueError('책을 먼저 등록해 주세요.')
    rows=core.book_candidates(c,book,profile)
    shown=rows[:60]
    checklist=[]
    for i,row in enumerate(shown):
        opts=''.join(f'<option value="{j}">{esc(x.get("lemma"))} · {esc(x.get("single_meaning_ko") or "새 뜻 입력")} · {esc(x.get("kind"))}</option>' for j,x in enumerate(row['options']))
        unresolved=row['guessed'] or len(row['options'])>1 or not row['options'][0].get('single_meaning_ko') or row['options'][0].get('pronunciation_note')
        check=' checked' if i<12 and not unresolved else ''
        checklist.append(f"""<article><label><input type="checkbox" name="keep" value="{i}"{check}> <strong>{esc(row['form'])}</strong>
 <span class="tag">{esc(row['estimate'])} 예상</span> 표본 {row['count']}회 · 누적 {row['nbooks']}권</label>
 <small>{esc(row['page'])} · {esc(row['context'])}</small>
 <label>뜻·형태 <select name="sense{i}">{opts}</select></label>
 {f'<label>새 뜻 <input name="gloss{i}"></label>' if any(not x.get('single_meaning_ko') for x in row['options']) else ''}
 {'<small class="warn">문맥과 형태를 확인한 뒤 선택</small>' if unresolved else ''}</article>""")
    coverage=''.join(f"<tr><td>{esc(v['page'])}</td><td>{v['tokens']}</td><td>{v['known']}</td><td>{v['inferred']}</td><td>{v['unknown']}</td><td>{v['unresolved']}</td><td>{v['proper']}</td></tr>" for v in core.coverage(c,book,profile))
    return page(r[0]+' · '+NAMES[profile],f"""<p>{link('/review','아들 검수',book=book,profile='son')} · {link('/review','딸 검수',book=book,profile='daughter')} · {link('/booklet','저장한 주간 소책자',book=book,profile=profile)} · {link('/booklet','누적 T1 인쇄',profile=profile,monthly='1')} · {link('/ocr','OCR 텍스트 교정',book=book)}</p>
<details><summary>쪽별 관찰치</summary><p>등장 횟수를 셉니다. ‘추정 앎’과 ‘미확인’은 직접 확인한 앎과 구분합니다.</p><table><tr><th>쪽</th><th>토큰</th><th>확인 앎</th><th>추정 앎</th><th>모름</th><th>미확인</th><th>이름 추정</th></tr>{coverage}</table></details>
<form method="post" action="/approve"><input type="hidden" name="book" value="{esc(book)}"><input type="hidden" name="profile" value="{profile}"><input type="hidden" name="version" value="{fingerprint(shown)}">
<p>10~15개를 권장합니다. 아이가 이미 아는 항목은 체크를 해제하고, 뜻이 갈리는 항목은 책 문장을 보고 선택하세요.</p><button>선택 저장</button>{''.join(checklist)}<button>선택 저장</button></form>""")

def booklet(c,book,profile,monthly=False):
    states=core.known(c,profile); stats=core.corp(c); records=[]
    if monthly:
        for row in c.execute('SELECT p.* FROM pack p JOIN books b ON p.book=b.id WHERE p.profile=? ORDER BY b.first_seen DESC,b.rowid DESC',(profile,)):
            x=get_card(c,row['card'])
            if x and core.tier(x,'모름',stats,False)=='T1':records.append((x,row,'T1'))
    else:
        for row in c.execute('SELECT * FROM pack WHERE book=? AND profile=?',(book,profile)):
            x=get_card(c,row['card'])
            if x:records.append((x,row,core.tier(x,'모름',stats) or ('관찰 2권' if x['track']=='vocab' else '패턴')))
    found=set(); main=[]; short=[]; patterns=[]
    for x,row,t in sorted(records,key=lambda a:(a[2],a[0]['card_form'].lower())):
        if x['card_id'] in found:continue
        found.add(x['card_id'])
        word=esc(x['card_form']);meaning=esc(x['single_meaning_ko']);example=esc(row['context'] or x.get('example_sentence',''))
        mark=f"<small>{esc(row['book'])} · {esc(row['page'])}</small>"
        if t in ('T3','관찰 2권'):short.append(f'<li><strong>{word}</strong> {meaning} · {example} {mark}</li>');continue
        if t=='패턴':patterns.append(f'<li><strong>{word}</strong> {meaning} · {example}</li>');continue
        picture=core.DATA['pictures'].get(x['card_form'].lower(),'')
        visual=('<span class="pic">'+esc(picture)+'</span>' if picture else '<small>그림·장면 스케치 □</small>')
        spelling=' · □ 쓸 수 있음' if t=='T1' and x['depth_target']==4 else ''
        main.append(f'<article>{visual}<h2>{word}</h2><p>{meaning}</p><p lang="en">{example}</p>{mark}<p>□ 들으면 앎 · □ 읽으면 앎{spelling}</p></article>')
    return page(('누적 T1 '+date.today().strftime('%Y-%m') if monthly else '주간 소책자')+' · '+NAMES[profile],f"""<button class="no-print" onclick="print()">인쇄 또는 PDF 저장</button><p>책을 펼치고 문장을 먼저 읽어 봅니다. 아는 칸에 표시하세요.</p><div class="bookcards">{''.join(main)}</div>{'<h2>이번 주 한 번 보기</h2><ul>'+''.join(short)+'</ul>' if short else ''}{'<h2>말장난·합성어</h2><ul>'+''.join(patterns)+'</ul>' if patterns else ''}{'<p>승인한 카드가 여기에 표시됩니다.</p>' if not records else ''}""")

def audio_page(c,word=''):
    questions=sorted(core.QUESTIONS.values(),key=lambda x:x['id'])
    verified={r['card'] for r in c.execute('SELECT card FROM reviewed_audio')}
    if word:
        defs=list(core.CARDS.values())+[json.loads(r[0]) for r in c.execute('SELECT payload FROM custom')]
        selected=[x for x in defs if word.lower() in {x['card_form'].lower(),x['lemma'].lower()} or word==x['card_id']]
        entries=[(x['card_id'],x['card_form']+' · '+x.get('single_meaning_ko','')+' · '+x.get('pronunciation_note','')+' · '+x.get('example_sentence','')) for x in selected]
    else:
        entries=[(q['card_id'],q['id']+' '+q['word']+' · '+q['sense']) for q in questions]
    controls=''.join('<option value="'+esc(key)+'">'+esc(label+(' · 검수 완료' if key in verified else ''))+'</option>' for key,label in entries)
    return page('음성 검수',f"""<p>진단 음성 {sum(q['card_id'] in verified for q in questions)} / 150 검수.</p>
<form method="get" action="/audio"><label>검수할 학습 단어 또는 카드 ID <input name="word" value="{esc(word)}"></label><button>카드 찾기</button></form>
<form method="post" action="/audio" enctype="multipart/form-data"><fieldset>
<label>카드 <select name="card" required>{controls}</select></label>
<label>검수할 음원 <input type="file" name="clip" accept=".mp3,.wav,.m4a" required></label>
<audio controls id="preview"></audio>
<label><input type="checkbox" name="checked" required> 음원을 직접 듣고 표기 형태와 의미에 맞는 발음을 확인했습니다.</label><button>검수 음원 저장</button></fieldset></form>
<script>document.querySelector('[name=clip]').onchange=e=>{{document.querySelector('#preview').src=URL.createObjectURL(e.target.files[0])}}</script>""")

def learner_page(c,profile,word):
    st=core.known(c,profile)
    due=[(key,v[2]) for key,v in st.items() if v[2] and v[2]<=date.today().isoformat()]
    candidates=[]
    if word:
        defs=list(core.CARDS.values())+[json.loads(r[0]) for r in c.execute('SELECT payload FROM custom')]
        candidates=[x for x in defs if word.lower()==x['card_form'].lower() or word==x['card_id']]
    elif due:
        candidates=[get_card(c,k) for k,_ in sorted(due,key=lambda x:x[1])[:30]]
        candidates=[x for x in candidates if x and core.tier(x,'모름',core.corp(c),False) in ('T1','T2')]
    rows=[]
    for x in candidates:
        k=x['card_id']; state=core.status(st,x)
        rows.append(f'<article><strong>{esc(x["card_form"])}</strong> {esc(x.get("single_meaning_ko"))} · {esc(x["kind"])} <small>{esc(state[0])} · 다음 {esc(state[2] or "—")}</small><form method="post" action="/learn"><input type="hidden" name="profile" value="{profile}"><input type="hidden" name="card" value="{esc(k)}"><button name="correct" value="1">직접 확인 · 앎</button> <button name="correct" value="0">직접 확인 · 모름</button></form></article>')
    return page('카드 기록 · '+NAMES[profile],f'<form action="/learn"><label>아이 {selector(selected=profile)}</label><label>단어 또는 카드 ID <input name="word" value="{esc(word)}"></label><button>찾기</button></form><p>아이에게 실제로 답을 받아 확인한 결과를 표시합니다.</p>'+''.join(rows))

def diagnostic_page(c,profile,preview):
    verified={r['card'] for r in c.execute('SELECT card FROM reviewed_audio')}
    questions=core.DATA['diagnostic']
    missing=sum(q['card_id'] not in verified for q in questions)
    if not preview and missing:
        return page('듣기 진단',f'<p>검수 음원이 필요한 문항이 {missing}개 있습니다.</p><p>{link("/audio","음성 검수")} · {link("/quiz","10문항 미리보기",profile=profile,preview="1")}</p>')
    qdata=[dict(id=q['id'],word=q['word'],options=q['options'],audio='/clip?'+urlencode({'card':q['card_id']}) if q['card_id'] in verified else '') for q in (questions[:10] if preview else questions)]
    return page('듣기 진단 · '+NAMES[profile],f"""<p>{'미리보기 · 기기 음성 · 응답 미저장' if preview else '소리를 듣고 그림 하나를 고릅니다. 50문항마다 쉴 수 있습니다.'}</p>
<button id="start">소리 켜고 시작</button> <button id="again" hidden>다시 듣기</button>
<p id="position" aria-live="polite"></p><div id="options" class="options"></div><p id="note"></p>
<audio id="voice" preload="auto"></audio>
<script>
const questions={json.dumps(qdata,ensure_ascii=False).replace('<','\\u003c')}, preview={str(preview).lower()}, profile={json.dumps(profile)};
const get=id=>document.getElementById(id), options=get('options'), player=get('voice');
let i=0, answers={{}}, generation=0;
async function play() {{
 const q=questions[i]; if(!q)return;
 const token=++generation;
 const again=get('again'); again.disabled=true;
 for(const b of options.querySelectorAll('button'))b.disabled=true;
 try {{
   if(q.audio){{
     player.src=q.audio;
     let timeout;
     const ended=new Promise((resolve,reject)=>{{
       player.onended=resolve;player.onerror=reject;timeout=setTimeout(reject,12000);
     }});
     try {{await Promise.all([player.play(),ended]);}}
     finally {{clearTimeout(timeout);player.onended=null;player.onerror=null;}}
   }}
   else {{
     if(!preview || !('speechSynthesis' in window))throw Error();
     speechSynthesis.cancel();
     const u=new SpeechSynthesisUtterance(q.word);u.lang='en-US';
     const v=speechSynthesis.getVoices().find(v=>v.lang==='en-US');if(v)u.voice=v;
     await new Promise((resolve,reject)=>{{u.onend=resolve;u.onerror=reject;speechSynthesis.speak(u);setTimeout(reject,3500);}});
   }}
   if(token!==generation)return;
   get('note').textContent='';for(const b of options.querySelectorAll('button'))b.disabled=false;
 }} catch(e){{player.pause();if(token===generation)get('note').textContent='소리가 재생되지 않았습니다. 다시 듣기를 눌러 주세요.';}}
 finally {{if(token===generation)again.disabled=false;}}
}}
function render(){{
 const q=questions[i]; options.replaceChildren();
 get('position').textContent=(i+1)+' / '+questions.length;
 for(const [j,icon] of q.options.entries()){{const b=document.createElement('button');b.textContent=icon;b.disabled=true;b.onclick=()=>answer(q.id,j);options.appendChild(b);}}
 play();
}}
async function answer(id,j){{
 if(questions[i]?.id!==id)return;
 answers[id]=j;player.pause();if(preview&&'speechSynthesis' in window)speechSynthesis.cancel();i++;generation++;
 options.replaceChildren();
 if(i===questions.length){{
   get('again').hidden=true;
   if(preview){{get('position').textContent='미리보기 완료';return;}}
   get('position').textContent='저장 중';
   const submit=async()=>{{try{{
      const r=await fetch('/score',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{profile,answers}})}});
      if(!r.ok)throw Error(await r.text());
      get('position').textContent='완료. 결과는 보호자 화면에서 확인해 주세요.';get('note').replaceChildren();
    }}catch(e){{get('position').textContent='저장 오류';const b=document.createElement('button');b.textContent='다시 저장';b.onclick=submit;get('note').replaceChildren(b);}}}};
   await submit();return;
 }}
 if(i%50===0){{get('position').textContent='잠깐 쉬어도 좋아요.';get('again').hidden=true;get('start').textContent='계속';get('start').hidden=false;return;}}
 render();
}}
get('start').onclick=()=>{{get('start').hidden=true;get('again').hidden=false;render();}};
get('again').onclick=play;
</script>""",navigation=False)

class Handler(BaseHTTPRequestHandler):
    def auth(self):
        pin=self.server.pin
        if not pin:return True
        cookie=self.headers.get('Cookie','')
        return any(hmac.compare_digest(part.strip(),'family='+self.server.session) for part in cookie.split(';'))
    def send_data(self,body,content='text/html; charset=utf-8',code=200):
        if isinstance(body,str):body=body.encode('utf-8')
        self.send_response(code);self.send_header('Content-Type',content)
        self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
    def redirect(self,path):
        self.send_response(303);self.send_header('Location',path);self.end_headers()
    def body(self):
        n=int(self.headers.get('Content-Length','0'))
        if not 0<n<=MAX_BODY:raise ValueError('입력 파일 합계는 90 MB 이내로 나누어 주세요.')
        return self.rfile.read(n)
    def fields(self,body):
        typ=self.headers.get('Content-Type','')
        if 'multipart/form-data' not in typ:return parse_qs(body.decode('utf-8'),keep_blank_values=True),{}
        m=BytesParser(policy=default).parsebytes(('Content-Type: '+typ+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+body)
        vals={};files={}
        for p in m.iter_parts():
            name=p.get_param('name',header='content-disposition')
            if p.get_filename():files.setdefault(name,[]).append((Path(p.get_filename()).name,p.get_payload(decode=True)))
            else:vals.setdefault(name,[]).append(p.get_payload(decode=True).decode('utf-8'))
        return vals,files
    def request_parts(self):
        u=urlsplit(self.path)
        return u.path,{k:v[0] for k,v in parse_qs(u.query).items()}
    def denied(self):
        self.send_data(page('가족 학습 도구','<form method="post" action="/login"><label>접속 코드 <input type="password" name="pin" required></label><button>접속</button></form>'),code=401)
    def parent_auth(self):
        return any(hmac.compare_digest(part.strip(),'parent='+self.server.parent_session) for part in self.headers.get('Cookie','').split(';'))
    def parent_prompt(self,path):
        self.send_data(page('보호자 확인','<form method="post" action="/parent"><input type="hidden" name="next" value="'+esc(path)+'"><label>보호자 코드 <input type="password" name="pin" required></label><button>확인</button></form>'),code=401)
    def do_GET(self):
        if not self.auth():self.denied();return
        path,q=self.request_parts()
        if path in {'/results','/export'} and not self.parent_auth():self.parent_prompt(self.path);return
        try:
            with core.db(STATE) as c:
                if path=='/':body=dashboard(c)
                elif path=='/review':body=review(c,book_id(q.get('book','')),require_profile(q.get('profile','')))
                elif path=='/booklet':body=booklet(c,q.get('book',''),require_profile(q.get('profile','')),q.get('monthly')=='1')
                elif path=='/ocr':
                    b=book_id(q.get('book',''));row=c.execute('SELECT title FROM books WHERE id=?',(b,)).fetchone()
                    if not row:raise ValueError('책을 찾을 수 없습니다.')
                    items=list(c.execute('SELECT page,text FROM pages WHERE book=? ORDER BY rowid',(b,)))
                    inputs=''.join(f'<label>{esc(p)}<textarea name="page{i}">{esc(t)}</textarea></label><input type="hidden" name="label{i}" value="{esc(p)}">' for i,(p,t) in enumerate(items))
                    body=page('OCR 교정',f'<form method="post" action="/correct"><input type="hidden" name="book" value="{esc(b)}"><input type="hidden" name="title" value="{esc(row[0])}">{inputs}<button>교정 내용 반영</button></form>')
                elif path=='/diagnostic':
                    blocks=[]
                    for k,n in NAMES.items():blocks.append('<li>'+n+' · '+link('/quiz','진단 시작',profile=k)+' · '+link('/quiz','미리보기',profile=k,preview='1')+' · '+link('/results','보호자 결과',profile=k)+'</li>')
                    body=page('듣기 진단','<p>아이별로 진행하고, 보호자 결과를 별도로 엽니다.</p><ul>'+''.join(blocks)+'</ul>')
                elif path=='/quiz':body=diagnostic_page(c,require_profile(q.get('profile','')),q.get('preview')=='1')
                elif path=='/results':
                    k=require_profile(q.get('profile','')); rs=list(c.execute('SELECT * FROM diagnostic WHERE profile=? ORDER BY day DESC,band',(k,)))
                    rows=''.join(f'<tr><td>{r["day"]}</td><td>{r["band"]}</td><td>{r["correct"]}/{r["total"]}</td><td>{r["adjusted"]:.1%}</td><td>{"구간 앎 추정" if r["passed"] else "개별 오답 반영"}</td></tr>' for r in rs)
                    body=page('보호자 결과 · '+NAMES[k],'<table><tr><th>날짜</th><th>구간</th><th>정답</th><th>보정</th><th>처리</th></tr>'+rows+'</table>')
                elif path=='/audio':body=audio_page(c,q.get('word',''))
                elif path=='/learn':body=learner_page(c,require_profile(q.get('profile','son')),q.get('word',''))
                elif path=='/clip':
                    row=c.execute('SELECT path FROM reviewed_audio WHERE card=?',(q.get('card',''),)).fetchone()
                    if not row:raise ValueError('검수 음원이 없습니다.')
                    p=HERE/'audio'/Path(row[0]).name
                    self.send_data(p.read_bytes(),{'.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4'}[p.suffix]);return
                elif path=='/export':
                    # The parent chooses one profile. Each export contains only that learner's records.
                    if 'profile' not in q:
                        body=page('학습 기록 내보내기','<p>'+link('/export','아들 JSON',profile='son')+' · '+link('/export','딸 JSON',profile='daughter')+'</p>')
                    else:
                        k=require_profile(q['profile']);st=core.known(c,k);cp=core.corp(c)
                        packs=[]
                        for r in c.execute('SELECT * FROM pack WHERE profile=?',(k,)):
                            row=dict(r); card=get_card(c,row['card'])
                            if card:
                                row['tier']=core.tier(card,'모름',cp) or ('관찰 2권' if card['track']=='vocab' else '패턴')
                                row['card_form']=card['card_form']
                                row['depth_target']=min(card['depth_target'], {'T1':4,'T2':3,'T3':2}.get(row['tier'],2))
                            packs.append(row)
                        out=dict(profile=k,card_states=st,corpus=cp,approved_packs=packs,
                                 local_cards=[json.loads(r[0]) for r in c.execute('SELECT payload FROM custom')],
                                 reviewed_audio={r['card']:r['path'] for r in c.execute('SELECT * FROM reviewed_audio')})
                        self.send_data(json.dumps(out,ensure_ascii=False,indent=2),'application/json; charset=utf-8');return
                else:self.send_data('찾을 수 없습니다.',code=404);return
            self.send_data(body)
        except (ValueError,OSError) as e:self.send_data(page('확인 필요',esc(e)),code=400)
    def do_POST(self):
        path,_=self.request_parts()
        try:
            if path=='/login':
                v,_=self.fields(self.body())
                if not self.server.pin or not hmac.compare_digest(v.get('pin',[''])[0],self.server.pin):self.denied();return
                self.send_response(303);self.send_header('Location','/');self.send_header('Set-Cookie','family='+self.server.session+'; HttpOnly; SameSite=Strict; Path=/');self.end_headers();return
            if not self.auth():self.denied();return
            body=self.body()
            if path=='/parent':
                v,_=self.fields(body);target=v.get('next',['/diagnostic'])[0]
                if urlsplit(target).path not in {'/results','/export'} or not target.startswith('/') or target.startswith('//'):target='/diagnostic'
                if not hmac.compare_digest(v.get('pin',[''])[0],self.server.parent_pin):self.parent_prompt(target);return
                self.send_response(303);self.send_header('Location',target);self.send_header('Set-Cookie','parent='+self.server.parent_session+'; HttpOnly; SameSite=Strict; Path=/');self.end_headers();return
            with core.db(STATE) as c:
                if path=='/score':
                    d=json.loads(body);p=require_profile(d['profile'])
                    reviewed={r[0] for r in c.execute('SELECT card FROM reviewed_audio')}
                    if any(q['card_id'] not in reviewed for q in core.QUESTIONS.values()):raise ValueError('진단 음성 검수가 필요합니다.')
                    core.diagnostic_result(c,p,d['answers']);self.send_data('저장 완료','text/plain; charset=utf-8');return
                v,f=self.fields(body); get=lambda k,default='':v.get(k,[default])[0]
                if path in ('/ingest','/correct'):
                    b=book_id(get('book'));title=get('title')
                    if path=='/correct':
                        items=[(get(k.replace('page','label',1)),get(k)) for k in v if re.fullmatch(r'page\d+',k)]
                    elif get('text').strip():
                        items=[(str(i),t.strip()) for i,t in enumerate(re.split(r'(?m)^\s*===\s*$',get('text')),1) if t.strip()]
                    else:
                        files=sorted(f.get('photos',[]))
                        if not 1<=len(files)<=20:raise ValueError('사진을 1~20장 선택해 주세요.')
                        items=[(name,core.ocr(name,data)) for name,data in files]
                    core.save_book(c,b,title,items);self.redirect('/review?'+urlencode(dict(book=b,profile='son')))
                elif path=='/approve':
                    b=book_id(get('book'));p=require_profile(get('profile'));rows=core.book_candidates(c,b,p)
                    if get('version')!=fingerprint(rows[:60]):raise ValueError('책 또는 학습 기록이 갱신됐습니다. 검수 화면을 다시 열어 주세요.')
                    indexes=[int(x) for x in v.get('keep',[])]
                    if len(set(indexes))!=len(indexes) or any(i<0 or i>=min(len(rows),60) for i in indexes):raise ValueError('선택 번호를 확인해 주세요.')
                    chosen=[]
                    for i in indexes:
                        idx=int(get('sense'+str(i),'0'))
                        if not 0<=idx<len(rows[i]['options']):raise ValueError('뜻 선택을 확인해 주세요.')
                        chosen.append((rows[i],idx,get('gloss'+str(i))))
                    core.approve_pack(c,b,p,chosen);self.redirect('/booklet?'+urlencode(dict(book=b,profile=p)))
                elif path=='/learn':
                    p=require_profile(get('profile'));key=get('card')
                    if get('correct') not in {'0','1'}:raise ValueError('앎 또는 모름을 선택하세요.')
                    core.record_review(c,p,key,get('correct')=='1');self.redirect('/learn?'+urlencode({'profile':p,'word':key}))
                elif path=='/audio':
                    card=get('card');files=f.get('clip',[])
                    if get('checked')!='on' or not get_card(c,card) or len(files)!=1:raise ValueError('카드와 확인한 음원 한 개를 선택해 주세요.')
                    name,bits=files[0];s=Path(name).suffix.lower()
                    if not bits or len(bits)>4*1024*1024 or s not in {'.wav','.mp3','.m4a'}:raise ValueError('4 MB 이하 WAV, MP3, M4A를 등록해 주세요.')
                    if not (s=='.wav' and bits.startswith(b'RIFF') and bits[8:12]==b'WAVE' or s=='.mp3' and (bits.startswith(b'ID3') or len(bits)>1 and bits[0]==255 and bits[1]&224==224) or s=='.m4a' and bits[4:8]==b'ftyp'):
                        raise ValueError('파일 내용이 선택한 음원 형식과 일치하지 않습니다.')
                    target=hashlib.sha256(card.encode()+bits).hexdigest()[:24]+s
                    (HERE/'audio').mkdir(exist_ok=True);(HERE/'audio'/target).write_bytes(bits)
                    c.execute('INSERT OR REPLACE INTO reviewed_audio VALUES (?,?)',(card,target));self.redirect('/audio')
                else:self.send_data('찾을 수 없습니다.',code=404)
        except (ValueError,KeyError,IndexError,OSError) as e:self.send_data(page('확인 필요',esc(e)),code=400)

def main():
    global STATE
    p=argparse.ArgumentParser();p.add_argument('--host',default='127.0.0.1');p.add_argument('--port',type=int,default=8765);p.add_argument('--pin',default='');p.add_argument('--db',type=Path,default=STATE);args=p.parse_args()
    if args.host not in {'127.0.0.1','localhost','::1'} and len(args.pin)<6:p.error('가정 Wi-Fi 접속에는 6자 이상의 --pin이 필요합니다.')
    STATE=args.db
    server=ThreadingHTTPServer((args.host,args.port),Handler);server.pin=args.pin;server.session=secrets.token_urlsafe(24);server.parent_session=secrets.token_urlsafe(24);server.parent_pin=f'{secrets.randbelow(1000000):06d}'
    print(f'http://{args.host}:{args.port} · 보호자 코드 {server.parent_pin}',flush=True);server.serve_forever()

if __name__=='__main__':main()
