import { Store, PROFILES } from './store.js';
import { Catalog } from './catalog.js';
import { AudioEngine } from './audio.js';
import { planSession, Session } from './session.js';
import { mulberry32 } from './questions.js';
import { ART, SCENE_BG, artFor } from './art.js';
import { Sync } from './sync.js';

const qs = new URLSearchParams(location.search);
const todayISO = () => qs.get('today') || new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const SPEED = Number(qs.get('speed') || 1);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const G = { store: null, meta: null, cat: null, scenes: {}, engine: null, sess: null, pid: null, today: todayISO(), ms: 0, view: 'home', fb: null, spell: null };
window.__cu = G;

async function boot() {
  let storage; try { storage = window.localStorage; storage.setItem('_t', '1'); storage.removeItem('_t'); }
  catch { storage = null; }
  const { memoryStorage } = await import('./store.js');
  G.volatile = !storage; G.store = new Store(storage || memoryStorage());
  G.syncStatus = { available: false, pending: [] };
  if (storage && qs.get('nosync') !== '1') {
    G.sync = new Sync({ storage, fetchImpl: (u, o) => fetch(u, o), debounceMs: 800, onMerged, onStatus: (st) => { G.syncStatus = st; paintSync(); } });
    await G.sync.init();
    G.store.onWrite = (name) => G.sync.changed(name);
  }
  G.meta = G.store.meta();
  const [cat, scenes, man] = await Promise.all(['data/catalog.json', 'data/scenes.json', 'audio/manifest.json'].map((u) => fetch(u).then((r) => r.json()).catch(() => null)));
  G.cat = new Catalog(cat); G.scenes = scenes || {};
  G.engine = new AudioEngine({ manifest: man?.entries || {}, speech: window.speechSynthesis || null });
  G.engine.on((e) => { if (e.type === 'fail') showBanner(e.key); if (e.type === 'play') hideBanner(); });
  document.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibility);
  setInterval(tick, 1000);
  route();
  window.addEventListener('hashchange', route);
}

// ---- server copy ----------------------------------------------------------------
// Another device saved newer data: fold it into what this page holds in memory.
function onMerged(name, data) {
  if (name === 'meta') { G.meta = G.store.meta(); return; }
  const p = G.sessProfile;
  if (p && name === 'p.' + p.id && data) { for (const k of Object.keys(p)) if (!(k in data)) delete p[k]; Object.assign(p, data); }
}
function syncLine() {
  const st = G.syncStatus;
  if (G.volatile) return '이 브라우저는 저장을 막고 있어요. 기록이 새로고침 후 사라질 수 있습니다.';
  if (!G.sync) return '기록 저장: 이 기기만 (서버 저장 꺼짐)';
  if (!st.available) return '기록 저장: 이 기기만. Mac의 서버(tools/serve.py)에 연결되지 않았어요.';
  return st.pending.length ? '기록 저장: 서버에 올리는 중…' : '기록 저장: 이 기기 + Mac 서버';
}
function paintSync() { const el = document.getElementById('syncline'); if (el) el.textContent = syncLine(); }

// ---- timer -------------------------------------------------------------------
const usedMs = (p) => p.sessions.filter((x) => x.day === G.today).reduce((a, x) => a + x.ms, 0) + (p.activeSession?.day === G.today ? p.activeSession.ms : 0);
let lastTick = Date.now();
function tick() {
  const n = Date.now(); const d = Math.min(n - lastTick, 3000); lastTick = n;
  if (G.sess && !document.hidden && G.view !== 'end') { const before = Math.floor(G.ms / 15000); G.ms += d * SPEED; updateClock(); if (Math.floor(G.ms / 15000) !== before) save(); }
}
const limitMs = () => Math.max(0, G.meta.settings.sessionMinutes * 6e4 - G.usedToday);
function updateClock() {
  const left = Math.max(0, limitMs() - G.ms); const m = Math.floor(left / 6e4), s = Math.floor(left / 1000) % 60;
  $('#clock').textContent = `${m}:${String(s).padStart(2, '0')}`;
  G.timeUp = left <= 0;
}
function onVisibility() {
  lastTick = Date.now();
  if (document.hidden) { G.sync?.flush().catch(() => {}); return; }
  G.sync?.flush().catch(() => {});
  // Back from lock / app switch: try the prompt again. If the browser refuses to play
  // without a tap, the normal failure banner offers "다시 듣기".
  const t = G.sess?.current; if (!t) return;
  if (G.view === 'learn') say(t.cardId, { force: true });
  else if (G.view === 'question' && !G.fb && t.q.autoAudio) say(t.q.audioKey, { force: true });
}

