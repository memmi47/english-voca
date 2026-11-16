// Flashcard game: screens. Rules live in deck.js (cards), map.js (review load, items), world.js (worlds, castles); audio in sound.js.
import { Run, newState, gradeOf, gradeCounts, mulberry32, shuffle, isSight, CFG } from './deck.js';
import { Sound } from './sound.js';
import { ensureMap, dueCount, settleRun, chooseBag, takeBag, Lightning, settleLightning, ITEMS, LIGHTNING_MIN, TRIAGE, triagePlan, triageScope } from './map.js';
import { indexWorlds, worldView, atlasView, currentWorld, nodeRun, finaleRun, settleWorld, enterWorld, stampGame, worldWords, worldOpen, setLeftOutKinds, startTile } from './world.js';
import { Sync, mergeCards } from './sync.js';
import { loadRecord, compact, totals, readBackup, migrate, setAside } from './store.js';

const qs = new URLSearchParams(location.search);
const todayISO = () => qs.get('today') || new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const FAST = qs.get('fast') === '1';                     // test hook: short reveal pauses
const DATA = qs.get('set') === 'demo' ? 'data/demo/' : 'data/';   // ?set=demo: the small 86-card set (tests, try-out)
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PROFILES = ['son', 'daughter'];
const BOSSES = ['👾', '🦖', '🐙', '🤖', '🐲', '👹'];        // used only when a world lists no boss
const GRADE = ['', '동', '은', '금'];
const MEDAL = ['', 'medal-bronze', 'medal-silver', 'medal-gold'];
const ITEM_SPR = { shield: 'mushroom', flame: 'fire-flower' };
const BAND_MUSIC = { P1: 'meadow', P2: 'sea', P3: 'sky' };
// A sprite from the inlined sheet (16-grid sprites at an integer scale: px = 16 x n).
const spr = (id, px = 64, cls = '') => `<svg class="spr ${cls}" width="${px}" height="${px}" viewBox="0 0 16 16" aria-hidden="true"><use href="#${id}"/></svg>`;
const anim = (a, b, px = 64, cls = '') => `<span class="anim2 ${cls}">${spr(a, px)}${spr(b, px)}</span>`;
async function loadSprites(url = 'assets/postal/sprites.svg') {
  try { const r = await fetch(url); if (!r.ok) return; const t = await r.text(); const d = document.createElement('div'); d.className = 'sheet'; if (url === 'assets/postal/sprites.svg') d.id = 'sheet'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; d.innerHTML = t; document.body.prepend(d); }
  catch { /* the game still works with plain boxes if the sheet is missing */ }
}
const LT_SECONDS = FAST ? 3 : 60;
const G = { ix: null, world: null, node: null, lt: null, game: null, words: [], byId: {}, meta: null, pid: null, st: null, run: null, boss: null, view: 'home', busy: false, timer: null, sound: null };
window.__cards = G;

