#!/usr/bin/env node
// Learning-load simulation over the whole deck (4,610 words), driven by the real rules in cards/js/deck.js and map.js.
// A simulated child (memory model below) plays day after day; the tool reports coverage, review backlog and what is
// actually remembered. Every number it prints is an estimate that depends on the assumptions in CHILD.
//
//   node tools/sim_learning.mjs                      # the standard scenario set, tables on stdout
//   node tools/sim_learning.mjs --json out.json      # also write every result
//   node tools/sim_learning.mjs --only base          # one child profile
//   node tools/sim_learning.mjs --seeds 5 --weeks 78
//
// Memory model (per word the child did not know beforehand):
//   chance to recall after t days = exp(-t / S). S ("stability", days) is set when the word is learned in a run and
//   grows by `growth` at each successful, properly spaced review; a miss cuts it to `failKeep` of its value.
//   Words known beforehand are answered right with probability `slip`. A child who does not recall a word says
//   "know" anyway with probability `falseClaim`, and on a 3-choice card guesses with probability `guess`.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { Run, newState, CFG, mulberry32, addDays, shuffle, gradeOf } from '../cards/js/deck.js';
import { ensureMap, settleRun, batPool, batState, dueCount, overdueCount, tileDue, BAT, RULES, MONSTER_AT } from '../cards/js/map.js';
const CASTLE_CARDS = 12, CASTLE_PASS = 0.8;            // world castle (cards/js/world.js CASTLE)

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const START = '2027-01-04';                                   // a Monday; only the weekday pattern matters

// ---- deck: the game's own card list (tools/make_cards_data.py builds it from the reference DB) ----
export function catalog() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/data/catalog.json'), 'utf8')).words; }
// Worlds for the simulation: 8 / 15 / 7 per band, tiles of `tileSize` words, played in order. The real map lets the
// child pick paths; that changes the order inside a world, not the load.
export function simWorlds(words, tileSize) {
  const worlds = [];
  for (const [band, n] of [['P1', 8], ['P2', 15], ['P3', 7]]) {
    const ws = words.filter((w) => w.band === band); const per = Math.ceil(ws.length / n);
    for (let i = 0; i < n; i++) { const part = ws.slice(i * per, (i + 1) * per); const tiles = [];
      for (let k = 0; k < part.length; k += tileSize) tiles.push({ id: `${band}-${i + 1}-${tiles.length + 1}`, words: part.slice(k, k + tileSize).map((w) => w.id) });
      worlds.push({ id: `${band}-${i + 1}`, band, tiles, last: i === n - 1 }); }
  }
  return worlds;
}

// The worlds the game really uses (cards/data/worlds.json): map tiles only, so function-word houses are left out.
export function realWorlds() {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/data/worlds.json'), 'utf8')); const out = [];
  for (const c of doc.continents) c.worlds.forEach((w, i) => out.push({ id: w.id, band: c.band, last: i === c.worlds.length - 1, tiles: w.map.nodes.filter((n) => n.kind === 'tile').map((n) => ({ id: n.id, words: n.words })) }));
  return out;
}

// ---- assumptions ----
// S0 and growth are set so that reviews done on time pass at about 78 / 85 / 90 % (the three columns of PLAN 8.2):
// exp(-1 / S0) for the first review, and S grows about as fast as the gaps do (1, 3, 7, 14, 30 days).
export const CHILD = {
  //        known beforehand            first stability, growth      learned in the run, honest, guessing     speed, play
  bear: { known: { P1: 0.40, P2: 0.15, P3: 0.05 }, sight: 0.8, S0: 4.0, growth: 2.6, failKeep: 0.5, pShort: 0.85, slip: 0.95, falseClaim: 0.25, guess: 0.8, sec: 1.35, minutes: 10, days: 5, skip: 0.10, loadN: 10, loadK: 1.0 },
  base: { known: { P1: 0.60, P2: 0.30, P3: 0.15 }, sight: 0.9, S0: 6.2, growth: 2.6, failKeep: 0.5, pShort: 0.92, slip: 0.97, falseClaim: 0.10, guess: 0.7, sec: 1.00, minutes: 15, days: 6, skip: 0.05, loadN: 10, loadK: 0.5 },
  bull: { known: { P1: 0.75, P2: 0.45, P3: 0.25 }, sight: 0.95, S0: 9.5, growth: 2.8, failKeep: 0.6, pShort: 0.96, slip: 0.98, falseClaim: 0.05, guess: 0.6, sec: 0.80, minutes: 20, days: 6, skip: 0.03, loadN: 10, loadK: 0.25 },
};
const T = { judge: 3.5, check: 5.5, ok: 0.9, miss: 3.0, run: 20 };       // seconds: card kinds, reveal after a right / wrong answer, per-run overhead
export const OLD_RULES = { tileDue: 8, tileDueMax: 8, tileDueShare: 0, monsterPerDay: 1, batOverdue: 0, batDebtFixed: false, batGrace: 0 };   // the rules before this study
const GAME_RULES = { ...RULES };                             // what cards/js/map.js ships with

