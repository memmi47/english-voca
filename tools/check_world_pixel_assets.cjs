/* Review board verification. Uses a read-only server and a fresh browser profile. */
const { chromium }=require('playwright');
const { spawn }=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||'/tmp/world-pixels');fs.mkdirSync(OUT,{recursive:true});
const port=8098,base=`http://127.0.0.1:${port}`,checks=[],errors=[],writes=[];
const server=spawn('python3',[path.join(ROOT,'tools/serve_art_lab.py'),'--port',String(port)],{cwd:ROOT,stdio:'ignore'});
function ok(name,value){assert.ok(value,name);checks.push(name);console.log('PASS',name);}
(async()=>{
 let browser;
 try{
  for(let i=0;i<60;i++){if(await fetch(base).then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
  await page.goto(base+'/cards/art-review/');await page.waitForSelector('body[data-ready=true]');
  ok('30 worlds, 180 bosses, 6 scenery symbols visible',await page.locator('.world').count()===30&&await page.locator('.boss').count()===180&&await page.locator('.decor-grid figure').count()===6);
  ok('all 360 manual review fields start unreviewed',await page.locator('select').evaluateAll(els=>els.length===360&&els.every(e=>e.value==='unreviewed')));
  ok('all SVG use references resolve',await page.locator('use').evaluateAll(els=>els.every(e=>document.getElementById(e.getAttribute('href').slice(1)))));
  const painted=await page.evaluate(async()=>{
    const seen=new Set();let count=0;
    for(const symbol of document.querySelectorAll('symbol[id^="wb-"]')){
      const src=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${symbol.innerHTML}</svg>`;
      const im=new Image();im.src='data:image/svg+xml;base64,'+btoa(src);await im.decode();
      const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(im,0,0);
      const data=x.getImageData(0,0,16,16).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i])opaque++;
      if(opaque<20)throw new Error(symbol.id+' is empty');seen.add(c.toDataURL());count++;
    }
    return {count,distinct:seen.size};
  });
  ok('180 SVG drawings rasterize and remain distinct',painted.count===180&&painted.distinct===180);
  ok('world palette variables inherited by scenery',await page.locator('.world .scene').evaluateAll(els=>els.every(el=>['--w-ground','--w-ground-d','--w-ground-l','--w-path','--w-path-d','--w-path-l','--w-sky','--w-sky-l'].every(k=>/^#[0-9A-F]{6}$/i.test(getComputedStyle(el).getPropertyValue(k).trim())))));
  await page.locator('button[data-band=P2]').click();ok('continent filter displays 15 sea worlds',await page.locator('.world:visible').count()===15);
  await page.locator('button[data-band=all]').click();
  const first=page.locator('.boss').first();await first.locator('[data-kind=native]').selectOption('missing');await first.locator('[data-kind=pixel]').selectOption('pass');
  await page.locator('#issues').check();ok('problem filter isolates one marked drawing',await page.locator('.boss:visible').count()===1&&await page.locator('.world:visible').count()===1);
  await page.locator('#export').click();ok('export requests device description without certifying iPad',await page.locator('#status').textContent().then(s=>s.includes('기기와 OS')));
  await page.locator('#device').fill('Automated Chromium review fixture — not an iPad');
  const download=page.waitForEvent('download');await page.locator('#export').click();const dl=await download;
  const report=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  ok('manual export keeps unreviewed items and records honest device context',report.results.length===180&&report.results[0].native==='missing'&&report.results[0].pixel==='pass'&&report.results.slice(1).every(v=>v.native==='unreviewed'&&v.pixel==='unreviewed')&&report.automaticDeviceCertification===false);
  await page.locator('#issues').uncheck();await first.locator('[data-kind=native]').selectOption('unreviewed');await first.locator('[data-kind=pixel]').selectOption('unreviewed');
  await page.locator('button[data-band=P1]').click();
  await page.locator('#device').fill('');
  await page.screenshot({path:path.join(OUT,'review-page.png')});
  for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(viewport);ok(`${viewport.width}px viewport has no page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.addStyleTag({content:`main{max-width:none;padding:20px}header,.instructions,.controls,.palettes,.scene,#decor,footer,.compare figure:not(:last-child),.boss label,.code,.world-head p{display:none!important}#worlds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.world{margin:0}.world-head{padding:10px 16px}.world-head h2{font-size:20px}.boss-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.boss{padding:10px 4px}.boss h4{font-size:12px;text-align:center}.compare figcaption{display:none}.pixel{width:64px;height:64px}`});
  for(const b of ['P1','P2','P3']){
    await page.evaluate(b=>document.querySelector(`button[data-band=${b}]`).click(),b);
    await page.screenshot({path:path.join(OUT,`${b.toLowerCase()}-sprites.png`),fullPage:true});
  }
  ok('review does not write game state or storage',writes.length===0&&await page.evaluate(()=>localStorage.length===0));
  const offline=await context.newPage();let http=0;offline.on('request',r=>{if(/^https?:/.test(r.url()))http++;});offline.on('pageerror',e=>errors.push(String(e)));
  await offline.setContent(fs.readFileSync(path.join(OUT,'world-pixel-review.html'),'utf8'));await offline.waitForSelector('body[data-ready=true]');
  ok('standalone HTML renders with no HTTP requests (setContent)',http===0&&await offline.locator('.boss').count()===180);
  ok('no browser page errors',errors.length===0);
  fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify({checks,renderer:'Linux Chromium; no actual iPad verification',errors},null,2));
  console.log(`${checks.length}/${checks.length} passed`);
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
