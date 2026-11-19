// Playhouse minigames (docs/MINIGAMES.md). Pure play: no word, star, gauge or key is touched; a win stamps the postcard.
// Top: placement and levels (pure, tested in tests/cards.test.mjs). Bottom: the games themselves (DOM, mounted by main.js).
// No logical assignment (||=, ??=): older iPad Safari (cards/js/compat.js).

export const GAME_NAMES = { memory: '그림 짝 맞추기', mail: '우체통에 편지 넣기', whack: '박쥐 톡', shell: '우체통 섞기',
  updown: '몇 번지일까', simon: '우체통 노래', quick: '빨리 뽑기', order: '1부터 차례로' };
export const GAME_TYPES = Object.keys(GAME_NAMES);
// The first worlds of the first continent bring the games in, two at a time (each starts at level 1 there).
export const DEBUT = [['memory', 'mail'], ['whack', 'shell'], ['updown', 'simon'], ['quick', 'order']];

// Level tables (1-5). Numbers are first guesses, to be tuned after the children play [docs/MINIGAMES.md 4.2].
export const LEVELS = {
  memory: [{ pairs: 3, cols: 3, preview: 2000, hide: 800 }, { pairs: 4, cols: 4, preview: 0, hide: 800 }, { pairs: 6, cols: 4, preview: 0, hide: 500 },
    { pairs: 8, cols: 4, preview: 0, hide: 500 }, { pairs: 10, cols: 5, preview: 0, hide: 500, flips: 30 }],
  mail: [{ boxes: [900], zone: 26, goal: 3 }, { boxes: [600], zone: 20, goal: 5 }, { boxes: [900, 620], zone: 22, goal: 2 },
    { boxes: [900, 620], zone: 34, goal: 3, together: true }, { boxes: [900, 650, 470], zone: 44, goal: 3, together: true, turn: true }],
  whack: [{ holes: 4, show: 1200, goal: 8, courier: 0, at: 1 }, { holes: 6, show: 1000, goal: 10, courier: 0.15, at: 1 }, { holes: 9, show: 800, goal: 12, courier: 0.3, at: 1 },
    { holes: 9, show: 700, goal: 15, courier: 0.3, at: 2, gold: 0.15 }, { holes: 12, show: 600, goal: 18, courier: 0.3, at: 3, gold: 0.15, sleepy: 0.15 }],
  shell: [{ boxes: 3, swaps: 3, ms: 700, letters: 1 }, { boxes: 3, swaps: 5, ms: 500, letters: 1 }, { boxes: 4, swaps: 6, ms: 380, letters: 1 },
    { boxes: 4, swaps: 8, ms: 320, letters: 2 }, { boxes: 5, swaps: 10, ms: 260, letters: 2 }],
  updown: [{ max: 20, tries: 6 }, { max: 50, tries: 7 }, { max: 100, tries: 8 }, { max: 100, tries: 7 }, { max: 200, tries: 8 }],
  simon: [{ boxes: 4, from: 3, to: 5, ms: 700, retry: true }, { boxes: 4, from: 3, to: 7, ms: 550, retry: true }, { boxes: 4, from: 4, to: 9, ms: 420 },
    { boxes: 6, from: 4, to: 9, ms: 550 }, { boxes: 6, from: 5, to: 11, ms: 420 }],
  quick: [{ rounds: 3, need: 2, window: 1200, fakes: 0 }, { rounds: 5, need: 3, window: 1000, fakes: 1 }, { rounds: 5, need: 4, window: 800, fakes: 2 },
    { rounds: 7, need: 5, window: 700, fakes: 3 }, { rounds: 7, need: 6, window: 600, fakes: 4, twitch: true }],
  order: [{ n: 9, time: 0, hide: true }, { n: 16, time: 0, hide: true }, { n: 16, time: 40, hide: true }, { n: 25, time: 60, hide: true }, { n: 25, time: 60, hide: false, mix: true }],
};
export const levelOf = (type, level) => LEVELS[type][Math.max(1, Math.min(5, level)) - 1];

