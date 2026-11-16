// Map-wide rules that do not depend on the shape of a world: review load (bat gauge, monster), stars, items, the
// lightning round. Worlds, tiles and castles are in world.js. Pure: no DOM, no storage.
// Nothing here writes to a word's schedule. Rewards (stars, items) live in state.map and never feed back into deck.js.
import { addDays, shuffle, confusable, bunchLeft } from './deck.js';

export const MONSTER_AT = 8;                 // this many due reviews put a monster on the map
export const LIGHTNING_MIN = 6;              // seen words needed to open the bonus house
export const BAT = { cap: 40, min: 20, max: 80, test: 25, up: 0.9, down: 0.7, step: 10 };   // bat gauge: start capacity, bounds, test size, accuracy thresholds
// Review-load rules. The values come from tools/sim_learning.mjs (docs/research/learning_load_sim.md).
//   tileDue..tileDueMax: due cards mixed into a tile run; the number grows with the backlog (backlog x tileDueShare), within the bounds
//   monsterPerDay: how many optional review monsters can be beaten in a day
//   batOverdue: the bat also comes when overdue reviews reach this many times the gauge capacity (0 = off)
//   batDebtFixed: measure that against the starting capacity (BAT.cap), not the capacity the last test left
//   batGrace: a review counts as overdue only after this many days past its date (0 = from the next day)
export const RULES = { tileDue: 8, tileDueMax: 20, tileDueShare: 0.5, monsterPerDay: 99, batOverdue: 1, batDebtFixed: false, batGrace: 0 };
// Tile triage (docs/LEARNING_VALUE_SPEC.md 2.3, 2.4; card T-003). on: false = every new word is asked one card at a time, as before.
//   spotFrom: this many passed words get two spot checks (fewer: one)   sample: cards per bunch check   auditDays: when a bunch is checked
//   splitDays: a bunch with a miss: the other words get their first check this many days later   auditsPerRun: bunches checked in one run
export const TRIAGE = { on: true, spotFrom: 4, sample: 3, auditDays: 30, splitDays: 7, auditsPerRun: 2 };
// What the child's choice on the word list means: tapped = unknown, the rest passed, a random one or two of those checked now.
export function triagePlan(unseen, tapped, rng) {
  const t = new Set(tapped); const passed = unseen.filter((id) => !t.has(id)); const n = passed.length >= TRIAGE.spotFrom ? 2 : passed.length ? 1 : 0;
  return { passed, tapped: unseen.filter((id) => t.has(id)), spot: shuffle(passed, rng).slice(0, n) };
}
// Puts a triage plan into a tile run's scope (deck.Run reads scope.triage). The bunch is named after the tile.
export function triageScope(node, plan, today) { node.scope = { ...node.scope, triage: { bunch: node.unit, ...plan, due: addDays(today, TRIAGE.auditDays) } }; delete node.triage; return node; }
// Bunch sample checks for a tile or monster run: the oldest open bunches that came due, a few cards each. null = none.
export function auditPick(state, today, rng) {
  if (!TRIAGE.on) return null;
  const open = Object.entries(state.bunches || {}).filter(([, b]) => !b.done && b.due && b.due <= today).sort((x, y) => x[1].due.localeCompare(y[1].due) || x[0].localeCompare(y[0]));
  const picks = []; let n = 0;
  for (const [b] of open) { if (n >= TRIAGE.auditsPerRun) break; const left = bunchLeft(state, b); if (!left.length) { state.bunches[b] = { ...state.bunches[b], done: today, result: 'empty' }; continue; } n++;   // a bunch with nothing left to sample (every passed word went to learning) is closed and takes no place
    for (const id of shuffle(left, rng).slice(0, TRIAGE.sample)) picks.push({ id, bunch: b }); }
  return picks.length ? { split: TRIAGE.splitDays, picks } : null;
}
export const ITEMS = { shield: { name: '방패 버섯', emoji: '🍄', info: '확인 카드를 한 번 틀려도 연속 정답이 안 끊겨요' },
  flame: { name: '불꽃 꽃', emoji: '🌸', info: '이번 판 동안 보스에게 2배로 맞혀요' } };
const SEEN_OK = (r) => r && (r.st === 'likely' || r.st === 'done' || (r.st === 'review' && r.step >= 1));   // words "ripe" enough for the lightning round

