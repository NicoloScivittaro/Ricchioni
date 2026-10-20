import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,sleep} from './lib.mjs';
import {gameEval,until} from './padmock.mjs';
const out='docs/agent-work/minigolf-gravity',browser=await launch(),errors=[],report={};
try{
 const {page,code}=await createRoomOnHost(browser);page.on('pageerror',e=>errors.push(e.message));
 const phones=[];for(let i=0;i<2;i++)phones.push(await addPhone(browser,code,['Niko','Boschi'][i],i));
 await hostEval(page,gm=>{gm.selectMinigame('minigolf');gm.startGame();});
 await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),30000,'vote');
 for(const p of phones){await p.page.waitForSelector('[data-map-id="lungomare"]');await p.page.click('[data-map-id="lungomare"]');}
 const G=(fn,arg)=>gameEval(page,'minigolf',fn,arg);
 await until(()=>G(g=>g.phase==='playing'),90000,'minigolf');
 const probe=await G(g=>{
  const p=g.match.active;window.__golfProbe={id:p.id,events:[]};const original=g.event.bind(g);g.event=e=>{window.__golfProbe.events.push({type:e.type,id:e.id,value:e.value});return original(e);};
  const c=g.match.course,maxX=Math.max(...c.floors.map(f=>f.x+f.w/2+(f.motion?.amplitude??0)));
  p.strokes=1;p.holeShots=1;g.match.consumed=true;g.match.stage='rolling';g.match.rollTime=0;g.match.aimRemaining=60;
  Object.assign(p.ball,{x:maxX+.8,y:p.ball.teeY+.28,z:p.ball.tee.z,vx:0,vy:0,vz:0,grounded:false,safe:{x:p.ball.tee.x+2,z:p.ball.tee.z},safeY:p.ball.teeY,readyFor:0});
  g.cameraRig.reset();return {id:p.id,tee:{...p.ball.tee},teeY:p.ball.teeY,startY:p.ball.y};
 });
 await sleep(250);const airborne=await G((g,id)=>{const p=g.players.find(p=>p.id===id);return {y:p.ball.y,vy:p.ball.vy,grounded:p.ball.grounded};},probe.id);
 assert.ok(airborne.y<probe.startY&&airborne.vy<0&&!airborne.grounded);report.airborne=airborne;
 await page.screenshot({path:out+'/fall.png'});
 await until(()=>page.evaluate(id=>window.__golfProbe.events.some(e=>e.type==='fall'&&e.id===id),probe.id),8000,'fall');
 await sleep(300);const restored=await G((g,id)=>{const p=g.players.find(p=>p.id===id);return {x:p.ball.x,z:p.ball.z,penalties:p.penalties,strokes:p.strokes};},probe.id);
 assert.ok(Math.hypot(restored.x-probe.tee.x,restored.z-probe.tee.z)<.05);assert.equal(restored.penalties,1);assert.equal(restored.strokes,2);report.teeReturn=restored;
 await G((g,id)=>{
  const p=g.players.find(p=>p.id===id),c=g.match.course;g.match.activeIndex=g.players.indexOf(p);g.match.turn++;g.match.stage='rolling';g.match.consumed=true;g.match.rollTime=0;
  Object.assign(p.ball,{x:c.hole.x-.7,z:c.hole.z,y:c.holeY+.28,vx:1.5,vy:0,vz:0,grounded:true,done:false,readyFor:0});p.aim={x:1,z:0};g.cameraRig.reset();
 },probe.id);
 await until(()=>page.evaluate(id=>window.__golfProbe.events.some(e=>e.type==='hole'&&e.id===id),probe.id),6000,'hole');
 const entry=await G((g,id)=>{const p=g.players.find(p=>p.id===id),m=g.visuals.balls.get(id);return {finished:p.finished,visible:m.isVisible,y:m.position.y,activeDrop:g.visuals.sinking.has(id)};},probe.id);
 assert.equal(entry.finished,true);assert.equal(entry.visible,true);assert.equal(entry.activeDrop,true);report.holeEntry=entry;
 await page.screenshot({path:out+'/cup.png'});await sleep(650);
 assert.equal(await G((g,id)=>g.visuals.balls.get(id).isVisible,probe.id),false);report.animationCompleted=true;
 await hostEval(page,gm=>gm.restartMatch());await sleep(300);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);report.cleanup=true;
 for(const p of phones)await p.ctx.close();assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/browser-checks.json',JSON.stringify({...report,errors,fixtureNote:'Ball poses and shot state prepared for isolated gravity/tee/cup probes; production renderer, solver, scoring and phones used.'},null,2));await browser.close();}