// ---- storage: this device, plus a copy on the home server when tools/serve_cards.py is reachable ----
const KEY = (id) => `cards.v0.p.${id}`;
// A record is upgraded from older formats on reading (store.js). One that cannot be read is set aside, never overwritten;
// one saved by a newer program than this page is shown but not changed.
function loadRec(id) { try { return loadRecord(localStorage, KEY(id), id); } catch { return { state: newState(id), damaged: false, newer: false, missing: true }; } }
const load = (id) => loadRec(id).state;
const NEWER = '이 화면의 프로그램이 오래됐어요. 화면을 새로 고치면 이어서 할 수 있어요. 그때까지 이 기기에서는 기록이 바뀌지 않아요.';
// G.seen: the text this page last read from or wrote to the open child's key. Different text there now means another tab
// of this browser saved since (sync writes of this page update G.seen in onMerged). A record of a newer program makes this
// page read-only; any other record is merged into the one in memory, in place, because a running Run holds that object.
const stored = () => localStorage.getItem(KEY(G.pid));
const fold = (data) => { for (const k of Object.keys(G.st)) if (!(k in data)) delete G.st[k]; Object.assign(G.st, data); };
function catchUp(text = stored(), aside = true) {
  if (text == null || text === G.seen) return true;
  let raw = null; try { raw = JSON.parse(text); } catch {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { if (aside) { setAside(localStorage, KEY(G.pid), text); G.seen = null; } return true; }   // unreadable: kept aside, never overwritten
  const m = migrate(raw, G.pid); G.seen = text;
  if (m.newer) { G.readonly = true; banner(`<span>${NEWER}</span><button data-act="reload">새로 고침</button>`); return false; }
  fold(mergeCards(G.st, m.state)); return true;
}
function save() {
  if (G.readonly) { banner(`<span>${NEWER}</span><button data-act="reload">새로 고침</button>`); return false; }
  try { if (!catchUp()) return false; compact(G.st, todayISO()); const text = JSON.stringify(G.st); localStorage.setItem(KEY(G.pid), text); G.seen = text; G.sync?.changed('p.' + G.pid); return true; } catch (e) { banner(`저장에 실패했어요: ${esc(e.message)}`); return false; }
}
function loadMeta() { try { return { names: { son: '아들', daughter: '딸' }, ...JSON.parse(localStorage.getItem('cards.v0.meta') || '{}') }; } catch { return { names: { son: '아들', daughter: '딸' } }; } }
// Another device saved newer data: fold it into what this page holds in memory.
function onMerged(nm, data) {
  if (nm === 'meta') { G.meta = loadMeta(); return; }
  if (G.st && nm === 'p.' + G.pid && data) { fold(data); try { G.seen = stored(); } catch {} }
}
function syncLine() {
  const st = G.syncStatus || { available: false, pending: [] };
  if (G.volatile) return '이 브라우저는 저장을 막고 있어요. 기록이 새로고침 후 사라질 수 있습니다.';
  if (st.stale) return '새 프로그램이 나왔어요. 화면을 새로 고치세요 (그 전까지 서버 기록은 건드리지 않아요).';
  if (!G.sync) return '기록 저장: 이 기기만 (서버 저장 꺼짐)';
  if (!st.available) return '기록 저장: 이 기기만. Mac의 서버(tools/serve_cards.py)에 연결되지 않았어요.';
  return st.pending.length ? '기록 저장: 서버에 올리는 중…' : '기록 저장: 이 기기 + Mac 서버';
}
function paintSync() { const el = document.getElementById('syncline'); if (el) el.textContent = syncLine(); }
async function openProfile(id) {
  const rec = loadRec(id); G.notice = rec.damaged ? '이 기기에 있던 기록을 읽을 수 없어 따로 보관했어요. 서버나 백업 파일의 기록으로 이어 갑니다(부모 기록 화면에서 복원할 수 있어요).' : '';   // set aside before the server copy is fetched
  if (G.sync?.available) { try { await G.sync.reconcile('p.' + id); } catch {} } return today(id);
}
const name = (id) => G.meta.names[id];

const PREF = 'cards.v0.pref';                           // this device only: music on/off, effects on/off
function loadPref() { try { return { music: false, sfx: true, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch { return { music: false, sfx: true }; } }
function savePref() { try { localStorage.setItem(PREF, JSON.stringify({ music: G.sound.musicOn, sfx: G.sound.sfx })); } catch {} }
const band = (on) => document.body.classList.toggle('band', on);
// A world brings three colours (sky, ground, path). Lighter and darker shades for the sprites are derived here, and the
// text on the sky switches between dark and light so it stays readable.
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (h, to, f) => '#' + rgb(h).map((c) => Math.round(c + (to - c) * f).toString(16).padStart(2, '0')).join('');
const lum = (h) => { const [r, g, b] = rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
function applyTheme(w) {
  const p = { sky: '#6FB5AA', ground: '#86B682', path: '#DEC995', ...(w?.palette || {}) }; const s = document.documentElement.style; const light = lum(p.sky) > 0.62;
  const set = { '--w-sky': p.sky, '--w-sky-l': mix(p.sky, 255, 0.4), '--w-ground': p.ground, '--w-ground-d': mix(p.ground, 0, 0.2), '--w-ground-l': mix(p.ground, 255, 0.3),
    '--w-path': p.path, '--w-path-d': mix(p.path, 0, 0.25), '--w-path-l': mix(p.path, 255, 0.25), '--fg': light ? '#233f3a' : '#fff5db', '--fg-sh': light ? 'rgba(255,250,240,.85)' : '#233f3a' };
  for (const [k, v] of Object.entries({ ...set, ...(w?.paletteVars || {}) })) s.setProperty(k, v);
}
const ro = (word) => { const c = String(word).charCodeAt(String(word).length - 1) - 0xac00; if (c < 0 || c > 11171) return `${word}(으)로`; const f = c % 28; return word + (f === 0 || f === 8 ? '로' : '으로'); };
const musicOf = (w) => BAND_MUSIC[G.ix.contOf[w.id].band] || 'meadow';
function banner(html) { const b = $('#banner'); b.innerHTML = html; b.hidden = false; }
function hideBanner() { $('#banner').hidden = true; }
const miniCard = (w, g, cls = '') => `<div class="mini g${g} ${cls}" data-act="peek" data-id="${esc(w.id)}"><b>${esc(w.form)}</b>${g ? spr(MEDAL[g], 22) : ''}</div>`;

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
  let storage; try { storage = window.localStorage; storage.setItem('_t', '1'); storage.removeItem('_t'); } catch { storage = null; }
  G.volatile = !storage; G.syncStatus = { available: false, pending: [] };
  try {
    const json = (r) => { if (!r.ok) throw new Error(`${r.url.split('/').slice(-2).join('/')} 파일을 읽지 못했어요 (${r.status})`); return r.json(); };
    // The real world file (from the world generator) wins; until it exists the stand-in file is used.
    let doc = await fetch(DATA + 'worlds.json').then((r) => (r.ok ? r.json() : null), () => null); G.standIn = !doc;
    if (!doc) doc = await fetch(DATA + 'worlds.fixture.json').then(json);
    const cat = await fetch(DATA + (doc.catalogue || 'catalog.json')).then(json);       // a world file may name its own card list
    // Card fields this game reads: track ("sight" = hear-and-pick card) and groups (confusion groups, never offered as wrong answers).
    G.words = cat.words.map((w) => ({ ...w, track: w.track || (w.answerMode === 'listen-spelling' || w.learningKind === 'sight' ? 'sight' : 'vocab'), groups: w.groups || (w.confusionGroups?.length ? w.confusionGroups : undefined) }));
    if (qs.get('houses') === 'sight') setLeftOutKinds([]);            // test-only: bring the hear-and-pick houses back
    if (qs.get('triage') === 'off') TRIAGE.on = false;                 // test-only: every new word one card at a time, as before the word list
    G.ix = indexWorlds(doc); G.byId = Object.fromEntries(G.words.map((w) => [w.id, w])); G.pack = doc.assetPack?.sheet || null;
    G.dataNote = G.standIn ? '세계 파일: 시험용(단어 배정 임시)' : doc.status === 'draft' || doc.playable === false ? '세계 파일: 초안(뜻·소리 검토 전)' : '';
    const lost = Object.keys(G.ix.wordWorld).filter((id) => !G.byId[id]); if (lost.length) throw new Error(`세계 파일의 카드 ${lost.length}장이 카드 목록에 없어요 (예: ${lost[0]})`);
  } catch (e) { $('#app').innerHTML = `<div class="page center"><h1 class="title">열 수 없어요</h1><p class="note" id="fatal">${esc(e.message)}</p></div>`; return; }
  if (storage && qs.get('nosync') !== '1') {
    G.sync = new Sync({ storage, fetchImpl: (u, o) => fetch(u, o), debounceMs: 800, onMerged, onStatus: (s) => { G.syncStatus = s; paintSync(); } });
    await G.sync.init();
  }
  await loadSprites(); if (G.pack) await loadSprites(G.pack); G.meta = loadMeta();   // the world file may bring its own boss sprites
  G.sound = new Sound({ off: qs.get('sound') === 'off' }); await G.sound.init();
  const pref = loadPref(); G.sound.musicOn = pref.music; G.sound.sfx = pref.sfx;
  document.addEventListener('click', onClick);
  document.addEventListener('change', (e) => { const f = e.target; if (!f.dataset?.restore || !f.files?.[0]) return; const id = f.dataset.restore; const rd = new FileReader(); rd.onload = () => restore(id, String(rd.result)); rd.onerror = () => { G.pmsg = '파일을 읽지 못했어요.'; parent(); }; rd.readAsText(f.files[0]); });
  // Another tab saved this child's record: fold it in now (save() checks again before every write). Nothing is written here,
  // so two open tabs never answer each other's saves.
  window.addEventListener('storage', (e) => { if (!G.st || !G.pid || G.readonly || e.key !== KEY(G.pid) || e.newValue == null) return; try { catchUp(e.newValue, false); } catch {} });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { G.sync?.flush().catch(() => {}); return; } G.sync?.flush().catch(() => {}); if (G.view === 'card' && !G.busy) speak(true); });
  home();
}

// ---- home ----
function home() {
  G.view = 'home'; G.pid = null; G.st = null; G.run = null; G.world = null; hideBanner(); clearTimeout(G.timer); applyTheme(G.ix.worlds[0]); band(false); G.sound?.scene(musicOf(G.ix.worlds[0]));
  $('#app').innerHTML = `<div class="page center"><h1 class="title">단어 카드</h1><p class="mut">누가 할까요?</p>
  <div class="hero">${anim('flag-a', 'flag-b', 64)}</div>
  <div class="profiles">${PROFILES.map((id) => `<button class="profile" data-act="pick" data-id="${id}"><svg class="spr" width="96" height="96" viewBox="0 0 48 48" aria-hidden="true"><use href="#courier-${id === 'son' ? 'teal' : 'gold'}-${id === 'son' ? 'idle' : 'wave'}"/></svg>${esc(name(id))}</button>`).join('')}</div>
  <p><button class="link" data-act="parent">부모 기록</button></p><p class="mut small" id="syncline">${esc(syncLine())}</p></div>`;
}

// ---- the map of one world ----
const STONE = { open: 'stone-open', cleared: 'stone-done', locked: 'stone-locked', blocked: 'stone-blocked' };
const big = (id) => `<svg class="spr big" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><use href="#${id}" width="64" height="64"/></svg>`;
const MSG = { locked: '앞 칸을 먼저 깨요', blocked: '박쥐 떼가 몰려왔어요! 먼저 쫓아내요', castleLocked: '길을 따라 성까지 가면 열려요', bonusLocked: `카드를 ${LIGHTNING_MIN}장 이상 익히면 열려요`, used: '오늘 보너스는 받았어요. 내일 또 열려요', gameLocked: '놀이집으로 가는 길을 먼저 지나가요', soon: '아직 준비 중이에요' };
// Ground, a path of tiles along every line of the map (snapped to the 16 px grid), and a few plants away from the paths.
// Map coordinates are 1000 x 600; the picture is drawn on a 250 x 150 grid so one tile is one stone wide.
function terrain(w) {
  const K = 0.25; const cell = (v) => Math.floor(v * K / 16) * 16; const seen = new Set(); const path = []; const N = w._nodes;
  for (const e of w.map.edges) { const a = N[e.from], b = N[e.to]; const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * K / 8);
    for (let i = 0; i <= n; i++) { const x = cell(a.x + (b.x - a.x) * i / n), y = cell(a.y + (b.y - a.y) * i / n); const k = x + ',' + y; if (!seen.has(k)) { seen.add(k); path.push(`<use href="#t-path" x="${x}" y="${y}" width="16" height="16"/>`); } } }
  for (const n of w.map.nodes) seen.add(cell(n.x) + ',' + cell(n.y));
  const rng = mulberry32([...w.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0); const deco = []; const KIND = ['tree', 'bush', 'flowers', 'rock', 'bush', 'flowers'];
  for (let i = 0; i < 60 && deco.length < 14; i++) { const x = Math.floor(rng() * 15) * 16, y = Math.floor(rng() * 9) * 16; const k = x + ',' + y; if (seen.has(k) || seen.has(x + ',' + (y + 16))) continue; seen.add(k); deco.push(`<use href="#${KIND[Math.floor(rng() * KIND.length)]}" x="${x}" y="${y}" width="16" height="16"/>`); }
  return `<svg class="terrain" viewBox="0 0 250 150" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="pg" width="16" height="16" patternUnits="userSpaceOnUse"><use href="#t-grass" width="16" height="16"/></pattern></defs><rect width="250" height="150" fill="url(#pg)"/>${path.join('')}${deco.join('')}</svg>`;
}
// A house hangs next to its anchor tile, on the side with the most room.
function housePos(w, h, taken) {
  const a = w._nodes[h.anchorNodeId] || w._nodes[w.map.startNodeId]; let best = null;
  for (const [dx, dy] of [[0, -110], [0, 110], [-120, 0], [120, 0], [-100, -100], [100, 100], [100, -100], [-100, 100]]) {
    const x = a.x + dx, y = a.y + dy; if (x < 60 || x > 940 || y < 70 || y > 520) continue;
    const d = Math.min(...taken.map((t) => Math.hypot(t.x - x, t.y - y))); if (!best || d > best.d) best = { x, y, d };
  }
  best ||= { x: Math.min(940, a.x + 90), y: Math.min(520, a.y + 90) }; taken.push(best); return best;
}
function today(id, msg = '', wid = null) {
  const rec = loadRec(id); G.view = 'today'; G.pid = id; G.st = rec.state; try { G.seen = stored(); } catch { G.seen = null; } G.readonly = rec.newer || !!G.syncStatus?.stale; G.run = null; G.lt = null; G.game = null; hideBanner(); clearTimeout(G.timer); band(false);
  if (G.readonly) banner(`<span>${NEWER}</span><button data-act="reload">새로 고침</button>`); else if (G.notice) { banner(`<span>${esc(G.notice)}</span><button data-act="hide">확인</button>`); G.notice = ''; }
  const st = G.st; const m = ensureMap(st);
  if (wid && G.ix.byId[wid] && worldOpen(G.ix, G.ix.byId[wid], st)) m.at = wid;
  const w = (G.world = currentWorld(G.ix, st)); const first = enterWorld(st, w, todayISO()); if (first || wid) save();
  applyTheme(w); G.sound.scene(musicOf(w));
  const v = worldView(G.ix, w, st, todayISO()); const c = gradeCounts(st, G.words); const used = usedMs(st);   // shown to the parent; there is no daily time cap (user decision 2026-11-12)
  const at = (n) => `left:${n.x / 10}%;top:${n.y / 6}%`;
  const place = (n, inner, label, status, extra = '') => `<button class="node ${status} ${extra}" data-act="node" data-id="${esc(n.id)}" style="${at(n)}" aria-label="${esc(label)}">${inner}${label ? `<span class="lbl">${esc(label)}</span>` : ''}${extra.includes('bonus') ? '<i class="x2">×2</i>' : ''}</button>`;
  const nodes = v.nodes.map((n) => {
    if (n.kind === 'tile') return place(n, spr(STONE[n.status] || 'stone-open', 64, 'big'), '', n.status, n.bonus ? 'bonus' : '');
    if (n.kind === 'castle') return place(n, `${v.crown ? `<i class="crown">${spr('crown', 32)}</i>` : ''}${big('gate')}`, v.crown ? '왕관!' : w.castle?.name || '성', n.status, 'castle');
    if (n.kind === 'minigame') return place(n, `${big('playhouse')}${n.status === 'cleared' ? `<i class="crown">${spr('stamp', 32)}</i>` : ''}`, '놀이집', n.status === 'cleared' ? 'open done' : n.status, 'game');
    if (n.kind === 'start') return `<div class="node start" style="${at(n)}">${anim('flag-a', 'flag-b', 64)}<span class="lbl">출발</span></div>`;
    return `<div class="node free" style="${at(n)}">${big('sign')}</div>`;
  });
  const taken = w.map.nodes.map((n) => ({ x: n.x, y: n.y }));
  const houses = v.houses.map((h) => { const p = housePos(w, h, taken); return place({ id: h.id, ...p }, big('post-office'), `${h.name} ${h.done}/${h.total}`, h.status, h.bonus ? 'house bonus' : 'house'); });
  const story = first ? w.intro : '';
  const hint = msg || (v.bat.full ? (v.bat.byDebt ? '미뤄 둔 복습이 쌓여 박쥐 떼가 몰려왔어요! 박쥐 시험을 치러야 해요' : '박쥐 떼가 몰려왔어요! 박쥐 시험을 치러야 해요') : story || (v.continent.finale.status === 'open' ? `${v.continent.name}의 모든 왕관을 모았어요. 세계 지도에서 큰 성에 도전해요!` : v.monster.present ? `복습 ${v.monster.count}장이 쌓였어요. 몬스터를 물리치면 별이 2배!` : '가고 싶은 길을 골라요'));
  const dock = (id, inner, label, status, extra = '') => `<button class="dockbtn ${status} ${extra}" data-act="node" data-id="${id}" aria-label="${esc(label)}">${inner}<span class="lbl">${esc(label)}</span></button>`;
  $('#app').innerHTML = `<div class="page map"><button class="back" data-act="home" aria-label="처음으로">‹</button>
  <div class="maphud"><b class="who">${esc(name(id))}</b><span class="chip" title="별">${spr('star', 24)} ${v.stars}</span><span class="chip" title="열쇠">${spr('key', 24)} ${v.keys}</span><span class="chip mut">오늘 ${Math.floor(used / 6e4)}분</span>
    <button class="tgl" data-act="atlas">세계 지도</button>
    <button class="tgl ${G.sound.musicOn ? 'on' : ''}" data-act="music" aria-pressed="${G.sound.musicOn}">♪ 음악 ${G.sound.musicOn ? '켜짐' : '꺼짐'}</button><button class="tgl ${G.sound.sfx ? 'on' : ''}" data-act="sfx" aria-pressed="${G.sound.sfx}">${spr('sound', 24)} 효과음 ${G.sound.sfx ? '켜짐' : '꺼짐'}</button></div>
  <div class="wtitle" id="wtitle"><b>${esc(v.continent.name)} · ${esc(w.name)}</b><span>${v.unitsDone}/${v.units}칸${v.crown ? ' · 왕관' : v.castle.status === 'cleared' ? ' · 열쇠' : ''}</span></div>
  <div class="batgauge ${v.bat.full ? 'full' : ''}" id="batgauge" title="새 단어를 만나면 차고 복습하면 줄어요. 복습을 미뤄도 차요. 가득 차면 박쥐 시험!">${anim('bat-a', 'bat-b', 32)}<div class="batbar"><i style="width:${Math.min(100, Math.round(v.bat.fill / v.bat.cap * 100))}%"></i></div><b>${v.bat.fill}/${v.bat.cap}</b></div>
  <div class="world" id="world" data-world="${esc(w.id)}">${terrain(w)}${nodes.join('')}${houses.join('')}</div>
  <p class="msg" id="msg">${esc(hint)}</p>
  <div class="dock">${v.bat.full ? dock('bat', anim('bat-a', 'bat-b', 48, 'fast'), '박쥐 시험', 'open', 'mon') : ''}
    ${v.monster.present ? dock('monster', anim('monster-a', 'monster-b', 48), `복습 몬스터 ${v.monster.count}`, 'open', 'mon') : ''}
    ${v.review.present ? dock('review', spr('envelope', 48), `복습 ${v.review.count}장`, v.bat.full ? 'blocked' : 'open') : ''}
    ${dock('bonus', `<svg class="spr" width="48" height="48" viewBox="0 0 64 64" aria-hidden="true"><use href="#mailbox" width="64" height="64"/></svg>`, '번개 집', v.bonus.status === 'used' ? 'cleared' : v.bonus.status === 'open' ? 'open' : 'locked')}</div>
  <div class="bag"><span class="mut">가방</span>${Object.entries(ITEMS).map(([k, it]) => `<button class="item ${v.bag === k ? 'sel' : ''}" data-act="bag" data-item="${k}" ${m.items[k] < 1 ? 'disabled' : ''} title="${esc(it.info)}">${spr(ITEM_SPR[k], 40)}<b>×${m.items[k]}</b></button>`).join('')}
    <span class="mut small">${v.bag ? esc(ITEMS[v.bag].name + ': ' + ITEMS[v.bag].info) : '다음 판에 쓸 아이템을 골라요'}</span></div>
  <div class="shelf"><div class="bar">${[3, 2, 1, 0].map((g) => `<i class="g${g}" style="flex:${c[g]}"></i>`).join('')}</div>
    <div class="legend"><span class="g3">${spr(MEDAL[3], 24)} 금 ${c[3]}</span><span class="g2">${spr(MEDAL[2], 24)} 은 ${c[2]}</span><span class="g1">${spr(MEDAL[1], 24)} 동 ${c[1]}</span><span class="g0">아직 ${c[0]}</span></div>
    <button class="sec" data-act="album">이 세계의 카드첩</button></div>
  <p class="mut small center" id="src">소리: ${esc(G.sound.source)}${G.dataNote ? ' · ' + esc(G.dataNote) : ''}</p><p class="mut small center" id="syncline">${esc(syncLine())}</p></div>`;
}
function nodeClick(id) {
  const st = G.st; const v = worldView(G.ix, G.world, st, todayISO()); const out = (t) => { const e = $('#msg'); if (e) e.textContent = t; };
  if (id === 'bat') return v.bat.full ? start('bat') : out('박쥐 게이지가 아직 안 찼어요');
  if (v.bat.full) return out(MSG.blocked);                  // a full gauge: the test comes first
  if (id === 'bonus') { if (v.bonus.status === 'open') return startLightning(); return out(v.bonus.status === 'used' ? MSG.used : MSG.bonusLocked); }
  if (id === 'monster' || id === 'review') return start(id);
  const n = v.nodes.find((x) => x.id === id) || v.houses.find((x) => x.id === id); if (!n) return;
  if (n.kind === 'minigame') { if (n.status === 'locked') return out(MSG.gameLocked); return n.playable ? startGame(n) : out(MSG.soon); }
  if (n.kind === 'castle' && n.status === 'locked') return out(MSG.castleLocked);
  if (n.kind === 'castle' && n.status === 'cleared') return out('이 성은 이미 깼어요.');
  if (n.status === 'locked') return out(MSG.locked);
  if (n.status === 'blocked') return out(MSG.blocked);
  if (n.status === 'cleared') return out(n.tiles ? '이 집은 다 읽었어요.' : '이 칸은 이미 깼어요.');
  return start(id);
}

// ---- world list ----
function atlas() {
  G.view = 'atlas'; hideBanner(); band(false); const a = atlasView(G.ix, G.st);
  const wbtn = (w) => `<button class="wcard ${w.open ? 'open' : 'locked'} ${G.world?.id === w.id ? 'here' : ''}" data-act="goworld" data-id="${esc(w.id)}" ${w.open ? '' : 'disabled'}>${w.crown ? spr('crown', 32) : w.castle ? spr('key', 32) : w.open ? spr('stone-open', 32) : spr('padlock', 32)}<b>${esc(w.name)}</b><i>${w.met}/${w.total}</i></button>`;
  $('#app').innerHTML = `<div class="page atlas"><button class="back" data-act="today" aria-label="돌아가기">‹</button><h1 class="title center">세계 지도</h1>
  ${a.map((c) => `<section class="cont" data-cont="${esc(c.id)}"><h2>${esc(c.name)} <small>왕관 ${c.crowns}/${c.total}</small></h2><p class="mut small">${esc(c.story || '')}</p>
    <div class="wgrid">${c.worlds.map(wbtn).join('')}
    <button class="wcard finale ${c.finale.status}" data-act="finale" data-id="${esc(c.id)}">${big('gate')}<b>${esc(c.finale.name)}</b><i>${c.finale.status === 'cleared' ? '통과!' : c.finale.status === 'open' ? `${c.finale.cards}장 시험` : c.finale.status === 'pending' ? '준비 중이에요' : '왕관을 모두 모으면 열려요'}</i></button></div></section>`).join('')}
  <p class="msg" id="msg"></p></div>`;
}

// ---- run ----
async function start(nodeId) {
  if (G.readonly || !catchUp()) return banner(`<span>${NEWER}</span><button data-act="reload">새로 고침</button>`);   // nothing can be saved: do not start
  await G.sound.unlock();                                  // inside the tap
  const seed = Number(qs.get('seed')) || Math.floor(Math.random() * 1e9); const rng = mulberry32(seed + G.st.runs.length);
  let node;
  if (nodeId.startsWith('finale:')) node = finaleRun(G.ix, G.ix.continents.find((c) => c.id === nodeId.slice(7)), G.st, todayISO(), rng);
  else node = nodeRun(G.ix, worldView(G.ix, G.world, G.st, todayISO()), nodeId, G.st, G.words, rng);
  if (!node) return today(G.pid);
  if (node.triage) return triage(node, rng);               // new words on this tile: the child first marks the unknown ones
  return begin(node, rng);
}
// The tile's new words as spellings only (no meaning, no picture: nothing is answered before it is asked). Tapped = unknown.
function triage(node, rng) {
  G.view = 'triage'; G.tri = { node, rng, marked: new Set() }; band(false); hideBanner();
  $('#app').innerHTML = `<div class="page center tri"><button class="back" data-act="today" aria-label="돌아가기">‹</button><h1 class="title">모르는 단어를 눌러요</h1>
  <div class="twords">${node.triage.map((id) => `<button class="tw" data-act="tmark" data-id="${esc(id)}" aria-pressed="false">${esc(G.byId[id].form)}</button>`).join('')}</div>
  <button class="go" data-act="tgo" id="tgo">다 알아요</button></div>`;
}
function triageMark(b) {
  const t = G.tri; if (!t || G.view !== 'triage') return; const id = b.dataset.id; const on = !t.marked.has(id);
  if (on) t.marked.add(id); else t.marked.delete(id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  $('#tgo').textContent = t.marked.size ? `${t.marked.size}개 배우러 가기` : '다 알아요';
  const w = G.byId[id]; G.sound.unlock().then(() => G.sound.play(w.id, w.form)).catch(() => {});   // the sound is a help only: a failure shows no banner here
}
async function triageGo() {
  const t = G.tri; if (!t || G.view !== 'triage') return; G.tri = null; await G.sound.unlock();
  return begin(triageScope(t.node, triagePlan(t.node.triage, [...t.marked], t.rng), todayISO()), t.rng);
}
function begin(node, rng) {
  const items = takeBag(G.st); G.node = node; startTile(G.st, node, todayISO()); if (!save() && G.readonly) return;   // the mark is saved before any word is
  if (!G.boss || G.boss.day !== todayISO() || G.boss.pid !== G.pid) G.boss = { idx: 0, hp: CFG.bossHp, defeated: 0, day: todayISO(), pid: G.pid };
  G.run = new Run({ state: G.st, words: G.words, today: todayISO(), rng, boss: G.boss, scope: node.scope, items, tag: node.tag });
  G.view = 'card'; band(true); G.shieldSeen = 0; G.sound.sfxPlay('step'); G.sound.scene(['castle', 'bat', 'finale'].includes(node.kind) ? 'castle' : 'study');
  $('#app').innerHTML = `<div class="run">
  <header class="hud"><button class="x" data-act="quit" aria-label="그만하기">✕</button>
    <div class="boss"><span class="boss-emoji" id="boss"></span><div class="hpbar"><i id="hp"></i></div><span class="floater" id="floater"></span></div>
    <div class="combo" id="combo"></div><div class="left" id="left"></div></header>
  <section class="stage"><div class="card" id="card"></div></section>
  <footer class="actions" id="actions"></footer></div>`;
  paintHud(); showCard();
}
function paintHud() {
  const b = G.run.boss; const be = bossPic(G.world, b.idx);
  if ($('#boss').dataset.e !== be.key) { $('#boss').dataset.e = be.key; $('#boss').innerHTML = be.html(56); } $('#hp').style.width = `${Math.max(0, b.hp) / CFG.bossHp * 100}%`;
  $('#combo').innerHTML = (G.run.items.shield ? spr(ITEM_SPR.shield, 24) : '') + (G.run.items.flame ? spr(ITEM_SPR.flame, 24) : '') + (G.run.combo >= 2 ? `연속 ${G.run.combo}` : ''); $('#combo').classList.toggle('hot', G.run.combo >= 5);
  $('#left').textContent = `남은 카드 ${G.run.left}`;
}
function bossPic(w, i) {
  const sp = w?.bossSprites; if (sp?.length && document.getElementById(sp[i % sp.length])) { const id = sp[i % sp.length]; return { key: id, html: (n) => spr(id, n) }; }
  const list = w?.bossEmoji?.length ? w.bossEmoji : BOSSES; const e = list[i % list.length]; return { key: e, html: (n) => pimg(e, n) };
}
const TAG = { castle: '박쥐·성 시험', new: '새 카드', review: '다시 만난 카드', likely: '다시 만난 카드', relearn: '방금 배운 카드', practice: '한 번 더', retry: '다시 도전' };
const HEAR = `<button class="hear" data-act="hear" aria-label="다시 듣기"><svg class="spr" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><use href="#sound" width="32" height="32"/></svg></button>`;
function front(it, w) {
  const g = gradeOf(G.st.words[w.id]); const chk = it.form === 'check' || it.verifying; const listen = chk && isSight(w) && !it.shown;   // a function word: hear it, pick the spelling
  $('#card').className = `card g${g} ${listen ? 'listen' : ''}`;
  $('#card').innerHTML = `<div class="tag ${chk ? 'chk' : ''}" id="tag">${chk ? (isSight(w) ? '확인! 글자를 골라요' : '확인! 뜻을 골라요') : TAG[it.role]}</div>
    ${listen ? `<div class="ear" id="word" data-hidden="1"><svg class="spr" width="96" height="96" viewBox="0 0 32 32" aria-hidden="true"><use href="#sound" width="32" height="32"/></svg><span>소리를 듣고 글자를 골라요</span></div>` : `<div class="word" id="word">${esc(w.form)}</div>`}${HEAR}`;
}
// A word the child marked as unknown is not asked again: one button shows the meaning (judge(false)).
function judgeButtons(it) { $('#actions').innerHTML = it?.taught ? `<button class="act yes see" data-act="no">뜻 보기</button>` : `<button class="act no" data-act="no">몰라요</button><button class="act yes" data-act="yes">알아요</button>`; }
function optionButtons(it) {
  const en = isSight(G.byId[it.id]) ? 'en' : '';
  $('#actions').innerHTML = `<div class="opts">${it.options.map((o, i) => `<button class="act opt ${en}" data-act="opt" data-i="${i}">${esc(o.ko)}</button>`).join('')}</div>
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
  front(it, w); if (it.form === 'check') optionButtons(it); else judgeButtons(it);
  lock(true); paintHud(); $('#card').classList.add('in'); speak(false);
}
function onJudge(know) {
  if (G.busy || G.view !== 'card') return; G.sound.sfxPlay('flip'); const it = G.run.current;
  const res = G.run.judge(know);
  if (res.next === 'verify') { front(it, G.byId[it.id]); optionButtons(it); G.sound.blip('hit'); return; }
  reveal(res);
}
function onPick(i) {
  if (G.busy || G.view !== 'card') return;
  reveal(G.run.pick(i));                                 // the card back shows the right answer; the options are cleared
}
function reveal(res) {
  G.busy = true; lock(true); save(); const w = res.word; const card = $('#card'); const shielded = G.run.shieldUsed > (G.shieldSeen || 0); G.shieldSeen = G.run.shieldUsed;
  const up = res.grade && res.grade.to > res.grade.from ? res.grade.to : 0; const sight = isSight(w);
  const line = res.ok ? (up ? `${GRADE[up]} 카드!` : res.verified ? '확인 성공!' : '') : res.said === 'wrong' ? (sight ? '이 글자예요' : '이 뜻이에요') : '이제 배워요';
  card.classList.remove('in'); card.classList.add('flip');
  setTimeout(() => {
    card.className = `card back g${gradeOf(G.st.words[w.id])} ${res.ok ? 'ok' : 'learn'} ${up ? 'up' : ''}`;
    card.innerHTML = `${up ? `<span class="sparkle">${anim('sparkle-a', 'sparkle-b', 48, 'fast')}</span><span class="sparkle l">${anim('sparkle-b', 'sparkle-a', 48, 'fast')}</span>` : ''}${sight ? `<div class="word">${esc(w.form)}</div>` : `${w.emoji ? `<div class="emoji">${pimg(w.emoji, 88)}</div>` : ''}<div class="ko">${esc(w.ko)}</div><div class="word small">${esc(w.form)}</div>`}${line ? `<div class="line">${up ? spr(MEDAL[up], 24) : ''}${line}</div>` : ''}`;
  }, FAST ? 0 : 90);
  if (res.dmg) { const f = $('#floater'); f.textContent = `-${res.dmg}`; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    $('#boss').classList.remove('hit'); void $('#boss').offsetWidth; $('#boss').classList.add('hit'); G.sound.blip(res.defeated ? 'boss' : res.verified || (G.run.items.flame && res.dmg >= 2) ? 'big' : 'hit');
    if (G.run.items.flame) setTimeout(() => G.sound.sfxPlay('flame'), 120); if (res.combo === 5) setTimeout(() => G.sound.sfxPlay('combo'), 160); }
  else G.sound.blip(res.said === 'wrong' && !shielded ? 'miss' : shielded ? 'shield' : 'retry');
  if (up) setTimeout(() => G.sound.jingle('grade'), 250);
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
  const rw = settleRun(G.st, node, run, rec, todayISO(), mulberry32(Date.now() % 1e9)); const ww = settleWorld(G.ix, G.st, node, rec, todayISO()); save(); G.sync?.flush().catch(() => {});
  G.view = 'end'; band(false); hideBanner(); const n = rec.n; const ups = run.changed.filter((c) => c.to > c.from); const w = G.world; const pc = (x) => Math.round(x * 100);
  const batNow = rw.batFull && !(node.kind === 'bat' && rw.bat.done);
  const title = { tile: ww.cleared ? '칸 클리어!' : `${n}판 끝!`, monster: rw.monster ? '몬스터를 물리쳤어요!' : '몬스터가 남았어요', castle: ww.key ? '성을 깼어요!' : '성 시험 결과',
    finale: ww.finale?.pass ? '큰 성을 깼어요!' : '큰 성 시험 결과', bat: rw.bat?.done ? '박쥐를 쫓아냈어요!' : '박쥐가 남았어요', review: `${n}판 끝!` }[node.kind];
  const lines = rw.stars > 0 ? [`<div class="gain">${spr('star', 32)} +${rw.stars}${rw.mult > 1 ? ` <em>(×${rw.mult})</em>` : ''}</div>`] : [];
  if (rw.item) lines.push(`<div class="gain">${spr(ITEM_SPR[rw.item], 40)} ${ITEMS[rw.item].name}을 얻었어요</div>`);
  if (ww.key) lines.push(`<div class="gain" id="keygain">${spr('key', 32)} ${esc(w.key?.name || '열쇠')}를 얻었어요</div>`);
  if (ww.crown) lines.push(`<div class="gain" id="crowngain">${spr('crown', 32)} 이 세계의 왕관을 얻었어요</div>`);
  if (ww.key && w.outro) lines.push(`<p class="story">${esc(w.outro)}</p>`);
  if (ww.key && ww.nextWorld && w.story) lines.push(`<p class="story">${esc(w.story)}</p>`);
  if (ww.finale?.pass && ww.finale.outro) lines.push(`<p class="story">${esc(ww.finale.outro)}</p>`);
  if (ww.finale?.pass) lines.push(`<p class="story">${ww.nextContinent ? `${esc(ro(ww.nextContinent.name))} 가는 길이 열렸어요!` : '모든 편지를 전했어요. 집으로 돌아가요!'}</p>`);
  if (rw.bat) lines.push(rw.bat.done ? `<p class="mut">${rw.bat.ok}/${rw.bat.total}장 맞혔어요 (${pc(rw.bat.acc)}%). ${rw.batFull ? '' : '박쥐 게이지가 0으로 돌아가요. '}${rw.bat.acc >= 0.9 ? '아주 잘 외우고 있어요. 다음 박쥐는 더 늦게 와요.' : rw.bat.acc < 0.7 ? '다음 박쥐는 조금 더 일찍 올 거예요. 틀린 카드는 다시 나와요.' : ''}</p>` : '<p class="mut">시험을 다 마치면 박쥐가 사라져요.</p>');
  if (batNow && node.kind !== 'bat') lines.push(`<div class="gain bat">${anim('bat-a', 'bat-b', 32)} 박쥐 게이지가 가득 찼어요!</div>`);
  if (batNow && node.kind === 'bat') lines.push('<p class="mut">미뤄 둔 복습이 아직 많아요. 박쥐가 한 번 더 와요.</p>');
  const exam = ww.castle || ww.finale; if (exam && !exam.pass) lines.push(`<p class="mut">${exam.ok}/${exam.total}장 맞혔어요. ${pc(exam.need)}% 이상이면 통과예요. 틀린 카드는 내일 다시 나와요.</p>`);
  const go = batNow ? ['bat-go', '박쥐 시험'] : ww.key && ww.nextWorld ? ['goworld', `▶ ${ro(ww.nextWorld.name)}`] : ww.finale?.pass && ww.nextContinent ? ['goworld', `▶ ${ro(ww.nextContinent.name)}`] : ['today', '▶ 지도로'];
  const goId = ww.key && ww.nextWorld ? ww.nextWorld.id : ww.finale?.pass && ww.nextContinent ? ww.nextContinent.worlds[0].id : '';
  $('#app').innerHTML = `<div class="page center"><h1 class="title">${title}</h1>${lines.join('')}
  <div class="tiles"><div><b>${rec.cards}</b><span>넘긴 카드</span></div><div><b>${rec.bosses}</b><span>잡은 보스</span></div><div><b>${rec.learned}</b><span>새로 배운 카드</span></div></div>
  ${ups.length ? `<p class="mut">등급이 오른 카드</p><div class="minis">${ups.map((c) => miniCard(G.byId[c.id], c.to)).join('')}</div>` : ''}
  <button class="go" data-act="${go[0]}" data-id="${esc(goId)}">${esc(go[1])}</button>${go[0] !== 'today' ? '<p><button class="link" data-act="today">지도에서 보기</button></p>' : ''}</div>`;
  G.run = null; G.node = null;
  G.sound.scene(musicOf(w));
  const jg = batNow ? 'bat' : ww.key || ww.finale?.pass ? 'victory' : ww.cleared || rw.monster || rw.bat?.done ? 'clear' : rw.item ? 'item' : null; if (jg) setTimeout(() => G.sound.jingle(jg), 150);
  if (ww.key) setTimeout(() => G.sound.jingle('key'), 1800); else if (ww.cleared) G.sound.sfxPlay('stamp');
}

// ---- lightning round (bonus house): true / false pairs, 60 seconds, touches no word ----
async function startLightning() {
  if (G.readonly || !catchUp()) return banner(`<span>${NEWER}</span><button data-act="reload">새로 고침</button>`);
  await G.sound.unlock(); const rng = mulberry32((Number(qs.get('seed')) || Date.now() % 1e9) + 7);
  G.lt = new Lightning({ state: G.st, words: G.words, rng, seconds: LT_SECONDS }); if (!G.lt.ready) return today(G.pid, MSG.bonusLocked);
  G.view = 'lightning'; band(true); G.ltEnd = Date.now() + LT_SECONDS * 1000; G.sound.scene('play');
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
  clearInterval(G.timer); if (G.view !== 'lightning') return; G.view = 'end'; band(false); G.sound.stop(); G.sound.sfxPlay('lightning-end'); G.sound.scene(musicOf(G.world));
  const r = settleLightning(G.st, G.lt, todayISO()); save(); G.sync?.flush().catch(() => {}); const sc = G.lt.score;
  $('#app').innerHTML = `<div class="page center"><h1 class="title">번개 끝!</h1><div class="tiles"><div><b>${sc}</b><span>맞힌 수</span></div><div><b>${G.st.map.best}</b><span>내 최고 기록</span></div></div>
  ${r.newBest ? '<div class="gain">새 기록!</div>' : ''}${r.item ? `<div class="gain">${spr(ITEM_SPR[r.item], 40)} ${ITEMS[r.item].name}을 얻었어요</div>` : r.first ? '<p class="mut">3개 이상 맞히면 아이템을 줘요</p>' : ''}
  <button class="go" data-act="today">▶ 지도로</button></div>`;
  G.lt = null;
}

// ---- playhouses: short games off the long paths. Pure play: they touch no word, star, gauge or key; one stamp each. ----
async function startGame(n) {
  await G.sound.unlock(); G.view = 'game'; band(false); G.sound.scene('play'); const rng = mulberry32((Number(qs.get('seed')) || Date.now() % 1e9) + 11);
  const em = [0, 1, 2];                                    // three of the world's boss pictures, as pairs
  G.game = n.gameType === 'memory' ? { node: n, type: 'memory', deck: shuffle([...em, ...em], rng), open: [], matched: new Set(), busy: false }
    : { node: n, type: 'mail', done: 0, t0: performance.now(), pos() { return 50 + 38 * Math.sin((performance.now() - this.t0) / (FAST ? 90 : 900)); }, inZone() { return Math.abs(this.pos() - 50) <= 13; } };
  paintGame();
  if (G.game.type === 'mail') { const tick = () => { if (G.view !== 'game' || !G.game || G.game.type !== 'mail') return; const b = $('#mailbox'); if (b) b.style.left = G.game.pos() + '%'; requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
}
function paintGame() {
  const g = G.game; const head = `<button class="back" data-act="today" aria-label="그만 놀고 지도로">‹</button>`;
  if (g.type === 'memory') {
    $('#app').innerHTML = `<div class="page center game">${head}<h1 class="title">그림 짝 맞추기</h1><p class="mut" id="gstatus">${g.matched.size / 2} / 3쌍</p>
    <div class="memgrid">${g.deck.map((e, i) => { const up = g.matched.has(i) || g.open.includes(i); return `<button class="memcard ${g.matched.has(i) ? 'matched' : ''}" data-act="mem" data-i="${i}" aria-label="${i + 1}번째 카드" ${g.matched.has(i) ? 'disabled' : ''}>${up ? bossPic(G.world, e).html(72) : spr('envelope', 64)}</button>`; }).join('')}</div>
    <p class="mut small">두 장씩 뒤집어 같은 그림을 찾아요. 서두르지 않아도 돼요.</p></div>`;
  } else {
    $('#app').innerHTML = `<div class="page center game">${head}<h1 class="title">우체통에 편지 넣기</h1><p class="mut" id="gstatus">${g.done} / 3통</p>
    <div class="mailtrack"><div class="mailzone"></div><div class="mailbox" id="mailbox" style="left:${g.pos()}%"><svg class="spr" width="96" height="96" viewBox="0 0 64 64" aria-hidden="true"><use href="#mailbox" width="64" height="64"/></svg></div></div>
    <button class="go" data-act="mail">${spr('envelope', 40)} 넣기!</button><p class="mut small" id="ghint">우체통이 노란 칸에 왔을 때 눌러요. 틀려도 괜찮아요.</p></div>`;
  }
}
function memPick(i) {
  const g = G.game; if (!g || g.type !== 'memory' || g.busy || g.matched.has(i) || g.open.includes(i)) return; g.open.push(i); G.sound.sfxPlay('flip');
  if (g.open.length < 2) return paintGame();
  const [a, b] = g.open;
  if (g.deck[a] === g.deck[b]) { g.matched.add(a); g.matched.add(b); g.open = []; G.sound.sfxPlay('correct'); paintGame(); if (g.matched.size === g.deck.length) setTimeout(endGame, FAST ? 30 : 500); }
  else { g.busy = true; paintGame(); setTimeout(() => { if (G.game !== g) return; g.open = []; g.busy = false; paintGame(); }, FAST ? 30 : 800); }
}
function mailDrop() {
  const g = G.game; if (!g || g.type !== 'mail') return;
  if (g.inZone()) { g.done++; G.sound.sfxPlay('mail'); if (g.done >= 3) return endGame(); $('#gstatus').textContent = `${g.done} / 3통`; $('#ghint').textContent = '쏙! 잘 넣었어요.'; }
  else { G.sound.sfxPlay('retry'); $('#ghint').textContent = '조금만 더 기다렸다가 눌러요.'; }
}
function endGame() {
  const g = G.game; if (!g) return; const fresh = stampGame(G.st, G.world, g.node.id, todayISO()); if (fresh) save(); G.view = 'end'; G.game = null; G.sound.scene(musicOf(G.world)); G.sound.sfxPlay('stamp'); if (fresh) setTimeout(() => G.sound.jingle('item'), 200);
  $('#app').innerHTML = `<div class="page center"><h1 class="title">잘 놀았어요!</h1><div class="gain" id="stampgain">${spr('stamp', 40)} ${fresh ? '엽서에 놀이 도장을 찍었어요' : '이 도장은 이미 모았어요'}</div>
  <p class="mut">놀이 도장은 카드 공부와는 상관없는 기념이에요.</p><button class="go" data-act="today">▶ 지도로</button></div>`;
}

// ---- album: the cards of this world ----
function album() {
  G.view = 'album'; const st = G.st; const ids = worldWords(G.world); const ws = ids.map((id) => G.byId[id]); const c = gradeCounts(st, ws);
  $('#app').innerHTML = `<div class="page"><button class="back" data-act="today" aria-label="돌아가기">‹</button><h1 class="title center">${esc(G.world.name)} 카드첩</h1>
  <p class="center mut">금 ${c[3]} · 은 ${c[2]} · 동 ${c[1]} · 아직 ${c[0]}</p><div id="peek" class="peek center"></div>
  <div class="minis grid">${ws.map((w) => { const r = st.words[w.id]; return r ? miniCard(w, gradeOf(r)) : '<div class="mini unseen">?</div>'; }).join('')}</div></div>`;
}

// ---- parent ----
function parent() {
  G.view = 'parent'; hideBanner(); band(false); const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '-');
  const block = (id) => { const st = load(id); const c = gradeCounts(st, G.words); const R = st.runs; const m = ensureMap(st); const a = atlasView(G.ix, st); const all = a.flatMap((x) => x.worlds);
    const T = totals(st); const tot = { cards: T.cards, wall: T.wall, claims: T.claims, v: T.verifies, vok: T.verifyOk, rv: T.reviews, rok: T.reviewOk, sp: T.spots, spok: T.spotOk, bd: T.bunchDone, bok: T.bunchOk };
    return `<h2>${esc(name(id))}</h2><p class="small">별 ${m.stars} · 열쇠 ${all.filter((w) => w.castle).length}/${all.length} · 왕관 ${all.filter((w) => w.crown).length} · 큰 성 ${a.filter((x) => x.finale.status === 'cleared').length}/${a.length} · 만난 카드 ${Object.keys(st.words).length}/${new Set(G.ix.worlds.flatMap(worldWords)).size} · 번개 최고 ${m.best} · 밀린 복습 ${dueCount(st, todayISO())}장 · 박쥐 ${m.bat.fill}/${m.bat.cap} · 금 ${c[3]} · 은 ${c[2]} · 동 ${c[1]} · 아직 ${c[0]} / 전체 ${T.n}판, 카드 ${tot.cards}장, 분당 ${tot.wall ? (tot.cards / (tot.wall / 6e4)).toFixed(1) : '-'}장, "알아요" 확인 정답률 ${pct(tot.vok, tot.v)} (${tot.vok}/${tot.v}), 복습 정답률 ${pct(tot.rok, tot.rv)} (${tot.rok}/${tot.rv}), 넘긴 단어 확인 정답률 ${pct(tot.spok, tot.sp)} (${tot.spok}/${tot.sp}), 묶음 확인 ${tot.bok}/${tot.bd}</p>
    <table><tr><th>날짜</th><th>판</th><th>칸</th><th>카드</th><th>시간</th><th>분당</th><th>카드당</th><th>알아요</th><th>확인</th><th>새 카드 앎/모름</th><th>배움</th><th>복습</th><th>보스</th></tr>
    ${R.slice(-60).map((r) => `<tr><td>${r.day}</td><td>${r.n}</td><td>${esc(r.tag || '-')}</td><td>${r.cards}</td><td>${Math.round(r.wall / 1000)}초</td><td>${r.wall ? (r.cards / (r.wall / 6e4)).toFixed(1) : '-'}</td><td>${r.cards ? (r.wall / r.cards / 1000).toFixed(1) : '-'}초</td>
      <td>${r.claims}</td><td>${r.verifyOk}/${r.verifies}</td><td>${r.known}/${r.unknown}</td><td>${r.learned}</td><td>${r.reviewOk}/${r.reviews}</td><td>${r.bosses}</td></tr>`).join('') || '<tr><td colspan="13">기록 없음</td></tr>'}</table>${R.length > 60 ? `<p class="small mut">최근 60판만 표시. 전체는 내보내기 파일에 있습니다.</p>` : ''}
    <p class="row"><button class="sec" data-act="export" data-id="${id}">기록 내보내기(파일)</button><label class="sec filebtn">파일에서 복원<input type="file" accept=".json,application/json" data-restore="${id}" hidden></label>
      <select id="snap-${id}" aria-label="날짜별 사본"><option value="">날짜별 사본…</option></select><button class="sec" data-act="snap" data-id="${id}">그 날짜 사본에서 복원</button><button class="link" data-act="reset" data-id="${id}">이 기기의 기록 지우기</button></p>
    <p class="small mut">복원은 지금 기록에 합치는 방식이라 어느 쪽 기록도 지워지지 않습니다.</p>`; };
  $('#app').innerHTML = `<div class="page parent"><button class="back" data-act="home" aria-label="처음으로">‹</button><h1 class="title">부모 기록</h1>
  <p class="small mut">분당 카드는 뜻을 보는 시간까지 포함한 실제 속도, 확인 정답률은 "알아요"라고 한 카드를 뜻 고르기로 확인한 결과, 복습 정답률은 날짜가 된 복습 카드의 결과, 넘긴 단어 확인은 단어 목록에서 넘긴 단어를 바로 뜻 고르기로 확인한 결과, 묶음 확인은 30일 뒤 표본 확인을 통과한 칸 묶음 수/끝난 묶음 수입니다. 소리: ${esc(G.sound.source)}${G.dataNote ? ' · ' + esc(G.dataNote) : ''}</p><p class="small" id="syncline">${esc(syncLine())}</p>
  <div class="safety" id="safety"><b>기록 보관 상태</b><span>① 이 기기: ${G.volatile ? '저장 불가' : '저장 중'}</span><span id="sf-server">② Mac 서버: 확인 중…</span><span id="sf-daily">③ 날짜별 사본: 확인 중…</span><span id="sf-off">④ 외부 백업(GitHub): 확인 중…</span></div>
  <p class="msg small" id="pmsg">${esc(G.pmsg || '')}</p>
  ${PROFILES.map(block).join('')}
  <h2>이름</h2><p class="row"><input id="nm-son" value="${esc(name('son'))}" size="8"><input id="nm-daughter" value="${esc(name('daughter'))}" size="8"><button class="sec" data-act="names">저장</button></p></div>`;
  paintSafety();
}
// The four places a record is kept, and the dated copies a parent can restore from.
async function paintSafety() {
  const set = (id, t, bad) => { const e = document.getElementById(id); if (e) { e.textContent = t; e.classList.toggle('bad', !!bad); } }; G.pmsg = '';
  let ping = null; try { const r = await fetch('api/ping'); ping = r.ok ? await r.json() : null; } catch {}
  if (!ping || !ping.store) { set('sf-server', '② Mac 서버: 연결 안 됨', true); set('sf-daily', '③ 날짜별 사본: 서버 필요', true); set('sf-off', '④ 외부 백업(GitHub): 서버 필요', true); return; }
  set('sf-server', '② Mac 서버: 연결됨'); set('sf-daily', ping.daily ? `③ 날짜별 사본: ${ping.daily}일치 (최근 ${ping.lastDaily})` : '③ 날짜별 사본: 아직 없음', !ping.daily);
  const off = ping.offsite; const age = off?.at ? (Date.now() - Date.parse(off.at)) / 864e5 : null;
  set('sf-off', !off ? '④ 외부 백업(GitHub): 설정 안 됨 (docs/DATA_SAFETY.md)' : off.ok ? `④ 외부 백업(GitHub): ${off.at.slice(0, 10)}${age > 3 ? ' (3일 넘게 안 됨)' : ''}` : `④ 외부 백업(GitHub): 실패 (${off.at.slice(0, 10)})`, !off || !off.ok || age > 3);
  for (const id of PROFILES) { try { const r = await fetch('api/snapshots/p.' + id); const days = r.ok ? (await r.json()).days : []; const sel = document.getElementById('snap-' + id); if (sel) sel.innerHTML = '<option value="">날짜별 사본…</option>' + days.slice().reverse().map((d) => `<option>${d}</option>`).join(''); } catch {} }
}
// Restore = merge into the current record. Nothing on either side is removed.
function restore(id, text) {
  const b = readBackup(text, id); if (!b.ok) { G.pmsg = `복원하지 못했어요: ${b.why}`; return parent(); }
  const before = Object.keys(load(id).words).length; const merged = mergeCards(load(id), b.state);
  try { localStorage.setItem(KEY(id), JSON.stringify(merged)); G.sync?.changed('p.' + id); G.pmsg = `${name(id)}: 복원했어요. 카드 기록 ${before}장 → ${Object.keys(merged.words).length}장 (파일에는 ${b.words}장).`; }
  catch (e) { G.pmsg = `복원하지 못했어요: ${e.message}`; }
  return parent();
}
function download(nm, obj) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = nm; document.body.appendChild(a); a.click(); a.remove(); }

async function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const a = b.dataset.act;
  if (!['yes', 'no', 'opt', 'hear', 'lt-yes', 'lt-no', 'node', 'mem', 'mail', 'tmark'].includes(a)) G.sound.sfxPlay('tap');
  switch (a) {
    case 'music': await G.sound.unlock(); G.sound.setMusic(!G.sound.musicOn); savePref(); return today(G.pid);
    case 'sfx': G.sound.setSfx(!G.sound.sfx); savePref(); G.sound.sfxPlay('tap'); return today(G.pid);
    case 'home': return home();
    case 'reload': return location.reload();
    case 'hide': return hideBanner();
    case 'snap': { const day = document.getElementById('snap-' + b.dataset.id)?.value; if (!day) { G.pmsg = '복원할 날짜를 먼저 고르세요.'; return parent(); }
      try { const r = await fetch(`api/snapshot/p.${b.dataset.id}/${day}`); if (!r.ok) throw new Error('사본을 읽지 못했어요'); return restore(b.dataset.id, await r.text()); } catch (e) { G.pmsg = `복원하지 못했어요: ${e.message}`; return parent(); } }
    case 'pick': await G.sound.unlock(); return openProfile(b.dataset.id);
    case 'today': return today(G.pid);
    case 'atlas': return atlas();
    case 'goworld': return today(G.pid, '', b.dataset.id);
    case 'finale': { const c = atlasView(G.ix, G.st).find((x) => x.id === b.dataset.id); if (c.finale.status === 'open') return start('finale:' + c.id);
      $('#msg').textContent = c.finale.status === 'cleared' ? '이 큰 성은 이미 깼어요.' : c.finale.status === 'pending' ? MSG.soon : `${c.name}의 왕관을 모두 모으면 열려요 (${c.crowns}/${c.total}). 왕관은 그 세계의 모든 칸과 집, 성을 깨면 받아요.`; return; }
    case 'node': return nodeClick(b.dataset.id);
    case 'bat-go': return start('bat');
    case 'bag': chooseBag(G.st, b.dataset.item); save(); return today(G.pid);
    case 'mem': return memPick(Number(b.dataset.i));
    case 'mail': return mailDrop();
    case 'lt-yes': return ltAnswer(true);
    case 'lt-no': return ltAnswer(false);
    case 'lt-quit': clearInterval(G.timer); G.lt = null; return today(G.pid);
    case 'yes': return onJudge(true);
    case 'no': return onJudge(false);
    case 'opt': return onPick(Number(b.dataset.i));
    case 'next': return next();
    case 'tmark': return triageMark(b);
    case 'tgo': return triageGo();
    case 'hear': await G.sound.unlock(); return speak(true);
    case 'mute-go': { const it = G.run?.current; if (it) { it.sound = 'none'; if (isSight(G.byId[it.id]) && $('#word')?.dataset.hidden) { it.shown = true; front(it, G.byId[it.id]); } } hideBanner(); lock(false); if (G.run) G.run.t0 = Date.now(); return; }   // without sound a hear-and-pick card shows its word
    case 'quit': if (G.run) return endRun('left'); return today(G.pid);
    case 'album': return album();
    case 'peek': { const w = G.byId[b.dataset.id]; if (!w) return; const p = $('#peek'); if (p) p.innerHTML = `<b>${esc(w.form)}</b> ${esc(w.ko)} ${w.emoji || ''}`; await G.sound.unlock(); return G.sound.play(w.id, w.form); }
    case 'parent': G.pmsg = ''; return parent();
    case 'export': return download(`cards_${b.dataset.id}_${todayISO()}.json`, load(b.dataset.id));
    case 'reset': if (confirm(`${name(b.dataset.id)}의 카드 기록을 이 기기에서 지울까요?${G.syncStatus?.available ? ' (Mac 서버의 사본은 남아 있고 다음에 다시 불러옵니다)' : ''}`)) { localStorage.removeItem(KEY(b.dataset.id)); } return parent();
    case 'names': G.meta.names = { son: $('#nm-son').value.trim() || '아들', daughter: $('#nm-daughter').value.trim() || '딸' }; localStorage.setItem('cards.v0.meta', JSON.stringify(G.meta)); G.sync?.changed('meta'); return parent();
  }
}
boot();
