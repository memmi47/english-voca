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

// outcome: 'independent' | 'hinted' | 'wrong'
// Returns a new record; never mutates. Same card is scored at most once per day.
export function applyScore(rec, outcome, day, depth) {
  if (rec.lastScoredDay === day) return { ...rec, changed: false };
  const r = { ...rec, lastScoredDay: day, lastOutcome: outcome, changed: true };
  const long = isLong(rec.tier);
  // Rehearsal before due date does not advance the interval (core.py behaviour).
  if (outcome === 'independent' && long && rec.due && rec.due > day) {
    return { ...r, changed: false, lastScoredDay: rec.lastScoredDay, lastOutcome: rec.lastOutcome };
  }
  if (outcome === 'independent') {
    r.streak = (rec.streak || 0) + 1;
    r.known = '앎'; r.origin = '게임 인출(소리 동반)';
    r.depthDone = Math.max(rec.depthDone || 0, depth);
    r.due = long ? addDays(day, SRS_DAYS[Math.min(r.streak - 1, SRS_DAYS.length - 1)]) : null;
  } else if (outcome === 'hinted') {
    // Assumption: hinted success is neither a pass nor a reset. Seen again tomorrow.
    r.known = rec.known === '앎' ? '앎' : '모름';
    r.origin = '게임 인출(힌트)';
    r.due = long ? addDays(day, 1) : null;
  } else {
    r.streak = 0; r.known = '모름'; r.origin = '게임 인출(소리 동반)';
    r.due = long ? addDays(day, 1) : null;
  }
  return r;
}
