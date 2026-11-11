// Learning engine: today's card plan, introduction records, retrieval-attempt records.
// No UI, no question building. Genre screens (quiz, detective) call these and render the result.
// Scheduling math stays in srs.js; this module decides which outcome an attempt counts as,
// applies it to the profile record, and appends the log entry.
import { applyScore, isLong } from './srs.js';

// ---- today's card plan --------------------------------------------------------
// -> { reviews: [cardId], newIds: [cardId], newRemaining, dueTotal }
export function planToday({ profile, today, settings, catalog }) {
  const recs = profile.cards;
  const norm = (id) => catalog.with(profile.localCards).card(id);
  const reviews = Object.entries(recs)
    .filter(([id, r]) => isLong(r.tier) && r.introduced && r.due && r.due <= today && norm(id))
    .sort((a, b) => a[1].due.localeCompare(b[1].due) || a[0].localeCompare(b[0]))
    .slice(0, settings.reviewMax).map(([id]) => id);
  const newPool = [];
  for (const pk of Object.values(profile.packs))
    for (const id of pk.order) {
      const r = recs[id];
      // introduced-but-never-scored cards (left early / skipped) come back as new
      const unscored = r && r.introduced && !r.lastScoredDay && r.known !== '앎';
      if (r && (!r.introduced || unscored) && norm(id) && !(r.known === '앎' && !r.inferred && r.introduced == null)) newPool.push(id);
    }
  const newIds = newPool.slice(0, settings.newPerSession);
  return { reviews, newIds, newRemaining: newPool.length - newIds.length, dueTotal: Object.values(recs).filter((r) => isLong(r.tier) && r.introduced && r.due && r.due <= today).length };
}

// ---- log ----------------------------------------------------------------------
export function appendLog(profile, entry, { today, now }) {
  const rec = profile.cards[entry.card];
  profile.log.push({ t: new Date(now).toISOString(), day: today, sample: !!rec?.sample, ...entry });
}

// ---- introduction -------------------------------------------------------------
// The word was shown and heard (or the parent skipped the sound: heard=false).
// Introduction alone never schedules anything; the first scored attempt does.
// -> { newlyIntroduced }
export function recordIntroduction(profile, cardId, { today, now, heard }) {
  const r = profile.cards[cardId];
  const newlyIntroduced = !r.introduced;
  if (newlyIntroduced) r.introduced = today;
  appendLog(profile, { card: cardId, type: 'learn', outcome: 'introduced', audioOk: !!heard }, { today, now });
  return { newlyIntroduced };
}

// ---- retrieval attempt --------------------------------------------------------
// a: { cardId, depth, type, correct, hint, heard, audioOk, scoring, retry, attempt (1-based), round, ms }
//   heard   - the prompt/word sound was actually played (decides assist: audio vs none)
//   scoring - this task may change the schedule (first attempt, one scored task per card per day)
//   retry   - spaced re-challenge after a miss; never scored
// Mutates the profile's card record and appends the log entry.
// -> { outcome, logOutcome, recovered, scored, stat }
//   outcome  independent | hinted | wrong | retry_success | retry_wrong | retry | null
//   stat     which session counter to bump (independent|hinted|wrong|retried) or null
export function recordAttempt(profile, a, { today, now }) {
  const r = profile.cards[a.cardId];
  let outcome = null, recovered = false, scored = false, stat = null;
  if (a.attempt === 1 && a.scoring) {
    scored = true;
    outcome = !a.correct ? 'wrong' : a.hint ? 'hinted' : 'independent';
    // Wrong earlier today (e.g. depth 1) then right at depth 2: a recovery, not a pass.
    if (outcome === 'independent' && r.dayFail === today) { outcome = 'hinted'; recovered = true; }
    const { changed, ...next } = applyScore(r, outcome, today, a.depth, !!a.heard);
    Object.assign(r, next);
    if (outcome === 'wrong') r.dayFail = today;
    stat = outcome;
  } else if (a.retry) {
    outcome = a.correct ? 'retry_success' : 'retry_wrong';
    if (a.correct) stat = 'retried';
  } else if (a.attempt === 1 && !a.correct && !a.scoring) {
    outcome = 'wrong'; stat = 'wrong'; r.dayFail = today;
  } else if (a.correct && a.attempt > 1) {
    outcome = 'retry'; stat = 'retried';
  } else if (a.correct) {
    outcome = a.hint ? 'hinted' : 'independent';
  }
  const logOutcome = recovered ? 'recovered_same_day' : (outcome || (a.correct ? 'independent' : 'wrong'));
  appendLog(profile, { card: a.cardId, type: a.type, depth: a.depth, outcome: logOutcome,
    attempts: a.attempt, hint: a.hint, audioOk: a.audioOk, scoring: a.scoring, round: a.round, ms: a.ms,
    correct: a.correct, assist: a.heard ? 'audio' : 'none', retryTask: a.retry }, { today, now });
  return { outcome, logOutcome, recovered, scored, stat };
}

// The child could not hear the prompt and the parent skipped it. Logged, never scored.
export function recordSkipNoAudio(profile, { cardId, type, depth }, { today, now }) {
  appendLog(profile, { card: cardId, type, depth, outcome: 'skipped_no_audio', scoring: false, audioOk: false, assist: 'none' }, { today, now });
}