// One simulated child over `weeks`. opt: { child, seed, weeks, tileSize, pMonster, lapse, dueOrder, rules, bat, contCards, contPass, castlePass }
// Options of docs/LEARNING_VALUE_SPEC.md (all off by default, so the older scenario sets are unchanged):
//   real: true        play the real worlds (4,489 cards; function words left out)
//   gradient: { P1: [hi, lo], ... }   chance to know a word beforehand falls from hi to lo across the worlds of a band
//   triage: true      a tile is first shown as one screen: words the child knows are passed in a bunch, the rest are learned
//   sample: n         a passed bunch is checked by n cards after 30 days (all right -> the bunch is done) instead of every card at 7 and 30 days
//   placement: { n, pass }   before the first day: n check cards per stretch of worlds, easiest first; `pass` right -> the stretch is passed in bunches
export function simulate(words, opt) {
  const C = { ...CHILD[opt.child || 'base'], ...(opt.childOver || {}) }; const rng = mulberry32(opt.seed || 1); const weeks = opt.weeks || 78;
  let worlds; if (opt.real) { worlds = realWorlds(); const on = new Set(worlds.flatMap((w) => w.tiles.flatMap((t) => t.words))); words = words.filter((w) => on.has(w.id)); } else worlds = simWorlds(words, opt.tileSize || 10);
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const cfg = { ...CFG, lapse: opt.lapse || 'reset', dueOrder: opt.dueOrder || CFG.dueOrder, logCap: 40 };
  Object.assign(RULES, OLD_RULES, opt.rules || {}); const bat0 = { ...BAT }; Object.assign(BAT, opt.bat || {});
  const state = newState('sim'); const map = ensureMap(state); let clock = Date.UTC(2027, 0, 4);
  const pKnown = {}; if (opt.gradient) for (const band of ['P1', 'P2', 'P3']) { const ws = worlds.filter((w) => w.band === band); const [hi, lo] = opt.gradient[band];
    ws.forEach((w, i) => { const p = hi + (lo - hi) * (ws.length > 1 ? i / (ws.length - 1) : 0); for (const t of w.tiles) for (const id of t.words) pKnown[id] = p; }); }
  const mem = {}; for (const w of words) mem[w.id] = { known: rng() < (pKnown[w.id] ?? (w.track === 'sight' ? C.sight : C.known[w.band])), S: null, last: -1 };
  const unknownTotal = words.filter((w) => !mem[w.id].known).length;
  const contPass = opt.contPass ?? 0.8, contCards = opt.contCards ?? 40, castlePass = opt.castlePass ?? CASTLE_PASS;
  let wi = 0, ti = 0, pendingCont = null; const contLog = []; const days = []; const marks = {};
  const tot = { cards: 0, reviews: 0, reviewOk: 0, lapses: 0, verifies: 0, verifyOk: 0, bats: 0, batAcc: 0, monsters: 0, castleTries: 0, castleFails: 0, tiles: 0, late: 0, lateN: 0, playDays: 0, sec: 0, batCards: 0, tileCards: 0, tileSec: 0, passed: 0, passedUnknown: 0, spot: 0, spotMiss: 0, audits: 0, auditFails: 0, placed: 0, unplaced: 0 };
  const groups = [];                                                          // bunches waiting for their sample check: { ids, day }
  // A word passed without a card: "likely" (silver). With sample checks it has no date of its own; the bunch has one.
  const passWords = (ids, today, d, tag) => { for (const id of ids) { state.words[id] = { st: 'likely', lstep: 0, due: opt.sample ? null : addDays(today, 7), firstDay: today, lastDay: today, lapses: 0, bulk: tag }; tot.passed++; if (!mem[id].known) tot.passedUnknown++; }
    if (opt.sample && ids.length) groups.push({ ids: ids.slice(), day: d + 30 }); };
  const checkSec = (ok) => (T.check + (ok ? T.ok : T.miss)) * C.sec;

  const recall = (m, d) => (m.known ? C.slip : m.S == null ? 0 : m.last >= d ? C.pShort : Math.min(C.slip, Math.exp(-(d - m.last) / m.S)));
  const pRight = (id, d) => { const r = recall(mem[id], d); return r + (1 - r) * C.guess / 3; };
  function play(node, d, today, forced = null) {
    const run = new Run({ state, words, today, rng, now: () => clock, cfg, scope: node.scope, tag: node.tag }); let sec = T.run * C.sec; let fresh = 0; let guard = 0;
    while (run.current && guard++ < 2000) {
      const it = run.show(); const m = mem[it.id]; const r0 = state.words[it.id];
      if ((it.role === 'review' || it.role === 'likely') && r0?.due) { const [y, mo, da] = r0.due.split('-').map(Number); tot.late += Math.max(0, d - Math.round((Date.UTC(y, mo - 1, da) - Date.UTC(2027, 0, 4)) / 864e5)); tot.lateN++; }
      const just = it.role === 'relearn' || it.role === 'practice';
      const has = rng() < (just ? (m.known ? 1 : C.pShort) : recall(m, d)); let res; let t = 0;
      const pick = (must) => { const idx = it.options.findIndex((o) => o.id === it.id); t += T.check; return run.pick(has ? idx : must || rng() < C.guess ? Math.floor(rng() * 3) : -1); };
      if (it.form === 'judge') { t += T.judge; res = run.judge(forced && it.role === 'new' && forced.has(it.id) ? false : has || rng() < C.falseClaim); if (res.next === 'verify') res = pick(true); } else res = pick(false);   // forced: the child already said "don't know" on the tile screen
      t += res.ok ? T.ok : T.miss; sec += t * C.sec; clock += Math.round(t * C.sec * 1000);
      if (!m.known) {                                                         // what the exposure does to the child's memory
        const weak = C.S0 * 0.3; const gap = m.last < 0 ? 0 : d - m.last;
        if (it.role === 'new') { fresh++; if (res.ok) m.S = Math.max(m.S || 0, weak); }                                   // passed without knowing: only saw the meaning once
        else if (just) { if (it.final) m.S = Math.max(m.S || 0, has && res.ok ? C.S0 / (1 + C.loadK * Math.max(0, newToday - C.loadN) / C.loadN) : weak); else if (m.S == null) m.S = weak; }
        else if (has) { const g = 1 + (C.growth - 1) * Math.min(1, gap / (0.15 * m.S)); m.S = Math.max(m.S * g, Math.min(gap, 3 * m.S) * 1.2); }   // a real retrieval
        else if (!res.ok) m.S = Math.max(weak, (m.S || 0) * C.failKeep);
        m.last = d;
      }
      run.advance();
    }
    newToday += fresh; const rec = run.finish('done'); tot.cards += rec.cards; tot.reviews += rec.reviews; tot.reviewOk += rec.reviewOk; tot.lapses += rec.lapses; tot.verifies += rec.verifies; tot.verifyOk += rec.verifyOk;
    return { run, rec, sec };
  }
  let newToday = 0;
  const contOdds = (band, d) => {                                             // chance to pass the continent castle now, by threshold (no state change)
    const ws = worlds.filter((w) => w.band === band); const grid = [0.6, 0.65, 0.7, 0.75, 0.8]; const hit = grid.map(() => 0); const N = 1500; let accSum = 0;
    for (let k = 0; k < N; k++) { const pool = contPool(ws); let ok = 0; for (const id of pool) if (rng() < pRight(id, d)) ok++; accSum += ok / pool.length; grid.forEach((g, i) => { if (ok / pool.length >= g) hit[i]++; }); }
    return { acc: accSum / N, pass: Object.fromEntries(grid.map((g, i) => [g, hit[i] / N])) };
  };
  const contPool = (ws) => { const per = Math.ceil(contCards / ws.length); let pool = []; for (const w of ws) pool = pool.concat(shuffle(w.tiles.flatMap((t) => t.words).filter((id) => state.words[id]), rng).slice(0, per)); return shuffle(pool, rng).slice(0, contCards); };

  // Placement: stretches of worlds from the easiest; n check cards each; enough right -> every tile of the stretch is passed in bunches.
  // The worlds are still walked: with all tiles passed the child goes straight to each world's castle (12 check cards).
  let placeSec = 0; const placedWorlds = new Set();
  if (opt.placement) {
    const stretches = []; for (const [band, parts] of [['P1', 2], ['P2', 3], ['P3', 2]]) { const ws = worlds.filter((w) => w.band === band); const per = Math.ceil(ws.length / parts); for (let i = 0; i < ws.length; i += per) stretches.push(ws.slice(i, i + per)); }
    for (const st of stretches) { const ids = shuffle(st.flatMap((w) => w.tiles.flatMap((t) => t.words)), rng).slice(0, opt.placement.n); let ok = 0;
      for (const id of ids) { const right = rng() < (mem[id].known ? C.slip : C.guess / 3); if (right) ok++; placeSec += checkSec(right); tot.cards++; }
      if (ok < opt.placement.pass) break;
      for (const w of st) { placedWorlds.add(w.id); for (const t of w.tiles) passWords(t.words, START, 0, t.id); tot.placed++; } }
  }
  for (let d = 0; d < weeks * 7; d++) {
    const today = addDays(START, d); const dayRec = { d, played: false, due: dueCount(state, today), overdue: overdueCount(state, today), cards: 0, fresh: 0, reviews: 0, sec: 0 };
    newToday = 0;
    if (d % 7 < C.days && rng() >= C.skip) {
      dayRec.played = true; tot.playDays++; const budget = C.minutes * 60; let castleFails = 0, contTries = 0;
      if (placeSec) { dayRec.sec += placeSec; placeSec = 0; }
      // sample checks that are due: n cards from the bunch; all right -> the bunch is done, else every word of it gets its own 7-day check
      for (let gi = 0; gi < groups.length && dayRec.sec < budget - 40; gi++) { const g = groups[gi]; if (g.day > d) continue; groups.splice(gi--, 1); tot.audits++;
        const pickN = shuffle(g.ids.filter((id) => state.words[id]?.bulk && state.words[id].st === 'likely' && state.words[id].due == null), rng); const sample = pickN.slice(0, opt.sample); let allOk = true;
        for (const id of sample) { const right = rng() < pRight(id, d); dayRec.sec += checkSec(right); dayRec.cards++; tot.cards++; if (!mem[id].known) mem[id].last = d; if (!right) { allOk = false; state.words[id] = { ...state.words[id], st: 'learn', due: addDays(today, 1), lastDay: today }; } }
        if (allOk) for (const id of pickN) state.words[id] = { ...state.words[id], st: 'done', due: null, lastDay: today };
        else { tot.auditFails++; for (const id of pickN) if (state.words[id].st === 'likely') state.words[id] = { ...state.words[id], due: addDays(today, 7) }; } }
      while (dayRec.sec < budget - 40) {
        const m = map; const due = dueCount(state, today); const bs = batState(state, today); let node = null;
        const monsterOk = due >= MONSTER_AT && (m.monsterDay !== today || (m.monsterN || 1) < RULES.monsterPerDay);
        if (bs.full) node = { kind: 'bat', tag: 'bat', scope: { bat: batPool(state, today, rng) } };
        else if (pendingCont && contTries < 2) node = { kind: 'cont', tag: 'cont:' + pendingCont, scope: { castle: contPool(worlds.filter((w) => w.band === pendingCont)) } };
        else if (monsterOk && rng() < (opt.pMonster ?? 0.5)) node = { kind: 'monster', tag: 'monster', scope: { noNew: true, duePerRun: 14 } };
        else if (!pendingCont && wi < worlds.length) {
          const w = worlds[wi];
          if (placedWorlds.has(w.id)) ti = w.tiles.length;                      // every tile was passed at placement: straight to the castle
          if (ti < w.tiles.length) node = { kind: 'tile', tag: w.tiles[ti].id, scope: { newIds: w.tiles[ti].words, newPerRun: w.tiles[ti].words.length, duePerRun: tileDue(due) } };
          else if (castleFails < 2) node = { kind: 'castle', tag: 'castle:' + w.id, scope: { castle: shuffle(w.tiles.flatMap((t) => t.words), rng).slice(0, CASTLE_CARDS) } };
        }
        if (!node && monsterOk) node = { kind: 'monster', tag: 'monster', scope: { noNew: true, duePerRun: 14 } };
        if (!node) break;
        let forced = null;
        if (opt.triage && node.kind === 'tile') {                              // the tile screen: tap what you do not know
          const all = node.scope.newIds.filter((id) => !state.words[id]); dayRec.sec += 1.5 * all.length * C.sec;
          let passed = all.filter((id) => mem[id].known || rng() < C.falseClaim); const tapped = all.filter((id) => !passed.includes(id));
          for (const id of shuffle(passed, rng).slice(0, passed.length >= 4 ? 2 : passed.length ? 1 : 0)) {   // spot check of what was passed
            const right = rng() < (mem[id].known ? C.slip : 1 / 3); tot.spot++; dayRec.sec += checkSec(right); dayRec.cards++; tot.cards++;
            if (!right) { tot.spotMiss++; passed = passed.filter((x) => x !== id); tapped.push(id); } }
          passWords(passed, today, d, node.tag); forced = new Set(tapped);
          node.scope = tapped.length ? { newIds: tapped, newPerRun: tapped.length, duePerRun: tileDue(due) } : { noNew: true, duePerRun: tileDue(due) };
          if (!tapped.length && !due) { ti++; tot.tiles++; continue; }           // nothing to learn and nothing to review: the tile is done
        }
        const { run, rec, sec } = play(node, d, today, forced); dayRec.sec += sec; dayRec.cards += rec.cards; dayRec.fresh += rec.fresh; dayRec.reviews += rec.reviews;
        if (node.kind === 'tile') { settleRun(state, node, run, rec, today, rng); ti++; tot.tiles++; tot.tileCards += rec.cards; tot.tileSec += sec; }
        else if (node.kind === 'monster') { settleRun(state, node, run, rec, today, rng); tot.monsters++; }
        else if (node.kind === 'bat') { const o = settleRun(state, node, run, rec, today, rng); tot.bats++; tot.batAcc += o.bat.acc; tot.batCards += rec.cards; }
        else if (node.kind === 'castle') { const total = rec.castleOk + rec.castleMiss; tot.castleTries++;
          if (total && rec.castleOk / total >= castlePass) { const w = worlds[wi]; if (w.last) { pendingCont = w.band; contLog.push({ band: w.band, readyDay: d, odds: contOdds(w.band, d), tries: 0, passDay: null }); } wi++; ti = 0; }
          else { castleFails++; tot.castleFails++; const w = worlds[wi];
            if (opt.placement?.undo && placedWorlds.has(w.id)) {              // the placement was wrong for this world: walk its tiles after all
              placedWorlds.delete(w.id); ti = 0; tot.unplaced++; castleFails = 0;
              for (const t of w.tiles) for (const id of t.words) { const r = state.words[id]; if (r && r.bulk && r.st === 'likely' && r.lastDay === START) delete state.words[id]; }
              for (const g of groups) g.ids = g.ids.filter((id) => state.words[id]); } } }
        else if (node.kind === 'cont') { const total = rec.castleOk + rec.castleMiss; const L = contLog[contLog.length - 1]; L.tries++; contTries++;
          if (total && rec.castleOk / total >= contPass) { L.passDay = d; pendingCont = null; marks[L.band] = d; } }
      }
    }
    tot.sec += dayRec.sec;
    if (d % 7 === 6) {                                                        // weekly snapshot
      let met = 0, metUnknown = 0, now = 0, durable = 0, fake = 0; const g = [0, 0, 0, 0];
      for (const w of words) { const r = state.words[w.id]; if (!r) continue; met++; g[gradeOf(r)]++; const m = mem[w.id]; if (m.known) continue; metUnknown++; const p = recall(m, d); now += p; if (m.S != null && Math.exp(-30 / m.S) >= 0.5) durable++; if (r.st === 'done' && p < 0.5) fake++; }
      dayRec.week = { w: (d + 1) / 7, met, metUnknown, now: Math.round(now), durable, fake, gold: g[3], silver: g[2], bronze: g[1], cap: map.bat.cap, world: wi };
      if (met === words.length && marks.allMet == null) marks.allMet = d;
    }
    days.push(dayRec);
  }
  Object.assign(BAT, bat0); Object.assign(RULES, GAME_RULES);
  const played = days.filter((x) => x.played); const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  return { opt, unknownTotal, weeks: days.filter((x) => x.week).map((x) => x.week), marks, contLog, tot,
    perDay: { cards: tot.cards / Math.max(1, tot.playDays), minutes: tot.sec / 60 / Math.max(1, tot.playDays), dueMed: q(played.map((x) => x.due), 0.5), dueP90: q(played.map((x) => x.due), 0.9), dueMax: Math.max(0, ...days.map((x) => x.due)), overdueMed: q(played.map((x) => x.overdue), 0.5) },
    passRate: tot.reviews ? tot.reviewOk / tot.reviews : 0, lateDays: tot.lateN ? tot.late / tot.lateN : 0, batAcc: tot.bats ? tot.batAcc / tot.bats : 0 };
}

