import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until,installMock,add,tap,btn,stick,XBOX,DS,GENERIC,watchControls} from './padmock.mjs';
const out='docs/agent-work/physics-update',browser=await launch(),report={errors:[],shots:[]};
try {
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<5;i++){const p=await addPhone(browser,code,'Volley'+i,i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));await installMock(page);
 for(const [i,id] of [XBOX,DS,GENERIC].entries()){await add(page,i,id);await sleep(200);await page.evaluate(pid=>window.__pads.setTarget(pid),ids[i]);await tap(page,i,'A');}
 await page.evaluate(()=>window.__pads.setTarget(null));await watchControls(page);
 const G=(fn,arg)=>gameEval(page,'volleyball',fn,arg);await startGame(page,'volleyball');await until(()=>G(g=>g.phase==='playing'),45000,'volley via');
 assert.ok(await page.evaluate(()=>window.__cc.text.includes('PALLONETTO')));await phones[3].page.waitForSelector('#volley-hit');assert.ok(await phones[3].page.evaluate(()=>document.body.innerText.includes('pallonetto')));
 await until(()=>G(g=>[...g.entities.values()].filter(e=>e.goblinDebug()).every(e=>e.goblinDebug().state==='ready')),60000,'native');
 await G(g=>{g.paused=true;g.soloBots.ids.clear();g.engine.runRenderLoop(()=>{if(!g.scene.isDisposed)g.scene.render();});});
 const roster=await G(g=>g.players.map(p=>({id:p.id,team:p.team}))),cdps=await Promise.all(phones.map(p=>p.page.createCDPSession()));
 const prepare=async(id,smash)=>G((g,a)=>{
   g.ctx.input.reset();g.phase='playing';g.redScore=0;g.blueScore=0;g.freeze=null;g.shotCues.clear();const p=g.players.find(p=>p.id===a.id),dir=p.team==='red'?1:-1;
   g.players.forEach((q,i)=>Object.assign(q,{x:i*4-8,z:q.team==='red'?-6:6,y:0,vx:0,vy:0,vz:0,hitCooldown:0,muroTime:0,jagerTime:0,lucidTime:0,dizzyTime:0,armTime:0}));
   Object.assign(p,{x:0,z:-dir*(a.smash?1.3:5.5),y:a.smash?1.2:0,vy:0,facing:dir>0?0:Math.PI});
   Object.assign(g.ball,{state:'flying',holderId:null,x:0,y:a.smash?3.2:1.7,z:p.z+dir*.3,vx:0,vy:0,vz:0,lastTouchId:null,teamTouches:0,crossedNet:false});
 },{id,smash});
 for(const team of ['red','blue']){
  const candidate=roster.filter(p=>p.team===team).sort((a,b)=>(ids.indexOf(a.id)<3?0:1)-(ids.indexOf(b.id)<3?0:1))[0],index=ids.indexOf(candidate.id);
  for(const [name,x,y,smash] of [['left',-1,0,false],['right',1,0,false],['neutral',0,0,false],['flat',0,-1,false],['lob',0,1,true],['smash',.5,-1,true]]){
   await prepare(candidate.id,smash);let touches=[];
   if(index<3){await stick(page,index,x,y);await sleep(180);}
   else {
     const [joy,hit]=await phones[index].page.evaluate(()=>['.arena-joy-base','#volley-hit'].map(q=>{const r=document.querySelector(q).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};}));
     touches=[{...joy,id:1}];await cdps[index].send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});
     touches=[{...joy,x:joy.x+x*50,y:joy.y+y*50,id:1}];await cdps[index].send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches});await sleep(180);touches.push({...hit,id:2});
   }
   const arrow=await G((g,id)=>{g.step(.001);g.scene.render();const p=g.players.find(p=>p.id===id),arr=g.aimArrows.get(id),pos=arr.getVerticesData('position'),V=g.scene.activeCamera.position.constructor,M=g.scene.getTransformMatrix().constructor,vp=g.scene.activeCamera.viewport.toGlobal(g.engine.getRenderWidth(),g.engine.getRenderHeight());const proj=i=>V.Project(new V(pos[i],pos[i+1],pos[i+2]),M.Identity(),g.scene.getTransformMatrix(),vp);return {visible:arr.isVisible,right:proj(3).x>proj(0).x,input:g.ctx.input.get(id).axis('move')};},candidate.id);
   if(name==='left')assert.ok(!arrow.right);if(name==='right')assert.ok(arrow.right);
   if(index<3){await btn(page,index,'A',true);await sleep(180);}else{await cdps[index].send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await sleep(180);}
   const shot=await G((g,id)=>{g.step(.001);const p=g.players.find(p=>p.id===id);return {vx:g.ball.vx,vy:g.ball.vy,vz:g.ball.vz,touch:g.ball.lastTouchId,smashes:p.smashes,receives:p.receives,errors:p.errors};},candidate.id);assert.equal(shot.touch,candidate.id);
   if(name==='left')assert.ok(shot.vx<0);if(name==='right')assert.ok(shot.vx>0);assert.ok(shot.vz*(team==='red'?1:-1)>0);
   if(name==='lob')assert.ok(shot.vy>9);if(name==='smash')assert.ok(shot.vy<0);if(name==='flat')assert.ok(shot.vy<8);
   if(index<3){await btn(page,index,'A',false);await stick(page,index,0,0);}else await cdps[index].send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await sleep(400);await page.screenshot({path:`${out}/volley-${team}-${name}.png`});
   const flight=await G(g=>{let time=0,net=false;while(g.phase==='playing'&&time<4){const errors=g.players.reduce((sum,p)=>sum+p.errors,0);g.updateBall(1/60);net||=g.players.reduce((sum,p)=>sum+p.errors,0)>errors&&g.phase==='playing';time+=1/60;}return {x:g.ball.x,z:g.ball.z,phase:g.phase,time,net};});
   console.log(team,name,JSON.stringify(flight));assert.equal(flight.phase,'pointPause');assert.ok(!flight.net);assert.ok(flight.z*(team==='red'?1:-1)>0);
   report.shots.push({team,name,index,arrow,shot,flight});console.log(`PASS ${team} ${name}`);
  }
 }
 // Telefono: due dita reali sul joystick e COLPISCI, indipendentemente dal pad scelto sopra.
 const index=3,pid=ids[index];await prepare(pid,false);const ph=phones[index].page;
 const points=await ph.evaluate(()=>['.arena-joy-base','#volley-hit'].map(q=>{const r=document.querySelector(q).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};}));
 await cdps[index].send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:4}]});
 await cdps[index].send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...points[0],x:points[0].x-45,y:points[0].y+40,id:4}]});await sleep(150);
 await cdps[index].send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],x:points[0].x-45,y:points[0].y+40,id:4},{...points[1],id:5}]});await sleep(150);
 await G(g=>g.step(.001));assert.equal(await G(g=>g.ball.lastTouchId),pid);assert.ok(await G(g=>g.ball.vy>9));
 await ph.screenshot({path:`${out}/volley-phone-multitouch.png`});await cdps[index].send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await G(g=>{g.paused=false;g.soloBots.ids=new Set(g.players.map(p=>p.id));g.resetBall();g.redScore=0;g.blueScore=0;g.ctx.input.reset();});
 let end;for(let i=0;i<160;i++){end=await G(g=>{for(let n=0;n<100&&!g.resultsSent;n++)g.step(.02);return {ended:g.resultsSent,phase:g.phase,score:[g.redScore,g.blueScore]};});if(end.ended)break;await sleep(30);}
 assert.ok(end.ended,'cinque bot: partita completa senza forzare il risultato');report.round={...end,accelerated:true};
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati');assert.equal(await hostEval(page,gm=>gm.state.lastResults.results.length),5);
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync(`${out}/volley-browser.json`,JSON.stringify(report,null,2));console.log('PASS direzione Volley due squadre, 12 tiri fisici, arrow screen sx/dx, pad e telefono multitouch, 5 bot partita naturale accelerata, lobby/cleanup.');
}finally{writeFileSync(`${out}/volley-progress.json`,JSON.stringify(report,null,2));await browser.close();}