// ---- helpers -----------------------------------------------------------------
const name = (id) => G.meta.names[id];
function curScene() {
  const pk = Object.values(viewProfile().packs).find((x) => x.scene && G.scenes[x.scene]); return pk ? { id: pk.scene, ...G.scenes[pk.scene] } : null;
}
const viewProfile = () => G.sessProfile && G.sessProfile.id === G.pid ? G.sessProfile : (G.viewP && G.viewP.id === G.pid ? G.viewP : (G.viewP = G.store.profile(G.pid)));
const art = (cardId, form) => artFor(cardId, form, G.sessScene, G.cat.with(viewProfile().localCards));
const hasArt = (c) => !!artFor(c.id, c.form, G.sessScene, G.cat);
function artHtml(cardId, form) { const a = art(cardId, form); return a ? a.html : ''; }
function showBanner(key, mode) {
  const b = $('#banner'); b.hidden = false;
  b.innerHTML = `<span>${mode === 'return' ? '돌아왔어요. 소리를 다시 들어요.' : '소리가 나지 않았어요.'} 볼륨과 무음 스위치를 확인하세요.</span>
    <button data-act="retry-audio">다시 듣기</button>${G.sess ? '<button class="ghost" data-act="skip-audio">소리 없이 넘기기(부모)</button>' : ''}`;
}
function hideBanner() { $('#banner').hidden = true; G.sess?.audioRecovered(); lock(false); }
function lock(on) { document.querySelectorAll('.opt,.tile').forEach((b) => b.classList.toggle('locked', on && !!G.sess?.current?.q?.needsSound)); }
function textFor(key) { const id = key.split('#')[0]; if (!G.pid) return ''; const p = viewProfile(); const c = G.cat.with(p.localCards).card(id);
  if (!c) return ''; return key.endsWith('#s') ? p.cards[id]?.context || c.form : c.form; }
async function say(key, opts = {}) {
  if (!key) return { ok: true };
  const r = await G.engine.play(key, { text: textFor(key), ...opts });
  if (!r.ok && !r.stale) { G.sess?.audioFailed(); showBanner(key); lock(true); }
  else if (r.ok) {
    if (!r.deduped) hideBanner();
    const t = G.sess?.current;
    if (t?.kind === 'question' && key === (t.q.audioKey || null)) { G.sess.audioPlayed(); lock(false); }
    if (t?.kind === 'learn' && key === t.cardId) { G.sess.audioPlayed(); const b = document.getElementById('learn-next'); if (b) b.disabled = false; }
  }
  return r;
}
function setBar(on) { $('#bar').hidden = !on; $('#who').textContent = G.pid ? name(G.pid) : ''; $('#replay').style.display = G.sess ? '' : 'none'; $('#clock').style.display = G.sess ? '' : 'none'; if (!on) hideBannerQuiet(); }
const sessionSample = (p) => { const ids = [...new Set(p.log.filter((e) => e.day === G.today && e.type !== 'learn').map((e) => e.card))]; return ids.length > 0 && ids.every((i) => p.cards[i]?.sample); };
function hideBannerQuiet() { $('#banner').hidden = true; }
function save() {
  // In-progress marker so a reload mid-session still counts the time. Never written once the session has ended.
  if (G.sess && !G.sess.ended && G.sessProfile) G.sessProfile.activeSession = { day: G.today, ms: Math.round(G.ms), sample: sessionSample(G.sessProfile) };
  if (!G.store.saveProfile(G.sessProfile)) { const b = $('#banner'); b.hidden = false; b.textContent = '저장에 실패했어요. 부모에게 알려 주세요: ' + G.store.lastError; } }

// ---- routing -----------------------------------------------------------------
function route() {
  const h = location.hash;
  if (h === '#/parent') return parent();
  if (h === '#/review') return reviewPage();
  if (h === '#/selftest') return selftest();
  if (G.sess && G.view !== 'home') return;
  home();
}
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