// Which game each playhouse holds, and its base level. Worlds in order; the base level comes from the continent and the
// world's place in it (first continent: 1 then 2, second: 2 then 3, later: 4). A game met for the first time is level 1.
// Later worlds take the least used games, apart from games they were already paired with, never a game of the world just
// before. Deterministic: same file, same plan.
export function gamePlan(ix) {
  const out = {}, used = {}, last = {}, pairs = {}; let prev = [], wi = 0; const pk = (a, b) => [a, b].sort().join('|');
  ix.continents.forEach((c, ci) => c.worlds.forEach((w, j) => {
    const half = j < c.worlds.length / 2; const base = ci === 0 ? (half ? 1 : 2) : ci === 1 ? (half ? 2 : 3) : 4;
    const nodes = w.map.nodes.filter((n) => n.kind === 'minigame'); out[w.id] = {};
    let picks = wi < DEBUT.length ? DEBUT[wi].slice() : [];
    while (picks.length < nodes.length) {
      const together = (t) => picks.reduce((n, q) => n + (pairs[pk(q, t)] || 0), 0);   // games already met side by side are kept apart
      const cand = GAME_TYPES.filter((t) => !picks.includes(t) && !prev.includes(t)).sort((a, b) => (used[a] || 0) - (used[b] || 0) || together(a) - together(b) || (last[a] ?? -1) - (last[b] ?? -1) || GAME_TYPES.indexOf(a) - GAME_TYPES.indexOf(b));
      picks.push(cand[0] || GAME_TYPES.find((t) => !picks.includes(t)) || GAME_TYPES[0]);
    }
    nodes.forEach((n, k) => { const type = picks[k]; out[w.id][n.id] = { type, base: used[type] ? base : 1 }; used[type] = (used[type] || 0) + 1; last[type] = wi; });
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) pairs[pk(picks[i], picks[j])] = (pairs[pk(picks[i], picks[j])] || 0) + 1;
    prev = picks.slice(0, nodes.length); wi++;
  }));
  return out;
}
// The level to play: base, +1 as a challenge once the playhouse is stamped (5 at most), -1 after two failures in a row.
export const playLevel = (base, { stamped = false, fails = 0 } = {}) => Math.max(1, Math.min(5, base + (stamped ? 1 : 0) - (fails >= 2 ? 1 : 0)));

// ---- small pure helpers (tested) ----
// Shell game: `n` swaps of two different slots.
export function shellSwaps(boxes, n, rng) { const out = []; for (let k = 0; k < n; k++) { const a = Math.floor(rng() * boxes); let b = Math.floor(rng() * (boxes - 1)); if (b >= a) b++; out.push([a, b]); } return out; }
// Where box `start` ends after the swaps (slots exchange their boxes).
export function shellFollow(start, swaps) { let at = start; for (const [a, b] of swaps) { if (at === a) at = b; else if (at === b) at = a; } return at; }
// Up-down: -1 = the house is lower, 1 = higher, 0 = found.
export const updownHint = (target, guess) => (guess === target ? 0 : guess < target ? 1 : -1);
// Mail: a box position (percent of the track) at time t (ms); dir flips change the phase direction (level 5).
export const mailPos = (phase) => 50 + 38 * Math.sin(phase);
export const inZone = (pos, zone) => Math.abs(pos - 50) <= zone / 2;

// ---- the games (DOM) ----
// ctx: { root, level, rng, fast, sfx(name), tone(i), pic(i) -> html, spr(id, px) -> html, mbox(px) -> the mailbox picture, win(), fail(), status(text), hint(text) }
// Each mount returns { stop(), peek() }: stop() cancels timers; peek() tells tests the answer (never shown on screen).
const wait = (ctx, ms) => (ctx.fast ? Math.min(ms, 30) : ms);

