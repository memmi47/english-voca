// Question construction. Pure: all randomness through the injected rng.
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
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function clozeParts(sentence, form) {
  if (!sentence || !form) return null;
  const m = new RegExp(`(^|[^A-Za-z'])(${esc(form)})(?![A-Za-z])`, 'i').exec(sentence);
  if (!m) return null;
  const start = m.index + m[1].length;
  // Blank every other occurrence too, otherwise the answer stays visible in the sentence.
  const mask = (t) => t.replace(new RegExp(`(^|[^A-Za-z'])${esc(form)}(?![A-Za-z])`, 'gi'), (x, a) => a + '____');
  return { before: mask(sentence.slice(0, start)), word: m[2], after: mask(sentence.slice(start + m[2].length)) };
}
export const spellable = (form) => /^[a-z]{2,10}$/i.test(form);

// What depths are actually available for this card, given data on hand.
export function availableDepths(card, rec, hasArt) {
  const out = [1, 2];
  if (clozeParts(rec.context, card.form)) out.push(3);
  if (spellable(card.form)) out.push(4);
  return out;
}
// Highest usable depth <= wanted. Falls back downward, never upward.
export function resolveDepth(card, rec, wanted, hasArt) {
  const av = availableDepths(card, rec, hasArt);
  for (let d = wanted; d >= 1; d--) if (av.includes(d)) return d;
  return 1;
}

function distractors(card, pool, n, rng, usable = () => true, soundBased = false) {
  const seenM = new Set([card.meaning]); const seenF = new Set([card.form.toLowerCase()]);
  const out = [];
  for (const c of shuffle(pool, rng)) {
    if (c.id === card.id || c.lemma === card.lemma) continue;
    if (seenM.has(c.meaning) || seenF.has(c.form.toLowerCase()) || !usable(c)) continue;
    if (soundBased && c.ipa && c.ipa === card.ipa) continue; // homophones (right/write) would give two correct answers
    seenM.add(c.meaning); seenF.add(c.form.toLowerCase()); out.push(c);
    if (out.length === n) break;
  }
  return out;
}

// pool: array of normalized cards (same scene/pack first). rec: card record (context etc).
export function makeQuestion({ card, depth, pool, rec, rng, hasArt }) {
  const d = resolveDepth(card, rec, depth, hasArt);
  const base = { cardId: card.id, depth: d, form: card.form, meaning: card.meaning };
  if (d === 1) {
    if (hasArt(card)) {
      const ds = distractors(card, pool, 3, rng, hasArt, true);
      if (ds.length >= 2) {                    // fewer than 3 pictures would make the answer trivial
      const opts = shuffle([card, ...ds], rng).map((c) => ({ cardId: c.id, kind: 'art' }));
      return { ...base, type: 'sound-pic', audioKey: card.id, autoAudio: true, needsSound: true, options: opts,
        answer: opts.findIndex((o) => o.cardId === card.id) };
      }
    }
    const ds = distractors(card, pool, 3, rng, () => true, true);
    const opts = shuffle([card, ...ds], rng).map((c) => ({ cardId: c.id, kind: 'text', label: c.meaning }));
    return { ...base, type: 'sound-meaning', audioKey: card.id, autoAudio: true, needsSound: true, options: opts,
      answer: opts.findIndex((o) => o.cardId === card.id) };
  }
  if (d === 2) {
    const ds = distractors(card, pool, 3, rng);
    const opts = shuffle([card, ...ds], rng).map((c) => ({ cardId: c.id, kind: 'text', label: c.meaning }));
    return { ...base, type: 'word-meaning', audioKey: card.id, autoAudio: true, needsSound: false, options: opts,
      answer: opts.findIndex((o) => o.cardId === card.id) };
  }
  if (d === 3) {
    const parts = clozeParts(rec.context, card.form);
    const ds = distractors(card, pool, 2, rng);
    const opts = shuffle([card, ...ds], rng).map((c) => ({ cardId: c.id, kind: 'word', label: c.form }));
    return { ...base, type: 'cloze', parts, sentenceKey: card.id + '#s', audioKey: null, autoAudio: false,
      needsSound: false, options: opts, answer: opts.findIndex((o) => o.cardId === card.id) };
  }
  const letters = card.form.toLowerCase().split('');
  const extra = shuffle('etaoinsrhl'.split('').filter((l) => !letters.includes(l)), rng).slice(0, letters.length > 3 ? 2 : 1);
  const tiles = shuffle([...letters, ...extra].map((ch, i) => ({ ch, i })), rng);
  return { ...base, type: 'spell', audioKey: card.id, autoAudio: true, needsSound: true, target: card.form.toLowerCase(), tiles,
    options: [], answer: -1 };
}

// Hint: drop two wrong options (choice types) or reveal the first letter (spell).
export function hintFor(q, rng) {
  if (q.type === 'spell') return { reveal: 1 };
  const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answer);
  return { hide: shuffle(wrong, rng).slice(0, Math.max(1, wrong.length - 1 > 1 ? 2 : 1)) };
}
