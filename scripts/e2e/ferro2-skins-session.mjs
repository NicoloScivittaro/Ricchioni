import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {io} from 'socket.io-client';
import {launch,sleep} from './lib.mjs';
import {installMock,add,tap,XBOX} from './padmock.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1600x900';
const base='http://localhost:5191',out='docs/agent-work/ferro-2',b=await launch(),sockets=[],r={errors:[]};let p,phone;
const host=(fn,arg)=>p.evaluate(async(src,arg)=>{const url=performance.getEntriesByType('resource').map(x=>x.name).find(n=>/\/GameManager.ts/.test(n));const{game:gm}=await import(url);return new Function('gm','arg',`return (${src})(gm,arg)`)(gm,arg);},fn.toString(),arg);
const ack=(s,e,v)=>new Promise((resolve,reject)=>s.timeout(5000).emit(e,v,(err,a)=>err?reject(err):resolve(a)));
try{
 p=await b.newPage();p.on('pageerror',e=>r.errors.push(e.message));await p.goto(base+'/?debug=1');console.log('Host loaded');await p.waitForSelector('#pm-create');await p.click('[data-count="2"]');await p.click('#pm-create');await p.waitForSelector('#pm-feature');const code=await p.$eval('.pm-room-code b',e=>e.textContent),people=[];
 for(const[i,name]of['Niko','Boschi'].entries()){const s=io('http://localhost:3012',{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});const a=await ack(s,'player:join',{roomCode:code,displayName:name});assert.equal(a.ok,true);people.push(a);s.emit('player:selectCharacter',{characterId:['goblin','buttafuori'][i]});s.emit('player:ready',{ready:true});}
 await installMock(p,2);await add(p,0,XBOX);await sleep(350);await p.evaluate(id=>window.__pads.assign(0,id),people[0].playerId);if(await p.$('#pad-root.open'))await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#pm-start')?.disabled);await host(gm=>gm.selectMinigame('ferro'));await sleep(250);await p.click('#pm-start');await p.waitForSelector('#pm-reel-stage');await p.keyboard.press('Enter');
 await p.waitForFunction(async()=>{const u=performance.getEntriesByType('resource').map(x=>x.name).find(n=>/\/GameManager.ts/.test(n));const{game:gm}=await import(u);return !!gm.state?.mapVote;},{timeout:15000});r.mapOptions=await host(gm=>gm.state.mapVote.options.map(o=>o.id));assert.deepEqual(r.mapOptions,['colosseum','hell','geonosis']);await tap(p,0,'A',120);r.mapPadVote=await host(gm=>gm.state.mapVote.votes);assert.equal(r.mapPadVote[people[0].playerId],'colosseum');
 let ready=false;for(let i=0;i<100;i++){ready=await host(gm=>!!gm.game.scene.getScene('ferro')?.playing);if(ready)break;if(await p.$('#pad-controls'))await p.keyboard.press('Enter');await sleep(350);}assert.ok(ready,'Ferro loading');console.log('Ferro ready');
 await host(gm=>gm.game.scene.getScene('ferro').match.state.phaseLeft=1000);
 r.start=await host(gm=>{const g=gm.game.scene.getScene('ferro');return{phase:g.match.state.phase,views:g.display.rigs.length,players:g.match.state.warriors.length,loading:!!document.querySelector('.game-asset-loading')};});assert.equal(r.start.phase,'selection');assert.equal(r.start.views,2);assert.equal(r.start.players,2);assert.equal(r.start.loading,false);

 r.skins=await host(gm=>[...gm.game.scene.getScene('ferro').display.actors.values()].map(a=>a.skinDebug()));assert.equal(r.skins.length,2);assert.ok(r.skins.every(s=>s.ready&&s.bones===65&&s.clips.length===15));
 await host(gm=>gm.restartMatch());await p.waitForFunction(()=>!document.querySelector('#ferro-canvas'),{polling:100,timeout:15000});r.cleanup=await host(()=>({canvases:document.querySelectorAll('#ferro-canvas').length,hud:document.querySelectorAll('.ferro-overlay').length,loading:document.querySelectorAll('.game-asset-loading').length}));assert.equal(r.cleanup.canvases,0);assert.equal(r.cleanup.hud,0);assert.deepEqual(r.errors,[]);r.status='passed';console.log(JSON.stringify(r));
}catch(e){r.failure=String(e);console.error(e);process.exitCode=1;}finally{for(const s of sockets)s.disconnect();try{await host(gm=>gm.restartMatch());}catch{}await b.close();writeFileSync(out+'/integration-skins.json',JSON.stringify(r,null,2));}
