// Worlds (schemaVersion 3, docs/WORLD_SCHEMA.md): continents -> worlds -> a map graph of tiles. Pure: no DOM, no storage.
// What is done is read from the word records: a tile is done when every word in it has been met and no run of it was left
// unfinished (startTile marks it, settleWorld clears the mark when a run reaches its end). Nothing here writes to a word's
// schedule or grade.
import { shuffle } from './deck.js';
import { ensureMap, dueCount, waitingCount, batState, batPool, tileDue, MONSTER_AT, RULES, LIGHTNING_MIN, ripeCount, TRIAGE, auditPick, passWord, checkPick } from './map.js';
import { stormBlocks } from './storm.js';

export const FREE = new Set(['start', 'junction', 'plaza']);          // nodes anyone can walk through
export const CASTLE = { cards: 12, pass: 0.8 };                       // defaults when a world carries no castleRule
export const FINALE = { cards: 40, pass: 0.75 };                       // continent castle defaults (the data file may set its own)
export const GAMES = new Set(['memory', 'mail']);   // the world file's own kinds; which game a playhouse holds comes from games.gamePlan                     // minigames this build can play; others show "준비 중"

// Kinds of side-activity houses left out of the learning path (units, crown, word counts, castle pools). Emptied = the old behaviour.
let LEFT_OUT = new Set(['sight']);
export const setLeftOutKinds = (kinds) => { LEFT_OUT = new Set(kinds); };
export const leftOutKinds = () => [...LEFT_OUT];
const onPath = (h) => !LEFT_OUT.has(h.kind);
// Index a world file once. Throws on a version this build does not understand.
export function indexWorlds(doc) {
  if (!doc || doc.schemaVersion !== 3) throw new Error(`세계 파일 버전(${doc && doc.schemaVersion})을 읽을 수 없어요. 이 프로그램은 버전 3을 읽습니다.`);
  const worlds = [], byId = {}, contOf = {}, wordWorld = {};
  for (const c of doc.continents) for (const w of c.worlds) {
    worlds.push(w); byId[w.id] = w; contOf[w.id] = c;
    w._nodes = Object.fromEntries(w.map.nodes.map((n) => [n.id, n])); w._adj = Object.fromEntries(w.map.nodes.map((n) => [n.id, []]));
    for (const e of w.map.edges) { if (!w._nodes[e.from] || !w._nodes[e.to]) throw new Error(`${w.id}: 선이 없는 칸을 가리켜요 (${e.from} - ${e.to})`); w._adj[e.from].push(e.to); w._adj[e.to].push(e.from); }
    if (w.castleRule?.type === 'explore') {
      const rule = w.castleRule, tiles = w.map.nodes.filter((n) => n.kind === 'tile');
      if (!Number.isInteger(rule.cards) || rule.cards < 1 || !Number.isFinite(rule.passRate) || rule.passRate <= 0 || rule.passRate > 1 ||
          !Number.isInteger(rule.minTiles) || rule.minTiles < 1 || rule.minTiles > tiles.length || rule.nodeId !== w.map.castleNodeId ||
          !Array.isArray(rule.stamps) || rule.stamps.length !== 2 || rule.stamps[0]?.id !== 'A' || rule.stamps[1]?.id !== 'B' ||
          new Set(rule.stamps.map((s) => s.nodeId)).size !== 2 || rule.stamps.some((s) => w._nodes[s.nodeId]?.kind !== 'tile'))
        throw new Error(`${w.id}: 성의 마을 수와 우표 배치를 읽을 수 없어요.`);
    }
    if (c.finale?.unlock === 'all-world-castles-and-tile-ratio' &&
        (!Number.isFinite(c.finale.minTileRate) || c.finale.minTileRate < 0.6 || c.finale.minTileRate > 0.8))
      throw new Error(`${c.id}: 대륙 성의 마을 비율을 읽을 수 없어요.`);
    for (const u of unitsIn(w)) for (const id of u.words) wordWorld[id] = w.id;
  }
  return { doc, continents: doc.continents, worlds, byId, contOf, wordWorld };
}
// Everything in a world that holds words: map tiles and the tiles of its houses (sight words, phrases).
// Cached per world and per setting, so flipping the setting is seen without re-indexing.
export function unitsIn(w) { const k = [...LEFT_OUT].sort().join(); if (w._unitsKey !== k) { w._units = unitsOf(w); w._unitsKey = k; } return w._units; }
function unitsOf(w) {
  const out = w.map.nodes.filter((n) => n.kind === 'tile').map((n) => ({ id: n.id, words: n.words, node: n.id, house: null, wid: w.id }));
  for (const h of (w.sideActivities || []).filter(onPath)) for (const t of h.tiles) out.push({ id: t.id, words: t.words, node: null, house: h.id, kind: h.kind, wid: w.id });
  return out;
}
export const worldWords = (w) => unitsIn(w).flatMap((u) => u.words);
// The one test of a finished tile (map tile or house tile), used by the path (reach), the map, the counts, the crown and
// the end screen. A record from before the marks existed has none, so its tiles are judged by the word records alone.
const tileDone = (state, wid, id, words) => words.every((x) => state.words[x]) && !ensureMap(state).worlds[wid]?.open?.[id];
export const unitDone = (state, u) => tileDone(state, u.wid, u.id, u.words);
const wstate = (state, wid) => { const m = ensureMap(state); return (m.worlds[wid] || (m.worlds[wid] = { castle: null, cleared: {}, stamps: {}, seen: null })); };
// A tile run starts: the tile stays unfinished until a run of it reaches its end (settleWorld), even when every word got a
// record on the way. Called by the screen before the run is made (a triage run records passed words when it is made).
export function startTile(state, node, today) { if (node.kind !== 'tile') return; const ws = wstate(state, node.wid); (ws.open || (ws.open = {}))[node.unit] = today; }
const cstate = (state, cid) => { const m = ensureMap(state); return (m.conts[cid] || (m.conts[cid] = { castle: null })); };

