import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,sleep} from './lib.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1600x900';
const browser=await launch(),out='docs/agent-work/human-views',result={errors:[],cases:[]};
try{
 for(const kind of process.env.VIEWS_VISUAL_ONLY?['backrooms','fps']:['backrooms','fps','kart'])for(const humans of process.env.VIEWS_VISUAL_ONLY?[3]:[1,3,5]){
  const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(`${kind}/${humans}: ${e.message}`));
  console.log(`Testing ${kind}: ${humans} humans, ${5-humans} bots`);
  await page.goto(`http://localhost:5191/tools/views/preview.html?game=${kind}&humans=${humans}&quality=medium`);
  await page.waitForFunction(()=>window.ready,{timeout:150000});
  const state=await page.evaluate(()=>{const f=window.fixture,g=f.game,ctx=f.ctx;
   return{kind:f.kind,humans:f.humans,participants:ctx.players.length,cameras:g.scene.activeCameras.map(c=>({name:c.name,viewport:[c.viewport.x,c.viewport.y,c.viewport.width,c.viewport.height],mask:c.layerMask})),
    owners:f.kind==='backrooms'?g.viewPlayers.map(p=>p.id):f.kind==='fps'?g.cams.map(c=>c.playerId):g.order,
    panels:f.kind==='backrooms'?g.panels.length:f.kind==='fps'?g.hud.size:g.hud.entries.size,
    actors:f.kind==='backrooms'?g.entities.size:f.kind==='fps'?g.avatars.size:g.karts.size,
    scares:f.kind==='backrooms'?g.scares.length:undefined};});
  assert.equal(state.participants,5);assert.equal(state.actors,5);assert.equal(state.cameras.length,humans);assert.equal(state.panels,humans);assert.deepEqual(state.owners,state.humans);
  if(humans===1)assert.deepEqual(state.cameras[0].viewport,[0,0,1,1]);
  if(kind==='backrooms'){
   assert.equal(state.scares,humans);
   state.mapping=await page.evaluate(()=>{const g=window.fixture.game;return g.viewPlayers.map((v,i)=>{const p=g.match.players.find(p=>p.id===v.id),index=g.match.players.indexOf(p),camera=g.cameras[i];return{id:p.id,rosterIndex:index,cameraX:camera.position.x,x:p.x,ownExcluded:(camera.layerMask&(1<<(10+index)))===0,scareMask:g.scares[i].root.getChildMeshes()[0].layerMask};});});
   assert.ok(state.mapping.every((p,i)=>p.ownExcluded&&Math.abs(p.cameraX-p.x)<.01&&p.scareMask===(1<<(20+i))));
   if(humans===3){
    state.capture=await page.evaluate(()=>{const g=window.fixture.game;g.controlsReady=false;g.paused=false;const p=g.match.players.find(p=>p.id===g.viewPlayers[1].id),bot=g.match.players.find(p=>p.bot);p.state='captured';p.stateTime=.1;g.match.events.push({type:'capture',player:p.id,kind:'bacteria',point:{x:p.x,z:p.z}},{type:'capture',player:bot.id,kind:'bacteria',point:{x:bot.x,z:bot.z}});g.step(.06);g.step(.06);g.scene.render();return{count:g.scares.length,visible:g.scares.map(s=>s.root.isEnabled()),kinds:[...g.captureKinds.keys()]};});
    assert.equal(state.capture.count,3);assert.deepEqual(state.capture.visible,[false,true,false]);
    state.spectator=await page.evaluate(()=>{const g=window.fixture.game,humans=g.viewPlayers.map(v=>g.match.players.find(p=>p.id===v.id));humans[0].state='eliminated';humans[0].stateTime=3;humans[1].state='eliminated';humans[1].stateTime=3;humans[2].state='exploring';g.step(.06);g.scene.render();g.setPaused(true);return{cameraX:g.cameras[0].position.x,subjectX:humans[2].x,subject:humans[2].id};});
    assert.equal(state.spectator.cameraX,state.spectator.subjectX);
   }
  }
  if(kind==='fps'){
   state.masks=await page.evaluate(()=>{const g=window.fixture.game;return g.cams.map(c=>({id:c.playerId,hiddenOwn:g.avatars.get(c.playerId).parts.every(m=>!(m.layerMask&c.camera.layerMask)),vmMask:c.vm.layerMask,cameraMask:c.camera.layerMask}));});
   assert.ok(state.masks.every(c=>c.hiddenOwn&&(c.vmMask&c.cameraMask)!==0));
  }
  await page.setViewport({width:1280,height:720});await sleep(100);await page.evaluate(()=>{const g=window.fixture.game;g.scene.render();});
  const resize=await page.evaluate(()=>window.fixture.game.scene.activeCameras.length);assert.equal(resize,humans);
  if(humans===3&&kind!=='kart'){
   if(kind==='backrooms')await page.evaluate(()=>{const g=window.fixture.game;g.paused=false;g.match.intro=0;for(const p of g.match.players){p.state='exploring';p.stateTime=3;}g.step(.06);g.controlsReady=true;g.viewPlayers.forEach((v,i)=>{const p=g.match.players.find(p=>p.id===v.id);g.updatePanel(p,p,i);});g.setPaused(true);g.scene.render();});
   await page.screenshot({path:`${out}/${kind}-3.png`});
  }
  result.cases.push(state);console.log(`Passed ${kind}/${humans}`);await page.evaluate(()=>window.fixture.dispose());await page.close();
 }
 assert.deepEqual(result.errors,[]);result.status='passed';
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}finally{await browser.close();writeFileSync(out+(process.env.VIEWS_VISUAL_ONLY?'/visual.json':'/renderers.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,cases:result.cases.length,errors:result.errors}));}
