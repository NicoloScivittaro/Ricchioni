import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,sleep,hostEval,hostSnapshot} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
const out='docs/agent-work/minigolf';mkdirSync(out,{recursive:true});
const browser=await launch(),report={errors:[]};
try{
 const {page,code}=await createRoomOnHost(browser);page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<2;i++)phones.push(await addPhone(browser,code,['Carbo','Christian'][i],i));
 const G=(fn,arg)=>gameEval(page,'minigolf',fn,arg);
 await startGame(page,'minigolf');await until(()=>G(g=>g.phase==='playing'),45000,'golf playing');
 await until(()=>phones[0].page.evaluate(()=>!document.querySelector('#golf-shoot')?.disabled),10000,'phone ready');
 await phones[0].page.touchscreen.tap(300,440); // unlock actual touch surface, input tested below through captured touch
 const touch=await phones[0].page.createCDPSession();
 const button=await phones[0].page.$eval('#golf-shoot',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...button,id:1}]});await sleep(500);
 assert.ok(await G(g=>g.players[0].charging&&g.players[0].charge>.25));
 await page.screenshot({path:`${out}/m1-charge.png`});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await until(()=>G(g=>g.players[0].strokes>=1),5000,'release shot');
 report.shot=await G(g=>({strokes:g.players[0].strokes,speed:Math.hypot(g.players[0].ball.vx,g.players[0].ball.vz)}));assert.ok(report.shot.speed>0);
 await G(g=>{const p=g.players[0];Object.assign(p.ball,{x:0,z:11,y:.28,vx:0,vz:0,grounded:true,readyFor:1});});
 await until(()=>phones[0].page.evaluate(()=>!document.querySelector('#golf-shoot')?.disabled),3000,'ready again');
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...button,id:2}]});await sleep(300);
 const strokes=await G(g=>g.players[0].strokes);
 await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await sleep(300);
 assert.equal(await G(g=>g.players[0].strokes),strokes,'touchcancel no shot');
 await G(g=>{const p=g.players[1];p.holeShots=1;p.strokes=1;p.ball.x=g.match.course.hole.x;p.ball.z=g.match.course.hole.z;p.ball.y=.28;p.ball.vx=p.ball.vz=0;});
 await until(()=>G(g=>g.players[1].finished),5000,'actual cup capture');
 report.hole=await G(g=>({finished:g.players[1].finished,total:g.players[1].total,ones:g.players[1].ones}));assert.equal(report.hole.ones,1);
 await page.screenshot({path:`${out}/m1-two-players.png`});
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');
 assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync(`${out}/m1-browser.json`,JSON.stringify(report,null,2));console.log('PASS M1 minigolf two phones, true touch hold/release/cancel, physical cup, count and lobby cleanup.');
}finally{await browser.close();}