function memory(ctx) {
  const L = levelOf('memory', ctx.level); const ids = []; for (let i = 0; i < L.pairs; i++) ids.push(i, i);
  const deck = shuffleIn(ids, ctx.rng); const open = [], matched = new Set(); let busy = false, flips = 0, peekAll = L.preview > 0; let timer = null;
  const paint = () => {
    ctx.status(`${matched.size / 2} / ${L.pairs}쌍${L.flips ? ` · 뒤집기 ${flips}/${L.flips}` : ''}`);
    ctx.root.innerHTML = `<div class="memgrid" style="--mem:${L.cols >= 5 ? 84 : L.cols === 4 ? 96 : 110}px;grid-template-columns:repeat(${L.cols},var(--mem))">${deck.map((e, i) => { const up = peekAll || matched.has(i) || open.includes(i);
      return `<button class="memcard ${matched.has(i) ? 'matched' : ''}" data-i="${i}" aria-label="${i + 1}번째 카드" ${matched.has(i) ? 'disabled' : ''}>${up ? ctx.pic(e, 60) : ctx.spr('envelope', 52)}</button>`; }).join('')}</div>`;
  };
  ctx.root.onclick = (ev) => { const b = ev.target.closest('.memcard'); if (!b || busy || peekAll) return; const i = Number(b.dataset.i); if (matched.has(i) || open.includes(i)) return;
    open.push(i); flips++; ctx.sfx('flip'); if (open.length < 2) return paint();
    const [a, c] = open; if (deck[a] === deck[c]) { matched.add(a); matched.add(c); open.length = 0; ctx.sfx('correct'); paint(); if (matched.size === deck.length) return void (timer = setTimeout(ctx.win, wait(ctx, 500))); }
    else { busy = true; paint(); timer = setTimeout(() => { open.length = 0; busy = false; paint(); }, wait(ctx, L.hide)); }
    if (L.flips && flips >= L.flips && matched.size < deck.length) timer = setTimeout(ctx.fail, wait(ctx, 600)); };
  ctx.hint(L.preview ? '잘 봐 두세요! 곧 뒤집혀요.' : '두 장씩 뒤집어 같은 그림을 찾아요.'); paint();
  if (peekAll) timer = setTimeout(() => { peekAll = false; ctx.hint('두 장씩 뒤집어 같은 그림을 찾아요.'); paint(); }, wait(ctx, L.preview));
  return { stop() { clearTimeout(timer); }, peek: () => ({ deck: deck.slice(), matched: [...matched], open: open.slice(), busy, preview: peekAll }) };
}

function mail(ctx) {
  const L = levelOf('mail', ctx.level); const n = L.boxes.length; const done = L.boxes.map(() => 0); let hits = 0, raf = 0, t0 = performance.now(), prevT = t0;
  const phase = L.boxes.map((_, i) => i * 1.7), dir = L.boxes.map(() => 1); let nextTurn = t0 + 3500;
  const goalText = () => (L.together ? `${hits} / ${L.goal}번` : n === 1 ? `${done[0]} / ${L.goal}통` : done.map((d, i) => `${i + 1}번 통 ${d}/${L.goal}`).join(' · '));
  ctx.root.innerHTML = `<div class="mailtrack ${n > 1 ? 'multi' : ''}" style="height:${70 + 92 * n}px"><div class="mailzone" style="left:${50 - L.zone / 2}%;width:${L.zone}%"></div>
    ${L.boxes.map((_, i) => `<div class="mailbox mover" data-k="${i}" style="top:${8 + i * 92}px">${ctx.mbox(96)}<b class="mail-n">${n > 1 ? i + 1 : ''}</b></div>`).join('')}</div>
    <button class="go" data-mail="1">${ctx.spr('envelope', 40)} 넣기!</button>`;
  const boxes = [...ctx.root.querySelectorAll('.mover')];
  const pos = () => phase.map(mailPos);
  const tick = (t) => { const dt = t - prevT; prevT = t; L.boxes.forEach((p, i) => { phase[i] += dir[i] * dt / (ctx.fast ? p / 10 : p); });
    if (L.turn && t > nextTurn) { dir[n - 1] *= -1; nextTurn = t + 2500 + ctx.rng() * 2500; }
    const ps = pos(); boxes.forEach((b, i) => { b.style.left = ps[i] + '%'; }); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick); ctx.status(goalText());
  ctx.hint(L.together ? `우체통 ${n}개가 모두 노란 칸에 함께 있을 때 눌러요. 한꺼번에 쏙!` : n > 1 ? '노란 칸에 와 있는 우체통에 편지가 들어가요. 모든 통에 넣어요.' : '우체통이 노란 칸에 왔을 때 눌러요. 틀려도 괜찮아요.');
  ctx.root.onclick = (ev) => { if (!ev.target.closest('[data-mail]')) return; const ps = pos(); const ins = ps.map((p) => inZone(p, L.zone));
    if (L.together) { if (ins.every(Boolean)) { hits++; ctx.sfx('mail'); ctx.hint('한꺼번에 쏙! 잘했어요.'); } else { ctx.sfx('retry'); ctx.hint(`${ins.filter(Boolean).length}개만 칸에 있었어요. 모두 모일 때를 기다려요.`); } }
    else { let got = false; ins.forEach((y, i) => { if (y && done[i] < L.goal) { done[i]++; got = true; } }); if (got) { ctx.sfx('mail'); ctx.hint('쏙! 잘 넣었어요.'); } else { ctx.sfx('retry'); ctx.hint('조금만 더 기다렸다가 눌러요.'); } }
    ctx.status(goalText()); if (L.together ? hits >= L.goal : done.every((d) => d >= L.goal)) { cancelAnimationFrame(raf); ctx.win(); } };
  return { stop() { cancelAnimationFrame(raf); }, peek: () => ({ pos: pos(), zone: L.zone, together: !!L.together }) };
}

