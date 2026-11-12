// Flashcard prototype: screens. Rules live in deck.js, audio in sound.js.
import { Run, newState, planRun, gradeOf, gradeCounts, mulberry32, CFG } from './deck.js';
import { Sound } from './sound.js';
import { ensureMap, mapView, nodeRun, settleRun, chooseBag, takeBag, Lightning, settleLightning, ITEMS, LIGHTNING_MIN, MONSTER_AT, CASTLE_PASS } from './map.js';

const qs = new URLSearchParams(location.search);
const todayISO = () => qs.get('today') || new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const FAST = qs.get('fast') === '1';                     // test hook: short reveal pauses
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PROFILES = ['son', 'daughter'];
const BOSSES = ['👾', '🦖', '🐙', '🤖', '🐲', '👹', '🦈', '👻', '🦂', '🐊', '🦇', '🦑'];
const GRADE = ['', '동', '은', '금'];
const DAY_MS = 15 * 6e4;                                  // the daily cap
const LT_SECONDS = FAST ? 3 : 60;
const G = { world: null, node: null, lt: null, words: [], byId: {}, meta: null, pid: null, st: null, run: null, boss: null, view: 'home', busy: false, timer: null, sound: null };
window.__cards = G;

// ---- storage (this device only in the prototype) ----
const KEY = (id) => `cards.v0.p.${id}`;
function load(id) { try { return JSON.parse(localStorage.getItem(KEY(id))) || newState(id); } catch { return newState(id); } }
function save() { try { localStorage.setItem(KEY(G.pid), JSON.stringify(G.st)); return true; } catch (e) { banner(`저장에 실패했어요: ${esc(e.message)}`); return false; } }
function loadMeta() { try { return { names: { son: '아들', daughter: '딸' }, ...JSON.parse(localStorage.getItem('cards.v0.meta') || '{}') }; } catch { return { names: { son: '아들', daughter: '딸' } }; } }
const name = (id) => G.meta.names[id];

function banner(html) { const b = $('#banner'); b.innerHTML = html; b.hidden = false; }
function hideBanner() { $('#banner').hidden = true; }
const miniCard = (w, g, cls = '') => `<div class="mini g${g} ${cls}" data-act="peek" data-id="${esc(w.id)}"><b>${esc(w.form)}</b>${g ? `<i>${GRADE[g]}</i>` : ''}</div>`;

// Emoji drawn tiny, then enlarged without smoothing: pixel-art look without any new artwork.
const PXC = {};
function px(emoji, n = 56) {
  const k = emoji + n; if (PXC[k]) return PXC[k];
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  x.font = '13px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, 8, 9);
  const o = document.createElement('canvas'); o.width = o.height = n; const y = o.getContext('2d'); y.imageSmoothingEnabled = false; y.drawImage(c, 0, 0, n, n);
  return (PXC[k] = o.toDataURL());
}
const pimg = (e, n = 56, cls = '') => `<img class="px ${cls}" src="${px(e, n)}" width="${n}" height="${n}" alt="">`;
const usedMs = (st) => st.runs.filter((r) => r.day === todayISO()).reduce((a, r) => a + r.wall, 0);

