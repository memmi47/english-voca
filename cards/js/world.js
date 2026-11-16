// Worlds (schemaVersion 3, docs/WORLD_SCHEMA.md): continents -> worlds -> a map graph of tiles. Pure: no DOM, no storage.
// What is done is read from the word records: a tile is done when every word in it has been met. Nothing here writes
// to a word's schedule or grade.
import { shuffle } from './deck.js';
import { ensureMap, dueCount, batState, batPool, tileDue, MONSTER_AT, RULES, LIGHTNING_MIN, ripeCount } from './map.js';

export const FREE = new Set(['start', 'junction', 'plaza']);          // nodes anyone can walk through
export const CASTLE = { cards: 12, pass: 0.8 };                       // defaults when a world carries no castleRule
export const FINALE = { cards: 40, pass: 0.75 };                       // continent castle defaults (the data file may set its own)
export const GAMES = new Set(['memory', 'mail']);                     // minigames this build can play; others show "준비 중"

// Index a world file once. Throws on a version this build does not understand.
export function indexWorlds(doc) {
  if (!doc || doc.schemaVersion !== 3) throw new Error(`세계 파일 버전(${doc && doc.schemaVersion})을 읽을 수 없어요. 이 프로그램은 버전 3을 읽습니다.`);
  const worlds = [], byId = {}, contOf = {}, wordWorld = {};
  for (const c of doc.continents) for (const w of c.worlds) {
    worlds.push(w); byId[w.id] = w; contOf[w.id] = c;
    w._nodes = Object.fromEntries(w.map.nodes.map((n) => [n.id, n])); w._adj = Object.fromEntries(w.map.nodes.map((n) => [n.id, []]));
    for (const e of w.map.edges) { if (!w._nodes[e.from] || !w._nodes[e.to]) throw new Error(`${w.id}: 선이 없는 칸을 가리켜요 (${e.from} - ${e.to})`); w._adj[e.from].push(e.to); w._adj[e.to].push(e.from); }
    w._units = unitsOf(w); for (const u of w._units) for (const id of u.words) wordWorld[id] = w.id;
  }
  return { doc, continents: doc.continents, worlds, byId, contOf, wordWorld };
}
// Everything in a world that holds words: map tiles and the tiles of its houses (sight words, phrases).
function unitsOf(w) {
  const out = w.map.nodes.filter((n) => n.kind === 'tile').map((n) => ({ id: n.id, words: n.words, node: n.id, house: null }));
  for (const h of w.sideActivities || []) for (const t of h.tiles) out.push({ id: t.id, words: t.words, node: null, house: h.id, kind: h.kind });
  return out;
}
export const worldWords = (w) => w._units.flatMap((u) => u.words);
export const unitDone = (state, u) => u.words.every((id) => state.words[id]);
const wstate = (state, wid) => { const m = ensureMap(state); return (m.worlds[wid] ||= { castle: null, cleared: {}, stamps: {}, seen: null }); };
const cstate = (state, cid) => { const m = ensureMap(state); return (m.conts[cid] ||= { castle: null }); };

