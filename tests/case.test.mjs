// Detective layer: case status is derived from card records; session order puts this week's words first.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Store, memoryStorage } from '../game/js/store.js';
import { Catalog } from '../game/js/catalog.js';
import { planSession, Session, REVIEW_EVERY } from '../game/js/session.js';
import { mulberry32 } from '../game/js/questions.js';
import { caseStatus, currentCaseId, familyProgress, stageLabel } from '../game/js/case.js';

const cat = new Catalog(JSON.parse(fs.readFileSync('game/data/catalog.json', 'utf8')));
const pack = (p) => JSON.parse(fs.readFileSync(`game/data/demo_pack_${p}.json`, 'utf8'));
const S = { newPerSession: 5, reviewMax: 25, sessionMinutes: 15 };
const load = (who) => { const st = new Store(memoryStorage()); st.importPack(who, pack(who)); const p = st.profile(who); const c = cat.with(p.localCards); return { p, cardOf: (id) => c.card(id) }; };
const CASE = 'DEMO-HOUSE';

test('C1: new case -> in progress -> solved -> closed, in that order', () => {
  const { p, cardOf } = load('son');
  let st = caseStatus(p, CASE, cardOf);
  assert.deepEqual([st.cards, st.total, st.secured, st.started, st.solved, st.vaultTotal], [9, 9, 0, false, false, 3]);
  assert.equal(stageLabel(st), '새 사건');
  const recs = Object.values(p.cards);
  recs.slice(0, 5).forEach((r) => { r.introduced = '2026-11-11'; r.depthDone = 2; r.known = '앎'; r.streak = 1; });
  st = caseStatus(p, CASE, cardOf);
  assert.deepEqual([st.secured, st.solved, stageLabel(st)], [5, false, '수사 중']);
  recs.forEach((r) => { r.introduced = '2026-11-11'; r.depthDone = Math.max(r.depthDone, 1); });
  st = caseStatus(p, CASE, cardOf);
  assert.deepEqual([st.solved, st.closed, st.vaultOpen], [true, false, 0]);
  recs.forEach((r) => { if (r.depthTarget >= 4) r.depthDone = 4; });
  st = caseStatus(p, CASE, cardOf);
  assert.deepEqual([st.closed, st.vaultOpen, stageLabel(st)], [true, 3, '사건 종결']);
});

test('C2: a secured clue stays secured after a later miss; only the light goes out', () => {
  const { p, cardOf } = load('son'); const r = Object.values(p.cards)[0];
  Object.assign(r, { introduced: '2026-11-11', depthDone: 2, known: '앎', streak: 2 });
  const a = caseStatus(p, CASE, cardOf);
  Object.assign(r, { known: '모름', streak: 0 });
  const b = caseStatus(p, CASE, cardOf);
  assert.equal(b.secured, a.secured); assert.equal(b.lit, a.lit - 1);
});

test('C3: exposure-only (T3) words must be seen but are not required clues', () => {
  const { p, cardOf } = load('daughter');
  const st0 = caseStatus(p, CASE, cardOf);
  assert.equal(st0.cards, 8); assert.equal(st0.total, 7);                       // cobweb is T3 in this pack
  for (const r of Object.values(p.cards)) if (r.tier !== 'T3') { r.introduced = '2026-11-11'; r.depthDone = 1; }
  assert.equal(caseStatus(p, CASE, cardOf).solved, false);                      // T3 word not seen yet
  for (const r of Object.values(p.cards)) r.introduced = '2026-11-11';
  assert.equal(caseStatus(p, CASE, cardOf).solved, true);
});

test('C4: status is read-only and the family total adds both children', () => {
  const son = load('son'), dau = load('daughter');
  for (const r of Object.values(son.p.cards)) { r.introduced = '2026-11-11'; r.depthDone = 1; }
  const before = JSON.stringify(son.p);
  const fam = familyProgress([{ profile: son.p, cardOf: son.cardOf }, { profile: dau.p, cardOf: dau.cardOf }]);
  assert.deepEqual(fam, { solved: 1, secured: 9 });
  assert.equal(JSON.stringify(son.p), before);
});

test('C5: the current case is the first pack with unseen words, then the first one not closed', () => {
  const { p, cardOf } = load('son');
  p.packs.SECOND = { book: 'SECOND', order: ['W2555:기본:owl:1'], sample: true };
  assert.equal(currentCaseId(p, cardOf), CASE);
  for (const r of Object.values(p.cards)) { r.introduced = '2026-11-11'; r.depthDone = 4; }
  assert.equal(caseStatus(p, CASE, cardOf).closed, true);
  assert.equal(currentCaseId(p, cardOf), 'SECOND');                             // closed case gives way to the open one
  assert.equal(currentCaseId({ packs: {}, cards: {} }, cardOf), null);
});

test('C6: this week\'s words come first; reviews are interleaved and the rest go last', () => {
  const { p } = load('son'); const ids = Object.keys(p.cards);
  ids.slice(0, 6).forEach((id) => Object.assign(p.cards[id], { introduced: '2026-11-11', lastScoredDay: '2026-11-11', known: '앎', streak: 1, depthDone: 2, due: '2026-11-12' }));
  const plan = planSession({ profile: p, today: '2026-11-12', settings: S, catalog: cat });
  assert.equal(plan.newIds.length, 3); assert.equal(plan.reviews.length, 6);
  const s = new Session({ profile: p, catalog: cat, plan, today: '2026-11-12', rng: mulberry32(3), hasArt: () => true });
  const kinds = s.tasks.map((t) => (t.kind === 'learn' ? 'L' : t.round === 'review' ? 'R' : 'N')).join('');
  assert.equal(kinds, 'LLL' + 'NNR'.repeat(3) + 'RRR');                        // 3 new x 2 rounds = 6 new-word questions
  assert.equal(REVIEW_EVERY, 2);
  const reviewsOnly = new Session({ profile: p, catalog: cat, plan: { ...plan, newIds: [] }, today: '2026-11-12', rng: mulberry32(3), hasArt: () => true });
  assert.ok(reviewsOnly.tasks.every((t) => t.round === 'review'));
});
