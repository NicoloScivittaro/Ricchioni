import assert from 'node:assert/strict';import{writeFileSync}from'node:fs';
process.env.HOST_URL='http://localhost:5186/?quality=high';process.env.CTRL_URL='http://localhost:5186/controller.html';
const{launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');const{sceneEval,until,installMock,add,tap,XBOX,remove}=await import('./padmock.mjs');
const out='docs/agent-work/terminal-2-1',report={},errors=[],browser=await launch();let held;
try{
 const{page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'TERMINAL '+i,i));
 const phone=phones[4].page;phone.on('pageerror',e=>errors.push(e.message));await phone.setRequestInterception(true);phone.on('request',req=>{if(req.url().includes('terminal-play.glb'))held=req;else void req.continue();});
 const ids=await hostEval(page,g=>g.state.players.map(p=>p.id));await installMock(page,4);for(let i=0;i<4;i++)await add(page,i,XBOX);await sleep(300);
 for(let i=0;i<4;i++){await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A',150);}await page.evaluate(()=>window.__pads.setTarget(null));
 await hostEval(page,g=>{g.selectMinigame('fps');g.startGame();});await until(()=>hostEval(page,g=>g.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,g=>g.skip());await until(()=>hostEval(page,g=>g.state.phase==='MINIGAME_MAP_VOTE'),15000,'vote');report.maps=await hostEval(page,g=>g.state.mapVote.options.map(m=>m.id));assert.deepEqual(report.maps,['cantiere','nuketown','terminal']);
 for(const p of phones){await p.page.waitForSelector('[data-map-id="terminal"]');await p.page.click('[data-map-id="terminal"]');}
 const G=(fn,arg)=>sceneEval(page,'fps',fn,arg);await until(()=>G(g=>g.roundReady&&g.worldReady),120000,'host ready');await until(()=>!!held,30000,'phone asset held');await G(g=>{g.controlsDone=true;g.ctx.finish=()=>{};});await sleep(400);
 report.waiting={time:await G(g=>g.matchTime),overlay:await phone.$eval('.fps-world-loading',e=>e.textContent)};assert.equal(report.waiting.time,0);assert.match(report.waiting.overlay,/CARICAMENTO TERMINAL/);
 await held.continue();held=null;await until(()=>G(g=>g.matchTime>.3),60000,'phone readiness ack');await phone.waitForFunction(()=>!document.querySelector('.fps-world-loading'));report.started=true;
 await sleep(1200);await page.screenshot({path:out+'/spawn.png'});
 await G(g=>{g.nuketownBots.ids=new Set(g.players.map(p=>p.id));});await sleep(7000);
 report.shortMatch=await G(g=>({time:g.matchTime,positions:g.players.map(p=>({alive:p.alive,y:p.y,hp:p.hp,kills:p.kills})),views:g.splitScreen.cams.length}));assert.ok(report.shortMatch.time>7);assert.ok(report.shortMatch.positions.every(p=>Number.isFinite(p.y)&&p.y>=-.2));
 await G(g=>{g.controlsDone=false;g.nuketownBots.ids=new Set();for(const p of g.players)g.ctx.input.cancelPlayer(p.id);});
 report.lifecycle=await G(g=>{
  const[a,b]=g.players,r=g.splitScreen,c=r.cams.find(c=>c.playerId===a.id);a.alive=true;a.hp=100;a.guardTime=a.armTime=a.debtTime=a.spawnProtection=0;
  r.update(1/60,g.players.map(p=>g.toRenderSnapshot(p)));const before=c.camera.position.y;g.applyDamage(a,200,b);a.y=-15;r.update(1/60,g.players.map(p=>g.toRenderSnapshot(p)));const dead={height:c.camera.position.y,shade:r.hud.get(a.id).deathShade.alpha};
  g.respawn(a);r.update(1/60,g.players.map(p=>g.toRenderSnapshot(p)));const spawn={height:c.camera.position.y,expected:a.y+a.eyeHeight,grounded:a.grounded};
  const safe={x:a.x,y:a.y,z:a.z};a.lastSafe=safe;a.y=-30;a.grounded=false;g.stepPlayer(a,1/60);const recovered={x:a.x,y:a.y,z:a.z,hp:a.hp};g.broadcastState();return{before,dead,spawn,safe,recovered};
 });assert.equal(report.lifecycle.dead.height,report.lifecycle.before);assert.equal(report.lifecycle.dead.shade,1);assert.equal(report.lifecycle.spawn.height,report.lifecycle.spawn.expected);assert.deepEqual({x:report.lifecycle.recovered.x,y:report.lifecycle.recovered.y,z:report.lifecycle.recovered.z},report.lifecycle.safe);
 report.phoneDeath=await G(g=>{const p=g.players[4];p.alive=false;p.y=-20;g.broadcastState();return true;});await sleep(150);report.phoneDeath=await phone.evaluate(()=>{const el=[...document.querySelectorAll('div')].find(e=>e.textContent==='ELIMINATO · RIENTRO TRA POCO');return !!el&&getComputedStyle(el).backgroundColor==='rgb(11, 18, 26)';});assert.ok(report.phoneDeath);
 await G(g=>{g.respawn(g.players[4]);g.broadcastState();});
 report.routes=await G(g=>{
  const arena=g.nuketown,nav=arena.nav,start=arena.closest({x:4.6,y:1.22,z:-35.2}),goal=arena.closest({x:-39.3,y:5.14,z:-54.9});
  const parent=new Int32Array(nav.length).fill(-1),queue=[start];parent[start]=start;for(let j=0;j<queue.length&&parent[goal]<0;j++)for(const v of arena.data.edges[queue[j]])if(parent[v]<0){parent[v]=queue[j];queue.push(v);}
  const path=[];for(let v=goal;v!==start;v=parent[v]){if(v<0)throw Error('No cabin route');path.push(v);}path.push(start);path.reverse();let p=nav[start],failures=0;
  for(const i of path.slice(1)){const q=nav[i],m=arena.move(p,q,1.05);if(Math.hypot(m.x-q.x,m.z-q.z)>.06||Math.abs(m.y-q.y)>.05)failures++;p=m;}
  const pair=[{x:-20.6,y:4.88,z:-1.6},{x:-21,y:4.88,z:-6.8}],blocked=!arena.visible(...pair);return{nodes:path.length,failures,wallBlocksShots:blocked,spawns:arena.spawns.length};
 });assert.equal(report.routes.failures,0);assert.equal(report.routes.spawns,19);assert.ok(report.routes.wallBlocksShots);
 await remove(page,0);await sleep(180);await add(page,0,XBOX);await tap(page,0,'A',150);await sleep(180);report.toasts=await page.evaluate(()=>({count:document.querySelectorAll('#pad-toasts>*').length,stale:[...document.querySelectorAll('#pad-toasts>*')].some(e=>/DISCONNESSO/.test(e.textContent))}));assert.ok(report.toasts.count<=1&&!report.toasts.stale);
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{if(held)await held.continue().catch(()=>{});writeFileSync(out+'/gameplay-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