function whack(ctx) {
  const L = levelOf('whack', ctx.level); const show = ctx.fast ? 400 : L.show; const cols = L.holes <= 4 ? 2 : L.holes <= 6 ? 3 : L.holes <= 9 ? 3 : 4; const end = Date.now() + (ctx.fast ? 8000 : 30000);
  let score = 0; const up = new Map(); const timers = []; let over = false;
  ctx.root.innerHTML = `<div class="whack" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: L.holes }, (_, i) => `<button class="hole" data-h="${i}" aria-label="${i + 1}번 우체통">${ctx.mbox(84)}<span class="pop"></span></button>`).join('')}</div>`;
  const holes = [...ctx.root.querySelectorAll('.hole')];
  const status = () => ctx.status(`${score} / ${L.goal}마리 · ${Math.max(0, Math.ceil((end - Date.now()) / 1000))}초`);
  const hide = (h) => { up.delete(h); holes[h].classList.remove('up'); holes[h].querySelector('.pop').innerHTML = ''; };
  const spawn = () => { if (over) return; const free = holes.map((_, i) => i).filter((i) => !up.has(i)); const k = Math.min(L.at, free.length);
    for (let j = 0; j < k; j++) { const h = free.splice(Math.floor(ctx.rng() * free.length), 1)[0]; const r = ctx.rng();
      const kind = r < L.courier ? 'courier' : r < L.courier + (L.gold || 0) ? 'gold' : r < L.courier + (L.gold || 0) + (L.sleepy || 0) ? 'sleepy' : 'bat';
      up.set(h, kind); holes[h].classList.add('up'); holes[h].querySelector('.pop').innerHTML = kind === 'courier' ? ctx.spr('courier-teal-wave', 64) : `<span class="bat ${kind}">${ctx.spr(kind === 'sleepy' ? 'bat-b' : 'bat-a', 64)}</span>`;
      timers.push(setTimeout(() => { if (up.get(h) === kind) hide(h); }, show)); }
    timers.push(setTimeout(spawn, show * 0.9)); };
  const clock = setInterval(() => { status(); if (Date.now() >= end && !over) { over = true; score >= L.goal ? ctx.win() : ctx.fail(); } }, 250);
  ctx.root.onclick = (ev) => { const b = ev.target.closest('.hole'); if (!b || over) return; const h = Number(b.dataset.h); const kind = up.get(h); if (!kind) return;
    hide(h); if (kind === 'courier' || kind === 'sleepy') { score = Math.max(0, score - 1); ctx.sfx('retry'); ctx.hint(kind === 'courier' ? '앗, 배달부예요! 박쥐만 눌러요.' : '잠든 박쥐를 깨웠어요!'); }
    else { score += kind === 'gold' ? 2 : 1; ctx.sfx('hit'); }
    status(); if (score >= L.goal && !over) { over = true; ctx.win(); } };
  ctx.hint(L.courier ? '박쥐만 톡! 배달부는 누르면 안 돼요.' : '튀어나온 박쥐를 톡 눌러요.'); status(); spawn();
  return { stop() { over = true; clearInterval(clock); timers.forEach(clearTimeout); }, peek: () => ({ up: [...up.entries()], score, goal: L.goal }) };
}

