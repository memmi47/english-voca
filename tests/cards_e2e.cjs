// Browser test for the flashcard prototype (cards/). Run: node tests/cards_e2e.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const PORT = 8091; const BASE = `http://localhost:${PORT}/`;
const server = spawn('python3', [path.join(__dirname, '..', 'tools', 'serve_cards.py'), '--port', String(PORT)], { stdio: 'ignore' });
const results = []; const errs = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WORDS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cards', 'data', 'words.json'), 'utf8')).words;
const KNOWN = new Set(WORDS.filter((w, i) => i % 2 === 0).map((w) => w.id));     // what this pretend child really knows

async function open(ctx, q) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + '?' + q); await page.waitForSelector('.profiles'); return page;
}
const state = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem('cards.v0.p.' + i)), id);
const cur = (page) => page.evaluate(() => { const r = window.__cards.run; const it = r && r.current; return it ? { id: it.id, form: it.form, role: it.role, verifying: !!it.verifying, ans: it.options ? it.options.findIndex((o) => o.id === it.id) : -1 } : null; });
const READY = '.act.yes:not([disabled]), .opt:not([disabled]), .tiles';
// One answer on the current card; resolves when the next card (or a verification, or the end screen) is up.
async function answer(page, sel) {
  const i0 = await page.evaluate(() => window.__cards.run.i);
  await page.click(sel);
  await page.waitForFunction((n) => { const r = window.__cards.run; return !r || r.i > n || (r.current && r.current.verifying && document.querySelector('.opt:not([disabled])')); }, i0, { timeout: 8000 });
}
// Plays the current run to the end. claim(id) = what the child says; real knowledge decides the checks.
async function play(page, claim = (id) => KNOWN.has(id)) {
  const seen = [];
  for (let g = 0; g < 300; g++) {
    await page.waitForSelector(READY, { timeout: 8000 }); if (await page.$('.tiles')) break;
    const it = await cur(page); if (!it) continue;
    if (it.form === 'check' || it.verifying) {
      const really = it.role === 'relearn' || KNOWN.has(it.id); if (!it.verifying) seen.push(it);
      await answer(page, `.opt[data-i="${really ? it.ans : (it.ans + 1) % 3}"]`);
    } else { seen.push(it); await answer(page, it.role === 'relearn' || it.role === 'practice' || claim(it.id) ? '.act.yes' : '.act.no'); }
  }
  return seen;
}