// ---- report helpers ----
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
// rs: results of the same scenario with different seeds
export function summarize(rs) {
  const at = (wk, f) => avg(rs.map((r) => f(r.weeks[Math.min(r.weeks.length - 1, wk - 1)])));
  const mark = (k) => { const v = rs.map((r) => r.marks[k]).filter((x) => x != null); return v.length === rs.length ? Math.round(avg(v) / 7) : null; };
  const cont = (band) => { const ls = rs.map((r) => r.contLog.find((c) => c.band === band)).filter(Boolean); if (!ls.length) return null; const done = ls.filter((l) => l.passDay != null);
    return { n: ls.length, ready: avg(ls.map((l) => l.readyDay)) / 7, acc: avg(ls.map((l) => l.odds.acc)), pass: Object.fromEntries([0.6, 0.65, 0.7, 0.75, 0.8].map((g) => [g, avg(ls.map((l) => l.odds.pass[g]))])), tries: avg(ls.map((l) => l.tries)), passed: done.length / ls.length, blocked: done.length ? avg(done.map((l) => l.passDay - l.readyDay)) : null }; };
  const wkrow = (wk) => ({ fake: Math.round(at(wk, (x) => x.fake || 0)), met: Math.round(at(wk, (x) => x.met)), metUnknown: Math.round(at(wk, (x) => x.metUnknown)), now: Math.round(at(wk, (x) => x.now)), durable: Math.round(at(wk, (x) => x.durable)), gold: Math.round(at(wk, (x) => x.gold)), cap: Math.round(at(wk, (x) => x.cap)) });
  return { unknown: Math.round(avg(rs.map((r) => r.unknownTotal))), w13: wkrow(13), w26: wkrow(26), w39: wkrow(39), w52: wkrow(52), wEnd: wkrow(rs[0].weeks.length),
    allMet: mark('allMet'), P1: mark('P1'), P2: mark('P2'), P3: mark('P3'), cont: { P1: cont('P1'), P2: cont('P2'), P3: cont('P3') },
    cards: avg(rs.map((r) => r.perDay.cards)), minutes: avg(rs.map((r) => r.perDay.minutes)), dueMed: avg(rs.map((r) => r.perDay.dueMed)), dueP90: avg(rs.map((r) => r.perDay.dueP90)), dueMax: avg(rs.map((r) => r.perDay.dueMax)),
    passRate: avg(rs.map((r) => r.passRate)), late: avg(rs.map((r) => r.lateDays)), bats: avg(rs.map((r) => r.tot.bats)), batsPerDay: avg(rs.map((r) => r.tot.bats / Math.max(1, r.tot.playDays))), forced: avg(rs.map((r) => r.tot.batCards / Math.max(1, r.tot.cards))), tileRun: avg(rs.map((r) => r.tot.tileCards / Math.max(1, r.tot.tiles))), tileMin: avg(rs.map((r) => r.tot.tileSec / 60 / Math.max(1, r.tot.tiles))), tilesPerDay: avg(rs.map((r) => r.tot.tiles / Math.max(1, r.tot.playDays))), batAcc: avg(rs.map((r) => r.batAcc)), monsters: avg(rs.map((r) => r.tot.monsters)), reviews: avg(rs.map((r) => r.tot.reviews)), lapses: avg(rs.map((r) => r.tot.lapses)),
    passed: avg(rs.map((r) => r.tot.passed)), passedUnknown: avg(rs.map((r) => r.tot.passedUnknown)), spotMiss: avg(rs.map((r) => r.tot.spotMiss / Math.max(1, r.tot.spot))), audits: avg(rs.map((r) => r.tot.audits)), auditFail: avg(rs.map((r) => r.tot.auditFails / Math.max(1, r.tot.audits))), placed: avg(rs.map((r) => r.tot.placed)), unplaced: avg(rs.map((r) => r.tot.unplaced)), total: rs[0].weeks.at(-1) ? Math.round(avg(rs.map((r) => r.unknownTotal))) : 0,
    castleFail: avg(rs.map((r) => r.tot.castleFails / Math.max(1, r.tot.castleTries))), verify: avg(rs.map((r) => r.tot.verifyOk / Math.max(1, r.tot.verifies))) };
}
const pct = (x) => (x == null || Number.isNaN(x) ? '-' : Math.round(x * 100) + '%'); const n0 = (x) => (x == null || Number.isNaN(x) ? '-' : String(Math.round(x)));
export function table(rows, cols) {
  const head = '| ' + cols.map((c) => c[0]).join(' | ') + ' |\n|' + cols.map((c, i) => (i ? '---:' : '---')).join('|') + '|\n';
  return head + rows.map((r) => '| ' + cols.map((c) => c[1](r)).join(' | ') + ' |').join('\n') + '\n';
}
export const COLS = [
  ['조건', (r) => r.name], ['전체 만남(주)', (r) => n0(r.s.allMet)], ['26주 만남', (r) => n0(r.s.w26.met)], ['26주 기억', (r) => `${n0(r.s.w26.now)}/${n0(r.s.w26.metUnknown)}`],
  ['52주 만남', (r) => n0(r.s.w52.met)], ['52주 기억', (r) => `${n0(r.s.w52.now)}/${n0(r.s.w52.metUnknown)}`], ['52주 굳은 단어', (r) => n0(r.s.w52.durable)], ['52주 금', (r) => n0(r.s.w52.gold)],
  ['복습 정답률', (r) => pct(r.s.passRate)], ['복습 지연(일)', (r) => r.s.late.toFixed(1)], ['밀린 복습 중앙/최대', (r) => `${n0(r.s.dueMed)}/${n0(r.s.dueMax)}`], ['하루 박쥐', (r) => r.s.batsPerDay.toFixed(1)], ['박쥐 카드 비중', (r) => pct(r.s.forced)], ['박쥐 정답률', (r) => pct(r.s.batAcc)], ['52주 용량', (r) => n0(r.s.w52.cap)], ['몬스터(회)', (r) => n0(r.s.monsters)], ['칸 한 판(장/분)', (r) => `${n0(r.s.tileRun)}/${r.s.tileMin.toFixed(1)}`], ['하루 카드', (r) => n0(r.s.cards)],
];
export const TRIAGE_COLS = [
  ['조건', (r) => r.name], ['전체 만남(주)', (r) => n0(r.s.allMet)], ['P1 대륙 성 통과(주)', (r) => n0(r.s.P1)], ['26주 만남', (r) => n0(r.s.w26.met)], ['52주 기억', (r) => `${n0(r.s.w52.now)}/${n0(r.s.w52.metUnknown)}`], ['52주 굳은 단어', (r) => n0(r.s.w52.durable)], ['52주 금', (r) => n0(r.s.w52.gold)],
  ['모르는데 금(52주/끝)', (r) => `${n0(r.s.w52.fake)}/${n0(r.s.wEnd.fake)}`], ['카드 없이 넘긴 단어(그중 모르는 것)', (r) => `${n0(r.s.passed)}(${n0(r.s.passedUnknown)})`], ['즉석 확인 오답', (r) => pct(r.s.spotMiss)], ['표본 확인(회)/실패', (r) => `${n0(r.s.audits)}/${pct(r.s.auditFail)}`], ['진단으로 넘긴 세계(되돌린 수)', (r) => `${r.s.placed.toFixed(1)}(${r.s.unplaced.toFixed(1)})`],
  ['세계 성 실패', (r) => pct(r.s.castleFail)], ['복습 정답률', (r) => pct(r.s.passRate)], ['박쥐 카드 비중', (r) => pct(r.s.forced)], ['하루 카드', (r) => n0(r.s.cards)],
];
export const CONT_COLS = [['조건', (r) => r.name], ...['P1', 'P2', 'P3'].flatMap((b) => [[`${b} 도착(주)`, (r) => (r.s.cont[b] ? r.s.cont[b].ready.toFixed(0) : '-')], [`${b} 정답률`, (r) => pct(r.s.cont[b]?.acc)],
  ...[0.65, 0.7, 0.75, 0.8].map((g) => [`${b} ${g * 100}%선 통과`, (r) => pct(r.s.cont[b]?.pass[g])])])];

