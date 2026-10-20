import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5176/?quality=high';process.env.CTRL_URL='http://localhost:5176/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until,installMock,add,XBOX,tap,stick,btn,watchControls}=await import('./padmock.mjs');
const out='docs/agent-work/volleyball-casacarbo';mkdirSync(out,{recursive:true});
const browser=await launch(),errors=[],checks=[];
const check=(ok,msg)=>{assert.ok(ok,msg);checks.push(msg);console.log('PASS '+msg);};
const pointer=(page,selector,type,id=45)=>page.$eval(selector,(e,a)=>e.dispatchEvent(new PointerEvent(a.type,{bubbles:true,pointerId:a.id,pointerType:'touch',isPrimary:true})),{type,id});
const G=(page,id,fn,arg)=>gameEval(page,id,fn,arg);
const cleanup=async(page,phones)=>{
 await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),20000,'lobby');
 check(await page.evaluate(()=>document.querySelectorAll('canvas').length)===1,'cleanup one canvas');
 await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const p of phones)await p.ctx.close();await page.close();
};
try {
 const {page,code}=await createRoomOnHost(browser);page.on('pageerror',e=>errors.push(e.message));
 const phones=[await addPhone(browser,code,'SOL PAD',0),await addPhone(browser,code,'SOL PHONE',1)];
 for(const p of phones)p.page.on('pageerror',e=>errors.push(e.message));
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
 await installMock(page);await add(page,0,XBOX);await page.evaluate(id=>window.__pads.setTarget(id),ids[0]);
 for(let i=0;i<6 && await page.evaluate(()=>window.__pads.pairedCount())<1;i++){await tap(page,0,'A');await sleep(400);}
 await page.evaluate(()=>window.__pads.setTarget(null));check(await page.evaluate(()=>window.__pads.pairedCount())===1,'mock Xbox paired');
 await watchControls(page);await hostEval(page,gm=>{gm.selectMinigame('volleyball');gm.startGame();});
 await until(()=>G(page,'volleyball',g=>g.phase==='playing'),90000,'volleyball playing');
 check(await page.evaluate(()=>/TUFFO/.test(window.__cc.text)&&/SPRINT/.test(window.__cc.text)),'new pad controls tutorial');
 const pid=ids[1],ph=phones[1].page;
 for(const [width,height] of [[320,740],[390,800],[740,360]]){
  await ph.setViewport({width,height,isMobile:true,hasTouch:true});await sleep(250);
  const bounds=await ph.evaluate(()=>['volley-hit','volley-jump','volley-dive','volley-sprint','volley-ability'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};}));
  check(bounds.every(r=>r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1&&r.h>=44),`phone buttons reachable ${width}x${height}`);
  await ph.screenshot({path:`${out}/volley-phone-${width}.png`});
 }
 await ph.setViewport({width:390,height:800,isMobile:true,hasTouch:true});
 // Live touch dive from outside normal hit radius; default stick aims toward ball.
 await G(page,'volleyball',(g,id)=>{
  const p=g.players.find(p=>p.id===id),side=p.team==='red'?-1:1;p.x=0;p.z=side*4;p.y=0;p.vx=p.vz=p.vy=0;p.diveCooldown=0;p.hitCooldown=0;
  Object.assign(g.ball,{state:'flying',holderId:null,lastTouchId:g.players.find(q=>q.id!==id).id,x:2.9,z:p.z,y:1.5,vx:0,vy:-1,vz:0});
 },pid);
 await pointer(ph,'#volley-dive','pointerdown');
 await until(()=>G(page,'volleyball',(g,id)=>g.players.find(p=>p.id===id).saves===1,pid),5000,'touch dive receive');
 const save=await G(page,'volleyball',(g,id)=>{const p=g.players.find(p=>p.id===id);return{saves:p.saves,receives:p.receives,smashes:p.smashes,last:g.ball.lastTouchId,cd:p.diveCooldown};},pid);
 check(save.last===pid && save.receives>=1&&save.smashes===0&&save.cd>0,'touch dive auto-receives low ball once');
 await pointer(ph,'#volley-dive','pointerdown');await sleep(200);check(await G(page,'volleyball',(g,id)=>g.players.find(p=>p.id===id).saves,pid)===1,'touch dive cooldown');
 // Sprint actual controller mapping and difference in movement speed.
 const pad=ids[0];
 const place=()=>G(page,'volleyball',(g,id)=>{const p=g.players.find(p=>p.id===id);p.x=-8;p.z=p.team==='red'?-5:5;p.y=0;p.vx=p.vz=0;p.sprintEnergy=1;p.diveTime=0;g.ball.state='held';g.ball.holderId=g.players.find(q=>q.id!==id).id;},pad);
 await place();await stick(page,0,1,0);await sleep(700);const normal=await G(page,'volleyball',(g,id)=>g.players.find(p=>p.id===id).x+8,pad);
 await stick(page,0,0,0);await place();await btn(page,0,'LB',true);await stick(page,0,1,0);await sleep(700);
 const sprint=await G(page,'volleyball',(g,id)=>{const p=g.players.find(p=>p.id===id);return{distance:p.x+8,energy:p.sprintEnergy};},pad);
 check(sprint.distance>normal*1.65&&sprint.energy<.9,'LB sprint faster with limited energy');
 await btn(page,0,'LB',false);await stick(page,0,0,0);
 // Actual TOP/Y dive through input manager.
 await G(page,'volleyball',(g,id)=>{const p=g.players.find(p=>p.id===id);p.x=0;p.z=p.team==='red'?-4:4;p.vx=p.vz=0;p.diveCooldown=0;p.hitCooldown=0;Object.assign(g.ball,{state:'flying',holderId:null,lastTouchId:g.players.find(q=>q.id!==id).id,x:2.9,z:p.z,y:1.5,vx:0,vy:-1,vz:0});},pad);
 await tap(page,0,'Y',80);await until(()=>G(page,'volleyball',(g,id)=>g.players.find(p=>p.id===id).saves===1,pad),5000,'pad dive');check(true,'Y dive auto-receives');
 await pointer(ph,'#volley-sprint','pointerdown');await sleep(150);await pointer(ph,'#volley-sprint','pointercancel');await sleep(200);
 check(await hostEval(page,(gm,id)=>!gm.input.get(id).peekPressed('sprint'),pid),'phone sprint cancel releases input');
 await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>gm.state.paused),5000,'pause');
 const frozen=await G(page,'volleyball',g=>g.players.map(p=>[p.x,p.z,p.sprintEnergy,p.diveCooldown]));await sleep(600);
 check(JSON.stringify(frozen)===JSON.stringify(await G(page,'volleyball',g=>g.players.map(p=>[p.x,p.z,p.sprintEnergy,p.diveCooldown]))),'volley pause freezes movement and cooldowns');
 await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>!gm.state.paused),5000,'resume');
 await page.screenshot({path:`${out}/volleyball-tv.png`});await cleanup(page,phones);
 check(errors.length===0,'no page errors');
}finally{writeFileSync(`${out}/browser-checks.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