// ---- home / profile -----------------------------------------------------------
function counts(id) {
  const p = G.store.profile(id); const recs = Object.values(p.cards);
  return { lit: recs.filter((r) => r.known === '앎' && r.streak > 0).length, total: recs.length, due: recs.filter((r) => r.introduced && r.due && r.due <= G.today).length,
    fresh: recs.filter((r) => !r.introduced).length, sample: recs.some((r) => r.sample) };
}
function home() {
  G.today = todayISO(); G.view = 'home'; G.sess = null; G.sessProfile = null; G.viewP = null; G.pid = null; setBar(false);
  const c = PROFILES.map(counts); const family = c.reduce((a, x) => a + x.lit, 0);
  $('#app').innerHTML = `<h1>Catch-up 어휘 탐험</h1>
  <p class="mut">누가 할까요?</p>
  <div class="profiles">${PROFILES.map((id, i) => `<button class="profile" data-act="pick" data-id="${id}"><span>${esc(name(id))}</span>
    <span class="small mut">${c[i].total ? `오늘 새 단어 ${Math.min(c[i].fresh, G.meta.settings.newPerSession)}개 · 복습 ${c[i].due}개` : '아직 단어 팩이 없어요'}</span>
    ${c[i].sample ? '<span class="pill sample">데모 데이터</span>' : ''}</button>`).join('')}</div>
  <div class="card center"><b>우리 집에 켜진 불: ${family}개</b><div class="small mut">두 사람이 함께 모은 숫자예요.</div></div>
  <p class="center"><button class="ghost" data-act="parent">부모 메뉴</button></p>
  <p class="center small mut" id="syncline">${esc(syncLine())}</p>`;
}
async function profileView(id) {
  if (G.sync?.available) { try { await G.sync.reconcile('p.' + id); } catch {} }
  G.today = todayISO(); G.pid = id; G.viewP = null; G.sessProfile = null; G.view = 'profile'; G.sessScene = curScene(); setBar(true); $('#clock').style.display = 'none'; $('#replay').style.display = 'none';
  const p = G.store.profile(id); const s = G.meta.settings;
  const usedToday = usedMs(p);
  const plan = planSession({ profile: p, today: G.today, settings: s, catalog: G.cat });
  const left = Math.max(0, s.sessionMinutes * 6e4 - usedToday);
  const empty = !plan.reviews.length && !plan.newIds.length;
  const sc = G.sessScene;
  $('#app').innerHTML = `<h2>${esc(name(id))}의 오늘</h2>
  ${sc ? `<div class="scene">${SCENE_BG[sc.id] || ''}${sc.items.map((it) => { const r = p.cards[it.card]; const on = r && r.known === '앎' && r.streak > 0;
    return r ? `<div class="item ${on ? 'on' : 'off'}" style="left:${it.x}%;top:${it.y}%">${ART[it.art]}</div>` : ''; }).join('')}</div>
  <p class="small mut">${esc(sc.title)}${sc.sample ? ' (자작 데모 장면)' : ''} · 불이 켜진 물건은 혼자 맞힌 단어예요.</p>` : ''}
  <div class="card"><div>새 단어 <b>${plan.newIds.length}</b>개 · 복습 <b>${plan.reviews.length}</b>개${plan.dueTotal > plan.reviews.length ? ` (밀린 복습 ${plan.dueTotal - plan.reviews.length}개는 다음에)` : ''}</div>
  <div class="small mut">장면에 남은 새 단어 ${plan.newRemaining}개 · 오늘 남은 시간 ${Math.floor(left / 6e4)}분</div></div>
  <p class="row"><button data-act="start" ${empty || left <= 0 ? 'disabled' : ''}>소리 켜고 시작</button>
  <button class="sec" data-act="home">돌아가기</button></p>
  ${empty ? '<p class="mut">오늘 할 단어가 없어요. 부모 메뉴에서 단어 팩을 가져오세요.</p>' : ''}
  ${left <= 0 ? '<p class="mut">오늘 15분을 다 썼어요. 내일 만나요.</p>' : ''}`;
}

