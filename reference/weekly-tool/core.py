import html, json, re, sqlite3, subprocess, tempfile
from pathlib import Path
from collections import Counter, defaultdict
from datetime import date, timedelta

ROOT=Path(__file__).resolve().parent
DATA=json.loads((ROOT/'vocabulary.json').read_text(encoding='utf-8'))
LEMMAS={l['id']:l for l in DATA['lemmas']}
CARDS={c['card_id']:c for c in DATA['cards']}
PENDING={x['id']:x for x in DATA['pending'] if not x['status'].startswith('자작')}
QUESTIONS={q['id']:q for q in DATA['diagnostic']}
BASE=defaultdict(list)
for c in CARDS.values():
    BASE[c['lemma_link']].append(c)
TOKEN=re.compile(r"['’]fraidy|[A-Za-z]+(?:['’-][A-Za-z]+)*",re.I)
def normalize(s):
    return s.lower().replace('’',"'")
EXACT=defaultdict(list)
for c in CARDS.values():
    EXACT[normalize(c['card_form'])].append(c)
for alias, ids in DATA['aliases'].items():
    for key in ids:
        if BASE.get(key):
            EXACT[normalize(alias)].append(BASE[key][0])
PENDING_INDEX=defaultdict(list)
for p in PENDING.values():
    PENDING_INDEX[normalize(p['form']).strip('!')].append(p)
MAX_PHRASE=max(len(k.split()) for k in (*EXACT,*PENDING_INDEX))
PROFILES={'son','daughter'}
SRS=(1,3,7,14,30)

def db(path):
    c=sqlite3.connect(path, timeout=15)
    c.row_factory=sqlite3.Row
    c.executescript("""
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,title TEXT NOT NULL,first_seen TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS pages(book TEXT REFERENCES books(id),page TEXT,text TEXT,PRIMARY KEY(book,page));
    CREATE TABLE IF NOT EXISTS corpus(book TEXT REFERENCES books(id),lemma TEXT,n INTEGER,PRIMARY KEY(book,lemma));
    CREATE TABLE IF NOT EXISTS evidence(book TEXT REFERENCES books(id),token_key TEXT,n INTEGER,PRIMARY KEY(book,token_key));
    CREATE TABLE IF NOT EXISTS custom(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS learner(profile TEXT,card TEXT,known TEXT,origin TEXT,streak INTEGER DEFAULT 0,due TEXT,PRIMARY KEY(profile,card));
    CREATE TABLE IF NOT EXISTS diagnostic(profile TEXT,day TEXT,band TEXT,correct INTEGER,total INTEGER,adjusted REAL,passed INTEGER,PRIMARY KEY(profile,day,band));
    CREATE TABLE IF NOT EXISTS reviewed_audio(card TEXT PRIMARY KEY,path TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pack(book TEXT,profile TEXT,card TEXT,tier TEXT,context TEXT,page TEXT,observed_count INTEGER,PRIMARY KEY(book,profile,card));
    CREATE TABLE IF NOT EXISTS resolutions(book TEXT,key TEXT,context TEXT,card TEXT,PRIMARY KEY(book,key,context));
    """)
    return c

def ocr(name, contents):
    suffix=Path(name).suffix.lower()
    if suffix not in {'.jpg','.jpeg','.png','.tif','.tiff','.webp'}:
        raise ValueError('JPG 또는 PNG 사진으로 변환해 주세요.')
    with tempfile.TemporaryDirectory() as folder:
        p=Path(folder)/('page'+suffix);p.write_bytes(contents)
        try:
            result=subprocess.run(['tesseract',str(p),'stdout','-l','eng','--psm','6'],
               check=True,capture_output=True,text=True,timeout=30)
        except FileNotFoundError as e:
            raise ValueError('Tesseract가 필요합니다. Mac 설치 명령은 README에 있습니다.') from e
        except (subprocess.TimeoutExpired,subprocess.CalledProcessError) as e:
            raise ValueError('OCR 실패. 페이지 '+name+'의 사진 방향과 화질을 확인해 주세요.') from e
    return result.stdout

def lookup(form):
    key=normalize(form)
    if key in EXACT:return EXACT[key],False
    tries=[]
    # Keep a specific book form. A guessed root requires parent confirmation.
    for suffix in ("'s",'ies','es','s','ied','ed','ing','er','est'):
        if not key.endswith(suffix) or len(key)<=len(suffix)+2:continue
        stem=key[:-len(suffix)]
        tries.extend([stem,stem+'e'])
        if suffix in ('ies','ied'):tries.append(stem+'y')
        if len(stem)>2 and stem[-1]==stem[-2]:tries.append(stem[:-1])
    return next((EXACT[t] for t in tries if t in EXACT),[]),True