async function boot() {
  const data = await fetch('data/words.json').then((r) => r.json());
  G.world = data.world; G.words = data.words; G.byId = Object.fromEntries(G.words.map((w) => [w.id, w])); G.meta = loadMeta();
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
const POS = { start: [7, 50], monster: [18, 50], A1: [32, 18], A2: [50, 18], B1: [32, 50], B2: [50, 50], C1: [32, 82], C2: [50, 82], bonus: [68, 20], castle: [84, 50] };
const LINES = [['start', 'A1'], ['A1', 'A2'], ['A2', 'castle'], ['start', 'B1'], ['B1', 'B2'], ['B2', 'castle'], ['start', 'C1'], ['C1', 'C2'], ['C2', 'castle']];
const MSG = { locked: '앞 칸을 먼저 깨요', blocked: '몬스터가 길을 막고 있어요. 먼저 물리쳐요', castleLocked: '두 길을 모두 깨면 성이 열려요', bonusLocked: `카드를 ${LIGHTNING_MIN}장 이상 익히면 열려요`, used: '오늘 보너스는 받았어요. 내일 또 열려요' };
function today(id, msg = '') {
  G.view = 'today'; G.pid = id; G.st = load(id); G.run = null; G.lt = null; hideBanner(); clearTimeout(G.timer);
  const st = G.st; const m = ensureMap(st); const v = mapView(G.world, st, todayISO()); const c = gradeCounts(st, G.words);
  const used = usedMs(st); const over = used >= DAY_MS && !FAST;
  const node = (key, e, label, status, extra = '') => { const [x, y] = POS[key];
    return `<button class="node ${status} ${extra}" data-act="node" data-id="${key}" style="left:${x}%;top:${y}%" aria-label="${esc(label)}">${pimg(e, 56, status === 'locked' || status === 'blocked' ? 'dim' : '')}<span class="lbl">${esc(label)}</span>${status === 'cleared' ? '<i class="flag">🚩</i>' : ''}${extra.includes('bonus') ? '<i class="x2">×2</i>' : ''}</button>`; };
  const tiles = v.roads.flatMap((r) => r.tiles.map((t) => node(t.id, r.icon, `${r.name.split(' ')[0]} ${t.id.slice(1)}`, t.status, t.bonus ? 'bonus' : '')));
  const lines = LINES.map(([a, b]) => `<line x1="${POS[a][0]}" y1="${POS[a][1]}" x2="${POS[b][0]}" y2="${POS[b][1]}"/>`).join('');
  $('#app').innerHTML = `<div class="page map"><button class="back" data-act="home" aria-label="처음으로">‹</button>
  <div class="maphud"><b class="who">${esc(name(id))}</b><span class="chip">⭐ ${v.stars}</span><span class="chip">🔑 ${v.keys}</span><span class="chip mut">오늘 ${Math.floor(used / 6e4)}분</span></div>
  <div class="world" id="world"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
    <div class="node start" style="left:${POS.start[0]}%;top:${POS.start[1]}%">${pimg('🚩', 56)}<span class="lbl">출발</span></div>
    ${tiles.join('')}
    ${v.monster.present ? node('monster', '👾', `복습 몬스터 ${v.monster.count}`, 'open', 'mon') : ''}
    ${node('bonus', '🏡', '보너스 집', v.bonus.status === 'used' ? 'cleared' : v.bonus.status === 'open' ? 'open' : 'locked')}
    ${node('castle', '🏰', v.worldDone ? '클리어!' : '성', v.castle.status)}</div>
  <p class="msg" id="msg">${esc(msg || (over ? '오늘은 여기까지! 내일 또 만나요.' : v.monster.present ? `복습 ${v.monster.count}장이 쌓였어요. 몬스터부터 물리쳐요!` : '가고 싶은 길을 골라요'))}</p>
  <div class="bag"><span class="mut">가방</span>${Object.entries(ITEMS).map(([k, it]) => `<button class="item ${v.bag === k ? 'sel' : ''}" data-act="bag" data-item="${k}" ${m.items[k] < 1 ? 'disabled' : ''} title="${esc(it.info)}">${pimg(it.emoji, 40)}<b>×${m.items[k]}</b></button>`).join('')}
    <span class="mut small">${v.bag ? esc(ITEMS[v.bag].name + ': ' + ITEMS[v.bag].info) : '다음 판에 쓸 아이템을 골라요'}</span></div>
  <div class="shelf"><div class="bar">${[3, 2, 1, 0].map((g) => `<i class="g${g}" style="flex:${c[g]}"></i>`).join('')}</div>
    <div class="legend"><span class="g3">금 ${c[3]}</span><span class="g2">은 ${c[2]}</span><span class="g1">동 ${c[1]}</span><span class="g0">아직 ${c[0]}</span></div>
    <button class="sec" data-act="album">카드첩 보기</button></div>
  <p class="mut small center" id="src">소리: ${esc(G.sound.source)}</p></div>`;
}
function nodeClick(id) {
  const st = G.st; const v = mapView(G.world, st, todayISO()); const out = (t) => { const e = $('#msg'); if (e) e.textContent = t; };
  if (usedMs(st) >= DAY_MS && !FAST) return out('오늘은 여기까지! 내일 또 만나요.');
  if (id === 'bonus') { if (v.bonus.status === 'open') return startLightning(); return out(v.bonus.status === 'used' ? MSG.used : MSG.bonusLocked); }
  if (id === 'castle' && v.castle.status === 'locked') return out(MSG.castleLocked);
  if (id === 'castle' && v.castle.status === 'cleared') return out('이 성은 이미 깼어요. 🔑');
  const t = v.roads.flatMap((r) => r.tiles).find((x) => x.id === id);
  if (t && t.status === 'locked') return out(MSG.locked);
  if ((t && t.status === 'blocked') || (id === 'castle' && v.castle.status === 'blocked')) return out(MSG.blocked);
  if (t && t.status === 'cleared') return out('이 칸은 이미 깼어요. 🚩');
  return start(id);
}

// ---- run ----
async function start(nodeId) {
  await G.sound.unlock();                                  // inside the tap
  const seed = Number(qs.get('seed')) || Math.floor(Math.random() * 1e9); const rng = mulberry32(seed + G.st.runs.length);
  const v = mapView(G.world, G.st, todayISO()); const node = nodeRun(G.world, v, nodeId, G.st, G.words, rng); if (!node) return today(G.pid);
  const items = takeBag(G.st); G.node = node; save();
  if (!G.boss || G.boss.day !== todayISO() || G.boss.pid !== G.pid) G.boss = { idx: 0, hp: CFG.bossHp, defeated: 0, day: todayISO(), pid: G.pid };
  G.run = new Run({ state: G.st, words: G.words, today: todayISO(), rng, boss: G.boss, scope: node.scope, items, tag: node.tag });
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
  const b = G.run.boss; const be = BOSSES[b.idx % BOSSES.length]; if ($('#boss').dataset.e !== be) { $('#boss').dataset.e = be; $('#boss').innerHTML = pimg(be, 56); } $('#hp').style.width = `${Math.max(0, b.hp) / CFG.bossHp * 100}%`;
  $('#combo').textContent = (G.run.items.shield ? '🍄 ' : '') + (G.run.items.flame ? '🌸 ' : '') + (G.run.combo >= 2 ? `연속 ${G.run.combo}` : ''); $('#combo').classList.toggle('hot', G.run.combo >= 5);
  $('#left').textContent = `남은 카드 ${G.run.left}`;
}
const TAG = { castle: '성 시험', new: '새 카드', review: '다시 만난 카드', likely: '다시 만난 카드', relearn: '방금 배운 카드', practice: '한 번 더', retry: '다시 도전' };
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
    card.innerHTML = `${w.emoji ? `<div class="emoji">${pimg(w.emoji, 88)}</div>` : ''}<div class="ko">${esc(w.ko)}</div><div class="word small">${esc(w.form)}</div>${line ? `<div class="line">${line}</div>` : ''}`;
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
  clearTimeout(G.timer); G.sound.stop(); const run = G.run; const node = G.node; const rec = run.finish(reason); G.boss = { ...run.boss, day: todayISO(), pid: G.pid };
  const rw = settleRun(G.world, G.st, node, run, rec, todayISO(), mulberry32(Date.now() % 1e9)); save();
  G.view = 'end'; hideBanner(); const n = rec.n; const ups = run.changed.filter((c) => c.to > c.from);
  const title = { tile: rw.cleared ? '칸 클리어!' : `${n}판 끝!`, monster: rw.cleared ? '몬스터를 물리쳤어요!' : '몬스터가 남았어요', castle: rw.key ? '성을 깼어요!' : '성 시험 결과' }[node.kind];
  const lines = [`<div class="gain">⭐ +${rw.stars}${rw.mult > 1 ? ` <em>(×${rw.mult})</em>` : ''}</div>`];
  if (rw.item) lines.push(`<div class="gain">${pimg(ITEMS[rw.item].emoji, 40)} ${ITEMS[rw.item].name}을 얻었어요</div>`);
  if (rw.key) lines.push('<div class="gain">🔑 열쇠를 얻었어요</div>');
  if (rw.castle && !rw.key) lines.push(`<p class="mut">${rw.castle.ok}/${rw.castle.total}장 맞혔어요. ${Math.round(CASTLE_PASS * 100)}% 이상이면 통과예요. 틀린 카드는 내일 다시 나와요.</p>`);
  $('#app').innerHTML = `<div class="page center"><h1 class="title">${title}</h1>${lines.join('')}
  <div class="tiles"><div><b>${rec.cards}</b><span>넘긴 카드</span></div><div><b>${rec.bosses}</b><span>잡은 보스</span></div><div><b>${rec.learned}</b><span>새로 배운 카드</span></div></div>
  ${ups.length ? `<p class="mut">등급이 오른 카드</p><div class="minis">${ups.map((c) => miniCard(G.byId[c.id], c.to)).join('')}</div>` : ''}
  <button class="go" data-act="today">▶ 지도로</button></div>`;
  G.run = null; G.node = null;
}

