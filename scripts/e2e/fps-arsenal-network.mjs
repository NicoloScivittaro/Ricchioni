import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5186/?quality=high';process.env.CTRL_URL='http://localhost:5186/controller.html';
const{launch,createRoomOnHost,addPhone,hostEval}=await import('./lib.mjs');const{sceneEval,until}=await import('./padmock.mjs');
const browser=await launch(),report={},errors=[],out='docs/agent-work/fps-arsenal';
try{
 const{page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const phones=[];for(let i=0;i<2;i++){
  const p=await addPhone(browser,code,'RETE '+i,i);p.page.on('pageerror',e=>errors.push(e.message));
phones.push(p);
 }
 await hostEval(page,g=>{g.selectMinigame('fps');g.startGame();});await until(()=>hostEval(page,g=>g.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,g=>g.skip());
 await until(()=>hostEval(page,g=>g.state.phase==='MINIGAME_MAP_VOTE'),15000,'vote');for(const p of phones){await p.page.waitForSelector('[data-map-id="cantiere"]');await p.page.click('[data-map-id="cantiere"]');}
 const G=(fn,arg)=>sceneEval(page,'fps',fn,arg);await until(()=>G(g=>g.roundReady&&g.controlsDone),90000,'ready');await G(g=>{g.controlsDone=false;g.soloBots.ids=new Set();});
 for(const p of phones)await p.page.waitForSelector('.fps-sniper-scope',{timeout:90000});
 for(const p of phones)await p.page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/controller\/fpsClient\.ts/.test(n));
  const{FpsClient}=await import(url);window.__arsenalSignals=[];
  for(const key of ['energyBolt','energyImpact','remoteShot']){const original=FpsClient.prototype[key];FpsClient.prototype[key]=function(...args){window.__arsenalSignals.push({type:key,arg:args[0]});return original.apply(this,args);};}
 });
 await G(g=>{for(const[p,z]of[[g.players[0],-20],[g.players[1],-10]])Object.assign(p,{x:-20,z,y:0,eyeHeight:1.5,hp:100,alive:true,spawnProtection:0,guardTime:0,debtTime:0,armTime:0,reloading:false,weaponId:'laser',magazine:5,ads:1,recoilPitch:0,recoilYaw:0,heat:0,moving:0});g.broadcastState();});
 for(const p of phones)await p.page.waitForFunction(()=>document.querySelector('.fps-sniper-scope')?.style.opacity==='1');
 report.scopeDelivered=true;
 await G(async g=>{const{getWeapon}=await import('/shared/fpsWeapons.ts');const a=g.players[0];Object.assign(a,{weaponId:'bombarda',yaw:0,pitch:0,magazine:20,ads:0,buffShots:0});g.broadcastState();g.fireShot(a,getWeapon('bombarda'));for(let i=0;i<30;i++)g.stepEnergyBolts(1/120);g.broadcastState();});
 for(const p of phones)await p.page.waitForFunction(()=>window.__arsenalSignals.some(s=>s.type==='energyImpact'));
 report.delivered=[];for(const p of phones)report.delivered.push(await p.page.evaluate(()=>window.__arsenalSignals));
 for(const messages of report.delivered){assert.equal(messages.filter(m=>m.type==='energyBolt').length,1);assert.equal(messages.filter(m=>m.type==='energyImpact').length,1);assert.equal(messages.filter(m=>m.type==='remoteShot').length,1);}
 report.targetHp=await G(g=>g.players[1].hp);assert.equal(report.targetHp,20);assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/network-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
