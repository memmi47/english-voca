// World map rules: roads, tiles, monster, bonus house, castle, items. Pure: no DOM, no storage.
// Nothing here writes to a word's schedule. Rewards (stars, items) live in state.map and never feed back into deck.js.
import { addDays, shuffle } from './deck.js';

export const MONSTER_AT = 8;                 // this many due reviews put a monster on the map
export const LIGHTNING_MIN = 6;              // seen words needed to open the bonus house
export const CASTLE_CARDS = 12;
export const CASTLE_PASS = 0.8;
export const BAT = { cap: 40, min: 20, max: 80, test: 25, up: 0.9, down: 0.7, step: 10 };   // bat gauge: start capacity, bounds, test size, accuracy thresholds
export const ITEMS = { shield: { name: '방패 버섯', emoji: '🍄', info: '확인 카드를 한 번 틀려도 연속 정답이 안 끊겨요' },
  flame: { name: '불꽃 꽃', emoji: '🌸', info: '이번 판 동안 보스에게 2배로 맞혀요' } };
const SEEN_OK = (r) => r && (r.st === 'likely' || r.st === 'done' || (r.st === 'review' && r.step >= 1));   // words "ripe" enough for the lightning round

export function ensureMap(state) {
  const m = (state.map ||= { stars: 0, items: { shield: 0, flame: 0 }, bag: null, cleared: {}, monsterDay: null, bonusDay: null, best: 0, castle: null, keys: 0 });
  m.bat ||= { fill: 0, cap: BAT.cap, met: [], last: null };            // the bat gauge: +1 per new word met, -1 per review answered
  return m;
}
export const tileDone = (state, tile) => tile.words.every((id) => state.words[id]);
export const roadDone = (state, road) => road.tiles.every((t) => tileDone(state, t));
export function dueCount(state, today) {
  return Object.values(state.words).filter((r) => (r.st === 'review' || r.st === 'likely') && r.due && r.due <= today && r.lastDay !== today).length;
}
export function seenWords(state, words) { return words.filter((w) => state.words[w.id]); }
// What a bat test would ask: overdue reviews (oldest first), then words met since the last test. Capped at BAT.test.
export function batPool(state, today, rng = null) {
  const m = ensureMap(state);
  const due = Object.entries(state.words).filter(([, r]) => (r.st === 'review' || r.st === 'likely') && r.due && r.due <= today && r.lastDay !== today)
    .sort((x, y) => x[1].due.localeCompare(y[1].due) || x[0].localeCompare(y[0])).map(([id]) => id).slice(0, BAT.test);
  const taken = new Set(due); let met = m.bat.met.filter((id) => state.words[id] && !taken.has(id));
  if (rng) met = shuffle(met, rng);
  return { due, fresh: met.slice(0, BAT.test - due.length) };
}

// What the map shows. status: cleared | open | locked | blocked (a monster stands in the way)
export function mapView(world, state, today) {
  const m = ensureMap(state); const due = dueCount(state, today);
  const monster = due >= MONSTER_AT && m.monsterDay !== today;           // optional: it no longer blocks the roads
  const pool = batPool(state, today); const batFull = m.bat.fill >= m.bat.cap && pool.due.length + pool.fresh.length > 0;
  const roadsDone = world.roads.filter((r) => roadDone(state, r)).length;
  const castleOpen = roadsDone >= world.castleNeeds; const castleCleared = !!m.castle;
  const roads = world.roads.map((road) => ({ ...road, done: roadDone(state, road), tiles: road.tiles.map((t, i) => {
    const cleared = tileDone(state, t); const prevOk = i === 0 || tileDone(state, road.tiles[i - 1]);
    return { ...t, cleared, bonus: castleCleared && !cleared, status: cleared ? 'cleared' : !prevOk ? 'locked' : batFull ? 'blocked' : 'open' };
  }) }));
  const ripe = Object.values(state.words).filter(SEEN_OK).length;
  const bonusStatus = m.bonusDay === today ? 'used' : ripe < LIGHTNING_MIN ? 'locked' : 'open';
  const castle = { status: castleCleared ? 'cleared' : !castleOpen ? 'locked' : batFull ? 'blocked' : 'open' };
  return { today, roads, castle, castleOpen, roadsDone, monster: { present: monster, count: due }, bat: { fill: m.bat.fill, cap: m.bat.cap, full: batFull }, bonus: { status: bonusStatus, ripe },
    stars: m.stars, items: { ...m.items }, bag: m.bag, keys: m.keys, best: m.best,
    worldDone: roads.every((r) => r.done) && castleCleared };
}

