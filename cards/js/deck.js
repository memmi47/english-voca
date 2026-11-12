// Flashcard deck rules. Pure: no DOM, no storage, no clock (today / now / rng are injected).
//
// A word moves through:  new -> likely (said "know" at first sight)  -> done
//                        new -> learn (did not know)  -> review step 0..4 -> done
// Review gaps are 1, 3, 7, 14, 30 days. "likely" words are only checked twice (7 and 30 days later).
// From the 7-day step on, a review is always a check card (pick the meaning), never self-judgement.
export const INTERVALS = [1, 3, 7, 14, 30];
export const LIKELY_DAYS = [7, 30];
export const CFG = {
  newPerRun: 7,        // new words drawn into one run
  reviewPerRun: 14,    // due cards drawn into one run
  bossHp: 12,        // about one boss per short run
  lapse: 'reset',      // 'reset': a missed review goes back to step 0 (current rule) | 'stepback': one step down
  logCap: 5000,
};

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function newState(id) { return { v: 0, id, words: {}, verify: [], runs: [], log: [] }; }

// Card grade shown to the child. It is the memory state, not a separate score.
// 0 not yet / still learning, 1 bronze (learned, early reviews), 2 silver (7-day step reached, or known at first sight), 3 gold (done)
export function gradeOf(w) {
  if (!w) return 0;
  if (w.st === 'done') return 3;
  if (w.st === 'likely') return 2;
  if (w.st === 'review') return w.step >= 2 ? 2 : 1;
  return 0;
}
export function gradeCounts(state, words) {
  const c = [0, 0, 0, 0];
  for (const w of words) c[gradeOf(state.words[w.id])]++;
  return c;
}

// How often a "know" claim is checked. Starts at 1 in 3; honest children get checked less, guessers every time.
export function verifyRate(state) {
  const v = state.verify.slice(-12); const n = v.length; const acc = n ? v.filter(Boolean).length / n : 0;
  if (n >= 4 && acc < 0.75) return 1;
  if (n >= 8 && acc >= 0.9) return 1 / 6;
  return 1 / 3;
}

// What one run draws: due cards first by date, then words not seen yet in deck order.
// scope (optional, from the map): { newIds: only these words may be new, newPerRun, duePerRun, noNew }
export function planRun(state, words, today, cfg = CFG, scope = {}) {
  const only = scope.newIds ? new Set(scope.newIds) : null; const due = [], retry = [], fresh = [];
  for (const w of words) {
    const r = state.words[w.id];
    if (!r) { if (!only || only.has(w.id)) fresh.push(w.id); continue; }
    if (r.lastDay === today || !r.due || r.due > today) continue;      // scored at most once a day
    if (r.st === 'learn') { if (!only || only.has(w.id)) retry.push(w.id); } else if (r.st === 'review' || r.st === 'likely') due.push(w.id);
  }
  due.sort((a, b) => state.words[a].due.localeCompare(state.words[b].due));
  const newCap = scope.noNew ? 0 : scope.newPerRun ?? cfg.newPerRun, dueCap = scope.duePerRun ?? cfg.reviewPerRun;
  const news = retry.concat(fresh).slice(0, newCap);
  return { due: due.slice(0, dueCap), news, dueLeft: Math.max(0, due.length - dueCap), newLeft: retry.length + fresh.length - news.length };
}