export const GATE_COLS = [['조건', (r) => r.name], ...['P1', 'P2', 'P3'].flatMap((b) => [[`${b} 도착(주)`, (r) => (r.s.cont[b] ? r.s.cont[b].ready.toFixed(0) : '-')], [`${b} 통과한 비율`, (r) => pct(r.s.cont[b]?.passed)],
  [`${b} 시도`, (r) => (r.s.cont[b] ? r.s.cont[b].tries.toFixed(1) : '-')], [`${b} 막힌 날`, (r) => (r.s.cont[b]?.blocked == null ? '-' : r.s.cont[b].blocked.toFixed(1))]]), ['전체 만남(주)', (r) => n0(r.s.allMet)], ['52주 기억', (r) => `${n0(r.s.w52.now)}/${n0(r.s.w52.metUnknown)}`]];

// ---- scenario runner: every (scenario, seed) is one job, spread over worker threads ----
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'; import os from 'node:os';
export async function runScenarios(list, seeds, weeks) {                      // list: [{ name, opt }]
  const jobs = []; list.forEach((sc, i) => { for (let s = 1; s <= seeds; s++) jobs.push({ i, opt: { weeks, ...sc.opt, seed: s * 7919 } }); });
  const res = list.map(() => []); let next = 0; const n = Math.min(jobs.length, Math.max(1, os.cpus().length));
  await Promise.all(Array.from({ length: n }, () => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { worker: true } });
    const feed = () => { if (next >= jobs.length) { w.terminate(); resolve(); return; } const j = jobs[next++]; w.postMessage(j); };
    w.on('message', (m) => { res[m.i].push(m.r); feed(); }); w.on('error', reject); feed();
  })));
  return list.map((sc, i) => ({ name: sc.name, opt: sc.opt, s: summarize(res[i]) }));
}
if (!isMainThread && workerData?.worker) {
  const words = catalog();
  parentPort.on('message', (j) => { const r = simulate(words, j.opt); parentPort.postMessage({ i: j.i, r }); });
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const seeds = Number(arg('seeds', 3)); const weeks = Number(arg('weeks', 78)); const set = arg('set', 'chosen'); const out = {};
  const SETS = (await import('./sim_scenarios.mjs')).default;
  if (!SETS[set]) { console.error('unknown --set. one of: ' + Object.keys(SETS).join(', ')); process.exit(2); }
  for (const sec of SETS[set]) {
    const rows = await runScenarios(sec.rows, seeds, weeks); out[sec.title] = rows;
    console.log(`\n### ${sec.title}\n`); console.log(table(rows, sec.cols === 'cont' ? CONT_COLS : sec.cols === 'gate' ? GATE_COLS : sec.cols === 'triage' ? TRIAGE_COLS : COLS));
  }
  if (arg('json', null)) fs.writeFileSync(arg('json'), JSON.stringify(out, null, 1));
}
