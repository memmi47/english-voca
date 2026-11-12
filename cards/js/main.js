// Flashcard prototype: screens. Rules live in deck.js, audio in sound.js.
import { Run, newState, planRun, gradeOf, gradeCounts, mulberry32, CFG } from './deck.js';
import { Sound } from './sound.js';

const qs = new URLSearchParams(location.search);
const todayISO = () => qs.get('today') || new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const FAST = qs.get('fast') === '1';                     // test hook: short reveal pauses
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PROFILES = ['son', 'daughter'];
const BOSSES = ['👾', '🦖', '🐙', '🤖', '🐲', '👹', '🦈', '👻', '🦂', '🐊', '🦇', '🦑'];
const GRADE = ['', '동', '은', '금'];
const MAX_RUNS = 6;                                      // about 15 minutes a day at this deck size
const G = { words: [], byId: {}, meta: null, pid: null, st: null, run: null, boss: null, view: 'home', busy: false, timer: null, sound: null };
window.__cards = G;

// ---- storage (this device only in the prototype) ----
const KEY = (id) => `cards.v0.p.${id}`;
function load(id) { try { return JSON.parse(localStorage.getItem(KEY(id))) || newState(id); } catch { return newState(id); } }
function save() { try { localStorage.setItem(KEY(G.pid), JSON.stringify(G.st)); return true; } catch (e) { banner(`저장에 실패했어요: ${esc(e.message)}`); return false; } }
function loadMeta() { try { return { names: { son: '아들', daughter: '딸' }, ...JSON.parse(localStorage.getItem('cards.v0.meta') || '{}') }; } catch { return { names: { son: '아들', daughter: '딸' } }; } }
const name = (id) => G.meta.names[id];

function banner(html) { const b = $('#banner'); b.innerHTML = html; b.hidden = false; }
function hideBanner() { $('#banner').hidden = true; }
const runsToday = (st) => st.runs.filter((r) => r.day === todayISO()).length;
const miniCard = (w, g, cls = '') => `<div class="mini g${g} ${cls}" data-act="peek" data-id="${esc(w.id)}"><b>${esc(w.form)}</b>${g ? `<i>${GRADE[g]}</i>` : ''}</div>`;

async function boot() {
  const data = await fetch('data/words.json').then((r) => r.json());
  G.words = data.words; G.byId = Object.fromEntries(G.words.map((w) => [w.id, w])); G.meta = loadMeta();
  G.sound = new Sound({ off: qs.get('sound') === 'off' }); await G.sound.init();
  document.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && G.view === 'card' && !G.busy) speak(true); });
  home();
}

// ---- home / today ----
function home() {
  G.view = 'home'; G.pid = null; G.st = null; G.run = null; hideBanner(); clearTimeout(G.timer);
  $('#app').innerHTML = `<div class="page center"><h1 class="title">단어 카드</h1><p class="mut">누가 할까요?</p>
  <div class="profiles">${PROFILES.map((id) => `<button class="profile" data-act="pick" data-id="${id}">${esc(name(id))}</button>`).join('')}</div>
  <p><button class="link" data-act="parent">부모 기록</button></p></div>`;
}
function today(id) {
  G.view = 'today'; G.pid = id; G.st = load(id); G.run = null; hideBanner(); clearTimeout(G.timer);
  const st = G.st; const n = runsToday(st); const plan = planRun(st, G.words, todayISO()); const c = gradeCounts(st, G.words);
  const empty = !plan.news.length && !plan.due.length; const capped = n >= MAX_RUNS;
  $('#app').innerHTML = `<div class="page center"><button class="back" data-act="home" aria-label="처음으로">‹</button>
  <h1 class="title">${esc(name(id))}</h1>
  <div class="dots" aria-label="오늘 한 판 수">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('')}${n > 3 ? `<em>+${n - 3}</em>` : ''}</div>
  ${empty ? '<p class="note">오늘 볼 카드를 다 봤어요. 내일 만나요!</p>' : capped ? '<p class="note">오늘은 여기까지! 내일 또 만나요.</p>'
    : `<button class="go" data-act="start">▶ ${n + 1}판 시작</button><p class="mut small">새 카드 ${plan.news.length}장 · 다시 만나는 카드 ${plan.due.length}장</p>`}
  <div class="shelf"><div class="bar">${[3, 2, 1, 0].map((g) => `<i class="g${g}" style="flex:${c[g]}"></i>`).join('')}</div>
    <div class="legend"><span class="g3">금 ${c[3]}</span><span class="g2">은 ${c[2]}</span><span class="g1">동 ${c[1]}</span><span class="g0">아직 ${c[0]}</span></div>
    <button class="sec" data-act="album">카드첩 보기</button></div>
  <p class="mut small" id="src">소리: ${esc(G.sound.source)}</p></div>`;
}

