// Review scheduling. Mirrors reference/weekly-tool/core.py record_review:
// success -> streak+1, next due 1/3/7/14/30 days; failure -> streak 0, due next day.
// Only T1/T2 get long-term due dates. T3 is exposure only.
export const SRS_DAYS = [1, 3, 7, 14, 30];
export const LONG_TIERS = ['T1', 'T2'];
export const TIER_MAX_DEPTH = { T1: 4, T2: 3, T3: 2 };

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export function effectiveDepth(tier, depthTarget) {
  return Math.max(1, Math.min(depthTarget || 2, TIER_MAX_DEPTH[tier] || 2));
}
export function isLong(tier) { return LONG_TIERS.includes(tier); }

// Which depth to ask at the next review. Steps up one level per due review until the
// effective target; a failed step-up is put on hold so reading-level review continues.
export const STEP_UP_HOLD_DAYS = 7;
export function nextDepth(rec, today) {
  const eff = effectiveDepth(rec.tier, rec.depthTarget);
  const done = rec.depthDone || 0;
  if (done >= eff) return eff;
  if (done >= 2 && rec.holdStepUpUntil && rec.holdStepUpUntil > today) return done;
  return Math.max(1, done + 1);
}

// outcome: 'independent' | 'hinted' | 'wrong'
// Returns a new record; never mutates. Same card is scored at most once per day.
//
// Reading knowledge (known/streak) is decided at depth 1-2 (sound/word -> meaning).
// A miss at depth 3-4 (cloze, spelling) on a card whose meaning was already recalled
// independently does not mark the word unknown: it is checked again tomorrow at the
// reading level and the harder step is retried after STEP_UP_HOLD_DAYS.
export function applyScore(rec, outcome, day, depth, heard = true) {
  const origin = heard ? '게임 인출(소리 동반)' : '게임 인출(소리 없음)';
  if (rec.lastScoredDay === day) return { ...rec, changed: false };
  const r = { ...rec, lastScoredDay: day, lastOutcome: outcome, changed: true };
  const long = isLong(rec.tier);
  // Rehearsal before due date does not advance the interval (core.py behaviour).
  if (outcome === 'independent' && long && rec.due && rec.due > day) {
    return { ...r, changed: false, lastScoredDay: rec.lastScoredDay, lastOutcome: rec.lastOutcome };
  }
  if (outcome === 'independent') {
    r.streak = (rec.streak || 0) + 1;
    r.known = '앎'; r.origin = origin;
    r.depthDone = Math.max(rec.depthDone || 0, depth);
    r.due = long ? addDays(day, SRS_DAYS[Math.min(r.streak - 1, SRS_DAYS.length - 1)]) : null;
  } else if (outcome === 'hinted') {
    // Assumption: hinted success is neither a pass nor a reset. Seen again tomorrow.
    r.known = rec.known === '앎' ? '앎' : '모름';
    r.origin = '게임 인출(힌트)';
    r.due = long ? addDays(day, 1) : null;
  } else if (depth >= 3 && (rec.depthDone || 0) >= 2 && rec.known === '앎') {
    r.lastOutcome = 'wrong_step_up';                      // harder task missed, meaning still known
    r.holdStepUpUntil = addDays(day, STEP_UP_HOLD_DAYS);
    r.due = long ? addDays(day, 1) : null;
  } else {
    r.streak = 0; r.known = '모름'; r.origin = origin;
    r.due = long ? addDays(day, 1) : null;
  }
  return r;
}