function shell(ctx) {
  const L = levelOf('shell', ctx.level); let round = 0, wins = 0, phase = 'show', swaps = [], letters = [], picked = [], slotOf = []; const timers = [];
  const W = 100 / L.boxes;
  const draw = () => { ctx.root.innerHTML = `<div class="shells" style="height:170px">${Array.from({ length: L.boxes }, (_, b) => `<button class="shellbox" data-b="${b}" style="left:${(slotOf[b] + 0.5) * W}%">${ctx.mbox(104)}<span class="shell-letter" ${letters.includes(b) && phase !== 'swap' && phase !== 'pick' ? '' : 'hidden'}>${ctx.spr('envelope', 36)}</span></button>`).join('')}</div>`; };
  const start = () => { phase = 'show'; picked = []; slotOf = Array.from({ length: L.boxes }, (_, i) => i); letters = shuffleIn(slotOf.slice(), ctx.rng).slice(0, L.letters); swaps = shellSwaps(L.boxes, L.swaps, ctx.rng);
    ctx.status(`${round + 1}판 / 3판 · 맞힌 판 ${wins}`); ctx.hint(L.letters > 1 ? '편지 두 통이 든 우체통을 잘 보세요!' : '편지가 든 우체통을 잘 보세요!'); draw();
    timers.push(setTimeout(() => { phase = 'swap'; draw(); ctx.hint('섞어요…'); let k = 0;
      const step = () => { if (k >= swaps.length) { phase = 'pick'; ctx.hint(L.letters > 1 ? '편지가 든 우체통 두 개를 눌러요.' : '편지가 든 우체통을 눌러요.'); return; }
        const [a, c] = swaps[k++]; const ba = slotOf.indexOf(a), bc = slotOf.indexOf(c); slotOf[ba] = c; slotOf[bc] = a;
        const ea = ctx.root.querySelector(`[data-b="${ba}"]`), ec = ctx.root.querySelector(`[data-b="${bc}"]`);
        if (ea && ec) { ea.style.transition = ec.style.transition = `left ${wait(ctx, L.ms)}ms ease-in-out, transform ${wait(ctx, L.ms)}ms`; ea.style.left = `${(c + 0.5) * W}%`; ec.style.left = `${(a + 0.5) * W}%`;
          ea.style.transform = 'translate(-50%,-14px)'; ec.style.transform = 'translate(-50%,14px)'; timers.push(setTimeout(() => { ea.style.transform = ec.style.transform = 'translate(-50%,0)'; }, wait(ctx, L.ms))); }
        ctx.sfx('tap'); timers.push(setTimeout(step, wait(ctx, L.ms + 60))); };
      step(); }, wait(ctx, 1200))); };
  ctx.root.onclick = (ev) => { const b = ev.target.closest('.shellbox'); if (!b || phase !== 'pick') return; const box = Number(b.dataset.b); if (picked.includes(box)) return; picked.push(box);
    b.classList.add('picked'); if (picked.length < L.letters) return;
    phase = 'reveal'; const ok = picked.every((x) => letters.includes(x)); if (ok) wins++; ctx.sfx(ok ? 'correct' : 'retry');
    draw(); ctx.root.querySelectorAll('.shellbox').forEach((e) => { const bx = Number(e.dataset.b); e.classList.toggle('picked', picked.includes(bx)); e.querySelector('.shell-letter').hidden = !letters.includes(bx); });
    ctx.hint(ok ? '찾았어요!' : '아쉬워요, 여기 있었어요.'); round++;
    timers.push(setTimeout(() => { if (wins >= 2) return ctx.win(); if (round - wins >= 2) return ctx.fail(); start(); }, wait(ctx, 1200))); };
  start();
  return { stop() { timers.forEach(clearTimeout); }, peek: () => ({ phase, letters: letters.slice(), slotOf: slotOf.slice() }) };
}

function updown(ctx) {
  const L = levelOf('updown', ctx.level); const target = 1 + Math.floor(ctx.rng() * L.max); let lo = 1, hi = L.max, left = L.tries, typed = '', over = false;
  const paint = () => { ctx.status(`남은 기회 ${left}번`);
    ctx.root.innerHTML = `<div class="street"><div class="street-bar"><i style="left:${(lo - 1) / L.max * 100}%;width:${(hi - lo + 1) / L.max * 100}%"></i></div><p class="street-range">${lo}번지 ~ ${hi}번지 중 한 집</p></div>
      <div class="pad-show" id="padshow">${typed || '?'}<small>번지</small></div>
      <div class="numpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '지움', 0, '확인'].map((k) => `<button data-k="${k}" class="${typeof k === 'string' ? 'padfn' : ''}">${k}</button>`).join('')}</div>`; };
  ctx.root.onclick = (ev) => { const b = ev.target.closest('[data-k]'); if (!b || over) return; const k = b.dataset.k;
    if (k === '지움') typed = typed.slice(0, -1); else if (k === '확인') { const g = Number(typed); if (!typed || g < 1 || g > L.max) { ctx.hint(`1부터 ${L.max}까지 골라요.`); return; }
      typed = ''; left--; const h = updownHint(target, g);
      if (h === 0) { over = true; ctx.sfx('correct'); ctx.hint(`${g}번지! 찾았어요.`); paint(); return void setTimeout(ctx.win, wait(ctx, 600)); }
      if (h > 0) lo = Math.max(lo, g + 1); else hi = Math.min(hi, g - 1); ctx.sfx('tap');
      ctx.hint(h > 0 ? `${g}번지보다 더 큰 번지예요 ▶` : `◀ ${g}번지보다 더 작은 번지예요`);
      if (left <= 0) { over = true; paint(); ctx.hint(`정답은 ${target}번지였어요.`); return void setTimeout(ctx.fail, wait(ctx, 1200)); } }
    else if (typed.length < String(L.max).length) typed += k;
    paint(); };
  ctx.hint(`1번지부터 ${L.max}번지 중 편지 받을 집을 찾아요. 이웃이 크다·작다를 알려 줘요.`); paint();
  return { stop() {}, peek: () => ({ target, lo, hi, left }) };
}

