// Regression tests for defects reported by the QA review (each reproduced before fixing).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Store, memoryStorage } from '../game/js/store.js';
import { Catalog } from '../game/js/catalog.js';
import { planSession, Session } from '../game/js/session.js';
import { mulberry32, clozeParts, makeQuestion } from '../game/js/questions.js';

const cat = new Catalog(JSON.parse(fs.readFileSync('game/data/catalog.json', 'utf8')));
const pack = (p) => JSON.parse(fs.readFileSync(`game/data/demo_pack_${p}.json`, 'utf8'));
const hasArt = () => true;
const S = { newPerSession: 5, reviewMax: 25, sessionMinutes: 15 };
const known = (id) => !!cat.card(id);

test('A1: introduced-but-unscored cards return to the new queue', () => {
  const st = new Store(memoryStorage()); st.importPack('son', pack('son'));
  const p = st.profile('son'); const plan = planSession({ profile: p, today: '2026-11-11', settings: S, catalog: cat });
  const s = new Session({ profile: p, catalog: cat, plan, today: '2026-11-11', rng: mulberry32(1), hasArt });
  for (const id of plan.newIds) s.completeLearn(id);               // left the session before any scored question
  const again = planSession({ profile: p, today: '2026-11-12', settings: S, catalog: cat });
  assert.equal(again.newIds.length, 5); assert.deepEqual(new Set(again.newIds), new Set(plan.newIds));
});
test('A2: demo import never overwrites a real card; clearSample keeps real progress', () => {
  const st = new Store(memoryStorage()); const real = pack('son'); delete real._sample; real.approved_packs.forEach((r) => { r.book = 'REAL-1'; });
  st.importPack('son', real);
  const p = st.profile('son'); const id = real.approved_packs[0].card; p.cards[id].streak = 3; p.cards[id].due = '2026-12-01'; p.cards[id].introduced = '2026-11-11'; st.saveProfile(p);
  st.importPack('son', pack('son'), { sample: true });
  assert.equal(st.profile('son').cards[id].sample, false); assert.equal(st.profile('son').cards[id].streak, 3);
  st.clearSample('son');
  assert.equal(st.profile('son').cards[id]?.streak, 3);
});
test('A3: sound-pic never offers fewer than 3 pictures', () => {
  const card = cat.card('W1559:기본:ghost:1'); const pool = [card, cat.card('W2555:기본:owl:1')];
  const q = makeQuestion({ card, depth: 1, pool: [...pool, ...['W3285:기본:shadow:1', 'W3506:기본:spider:1', 'W0713:기본:cobweb:1'].map((i) => cat.card(i))], rec: { context: '' }, rng: mulberry32(2), hasArt: (c) => c.id === card.id || c.id === 'W2555:기본:owl:1' });
  assert.ok(q.options.length >= 3 || q.type !== 'sound-pic', q.type + ' ' + q.options.length);
});
test('B7: every occurrence of the target word is blanked in cloze', () => {
  const c = clozeParts('The ghost said the ghost is here.', 'ghost');
  assert.ok(!/ghost/i.test(c.before + c.after));
});
test('B9: wrong on depth 1 then right on depth 2 the same day does not advance the streak', () => {
  const st = new Store(memoryStorage()); st.importPack('son', pack('son'));
  const p = st.profile('son'); const plan = planSession({ profile: p, today: '2026-11-11', settings: S, catalog: cat });
  const s = new Session({ profile: p, catalog: cat, plan, today: '2026-11-11', rng: mulberry32(5), hasArt });
  const target = plan.newIds[0]; let guard = 0;
  while (s.current && guard++ < 100) {
    const t = s.current;
    if (t.kind === 'learn') { s.completeLearn(t.cardId); s.advance(); continue; }
    if (t.q.cardId === target && t.round === 'A') { s.audioPlayed?.(); s.submit(t.q.type === 'spell' ? 'zzz' : (t.q.answer + 1) % t.q.options.length); s.advance(); continue; }
    s.audioPlayed?.(); s.submit(t.q.type === 'spell' ? t.q.target : t.q.answer); s.advance();
  }
  assert.equal(p.cards[target].streak, 0); assert.equal(p.cards[target].due, '2026-11-12'); assert.notEqual(p.cards[target].lastOutcome, 'independent');
});
test('B6: sound-dependent question cannot be scored before its audio was confirmed', () => {
  const st = new Store(memoryStorage()); st.importPack('son', pack('son'));
  const p = st.profile('son'); const plan = planSession({ profile: p, today: '2026-11-11', settings: S, catalog: cat });
  const s = new Session({ profile: p, catalog: cat, plan, today: '2026-11-11', rng: mulberry32(5), hasArt });
  while (s.current.kind === 'learn') { s.completeLearn(s.current.cardId); s.advance(); }
  const t = s.current; assert.ok(t.q.needsSound);
  assert.equal(s.submit(t.q.answer).blocked, 'audio');
  s.audioPlayed(); assert.equal(s.submit(t.q.answer).correct, true);
});
test('B8/B10: import validation and tier-change due', () => {
  const st = new Store(memoryStorage());
  const bad = (mut, re) => { const d = pack('son'); mut(d); assert.throws(() => st.importPack('son', d, { knownCard: known }), re); };
  bad((d) => { d.approved_packs[0].book = ''; }, /book/);
  bad((d) => { d.approved_packs[0] = null; }, /항목/);
  bad((d) => { d.approved_packs[0].card = 'W9999:없는:카드:1'; }, /카탈로그/);
  bad((d) => { d.local_cards = {}; }, /local_cards/);
  bad((d) => { d.approved_packs[0].card = '__proto__'; }, /카드/);
  assert.equal(Object.keys(st.profile('son').cards).length, 0);
  const id = pack('son').approved_packs[2].card;
  const asT3 = pack('son'); asT3.approved_packs[2].tier = 'T3';
  st.importPack('son', asT3, { knownCard: known, today: '2026-11-11' });
  const p = st.profile('son'); p.cards[id].introduced = '2026-11-11'; p.cards[id].known = '앎'; p.cards[id].lastScoredDay = '2026-11-11'; st.saveProfile(p);
  assert.equal(st.profile('son').cards[id].due, null);
  st.importPack('son', pack('son'), { knownCard: known, today: '2026-11-12' });   // parent raises it to T1
  assert.equal(st.profile('son').cards[id].tier, 'T1'); assert.equal(st.profile('son').cards[id].due, '2026-11-12'); assert.equal(st.profile('son').cards[id].known, '앎');
});
test('B11: corrupted stored profile is backed up, not silently replaced', () => {
  const m = memoryStorage(); const st = new Store(m); st.importPack('son', pack('son'));
  m.setItem('catchup.v1.p.son', '{broken');
  const p = st.profile('son'); assert.deepEqual(p.cards, {});
  assert.ok([...m._map.keys()].some((k) => k.startsWith('catchup.v1.corrupt.son')));
  assert.ok(st.corrupt);
});
