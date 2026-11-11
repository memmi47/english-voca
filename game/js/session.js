import { effectiveDepth, nextDepth } from './srs.js';
import { makeQuestion, hintFor, shuffle } from './questions.js';
import { planToday, recordIntroduction, recordAttempt, recordSkipNoAudio } from './engine.js';

// Planning and scoring rules live in engine.js; kept under the old name for existing callers.
export const planSession = planToday;

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
    const t = this.current;
    const { newlyIntroduced } = recordIntroduction(this.p, cardId, { today: this.today, now: this.now(), heard: !!(t && t.kind === 'learn' && t.heard) });
    if (newlyIntroduced) this.stats.newIntroduced++;
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
    const res = recordAttempt(this.p, { cardId: q.cardId, type: q.type, depth: q.depth, correct, hint: t.hint,
      heard: !!t.audioPlayedOk, audioOk: !t.audioFailed, scoring: t.scoring, retry: t.retry, attempt: t.attempts,
      round: t.round, ms: this.now() - t.startMs }, { today: this.today, now: this.now() });
    const { outcome } = res;
    if (res.recovered) t.recovered = true;
    if (res.stat) this.stats[res.stat]++;
    if (res.scored && t.round === 'review') this.stats.reviewed++;
    t.firstWrong = t.firstWrong || (t.attempts === 1 && !correct);
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
    recordSkipNoAudio(this.p, { cardId: t.q.cardId, type: t.q.type, depth: t.q.depth }, { today: this.today, now: this.now() });
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
}
