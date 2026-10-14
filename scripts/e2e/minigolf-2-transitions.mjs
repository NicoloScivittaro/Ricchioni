import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until,installMock,add,remove,tap,btn,XBOX,DS,GENERIC,slot} from './padmock.mjs';
const out=process.env.GOLF_OUT??'docs/agent-work/minigolf-2',report={errors:[],transitions:[]};mkdirSync(out,{recursive:true});const browser=await launch();
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));const phones=[];
 for(let i=0;i<5;i++){const p=await addPhone(browser,code,['Niko','Christian','Victor','Carbo','Ciro'][i],i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const ids=await hostEval(page,g=>g.state.players.map(p=>p.id));await installMock(page);
 for(const [i,name]of[XBOX,DS,GENERIC].entries()){await add(page,i,name);await sleep(200);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A');}await page.evaluate(()=>window.__pads.setTarget(null));
 await startGame(page,'minigolf');const G=(f,a)=>gameEval(page,'minigolf',f,a);await until(()=>G(g=>g.phase==='playing'),50000,'play');
 // Configured short deadline fixture, actual controls/socket/physics and hole lifecycle.
 await G(g=>{g.match=new g.match.constructor(g.ctx.players,()=>.99,undefined,{holeSeconds:4});g.turn=-1;g.courseIndex=-1;g.syncCourse();});
 await until(()=>G(g=>g.match.aiming),12000,'hole1');assert.equal(await G(g=>g.match.activeIndex),0);
 await btn(page,0,'A',true);await sleep(300);assert.ok(await G(g=>g.players[0].charging));await page.keyboard.press('Escape');
 const before=await G(g=>({time:g.match.time,remaining:g.match.remaining}));await sleep(700);assert.deepEqual(await G(g=>({time:g.match.time,remaining:g.match.remaining})),before);
 await page.keyboard.press('Escape');await btn(page,0,'A',false);await sleep(200);assert.equal(await G(g=>g.players[0].strokes),0);
 // Hold across the deadline: transition must cancel it without a shot on release.
 await btn(page,0,'A',true);await until(()=>G(g=>g.phase==='transition'),6500,'intermission1');await page.screenshot({path:`out/intermission-1-fixed.png`.replace('out/',out+'/')});
 await btn(page,0,'A',false);await phones[4].page.reload({waitUntil:'load'});await phones[4].page.waitForSelector('#golf-companion-status');
 await until(()=>G(g=>g.match.courseIndex===1&&g.match.aiming),16000,'hole2');
 const snapshot=()=>G(g=>({hole:g.match.holeNumber,remaining:g.match.remaining,active:g.match.activeIndex,ids:g.players.map(p=>p.id),records:g.players.map(p=>p.records.length),strokes:g.players.map(p=>p.strokes),used:g.players.map(p=>p.used),extras:g.match.extras.length,charging:g.players.map(p=>p.charging)}));
 const h2=await snapshot();assert.deepEqual(h2.ids,ids);assert.deepEqual(h2.records,[1,1,1,1,1]);assert.ok(h2.remaining>3&&h2.remaining<=4);assert.ok(h2.strokes.every(s=>s===0)&&h2.charging.every(s=>!s));assert.equal(h2.active,1);report.transitions.push(h2);
 await btn(page,1,'A',true);await sleep(350);await btn(page,1,'A',false);await until(()=>G(g=>g.players[1].strokes===1),2500,'PlayStation shot after transition');
 await until(()=>G(g=>g.match.courseIndex===2&&g.match.aiming),35000,'hole3');const h3=await snapshot();assert.deepEqual(h3.ids,ids);assert.deepEqual(h3.records,[2,2,2,2,2]);assert.equal(h3.active,2);assert.ok(h3.strokes.every(s=>s===0)&&h3.used.every(s=>!s));report.transitions.push(h3);
 assert.equal((await slot(page,ids[0])).padIndex,0);assert.equal((await slot(page,ids[1])).padIndex,1);
 await remove(page,2);await phones[2].page.waitForFunction(()=>document.querySelector('#golf-shoot')&&!document.querySelector('#golf-shoot').disabled&&!document.querySelector('#golf-active').hidden);
 const cdp=await phones[2].page.createCDPSession(),point=await phones[2].page.$eval('#golf-shoot',b=>{const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await until(()=>G(g=>g.players[2].charging),1500,'fallback touch charging');await sleep(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await until(()=>G(g=>g.players[2].strokes===1),2500,'phone shot after transition/fallback');
 // Advance real simulation to bounded AFK playoff/result. No finish injection.
 for(let i=0;i<220&&!await G(g=>g.phase==='ended');i++){await G(g=>{for(let j=0;j<50&&g.phase!=='ended';j++)g.step(.02);});await sleep(10);}
 assert.equal(await G(g=>g.phase),'ended');assert.ok(await G(g=>g.players.every(p=>p.records.length===3)));await G(g=>{g.setPaused(true);});
 for(const [width,height]of[[1280,720],[800,600]]){await page.setViewport({width,height});await sleep(250);await G(g=>{g.scene.render();});await page.screenshot({path:`${out}/final-table-${width}x${height}.png`});}
 report.final=await G(g=>({courses:g.match.courses.map(c=>c.id),playoff:g.match.playoff,results:g.match.results()}));
 assert.equal(new Set(report.final.courses).size,3);assert.ok(report.final.results.every(r=>r.placement===1));
 await G(g=>{g.setPaused(false);for(let i=0;i<450&&!g.resultsSent;i++)g.step(.02);});await until(async()=>(await hostSnapshot(page)).phase==='ROUND_RESULTS',12000,'results');
 const results=await hostEval(page,g=>g.state.lastResults);assert.ok(results.results.every(r=>r.placement===1));assert.equal(new Set(Object.values(results.deltas)).size,1);await sleep(5900);await page.screenshot({path:`${out}/results-ex-aequo-five.png`});report.sharedResults=results;
 await hostEval(page,g=>g.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',12000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 console.log('PASS transitions:5real phone clients,3 pad mappings,pause deadline,held cancellation,rejoin,PlayStation+phone shots after hole reset,3 records,actual AFK playoff,shared ScoreManager points,TV1280/800,cleanup');
}finally{writeFileSync(`${out}/transitions-browser.json`,JSON.stringify(report,null,2));await browser.close();}