// The world's post office (map.TRIAGE.sort): every word of the world is looked at once, a page at a time, in the world's
// order, before any tile run of the world starts. `ws.sorted` counts the words of worldWords(w) already looked at; the words
// tapped as known have a record (map.passWord), the others have none until a tile run teaches them. A word met before (a
// record of its own) is never shown. -> { total, left, page: [ids] }
const sortOn = () => TRIAGE.on && TRIAGE.sort;
function sortList(w, state) { const all = worldWords(w); const from = ensureMap(state).worlds[w.id]?.sorted || 0; const seen = new Set(); const out = [];
  for (let i = from; i < all.length; i++) { const id = all[i]; if (!state.words[id] && !seen.has(id)) { seen.add(id); out.push([i, id]); } } return out; }
export function sortView(w, state) { const list = sortList(w, state); return { total: new Set(worldWords(w)).size, left: list.length, page: list.slice(0, TRIAGE.page).map(([, id]) => id) }; }
// One page sorted: `known` (ids of the page) are passed into their tile's bunch, the pointer moves past the page. A tile whose
// every word now has a record still waits for one run of its own (the `open` mark), so its checks and reviews are played.
export function sortPage(state, w, known, today, at) {
  const list = sortList(w, state).slice(0, TRIAGE.page); if (!list.length) return 0; const page = new Set(list.map(([, id]) => id)); const ws = wstate(state, w.id);
  const units = unitsIn(w); const mark = new Set();
  for (const id of known) { if (!page.has(id) || state.words[id]) continue; const u = units.find((x) => x.words.includes(id)); passWord(state, id, u.id, today, at); mark.add(u); }
  for (const u of mark) if (u.words.every((x) => state.words[x]) && !ws.cleared[u.id]) (ws.open || (ws.open = {}))[u.id] = ws.open?.[u.id] || today;
  ws.sorted = list[list.length - 1][0] + 1; return list.length;
}