// ---- session -------------------------------------------------------------------
async function startSession() {
  G.today = todayISO(); const id = G.pid; const p = G.store.profile(id); G.sessProfile = p;
  const ok = await G.engine.unlock();                     // inside the tap handler
  if (p.activeSession) { p.sessions.push({ ...p.activeSession, reason: 'interrupted' }); delete p.activeSession; }
  G.usedToday = usedMs(p);
  G.ms = 0; lastTick = Date.now();
  const plan = planSession({ profile: p, today: G.today, settings: G.meta.settings, catalog: G.cat });
  const seed = Number(qs.get('seed')) || Math.floor(Math.random() * 1e9);
  G.sess = new Session({ profile: p, catalog: G.cat, plan, today: G.today, rng: mulberry32(seed), hasArt, onChange: save });
  G.view = 'soundcheck'; setBar(true); $('#prog').textContent = ''; updateClock();
  $('#app').innerHTML = `<h2>소리 확인</h2><div class="card center"><p>소리를 켜고 버튼을 눌러 보세요.</p>
  <button data-act="sc-play">🔊 소리 들어 보기</button>
  <p id="sc-msg" class="mut">${ok ? '' : '이 기기는 아직 소리를 허용하지 않았어요. 버튼을 다시 눌러 보세요.'}</p>
  <div class="row" style="justify-content:center"><button data-act="sc-yes" disabled id="sc-yes">들렸어요</button><button class="sec" data-act="sc-no">안 들려요</button></div></div>`;
}
async function soundCheck() {
  const r = await G.engine.play('__soundcheck', { force: true, text: 'Sound check. Can you hear me?' });
  $('#sc-msg').textContent = r.ok ? '들렸으면 "들렸어요"를 눌러요.' : '소리를 재생하지 못했어요. 볼륨과 무음 스위치를 확인하고 다시 눌러요.';
  $('#sc-yes').disabled = !r.ok;
}
function next() {
  const s = G.sess; G.fb = null; G.spell = null;
  if (G.timeUp && s.current && G.view !== 'end') { /* finish after current item */ }
  const t = s.current;
  if (!t || (G.timeUp && t.kind !== 'learn' && s.index > 0)) return endSession(t ? 'time' : 'done');
  if (G.timeUp && t.kind === 'learn') return endSession('time');
  const done = s.index, total = s.total; $('#prog').textContent = `${Math.min(done + 1, total)} / ${total}`;
  if (t.kind === 'learn') return learnView(t);
  questionView(t);
}
function learnView(t) {
  G.view = 'learn'; const s = G.sess; const p = s.p; const c = s.cat.card(t.cardId); const r = p.cards[t.cardId]; const sc = G.sessScene;
  const idx = s.plan.newIds.indexOf(t.cardId);
  const parts = r.context && new RegExp(`\\b(${c.form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
  const sent = r.context ? esc(r.context).replace(parts, '<mark>$1</mark>') : '';
  $('#app').innerHTML = `<div class="pill">새 단어 ${idx + 1} / ${s.plan.newIds.length}</div>
  ${sc ? `<div class="scene">${SCENE_BG[sc.id] || ''}${sc.items.map((it) => {
      if (!p.cards[it.card]) return '';
      const cls = it.card === t.cardId ? 'focus' : (p.cards[it.card].introduced || s.plan.newIds.includes(it.card)) ? '' : 'dim';
      return `<button class="item ${cls}" data-act="tap-item" data-id="${esc(it.card)}" style="left:${it.x}%;top:${it.y}%" aria-label="그림">${ART[it.art]}</button>`; }).join('')}</div>`
    : `<div class="card center"><div style="font-size:80px">${artHtml(c.id, c.form)}</div></div>`}
  <div class="card center"><div class="big">${esc(c.form)}</div>
    <div class="ipa">${c.ipa ? esc(c.ipa) + ' <span class="small">(참고 표기)</span>' : ''}</div>
    <div class="meaning">${esc(c.meaning)}</div>
    ${sent ? `<div class="sent">${sent}</div>` : ''}
    <div class="row" style="justify-content:center"><button class="sec" data-act="hear" data-key="${esc(c.id)}">🔊 단어</button>
    ${sent ? `<button class="sec" data-act="hear" data-key="${esc(c.id)}#s">🔊 문장</button>` : ''}</div>
    ${r.sample ? '<div class="small mut">자작 예문 · 데모</div>' : r.page ? `<div class="small mut">책 p.${esc(r.page)}에서 찾아보기</div>` : ''}
  </div><p class="center"><button data-act="learn-next" id="learn-next" disabled>다음 ▶</button></p>`;
  say(c.id, { ctx: 'learn:' + G.sess.index });                 // "다음" opens only after the word was actually played
}
function questionView(t) {
  G.view = 'question'; const s = G.sess; const q = t.q; t.startMs = null; G.fb = null;
  const lbl = { 'sound-pic': '듣고 그림 찾기', 'sound-meaning': '듣고 뜻 고르기', 'word-meaning': '단어의 뜻은?', cloze: '빈칸에 알맞은 단어', spell: '들은 단어를 쓰기' }[q.type];
  let body = '';
  const opts = q.options.map((o, i) => o.kind === 'art'
    ? `<button class="opt" data-act="ans" data-i="${i}" aria-label="그림 ${i + 1}"><span class="art">${artHtml(o.cardId, s.cat.card(o.cardId).form)}</span></button>`
    : `<button class="opt" data-act="ans" data-i="${i}">${esc(o.label)}</button>`).join('');
  if (q.type === 'sound-pic') body = `<div class="center"><button data-act="replay" style="font-size:40px;min-height:90px">🔊 듣기</button></div><div class="grid g2">${opts}</div>`;
  else if (q.type === 'sound-meaning') body = `<div class="center"><button data-act="replay" style="font-size:40px;min-height:90px">🔊 듣기</button></div><div class="grid g1">${opts}</div>`;
  else if (q.type === 'word-meaning') body = `<div class="card center"><div class="big">${esc(q.form)}</div><button class="sec" data-act="replay">🔊</button></div><div class="grid g1">${opts}</div>`;
  else if (q.type === 'cloze') body = `<div class="card sent">${esc(q.parts.before)}<span class="blank" id="blank">&nbsp;</span>${esc(q.parts.after)}</div><div class="grid g1">${opts}</div>`;
  else { G.spell = { letters: [], used: new Set() };
    body = `<div class="center"><button data-act="replay" style="font-size:40px;min-height:90px">🔊 듣기</button><div class="meaning">${esc(q.meaning)}</div></div>
      <div class="slots" id="slots">${q.target.split('').map(() => '<div class="slot"></div>').join('')}</div>
      <div class="tiles" id="tiles">${q.tiles.map((x, i) => `<button class="tile" data-act="tile" data-i="${i}">${x.ch}</button>`).join('')}</div>
      <p class="center"><button class="sec" data-act="undo">지우기</button></p>`; }
  $('#app').innerHTML = `<div class="pill">${lbl}${t.retry ? ' · 다시 도전' : ''}${t.round === 'review' ? ' · 복습' : ''}</div>${body}
    <div id="fb"></div><p class="center"><button class="ghost" data-act="hint" id="hintbtn">힌트 보기</button></p>`;
  if (q.needsSound) lock(true);
  if (q.autoAudio) say(q.audioKey, { ctx: 'q:' + s.index + ':' + (t.retry ? 'r' : '') });
}
async function answer(val) {
  const s = G.sess; const t = s.current; if (!t || G.fb) return; const q = t.q;
  const v = s.submit(val); if (v.blocked) return;
  const right = v.correct; G.fb = v;
  const btns = [...document.querySelectorAll('.opt')];
  if (q.type !== 'spell') { btns.forEach((b, i) => { b.disabled = true; if (i === q.answer) b.classList.add('right'); else if (i === val) b.classList.add('wrong'); }); }
  const c = s.cat.card(q.cardId); const r = s.p.cards[q.cardId];
  if (q.type === 'cloze') { $('#blank').textContent = q.parts.word; }
  $('#fb').innerHTML = `<div class="fb ${right ? 'right' : 'wrong'}"><b>${right ? (t.hint ? '좋아요! (힌트 사용)' : '맞아요!') : '정답을 같이 볼까요?'}</b>
    <div><span class="big" style="font-size:36px">${esc(c.form)}</span> ${esc(c.meaning)}</div>
    ${q.type === 'cloze' ? `<div class="sent">${esc(r.context)}</div>` : ''}
    <div class="row"><button class="sec" data-act="hear" data-key="${esc(c.id)}">🔊 단어</button>${r.context ? `<button class="sec" data-act="hear" data-key="${esc(c.id)}#s">🔊 문장</button>` : ''}</div></div>
    <p class="center"><button data-act="q-next" id="qnext">다음 ▶</button></p>`;
  document.getElementById('hintbtn').style.display = 'none';
  document.getElementById('qnext').scrollIntoView({ block: 'end' });      // keep "다음" on screen on iPad landscape
  // feedback audio: wrong -> the correct word; cloze -> the full sentence afterwards.
  say(q.type === 'cloze' && right ? c.id + '#s' : c.id, { ctx: 'fb:' + s.index, force: !right });
}

function endSession(reason) {
  const s = G.sess; const sum = s.finish(reason); G.view = 'end'; G.engine.stop();
  const p = s.p; p.sessions.push({ day: G.today, ms: Math.round(G.ms), reason, sample: sessionSample(p), newIntroduced: sum.newIntroduced, reviewed: sum.reviewed,
    independent: sum.independent, hinted: sum.hinted, wrong: sum.wrong, audioFail: sum.audioFail, endedAt: new Date().toISOString() });
  delete p.activeSession; save(); G.sync?.flush().catch(() => {}); setBar(true); $('#clock').style.display = 'none'; $('#replay').style.display = 'none'; hideBannerQuiet();
  const todayIds = new Set(p.log.filter((e) => e.day === G.today && e.type !== 'learn').map((e) => e.card));
  const seen = [...todayIds].map((id) => ({ id, c: s.cat.card(id), r: p.cards[id] })).filter((x) => x.c);
  const lit = seen.filter((x) => x.r.lastOutcome === 'independent' && x.r.lastScoredDay === G.today);
  const again = seen.filter((x) => x.r.lastScoredDay === G.today && x.r.lastOutcome !== 'independent');
  $('#app').innerHTML = `<h1>${reason === 'time' ? '오늘은 여기까지!' : '오늘 끝!'}</h1>
  <div class="card"><p>오늘 ${Math.max(1, Math.round(G.ms / 6e4))}분 했어요. 새로 만난 단어 ${sum.newIntroduced}개, 복습 ${sum.reviewed}개.</p>
  ${lit.length ? `<p><b>혼자 맞힌 단어</b> (소리 도움을 받은 게임 결과): ${lit.map((x) => esc(x.c.form)).join(', ')}</p>` : ''}
  ${again.length ? `<p><b>내일 다시 볼 단어</b>: ${again.map((x) => esc(x.c.form)).join(', ')}</p>` : ''}
  <p class="mut small">오늘 책을 읽을 때 이 단어들을 찾아보세요${seen.some((x) => x.r.page && !x.r.sample) ? ': ' + seen.filter((x) => x.r.page && !x.r.sample).map((x) => `${esc(x.c.form)} (p.${esc(x.r.page)})`).join(', ') : '.'}</p>
  ${sum.audioFail ? `<p class="fb wrong small">소리 오류 ${sum.audioFail}번이 기록되었어요(부모 확인용).</p>` : ''}</div>
  <p class="center"><button data-act="home">처음으로</button></p>`;
  G.sess = null;
}

// ---- parent -------------------------------------------------------------------
let gateOk = false;
function parent() {
  G.view = 'parent'; setBar(false); G.sess = null;
  if (!gateOk) { const a = 6 + Math.floor(Math.random() * 4), b = 4 + Math.floor(Math.random() * 5); G.gate = a + b;
    $('#app').innerHTML = `<h2>부모 메뉴</h2><div class="card"><p>${a} + ${b} = ?</p><input id="gate" inputmode="numeric" size="4"> <button data-act="gate">확인</button> <button class="sec" data-act="home">돌아가기</button></div>`; return; }
  const m = G.engine.manifest; const cnt = {}; Object.values(m).forEach((e) => { cnt[e.status] = (cnt[e.status] || 0) + 1; });
  const prof = PROFILES.map((id) => { const p = G.store.profile(id); return `<tr><td>${esc(name(id))}</td><td>${Object.keys(p.packs).map((k) => esc(k) + (p.packs[k].sample ? ' (데모)' : '')).join(', ') || '-'}</td><td>${Object.keys(p.cards).length}</td><td>${p.sessions.length}</td></tr>`; }).join('');
  $('#app').innerHTML = `<h2>부모 메뉴</h2><p><a href="#/review">음원 검수</a> · <a href="#/selftest">자체 점검</a> · <button class="ghost" data-act="home">돌아가기</button></p>
  <div class="card col"><b>단어 팩 가져오기</b><p class="small mut">주간 도구 app.py의 '/export?profile=...' JSON을 아이별로 가져옵니다. 같은 파일을 다시 가져와도 진도는 유지됩니다.</p>
    <div class="row"><select id="imp-p">${PROFILES.map((id) => `<option value="${id}">${esc(name(id))}</option>`).join('')}</select><input type="file" id="imp-f" accept=".json,application/json"></div>
    <textarea id="imp-t" placeholder="또는 JSON을 붙여넣기"></textarea><div class="row"><button data-act="import">가져오기</button><button class="sec" data-act="demo">데모 팩 불러오기(자작, 두 아이)</button></div><div id="imp-r"></div></div>
  <div class="card col"><b>현황</b><table><tr><th>아이</th><th>팩</th><th>카드</th><th>세션</th></tr>${prof}</table>
    <div class="small">음원 매니페스트: ${Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}. 사람이 검수한 음원만 '검수 완료'로 표시됩니다.</div>
    <div class="small" id="syncline">${esc(syncLine())}</div>${G.store.corrupt ? '<div class="fb wrong small">이 기기의 저장 데이터 일부를 읽지 못해 사본을 따로 보관했습니다.</div>' : ''}</div>
  <div class="card col"><b>내보내기(아이별)</b><div class="row">${PROFILES.map((id) => `<button class="sec" data-act="export" data-id="${id}">${esc(name(id))} JSON</button>`).join('')}</div>
    <p class="small mut">게임 결과는 소리 도움을 받은 결과입니다. 종이 책에서 혼자 읽은 결과와 합치지 마세요.</p></div>
  <div class="card col"><b>설정</b><div class="row"><label>아들 이름 <input id="nm-son" value="${esc(name('son'))}" size="8"></label><label>딸 이름 <input id="nm-daughter" value="${esc(name('daughter'))}" size="8"></label></div>
    <div class="row"><label>한 번에 새 단어 <input id="st-new" type="number" min="3" max="10" value="${G.meta.settings.newPerSession}" style="width:70px"></label>
    <label>복습 상한 <input id="st-rev" type="number" min="5" max="30" value="${G.meta.settings.reviewMax}" style="width:70px"></label>
    <label>하루 분 <input id="st-min" type="number" min="5" max="15" value="${G.meta.settings.sessionMinutes}" style="width:70px"></label></div><button data-act="save-settings">저장</button></div>
  <div class="card col"><b>데모 데이터 삭제</b><div class="row">${PROFILES.map((id) => `<button class="sec" data-act="clear-sample" data-id="${id}">${esc(name(id))} 데모 삭제</button>`).join('')}</div></div>`;
}
async function doImport(profile, text, sample) {
  const out = $('#imp-r');
  try { const rep = G.store.importPack(profile, JSON.parse(text), { sample, today: G.today, knownCard: (id) => !!G.cat.card(id) }); out.innerHTML = `<div class="fb right">완료: 새 카드 ${rep.added}, 갱신 ${rep.updated}, 변경 없음 ${rep.unchanged} (${rep.packs.map((x) => esc(x.book) + ':' + x.status).join(', ')})</div>`; }
  catch (e) { out.innerHTML = `<div class="fb wrong">가져오기 실패: ${esc(e.message)}</div>`; }
}
function download(name, obj) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

// ---- audio review page --------------------------------------------------------------
function reviewPage() {
  G.view = 'review'; setBar(false);
  const log = JSON.parse(localStorage.getItem('catchup.v1.review') || '{"reviews":[]}');
  const by = Object.fromEntries(log.reviews.map((r) => [r.key, r]));
  const rows = Object.entries(G.engine.manifest).map(([k, e]) => { const r = by[k];
    return `<tr><td>${esc(k)}</td><td>${esc(e.kind)}</td><td>${esc(e.text)}</td><td><span class="pill ${e.status === 'human_approved' ? 'ok' : 'temp'}">${esc(e.status)}</span>${r ? `<br><span class="small">내 판정: ${esc(r.verdict)}</span>` : ''}</td>
    <td><button class="sec" data-act="hear" data-key="${esc(k)}">▶</button> <button class="sec" data-act="rv" data-v="approve" data-key="${esc(k)}">승인</button> <button class="sec" data-act="rv" data-v="reject" data-key="${esc(k)}">반려</button></td></tr>`; }).join('');
  $('#app').innerHTML = `<h2>음원 검수</h2><p><a href="#/parent">부모 메뉴</a></p><div class="card small">확인: 목표 단어와 예문 발음이 뜻·품사·시제와 맞는가 / 시작·끝이 잘리지 않았는가 / 잡음 없는가. 개발용 합성 음원(dev_tts)은 승인하지 않는 것이 원칙입니다.
  <div class="row"><label>검수자 <input id="rv-name" size="10" value="${esc(localStorage.getItem('catchup.v1.reviewer') || '')}"></label><button data-act="rv-export">검수 로그 내보내기</button></div></div>
  <table><tr><th>키</th><th>종류</th><th>텍스트</th><th>상태</th><th>검수</th></tr>${rows}</table>`;
}

// ---- self test (runs in the real browser) ---------------------------------------------
async function selftest() {
  G.view = 'selftest'; setBar(false); const out = []; const ok = (n, c) => out.push(`${c ? 'PASS' : 'FAIL'} ${n}`);
  ok('localStorage 사용', !G.volatile); ok('오디오 매니페스트 로드', Object.keys(G.engine.manifest).length > 0);
  ok('AudioContext/Audio 지원', typeof Audio === 'function'); ok('speechSynthesis(임시 대체) 지원', !!window.speechSynthesis);
  ok('세이프 에어리어/뷰포트', !!document.querySelector('meta[name=viewport]'));
  $('#app').innerHTML = `<h2>자체 점검</h2><pre>${esc(out.join('\n'))}</pre><p class="small mut">iPad 실기기 소리 재생은 이 점검으로 확인되지 않습니다. 학습 화면에서 직접 확인하세요.</p><p><a href="#/parent">부모 메뉴</a></p>`;
}

// ---- events ------------------------------------------------------------------------
async function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act; const s = G.sess;
  switch (a) {
    case 'home': if (s && G.view !== 'end') { s.finish('left'); G.engine.stop(); const p = s.p; p.sessions.push({ day: G.today, ms: Math.round(G.ms), reason: 'left', sample: sessionSample(p) }); delete p.activeSession; save(); G.sess = null; } return go('#/') || home();
    case 'pick': return profileView(b.dataset.id);
    case 'parent': return go('#/parent');
    case 'start': return startSession();
    case 'sc-play': return soundCheck();
    case 'sc-yes': return next();
    case 'sc-no': $('#sc-msg').textContent = '아이패드 옆의 무음 스위치, 볼륨, 블루투스 연결을 확인한 뒤 다시 눌러요.'; return;
    case 'tap-item': return say(b.dataset.id, { force: true });
    case 'hear': return say(b.dataset.key, { force: true });
    case 'replay': { const t = s?.current; const key = t?.kind === 'learn' ? t.cardId : t?.q?.audioKey || t?.q?.cardId; return say(key, { force: true }); }
    case 'retry-audio': { const t = s?.current; const key = t?.kind === 'learn' ? t.cardId : t?.q?.audioKey || t?.q?.cardId || G.engine.lastFail?.key; await G.engine.unlock(); return say(key, { force: true }); }
    case 'skip-audio': { const t = s?.current; hideBannerQuiet(); if (!t) return;
      if (t.kind === 'question') s.skipNoAudio(); else { s.completeLearn(t.cardId); s.advance(); }   // logged with audioOk:false
      return next(); }
    case 'learn-next': { const t = s.current; if (!t.heard) return; s.completeLearn(t.cardId); s.advance(); return next(); }
    case 'ans': if (b.classList.contains('locked')) return; return answer(Number(b.dataset.i));
    case 'tile': { if (b.disabled || b.classList.contains('locked')) return; const q = s.current.q; G.spell.letters.push(q.tiles[b.dataset.i].ch); G.spell.used.add(b.dataset.i); b.disabled = true;
      document.querySelectorAll('.slot').forEach((el, i) => { el.textContent = G.spell.letters[i] || ''; });
      if (G.spell.letters.length === q.target.length) return answer(G.spell.letters.join('')); return; }
    case 'undo': { if (G.fb) return; const l = G.spell.letters; if (!l.length) return; l.pop(); const i = [...G.spell.used].pop(); G.spell.used.delete(i);
      document.querySelector(`.tile[data-i="${i}"]`).disabled = false; document.querySelectorAll('.slot').forEach((el, j) => { el.textContent = l[j] || ''; }); return; }
    case 'hint': { if (G.fb) return; const h = s.useHint(); b.disabled = true;
      if (h.hide) document.querySelectorAll('.opt').forEach((o, i) => { if (h.hide.includes(i)) o.classList.add('gone'); });
      if (h.reveal) { const q = s.current.q; G.spell = { letters: [], used: new Set() };
        document.querySelectorAll('.tile').forEach((t) => { t.disabled = false; }); document.querySelectorAll('.slot').forEach((el) => { el.textContent = ''; });
        const idx = q.tiles.findIndex((x) => x.ch === q.target[0]); document.querySelector(`.tile[data-i="${idx}"]`)?.click(); }
      return; }
    case 'q-next': s.advance(); return next();
    case 'gate': if (Number($('#gate').value) === G.gate) { gateOk = true; return parent(); } return alert('다시 계산해 보세요.');
    case 'import': { const f = $('#imp-f').files[0]; const text = f ? await f.text() : $('#imp-t').value; return doImport($('#imp-p').value, text, false); }
    case 'demo': for (const id of PROFILES) { const r = await fetch(`data/demo_pack_${id}.json`); G.store.importPack(id, await r.json(), { sample: true, today: G.today, knownCard: (cid) => !!G.cat.card(cid) }); } parent(); $('#imp-r').innerHTML = '<div class="fb right">데모 팩을 불러왔어요(이미 있으면 진도 유지).</div>'; return;
    case 'export': return download(`catchup_${b.dataset.id}_${G.today}.json`, G.store.exportProfile(b.dataset.id));
    case 'save-settings': G.meta.names = { son: $('#nm-son').value || '아들', daughter: $('#nm-daughter').value || '딸' };
      const clamp = (v, a, b, d) => Math.min(b, Math.max(a, Math.round(Number(v)) || d));
      G.meta.settings = { ...G.meta.settings, newPerSession: clamp($('#st-new').value, 3, 10, 5), reviewMax: clamp($('#st-rev').value, 5, 30, 25), sessionMinutes: clamp($('#st-min').value, 5, 15, 15) };
      G.store.saveMeta(G.meta); return parent();
    case 'clear-sample': if (confirm('데모 데이터를 삭제할까요? 실제 팩과 기록은 그대로 둡니다.')) G.store.clearSample(b.dataset.id); return parent();
    case 'rv': { const nm = $('#rv-name').value.trim(); if (!nm) return alert('검수자 이름을 입력하세요.'); localStorage.setItem('catchup.v1.reviewer', nm);
      const log = JSON.parse(localStorage.getItem('catchup.v1.review') || '{"reviews":[]}'); const k = b.dataset.key;
      log.reviews = log.reviews.filter((r) => r.key !== k).concat({ key: k, sha256: G.engine.manifest[k].sha256, verdict: b.dataset.v, reviewer: nm, at: new Date().toISOString() });
      localStorage.setItem('catchup.v1.review', JSON.stringify(log)); return reviewPage(); }
    case 'rv-export': return download('audio_review_log.json', JSON.parse(localStorage.getItem('catchup.v1.review') || '{"reviews":[]}'));
  }
}
boot();
