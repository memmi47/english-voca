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
  if (!/(^|&)storm=/.test(q)) q += '&storm=off';                       // whirlwinds (T-008) only in section 14
  await page.goto(BASE + '?set=demo&' + q); await page.waitForSelector('.profiles'); return page;
}
const state = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem('cards.v0.p.' + i)), id);
const cur = (page) => page.evaluate(() => { const r = window.__cards.run; const it = r && r.current; return it ? { id: it.id, form: it.form, role: it.role, verifying: !!it.verifying, ans: it.options ? it.options.findIndex((o) => o.id === it.id) : -1 } : null; });
const nodeStatus = (page, id) => page.$eval(`[data-act=node][data-id=${id}]`, (b) => [...b.classList].filter(c=>['open','cleared','locked','blocked','used','done'].includes(c)).join(' '));
const nextCard = page => page.locator('[data-act=next]');
async function acknowledgeMeaning(page) {
  if (await nextCard(page).isVisible()) {
    await page.locator('#card.back.learn').waitFor();
    await nextCard(page).click();
  }
}
// A node is pressed on its picture, like a finger would.
async function startNode(page, id) { await page.click(`[data-act=node][data-id=${id}]`); await page.waitForSelector(READY, { timeout: 8000 }); }
async function answer(page, sel) {
  const i0 = await page.evaluate(() => window.__cards.run.i);
  await page.click(sel);
  await acknowledgeMeaning(page);
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
  fs.mkdirSync('/tmp/c011-screens',{recursive:true});
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
  await acknowledgeMeaning(page);
  await page.waitForFunction(() => window.__cards.run.i >= 1);
  const seen = await play(page); await page.waitForSelector('.tiles');
  let son = await state(page, 'son'); const a1 = TILE('A1').map((id) => WORDS.find((w) => w.id === id));
  ok('the tile introduced exactly its own words', Object.keys(son.words).sort().join() === TILE('A1').slice().sort().join());
  ok('known words become "likely" (silver), due in 7 days', a1.filter((w) => KNOWN.has(w.id)).every((w) => son.words[w.id].st === 'likely' && son.words[w.id].due === '2026-11-19'));
  ok('unknown words were learned: 1-day review', a1.filter((w) => !KNOWN.has(w.id)).every((w) => son.words[w.id].st === 'review' && son.words[w.id].step === 0 && son.words[w.id].due === '2026-11-13'));
  ok('unknown words came back in the same run, last time as a check', seen.some((x) => x.role === 'relearn' && x.form === 'check'), 'cards=' + seen.length);
  ok('run record has timing, counts and the tile', son.runs.length === 1 && son.runs[0].tag === 'A1' && son.runs[0].fresh === 10 && son.runs[0].wall > 0 && son.runs[0].stars > 0);
  ok('end screen: tile cleared, stars, cards', /칸 클리어/.test(await page.textContent('h1')) && /\+\d+/.test(await page.textContent('.gain')) &&
    await page.textContent('.result-cards span') === '푼 카드' && Number(await page.textContent('.result-cards b')) === son.runs[0].cards);
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
  await nextCard(page).click();
  await play(page, () => true); await page.waitForSelector('.tiles');
  son = await state(page, 'son');
  ok('verification results are kept for the parent view', son.runs[1].verifies >= 1 && son.verify.includes(false));
  ok('a caught false claim still lets the tile clear once every word was met', /칸 클리어/.test(await page.textContent('h1')));

  // 4. the other child is untouched; parent view lists the runs; home privacy mode hides all progress numbers
  ok('sibling record untouched', (await state(page, 'daughter')) === null);
  await toMap(page); await page.click('[data-act=home]'); await page.click('[data-act=parent]');
  ok('parent view shows runs, tile names, the check accuracy and stars', (await page.$$('.parent table tr')).length >= 3 && /확인 정답률/.test(await page.textContent('.parent')) && /별 \d+/.test(await page.textContent('.parent')) && /A1/.test(await page.textContent('.parent table')));
  await page.click('[data-act=home-progress]');
  await page.click('[data-act=home]');
  ok('home screen shows no numbers when the parent hides progress', !/\d/.test(await page.textContent('.profiles')));
  await page.click('[data-act=parent]'); await page.click('[data-act=home-progress]');

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

  // 6. exploration: stamps and K before a castle, check-only exam, key, bonus road x2, bag items
  const wctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true });
  for (const w of WORDS) KNOWN.add(w.id);
  const w1 = await open(wctx, 'today=2026-12-01&triage=off&seed=11&sound=off&fast=1'); await w1.click('[data-act=pick][data-id=daughter]'); await w1.waitForSelector('.world');
  await startNode(w1, 'A1'); await play(w1); await toMap(w1);
  await w1.click('[data-act=node][data-id=castle]');
  ok('castle stays locked until a path reaches it', /\blocked\b/.test(await nodeStatus(w1, 'castle')) && /성까지/.test(await w1.textContent('#msg')));
  for (const id of ['A2', 'B1']) { await startNode(w1, id); await play(w1); await toMap(w1); }
  ok('a reached castle stays locked at three of four villages with only stamp A; the gauge still shows 30 of 40', /\blocked\b/.test(await nodeStatus(w1, 'castle')) && /30\/40/.test(await w1.textContent('#batgauge')) && await w1.evaluate(()=>{const g=window.__cards;return g.world.castleRule.minTiles===4&&document.querySelector('#castle-gate .gate-villages').textContent==='마을 3/4'&&document.querySelector('#world-stamps [data-stamp=A]').dataset.collected==='true'&&document.querySelector('#world-stamps [data-stamp=B]').dataset.collected==='false';}));
  await startNode(w1, 'C1'); await play(w1);
  ok('the fourth tile fills the gauge: the end screen announces the bats and offers the test', /박쥐 게이지가 가득/.test(await w1.textContent('.page')) && (await w1.$eval('.go', (b) => b.dataset.act)) === 'bat-go');
  await toMap(w1);
  ok('full gauge: the bat node appears and every other node says the bats come first', !!(await w1.$('[data-id=bat]')) && /\bblocked\b/.test(await nodeStatus(w1, 'castle')) && /\bblocked\b/.test(await nodeStatus(w1, 'B2')));
  await w1.click('[data-act=node][data-id=B2]'); ok('a tile cannot start while the gauge is full', /박쥐/.test(await w1.textContent('#msg')) && !(await w1.$('.run')));
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
  ok('C013: both collected stamps agree on tiles, HUD and castle conditions; the gate uses an open door', await w1.evaluate(()=>['A','B'].every(id=>document.querySelector(`#world-stamps [data-stamp=${id}]`).dataset.collected==='true'&&document.querySelector(`#castle-gate [data-stamp=${id}]`).dataset.collected==='true'&&document.querySelector(`.node .gate-stamp[data-stamp=${id}]`).dataset.collected==='true')&&document.querySelector('#castle-gate').dataset.ready==='true'&&!!document.querySelector('.node.castle use[href="#c011-door-open"]')&&!!document.querySelector('#c013-stamp-a rect[fill="#387D74"]')&&!!document.querySelector('#c013-stamp-b rect[fill="#E89AA8"]')&&Object.keys(window.__cards.st.map.worlds['d1-01'].stamps).length===0&&!('gateStamps' in window.__cards.st.map.worlds['d1-01'])));
  fs.mkdirSync('/tmp/c013-screens',{recursive:true}); await w1.setViewportSize({width:1180,height:820}); await w1.screenshot({path:'/tmp/c013-screens/world-gates.png',animations:'disabled'}); await w1.setViewportSize({width:1024,height:700});
  await w1.click('[data-act=node][data-id=castle]'); await w1.waitForSelector(READY);
  const castleQ = await w1.evaluate(() => window.__cards.run.queue.map((q) => q.role + ':' + q.form));
  ok('castle is a check-only run of 12 cards', castleQ.length === 12 && castleQ.every((x) => x === 'castle:check'));
  await play(w1); await w1.waitForSelector('.tiles');
  ok('passing the castle gives a key', /성을 깼어요/.test(await w1.textContent('h1')) && /열쇠/.test(await w1.textContent('.page')));
  await toMap(w1);
  ok('castle shows cleared, key counted, what is left over is bonus x2', /\bcleared\b/.test(await nodeStatus(w1, 'castle')) && (await w1.textContent('.maphud .chip:nth-of-type(2)')).trim() === '1' && (await w1.$$('.node .x2')).length === 2);   // the house is off the path now: only the two left-over tiles   // the two tiles left over and the house
  const starsBefore = await w1.evaluate(() => window.__cards.st.map.stars);
  await startNode(w1, 'B2'); await play(w1); const gain = Number((/\+(\d+)/.exec(await w1.textContent('.gain')) || [])[1]);
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
  ok('music starts on, effects on', await v1.evaluate(() => window.__cards.sound.musicOn && window.__cards.sound.sfx));
  await v1.click('[data-act=music]'); await v1.waitForFunction(() => !window.__cards.sound.musicOn);
  await v1.click('[data-act=music]'); await v1.waitForSelector('.tgl.on');
  await v1.waitForFunction(() => window.__cards.sound.music && window.__cards.sound.music.on, null, { timeout: 8000 });
  ok('music toggle plays the map loop and is remembered', await v1.evaluate(() => window.__cards.sound.music.track.id === 'meadow' && JSON.parse(localStorage.getItem('cards.v0.pref')).music === true));
  await v1.evaluate(() => window.__cards.sound.sfxPlay('hit')); ok('effects can play through the real synth without errors', await v1.evaluate(() => window.__cards.sound.ctx.state !== 'closed'));
  await v1.goto(BASE + '?set=demo&today=2026-11-12&seed=9&fast=1&nosync=1&storm=off'); await v1.waitForSelector('.profiles');
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
  ok('castle with every tile and the house done: key, crown, the closing line and a way to the next world', !!(await x.$('#keygain')) && !!(await x.$('#crowngain')) && /장미 열쇠/.test(await x.textContent('#keygain')) && /꽃마루 문이 열렸어/.test(await x.textContent('.page')) && (await x.$eval('.go', (b) => b.dataset.act)) === 'celebration-atlas');
  const castlePresentationRecord = JSON.stringify(await state(x,'son'));
  await x.screenshot({path:'/tmp/c011-screens/castle-celebration.png',animations:'disabled'});
  await x.click('.go'); await x.waitForSelector('.atlas .door-stage'); await x.waitForSelector('.door-stage[data-phase=open] .go:not([disabled])');
  ok('C011: world celebration opens the door on atlas without changing child records', JSON.stringify(await state(x,'son')) === castlePresentationRecord && await x.$eval('#atlas-door use',(e)=>e.getAttribute('href')) === '#c011-door-open');
  await x.screenshot({path:'/tmp/c011-screens/atlas-door.png',animations:'disabled'});
  await x.click('.door-stage .go'); await x.waitForSelector('#world[data-world="d1-02"]');
  ok('the next world opens with its own colours and opening line', /상자 사이에/.test(await msg()) && await x.evaluate(() => document.documentElement.style.getPropertyValue('--w-ground') === '#E3B45B'));
  await x.click('[data-act=atlas]'); await x.waitForSelector('.atlas');
  const atl = await x.evaluate(() => ({ crown: !!document.querySelector('.wcard[data-id="d1-01"] use[href="#crown"]'), here: document.querySelector('.wcard.here').dataset.id, locked: document.querySelector('.wcard[data-id="d2-01"]').disabled, finale: document.querySelector('.wcard.finale[data-id="d1"]').className }));
  ok('world list: crown on the finished world, the current world marked, the next continent closed, the big castle locked', atl.crown && atl.here === 'd1-02' && atl.locked && /\blocked\b/.test(atl.finale), JSON.stringify(atl));
  await x.click('.wcard.finale[data-id="d1"]'); ok('the locked big castle says what it needs', /세계 성 1\/2/.test(await msg()) && /마을 6\/8 \(70%\)/.test(await msg()));
  await x.click('.wcard[data-id="d1-01"]'); await x.waitForSelector('#world[data-world="d1-01"]'); ok('an earlier world can be visited again', /왕관/.test(await x.textContent('#wtitle')));
  await x.click('[data-act=atlas]'); await x.click('.wcard[data-id="d1-02"]'); await x.waitForSelector('#world[data-world="d1-02"]');
  for (const id of ['T1', 'T2', 'T3', 'T4', 'T5']) { await startNode(x, id); await play(x); if (await x.$('[data-act=bat-go]')) { await x.click('[data-act=bat-go]'); await x.waitForSelector(READY); await play(x); await x.waitForSelector('.tiles'); } await toMap(x); }
  await startNode(x, 'k'); await play(x); await x.waitForSelector('.tiles'); await toMap(x);
  ok('with every world castle and enough villages the map points to the big castle', /큰 성에 도전/.test(await msg()));
  await x.click('[data-act=atlas]'); await x.waitForSelector('.wcard.finale.open'); await x.click('.wcard.finale[data-id="d1"]'); await x.waitForSelector(READY);
  const fq = await x.evaluate(() => window.__cards.run.queue.map((q) => q.role + ':' + q.form));
  ok('the big castle is a check-only run over the continent (10 cards in the demo)', fq.length === 10 && fq.every((q) => q === 'castle:check') && (await x.evaluate(() => window.__cards.node.pass)) === 0.7);
  await play(x); await x.waitForSelector('.tiles');
  ok('passing it opens the way to the next continent', /큰 성을 깼어요/.test(await x.textContent('h1')) && /굽이굽이 바다/.test(await x.textContent('.page')) && (await x.$eval('.go', (b) => b.dataset.act)) === 'celebration-atlas');
  const continentPresentationRecord = JSON.stringify(await state(x,'son'));
  await x.click('.go'); await x.waitForSelector('.atlas .door-stage.continent'); await x.waitForSelector('.door-stage[data-phase=open] .go:not([disabled])');
  ok('C011: continent celebration opens the next continent door without changing child records', JSON.stringify(await state(x,'son')) === continentPresentationRecord);
  await x.click('.door-stage .go'); await x.waitForSelector('#world[data-world="d2-01"]');
  ok('the second continent has its own music and colours', await x.evaluate(() => window.__cards.sound.seen.has('scene:sea') && document.documentElement.style.getPropertyValue('--w-ground') === '#75B7B1'));
  await x.click('[data-act=home]'); await x.click('[data-act=parent]');
  ok('the parent view counts keys, crowns and big castles', /열쇠 2\/3/.test(await x.textContent('.parent')) && /왕관 2/.test(await x.textContent('.parent')) && /큰 성 1\/2/.test(await x.textContent('.parent')) && /복습 정답률/.test(await x.textContent('.parent')));
  // C-010: actual recorded assets, real Web Audio sources and word-file playback.
  const gmSeed = await state(x, 'son'); gmSeed.map.at = 'd1-01'; gmSeed.words = {};
  const gmctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  await gmctx.addInitScript(() => localStorage.setItem('cards.v0.pref', JSON.stringify({music:false,sfx:true}))); // preserve explicit toggle setup under the new default
  await gmctx.addInitScript((st) => localStorage.setItem('cards.v0.p.son', JSON.stringify(st)), gmSeed);
  await gmctx.addInitScript(() => { window.__gmStarts = []; const start = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...args) { window.__gmStarts.push({ source: this, offset: args[1] || 0 }); return start.apply(this, args); }; });
  const gmWord = Buffer.alloc(44 + 32000); wav.copy(gmWord, 0, 0, 44); gmWord.writeUInt32LE(32036, 4); gmWord.writeUInt32LE(32000, 40);
  for (let i = 44; i < gmWord.length; i++) gmWord[i] = 128 + Math.round(18 * Math.sin((i - 44) * Math.PI * 2 * 220 / 8000));
  await gmctx.route('**/audio/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: Object.fromEntries(WORDS.map((w) => [w.id, 'gm-word.wav'])) }) }));
  await gmctx.route('**/audio/gm-word.wav', (r) => r.fulfill({ contentType: 'audio/wav', body: gmWord }));
  const gmPage = await open(gmctx, 'today=2026-12-20&triage=off&seed=9&fast=1'); const gmRequests = [];
  gmPage.on('request', (r) => { if (/music-gm\/.*\.m4a/.test(r.url())) gmRequests.push(r.url()); });
  await gmPage.click('[data-act=pick][data-id=son]'); await gmPage.click('[data-act=music]');
  await gmPage.waitForFunction(() => window.__cards.sound.music?.backend === 'gm');
  const gmFirst = await gmPage.evaluate(() => window.__cards.sound.music.file);
  await gmPage.click('[data-act=atlas]'); await gmPage.click('.wcard[data-id="d1-02"]');
  await gmPage.waitForFunction((first) => window.__cards.sound.music?.backend === 'gm' && window.__cards.sound.music.file !== first, gmFirst);
  ok('GM: two world maps play different recorded files with the logical meadow id', await gmPage.evaluate(() => window.__cards.sound.music.track.id === 'meadow' && window.__cards.sound.seen.has('scene:meadow')) && new Set(gmRequests).size >= 2);
  ok('GM: actual AudioBufferSourceNode loop boundaries and starting offset match the manifest', await gmPage.evaluate(async () => { const s = window.__cards.sound, m = s.music, manifest = await (await fetch('assets/postal/music-gm/manifest.json')).json(), e = manifest.tracks[m.assetId]; return m.source instanceof AudioBufferSourceNode && m.source.loop && m.source.loopStart === e.loopStart && m.source.loopEnd === e.loopEnd && m.startOffset === e.startOffset && window.__gmStarts.some((call) => call.source === m.source && call.offset === e.startOffset); }));
  await gmPage.click('[data-act=atlas]'); await gmPage.click('.wcard[data-id="d1-01"]'); await startNode(gmPage, 'A1');
  await gmPage.waitForFunction(() => { const s = window.__cards.sound; return s.music?.backend === 'gm' && s.music.ducked && s.el && !s.el.paused; });
  const gmDucked = await gmPage.evaluate(() => { const s = window.__cards.sound; return s.music.ducked && Math.abs(s.music.gainTarget - s.music.volume * .18) < 1e-8; });
  await gmPage.evaluate(() => window.__cards.sound.stop()); await gmPage.waitForTimeout(200);
  ok('GM: real card word playback ducks music to 0.18 and word stop restores it', gmDucked && await gmPage.evaluate(() => !window.__cards.sound.music.ducked && Math.abs(window.__cards.sound.music.gainTarget - window.__cards.sound.music.volume) < 1e-8));
  await gmPage.close(); await gmctx.close();
  const blockedctx = await browser.newContext(); const blockedErrors = [];
  await blockedctx.addInitScript(() => localStorage.setItem('cards.v0.pref', JSON.stringify({music:false,sfx:true}))); // explicit toggle setup
  await blockedctx.route('**/assets/postal/music-gm/*.m4a', (r) => r.abort());
  const blockedPage = await open(blockedctx, 'today=2026-11-12&seed=9&fast=1'); blockedPage.on('pageerror', (e) => blockedErrors.push(String(e)));
  await blockedPage.click('[data-act=pick][data-id=son]'); await blockedPage.click('[data-act=music]');
  await blockedPage.waitForFunction(() => window.__cards.sound.music?.backend === 'chip' && window.__cards.sound.music.on);
  ok('GM: blocked recordings fall back to the original chip loop without an error screen', await blockedPage.evaluate(() => window.__cards.sound.music.track.id === 'meadow' && window.__cards.sound.fails === 0 && !!document.querySelector('.world')) && blockedErrors.length === 0);
  await blockedPage.close(); await blockedctx.close();

  await x.close(); await xctx.close();

  // 10d. the full deck: 4,610 cards and 30 worlds load and a first tile can be played; a world file of another version is refused
  const fullctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const fp = await fullctx.newPage(); fp.on('pageerror', (e) => errs.push(String(e)));
  const t0 = Date.now(); await fp.goto(BASE + '?today=2026-12-21&triage=off&seed=2&sound=off&fast=1&nosync=1&storm=off'); await fp.waitForSelector('.profiles'); await fp.click('[data-act=pick][data-id=son]'); await fp.waitForSelector('.world'); const loadMs = Date.now() - t0;
  const full = await fp.evaluate(() => ({ words: window.__cards.words.length, worlds: window.__cards.ix.worlds.length, world: document.querySelector('#world').dataset.world, open: document.querySelectorAll('.node.open').length, nodes: document.querySelectorAll('.world .node').length, wide: document.scrollingElement.scrollWidth <= innerWidth + 1 }));
  ok('full deck: 4,610 cards, 30 worlds, the first world\'s map with open tiles, fits the screen width', full.words === 4610 && full.worlds === 30 && full.world === 'p1-01' && full.open >= 2 && full.nodes >= 15 && full.wide, JSON.stringify(full) + ' load ' + loadMs + ' ms');
  ok('the full deck opens from the real world file, with no stand-in note', !/세계 파일: 시험용/.test(await fp.textContent('#src')));
  const openId = await fp.$eval('.world .node.open', (b) => b.dataset.id); await fp.click(`[data-act=node][data-id="${openId}"]`); await fp.waitForSelector(READY);
  const fullRun = await fp.evaluate(() => ({ n: window.__cards.run.queue.length, word: document.querySelector('#word').textContent }));
  ok('a tile of the full deck starts a run of its 10 new words', fullRun.n === 10 && fullRun.word.length > 0, JSON.stringify(fullRun));
  await fp.click('[data-act=yes]'); await fp.waitForFunction(() => window.__cards.run.i >= 1 || document.querySelector('.opt'), null, { timeout: 8000 });
  await fp.close();
  const bad = await fullctx.newPage(); await bad.route('**/data/worlds.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ schemaVersion: 9, continents: [] }) }));
  await bad.goto(BASE + '?today=2026-12-21&sound=off&nosync=1&storm=off'); await bad.waitForSelector('#fatal');
  ok('a world file of an unknown version is refused with a plain message', /버전/.test(await bad.textContent('#fatal')));
  await bad.close(); await fullctx.close();
  // 10d-2. worlds.json cannot be read (404): the "열 수 없어요" screen gives the reason; no stand-in world is asked for or opened; nothing is written to storage
  const nwctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true }); const nw = await nwctx.newPage(); const nwReq = []; nw.on('request', (r) => nwReq.push(r.url()));
  await nw.route('**/data/worlds.json', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'nope' }));
  await nw.goto(BASE + '?today=2026-12-21&sound=off&nosync=1&storm=off'); await nw.waitForSelector('#fatal');
  const nwState = await nw.evaluate(() => ({ title: document.querySelector('h1').textContent, keys: localStorage.length, world: !!document.querySelector('#world'), profiles: !!document.querySelector('.profiles') }));
  ok('worlds.json blocked (404): the "열 수 없어요" screen names the file, the stand-in world is not opened, nothing is written to localStorage',
    nwState.title === '열 수 없어요' && /worlds\.json/.test(await nw.textContent('#fatal')) && !nwState.world && !nwState.profiles && nwState.keys === 0 && !nwReq.some((u) => /fixture/.test(u)), JSON.stringify({ nwState, fatal: await nw.textContent('#fatal') }));
  await nw.close(); await nwctx.close();

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
  ok('after playing on, the record is in the new format and still holds the old words', up.v === 3 && Object.keys(up.words).length === 30 && Object.keys(JSON.parse(SAVE0).words).every((id) => up.words[id]) && !!up.map.legacy);
  await u.evaluate(() => localStorage.setItem('cards.v0.p.son', '{"v":1,"id":"son","words":{"W0122'));           // cut off in the middle of a write
  await u.goto(BASE + '?set=demo&today=2026-12-22&triage=off&seed=4&sound=off&fast=1&nosync=1&storm=off'); await u.waitForSelector('.profiles'); await u.click('[data-act=pick][data-id=son]'); await u.waitForSelector('.world');
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
  await mc.goto(BASE + '?set=demo&today=2026-12-12&triage=off&seed=5&sound=off&fast=1&storm=off'); await mc.waitForSelector('.profiles');
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
    && JSON.stringify(tson.bunches) === '{"A1":{"due":"2026-12-12","done":null}}' && tson.v === 3 && tson.map.bat.fill === 3, JSON.stringify(tson.bunches) + ' fill ' + tson.map.bat.fill);
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
  const futureT = await tb.evaluate(() => { const k = 'cards.v0.p.son'; const s = JSON.parse(localStorage.getItem(k)); s.v = s.v + 1; s.futureOnly = true; s.words.futureWord = { st: 'done' }; const t = JSON.stringify(s); localStorage.setItem(k, t); return t; });
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
  ok('F1: tab B saved more words of the same format, then tab A played and saved: both tabs\' words are kept', otherW.every((id) => both.words[id] && both.words[id].st === 'likely') && TILE('A1').every((id) => both.words[id]) && both.v === 3, Object.keys(both.words).length + ' words');
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

  // 14. 회오리 (card T-008): the delivery rider and the whirlwind on the map, and the storm run of word forms. Every section
  //     above runs with storm=off (open() adds it); only here are whirlwinds on, with ?storm=now (no chance draw) and fixed seeds.
  const W14 = WORLDS.find((w) => w.id === 'd1-01');
  const dist14 = (from) => { const d = { [from]: 0 }; const q = [from]; while (q.length) { const v = q.shift(); for (const e of W14.map.edges) for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) if (a === v && !(b in d)) { d[b] = d[v] + 1; q.push(b); } } return d; };
  const FORMS14 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cards', 'data', 'forms.json'), 'utf8')).forms.filter((f) => !f.clash.length && WORDS.some((w) => w.id === f.base));
  const inW14 = new Set(W14.map.nodes.flatMap((n) => n.words || [])); const BASES14 = [...new Set(FORMS14.map((f) => f.base))].filter((b) => inW14.has(b));   // base words of the demo forms on this map
  const met14 = (o) => ({ st: 'review', step: 2, due: '2027-01-30', firstDay: '2026-11-01', lastDay: '2026-11-10', lapses: 0, ...o });
  const map14 = (extra) => ({ stars: 0, items: { shield: 0, flame: 0 }, bag: null, monsterDay: null, bonusDay: null, best: 0, keys: 0, worlds: {}, conts: {}, at: 'd1-01', bat: { fill: 0, cap: 40, met: [], last: null }, ...extra });
  const seed14 = (p, pid, ids, map) => p.evaluate(([pid, ids, map, rec]) => { const s = { v: 2, id: pid, words: {}, verify: [], runs: [], log: [], bunches: {} }; for (const id of ids) s.words[id] = rec; if (map) s.map = map; localStorage.setItem('cards.v0.p.' + pid, JSON.stringify(s)); }, [pid, ids, map, met14()]);
  const look14 = (p) => p.evaluate(() => ({ storm: document.querySelector('#storm')?.dataset.node || null, held: !!document.querySelector('#storm.held'), rider: document.querySelector('#rider')?.dataset.node || null,
    pic: !!document.querySelector('#storm use[href="#fx-storm-a"]') && !!document.getElementById('fx-storm-a'), msg: document.querySelector('#msg')?.textContent || '', saved: (JSON.parse(localStorage.getItem('cards.v0.p.' + window.__cards.pid)).map || {}).storm || null }));
  const stCur = (p) => p.evaluate(() => { const r = window.__cards.srun; const c = r && r.current; return c ? { id: c.id, form: c.form, baseForm: c.baseForm, ko: c.ko, ans: c.options.indexOf(c.baseForm), again: r.queue[r.i].again, tag: document.querySelector('#tag')?.textContent || '' } : null; });
  const keep14 = (s) => JSON.stringify([s.words, s.bunches || {}, s.map.bat]);
  const Q14 = 'today=2026-11-20&triage=off&seed=53&sound=off&fast=1&storm=now'; // Demo four farthest candidates: seed53 picks B1 so two actual moves are observed.
  const zctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  let z = await open(zctx, Q14); await seed14(z, 'son', [...new Set([...BASES14,...TILE('B1'),...TILE('C1')])], null); // ready both gate stamps without touching the rider or storm rule
  await z.click('[data-act=pick][data-id=son]'); await z.waitForSelector('.world'); const z0 = await look14(z);
  await startNode(z, 'A1'); await play(z); await toMap(z); const z1 = await look14(z); const dA1 = dist14('A1');
  const far = Math.max(...W14.map.nodes.filter((n) => n.kind === 'tile').map((n) => dA1[n.id]));
  ok('회오리 1: five or more base words with forms met, a run finished: the whirlwind appears on the farthest tile and the rider stands on the tile just cleared', BASES14.length >= 5 && !z0.storm && z0.rider === 'start'
    && z1.rider === 'A1' && !!z1.storm && dA1[z1.storm] === far && z1.saved && z1.saved.node === z1.storm && z1.pic && /회오리가 나타났어요/.test(z1.msg), JSON.stringify({ bases: BASES14.length, z0, z1 }));
  await startNode(z, 'A2'); await play(z); await toMap(z); const z2 = await look14(z); const dA2 = dist14('A2');
  await z.click('[data-act=node][data-id=castle]'); await z.waitForSelector(READY);              // a castle run does not move the rider: answered wrong on purpose so the castle stays open
  for (let k = 0; k < 40; k++) { await z.waitForSelector(READY, { timeout: 8000 }); if (await z.$('.tiles')) break; const it = await cur(z); if (!it) continue; await answer(z, `.opt[data-i="${(it.ans + 1) % 3}"]`); }
  const castleEnd = await z.textContent('h1'); await z.click('[data-act=today]');
  const sawCaught = await z.waitForSelector('#caught', { timeout: 4000 }).then(async () => /회오리에 휩쓸렸어요/.test(await z.textContent('#caught')), () => false);
  const runStarted = await z.waitForSelector('.storm-run .opt:not([disabled])', { timeout: 8000 }).then(() => true, () => false); const zs = await state(z, 'son');
  ok('회오리 2: each finished run moves it one step toward the rider; when it reaches the rider, "휩쓸렸어요" shows and the storm run starts', z2.rider === 'A2' && dA2[z2.storm] === dA2[z1.storm] - 1 && /다가와요/.test(z2.msg)
    && /성 시험 결과/.test(castleEnd) && sawCaught && runStarted && zs.map.storm && zs.map.storm.node === 'A2', JSON.stringify({ z2, from: z1.storm, castleEnd, sawCaught, runStarted, storm: zs.map.storm }));
  await z.reload(); await z.waitForSelector('.profiles'); await z.click('[data-act=pick][data-id=son]'); await z.waitForSelector('.world'); const z3 = await look14(z);
  await z.click('[data-act=node][data-id=B2]'); const toStorm = await z.waitForSelector('.storm-run .opt:not([disabled])', { timeout: 8000 }).then(() => true, () => false);
  ok('회오리 3: after a reload the rider is still caught; pressing a tile opens the storm run, not the tile', z3.storm === 'A2' && z3.rider === 'A2' && z3.held && /잡혔어요/.test(z3.msg) && toStorm && !(await z.evaluate(() => window.__cards.run)), JSON.stringify(z3));
  const before14 = await state(z, 'son'); const order14 = []; let missed14 = null; let line14 = '';
  for (let k = 0; k < 20; k++) {
    await z.waitForSelector('.storm-run .opt:not([disabled]), .tiles', { timeout: 8000 }); if (await z.$('.tiles')) break; const c = await stCur(z); order14.push(c);
    const wrong = missed14 === null; if (wrong) missed14 = c.id;
    await z.click(`.opt[data-i="${wrong ? (c.ans + 1) % 3 : c.ans}"]`); await z.waitForSelector('#goon');
    if (wrong) line14 = (await z.textContent('#stline')).replace(/\s+/g, ' ').trim(); await z.click('#goon');
  }
  await z.waitForSelector('.tiles'); const after14 = await state(z, 'son'); const m14 = order14.find((c) => c.id === missed14) || {};
  ok('회오리 4: a card answered wrong shows "form → base 뜻" and comes back once at the end; word records, bunches and the bat gauge are the same before and after', order14.length === 6 && order14.filter((c) => c.id === missed14).length === 2 && order14[5].id === missed14 && order14[5].again && /한 번 더/.test(order14[5].tag)
    && order14.slice(0, 5).every((c) => !c.again) && line14 === `${m14.form} → ${m14.baseForm} ${m14.ko}` && !!m14.ko && keep14(before14) === keep14(after14) && after14.forms[missed14].ok === 0, JSON.stringify({ n: order14.length, line14, missed14 }));
  const endTitle = await z.textContent('h1'); const starTxt = await z.textContent('#stormstars').catch(() => ''); const gained = after14.map.stars - before14.map.stars; await toMap(z); const z5 = await look14(z);
  await z.click('[data-act=node][data-id=B2]'); const tileRun = await z.waitForSelector(READY, { timeout: 8000 }).then(async () => !!(await z.evaluate(() => window.__cards.run)) && !(await z.$('.storm-run')), () => false);
  ok('회오리 5: finished: "빠져나왔어요", 4 stars for 4 first answers right, the whirlwind is gone and a tile starts its own run again', /회오리에서 빠져나왔어요/.test(endTitle) && gained === 4 && /\+4/.test(starTxt) && !z5.storm && !after14.map.storm && tileRun
    && after14.runs.at(-1).kind === 'storm' && after14.runs.at(-1).fresh === 0, JSON.stringify({ endTitle, gained, z5 }));
  await z.click('[data-act=quit]'); await z.waitForSelector('.tiles'); await toMap(z); await z.click('[data-act=home]'); await z.click('[data-act=parent]'); const pf = await z.textContent('[data-forms=son]').catch(() => '');
  ok('회오리 부모 화면: one line of word-form progress (finished forms / forms that can be asked)', pf === '변신 단어: 끝난 형태 0 / 낼 수 있는 형태 8', pf);
  await z.close(); await zctx.close();
  // 6: the forms file cannot be read: the game opens as before, no whirlwind, a saved one blocks nothing
  const nfx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true }); await nfx.route('**/data/forms.json', (r) => r.abort());
  const n14 = await open(nfx, Q14); await seed14(n14, 'son', BASES14, map14({ storm: { wid: 'd1-01', node: 'start', day: '2026-11-20' } }));
  await n14.click('[data-act=pick][data-id=son]'); await n14.waitForSelector('.world'); const n6 = await look14(n14); const on6 = await n14.evaluate(() => [window.__cards.fx]);
  await startNode(n14, 'A1'); const run6 = await n14.evaluate(() => !!window.__cards.run); await play(n14); await toMap(n14); const n6b = await look14(n14);
  ok('회오리 6: forms.json blocked: the map opens, no whirlwind is drawn or made, a tile under a saved whirlwind starts as usual', !n6.storm && !n6b.storm && on6[0] === null && run6 && !(await n14.$('#fatal')) && !(await state(n14, 'son')).map.storm, JSON.stringify({ n6, n6b }));
  await n14.close(); await nfx.close();
  // 7: a full bat gauge: the whirlwind waits and the bat test comes first
  const bctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const b14 = await open(bctx, Q14); await seed14(b14, 'daughter', BASES14, map14({ bat: { fill: 40, cap: 40, met: BASES14, last: null }, storm: { wid: 'd1-01', node: 'C2', day: '2026-11-20' } }));
  await b14.click('[data-act=pick][data-id=daughter]'); await b14.waitForSelector('.world'); const b7 = await look14(b14); const batDock = !!(await b14.$('[data-id=bat]'));
  await b14.click('#storm'); await sleep(100); const msg7 = await b14.textContent('#msg'); const noStorm7 = !(await b14.$('.storm-run'));
  await startNode(b14, 'bat'); const batRun = await b14.evaluate(() => window.__cards.node.kind); await play(b14); await b14.waitForSelector('.tiles'); await toMap(b14); const b7b = await look14(b14);
  ok('회오리 7: bat gauge full: the bat test opens first (pressing the whirlwind says so), and after the bat test the whirlwind has not moved', b7.storm === 'C2' && batDock && /박쥐/.test(msg7) && noStorm7 && batRun === 'bat' && b7b.storm === 'C2' && b7b.saved && b7b.saved.node === 'C2', JSON.stringify({ b7, msg7, b7b }));
  await b14.close(); await bctx.close();


  // C-011 presentation: HP and outfits never alter the learning rules or child JSON.
  const feedbackctx = await browser.newContext({viewport:{width:1180,height:820},hasTouch:true});
  const fb = await open(feedbackctx,'today=2026-11-12&triage=off&seed=9&sound=off&fast=1');
  await fb.click('[data-act=pick][data-id=son]'); await fb.waitForSelector('.world');
  await fb.evaluate(()=>{const g=window.__cards;g.st.map.stars=11;localStorage.setItem('cards.v0.p.son',JSON.stringify(g.st));});
  await startNode(fb,'A1'); await fb.screenshot({path:'/tmp/c011-screens/monster.png',animations:'disabled'});
  const fixedMonster = await fb.evaluate(()=>({id:window.__cards.displayBoss.id,n:window.__cards.displayBoss.N,hp:window.__cards.displayBoss.hp,svg:document.querySelector('#boss use').getAttribute('href')}));
  const missHP = await fb.evaluate(()=>{const g=window.__cards;document.querySelector('[data-act=no]').click();return {hp:g.displayBoss.hp,down:document.querySelector('#boss').classList.contains('down'),hit:document.querySelector('#boss').classList.contains('hit')};});
  ok('C011: one labelled original monster starts at initial cards; unknown keeps HP and has no hit/down',fixedMonster.n===10 && fixedMonster.hp===10 && fixedMonster.svg==='#'+fixedMonster.id && missHP.hp===10 && !missHP.down && !missHP.hit && /몬스터 체력/.test(await fb.textContent('.monster-panel')));
  await nextCard(fb).click();
  await fb.waitForFunction(()=>window.__cards.run.i>=1); await fb.waitForSelector(READY);
  const hpAnswer = await fb.evaluate(()=>{const g=window.__cards;g.run.rng=()=>.99;g.run.boss.hp=1;g.run.items.flame=true;document.querySelector('[data-act=yes]').click();return {hp:g.displayBoss.hp,id:g.displayBoss.id,idx:g.run.boss.idx,floater:document.querySelector('#floater').textContent};});
  ok('C011: correct answer removes one display HP, even with flame and internal boss rollover',hpAnswer.hp===9 && hpAnswer.id===fixedMonster.id && hpAnswer.floater==='-1' && hpAnswer.idx>=1,JSON.stringify(hpAnswer));
  await play(fb,()=>true); await fb.waitForSelector('.tiles');
  ok('C011: normal completion collapses the same monster to zero and crossing 12 stars announces the first gift',await fb.evaluate((id)=>window.__cards.displayBoss.hp===0&&window.__cards.displayBoss.id===id&&window.__cards.displayBoss.down&&document.querySelector('.monster-finished')?.dataset.hp==='0'&&window.__cards.st.map.stars>=12&&!!document.querySelector('#giftgain'),fixedMonster.id));
  await toMap(fb);
  // Replay from a fresh child state to test identity independently of day/boss index.
  await fb.evaluate(()=>{localStorage.removeItem('cards.v0.p.son');window.__cards.boss={idx:99,hp:2,defeated:99,day:'2026-11-12',pid:'son'};});
  await fb.click('[data-act=home]'); await fb.click('[data-act=pick][data-id=son]'); await fb.waitForSelector('.world'); await startNode(fb,'A1');
  ok('C011: same tile has the same monster across fresh runs and internal boss indices',await fb.evaluate((id)=>window.__cards.displayBoss.id===id,fixedMonster.id));
  await fb.evaluate(()=>{window.__cards.displayBoss.hp=1;});
  const verifyHP = await fb.evaluate(()=>{const g=window.__cards;g.run.rng=()=>0;const before=g.displayBoss.hp;document.querySelector('[data-act=yes]').click();return {before,after:g.displayBoss.hp,verify:g.run.current.verifying,hit:document.querySelector('#boss').classList.contains('hit')};});
  ok('C011: verification pending does no damage',verifyHP.verify && verifyHP.before===1 && verifyHP.after===1 && !verifyHP.hit);
  const oneHP = await fb.evaluate(()=>{const g=window.__cards;const i=g.run.current.options.findIndex(o=>o.id===g.run.current.id);document.querySelector(`.opt[data-i="${i}"]`).click();return {hp:g.displayBoss.hp,left:g.run.left,down:g.displayBoss.down};});
  ok('C011: display HP stays at one while a retried queue still has cards',oneHP.hp===1&&oneHP.left>1&&!oneHP.down);
  await fb.waitForFunction(()=>!window.__cards.busy);
  await fb.click('[data-act=quit]'); await fb.waitForSelector('.tiles');
  ok('C011: quitting a run does not collapse the monster',await fb.evaluate(()=>window.__cards.displayBoss.hp>0&&!window.__cards.displayBoss.down&&!document.querySelector('.monster-finished')));
  await toMap(fb);
  // Seed stars only in this throwaway browser; wardrobe must not write the resulting child record.
  await fb.evaluate(()=>{const g=window.__cards;g.st.map.stars=12;localStorage.setItem('cards.v0.p.son',JSON.stringify(g.st));});
  await fb.click('[data-act=home]'); await fb.click('[data-act=pick][data-id=son]'); await fb.waitForSelector('.world');
  const beforeLook = await fb.evaluate(()=>localStorage.getItem('cards.v0.p.son'));
  await fb.click('[data-act=wardrobe]'); await fb.waitForSelector('#wardrobe'); await fb.click('[data-act=gear][data-slot=hat][data-id=leaf-cap]');
  await fb.screenshot({path:'/tmp/c011-screens/wardrobe.png',animations:'disabled'});
  await fb.click('[data-act=gear-tab][data-slot=bag]');
  const savedLookInvariant = await fb.evaluate((before)=>localStorage.getItem('cards.v0.p.son')===before&&JSON.parse(localStorage.getItem('cards.v0.look.son')).slots.hat.id==='leaf-cap'&&document.querySelector('[data-act=gear][data-slot=bag][data-id="sun-bag"]').disabled&&!!document.querySelector('#rider use[data-layer="hat"][href="#c016-hat-legacy-leaf-cap-0"]'),beforeLook);
  await fb.keyboard.press('Escape'); await fb.reload(); await fb.waitForSelector('.profiles'); await fb.click('[data-act=pick][data-id=son]'); await fb.waitForSelector('.world');
  ok('C011: outfit persists after reload without consuming stars',await fb.evaluate(()=>window.__cards.st.map.stars===12&&!!document.querySelector('#rider use[data-layer="hat"][href="#c016-hat-legacy-leaf-cap-0"]')));
  await fb.click('[data-act=home]'); await fb.click('[data-act=pick][data-id=daughter]'); await fb.waitForSelector('.world');
  ok('C011: outfit choice is separate for each child',await fb.$eval('#rider use',e=>e.getAttribute('href'))==='#courier-gold-idle');
  await fb.click('[data-act=atlas]'); ok('C011: a locked world has a shut door and cannot be entered',await fb.$eval('.wcard[data-id="d1-02"]',e=>e.disabled&&!!e.querySelector('use[href="#c011-door-locked"]')));
  await fb.close(); await feedbackctx.close();
  const prefctx = await browser.newContext(); const prefPage = await open(prefctx,'today=2026-11-12&fast=1'); await prefPage.click('[data-act=pick][data-id=son]'); await prefPage.waitForSelector('.world');
  await prefPage.click('[data-act=music]'); await prefPage.waitForFunction(()=>!window.__cards.sound.musicOn&&JSON.parse(localStorage.getItem('cards.v0.pref')).music===false); await prefPage.reload(); await prefPage.waitForSelector('.profiles'); await prefPage.click('[data-act=pick][data-id=son]'); await prefPage.waitForSelector('.world');
  ok('C011: music starts enabled and an explicit off choice survives reload',await prefPage.evaluate(()=>!window.__cards.sound.musicOn&&JSON.parse(localStorage.getItem('cards.v0.pref')).music===false));
  await prefPage.close(); await prefctx.close();


  const failedctx = await browser.newContext({viewport:{width:1180,height:820}}); const failedPage = await open(failedctx,'today=2026-11-12&triage=off&seed=9&sound=off&fast=1');
  await failedPage.evaluate(async()=>{const {newState}=await import('./js/deck.js');const g=window.__cards,s=newState('son');s.map={at:'d1-01',stars:0,items:{shield:0,flame:0},bag:null,best:0,bonusDay:null,bat:{fill:0,cap:40,met:[],last:null},worlds:{'d1-01':{tiles:{},castle:null,entered:'2026-11-12',stamps:{}}},conts:{}};for(const n of g.ix.byId['d1-01'].map.nodes)if(n.kind==='tile'){s.map.worlds['d1-01'].tiles[n.unit||n.id]='2026-11-12';for(const id of n.words||[])s.words[id]={st:'done',due:null,step:0};}localStorage.setItem('cards.v0.p.son',JSON.stringify(s));});
  await failedPage.click('[data-act=pick][data-id=son]'); await failedPage.waitForSelector('.world'); await startNode(failedPage,'castle');
  for(let i=0;i<30;i++){await failedPage.waitForSelector(READY);if(await failedPage.$('.tiles'))break;await answer(failedPage,'[data-act=opt][data-i="-1"]');}
  ok('C011: failed castle keeps its remaining monster HP and never shows defeat',await failedPage.evaluate(()=>window.__cards.displayBoss.hp>0&&!window.__cards.displayBoss.down&&!document.querySelector('.monster-finished')) && /시험 결과/.test(await failedPage.textContent('h1')));
  await failedPage.close(); await failedctx.close();
  const fanctx = await browser.newContext(); const fanPage = await open(fanctx,'today=2026-11-12&fast=1'); await fanPage.click('[data-act=pick][data-id=son]'); await fanPage.waitForSelector('.world'); await fanPage.waitForFunction(()=>window.__cards.sound.music?.on);
  for(const id of ['world-fanfare','continent-fanfare']) {
    const actual = await fanPage.evaluate(async(id)=>{const s=window.__cards.sound;await s.jingle(id);const node=[...s.jingleNodes].find(n=>n.fanfare&&n.source);const snapshot={source:node?.source instanceof AudioBufferSourceNode,length:node?.source?.buffer.duration,duck:s.music.ducked};if(node){const ended=new Promise(resolve=>node.source.addEventListener('ended',resolve,{once:true}));node.source.playbackRate.value=8;await ended;}return {...snapshot,recovered:!s.music.ducked};},id);
    ok(`C011: ${id} decodes, plays to its end and restores music duck`,actual.source&&Math.abs(actual.length-(id==='world-fanfare'?5:10))<.05&&actual.duck&&actual.recovered,JSON.stringify(actual));
    for(const mode of ['404','decode']) {
      await fanPage.route(`**/assets/postal/music-gm/${id}.m4a`,r=>r.fulfill({status:mode==='404'?404:200,contentType:'audio/mp4',body:mode==='404'?'missing':'invalid encoded audio'}));
      const fallback=await fanPage.evaluate(async(id)=>{const s=window.__cards.sound;s.gmJingles.clear();let wanted=null;const old=s.track;s.track=async function(name){wanted=name;return old.call(this,name);};await s.jingle(id);s.track=old;const node=[...s.jingleNodes].find(n=>n.fanfare);const result={wanted,chip:!!node&&!node.source,duck:s.music.ducked};s.cancelFanfares();return {...result,recovered:!s.music.ducked};},id);
      ok(`C011: ${id} ${mode} falls back to victory chip and cancels cleanly`,fallback.wanted==='victory'&&fallback.chip&&fallback.duck&&fallback.recovered,JSON.stringify(fallback));await fanPage.unroute(`**/assets/postal/music-gm/${id}.m4a`);
    }
  }

  const quotactx=await browser.newContext({viewport:{width:1180,height:820}}),quotaPage=await open(quotactx,'today=2026-11-12&triage=off&seed=9&sound=off&fast=1');
  await quotaPage.click('[data-act=pick][data-id=son]');await quotaPage.waitForSelector('.world');
  const quotaBefore=await quotaPage.evaluate(()=>{const g=window.__cards;g.st.map.stars=12;g.st.map.keys=1;g.st.map.worlds['d1-01'].castle='2026-11-12';localStorage.setItem('cards.v0.p.son',JSON.stringify(g.st));const before=localStorage.getItem('cards.v0.p.son'),set=Storage.prototype.setItem;window.__quotaAttempts=[];Storage.prototype.setItem=function(k,v){if(k==='cards.v0.seen'||k.startsWith('cards.v0.look.')||k.startsWith('cards.v0.p.')){window.__quotaAttempts.push({key:k,value:v});throw new DOMException('quota fixture','QuotaExceededError');}return set.call(this,k,v);};return before;});
  await quotaPage.click('[data-act=wardrobe]');await quotaPage.click('[data-act=gear][data-slot=hat][data-id=leaf-cap]');await quotaPage.click('#wardrobe [data-act=look-close]');
  await quotaPage.click('[data-act=atlas]');await quotaPage.click('.world-door[data-act=door][data-id="d1-02"]');await quotaPage.waitForSelector('.door-stage[data-phase=open]');
  await quotaPage.click('[data-act=today]');await quotaPage.waitForSelector('.world');const quotaLook=await quotaPage.$eval('#rider use[data-layer="hat"]',e=>e.getAttribute('href'));await quotaPage.click('[data-act=atlas]');
  ok('C011: first gift, locked outfits and saved look keep child JSON unchanged; read-only device storage retains door and gift acknowledgements and outfit in memory',savedLookInvariant&&quotaLook==='#c016-hat-legacy-leaf-cap-0'&&await quotaPage.evaluate(before=>{const a=window.__quotaAttempts,docs=a.filter(x=>x.key==='cards.v0.seen').map(x=>JSON.parse(x.value));return localStorage.getItem('cards.v0.p.son')===before&&!a.some(x=>x.key.startsWith('cards.v0.p.'))&&docs.some(x=>x.son?.gifts?.['leaf-cap']&&x.son?.doors?.['world:d1-01:d1-02'])&&!!document.querySelector('.wcard[data-id="d1-02"] .world-door use[href="#c011-door-open"]')&&!document.querySelector('.wcard[data-id="d1-02"] .world-door.unseen');},quotaBefore));
  await quotaPage.close();await quotactx.close();

  // A pending recording load must not start after leaving a celebration.
  const cancelled=await fanPage.evaluate(async()=>{const s=window.__cards.sound,record=s._recording;let release;s._recording=()=>new Promise(r=>release=r);const p=s.jingle('world-fanfare');s.cancelFanfares();release(null);await p;s._recording=record;return ![...s.jingleNodes].some(n=>n.fanfare)&&!s.music.ducked;});
  ok('C011: leaving a celebration cancels an awaited fanfare without a late chip fallback',cancelled);
  await fanPage.close();await fanctx.close();


  const gatectx=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true}),gp=await open(gatectx,'today=2026-11-12&triage=off&seed=53&sound=off&fast=1');
  await gp.evaluate(async()=>{const{newState}=await import('./js/deck.js'),{ensureMap}=await import('./js/map.js');const g=window.__cards,s=newState('son'),m=ensureMap(s);m.at='d1-01';m.worlds['d1-01']={castle:null,cleared:{},stamps:{},seen:'2026-11-12',here:'A2'};for(const n of g.ix.byId['d1-01'].map.nodes.filter(n=>['A1','A2'].includes(n.id)))for(const id of n.words)s.words[id]={st:'done',step:0,due:null};localStorage.setItem('cards.v0.p.son',JSON.stringify(s));});
  await gp.click('[data-act=pick][data-id=son]');await gp.waitForSelector('.world');
  const frontier=await gp.evaluate(()=>({near:[...document.querySelectorAll('.node.open.nearby')].map(e=>e.dataset.id).sort(),far:[...document.querySelectorAll('.node.open.distant')].map(e=>e.dataset.id).sort(),disabled:[...document.querySelectorAll('.node.open.distant')].some(e=>e.disabled)}));
  ok('C013: only open villages adjacent through local free nodes glow, while remote choices remain enabled',frontier.near.join()==='B2,C2'&&frontier.far.join()==='B1,C1'&&!frontier.disabled,JSON.stringify(frontier));
  await startNode(gp,'B1');ok('C013: a faded remote village remains a legal learning choice',await gp.evaluate(()=>window.__cards.node.unit==='B1'&&window.__cards.run.queue.length===10));await gp.click('[data-act=quit]');await gp.waitForSelector('.tiles');
  await gp.evaluate(async()=>{const{ensureMap}=await import('./js/map.js');const g=window.__cards,m=ensureMap(g.st);g.st.words={};for(const w of g.ix.continents[0].worlds){m.worlds[w.id]={castle:'2026-11-11',cleared:{},stamps:{},seen:'2026-11-12'};const count=w.id==='d1-01'?4:4;for(const n of w.map.nodes.filter(n=>n.kind==='tile').slice(0,count))for(const id of n.words)g.st.words[id]={st:'done',step:0,due:null};}m.at='d1-01';m.bat={fill:0,cap:40,met:[],last:null};localStorage.setItem('cards.v0.p.son',JSON.stringify(g.st));});
  await toMap(gp);ok('C013: an already passed castle keeps its completed label when new stamp conditions are missing',await gp.evaluate(()=>document.querySelector('#castle-gate').dataset.cleared==='true'&&document.querySelector('#castle-gate').dataset.ready==='false'&&/성 통과 완료/.test(document.querySelector('#castle-gate').textContent)&&/남은 마을은 선택/.test(document.querySelector('#castle-gate').textContent)&&document.querySelector('.node.castle').classList.contains('cleared')));await gp.click('[data-act=atlas]');
  ok('C013: continent castle opens at all world castles and 8/11 villages with no crowns required',await gp.evaluate(()=>document.querySelector('.wcard.finale[data-id=d1]').classList.contains('open')&&document.querySelector('.wcard.finale[data-id=d1] .continent-gate').textContent==='세계 성 2/2 · 마을 8/8 (70%)'&&!document.querySelector('.cont[data-cont=d1] .wcard use[href="#crown"]')));
  await gp.screenshot({path:'/tmp/c013-screens/continent-gates.png',animations:'disabled'});
  await gp.close();await gatectx.close();

  // C-014 checks with real motion enabled and isolated presentation preferences.
  const homeCtx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const hm = await open(homeCtx, 'today=2026-11-18&triage=off&sound=off&seed=9');
  const expectedHome = await hm.evaluate(() => {
    const expected = {};
    for (const [i,id] of ['son','daughter'].entries()) {
      const ids = window.__cards.words.slice(0,4+i).map(w => w.id);
      const words = Object.fromEntries(ids.map((word,j) => [word, { st: j === 1 ? 'review' : 'done', step: j === 1 ? 0 : 2, firstDay: j === 0 ? '2026-11-15' : '2026-11-16', lastDay:'2026-11-18', ...(j === 1 ? {} : { up: j === 0 ? '2026-11-15' : '2026-11-16' }) }]));
      const record = JSON.stringify({ v:3,id,words,runs:[{day:'2026-11-16',reason:'done'},{day:'2026-11-17',reason:'left'}] });
      localStorage.setItem('cards.v0.p.'+id,record);
      expected[id] = record;
    }
    return expected;
  });
  await hm.reload(); await hm.waitForSelector('.profiles'); await hm.evaluate(() => document.fonts.ready);
  fs.mkdirSync('/tmp/c014-screens',{recursive:true});
  await hm.screenshot({path:'/tmp/c014-screens/home.png'});
  await hm.click('[data-act=parent]'); await hm.click('[data-act=home]');
  ok('C014: firm words (all time and since Monday) and Monday-first activity match each child record; home is read-only', await hm.evaluate(expected => {
    return ['son','daughter'].every((id,i) => {
      const panel = document.querySelector(`.profile[data-id=${id}]`);
      return panel.querySelector('.home-count b').textContent === String(3+i) &&
        panel.querySelector('.home-met').textContent === '만난 단어 ' + (4+i) &&
        panel.querySelector('.home-week').textContent === `이번 주 새 단어 +${3+i} · 익힌 +${2+i}` &&
        [...panel.querySelectorAll('.week-dots span')].map(x=>x.dataset.played).join(',') === 'true,false,false,false,false,false,false' &&
        expected[id] === localStorage.getItem('cards.v0.p.'+id);
    }) && document.querySelector('.home-goal').textContent.includes('새 단어 +7 / 목표 42') &&
      !/1등|왕관|이겼다/.test(document.querySelector('.home-postal').textContent);
  },expectedHome));
  await hm.click('[data-act=parent]'); await hm.click('[data-act=home-progress]'); await hm.click('[data-act=home]');
  ok('C014: parent can hide home scores for both children', await hm.locator('.home-count,.home-met,.home-week,.home-goal,.week-dots').count()===0);
  await hm.click('[data-act=parent]'); await hm.click('[data-act=reduce-motion]'); await hm.click('[data-act=home]');
  ok('C014: reduced motion stops the home courier pulse', await hm.locator('.home-courier').first().evaluate(el=>getComputedStyle(el).animationName==='none'));
  await hm.close(); await homeCtx.close();

  const motionCtx = await browser.newContext({ viewport:{width:1180,height:820}, hasTouch:true });
  const motion = await open(motionCtx,'today=2026-11-18&triage=off&sound=off&seed=9');
  await motion.click('[data-act=pick][data-id=son]');
  await motion.waitForSelector('.world');
  await motion.evaluate(()=>document.fonts.ready);
  await motion.screenshot({path:'/tmp/c014-screens/world.png'});
  const skipped = await motion.evaluate(() => {
    const choice = document.querySelector('[data-act=node][data-id=A1]');
    choice.click();
    const move = document.querySelector('#rider').getAnimations().find(a=>a.playState==='running');
    choice.click();
    return !!move && move.playState==='idle';
  });
  await motion.waitForSelector(READY);
  ok('C014: a tile tap walks the route and a second tap skips the travel', skipped && await motion.evaluate(()=>window.__cards.node?.unit==='A1'));
  const throwResponse = await motion.evaluate(async () => {
    const g=window.__cards;
    g.run.rng=()=>.99;
    const i=g.run.i;
    const started=performance.now();
    document.querySelector('.act.yes').click();
    const fx=!!document.querySelector('.mail-flight');
    return new Promise(resolve=>{
      const frame=()=>{
        const enabled=document.querySelector('.act.yes:not([disabled]),.opt:not([disabled])');
        if (enabled && g.run.i===i+1) resolve({fx,t:performance.now()-started});
        else if (performance.now()-started>=100) resolve({fx,t:-1});
        else requestAnimationFrame(frame);
      };
      frame();
    });
  });
  ok('C014: mail flies while the next card is accepting input within 100ms', throwResponse.fx && throwResponse.t>=0 && throwResponse.t<100, JSON.stringify(throwResponse));
  await motion.screenshot({path:'/tmp/c014-screens/throw.png'});
  await motion.close(); await motionCtx.close();
  const castleMotionCtx = await browser.newContext({viewport:{width:1180,height:820}});
  const castleMotion = await open(castleMotionCtx,'today=2026-11-18&triage=off&sound=off&seed=9');
  await castleMotion.evaluate(async()=>{
    const {newState}=await import('./js/deck.js'); const {ensureMap}=await import('./js/map.js');
    const st=newState('son'), m=ensureMap(st); m.at='d1-01';
    const w=window.__cards.ix.byId['d1-01'];
    for (const n of w.map.nodes.filter(n=>n.kind==='tile')) for (const id of n.words) st.words[id]={st:'done'};
    localStorage.setItem('cards.v0.p.son',JSON.stringify(st));
  });
  await castleMotion.click('[data-act=pick][data-id=son]'); await startNode(castleMotion,'castle');
  await castleMotion.waitForSelector('.guardian-entry'); await castleMotion.screenshot({path:'/tmp/c014-screens/castle.png'});
  const skipEntry = castleMotion.getByRole('button',{name:'등장 장면 건너뛰기'});
  await skipEntry.evaluate(b=>b.click());
  ok('C014: a castle entrance can be skipped while choices remain enabled', await castleMotion.locator('.guardian-entry').count()===0 && await castleMotion.locator('.opt:not([disabled])').count()>0);
  await castleMotion.close();await castleMotionCtx.close();

  // C-015. Real atlas geometry, the gate outside the map, shared courier size and option typography.
  const visual = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const vp = await visual.newPage();
  vp.on('pageerror', (e) => errs.push(String(e)));
  await vp.goto(BASE + '?today=2026-11-18&fast=1&sound=off&nosync=1&triage=off&storm=off');
  await vp.waitForSelector('.profiles');
  await vp.evaluate(async () => {
    const { newState } = await import('./js/deck.js');
    const { ensureMap } = await import('./js/map.js');
    const s = newState('son'), m = ensureMap(s);
    m.stars = 1000;
    m.at = 'p1-01';
    m.worlds['p1-01'] = { castle: '2026-11-17', cleared: {}, stamps: {}, seen: '2026-11-17' };
    localStorage.setItem('cards.v0.p.son', JSON.stringify(s));
  });
  fs.mkdirSync('/tmp/c015-screens', { recursive: true });
  await vp.click('[data-act=pick][data-id=son]');
  await vp.waitForSelector('#world[data-world=p1-01]');
  await vp.evaluate(() => document.fonts.ready);
  await vp.screenshot({ path: '/tmp/c015-screens/world.png', animations: 'disabled' });
  ok('C015: a 1000-star HUD fits in one row with both labelled sound toggles', await vp.evaluate(() => {
    const row = document.querySelector('.maphud'), items = [...row.children].map((item) => item.getBoundingClientRect());
    const centres = items.map((r) => (r.top + r.bottom) / 2);
    const box = row.getBoundingClientRect();
    return row.textContent.includes('1000') && Math.max(...centres) - Math.min(...centres) < 2 &&
      items.every((r) => r.left >= box.left && r.right <= box.right + 1) &&
      ['music','sfx'].every((id) => row.querySelector(`[data-act=${id}]`).hasAttribute('aria-label'));
  }));
  ok('C015: the visible castle requirements panel never overlaps map tiles, castle or stamp markers', await vp.evaluate(() => {
    const gate = document.querySelector('#castle-gate');
    const a = gate.getBoundingClientRect();
    return a.height > 0 && document.querySelector('.castle-pin') && [...document.querySelectorAll('#world .node, #world .gate-stamp')].every((n) => {
      const b = n.getBoundingClientRect();
      return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
    });
  }));
  await vp.click('[data-act=wardrobe]');
  await vp.screenshot({ path: '/tmp/c015-screens/wardrobe.png', animations: 'disabled' });
  const courierBounds = () => vp.locator('.gear-preview svg').evaluate(drawing => {
    const box = drawing.getBoundingClientRect();
    const art = drawing.getBBox();
    const view = drawing.viewBox.baseVal;
    return [box.width, box.height, art.width / view.width, art.height / view.height];
  });
  const defaultBounds = await courierBounds();
  const fitted = [];
  for (const [slot,ids] of [['hat',['leaf-cap','night-cap']],['bag',['sun-bag','letter-bag']],['coat',['sea-coat','festival-coat']]]) {
    await vp.click(`[data-act=gear-tab][data-slot=${slot}]`);
    for (const id of ids) {
      await vp.click(`[data-act=gear][data-slot=${slot}][data-id=${id}]`);
      fitted.push(await courierBounds());
    }
    await vp.click(`[data-act=gear][data-slot=${slot}][data-id=default]`);
  }
  ok('C015: six outfits share the default courier display size and similar painted bounds', fitted.length === 6 && fitted.every(([w,h,aw,ah]) =>
    w === defaultBounds[0] && h === defaultBounds[1] && Math.abs(aw-defaultBounds[2]) <= .07 && Math.abs(ah-defaultBounds[3]) <= .07), JSON.stringify({defaultBounds,fitted}));
  await vp.click('#wardrobe [data-act=look-close]');
  await vp.click('[data-act=atlas]');
  await vp.screenshot({ path: '/tmp/c015-screens/atlas-p1.png', animations: 'disabled' });
  const drawn = await vp.evaluate(() => {
    const sections = [...document.querySelectorAll('.cont')];
    return sections.map((c) => ({
      count: c.querySelectorAll('.atlas-stop [data-act=goworld]').length,
      drawing: !!document.querySelector(c.querySelector('.atlas-geography use')?.getAttribute('href') || '#absent'),
      finale: !!c.querySelector('.atlas-stop .finale'),
    }));
  });
  const lockedWorld = vp.locator('.wcard[data-id=p1-03]');
  const locked = await lockedWorld.isDisabled();
  await lockedWorld.evaluate((button) => button.click());
  ok('C015: drawn maps cover every world, lock closed villages and allow an open world to be entered',
    JSON.stringify(drawn.map((x) => x.count)) === '[8,15,7]' && drawn.every((x) => x.drawing && x.finale) &&
    locked && await vp.locator('.atlas').count() === 1 &&
    await vp.click('.wcard[data-id=p1-02]').then(() => vp.waitForSelector('#world[data-world=p1-02]')).then(() => true), JSON.stringify(drawn));
  await vp.click('[data-act=atlas]');
  await vp.setViewportSize({ width: 390, height: 844 });
  const mobile = await vp.evaluate(() => document.documentElement.scrollWidth <= innerWidth &&
    [...document.querySelectorAll('.atlas-scroll')].every((el) => el.scrollWidth > el.clientWidth));
  await vp.click('[data-act=atlas-list]');
  const listCount = await vp.locator('.wgrid .wcard[data-act=goworld]').count();
  ok('C015: narrow atlases scroll within their map and provide a complete list on request', mobile && listCount === 30);

  // A real castle screen with a controlled, catalogue-derived typography fixture.
  await vp.setViewportSize({ width: 1180, height: 820 });
  await vp.evaluate(async () => {
    const { newState } = await import('./js/deck.js');
    const { ensureMap } = await import('./js/map.js');
    const g = window.__cards, s = newState('son'), m = ensureMap(s);
    const w = g.ix.byId['p1-01'];
    m.at = w.id;
    for (const n of w.map.nodes) for (const id of n.words || []) s.words[id] = { st: 'done' };
    localStorage.setItem('cards.v0.p.son', JSON.stringify(s));
  });
  await vp.reload();
  await vp.waitForSelector('.profiles');
  await vp.click('[data-act=pick][data-id=son]');
  await vp.click('.node.castle');
  await vp.waitForSelector('.opt:not(:disabled)');
  await vp.evaluate(() => {
    const g = window.__cards;
    const longest = [...g.words].filter((w) => w.track !== 'sight' && typeof w.ko === 'string').sort((a,b) => b.ko.length - a.ko.length).slice(0, 9);
    // Route the fixture's long catalogue glosses through the real castle option renderer.
    for (let i = 1; i <= 3; i++) g.run.queue[i].id = longest[(i - 1) * 3].id;
    g.run._options = () => longest.slice((g.run.i - 1) * 3, g.run.i * 3).map(({id,ko}) => ({ id, ko }));
  });
  let longChoicesFit = true;
  for (let i = 0; i < 3; i++) {
    await answer(vp, '.opt[data-i="0"]');
    await vp.waitForSelector('.opt.long-option:not(:disabled)');
    longChoicesFit &&= await vp.evaluate(() => {
      const opts = [...document.querySelectorAll('.opt')];
      return opts.length === 3 && opts.every((b) => {
        const text = document.createRange(); text.selectNodeContents(b);
        const box = b.getBoundingClientRect();
        return b.offsetHeight === opts[0].offsetHeight && getComputedStyle(b).wordBreak === 'keep-all' &&
          [...text.getClientRects()].every((r) => r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom);
      });
    });
    if (i === 0) await vp.screenshot({ path: '/tmp/c015-screens/long-options.png', animations: 'disabled' });
  }
  ok('C015: the catalogue’s longest glosses wrap and all three options have equal height', longChoicesFit);
  await visual.close();

  // C-016 wardrobe: each slot is earned from a different kind of progress.
  const gearCtx=await browser.newContext({viewport:{width:1180,height:820}});
  const gearPage=await gearCtx.newPage();
  gearPage.on('pageerror',e=>errs.push(String(e)));
  await gearPage.goto(BASE+'/?today=2026-11-18&triage=off&nosync=1&sound=off&storm=off');
  await gearPage.waitForSelector('.profiles');
  await gearPage.evaluate(async()=>{
    const {newState}=await import('./js/deck.js'), {ensureMap}=await import('./js/map.js');
    const g=window.__cards,s=newState('son'),m=ensureMap(s);
    m.at='p1-01';m.stars=12;
    m.worlds['p1-01']={castle:'2026-11-17',seen:'2026-11-17',cleared:{},stamps:{}};
    m.conts.c1={castle:'2026-11-17'};
    for(const w of g.words.slice(0,500))s.words[w.id]={st:'done'};
    localStorage.setItem('cards.v0.p.son',JSON.stringify(s));
    localStorage.setItem('cards.v0.look.son',JSON.stringify({outfit:'sea-coat'}));
    localStorage.setItem('cards.v0.seen',JSON.stringify({son:{gifts:{'sea-coat':true}}}));
  });
  await gearPage.click('[data-act=pick][data-id=son]');
  await gearPage.waitForSelector('#world[data-world=p1-01]');
  const out016='/tmp/c016-screens';
  fs.mkdirSync(out016,{recursive:true});
  await gearPage.screenshot({path:out016+'/stamps.png',animations:'disabled'});
  const beforeGear=await gearPage.evaluate(()=>localStorage.getItem('cards.v0.p.son'));
  ok('C016: revised first-world stamps and the earned legacy outfit are rendered',await gearPage.evaluate(()=>{
    const stamps=[...document.querySelectorAll('#world .gate-stamp')].map(e=>e.closest('[data-id]').dataset.id);
    return stamps.includes('p1-01-detour-2-3')&&stamps.includes('p1-01-detour-3-3')&&
      document.querySelector('#rider use').getAttribute('href')==='#c011-look-sea-coat-idle';
  }));
  await gearPage.click('[data-act=wardrobe]');
  await gearPage.click('[data-act=gear-tab][data-slot=hat]');
  const hatLocked=await gearPage.locator('[data-act=gear][data-id=p1-04]').isDisabled();
  await gearPage.click('[data-act=gear][data-id=p1-01]');
  const colorLocked=await gearPage.locator('[data-act=gear-color][data-color="2"]').isDisabled();
  await gearPage.click('[data-act=gear-color][data-color="1"]');
  ok('C016: a world castle opens its hat only, star thresholds select color, and the legacy coat stays equipped',
    hatLocked&&colorLocked&&await gearPage.evaluate(()=>{
      const look=JSON.parse(localStorage.getItem('cards.v0.look.son'));
      return look.slots.hat.id==='p1-01'&&look.slots.hat.color===1&&look.outfit==='sea-coat'&&
        !!document.querySelector('#rider use[href="#c016-coat-legacy-sea-coat-0"]');
    }));
  await gearPage.screenshot({path:out016+'/wardrobe.png',animations:'disabled'});
  await gearPage.click('[data-act=gear-tab][data-slot=ride]');
  const rideLocked=await gearPage.locator('[data-act=gear][data-id=c2]').isDisabled();
  await gearPage.click('[data-act=gear][data-id=c1]');
  await gearPage.click('[data-act=gear-tab][data-slot=pet]');
  const petLocked=await gearPage.locator('[data-act=gear][data-id=lizard]').isDisabled();
  await gearPage.click('[data-act=gear][data-id=snail]');
  await gearPage.click('#wardrobe .sec[data-act=look-close]');
  ok('C016: ride and pet use separate slots, 4 rider frames and 2 pet frames, without writing child progress',
    rideLocked&&petLocked&&await gearPage.evaluate(before=>{
      const rider=document.querySelector('#rider');
      return localStorage.getItem('cards.v0.p.son')===before&&rider.getBoundingClientRect().width===80&&
        rider.querySelector('.rider-body').dataset.frames==='4'&&rider.querySelector('.rider-pet').dataset.frames==='2'&&
        !!rider.querySelector('use[href="#c016-ride-c1-idle"]')&&getComputedStyle(rider).pointerEvents==='none';
    },beforeGear));
  await gearPage.screenshot({path:out016+'/rider-ride-pet.png',animations:'disabled'});
  await gearPage.evaluate(()=>{
    const key='cards.v0.p.son',s=JSON.parse(localStorage.getItem(key));
    s.words[Object.keys(s.words)[0]].st='learn';
    localStorage.setItem(key,JSON.stringify(s));
  });
  await gearPage.reload();
  await gearPage.waitForSelector('.profiles');
  await gearPage.click('[data-act=pick][data-id=son]');
  await gearPage.waitForSelector('#rider');
  await gearPage.click('[data-act=wardrobe]');
  await gearPage.click('[data-act=gear-tab][data-slot=pet]');
  ok('C016: the earned pet stays unlocked after the known-word count drops and the page reloads',
    await gearPage.locator('[data-act=gear][data-id=snail]').isEnabled()&&
    await gearPage.$eval('#rider use[href="#c016-pet-snail-0"]',e=>!!e));
  await gearPage.click('#wardrobe .sec[data-act=look-close]');
  const mounted = await gearPage.evaluate(() => {
    const choice = document.querySelector('#world .node.open.nearby');
    const rider = document.querySelector('#rider');
    choice.click();
    const move = rider.getAnimations()[0];
    const pet = rider.querySelector('.rider-pet').getAnimations()[0];
    if (!move || !pet) return null;
    for (const animation of [move, pet]) {
      animation.pause();
      animation.currentTime = animation.effect.getTiming().duration * .6;
    }
    const follows = pet.effect.getKeyframes().some(frame => frame.transform !== 'translate(0px, 0px)');
    const mountedArt = !!rider.querySelector('use[href="#c016-ride-c1-move"]') &&
      !!rider.querySelector('use[href="#c016-body-teal-walk3"]') && rider.classList.contains('mounted');
    return { id: choice.dataset.id, follows, mountedArt };
  });
  if (mounted) {
    await gearPage.screenshot({path:out016+'/mounted-pet.png'});
    await gearPage.locator(`[data-act=node][data-id="${mounted.id}"]`).evaluate(button => button.click());
    await gearPage.waitForSelector(READY);
  }
  ok('C016: the courier rides while moving, the pet follows the previous stop, and a second tap still opens the tile',
    mounted?.follows && mounted.mountedArt && await gearPage.evaluate(id=>window.__cards.node?.unit===id,mounted.id));
  await gearCtx.close();

  // C-017 identity overlays and measured idle movement.
  const kidsOut='/tmp/c017-screens';
  fs.mkdirSync(kidsOut,{recursive:true});
  const kids=await browser.newContext({viewport:{width:1180,height:820}});
  const mapKids=[];
  for (const [child,world] of [['son','p1-03'],['daughter','p1-01']]) {
    const page=await kids.newPage();
    page.on('pageerror',e=>errs.push(String(e)));
    await page.goto(BASE+'?today=2026-11-18&triage=off&nosync=1&sound=off&storm=off');
    await page.waitForSelector('.profiles');
    await page.evaluate(async({child,world})=>{
      const {newState}=await import('./js/deck.js'), {ensureMap}=await import('./js/map.js');
      const st=newState(child), map=ensureMap(st);
      map.at=world;
      map.worlds[world]={castle:'2026-11-17',seen:'2026-11-17',cleared:{},stamps:{}};
      localStorage.setItem('cards.v0.p.'+child,JSON.stringify(st));
    },{child,world});
    await page.click(`[data-act=pick][data-id=${child}]`);
    await page.waitForSelector('#rider .rider-body');
    mapKids.push(page);
  }
  const signature=(page,sel)=>page.locator(sel).evaluate(el=>
    [...el.querySelectorAll('use[data-layer=hair],use[data-layer=identity]')].map(use=>use.getAttribute('href')));
  const sonSignature=['#c017-hair-son','#c017-scarf-son'];
  const daughterSignature=['#c017-hair-daughter','#c017-heart-daughter'];
  const [sonMap,daughterMap]=mapKids;
  const mapSignatures=await Promise.all(mapKids.map(page=>signature(page,'#rider .rider-body')));
  ok('C017: every map frame carries only its own child’s hair and marker',
    JSON.stringify(mapSignatures)===JSON.stringify([Array(4).fill(sonSignature).flat(),Array(4).fill(daughterSignature).flat()]),
    JSON.stringify(mapSignatures));

  const motionSample=(page)=>page.locator('#rider .rider-body').evaluate(el=>{
    const animation=el.getAnimations()[0];
    if (!animation) return null;
    animation.pause();
    const duration=animation.effect.getTiming().duration;
    el.style.animation='none';
    const origin=el.getBoundingClientRect();
    el.style.animation='';
    const paused=el.getAnimations()[0];
    paused.pause();
    const points=Array.from({length:16},(_,i)=>{
      paused.currentTime=duration*i/16;
      const bounds=el.getBoundingClientRect();
      return [bounds.left-origin.left,bounds.top-origin.top];
    });
    paused.play();
    return {duration,quarters:[0,4,8,12].map(i=>points[i]),max:Math.max(...points.map(([x,y])=>Math.hypot(x,y)))};
  });
  const [sonMotion,daughterMotion]=await Promise.all(mapKids.map(motionSample));
  const near=(value,expected)=>Math.abs(value-expected)<.001;
  ok('C017: the map idle curves are 1.4-second sway and 0.8-second hop, at most 3 CSS px apart by no more than 1 px',
    sonMotion?.duration===1400&&daughterMotion?.duration===800&&near(sonMotion.max,2)&&near(daughterMotion.max,3)&&
    daughterMotion.max-sonMotion.max<=1&&JSON.stringify(sonMotion.quarters)===JSON.stringify([[-2,0],[0,1],[2,0],[0,1]])&&
    JSON.stringify(daughterMotion.quarters)===JSON.stringify([[0,0],[0,-2],[0,-3],[0,-2]]),
    JSON.stringify({son:sonMotion,daughter:daughterMotion}));

  async function pairCapture(name, images) {
    const comparison=await kids.newPage();
    await comparison.setViewportSize({width:Math.min(1880,images.length*780),height:820});
    await comparison.setContent(`<main style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;background:#f8efd6;color:#233f3a;font:20px system-ui">${images.map((img,i)=>`<figure style="margin:0;text-align:center"><figcaption>${i===0?'아들':'딸'}</figcaption><img alt="" style="width:100%;max-height:740px;object-fit:contain;image-rendering:pixelated" src="data:image/png;base64,${img.toString('base64')}"></figure>`).join('')}</main>`);
    await comparison.locator('main').screenshot({path:`${kidsOut}/${name}.png`});
    await comparison.close();
  }
  await pairCapture('map-couriers',await Promise.all(mapKids.map(page=>page.locator('#world').screenshot({animations:'disabled'}))));
  for (const [page,slot,item,badge,file] of [
    [sonMap,'coat','p1-03',sonSignature[1],'son-coat'],
    [daughterMap,'hat','p1-01',daughterSignature[1],'daughter-hat']
  ]) {
    await page.click('[data-act=wardrobe]');
    await page.click(`[data-act=gear-tab][data-slot=${slot}]`);
    await page.click(`[data-act=gear][data-id=${item}]`);
    const visible=await page.locator('.gear-preview').evaluate((el,{slot,item,badge})=>{
      const gear=el.querySelector(`use[data-layer=${slot}][href="#c016-${slot}-${item}-0"]`);
      const mark=el.querySelector(`use[data-layer=identity][href="${badge}"]`);
      return !!gear&&!!mark&&!!mark.getBBox().width&&!!(gear.compareDocumentPosition(mark)&Node.DOCUMENT_POSITION_FOLLOWING);
    },{slot,item,badge});
    ok(`C017: ${file} keeps the original marker on top of the selected layer`,visible);
    await page.locator('.wardrobe').screenshot({path:`${kidsOut}/${file}.png`,animations:'disabled'});
    await page.click('#wardrobe .sec[data-act=look-close]');
  }
  await Promise.all(mapKids.map(page=>page.emulateMedia({reducedMotion:'reduce'})));
  const mediaPaused=await Promise.all(mapKids.map(motionSample));
  await Promise.all(mapKids.map(page=>page.emulateMedia({reducedMotion:'no-preference'})));
  await sonMap.click('[data-act=home]');
  const homeMotion=page=>page.locator('.home-courier').evaluateAll(el=>el.map(face=>getComputedStyle(face).animationName));
  const homePlaying=await homeMotion(sonMap);
  await sonMap.click('[data-act=parent]');
  await sonMap.click('[data-act=reduce-motion]');
  await Promise.all(mapKids.map(page=>page.reload()));
  await Promise.all(mapKids.map(async(page,i)=>{
    const child=i===0?'son':'daughter';
    await page.click(`[data-act=pick][data-id=${child}]`);
    await page.waitForSelector('#rider .rider-body');
  }));
  const prefPaused=await Promise.all(mapKids.map(motionSample));
  await sonMap.click('[data-act=home]');
  const homePaused=await homeMotion(sonMap);
  ok('C017: the browser preference and the parent switch both stop either child’s idle movement',
    [...mediaPaused,...prefPaused].every(value=>value===null)&&
    JSON.stringify(homePlaying)===JSON.stringify(['courier-son-idle','courier-daughter-idle'])&&
    JSON.stringify(homePaused)===JSON.stringify(['none','none']));

  const throwImages=[];
  for (const [id,expected] of [['son',sonSignature],['daughter',daughterSignature]]) {
    const throwCtx=await browser.newContext({viewport:{width:1180,height:820}});
    const throwPage=await open(throwCtx,'today=2026-11-18&triage=off&sound=off&seed=9');
    await throwPage.click(`[data-act=pick][data-id=${id}]`);
    await startNode(throwPage,'A1');
    await throwPage.addStyleTag({content:'.thrower { animation:none !important; }'});
    await throwPage.evaluate(()=>{
      window.__cards.run.rng=()=>.99;
      document.querySelector('.act.yes').click();
    });
    await throwPage.waitForSelector('.thrower svg');
    const layers=await signature(throwPage,'.thrower');
    ok(`C017: ${id} keeps identity in the active throwing frame`,JSON.stringify(layers)===JSON.stringify(expected));
    throwImages.push(await throwPage.locator('#app').screenshot({animations:'disabled'}));
    await throwCtx.close();
  }
  await pairCapture('card-couriers',throwImages);
  await kids.close();

  // C-018 wardrobe slots, old device looks, and gifts on the world map.
  const out018='/tmp/c018-screens';
  fs.mkdirSync(out018,{recursive:true});
  const polish=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true});
  const polishPage=await polish.newPage();
  polishPage.on('pageerror',e=>errs.push(String(e)));
  await polishPage.goto(BASE+'?today=2026-11-18&fast=1&nosync=1&sound=off&storm=off');
  await polishPage.waitForSelector('.profiles');
  await polishPage.evaluate(async()=>{
    const {newState}=await import('./js/deck.js'), {ensureMap}=await import('./js/map.js');
    const st=newState('son'), map=ensureMap(st);
    map.at='p1-01';
    for (const id of ['p1-01','p1-02']) map.worlds[id]={castle:'2026-11-17',seen:'2026-11-17',cleared:{},stamps:{}};
    localStorage.setItem('cards.v0.p.son',JSON.stringify(st));
    localStorage.setItem('cards.v0.look.son',JSON.stringify({outfit:'leaf-cap',slots:{
      coat:{id:'leaf-cap',color:0},hat:{id:'p1-01',color:0},bag:{id:'p1-02',color:0}
    }}));
  });
  const legacyHat='[data-act=gear][data-slot=hat][data-id=leaf-cap]';
  await polishPage.click('[data-act=pick][data-id=son]');
  await polishPage.waitForSelector('#rider');
  const beforePolish=await polishPage.evaluate(()=>localStorage.getItem('cards.v0.p.son'));
  await polishPage.click('[data-act=wardrobe]');
  await polishPage.screenshot({path:out018+'/wardrobe-hats.png',animations:'disabled'});
  const migrated=await polishPage.evaluate(before=>{
    const doc=JSON.parse(localStorage.getItem('cards.v0.look.son'));
    return doc.outfit==='default'&&!doc.slots.coat&&doc.slots.hat.id==='leaf-cap'&&doc.slots.bag.id==='p1-02'&&
      localStorage.getItem('cards.v0.p.son')===before;
  },beforePolish);
  await polishPage.click('[data-act=gear][data-slot=hat][data-id=p1-01]');
  await polishPage.reload(); await polishPage.waitForSelector('.profiles');
  await polishPage.click('[data-act=pick][data-id=son]');
  await polishPage.click('[data-act=wardrobe]');
  await polishPage.click(legacyHat);
  ok('C018: an old coat-slot star hat moves to the hat slot, remains earned, and keeps the other slots and child JSON',
    migrated&&await polishPage.locator(legacyHat).getAttribute('aria-pressed')==='true'&&await polishPage.evaluate(before=>
      localStorage.getItem('cards.v0.p.son')===before&&!!document.querySelector('#rider use[data-layer=hat][href="#c016-hat-legacy-leaf-cap-0"]'),beforePolish));

  const slots018={hat:[['leaf-cap','잎사귀 모자',12],['night-cap','밤하늘 모자',240]],
    bag:[['sun-bag','햇살 가방',40],['letter-bag','편지 가방',500]],coat:[['sea-coat','물결 옷',100],['festival-coat','축제 옷',1000]],ride:[],pet:[]};
  const layout018=[], silhouettes018=[];
  for(const [slot,legacy] of Object.entries(slots018)){
    await polishPage.click(`[data-act=gear-tab][data-slot=${slot}]`);
    const checked=await polishPage.locator('.looks .gear:not([data-id=default])').evaluateAll((buttons,{slot,legacy})=>{
      const starred=buttons.filter(b=>b.querySelector('.star-gift'));
      const locked=buttons.filter(b=>b.disabled);
      const artIds=buttons.every(b=>b.dataset.slot===slot&&b.querySelector('use').getAttribute('href').startsWith(`#c016-${slot}-`));
      const starNames=starred.length===legacy.length&&legacy.every(([id,name,stars])=>starred.some(b=>b.dataset.id===id&&
        b.querySelector('b').textContent===name&&(!b.disabled||b.querySelector('small').textContent===`★ ${stars}에 열려요`)));
      const silhouettes=locked.length>0&&locked.every(b=>{
        const drawing=b.querySelector('svg.gear-art'), use=drawing?.querySelector('use');
        if(!use) return false;
        const art=use.getBBox(), view=drawing.viewBox.baseVal;
        return b.classList.contains('silhouette')&&getComputedStyle(b).opacity==='1'&&getComputedStyle(drawing).filter.includes('brightness(0)')&&
          art.width>=10&&art.height>=8&&art.height/art.width>=.25&&art.x>=view.x&&art.y>=view.y&&
          art.x+art.width<=view.x+view.width&&art.y+art.height<=view.y+view.height&&b.querySelector('small').textContent.length>0;
      });
      return {layout:buttons.length===(legacy.length?12:3)&&artIds&&starNames,silhouettes};
    },{slot,legacy});
    layout018.push(checked.layout);silhouettes018.push(checked.silhouettes);
    if(slot==='coat') await polishPage.screenshot({path:out018+'/locked-items.png',animations:'disabled'});
  }
  ok('C018: every wardrobe slot contains only its own item type, and exactly the six legacy items carry star gifts',layout018.every(Boolean),JSON.stringify(layout018));
  ok('C018: every locked item shows a dark, fully framed item-shaped silhouette and its unlock condition',silhouettes018.every(Boolean),JSON.stringify(silhouettes018));

  await polishPage.click('#wardrobe .sec[data-act=look-close]');
  await polishPage.click('[data-act=atlas]');
  await polishPage.screenshot({path:out018+'/world-atlas.png',animations:'disabled'});
  const atlasQuiet=await polishPage.evaluate(()=>{
    const icons=[...document.querySelectorAll('.atlas-stop .atlas-gift')];
    return icons.length===30&&icons.every(icon=>!icon.textContent.trim()&&!!icon.querySelector('use'))&&
      !document.querySelector('.atlas .world-gift')&&!!document.querySelector('.atlas-gift[data-id=p1-01] .gift-check path')&&
      !document.querySelector('.atlas-gift[data-id=p1-04] .gift-check');
  });
  const lockedVillage=polishPage.locator('.wcard[data-id=p1-04]');
  const lockedStill=await lockedVillage.isDisabled();
  const sign=lockedVillage.locator('b');
  await sign.scrollIntoViewIfNeeded();
  const labelPosition=await sign.boundingBox();
  await polishPage.touchscreen.tap(labelPosition.x+labelPosition.width/2,labelPosition.y+labelPosition.height/2);
  const guide=await polishPage.locator('#banner:not([hidden])').textContent();
  await polishPage.click('#banner [data-act=hide]');
  await polishPage.click('.wcard[data-id=p1-02]');
  await polishPage.waitForSelector('#world[data-world=p1-02]');
  const mapGift=await polishPage.locator('.world-gift').evaluate(el=>
    el.textContent.includes('과일 주머니')&&el.querySelector('svg').getBoundingClientRect().height>=2*el.querySelector('span').getBoundingClientRect().height);
  ok('C018: atlas gifts use icons with earned checks, village taps reveal the name, and the world gift is double text height',
    atlasQuiet&&lockedStill&&guide.includes('나무결 모자')&&mapGift);
  await polish.close();

  // C-019 uses a scheduled date at deployment. Exercise both sides of a date
  // on the original app code, substituting only that setting in this browser.
  const cutoff='2026-11-18', previousDay='2026-11-17';
  const tierSource=fs.readFileSync(path.join(__dirname,'../cards/js/main.js'),'utf8');
  const dateSetting=/^const ITEM_TIERS_FROM = (?:null|'\d{4}-\d{2}-\d{2}');$/m;
  if (!dateSetting.test(tierSource)) throw new Error('Could not find the C-019 rollout date setting.');
  const tierCode=tierSource.replace(dateSetting,`const ITEM_TIERS_FROM = '${cutoff}';`);
  const tierOut='/tmp/c019-screens';
  fs.mkdirSync(tierOut,{recursive:true});
  const rewards=await browser.newContext({viewport:{width:1180,height:820},reducedMotion:'no-preference'});
  await rewards.route('**/js/main.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:tierCode}));
  const tierPage=await rewards.newPage();
  tierPage.on('pageerror',e=>errs.push(String(e)));
  const tierTab=slot=>tierPage.click(`[data-act=gear-tab][data-slot=${slot}]`);
  const tierGear=id=>tierPage.locator(`[data-act=gear][data-id=${id}]`);
  const leaveTiers=()=>tierPage.click('#wardrobe .sec[data-act=look-close]');
  async function tierProfile({pid='son',day=cutoff,at='p1-01',castles={},conts={},slots={},stars=0}) {
    await tierPage.goto(BASE+`?today=${day}&nosync=1&sound=off&storm=off`);
    await tierPage.waitForSelector('.profiles');
    await tierPage.evaluate(async({pid,at,castles,conts,slots,stars,day})=>{
      const {newState}=await import('./js/deck.js'), {ensureMap}=await import('./js/map.js');
      const st=newState(pid), map=ensureMap(st);
      map.at=at; map.stars=stars;
      for (const [id,date] of Object.entries(castles)) map.worlds[id]={castle:date,seen:date,cleared:{},stamps:{}};
      map.worlds[at]??={castle:null,seen:day,cleared:{},stamps:{}};
      map.conts=Object.fromEntries(Object.entries(conts).map(([id,castle])=>[id,{castle}]));
      localStorage.setItem(`cards.v0.p.${pid}`,JSON.stringify(st));
      localStorage.setItem(`cards.v0.look.${pid}`,JSON.stringify({outfit:'default',slots}));
    },{pid,at,castles,conts,slots,stars,day});
    await tierPage.click(`[data-act=pick][data-id=${pid}]`);
    await tierPage.waitForSelector(`#world[data-world=${at}]`);
  }
  await tierProfile({day:previousDay,castles:{'p1-01':previousDay}});
  await tierPage.click('[data-act=wardrobe]');
  const beforeCutoff=await tierGear('p1-01').isEnabled()&&await tierGear('c019-h-straw').count()===0;
  await tierProfile({castles:{'p1-01':cutoff}});
  const noFirstWorldGift=await tierPage.locator('.world-gift').count()===0;
  await tierPage.click('[data-act=wardrobe]');
  const zeroHats=await tierPage.locator('.gear[data-rank]:enabled').count()===0;
  await tierTab('bag');
  const zeroBags=await tierPage.locator('.gear[data-rank]:enabled').count()===0;
  await tierTab('coat');
  const zeroCoats=await tierPage.locator('.gear[data-id]:enabled:not([data-id=default])').count()===0;
  await leaveTiers();
  await tierPage.click('[data-act=atlas]');
  const atlasRewards=await tierPage.locator('button.atlas-gift').evaluateAll(icons=>icons.map(icon=>icon.dataset.id));
  await tierProfile({at:'p1-02',castles:{'p1-01':cutoff,'p1-02':cutoff}});
  const secondWorldGift=await tierPage.locator('.world-gift span').textContent();
  await tierPage.click('[data-act=wardrobe]');
  const firstHat=await tierGear('c019-h-straw').isEnabled()&&await tierPage.locator('.gear[data-rank]:enabled').count()===1;
  await tierProfile({at:'p1-08',castles:Object.fromEntries(Array.from({length:8},(_,i)=>[`p1-0${i+1}`,cutoff]))});
  await tierPage.click('[data-act=wardrobe]');
  await tierTab('coat');
  const fieldCoatsLocked=await tierPage.locator('.gear[data-id]:enabled:not([data-id=default])').count()===0;
  ok('C019: the date switches the schedule, the first castle gives nothing, and new field records cannot earn coats',
    beforeCutoff&&noFirstWorldGift&&zeroHats&&zeroBags&&zeroCoats&&firstHat&&fieldCoatsLocked&&secondWorldGift.includes('밀짚 우편모자')&&
    JSON.stringify(atlasRewards)===JSON.stringify(['p1-02','p1-05','p1-08','p2-02','p2-04','p2-06','p2-08','p2-10','p2-12','p2-15','p3-02','p3-04','p3-06','p3-07']));

  await tierProfile({at:'p1-01',castles:{'p1-01':previousDay,'p1-02':previousDay,'p1-03':previousDay,'p1-06':previousDay},stars:3,
    slots:{hat:{id:'p1-01',color:1},bag:{id:'p1-02',color:0},coat:{id:'p1-03',color:0}}});
  const beforeMigration=await tierPage.evaluate(()=>localStorage.getItem('cards.v0.p.son'));
  await tierPage.click('[data-act=wardrobe]');
  const hatMigrated=await tierGear('c019-h-straw').getAttribute('aria-pressed')==='true';
  await tierTab('bag');
  const bagMigrated=await tierGear('c019-b-acorn').getAttribute('aria-pressed')==='true';
  await tierTab('coat');
  const coatsKept=await tierGear('p1-03').getAttribute('aria-pressed')==='true'&&await tierGear('p1-06').isEnabled();
  await tierPage.reload(); await tierPage.waitForSelector('.profiles');
  await tierPage.click('[data-act=pick][data-id=son]'); await tierPage.waitForSelector('#rider');
  const migratedRecord=await tierPage.evaluate(before=>{
    const look=JSON.parse(localStorage.getItem('cards.v0.look.son'));
    return look.slots.hat.id==='c019-h-straw'&&look.slots.hat.color===1&&look.slots.bag.id==='c019-b-acorn'&&look.slots.coat.id==='p1-03'&&
      !!document.querySelector('#rider use[href="#c019-coat-p1-03-0"]')&&localStorage.getItem('cards.v0.p.son')===before;
  },beforeMigration);
  ok('C019: earlier castle dates retain equivalent unlocks and both archived field coats without rewriting child records',
    hatMigrated&&bagMigrated&&coatsKept&&migratedRecord);

  const sky={
    at:'p3-07',stars:40,conts:{c1:previousDay,c2:previousDay},
    castles:Object.fromEntries([[1,8],[2,15],[3,7]].flatMap(([band,count])=>
      Array.from({length:count},(_,i)=>[`p${band}-${String(i+1).padStart(2,'0')}`,cutoff]))),
    slots:{hat:{id:'c019-h-plume',color:0},bag:{id:'c019-b-dawn',color:0},coat:{id:'c019-c-star',color:0}}
  };
  const motionCheck=()=>tierPage.locator('#rider .rider-body .frame:first-child .gear-glint').evaluateAll(frames=>({
    count:frames.length, active:frames.filter(f=>getComputedStyle(f).animationName==='gear-shimmer').length
  }));
  await tierProfile({...sky,pid:'son'});
  const couldMove=await motionCheck();
  const sonIdentity=await tierPage.locator('#rider use[href="#c017-scarf-son"]').count()>0;
  await tierPage.screenshot({path:tierOut+'/sky-son.png'});
  await tierPage.click('[data-act=wardrobe]');
  for (const [slot,file] of [['hat','hats'],['bag','bags'],['coat','coats']]) {
    await tierTab(slot);
    await tierPage.screenshot({path:`${tierOut}/${file}.png`});
  }
  const noEarlySpark=await tierPage.locator('.gear:not([data-rank="3"]) .gear-glint').count()===0;
  await tierProfile({...sky,pid:'daughter'});
  const daughterIdentity=await tierPage.locator('#rider use[href="#c017-heart-daughter"]').count()>0;
  await tierPage.screenshot({path:tierOut+'/sky-daughter.png'});
  await tierPage.emulateMedia({reducedMotion:'reduce'});
  const mediaQuiet=await motionCheck();
  await tierPage.emulateMedia({reducedMotion:'no-preference'});
  await tierPage.click('[data-act=home]'); await tierPage.click('[data-act=parent]');
  await tierPage.click('[data-act=reduce-motion]'); await tierPage.click('[data-act=home]');
  await tierPage.click('[data-act=pick][data-id=daughter]'); await tierPage.waitForSelector('#rider');
  const deviceQuiet=await motionCheck();
  ok('C019: tier-three glints animate only on the eligible gear and stop for either motion preference',
    couldMove.count===6&&couldMove.active===6&&noEarlySpark&&sonIdentity&&daughterIdentity&&
    mediaQuiet.count===6&&mediaQuiet.active===0&&deviceQuiet.count===6&&deviceQuiet.active===0);
  await rewards.close();

  // C-020: exercise the real pacing and first-use screens at an iPad landscape size.
  const firstPlayOut = '/tmp/c020-screens';
  fs.mkdirSync(firstPlayOut, { recursive:true });
  const captureFirstPlay = (page, name) => page.screenshot({ path:path.join(firstPlayOut, name+'.png'), animations:'disabled' });
  const firstPlayCtx = await browser.newContext({ viewport:{ width:1024, height:768 }, hasTouch:true, reducedMotion:'reduce' });
  const pacing = await open(firstPlayCtx, 'today=2026-11-18&triage=off&sound=off&seed=5');
  await pacing.tap('[data-act=pick][data-id=son]');
  await startNode(pacing, 'A1');
  const holdMeaning = async (page, input, name) => {
    const position = () => page.evaluate(() => window.__cards.run?.i);
    const before = await position(), {id} = await cur(page);
    const {form,ko} = WORDS.find(word => word.id === id);
    await page.tap(input);
    await page.waitForSelector('#card.back.learn');
    await sleep(5100);
    const kept = await position() === before && await page.locator('#card.back .ko').textContent() === ko &&
      await page.locator('#card.back .word').textContent() === form && await nextCard(page).isVisible();
    if (name) await captureFirstPlay(page, name);
    await nextCard(page).tap();
    await page.waitForSelector(READY);
    return kept && await position() === before+1;
  };
  const unknownId = (await cur(pacing)).id;
  const unknownHeld = await holdMeaning(pacing, '.act.no', 'unknown-meaning');
  await pacing.evaluate(() => { window.__cards.run.rng = () => 0; });
  await pacing.tap('.act.yes');
  await pacing.waitForSelector('.opt:not([disabled])');
  const wrongHeld = await holdMeaning(pacing, `.opt[data-i="${((await cur(pacing)).ans+1)%3}"]`);
  await pacing.tap('.act.yes');
  await pacing.waitForSelector('.opt:not([disabled])');
  const correctAt = await pacing.evaluate(() => window.__cards.run.i);
  await pacing.tap(`.opt[data-i="${(await cur(pacing)).ans}"]`);
  await pacing.waitForFunction(i => window.__cards.run.i === i+1, correctAt);
  const correctAdvanced = !await nextCard(pacing).count();
  const unknownRecord = (await state(pacing,'son')).words[unknownId];
  await firstPlayCtx.close();

  const hintCtx = await browser.newContext({ viewport:{width:1024,height:768}, hasTouch:true, reducedMotion:'reduce' });
  const hintPage = await open(hintCtx, 'today=2026-11-18&sound=off&seed=31');
  const firstHint = hintPage.getByText('봉투 하나를 골라 눌러 봐!', { exact:true });
  await hintPage.tap('[data-act=pick][data-id=son]');
  await firstHint.waitFor();
  const hintAboveMap = await firstHint.evaluate(el => {
    const box = el.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= innerHeight && box.bottom <= document.querySelector('#world').getBoundingClientRect().top;
  });
  const choices = await hintPage.locator('#world button.node.open').count();
  await captureFirstPlay(hintPage, 'first-map-hint');
  await hintPage.tap('[data-act=node][data-id=A1]');
  await hintPage.waitForSelector('.twords');
  for (const word of await hintPage.locator('.tw').all()) await word.tap();
  const listNote = await hintPage.locator('#triage-note').evaluate(el => !el.hidden &&
    el.textContent === '고른 단어를 배우고, 아는 단어도 몇 개 확인해요' &&
    el.getBoundingClientRect().top >= document.querySelector('#tgo').getBoundingClientRect().bottom);
  await hintPage.tap('#tgo');
  await hintPage.waitForSelector('.act.see:not([disabled])');
  const taughtHeld = await holdMeaning(hintPage, '.act.see');
  ok('C020: unknown, wrong and first-taught meanings wait 5 seconds and require Next; a correct answer advances by itself',
    unknownHeld && wrongHeld && taughtHeld && correctAdvanced &&
    unknownRecord.st === 'learn' && unknownRecord.miss === '2026-11-18' && unknownRecord.misses === 1 && unknownRecord.lapses === 0);
  await hintPage.reload();
  await hintPage.tap('[data-act=pick][data-id=son]');
  await hintPage.waitForSelector('#world');
  const goneForSon = !await firstHint.count();
  await hintPage.tap('[data-act=home]');
  await hintPage.tap('[data-act=pick][data-id=daughter]');
  await firstHint.waitFor();
  ok('C020: all three envelopes are offered, the list explains its spot checks, and the hint persists only for the unstarted child',
    hintAboveMap && choices === 3 && listNote && goneForSon && await firstHint.isVisible());
  await hintCtx.close();

  const giftCtx = await browser.newContext({ viewport:{width:1024,height:768}, hasTouch:true, reducedMotion:'reduce' });
  const giftPage = await giftCtx.newPage();
  giftPage.on('pageerror', e => errs.push(String(e)));
  await giftPage.goto(BASE+'?today=2026-11-20&sound=off&storm=off&nosync=1&seed=5');
  await giftPage.waitForSelector('.profiles');
  await giftPage.evaluate(async () => {
    const {newState} = await import('./js/deck.js'), {ensureMap} = await import('./js/map.js');
    const s = newState('son'), map = ensureMap(s);
    map.at = 'p1-05';
    map.stars = 40;
    for (const id of ['p1-01','p1-02','p1-03','p1-04']) map.worlds[id] = { castle:'2026-11-19', cleared:{}, stamps:{}, seen:'2026-11-19' };
    for (const tile of window.__cards.ix.byId[map.at].map.nodes) for (const id of tile.words || []) s.words[id] = { st:'done', due:null };
    localStorage.setItem('cards.v0.p.son', JSON.stringify(s));
  });
  await giftPage.tap('[data-act=pick][data-id=son]');
  await giftPage.waitForSelector('#world[data-world=p1-05]');
  await giftPage.tap('#world .node.castle.open');
  await giftPage.waitForSelector(READY);
  const examCount = await giftPage.evaluate(() => window.__cards.run.queue.length);
  for (let i = 0; i < examCount; i++) {
    await giftPage.waitForSelector('.opt:not([disabled])');
    await answer(giftPage,`.opt[data-i="${(await cur(giftPage)).ans}"]`);
  }
  ok('C020: answering all 12 castle cards shows the exact correct/total and no skipped-card copy',
    examCount === 12 && await giftPage.locator('h1').textContent() === '성을 깼어요!' &&
    await giftPage.locator('.result-cards span').textContent() === '뜻을 맞힌 단어' &&
    await giftPage.locator('.result-cards b').textContent() === '12개 / 12' &&
    !/넘긴/.test(await giftPage.locator('.tiles').textContent()));
  await captureFirstPlay(giftPage, 'castle-result');
  const giftLink = giftPage.getByRole('button', { name:'도토리 허리주머니', exact:true });
  const realPreview = await giftLink.locator('use').evaluate(use => !!document.querySelector(use.getAttribute('href')));
  await giftLink.tap();
  const bagTab = giftPage.locator('[data-act=gear-tab][data-slot=bag]');
  const giftCard = giftPage.locator('.gear[data-id=c019-b-acorn]');
  const rightPlace = await bagTab.getAttribute('aria-pressed') === 'true' && await bagTab.getByText('새로').isVisible() &&
    await giftCard.evaluate(el => document.activeElement === el && !el.disabled && el.classList.contains('gift-target')) &&
    await giftCard.getByText('새로').isVisible();
  await captureFirstPlay(giftPage, 'new-gift');
  await giftPage.waitForFunction(() => JSON.parse(localStorage.getItem('cards.v0.seen'))?.son?.viewedGifts?.['c019-b-acorn']);
  await giftPage.getByRole('button',{name:'닫기',exact:true}).last().tap();
  await giftLink.tap();
  ok('C020: a castle links a named gift with matching art to its highlighted wardrobe slot; seen badges clear on revisit',
    realPreview && rightPlace && !await giftCard.getByText('새로').count() && !await bagTab.getByText('새로').count());
  await giftCtx.close();

  const earlyCtx = await browser.newContext({ viewport:{width:1024,height:768}, hasTouch:true });
  const early = await open(earlyCtx, 'today=2026-11-18&sound=off');
  const firstRecords = await early.evaluate(() => {
    const g = window.__cards;
    const son = Object.fromEntries(g.words.slice(0,20).map(({id},i) => [id, {
      st:i === 0 ? 'learn' : 'likely', firstDay:i < 10 ? '2026-11-16' : '2026-11-18',
      ...(i === 0 ? { miss:'2026-11-16', misses:2, lapses:1 } : {})
    }]));
    const daughter = Object.fromEntries(g.words.slice(20,24).map(({id},i) => [id, {
      st:'review', step:0, firstDay:['2026-11-15','2026-11-16','2026-11-18','2026-11-19'][i]
    }]));
    return Object.entries({son,daughter}).map(([id,words]) => {
      const record = JSON.stringify({v:3,id,words,runs:[{day:'2026-11-18',reason:'done'}]});
      localStorage.setItem('cards.v0.p.'+id,record);
      return [id,record];
    });
  });
  await early.reload();
  await early.waitForSelector('.home-goal');
  const sonPanel = early.locator('.profile[data-id=son]');
  ok('C020: first week shows 0 firm, 20 met and +20 new, and the joint target sums only words first seen this week to date',
    await sonPanel.locator('.home-count').textContent() === '익힌 단어 0' &&
    await sonPanel.locator('.home-met').textContent() === '만난 단어 20' &&
    await sonPanel.locator('.home-week').textContent() === '이번 주 새 단어 +20 · 익힌 +0' &&
    await early.locator('.home-goal').textContent() === '이번 주 둘이 함께 새 단어 +22 / 목표 42' &&
    await early.locator('.office-post use').count() === 2 &&
    await early.evaluate(records => records.every(([id,record]) => localStorage.getItem('cards.v0.p.'+id) === record), firstRecords));
  await captureFirstPlay(early, 'first-week-home');
  await earlyCtx.close();

  ok('no uncaught page errors / console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close(); server.kill();
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('cards e2e crashed', e); try { server.kill(); } catch {} process.exit(2); });
