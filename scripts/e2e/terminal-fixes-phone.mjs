import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5186/?quality=high';process.env.CTRL_URL='http://localhost:5186/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {sceneEval,until,installMock,add,tap,trig,stick,XBOX,remove}=await import('./padmock.mjs');
const out='docs/agent-work/terminal-fixes',report={},errors=[];const browser=await launch();
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
 await page.evaluate(()=>performance.setResourceTimingBufferSize(10000));
 const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'TERMINAL '+(i+1),i));
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));await installMock(page,5);for(let i=0;i<5;i++)await add(page,i,XBOX);await sleep(400);
 for(let i=0;i<5;i++){await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A',150);}await page.evaluate(()=>window.__pads.setTarget(null));
 await hostEval(page,gm=>{gm.selectMinigame('fps');gm.startGame();});await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,gm=>gm.skip());
 await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),15000,'map ballot');report.maps=await hostEval(page,gm=>gm.state.mapVote.options.map(m=>m.id));assert.deepEqual(report.maps,['cantiere','nuketown','terminal']);
 for(const phone of phones){await phone.page.waitForSelector('[data-map-id="terminal"]');await phone.page.click('[data-map-id="terminal"]');}
 const G=(fn,arg)=>sceneEval(page,'fps',fn,arg);
 await until(()=>G(g=>g.roundReady&&g.controlsDone&&g.worldReady&&g.splitScreen?.cams.length===5),180000,'Terminal ready');


 await G(g=>{g.nuketownBots.ids=new Set();g.ctx.finish=()=>{};g.controlsDone=true;});
 await remove(page,0);const phone=phones[0].page;await phone.setViewport({width:390,height:844});await phone.waitForSelector('#fps-crouch',{timeout:30000});await sleep(1500);
 const pointer=async(id,type)=>phone.evaluate(({id,type})=>document.querySelector(id).dispatchEvent(new PointerEvent(type,{pointerId:42,bubbles:true,cancelable:true})),{id,type});
 await pointer('#fps-crouch','pointerdown');await sleep(250);report.crouch=await G(g=>({active:g.players[0].crouching,eye:g.players[0].eyeHeight}));assert.ok(report.crouch.active&&report.crouch.eye<1);
 await pointer('#fps-crouch','pointercancel');await sleep(250);report.release=await G(g=>!g.players[0].crouching);assert.ok(report.release);
 await pointer('#fps-jump','pointerdown');await sleep(200);report.jump=await G(g=>({airborne:!g.players[0].grounded,height:g.players[0].y-g.players[0].groundY}));assert.ok(report.jump.airborne&&report.jump.height>.3);await sleep(900);report.landed=await G(g=>g.players[0].grounded);assert.ok(report.landed);
 report.layout=await phone.evaluate(()=>{const center={x:innerWidth/2,y:innerHeight/2};return ['#fps-jump','#fps-crouch','#fps-fire','#fps-aim','#fps-dash','#fps-reload'].map(id=>{const b=document.querySelector(id).getBoundingClientRect();return{id,visible:b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,crosshairClear:center.x<b.x||center.x>b.right||center.y<b.y||center.y>b.bottom};});});assert.ok(report.layout.every(b=>b.visible&&b.crosshairClear));report.score=await phone.evaluate(()=>{const score=document.querySelector('.fps-score'),r=score.getBoundingClientRect(),badge=document.querySelector('#pad-fallback-badge').getBoundingClientRect();return{text:score.textContent,clear:r.top>=badge.bottom&&r.right<=innerWidth};});assert.ok(report.score.clear&&report.score.text.includes('/10'));await phone.screenshot({path:out+'/phone-portrait.png'});
 await phone.setViewport({width:844,height:390});await sleep(500);await phone.screenshot({path:out+'/phone-landscape.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/phone-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