def analysis(text):
    normalized_text=text.replace('’',"'")
    matches=list(TOKEN.finditer(normalized_text))
    i=0;hits=[]
    while i<len(matches):
        m=matches[i]; span=1; form=m.group()
        choices=[]; proposed=[]; guessed=False
        for n in range(min(MAX_PHRASE,len(matches)-i),1,-1):
            chunk=normalized_text[m.start():matches[i+n-1].end()]
            if not re.fullmatch(r"[A-Za-z'\-\s]+",chunk):continue
            key=normalize(' '.join(chunk.split()))
            if key in EXACT or key in PENDING_INDEX:
                form=' '.join(chunk.split());span=n;choices=EXACT.get(key,[]);proposed=PENDING_INDEX.get(key,[]);break
        if span==1:
            choices,guessed=lookup(form)
            proposed=PENDING_INDEX.get(normalize(form),[])
        start=max(normalized_text.rfind(mark,0,m.start()) for mark in '.!?')+1
        finish=next((j+1 for j in range(matches[i+span-1].end(),len(normalized_text)) if normalized_text[j] in '.!?'),len(normalized_text))
        context=' '.join(normalized_text[start:finish].split())[:280]
        leading=not normalized_text[start:m.start()].strip(' \t\r\n\"“”\'')
        proper=(span==1 and form not in ('I',) and (form in {'Geronimo','Thea','Benjamin','New Mouse City','Stilton'} or form.isupper() and len(form)>1 or form[:1].isupper() and not leading and not proposed and form not in {'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'}))
        if choices and any(c['track'] in {'wordplay','compound'} for c in choices):proper=False
        hits.append(dict(form=form,key=normalize(form),span=span,choices=choices,proposed=proposed,guessed=guessed,proper=proper,context=context))
        i+=span
    return hits

def reviewed_hits(c,book,text):
    approved={(r['key'],r['context']):r['card'] for r in c.execute('SELECT key,context,card FROM resolutions WHERE book=?',(book,))}
    for hit in analysis(text):
        key=approved.get((hit['key'],hit['context']))
        if key:
            item=CARDS.get(key)
            if not item:
                row=c.execute('SELECT payload FROM custom WHERE id=?',(key,)).fetchone()
                item=json.loads(row[0]) if row else None
            if item:hit.update(choices=[item],guessed=False)
        yield hit

def save_book(c,book,title,items):
    if not 1<=len(items)<=20 or len({p for p,_ in items})!=len(items):
        raise ValueError('서로 다른 표본 쪽을 1~20개 입력해 주세요.')
    if not book or not title.strip() or any(not TOKEN.search(t) for _,t in items):
        raise ValueError('책 ID, 제목, 그리고 모든 쪽의 영어 텍스트를 확인해 주세요.')
    c.execute("INSERT INTO books(id,title) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title",(book,title.strip()))
    c.execute('DELETE FROM pages WHERE book=?',(book,))
    # Old approvals remain available only for the exact same sentence and form.
    c.executemany('INSERT INTO pages VALUES (?,?,?)',[(book,p,t) for p,t in items])
    refresh_corpus(c,book)
    c.commit()

def refresh_corpus(c,book):
    counts=Counter(); evidence=Counter()
    for row in c.execute('SELECT text FROM pages WHERE book=?',(book,)):
        for h in reviewed_hits(c,book,row[0]):
            if h['proper']:continue
            evidence[h['key']]+=1
            roots={x['lemma_link'] for x in h['choices']}
            if len(roots)==1 and not h['guessed']:counts[roots.pop()]+=1
    c.execute('DELETE FROM corpus WHERE book=?',(book,))
    c.execute('DELETE FROM evidence WHERE book=?',(book,))
    c.executemany('INSERT INTO corpus VALUES (?,?,?)',[(book,k,n) for k,n in counts.items()])
    c.executemany('INSERT INTO evidence VALUES (?,?,?)',[(book,k,n) for k,n in evidence.items()])

def corp(c):
    return {r['lemma']:(r['nbooks'],r['ntokens'],r['title']) for r in c.execute("""
      SELECT s.lemma,COUNT(*) nbooks,SUM(s.n) ntokens,
       (SELECT b.title FROM corpus z JOIN books b ON b.id=z.book WHERE z.lemma=s.lemma ORDER BY b.first_seen,b.rowid LIMIT 1) title
      FROM corpus s GROUP BY s.lemma""")}

def known(c,profile):
    return {r['card']:(r['known'],r['origin'],r['due'],r['streak']) for r in c.execute('SELECT * FROM learner WHERE profile=?',(profile,))}
