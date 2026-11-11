// Case state for the detective layer. One case = one weekly pack.
// Everything here is derived from card records; nothing is stored, so sync and scoring are untouched
// and a reward can never change a schedule.
import { effectiveDepth, isLong } from './srs.js';
import { spellable } from './questions.js';

// "Clue secured": the word was recalled independently at least once (depthDone is only raised by an
// independent answer). It never goes back, unlike the scene light, which shows current memory.
export const isSecured = (r) => (r.depthDone || 0) >= 1;
export const isLit = (r) => r.known === '앎' && r.streak > 0;

// cardOf(id) -> normalized catalog card (needed to know whether a depth-4 word can be spelled).
// T3 cards are exposure only (no review if missed), so they must be seen but need not be secured.
export function caseStatus(profile, packId, cardOf = () => null) {
  const pk = profile.packs[packId];
  const recs = (pk?.order || []).map((id) => [id, profile.cards[id]]).filter(([, r]) => r);
  const need = recs.filter(([, r]) => isLong(r.tier));
  const vault = need.filter(([id, r]) => effectiveDepth(r.tier, r.depthTarget) >= 4 && spellable(cardOf(id)?.form || ''));
  const secured = need.filter(([, r]) => isSecured(r)).length;
  const seen = recs.filter(([, r]) => r.introduced).length;
  const vaultOpen = vault.filter(([, r]) => (r.depthDone || 0) >= 4).length;
  const solved = recs.length > 0 && seen === recs.length && secured === need.length;
  return { id: packId, sample: !!pk?.sample, cards: recs.length, seen, started: seen > 0, total: need.length, secured,
    lit: recs.filter(([, r]) => isLit(r)).length, vaultTotal: vault.length, vaultOpen, solved,
    closed: solved && vaultOpen === vault.length };
}

export function stageLabel(st) {
  if (!st.started) return '새 사건';
  if (st.closed) return '사건 종결';
  if (st.solved) return '사건 해결 · 금고가 남았어요';
  return '수사 중';
}

// The case the child works on now: the first pack that still has unseen words (the same order the
// planner draws new words in), else the first case not yet closed, else the last one.
export function currentCaseId(profile, cardOf) {
  const ids = Object.keys(profile.packs);
  if (!ids.length) return null;
  const sts = ids.map((id) => caseStatus(profile, id, cardOf));
  return (sts.find((s) => s.seen < s.cards) || sts.find((s) => !s.closed) || sts[sts.length - 1]).id;
}

// Cooperative family total. Never broken down per child on screen.
export function familyProgress(entries) {   // [{ profile, cardOf }]
  let solved = 0, secured = 0;
  for (const { profile, cardOf } of entries)
    for (const id of Object.keys(profile.packs)) { const s = caseStatus(profile, id, cardOf); if (s.solved) solved++; secured += s.secured; }
  return { solved, secured };
}
