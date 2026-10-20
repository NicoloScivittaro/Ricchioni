import assert from 'node:assert/strict';import {readdirSync,writeFileSync} from 'node:fs';import {launch,sleep} from './lib.mjs';
const browser=await launch(),errors=[],report={},out='docs/agent-work/terminal-2-3';
try{
 const page=await browser.newPage();page.on('response',r=>{if(r.status()>=400&&r.url().endsWith('/favicon.ico'))report.missingSiteFavicon=true;});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 const response=await page.goto('http://localhost:3012/terminal-2-3/');assert.equal(response.status(),200);await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));report.gallery=true;
 const bundle=readdirSync('dist/assets').find(n=>/^fpsClient-.*\.js$/.test(n));
 report.compiledClient=await page.evaluate(async bundle=>{
  document.body.innerHTML='<div id="stage" style="position:fixed;inset:0"></div>';
  const{FpsClient}=await import('/assets/'+bundle);const c=new FpsClient(document.querySelector('#stage'),'built',()=>{},()=>null,'terminal');c.engine.stopRenderLoop();
  c.updateState({matchTime:0,players:[{id:'built',name:'BUILT',color:'#80dda0',x:18.6,z:-7.8,y:4.88,hp:100,alive:true,weaponId:'laser',magazine:5,reloading:false,firing:false,ads:1}]});await c.vm.whenReady();await c.ready;await c.scene.whenReadyAsync();for(let i=0;i<90;i++)c.tick(1/60);c.scene.render();
  const scoped={zoom:Math.tan(.8/2)/Math.tan(c.camera.fov/2),alpha:c.scopeEl.style.opacity,hidden:!c.vm.current.root.isEnabled()};
  c.energyBolt({id:1,ox:-20,oy:1.5,oz:-15,dx:0,dy:0,dz:1,speed:55,range:60});const launched=c.energyFx.bolts.filter(b=>b.mesh.isVisible).length;c.energyImpact({id:1,x:-20,y:1.5,z:-10,r:1.8});const stopped=c.energyFx.bolts.filter(b=>b.mesh.isVisible).length;c.dispose();return{scoped,launched,stopped};
 },bundle);assert.equal(report.compiledClient.scoped.alpha,'1');assert.equal(report.compiledClient.scoped.zoom,4);assert.ok(report.compiledClient.scoped.hidden);assert.equal(report.compiledClient.launched,1);assert.equal(report.compiledClient.stopped,0);
 await page.goto('http://localhost:3012/');await page.waitForSelector('canvas');await sleep(2000);report.hostTitle=await page.title();assert.match(report.hostTitle,/Ricchioni Party/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/production-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
