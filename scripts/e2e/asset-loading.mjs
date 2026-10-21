import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,sleep} from './lib.mjs';
process.env.GOBLIN_GPU='1';const b=await launch(),r={errors:[]},out='docs/agent-work/ferro-furia';let p;
try{
 p=await b.newPage();p.on('pageerror',e=>r.errors.push(e.message));await p.setRequestInterception(true);let release;const gate=new Promise(r=>release=r),blocked=[];
 p.on('request',async req=>{if(/\.glb(?:\?|$)/.test(req.url())){blocked.push(req.url());await gate;}await req.continue().catch(()=>{});});
 await p.goto('http://localhost:5191/tools/ferro/loading.html');await p.waitForFunction(()=>window.fixture?.game&&document.querySelector('.game-asset-loading'),{timeout:30000});await sleep(800);
 r.pending=await p.evaluate(()=>{const f=window.fixture,g=f.game;return{controls:f.controls,loading:!!document.querySelector('.game-asset-loading [role="progressbar"]'),visible:g.engine.getRenderingCanvas().style.visibility,time:g.match.time,phase:g.match.phase};});assert.equal(r.pending.controls,0);assert.equal(r.pending.loading,true);assert.equal(r.pending.visible,'hidden');assert.equal(r.pending.time,0);assert.ok(blocked.length>0);release();
 await p.waitForFunction(()=>window.fixture.controls===1&&!document.querySelector('.game-asset-loading'),{timeout:90000});r.ready=await p.evaluate(()=>{const f=window.fixture,g=f.game;return{controls:f.controls,visible:g.engine.getRenderingCanvas().style.visibility,actors:[...g.entities.values()].map(e=>e.goblinDebug()),time:g.match.time};});assert.equal(r.ready.visible,'visible');assert.ok(r.ready.actors.every(a=>a?.state==='ready'));assert.deepEqual(r.errors,[]);
 await p.evaluate(()=>window.fixture.dispose());r.cleanup=await p.$$eval('.game-asset-loading',a=>a.length);assert.equal(r.cleanup,0);r.blocked=blocked.length;r.status='passed';console.log(JSON.stringify(r));
}catch(e){r.failure=String(e);if(p)r.diagnostic=await p.evaluate(()=>{const g=window.fixture?.game;return{body:document.body.innerText.slice(-1000),actors:g?[...g.entities.values()].map(e=>e.goblinDebug()):[],pending:g?.scene._pendingData.map(d=>d.name??d.url),notReady:g?.scene.textures.filter(t=>!t.isReady()).map(t=>t.name),ready:g?.scene.isReady()};}).catch(()=>null);console.error(e);process.exitCode=1;}finally{await b.close();writeFileSync(out+'/loading.json',JSON.stringify(r,null,2));}