export class Run {
  // scope: see planRun; scope.castle = [ids] makes a check-only run over those words. items: { shield, flame } for this run only.
  constructor({ state, words, today, rng, now = () => Date.now(), cfg = CFG, boss = null, scope = {}, items = {}, tag = null }) {
    this.s = state; this.words = words; this.byId = Object.fromEntries(words.map((w) => [w.id, w]));
    this.today = today; this.rng = rng; this.now = now; this.cfg = cfg;
    this.boss = boss || { idx: 0, hp: cfg.bossHp, defeated: 0 };
    this.met = []; this.scope = scope; this.items = { shield: items.shield || 0, flame: !!items.flame }; this.shieldUsed = 0; this.tag = tag;
    this.combo = 0; this.i = 0; this.t0 = null; this.startedAt = now(); this.ended = null;
    this.stats = { cards: 0, claims: 0, verifies: 0, verifyOk: 0, fresh: 0, known: 0, unknown: 0, learned: 0, reviews: 0, reviewOk: 0, lapses: 0, bosses: 0, ms: 0, stars: 0, castleOk: 0, castleMiss: 0, testOk: 0, testMiss: 0 };
    this.changed = [];                                   // [{id, from, to}] grade changes in this run
    const plan = planRun(state, words, today, cfg, scope); this.plan = plan;
    // A new word, then up to two due cards, so reviews space out the new words.
    const q = []; const due = plan.due.slice();
    const dueItem = (id) => { const r = state.words[id];
      return { id, role: r.st === 'likely' ? 'likely' : 'review', form: r.st === 'likely' || r.step >= 2 ? 'check' : 'judge' }; };
    // A word that was not learned on an earlier day comes back as a check card (role 'retry'), never as self-judgement.
    for (const id of plan.news) { q.push(state.words[id] ? { id, role: 'retry', form: 'check' } : { id, role: 'new', form: 'judge' }); for (let k = 0; k < 2 && due.length; k++) q.push(dueItem(due.shift())); }
    while (due.length) q.push(dueItem(due.shift()));
    // bat test (scope.bat = { due, fresh }): overdue reviews as check cards first (normal scheduling), then words met since the last test
    if (scope.bat) { this.queue = scope.bat.due.map((id) => ({ ...dueItem(id), form: 'check' })).concat(scope.bat.fresh.map((id) => ({ id, role: 'castle', form: 'check' }))); this.plan = { due: [], news: [], dueLeft: 0, newLeft: 0 }; return; }
    if (scope.castle) { this.queue = shuffle(scope.castle, rng).map((id) => ({ id, role: 'castle', form: 'check' })); this.plan = { due: [], news: [], dueLeft: 0, newLeft: 0 }; return; }
    this.queue = q;
  }
  get current() { return this.ended ? null : this.queue[this.i] || null; }
  get left() { return Math.max(0, this.queue.length - this.i); }
  word(id) { return this.byId[id]; }
  show() { this.t0 = this.now(); const it = this.current; if (it && it.form === 'check' && !it.options) it.options = this._options(it.id); return it; }

  // Self-judgement on a judge card. May turn into a check: { next: 'verify', options }.
  judge(know) {
    const it = this.current; if (!it || it.form !== 'judge' || it.verifying) throw new Error('not a judge card');
    if (!know) return this._miss(it, { said: 'dontknow' });
    if (it.role === 'new' || it.role === 'review') {   // re-appearances right after the answer was shown are not checked
      this.stats.claims++;
      if (this.rng() < verifyRate(this.s)) { it.verifying = true; it.options = this._options(it.id); return { next: 'verify', options: it.options }; }
    }
    return this._hit(it, { verified: false });
  }
  // Answer on a check card or a verification. idx = option index, or -1 for "몰라요".
  pick(idx) {
    const it = this.current; if (!it || !(it.form === 'check' || it.verifying)) throw new Error('not a check');
    if (idx === -1) return this._miss(it, { said: 'dontknow' });
    const ok = it.options[idx] && it.options[idx].id === it.id;
    if (it.verifying) { this.stats.verifies++; if (ok) this.stats.verifyOk++; this.s.verify.push(ok); if (this.s.verify.length > 40) this.s.verify.shift(); }
    return ok ? this._hit(it, { verified: true }) : this._miss(it, { said: 'wrong', picked: idx });
  }
  advance() { this.i++; return this.current; }