const SIMON_COLORS = ['#cc6651', '#387d74', '#eab65c', '#7d6bb0', '#5b8fd1', '#8fb85a'];
function simon(ctx) {
  const L = levelOf('simon', ctx.level); const seq = []; while (seq.length < L.from) seq.push(Math.floor(ctx.rng() * L.boxes));
  let pos = 0, phase = 'show', retried = false; const timers = [];
  ctx.root.innerHTML = `<div class="simon" style="grid-template-columns:repeat(${L.boxes > 4 ? 3 : 2},1fr)">${Array.from({ length: L.boxes }, (_, i) => `<button class="sbox" data-s="${i}" style="--c:${SIMON_COLORS[i]}" aria-label="${i + 1}번 우체통">${ctx.mbox(80)}</button>`).join('')}</div>`;
  const boxes = [...ctx.root.querySelectorAll('.sbox')];
  const flash = (i, ms) => { boxes[i].classList.add('lit'); ctx.tone(i); timers.push(setTimeout(() => boxes[i].classList.remove('lit'), wait(ctx, ms * 0.7))); };
  const play = () => { phase = 'show'; pos = 0; ctx.status(`${seq.length}개 순서 · 목표 ${L.to}개`); ctx.hint('잘 듣고 보세요…'); let k = 0;
    const step = () => { if (k >= seq.length) { phase = 'input'; ctx.hint('같은 순서로 눌러요.'); return; } flash(seq[k++], L.ms); timers.push(setTimeout(step, wait(ctx, L.ms))); };
    timers.push(setTimeout(step, wait(ctx, 700))); };
  ctx.root.onclick = (ev) => { const b = ev.target.closest('.sbox'); if (!b || phase !== 'input') return; const i = Number(b.dataset.s); flash(i, 300);
    if (i !== seq[pos]) { if (L.retry && !retried) { retried = true; ctx.sfx('retry'); ctx.hint('한 번 더 들려줄게요.'); return play(); } phase = 'over'; ctx.sfx('miss'); ctx.hint('순서가 달랐어요.'); return void timers.push(setTimeout(ctx.fail, wait(ctx, 900))); }
    pos++; if (pos < seq.length) return;
    if (seq.length >= L.to) { phase = 'over'; ctx.sfx('correct'); return void timers.push(setTimeout(ctx.win, wait(ctx, 500))); }
    ctx.sfx('correct'); seq.push(Math.floor(ctx.rng() * L.boxes)); timers.push(setTimeout(play, wait(ctx, 500))); };
  play();
  return { stop() { timers.forEach(clearTimeout); }, peek: () => ({ seq: seq.slice(), pos, phase }) };
}