// Walk from the start through free nodes and finished tiles. An unfinished tile next to that set is "open".
export function reach(w, state) {
  const done = (n) => n.kind === 'tile' && tileDone(state, w.id, n.id, n.words);
  const reached = new Set([w.map.startNodeId]), open = new Set(), q = [w.map.startNodeId]; let castle = false; const games = new Set();
  while (q.length) {
    const v = q.shift();
    for (const id of w._adj[v]) {
      const n = w._nodes[id];
      if (n.kind === 'castle') { castle = true; continue; }
      if (n.kind === 'minigame') { games.add(id); continue; }
      if (n.kind === 'tile' && !done(n)) { open.add(id); continue; }
      if (!reached.has(id) && (FREE.has(n.kind) || n.kind === 'tile')) { reached.add(id); q.push(id); }
    }
  }
  return { reached, open, castle, games };
}

// Derived only from completed map tiles; neither gate stamps nor totals are
// written to a child's records (ws.stamps remains minigame decoration only).
function worldGate(w, state, r = reach(w, state)) {
  const tiles = w.map.nodes.filter((n) => n.kind === 'tile'), rule = w.castleRule;
  const tilesDone = tiles.filter((n) => tileDone(state, w.id, n.id, n.words)).length;
  const stamps = rule?.type === 'explore' ? rule.stamps.map((s) => ({ ...s, collected: tileDone(state, w.id, s.nodeId, w._nodes[s.nodeId].words) })) : [];
  const minTiles = rule?.type === 'explore' ? rule.minTiles : 0;
  return { tilesDone, totalTiles: tiles.length, minTiles, reachable: r.castle, stamps,
    ready: r.castle && tilesDone >= minTiles && stamps.every((s) => s.collected) };
}

export function crowned(w, state) { return !!wstate(state, w.id).castle && unitsIn(w).every((u) => unitDone(state, u)); }
// A continent castle the world file marks as not decided yet (status "pending-config", or cards / passRate given as null) is
// "준비 중": it never starts and never opens the next continent. A file without a finale uses the defaults.
export function finaleOf(c) { const f = c.finale; const pending = !!f && (f.status === 'pending-config' || f.cards === null || f.passRate === null);
  return { cards: f?.cards ?? FINALE.cards, pass: f?.passRate ?? FINALE.pass, pending }; }
// A world opens when the one before it has its castle passed; the first world of a continent needs the continent castle before it.
export function worldOpen(ix, w, state) {
  const c = ix.contOf[w.id]; const i = c.worlds.indexOf(w);
  if (i > 0) return !!wstate(state, c.worlds[i - 1].id).castle;
  const ci = ix.continents.indexOf(c); return ci === 0 || !!cstate(state, ix.continents[ci - 1].id).castle;
}
export function continentView(ix, c, state) {
  const crowns = c.worlds.filter((w) => crowned(w, state)).length; const passed = cstate(state, c.id).castle;
  const tiles = c.worlds.flatMap((w) => w.map.nodes.filter((n) => n.kind === 'tile').map((n) => ({ w, n })));
  const worldsPassed = c.worlds.filter((w) => !!wstate(state, w.id).castle).length;
  const tilesDone = tiles.filter(({ w, n }) => tileDone(state, w.id, n.id, n.words)).length;
  const minTileRate = c.finale?.unlock === 'all-world-castles-and-tile-ratio' ? c.finale.minTileRate : null;
  const minTiles = minTileRate === null ? tiles.length : Math.ceil(minTileRate * tiles.length);
  const ready = minTileRate === null ? crowns === c.worlds.length : worldsPassed === c.worlds.length && tilesDone >= minTiles;
  const gate = { worldsPassed, totalWorlds: c.worlds.length, tilesDone, totalTiles: tiles.length, minTiles, minTileRate, ready };
  return { id: c.id, name: c.name, story: c.story, crowns, total: c.worlds.length, gate,
    finale: { ...finaleOf(c), name: c.finale?.name || `${c.name}의 큰 성`, intro: c.finale?.intro || '', outro: c.finale?.outro || '', status: passed ? 'cleared' : finaleOf(c).pending ? 'pending' : ready ? 'open' : 'locked', day: passed } };
}
// The world list: what is open, what has a key (castle), what has a crown.
export function atlasView(ix, state) {
  return ix.continents.map((c) => ({ ...continentView(ix, c, state), worlds: c.worlds.map((w) => {
    const met = worldWords(w).filter((id) => state.words[id]).length; const total = worldWords(w).length;
    return { id: w.id, name: w.name, open: worldOpen(ix, w, state), castle: !!wstate(state, w.id).castle, crown: crowned(w, state), met, total };
  }) }));
}
// Where the child should land: the remembered world if it is open, else the first open world without a castle, else the last open one.
export function currentWorld(ix, state) {
  const m = ensureMap(state); const at = ix.byId[m.at];
  if (at && worldOpen(ix, at, state)) return at;
  const open = ix.worlds.filter((w) => worldOpen(ix, w, state));
  return open.find((w) => !wstate(state, w.id).castle) || open[open.length - 1] || ix.worlds[0];
}