  _options(id) {
    const w = this.byId[id];
    const others = shuffle(this.words.filter((x) => x.id !== id && x.ko !== w.ko), this.rng);
    const same = others.filter((x) => x.type === w.type), rest = others.filter((x) => x.type !== w.type);
    return shuffle([w, ...same.concat(rest).slice(0, 2)], this.rng).map((x) => ({ id: x.id, ko: x.ko }));
  }
  _rec(id) { return this.s.words[id]; }
  _set(id, next) {
    const from = gradeOf(this.s.words[id]);
    this.s.words[id] = { firstDay: this.today, lapses: 0, ...this.s.words[id], ...next, lastDay: this.today };
    const to = gradeOf(this.s.words[id]);
    if (to !== from) this.changed.push({ id, from, to });
    return { from, to };
  }
  _hit(it, { verified }) {
    const r = this._rec(it.id); let g = null; const t = this.today;
    if (it.role === 'new') { this.stats.fresh++; this.stats.known++; g = this._set(it.id, { st: 'likely', lstep: 0, due: addDays(t, LIKELY_DAYS[0]) }); }
    else if (it.role === 'likely') { this.stats.reviews++; this.stats.reviewOk++;
      g = r.lstep >= 1 ? this._set(it.id, { st: 'done', due: null }) : this._set(it.id, { lstep: 1, due: addDays(t, LIKELY_DAYS[1]) }); }
    else if (it.role === 'review') { this.stats.reviews++; this.stats.reviewOk++;
      g = r.step >= INTERVALS.length - 1 ? this._set(it.id, { st: 'done', due: null }) : this._set(it.id, { step: r.step + 1, due: addDays(t, INTERVALS[r.step + 1]) }); }
    else if ((it.role === 'relearn' && it.final) || it.role === 'retry') { this.stats.learned++; g = this._set(it.id, { st: 'review', step: 0, due: addDays(t, INTERVALS[0]) }); }
    if (it.role === 'castle') this.stats.castleOk++;
    if (this.scope.bat && (it.role === 'review' || it.role === 'likely' || it.role === 'castle')) this.stats.testOk++;
    if (it.role === 'new') this.met.push(it.id);
    this.combo++;
    let dmg = verified ? 3 : 1; if (this.combo >= 5) dmg++; if (this.items.flame) dmg *= 2;
    const stars = it.role === 'relearn' || it.role === 'practice' ? 0 : it.form === 'check' || verified ? 3 : 1; this.stats.stars += stars;
    return this._done(it, { ok: true, verified, dmg, grade: g, stars });
  }
  _miss(it, { said, picked }) {
    const r = this._rec(it.id); const t = this.today; let g = null;
    if (this.scope.bat && (it.role === 'review' || it.role === 'likely' || it.role === 'castle')) this.stats.testMiss++;
    if (it.role === 'new') this.met.push(it.id);
    if (said === 'wrong') { if (this.items.shield > 0) { this.items.shield--; this.shieldUsed++; } else this.combo = 0; }   // a wrong pick breaks the combo (a shield absorbs one); an honest "몰라요" does not
    if (it.role === 'new' || it.role === 'likely' || it.role === 'retry') {
      if (it.role === 'new') { this.stats.fresh++; this.stats.unknown++; } else if (it.role === 'likely') { this.stats.reviews++; this.stats.lapses++; }
      g = this._set(it.id, { st: 'learn', due: addDays(t, 1), lapses: (r?.lapses || 0) + (it.role === 'likely' ? 1 : 0) });
      this._relearn(it.id);
    } else if (it.role === 'review') {
      this.stats.reviews++; this.stats.lapses++;
      const step = this.cfg.lapse === 'stepback' ? Math.max(0, r.step - 1) : 0;
      g = this._set(it.id, { st: 'review', step, due: addDays(t, 1), lapses: (r.lapses || 0) + 1 });
      this._insert(Math.min(this.i + 4, this.queue.length), { id: it.id, role: 'practice', form: 'judge' });
    } else if (it.role === 'relearn' && it.final) {
      g = this._set(it.id, { st: 'learn', due: addDays(t, 1) });         // not learned today: comes back as a new card tomorrow
    } else if (it.role === 'castle') {
      this.stats.castleMiss++; g = this._set(it.id, { st: 'learn', due: addDays(t, 1) });   // a failed exam card is not known: back as a check card tomorrow
    }
    return this._done(it, { ok: false, said, picked, dmg: 0, grade: g });
  }
  _insert(at, item) { this.queue.splice(at, 0, item); return at; }
  // A word the child did not know comes back about 3 cards later, about 5 after that, and at the end of the run.
  // The last appearance is a check card; passing it puts the word on the 1-day review.
  _relearn(id) {
    const mk = () => ({ id, role: 'relearn', form: 'judge' }); const at = [];
    at.push(this._insert(Math.min(this.i + 4, this.queue.length), mk()));
    const a2 = Math.min(at[0] + 6, this.queue.length); if (a2 - at[0] >= 3) at.push(this._insert(a2, mk()));
    const a3 = this.queue.length; if (a3 - at[at.length - 1] >= 3) at.push(this._insert(a3, mk()));
    const last = this.queue[at[at.length - 1]]; last.final = true; last.form = 'check';
  }
  _done(it, res) {
    const ms = this.t0 == null ? 0 : this.now() - this.t0; this.t0 = null;
    this.stats.cards++; this.stats.ms += ms;
    let defeated = 0;
    if (res.dmg) { this.boss.hp -= res.dmg; while (this.boss.hp <= 0) { this.boss.hp += this.cfg.bossHp; this.boss.idx++; this.boss.defeated++; this.stats.bosses++; defeated++; } }
    this.s.log.push({ t: new Date(this.now()).toISOString(), day: this.today, id: it.id, role: it.role, form: it.form, ok: res.ok,
      verified: !!res.verified, said: res.said || 'know', ms, sound: it.sound || null });
    if (this.s.log.length > this.cfg.logCap) this.s.log = this.s.log.slice(-this.cfg.logCap);
    it.done = true;
    return { ...res, next: 'reveal', word: this.byId[it.id], combo: this.combo, defeated, boss: { ...this.boss }, role: it.role, final: !!it.final };
  }
  finish(reason = 'done') {
    if (this.ended) return this.ended;
    const n = this.s.runs.filter((r) => r.day === this.today).length + 1;
    this.ended = { day: this.today, n, reason, tag: this.tag, shieldBack: this.items.shield, ...this.stats, wall: this.now() - this.startedAt, changed: this.changed.length, endedAt: new Date(this.now()).toISOString() };
    this.s.runs.push(this.ended);
    return this.ended;
  }
}
