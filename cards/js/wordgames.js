// The last gate of a castle (docs/MINIGAMES.md 7): a world castle ends with a hangman word, a continent castle with a small
// crossword (a run of three hangman words when no crossword can be laid). They only decide whether the castle is passed;
// a word the child could not spell gets its "not known" record (miss, misses), never a schedule or grade change.
// Top: pure rules (tested in tests/cards.test.mjs). Bottom: the screens (DOM, mounted by main.js).
// No logical assignment (||=, ??=): older iPad Safari (cards/js/compat.js).

export const HANG = { lives: 6, multiLives: 8, multiWords: 3 };
const LETTERS = /^[a-z]+$/;
// A word fit for spelling: letters only (no phrase, space or hyphen), at least `min` letters.
export const spellable = (form, min = 4) => !!form && LETTERS.test(form.toLowerCase()) && form.length >= min;
// The hangman word: 5+ letters first, else 4 (user decision 2026-11-19). `first` are the castle exam's right answers,
// `rest` other words of the world the child has met. -> word object or null
export function hangmanPick(first, rest, rng) {
  for (const pool of [first, rest]) for (const min of [5, 4]) { const c = pool.filter((w) => spellable(w.form, min)); if (c.length) return c[Math.floor(rng() * c.length)]; }
  return null;
}
// Letters guessed so far against one or more words. lives: wrong guesses allowed in all.
export class Hangman {
  constructor(words, lives = HANG.lives, reveal = 0) {
    this.words = words.map((w) => w.toLowerCase()); this.at = 0; this.lives = lives; this.wrong = []; this.right = new Set();
    for (let k = 0; k < reveal; k++) this.right.add(this.words[0][k]);    // a help after two lost games: the first letter(s)
  }
  get word() { return this.words[this.at]; }
  get shown() { return [...this.word].map((c) => (this.right.has(c) ? c : '')); }
  get solved() { return [...this.word].every((c) => this.right.has(c)); }
  get lost() { return this.wrong.length >= this.lives; }
  get over() { return this.lost || (this.solved && this.at === this.words.length - 1); }
  // -> 'hit' | 'miss' | 'again' (already tried) | 'next' (this word solved, another follows) | 'win' | 'lose'
  guess(ch) {
    ch = ch.toLowerCase(); if (this.over || this.right.has(ch) || this.wrong.includes(ch)) return 'again';
    if (this.word.includes(ch)) { this.right.add(ch); if (!this.solved) return 'hit'; if (this.at === this.words.length - 1) return 'win'; this.at++; this.right = new Set(); return 'next'; }
    this.wrong.push(ch); return this.lost ? 'lose' : 'miss';
  }
}

