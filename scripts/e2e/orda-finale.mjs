import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {io} from 'socket.io-client';
import {launch,sleep} from './lib.mjs';
import {installMock,add,XBOX,trig} from './padmock.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1920x1080';
const base=process.env.ORDA_URL??'http://localhost:5191';
const b=await launch(),report={url:base,errors:[],screenshots:[]},sockets=[];let p,phone;
const ack=(s,e,v)=>new Promise((r,j)=>s.timeout(5000).emit(e,v,(err,a)=>err?j(err):r(a)));
const host=async(fn,arg)=>p.evaluate(async(fnSrc,arg)=>{const urls=performance.getEntriesByType('resource').map(r=>r.name),url=urls.find(n=>/\/GameManager.ts/.test(n))??urls.find(n=>/\/assets\/main-[^/]+\.js(?:\?|$)/.test(n));const m=await import(url),gm=m.game??Object.values(m).find(v=>v&&typeof v==='object'&&typeof v.restartMatch==='function'&&v.input);return new Function('gm','arg',`return (${fnSrc})(gm,arg)`)(gm,arg);},fn.toString(),arg);
const snapshot=()=>host(gm=>{const s=gm.game.scene.getScene('orda');return s?.match?{state:s.match.packet(),stats:s.display?.stats(),playing:s.playing}:null;});
try{
 p=await b.newPage();p.on('pageerror',e=>report.errors.push('host: '+e.message));p.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text().slice(0,300));});
 await p.goto(base+'/?debug=1');await p.waitForSelector('#pm-create');await p.click('[data-count="5"]');await p.click('#pm-create');await p.waitForSelector('#pm-feature');const code=await p.$eval('.pm-room-code b',e=>e.textContent);console.log('ROOM',code);
 const people=[];
 for(const[i,name]of ['Niko','Boschi','Victor'].entries()){const s=io('http://localhost:3012',{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});const a=await ack(s,'player:join',{roomCode:code,displayName:name});assert.equal(a.ok,true);people.push(a);s.emit('player:selectCharacter',{characterId:['goblin','buttafuori','dottore'][i]});s.emit('player:ready',{ready:true});}
 await installMock(p,5);await add(p,0,XBOX);await add(p,1,XBOX);await sleep(500);await p.evaluate(ids=>{ids.forEach((id,i)=>window.__pads.assign(i,id));},people.slice(0,2).map(a=>a.playerId));
 if(await p.$('#pad-root.open'))await p.keyboard.press('Escape');
 // Third participant reconnects through the actual phone app. His Node socket is intentionally replaced.
 sockets[2].disconnect();phone=await b.newPage();await phone.setViewport({width:900,height:500,deviceScaleFactor:1});phone.on('pageerror',e=>report.errors.push('phone: '+e.message));
 phone.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log('PHONE',m.type(),m.text().slice(0,300));});
 await phone.evaluateOnNewDocument(a=>{localStorage.setItem('ricchioni.pid',a.playerId);localStorage.setItem('ricchioni.tok',a.reconnectToken);},people[2]);await phone.goto(base+'/controller.html');
 await p.bringToFront();await p.waitForFunction(()=>!document.querySelector('#pm-start')?.disabled);await host(gm=>gm.selectMinigame('orda'));await sleep(350);await p.click('#pm-start');console.log('START');await p.waitForSelector('#pm-reel-stage');await p.keyboard.press('Enter');
 const deadline=Date.now()+100000;let snap;
 while(Date.now()<deadline){snap=await snapshot();if(snap?.playing)break;if(await p.$('#pad-controls'))await p.keyboard.press('Enter');await sleep(500);}
 assert.ok(snap?.playing,'Orda did not finish loading');console.log('LOADED',snap.stats);report.start={stats:snap.stats,participants:snap.state.players.map(p=>({name:p.name,bot:p.bot,hp:p.hp,weapon:p.weapon}))};assert.equal(snap.state.players.length,5);assert.equal(snap.state.players.filter(p=>p.bot).length,2);
 await p.keyboard.press('F3');await sleep(4500);report.firstWave=await snapshot();assert.ok(report.firstWave.state.wave>=1);await p.screenshot({path:'docs/agent-work/orda-finale/01-prima-ondata.png'});report.screenshots.push('01-prima-ondata.png');
 await phone.bringToFront();await phone.waitForFunction(()=>!document.querySelector('.orda-phone-loading'),{timeout:60000,polling:100});assert.ok(await phone.$('.orda-phone canvas'));report.phone={canvas:await phone.$eval('.orda-phone canvas',c=>({width:c.width,height:c.height})),text:await phone.$eval('.orda-overlay',e=>e.textContent)};await p.bringToFront();
 // Actual GamepadManager -> input -> simulation path, including ADS and finite-ammo trigger.
 await trig(p,0,'LT',1);await trig(p,0,'RT',1);await sleep(550);await trig(p,0,'RT',0);await trig(p,0,'LT',0);report.pad=await snapshot();assert.ok(report.pad.state.players[0].ammo<12);assert.ok(report.pad.state.players[0].ads>.4);
 const pitchBefore=(await snapshot()).state.players[0].pitch;await p.evaluate(()=>{window.__mp.pads[0].axes[3]=-.6;});await sleep(280);await p.evaluate(()=>{window.__mp.pads[0].axes[3]=0;});report.padLook={before:pitchBefore,after:(await snapshot()).state.players[0].pitch};assert.ok(report.padLook.after<pitchBefore,'Right stick up must aim upwards');
 await p.evaluate(()=>{window.__mp.pads[0].axes[3]=.6;});await sleep(280);await p.evaluate(()=>{window.__mp.pads[0].axes[3]=0;});
 // Actual pointer events -> socket -> host movement and ADS from the phone.
 const before=await snapshot();await phone.bringToFront();await phone.click('[data-tap="jump"]');await p.bringToFront();await sleep(180);const after=await snapshot();report.phone.jumpState={before:before.state.players.find(p=>p.name==='Victor').lastJump,after:after.state.players.find(p=>p.name==='Victor').lastJump,y:after.state.players.find(p=>p.name==='Victor').y};assert.ok(after.state.players.find(p=>p.name==='Victor').y>0);report.phone.jump=true;console.log('CONTROLS OK');
 if(!process.env.ORDA_SMOKE_ONLY){
 // Exclude the extra phone renderer from the desktop's five-view GPU sample.
 await phone.close();phone=null;const third=sockets[2]=io('http://localhost:3012',{transports:['websocket'],reconnection:false});await new Promise(r=>third.once('connect',r));await ack(third,'player:join',{roomCode:'',displayName:'',reconnectToken:people[2].reconnectToken});
 // Late-wave fixture: use the real wave scheduler and AI, not visual stand-ins. State setup is explicit in the report.
 await host(gm=>{const s=gm.game.scene.getScene('orda'),m=s.match;m.state.enemies=[];m.state.bolts=[];m.state.wave=9;m.startWave();m.state.players.forEach(p=>{p.hp=100;});s.savedStep=m.step.bind(m);m.step=(dt,input)=>{for(const p of m.state.players)if(p.alive)p.hp=100;s.savedStep(dt,input);};});await sleep(7500);
 report.advanced=await snapshot();await p.screenshot({path:'docs/agent-work/orda-finale/02-ondata-dieci.png'});report.screenshots.push('02-ondata-dieci.png');
 // Live fixed-state sample: 5 cameras and real enemies, no other browser viewport competing for GPU.
 report.benchmark=await host(async gm=>{const s=gm.game.scene.getScene('orda'),m=s.match,rows=[];for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,500));rows.push({...s.display.stats(),enemies:m.state.enemies.length});}return rows;});
 assert.ok(report.benchmark.every(r=>r.views===5),'Benchmark must retain five active views');
 report.benchmarkSummary={fps:report.benchmark.reduce((sum,r)=>sum+r.fps,0)/report.benchmark.length,render:report.benchmark[0].width+'×'+report.benchmark[0].height,scale:report.benchmark[0].scale,enemies:[Math.min(...report.benchmark.map(r=>r.enemies)),Math.max(...report.benchmark.map(r=>r.enemies))],seconds:6,conditions:'1920×1080 browser, RTX/D3D11, 5 live viewports, wave 10 fixture, normal simulation and AI, phone renderer closed; harness resets HP each step solely to preserve all five cameras during the sample and model loading. No invulnerability exists in the actual minigame.'};
 report.gpu=await p.evaluate(()=>{const gl=document.querySelector('#orda-canvas').getContext('webgl2');const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable';});
 // Every weapon can instantiate its actual existing GLB, including sniper ADS.
 report.weaponModels=await host(async gm=>{const s=gm.game.scene.getScene('orda'),p=s.match.state.players[0],ids=['pistola','mitraglia','raffica','laser','sparapiselli','bombarda'],rows=[];for(const id of ids){p.weapon=id;p.ammo=0;p.reserve=300;p.reload=.001;s.match.step(1/30);s.display.update(s.match.state,0);const rig=s.display.rigs[0];rows.push({id,loaded:await rig.vm.whenReady()});}p.weapon='laser';p.ammo=0;p.reload=.001;s.match.step(1/30);s.display.update(s.match.state,0);return rows;});assert.ok(report.weaponModels.every(r=>r.loaded));
 await trig(p,0,'LT',1);await sleep(350);report.sniperScope=await p.$eval('.orda-scope',el=>Number(el.style.opacity));assert.ok(report.sniperScope>.8);await p.screenshot({path:'docs/agent-work/orda-finale/03-cecchino-boss.png'});report.screenshots.push('03-cecchino-boss.png');await trig(p,0,'LT',0);
 report.permanentDeath=await host(gm=>{const s=gm.game.scene.getScene('orda'),m=s.match;m.step=s.savedStep;delete s.savedStep;m.damagePlayer(m.state.players[0],1000);m.resolveDeaths();m.advance(.2);return{alive:m.state.players[0].alive,hp:m.state.players[0].hp};});assert.equal(report.permanentDeath.alive,false);
 // Real match finish through server ranking after the celebration; no direct ctx.finish test shortcut.
 report.winner=await host(gm=>{const s=gm.game.scene.getScene('orda'),m=s.match;for(const p of m.state.players.slice(1,-1))m.damagePlayer(p,1000);m.resolveDeaths();return{phase:m.state.phase,winner:m.state.winner,rank:m.ranking().map(p=>p.id)};});assert.equal(report.winner.phase,'finished');await sleep(450);await p.screenshot({path:'docs/agent-work/orda-finale/04-ultimo-vivo.png'});report.screenshots.push('04-ultimo-vivo.png');await sleep(2400);report.finished=await host(gm=>({phase:gm.state.phase,results:gm.state.lastResults}));assert.ok(report.finished.results?.results.length===5);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify({...report,firstWave:undefined,pad:undefined,advanced:undefined,benchmark:undefined},null,2));
}catch(e){report.failure=String(e);if(p)await p.screenshot({path:'docs/agent-work/orda-finale/failure.png'}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{for(const s of sockets)s.disconnect();try{await host(gm=>gm.restartMatch());}catch{}await b.close();writeFileSync('docs/agent-work/orda-finale/'+(process.env.ORDA_SMOKE_ONLY?'smoke.json':'browser.json'),JSON.stringify(report,null,2));}