// What the map of one world shows. Node status: cleared | open | locked | blocked (a full bat gauge comes first).
export function worldView(ix, w, state, today) {
  const m = ensureMap(state); const ws = wstate(state, w.id); const r = reach(w, state); const bat = batState(state, today); const due = dueCount(state, today); const wait = waitingCount(state, today);
  const castleDone = !!ws.castle; const gate = (s) => (s === 'open' && bat.full ? 'blocked' : s); const exploration = worldGate(w, state, r);
  const nodes = w.map.nodes.map((n) => {
    if (n.kind === 'tile') { const cleared = tileDone(state, w.id, n.id, n.words); return { ...n, status: cleared ? 'cleared' : gate(r.open.has(n.id) ? 'open' : 'locked'), bonus: castleDone && !cleared, left: n.words.filter((id) => !state.words[id]).length }; }
    if (n.kind === 'castle') return { ...n, status: castleDone ? 'cleared' : gate(exploration.ready ? 'open' : 'locked') };
    if (n.kind === 'minigame') return { ...n, status: !r.games.has(n.id) ? 'locked' : ws.stamps[n.id] ? 'cleared' : 'open', playable: GAMES.has(n.gameType) };
    return { ...n, status: 'free' };
  });
  const houses = (w.sideActivities || []).filter(onPath).map((h) => {
    const tiles = h.tiles.map((t) => ({ ...t, cleared: tileDone(state, w.id, t.id, t.words) })); const done = tiles.filter((t) => t.cleared).length;
    const anchorOk = r.reached.has(h.anchorNodeId) || !w._nodes[h.anchorNodeId];
    return { id: h.id, name: h.name, icon: h.icon, kind: h.kind, anchorNodeId: h.anchorNodeId, tiles, done, total: tiles.length, bonus: castleDone && done < tiles.length,
      status: done === tiles.length ? 'cleared' : gate(anchorOk ? 'open' : 'locked') };
  });
  const units = unitsIn(w).length, unitsDone = unitsIn(w).filter((u) => unitDone(state, u)).length;
  const monster = due >= MONSTER_AT && (m.monsterDay !== today || (m.monsterN || 1) < RULES.monsterPerDay);
  const ripe = ripeCount(state); const c = ix.contOf[w.id];
  return { today, world: w, nodes, houses, gate: exploration, castle: nodes.find((n) => n.kind === 'castle'), crown: castleDone && unitsDone === units, units, unitsDone,
    monster: { present: monster, count: due }, review: { present: !monster && wait > 0, count: wait }, bat: { fill: bat.fill, cap: bat.cap, full: bat.full, overdue: bat.overdue, limit: bat.limit, byDebt: bat.byDebt },
    bonus: { status: m.bonusDay === today ? 'used' : ripe < LIGHTNING_MIN ? 'locked' : 'open', ripe }, stars: m.stars, items: { ...m.items }, bag: m.bag, keys: m.keys, best: m.best,
    next: w.nextWorldId ? ix.byId[w.nextWorldId] : null, continent: continentView(ix, c, state), firstVisit: !ws.seen, sort: sortOn() ? sortView(w, state) : null };
}