def status(states,card):
    return states.get(card['card_id'],('미확인','',None,0))
def tier(card,learner_state,stats,observed=True):
    l=LEMMAS.get(card['lemma_link'],{})
    if card['track']!='vocab':return ''
    n=stats.get(card['lemma_link'],(0,0,''))[0]
    if n>=3 or (l.get('genre') and n>=2) or (l.get('high_freq') and learner_state=='모름'):return 'T1'
    if l.get('genre'):return 'T2'
    return 'T3' if observed and n<=1 else ''

def book_candidates(c,book,profile):
    states=known(c,profile);stats=corp(c); tally={}
    for row in c.execute('SELECT * FROM pages WHERE book=? ORDER BY rowid',(book,)):
        for h in reviewed_hits(c,book,row['text']):
            if h['proper']:continue
            choices=[x for x in h['choices'] if x['track'] in {'vocab','wordplay','compound'}]
            if not choices and h['choices']:continue
            # A sight word/homograph with an unresolved content reading stays in the review queue.
            if choices and all(status(states,x)[0]=='앎' for x in choices):continue
            actual=[]
            for x in choices:
                if status(states,x)[0]=='앎':continue
                y=dict(x)
                if normalize(x['card_form'])!=h['key']:
                    y['card_form']=h['form'];y['audio_checked']=False;y['audio_file']=''
                    y['parent_card_id']=x['card_id']
                actual.append(y)
            if not actual:
                p=next(iter(h['proposed']),None)
                key=p['id'] if p else 'raw:'+h['key']
                actual=[dict(card_id=key,card_form=h['form'],lemma_link=key,lemma=h['form'],single_meaning_ko=p['meaning'] if p else '',track='wordplay' if p and p['group']=='시리즈 말장난' else 'vocab',kind='본문 표기',image_type='추상·기능',depth_target=2,audio_checked=False,sense_order=1)]
            keyed=h['key']
            if keyed not in tally:tally[keyed]=dict(form=h['form'],count=0,page=row['page'],context=h['context'],options=actual,guessed=h['guessed'])
            tally[keyed]['count']+=1
    def sortkey(r):
        def priority(x):
            st=status(states,x)[0]
            if st=='미확인' and LEMMAS.get(x['lemma_link'],{}).get('high_freq'):st='모름'
            return tier(x,st,stats) or 'T3'
        best=min((priority(x) for x in r['options']),default='T3')
        n=max(stats.get(x['lemma_link'],(0,0,''))[0] for x in r['options'])
        f=min((min(LEMMAS.get(x['lemma_link'],{}).get(k) or 99999 for k in ('ndl','ngsl')) for x in r['options']),default=99999)
        r['estimate']=best;r['nbooks']=n
        essential=any(x['card_id'] in PENDING for x in r['options'])
        return (best,-r['count'],-n,f,not essential,r['form'].lower())
    return sorted(tally.values(),key=sortkey)

def approve_pack(c,book,profile,selected):
    if not 1<=len(selected)<=15:raise ValueError('1~15개를 선택하세요. 권장 분량은 10~15개입니다.')
    c.execute('DELETE FROM pack WHERE book=? AND profile=?',(book,profile))
    for r,idx,gloss in selected:
        x=dict(r['options'][idx])
        if not x.get('single_meaning_ko') and not gloss.strip():
            raise ValueError('새 단어의 뜻을 입력해 주세요: '+x['card_form'])
        old=x['card_id']
        if old not in CARDS or x.get('parent_card_id'):
            identity=(x['lemma_link']+'|'+normalize(x['card_form'])+'|'+(gloss.strip() or x['single_meaning_ko']))
            import hashlib
            card_id='B'+hashlib.sha1(identity.encode()).hexdigest()[:18]
            x['card_id']=card_id
            if x['lemma_link'] not in LEMMAS:x['lemma_link']=old if old in PENDING else 'local:'+normalize(x['lemma'])
            x['single_meaning_ko']=gloss.strip() or x['single_meaning_ko']
            x.update(example_sentence=r['context'],example_source=f'{book} p.{r["page"]}',audio_checked=False,audio_file='')
            c.execute('INSERT OR IGNORE INTO custom VALUES (?,?)',(card_id,json.dumps(x,ensure_ascii=False)))
        elif gloss.strip() and gloss.strip()!=x['single_meaning_ko']:
            raise ValueError('기존 뜻과 다르면 뜻 선택 메뉴에서 다른 카드를 고르세요.')
        c.execute("""INSERT INTO learner VALUES (?,?,?, '부모 확인',0,NULL)
          ON CONFLICT(profile,card) DO UPDATE SET known=excluded.known,origin=excluded.origin""",(profile,x['card_id'],'모름'))
        c.execute('INSERT OR REPLACE INTO resolutions VALUES (?,?,?,?)',(book,normalize(r['form']),r['context'],x['card_id']))
        refresh_corpus(c,book)
        stats=corp(c); t=tier(x,'모름',stats) or ('관찰 2권' if x['track']=='vocab' else '패턴')
        if x['track']=='vocab' and t in ('T1','T2'):
            c.execute('UPDATE learner SET due=COALESCE(due,?) WHERE profile=? AND card=?',(date.today().isoformat(),profile,x['card_id']))
        c.execute('INSERT INTO pack VALUES (?,?,?,?,?,?,?)',(book,profile,x['card_id'],t,r['context'],r['page'],r['count']))
    c.commit()

