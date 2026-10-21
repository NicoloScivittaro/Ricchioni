import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {launch,sleep} from './lib.mjs';
process.env.GOBLIN_GPU='1';
const browser=await launch(),report=process.env.SKIP_NORMAL==='1'?JSON.parse(readFileSync('docs/agent-work/litorale-lag/loading.json','utf8')):{errors:[],checks:[]};
const url='http://localhost:5191/docs/agent-work/litorale-lag/live.html?quality=high&views=1';
const page=async()=>{const p=await browser.newPage();p.on('pageerror',e=>report.errors.push(e.message));return p;};
try {
 let p;
 if(process.env.SKIP_NORMAL!=='1'){
 p=await page();await p.goto(url+'&goblinDelay=1800');
 await p.waitForFunction(()=>!!window.g);
 const pending=await p.evaluate(()=>({preparing:g.preparingCoast,time:g.race.raceTime,controls:window.controls.length}));
 assert.equal(pending.preparing,true);assert.equal(pending.time,0);assert.equal(pending.controls,0);
 await p.waitForFunction(()=>window.ready,{timeout:30000});
 const ready=await p.evaluate(()=>({load:window.loadMs,scale:window.loadScale,controls:window.controls,drivers:[...g.entities.values()].filter(e=>e.goblinDriver).map(e=>e.goblinDriver.ready)}));
 assert.ok(ready.load>=1600);assert.ok(ready.drivers.every(Boolean));assert.deepEqual(ready.controls,[{pending:0}]);
 assert.equal(ready.scale,1,'hidden loading frames do not lower the native HIGH resolution');
 await p.waitForFunction(()=>g.race.phase==='racing',{timeout:8000});
 report.hud=await p.evaluate(async()=>{
  const original=g.hud.update,cam=g.cameraManager.update,id=g.order[0];let calls=0,cameras=0,time=0,frames=0;
  g.hud.update=function(...args){if(args[0]===id){calls++;time+=args.at(-1);}return original.apply(this,args);};
  g.cameraManager.update=function(...args){if(args[1]===id)cameras++;return cam.apply(this,args);};
  const o=g.scene.onAfterRenderObservable.add(()=>frames++),start=performance.now();await new Promise(r=>setTimeout(r,1800));
  g.scene.onAfterRenderObservable.remove(o);g.hud.update=original;g.cameraManager.update=cam;
  return{calls,cameras,frames,hudTime:time,elapsed:(performance.now()-start)/1000};
 });
 assert.ok(report.hud.calls/report.hud.elapsed<34);assert.ok(report.hud.cameras>=report.hud.calls);
 assert.ok(Math.abs(report.hud.hudTime-report.hud.elapsed)<.15,'HUD animations retain elapsed time at the lower refresh rate');
 report.checks.push('Delayed real drivers finish before controls/countdown; one-view race starts; HUD capped near 30 Hz with elapsed-time preservation and full-rate camera.');
 report.checks.push('Native HIGH resolution is preserved at readiness after deliberately slow hidden loading.');
 await p.evaluate(()=>g.dispose());await p.close();
 }
 p=await page();await p.setRequestInterception(true);let aborted=false,target='';
 p.on('request',r=>{const path=r.url().split('?')[0];if(!target&&path.endsWith('.glb'))target=path;if(path===target){aborted=true;r.abort();}else r.continue();});
 await p.goto(url);await p.waitForFunction(()=>window.ready,{timeout:30000});
 const fallback=await p.evaluate(()=>({failed:[...g.entities.values()].filter(e=>e.goblinDriver?.failed).length,controls:window.controls}));report.fallback=fallback;
 assert.equal(aborted,true);assert.equal(fallback.failed,1);assert.deepEqual(fallback.controls,[{pending:0}]);
 report.checks.push('A failed driver asset keeps its existing procedural fallback and does not block starting.');
 await p.evaluate(()=>g.dispose());await p.close();
 p=await page();await p.goto(url+'&goblinDelay=4000');await p.waitForFunction(()=>!!window.g);
 await p.evaluate(()=>g.dispose());await p.waitForFunction(()=>window.ready,{timeout:3000});
 assert.equal(await p.evaluate(()=>g.scene.isDisposed),true);assert.equal(await p.evaluate(()=>window.controls.length),0);
 report.checks.push('Disposal during loading settles readiness without starting controls or keeping a live scene.');
 assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify(report));
}finally{writeFileSync('docs/agent-work/litorale-lag/loading.json',JSON.stringify(report,null,2));await browser.close();}