// ---- lightning round (bonus house): true / false pairs, 60 seconds, touches no word ----
async function startLightning() {
  await G.sound.unlock(); const rng = mulberry32((Number(qs.get('seed')) || Date.now() % 1e9) + 7);
  G.lt = new Lightning({ state: G.st, words: G.words, rng, seconds: LT_SECONDS }); if (!G.lt.ready) return today(G.pid, MSG.bonusLocked);
  G.view = 'lightning'; G.ltEnd = Date.now() + LT_SECONDS * 1000;
  $('#app').innerHTML = `<div class="run"><header class="hud"><button class="x" data-act="lt-quit" aria-label="그만하기">✕</button><div class="ltbar"><i id="ltbar"></i></div><div class="combo" id="ltscore">0</div></header>
  <section class="stage"><div class="card" id="card"></div></section>
  <footer class="actions"><button class="act no" data-act="lt-no">아니에요 ✕</button><button class="act yes" data-act="lt-yes">맞아요 ○</button></footer></div>`;
  ltNext(); G.timer = setInterval(ltTick, 100);
}
function ltNext() { const c = G.lt.next(); $('#card').className = 'card in'; $('#card').innerHTML = `<div class="tag">단어와 뜻이 맞을까요?</div><div class="word">${esc(c.form)}</div><div class="ko mid">${esc(c.ko)}</div>`; G.sound.play(c.id, c.form); }
function ltTick() { const left = G.ltEnd - Date.now(); const bar = $('#ltbar'); if (bar) bar.style.width = `${Math.max(0, left) / (LT_SECONDS * 10)}%`; if (left <= 0) ltEnd(); }
function ltAnswer(says) {
  if (G.view !== 'lightning') return; const ok = G.lt.answer(says); G.sound.blip(ok ? 'hit' : 'miss'); $('#ltscore').textContent = G.lt.score;
  $('#card').classList.add(ok ? 'okflash' : 'badflash'); setTimeout(() => { if (G.view === 'lightning') ltNext(); }, FAST ? 10 : 160);
}
function ltEnd() {
  clearInterval(G.timer); if (G.view !== 'lightning') return; G.view = 'end'; G.sound.stop();
  const r = settleLightning(G.st, G.lt, todayISO()); save(); const sc = G.lt.score;
  $('#app').innerHTML = `<div class="page center"><h1 class="title">번개 끝!</h1><div class="tiles"><div><b>${sc}</b><span>맞힌 수</span></div><div><b>${G.st.map.best}</b><span>내 최고 기록</span></div></div>
  ${r.newBest ? '<div class="gain">새 기록!</div>' : ''}${r.item ? `<div class="gain">${pimg(ITEMS[r.item].emoji, 40)} ${ITEMS[r.item].name}을 얻었어요</div>` : r.first ? '<p class="mut">3개 이상 맞히면 아이템을 줘요</p>' : ''}
  <button class="go" data-act="today">▶ 지도로</button></div>`;
  G.lt = null;
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
    return `<h2>${esc(name(id))}</h2><p class="small">별 ${ensureMap(st).stars} · 열쇠 ${ensureMap(st).keys} · 깬 칸 ${Object.keys(ensureMap(st).cleared).length}/6 · 번개 최고 ${ensureMap(st).best} · 금 ${c[3]} · 은 ${c[2]} · 동 ${c[1]} · 아직 ${c[0]} / 전체 ${R.length}판, 카드 ${tot.cards}장, 분당 ${tot.wall ? (tot.cards / (tot.wall / 6e4)).toFixed(1) : '-'}장, "알아요" 확인 정답률 ${pct(tot.vok, tot.v)} (${tot.vok}/${tot.v})</p>
    <table><tr><th>날짜</th><th>판</th><th>칸</th><th>카드</th><th>시간</th><th>분당</th><th>카드당</th><th>알아요</th><th>확인</th><th>새 카드 앎/모름</th><th>배움</th><th>복습</th><th>보스</th></tr>
    ${R.map((r) => `<tr><td>${r.day}</td><td>${r.n}</td><td>${r.tag || '-'}</td><td>${r.cards}</td><td>${Math.round(r.wall / 1000)}초</td><td>${r.wall ? (r.cards / (r.wall / 6e4)).toFixed(1) : '-'}</td><td>${r.cards ? (r.wall / r.cards / 1000).toFixed(1) : '-'}초</td>
      <td>${r.claims}</td><td>${r.verifyOk}/${r.verifies}</td><td>${r.known}/${r.unknown}</td><td>${r.learned}</td><td>${r.reviewOk}/${r.reviews}</td><td>${r.bosses}</td></tr>`).join('') || '<tr><td colspan="13">기록 없음</td></tr>'}</table>
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
    case 'node': return nodeClick(b.dataset.id);
    case 'bag': chooseBag(G.st, b.dataset.item); save(); return today(G.pid);
    case 'lt-yes': return ltAnswer(true);
    case 'lt-no': return ltAnswer(false);
    case 'lt-quit': clearInterval(G.timer); G.lt = null; return today(G.pid);
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
