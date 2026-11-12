// Build with preview_world_maps.py, then run: node tools/check_world_map_preview.cjs /absolute/output
const {chromium}=require('playwright');
const fs=require('fs'),nodePath=require('path');
if(!process.argv[2])throw Error('Usage: node tools/check_world_map_preview.cjs /absolute/output');
const path=nodePath.resolve(process.argv[2])+'/';
const data=JSON.parse(fs.readFileSync(path+'atlas-data.json','utf8'));
function tilePath(g,target){const by=Object.fromEntries(g.nodes.map(n=>[n.id,n])),adj=Object.fromEntries(g.nodes.map(n=>[n.id,[]]));g.edges.forEach(([a,b])=>{adj[a].push(b);adj[b].push(a)});const prev=new Map([[g.startNodeId,null]]),todo=[g.startNodeId];while(todo.length){const id=todo.shift();for(const dst of adj[id])if(!prev.has(dst)){prev.set(dst,id);todo.push(dst)}}const route=[];for(let id=target;id;id=prev.get(id))if(by[id].kind==='tile')route.unshift(id);return route;}
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent(fs.readFileSync(path+'index.html','utf8'));await page.evaluate(()=>document.fonts.ready);
 if(await page.locator('main .world').count()!==30)throw Error('map count');
 await page.locator('[data-band=p2]').click();if(await page.locator('main .world:visible').count()!==15)throw Error('filter');
 await page.locator('[data-band=all]').click();await page.locator('#p1-01').click();
 const trial=page.locator('.dialogbody'),world=data[0],game=world.graph.nodes.find(n=>n.kind==='minigame');
 await trial.locator('[data-tile=p1-01-main-5]').click({force:true});if(await page.evaluate(()=>cleared.size)!==0)throw Error('locked tile bypass');
 await trial.locator(`[data-game=${game.id}]`).click({force:true});if(await page.locator('#gamePanel').isVisible())throw Error('locked playhouse');
 for(const id of tilePath(world.graph,game.id))await trial.locator(`[data-tile=${id}]`).click();
 await trial.locator(`[data-game=${game.id}]`).click();
 if(!(await page.locator('#gamePanel h3').textContent()).includes('짝'))throw Error('memory not opened');
 const countBefore=await page.evaluate(()=>cleared.size);
 await page.locator('#miniGrid button').first().click();await page.locator('#gameClose').click();if(await page.evaluate(()=>stamps.size)!==0||await page.evaluate(()=>cleared.size)!==countBefore)throw Error('cancel affected route or reward');
 await trial.locator(`[data-game=${game.id}]`).click();
 async function solveMemory(){const deck=await page.evaluate(()=>gameState.deck);for(const value of [...new Set(deck)])for(const index of deck.map((v,i)=>v===value?i:-1).filter(i=>i>=0))await page.locator('#miniGrid button').nth(index).click();}
 await solveMemory();if(await page.evaluate(()=>stamps.size)!==1)throw Error('stamp missing');
 await page.locator('#gameAgain').click();await solveMemory();if(await page.evaluate(()=>stamps.size)!==1)throw Error('duplicate stamp');
 if(await page.evaluate(()=>cleared.size)!==countBefore)throw Error('minigame changed learning route');
 await page.locator('#gameBack').click();
 const game2=world.graph.nodes.filter(n=>n.kind==='minigame')[1];for(const id of tilePath(world.graph,game2.id))await trial.locator(`[data-tile=${id}]`).click();
 await trial.locator(`[data-game=${game2.id}]`).click();
 const findBefore=await page.evaluate(()=>cleared.size);const wrong=await page.evaluate(()=>(gameState.targetIndex+1)%9);await page.locator('#miniGrid button').nth(wrong).click();if(await page.evaluate(()=>gameState.round)!==0)throw Error('wrong find advanced');for(let i=0;i<5;i++){const target=await page.evaluate(()=>gameState.targetIndex);await page.locator('#miniGrid button').nth(target).click();}
 if(await page.evaluate(()=>stamps.size)!==2)throw Error('find completion');if(await page.evaluate(()=>cleared.size)!==findBefore)throw Error('find changed learning route');
 await page.locator('#gameBack').click();
 for(const id of world.audit.shortestTiles)await trial.locator(`[data-tile=${id}]`).click();if(!(await page.locator('#routeStatus').textContent()).includes('성에 도착'))throw Error('castle reach');
 const before=await page.locator('#routeStatus').textContent();await trial.locator(`[data-tile=${world.audit.shortestTiles[0]}]`).click();if(await page.locator('#routeStatus').textContent()!==before)throw Error('cleared revisit charged');
 await page.locator('#resetRoute').click();if(await page.evaluate(()=>cleared.size)!==0)throw Error('reset');
 await page.locator('#next').click();for(const id of data[1].audit.shortestTiles)await trial.locator(`[data-tile=${id}]`).click();if(!(await page.locator('#routeStatus').textContent()).includes('성에 도착'))throw Error('castle required minigame');await page.locator('#prev').click();await page.locator('#close').click();
 await page.locator('#view').click();await page.locator('#view').click();
 await page.pdf({path:path+'world-atlas.pdf',printBackground:true,preferCSSPageSize:true});
 await page.setViewportSize({width:390,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile overflow');
 for(const band of ['p1','p2','p3']){await page.setViewportSize({width:1500,height:1000});await page.setContent(fs.readFileSync(path+band+'.html','utf8'));await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path+band+'-maps.png',fullPage:true});}
 await page.goto('about:blank');await page.setContent(fs.readFileSync(path+'index.html','utf8'));await page.evaluate(()=>document.fonts.ready);await page.locator('#p1-01').click();await page.locator('dialog').screenshot({path:path+'detail.png'});await page.locator('#previewGame').click();await page.locator('#gamePanel').screenshot({path:path+'minigame.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS 30 maps; filter/modal; locked paths and playhouses; optional memory/find; single cosmetic stamp; no learning change; castle and free revisit; reset; 390px; PDF/PNGs');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