// A small crossword from `words` (objects with form, ko, id): `want` words that cross each other. Greedy, a few shuffles.
// -> { rows, cols, entries: [{ id, word, ko, row, col, dir: 'a'|'d', num }] } or null when fewer than `min` words fit.
export function buildCrossword(words, rng, { want = 5, min = 4, tries = 80, maxLen = 8 } = {}) {
  const cand = []; const seen = new Set();
  for (const w of words) { const f = (w.form || '').toLowerCase(); if (spellable(f, 3) && f.length <= maxLen && !seen.has(f)) { seen.add(f); cand.push({ ...w, f }); } }
  if (cand.length < min) return null;
  let best = null;
  for (let t = 0; t < tries && !(best && best.entries.length >= want); t++) {
    const order = shuffle(cand, rng).sort((a, b) => b.f.length - a.f.length + (rng() - 0.5) * 3);
    const grid = new Map(); const placed = []; const key = (r, c) => r + ',' + c;
    const fits = (f, r, c, dir) => { const dr = dir === 'd' ? 1 : 0, dc = dir === 'a' ? 1 : 0; let cross = 0;
      if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * f.length, c + dc * f.length))) return -1;     // ends stay free
      for (let i = 0; i < f.length; i++) { const rr = r + dr * i, cc = c + dc * i; const g = grid.get(key(rr, cc));
        if (g) { if (g.ch !== f[i] || g.dirs.includes(dir)) return -1; cross++; continue; }
        if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) return -1; }                 // no side-by-side letters
      return cross; };
    const put = (w, r, c, dir) => { const dr = dir === 'd' ? 1 : 0, dc = dir === 'a' ? 1 : 0;
      for (let i = 0; i < w.f.length; i++) { const k = key(r + dr * i, c + dc * i); const g = grid.get(k); if (g) g.dirs.push(dir); else grid.set(k, { ch: w.f[i], dirs: [dir] }); }
      placed.push({ w, r, c, dir }); };
    put(order[0], 0, 0, 'a');
    for (const w of order.slice(1)) { if (placed.length >= want) break; const opts = [];
      for (const p of placed) for (let i = 0; i < p.w.f.length; i++) for (let j = 0; j < w.f.length; j++) { if (p.w.f[i] !== w.f[j]) continue;
        const dir = p.dir === 'a' ? 'd' : 'a'; const r = p.dir === 'a' ? p.r - j : p.r + i, c = p.dir === 'a' ? p.c + i : p.c - j; const x = fits(w.f, r, c, dir); if (x > 0) opts.push([r, c, dir, x]); }
      if (opts.length) { const o = opts[Math.floor(rng() * opts.length)]; put(w, o[0], o[1], o[2]); } }
    if (!best || placed.length > best.placed.length) best = { placed, entries: placed };
  }
  if (!best || best.placed.length < min) return null;
  const rs = best.placed.flatMap((p) => [p.r, p.r + (p.dir === 'd' ? p.w.f.length - 1 : 0)]), cs = best.placed.flatMap((p) => [p.c, p.c + (p.dir === 'a' ? p.w.f.length - 1 : 0)]);
  const r0 = Math.min(...rs), c0 = Math.min(...cs);
  const entries = best.placed.map((p) => ({ id: p.w.id, word: p.w.f, ko: p.w.ko || '', row: p.r - r0, col: p.c - c0, dir: p.dir }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const starts = []; for (const e of entries) { const k = e.row + ',' + e.col; if (!starts.includes(k)) starts.push(k); e.num = starts.indexOf(k) + 1; }
  return { rows: Math.max(...rs) - r0 + 1, cols: Math.max(...cs) - c0 + 1, entries };
}
// Every cell of a crossword: { 'r,c': letter }
export function crossCells(cw) { const out = {}; for (const e of cw.entries) for (let i = 0; i < e.word.length; i++) out[(e.row + (e.dir === 'd' ? i : 0)) + ',' + (e.col + (e.dir === 'a' ? i : 0))] = e.word[i]; return out; }

function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

// ---- screens ----
// ctx: { root, rng, fast, spr(id, px), mbox(px), sfx(name), say(word) (plays the word), win(), lose(missedIds), style: 'A'|'B'|'C', reveal }
const KEYS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const keyboard = () => `<div class="hkeys">${KEYS.map((k) => `<button data-key="${k}">${k}</button>`).join('')}</div>`;

// The picture that comes one step closer with each wrong letter. The castles take turns: B rope bridge, A bat, C balloons
// (user 2026-11-20: mixed by stage). The last two chances shake and warn; the courier's face follows (scared, then sad or
// X eyes). ctx.courier(face, px) draws the child's courier with a face; ctx.bat(px) a flapping bat.
const BALLOON = ['#cc6651', '#eab65c', '#387d74', '#7d6bb0', '#5b8fd1', '#e89aa8'];
function danger(style, wrong, lives, ctx) {
  const k = Math.min(wrong, lives), lost = wrong >= lives, close = !lost && lives - k <= 2;
  const face = lost ? (style === 'B' ? 'hurt' : 'sad') : close ? 'scared' : '';
  const kid = (cls) => `<span class="d-kid ${cls} ${close ? 'tremble' : ''}">${ctx.courier(face, 64)}${close ? '<i class="sweat"></i>' : ''}</span>`;
  const warn = close ? `<b class="d-warn">${lives - k === 1 ? '마지막 기회!' : '조심해요!'}</b>` : '';
  const cls = `danger d-${style} ${close ? 'close' : ''} ${lost ? 'lost' : ''}`;
  if (style === 'A') {        // a bat flies in from the right, closer with each wrong letter; at the end it takes the letter away
    const left = lost ? 46 : 84 - k * (34 / lives);
    return `<div class="${cls}" data-step="${k}">${kid('a-kid')}<span class="d-letter ${lost ? 'taken' : ''}">${ctx.spr('envelope', 64)}<i class="seal"></i></span>
      <span class="d-batpic" style="left:${left}%">${ctx.bat(close || lost ? 88 : 72)}${lost ? `<span class="carried">${ctx.spr('envelope', 40)}</span>` : ''}</span>${warn}${lost ? '<b class="d-say">박쥐가 편지를 물고 날아갔어요!</b>' : ''}</div>`;
  }
  if (style === 'C') {        // the letter hangs on six balloons by strings; each wrong letter pops one and the letter sinks
    const ly = lost ? 128 : 70 + k * 9; const spots = [[60, 30], [92, 16], [124, 10], [156, 16], [188, 30], [124, 42]];
    let svg = '';
    spots.forEach(([x, y], i) => { if (i < k) { if (i === k - 1 && !lost) svg += `<g class="popped"><path d="M${x - 10} ${y}l-6 -6M${x + 10} ${y}l6 -6M${x} ${y - 12}v-8M${x - 8} ${y + 10}l-6 6M${x + 8} ${y + 10}l6 6" stroke="#233F3A" stroke-width="3"/></g>`; return; }
      svg += `<line x1="${x}" y1="${y + 16}" x2="124" y2="${ly}" stroke="#233F3A" stroke-width="2"/><g class="bln ${close ? 'wobble' : ''}" style="--d:${i * 0.15}s"><ellipse cx="${x}" cy="${y}" rx="13" ry="16" fill="${BALLOON[i]}" stroke="#233F3A" stroke-width="3"/><ellipse cx="${x - 5}" cy="${y - 6}" rx="3" ry="5" fill="#fff" opacity=".7"/><path d="M${x - 3} ${y + 17}h6l-3 4z" fill="#233F3A"/></g>`; });
    svg += `<rect x="40" y="132" width="168" height="18" rx="9" fill="#7fb7d6" stroke="#233F3A" stroke-width="3"/>${lost ? '<ellipse cx="124" cy="136" rx="30" ry="6" fill="none" stroke="#fff" stroke-width="3"/>' : ''}`;
    return `<div class="${cls}" data-step="${k}"><svg class="c-sky" viewBox="0 0 248 150" aria-hidden="true">${svg}</svg><span class="c-letter" style="top:${ly * 1.27}px">${ctx.spr('envelope', 48)}</span>${kid('c-kid')}${warn}${lost ? '<b class="d-say">퐁당! 편지가 연못에 빠졌어요</b>' : ''}</div>`;
  }
  // B: planks fall from the left; the courier steps onto the first plank still there; the last plank cracks.
  const at = lost ? lives - 1 : k; const step = 84 / lives;
  const planks = Array.from({ length: lives }, (_, i) => `<i class="plank ${i < k ? 'fall' : ''} ${close && i === lives - 1 ? 'crack' : ''}"></i>`).join('');
  return `<div class="${cls}" data-step="${k}"><div class="river"><i></i><i></i></div><i class="post l"></i><i class="post r"></i><div class="bridge">${planks}</div>
    <span class="d-courier ${close ? 'tremble' : ''}" style="left:${8 + (at + 0.5) * step}%">${ctx.courier(face, 72)}${close ? '<i class="sweat"></i>' : ''}${lost ? '<i class="splash"></i>' : ''}</span>${warn}${lost ? '<b class="d-say">퐁당! 헤엄쳐 나왔어요</b>' : ''}</div>`;
}

// words: [{ id, form, ko }]. Several words share the lives (continent fallback).
export function mountHangman(ctx, words, lives) {
  const h = new Hangman(words.map((w) => w.form), lives, ctx.reveal ? 1 : 0); const style = ctx.style || 'B'; const timers = []; let heard = false;
  // The sound is no free help (user 2026-11-20): it is offered once, only when two chances or fewer are left.
  const canHear = () => !heard && h.lives - h.wrong.length <= 2 && !h.over;
  const cur = () => words[h.at];
  const paint = (msg = '') => {
    ctx.root.innerHTML = `${danger(style, h.wrong.length, h.lives, ctx)}
      ${words.length > 1 ? `<p class="mut">단어 ${h.at + 1} / ${words.length}</p>` : ''}
      <div class="hword">${h.shown.map((c) => `<span class="hslot">${c}</span>`).join('')}</div>
      <p class="hclue">뜻: <b>${cur().ko || '?'}</b>${canHear() ? ` <button class="sec small hear-once" data-say="1">${ctx.spr('sound', 20)} 한 번만 듣기</button>` : ''}</p>
      <p class="hleft">남은 기회 <b>${h.lives - h.wrong.length}</b>${h.wrong.length ? ` · 틀린 글자 ${h.wrong.join(' ')}` : ''}</p>
      <p class="hmsg">${msg}</p>${keyboard()}`;
    for (const b of ctx.root.querySelectorAll('[data-key]')) { const k = b.dataset.key; if (h.right.has(k)) b.classList.add('hit'); if (h.wrong.includes(k)) b.classList.add('miss'); if (h.right.has(k) || h.wrong.includes(k)) b.disabled = true; }
  };
  ctx.root.onclick = (ev) => {
    if (ev.target.closest('[data-say]')) { if (!canHear()) return; heard = true; ctx.say(cur()); return paint('잘 들어 봐요.'); }
    const b = ev.target.closest('[data-key]'); if (!b || h.over) return; const before = cur(); const r = h.guess(b.dataset.key);
    if (r === 'again') return;
    ctx.sfx(r === 'miss' || r === 'lose' ? 'miss' : 'correct');
    if (r === 'next') { ctx.say(before); return paint(`${before.form}! 다음 단어예요.`); }
    if (r === 'win') { paint(`${before.form}! 편지를 지켰어요.`); ctx.say(before); return void timers.push(setTimeout(ctx.win, ctx.fast ? 30 : 1200)); }
    if (r === 'lose') { const missed = words.slice(h.at).map((w) => w.id); paint(`정답은 ${before.form}였어요.`); ctx.root.querySelector('.hword').innerHTML = [...before.form].map((c) => `<span class="hslot show">${c}</span>`).join(''); return void timers.push(setTimeout(() => ctx.lose(missed), ctx.fast ? 30 : 1800)); }
    paint();
  };
  paint(words.length > 1 ? '세 단어를 이어서 맞혀요. 기회는 함께 써요.' : '알파벳을 눌러 단어를 맞혀요.');
  return { stop() { timers.forEach(clearTimeout); }, peek: () => ({ word: h.word, at: h.at, wrong: h.wrong.slice(), style, heard }) };
}

// The continent castle's crossword: tap a clue (or a cell), type with the letter keys; "확인" checks. 3 checks in all.
export function mountCrossword(ctx, cw, checks = 3) {
  const cells = crossCells(cw); const typed = {}; let sel = 0, cur = 0, left = checks, over = false, won = false, hit = false; const timers = []; const solved = new Set();   // solved: cells checked right   // cur: the cell of the chosen word the next letter goes in
  if (ctx.reveal) for (const e of cw.entries) typed[e.row + ',' + e.col] = e.word[0];
  const cellsOf = (e) => Array.from({ length: e.word.length }, (_, i) => (e.row + (e.dir === 'd' ? i : 0)) + ',' + (e.col + (e.dir === 'a' ? i : 0)));
  const paint = (msg = '', marks = {}) => {
    const e = cw.entries[sel]; const on = new Set(cellsOf(e)); const here = cellsOf(e)[cur]; const nums = {}; for (const x of cw.entries) nums[x.row + ',' + x.col] = x.num;
    let grid = ''; for (let r = 0; r < cw.rows; r++) for (let c = 0; c < cw.cols; c++) { const k = r + ',' + c;
      grid += cells[k] ? `<button class="xcell ${on.has(k) ? 'on' : ''} ${k === here ? 'cur' : ''} ${marks[k] || (solved.has(k) ? 'ok' : '')}" data-cell="${k}">${nums[k] ? `<sup>${nums[k]}</sup>` : ''}${typed[k] || ''}</button>` : '<i class="xblank"></i>'; }
    const done = cw.entries.filter((x) => cellsOf(x).every((k) => solved.has(k))).length; const face = over && won ? 'joy' : over ? 'sad' : left === 1 ? 'scared' : '';
    ctx.root.innerHTML = `<div class="xscene"><span class="x-kid ${left === 1 && !over ? 'tremble' : ''}">${ctx.courier(face, 64)}</span><div class="xhp" aria-label="남은 단어 ${cw.entries.length - done}">${cw.entries.map((x, i) => `<i class="${i < done ? 'gone' : ''}"></i>`).join('')}</div><span class="x-guard ${hit ? 'hit' : ''} ${over && won ? 'down' : ''}">${ctx.guard(80)}</span></div>
      <div class="xwrap"><div class="xgrid" style="grid-template-columns:repeat(${cw.cols},var(--xc))">${grid}</div>
      <div class="xclues">${cw.entries.map((x, i) => `<button class="xclue ${i === sel ? 'on' : ''}" data-clue="${i}"><b>${x.num}${x.dir === 'a' ? '→' : '↓'}</b> ${x.ko || '?'} <span data-say="${i}">${ctx.spr('sound', 18)}</span></button>`).join('')}
      <p class="hleft">확인 기회 <b>${left}</b></p></div></div><p class="hmsg">${msg}</p>
      <div class="hkeys xkeys">${KEYS.map((k) => `<button data-key="${k}">${k}</button>`).join('')}<button class="padfn" data-del="1">지우기</button><button class="padfn xcheck" data-check="1">확인</button></div>`;
  };
  // Choosing a word puts the cursor on its first cell. Typing writes there and moves on, over letters already in place
  // (a crossing), so a child types the whole word from its start.
  const choose = (i) => { sel = i; cur = 0; };
  ctx.root.onclick = (ev) => { if (over) return; const t = ev.target;
    const sayEl = t.closest('[data-say]'); if (sayEl) { const x = cw.entries[Number(sayEl.dataset.say)]; return ctx.say({ id: x.id, form: x.word }); }
    const clue = t.closest('[data-clue]'); if (clue) { choose(Number(clue.dataset.clue)); return paint(); }
    const cell = t.closest('[data-cell]'); if (cell) { const k = cell.dataset.cell; if (!cellsOf(cw.entries[sel]).includes(k)) sel = cw.entries.findIndex((x) => cellsOf(x).includes(k)); cur = cellsOf(cw.entries[sel]).indexOf(k); return paint(); }
    if (t.closest('[data-del]')) { const ks = cellsOf(cw.entries[sel]); if (!typed[ks[cur]] && cur > 0) cur--; delete typed[ks[cur]]; return paint(); }
    const key = t.closest('[data-key]'); if (key) { const ks = cellsOf(cw.entries[sel]); typed[ks[cur]] = key.dataset.key; ctx.sfx('tap');
      if (cur < ks.length - 1) cur++; else { const i = cw.entries.findIndex((x) => cellsOf(x).some((c) => !typed[c])); if (i >= 0) choose(i); } return paint(); }
    if (t.closest('[data-check]')) { const all = Object.keys(cells); if (all.some((k) => !typed[k])) return paint('빈칸을 모두 채운 뒤 확인해요.');
      const marks = {}; let wrong = 0; for (const k of all) { const ok = typed[k] === cells[k]; marks[k] = ok ? 'ok' : 'bad'; if (!ok) wrong++; }
      for (const k of all) if (marks[k] === 'ok') solved.add(k); hit = true; timers.push(setTimeout(() => { hit = false; }, 600));
      if (!wrong) { over = true; won = true; ctx.sfx('correct'); paint('모두 맞혔어요! 큰 성의 문이 열려요.', marks); return void timers.push(setTimeout(ctx.win, ctx.fast ? 30 : 1500)); }
      left--; ctx.sfx('miss');
      if (left <= 0) { over = true; const missed = cw.entries.filter((x) => cellsOf(x).some((k) => typed[k] !== cells[k])).map((x) => x.id); for (const k of all) typed[k] = cells[k]; paint('정답을 보여 줄게요.', marks); return void timers.push(setTimeout(() => ctx.lose(missed), ctx.fast ? 30 : 2500)); }
      for (const k of all) if (typed[k] !== cells[k]) delete typed[k]; return paint(`틀린 칸 ${wrong}개를 지웠어요. 다시 채워요.`, marks); } };
  choose(0); paint('뜻을 보고 단어를 채워요. 칸이 겹치는 글자가 힌트예요.');
  return { stop() { timers.forEach(clearTimeout); }, peek: () => ({ cells: { ...cells }, typed: { ...typed }, sel, cur, left, entries: cw.entries.map((x) => ({ ...x })) }) };
}