def record_review(c,profile,card_id,correct,day=None):
    day=day or date.today(); x=CARDS.get(card_id)
    if not x:
        r=c.execute('SELECT payload FROM custom WHERE id=?',(card_id,)).fetchone()
        x=json.loads(r[0]) if r else None
    if not x:raise ValueError('알 수 없는 카드')
    prev=known(c,profile).get(card_id,('미확인','',None,0))
    long=tier(x,'모름',corp(c),False) in ('T1','T2')
    if correct and long and prev[2] and prev[2]>day.isoformat():
        return  # Rehearsal before the due date does not advance the interval.
    n=prev[3]+1 if correct else 0
    delay=SRS[min(max(n-1,0),len(SRS)-1)]
    c.execute("""INSERT INTO learner VALUES (?,?,?,?,?,?)
      ON CONFLICT(profile,card) DO UPDATE SET known=excluded.known,origin=excluded.origin,streak=excluded.streak,due=excluded.due""",
      (profile,card_id,'앎' if correct else '모름','직접 인출',n,(day+timedelta(days=delay)).isoformat() if long else None))
    c.commit()

def diagnostic_result(c,profile,answers,day=None):
    if set(answers)!=set(QUESTIONS) or any(type(x) is not int or not 0<=x<=3 for x in answers.values()):
        raise ValueError('150개 문항의 응답을 확인해 주세요.')
    day=(day or date.today()).isoformat(); summary=[]
    for band in ('P1','P2','P3'):
        items=[q for q in QUESTIONS.values() if q['band']==band]
        n=len(items); correct=sum(answers[q['id']]==q['answer'] for q in items)
        adjusted=(correct/n-.25)/.75
        passed=int(correct*40>=37*n)
        c.execute('INSERT OR REPLACE INTO diagnostic VALUES (?,?,?,?,?,?,?)',(profile,day,band,correct,n,adjusted,passed))
        c.execute("DELETE FROM learner WHERE profile=? AND origin=?", (profile,'진단 구간 추정 '+band))
        if passed:
            rows=[(profile,x['card_id'],'앎','진단 구간 추정 '+band) for x in CARDS.values() if x['track']=='vocab' and LEMMAS[x['lemma_link']]['old_priority']==band]
            c.executemany('INSERT OR IGNORE INTO learner(profile,card,known,origin) VALUES (?,?,?,?)',rows)
        for q in items:
            if answers[q['id']]!=q['answer']:
                c.execute("""INSERT INTO learner(profile,card,known,origin) VALUES (?,?,'모름','진단 오답')
                  ON CONFLICT(profile,card) DO UPDATE SET known='모름',origin='진단 오답',streak=0,due=NULL""",(profile,q['card_id']))
        summary.append(dict(band=band,correct=correct,total=n,adjusted=adjusted,passed=bool(passed)))
    c.commit();return summary

def coverage(c,book,profile):
    states=known(c,profile); out=[]
    for row in c.execute('SELECT * FROM pages WHERE book=? ORDER BY rowid',(book,)):
        counts=Counter()
        for h in reviewed_hits(c,book,row['text']):
            counts['tokens']+=h['span']
            options=h['choices']
            vals=[status(states,k) for k in options]
            if h['proper']: label='proper'
            elif h['guessed'] or not vals:label='unresolved'
            elif all(v[0]=='앎' and not v[1].startswith('진단 구간') for v in vals):label='known'
            elif all(v[0]=='앎' for v in vals):label='inferred'
            elif all(v[0]=='모름' for v in vals):label='unknown'
            else:label='unresolved'
            counts[label]+=h['span']
        out.append(dict(page=row['page'],**{k:counts[k] for k in ('tokens','known','inferred','unknown','proper','unresolved')}))
    return out
