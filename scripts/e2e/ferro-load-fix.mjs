import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {io} from 'socket.io-client';
import {launch,sleep} from './lib.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1600x900';
const base=process.env.FERRO_BASE??'http://localhost:3012',map=process.env.FERRO_MAP??'colosseum',out='docs/agent-work/ferro-load-fix',r={base,map,errors:[],requests:[]},browser=await launch(),clients=[];let state;
try{
 const p=await browser.newPage();await p.setCacheEnabled(false);
 const delay=Number(process.env.FERRO_DELAY_MS??0);let delayed=false;
 if(delay){await p.setRequestInterception(true);p.on('request',request=>{if(!delayed&&/\/(skin-goblin|green_goblin_casacarbo)\.glb/.test(request.url())){delayed=true;setTimeout(()=>request.continue().catch(()=>{}),delay);}else void request.continue();});}
 p.on('pageerror',e=>r.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')r.errors.push(m.text());});
 p.on('response',response=>{if(/\.(glb|json)(\?|$)/.test(response.url()))r.requests.push({url:response.url(),status:response.status(),at:Date.now()});});
 await p.goto(base+'/?debug=1');await p.waitForSelector('#pm-create');await p.click('[data-count="5"]');await p.click('#pm-create');await p.waitForSelector('#pm-feature');const roomCode=await p.$eval('.pm-room-code b',e=>e.textContent);
 for(const[i,id]of ['goblin','buttafuori','dottore','judoka','ciro'].entries()){
  const socket=io('http://localhost:3012',{transports:['websocket'],reconnection:false});clients.push(socket);socket.on('room:state',s=>state=s);
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const join=await new Promise(resolve=>socket.emit('player:join',{roomCode,displayName:'LOAD '+i},resolve));assert.ok(join.ok);socket.emit('player:selectCharacter',{characterId:id});socket.emit('player:ready',{ready:true});
 }
 await p.evaluate(()=>[...document.querySelectorAll('[data-game]')].find(e=>e.textContent.includes('FERRO E FURIA')).click());await p.waitForFunction(()=>!document.querySelector('#pm-start').disabled);await p.click('#pm-start');await p.waitForSelector('#pm-reel-stage');await p.keyboard.press('Enter');
 const voteUntil=Date.now()+15000;while(!state?.mapVote&&Date.now()<voteUntil)await sleep(100);assert.ok(state?.mapVote);
 for(const socket of clients)socket.emit('map:vote',{roundId:state.roundId,mapId:map});
 const start=Date.now();let done=false;
 for(let i=0;i<240;i++){
  r.last=await p.evaluate(()=>({loading:!!document.querySelector('.game-asset-loading'),controls:!!document.querySelector('#pad-controls'),ferro:!!document.querySelector('#ferro-overlay'),error:document.querySelector('.ui-card.err')?.textContent??null,text:document.body.innerText.slice(-500)}));
  if(r.last.controls)await p.keyboard.press('Enter');
  if(r.last.ferro&&!r.last.loading&&!r.last.controls){done=true;break;}
  if(r.last.error||r.errors.some(e=>e.includes('caricamento sta')))break;
  await sleep(400);
 }
 r.elapsedSeconds=(Date.now()-start)/1000;r.delayedAsset=delayed;r.delayMs=delay;await p.screenshot({path:out+'/'+map+'-'+(process.env.FERRO_LABEL??'cold')+'.png'});assert.ok(done,JSON.stringify(r.last));assert.ok(!r.errors.some(e=>!e.includes('favicon')));r.status='passed';console.log(JSON.stringify(r));
}catch(e){r.failure=String(e);console.error(e);process.exitCode=1;}finally{for(const socket of clients)socket.disconnect();await browser.close();writeFileSync(out+'/'+map+'-'+(process.env.FERRO_LABEL??'cold')+'.json',JSON.stringify(r,null,2));}
