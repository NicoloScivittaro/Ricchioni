import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until,installMock,add,tap,btn,XBOX,DS,GENERIC} from './padmock.mjs';
const out='docs/agent-work/physics-update',browser=await launch(),report={errors:[],items:[],controls:[]};
try {
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<5;i++){const p=await addPhone(browser,code,'Item'+i,i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
 await installMock(page);for(const [i,id] of [XBOX,DS,GENERIC].entries()){await add(page,i,id);await sleep(250);await page.evaluate(pid=>window.__pads.setTarget(pid),ids[i]);await tap(page,i,'A');}
 await page.evaluate(()=>window.__pads.setTarget(null));const G=(fn,arg)=>gameEval(page,'kart3d',fn,arg);
 await startGame(page,'kart3d');await until(()=>G(g=>g.race.phase==='racing'),30000,'kart via');
 await until(()=>G(g=>[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready')),60000,'native');
 const reset=(item,player=0)=>G((g,a)=>{
   g.paused=true;g.ctx.input.reset();g.soloBots.ids.clear();
   for(const trap of g.items.traps)trap.life=0;for(const p of g.items.projectiles)p.life=0;
   const ks=[...g.karts.values()];
   for(const [i,k] of ks.entries())Object.assign(k,{distance:65+i*12,lateral:i===1?0:2.8,speed:32,heading:0,absHeading:g.trackAngleAt(65+i*12),slipVelocity:0,collisionYawVelocity:0,wallContact:false,stunTimer:0,invulnTimer:0,oilTimer:0,boostTimer:0,boostPower:0,disturbTimer:0,jumpHeight:0,jumpVelocity:0,magnetTimer:0,magnetTarget:null,bumperTimer:0,faultyTimer:0,shielded:false,respawnTimer:0,heldItem:null,finished:false});
   ks[a.player].lateral=0;ks[a.player].heldItem=a.item;
   g.items.previous.clear();g.items.update(.001,ks,()=>2,5);
 },{item,player});
 for(const [pad,item] of [[0,'calamita'],[1,'turbo_difettoso'],[2,'paraurti']]){
   await reset(item,pad);await btn(page,pad,'X',true);await sleep(180);await G(g=>g.step(.016));await btn(page,pad,'X',false);
   assert.equal(await G((g,i)=>[...g.karts.values()][i].heldItem,pad),null);report.controls.push({pad,item});
 }
 await phones[3].page.waitForSelector('.ctl-item');await reset('mollone',3);
 await G((g,id)=>g.sendInfoLine(id,g.karts.get(id)),ids[3]);await until(()=>phones[3].page.evaluate(()=>document.body.innerText.includes('MOLLONE')),5000,'descrizione telefono');
 await phones[3].page.screenshot({path:`${out}/item-phone.png`});
 const ph=phones[3].page,cdp=await ph.createCDPSession(),point=await ph.evaluate(()=>{const r=document.querySelector('.ctl-item').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,id:8};});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await sleep(200);await G(g=>g.step(.016));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(await G(g=>[...g.karts.values()][3].jumpHeight>0));
 report.controls.push({phone:true,item:'mollone'});
 const items=process.env.ITEMS?.split(',')??['turbo','super_turbo','sfera','olio','scudo','disturbo','calamita','piccione','turbo_difettoso','buca','raffica','paraurti','mollone'];
 for(const item of items){
   await reset(item);
   await G((g,item)=>{
     const ks=[...g.karts.values()],k=ks[0];
     if(['olio','buca','raffica'].includes(item)){k.distance+=18;k.absHeading=g.trackAngleAt(k.distance);}
     g.items.useItem(k,ks,id=>id===k.playerId?2:1);
     if(['olio','buca','raffica'].includes(item)){k.distance-=18;k.absHeading=g.trackAngleAt(k.distance);}
     if(item==='mollone'){k.jumpHeight=1.25;k.jumpVelocity=.1;}
     g.items.previous.clear();g.items.update(.016,ks,()=>2,5);
     for(let i=0;i<60;i++)for(const s of ks){g.entities.get(s.playerId).updateVisual(s,g.spline);g.cameraManager.update(.05,s.playerId,s,g.spline);}
     for(const s of ks){g.hud.update(s.playerId,s,5,3,[.55,1.2,2.1],.016);g.hud.entries.get(s.playerId).flashText.text='';}
     g.scene.render();
   },item);
   await G(async g=>{await g.scene.whenReadyAsync();g.scene.render();});
   const state=await G(g=>{const k=[...g.karts.values()][0];return {held:k.heldItem,boost:k.boostTimer,grip:k.oilTimer,jump:k.jumpHeight,bumper:k.bumperTimer,fault:k.faultyTimer,magnet:k.magnetTimer,traps:g.items.traps.map(t=>t.kind),projectiles:g.items.projectiles.map(p=>p.kind),meshes:g.scene.meshes.length,mats:g.scene.materials.length};});
   assert.equal(state.held,null);report.items.push({item,...state});
   await page.screenshot({path:`${out}/item-${item}-1280.png`});console.log('visual '+item);
 }
 // Tutti i sette nuovi effetti insieme; cinque kart guidano davvero con boost/drift.
 await reset('olio');report.mixed=await G(g=>{
   const ks=[...g.karts.values()];const use=(k,item)=>{k.heldItem=item;g.items.useItem(k,ks,id=>ks.findIndex(k=>k.playerId===id)+1);};
   use(ks[0],'calamita');use(ks[0],'turbo_difettoso');use(ks[1],'piccione');use(ks[2],'buca');use(ks[3],'raffica');use(ks[4],'paraurti');use(ks[4],'mollone');
   g.soloBots.ids=new Set(ks.map(k=>k.playerId));
   for(let i=0;i<120;i++)g.step(1/60);
   return {finite:ks.every(k=>[k.distance,k.lateral,k.speed,k.slipVelocity,k.jumpHeight].every(Number.isFinite)),moving:ks.map(k=>k.speed),traps:g.items.traps.length,projectiles:g.items.projectiles.length,timed:g.items.timed.size};
 });assert.ok(report.mixed.finite&&report.mixed.moving.every(v=>v>0));
 await G(async g=>{await g.scene.whenReadyAsync();g.scene.render();});await page.screenshot({path:`${out}/items-mixed-five.png`});
 await page.setViewport({width:1920,height:1080});await G(g=>{g.engine.resize();g.scene.render();});await page.screenshot({path:`${out}/items-mixed-1920.png`});
 // Replay di item: i materiali cache hanno un limite e tornano alla stessa soglia.
 report.resources=await G(g=>{
   const ks=[...g.karts.values()],k=ks[0];const trial=()=>{for(const item of ['piccione','olio','buca','raffica']){k.heldItem=item;g.items.useItem(k,ks,()=>2);}for(const t of g.items.traps)t.life=0;for(const p of g.items.projectiles)p.life=0;g.items.update(.016,ks,()=>2,5);};
   trial();const before={meshes:g.scene.meshes.length,mats:g.scene.materials.length};for(let i=0;i<20;i++)trial();return {before,after:{meshes:g.scene.meshes.length,mats:g.scene.materials.length}};
 });assert.deepEqual(report.resources.before,report.resources.after);
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync(`${out}/${process.env.ITEMS?'items-targeted':'items-browser'}.json`,JSON.stringify(report,null,2));console.log(`PASS ${items.length} item screenshot, Xbox/DS/generico/telefono, cinque kart ed effetti misti, risorse limitate, lobby.`);
}finally{writeFileSync(`${out}/items-progress.json`,JSON.stringify(report,null,2));await browser.close();}
