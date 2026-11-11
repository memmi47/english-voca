// Browser E2E (Chromium via Playwright). Run: node tests/e2e.cjs  (server: python3 -m http.server 8077 -d game)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8077/';
const results = []; const errs = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, ctx, q = '') {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + (q ? '?' + q : '')); await page.waitForSelector('#app h1, #app h2');
  return page;
}
async function gate(page) {
  await page.click('[data-act=parent]'); await page.waitForSelector('#gate');
  const t = await page.textContent('.card p'); const [a, b] = t.match(/\d+/g).map(Number);
  await page.fill('#gate', String(a + b)); await page.click('[data-act=gate]'); await page.waitForSelector('[data-act=demo]');
}
async function loadDemo(page) { await gate(page); await page.click('[data-act=demo]'); await page.waitForSelector('#imp-r .right'); await page.click('#app [data-act=home]'); await page.waitForSelector('.profiles'); }
async function startAs(page, id) {
  await page.click(`[data-act=pick][data-id=${id}]`); await page.click('[data-act=start]'); await page.waitForSelector('#sc-yes');
  await page.click('[data-act=sc-play]'); await page.waitForFunction(() => !document.querySelector('#sc-yes').disabled); await page.click('[data-act=sc-yes]');
}
// Plays through the session. opts: wrongOnce, quick
async function playAll(page, opts = {}) {
  let wrong = opts.wrongOnce ? 1 : 0; const seen = [];
  for (let guard = 0; guard < 120; guard++) {
    await page.waitForSelector('#app h1, [data-act=learn-next], .opt, .tile', { timeout: 8000 });
    if (await page.$('#app h1')) break;
    if (await page.$('[data-act=learn-next]')) { await page.click('[data-act=learn-next]'); continue; }
    await page.waitForFunction(() => document.querySelector('.opt:not(.locked)') || document.querySelector('.tile:not(.locked)'), null, { timeout: 8000 });
    const info = await page.evaluate(() => { const t = window.__cu.sess.current; return { type: t.q.type, answer: t.q.answer, target: t.q.target, scoring: t.scoring, card: t.q.cardId, retry: t.retry }; });
    seen.push(info);
    if (info.type === 'spell') {
      const word = wrong && info.scoring ? 'zzzzz' : info.target; if (wrong && info.scoring) wrong--;
      for (const ch of word.slice(0, info.target.length)) {
        const sel = await page.evaluateHandle((c) => [...document.querySelectorAll('.tile:not([disabled])')].find((b) => b.textContent === c) || [...document.querySelectorAll('.tile:not([disabled])')][0], ch);
        await sel.asElement().click();
      }
    } else {
      let i = info.answer; if (wrong && info.scoring) { wrong--; i = (info.answer + 1) % 4; if (i >= (await page.$$('.opt')).length) i = 0; }
      await page.click(`.opt[data-i="${i}"]`);
    }
    await page.waitForSelector('#qnext'); await page.click('#qnext');
  }
  return seen;
}
const prof = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem('catchup.v1.p.' + i)), id);

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  let page = await newPage(browser, ctx, 'today=2026-11-11&seed=3');

  // 1. import demo packs
  await loadDemo(page);
  let son = await prof(page, 'son'), dau = await prof(page, 'daughter');
  ok('demo pack imported: son 9 cards, daughter 8 cards', Object.keys(son.cards).length === 9 && Object.keys(dau.cards).length === 8);
  ok('sample flag stored', Object.values(son.cards).every((c) => c.sample));

  // 2. session for son with one wrong answer
  await startAs(page, 'son');
  const t0 = Date.now(); const seen = await playAll(page, { wrongOnce: true });
  await page.waitForSelector('#app h1');
  son = await prof(page, 'son');
  const intro = Object.values(son.cards).filter((c) => c.introduced).length;
  ok('5 new cards introduced (cap)', intro === 5, 'introduced=' + intro);
  ok('retry task appeared after wrong', seen.some((s) => s.retry));
  const wrongCards = Object.values(son.cards).filter((c) => c.lastOutcome === 'wrong');
  ok('wrong first answer -> streak 0, due next day', wrongCards.length === 1 && wrongCards[0].streak === 0 && wrongCards[0].due === '2026-11-12');
  const good = Object.values(son.cards).filter((c) => c.lastOutcome === 'independent');
  ok('independent correct -> due +1 day, streak 1', good.length === 4 && good.every((c) => c.streak === 1 && c.due === '2026-11-12'));
  ok('log marks sound assistance on every question entry (audio, or none for silent cloze)', son.log.filter((e) => e.type !== 'learn').every((e) => e.assist === 'audio' || e.assist === 'none') && son.log.some((e) => e.assist === 'audio'));
  ok('session record saved', son.sessions.length === 1 && son.sessions[0].day === '2026-11-11');
  const hist = await page.evaluate(() => window.__cu.engine.history.map((e) => e.type + ':' + (e.source || e.reason || '')));
  ok('word audio played from files (not speech)', hist.some((h) => h === 'play:file') && !hist.some((h) => h === 'play:speech'), hist.slice(0, 6).join(','));

  // 3. reload keeps records; siblings separate
  await page.reload(); await page.waitForSelector('.profiles');
  const son2 = await prof(page, 'son'); ok('reload keeps progress', JSON.stringify(son2.cards) === JSON.stringify(son.cards));
  dau = await prof(page, 'daughter');
  ok('daughter untouched by son session', Object.values(dau.cards).every((c) => !c.introduced && c.streak === 0 && !c.due) && dau.log.length === 0);

  // 4. re-import same pack keeps progress
  await gate(page); await page.click('[data-act=demo]'); await page.waitForSelector('#imp-r .right');
  son2.cards && ok('re-import keeps progress', JSON.stringify((await prof(page, 'son')).cards) === JSON.stringify(son.cards));
  const tampered = await page.evaluate(async () => { const r = await fetch('data/demo_pack_daughter.json'); const d = await r.json(); return JSON.stringify(d); });
  await page.selectOption('#imp-p', 'son'); await page.fill('#imp-t', tampered); await page.click('[data-act=import]'); await page.waitForSelector('#imp-r .wrong');
  ok("importing daughter's file into son is rejected", /선택한 아이와 다릅니다/.test(await page.textContent('#imp-r')));
  await page.click('#app [data-act=home]');

  // 5. day 2: reviews return, depth steps up
  const p2 = await newPage(browser, ctx, 'today=2026-11-12&seed=5');
  await p2.click('[data-act=pick][data-id=son]');
  const txt = await p2.textContent('.card'); ok('day 2 plan shows 5 reviews + 4 new', /새 단어 4개/.test(txt) && /복습 5개/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 80));
  await p2.click('[data-act=start]'); await p2.waitForSelector('#sc-yes'); await p2.click('[data-act=sc-play]');
  await p2.waitForFunction(() => !document.querySelector('#sc-yes').disabled); await p2.click('[data-act=sc-yes]');
  const seen2 = await playAll(p2);
  const son3 = await prof(p2, 'son');
  ok('day 2 review streak 2 for earlier correct cards', Object.values(son3.cards).filter((c) => c.streak === 2).length >= 3 && Object.values(son3.cards).filter((c) => c.streak === 2).every((c) => c.due === '2026-11-15'));
  ok('review depth stepped up (cloze appears)', seen2.some((s) => s.type === 'cloze'));
  await p2.close();

  // 6. audio failure and recovery
  const p3 = await newPage(browser, ctx, 'today=2026-11-11&seed=9');
  await p3.click('[data-act=pick][data-id=daughter]'); await p3.click('[data-act=start]'); await p3.waitForSelector('#sc-yes');
  await p3.click('[data-act=sc-play]'); await p3.waitForFunction(() => !document.querySelector('#sc-yes').disabled); await p3.click('[data-act=sc-yes]');
  await p3.route('**/audio/dev/**', (r) => r.fulfill({ status: 404, body: 'no' }));
  await p3.click('[data-act=learn-next]');          // learn card 1 (heard fine earlier? navigates to learn 2)
  await p3.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
  ok('failure shows banner with retry', (await p3.textContent('#banner')).includes('다시 듣기'));
  ok('learn view still on same card after failure', !!(await p3.$('[data-act=learn-next]')));
  // advance to the first sound question with audio down
  p3.on('dialog', (d) => d.accept());
  while (await p3.$('[data-act=learn-next]')) { await p3.click('[data-act=learn-next]'); await sleep(150); }
  await p3.waitForSelector('.opt', { timeout: 8000 }); await sleep(800);
  const locked = await p3.evaluate(() => [...document.querySelectorAll('.opt')].every((b) => b.classList.contains('locked')));
  ok('sound question options locked while audio is down', locked);
  const before = await p3.evaluate(() => window.__cu.sess.index);
  await p3.click('.opt[data-i="0"]', { force: true }); await sleep(200);
  ok('tap on locked option is ignored (question kept)', await p3.evaluate(() => window.__cu.sess.index) === before && !(await p3.$('#qnext')));
  await p3.unroute('**/audio/dev/**'); await p3.click('[data-act=retry-audio]'); await sleep(600);
  ok('retry restores sound and unlocks', await p3.evaluate(() => [...document.querySelectorAll('.opt')].every((b) => !b.classList.contains('locked'))) && await p3.$eval('#banner', (b) => b.hidden));
  const issues = (await prof(p3, 'daughter')).audioIssues; ok('audio issue logged', issues.length >= 1);
  await p3.close();

  // 7. 15-minute end (virtual time) : speed 900 => 1 real sec = 15 virtual min
  const p4 = await newPage(browser, ctx, 'today=2026-11-20&seed=4&speed=400');
  await gate(p4); await p4.click('[data-act=demo]'); await p4.waitForSelector('#imp-r .right'); await p4.click('#app [data-act=home]');
  await p4.click('[data-act=pick][data-id=daughter]'); await p4.click('[data-act=start]'); await p4.waitForSelector('#sc-yes');
  await p4.click('[data-act=sc-play]'); await p4.waitForFunction(() => !document.querySelector('#sc-yes').disabled); await p4.click('[data-act=sc-yes]');
  await p4.waitForSelector('[data-act=learn-next]'); await sleep(3500);       // ~23 virtual minutes pass
  await p4.click('[data-act=learn-next]');
  await p4.waitForSelector('#app h1', { timeout: 8000 });
  ok('time cap ends the session', /오늘은 여기까지/.test(await p4.textContent('#app')));
  const d4 = await prof(p4, 'daughter'); ok('time-up session saved with reason', d4.sessions.some((s) => s.reason === 'time'));
  await p4.click('#app [data-act=home]'); await p4.click('[data-act=pick][data-id=daughter]');
  ok('start disabled when daily time is used up', await p4.$eval('[data-act=start]', (b) => b.disabled));
  await p4.close();

  // 8. rapid screen transitions: no page errors, last play wins
  const ctx5 = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const p5 = await newPage(browser, ctx5, 'today=2026-11-30&seed=2');
  await gate(p5); await p5.click('[data-act=demo]'); await p5.waitForSelector('#imp-r .right'); await p5.click('#app [data-act=home]');
  await startAs(p5, 'son');
  for (let i = 0; i < 5; i++) { await p5.click('[data-act=learn-next]'); }       // no waiting
  await sleep(1200);
  const hist5 = await p5.evaluate(() => window.__cu.engine.history.filter((e) => e.type === 'play' || e.type === 'fail').length);
  ok('rapid next x5 -> still consistent', await p5.evaluate(() => window.__cu.sess.index) === 5, 'plays/fails=' + hist5);
  await p5.close();

  // 9. reloading mid-session must not reset the daily 15-minute budget
  const ctx6 = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const p6 = await newPage(browser, ctx6, 'today=2026-12-05&seed=2&speed=200');
  await gate(p6); await p6.click('[data-act=demo]'); await p6.waitForSelector('#imp-r .right'); await p6.click('#app [data-act=home]');
  await startAs(p6, 'son'); await p6.waitForSelector('[data-act=learn-next]'); await sleep(2500);   // ~8 virtual minutes
  await p6.reload(); await p6.waitForSelector('.profiles'); await p6.click('[data-act=pick][data-id=son]');
  const left = Number((await p6.textContent('.card')).match(/남은 시간 (\d+)분/)[1]);
  ok('reload mid-session keeps used time (left < 15 min)', left < 15, 'left=' + left);
  ok('cards introduced in an interrupted session are re-planned (5 new again)', /새 단어 5개/.test(await p6.textContent('.card')), (await p6.textContent('.card')).replace(/\s+/g, ' ').slice(0, 40));
  await p6.close(); await ctx6.close();

  ok('no uncaught page errors / console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  require('fs').writeFileSync(__dirname + '/e2e-results.json', JSON.stringify(results, null, 1));
  console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('E2E crashed', e); process.exit(2); });
