import test from 'node:test';
import assert from 'node:assert/strict';
import { recordIntroduction, recordAttempt, recordSkipNoAudio } from '../game/js/engine.js';

const ctx = (today = '2026-11-11') => ({ today, now: Date.parse(today + 'T09:00:00Z') });
const prof = (rec = {}) => ({ id: 'son', cards: { c1: { tier: 'T1', depthTarget: 3, introduced: null, depthDone: 0, known: '미확인', streak: 0, due: null, lastScoredDay: null, ...rec } }, log: [] });
const att = (o = {}) => ({ cardId: 'c1', depth: 1, type: 'choice', correct: true, hint: false, heard: true, audioOk: true, scoring: true, retry: false, attempt: 1, round: 'A', ms: 900, ...o });

test('E1: introduction sets the date once, schedules nothing, logs hearing', () => {
  const p = prof();
  assert.equal(recordIntroduction(p, 'c1', { ...ctx(), heard: true }).newlyIntroduced, true);
  assert.equal(p.cards.c1.introduced, '2026-11-11'); assert.equal(p.cards.c1.due, null);
  assert.equal(recordIntroduction(p, 'c1', { ...ctx('2026-11-12'), heard: false }).newlyIntroduced, false);
  assert.equal(p.cards.c1.introduced, '2026-11-11');
  assert.deepEqual(p.log.map((e) => e.audioOk), [true, false]);
});

test('E2: independent, hinted and wrong first attempts map to schedule and counters', () => {
  let p = prof(); let r = recordAttempt(p, att(), ctx());
  assert.deepEqual([r.outcome, r.stat, r.scored], ['independent', 'independent', true]);
  assert.equal(p.cards.c1.due, '2026-11-12'); assert.equal(p.cards.c1.streak, 1);
  p = prof(); r = recordAttempt(p, att({ hint: true }), ctx());
  assert.deepEqual([r.outcome, p.cards.c1.due], ['hinted', '2026-11-12']);
  p = prof(); r = recordAttempt(p, att({ correct: false }), ctx());
  assert.deepEqual([r.outcome, p.cards.c1.known, p.cards.c1.dayFail], ['wrong', '모름', '2026-11-11']);
});

test('E3: right after a same-day miss is a recovery, not a pass', () => {
  const p = prof(); recordAttempt(p, att({ correct: false }), ctx());
  const r = recordAttempt(p, att({ depth: 2 }), ctx());
  assert.equal(r.recovered, true); assert.equal(r.logOutcome, 'recovered_same_day'); assert.equal(p.cards.c1.streak, 0);
});

test('E4: retry attempts never change the schedule', () => {
  const p = prof(); recordAttempt(p, att({ correct: false }), ctx());
  const before = JSON.stringify(p.cards.c1);
  const r = recordAttempt(p, att({ retry: true, scoring: false }), ctx());
  assert.deepEqual([r.outcome, r.stat, r.scored], ['retry_success', 'retried', false]);
  assert.equal(JSON.stringify(p.cards.c1), before);
});

test('E5: assist is audio only when the sound was heard; skip is logged unscored', () => {
  const p = prof(); recordAttempt(p, att({ heard: false, scoring: false }), ctx());
  assert.equal(p.log[0].assist, 'none');
  recordSkipNoAudio(p, { cardId: 'c1', type: 'choice', depth: 1 }, ctx());
  assert.deepEqual([p.log[1].outcome, p.log[1].scoring], ['skipped_no_audio', false]);
});