// ---- run ----
async function start() {
  await G.sound.unlock();                                  // inside the tap
  const seed = Number(qs.get('seed')) || Math.floor(Math.random() * 1e9);
  if (!G.boss || G.boss.day !== todayISO() || G.boss.pid !== G.pid) G.boss = { idx: 0, hp: CFG.bossHp, defeated: 0, day: todayISO(), pid: G.pid };
  G.run = new Run({ state: G.st, words: G.words, today: todayISO(), rng: mulberry32(seed + G.st.runs.length), boss: G.boss });
  G.view = 'card';
  $('#app').innerHTML = `<div class="run">
  <header class="hud"><button class="x" data-act="quit" aria-label="그만하기">✕</button>
    <div class="boss"><span class="boss-emoji" id="boss"></span><div class="hpbar"><i id="hp"></i></div><span class="floater" id="floater"></span></div>
    <div class="combo" id="combo"></div><div class="left" id="left"></div></header>
  <section class="stage"><div class="card" id="card"></div></section>
  <footer class="actions" id="actions"></footer></div>`;
  paintHud(); showCard();
}
function paintHud() {
  const b = G.run.boss; $('#boss').textContent = BOSSES[b.idx % BOSSES.length]; $('#hp').style.width = `${Math.max(0, b.hp) / CFG.bossHp * 100}%`;
  $('#combo').textContent = G.run.combo >= 2 ? `연속 ${G.run.combo}` : ''; $('#combo').classList.toggle('hot', G.run.combo >= 5);
  $('#left').textContent = `남은 카드 ${G.run.left}`;
}
const TAG = { new: '새 카드', review: '다시 만난 카드', likely: '다시 만난 카드', relearn: '방금 배운 카드', practice: '한 번 더', retry: '다시 도전' };
function front(it, w, extra = '') {
  const g = gradeOf(G.st.words[w.id]);
  $('#card').className = `card g${g}`;
  $('#card').innerHTML = `<div class="tag ${it.form === 'check' || it.verifying ? 'chk' : ''}" id="tag">${it.form === 'check' || it.verifying ? '확인! 뜻을 골라요' : TAG[it.role]}${extra}</div>
    <div class="word" id="word">${esc(w.form)}</div><button class="hear" data-act="hear" aria-label="다시 듣기">🔊</button>`;
}
function judgeButtons() { $('#actions').innerHTML = `<button class="act no" data-act="no">몰라요</button><button class="act yes" data-act="yes">알아요</button>`; }
function optionButtons(it) {
  $('#actions').innerHTML = `<div class="opts">${it.options.map((o, i) => `<button class="act opt" data-act="opt" data-i="${i}">${esc(o.ko)}</button>`).join('')}</div>
    <button class="link" data-act="opt" data-i="-1">몰라요</button>`;
}
const lock = (on) => document.querySelectorAll('.act').forEach((b) => { b.disabled = on; });
async function speak(force) {
  const it = G.run?.current; if (!it) return; const w = G.byId[it.id];
  const r = await G.sound.play(w.id, w.form);
  if (r.stale) return r;
  if (r.ok) { it.sound = r.source; hideBanner(); if (G.view === 'card' && !G.busy) { lock(false); if (G.run.t0 == null || !force) G.run.t0 = Date.now(); } }
  else banner(`<span>소리가 안 나요. 볼륨과 무음 스위치를 확인하세요.</span><button data-act="hear">다시 듣기</button><button class="link" data-act="mute-go">소리 없이 계속(부모)</button>`);
  return r;
}
function showCard() {
  const it = G.run.show(); if (!it) return endRun('done');
  G.busy = false; G.run.t0 = null; const w = G.byId[it.id];
  front(it, w); if (it.form === 'check') optionButtons(it); else judgeButtons();
  lock(true); paintHud(); $('#card').classList.add('in'); speak(false);
}
function onJudge(know) {
  if (G.busy || G.view !== 'card') return; const it = G.run.current;
  const res = G.run.judge(know);
  if (res.next === 'verify') { front(it, G.byId[it.id]); optionButtons(it); G.sound.blip('hit'); return; }
  reveal(res);
}
function onPick(i) {
  if (G.busy || G.view !== 'card') return;
  reveal(G.run.pick(i));                                 // the card back shows the right meaning; the options are cleared
}
function reveal(res) {
  G.busy = true; lock(true); save(); const w = res.word; const card = $('#card');
  const up = res.grade && res.grade.to > res.grade.from ? res.grade.to : 0;
  const line = res.ok ? (up ? `${GRADE[up]} 카드!` : res.verified ? '확인 성공!' : '') : res.said === 'wrong' ? '이 뜻이에요' : '이제 배워요';
  card.classList.remove('in'); card.classList.add('flip');
  setTimeout(() => {
    card.className = `card back g${gradeOf(G.st.words[w.id])} ${res.ok ? 'ok' : 'learn'} ${up ? 'up' : ''}`;
    card.innerHTML = `${w.emoji ? `<div class="emoji">${w.emoji}</div>` : ''}<div class="ko">${esc(w.ko)}</div><div class="word small">${esc(w.form)}</div>${line ? `<div class="line">${line}</div>` : ''}`;
  }, FAST ? 0 : 90);
  if (res.dmg) { const f = $('#floater'); f.textContent = `-${res.dmg}`; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    $('#boss').classList.remove('hit'); void $('#boss').offsetWidth; $('#boss').classList.add('hit'); G.sound.blip(res.defeated ? 'boss' : res.verified ? 'big' : 'hit'); }
  else G.sound.blip('miss');
  if (res.defeated) { $('#boss').classList.add('down'); setTimeout(() => { $('#boss').classList.remove('down'); paintHud(); }, FAST ? 0 : 450); } else paintHud();
  if (res.ok) { $('#actions').innerHTML = ''; G.timer = setTimeout(next, FAST ? 30 : up ? 1300 : 900); }
  else {                                                 // a word to learn: hear it again, then move on (tap to go sooner)
    $('#actions').innerHTML = `<button class="act goon" data-act="next" id="goon">다음 ▶</button>`;
    setTimeout(() => G.sound.play(w.id, w.form), FAST ? 0 : 350);
    G.timer = setTimeout(next, FAST ? 30 : 3000);
  }
}
function next() { clearTimeout(G.timer); if (G.view !== 'card' || !G.busy) return; G.run.advance(); showCard(); }   // busy guards a tap racing the timer

