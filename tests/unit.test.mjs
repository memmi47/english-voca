import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyScore, addDays, effectiveDepth, SRS_DAYS } from '../game/js/srs.js';
import { Store, memoryStorage, fingerprint } from '../game/js/store.js';
import { Catalog } from '../game/js/catalog.js';
import { planSession, Session } from '../game/js/session.js';
import { mulberry32, clozeParts, makeQuestion, resolveDepth } from '../game/js/questions.js';

const cat = new Catalog(JSON.parse(fs.readFileSync('game/data/catalog.json', 'utf8')));
const pack = (p) => JSON.parse(fs.readFileSync(`game/data/demo_pack_${p}.json`, 'utf8'));
const hasArt = () => true;
const rec0 = (o = {}) => ({ tier: 'T1', streak: 0, due: null, depthDone: 0, known: '미확인', lastScoredDay: null, ...o });

test('SRS 1,3,7,14,30 then capped; failure resets to next day', () => {
  let r = rec0(); let day = '2026-11-11'; const gaps = [];
  for (let i = 0; i < 7; i++) { r = applyScore(r, 'independent', day, 2); gaps.push((new Date(r.due) - new Date(day)) / 864e5); day = r.due; }
  assert.deepEqual(gaps, [...SRS_DAYS, 30, 30]);
  r = applyScore(r, 'wrong', day, 2);
  assert.equal(r.streak, 0); assert.equal(r.due, addDays(day, 1));
});
test('same-day second score and early rehearsal do not advance', () => {
  let r = applyScore(rec0(), 'independent', '2026-11-11', 2);
  const again = applyScore(r, 'independent', '2026-11-11', 2);
  assert.equal(again.streak, 1); assert.equal(again.changed, false);
  const early = applyScore({ ...r, lastScoredDay: '2026-11-11' }, 'independent', '2026-11-12', 2); // due 11-12 -> ok
  assert.equal(early.streak, 2);
  const tooEarly = applyScore({ ...r, lastScoredDay: '2026-11-11', due: '2026-11-20' }, 'independent', '2026-11-13', 2);
  assert.equal(tooEarly.streak, 1);
});
test('T3 never gets a due date; hinted does not advance or reset', () => {
  assert.equal(applyScore(rec0({ tier: 'T3' }), 'independent', '2026-11-11', 1).due, null);
  const r = applyScore(rec0({ streak: 3, known: '앎' }), 'hinted', '2026-11-11', 2);
  assert.equal(r.streak, 3); assert.equal(r.due, '2026-11-12');
  assert.equal(effectiveDepth('T3', 4), 2); assert.equal(effectiveDepth('T2', 4), 3); assert.equal(effectiveDepth('T1', 4), 4);
});
test('import is idempotent and never resets progress; profiles are separate', () => {
  const st = new Store(memoryStorage());
  const rep1 = st.importPack('son', pack('son'));
  assert.ok(rep1.added >= 8);
  const p = st.profile('son'); const id = Object.keys(p.cards)[0];
  p.cards[id].streak = 4; p.cards[id].due = '2026-12-01'; p.cards[id].introduced = '2026-11-11'; st.saveProfile(p);
  const rep2 = st.importPack('son', pack('son'));
  assert.equal(rep2.added, 0); assert.equal(rep2.packs[0].status, 'same');
  assert.equal(st.profile('son').cards[id].streak, 4);
  // edited pack (context change) merges without reset
  const edited = pack('son'); edited.approved_packs[0].context = 'A ghost sang.';
  const rep3 = st.importPack('son', edited);
  assert.equal(rep3.packs[0].status, 'merged'); assert.equal(st.profile('son').cards[id].streak, 4);
  assert.equal(Object.keys(st.profile('daughter').cards).length, 0);
  assert.throws(() => st.importPack('daughter', pack('son')), /선택한 아이와 다릅니다/);
});
test('diagnostic-inferred known is kept as estimate, not direct knowledge', () => {
  const st = new Store(memoryStorage()); const d = pack('son'); const c = d.approved_packs[0].card;
  d.card_states = { [c]: ['앎', '진단 구간 추정 P1', null, 0] };
  st.importPack('son', d);
  const r = st.profile('son').cards[c];
  assert.equal(r.inferred, true); assert.equal(r.due, null);
});
test('plan caps new cards; review only due T1/T2; cloze needs the word in the sentence', () => {
  const st = new Store(memoryStorage()); st.importPack('son', pack('son'));
  const p = st.profile('son'); const settings = st.meta().settings;
  const plan = planSession({ profile: p, today: '2026-11-11', settings, catalog: cat });
  assert.equal(plan.newIds.length, 5); assert.equal(plan.reviews.length, 0);
  assert.deepEqual(clozeParts('The wind shook the window.', 'wind'), { before: 'The ', word: 'wind', after: ' shook the window.' });
  assert.equal(clozeParts('Windy day', 'wind'), null);
  const rng = mulberry32(1); const c = cat.with(p.localCards).card(plan.newIds[0]);
  assert.equal(resolveDepth(c, { context: '' }, 3, hasArt), 2);
});
test('full session: wrong first answer is scored wrong, retried later, no double scoring', () => {
  const st = new Store(memoryStorage()); st.importPack('son', pack('son'));
  const p = st.profile('son'); const settings = st.meta().settings;
  const plan = planSession({ profile: p, today: '2026-11-11', settings, catalog: cat });
  const s = new Session({ profile: p, catalog: cat, plan, today: '2026-11-11', rng: mulberry32(7), hasArt });
  let wrongOnce = false, guard = 0, flaggedCard = null;
  while (s.current && guard++ < 200) {
    const t = s.current;
    if (t.kind === 'learn') { s.completeLearn(t.cardId); s.advance(); continue; }
    s.audioPlayed();
    if (!wrongOnce && t.scoring) { wrongOnce = true; flaggedCard = t.q.cardId; const w = t.q.type === 'spell' ? 'zzz' : (t.q.answer + 1) % t.q.options.length; s.submit(w); }
    const right = t.q.type === 'spell' ? t.q.target : t.q.answer;
    s.submit(right); s.advance();
  }
  assert.ok(guard < 200);
  const r = p.cards[flaggedCard];
  assert.equal(r.streak, 0); assert.equal(r.known, '모름');
  assert.equal(r.due, '2026-11-12');
  const others = plan.newIds.filter((i) => i !== flaggedCard);
  for (const o of others) assert.equal(p.cards[o].streak, 1);
  assert.ok(p.log.some((e) => e.outcome === 'retry'));
  assert.ok(p.log.every((e) => e.assist === 'audio' || e.type === 'learn' || e.assist === 'none'));
  // day 2: due reviews come back, depth steps up
  const plan2 = planSession({ profile: p, today: '2026-11-12', settings, catalog: cat });
  assert.ok(plan2.reviews.includes(flaggedCard)); assert.equal(plan2.newIds.length, 4);
});
test('fingerprint stable', () => { assert.equal(fingerprint([1, 2]), fingerprint([1, 2])); assert.notEqual(fingerprint([1]), fingerprint([2])); });