// The run a node starts. -> { kind, wid, tag, scope, ... } or null when it is not available.
export function nodeRun(ix, view, id, state, words, rng) {
  const w = view.world;
  if (id === 'bat') return view.bat.full ? { kind: 'bat', wid: w.id, tag: 'bat', scope: { bat: batPool(state, view.today, rng) } } : null;
  if (view.bat.full) return null;                                       // a full gauge: the test comes first, nothing else starts
  // The whirlwind stands on the rider's node (storm.js): tile, monster and review runs of this world wait for the storm run.
  const caught = stormBlocks(state, w.id, ix);
  // With triage on, tile and monster runs carry due bunch checks (scope.audit), and a tile with words not met yet lists them
  // (node.triage) so the screen asks which are unknown before the run is made (map.triageScope).
  const audit = (scope) => { const a = auditPick(state, view.today, rng); if (a) scope.audit = a; return scope; };
  if (caught && (id === 'monster' || id === 'review')) return null;
  if (id === 'monster') return view.monster.present ? { kind: 'monster', wid: w.id, tag: 'monster', scope: audit({ noNew: true, duePerRun: 14 }) } : null;
  // A few cards waiting and no monster (also after every world and castle is done): the same cards as a monster run, no item.
  if (id === 'review') return view.review.present ? { kind: 'review', wid: w.id, tag: 'review', scope: audit({ noNew: true, duePerRun: 14 }) } : null;
  // With world sorting on, a tile waits until the post office is done; then its new words are taught and passed words checked.
  const unitRun = (u, bonus) => { if (sortOn() && view.sort?.left) return { kind: 'sort', wid: w.id };
    const node = { kind: 'tile', wid: w.id, tag: u.id, unit: u.id, bonus, scope: audit({ newIds: u.words, newPerRun: u.words.length, duePerRun: tileDue(view.monster.count) }) };
    if (sortOn()) { node.scope.teach = true; const ck = checkPick(state, worldWords(w), rng); if (ck.length) node.scope.checks = ck; return node; }
    const unseen = u.words.filter((x) => !state.words[x]); if (TRIAGE.on && unseen.length) node.triage = unseen; return node; };
  // A tile (or house) already cleared can be played again as practice: its met words as check cards. Practice changes no
  // schedule, grade or gauge (deck.Run, scope.practice); only what the child did not know is kept on the word.
  const practiceRun = (words, tag) => { const ids = words.filter((x) => state.words[x]); return ids.length ? { kind: 'practice', wid: w.id, tag: 'practice:' + tag, scope: { practice: shuffle(ids, rng).slice(0, 12) } } : null; };
  const n = view.nodes.find((x) => x.id === id);
  if (n && n.kind === 'tile') return caught ? null : n.status === 'open' ? unitRun(n, n.bonus) : n.status === 'cleared' ? practiceRun(n.words, n.id) : null;
  if (n && n.kind === 'castle') {
    if (n.status !== 'open' || !worldGate(w, state).ready || wstate(state, w.id).castle) return null; const rule = w.castleRule || {};
    const pool = shuffle(worldWords(w).filter((x) => state.words[x]), rng).slice(0, rule.cards ?? CASTLE.cards);
    return pool.length ? { kind: 'castle', wid: w.id, tag: 'castle:' + w.id, pass: rule.passRate ?? CASTLE.pass, scope: { castle: pool } } : null;
  }
  const h = view.houses.find((x) => x.id === id);
  if (h) { if (caught) return null; if (h.status === 'cleared') return practiceRun(h.tiles.flatMap((t) => t.words), h.id); if (h.status !== 'open') return null; const t = h.tiles.find((x) => !x.cleared); return t ? unitRun(t, h.bonus) : null; }
  return null;
}
// The continent castle: cards met anywhere in the continent, the same number from every world.
export function finaleRun(ix, c, state, today, rng) {
  const v = continentView(ix, c, state); if (v.finale.status !== 'open' || batState(state, today).full) return null;
  const per = Math.ceil(v.finale.cards / c.worlds.length); let pool = [];
  for (const w of c.worlds) pool = pool.concat(shuffle(worldWords(w).filter((x) => state.words[x]), rng).slice(0, per));
  return { kind: 'finale', cid: c.id, tag: 'finale:' + c.id, pass: v.finale.pass, scope: { castle: shuffle(pool, rng).slice(0, v.finale.cards) } };
}

