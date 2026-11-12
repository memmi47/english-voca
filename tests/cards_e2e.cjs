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
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cards', 'data', 'words.json'), 'utf8'));
const WORDS = DATA.words; const WORLD = DATA.world;
const TILE = (id) => WORLD.roads.flatMap((r) => r.tiles).find((t) => t.id === id).words;
const KNOWN = new Set(WORDS.filter((w, i) => (i * 5) % 7 < 3).map((w) => w.id));   // a mix in every tile     // what this pretend child really knows
const READY = '.act.yes:not([disabled]), .opt:not([disabled]), .tiles';

// Most tests run with nosync=1 (pure on-device behaviour); the sharing tests pass sync = true.
async function open(ctx, q, sync = false) {
  if (!sync) q += '&nosync=1';
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + '?' + q); await page.waitForSelector('.profiles'); return page;
}
const state = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem('cards.v0.p.' + i)), id);
const cur = (page) => page.evaluate(() => { const r = window.__cards.run; const it = r && r.current; return it ? { id: it.id, form: it.form, role: it.role, verifying: !!it.verifying, ans: it.options ? it.options.findIndex((o) => o.id === it.id) : -1 } : null; });
const nodeStatus = (page, id) => page.$eval(`[data-act=node][data-id=${id}]`, (b) => b.className.replace('node', '').trim());
// A node is pressed on its picture, like a finger would.
async function startNode(page, id) { await page.click(`[data-act=node][data-id=${id}] img`); await page.waitForSelector(READY, { timeout: 8000 }); }
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
  let page = await open(ctx, 'today=2026-11-12&seed=5&sound=off&fast=1');

  // 1. the map
  await page.click('[data-act=pick][data-id=son]'); await page.waitForSelector('.world');
  const first = await Promise.all(['A1', 'B1', 'C1'].map((id) => nodeStatus(page, id))); const second = await Promise.all(['A2', 'B2', 'C2', 'castle', 'bonus'].map((id) => nodeStatus(page, id)));
  ok('map: first tile of every road is open, the rest are locked', first.every((c) => /\bopen\b/.test(c)) && second.every((c) => /\blocked\b/.test(c)), first.join('|') + ' / ' + second.join('|'));
  await page.click('[data-act=node][data-id=A2] img'); ok('a locked tile explains itself and does not start', /앞 칸을 먼저/.test(await page.textContent('#msg')) && !(await page.$('.run')));
  ok('map fits one screen width and tiles are labelled', await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1) && (await page.$$('.node .lbl')).length >= 9);
  ok('pixel font and a clear word font are both in use', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Galmuri11') && /Galmuri11/.test(getComputedStyle(document.body).fontFamily) && !/Galmuri11/.test(getComputedStyle(document.documentElement).getPropertyValue('--word')); }));

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
  ok('run record has timing, counts and the tile', son.runs.length === 1 && son.runs[0].tag === 'A1' && son.runs[0].fresh === 11 && son.runs[0].wall > 0 && son.runs[0].stars > 0);
  ok('end screen: tile cleared, stars, cards', /칸 클리어/.test(await page.textContent('h1')) && /⭐ \+\d+/.test(await page.textContent('.gain')) && /넘긴 카드/.test(await page.textContent('.tiles')));
  await toMap(page);
  ok('cleared tile gets a flag; the next tile on the road opens; stars are shown', /\bcleared\b/.test(await nodeStatus(page, 'A1')) && /\bopen\b/.test(await nodeStatus(page, 'A2')) && /⭐ [1-9]/.test(await page.textContent('.maphud')));

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
  const d2 = await open(ctx, 'today=2026-11-13&seed=6&sound=off&fast=1');
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
  const w1 = await open(wctx, 'today=2026-12-01&seed=11&sound=off&fast=1'); await w1.click('[data-act=pick][data-id=daughter]'); await w1.waitForSelector('.world');
  for (const id of ['A1', 'A2', 'B1']) { await startNode(w1, id); await play(w1); await toMap(w1); }
  ok('castle stays locked with one road done', /\blocked\b/.test(await nodeStatus(w1, 'castle')) && /두 길/.test(await (async () => { await w1.click('[data-act=node][data-id=castle] img'); return w1.textContent('#msg'); })()));
  ok('the gauge shows 31 of 40 after three tiles', /31\/40/.test(await w1.textContent('#batgauge')));
  await startNode(w1, 'B2'); await play(w1);
  ok('the fourth tile fills the gauge: the end screen announces the bats and offers the test', /박쥐 게이지가 가득/.test(await w1.textContent('.page')) && (await w1.$eval('.go', (b) => b.dataset.act)) === 'bat-go');
  await toMap(w1);
  ok('full gauge: the bat node appears and every other node says the bats come first', !!(await w1.$('[data-id=bat]')) && /\bblocked\b/.test(await nodeStatus(w1, 'castle')) && /\bblocked\b/.test(await nodeStatus(w1, 'C1')));
  await w1.click('[data-act=node][data-id=C1] img'); ok('a tile cannot start while the gauge is full', /박쥐/.test(await w1.textContent('#msg')) && !(await w1.$('.run')));
  await startNode(w1, 'bat'); const batQ = await w1.evaluate(() => window.__cards.run.queue.map((q) => q.form + ':' + q.role));
  ok('the bat test is 25 check cards over the words just met', batQ.length === 25 && batQ.every((x) => x.startsWith('check:')), batQ.length + ' ' + batQ[0]);
  await w1.click('[data-act=quit]'); await w1.waitForSelector('.tiles');
  ok('leaving the test early keeps the gauge full', /박쥐가 남았어요/.test(await w1.textContent('h1')) && (await state(w1, 'daughter')).map.bat.fill === 40);
  await w1.click('[data-act=bat-go]'); await w1.waitForSelector(READY); await play(w1); await w1.waitForSelector('.tiles');
  const batDone = await state(w1, 'daughter');
  ok('passing the test empties the gauge and raises the capacity to 50', /박쥐를 쫓아냈어요/.test(await w1.textContent('h1')) && batDone.map.bat.fill === 0 && batDone.map.bat.cap === 50 && batDone.runs.at(-1).tag === 'bat', JSON.stringify(batDone.map.bat));
  await toMap(w1);
  ok('castle opens after two roads', /\bopen\b/.test(await nodeStatus(w1, 'castle')) && !(await w1.$('[data-id=bat]')));
  await w1.click('[data-act=node][data-id=castle] img'); await w1.waitForSelector(READY);
  const castleQ = await w1.evaluate(() => window.__cards.run.queue.map((q) => q.role + ':' + q.form));
  ok('castle is a check-only run of 12 cards', castleQ.length === 12 && castleQ.every((x) => x === 'castle:check'));
  await play(w1); await w1.waitForSelector('.tiles');
  ok('passing the castle gives a key', /성을 깼어요/.test(await w1.textContent('h1')) && /🔑/.test(await w1.textContent('.page')));
  await toMap(w1);
  ok('castle shows cleared, key counted, leftover road is bonus x2', /\bcleared\b/.test(await nodeStatus(w1, 'castle')) && /🔑 1/.test(await w1.textContent('.maphud')) && (await w1.$$('.node .x2')).length === 2);   // both tiles of the leftover road
  const starsBefore = await w1.evaluate(() => window.__cards.st.map.stars);
  await startNode(w1, 'C1'); await play(w1); const gain = Number((/\+(\d+)/.exec(await w1.textContent('.gain')) || [])[1]);
  ok('bonus road pays double stars', /\(×2\)/.test(await w1.textContent('.gain')) && gain > 0 && (await state(w1, 'daughter')).map.stars === starsBefore + gain, 'gain=' + gain);
  const dau = await state(w1, 'daughter');
  ok('map rewards left no trace in any word record', Object.values(dau.words).every((r) => !('stars' in r) && !('item' in r) && !('bonus' in r)));
  await toMap(w1);

  // 7. lightning round: opens once words are ripe, touches no word, drops an item, once a day
  ok('bonus house is open', /\bopen\b/.test(await nodeStatus(w1, 'bonus')));
  const wordsBefore = JSON.stringify((await state(w1, 'daughter')).words);
  await w1.click('[data-act=node][data-id=bonus] img'); await w1.waitForSelector('[data-act=lt-yes]');
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
  const m1 = await open(mctx, 'today=2026-12-02&seed=3&sound=off&fast=1'); await m1.click('[data-act=pick][data-id=daughter]'); await m1.waitForSelector('.world');
  await m1.evaluate(() => { const st = JSON.parse(localStorage.getItem('cards.v0.p.daughter') || 'null') || { v: 0, id: 'daughter', words: {}, verify: [], runs: [], log: [] };
    const ids = window.__cards.words.slice(0, 10).map((w) => w.id); for (const id of ids) st.words[id] = { st: 'review', step: 0, due: '2026-12-02', firstDay: '2026-12-01', lastDay: '2026-12-01', lapses: 0 };
    localStorage.setItem('cards.v0.p.daughter', JSON.stringify(st)); });
  await m1.click('[data-act=home]'); await m1.click('[data-act=pick][data-id=daughter]'); await m1.waitForSelector('.world');
  ok('10 due reviews put a monster on the map', !!(await m1.$('[data-id=monster]')) && /몬스터 10/.test(await m1.textContent('[data-id=monster]')));
  ok('the monster blocks nothing: road tiles stay open', /\bopen\b/.test(await nodeStatus(m1, 'A1')) && /\bopen\b/.test(await nodeStatus(m1, 'C1')));
  ok('the parent view lists the overdue reviews and the gauge', await (async () => { await m1.click('[data-act=home]'); await m1.click('[data-act=parent]'); const t = await m1.textContent('.parent'); await m1.click('[data-act=home]'); await m1.click('[data-act=pick][data-id=daughter]'); await m1.waitForSelector('.world'); return /밀린 복습 10장/.test(t) && /박쥐 0\/40/.test(t); })());
  await m1.click('[data-act=node][data-id=monster] img'); await m1.waitForSelector(READY);
  const mq = await m1.evaluate(() => window.__cards.run.queue.map((q) => q.role));
  ok('monster run is reviews only', mq.length === 10 && mq.every((r) => r === 'review'), mq.join());
  await play(m1); await m1.waitForSelector('.tiles');
  ok('beating the monster gives double stars and an item', /물리쳤어요/.test(await m1.textContent('h1')) && /\(×2\)/.test(await m1.textContent('.gain')) && /얻었어요/.test(await m1.textContent('.page')));
  await toMap(m1);
  ok('monster is gone and the roads are still open', !(await m1.$('[data-id=monster]')) && /\bopen\b/.test(await nodeStatus(m1, 'A1')));
  await m1.close(); await mctx.close();

  // 9. sound: a file from the manifest is used when present
  const fctx = await browser.newContext({ viewport: { width: 768, height: 950 }, hasTouch: true });
  const mp3 = fs.readdirSync(path.join(__dirname, '..', 'game', 'audio', 'dev')).find((f) => f.endsWith('.mp3'));
  await fctx.route('**/audio/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: Object.fromEntries(WORDS.map((w) => [w.id, 'x.mp3'])) }) }));
  await fctx.route('**/audio/x.mp3', (r) => r.fulfill({ contentType: 'audio/mpeg', body: fs.readFileSync(path.join(__dirname, '..', 'game', 'audio', 'dev', mp3)) }));
  const f1 = await open(fctx, 'today=2026-11-12&seed=7&fast=1');
  await f1.click('[data-act=pick][data-id=daughter]'); await f1.waitForSelector('.world');
  ok('map screen says audio files are in use', /음원 파일/.test(await f1.textContent('#src')));
  ok('map fits the portrait screen without sideways scroll', await f1.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1));
  await f1.click('[data-act=node][data-id=C1] img'); await f1.waitForSelector('.act.yes:not([disabled])', { timeout: 8000 });
  ok('buttons open after the word was played from a file', await f1.evaluate(() => window.__cards.run.current.sound) === 'file');
  ok('card and both buttons fit on one screen (portrait)', await f1.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1));
  await f1.close(); await fctx.close();

  // 10. sound failure: no file and no system voice -> card stays locked, banner offers retry; parent can continue
  const nctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  await nctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); });
  const n1 = await open(nctx, 'today=2026-11-12&seed=8&fast=1');
  await n1.click('[data-act=pick][data-id=daughter]'); await n1.waitForSelector('.world'); await n1.click('[data-act=node][data-id=A1] img');
  await n1.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
  ok('no sound: banner with retry, answer buttons stay locked', /다시 듣기/.test(await n1.textContent('#banner')) && await n1.$eval('.act.yes', (b) => b.disabled));
  await n1.click('[data-act=mute-go]');
  ok('parent override unlocks the card and is recorded as no sound', !(await n1.$eval('.act.yes', (b) => b.disabled)) && await n1.evaluate(() => window.__cards.run.current.sound) === 'none');
  await n1.close(); await nctx.close();

  // 11. record sharing: progress made on one device ("Mac mini") shows on another ("iPad"), survives a wiped browser,
  //     survives the server being unreachable, and two devices that played apart end up with both
  const read = (id) => JSON.parse(fs.readFileSync(path.join(STATE, `p.${id}.json`), 'utf8')).data;
  const idle = (p) => p.waitForFunction(() => window.__cards.sync && window.__cards.sync.pending.length === 0, null, { timeout: 8000 });
  const mac = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const ipad = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  const mc = await open(mac, 'today=2026-12-10&seed=3&sound=off&fast=1', true);
  ok('home says the record is kept on this device and the Mac server', /이 기기 \+ Mac 서버/.test(await mc.textContent('#syncline')), await mc.textContent('#syncline'));
  await mc.click('[data-act=pick][data-id=son]'); await mc.waitForSelector('.world'); await startNode(mc, 'A1'); await play(mc); await idle(mc);
  ok('state file written on the server side', fs.existsSync(path.join(STATE, 'p.son.json')) && read('son').runs.length === 1 && Object.keys(read('son').words).length === 11);
  const ip = await open(ipad, 'today=2026-12-11&seed=4&sound=off&fast=1', true);
  const ipadSon = await state(ip, 'son');
  ok('a second device starts with the first one\'s progress', ipadSon && Object.keys(ipadSon.words).length === 11 && ipadSon.map.cleared.A1 === '2026-12-10');
  await ip.click('[data-act=pick][data-id=son]'); await ip.waitForSelector('.world');
  ok('its map shows the cleared tile and the next one open', /\bcleared\b/.test(await nodeStatus(ip, 'A1')) && /\bopen\b/.test(await nodeStatus(ip, 'A2')));
  ok('the other child\'s document was not created', !fs.existsSync(path.join(STATE, 'p.daughter.json')));
  await mc.evaluate(() => localStorage.clear());                                  // the browser threw its storage away
  await mc.goto(BASE + '?today=2026-12-12&seed=5&sound=off&fast=1'); await mc.waitForSelector('.profiles');
  ok('a wiped browser gets everything back from the server', Object.keys((await state(mc, 'son')).words).length === 11);

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
  ok('after reconnecting, both devices\' tiles and runs are on the server', ['A1', 'B1', 'C1'].every((t) => merged.map.cleared[t]) && merged.runs.map((r) => r.tag).sort().join() === 'A1,B1,C1');
  ok('the device that reconnected holds the merged record too', JSON.stringify(Object.keys(macSt.map.cleared).sort()) === JSON.stringify(['A1', 'B1', 'C1']) && macSt.runs.length === 3);
  ok('merging touched no word schedule it should not: every word is on the server exactly once', Object.keys(merged.words).length === 11 + 9 + 10);
  await mc.close(); await ip.close(); await mac.close(); await ipad.close();
  // a plain static host (no state API): the home screen says device-only
  const sctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  await sctx.route('**/api/**', (r) => r.fulfill({ status: 404, body: 'nope' }));
  const s1 = await open(sctx, 'today=2026-12-14&sound=off', true);
  ok('without a state API the home screen says device-only', /이 기기만/.test(await s1.textContent('#syncline')), await s1.textContent('#syncline'));
  await s1.close(); await sctx.close();

  ok('no uncaught page errors / console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close(); server.kill();
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('cards e2e crashed', e); try { server.kill(); } catch {} process.exit(2); });
