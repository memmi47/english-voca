import { applyScore, effectiveDepth, isLong, nextDepth } from './srs.js';
import { makeQuestion, hintFor, shuffle } from './questions.js';

// ---- planning ---------------------------------------------------------------
export function planSession({ profile, today, settings, catalog }) {
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

// ---- session ----------------------------------------------------------------
export class Session {
  constructor({ profile, catalog, plan, today, rng, hasArt, now = () => Date.now(), onChange = () => {} }) {
    this.p = profile; this.cat = catalog.with(profile.localCards); this.plan = plan; this.today = today;
    this.rng = rng; this.hasArt = hasArt; this.now = now; this.onChange = onChange;
    this.stats = { newIntroduced: 0, reviewed: 0, independent: 0, hinted: 0, wrong: 0, retried: 0, audioFail: 0, skippedNoAudio: 0 };
    this.startedAt = now(); this.tasks = []; this.i = 0; this.ended = null; this._pool();
    this._build();
  }
  _pool() {
    const ids = new Set(); const arr = [];
    const add = (id) => { if (ids.has(id)) return; const c = this.cat.card(id); if (c && c.meaning) { ids.add(id); arr.push(c); } };
    for (const pk of Object.values(this.p.packs)) pk.order.forEach(add);
    Object.entries(this.p.cards).filter(([, r]) => r.introduced).forEach(([id]) => add(id));
    if (arr.length < 8) {
      const starters = Object.entries(this.cat.cards).filter(([, c]) => c.s && c.k === 'vocab' && c.m).map(([id]) => id);
      for (const id of shuffle(starters, this.rng)) { add(id); if (arr.length >= 14 && arr.filter((c) => this.hasArt(c)).length >= 6) break; }
    }
    this.pool = arr;
  }
  rec(id) { return this.p.cards[id]; }
  _q(cardId, depth, extra) {
    const card = this.cat.card(cardId);
    const q = makeQuestion({ card, depth, pool: this.pool, rec: this.rec(cardId), rng: this.rng, hasArt: this.hasArt });
    return { kind: 'question', q, scoring: false, retry: false, attempts: 0, hint: false, startMs: null, audioFailed: false, ...extra };
  }
  _build() {
    const { reviews, newIds } = this.plan; const t = [];
    for (const id of reviews) {
      t.push(this._q(id, nextDepth(this.rec(id), this.today), { scoring: true, round: 'review' }));
    }
    if (newIds.length) {
      for (const id of newIds) t.push({ kind: 'learn', cardId: id });
      const orderA = shuffle(newIds, this.rng); let orderB = shuffle(newIds, this.rng);
      if (orderB[0] === orderA[orderA.length - 1] && orderB.length > 1) orderB = orderB.slice(1).concat(orderB[0]);
      for (const id of orderA) {
        const eff = effectiveDepth(this.rec(id).tier, this.rec(id).depthTarget);
        t.push(this._q(id, 1, { scoring: eff <= 1, round: 'A' }));
      }
      for (const id of orderB) {
        const eff = effectiveDepth(this.rec(id).tier, this.rec(id).depthTarget);
        if (eff >= 2) t.push(this._q(id, 2, { scoring: true, round: 'B' }));
      }
    }
    this.tasks = t;
  }
  get current() { return this.ended ? null : this.tasks[this.i] || null; }
  get total() { return this.tasks.length; }
  get index() { return this.i; }

  completeLearn(cardId) {
    const r = this.rec(cardId); const t = this.current;
    if (!r.introduced) { r.introduced = this.today; this.stats.newIntroduced++; }
    this._log({ card: cardId, type: 'learn', outcome: 'introduced', audioOk: !!(t && t.kind === 'learn' && t.heard) });
    this.onChange();
  }
  useHint() {
    const t = this.current; if (!t || t.kind !== 'question') return null;
    t.hint = true; t.hintData = t.hintData || hintFor(t.q, this.rng); return t.hintData;
  }
  audioFailed() {
    const t = this.current; if (!t) return;
    if (t.kind === 'question') t.audioFailed = true;
    this.stats.audioFail++; this._issue(t.kind === 'learn' ? t.cardId : (t.q.audioKey || t.q.cardId)); this.onChange();
  }
  audioPlayed() {
    const t = this.current; if (!t) return;
    if (t.kind === 'learn') t.heard = true;
    else { t.audioPlayedOk = true; t.audioFailed = false; }
  }
  audioRecovered() { const t = this.current; if (t && t.kind === 'question') t.audioFailed = false; }
  _issue(key) { this.p.audioIssues.push({ day: this.today, key, sample: !!this.rec(key.split('#')[0])?.sample }); }

  // answer: option index (choice) or string (spell). Returns verdict for UI.
  submit(answer) {
    const t = this.current; if (!t || t.kind !== 'question') throw new Error('no question');
    const q = t.q;
    if (q.needsSound && (t.audioFailed || !t.audioPlayedOk)) return { blocked: 'audio' };
    if (t.startMs == null) t.startMs = this.now();
    t.attempts++;
    const correct = q.type === 'spell' ? String(answer).toLowerCase() === q.target : answer === q.answer;
    const r = this.rec(q.cardId); let outcome = null;
    if (t.attempts === 1 && t.scoring) {
      outcome = !correct ? 'wrong' : t.hint ? 'hinted' : 'independent';
      // Wrong earlier today (e.g. depth 1) then right at depth 2: a recovery, not a pass.
      if (outcome === 'independent' && r.dayFail === this.today) { outcome = 'hinted'; t.recovered = true; }
      const { changed, ...next } = applyScore(r, outcome, this.today, q.depth, !!t.audioPlayedOk);
      Object.assign(r, next);
      if (outcome === 'wrong') r.dayFail = this.today;
      this.stats[outcome]++; if (t.round === 'review') this.stats.reviewed++;
    } else if (t.retry) { outcome = correct ? 'retry_success' : 'retry_wrong'; if (correct) this.stats.retried++; }
    else if (t.attempts === 1 && !correct && !t.scoring) { outcome = 'wrong'; this.stats.wrong++; r.dayFail = this.today; }
    else if (correct && t.attempts > 1) { outcome = 'retry'; this.stats.retried++; }
    else if (correct) { outcome = t.hint ? 'hinted' : 'independent'; }
    t.firstWrong = t.firstWrong || (t.attempts === 1 && !correct);
    this._log({ card: q.cardId, type: q.type, depth: q.depth, outcome: t.recovered ? 'recovered_same_day' : (outcome || (correct ? 'independent' : 'wrong')),
      attempts: t.attempts, hint: t.hint, audioOk: !t.audioFailed, scoring: t.scoring, round: t.round, ms: this.now() - t.startMs,
      correct, assist: t.audioPlayedOk ? 'audio' : 'none', retryTask: t.retry });
    if (correct) t.done = true;
    if (!correct && t.attempts === 1) t.done = true;   // answer is revealed; a spaced retry task follows
    this.onChange();
    return { correct, outcome, attempts: t.attempts, done: !!t.done };
  }
  // The child could not hear the prompt; parent skips. Not scored.
  skipNoAudio() {
    const t = this.current; if (!t) return;
    if (t.done) { this.advance(); return; }          // already answered: nothing to skip
    this.stats.skippedNoAudio++;
    this._log({ card: t.q.cardId, type: t.q.type, depth: t.q.depth, outcome: 'skipped_no_audio', scoring: false, audioOk: false, assist: 'none' });
    this.tasks.push({ ...t, attempts: 0, hint: false, hintData: null, startMs: null, audioFailed: false, scoring: false, retry: true });
    this.i++; this.onChange();
  }
  advance() {
    const t = this.current; if (!t) return null;
    if (t.kind === 'question' && t.firstWrong && !t.retry) {
      const again = this._q(t.q.cardId, t.q.depth, { retry: true, round: t.round });
      this.tasks.splice(Math.min(this.i + 4, this.tasks.length), 0, again);
    }
    this.i++; return this.current;
  }
  finish(reason) {
    if (this.ended) return this.ended;
    const ms = this.now() - this.startedAt;
    this.ended = { reason, day: this.today, ms, ...this.stats };
    return this.ended;
  }
  _log(e) {
    const rec = this.rec(e.card);
    this.p.log.push({ t: new Date(this.now()).toISOString(), day: this.today, sample: !!rec?.sample, ...e });
  }
}
