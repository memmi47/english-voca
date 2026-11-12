// Run after preview_world_maps.py: node tools/check_world_map_preview.cjs /absolute/output
// Uses installed Playwright and /usr/bin/chromium for this managed environment.
const {chromium}=require('playwright');
const fs=require('fs');const nodePath=require('path');
if(!process.argv[2])throw Error('Usage: node tools/check_world_map_preview.cjs /absolute/output');
const path=nodePath.resolve(process.argv[2])+'/';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent(fs.readFileSync(path+'index.html','utf8'));await page.evaluate(()=>document.fonts.ready);
 if(await page.locator('main .world').count()!==30)throw Error('map count');
 await page.locator('[data-band=p2]').click();if(await page.locator('main .world:visible').count()!==15)throw Error('filter');
 await page.locator('[data-band=all]').click();await page.locator('#p1-01').click();if(!(await page.locator('dialog').isVisible()))throw Error('dialog');
 const trial=page.locator('.dialogbody');
 await trial.locator('[data-tile=p1-01-s3-1]').click({force:true});
 if(!(await page.locator('#routeStatus').textContent()).includes('0 / 5'))throw Error('locked stage skipped');
 for(const [stage,lane] of [[1,1],[2,3],[3,2],[4,1],[5,3]])await trial.locator(`[data-tile=p1-01-s${stage}-${lane}]`).click();
 if(!(await page.locator('#routeStatus').textContent()).includes('성 도착'))throw Error('woven route failed');
 const before=await page.locator('#routeStatus').textContent();
 await trial.locator('[data-tile=p1-01-s1-1]').click();if(await page.locator('#routeStatus').textContent()!==before)throw Error('cleared revisit charged');
 await trial.locator('[data-tile=p1-01-s1-2]').click();if(!(await trial.locator('[data-tile=p1-01-s1-2]').getAttribute('class')).includes('done'))throw Error('leftover revisit');
 await page.locator('#resetRoute').click();if(!(await page.locator('#routeStatus').textContent()).includes('0 / 5'))throw Error('reset');
 await page.locator('#next').click();if(!(await page.locator('.dialogbody h3').textContent()).includes('동글'))throw Error('next');await page.locator('#prev').click();await page.locator('#close').click();
 await page.locator('#view').click();if(!(await page.locator('body').getAttribute('class')).includes('detail'))throw Error('detail');await page.locator('#view').click();
 await page.pdf({path:path+'world-atlas.pdf',printBackground:true,preferCSSPageSize:true});
 await page.setViewportSize({width:390,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile overflow');
 for(const band of ['p1','p2','p3']){await page.setViewportSize({width:1500,height:1000});await page.setContent(fs.readFileSync(path+band+'.html','utf8'));await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path+band+'-maps.png',fullPage:true});}
 await page.goto('about:blank');await page.setContent(fs.readFileSync(path+'index.html','utf8'));await page.evaluate(()=>document.fonts.ready);await page.locator('#p1-01').click();for(const [stage,lane] of [[1,1],[2,3],[3,2]])await page.locator(`.dialogbody [data-tile=p1-01-s${stage}-${lane}]`).click();await page.locator('dialog').screenshot({path:path+'detail.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS weave switching, no stage skip, cleared free revisit, leftover visit, reset; 30 maps, continent filter, modal next/previous, detail layout, 390px no overflow, PDF and 3 overview images');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
