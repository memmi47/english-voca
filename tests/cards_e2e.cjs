// Browser test for the flashcard prototype (cards/). Run: node tests/cards_e2e.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = 8091; const BASE = `http://localhost:${PORT}/`;
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'cards-state-'));          // a throwaway state folder for the sharing tests
const server = spawn('python3', [path.join(__dirname, '..', 'tools', 'serve_cards.py'), '--port', String(PORT), '--state-dir', STATE], { stdio: 'ignore' });
const results = []; const errs = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The demo set (?set=demo): 86 cards, two continents, three worlds. Built by tools/make_cards_demo.py.
const DEMO = path.join(__dirname, '..', 'cards', 'data', 'demo');
const WORDS = JSON.parse(fs.readFileSync(path.join(DEMO, 'catalog.json'), 'utf8')).words; const DOC = JSON.parse(fs.readFileSync(path.join(DEMO, 'worlds.json'), 'utf8'));
const WORLDS = DOC.continents.flatMap((c) => c.worlds); const NODES = WORLDS.flatMap((w) => w.map.nodes.concat(w.sideActivities.flatMap((h) => h.tiles)));
const TILE = (id) => NODES.find((t) => t.id === id).words;
const KNOWN = new Set(WORDS.filter((w, i) => (i * 5) % 7 < 3).map((w) => w.id));   // a mix in every tile     // what this pretend child really knows
const READY = '.act.yes:not([disabled]), .opt:not([disabled]), .tiles';

// Most tests run with nosync=1 (pure on-device behaviour); the sharing tests pass sync = true.
async function open(ctx, q, sync = false) {
  if (!sync) q += '&nosync=1';
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + '?set=demo&' + q); await page.waitForSelector('.profiles'); return page;
}
const state = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem('cards.v0.p.' + i)), id);
const cur = (page) => page.evaluate(() => { const r = window.__cards.run; const it = r && r.current; return it ? { id: it.id, form: it.form, role: it.role, verifying: !!it.verifying, ans: it.options ? it.options.findIndex((o) => o.id === it.id) : -1 } : null; });
const nodeStatus = (page, id) => page.$eval(`[data-act=node][data-id=${id}]`, (b) => b.className.replace('node', '').trim());
// A node is pressed on its picture, like a finger would.
async function startNode(page, id) { await page.click(`[data-act=node][data-id=${id}]`); await page.waitForSelector(READY, { timeout: 8000 }); }
async function answer(page, sel) {
  const i0 = await page.evaluate(() => window.__cards.run.i);
  await page.click(sel);
  await page.waitForFunction((n) => { const r = window.__cards.run; return !r || r.i > n || (r.current && r.current.verifying && document.querySelector('.opt:not([disabled])')); }, i0, { timeout: 8000 });
}
// Plays the current run to the end screen. claim(id) = what the child says; real knowledge decides the checks.
async function play(page, claim = (id) => KNOWN.has(id)) {
  const seen = [];
  for (let g = 0; g < 400; g++) {
    await page.waitForSelector(READY, { timeout: 8000 }); if (await page.$('.tiles')) break;
    const it = await cur(page); if (!it) continue;
    if (it.form === 'check' || it.verifying) {
      const really = it.role === 'relearn' || KNOWN.has(it.id); if (!it.verifying) seen.push(it);
      await answer(page, `.opt[data-i="${really ? it.ans : (it.ans + 1) % 3}"]`);
    } else { seen.push(it); await answer(page, it.role === 'relearn' || it.role === 'practice' || claim(it.id) ? '.act.yes' : '.act.no'); }
  }
  return seen;
}
const toMap = async (page) => { await page.click('[data-act=today]'); await page.waitForSelector('.world'); };