export function ensureMap(state) {
  const m = (state.map ||= { stars: 0, items: { shield: 0, flame: 0 }, bag: null, monsterDay: null, bonusDay: null, best: 0, keys: 0 });
  m.worlds ||= {}; m.conts ||= {}; m.at ??= null;                      // per world: castle day, cleared tiles, stamps; per continent: castle day
  m.bat ||= { fill: 0, cap: BAT.cap, met: [], last: null };            // the bat gauge: +1 per new word met, -1 per review answered
  return m;
}
const waiting = (r, today) => (r.st === 'review' || r.st === 'likely' || r.st === 'learn') && r.due && r.lastDay !== today;
export function dueCount(state, today) {
  return Object.values(state.words).filter((r) => (r.st === 'review' || r.st === 'likely') && r.due && r.due <= today && r.lastDay !== today).length;
}
// Cards a review run would show: reviews and words still to learn whose date has come and that were not scored today.
// With fewer than MONSTER_AT of them there is no monster, so the map offers a plain review run (world.nodeRun 'review').
export const waitingCount = (state, today) => Object.values(state.words).filter((r) => waiting(r, today) && r.due <= today).length;
// Reviews (and words still to learn) that were due before today and are still waiting.
export function overdueCount(state, today) { const edge = RULES.batGrace ? addDays(today, -RULES.batGrace) : today; return Object.values(state.words).filter((r) => waiting(r, today) && r.due < edge).length; }
export const ripeCount = (state) => Object.values(state.words).filter(SEEN_OK).length;
export const tileDue = (backlog) => Math.max(RULES.tileDue, Math.min(RULES.tileDueMax, Math.ceil(backlog * RULES.tileDueShare)));
// What a bat test would ask: overdue reviews (oldest first), then words met since the last test. Capped at BAT.test.
export function batPool(state, today, rng = null) {
  const m = ensureMap(state);
  const due = Object.entries(state.words).filter(([, r]) => waiting(r, today) && r.due <= today)
    .sort((x, y) => x[1].due.localeCompare(y[1].due) || x[0].localeCompare(y[0])).map(([id]) => id).slice(0, BAT.test);
  const taken = new Set(due); let met = m.bat.met.filter((id) => state.words[id] && !taken.has(id));
  if (rng) met = shuffle(met, rng);
  return { due, fresh: met.slice(0, BAT.test - due.length) };
}
// The gauge is full when enough new words were met without reviews, or when too many reviews were put off.
export function batState(state, today) {
  const m = ensureMap(state); const pool = batPool(state, today); const has = pool.due.length + pool.fresh.length > 0;
  const overdue = overdueCount(state, today); const limit = RULES.batOverdue > 0 ? Math.round(RULES.batOverdue * (RULES.batDebtFixed ? BAT.cap : m.bat.cap)) : 0;
  const byDebt = limit > 0 && overdue >= limit;
  const shown = Math.min(m.bat.cap, Math.max(m.bat.fill, limit > 0 ? Math.floor(overdue / limit * m.bat.cap) : 0));
  return { fill: shown, raw: m.bat.fill, cap: m.bat.cap, overdue, limit, byDebt, full: has && (m.bat.fill >= m.bat.cap || byDebt) };
}

// Settle a finished run: stars, item drops, the gauge. rec = run.finish() record, run = the Run.
// node.kind: tile (node.bonus doubles the stars) | monster | castle | finale | bat. World results come from world.settleWorld.
export function settleRun(state, node, run, rec, today, rng) {
  const m = ensureMap(state); const out = { stars: 0, mult: 1, item: null, monster: false };
  if (run.items.shield > 0) { m.items.shield += run.items.shield; }                  // an unused shield comes back
  if (node.kind === 'monster') {
    out.mult = 2;
    if (rec.reason === 'done') { m.monsterN = m.monsterDay === today ? (m.monsterN || 1) + 1 : 1; m.monsterDay = today; out.item = rng() < 0.5 ? 'shield' : 'flame'; m.items[out.item]++; out.monster = true; }
  } else if (node.kind === 'tile' && node.bonus) out.mult = 2;
  if (node.kind === 'bat') out.mult = 0;                              // the forced test pays no stars: nobody should fill the gauge on purpose
  out.stars = rec.stars * out.mult; m.stars += out.stars;
  const b = m.bat;
  if (node.kind === 'bat') {
    const total = rec.testOk + rec.testMiss; const acc = total ? rec.testOk / total : 0; out.bat = { ok: rec.testOk, total, acc, done: rec.reason === 'done', cap: b.cap };
    if (out.bat.done) {                                                  // the gauge empties whatever the score; the score only moves the next capacity
      b.cap = acc >= BAT.up ? Math.min(BAT.max, b.cap + BAT.step) : acc < BAT.down ? Math.max(BAT.min, b.cap - BAT.step) : b.cap;
      b.fill = 0; b.met = []; b.last = rec.endedAt; out.bat.cap = b.cap;
    }
  } else {
    b.fill = Math.max(0, b.fill + rec.fresh - rec.reviews);
    for (const id of run.met) if (!b.met.includes(id)) b.met.push(id);
    b.met = b.met.slice(-200);
  }
  out.batFull = batState(state, today).full;
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

// Lightning round: true/false pairs over words the child has already gone through. Words without a Korean gloss
// (function words) are left out.
export class Lightning {
  constructor({ state, words, rng, seconds = 60 }) {
    this.all = words.filter((w) => w.ko); this.pool = shuffle(this.all.filter((w) => SEEN_OK(state.words[w.id])), rng); this.rng = rng;
    this.seconds = seconds; this.score = 0; this.total = 0; this.i = 0; this.cur = null;
  }
  get ready() { return this.pool.length >= LIGHTNING_MIN; }
  next() {
    const w = this.pool[this.i++ % this.pool.length]; const truth = this.rng() < 0.5;
    let shown = w;
    if (!truth) { for (let k = 0; k < 50; k++) { const x = this.all[Math.floor(this.rng() * this.all.length)]; if (x.id !== w.id && x.ko !== w.ko && !confusable(w, x)) { shown = x; break; } } if (shown === w) shown = this.all.find((x) => x.ko !== w.ko && !confusable(w, x)) || w; }
    this.cur = { id: w.id, form: w.form, ko: shown.ko, truth: shown === w }; return this.cur;
  }
  answer(says) { const ok = says === this.cur.truth; this.total++; if (ok) this.score++; return ok; }
}
export function settleLightning(state, lt, today) {
  const m = ensureMap(state); const first = m.bonusDay !== today; let item = null; const newBest = lt.score > m.best;
  if (newBest) m.best = lt.score;
  if (first) { m.bonusDay = today; item = lt.score >= 3 ? (lt.score % 2 ? 'shield' : 'flame') : null; if (item) m.items[item]++; }
  return { item, newBest, first };
}
