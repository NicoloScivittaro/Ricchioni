import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const browser=await launch(),out='docs/agent-work/glide-polish',checks=[],errors=[],G=(p,f,a)=>gameEval(p,'kart3d',f,a);let details;
const ok=(c,label)=>{assert.ok(c,label);checks.push(label);console.log('PASS '+label);};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));const phones=[];
 for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'ALA '+i,i));
 await hostEval(page,gm=>{gm.selectMinigame('kart3d','arcobaleno');gm.startGame();});await until(()=>G(page,g=>g.controlsDone&&g.race.phase==='racing'),90000,'race');
 details=await G(page,g=>{
  g.paused=true;g.hud.setCountdown('');const gap=g.rainbow.gaps[0];
  [...g.karts.values()].forEach((k,i)=>{Object.assign(k,{distance:gap.landing-47-i*6,lateral:i%2?2:-2,flight:'GLIDE',glideStart:gap.launch,glideEnd:gap.landing,flightTime:7,flightEntryHeight:0,glideYawVelocity:0,glideLanding:0,speed:40,heading:0,steerVisual:0,jumpHeight:g.spline.flightHeightAt(gap.landing-47-i*6),jumpVelocity:-2,absHeading:g.trackAngleAt(gap.landing-47-i*6),slipVelocity:0,oilTimer:0});g.entities.get(k.playerId).updateVisual(k,g.spline);for(let i=0;i<40;i++)g.wings.get(k.playerId).update(1/60,true,0);});
  for(let i=0;i<120;i++)for(const k of g.karts.values())g.cameraManager.update(1/60,k.playerId,k,g.spline);g.present(1/60);g.scene.render();g.scene.render();
  const ownership=[...g.landingGuides.values()].map(guide=>g.scene.activeCameras.filter(c=>(c.layerMask&guide.mesh.layerMask)!==0).length);
  const id=g.order[0],k=g.karts.get(id),guide=g.landingGuides.get(id),left=g.wings.get(id).wings;
  guide.update(k,g.rainbow);const green=guide.material.emissiveColor.asArray();k.lateral=12;guide.update(k,g.rainbow);const red=guide.material.emissiveColor.asArray();k.lateral=-2;
  const foil={meshes:left.length,vertices:left.map(m=>m.getTotalVertices()),alpha:left.map(m=>m.hasVertexAlpha),normalY:left.map(m=>m.getVerticesData('normal')[1])};
  return {ownership,green,red,foil};
 });
 ok(details.ownership.length===5&&details.ownership.every(n=>n===1),'five landing markers are private to their viewport');
 ok(details.green[1]>details.green[0]&&details.red[0]>details.red[1],'prediction turns green in lane and orange outside');
 ok(details.foil.meshes===2&&details.foil.alpha.every(Boolean)&&details.foil.normalY.every(y=>y>0),'swept foils: two meshes, matching normals and fading trails');
 await page.screenshot({path:`${out}/landing-5views.png`});
 await G(page,g=>{g.savedOrder=g.order;const id=g.order[0];g.order=[id];g.cameraManager.applyLayout(g.order);g.hud.layout(g.order);for(let i=0;i<120;i++)g.cameraManager.update(1/60,id,g.karts.get(id),g.spline);g.present(1/60);g.scene.render();g.scene.render();});
 await page.screenshot({path:`${out}/landing-guide.png`});
 const landing=await G(page,g=>{const id=g.order[0],k=g.karts.get(id),gap=g.rainbow.gaps[0];Object.assign(k,{distance:gap.landing,flight:'DRIVE',jumpHeight:0,jumpVelocity:0,glideLanding:.3,heading:0,steerVisual:0});g.entities.get(id).updateVisual(k,g.spline);const entity=g.entities.get(id);g.present(1/60);g.scene.render();return {compression:entity.compression,bodyY:entity.carriage.position.y,markerEnabled:g.landingGuides.get(id).mesh.isEnabled()};});
 ok(landing.compression>.09&&landing.bodyY<-.07,'touchdown compresses the suspension');ok(!landing.markerEnabled,'touchdown hides the prediction');
 await page.screenshot({path:`${out}/touchdown.png`});
 details.landing=landing;
 await hostEval(page,gm=>gm.restartMatch());await sleep(800);await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const ph of phones)await ph.ctx.close();ok(errors.length===0,'no presentation runtime errors');
}finally{writeFileSync(`${out}/presentation-checks.json`,JSON.stringify({checks,errors,details},null,2));await browser.close();}