function endRun(reason) {
  clearTimeout(G.timer); G.sound.stop(); const run = G.run; const rec = run.finish(reason); G.boss = { ...run.boss, day: todayISO(), pid: G.pid }; save();
  G.view = 'end'; hideBanner(); const n = rec.n; const plan = planRun(G.st, G.words, todayISO());
  const more = (plan.news.length || plan.due.length) && n < MAX_RUNS;
  const ups = run.changed.filter((c) => c.to > c.from);
  $('#app').innerHTML = `<div class="page center"><h1 class="title">${n}판 끝!</h1>
  <div class="tiles"><div><b>${rec.cards}</b><span>넘긴 카드</span></div><div><b>${rec.bosses}</b><span>잡은 보스</span></div><div><b>${rec.learned}</b><span>새로 배운 카드</span></div></div>
  ${ups.length ? `<p class="mut">등급이 오른 카드</p><div class="minis">${ups.map((c) => miniCard(G.byId[c.id], c.to)).join('')}</div>` : ''}
  ${more ? `<button class="go" data-act="start">▶ ${n + 1}판 시작</button>` : '<p class="note">오늘 볼 카드를 다 봤어요!</p>'}
  <p><button class="sec" data-act="today">${more ? '오늘은 그만' : '처음으로'}</button></p></div>`;
  G.run = null;
}

// ---- album ----
function album() {
  G.view = 'album'; const st = G.st; const c = gradeCounts(st, G.words);
  $('#app').innerHTML = `<div class="page"><button class="back" data-act="today" aria-label="돌아가기">‹</button><h1 class="title center">${esc(name(G.pid))}의 카드첩</h1>
  <p class="center mut">금 ${c[3]} · 은 ${c[2]} · 동 ${c[1]} · 아직 ${c[0]}</p><div id="peek" class="peek center"></div>
  <div class="minis grid">${G.words.map((w) => { const r = st.words[w.id]; return r ? miniCard(w, gradeOf(r)) : '<div class="mini unseen">?</div>'; }).join('')}</div></div>`;
}

