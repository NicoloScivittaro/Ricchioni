import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
import {visualCounters} from './tripo-counters.mjs';
const out='docs/agent-work/post-playtest',browser=await launch(),report={errors:[],accelerated:true};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<5;i++){const p=await addPhone(browser,code,`P${i}`,i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const G=(fn,arg)=>gameEval(page,'soccer',fn,arg);await startGame(page,'soccer');
 await until(async()=>await G(g=>g.phase==='playing'),40000,'via');
 await until(async()=>await G(g=>[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready')),60000,'Tripo');
 const identity=await G(g=>g.players.map(p=>{const v=g.readability.players.get(p.id);return {color:p.color,ring:v.ring.material.emissiveColor.toHexString(),team:p.team,text:v.status.text,name:v.name.text};}));
 assert.equal(identity.length,5);for(const p of identity){assert.equal(p.ring.toLowerCase(),p.color.toLowerCase());assert.ok(p.text.includes(p.team==='red'?'ROSSI':'BLU'));assert.ok(p.name);}
 report.identity=identity;
 await page.keyboard.press('Escape');await phones[4].page.waitForSelector('#pause-overlay');const clock=await G(g=>g.matchTime);await phones[4].page.reload({waitUntil:'load'});await phones[4].page.waitForSelector('#pause-overlay');await sleep(400);assert.equal(await G(g=>g.matchTime),clock);await page.keyboard.press('Escape');await phones[4].page.waitForFunction(()=>!document.querySelector('#pause-overlay'));
 const fixture=()=>G(g=>{g.ctx.input.reset();for(let i=0;i<g.players.length;i++){const p=g.players[i];Object.assign(p,{x:10,z:i%2?-7:7,vx:0,vz:0,hasBall:false,charging:false,chargeTime:0,dodgeTime:0,dodgeCooldown:0,lunge:false,stunTime:0,perfectTime:0,lucidTime:0,stanceTime:0,armTime:0,debtTime:0});}
 const a=g.players[0],b=g.players.find(p=>p.id!==a.id&&p.team===a.team),v=g.players.find(p=>p.team!==a.team);a.x=-8;a.z=0;a.facing=Math.PI/2;b.x=-1;b.z=0;v.x=10;v.z=0;a.hasBall=true;Object.assign(g.ball,{x:-6.35,z:0,ownerId:a.id,vx:0,vz:0,freeGrace:0,lastKickerId:null,prevKickerId:null});return {a:a.id,b:b.id,v:v.id};});
 let ids=await fixture();
 // Real mobile input: hold and release, visual power reflects the simulation.
 await phones[0].page.evaluate(()=>document.querySelector('#soccer-shoot').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7})));
 await until(async()=>await G(g=>g.players[0].charging&&g.players[0].chargeTime>.4),5000,'carica');
 assert.ok(await G(g=>g.readability.players.get(g.players[0].id).power.isVisible&&g.aimArrow.isVisible));
 await page.screenshot({path:`${out}/soccer-charge.png`});
 await phones[0].page.evaluate(()=>document.querySelector('#soccer-shoot').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7})));
 await until(async()=>await G(g=>!g.players[0].hasBall&&!g.players[0].charging),5000,'rilascio');
 report.release=await G(g=>({speed:Math.hypot(g.ball.vx,g.ball.vz),powerVisible:g.readability.players.get(g.players[0].id).power.isVisible,feed:[g.hud.action?.text]}));assert.ok(!report.release.powerVisible);assert.ok(report.release.feed.some(s=>s.includes('TIRO')));
 ids=await fixture();const pass=await G((g,o)=>{g.ctx.input.handle(o.a,{kind:'down',controlId:'shoot'});g.step(.01);g.ctx.input.handle(o.a,{kind:'up',controlId:'shoot'});for(let i=0;i<90;i++)g.step(.01);return {owner:g.ball.ownerId,ball:{...g.ball},players:g.players.map(p=>({id:p.id,x:p.x,z:p.z,hasBall:p.hasBall,facing:p.facing,charge:p.chargeTime})),feed:[g.hud.action?.text]};},ids);assert.equal(pass.owner,ids.b);assert.ok(pass.feed.some(s=>s.includes('PASSAGGIO RIUSCITO')));report.pass=pass;
 await fixture();const lucid=await G(g=>{const p=g.players.find(p=>p.characterId==='dottore');g.players.forEach(q=>q.hasBall=false);p.hasBall=true;p.x=0;p.z=0;p.facing=0;p.lucidTime=2;g.ball.ownerId=p.id;g.ctx.input.handle(p.id,{kind:'down',controlId:'shoot'});g.step(.05);const low=g.aimArrow.rotation.y;for(let i=0;i<14;i++)g.step(.05);const high=g.aimArrow.rotation.y;g.ctx.input.handle(p.id,{kind:'up',controlId:'shoot'});g.step(.01);return {low,high};});assert.equal(lucid.low,0);assert.ok(Math.abs(lucid.high)>1);report.lucid=lucid;
 ids=await fixture();const tackle=await G((g,o)=>{const a=g.players.find(p=>p.id===o.a),v=g.players.find(p=>p.id===o.v);v.x=a.x+1.5;v.z=a.z;v.facing=-Math.PI/2;g.ctx.input.handle(v.id,{kind:'down',controlId:'dash'});g.step(.01);g.ctx.input.handle(v.id,{kind:'up',controlId:'dash'});return {owner:g.ball.ownerId,tackles:v.tackles,text:g.readability.possession.text,feed:[g.hud.action?.text]};},ids);assert.equal(tackle.owner,ids.v);assert.ok(tackle.tackles>0);assert.ok(tackle.feed.some(s=>s.includes('CONTRASTO RIUSCITO')));report.tackle=tackle;
 // Five overlapping bodies: names separate on screen without covering the score/possession rows.
 await G(g=>{g.ctx.input.reset();g.players.forEach(p=>{p.hasBall=false;p.charging=false;p.vx=p.vz=0;p.x=0;p.z=8;});Object.assign(g.ball,{ownerId:null,x:0,z:0,vx:0,vz:0,freeGrace:10});});await sleep(250);
 const labels=await G(g=>[...g.readability.players.values()].map(v=>{const r=v.box._currentMeasure;return {x:r.left,y:r.top,w:r.width,h:r.height};}));
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'five close names do not overlap');}report.closeLabels=labels;
 await page.screenshot({path:`${out}/soccer-close.png`});
 // Occlusion fixture and wide roster: only visual positions are arranged, no end-state override.
 await G(g=>{g.ctx.input.reset();g.players.forEach((p,i)=>{p.hasBall=false;p.charging=false;p.vx=p.vz=0;p.x=i===0?0:i%2?14:-14;p.z=i===0?0:i<3?8:-8;});Object.assign(g.ball,{ownerId:null,x:0,z:0,vx:0,vz:0,freeGrace:10});g.step(.01);});
 assert.ok(await G(g=>g.readability.ballRing.material.depthFunction===519&&g.readability.ballLabel.isVisible));
 report.framing=[];
 for(const [width,height] of [[1280,720],[1366,768],[1920,1080],[800,600]]){
  await page.setViewport({width,height});await sleep(400);
  const projected=await G(g=>{const c=g.scene.activeCamera,e=g.engine,Vec=g.ballMesh.position.constructor,Matrix=g.ballMesh.getWorldMatrix().constructor;const vp=c.viewport.toGlobal(e.getRenderWidth(),e.getRenderHeight());return [...g.players.map(p=>[p.x,3.1+p.y,p.z]),[g.ball.x,.55,g.ball.z],[-16,2.3,0],[16,2.3,0]].map(p=>{const v=Vec.Project(new Vec(...p),Matrix.Identity(),g.scene.getTransformMatrix(),vp);return {x:v.x/vp.width,y:v.y/vp.height};});});
  assert.ok(projected.every(p=>p.x>.045&&p.x<.955&&p.y>.14&&p.y<.86),`safe framing ${width}x${height}: ${JSON.stringify(projected)}`);report.framing.push({width,height,projected});
 }
 await page.setViewport({width:1280,height:720});await sleep(400);await page.screenshot({path:`${out}/soccer-five.png`});
 // Five seats, actual AI for the four bots, natural match and possible golden goal.
 await G(g=>{for(const p of g.ctx.players)p.bot=true;g.soloBots=new g.soloBots.constructor(g.ctx);});
 let info;for(let b=0;b<30;b++){info=await G(g=>{for(let n=0;n<100&&!g.resultsSent;n++)g.step(.05);return {phase:g.phase,ended:g.resultsSent,red:g.redScore,blue:g.blueScore,finite:g.players.every(p=>[p.x,p.z,p.vx,p.vz].every(Number.isFinite))&&[g.ball.x,g.ball.z,g.ball.vx,g.ball.vz].every(Number.isFinite)};});if(info.ended)break;await sleep(100);}
 assert.ok(info.ended&&info.finite);report.round=info;await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati');assert.equal(await hostEval(page,gm=>gm.state.lastResults.results.length),5);
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal((await visualCounters(page)).liveInstances,0);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync(`${out}/soccer-browser.json`,JSON.stringify(report,null,2));console.log('PASS soccer: five identities, phone charge/release, real pass/tackle, occlusion indicator, four screen framings/goals, pause/rejoin, AI natural match/results, cleanup and no errors. Time accelerated.');
}finally{await browser.close();}
