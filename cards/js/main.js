// Flashcard game: screens. Rules live in deck.js (cards), map.js (review load, items), world.js (worlds, castles); audio in sound.js.
import { Run, newState, gradeOf, gradeCounts, mulberry32, shuffle, isSight, CFG } from './deck.js';
import { Sound } from './sound.js';
import { ensureMap, dueCount, settleRun, chooseBag, takeBag, Lightning, settleLightning, ITEMS, LIGHTNING_MIN, TRIAGE, triagePlan, triageScope } from './map.js';
import { indexWorlds, worldView, atlasView, currentWorld, nodeRun, finaleRun, settleWorld, enterWorld, stampGame, worldWords, worldOpen, setLeftOutKinds, startTile } from './world.js';
import { Sync, mergeCards } from './sync.js';
import { loadRecord, compact, totals, readBackup, migrate, setAside } from './store.js';
import { STORM, indexForms, formDone, hereOf, stormOf, stormBlocks, stormRelease, stormTick, StormRun, settleStorm } from './storm.js';

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
const G = { fx: null, srun: null, stormEv: null, ix: null, world: null, node: null, lt: null, game: null, words: [], byId: {}, meta: null, pid: null, st: null, run: null, boss: null, view: 'home', busy: false, timer: null, sound: null };
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
  fold(mergeCards(G.st, m.state, G.ix)); return true;
}
function save() {
  if (G.readonly) { banner(`<span>${NEWER}</span><button data-act="reload">새로 고침</button>`); return false; }
  try { if (!catchUp()) return false; compact(G.st, todayISO()); const text = JSON.stringify(G.st); localStorage.setItem(KEY(G.pid), text); G.seen = text; G.sync?.changed('p.' + G.pid); rememberPetUnlock(); return true; } catch (e) { banner(`저장에 실패했어요: ${esc(e.message)}`); return false; }
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
  const rec = loadRec(id); G.notice = rec.damaged && rec.kept === false ? '이 기기에 있던 기록을 읽을 수 없는데, 저장 공간이 모자라 따로 보관하지도 못했어요. 그 기록을 지우지 않도록 이 기기에서는 기록을 바꾸지 않아요. 부모 기록 화면에서 서버나 백업 파일로 복원해 주세요.' : rec.damaged ? '이 기기에 있던 기록을 읽을 수 없어 따로 보관했어요. 서버나 백업 파일의 기록으로 이어 갑니다(부모 기록 화면에서 복원할 수 있어요).' : '';   // set aside before the server copy is fetched
  if (G.sync?.available) { try { await G.sync.reconcile('p.' + id); } catch {} } return today(id);
}
const name = (id) => G.meta.names[id];

const PREF = 'cards.v0.pref';                           // this device only: music on/off, effects on/off
function loadPref() { try { const p = JSON.parse(localStorage.getItem(PREF) || '{}'); return { music: typeof p?.music === 'boolean' ? p.music : true, sfx: typeof p?.sfx === 'boolean' ? p.sfx : true }; } catch { return { music: true, sfx: true }; } }
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

