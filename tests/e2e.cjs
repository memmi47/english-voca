// Browser E2E (Chromium via Playwright). Run: node tests/e2e.cjs
// Starts its own tools/serve.py on a spare port with a throwaway state directory.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = 8078; const BASE = `http://localhost:${PORT}/`;
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'catchup-state-'));
let server = null;
function startServer() { server = spawn('python3', [path.join(__dirname, '..', 'tools', 'serve.py'), '--port', String(PORT), '--state-dir', STATE], { stdio: 'ignore' }); }
async function waitServer(up = true) { for (let i = 0; i < 50; i++) { const ok = await fetch(BASE + 'api/ping').then((r) => r.ok, () => false); if (ok === up) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error('server state'); }
const results = []; const errs = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Most tests run with nosync=1 (pure on-device behaviour); the sync tests pass sync=true.
async function newPage(browser, ctx, q = '', sync = false) {
  if (!sync) q = (q ? q + '&' : '') + 'nosync=1';
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
// Sound check, then the case briefing if this is the first visit to the case.
async function soundOk(page) {
  await page.waitForSelector('#sc-yes');
  await page.click('[data-act=sc-play]'); await page.waitForFunction(() => !document.querySelector('#sc-yes').disabled); await page.click('[data-act=sc-yes]');
  await page.waitForSelector('[data-act=brief-go], [data-act=learn-next], .opt, .tile, #app h1');
  if (await page.$('[data-act=brief-go]')) { await page.click('[data-act=brief-go]'); return true; }
  return false;
}
async function startAs(page, id) {
  await page.click(`[data-act=pick][data-id=${id}]`); await page.click('[data-act=start]'); return soundOk(page);
}
// Plays through the session. opts: wrongOnce, quick
async function playAll(page, opts = {}) {
  let wrong = opts.wrongOnce ? 1 : 0; const seen = [];
  for (let guard = 0; guard < 120; guard++) {
    await page.waitForSelector('#app h1, [data-act=learn-next], .opt, .tile', { timeout: 8000 });
    if (await page.$('#app h1')) break;
    if (await page.$('[data-act=learn-next]')) { await page.click('[data-act=learn-next]'); continue; }
    await page.waitForFunction(() => document.querySelector('.opt:not(.locked)') || document.querySelector('.tile:not(.locked)'), null, { timeout: 8000 });
    const info = await page.evaluate(() => { const t = window.__cu.sess.current; return { type: t.q.type, answer: t.q.answer, target: t.q.target, scoring: t.scoring, card: t.q.cardId, retry: t.retry, round: t.round, spot: !!document.querySelector('.opt.spot') }; });
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
  startServer(); await waitServer();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  let page = await newPage(browser, ctx, 'today=2026-11-11&seed=3');

  // 1. import demo packs
  await loadDemo(page);
  let son = await prof(page, 'son'), dau = await prof(page, 'daughter');
  ok('demo pack imported: son 9 cards, daughter 8 cards', Object.keys(son.cards).length === 9 && Object.keys(dau.cards).length === 8);
  ok('sample flag stored', Object.values(son.cards).every((c) => c.sample));

  // 2. session for son with one wrong answer
  const briefed = await startAs(page, 'son');
  ok('first visit to a case opens with the briefing screen', briefed === true);
  const t0 = Date.now(); const seen = await playAll(page, { wrongOnce: true });
  await page.waitForSelector('#app h1');
  ok('sound -> object is answered by tapping an object inside the scene', seen.some((s) => s.type === 'sound-pic' && s.spot));
  ok('report shows case progress: 4 of 9 clues secured after one miss', /수사 중/.test(await page.textContent('#caseline')) && /단서 확보 4\/9/.test(await page.textContent('#caseline')), await page.textContent('#caseline'));
  son = await prof(page, 'son');
  const intro = Object.values(son.cards).filter((c) => c.introduced).length;
  ok('5 new cards introduced (cap)', intro === 5, 'introduced=' + intro);
  ok('retry task appeared after wrong', seen.some((s) => s.retry));
  const wrongCards = Object.values(son.cards).filter((c) => c.lastOutcome === 'wrong');
  ok('wrong first answer -> streak 0, due next day', wrongCards.length === 1 && wrongCards[0].streak === 0 && wrongCards[0].due === '2026-11-12');
  const good = Object.values(son.cards).filter((c) => c.lastOutcome === 'independent');
  ok('independent correct -> due +1 day, streak 1', good.length === 4 && good.every((c) => c.streak === 1 && c.due === '2026-11-12'));
  ok('log marks sound assistance on every question entry (audio, or none for silent cloze)', son.log.filter((e) => e.type !== 'learn').every((e) => e.assist === 'audio' || e.assist === 'none') && son.log.some((e) => e.assist === 'audio'));
  ok('session record saved, with the number of answers for the per-minute check', son.sessions.length === 1 && son.sessions[0].day === '2026-11-11' && son.sessions[0].answered >= 10, 'answered=' + son.sessions[0].answered);
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
  await p2.click('[data-act=start]'); const briefed2 = await soundOk(p2);
  ok('briefing is not repeated once the case is under way', briefed2 === false);
  const order2 = await p2.evaluate(() => window.__cu.sess.tasks.map((t) => (t.kind === 'learn' ? 'L' : t.round === 'review' ? 'R' : 'N')).join(''));
  ok('day 2 order: new words first, reviews between new-word questions', /^L+NNR/.test(order2) && order2.lastIndexOf('N') > order2.indexOf('R'), order2);
  const seen2 = await playAll(p2);
  const son3 = await prof(p2, 'son');
  ok('day 2 review streak 2 for earlier correct cards', Object.values(son3.cards).filter((c) => c.streak === 2).length >= 3 && Object.values(son3.cards).filter((c) => c.streak === 2).every((c) => c.due === '2026-11-15'));
  ok('review depth stepped up (cloze appears)', seen2.some((s) => s.type === 'cloze'));
  await p2.close();

  // 6. audio failure and recovery
  const p3 = await newPage(browser, ctx, 'today=2026-11-11&seed=9');
  await startAs(p3, 'daughter');
  await p3.waitForSelector('#learn-next:not([disabled])');     // card 1 was heard
  await p3.route('**/audio/dev/**', (r) => r.fulfill({ status: 404, body: 'no' }));
  await p3.click('#learn-next');                                // card 2 cannot load its audio
  await p3.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
  ok('failure shows banner with retry', (await p3.textContent('#banner')).includes('다시 듣기'));
  ok('learn view stays on the card and "다음" stays closed until the word is heard', await p3.$eval('#learn-next', (b) => b.disabled));
  // parent override moves on without sound (logged as not heard)
  while (await p3.$('#learn-next')) { await p3.waitForSelector('#banner:not([hidden]) [data-act=skip-audio]'); await p3.click('[data-act=skip-audio]'); await sleep(150); }
  await p3.waitForSelector('.opt', { timeout: 8000 }); await sleep(800);
  const locked = await p3.evaluate(() => [...document.querySelectorAll('.opt')].every((b) => b.classList.contains('locked')));
  ok('sound question options locked while audio is down', locked);
  const before = await p3.evaluate(() => window.__cu.sess.index);
  await p3.click('.opt[data-i="0"]', { force: true }); await sleep(200);
  ok('tap on locked option is ignored (question kept)', await p3.evaluate(() => window.__cu.sess.index) === before && !(await p3.$('#qnext')));
  await p3.unroute('**/audio/dev/**'); await p3.click('[data-act=retry-audio]'); await sleep(600);
  ok('retry restores sound and unlocks', await p3.evaluate(() => [...document.querySelectorAll('.opt')].every((b) => !b.classList.contains('locked'))) && await p3.$eval('#banner', (b) => b.hidden));
  const d3 = await prof(p3, 'daughter'); ok('audio issue logged', d3.audioIssues.length >= 1);
  ok('cards learned without sound are logged as not heard', d3.log.filter((e) => e.type === 'learn').some((e) => e.audioOk === false) && d3.log.filter((e) => e.type === 'learn')[0].audioOk === true);
  await p3.close();

  // 7. 15-minute end (virtual time) : speed 900 => 1 real sec = 15 virtual min
  const p4 = await newPage(browser, ctx, 'today=2026-11-20&seed=4&speed=400');
  await gate(p4); await p4.click('[data-act=demo]'); await p4.waitForSelector('#imp-r .right'); await p4.click('#app [data-act=home]');
  await startAs(p4, 'daughter');
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
  for (let i = 0; i < 5; i++) { await p5.click('#learn-next'); }       // as fast as the button opens
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

  // 10. server copy: progress made on one browser ("Mac") is there on another ("iPad"), and survives a wiped browser
  const mac = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const m1 = await newPage(browser, mac, 'today=2026-12-10&seed=3', true);
  ok('home shows server-backed storage', /Mac 서버/.test(await m1.textContent('#syncline')), await m1.textContent('#syncline'));
  await loadDemo(m1); await startAs(m1, 'son'); await playAll(m1); await m1.waitForSelector('#app h1');
  await m1.waitForFunction(() => window.__cu.syncStatus.available && window.__cu.syncStatus.pending.length === 0, null, { timeout: 8000 });
  const macSon = await prof(m1, 'son');
  ok('state file written on the server side', fs.existsSync(path.join(STATE, 'p.son.json')) && JSON.parse(fs.readFileSync(path.join(STATE, 'p.son.json'), 'utf8')).data.sessions.length === 1);
  const ipad = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const i1 = await newPage(browser, ipad, 'today=2026-12-11&seed=4', true);
  const ipadSon = await prof(i1, 'son');
  ok('second browser starts with the first one\'s progress', JSON.stringify(ipadSon.cards) === JSON.stringify(macSon.cards) && Object.values(ipadSon.cards).filter((c) => c.streak === 1).length === 5);
  await i1.click('[data-act=pick][data-id=son]'); await i1.waitForSelector('[data-act=start]');
  ok('second browser plans reviews from that progress', /복습 5개/.test(await i1.textContent('.card')), (await i1.textContent('.card')).replace(/\s+/g, ' ').slice(0, 30));
  await i1.click('[data-act=start]'); await soundOk(i1);
  await playAll(i1); await i1.waitForFunction(() => window.__cu.syncStatus.pending.length === 0, null, { timeout: 8000 });
  await m1.evaluate(() => localStorage.clear());                   // the browser threw its storage away
  await m1.goto(BASE + '?today=2026-12-12&seed=5'); await m1.waitForSelector('.profiles');
  const restored = await prof(m1, 'son');
  ok('wiped browser gets everything back, including the other device\'s day', restored && Object.values(restored.cards).filter((c) => c.streak === 2).length >= 3 && restored.sessions.length === 2, restored ? 'sessions=' + restored.sessions.length : 'null');
  ok('sibling document untouched by son\'s sessions', (await prof(m1, 'daughter')).log.length === 0);

  ok('a finished session leaves no in-progress marker (time is not counted twice)', !restored.activeSession && !macSon.activeSession);

  // 11. state API unreachable mid-use: the game keeps saving on the device and says so; data uploads when it is back
  const m2 = await newPage(browser, mac, 'today=2026-12-13&seed=6', true);
  await m2.route('**/api/**', (r) => r.abort());
  await startAs(m2, 'daughter'); await playAll(m2); await m2.waitForSelector('#app h1');
  const offline = await prof(m2, 'daughter'); ok('session completes and saves locally while the server copy is unreachable', offline.sessions.length === 1);
  ok('pending upload is tracked', await m2.evaluate(() => window.__cu.sync.pending.includes('p.daughter')));
  ok('nothing reached the server yet', !fs.existsSync(path.join(STATE, 'p.daughter.json')) || JSON.parse(fs.readFileSync(path.join(STATE, 'p.daughter.json'), 'utf8')).data.sessions.length === 0);
  await m2.unroute('**/api/**'); await m2.evaluate(() => window.__cu.sync.flush());
  await m2.waitForFunction(() => window.__cu.sync.pending.length === 0, null, { timeout: 8000 });
  ok('pending session reaches the server once it is reachable', JSON.parse(fs.readFileSync(path.join(STATE, 'p.daughter.json'), 'utf8')).data.sessions.length === 1);
  // 12. static hosting without the state API (e.g. plain file server): device-only, clearly labelled
  const m3 = await ctx.newPage(); await m3.route('**/api/**', (r) => r.fulfill({ status: 404, body: 'nope' }));
  await m3.goto(BASE + '?today=2026-12-14'); await m3.waitForSelector('.profiles');
  ok('without a state API the home screen says device-only', /이 기기만/.test(await m3.textContent('#syncline')), await m3.textContent('#syncline'));
  await m3.close();
  await mac.close(); await ipad.close();

  // 13. the demo case can be played to the end: solved when every clue was recalled, closed when the vault opens
  const ctx7 = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const p7 = await newPage(browser, ctx7, 'today=2026-11-11&seed=11'); await loadDemo(p7);
  let solvedDay = null, closedDay = null, spelled = 0, played = 0;
  for (let d = 0; d < 16 && !closedDay; d++) {
    const day = new Date(Date.UTC(2026, 10, 11 + d)).toISOString().slice(0, 10);
    await p7.goto(BASE + `?today=${day}&seed=${20 + d}&nosync=1`); await p7.waitForSelector('.profiles');
    await p7.click('[data-act=pick][data-id=son]'); await p7.waitForSelector('[data-act=start]');
    if (await p7.$eval('[data-act=start]', (b) => b.disabled)) continue;         // nothing due that day
    await p7.click('[data-act=start]'); await soundOk(p7);
    const seen7 = await playAll(p7); await p7.waitForSelector('#app h1'); played++;
    spelled += seen7.filter((x) => x.type === 'spell').length;
    if (!solvedDay && await p7.$('[data-case=solved]')) solvedDay = day;
    if (await p7.$('[data-case=closed]')) closedDay = day;
  }
  ok('case is solved on the day the last clue is recalled independently (day 2)', solvedDay === '2026-11-12', 'solved=' + solvedDay);
  ok('vault (spelling, depth 4) closes the case', !!closedDay && spelled >= 3, `closed=${closedDay} sessions=${played} spelled=${spelled}`);
  const son7 = await prof(p7, 'son');
  ok('case progress wrote nothing extra into the records', Object.values(son7.cards).every((c) => !('secured' in c) && !('solved' in c)) && !('cases' in son7));
  await p7.click('#app [data-act=home]'); await p7.waitForSelector('#family');
  ok('home shows one combined family total and no per-child case score', /해결한 사건 1건 · 확보한 단서 9개/.test(await p7.textContent('#family')) && !/단서|사건/.test(await p7.textContent('.profiles')), await p7.textContent('#family'));
  await p7.click('[data-act=pick][data-id=son]'); await p7.waitForSelector('[data-act=start]');
  ok('case file shows the closed case', /사건 종결/.test(await p7.textContent('#app')) && /금고 3\/3/.test(await p7.textContent('#app')));
  await p7.close(); await ctx7.close();

  // 14. inside the scene, hint and right/wrong marks follow the option index, not the order objects are drawn in
  const ctx8 = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const p8 = await newPage(browser, ctx8, 'today=2026-11-11&seed=7'); await loadDemo(p8); await startAs(p8, 'son');
  while (await p8.$('#learn-next')) { await p8.waitForSelector('#learn-next:not([disabled])'); await p8.click('#learn-next'); await p8.waitForSelector('#learn-next, .opt'); }
  await p8.waitForSelector('.opt.spot:not(.locked)');
  const ans8 = await p8.evaluate(() => window.__cu.sess.current.q.answer);
  await p8.click('#hintbtn');
  const gone8 = await p8.$$eval('.opt.spot.gone', (els) => els.map((e) => Number(e.dataset.i)));
  ok('hint in the scene removes two wrong objects and keeps the answer', gone8.length === 2 && !gone8.includes(ans8), 'gone=' + gone8 + ' answer=' + ans8);
  const wrong8 = [0, 1, 2, 3].find((i) => i !== ans8 && !gone8.includes(i));
  await p8.click(`.opt.spot[data-i="${wrong8}"]`); await p8.waitForSelector('#qnext');
  const marks8 = await p8.evaluate(() => ({ right: [...document.querySelectorAll('.opt.right')].map((e) => Number(e.dataset.i)), wrong: [...document.querySelectorAll('.opt.wrong')].map((e) => Number(e.dataset.i)) }));
  ok('scene marks the correct object and the tapped one', marks8.right.length === 1 && marks8.right[0] === ans8 && marks8.wrong.length === 1 && marks8.wrong[0] === wrong8, JSON.stringify(marks8));
  await p8.close(); await ctx8.close();

  ok('no uncaught page errors / console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close(); server.kill();
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  require('fs').writeFileSync(__dirname + '/e2e-results.json', JSON.stringify(results, null, 1));
  console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('E2E crashed', e); try { server.kill(); } catch {} process.exit(2); });
