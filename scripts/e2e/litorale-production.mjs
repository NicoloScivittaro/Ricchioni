import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {io} from 'socket.io-client';
import {launch,sleep} from './lib.mjs';
import {until} from './padmock.mjs';
process.env.GOBLIN_GPU='1';
const browser=await launch(),phones=[],report={errors:[],checks:[],console:[],failedRequests:[]};let state,p;
const ack=(s,e,v)=>new Promise((resolve,reject)=>s.timeout(4000).emit(e,v,(err,a)=>err?reject(err):resolve(a)));
try {
 p=await browser.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',d=>d.accept());
 p.on('console',m=>{if(['error','warn'].includes(m.type())&&report.console.length<12)report.console.push(m.text().slice(0,500));});
 p.on('requestfailed',r=>{if(report.failedRequests.length<12)report.failedRequests.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText});});
 await p.goto('http://localhost:3012/?quality=high');await p.waitForSelector('#pm-create',{timeout:30000});
 await p.click('[data-count="5"]');await p.click('#pm-create');await p.waitForSelector('#pm-feature');
 const code=await p.$eval('.pm-room-code b',e=>e.textContent);
 for(let i=0;i<5;i++){
  const s=io('http://localhost:3012',{transports:['websocket'],reconnection:false});phones.push(s);s.on('room:state',v=>state=v);
  await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});
  assert.equal((await ack(s,'player:join',{roomCode:code,displayName:'Prova '+(i+1)})).ok,true);
  s.emit('player:selectCharacter',{characterId:['goblin','buttafuori','dottore','judoka','ciro'][i]});s.emit('player:ready',{ready:true});
 }
 await p.waitForFunction(()=>!document.querySelector('#pm-start')?.disabled);
 await p.click('#pm-catalog-open');const kart=await p.$$eval('[data-catalog]',els=>els.find(e=>e.querySelector('strong')?.textContent==='RIBALTATI').dataset.catalog);
 await p.click(`[data-catalog="${kart}"]`);await p.click('#pm-start');await p.waitForSelector('#pm-reel-stage');await p.keyboard.press('Enter');
 await until(()=>state?.phase==='MINIGAME_MAP_VOTE',10000,'actual map vote');
 for(const s of phones)assert.equal((await ack(s,'map:vote',{roundId:state.roundId,mapId:'litorale'})).ok,true);
 // Votes remain editable until the existing 15-second deadline, then intro.
 await until(()=>state?.phase==='MINIGAME_PLAYING',26000,'actual playing phase');
 await p.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>c.style.zIndex==='10000'&&c.style.visibility==='visible'),{timeout:30000});
 report.native=await p.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/main-[^/]+\.js(?:\?|$)/.test(n));
  const module=await import(url),gm=module.g,g=gm.game.scene.getScene('kart3d').game3d;
  return{scale:g.engine.getHardwareScalingLevel(),views:g.scene.activeCameras.length,preparing:g.preparingCoast,drivers:[...g.entities.values()].filter(e=>e.goblinDriver).map(e=>e.goblinDriver.ready)};
 });
 assert.equal(report.native.scale,1);assert.equal(report.native.views,5);assert.equal(report.native.preparing,false);assert.ok(report.native.drivers.every(Boolean));
 assert.equal(state.players.length,5);assert.equal(state.currentMinigame.minigameId,'kart3d');
 await sleep(4000);for(const s of phones)s.emit('input:down',{controlId:'up'});await sleep(1300);
 await p.screenshot({path:'docs/agent-work/litorale-lag/production.png'});
 report.checks.push('Final compiled game: five controller sockets, one Ribaltati card, real Litorale map vote, loader completion, visible five-player race and throttle inputs.');
 assert.equal(await p.evaluate(()=>document.body.textContent.includes('Il caricamento sta impiegando troppo tempo')),false);
 await p.keyboard.press('Escape');await sleep(150);
 const back=await p.$$('button');let clicked=false;
 for(const b of back)if((await b.evaluate(e=>e.textContent)).includes('TORNA ALLA LOBBY')){await b.click();clicked=true;break;}
 assert.equal(clicked,true);await p.waitForSelector('#pm-feature');
 assert.equal(await p.$$eval('canvas',els=>els.filter(c=>c.style.zIndex==='10000').length),0);
 await p.click('#pm-back');await p.waitForSelector('#pm-create');
 report.checks.push('Pause/return cleans up the 3D canvas and returns to the shared room; no load recovery or page errors.');
 assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify(report));
}catch(e){
 report.failure={message:e.message,phase:state?.phase};
 if(p){report.dom=await p.evaluate(()=>({text:document.body.innerText.slice(-3000),canvases:[...document.querySelectorAll('canvas')].map(c=>({z:c.style.zIndex,visibility:c.style.visibility,w:c.width,h:c.height})),debugKeys:Object.keys(window).filter(k=>/gm|game|babylon|phaser|envScene/i.test(k)).slice(0,20)}));await p.screenshot({path:'docs/agent-work/litorale-lag/production-failure.png'});}
 throw e;
}finally{phones.forEach(s=>s.disconnect());await browser.close();writeFileSync('docs/agent-work/litorale-lag/production.json',JSON.stringify(report,null,2));}