function quick(ctx) {
  const L = levelOf('quick', ctx.level); let round = 0, wins = 0, phase = 'wait', signalAt = 0; const timers = [];
  const fakeRounds = new Set(shuffleIn(Array.from({ length: L.rounds }, (_, i) => i), ctx.rng).slice(0, L.fakes));
  ctx.root.innerHTML = `<button class="quick" id="quickbtn"><span class="quick-bat">${ctx.spr('bat-a', 72)}</span><b id="quicksay">준비…</b></button>`;
  const btn = ctx.root.querySelector('#quickbtn'), say = ctx.root.querySelector('#quicksay');
  const set = (cls, text) => { btn.className = 'quick q-' + cls; say.textContent = text; };
  const next = () => { if (wins >= L.need) return ctx.win(); if (round - wins > L.rounds - L.need) return ctx.fail(); if (round >= L.rounds) return wins >= L.need ? ctx.win() : ctx.fail();
    phase = 'wait'; set('wait', '준비…'); ctx.status(`${round + 1}판 / ${L.rounds}판 · 성공 ${wins} (목표 ${L.need})`);
    const delay = 1200 + ctx.rng() * 1800;
    if (fakeRounds.has(round)) timers.push(setTimeout(() => { if (phase === 'wait') { set('fake', '잠깐!'); timers.push(setTimeout(() => { if (phase === 'wait') set('wait', '준비…'); }, wait(ctx, 500))); } }, wait(ctx, delay * 0.5)));
    if (L.twitch) timers.push(setTimeout(() => { if (phase === 'wait') btn.classList.add('q-twitch'); }, wait(ctx, delay * 0.8)));
    timers.push(setTimeout(() => { if (phase !== 'wait') return; phase = 'go'; signalAt = performance.now(); set('go', '지금!'); ctx.sfx('gate');
      timers.push(setTimeout(() => { if (phase !== 'go') return; phase = 'done'; set('late', '늦었어요'); round++; timers.push(setTimeout(next, wait(ctx, 900))); }, ctx.fast ? 2000 : L.window)); }, wait(ctx, delay))); };
  btn.onclick = () => { if (phase === 'go') { phase = 'done'; const ms = Math.round(performance.now() - signalAt); wins++; round++; ctx.sfx('hit'); set('ok', `${ms / 1000}초!`); timers.push(setTimeout(next, wait(ctx, 900))); }
    else if (phase === 'wait') { phase = 'done'; round++; ctx.sfx('retry'); set('early', '너무 빨랐어요'); timers.push(setTimeout(next, wait(ctx, 900))); } };
  ctx.hint('"지금!"이 뜨면 바로 눌러요. "잠깐!"이나 준비 중에 누르면 그 판은 실패예요.'); next();
  return { stop() { timers.forEach(clearTimeout); }, peek: () => ({ phase, round, wins }) };
}

function order(ctx) {
  const L = levelOf('order', ctx.level); const nums = shuffleIn(Array.from({ length: L.n }, (_, i) => i + 1), ctx.rng); let want = 1, over = false; const t0 = Date.now(); let clock = 0;
  const cols = Math.round(Math.sqrt(L.n));
  ctx.root.innerHTML = `<div class="ordergrid" style="grid-template-columns:repeat(${cols},1fr)">${nums.map((v) => `<button class="ord" data-v="${v}" style="${L.mix ? `font-size:${18 + Math.floor(ctx.rng() * 18)}px;color:${SIMON_COLORS[Math.floor(ctx.rng() * 4)]}` : ''}">${v}</button>`).join('')}</div>`;
  const status = () => ctx.status(`다음: ${want}${L.time ? ` · ${Math.max(0, L.time - Math.floor((Date.now() - t0) / 1000))}초` : ` · ${Math.floor((Date.now() - t0) / 1000)}초`}`);
  clock = setInterval(() => { status(); if (L.time && !over && Date.now() - t0 >= (ctx.fast ? 3000 : L.time * 1000)) { over = true; clearInterval(clock); ctx.fail(); } }, 250);
  ctx.root.onclick = (ev) => { const b = ev.target.closest('.ord'); if (!b || over) return; const v = Number(b.dataset.v);
    if (v !== want) { ctx.sfx('retry'); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 300); return; }
    ctx.sfx('tap'); if (L.hide) b.classList.add('gone'); want++; status();
    if (want > L.n) { over = true; clearInterval(clock); ctx.hint(`${((Date.now() - t0) / 1000).toFixed(1)}초 만에 다 찾았어요!`); setTimeout(ctx.win, wait(ctx, 600)); } };
  ctx.hint(`1부터 ${L.n}까지 차례로 눌러요.`); status();
  return { stop() { over = true; clearInterval(clock); }, peek: () => ({ want, n: L.n }) };
}

const GAMES = { memory, mail, whack, shell, updown, simon, quick, order };
export function mountGame(type, ctx) { const g = GAMES[type]; if (!g) throw new Error('unknown game ' + type); return g(ctx); }

function shuffleIn(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