// Marks a visit (intro text shown once) and remembers the world the child is in.
export function enterWorld(state, w, today) { const ws = wstate(state, w.id); const first = !ws.seen; if (first) ws.seen = today; ensureMap(state).at = w.id; return first; }
// A finished minigame stamps the postcard once. Decoration only.
export function stampGame(state, w, nodeId, today) { const ws = wstate(state, w.id); if (ws.stamps[nodeId]) return false; ws.stamps[nodeId] = today; return true; }
// A challenge win (the playhouse was already stamped) adds a gold stamp once. Decoration only.
export function goldStamp(state, w, nodeId, today) { const ws = wstate(state, w.id); const g = ws.gold || (ws.gold = {}); if (g[nodeId]) return false; g[nodeId] = today; return true; }

// World-level results of a finished run (the gauge, stars and items are settled by map.settleRun).
export function settleWorld(ix, state, node, rec, today) {
  const m = ensureMap(state); const out = { cleared: false, key: false, crown: false, castle: null, finale: null, nextWorld: null, nextContinent: null };
  if (node.kind === 'tile') {
    const w = ix.byId[node.wid]; const u = unitsIn(w).find((x) => x.id === node.unit); const ws = wstate(state, w.id);
    if (u && rec.reason === 'done' && ws.open?.[u.id]) delete ws.open[u.id];   // the run reached its end; a run left early keeps the mark
    if (u && unitDone(state, u) && !ws.cleared[u.id]) { ws.cleared[u.id] = today; out.cleared = true; }
    if (u && u.node && rec.reason === 'done' && unitDone(state, u)) ws.here = u.node;   // the rider (storm.js) stands on the tile just cleared
    out.crown = out.cleared && crowned(w, state);
  } else if (node.kind === 'castle') {
    const w = ix.byId[node.wid]; const ws = wstate(state, w.id); const total = rec.castleOk + rec.castleMiss; const pass = rec.reason === 'done' && total > 0 && rec.castleOk / total >= node.pass;
    out.castle = { ok: rec.castleOk, total, pass, need: node.pass };
    if (pass && !ws.castle) { ws.castle = today; m.keys++; out.key = true; out.cleared = true; out.crown = crowned(w, state); out.nextWorld = w.nextWorldId ? ix.byId[w.nextWorldId] : null; }
  } else if (node.kind === 'finale') {
    const c = ix.continents.find((x) => x.id === node.cid); const cs = cstate(state, c.id); const total = rec.castleOk + rec.castleMiss; const pass = rec.reason === 'done' && total > 0 && rec.castleOk / total >= node.pass && !finaleOf(c).pending;
    out.finale = { ok: rec.castleOk, total, pass, need: node.pass, name: c.finale?.name || `${c.name}의 큰 성`, outro: c.finale?.outro || '' };
    if (pass && !cs.castle) { cs.castle = today; out.cleared = true; out.nextContinent = ix.continents[ix.continents.indexOf(c) + 1] || null; }
  }
  return out;
}