(async () => {
  for (let i = 0; i < 50; i++) { if (await fetch(BASE).then((r) => r.ok, () => false)) break; await sleep(100); }
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  let page = await open(ctx, 'today=2026-11-12&seed=5&sound=off&fast=1');

  // 1. today screen and the first card
  await page.click('[data-act=pick][data-id=son]');
  ok('today screen plans 7 new cards', /새 카드 7장/.test(await page.textContent('#app')));
  await page.click('[data-act=start]'); await page.waitForSelector('.act.yes:not([disabled])');
  const first = await cur(page); const w0 = WORDS.find((w) => w.id === first.id);
  ok('front shows the English word and not its meaning', (await page.textContent('#word')) === w0.form && !(await page.textContent('#app')).includes(w0.ko));
  ok('card and both buttons fit on one screen (landscape)', await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1 && document.querySelector('.act.yes').getBoundingClientRect().bottom <= innerHeight));
  // click and read in one step: in fast mode the next card arrives within milliseconds
  const shown = await page.evaluate(() => { document.querySelector('.act.yes').click(); return new Promise((res) => setTimeout(() => res(document.querySelector('#card').textContent), 5)); });
  ok('meaning appears only after the child answered', shown.includes(w0.ko), shown);
  await page.waitForFunction(() => window.__cards.run.i >= 1);

  // 2. play the run honestly
  const seen = await play(page); await page.waitForSelector('.tiles');
  let son = await state(page, 'son');
  const day1 = WORDS.slice(0, 7);
  ok('known words become "likely" (silver), due in 7 days', day1.filter((w) => KNOWN.has(w.id)).every((w) => son.words[w.id].st === 'likely' && son.words[w.id].due === '2026-11-19'));
  ok('unknown words were shown again and learned: 1-day review', day1.filter((w) => !KNOWN.has(w.id)).every((w) => son.words[w.id].st === 'review' && son.words[w.id].step === 0 && son.words[w.id].due === '2026-11-13'));
  ok('unknown words came back in the same run, last time as a check', seen.some((x) => x.role === 'relearn' && x.form === 'check') && seen.length > 7, 'cards=' + seen.length);
  ok('run record saved with timing and counts', son.runs.length === 1 && son.runs[0].cards === seen.length + 1 && son.runs[0].fresh === 7 && son.runs[0].wall > 0);
  ok('end screen shows cards, bosses, learned', /넘긴 카드/.test(await page.textContent('.tiles')) && /잡은 보스/.test(await page.textContent('.tiles')));

  // 3. a false "know" is checked and caught
  await page.click('[data-act=start]'); await page.waitForSelector('.act.yes:not([disabled])');
  await page.evaluate(() => { window.__cards.run.rng = () => 0; });                 // verify every claim
  let it = await cur(page); let guard = 0;
  while (KNOWN.has(it.id) && guard++ < 10) {                                         // pass the known ones properly
    await answer(page, '.act.yes'); await answer(page, `.opt[data-i="${(await cur(page)).ans}"]`);
    await page.waitForSelector(READY); it = await cur(page);
  }
  const comboBefore = await page.evaluate(() => { window.__cards.run.combo = 3; return window.__cards.run.combo; });   // a streak to lose
  await answer(page, '.act.yes');
  ok('claiming "know" can turn into a 3-choice check', (await page.$$('.opt')).length === 3 && /확인/.test(await page.textContent('#tag')));
  const a = (await cur(page)).ans;
  const snap = await page.evaluate((i) => { const r = window.__cards.run; const id = r.current.id; document.querySelector('.opt[data-i="' + i + '"]').click();
    return { combo: r.combo, goon: !!document.querySelector('#goon'), st: window.__cards.st.words[id].st }; }, (a + 1) % 3);
  ok('wrong check: word goes to learning, combo resets, "next" is offered', snap.st === 'learn' && comboBefore >= 1 && snap.combo === 0 && snap.goon, JSON.stringify(snap));
  await play(page, () => true); await page.waitForSelector('.tiles');
  son = await state(page, 'son');
  ok('verification results are kept for the parent view', son.runs[1].verifies >= 1 && son.verify.includes(false));

  // 4. the other child is untouched; parent view lists the runs
  ok('sibling record untouched', (await state(page, 'daughter')) === null);
  await page.click('[data-act=today]'); await page.click('[data-act=home]'); await page.click('[data-act=parent]');
  ok('parent view shows both runs and the check accuracy', (await page.$$('.parent table tr')).length >= 4 && /확인 정답률/.test(await page.textContent('.parent')));
  ok('no sibling comparison on the home screen', await (async () => { await page.click('[data-act=home]'); return !/\d/.test(await page.textContent('.profiles')); })());

  // 5. day 2: learned words return as reviews, pass -> 3-day gap
  const d2 = await open(ctx, 'today=2026-11-13&seed=6&sound=off&fast=1');
  await d2.click('[data-act=pick][data-id=son]');
  const dueTxt = await d2.textContent('#app'); const dueN = Number((dueTxt.match(/다시 만나는 카드 (\d+)장/) || [])[1]);
  ok('day 2 brings back yesterday\'s learned words', dueN >= 3, 'due=' + dueN);
  const before = await state(d2, 'son'); const dueIds = Object.keys(before.words).filter((id) => before.words[id].st === 'review' && before.words[id].due === '2026-11-13');
  await d2.click('[data-act=start]'); await d2.evaluate((ids) => { window.__known2 = ids; }, dueIds);
  for (const id of dueIds) KNOWN.add(id);                                           // the child remembers them today
  await play(d2); await d2.waitForSelector('.tiles');
  const after = await state(d2, 'son');
  ok('passed 1-day reviews move to the 3-day gap', dueIds.length > 0 && dueIds.every((id) => after.words[id].step === 1 && after.words[id].due === '2026-11-16'));
  await d2.close();

  // 6. sound: a file from the manifest is used when present
  const fctx = await browser.newContext({ viewport: { width: 768, height: 950 }, hasTouch: true });
  const mp3 = fs.readdirSync(path.join(__dirname, '..', 'game', 'audio', 'dev')).find((f) => f.endsWith('.mp3'));
  await fctx.route('**/audio/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: Object.fromEntries(WORDS.map((w) => [w.id, 'x.mp3'])) }) }));
  await fctx.route('**/audio/x.mp3', (r) => r.fulfill({ contentType: 'audio/mpeg', body: fs.readFileSync(path.join(__dirname, '..', 'game', 'audio', 'dev', mp3)) }));
  const f1 = await open(fctx, 'today=2026-11-12&seed=7&fast=1');
  await f1.click('[data-act=pick][data-id=daughter]');
  ok('today screen says audio files are in use', /음원 파일/.test(await f1.textContent('#src')));
  await f1.click('[data-act=start]'); await f1.waitForSelector('.act.yes:not([disabled])', { timeout: 8000 });
  ok('buttons open after the word was played from a file', await f1.evaluate(() => window.__cards.run.current.sound) === 'file');
  ok('card and both buttons fit on one screen (portrait)', await f1.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1));
  await f1.close(); await fctx.close();

  // 7. sound failure: no file and no system voice -> card stays locked, banner offers retry; parent can continue
  const nctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  await nctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); });
  const n1 = await open(nctx, 'today=2026-11-12&seed=8&fast=1');
  await n1.click('[data-act=pick][data-id=daughter]'); await n1.click('[data-act=start]');
  await n1.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
  ok('no sound: banner with retry, answer buttons stay locked', /다시 듣기/.test(await n1.textContent('#banner')) && await n1.$eval('.act.yes', (b) => b.disabled));
  await n1.click('[data-act=mute-go]');
  ok('parent override unlocks the card and is recorded as no sound', !(await n1.$eval('.act.yes', (b) => b.disabled)) && await n1.evaluate(() => window.__cards.run.current.sound) === 'none');
  await n1.close(); await nctx.close();

  ok('no uncaught page errors / console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close(); server.kill();
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('cards e2e crashed', e); try { server.kill(); } catch {} process.exit(2); });
