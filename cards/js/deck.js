// Flashcard deck rules. Pure: no DOM, no storage, no clock (today / now / rng are injected).
//
// A word moves through:  new -> likely (said "know" at first sight)  -> done
//                        new -> learn (did not know)  -> review step 0..4 -> done
// Review gaps are 1, 3, 7, 14, 30 days. "likely" words are only checked twice (7 and 30 days later).
// From the 7-day step on, a review is always a check card (pick the meaning), never self-judgement.
// Tile triage (map.TRIAGE): words the child did not mark on the tile's word list are "passed": silver with no date,
// tagged with the tile's bunch. A few of them are checked at once (role 'spot'); the bunch is sampled again later (role 'audit').
export const INTERVALS = [1, 3, 7, 14, 30];
export const LIKELY_DAYS = [7, 30];
export const CFG = {
  newPerRun: 7,        // new words drawn into one run
  reviewPerRun: 14,    // due cards drawn into one run
  bossHp: 12,        // about one boss per short run
  lapse: 'reset',      // 'reset': a missed review goes back to step 0 (current rule) | 'stepback': one step down
  retryPerRun: 4,      // words still to learn that belong to other tiles: this many come back per run
  dueOrder: 'recent',  // which due cards a run takes first: 'recent' (latest due date; the bat test takes the oldest) | 'oldest' | 'mixed' (alternating)
  logCap: 5000,
  posOption: true,     // meaning cards: fill remaining wrong answers from the exact part of speech (pool size 5+); false = T-006
  themeOption: true,   // meaning cards: one wrong answer comes from the same theme and part of speech (when 5+ such cards exist); false = as before
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

export const SCHEMA = 3;                                // format of a saved record; upgrades live in store.js
export function newState(id) { return { v: SCHEMA, id, words: {}, verify: [], runs: [], log: [], bunches: {}, forms: {} }; }
// Passed words of a bunch that are still passed (not checked into learning or reviews since).
export const bunchLeft = (state, b) => Object.keys(state.words).filter((id) => { const r = state.words[id]; return r.st === 'likely' && r.due == null && r.bunch === b; });

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
// scope (optional, from the map): { newIds: only these words may be new, newPerRun, duePerRun, noNew, retryPerRun }
// `retries`: words that were not learned (state "learn") and belong to no tile of this run. Without them a word that
// failed its last check, or a castle or bat card, would never come back once its tile is cleared.
export function planRun(state, words, today, cfg = CFG, scope = {}) {
  const only = scope.newIds ? new Set(scope.newIds) : null; const due = [], retry = [], stray = [], fresh = [];
  for (const w of words) {
    const r = state.words[w.id];
    if (!r) { if (!only || only.has(w.id)) fresh.push(w.id); continue; }
    if (r.lastDay === today || !r.due || r.due > today) continue;      // scored at most once a day
    if (r.st === 'learn') { (!only || only.has(w.id) ? retry : stray).push(w.id); } else if (r.st === 'review' || r.st === 'likely') due.push(w.id);
  }
  const byDue = (a, b) => state.words[a].due.localeCompare(state.words[b].due);
  due.sort(byDue); stray.sort(byDue);
  const order = cfg.dueOrder || 'oldest';
  if (order === 'recent') due.reverse();
  else if (order === 'mixed') { const m = []; for (let i = 0, j = due.length - 1; i <= j; i++, j--) { m.push(due[i]); if (j > i) m.push(due[j]); } due.splice(0, due.length, ...m); }
  const newCap = scope.noNew ? 0 : scope.newPerRun ?? cfg.newPerRun, dueCap = scope.duePerRun ?? cfg.reviewPerRun;
  const news = retry.concat(fresh).slice(0, newCap); const retries = (scope.noNew ? retry.concat(stray).sort(byDue) : stray).slice(0, scope.retryPerRun ?? cfg.retryPerRun ?? 4);
  return { due: due.slice(0, dueCap), news, retries, dueLeft: Math.max(0, due.length - dueCap), newLeft: retry.length + fresh.length - news.length };
}

// A function word (track "sight") has no Korean gloss: its card plays the sound and asks for the spelling.
export const isSight = (w) => w.track === 'sight' || !w.ko;
const groupOf = (w) => (isSight(w) ? 'sight' : w.type);
const label = (w) => (isSight(w) ? w.form : w.ko);          // what an answer choice shows
// Cards a catalogue marks as confusable with each other (w.groups: ids of its confusion groups) are never offered as
// wrong answers for one another.
export const confusable = (a, b) => !!(a.groups && b.groups && a.groups.some((g) => b.groups.includes(g)));
// Per deck (the words array): id lookup and words grouped by picture type. Built once; the full deck holds thousands of words.
const INDEX = new WeakMap();
// Cards with a theme and a part of speech (theme not 기타/보완) are also grouped by "theme|pos" for the same-theme wrong answer.
const themeKey = (w) => (!isSight(w) && w.theme && w.pos && !/기타|보완/.test(w.theme) ? `${w.theme}|${w.pos}` : null);
function indexOf(words) {
  let ix = INDEX.get(words);
  if (!ix) { ix = { byId: Object.fromEntries(words.map((w) => [w.id, w])), byType: new Map(), byTheme: new Map(), byPos: new Map() }; for (const w of words) { const k = groupOf(w); let a = ix.byType.get(k); if (!a) ix.byType.set(k, (a = [])); a.push(w); const t = themeKey(w); if (t) { let b = ix.byTheme.get(t); if (!b) ix.byTheme.set(t, (b = [])); b.push(w); } if (!isSight(w) && w.pos) { let p = ix.byPos.get(w.pos); if (!p) ix.byPos.set(w.pos, (p = [])); p.push(w); } } INDEX.set(words, ix); }
  return ix;
}

export class Run {
  // scope: see planRun; scope.castle = [ids] makes a check-only run over those words. items: { shield, flame } for this run only.
  // scope.triage = { bunch, passed, tapped, spot, due }: the tile's word list was looked over (map.triageScope). Passed words
  // that are not spot-checked are recorded right here; spot cards go first; tapped words are taught, not asked.
  // scope.audit = { split, picks: [{ id, bunch }] }: sample checks of bunches that came due (map.auditPick), mixed in.
  constructor({ state, words, today, rng, now = () => Date.now(), cfg = CFG, boss = null, scope = {}, items = {}, tag = null }) {
    this.s = state; this.words = words; this.ix = indexOf(words); this.byId = this.ix.byId;
    this.today = today; this.rng = rng; this.now = now; this.cfg = cfg;
    this.boss = boss || { idx: 0, hp: cfg.bossHp, defeated: 0 };
    this.met = []; this.scope = scope; this.items = { shield: items.shield || 0, flame: !!items.flame }; this.shieldUsed = 0; this.tag = tag;
    this.combo = 0; this.i = 0; this.t0 = null; this.startedAt = now(); this.ended = null;
    this.stats = { cards: 0, claims: 0, verifies: 0, verifyOk: 0, fresh: 0, known: 0, unknown: 0, learned: 0, reviews: 0, reviewOk: 0, lapses: 0, bosses: 0, ms: 0, stars: 0, castleOk: 0, castleMiss: 0, testOk: 0, testMiss: 0, spots: 0, spotOk: 0, bunchOk: 0, bunchDone: 0 };
    this.changed = [];                                   // [{id, from, to}] grade changes in this run
    const tri = scope.triage; const spot = new Set(tri ? tri.spot : []); const taught = new Set(tri ? tri.tapped : []);
    if (tri) for (const id of tri.passed) if (!spot.has(id) && !state.words[id]) this._pass(id, tri);   // recorded when the run is made, before planRun sees them
    const plan = planRun(state, words, today, cfg, tri ? { ...scope, newIds: (scope.newIds || words.map((w) => w.id)).filter((id) => !spot.has(id)) } : scope); this.plan = plan;
    // A new word, then up to two due cards, so reviews space out the new words.
    const q = []; const due = plan.due.slice();
    const dueItem = (id) => { const r = state.words[id];
      return { id, role: r.st === 'likely' ? 'likely' : 'review', form: r.st === 'likely' || r.step >= 2 || isSight(this.byId[id]) ? 'check' : 'judge' }; };
    // A word that was not learned on an earlier day comes back as a check card (role 'retry'), never as self-judgement.
    // A tapped word was already called unknown: it is taught (front, then "뜻 보기" = judge(false)), never asked "know?" again.
    for (const id of plan.news) { q.push(state.words[id] ? { id, role: 'retry', form: 'check' } : taught.has(id) ? { id, role: 'new', form: 'judge', taught: true } : { id, role: 'new', form: isSight(this.byId[id]) ? 'check' : 'judge' }); for (let k = 0; k < 2 && due.length; k++) q.push(dueItem(due.shift())); }
    while (due.length) q.push(dueItem(due.shift()));
    for (const id of plan.retries) q.push({ id, role: 'retry', form: 'check' });       // stranded learning words, as check cards
    // bat test (scope.bat = { due, fresh }): overdue reviews as check cards first (normal scheduling), then words met since the last test
    if (scope.bat) { this.queue = scope.bat.due.map((id) => (state.words[id].st === 'learn' ? { id, role: 'retry', form: 'check' } : { ...dueItem(id), form: 'check' })).concat(scope.bat.fresh.map((id) => ({ id, role: 'castle', form: 'check' }))); this.plan = { due: [], news: [], dueLeft: 0, newLeft: 0 }; return; }
    if (scope.castle) { this.queue = shuffle(scope.castle, rng).map((id) => ({ id, role: 'castle', form: 'check' })); this.plan = { due: [], news: [], dueLeft: 0, newLeft: 0 }; return; }
    // Bunch samples go at random places among the run's cards; the spot checks of the tile come first of all.
    this.audits = {};
    for (const p of scope.audit ? scope.audit.picks : []) { if (!bunchLeft(state, p.bunch).includes(p.id)) continue; const a = (this.audits[p.bunch] ||= { left: 0, miss: false, closed: false }); a.left++;
      q.splice(Math.floor(rng() * (q.length + 1)), 0, { id: p.id, role: 'audit', form: 'check', bunch: p.bunch }); }
    this.queue = (tri ? tri.spot.filter((id) => !state.words[id]).map((id) => ({ id, role: 'spot', form: 'check', bunch: tri.bunch })) : []).concat(q);
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

  // Three choices: the right one and two wrong ones, of the same picture type when possible. The three always read
  // differently. Wrong ones are drawn at random (no full shuffle: the deck can be thousands of words).
  // A function word offers spellings instead of meanings, and never a word that sounds the same (for / four).
  _options(id) {
    const w = this.byId[id]; const sight = isSight(w); const out = [w]; const used = new Set([label(w)]);
    const fits = (x) => (sight ? !(w.ipa && x.ipa === w.ipa) : !isSight(x)) && !confusable(w, x);
    const take = (x) => { if (out.length < 3 && x.id !== id && fits(x) && !used.has(label(x))) { used.add(label(x)); out.push(x); } };
    const draw = (pool) => { for (let k = 0; k < 30 && out.length < 3 && pool.length; k++) take(pool[Math.floor(this.rng() * pool.length)]); };
    const tk = this.cfg.themeOption !== false ? themeKey(w) : null;
    if (tk) { const cand = this.ix.byTheme.get(tk).filter((x) => x.id !== id && fits(x) && label(x) !== label(w)); if (cand.length >= 5) take(cand[Math.floor(this.rng() * cand.length)]); }   // one wrong answer from the same theme and part of speech
    if (this.cfg.posOption !== false && !sight && w.pos) { const pool = this.ix.byPos.get(w.pos) || []; if (pool.length >= 5) draw(pool); }
    const same = this.ix.byType.get(groupOf(w)) || [];
    draw(same); if (out.length < 3) for (const x of same) take(x);          // a small group: fall back to scanning it
    draw(this.words); if (out.length < 3) for (const x of this.words) take(x);
    return shuffle(out, this.rng).map((x) => ({ id: x.id, ko: sight ? x.form : x.ko }));
  }
  _rec(id) { return this.s.words[id]; }
  // A passed word joins its tile's bunch. The bunch is made with the first word; later words keep its date.
  // If the tile's bunch was already checked (the tile was left half done for a month), the word cannot wait for a
  // sample that will never come: it gets its own 7- and 30-day checks, like a word the child called known on a card.
  _pass(id, { bunch, due }) {
    const b = (this.s.bunches ||= {});
    if (b[bunch]?.done) return this._set(id, { st: 'likely', lstep: 0, due: addDays(this.today, LIKELY_DAYS[0]) });
    b[bunch] ||= { due, done: null };
    return this._set(id, { st: 'likely', lstep: 0, due: null, bunch });
  }
  _verify(ok) { this.s.verify.push(ok); if (this.s.verify.length > 40) this.s.verify.shift(); }
  // One sample of a bunch answered. The bunch is settled when its last sample is answered (or, with a miss, when the run ends).
  _audit(it, ok) { const a = this.audits[it.bunch]; if (!a) return; a.left--; if (!ok) a.miss = true; if (a.left <= 0) this._settle(it.bunch); }
  _settle(bunch) {
    const a = this.audits[bunch]; if (!a || a.closed) return; a.closed = true; const t = this.today; const split = this.scope.audit?.split ?? 7;
    for (const id of bunchLeft(this.s, bunch)) this._set(id, a.miss ? { due: addDays(t, split) } : { st: 'done', due: null });   // split: the 7- and 30-day checks start (lstep stays 0)
    const b = (this.s.bunches ||= {}); b[bunch] = { ...(b[bunch] || {}), done: t, result: a.miss ? 'split' : 'ok' };
    this.stats.bunchDone++; if (!a.miss) this.stats.bunchOk++;
  }
  // `at` (ms from the injected clock) orders two changes of the same day when two devices' records are merged (sync.newer).
  _set(id, next) {
    const from = gradeOf(this.s.words[id]);
    this.s.words[id] = { firstDay: this.today, lapses: 0, ...this.s.words[id], ...next, lastDay: this.today, at: this.now() };
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
    else if (it.role === 'spot') { this.stats.spots++; this.stats.spotOk++; this._verify(true); g = this._pass(it.id, this.scope.triage); }   // passed after all
    else if (it.role === 'audit') this._audit(it, true);                                  // not a review: rec.reviews leaves it out
    if (it.role === 'castle') this.stats.castleOk++;
    if (this.scope.bat && (it.role === 'review' || it.role === 'likely' || it.role === 'castle' || it.role === 'retry')) this.stats.testOk++;
    if (it.role === 'new') this.met.push(it.id);
    this.combo++;
    let dmg = verified ? 3 : 1; if (this.combo >= 5) dmg++; if (this.items.flame) dmg *= 2;
    const stars = it.role === 'relearn' || it.role === 'practice' ? 0 : it.form === 'check' || verified ? 3 : 1; this.stats.stars += stars;
    return this._done(it, { ok: true, verified, dmg, grade: g, stars });
  }
  _miss(it, { said, picked }) {
    const r = this._rec(it.id); const t = this.today; let g = null;
    if (this.scope.bat && (it.role === 'review' || it.role === 'likely' || it.role === 'castle' || it.role === 'retry')) this.stats.testMiss++;
    if (it.role === 'new' || it.role === 'spot') this.met.push(it.id);
    if (said === 'wrong') { if (this.items.shield > 0) { this.items.shield--; this.shieldUsed++; } else this.combo = 0; }   // a wrong pick breaks the combo (a shield absorbs one); an honest "몰라요" does not
    if (it.role === 'spot') { this.stats.spots++; this._verify(false); }                 // a failed spot check is a failed "know" claim on a new card
    if (it.role === 'new' || it.role === 'likely' || it.role === 'retry' || it.role === 'spot') {
      if (it.role === 'new' || it.role === 'spot') { this.stats.fresh++; this.stats.unknown++; } else if (it.role === 'likely') { this.stats.reviews++; this.stats.lapses++; }
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
    } else if (it.role === 'audit') {
      g = this._set(it.id, { st: 'learn', due: addDays(t, 1) }); this._audit(it, false);   // like a failed castle card
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
    for (const [b, a] of Object.entries(this.audits || {})) if (a.miss) this._settle(b);   // left early with a miss: split now; without one the bunch waits for the next run
    const n = this.s.runs.filter((r) => r.day === this.today).length + 1;
    this.ended = { day: this.today, n, reason, tag: this.tag, shieldBack: this.items.shield, ...this.stats, wall: this.now() - this.startedAt, changed: this.changed.length, endedAt: new Date(this.now()).toISOString() };
    this.s.runs.push(this.ended);
    return this.ended;
  }
}
