import {visualCounters} from './tripo-counters.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,HOST_URL,sleep} from './lib.mjs';
const browser=await launch(),report={};
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(HOST_URL,{waitUntil:'load'});
 await page.evaluate(async()=>{
  const {FpsClient}=await import('/src/controller/fpsClient.ts');
  for(const el of document.body.children)el.style.visibility='hidden';
  const box=document.createElement('div');box.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:999999';document.body.append(box);
  const ids=['goblin','buttafuori','judoka','ciro','dottore'];
  const client=new FpsClient(box,'self',()=>{},id=>id);
  const players=[{id:'self',name:'self',x:0,z:-8,yaw:0,color:'#22cc88',hp:100,alive:true,weaponId:'mitraglia',firing:false},...ids.map((id,i)=>({id,name:id,x:(i-2)*2,z:-3,yaw:Math.PI,color:'#22cc88',hp:100,alive:true,weaponId:'mitraglia',firing:false}))];
  client.updateState({matchTime:120,players});window.__phone={client,players,ids};
 });
 await page.waitForFunction(()=>[...window.__phone.client.remotes.values()].filter(e=>e.tripo).every(e=>e.tripo.debug().state==='ready'),{timeout:60000});
 assert.equal((await visualCounters(page)).liveInstances,4);
 await sleep(400);
 report.states=await page.evaluate(()=>{
  const {client,players}=window.__phone;client.engine.stopRenderLoop();const rows=[];
  for(const phase of ['idle','move','hit','death','respawn']){
   for(const p of players.filter(p=>p.id!=='self')){if(phase==='move')p.x+=1;if(phase==='hit')p.hp=60;if(phase==='death'){p.alive=false;p.hp=0;}if(phase==='respawn'){p.alive=true;p.hp=100;}}
   const state=Object.freeze({matchTime:120,players:players.map(p=>Object.freeze({...p}))}),before=JSON.stringify(state);client.updateState(state);
   for(let n=0;n<14;n++){client.interpolateRemotes(.016);client.scene.render();}
   for(const [id,e] of client.remotes){if(!e.tripo)continue;rows.push({id,phase,debug:e.tripo.debug(),meshIds:e.tripo.meshes.map(m=>m.uniqueId),oldHidden:!e.body.isVisible&&!e.head.isEnabled(),finite:e.tripo.meshes.filter(m=>m.getTotalVertices()>0).every(m=>Array.from(m.getPositionData(true,true)).every(Number.isFinite)),physicsUnchanged:before===JSON.stringify(state),rootY:e.tripoRoot.position.y});}
  }
  return {rows,dottoreOriginal:!client.remotes.get('dottore').tripo&&client.remotes.get('dottore').head.isEnabled()};
 });
 assert.equal(report.states.rows.length,20);assert.ok(report.states.dottoreOriginal);
 for(const row of report.states.rows){assert.equal(row.debug.bones,65);assert.ok(row.oldHidden&&row.finite&&row.physicsUnchanged);assert.equal(row.rootY,0);assert.deepEqual(row.meshIds,report.states.rows.find(r=>r.id===row.id).meshIds);if(row.phase==='death')assert.match(row.debug.animator.name,/\.ko$/);}
 await page.evaluate(()=>window.__phone.client.engine.runRenderLoop(()=>window.__phone.client.scene.render()));await sleep(200);await page.screenshot({path:'docs/agent-work/general-polish/shots/fps-phone-remotes.png'});
 await page.evaluate(()=>window.__phone.client.dispose());
 report.counters=await visualCounters(page);assert.equal(report.counters.liveInstances,0);
 // Fail every character download in a fresh scene: the remote boxes and decorated heads remain visible.
 await page.setRequestInterception(true);page.on('request',r=>/_(?:casacarbo|animated)\.glb/.test(r.url())?r.abort('failed'):r.continue());
 await page.evaluate(async()=>{const {FpsClient}=await import('/src/controller/fpsClient.ts');const box=document.createElement('div');document.body.append(box);const client=new FpsClient(box,'self',()=>{},id=>id);client.updateState({matchTime:120,players:window.__phone.players});window.__phone.client=client;});
 await page.waitForFunction(()=>[...window.__phone.client.remotes.values()].filter(e=>e.tripo).every(e=>e.tripo.debug().state==='error'),{timeout:30000});
 report.fallback=await page.evaluate(()=>[...window.__phone.client.remotes.values()].filter(e=>e.tripo).map(e=>({state:e.tripo.debug().state,visible:e.body.isVisible&&e.head.isEnabled()})));assert.equal(report.fallback.length,4);assert.ok(report.fallback.every(r=>r.visible));
 await page.evaluate(()=>window.__phone.client.dispose());assert.deepEqual(errors,[]);
 writeFileSync('docs/agent-work/general-polish/fps-phone.json',JSON.stringify({report,errors},null,2));console.log('PASS: four Tripo FPS remotes on phone renderer; movement/hit/KO/respawn preserve skin and immutable state; Dottore original; four failed downloads retain legacy; disposal');
}finally{await browser.close();}
