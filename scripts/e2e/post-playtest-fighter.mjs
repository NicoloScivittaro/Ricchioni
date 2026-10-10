import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until,installMock,add,XBOX,DS,GENERIC,btn,tap,stick,watchControls,pressedOf} from './padmock.mjs';
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
 await page.screenshot({path:'docs/agent-work/post-playtest/fighter-controls.png'});
 assert.ok(await page.evaluate(()=>['CALCIO','PRESA','PARATA'].every(s=>window.__cc.text.includes(s))));
 await until(async()=>await G(g=>g.phase==='playing'),30000,'via');
 await until(async()=>await G(g=>[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready')),60000,'Tripo');
 for(let i=0;i<3;i++)for(const [button,control] of [['RT','kick'],['LB','grab'],['LT','parry']]){await btn(page,i,button,true);await sleep(60);assert.ok(await pressedOf(page,ids[i],control));await btn(page,i,button,false);await sleep(180);}
 const card=await phones[0].page.evaluate(()=>document.body.textContent);assert.ok(['CALCIO','PRESA','PARATA'].every(s=>card.includes(s)));
 await phones[4].page.setViewport({width:390,height:844});await sleep(200);
 assert.equal(await phones[4].page.$$('.ctl-kick,.ctl-grab,.ctl-parry').then(a=>a.length),3);await phones[4].page.screenshot({path:'docs/agent-work/post-playtest/fighter-phone.png'});
 await page.keyboard.press('Escape');await phones[4].page.waitForSelector('#pause-overlay');const clock=await G(g=>g.world.time);await phones[4].page.reload({waitUntil:'load'});await phones[4].page.waitForSelector('#pause-overlay');await sleep(350);assert.equal(await G(g=>g.world.time),clock);await page.keyboard.press('Escape');await phones[4].page.waitForFunction(()=>!document.querySelector('#pause-overlay'));
 const reset=async(a=0,b=1,d=3.6)=>G((g,o)=>{g.ctx.input.reset();g.world.fighters.forEach((f,i)=>{f.x=i===o.a?0:i===o.b?o.d:7+i;f.y=0;f.grounded=true;f.support=0;f.vx=f.vy=0;f.facing=i===o.b?-1:1;f.percent=0;f.invuln=f.hitstun=f.landLag=f.intang=f.parryCd=f.grabProtect=0;f.attack=f.dodge=f.grab=f.parry=null;f.grabbedBy=null;f.kickBuf=f.grabBuf=f.parryBuf=f.heavyBuf=f.lightBuf=f.dodgeBuf=0;f.ab.stanceT=f.ab.whiffT=f.ab.freezeT=f.ab.vanishT=f.ab.windowT=0;});}, {a,b,d});
 await reset();await tap(page,0,'RT',90);await until(async()=>await G(g=>g.world.fighters[1].percent>0),3000,'calcio a distanza');report.kick=await G(g=>({damage:g.world.fighters[1].percent,clip:g.entities.get(g.world.fighters[0].id).goblinDebug()?.animator?.name}));
 await reset(0,1,1.4);await btn(page,0,'LB',true);await until(async()=>await G(g=>!!g.world.fighters[0].grab),3000,'presa');await stick(page,0,-1,0);await btn(page,0,'LB',false);await until(async()=>await G(g=>g.world.fighters[1].lastHitVia==='grab'),3000,'proiezione a sinistra');assert.ok(await G(g=>g.world.fighters[1].vx<0));await stick(page,0,0,0);report.grab=true;
 await reset(0,1,1.4);
 // Same real InputManager edges in one browser frame make the timing deterministic.
 const parry=await G(g=>{const [a,b]=g.world.fighters;g.ctx.input.handle(a.id,{kind:'down',controlId:'light'});g.ctx.input.handle(b.id,{kind:'down',controlId:'parry'});for(let i=0;i<6;i++)g.step(.01);return {damage:b.percent,stunned:a.hitstun>0};});assert.equal(parry.damage,0);assert.ok(parry.stunned);report.parry=parry;
 await reset(4,0,3.6);await phones[4].page.evaluate(()=>document.querySelector('.ctl-kick').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7})));await until(async()=>await G(g=>g.world.fighters[0].percent>0),3000,'calcio da telefono');await phones[4].page.evaluate(()=>document.querySelector('.ctl-kick').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7})));
 await G(g=>g.world.fighters.forEach(f=>g.setBot(f.id,true)));await sleep(1500);await page.screenshot({path:'docs/agent-work/post-playtest/fighter-five.png'});
 let info;for(let batch=0;batch<40;batch++){info=await G(g=>{for(let i=0;i<120&&!g.resultsSent;i++)g.step(.05);return {phase:g.world.phase,time:g.world.time,reason:g.world.endReason,finite:g.world.fighters.every(f=>[f.x,f.y,f.percent,f.vx,f.vy].every(Number.isFinite))};});if(info?.phase==='over')break;await sleep(80);}
 assert.equal(info.phase,'over');assert.ok(info.finite);report.round=info;await G(g=>{for(let i=0;i<120&&!g.resultsSent;i++)g.step(.05);});
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati naturali');assert.equal(await hostEval(page,gm=>gm.state.lastResults.results.length),5);
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal((await visualCounters(page)).liveInstances,0);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync('docs/agent-work/post-playtest/fighter-browser.json',JSON.stringify(report,null,2));console.log('PASS: five players, Xbox/DS/generic mapping and phone, all controls/Companion, real kick/throw/parry, pause/reload, natural battle results, Tripo/cleanup, no pageerrors. Time accelerated.');
}finally{await browser.close();}
