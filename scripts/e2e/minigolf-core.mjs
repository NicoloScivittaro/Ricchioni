import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,sleep,hostEval,hostSnapshot} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
const out='docs/agent-work/minigolf-redesign';mkdirSync(out,{recursive:true});const browser=await launch(),report={errors:[]};
try{
 const {page,code}=await createRoomOnHost(browser);page.on('pageerror',e=>report.errors.push(String(e)));const phones=[];
 for(let i=0;i<2;i++)phones.push(await addPhone(browser,code,['Carbo','Christian'][i],i));const G=(f,a)=>gameEval(page,'minigolf',f,a);
 await startGame(page,'minigolf');await until(()=>G(g=>g.match.aiming),50000,'aim');const first=await G(g=>g.match.activeIndex),phone=phones[first].page;
 await phone.waitForFunction(()=>!document.querySelector('#golf-shoot').disabled);assert.ok(await phones[1-first].page.evaluate(()=>!document.querySelector('#golf-spectator').hidden));
 const cdp=await phone.createCDPSession(),point=await phone.$eval('#golf-shoot',b=>{const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await sleep(450);assert.ok(await G((g,i)=>g.players[i].charging&&g.players[i].charge>.2,first));await page.screenshot({path:`${out}/m1-original-camera.png`});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await until(()=>G((g,i)=>g.players[i].strokes===1,first),4000,'actual touch shot');report.first=first;report.shot=await G(g=>({stage:g.match.stage,speed:Math.hypot(g.match.active.ball.vx,g.match.active.ball.vz)}));assert.ok(report.shot.speed>0);
 await until(()=>G(g=>g.match.aiming),24000,'next aim');const index=await G(g=>g.match.activeIndex),ph=phones[index].page,touch=await ph.createCDPSession(),p=await ph.$eval('#golf-shoot',b=>{const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});await ph.waitForFunction(()=>!document.querySelector('#golf-shoot').disabled);
 const count=await G((g,i)=>g.players[i].strokes,index);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:2}]});await sleep(250);await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await sleep(200);assert.equal(await G((g,i)=>g.players[i].strokes,index),count);
 // Reload while still holding TIRA: a disconnect cancellation must not become a shot.
 await G(g=>{g.match.aimRemaining=6;});await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:3}]});await sleep(250);await ph.reload({waitUntil:'load'});await ph.waitForSelector('#golf-status');await sleep(300);assert.equal(await G((g,i)=>g.players[i].strokes,index),count,'disconnect during charge does not shoot');report.reloadDuringCharge=true;
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);console.log('PASS two phones: active-only controls, perspective camera, true touch hold/release/cancel, natural next turn and lobby cleanup.');
}finally{writeFileSync(`${out}/core-browser.json`,JSON.stringify(report,null,2));await browser.close();}