// The run a node starts. -> { kind, scope, tag } or null when the node is not available.
export function nodeRun(world, view, id, state, words, rng) {
  if (id === 'bat') {
    if (!view.bat.full) return null;
    const pool = batPool(state, view.today, rng); return { kind: 'bat', tag: 'bat', scope: { bat: pool } };
  }
  if (view.bat.full) return null;                                       // a full gauge: the test comes first, nothing else starts
  if (id === 'monster') return view.monster.present ? { kind: 'monster', tag: 'monster', scope: { noNew: true, duePerRun: 14 } } : null;
  if (id === 'castle') {
    if (view.castle.status !== 'open') return null;
    const pool = shuffle(seenWords(state, words).map((w) => w.id), rng).slice(0, CASTLE_CARDS);
    return { kind: 'castle', tag: 'castle', scope: { castle: pool } };
  }
  for (const road of view.roads) for (const t of road.tiles) if (t.id === id) {
    if (t.status !== 'open' && !(t.cleared && false)) return null;
    return { kind: 'tile', tag: t.id, bonus: t.bonus, scope: { newIds: t.words, newPerRun: t.words.length, duePerRun: 8 } };
  }
  return null;
}

// Settle a finished run: stars, item drops, cleared flags. rec = run.finish() record, run = the Run.
export function settleRun(world, state, node, run, rec, today, rng) {
  const m = ensureMap(state); const out = { stars: 0, mult: 1, item: null, cleared: false, key: false, castle: null };
  if (run.items.shield > 0) { m.items.shield += run.items.shield; }                  // an unused shield comes back
  if (node.kind === 'monster') {
    out.mult = 2;
    if (rec.reason === 'done') { m.monsterDay = today; out.item = rng() < 0.5 ? 'shield' : 'flame'; m.items[out.item]++; out.cleared = true; }
  } else if (node.kind === 'castle') {
    const total = rec.castleOk + rec.castleMiss; const pass = rec.reason === 'done' && total > 0 && rec.castleOk / total >= CASTLE_PASS;
    out.castle = { ok: rec.castleOk, total, pass };
    if (pass && !m.castle) { m.castle = today; m.keys++; out.key = true; out.cleared = true; }
  } else if (node.kind === 'tile') {
    const tile = world.roads.flatMap((r) => r.tiles).find((t) => t.id === node.tag);
    if (node.bonus) out.mult = 2;
    if (tileDone(state, tile) && !m.cleared[tile.id]) { m.cleared[tile.id] = today; out.cleared = true; }
  }
  if (node.kind === 'bat') out.mult = 0;                              // the forced test pays no stars: nobody should fill the gauge on purpose
  out.stars = rec.stars * out.mult; m.stars += out.stars;
  const b = m.bat;
  if (node.kind === 'bat') {
    const total = rec.testOk + rec.testMiss; const acc = total ? rec.testOk / total : 0; out.bat = { ok: rec.testOk, total, acc, done: rec.reason === 'done', cap: b.cap };
    if (out.bat.done) {                                                  // the gauge empties whatever the score; the score only moves the next capacity
      b.cap = acc >= BAT.up ? Math.min(BAT.max, b.cap + BAT.step) : acc < BAT.down ? Math.max(BAT.min, b.cap - BAT.step) : b.cap;
      b.fill = 0; b.met = []; b.last = rec.endedAt; out.bat.cap = b.cap; out.cleared = true;
    }
  } else {
    b.fill = Math.max(0, b.fill + rec.fresh - rec.reviews);
    for (const id of run.met) if (!b.met.includes(id)) b.met.push(id);
    b.met = b.met.slice(-200);
  }
  out.batFull = b.fill >= b.cap;
  return out;
}

export function chooseBag(state, item) {                  // item: 'shield' | 'flame' | null (toggle)
  const m = ensureMap(state);
  if (item && (!ITEMS[item] || m.items[item] < 1)) return m.bag;
  m.bag = m.bag === item ? null : item; return m.bag;
}
// Takes the chosen item out of the bag when a run starts. -> { shield, flame } for the Run.
export function takeBag(state) {
  const m = ensureMap(state); const b = m.bag; m.bag = null;
  if (b && m.items[b] > 0) { m.items[b]--; return { shield: b === 'shield' ? 1 : 0, flame: b === 'flame' }; }
  return {};
}

// Lightning round: true/false pairs over words the child has already gone through.
export class Lightning {
  constructor({ state, words, rng, seconds = 60 }) {
    this.pool = shuffle(words.filter((w) => SEEN_OK(state.words[w.id])), rng); this.all = words; this.rng = rng;
    this.seconds = seconds; this.score = 0; this.total = 0; this.i = 0; this.cur = null;
  }
  get ready() { return this.pool.length >= LIGHTNING_MIN; }
  next() {
    const w = this.pool[this.i++ % this.pool.length]; const truth = this.rng() < 0.5;
    let shown = w;
    if (!truth) { const others = this.all.filter((x) => x.id !== w.id && x.ko !== w.ko); shown = others[Math.floor(this.rng() * others.length)]; }
    this.cur = { id: w.id, form: w.form, ko: shown.ko, truth }; return this.cur;
  }
  answer(says) { const ok = says === this.cur.truth; this.total++; if (ok) this.score++; return ok; }
}
export function settleLightning(state, lt, today) {
  const m = ensureMap(state); const first = m.bonusDay !== today; let item = null; const newBest = lt.score > m.best;
  if (newBest) m.best = lt.score;
  if (first) { m.bonusDay = today; item = lt.score >= 3 ? (lt.score % 2 ? 'shield' : 'flame') : null; if (item) m.items[item]++; }
  return { item, newBest, first };
}