// Walk from the start through free nodes and finished tiles. An unfinished tile next to that set is "open".
export function reach(w, state) {
  const done = (n) => n.kind === 'tile' && n.words.every((id) => state.words[id]);
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

export function crowned(w, state) { return !!wstate(state, w.id).castle && w._units.every((u) => unitDone(state, u)); }
export function finaleOf(c) { return { cards: c.finale?.cards ?? FINALE.cards, pass: c.finale?.passRate ?? FINALE.pass }; }
// A world opens when the one before it has its castle passed; the first world of a continent needs the continent castle before it.
export function worldOpen(ix, w, state) {
  const c = ix.contOf[w.id]; const i = c.worlds.indexOf(w);
  if (i > 0) return !!wstate(state, c.worlds[i - 1].id).castle;
  const ci = ix.continents.indexOf(c); return ci === 0 || !!cstate(state, ix.continents[ci - 1].id).castle;
}
export function continentView(ix, c, state) {
  const crowns = c.worlds.filter((w) => crowned(w, state)).length; const passed = cstate(state, c.id).castle;
  return { id: c.id, name: c.name, story: c.story, crowns, total: c.worlds.length, finale: { ...finaleOf(c), status: passed ? 'cleared' : crowns === c.worlds.length ? 'open' : 'locked', day: passed } };
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
  const m = ensureMap(state); const ws = wstate(state, w.id); const r = reach(w, state); const bat = batState(state, today); const due = dueCount(state, today);
  const castleDone = !!ws.castle; const gate = (s) => (s === 'open' && bat.full ? 'blocked' : s);
  const nodes = w.map.nodes.map((n) => {
    if (n.kind === 'tile') { const cleared = n.words.every((id) => state.words[id]); return { ...n, status: cleared ? 'cleared' : gate(r.open.has(n.id) ? 'open' : 'locked'), bonus: castleDone && !cleared, left: n.words.filter((id) => !state.words[id]).length }; }
    if (n.kind === 'castle') return { ...n, status: castleDone ? 'cleared' : gate(r.castle ? 'open' : 'locked') };
    if (n.kind === 'minigame') return { ...n, status: !r.games.has(n.id) ? 'locked' : ws.stamps[n.id] ? 'cleared' : 'open', playable: GAMES.has(n.gameType) };
    return { ...n, status: 'free' };
  });
  const houses = (w.sideActivities || []).map((h) => {
    const tiles = h.tiles.map((t) => ({ ...t, cleared: t.words.every((id) => state.words[id]) })); const done = tiles.filter((t) => t.cleared).length;
    const anchorOk = r.reached.has(h.anchorNodeId) || !w._nodes[h.anchorNodeId];
    return { id: h.id, name: h.name, icon: h.icon, kind: h.kind, anchorNodeId: h.anchorNodeId, tiles, done, total: tiles.length, bonus: castleDone && done < tiles.length,
      status: done === tiles.length ? 'cleared' : gate(anchorOk ? 'open' : 'locked') };
  });
  const units = w._units.length, unitsDone = w._units.filter((u) => unitDone(state, u)).length;
  const monster = due >= MONSTER_AT && (m.monsterDay !== today || (m.monsterN || 1) < RULES.monsterPerDay);
  const ripe = ripeCount(state); const c = ix.contOf[w.id];
  return { today, world: w, nodes, houses, castle: nodes.find((n) => n.kind === 'castle'), crown: castleDone && unitsDone === units, units, unitsDone,
    monster: { present: monster, count: due }, bat: { fill: bat.fill, cap: bat.cap, full: bat.full, overdue: bat.overdue, limit: bat.limit, byDebt: bat.byDebt },
    bonus: { status: m.bonusDay === today ? 'used' : ripe < LIGHTNING_MIN ? 'locked' : 'open', ripe }, stars: m.stars, items: { ...m.items }, bag: m.bag, keys: m.keys, best: m.best,
    next: w.nextWorldId ? ix.byId[w.nextWorldId] : null, continent: continentView(ix, c, state), firstVisit: !ws.seen };
}

// The run a node starts. -> { kind, wid, tag, scope, ... } or null when it is not available.
export function nodeRun(ix, view, id, state, words, rng) {
  const w = view.world;
  if (id === 'bat') return view.bat.full ? { kind: 'bat', wid: w.id, tag: 'bat', scope: { bat: batPool(state, view.today, rng) } } : null;
  if (view.bat.full) return null;                                       // a full gauge: the test comes first, nothing else starts
  if (id === 'monster') return view.monster.present ? { kind: 'monster', wid: w.id, tag: 'monster', scope: { noNew: true, duePerRun: 14 } } : null;
  const unitRun = (u, bonus) => ({ kind: 'tile', wid: w.id, tag: u.id, unit: u.id, bonus, scope: { newIds: u.words, newPerRun: u.words.length, duePerRun: tileDue(view.monster.count) } });
  const n = view.nodes.find((x) => x.id === id);
  if (n && n.kind === 'tile') return n.status === 'open' ? unitRun(n, n.bonus) : null;
  if (n && n.kind === 'castle') {
    if (n.status !== 'open') return null; const rule = w.castleRule || {};
    const pool = shuffle(worldWords(w).filter((x) => state.words[x]), rng).slice(0, rule.cards ?? CASTLE.cards);
    return pool.length ? { kind: 'castle', wid: w.id, tag: 'castle:' + w.id, pass: rule.passRate ?? CASTLE.pass, scope: { castle: pool } } : null;
  }
  const h = view.houses.find((x) => x.id === id);
  if (h) { if (h.status !== 'open') return null; const t = h.tiles.find((x) => !x.cleared); return t ? unitRun(t, h.bonus) : null; }
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

// World-level results of a finished run (the gauge, stars and items are settled by map.settleRun).
export function settleWorld(ix, state, node, rec, today) {
  const m = ensureMap(state); const out = { cleared: false, key: false, crown: false, castle: null, finale: null, nextWorld: null, nextContinent: null };
  if (node.kind === 'tile') {
    const w = ix.byId[node.wid]; const u = w._units.find((x) => x.id === node.unit); const ws = wstate(state, w.id);
    if (u && unitDone(state, u) && !ws.cleared[u.id]) { ws.cleared[u.id] = today; out.cleared = true; }
    out.crown = out.cleared && crowned(w, state);
  } else if (node.kind === 'castle') {
    const w = ix.byId[node.wid]; const ws = wstate(state, w.id); const total = rec.castleOk + rec.castleMiss; const pass = rec.reason === 'done' && total > 0 && rec.castleOk / total >= node.pass;
    out.castle = { ok: rec.castleOk, total, pass, need: node.pass };
    if (pass && !ws.castle) { ws.castle = today; m.keys++; out.key = true; out.cleared = true; out.crown = crowned(w, state); out.nextWorld = w.nextWorldId ? ix.byId[w.nextWorldId] : null; }
  } else if (node.kind === 'finale') {
    const c = ix.continents.find((x) => x.id === node.cid); const cs = cstate(state, c.id); const total = rec.castleOk + rec.castleMiss; const pass = rec.reason === 'done' && total > 0 && rec.castleOk / total >= node.pass;
    out.finale = { ok: rec.castleOk, total, pass, need: node.pass, name: c.name };
    if (pass && !cs.castle) { cs.castle = today; out.cleared = true; out.nextContinent = ix.continents[ix.continents.indexOf(c) + 1] || null; }
  }
  return out;
}
