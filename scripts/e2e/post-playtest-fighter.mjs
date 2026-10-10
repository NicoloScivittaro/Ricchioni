import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until,installMock,add,XBOX,DS,GENERIC,remove,btn,tap,stick,watchControls,pressedOf} from './padmock.mjs';
import {visualCounters} from './tripo-counters.mjs';
const browser=await launch(),report={errors:[],accelerated:true};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<5;i++){const p=await addPhone(browser,code,`P${i}`,i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));await installMock(page);
 for(let i=0;i<3;i++){await add(page,i,[XBOX,DS,GENERIC][i]);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);for(let n=0;n<6&&(await page.evaluate(()=>window.__pads.pairedCount()))<i+1;n++){await tap(page,i,'A');await sleep(350);}}
 await page.evaluate(()=>window.__pads.setTarget(null));assert.equal(await page.evaluate(()=>window.__pads.pairedCount()),3);
 const G=(fn,arg)=>gameEval(page,'cornicione',fn,arg);await watchControls(page);await startGame(page,'cornicione');
 await until(async()=>await page.evaluate(()=>window.__cc?.shownAt!==null),30000,'CONTROLLI');
 await page.screenshot({path:'docs/agent-work/cornicione-throws/fighter-controls.png'});
 assert.ok(await page.evaluate(()=>['CALCIO','LANCIO','PARATA'].every(s=>window.__cc.text.includes(s))));
 await until(async()=>await G(g=>g.phase==='playing'),30000,'via');
 await until(async()=>await G(g=>[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready')),60000,'Tripo');
 for(let i=0;i<3;i++)for(const [button,control] of [['RT','kick'],['LB','throw'],['LT','parry']]){await btn(page,i,button,true);await sleep(60);assert.ok(await pressedOf(page,ids[i],control));await btn(page,i,button,false);await sleep(180);}
 const card=await phones[0].page.evaluate(()=>document.body.textContent);assert.ok(['CALCIO','LANCIO','PARATA'].every(s=>card.includes(s)));
 await phones[4].page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await sleep(200);
 assert.equal(await phones[4].page.$$('.ctl-kick,.ctl-throw,.ctl-parry').then(a=>a.length),3);await phones[4].page.screenshot({path:'docs/agent-work/cornicione-throws/fighter-phone.png'});
 await page.keyboard.press('Escape');await phones[4].page.waitForSelector('#pause-overlay');const clock=await G(g=>g.world.time);await phones[4].page.reload({waitUntil:'load'});await phones[4].page.waitForSelector('#pause-overlay');await sleep(350);assert.equal(await G(g=>g.world.time),clock);await page.keyboard.press('Escape');await phones[4].page.waitForFunction(()=>!document.querySelector('#pause-overlay'));
 const reset=async(a=0,b=1,d=3.6)=>G((g,o)=>{g.ctx.input.reset();g.world.projectiles=[];g.throwPoses.clear();g.world.fighters.forEach((f,i)=>{f.x=i===o.a?0:i===o.b?o.d:7+i;f.y=0;f.grounded=true;f.support=0;f.vx=f.vy=0;f.facing=i===o.b?-1:1;f.percent=0;f.invuln=f.hitstun=f.landLag=f.intang=f.parryCd=f.throwCd=0;f.attack=f.dodge=f.objectThrow=f.parry=null;f.kickBuf=f.parryBuf=f.heavyBuf=f.lightBuf=f.dodgeBuf=0;f.ab.stanceT=f.ab.whiffT=f.ab.freezeT=f.ab.vanishT=f.ab.windowT=0;});}, {a,b,d});
 await reset();await tap(page,0,'RT',90);await until(async()=>await G(g=>g.world.fighters[1].percent>0),3000,'calcio a distanza');report.kick=await G(g=>({damage:g.world.fighters[1].percent,clip:g.entities.get(g.world.fighters[0].id).goblinDebug()?.animator?.name}));
 await G(g=>{g.throwTrace=[];const emit=g.world.emit.bind(g.world);g.world.emit=e=>{if(e.t==='objectThrow'||e.t==='objectImpact')g.throwTrace.push(JSON.parse(JSON.stringify(e)));emit(e);};});
 await reset(0,1,10);await btn(page,0,'LB',true);await until(async()=>await G(g=>g.world.fighters[0].objectThrow?.charge>.65),3000,'carica LB');
 const clip=await G(g=>g.entities.get(g.world.fighters[0].id).goblinDebug()?.animator?.name);assert.ok(clip?.endsWith('.ballThrow'));report.chargeClip=clip;
 await btn(page,0,'LB',false);await until(async()=>await G(g=>g.throwTrace.some(e=>e.t==='objectThrow')),3000,'lancio caricato');
 report.charged=await G(g=>g.throwTrace.find(e=>e.t==='objectThrow').projectile);assert.ok(report.charged.speed>25);assert.ok(await G(g=>g.world.fighters[0].throwCd>5));
 await reset(0,1,-6);await stick(page,0,-1,0);const traceStart=await G(g=>g.throwTrace.length);await tap(page,0,'LB',70);
 await until(async()=>await G((g,n)=>g.throwTrace.slice(n).some(e=>e.t==='objectThrow'),traceStart),3000,'tiro veloce sinistro');assert.ok(await G((g,n)=>g.throwTrace.slice(n).find(e=>e.t==='objectThrow').projectile.dx<0,traceStart));await stick(page,0,0,0);report.quickAim=true;
 await reset();await btn(page,0,'LB',true);await until(async()=>await G(g=>!!g.world.fighters[0].objectThrow),3000,'carica da annullare');await page.keyboard.press('Escape');
 const pausedCount=await G(g=>g.throwTrace.filter(e=>e.t==='objectThrow').length);await btn(page,0,'LB',false);await page.keyboard.press('Escape');await sleep(300);assert.equal(await G(g=>g.throwTrace.filter(e=>e.t==='objectThrow').length),pausedCount);report.pauseCancelsCharge=true;
 // Five cosmetic props/skins simultaneously, through the same InputManager and simulation.
 await reset();await G(g=>{g.world.fighters.forEach((f,i)=>{f.x=-8+i*4;g.ctx.input.handle(f.id,{kind:'down',controlId:'throw'});});for(let i=0;i<45;i++)g.step(.016);});
 await page.screenshot({path:'docs/agent-work/cornicione-throws/objects-five.png'});
 report.cosmetics=await G(g=>[...g.objects.props.values()].map(p=>({character:p.characterId,on:p.root.isEnabled(),pieces:p.pieces.length})));
 assert.equal(report.cosmetics.filter(p=>p.on).length,5);assert.equal(new Set(report.cosmetics.map(p=>p.character)).size,5);await G(g=>{g.world.cancelObjectThrows();g.ctx.input.reset();});
 await reset(0,1,1.4);
 // Same real InputManager edges in one browser frame make the timing deterministic.
 const parry=await G(g=>{const [a,b]=g.world.fighters;g.ctx.input.handle(a.id,{kind:'down',controlId:'light'});g.ctx.input.handle(b.id,{kind:'down',controlId:'parry'});for(let i=0;i<6;i++)g.step(.01);return {damage:b.percent,stunned:a.hitstun>0};});assert.equal(parry.damage,0);assert.ok(parry.stunned);report.parry=parry;
 await reset(4,0,3.6);await phones[4].page.evaluate(()=>document.querySelector('.ctl-kick').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7})));await until(async()=>await G(g=>g.world.fighters[0].percent>0),3000,'calcio da telefono');await phones[4].page.evaluate(()=>document.querySelector('.ctl-kick').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7})));
 await reset(4,0,9);await phones[4].page.evaluate(()=>document.querySelector('.ctl-throw').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:8})));
 await until(async()=>await G(g=>g.world.fighters[4].objectThrow?.charge>.5),3000,'carica telefono');assert.ok((await phones[4].page.evaluate(()=>document.querySelector('#corn-throw-status')?.textContent)).includes('CARICA'));
 const phoneStart=await G(g=>g.throwTrace.length);await phones[4].page.evaluate(()=>document.querySelector('.ctl-throw').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:8})));
 await until(async()=>await G((g,n)=>g.throwTrace.slice(n).some(e=>e.t==='objectThrow'),phoneStart),3000,'lancio telefono');await until(async()=>(await phones[4].page.evaluate(()=>document.querySelector('#corn-throw-status')?.textContent)).includes('RICARICA'),3000,'ricarica telefono');report.phoneCharge=true;
 await reset(4,0,9);await phones[4].page.evaluate(()=>document.querySelector('.ctl-throw').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:9})));
 await until(async()=>await G(g=>!!g.world.fighters[4].objectThrow),3000,'touch cancellabile');const cancelStart=await G(g=>g.throwTrace.length);
 await phones[4].page.evaluate(()=>document.querySelector('.ctl-throw').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:9})));await sleep(350);
 assert.equal(await G((g,n)=>g.throwTrace.slice(n).filter(e=>e.t==='objectThrow').length,cancelStart),0);report.phoneCancel=true;
 await reset(4,0,9);await phones[4].page.evaluate(()=>document.querySelector('.ctl-throw').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:10})));
 await until(async()=>await G(g=>!!g.world.fighters[4].objectThrow),3000,'carica prima del blur');const blurStart=await G(g=>g.throwTrace.length);
 await phones[4].page.evaluate(()=>window.dispatchEvent(new Event('blur')));await sleep(300);assert.equal(await G((g,n)=>g.throwTrace.slice(n).filter(e=>e.t==='objectThrow').length,blurStart),0);
 await phones[4].page.evaluate(()=>document.querySelector('.ctl-throw').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:11})));
 await until(async()=>await G(g=>!!g.world.fighters[4].objectThrow),3000,'pointer riutilizzabile dopo blur');const reconnectStart=await G(g=>g.throwTrace.length);await phones[4].page.reload({waitUntil:'load'});await phones[4].page.waitForSelector('.ctl-throw');await sleep(350);
 assert.equal(await G((g,n)=>g.throwTrace.slice(n).filter(e=>e.t==='objectThrow').length,reconnectStart),0);report.phoneBlurRejoin=true;
 await reset(4,0,-7);
 const touch=await phones[4].page.createCDPSession();await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 const centers=await phones[4].page.evaluate(()=>Object.fromEntries(['throw','left'].map(key=>{const r=document.querySelector(`.ctl-${key}`).getBoundingClientRect();return [key,{x:r.left+r.width/2,y:r.top+r.height/2}];})));
 const first={...centers.throw,id:1},second={...centers.left,id:2};const multiStart=await G(g=>g.throwTrace.length);
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
 await until(async()=>await G(g=>g.world.fighters[4].objectThrow?.charge>.15),3000,'dito reale sulla carica');
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,second]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:370,y:140,id:1},second]});
 await until(async()=>await G(g=>g.world.fighters[4].objectThrow?.charge>.5&&g.world.fighters[4].objectThrow.dx<0),3000,'cattura dito fuori pulsante + secondo dito mira');
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[second]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await until(async()=>await G((g,n)=>g.throwTrace.slice(n).some(e=>e.t==='objectThrow'&&e.projectile.dx<0&&e.projectile.charge>.4),multiStart),3000,'rilascio reale con due dita');report.multiTouchCapturedAim=true;
 await reset();await btn(page,0,'LB',true);await until(async()=>await G(g=>!!g.world.fighters[0].objectThrow),3000,'carica pad prima del distacco');const lostStart=await G(g=>g.throwTrace.length);await remove(page,0);await sleep(400);
 assert.equal(await G(g=>g.world.fighters[0].objectThrow),null);assert.equal(await G((g,n)=>g.throwTrace.slice(n).filter(e=>e.t==='objectThrow').length,lostStart),0);await phones[0].page.waitForSelector('.ctl-throw');report.padLossCancels=true;
 await G(g=>g.world.fighters.forEach(f=>g.setBot(f.id,true)));await sleep(1500);await page.screenshot({path:'docs/agent-work/cornicione-throws/fighter-five.png'});
 let info;for(let batch=0;batch<40;batch++){info=await G(g=>{for(let i=0;i<120&&!g.resultsSent;i++)g.step(.05);return {phase:g.world.phase,time:g.world.time,reason:g.world.endReason,finite:g.world.fighters.every(f=>[f.x,f.y,f.percent,f.vx,f.vy].every(Number.isFinite))};});if(info?.phase==='over')break;await sleep(80);}
 assert.equal(info.phase,'over');assert.ok(info.finite);report.round=info;await G(g=>{for(let i=0;i<120&&!g.resultsSent;i++)g.step(.05);});
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati naturali');assert.equal(await hostEval(page,gm=>gm.state.lastResults.results.length),5);
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal((await visualCounters(page)).liveInstances,0);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync('docs/agent-work/cornicione-throws/fighter-browser.json',JSON.stringify(report,null,2));console.log('PASS: five players, Xbox/DS/generic mapping and phone, all controls/Companion, real kick/charged throw/parry, pause/reload, natural battle results, Tripo/cleanup, no pageerrors. Time accelerated.');
}finally{await browser.close();}