(async () => {
  for (let i = 0; i < 50; i++) { if (await fetch(BASE).then((r) => r.ok, () => false)) break; await sleep(100); }
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  let page = await open(ctx, 'today=2026-11-12&triage=off&seed=5&sound=off&fast=1');

  // 1. the map
  await page.click('[data-act=pick][data-id=son]'); await page.waitForSelector('.world');
  const first = await Promise.all(['A1', 'B1', 'C1'].map((id) => nodeStatus(page, id))); const second = await Promise.all(['A2', 'B2', 'C2', 'castle', 'bonus'].map((id) => nodeStatus(page, id)));
  ok('map: first tile of every road is open, the rest are locked', first.every((c) => /\bopen\b/.test(c)) && second.every((c) => /\blocked\b/.test(c)), first.join('|') + ' / ' + second.join('|'));
  await page.click('[data-act=node][data-id=A2]'); ok('a locked tile explains itself and does not start', /앞 칸을 먼저/.test(await page.textContent('#msg')) && !(await page.$('.run')));
  ok('map fits one screen width; landmarks are labelled', await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1) && (await page.$$('.node .lbl')).length >= 4);   // was 5 with the house label; the house is off the path now
  ok('pixel font and a clear word font are both in use', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Galmuri11') && /Galmuri11/.test(getComputedStyle(document.body).fontFamily) && !/Galmuri11/.test(getComputedStyle(document.documentElement).getPropertyValue('--word')); }));

  ok('the hear-and-pick house is not on the default map', !(await page.$('[data-id=H1]')));

  // 2. first tile
  await startNode(page, 'A1'); const c0 = await cur(page); const w0 = WORDS.find((w) => w.id === c0.id);
  ok('front shows the English word and not its meaning', (await page.textContent('#word')) === w0.form && !(await page.textContent('#app')).includes(w0.ko));
  ok('card and both buttons fit on one screen (landscape)', await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1 && document.querySelector('.act.yes').getBoundingClientRect().bottom <= innerHeight));
  const sel0 = KNOWN.has(c0.id) ? '.act.yes' : '.act.no';
  const shown = await page.evaluate((sel) => { document.querySelector(sel).click(); return new Promise((res) => setTimeout(() => res(document.querySelector('#card').textContent), 5)); }, sel0);
  ok('meaning appears only after the child answered', shown.includes(w0.ko), shown);
  await page.waitForFunction(() => window.__cards.run.i >= 1);
  const seen = await play(page); await page.waitForSelector('.tiles');
  let son = await state(page, 'son'); const a1 = TILE('A1').map((id) => WORDS.find((w) => w.id === id));
  ok('the tile introduced exactly its own words', Object.keys(son.words).sort().join() === TILE('A1').slice().sort().join());
  ok('known words become "likely" (silver), due in 7 days', a1.filter((w) => KNOWN.has(w.id)).every((w) => son.words[w.id].st === 'likely' && son.words[w.id].due === '2026-11-19'));
  ok('unknown words were learned: 1-day review', a1.filter((w) => !KNOWN.has(w.id)).every((w) => son.words[w.id].st === 'review' && son.words[w.id].step === 0 && son.words[w.id].due === '2026-11-13'));
  ok('unknown words came back in the same run, last time as a check', seen.some((x) => x.role === 'relearn' && x.form === 'check'), 'cards=' + seen.length);
  ok('run record has timing, counts and the tile', son.runs.length === 1 && son.runs[0].tag === 'A1' && son.runs[0].fresh === 10 && son.runs[0].wall > 0 && son.runs[0].stars > 0);
  ok('end screen: tile cleared, stars, cards', /칸 클리어/.test(await page.textContent('h1')) && /\+\d+/.test(await page.textContent('.gain')) && /넘긴 카드/.test(await page.textContent('.tiles')));
  await toMap(page);
  ok('cleared tile gets a flag; the next tile on the road opens; stars are shown', /\bcleared\b/.test(await nodeStatus(page, 'A1')) && /\bopen\b/.test(await nodeStatus(page, 'A2')) && /[1-9]/.test(await page.textContent('.maphud .chip:nth-of-type(1)')));
  ok('sound events fired during the run (step, study music, flip, jingle, stamp)', await page.waitForFunction(() => { const l = window.__cards.sound.seen; return ['step', 'scene:study', 'flip', 'jingle:clear', 'stamp', 'scene:meadow'].every((k) => l.has(k)); }, null, { timeout: 3000 }).then(() => true, () => false));

  // 3. a false "know" is checked and caught
  await startNode(page, 'B1');
  await page.evaluate(() => { window.__cards.run.rng = () => 0; });                 // verify every claim
  let it = await cur(page); let guard = 0;
  while (KNOWN.has(it.id) && guard++ < 14) {                                         // pass the known ones properly
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
  ok('a caught false claim still lets the tile clear once every word was met', /칸 클리어/.test(await page.textContent('h1')));

  // 4. the other child is untouched; parent view lists the runs; no sibling comparison
  ok('sibling record untouched', (await state(page, 'daughter')) === null);
  await toMap(page); await page.click('[data-act=home]'); await page.click('[data-act=parent]');
  ok('parent view shows runs, tile names, the check accuracy and stars', (await page.$$('.parent table tr')).length >= 3 && /확인 정답률/.test(await page.textContent('.parent')) && /별 \d+/.test(await page.textContent('.parent')) && /A1/.test(await page.textContent('.parent table')));
  await page.click('[data-act=home]');
  ok('home screen shows no numbers (no sibling comparison)', !/\d/.test(await page.textContent('.profiles')));

  // 5. day 2: the reviews of two tiles pile up into an optional monster; it does not block the roads
  const d2 = await open(ctx, 'today=2026-11-13&triage=off&seed=6&sound=off&fast=1');
  await d2.click('[data-act=pick][data-id=son]'); await d2.waitForSelector('.world');
  const before = await state(d2, 'son'); const dueIds = Object.keys(before.words).filter((id) => before.words[id].st === 'review' && before.words[id].due === '2026-11-13');
  ok('day 2: yesterday\'s learned words are due and form a monster', dueIds.length >= 8 && !!(await d2.$('[data-id=monster]')), 'due=' + dueIds.length);
  ok('day 2: the monster does not block: tile A2 stays open', /\bopen\b/.test(await nodeStatus(d2, 'A2')));
  ok('day 2: the bat gauge shows 20 of 40 (20 new words, no reviews yet)', /20\/40/.test(await d2.textContent('#batgauge')) && !(await d2.$('[data-id=bat]')));
  for (const id of dueIds) KNOWN.add(id);                                           // the child remembers them today
  await startNode(d2, 'monster'); await play(d2); await d2.waitForSelector('.tiles');
  const after = await state(d2, 'son');
  ok('passed 1-day reviews move to the 3-day gap', dueIds.every((id) => after.words[id].step === 1 && after.words[id].due === '2026-11-16'));
  await toMap(d2);
  ok('monster beaten: it is gone and the gauge went down by the reviews answered', !(await d2.$('[data-id=monster]')) && /\bopen\b/.test(await nodeStatus(d2, 'A2')) && (await state(d2, 'son')).map.bat.fill < 20);
  await startNode(d2, 'A2');
  const order = await d2.evaluate(() => window.__cards.run.queue.map((q) => q.role[0]).join(''));
  ok('a tile run starts with its new words', /^n/.test(order) && !/r/.test(order.slice(0, 1)), order);
  await d2.close();

  // 6. the whole world in one day: castle opens after two roads, check-only exam, key, bonus road x2, bag items
  const wctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  for (const w of WORDS) KNOWN.add(w.id);
  const w1 = await open(wctx, 'today=2026-12-01&triage=off&seed=11&sound=off&fast=1'); await w1.click('[data-act=pick][data-id=daughter]'); await w1.waitForSelector('.world');
  await startNode(w1, 'A1'); await play(w1); await toMap(w1);
  await w1.click('[data-act=node][data-id=castle]');
  ok('castle stays locked until a path reaches it', /\blocked\b/.test(await nodeStatus(w1, 'castle')) && /성까지/.test(await w1.textContent('#msg')));
  for (const id of ['A2', 'B1']) { await startNode(w1, id); await play(w1); await toMap(w1); }
  ok('one finished path opens the castle (through the square); the gauge shows 30 of 40 after three tiles', /\bopen\b/.test(await nodeStatus(w1, 'castle')) && /30\/40/.test(await w1.textContent('#batgauge')));
  await startNode(w1, 'B2'); await play(w1);
  ok('the fourth tile fills the gauge: the end screen announces the bats and offers the test', /박쥐 게이지가 가득/.test(await w1.textContent('.page')) && (await w1.$eval('.go', (b) => b.dataset.act)) === 'bat-go');
  await toMap(w1);
  ok('full gauge: the bat node appears and every other node says the bats come first', !!(await w1.$('[data-id=bat]')) && /\bblocked\b/.test(await nodeStatus(w1, 'castle')) && /\bblocked\b/.test(await nodeStatus(w1, 'C1')));
  await w1.click('[data-act=node][data-id=C1]'); ok('a tile cannot start while the gauge is full', /박쥐/.test(await w1.textContent('#msg')) && !(await w1.$('.run')));
  await startNode(w1, 'bat'); const batQ = await w1.evaluate(() => window.__cards.run.queue.map((q) => q.form + ':' + q.role));
  ok('the bat test is 25 check cards over the words just met', batQ.length === 25 && batQ.every((x) => x.startsWith('check:')), batQ.length + ' ' + batQ[0]);
  await w1.click('[data-act=quit]'); await w1.waitForSelector('.tiles');
  ok('leaving the test early keeps the gauge full', /박쥐가 남았어요/.test(await w1.textContent('h1')) && (await state(w1, 'daughter')).map.bat.fill === 40);
  await w1.click('[data-act=bat-go]'); await w1.waitForSelector(READY); await play(w1); await w1.waitForSelector('.tiles');
  const batDone = await state(w1, 'daughter');
  ok('passing the test empties the gauge and raises the capacity to 50', /박쥐를 쫓아냈어요/.test(await w1.textContent('h1')) && batDone.map.bat.fill === 0 && batDone.map.bat.cap === 50 && batDone.runs.at(-1).tag === 'bat', JSON.stringify(batDone.map.bat));
  ok('F10: a bat test with no reviews left over says the gauge goes back to 0', /박쥐 게이지가 0으로 돌아가요/.test(await w1.textContent('.page')));
  await toMap(w1);
  ok('castle is open again once the bats are gone', /\bopen\b/.test(await nodeStatus(w1, 'castle')) && !(await w1.$('[data-id=bat]')));
  await w1.click('[data-act=node][data-id=castle]'); await w1.waitForSelector(READY);
  const castleQ = await w1.evaluate(() => window.__cards.run.queue.map((q) => q.role + ':' + q.form));
  ok('castle is a check-only run of 12 cards', castleQ.length === 12 && castleQ.every((x) => x === 'castle:check'));
  await play(w1); await w1.waitForSelector('.tiles');
  ok('passing the castle gives a key', /성을 깼어요/.test(await w1.textContent('h1')) && /열쇠/.test(await w1.textContent('.page')));
  await toMap(w1);
  ok('castle shows cleared, key counted, what is left over is bonus x2', /\bcleared\b/.test(await nodeStatus(w1, 'castle')) && (await w1.textContent('.maphud .chip:nth-of-type(2)')).trim() === '1' && (await w1.$$('.node .x2')).length === 2);   // the house is off the path now: only the two left-over tiles   // the two tiles left over and the house
  const starsBefore = await w1.evaluate(() => window.__cards.st.map.stars);
  await startNode(w1, 'C1'); await play(w1); const gain = Number((/\+(\d+)/.exec(await w1.textContent('.gain')) || [])[1]);
  ok('bonus road pays double stars', /\(×2\)/.test(await w1.textContent('.gain')) && gain > 0 && (await state(w1, 'daughter')).map.stars === starsBefore + gain, 'gain=' + gain);
  const dau = await state(w1, 'daughter');
  ok('map rewards left no trace in any word record', Object.values(dau.words).every((r) => !('stars' in r) && !('item' in r) && !('bonus' in r)));
  await toMap(w1);

  // 7. lightning round: opens once words are ripe, touches no word, drops an item, once a day
  ok('bonus house is open', /\bopen\b/.test(await nodeStatus(w1, 'bonus')));
  const wordsBefore = JSON.stringify((await state(w1, 'daughter')).words);
  await w1.click('[data-act=node][data-id=bonus]'); await w1.waitForSelector('[data-act=lt-yes]');
  for (let k = 0; k < 8; k++) { const truth = await w1.evaluate(() => window.__cards.lt.cur.truth); await w1.click(truth ? '[data-act=lt-yes]' : '[data-act=lt-no]'); await sleep(40); }
  await w1.waitForSelector('.tiles', { timeout: 8000 });
  const ltState = await state(w1, 'daughter');
  ok('lightning round ends with a score, an item and a best record', ltState.map.best >= 8 && /내 최고 기록/.test(await w1.textContent('.tiles')) && (ltState.map.items.shield + ltState.map.items.flame) >= 1, JSON.stringify(ltState.map.items));
  ok('lightning round changed no word record', JSON.stringify(ltState.words) === wordsBefore);
  await toMap(w1);
  ok('bonus house is used up for today', /\bcleared\b/.test(await nodeStatus(w1, 'bonus')));
  const item = ltState.map.items.shield ? 'shield' : 'flame';
  await w1.click(`[data-act=bag][data-item=${item}]`); await w1.waitForSelector('.item.sel');
  ok('an item can be put in the bag', await w1.$eval('.item.sel', (b) => b.dataset.item) === item);
  await w1.close(); await wctx.close();

  // 8. optional monster: 8+ due reviews put it on the map without blocking anything
  const mctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const m1 = await open(mctx, 'today=2026-12-02&triage=off&seed=3&sound=off&fast=1'); await m1.click('[data-act=pick][data-id=daughter]'); await m1.waitForSelector('.world');
  await m1.evaluate(() => { const st = JSON.parse(localStorage.getItem('cards.v0.p.daughter') || 'null') || { v: 0, id: 'daughter', words: {}, verify: [], runs: [], log: [] };
    const ids = window.__cards.words.slice(0, 10).map((w) => w.id); for (const id of ids) st.words[id] = { st: 'review', step: 0, due: '2026-12-02', firstDay: '2026-12-01', lastDay: '2026-12-01', lapses: 0 };
    localStorage.setItem('cards.v0.p.daughter', JSON.stringify(st)); });
  await m1.click('[data-act=home]'); await m1.click('[data-act=pick][data-id=daughter]'); await m1.waitForSelector('.world');
  ok('10 due reviews put a monster on the map', !!(await m1.$('[data-id=monster]')) && /몬스터 10/.test(await m1.textContent('[data-id=monster]')));
  ok('F6: with a monster on the map there is no review button', !(await m1.$('[data-id=review]')));
  ok('the monster blocks nothing: road tiles stay open', /\bopen\b/.test(await nodeStatus(m1, 'A1')) && /\bopen\b/.test(await nodeStatus(m1, 'C1')));
  ok('the parent view lists the overdue reviews and the gauge', await (async () => { await m1.click('[data-act=home]'); await m1.click('[data-act=parent]'); const t = await m1.textContent('.parent'); await m1.click('[data-act=home]'); await m1.click('[data-act=pick][data-id=daughter]'); await m1.waitForSelector('.world'); return /밀린 복습 10장/.test(t) && /박쥐 0\/40/.test(t); })());
  await m1.click('[data-act=node][data-id=monster]'); await m1.waitForSelector(READY);
  const mq = await m1.evaluate(() => window.__cards.run.queue.map((q) => q.role));
  ok('monster run is reviews only', mq.length === 10 && mq.every((r) => r === 'review'), mq.join());
  await play(m1); await m1.waitForSelector('.tiles');
  ok('beating the monster gives double stars and an item', /물리쳤어요/.test(await m1.textContent('h1')) && /\(×2\)/.test(await m1.textContent('.gain')) && /얻었어요/.test(await m1.textContent('.page')));
  await toMap(m1);
  ok('monster is gone and the roads are still open', !(await m1.$('[data-id=monster]')) && /\bopen\b/.test(await nodeStatus(m1, 'A1')));
  await m1.close(); await mctx.close();

  // 9. sound: a file from the manifest is used when present
  const fctx = await browser.newContext({ viewport: { width: 768, height: 950 }, hasTouch: true });
  const wav = (() => { const n = 800, b = Buffer.alloc(44 + n); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44); return b; })();   // 0.1 s of silence
  await fctx.route('**/audio/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: Object.fromEntries(WORDS.map((w) => [w.id, 'x.wav'])) }) }));
  await fctx.route('**/audio/x.wav', (r) => r.fulfill({ contentType: 'audio/wav', body: wav }));
  const f1 = await open(fctx, 'today=2026-11-12&triage=off&seed=7&fast=1');
  await f1.click('[data-act=pick][data-id=daughter]'); await f1.waitForSelector('.world');
  ok('map screen says audio files are in use', /음원 파일/.test(await f1.textContent('#src')));
  ok('map fits the portrait screen without sideways scroll', await f1.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1));
  await f1.click('[data-act=node][data-id=C1]'); await f1.waitForSelector('.act.yes:not([disabled])', { timeout: 8000 });
  ok('buttons open after the word was played from a file', await f1.evaluate(() => window.__cards.run.current.sound) === 'file');
  ok('card and both buttons fit on one screen (portrait)', await f1.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1));
  await f1.close(); await fctx.close();

  // 10. sound failure: no file and no system voice -> card stays locked, banner offers retry; parent can continue
  const nctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  await nctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); });
  const n1 = await open(nctx, 'today=2026-11-12&triage=off&seed=8&fast=1');
  await n1.click('[data-act=pick][data-id=daughter]'); await n1.waitForSelector('.world'); await n1.click('[data-act=node][data-id=A1]');
  await n1.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
  ok('no sound: banner with retry, answer buttons stay locked', /다시 듣기/.test(await n1.textContent('#banner')) && await n1.$eval('.act.yes', (b) => b.disabled));
  await n1.click('[data-act=mute-go]');
  ok('parent override unlocks the card and is recorded as no sound', !(await n1.$eval('.act.yes', (b) => b.disabled)) && await n1.evaluate(() => window.__cards.run.current.sound) === 'none');
  await n1.close(); await nctx.close();

  // 10b. look and music: sprite sheet, per-world colours, music toggle that survives a reload (sound on, headless audio)
  const vctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const v1 = await open(vctx, 'today=2026-11-12&seed=9&fast=1&nosync=1');
  await v1.click('[data-act=pick][data-id=son]'); await v1.waitForSelector('.world');
  const look = await v1.evaluate(() => ({ sheet: document.querySelectorAll('#sheet symbol').length, a1: document.querySelector('[data-id=A1] use')?.getAttribute('href'), a2: document.querySelector('[data-id=A2] use')?.getAttribute('href'),
    ground: document.documentElement.style.getPropertyValue('--w-ground'), path: document.querySelectorAll('.terrain use[href="#t-path"]').length, big: document.querySelector('[data-id=A1] .big').getBoundingClientRect().width }));
  ok('sprite sheet inlined (66 symbols); open tile and locked tile use stone pads', look.sheet === 66 && look.a1 === '#stone-open' && look.a2 === '#stone-locked', JSON.stringify(look));
  ok('world colours come from the world file; the map has path tiles; a stone is drawn about 64 px wide', look.ground === '#8FCB83' && look.path > 8 && look.big >= 56, JSON.stringify(look));
  ok('text on a light sky is dark', await v1.evaluate(() => document.documentElement.style.getPropertyValue('--fg') === '#233f3a'));
  ok('music starts off, effects on', await v1.evaluate(() => !window.__cards.sound.musicOn && window.__cards.sound.sfx));
  await v1.click('[data-act=music]'); await v1.waitForSelector('.tgl.on');
  await v1.waitForFunction(() => window.__cards.sound.music && window.__cards.sound.music.on, null, { timeout: 8000 });
  ok('music toggle plays the map loop and is remembered', await v1.evaluate(() => window.__cards.sound.music.track.id === 'meadow' && JSON.parse(localStorage.getItem('cards.v0.pref')).music === true));
  await v1.evaluate(() => window.__cards.sound.sfxPlay('hit')); ok('effects can play through the real synth without errors', await v1.evaluate(() => window.__cards.sound.ctx.state !== 'closed'));
  await v1.goto(BASE + '?set=demo&today=2026-11-12&seed=9&fast=1&nosync=1'); await v1.waitForSelector('.profiles');
  await v1.click('[data-act=pick][data-id=son]'); await v1.waitForSelector('.world');
  ok('the music choice persists after a reload', await v1.evaluate(() => window.__cards.sound.musicOn));
  await v1.close(); await vctx.close();

  // 10c. worlds: house with hear-and-pick cards, playhouses, key and crown, next world, world list, continent castle, next continent
  const xctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const x = await open(xctx, 'today=2026-12-20&triage=off&seed=21&sound=off&fast=1&houses=sight'); await x.click('[data-act=pick][data-id=son]'); await x.waitForSelector('.world');
  const worldId = () => x.$eval('#world', (e) => e.dataset.world); const msg = () => x.textContent('#msg');
  ok('the first visit shows the world\'s opening line and its name', (await worldId()) === 'd1-01' && /첫 편지/.test(await msg()) && /새싹 들판 · 단어 마을/.test(await x.textContent('#wtitle')));
  await x.click('[data-act=node][data-id=G1]'); const m1x = await msg(); await x.click('[data-act=node][data-id=H1]');
  ok('a playhouse and a house are closed until the path reaches them', /놀이집으로 가는 길/.test(m1x) && /앞 칸을 먼저/.test(await msg()) && !(await x.$('.run')));
  await startNode(x, 'A1'); await play(x); await toMap(x);
  ok('the house opens when its tile is done', /\bopen\b/.test(await nodeStatus(x, 'H1')) && /0\/1/.test(await x.textContent('[data-id=H1]')));
  await startNode(x, 'H1'); const sc = await cur(x); const sw = WORDS.find((w) => w.id === sc.id); const sightForms = WORDS.filter((w) => w.track === 'sight').map((w) => w.form);
  const optTexts = await x.$$eval('.opt', (bs) => bs.map((b) => b.textContent));
  ok('a function word is a hear-and-pick card: the word is hidden and the choices are spellings', sw.track === 'sight' && !!(await x.$('#word[data-hidden]')) && !(await x.textContent('#card')).includes(sw.form) && /글자를 골라요/.test(await x.textContent('#tag')) && optTexts.length === 3 && optTexts.every((t) => sightForms.includes(t)) && optTexts.includes(sw.form), optTexts.join());
  const backText = await x.evaluate((i) => { document.querySelector(`.opt[data-i="${i}"]`).click(); return new Promise((res) => setTimeout(() => res(document.querySelector('#card').textContent), 5)); }, sc.ans);
  ok('after the answer the card shows the word', backText.includes(sw.form), backText);
  await x.waitForFunction(() => window.__cards.run.i >= 1); await play(x); await x.waitForSelector('.tiles'); await toMap(x);
  const stH = (await state(x, 'son')).words;
  ok('the house is done and counted: every function word has a record', /\bcleared\b/.test(await nodeStatus(x, 'H1')) && /1\/1/.test(await x.textContent('[data-id=H1]')) && TILE('H1-1').every((id) => stH[id]));
  await startNode(x, 'B1'); await play(x); await toMap(x);
  const before10c = JSON.stringify((await state(x, 'son')).words);
  await x.click('[data-act=node][data-id=G1]'); await x.waitForSelector('.memgrid');
  ok('the playhouse opens a picture-pair game with six cards', (await x.$$('.memcard')).length === 6 && /0 \/ 3쌍/.test(await x.textContent('#gstatus')));
  const deck = await x.evaluate(() => window.__cards.game.deck); const wrongPair = [0, deck.findIndex((e) => e !== deck[0])];
  for (const i of wrongPair) await x.click(`.memcard[data-i="${i}"]`);
  await x.waitForFunction(() => window.__cards.game.open.length === 0 && !window.__cards.game.busy);
  ok('a wrong pair turns back and costs nothing', (await x.evaluate(() => window.__cards.game.matched.size)) === 0);
  for (const e of [...new Set(deck)]) { const [i, j] = deck.map((d, k) => (d === e ? k : -1)).filter((k) => k >= 0); await x.click(`.memcard[data-i="${i}"]`); await x.click(`.memcard[data-i="${j}"]`); }
  await x.waitForSelector('#stampgain');
  const stamped = await state(x, 'son');
  ok('finishing gives one stamp and changes no word, star or gauge', /도장을 찍었어요/.test(await x.textContent('#stampgain')) && stamped.map.worlds['d1-01'].stamps.G1 === '2026-12-20' && JSON.stringify(stamped.words) === before10c);
  await toMap(x); ok('the playhouse shows its stamp and can be played again', /\bdone\b/.test(await nodeStatus(x, 'G1')));
  for (const id of ['C1', 'C2']) { await startNode(x, id); await play(x); if (await x.$('[data-act=bat-go]')) { await x.click('[data-act=bat-go]'); await x.waitForSelector(READY); await play(x); await x.waitForSelector('.tiles'); } await toMap(x); }
  await x.click('[data-act=node][data-id=G2]'); await x.waitForSelector('.mailtrack');
  await x.waitForFunction(() => { const g = window.__cards.game; if (g && !g.inZone()) { document.querySelector('[data-act=mail]').click(); return true; } return false; }, null, { polling: 'raf' });
  ok('a letter dropped outside the yellow zone does not count', /0 \/ 3통/.test(await x.textContent('#gstatus')) && /조금만 더/.test(await x.textContent('#ghint')));
  for (let k = 0; k < 3; k++) await x.waitForFunction((n) => { const g = window.__cards.game; if (!g) return true; if (g.done === n && g.inZone()) { document.querySelector('[data-act=mail]').click(); return true; } return false; }, k, { polling: 'raf' });
  await x.waitForSelector('#stampgain');
  ok('three letters in the zone finish the mailbox game with a second stamp', Object.keys((await state(x, 'son')).map.worlds['d1-01'].stamps).sort().join() === 'G1,G2');
  await toMap(x);
  for (const id of ['A2', 'B2']) { await startNode(x, id); await play(x); if (await x.$('[data-act=bat-go]')) { await x.click('[data-act=bat-go]'); await x.waitForSelector(READY); await play(x); await x.waitForSelector('.tiles'); } await toMap(x); }
  await startNode(x, 'castle'); await play(x); await x.waitForSelector('.tiles');
  ok('castle with every tile and the house done: key, crown, the closing line and a way to the next world', !!(await x.$('#keygain')) && !!(await x.$('#crowngain')) && /장미 열쇠/.test(await x.textContent('#keygain')) && /꽃마루 문이 열렸어/.test(await x.textContent('.page')) && (await x.$eval('.go', (b) => b.dataset.act + ':' + b.dataset.id)) === 'goworld:d1-02');
  await x.click('.go'); await x.waitForSelector('#world[data-world="d1-02"]');
  ok('the next world opens with its own colours and opening line', /상자 사이에/.test(await msg()) && await x.evaluate(() => document.documentElement.style.getPropertyValue('--w-ground') === '#E3B45B'));
  await x.click('[data-act=atlas]'); await x.waitForSelector('.atlas');
  const atl = await x.evaluate(() => ({ crown: !!document.querySelector('.wcard[data-id="d1-01"] use[href="#crown"]'), here: document.querySelector('.wcard.here').dataset.id, locked: document.querySelector('.wcard[data-id="d2-01"]').disabled, finale: document.querySelector('.wcard.finale[data-id="d1"]').className }));
  ok('world list: crown on the finished world, the current world marked, the next continent closed, the big castle locked', atl.crown && atl.here === 'd1-02' && atl.locked && /\blocked\b/.test(atl.finale), JSON.stringify(atl));
  await x.click('.wcard.finale[data-id="d1"]'); ok('the locked big castle says what it needs', /왕관을 모두 모으면/.test(await msg()) && /1\/2/.test(await msg()));
  await x.click('.wcard[data-id="d1-01"]'); await x.waitForSelector('#world[data-world="d1-01"]'); ok('an earlier world can be visited again', /왕관/.test(await x.textContent('#wtitle')));
  await x.click('[data-act=atlas]'); await x.click('.wcard[data-id="d1-02"]'); await x.waitForSelector('#world[data-world="d1-02"]');
  for (const id of ['T1', 'T2']) { await startNode(x, id); await play(x); if (await x.$('[data-act=bat-go]')) { await x.click('[data-act=bat-go]'); await x.waitForSelector(READY); await play(x); await x.waitForSelector('.tiles'); } await toMap(x); }
  await startNode(x, 'k'); await play(x); await x.waitForSelector('.tiles'); await toMap(x);
  ok('with every crown of the continent the map points to the big castle', /큰 성에 도전/.test(await msg()));
  await x.click('[data-act=atlas]'); await x.waitForSelector('.wcard.finale.open'); await x.click('.wcard.finale[data-id="d1"]'); await x.waitForSelector(READY);
  const fq = await x.evaluate(() => window.__cards.run.queue.map((q) => q.role + ':' + q.form));
  ok('the big castle is a check-only run over the continent (10 cards in the demo)', fq.length === 10 && fq.every((q) => q === 'castle:check') && (await x.evaluate(() => window.__cards.node.pass)) === 0.7);
  await play(x); await x.waitForSelector('.tiles');
  ok('passing it opens the way to the next continent', /큰 성을 깼어요/.test(await x.textContent('h1')) && /굽이굽이 바다/.test(await x.textContent('.page')) && (await x.$eval('.go', (b) => b.dataset.act + ':' + b.dataset.id)) === 'goworld:d2-01');
  await x.click('.go'); await x.waitForSelector('#world[data-world="d2-01"]');
  ok('the second continent has its own music and colours', await x.evaluate(() => window.__cards.sound.seen.has('scene:sea') && document.documentElement.style.getPropertyValue('--w-ground') === '#75B7B1'));
  await x.click('[data-act=home]'); await x.click('[data-act=parent]');
  ok('the parent view counts keys, crowns and big castles', /열쇠 2\/3/.test(await x.textContent('.parent')) && /왕관 2/.test(await x.textContent('.parent')) && /큰 성 1\/2/.test(await x.textContent('.parent')) && /복습 정답률/.test(await x.textContent('.parent')));
  await x.close(); await xctx.close();

  // 10d. the full deck: 4,610 cards and 30 worlds load and a first tile can be played; a world file of another version is refused
  const fullctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const fp = await fullctx.newPage(); fp.on('pageerror', (e) => errs.push(String(e)));
  const t0 = Date.now(); await fp.goto(BASE + '?today=2026-12-21&triage=off&seed=2&sound=off&fast=1&nosync=1'); await fp.waitForSelector('.profiles'); await fp.click('[data-act=pick][data-id=son]'); await fp.waitForSelector('.world'); const loadMs = Date.now() - t0;
  const full = await fp.evaluate(() => ({ words: window.__cards.words.length, worlds: window.__cards.ix.worlds.length, world: document.querySelector('#world').dataset.world, open: document.querySelectorAll('.node.open').length, nodes: document.querySelectorAll('.world .node').length, standIn: window.__cards.standIn, wide: document.scrollingElement.scrollWidth <= innerWidth + 1 }));
  ok('full deck: 4,610 cards, 30 worlds, the first world\'s map with open tiles, fits the screen width', full.words === 4610 && full.worlds === 30 && full.world === 'p1-01' && full.open >= 2 && full.nodes >= 15 && full.wide, JSON.stringify(full) + ' load ' + loadMs + ' ms');
  ok('the stand-in world file is named as such', full.standIn ? /시험용/.test(await fp.textContent('#src')) : true);
  const openId = await fp.$eval('.world .node.open', (b) => b.dataset.id); await fp.click(`[data-act=node][data-id="${openId}"]`); await fp.waitForSelector(READY);
  const fullRun = await fp.evaluate(() => ({ n: window.__cards.run.queue.length, word: document.querySelector('#word').textContent }));
  ok('a tile of the full deck starts a run of its 10 new words', fullRun.n === 10 && fullRun.word.length > 0, JSON.stringify(fullRun));
  await fp.click('[data-act=yes]'); await fp.waitForFunction(() => window.__cards.run.i >= 1 || document.querySelector('.opt'), null, { timeout: 8000 });
  await fp.close();
  const bad = await fullctx.newPage(); await bad.route('**/data/worlds.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ schemaVersion: 9, continents: [] }) }));
  await bad.goto(BASE + '?today=2026-12-21&sound=off&nosync=1'); await bad.waitForSelector('#fatal');
  ok('a world file of an unknown version is refused with a plain message', /버전/.test(await bad.textContent('#fatal')));
  await bad.close(); await fullctx.close();

  // 10e. updates never reset progress: an old-format record opens, a damaged one is set aside and restored from a file,
  //      a record from a newer program is left alone
  const SAVE0 = fs.readFileSync(path.join(__dirname, 'fixtures', 'saves', 'v0-prototype.json'), 'utf8');
  const uctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const u = await open(uctx, 'today=2026-12-22&triage=off&seed=4&sound=off&fast=1');
  await u.evaluate((t) => localStorage.setItem('cards.v0.p.son', t), SAVE0); await u.reload(); await u.waitForSelector('.profiles');
  await u.click('[data-act=pick][data-id=son]'); await u.waitForSelector('.world');
  ok('a record saved by the 60-word prototype opens after the update: its tiles, stars and gauge are there', /\bcleared\b/.test(await nodeStatus(u, 'A1')) && /\bcleared\b/.test(await nodeStatus(u, 'B1')) && /77/.test(await u.textContent('.maphud .chip:nth-of-type(1)')) && /20\/40/.test(await u.textContent('#batgauge')));
  await startNode(u, 'A2'); await play(u); await u.waitForSelector('.tiles');
  const up = await state(u, 'son');
  ok('after playing on, the record is in the new format and still holds the old words', up.v === 2 && Object.keys(up.words).length === 30 && Object.keys(JSON.parse(SAVE0).words).every((id) => up.words[id]) && !!up.map.legacy);
  await u.evaluate(() => localStorage.setItem('cards.v0.p.son', '{"v":1,"id":"son","words":{"W0122'));           // cut off in the middle of a write
  await u.goto(BASE + '?set=demo&today=2026-12-22&triage=off&seed=4&sound=off&fast=1&nosync=1'); await u.waitForSelector('.profiles'); await u.click('[data-act=pick][data-id=son]'); await u.waitForSelector('.world');
  const dmg = await u.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cards.v0.p.son.damaged.')).map((k) => localStorage.getItem(k)));
  ok('a damaged record is set aside (not overwritten) and the child is told', dmg.length === 1 && dmg[0].startsWith('{"v":1,"id":"son"') && /따로 보관/.test(await u.textContent('#banner')));
  await u.click('[data-act=hide]'); await u.click('[data-act=home]'); await u.click('[data-act=parent]'); await u.waitForSelector('#safety');
  await u.setInputFiles('input[data-restore=son]', { name: 'cards_son.json', mimeType: 'application/json', buffer: Buffer.from(SAVE0) });
  await u.waitForFunction(() => /복원했어요/.test(document.querySelector('#pmsg')?.textContent || ''));
  ok('a parent restores the record from an exported file; it is merged in', /0장 → 20장/.test(await u.textContent('#pmsg')) && Object.keys((await state(u, 'son')).words).length === 20);
  await u.setInputFiles('input[data-restore=daughter]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(SAVE0) });
  await u.waitForFunction(() => /복원하지 못했어요/.test(document.querySelector('#pmsg')?.textContent || ''));
  ok('a file of the other child is refused with a reason', /다른 아이/.test(await u.textContent('#pmsg')) && (await state(u, 'daughter')) === null);
  const future = JSON.stringify({ v: 99, id: 'son', words: { x: { st: 'done' } }, runs: [], verify: [], log: [], somethingNew: true });
  await u.evaluate((t) => localStorage.setItem('cards.v0.p.son', t), future); await u.click('[data-act=home]'); await u.click('[data-act=pick][data-id=son]'); await u.waitForSelector('.world');
  await u.click('[data-act=node][data-id=A1]'); await sleep(150);
  ok('a record from a newer program is shown read-only: a reload is asked for, no run starts, nothing is written', /오래됐어요/.test(await u.textContent('#banner')) && !(await u.$('.run')) && (await u.evaluate(() => localStorage.getItem('cards.v0.p.son'))) === future);
  await u.close(); await uctx.close();

  // 10g. a record that already holds function-word entries keeps them although the house is off the path
  const V1W = fs.readFileSync(path.join(__dirname, 'fixtures', 'saves', 'v1-worlds.json'), 'utf8'); const v1w = JSON.parse(V1W);
  const gctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const g = await open(gctx, 'today=2026-12-22&triage=off&seed=4&sound=off&fast=1');
  await g.evaluate((t) => localStorage.setItem('cards.v0.p.daughter', t), V1W); await g.reload(); await g.waitForSelector('.profiles');
  await g.click('[data-act=pick][data-id=daughter]'); await g.waitForSelector('.world');
  const sightIdsF = WORDS.filter((w) => w.track === 'sight').map((w) => w.id); const heldF = Object.keys(v1w.words).filter((id) => sightIdsF.includes(id));
  ok('the fixture really holds function-word entries and the map shows no house', heldF.length === 6 && !(await g.$('[data-id=H1]')), String(heldF.length));
  const openF = await g.$eval('.world .node.open', (b) => b.dataset.id); await startNode(g, openF); await play(g); await g.waitForSelector('.tiles');
  const afterF = (await state(g, 'daughter')).words;
  ok('after opening the map and playing one tile, every earlier word record is still there', Object.keys(v1w.words).every((id) => afterF[id]) && heldF.every((id) => afterF[id]));
  await g.close(); await gctx.close();

  // 11. record sharing: progress made on one device ("Mac mini") shows on another ("iPad"), survives a wiped browser,
  //     survives the server being unreachable, and two devices that played apart end up with both
  const read = (id) => JSON.parse(fs.readFileSync(path.join(STATE, `p.${id}.json`), 'utf8')).data;
  const idle = (p) => p.waitForFunction(() => window.__cards.sync && window.__cards.sync.pending.length === 0, null, { timeout: 8000 });
  const mac = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const ipad = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const mc = await open(mac, 'today=2026-12-10&triage=off&seed=3&sound=off&fast=1', true);
  ok('home says the record is kept on this device and the Mac server', /이 기기 \+ Mac 서버/.test(await mc.textContent('#syncline')), await mc.textContent('#syncline'));
  await mc.click('[data-act=pick][data-id=son]'); await mc.waitForSelector('.world'); await startNode(mc, 'A1'); await play(mc); await idle(mc);
  ok('state file written on the server side', fs.existsSync(path.join(STATE, 'p.son.json')) && read('son').runs.length === 1 && Object.keys(read('son').words).length === 10);
  const ip = await open(ipad, 'today=2026-12-11&triage=off&seed=4&sound=off&fast=1', true);
  const ipadSon = await state(ip, 'son');
  ok('a second device starts with the first one\'s progress', ipadSon && Object.keys(ipadSon.words).length === 10 && ipadSon.map.worlds['d1-01'].cleared.A1 === '2026-12-10');
  await ip.click('[data-act=pick][data-id=son]'); await ip.waitForSelector('.world');
  ok('its map shows the cleared tile and the next one open', /\bcleared\b/.test(await nodeStatus(ip, 'A1')) && /\bopen\b/.test(await nodeStatus(ip, 'A2')));
  ok('the other child\'s document was not created', !fs.existsSync(path.join(STATE, 'p.daughter.json')));
  await mc.evaluate(() => localStorage.clear());                                  // the browser threw its storage away
  await mc.goto(BASE + '?set=demo&today=2026-12-12&triage=off&seed=5&sound=off&fast=1'); await mc.waitForSelector('.profiles');
  ok('a wiped browser gets everything back from the server', Object.keys((await state(mc, 'son')).words).length === 10);

  // server unreachable: the run still saves on the device, says so, and uploads later
  await mc.route('**/api/**', (r) => r.abort());
  await mc.click('[data-act=pick][data-id=son]'); await mc.waitForSelector('.world'); await startNode(mc, 'B1'); await play(mc);
  ok('a run completes and is kept on the device while the server is unreachable', (await state(mc, 'son')).runs.length === 2 && await mc.evaluate(() => window.__cards.sync.pending.includes('p.son')));
  ok('the server has not seen it yet', read('son').runs.length === 1);
  // meanwhile the other device plays another tile and uploads first
  await ip.click('[data-act=today]').catch(() => {}); await startNode(ip, 'C1'); await play(ip); await idle(ip);
  ok('the other device\'s run reached the server', read('son').runs.length === 2 && read('son').runs.some((r) => r.tag === 'C1'));
  await mc.unroute('**/api/**'); await mc.evaluate(() => window.__cards.sync.flush()); await idle(mc);
  const merged = read('son'); const macSt = await state(mc, 'son');
  ok('after reconnecting, both devices\' tiles and runs are on the server', ['A1', 'B1', 'C1'].every((t) => merged.map.worlds['d1-01'].cleared[t]) && merged.runs.map((r) => r.tag).sort().join() === 'A1,B1,C1');
  ok('the device that reconnected holds the merged record too', JSON.stringify(Object.keys(macSt.map.worlds['d1-01'].cleared).sort()) === JSON.stringify(['A1', 'B1', 'C1']) && macSt.runs.length === 3);
  ok('merging touched no word schedule it should not: every word is on the server exactly once', Object.keys(merged.words).length === 30);
  await mc.click('[data-act=today]').catch(() => {}); await mc.click('[data-act=home]'); await mc.click('[data-act=parent]');
  await mc.waitForFunction(() => /연결됨/.test(document.querySelector('#sf-server')?.textContent || '') && document.querySelectorAll('#snap-son option').length >= 2, null, { timeout: 8000 });
  ok('the parent screen shows where the record is kept: device, server, dated copies, and that the off-site backup is not set up', /저장 중/.test(await mc.textContent('#safety')) && /1일치/.test(await mc.textContent('#sf-daily')) && /설정 안 됨/.test(await mc.textContent('#sf-off')) && await mc.$eval('#sf-off', (e) => e.classList.contains('bad')));
  const dayOpt = await mc.$eval('#snap-son option:nth-child(2)', (o) => o.value); await mc.evaluate(() => localStorage.removeItem('cards.v0.p.son'));
  await mc.selectOption('#snap-son', dayOpt); await mc.click('[data-act=snap][data-id=son]'); await mc.waitForFunction(() => /복원했어요/.test(document.querySelector('#pmsg')?.textContent || ''));
  ok('a dated copy on the server restores a record that was lost on the device', /0장 → 30장/.test(await mc.textContent('#pmsg')) && Object.keys((await state(mc, 'son')).words).length === 30, await mc.textContent('#pmsg'));
  ok('the state folder holds the dated copies and the previous versions', fs.readdirSync(path.join(STATE, 'daily')).filter((f) => f.startsWith('p.son.')).length === 1 && fs.readdirSync(path.join(STATE, 'backup')).length >= 1);
  await mc.close(); await ip.close(); await mac.close(); await ipad.close();
  // a plain static host (no state API): the home screen says device-only
  const sctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  await sctx.route('**/api/**', (r) => r.fulfill({ status: 404, body: 'nope' }));
  const s1 = await open(sctx, 'today=2026-12-14&sound=off', true);
  ok('without a state API the home screen says device-only', /이 기기만/.test(await s1.textContent('#syncline')), await s1.textContent('#syncline'));
  await s1.close(); await sctx.close();

  // 12. tile triage (on by default): the tile's new words as a list, the unknown ones tapped and taught, a spot check or two
  //     of the rest, and 30 days later a sample check of each bunch mixed into another run
  const tctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const t = await open(tctx, 'today=2026-11-12&seed=31&sound=off&fast=1'); await t.click('[data-act=pick][data-id=son]'); await t.waitForSelector('.world');
  const curT = (p) => p.evaluate(() => { const r = window.__cards.run; const it = r && r.current; return it ? { id: it.id, form: it.form, role: it.role, taught: !!it.taught, verifying: !!it.verifying, ans: it.options ? it.options.findIndex((o) => o.id === it.id) : -1 } : null; });
  async function playTri(p, knows = () => true) {                                   // a taught card has only "뜻 보기"; every check is answered by knows(id)
    const seen = [];
    for (let k = 0; k < 400; k++) {
      await p.waitForSelector(READY, { timeout: 8000 }); if (await p.$('.tiles')) break;
      const it = await curT(p); if (!it) continue; if (!it.verifying) seen.push(it);
      if (it.form === 'check' || it.verifying) await answer(p, `.opt[data-i="${it.role === 'relearn' || knows(it.id) ? it.ans : (it.ans + 1) % 3}"]`);
      else await answer(p, it.taught ? '.act.see' : '.act.yes');
    }
    return seen;
  }
  const fits = (p) => p.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1 && document.querySelector('#tgo').getBoundingClientRect().bottom <= innerHeight && [...document.querySelectorAll('.tw')].every((b) => b.getBoundingClientRect().bottom <= innerHeight));
  await t.click('[data-act=node][data-id=A1]'); await t.waitForSelector('.twords');
  const listIds = await t.$$eval('.tw', (bs) => bs.map((b) => b.dataset.id)); const appText = await t.textContent('#app');
  const glossShown = TILE('A1').map((id) => WORDS.find((w) => w.id === id)).filter((w) => appText.includes(w.ko)).map((w) => w.ko);
  ok('triage: pressing a tile shows its 10 new words as spellings, with no meaning or picture and no run started', listIds.length === 10 && listIds.slice().sort().join() === TILE('A1').slice().sort().join() && glossShown.length === 0 && !(await t.$('#app img.px, #app .emoji, .run')) && /모르는 단어를 눌러요/.test(await t.textContent('h1')), glossShown.join());
  const land = await fits(t); await t.setViewportSize({ width: 768, height: 950 }); const port = await fits(t); await t.setViewportSize({ width: 1180, height: 820 });
  ok('triage: the 10 words and the button fit without scrolling in landscape (1180x820) and portrait (768x950)', land && port, `landscape ${land} portrait ${port}`);
  const goText = () => t.textContent('#tgo'); const g0 = await goText();
  for (const id of listIds.slice(0, 3)) await t.click(`.tw[data-id="${id}"]`); const g3 = await goText();
  await t.click(`.tw[data-id="${listIds[0]}"]`); const g2 = await goText(); const pressed = await t.$eval(`.tw[data-id="${listIds[0]}"]`, (b) => b.getAttribute('aria-pressed'));
  for (const id of listIds.slice(1, 3)) await t.click(`.tw[data-id="${id}"]`); const gNone = await goText();
  ok('triage: tapping marks and unmarks a word; the button reads "N개 배우러 가기" or "다 알아요"; no sound banner', g0 === '다 알아요' && g3 === '3개 배우러 가기' && g2 === '2개 배우러 가기' && pressed === 'false' && gNone === '다 알아요' && await t.$eval('#banner', (b) => b.hidden), [g0, g3, g2, pressed, gNone].join('|'));
  const marked = listIds.slice(0, 3); for (const id of marked) await t.click(`.tw[data-id="${id}"]`);
  await t.click('#tgo'); await t.waitForSelector(READY);
  const firstTaughtBtn = async () => { const q = await t.evaluate(() => window.__cards.run.queue.map((x) => x.role)); return q; };
  const q0 = await firstTaughtBtn(); const seenT = [];
  for (let k = 0; k < 400; k++) {                                                    // play, and look at the buttons of the first taught card
    await t.waitForSelector(READY, { timeout: 8000 }); if (await t.$('.tiles')) break; const it = await curT(t); if (!it) continue; if (!it.verifying) seenT.push(it);
    if (it.taught && !seenT.btns) seenT.btns = await t.$$eval('#actions button', (bs) => bs.map((b) => b.textContent));
    if (it.form === 'check' || it.verifying) await answer(t, `.opt[data-i="${it.ans}"]`); else await answer(t, it.taught ? '.act.see' : '.act.yes');
  }
  const taughtIds = seenT.filter((x) => x.role === 'new').map((x) => x.id);
  ok('triage: the spot checks of passed words come first; only the marked words are taught, with one button "뜻 보기"', q0[0] === 'spot' && q0[1] === 'spot' && seenT[0].role === 'spot' && seenT[1].role === 'spot' && !marked.includes(seenT[0].id) && !marked.includes(seenT[1].id)
    && taughtIds.length === 3 && taughtIds.slice().sort().join() === marked.slice().sort().join() && seenT.filter((x) => x.role === 'new').every((x) => x.taught && x.form === 'judge') && JSON.stringify(seenT.btns) === '["뜻 보기"]', q0.join() + ' ' + JSON.stringify(seenT.btns));
  let tson = await state(t, 'son'); const passedA1 = listIds.slice(3);
  ok('triage: the tile is cleared; passed words are silver with no date in bunch A1 (due in 30 days); marked words are on the 1-day review', /칸 클리어/.test(await t.textContent('h1'))
    && passedA1.every((id) => tson.words[id].st === 'likely' && tson.words[id].due === null && tson.words[id].bunch === 'A1') && marked.every((id) => tson.words[id].st === 'review' && tson.words[id].due === '2026-11-13')
    && JSON.stringify(tson.bunches) === '{"A1":{"due":"2026-12-12","done":null}}' && tson.v === 2 && tson.map.bat.fill === 3, JSON.stringify(tson.bunches) + ' fill ' + tson.map.bat.fill);
  await toMap(t); await t.click('[data-act=node][data-id=B1]'); await t.waitForSelector('.twords'); await t.click('#tgo'); await t.waitForSelector(READY);
  const qB = await t.evaluate(() => window.__cards.run.queue.map((x) => x.role)); const seenB = await playTri(t); tson = await state(t, 'son');
  ok('triage: a tile where every word is known asks only the two spot checks and is cleared', qB.join() === 'spot,spot' && seenB.length === 2 && /칸 클리어/.test(await t.textContent('h1')) && TILE('B1').every((id) => tson.words[id].st === 'likely' && tson.words[id].bunch === 'B1'), qB.join());
  await t.close();
  const t30 = await open(tctx, 'today=2026-12-12&seed=32&sound=off&fast=1'); await t30.click('[data-act=pick][data-id=son]'); await t30.waitForSelector('.world');
  await t30.click('[data-act=node][data-id=C1]'); await t30.waitForSelector('.twords'); await t30.click('#tgo'); await t30.waitForSelector(READY);
  const q30 = await t30.evaluate(() => window.__cards.run.queue.map((x) => x.role + ':' + (x.bunch || ''))); const seen30 = await playTri(t30); const s30 = await state(t30, 'son');
  const audits = q30.filter((x) => x.startsWith('audit:'));
  ok('bunch check: 30 days later another tile run mixes in 3 sample cards from each due bunch (A1, B1), after its spot checks', audits.length === 6 && audits.filter((x) => x === 'audit:A1').length === 3 && audits.filter((x) => x === 'audit:B1').length === 3 && q30.slice(0, 2).every((x) => x.startsWith('spot:')) && seen30.filter((x) => x.role === 'audit').length === 6, q30.join());
  ok('bunch check: all samples right -> every passed word of both bunches is gold and the bunches are closed "ok"', passedA1.concat(TILE('B1')).every((id) => s30.words[id].st === 'done' && s30.words[id].due === null) && s30.bunches.A1.result === 'ok' && s30.bunches.B1.result === 'ok' && s30.bunches.A1.done === '2026-12-12' && s30.bunches.C1.done === null, JSON.stringify(s30.bunches));
  await t30.click('[data-act=today]'); await t30.waitForSelector('.world'); await t30.click('[data-act=home]'); await t30.click('[data-act=parent]'); const ptext = await t30.textContent('.parent');
  ok('parent view shows the spot-check accuracy of passed words and the bunch checks passed / finished', /넘긴 단어 확인 정답률 100% \(6\/6\)/.test(ptext) && /묶음 확인 2\/2/.test(ptext), (/넘긴 단어[^,]*/.exec(ptext) || [''])[0] + ' ' + (/묶음 확인 \d+\/\d+/.exec(ptext) || [''])[0]);
  await t30.close(); await tctx.close();

  // 13. fixes from the cross review C-005 (card T-011)
  // F1: two tabs of one browser. A record a newer program wrote in tab B stops tab A; a record of the same program is merged.
  const f1ctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const ta = await open(f1ctx, 'today=2026-11-12&triage=off&seed=41&sound=off&fast=1'); await ta.click('[data-act=pick][data-id=son]'); await ta.waitForSelector('.world');
  const tb = await open(f1ctx, 'today=2026-11-12&triage=off&seed=41&sound=off&fast=1');
  const futureT = await tb.evaluate(() => { const k = 'cards.v0.p.son'; const s = JSON.parse(localStorage.getItem(k)); s.v = 3; s.futureOnly = true; s.words.futureWord = { st: 'done' }; const t = JSON.stringify(s); localStorage.setItem(k, t); return t; });
  await ta.click('[data-act=node][data-id=A1]'); await sleep(150);
  ok('F1: after tab B saved a record of a newer program, tab A starts no run, asks for a reload and writes nothing', !(await ta.$('.run')) && /오래됐어요/.test(await ta.textContent('#banner')) && (await ta.evaluate(() => localStorage.getItem('cards.v0.p.son'))) === futureT && await ta.evaluate(() => window.__cards.readonly));
  await ta.evaluate(() => document.querySelector('[data-act=home]').click()); await ta.click('[data-act=pick][data-id=son]'); await ta.waitForSelector('.world');   // the reload banner lies over the back button
  ok('F1: tab A still writes nothing after going back to the map', (await ta.evaluate(() => localStorage.getItem('cards.v0.p.son'))) === futureT);
  await ta.close(); await tb.close(); await f1ctx.close();
  const f1b = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const tc = await open(f1b, 'today=2026-11-12&triage=off&seed=42&sound=off&fast=1'); await tc.click('[data-act=pick][data-id=son]'); await tc.waitForSelector('.world');
  const td = await open(f1b, 'today=2026-11-12&triage=off&seed=42&sound=off&fast=1'); const otherW = TILE('U1');
  await td.evaluate((ids) => { const k = 'cards.v0.p.son'; const s = JSON.parse(localStorage.getItem(k)); for (const id of ids) s.words[id] = { st: 'likely', lstep: 0, due: '2026-11-19', firstDay: '2026-11-12', lastDay: '2026-11-12', lapses: 0 }; localStorage.setItem(k, JSON.stringify(s)); }, otherW);
  await startNode(tc, 'A1'); await play(tc); await tc.waitForSelector('.tiles');
  const both = await state(tc, 'son');
  ok('F1: tab B saved more words of the same format, then tab A played and saved: both tabs\' words are kept', otherW.every((id) => both.words[id] && both.words[id].st === 'likely') && TILE('A1').every((id) => both.words[id]) && both.v === 2, Object.keys(both.words).length + ' words');
  await tc.close(); await td.close(); await f1b.close();

  // F6: every world and castle done, 3 words still to learn: a review button on the map starts a run of those 3
  const f6 = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const r6 = await open(f6, 'today=2026-11-16&triage=off&seed=43&sound=off&fast=1');
  const learn6 = await r6.evaluate(() => { const G = window.__cards; const s = { v: 2, id: 'son', words: {}, verify: [], runs: [], log: [], bunches: {}, map: { stars: 0, items: { shield: 0, flame: 0 }, bag: null, monsterDay: null, bonusDay: null, best: 0, keys: G.ix.worlds.length, worlds: {}, conts: {}, at: null, bat: { fill: 0, cap: 40, met: [], last: null } } };
    for (const w of G.words) s.words[w.id] = { st: 'done', due: null, firstDay: '2026-11-01', lastDay: '2026-11-01', lapses: 0 };
    for (const w of G.ix.worlds) s.map.worlds[w.id] = { castle: '2026-11-10', cleared: {}, stamps: {}, seen: '2026-11-01' }; for (const c of G.ix.continents) s.map.conts[c.id] = { castle: '2026-11-10' };
    const ids = G.words.filter((w) => w.ko).slice(0, 3).map((w) => w.id); for (const id of ids) s.words[id] = { st: 'learn', due: '2026-11-15', firstDay: '2026-11-01', lastDay: '2026-11-14', lapses: 0 };
    s.map.at = G.ix.worlds.at(-1).id; localStorage.setItem('cards.v0.p.son', JSON.stringify(s)); return ids; });
  await r6.click('[data-act=pick][data-id=son]'); await r6.waitForSelector('.world');
  ok('F6: all done but 3 words to learn: no monster, a "복습 3장" button', !(await r6.$('[data-id=monster]')) && /복습 3장/.test((await r6.textContent('[data-id=review]').catch(() => '')) || ''));
  await startNode(r6, 'review'); const q6 = await r6.evaluate(() => window.__cards.run.queue.map((q) => q.role + ':' + q.id));
  ok('F6: the review run starts with those 3 words as re-tries', q6.length === 3 && learn6.every((id) => q6.includes('retry:' + id)), q6.join());
  await play(r6, () => true); await r6.waitForSelector('.tiles'); const s6 = await state(r6, 'son');
  ok('F6: after the run the words are on the 1-day review and the button is gone', learn6.every((id) => s6.words[id].st === 'review') && /\+\d+/.test(await r6.textContent('.gain')) && await (async () => { await toMap(r6); return !(await r6.$('[data-id=review]')); })());
  await r6.close(); await f6.close();

  // F7: leaving a tile with only the last re-check to go keeps it open and the next tile locked; finishing a run of it later clears it
  const f7 = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const q7 = 'today=2026-11-12&triage=off&seed=44&sound=off&fast=1'; let p7 = await open(f7, q7); await p7.click('[data-act=pick][data-id=son]'); await p7.waitForSelector('.world');
  await startNode(p7, 'A1'); const miss7 = await p7.evaluate(() => { window.__cards.run.rng = () => 0.9; return window.__cards.run.queue[9].id; });   // 0.9: no "know" is checked
  for (let k = 0; k < 30; k++) { await p7.waitForSelector(READY); const it = await cur(p7); if (it.role !== 'new') break; await answer(p7, it.id === miss7 ? '.act.no' : '.act.yes'); }
  const left7 = await p7.evaluate(() => ({ left: window.__cards.run.left, role: window.__cards.run.current.role }));
  await p7.click('[data-act=quit]'); await p7.waitForSelector('.tiles'); const end7 = await p7.textContent('h1'); await toMap(p7);
  const s7 = await state(p7, 'son');
  ok('F7: left with only the last re-check to go: not cleared, the tile stays open and the next tile is locked', left7.left === 1 && left7.role === 'relearn' && !/칸 클리어/.test(end7) && Object.keys(s7.words).length === 10 && s7.map.worlds['d1-01'].open.A1 === '2026-11-12'
    && /\bopen\b/.test(await nodeStatus(p7, 'A1')) && /\blocked\b/.test(await nodeStatus(p7, 'A2')) && /0\/6칸/.test(await p7.textContent('#wtitle')), JSON.stringify(left7) + ' ' + end7);
  await p7.close(); p7 = await open(f7, q7); await p7.click('[data-act=pick][data-id=son]'); await p7.waitForSelector('.world');
  ok('F7: the same after a reload', /\bopen\b/.test(await nodeStatus(p7, 'A1')) && /\blocked\b/.test(await nodeStatus(p7, 'A2')));
  await startNode(p7, 'A1');
  ok('F7: going back in finishes the tile (nothing left to show today): cleared, the next tile opens', /칸 클리어/.test(await p7.textContent('h1')) && await (async () => { await toMap(p7); return /\bcleared\b/.test(await nodeStatus(p7, 'A1')) && /\bopen\b/.test(await nodeStatus(p7, 'A2')); })() && !(await state(p7, 'son')).map.worlds['d1-01'].open.A1);
  await p7.close(); await f7.close();

  // F10: a bat test that leaves enough put-off reviews for another bat does not say the gauge goes back to 0
  const f10 = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const b10 = await open(f10, 'today=2026-11-20&triage=off&seed=45&sound=off&fast=1');
  await b10.evaluate(() => { const s = { v: 2, id: 'daughter', words: {}, verify: [], runs: [], log: [], bunches: {} }; for (const w of window.__cards.words.filter((x) => x.ko)) s.words[w.id] = { st: 'review', step: 1, due: '2026-11-01', firstDay: '2026-10-20', lastDay: '2026-10-25', lapses: 0 };
    localStorage.setItem('cards.v0.p.daughter', JSON.stringify(s)); });
  await b10.click('[data-act=pick][data-id=daughter]'); await b10.waitForSelector('.world');
  ok('F10: 80 put-off reviews bring the bat', !!(await b10.$('[data-id=bat]')));
  await startNode(b10, 'bat'); await play(b10, () => true); await b10.waitForSelector('.tiles'); const page10 = await b10.textContent('.page');
  ok('F10: the bat test is done but bats will come again: no "goes back to 0"', /박쥐를 쫓아냈어요/.test(await b10.textContent('h1')) && !/0으로 돌아가요/.test(page10) && /25\/25장/.test(page10) && await (async () => { await toMap(b10); return !!(await b10.$('[data-id=bat]')); })(), page10.slice(0, 160));
  await b10.close(); await f10.close();

  ok('no uncaught page errors / console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close(); server.kill();
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('cards e2e crashed', e); try { server.kill(); } catch {} process.exit(2); });
