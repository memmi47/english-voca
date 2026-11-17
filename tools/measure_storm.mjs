// Reproducible C-008 experiment; see docs/research/storm_frequency.md for its model and denominators.
import { readFileSync } from 'node:fs';
import { newState, mulberry32 } from '../cards/js/deck.js';
import { ensureMap } from '../cards/js/map.js';
import { indexWorlds, startTile, settleWorld, unitDone, unitsIn } from '../cards/js/world.js';
import { STORM, indexForms, formPool, distances, stormTick, stormRelease, stormBlocks, StormRun, settleStorm } from '../cards/js/storm.js';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ix = indexWorlds(json('../cards/data/worlds.json'));
const fx = indexForms(json('../cards/data/forms.json'));
const tiles = ix.worlds.flatMap((w) => w.map.nodes.filter((n) => n.kind === 'tile').map((n) => ({ w, n })));
const seedCount = Number(process.env.STORM_SEEDS || 200);
if (!Number.isInteger(seedCount) || seedCount < 1) throw new Error('STORM_SEEDS must be a positive integer');
const day = (n) => new Date(Date.UTC(2025, 0, 1 + n)).toISOString().slice(0, 10);
function finishTile(state, w, n, today) {
  const node = { kind: 'tile', wid: w.id, unit: n.id };
  startTile(state, node, today);
  // All words have been met and mastered; the modeled child has no overdue/bat debt.
  for (const id of n.words) if (!state.words[id]) (state._fastWords ? Object.getPrototypeOf(state.words) : state.words)[id] = { st: 'done' };
  settleWorld(ix, state, node, { reason: 'done' }, today);
  if (!unitDone(state, unitsIn(w).find((u) => u.id === n.id))) throw new Error(`Tile not completed: ${w.id}/${n.id}`);
}
function modelState(fast = true) { const state = newState('measure'); if (fast) { state.words = Object.create(Object.create(null)); state._fastWords = true; } return state; }
function snapshot() {
  const state = modelState(); let first = null; const counts = [];
  for (const w of ix.worlds) {
    for (const n of w.map.nodes.filter((x) => x.kind === 'tile')) {
      finishTile(state, w, n, day(0));
      const count = formPool(state, fx, day(0)).length;
      if (!first && count >= STORM.need) first = `${w.id} / ${n.id} (${count})`;
    }
    counts.push(formPool(state, fx, day(0)).length);
  }
  return { first, counts };
}
function staticDistances(w) {
  const state = newState('static');
  for (const f of fx.forms) state.words[f.base] = { st: 'done' };
  const m = ensureMap(state); m.worlds[w.id] = { here: null };
  const rows = w.map.nodes.map((n) => {
    m.worlds[w.id].here = n.id; m.storm = null; m.stormN = 0; m.stormDay = null;
    const ev = stormTick(state, ix, fx, { wid: w.id, kind: 'tile', reason: 'done' }, day(0), () => 0);
    if (ev.event !== 'spawn') throw new Error(`No spawn from ${w.id}/${n.id}`);
    return { n, distance: distances(w, n.id)[ev.node] };
  });
  const summarize = (values) => {
    values.sort((a, b) => a - b); const mid = Math.floor(values.length / 2);
    return [values[0], values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2, values.at(-1)];
  };
  return [summarize(rows.filter(({n}) => n.kind === 'tile' || n.id === w.map.startNodeId).map((x) => x.distance)), summarize(rows.map((x) => x.distance))];
}
function simulate(rate, seed, fast = true) {
  const state = modelState(fast); const rng = mulberry32(seed); let spawn = 0, caught = 0, cards = 0, gone = 0, released = 0;
  for (let i = 0; i < tiles.length; i++) {
    const today = day(Math.floor(i / rate)); const { w, n } = tiles[i];
    if (stormRelease(state, ix, fx, today)) released++;
    finishTile(state, w, n, today);
    const ev = stormTick(state, ix, fx, { wid: w.id, kind: 'tile', reason: 'done' }, today, rng).event;
    if (ev === 'spawn') spawn++;
    if (ev === 'gone') gone++;
    if (stormBlocks(state, w.id, ix)) {
      caught++;
      const run = new StormRun({ state, fx, today, rng, now: () => 0 });
      while (run.current) { const card = run.show(); run.pick(card.options.indexOf(card.baseForm)); run.advance(); }
      const rec = run.finish(); cards += rec.cards; settleStorm(state, rec, today);
    }
    // Only storm rules use these histories; keeping them is unnecessary for this measurement.
    state.log.length = 0; state.runs.length = 0;
  }
  const pending = state.map.storm ? 1 : 0;
  if (spawn !== caught + gone + released + pending) throw new Error('Storm accounting mismatch');
  return { spawn, caught, cards, gone, released, pending };
}
const result = snapshot();
console.log(`Seeds: ${seedCount}; map tiles: ${tiles.length}; first eligible: ${result.first}`);
console.log('\n| 세계 | 학습 칸 | 전체 노드 | 배달부 위치 거리 최소/중앙/최대 | 전체 노드 거리 최소/중앙/최대 | 누적 형태 |\n|---|---:|---:|---|---|---:|');
ix.worlds.forEach((w, i) => { const [valid, all] = staticDistances(w); console.log(`| ${w.id} | ${w.map.nodes.filter((n) => n.kind === 'tile').length} | ${w.map.nodes.length} | ${valid.join(' / ')} | ${all.join(' / ')} | ${result.counts[i]} |`); });
console.log('\n| 확률 | 칸 판/일 | 일수/씨앗 | 생성/일 | 잡힘/일 | 카드/일 | 이동 소멸/일 | 풀 부족 소멸/일 | 종료 시 남음/일 |\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
const originalChance = STORM.chance;
try {
  for (const chance of [0.2, 0.35, 0.5]) {
    STORM.chance = chance;
    for (const rate of [6, 12, 20]) {
      const totals = { spawn: 0, caught: 0, cards: 0, gone: 0, released: 0, pending: 0 };
      for (let seed = 1; seed <= seedCount; seed++) {
        const r = simulate(rate, seed);
        if (process.env.STORM_VERIFY && seed === 1 && JSON.stringify(r) !== JSON.stringify(simulate(rate, seed, false))) throw new Error(`Enumerable comparison failed: ${chance}/${rate}`);
        for (const k of Object.keys(totals)) totals[k] += r[k];
      }
      const days = Math.ceil(tiles.length / rate); const denom = seedCount * days;
      console.log(`| ${chance} | ${rate} | ${days} | ${[totals.spawn, totals.caught, totals.cards, totals.gone, totals.released, totals.pending].map((n) => (n / denom).toFixed(3)).join(' | ')} |`);
    }
  }
} finally { STORM.chance = originalChance; }