// Word forms for the whirlwind (storm.js, card T-008). No file, an unreadable one or ?storm=off: no whirlwind (STORM.on false),
// and the game opens as before. The demo set keeps only the forms whose base word is one of its cards.
async function loadForms() {
  if (qs.get('storm') === 'off') { G.fx = null; STORM.on = false; return; }   // test-only: no whirlwind
  let doc = null; try { const r = await fetch('data/forms.json'); if (r.ok) doc = await r.json(); } catch {}
  if (doc && Array.isArray(doc.forms) && DATA !== 'data/') doc = { ...doc, forms: doc.forms.filter((f) => f && G.byId[f.base]) };
  G.fx = indexForms(doc); STORM.on = !!G.fx;
  if (qs.get('storm') === 'now' && G.fx) STORM.chance = 1;            // test-only: a whirlwind comes whenever the rules allow one
}
// The whirlwind pictures (C-004) live in the world pixel sheet; a world file without that sheet (the demo set) gets only them.
const STORM_SHEET = 'assets/postal/world-pixels/sprites.svg';
async function loadStormSprites() {
  if (document.getElementById('fx-storm-a')) return;
  try { const r = await fetch(STORM_SHEET); if (!r.ok) return; const doc = new DOMParser().parseFromString(await r.text(), 'image/svg+xml');
    const keep = [...doc.querySelectorAll('symbol[id^="fx-storm"]')].map((x) => x.outerHTML).join(''); if (!keep) return;
    const d = document.createElement('div'); d.className = 'sheet'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${keep}</svg>`; document.body.prepend(d); } catch { /* no picture: the whirlwind is drawn as an empty button */ }
}

async function boot() {
  let storage; try { storage = window.localStorage; storage.setItem('_t', '1'); storage.removeItem('_t'); } catch { storage = null; }
  G.volatile = !storage; G.syncStatus = { available: false, pending: [] };
  try {
    const json = (r) => { if (!r.ok) throw new Error(`${r.url.split('/').slice(-2).join('/')} 파일을 읽지 못했어요 (${r.status})`); return r.json(); };
    // The world file (from the world generator) is the only source of the maps and word assignment. If it cannot be read the
    // "열 수 없어요" screen says why; there is no stand-in file, so a child's record never lands on a guessed assignment.
    const doc = await fetch(DATA + 'worlds.json').then(json, () => { throw new Error('worlds.json 파일을 읽지 못했어요 (연결 없음)'); });
    const cat = await fetch(DATA + (doc.catalogue || 'catalog.json')).then(json);       // the real file names catalogue.json; the small demo file names none and uses its own catalog.json
    // Card fields this game reads: track ("sight" = hear-and-pick card) and groups (confusion groups, never offered as wrong answers).
    G.words = cat.words.map((w) => ({ ...w, track: w.track || (w.answerMode === 'listen-spelling' || w.learningKind === 'sight' ? 'sight' : 'vocab'), groups: w.groups || (w.confusionGroups?.length ? w.confusionGroups : undefined) }));
    if (qs.get('houses') === 'sight') setLeftOutKinds([]);            // test-only: bring the hear-and-pick houses back
    if (qs.get('triage') === 'off') TRIAGE.on = false;                 // test-only: every new word one card at a time, as before the word list
    if (qs.get('theme') === 'off') CFG.themeOption = false;            // test-only: wrong answers as before the same-theme choice
    G.ix = indexWorlds(doc); G.byId = Object.fromEntries(G.words.map((w) => [w.id, w])); G.pack = doc.assetPack?.sheet || null;
    G.dataNote = doc.status === 'draft' || doc.playable === false ? '세계 파일: 초안(뜻·소리 검토 전)' : '';
    const lost = Object.keys(G.ix.wordWorld).filter((id) => !G.byId[id]); if (lost.length) throw new Error(`세계 파일의 카드 ${lost.length}장이 카드 목록에 없어요 (예: ${lost[0]})`);
  } catch (e) { $('#app').innerHTML = `<div class="page center"><h1 class="title">열 수 없어요</h1><p class="note" id="fatal">${esc(e.message)}</p></div>`; return; }
  await loadForms();
  if (storage && qs.get('nosync') !== '1') {
    G.sync = new Sync({ storage, fetchImpl: (u, o) => fetch(u, o), debounceMs: 800, ix: G.ix, onMerged, onStatus: (s) => { G.syncStatus = s; paintSync(); } });
    await G.sync.init();
  }
  await loadSprites(); await loadSprites('assets/postal/atlas/sprites.svg'); await loadSprites('assets/postal/wardrobe/sprites.svg'); await loadSprites('assets/postal/feedback/sprites.svg'); await loadSprites('assets/postal/stamps/sprites.svg'); if (G.pack) await loadSprites(G.pack); if (STORM.on) await loadStormSprites(); G.meta = loadMeta();   // the world file may bring its own boss sprites
  G.sound = new Sound({ off: qs.get('sound') === 'off' }); await G.sound.init();
  const pref = loadPref(); G.sound.musicOn = pref.music; G.sound.sfx = pref.sfx;
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#wardrobe')) { $('#wardrobe').remove(); $('[data-act=wardrobe]')?.focus(); } if (['Enter',' '].includes(e.key) && e.target.matches('.world-door[data-act]')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('change', (e) => { const f = e.target; if (!f.dataset?.restore || !f.files?.[0]) return; const id = f.dataset.restore; const rd = new FileReader(); rd.onload = () => restore(id, String(rd.result)); rd.onerror = () => { G.pmsg = '파일을 읽지 못했어요.'; parent(); }; rd.readAsText(f.files[0]); });
  // Another tab saved this child's record: fold it in now (save() checks again before every write). Nothing is written here,
  // so two open tabs never answer each other's saves.
  window.addEventListener('storage', (e) => { if (!G.st || !G.pid || G.readonly || e.key !== KEY(G.pid) || e.newValue == null) return; try { catchUp(e.newValue, false); } catch {} });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { G.sync?.flush().catch(() => {}); return; } G.sync?.flush().catch(() => {}); if (G.view === 'card' && !G.busy) speak(true); });
  home();
}

// ---- home ----
function home() {
  clearPresentation();
  G.view = 'home'; G.pid = null; G.st = null; G.run = null; G.srun = null; G.stormEv = null; G.world = null; hideBanner(); clearTimeout(G.timer); applyTheme(G.ix.worlds[0]); band(false); G.sound?.scene(musicOf(G.ix.worlds[0]), { worldId: G.ix.worlds[0].id });
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
  clearPresentation();
  const rec = loadRec(id); G.view = 'today'; G.pid = id; G.st = rec.state; try { G.seen = stored(); } catch { G.seen = null; } G.readonly = rec.newer || rec.kept === false || !!G.syncStatus?.stale; G.run = null; G.lt = null; G.game = null; hideBanner(); clearTimeout(G.timer); band(false);
  if (G.readonly) banner(`<span>${NEWER}</span><button data-act="reload">새로 고침</button>`); else if (G.notice) { banner(`<span>${esc(G.notice)}</span><button data-act="hide">확인</button>`); G.notice = ''; }
  const st = G.st; const m = ensureMap(st);
  if (wid && G.ix.byId[wid] && worldOpen(G.ix, G.ix.byId[wid], st)) m.at = wid;
  const w = (G.world = currentWorld(G.ix, st)); const first = enterWorld(st, w, todayISO());
  const released = !G.readonly && stormRelease(st, G.ix, G.fx, todayISO());   // a whirlwind with nothing left to ask never holds the rider
  if (first || wid || released) save();
  rememberPetUnlock(); applyTheme(w); G.sound.scene(musicOf(w), { worldId: w.id });
  const v = worldView(G.ix, w, st, todayISO()); const c = gradeCounts(st, G.words);
  const ev = G.stormEv && G.stormEv.pid === id && G.stormEv.wid === w.id ? G.stormEv : null; G.stormEv = null;   // what the last run did to the whirlwind, shown once
  const sw = STORM.on ? stormOf(st, G.ix) : null; const storm = sw && sw.wid === w.id ? sw : null; const held = stormBlocks(st, w.id, G.ix);
  if (ev && ev.event === 'caught' && held && !v.bat.full) return caught();
  const near = localFrontier(w, st, v);
  const at = (n) => `left:${n.x / 10}%;top:${n.y / 6}%`;
  const place = (n, inner, label, status, extra = '') => `<button class="node ${status} ${extra}" data-act="node" data-id="${esc(n.id)}" style="${at(n)}" aria-label="${esc(label)}">${inner}${label ? `<span class="lbl">${esc(label)}</span>` : ''}${extra.includes('bonus') ? '<i class="x2">×2</i>' : ''}</button>`;
  const nodes = v.nodes.map((n) => {
    if (n.kind === 'tile') { const stamp = v.gate?.stamps.find((x) => x.nodeId === n.id); return place(n, spr(STONE[n.status] || 'stone-open', 64, 'big') + (stamp ? `<span class="gate-stamp ${stamp.collected ? 'collected' : ''}" data-stamp="${stamp.id}" data-collected="${stamp.collected}" aria-label="우표 ${stamp.id} ${stamp.collected ? '모음' : '모으기'}">${stampPic(stamp)}${stamp.collected ? '<b>✓</b>' : ''}</span>` : ''), '', n.status, `${n.bonus ? 'bonus' : ''} ${n.status === 'open' ? near.has(n.id) ? 'nearby' : 'distant' : ''}`); }
    if (n.kind === 'castle') return place(n, `${v.crown ? `<i class="crown">${spr('crown', 32)}</i>` : ''}${v.castle.status !== 'cleared' && v.gate?.ready ? spr('c011-door-open',64,'big') : big('gate')}${v.gate && !v.crown ? `<span class="castle-pin" aria-hidden="true">${v.gate.tilesDone}/${v.gate.minTiles} ${v.gate.stamps.map((stamp) => stamp.id + (stamp.collected ? '✓' : '·')).join(' ')}</span>` : ''}`, v.crown ? '왕관!' : w.castle?.name || '성', n.status, 'castle');
    if (n.kind === 'minigame') return place(n, `${big('playhouse')}${n.status === 'cleared' ? `<i class="crown">${spr('stamp', 32)}</i>` : ''}`, '놀이집', n.status === 'cleared' ? 'open done' : n.status, 'game');
    if (n.kind === 'start') return `<div class="node start" style="${at(n)}">${anim('flag-a', 'flag-b', 64)}<span class="lbl">출발</span></div>`;
    return `<div class="node free" style="${at(n)}">${big('sign')}</div>`;
  });
  const taken = w.map.nodes.map((n) => ({ x: n.x, y: n.y }));
  const houses = v.houses.map((h) => { const p = housePos(w, h, taken); return place({ id: h.id, ...p }, big('post-office'), `${h.name} ${h.done}/${h.total}`, h.status, h.bonus ? 'house bonus' : 'house'); });
  const story = first ? w.intro : '';
  const stormHint = held ? '회오리에 잡혔어요! 회오리를 눌러 빠져나와요' : ev?.event === 'spawn' ? '회오리가 나타났어요' : ev?.event === 'move' ? '회오리가 다가와요' : ev?.event === 'gone' ? '회오리가 사라졌어요' : '';
  const hint = msg || (v.bat.full ? (v.bat.byDebt ? '미뤄 둔 복습이 쌓여 박쥐 떼가 몰려왔어요! 박쥐 시험을 치러야 해요' : '박쥐 떼가 몰려왔어요! 박쥐 시험을 치러야 해요') : stormHint || story || (v.continent.finale.status === 'open' ? `${v.continent.name}의 세계 성과 마을 조건을 채웠어요. 세계 지도에서 큰 성에 도전해요!` : v.monster.present ? `복습 ${v.monster.count}장이 쌓였어요. 몬스터를 물리치면 별이 2배!` : '가고 싶은 길을 골라요'));
  const dock = (id, inner, label, status, extra = '') => `<button class="dockbtn ${status} ${extra}" data-act="node" data-id="${id}" aria-label="${esc(label)}">${inner}<span class="lbl">${esc(label)}</span></button>`;
  $('#app').innerHTML = `<div class="page map"><button class="back" data-act="home" aria-label="처음으로">‹</button>
  <div class="maphud"><b class="who">${esc(name(id))}</b><span class="chip" title="별">${spr('star', 24)} ${v.stars}</span><button class="chip gift-chip" data-act="wardrobe">${spr('c011-gift-closed', 24)} ${esc(nextGift(v.stars))}</button><button class="chip" title="열쇠" data-act="key-help">${spr('key', 24)} ${v.keys}</button>
    <button class="tgl" data-act="atlas">세계 지도</button>
    <button class="tgl ${G.sound.musicOn ? 'on' : ''}" data-act="music" aria-pressed="${G.sound.musicOn}" aria-label="음악" title="음악">♪</button><button class="tgl ${G.sound.sfx ? 'on' : ''}" data-act="sfx" aria-pressed="${G.sound.sfx}" aria-label="효과음" title="효과음">${spr('sound', 24)}</button></div>
  <div class="wtitle" id="wtitle"><b>${esc(v.continent.name)} · ${esc(w.name)}</b><span>${v.unitsDone}/${v.units}칸${v.crown ? ' · 왕관' : v.castle.status === 'cleared' ? ' · 열쇠' : ''}</span></div>
  <div class="gate-toolbar"><div id="world-stamps" class="world-stamps" aria-label="모은 관문 우표">${(v.gate?.stamps || []).map((x) => `<span class="stamp-chip ${x.collected ? 'collected' : 'missing'}" data-stamp="${x.id}" data-collected="${x.collected}">${stampPic(x)} 우표 ${x.id} ${x.collected ? '✓' : '·'}</span>`).join('')}</div>
  <div class="batgauge ${v.bat.full ? 'full' : ''}" id="batgauge" title="새 단어를 만나면 차고 복습하면 줄어요. 복습을 미뤄도 차요. 가득 차면 박쥐 시험!">${anim('bat-a', 'bat-b', 32)}<div class="batbar"><i style="width:${Math.min(100, Math.round(v.bat.fill / v.bat.cap * 100))}%"></i></div><b>${v.bat.fill}/${v.bat.cap}</b></div></div>
  ${castleGate(v.gate,v.castle.status === 'cleared')}${giftNote(w.id)}
  <div class="world" id="world" data-world="${esc(w.id)}">${terrain(w)}${nodes.join('')}${houses.join('')}${stormLayer(w, st, storm, ev, held, at)}</div>
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
  slideStorm(w, ev, storm);
}
// The rider stands on the upper left of its tile, the whirlwind on the upper right of its own, so neither hides the stone,
// its lock or its marks. Only the whirlwind can be pressed.
function stormLayer(w, st, storm, ev, held, at) {
  const h = w._nodes[hereOf(st, w)]; const col = G.pid === 'daughter' ? 'gold' : 'teal';
  const rider = h ? `<div class="rider" id="rider" data-node="${esc(h.id)}" style="${at(h)}">${riderLook(false)}</div>` : '';
  let out = rider;
  if (storm) { const from = ev && ev.event === 'move' && !FAST && w._nodes[ev.from] ? w._nodes[ev.from] : w._nodes[storm.node];   // drawn where it was, then slides over
    out += `<button class="storm ${held ? 'held' : ''} ${ev?.event === 'spawn' ? 'spawn' : ''}" id="storm" data-act="storm" data-node="${esc(storm.node)}" style="${at(from)}" aria-label="회오리">${anim('fx-storm-a', 'fx-storm-b', 48, 'fast')}</button>`; }
  if (ev && ev.event === 'gone' && w._nodes[ev.node]) out += `<div class="stormfx gone" id="stormgone" style="${at(w._nodes[ev.node])}">${spr('fx-storm-gone', 48)}</div>`;
  return out;
}
function slideStorm(w, ev, storm) {
  if (!storm || !ev || ev.event !== 'move' || FAST) return; const b = $('#storm'); const n = w._nodes[storm.node]; if (!b || !n) return;
  requestAnimationFrame(() => requestAnimationFrame(() => { b.classList.add('slide'); b.style.left = `${n.x / 10}%`; b.style.top = `${n.y / 6}%`; }));
}
function nodeClick(id) {
  const st = G.st; const v = worldView(G.ix, G.world, st, todayISO()); const out = (t) => { const e = $('#msg'); if (e) e.textContent = t; };
  if (id === 'bat') return v.bat.full ? start('bat') : out('박쥐 게이지가 아직 안 찼어요');
  if (v.bat.full) return out(MSG.blocked);                  // a full gauge: the test comes first
  if (id === 'bonus') { if (v.bonus.status === 'open') return startLightning(); return out(v.bonus.status === 'used' ? MSG.used : MSG.bonusLocked); }
  // Caught by the whirlwind: the tiles, houses, monster and review of this world lead to the storm run (castles do not wait).
  const held = stormBlocks(st, G.world.id, G.ix);
  if (id === 'monster' || id === 'review') return held ? startStorm() : start(id);
  const n = v.nodes.find((x) => x.id === id) || v.houses.find((x) => x.id === id); if (!n) return;
  if (held && n.status === 'open' && (n.kind === 'tile' || v.houses.includes(n))) return startStorm();
  if (n.kind === 'minigame') { if (n.status === 'locked') return out(MSG.gameLocked); return n.playable ? startGame(n) : out(MSG.soon); }
  if (n.kind === 'castle' && n.status === 'locked') return out(v.gate ? gateMessage(v.gate) : MSG.castleLocked);
  if (n.kind === 'castle' && n.status === 'cleared') return out('이 성은 이미 깼어요.');
  if (n.status === 'locked') return out(MSG.locked);
  if (n.status === 'blocked') return out(MSG.blocked);
  if (n.status === 'cleared') return out(n.tiles ? '이 집은 다 읽었어요.' : '이 칸은 이미 깼어요.');
  return start(id);
}

// Only immediate choices from the rider glow. Other legal frontiers remain clickable.
function localFrontier(w, st, view) {
  const here = hereOf(st,w), root = w._nodes[here] ? here : w.map.startNodeId;
  const seen = new Set([root]), q = [root], near = new Set(), open = new Set(view.nodes.filter((n) => n.kind === 'tile' && n.status === 'open').map((n) => n.id));
  while(q.length) for(const id of w._adj[q.shift()] || []) {
    if(open.has(id)) near.add(id);
    if(!seen.has(id) && ['start','junction','plaza'].includes(w._nodes[id]?.kind)) { seen.add(id); q.push(id); }
  }
  return near;
}
const stampPic = (x, size=32) => spr(`c013-stamp-${x.id.toLowerCase()}`,size);
const gateMessage = (g) => `마을 ${g.tilesDone}/${g.minTiles} · 우표 A ${g.stamps.find(x=>x.id==='A')?.collected ? '✓' : '·'} · 우표 B ${g.stamps.find(x=>x.id==='B')?.collected ? '✓' : '·'}${g.reachable ? '' : ' · 성까지 길을 이어요'}`;
const continentGateText = (g) => `세계 성 ${g.worldsPassed}/${g.totalWorlds} · 마을 ${g.tilesDone}/${g.minTiles} (${Math.round(g.minTileRate*100)}%)`;
function castleGate(g,cleared=false) {
  if (!g) return '';
  return `<aside class="castle-gate ${g.ready ? 'ready' : ''}" id="castle-gate" data-ready="${g.ready}" data-cleared="${cleared}"><b>${cleared ? '성 통과 완료' : '성에 들어가려면'}</b><span class="gate-villages">마을 ${g.tilesDone}/${g.minTiles}</span><span class="gate-stamps">${g.stamps.map(x=>`<span data-stamp="${x.id}" data-collected="${x.collected}">${stampPic(x,24)} 우표 ${x.id} ${x.collected ? '✓' : '·'}</span>`).join('')}</span><small>${cleared ? '남은 마을은 선택해요' : g.ready ? '문이 열렸어요' : g.reachable ? '마을과 우표를 모아요' : '성까지 길을 이어요'}</small></aside>`;
}

// ---- illustrated continent maps ----
const ATLAS_POINTS = {
  P1: [[9,59],[20,36],[35,26],[48,39],[39,66],[55,77],[69,61],[78,37],[91,23]],
  P2: [[8,20],[24,27],[39,17],[54,28],[70,17],[86,25],[89,47],[72,53],[55,46],[37,55],[20,46],[10,70],[29,80],[47,72],[66,81],[88,77]],
  P3: [[9,73],[26,63],[36,38],[53,23],[68,37],[57,63],[75,76],[91,54]],
};
function atlasWorld(w, illustrated) {
  const door = doorFor(w.id);
  const unseen = door && !deviceSeen().doors[door.key];
  const here = G.world?.id === w.id;
  const badge = w.crown ? spr('crown', 24) : w.castle ? spr('key', 24) : '';
  const status = w.open ? (here ? '현재 위치' : '열림') : '잠김';
  const picture = illustrated ? spr('c015-village', 54) : '';
  return `<button class="wcard ${w.open ? 'open' : 'locked'} ${here ? 'here' : ''}" data-act="goworld" data-id="${esc(w.id)}" aria-label="${esc(w.name)} · ${status}" ${w.open ? '' : 'disabled'}>
    <span class="atlas-picture">${picture}${here && illustrated ? `<span class="atlas-courier">${courier('idle', undefined, 42)}</span>` : ''}<span class="atlas-badge">${badge}</span><span class="world-door">${spr(w.open && !unseen ? 'c011-door-open' : 'c011-door-locked', illustrated ? 27 : 48)}</span></span>
    <b>${esc(w.name)}</b><i>${w.met}/${w.total}</i>${giftNote(w.id)}</button>
    ${unseen ? `<button class="world-door atlas-door-trigger unseen" data-act="door" data-id="${esc(w.id)}" aria-label="${esc(w.name)} 열쇠로 문 열기" title="열쇠로 문 열기">${spr('key', 24)}</button>` : ''}`;
}
function atlasFinale(c) {
  const status = c.finale.status;
  const label = status === 'cleared' ? '통과!' : status === 'open' ? `${c.finale.cards}장 시험` : status === 'pending' ? '준비 중이에요' : '세계 성과 마을 조건을 채워요';
  return `<button class="wcard finale ${status}" data-act="finale" data-id="${esc(c.id)}">${status === 'open' ? spr('c011-door-open',64,'big') : big('gate')}<b>${esc(c.finale.name)}</b><i>${label}</i>${c.gate ? `<span class="continent-gate" data-ready="${c.gate.ready}">${esc(continentGateText(c.gate))}</span>` : ''}</button>`;
}
function drawContinent(c) {
  const bandName = G.ix.continents.find((entry) => entry.id === c.id).band;
  const layout = ATLAS_POINTS[bandName] || ATLAS_POINTS.P1;
  const points = c.worlds.map((_, i) => layout[Math.round(i * (layout.length - 2) / Math.max(1, c.worlds.length - 1))]);
  points.push(layout.at(-1));
  const path = points.map((point) => point.join(',')).join(' ');
  const position = ([x,y]) => `left:${x}%;top:${y}%`;
  return `<div class="atlas-scroll" tabindex="0" aria-label="${esc(c.name)} 그림 지도"><div class="atlas-land ${c.worlds.length > 9 ? 'many-worlds' : ''}">
    <svg class="atlas-geography" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><use href="#c015-atlas-${(ATLAS_POINTS[bandName] ? bandName : 'P1').toLowerCase()}" width="100" height="100"/><polyline points="${path}" fill="none" stroke="#325d56" stroke-dasharray="3 6" stroke-linecap="round" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>
    ${c.worlds.map((w,i) => `<div class="atlas-stop" style="${position(points[i])}">${atlasWorld(w,true)}</div>`).join('')}
    <div class="atlas-stop atlas-end" style="${position(points.at(-1))}">${atlasFinale(c)}</div></div></div>`;
}
function atlas(transition = null, list = false) {
  clearPresentation(); G.view = 'atlas'; hideBanner(); band(false); const continents = atlasView(G.ix, G.st);
  $('#app').innerHTML = `<div class="page atlas"><button class="back" data-act="today" aria-label="돌아가기">‹</button><h1 class="title center">세계 지도</h1>
  <button class="tgl atlas-mode" data-act="${list ? 'atlas' : 'atlas-list'}">${list ? '그림 지도로 보기' : '목록으로 보기'}</button>
  <div id="door-stage"></div>${continents.map((c) => `<section class="cont" data-cont="${esc(c.id)}"><h2>${esc(c.name)} <small>왕관 ${c.crowns}/${c.total}</small></h2><p class="mut small">${esc(c.story || '')}</p>
    ${list ? `<div class="wgrid">${c.worlds.map((w) => `<div class="atlas-list-stop">${atlasWorld(w,false)}</div>`).join('')}${atlasFinale(c)}</div>` : drawContinent(c)}</section>`).join('')}
  <p class="msg" id="msg"></p></div>`;
  if (transition) showDoor(transition);
}

// Presentation preferences are deliberately separate from child records and Sync.
const GIFTS = [{ id:'leaf-cap', stars:12, name:'잎사귀 모자' }, { id:'sun-bag', stars:40, name:'햇살 가방' }, { id:'sea-coat', stars:100, name:'물결 옷' }, { id:'night-cap', stars:240, name:'밤하늘 모자' }, { id:'letter-bag', stars:500, name:'편지 가방' }, { id:'festival-coat', stars:1000, name:'축제 옷' }];
let presentationTimers = [], deviceMemory = {}, lookMemory = {};
function later(fn, ms) { const id = setTimeout(fn, FAST ? Math.min(ms, 20) : ms); presentationTimers.push(id); return id; }
function clearPresentation() { presentationTimers.forEach(clearTimeout); presentationTimers = []; G.sound?.cancelFanfares(); G.door = null; $('#wardrobe')?.remove(); }
const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function deviceSeen() {
  let doc = deviceMemory; try { const raw = JSON.parse(localStorage.getItem('cards.v0.seen') || '{}'); if (raw && typeof raw === 'object' && !Array.isArray(raw)) doc = { ...raw, ...deviceMemory }; /* Retain this session's acknowledgements if storage writes fail. */ } catch {}
  deviceMemory = doc; const old = doc[G.pid]; const item = old && typeof old === 'object' && !Array.isArray(old) ? old : {};
  for (const key of ['doors', 'gifts']) if (!item[key] || typeof item[key] !== 'object' || Array.isArray(item[key])) item[key] = {};
  doc[G.pid] = item; return item;
}
function writeDevice() { try { localStorage.setItem('cards.v0.seen', JSON.stringify(deviceMemory)); } catch {} }
function nextGift(stars) { const g = GIFTS.find((x) => stars < x.stars); return g ? `다음 선물까지 ★ ${g.stars-stars}` : '선물을 모두 열었어요'; }
const SLOTS = { hat:'모자', bag:'가방', coat:'옷', ride:'탈것', pet:'반려동물' };
const WORLD_GIFT_NAMES = ['꽃씨 챙모자','과일 주머니','풀잎 조끼','나무결 모자','연잎 가방','굴마을 외투','언덕 베레모','종방울 가방','항구 셔츠','조개 테두리 모자','빵바구니 가방','시계 조끼','풍선 캡','빗방울 가방','물감 앞치마','승차표 모자','공구 가방','눈꽃 외투','단추 모자','사진 가방','모래빛 셔츠','유리구슬 모자','책등 가방','구름 조끼','달조각 모자','별가루 주머니','깃털 외투','바람개비 모자','망원경 가방','창문빛 셔츠'];
const PET_GOALS = [500, 1500, 3000];
const COLOR_GOALS = [0, 3, 40];
function worldGift(id) {
  const match = /^p([123])-(\d\d)$/.exec(id);
  if (!match) return null;
  const index = [0, 8, 23][Number(match[1]) - 1] + Number(match[2]) - 1;
  const world = G.ix.byId[id];
  if (!world || !WORLD_GIFT_NAMES[index]) return null;
  return { id, slot:['hat','bag','coat'][index % 3], name:WORLD_GIFT_NAMES[index], world };
}
function wardrobeItems() {
  const worlds = G.ix.worlds.map(w => worldGift(w.id)).filter(Boolean);
  const rides = ['우편 자전거','봉투 나룻배','편지 열기구'].map((name,i) => ({slot:'ride', id:'c'+(i+1), name, continent:G.ix.continents[i]}));
  const pets = ['우표 더듬이 달팽이','소인 꼬리 도마뱀','봉투 날개 나방'].map((name,i) => ({slot:'pet', id:['snail','lizard','moth'][i], name, tier:i+1}));
  return [...worlds, ...rides.filter(r=>r.continent?.id===r.id), ...pets, ...GIFTS.map(g=>({...g,slot:'coat',legacy:true}))];
}
const lookKey = id => 'cards.v0.look.' + id;
function readLook(id) {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(lookKey(id))) || {}; } catch {}
  const memory = lookMemory[id];
  const tier = value => Number.isInteger(value) && value >= 0 && value <= PET_GOALS.length ? value : 0;
  const source = memory || stored;
  return { outfit:typeof source.outfit==='string' ? source.outfit : 'default',
    slots: { ...source.slots }, petTier:Math.max(tier(stored.petTier),tier(memory?.petTier)) };
}
function writeLook(id, doc) {
  lookMemory[id] = doc;
  try { localStorage.setItem(lookKey(id), JSON.stringify(doc)); } catch {}
}
function rememberPetUnlock(st = G.st, id = G.pid) {
  if (!st || !id || G.readonly) return;
  const look = readLook(id);
  if (look.petTier === PET_GOALS.length) return;
  const known = G.words.reduce((count,w) => count + Number(gradeOf(st.words?.[w.id]) >= 2),0);
  const tier = PET_GOALS.filter(goal=>known>=goal).length;
  if (tier > look.petTier) writeLook(id,{...look,petTier:tier});
}
function unlocked(item, st, look, seen = {}) {
  if (item.legacy) return !!seen[item.id] || (st?.map?.stars || 0) >= item.stars;
  if (item.world) return !!st?.map?.worlds?.[item.id]?.castle;
  if (item.continent) return !!st?.map?.conts?.[item.id]?.castle;
  return look.petTier >= item.tier;
}
function lookSelection(pid,st) {
  const look=readLook(pid), selected={};
  const stars=st?.map?.stars || 0;
  let seen = deviceMemory[pid]?.gifts;
  if (!seen) { try { seen = JSON.parse(localStorage.getItem('cards.v0.seen'))?.[pid]?.gifts; } catch {} }
  for (const item of wardrobeItems()) {
    const choice=look.slots[item.slot] ?? (item.slot==='coat' ? {id:look.outfit,color:0} : null);
    if (choice?.id===item.id && unlocked(item,st,look,seen)) {
      const color=Number.isInteger(choice.color) && COLOR_GOALS[choice.color]<=stars ? choice.color : 0;
      selected[item.slot]={...item,color};
    }
  }
  return selected;
}
function wardrobeArt(id, px=48, extra='') {
  return `<svg class="spr ${extra}" width="${px}" height="${px}" viewBox="0 0 48 48" aria-hidden="true"><use href="#${id}"/></svg>`;
}
function layerId(item, slot, color) {
  if (!item) return `c016-${slot}-default-${color}`;
  return `c016-${slot}-${item.legacy?'legacy-':''}${item.id}-${item.color}`;
}
function courierFrame(frame, selection, px, pid, index=0) {
  const color=pid==='daughter'?'gold':'teal';
  const movement=frame.startsWith('walk') ? 'walk' : 'idle';
  const {coat,bag,hat}=selection;
  if (!hat && !bag && !coat && index===0) {
    const special=['run','throw'].includes(frame);
    const legacy=special ? `c014-courier-${color}-${frame}` : `courier-${color}-${frame}`;
    return wardrobeArt(document.getElementById(legacy)?legacy:`courier-${color}-idle`,px);
  }
  if (!hat && !bag && coat?.legacy && !coat.color && index===0 && !['run','throw'].includes(frame)) return spr(`c011-look-${coat.id}-${movement==='walk'?'walk1':'idle'}`,px);
  const body = ['run','throw'].includes(frame) && document.getElementById(`c014-courier-${color}-${frame}`) ? `c014-courier-${color}-${frame}` : `c016-body-${color}-${movement}${index}`;
  const layers=[body,layerId(coat,'coat',color),layerId(bag,'bag',color),`c016-head-${color}-${movement}${index}`,layerId(hat,'hat',color)];
  return `<svg class="spr" width="${px}" height="${px}" viewBox="0 0 48 48" aria-hidden="true">${layers.map((id,i)=>`<use data-layer="${['body','coat','bag','head','hat'][i]}" href="#${id}"/>`).join('')}</svg>`;
}
function courier(frame='idle', outfit, px=48, pid=G.pid, st=G.st) {
  if (outfit==='default') return wardrobeArt(`courier-${pid==='daughter'?'gold':'teal'}-idle`,px);
  if (outfit && GIFTS.some(g=>g.id===outfit)) return spr(`c011-look-${outfit}-idle`,px);
  return courierFrame(frame, lookSelection(pid,st), px, pid);
}
function riderLook(moving=false) {
  const selection=lookSelection(G.pid,G.st);
  const stack=(frames,kind)=>`<span class="rider-frames ${kind}" data-frames="${frames.length}">${frames.map((html,i)=>`<span class="frame" style="--frame:${i}">${html}</span>`).join('')}</span>`;
  const frames=Array.from({length:4},(_,i)=>courierFrame(moving?'walk1':'idle',selection,80,G.pid,i));
  const ride=selection.ride;
  const pet=selection.pet;
  return `<span class="rider-shadow"></span>${ride ? wardrobeArt(`c016-ride-${ride.id}-${moving?'move':'idle'}`,64,`rider-ride ${moving?'mounted':'parked'} color-${ride.color}`):''}
    ${stack(frames,'rider-body')}${pet ? stack([0,1].map(i=>wardrobeArt(`c016-pet-${pet.id}-${i}`,34,`color-${pet.color}`)),'rider-pet'):''}`;
}
function renderRider(moving=false) {
  const rider=$('#rider');
  if (rider) { rider.classList.toggle('mounted',moving&&!!lookSelection(G.pid,G.st).ride); rider.innerHTML=riderLook(moving); }
}
const giftNote = id => {
  const gift=worldGift(id);
  return gift ? `<span class="world-gift">${wardrobeArt(layerId({...gift,color:0},gift.slot,'teal'),32)} 이 세계의 선물: ${esc(gift.name)}</span>` : '';
};
function wardrobe(slot='coat') {
  $('#wardrobe')?.remove();
  rememberPetUnlock();
  const stars=G.st.map.stars, look=readLook(G.pid), selection=lookSelection(G.pid,G.st), seen=deviceSeen();
  for (const g of GIFTS) if (stars>=g.stars) seen.gifts[g.id]=true;
  writeDevice();
  const box=document.createElement('div'); box.id='wardrobe'; box.className='wardrobe-shade';
  const legacy=slot==='coat' ? `<div class="looks">${[{id:'default',stars:0,name:'기본 모습'},...GIFTS].map(g=>{
    const active=g.id==='default'?!selection.coat:selection.coat?.id===g.id;
    return `<button class="look ${active?'selected':''}" data-act="look" data-id="${g.id}" aria-pressed="${active}" ${stars<g.stars&&!seen.gifts[g.id]?'disabled':''}>${courier('idle',g.id,64)}<b>${g.name}</b><small>${stars<g.stars&&!seen.gifts[g.id]?`★ ${g.stars}에 열려요`:active?'입고 있어요':'입기'}</small></button>`;
  }).join('')}</div>`:'';
  const items=wardrobeItems().filter(item=>item.slot===slot && !item.legacy);
  const cards=items.map(item=>{
    const enabled=unlocked(item,G.st,look,seen.gifts), active=selection[slot]?.id===item.id;
    const icon=slot==='ride'?`c016-ride-${item.id}-idle`:slot==='pet'?`c016-pet-${item.id}-0`:layerId({...item,color:0},slot,'teal');
    const why=item.world?`${item.world.name} 성을 깨면`:item.continent?`${item.continent.name} 큰 성을 깨면`:`아는 단어 ${PET_GOALS[item.tier-1]}개`;
    return `<button class="gear ${enabled?'':'silhouette'}" data-act="gear" data-id="${item.id}" data-slot="${slot}" aria-pressed="${active}" ${enabled?'':'disabled'}>${wardrobeArt(icon,54)}<b>${esc(item.name)}</b><small>${enabled?(active?'선택했어요':'고르기'):esc(why)}</small></button>`;
  }).join('');
  const active=selection[slot];
  const colors=active?`<div class="gear-colors" aria-label="색 고르기">${COLOR_GOALS.map((goal,i)=>`<button class="sec" data-act="gear-color" data-slot="${slot}" data-color="${i}" aria-pressed="${active.color===i}" ${stars<goal?'disabled':''}>${['기본색','색 2','색 3'][i]}${goal?` · ★ ${goal}`:''}</button>`).join('')}</div>`:'';
  box.innerHTML=`<section class="wardrobe" role="dialog" aria-modal="true" aria-labelledby="wardrobe-title"><button class="back" data-act="look-close" aria-label="닫기">×</button><h2 id="wardrobe-title">배달부 꾸미기</h2><p>모은 별 ★ ${stars} · 별은 줄어들지 않아요</p>
  <div class="gear-preview">${courier('idle',undefined,80)}</div><nav class="gear-tabs" aria-label="꾸미기 종류">${Object.entries(SLOTS).map(([key,label])=>`<button class="sec" data-act="gear-tab" data-slot="${key}" aria-pressed="${key===slot}">${label}</button>`).join('')}</nav>
  ${colors}${legacy}<div class="looks">${slot!=='coat'?`<button class="gear" data-act="gear" data-id="default" data-slot="${slot}" aria-pressed="${!active}">기본</button>`:''}${cards}</div>
  <button class="sec" data-act="look-close">닫기</button></section>`;
  $('#app').append(box); box.querySelector(`[data-act=gear-tab][data-slot=${slot}]`).focus({preventScroll:true});
}
function wear(id,slot='coat',color=null) {
  if (!Object.hasOwn(SLOTS,slot)) return;
  const look=readLook(G.pid);
  const item=wardrobeItems().find(i=>i.slot===slot&&i.id===id);
  if (id!=='default' && (!item || !unlocked(item,G.st,look,deviceSeen().gifts))) return;
  if (color!==null && (!Number.isInteger(color)||!(COLOR_GOALS[color]<=G.st.map.stars))) return;
  look.slots[slot]=id==='default'?null:{id,color:color??0};
  if (slot==='coat') look.outfit=item?.legacy?id:'default';
  writeLook(G.pid,look);
  renderRider();
  wardrobe(slot);
}
function doorFor(to) {
  const world = G.ix.byId[to]; if (!world || !worldOpen(G.ix, world, G.st)) return null;
  const ci = G.ix.continents.findIndex((c) => c.worlds.some((w) => w.id === to)), c = G.ix.continents[ci], wi = c.worlds.findIndex((w) => w.id === to);
  if (wi > 0) return { key:`world:${c.worlds[wi-1].id}:${to}`, from:c.worlds[wi-1].id, to, kind:'world' };
  if (ci > 0) return { key:`continent:${G.ix.continents[ci-1].id}:${to}`, from:G.ix.continents[ci-1].worlds.at(-1).id, to, kind:'continent' };
  return null;
}
function showDoor(d) {
  if (!d?.to || !G.ix.byId[d.to] || !worldOpen(G.ix,G.ix.byId[d.to],G.st)) return;
  G.door = d; const w = G.ix.byId[d.to];
  $('#door-stage').innerHTML = `<section class="door-stage ${d.kind}" data-phase="path"><h2>${d.kind === 'continent' ? '바다 너머 새로운 편지길' : '열쇠로 다음 문을 열어요'}</h2><div class="door-scene">${spr(d.kind === 'continent' ? 'c011-island-wave' : 'c011-island-leaf',96)}<span class="door-path"></span><span class="flying-key">${spr('key',48)}</span><span id="atlas-door">${spr('c011-door-locked',96)}</span></div><p>${esc(w.name)}</p><button class="sec" data-act="door-skip">바로 문 열기</button><button class="go" data-act="goworld" data-id="${esc(w.id)}" disabled>${esc(w.name)}로 가기</button></section>`;
  if (motionOff()) return openDoor();
  later(() => { if (G.door === d && G.view === 'atlas') $('.door-stage')?.setAttribute('data-phase','key'); },450);
  later(() => { if (G.door === d && G.view === 'atlas') openDoor(); },d.kind === 'continent' ? 2000 : 1500);
}
function openDoor() {
  const d = G.door; if (!d || G.view !== 'atlas' || !worldOpen(G.ix,G.ix.byId[d.to],G.st)) return;
  $('.door-stage')?.setAttribute('data-phase','open'); $('#atlas-door').innerHTML = spr('c011-door-open',96); $('.door-stage .go').disabled = false;
  $('.door-stage [data-act=door-skip]').hidden = true; deviceSeen().doors[d.key] = true; writeDevice();
  const badge = $(`.wcard[data-id="${d.to}"] .world-door use`); if (badge) badge.setAttribute('href', '#c011-door-open');
  $(`.atlas-door-trigger[data-id="${d.to}"]`)?.remove();
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
  clearPresentation(); G.displayBoss = displayMonster(node, G.run.queue.length); G.ending = false; G.view = 'card'; band(true); G.shieldSeen = 0; G.sound.sfxPlay('step'); G.sound.scene(['castle', 'bat', 'finale'].includes(node.kind) ? 'castle' : 'study', node.kind === 'finale' ? { variant: 'continent-castle' } : {});
  $('#app').innerHTML = `<div class="run">
  <header class="hud"><button class="x" data-act="quit" aria-label="그만하기">✕</button>
    <div class="boss monster-panel ${['castle','finale'].includes(node.kind) ? 'guardian' : ''}"><span class="boss-emoji" id="boss"></span><div class="monster-health"><b>몬스터 체력</b><div class="hpbar" role="progressbar" aria-label="몬스터 체력"><i id="hp"></i></div><span id="hp-count"></span><small id="monster-hint"></small></div><span class="floater" id="floater"></span></div>
    <div class="combo" id="combo"></div><div class="left" id="left"></div></header>
  <section class="stage"><div class="card" id="card"></div></section>
  <footer class="actions" id="actions"></footer></div>`;
  paintHud(); showCard();
  if (G.view === 'card') { $('#monster-hint').textContent = '이 길의 몬스터가 나타났어요!'; later(() => { if (G.view === 'card') paintHud(); },900); }
}
function displayMonster(node,N) {
  const w = node.kind === 'finale' ? G.ix.continents.find((c) => c.id === node.cid)?.worlds.at(-1) || G.world : G.world;
  let hash = 7; for (const ch of `${w.id}:${node.unit || node.tag || node.kind}`) hash = (hash*31+ch.charCodeAt(0))>>>0;
  let id = node.kind === 'bat' ? 'bat-a' : ['castle','finale'].includes(node.kind) ? w.castle?.spriteId : w.bossSprites?.[hash % w.bossSprites.length];
  if (!id || !document.getElementById(id)) id = 'c011-monster'; return { id,N,hp:N,down:false };
}
function paintHud() {
  const b = G.displayBoss; if (!b || !$('#boss')) return;
  if ($('#boss').dataset.e !== b.id) { $('#boss').dataset.e = b.id; $('#boss').innerHTML = spr(b.id, ['castle','finale'].includes(G.node?.kind) ? 128 : 96); }
  $('#hp').style.width = `${b.N ? b.hp/b.N*100 : 0}%`; $('#hp-count').textContent = `${b.hp}/${b.N}`;
  const bar = $('.monster-health .hpbar'); bar.setAttribute('aria-valuemin','0'); bar.setAttribute('aria-valuemax',b.N); bar.setAttribute('aria-valuenow',b.hp);
  $('#monster-hint').textContent = b.hp === 1 && G.run.left > 1 ? '마지막까지 힘내요' : '';
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
  $('#actions').innerHTML = `<div class="opts">${it.options.map((o, i) => `<button class="act opt ${en}${o.ko.length >= 15 ? ' long-option' : ''}" data-act="opt" data-i="${i}">${esc(o.ko)}</button>`).join('')}</div>
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
  if (res.next === 'verify') { front(it, G.byId[it.id]); optionButtons(it); return; }
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
  if (res.ok) { G.displayBoss.hp = Math.max(1,G.displayBoss.hp-1); const f = $('#floater'); f.textContent = '-1'; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    $('#boss').classList.remove('hit'); void $('#boss').offsetWidth; $('#boss').classList.add('hit'); G.sound.blip('hit');
    if (G.run.items.flame) setTimeout(() => G.sound.sfxPlay('flame'), 120); if (res.combo === 5) setTimeout(() => G.sound.sfxPlay('combo'), 160); }
  else G.sound.blip(res.said === 'wrong' && !shielded ? 'miss' : shielded ? 'shield' : 'retry');
  if (up) setTimeout(() => G.sound.jingle('grade'), 250);
  paintHud();
  if (res.ok) { $('#actions').innerHTML = ''; G.timer = setTimeout(next, FAST ? 30 : up ? 1300 : 900); }
  else {                                                 // a word to learn: hear it again, then move on (tap to go sooner)
    $('#actions').innerHTML = `<button class="act goon" data-act="next" id="goon">다음 ▶</button>`;
    setTimeout(() => G.sound.play(w.id, w.form), FAST ? 0 : 350);
    G.timer = setTimeout(next, FAST ? 30 : 3000);
  }
}
function next() { clearTimeout(G.timer); if (G.view !== 'card' || !G.busy) return; G.run.advance(); showCard(); }   // busy guards a tap racing the timer

function endRun(reason) {
  if (!G.run || G.ending) return; G.ending = true;
  clearTimeout(G.timer); G.sound.stop(); const run = G.run; const node = G.node; const rec = run.finish(reason); G.boss = { ...run.boss, day: todayISO(), pid: G.pid };
  const was = stormOf(G.st, G.ix); const heldBefore = !!node.wid && stormBlocks(G.st, node.wid, G.ix);
  const rw = settleRun(G.st, node, run, rec, todayISO(), mulberry32(Date.now() % 1e9)); const ww = settleWorld(G.ix, G.st, node, rec, todayISO());
  stormAfter(node, rec, was, heldBefore); save(); G.sync?.flush().catch(() => {});
  const defeated = reason === 'done' && (!['castle','finale'].includes(node.kind) || (ww.castle || ww.finale)?.pass);
  if (defeated) { G.displayBoss.hp = 0; G.displayBoss.down = true; paintHud(); $('#boss')?.classList.add('down'); }
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
  const celebration = !!(ww.key || (ww.finale?.pass && ww.cleared));
  const target = ww.key ? ww.nextWorld : ww.finale?.pass ? ww.nextContinent?.worlds[0] : null;
  G.celebrationDoor = target ? { key:ww.key ? `world:${w.id}:${target.id}` : `continent:${node.cid}:${target.id}`, from:w.id, to:target.id, kind:ww.key ? 'world' : 'continent' } : null;
  const gifts = GIFTS.filter((g) => G.st.map.stars >= g.stars && !deviceSeen().gifts[g.id]);
  const go = celebration ? ['celebration-atlas','세계 지도 보기'] : batNow ? ['bat-go', '박쥐 시험'] : ww.key && ww.nextWorld ? ['goworld', `▶ ${ro(ww.nextWorld.name)}`] : ww.finale?.pass && ww.nextContinent ? ['goworld', `▶ ${ro(ww.nextContinent.name)}`] : ['today', '▶ 지도로'];
  const goId = ww.key && ww.nextWorld ? ww.nextWorld.id : ww.finale?.pass && ww.nextContinent ? ww.nextContinent.worlds[0].id : '';
  $('#app').innerHTML = `<div class="page center ${celebration ? 'celebration' : ''}"><h1 class="title">${title}</h1>${celebration ? `<div class="celebration-art">${spr(ww.key ? 'c011-castle-world' : 'c011-castle-continent',128)}<span class="celebration-key">${spr('key',48)}</span></div>` : defeated ? `<div class="monster-finished" data-hp="0" data-sprite="${G.displayBoss.id}">${spr(G.displayBoss.id,64)}<span>몬스터 체력 0/${G.displayBoss.N}</span></div>` : ''}${lines.join('')}${gifts.length ? `<div id="giftgain">${spr('c011-gift-open',48)} 새 선물이 열렸어요 <button class="sec" data-act="wardrobe">배달부 꾸미기</button></div>` : ''}
  <div class="tiles"><div><b>${rec.cards}</b><span>넘긴 카드</span></div><div><b>1</b><span>몬스터와 한 판</span></div><div><b>${rec.learned}</b><span>새로 배운 카드</span></div></div>
  ${ups.length ? `<p class="mut">등급이 오른 카드</p><div class="minis">${ups.map((c) => miniCard(G.byId[c.id], c.to)).join('')}</div>` : ''}
  <button class="go" data-act="${go[0]}" data-id="${esc(goId)}">${esc(go[1])}</button>${go[0] !== 'today' ? '<p><button class="link" data-act="today">지도에서 보기</button></p>' : ''}</div>`;
  G.run = null; G.node = null;
  G.sound.scene(musicOf(w), { worldId: w.id });
  const jg = celebration ? (ww.key ? 'world-fanfare' : 'continent-fanfare') : batNow ? 'bat' : ww.key || ww.finale?.pass ? 'victory' : ww.cleared || rw.monster || rw.bat?.done ? 'clear' : rw.item ? 'item' : null; if (jg) later(() => G.sound.jingle(jg), 150);
  if (ww.cleared) G.sound.sfxPlay('stamp');
}

// ---- the whirlwind (storm.js): one step per finished run, then a storm run of word forms when it reaches the rider ----
// Called once after settleRun and settleWorld; the result is shown when the end screen is closed (the next map of that world).
function stormAfter(node, rec, was, heldBefore) {
  const rng = mulberry32((Number(qs.get('seed')) || Date.now() % 1e9) + 101 + G.st.runs.length);
  const t = stormTick(G.st, G.ix, G.fx, { wid: node.wid, kind: node.kind, reason: rec.reason }, todayISO(), rng); let event = t.event;
  // The rules leave a rider who walks onto the whirlwind's tile caught without an event (storm.js): the screen shows it as caught.
  if (!event && node.wid && !heldBefore && stormBlocks(G.st, node.wid, G.ix)) event = 'caught';
  G.stormEv = event ? { pid: G.pid, event, wid: was?.wid || node.wid, from: was?.node || null, node: t.node || stormOf(G.st, G.ix)?.node || null } : null;
}
// "회오리에 휩쓸렸어요!": shown for a moment, then the storm run starts (a tap starts it sooner).
function caught() {
  G.view = 'caught'; band(false); clearTimeout(G.timer); G.sound.sfxPlay('gate'); G.sound.jingle('storm-caught');
  $('#app').innerHTML = `<div class="page center caught" id="caught"><h1 class="title">회오리에 휩쓸렸어요!</h1>
  <div class="hero stormhero">${anim('fx-storm-a', 'fx-storm-b', 128, 'fast')}<span class="letters">${spr('fx-storm-letters', 64)}</span></div>
  <p class="note">변신한 단어의 원래 모습을 찾으면 빠져나와요</p><button class="go" data-act="storm">시작</button></div>`;
  G.timer = setTimeout(() => { if (G.view === 'caught') startStorm(); }, FAST ? 400 : 1600);
}
async function startStorm() {
  clearTimeout(G.timer);
  if (G.readonly || !catchUp()) return banner(`<span>${NEWER}</span><button data-act="reload">새로 고침</button>`);
  const v = worldView(G.ix, G.world, G.st, todayISO()); if (v.bat.full) return today(G.pid, MSG.blocked);   // the bat test comes first
  await G.sound.unlock(); const rng = mulberry32((Number(qs.get('seed')) || Math.floor(Math.random() * 1e9)) + 202 + G.st.runs.length);
  const run = STORM.on && G.fx ? new StormRun({ state: G.st, fx: G.fx, words: G.words, today: todayISO(), rng }) : null;
  if (!run || !run.cards.length) { if (stormRelease(G.st, G.ix, G.fx, todayISO())) save(); return today(G.pid); }   // nothing to ask: no empty run
  G.srun = run; G.view = 'storm'; band(true); G.busy = false; G.sound.sfxPlay('step'); G.sound.scene('storm');
  $('#app').innerHTML = `<div class="run storm-run">
  <header class="hud"><button class="x" data-act="st-quit" aria-label="그만하기">✕</button>
    <div class="boss">${anim('fx-storm-a', 'fx-storm-b', 48, 'fast')}<b class="stitle">회오리 탈출</b></div><div class="left" id="left"></div></header>
  <section class="stage"><div class="card" id="card"></div></section>
  <footer class="actions" id="actions"></footer></div>`;
  stormCard();
}
function stormCard() {
  const r = G.srun; const c = r.show(); if (!c) return stormEnd('done');
  G.busy = false; $('#left').textContent = `남은 카드 ${r.left}`;
  $('#card').className = 'card in storm-card';
  $('#card').innerHTML = `<div class="tag" id="tag">${r.queue[r.i].again ? '한 번 더! ' : ''}원래 단어를 골라요</div><span class="letters">${spr('fx-storm-letters', 48)}</span><div class="word" id="word">${esc(c.form)}</div>`;
  $('#actions').innerHTML = `<div class="opts">${c.options.map((o, i) => `<button class="act opt en" data-act="st-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
  // The form's own sound if a file was made for it (tools/cards_say_audio.sh, cards/audio/forms.tsv); otherwise silent.
  if (G.sound.files[c.id]) G.sound.play(c.id, c.form).catch(() => {});
}
function stormPick(i) {
  if (G.busy || G.view !== 'storm' || !G.srun?.current) return; G.busy = true;
  const res = G.srun.pick(i); save(); G.sound.sfxPlay(res.ok ? 'correct' : 'miss');
  document.querySelectorAll('[data-act=st-opt]').forEach((b, k) => { b.disabled = true; if (b.textContent === res.answer) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); });
  const card = $('#card'); card.className = `card back storm-card ${res.ok ? 'ok' : 'learn'}`;
  card.innerHTML = `<div class="tag">${res.ok ? '맞았어요!' : '이 단어예요'}</div><div class="stline" id="stline"><b>${esc(res.form)}</b> → <b>${esc(res.answer)}</b>${res.ko ? ` <span>${esc(res.ko)}</span>` : ''}</div>${res.ok || res.again ? '' : '<div class="line">끝에 한 번 더 나와요</div>'}`;
  $('#actions').insertAdjacentHTML('beforeend', `<button class="act goon" data-act="st-next" id="goon">다음 ▶</button>`);
}
function stormNext() { if (G.view !== 'storm' || !G.busy) return; G.srun.advance(); stormCard(); }
function stormEnd(reason) {
  const run = G.srun; if (!run) return today(G.pid); G.sound.stop(); const rec = run.finish(reason); const out = settleStorm(G.st, rec, todayISO()); save(); G.sync?.flush().catch(() => {});
  G.srun = null; G.view = 'end'; band(false); hideBanner(); G.sound.scene(musicOf(G.world), { worldId: G.world.id });
  const n = run.cards.length; const okN = run.stats.formOk;
  $('#app').innerHTML = `<div class="page center"><h1 class="title">${out.cleared ? '회오리에서 빠져나왔어요' : '회오리가 남았어요'}</h1>
  ${out.cleared ? `<div class="hero stormhero">${spr('fx-storm-gone', 96)}</div>${out.stars > 0 ? `<div class="gain" id="stormstars">${spr('star', 32)} +${out.stars}</div>` : ''}` : '<p class="mut">회오리를 다시 누르면 처음부터 풀 수 있어요.</p>'}
  <div class="tiles"><div><b id="stormok">${okN}/${n}</b><span>맞힌 수</span></div><div><b>${out.stars}</b><span>받은 별</span></div><div><b>${rec.cards}</b><span>넘긴 카드</span></div></div>
  <button class="go" data-act="today">▶ 지도로</button></div>`;
  if (out.cleared) setTimeout(() => G.sound.jingle('clear'), 150);
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
  clearInterval(G.timer); if (G.view !== 'lightning') return; G.view = 'end'; band(false); G.sound.stop(); G.sound.sfxPlay('lightning-end'); G.sound.scene(musicOf(G.world), { worldId: G.world.id });
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
  const g = G.game; if (!g) return; const fresh = stampGame(G.st, G.world, g.node.id, todayISO()); if (fresh) save(); G.view = 'end'; G.game = null; G.sound.scene(musicOf(G.world), { worldId: G.world.id }); G.sound.sfxPlay('stamp'); if (fresh) setTimeout(() => G.sound.jingle('item'), 200);
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
    return `<h2>${esc(name(id))}</h2><p class="small">오늘 ${Math.floor(R.filter((run) => run.day === todayISO()).reduce((sum, run) => sum + run.wall, 0) / 6e4)}분 · 별 ${m.stars} · 열쇠 ${all.filter((w) => w.castle).length}/${all.length} · 왕관 ${all.filter((w) => w.crown).length} · 큰 성 ${a.filter((x) => x.finale.status === 'cleared').length}/${a.length} · 만난 카드 ${Object.keys(st.words).length}/${new Set(G.ix.worlds.flatMap(worldWords)).size} · 번개 최고 ${m.best} · 밀린 복습 ${dueCount(st, todayISO())}장 · 박쥐 ${m.bat.fill}/${m.bat.cap} · 금 ${c[3]} · 은 ${c[2]} · 동 ${c[1]} · 아직 ${c[0]} / 전체 ${T.n}판, 카드 ${tot.cards}장, 분당 ${tot.wall ? (tot.cards / (tot.wall / 6e4)).toFixed(1) : '-'}장, "알아요" 확인 정답률 ${pct(tot.vok, tot.v)} (${tot.vok}/${tot.v}), 복습 정답률 ${pct(tot.rok, tot.rv)} (${tot.rok}/${tot.rv}), 넘긴 단어 확인 정답률 ${pct(tot.spok, tot.sp)} (${tot.spok}/${tot.sp}), 묶음 확인 ${tot.bok}/${tot.bd}</p>
    ${formsLine(st)}
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
// Word forms (storm.js): finished forms / forms that can be asked (their base word was met). Nothing about the other child.
function formsLine(st) {
  if (!G.fx) return ''; const can = G.fx.forms.filter((f) => st.words[f.base]); const done = can.filter((f) => formDone((st.forms || {})[f.id])).length;
  return `<p class="small" data-forms="${esc(st.id)}">변신 단어: 끝난 형태 ${done} / 낼 수 있는 형태 ${can.length}</p>`;
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
  const before = Object.keys(load(id).words).length; const merged = mergeCards(load(id), b.state, G.ix);
  try { localStorage.setItem(KEY(id), JSON.stringify(merged)); G.sync?.changed('p.' + id); G.pmsg = `${name(id)}: 복원했어요. 카드 기록 ${before}장 → ${Object.keys(merged.words).length}장 (파일에는 ${b.words}장).`; }
  catch (e) { G.pmsg = `복원하지 못했어요: ${e.message}`; }
  return parent();
}
function download(nm, obj) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = nm; document.body.appendChild(a); a.click(); a.remove(); }

async function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const a = b.dataset.act;
  if (!['yes', 'no', 'opt', 'hear', 'lt-yes', 'lt-no', 'node', 'mem', 'mail', 'tmark', 'st-opt', 'storm'].includes(a)) G.sound.sfxPlay('tap');
  switch (a) {
    case 'music': await G.sound.unlock(); G.sound.setMusic(!G.sound.musicOn); savePref(); return today(G.pid);
    case 'sfx': G.sound.setSfx(!G.sound.sfx); savePref(); G.sound.sfxPlay('tap'); return today(G.pid);
    case 'key-help': return banner('성을 깨면 열쇠를 얻고, 열쇠로 다음 세계 문을 열어요 <button data-act=hide>확인</button>');
    case 'wardrobe': return wardrobe();
    case 'look': return wear(b.dataset.id);
    case 'gear-tab': return wardrobe(b.dataset.slot);
    case 'gear': return wear(b.dataset.id,b.dataset.slot);
    case 'gear-color': { const choice=lookSelection(G.pid,G.st)[b.dataset.slot]; if (choice) return wear(choice.id,b.dataset.slot,Number(b.dataset.color)); return; }
    case 'look-close': $('#wardrobe')?.remove(); return;
    case 'celebration-atlas': return atlas(G.celebrationDoor);
    case 'door': return showDoor(doorFor(b.dataset.id));
    case 'door-skip': return openDoor();
    case 'home': return home();
    case 'reload': return location.reload();
    case 'hide': return hideBanner();
    case 'snap': { const day = document.getElementById('snap-' + b.dataset.id)?.value; if (!day) { G.pmsg = '복원할 날짜를 먼저 고르세요.'; return parent(); }
      try { const r = await fetch(`api/snapshot/p.${b.dataset.id}/${day}`); if (!r.ok) throw new Error('사본을 읽지 못했어요'); return restore(b.dataset.id, await r.text()); } catch (e) { G.pmsg = `복원하지 못했어요: ${e.message}`; return parent(); } }
    case 'pick': await G.sound.unlock(); return openProfile(b.dataset.id);
    case 'today': return today(G.pid);
    case 'atlas': return atlas();
    case 'atlas-list': return atlas(null, true);
    case 'goworld': if (G.ix.byId[b.dataset.id] && worldOpen(G.ix,G.ix.byId[b.dataset.id],G.st)) return today(G.pid, '', b.dataset.id); return;
    case 'finale': { const c = atlasView(G.ix, G.st).find((x) => x.id === b.dataset.id); if (c.finale.status === 'open') return start('finale:' + c.id);
      $('#msg').textContent = c.finale.status === 'cleared' ? '이 큰 성은 이미 깼어요.' : c.finale.status === 'pending' ? MSG.soon : c.gate ? `${c.name}: ${continentGateText(c.gate)}. 세계 성을 모두 깨고 마을을 더 돌아봐요. 왕관은 선택해서 모아요.` : `${c.name}의 왕관을 모두 모으면 열려요 (${c.crowns}/${c.total}).`; return; }
    case 'node': return nodeClick(b.dataset.id);
    case 'storm': if (G.view === 'today' && worldView(G.ix, G.world, G.st, todayISO()).bat.full) { $('#msg').textContent = MSG.blocked; return; } return startStorm();
    case 'st-opt': return stormPick(Number(b.dataset.i));
    case 'st-next': return stormNext();
    case 'st-quit': return stormEnd('left');
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