// ---- parent ----
function parent() {
  G.view = 'parent'; hideBanner(); const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '-');
  const block = (id) => { const st = load(id); const c = gradeCounts(st, G.words); const R = st.runs;
    const tot = R.reduce((a, r) => ({ cards: a.cards + r.cards, wall: a.wall + r.wall, claims: a.claims + r.claims, v: a.v + r.verifies, vok: a.vok + r.verifyOk }), { cards: 0, wall: 0, claims: 0, v: 0, vok: 0 });
    return `<h2>${esc(name(id))}</h2><p class="small">금 ${c[3]} · 은 ${c[2]} · 동 ${c[1]} · 아직 ${c[0]} / 전체 ${R.length}판, 카드 ${tot.cards}장, 분당 ${tot.wall ? (tot.cards / (tot.wall / 6e4)).toFixed(1) : '-'}장, "알아요" 확인 정답률 ${pct(tot.vok, tot.v)} (${tot.vok}/${tot.v})</p>
    <table><tr><th>날짜</th><th>판</th><th>카드</th><th>시간</th><th>분당</th><th>카드당</th><th>알아요</th><th>확인</th><th>새 카드 앎/모름</th><th>배움</th><th>복습</th><th>보스</th></tr>
    ${R.map((r) => `<tr><td>${r.day}</td><td>${r.n}</td><td>${r.cards}</td><td>${Math.round(r.wall / 1000)}초</td><td>${r.wall ? (r.cards / (r.wall / 6e4)).toFixed(1) : '-'}</td><td>${r.cards ? (r.wall / r.cards / 1000).toFixed(1) : '-'}초</td>
      <td>${r.claims}</td><td>${r.verifyOk}/${r.verifies}</td><td>${r.known}/${r.unknown}</td><td>${r.learned}</td><td>${r.reviewOk}/${r.reviews}</td><td>${r.bosses}</td></tr>`).join('') || '<tr><td colspan="12">기록 없음</td></tr>'}</table>
    <p class="row"><button class="sec" data-act="export" data-id="${id}">기록 내보내기(JSON)</button><button class="link" data-act="reset" data-id="${id}">기록 지우기</button></p>`; };
  $('#app').innerHTML = `<div class="page parent"><button class="back" data-act="home" aria-label="처음으로">‹</button><h1 class="title">부모 기록</h1>
  <p class="small mut">시제품 확인용 수치입니다. 분당 카드는 뜻을 보는 시간까지 포함한 실제 속도, 확인 정답률은 "알아요"라고 한 카드를 뜻 고르기로 확인한 결과입니다. 기록은 이 기기에만 저장됩니다. 소리: ${esc(G.sound.source)}</p>
  ${PROFILES.map(block).join('')}
  <h2>이름</h2><p class="row"><input id="nm-son" value="${esc(name('son'))}" size="8"><input id="nm-daughter" value="${esc(name('daughter'))}" size="8"><button class="sec" data-act="names">저장</button></p></div>`;
}
function download(nm, obj) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = nm; document.body.appendChild(a); a.click(); a.remove(); }

async function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const a = b.dataset.act;
  switch (a) {
    case 'home': return home();
    case 'pick': return today(b.dataset.id);
    case 'today': return today(G.pid);
    case 'start': return start();
    case 'yes': return onJudge(true);
    case 'no': return onJudge(false);
    case 'opt': return onPick(Number(b.dataset.i));
    case 'next': return next();
    case 'hear': await G.sound.unlock(); return speak(true);
    case 'mute-go': { const it = G.run?.current; if (it) it.sound = 'none'; hideBanner(); lock(false); if (G.run) G.run.t0 = Date.now(); return; }
    case 'quit': if (G.run) return endRun('left'); return today(G.pid);
    case 'album': return album();
    case 'peek': { const w = G.byId[b.dataset.id]; if (!w) return; const p = $('#peek'); if (p) p.innerHTML = `<b>${esc(w.form)}</b> ${esc(w.ko)} ${w.emoji || ''}`; await G.sound.unlock(); return G.sound.play(w.id, w.form); }
    case 'parent': return parent();
    case 'export': return download(`cards_${b.dataset.id}_${todayISO()}.json`, load(b.dataset.id));
    case 'reset': if (confirm(`${name(b.dataset.id)}의 카드 기록을 모두 지울까요?`)) { localStorage.removeItem(KEY(b.dataset.id)); } return parent();
    case 'names': G.meta.names = { son: $('#nm-son').value.trim() || '아들', daughter: $('#nm-daughter').value.trim() || '딸' }; localStorage.setItem('cards.v0.meta', JSON.stringify(G.meta)); return parent();
  }
}
boot();
