import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:3004/';process.env.CTRL_URL='http://localhost:3004/controller.html';
const {launch,addPhone,sleep,HOST_URL}=await import('./lib.mjs');
const browser=await launch();
try{
 const page=await browser.newPage(),wire={room:null};const c=await page.target().createCDPSession();await c.send('Network.enable');c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [e,d]=JSON.parse(response.payloadData.slice(2));if(e==='room:state')wire.room=d;}catch{}});
 const until=async(fn,label)=>{const t=Date.now();while(Date.now()-t<60000){if(await fn())return;await sleep(100);}throw Error('Timeout '+label);};
 await page.goto(HOST_URL,{waitUntil:'load'});await page.waitForSelector('canvas');await sleep(1000);await page.keyboard.press('Enter');await until(()=>wire.room?.roomCode,'stanza');
 await addPhone(browser,wire.room.roomCode,'FPS GOBLIN',0);await addPhone(browser,wire.room.roomCode,'FPS BOSCHI',1);
 for(let i=0;i<17;i++){await page.keyboard.press('ArrowRight');await sleep(120);}await until(()=>wire.room?.selectedMinigameId==='trentuno','selezione');await page.keyboard.press('Enter');await until(()=>wire.room?.phase==='MINIGAME_PLAYING','gioco');await sleep(3000);
 const samples=[];
 for(const enabled of [false,true,true,false,false,true]){
  await page.keyboard.press('v');await page.waitForSelector('[data-nar=enabled]');await page.$eval('[data-nar=enabled]',(e,on)=>{e.checked=on;e.dispatchEvent(new Event('change',{bubbles:true}));},enabled);await page.keyboard.press('v');await sleep(200);
  const metrics=await page.evaluate(async()=>{const frames=[];await new Promise(resolve=>{const first=performance.now();const step=t=>{frames.push(t);if(t-first<2500)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});const deltas=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);return{fps:+((frames.length-1)*1000/(frames.at(-1)-frames[0])).toFixed(2),p95FrameMs:+deltas[Math.floor(deltas.length*.95)].toFixed(2)};});
  assert.equal(await page.$('#narrator-subtitles'),null);samples.push({narrator:enabled,...metrics});
 }
 const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
 const off=median(samples.filter(s=>!s.narrator).map(s=>s.fps)),on=median(samples.filter(s=>s.narrator).map(s=>s.fps)),ratio=on/off;
 const report={compiled:true,game:'trentuno',players:2,pairedComparison:true,samples,medianOffFps:off,medianOnFps:on,onOffRatio:ratio,noRegressionWithin3Percent:ratio>=.97};writeFileSync('docs/agent-work/narrator/performance-tests.json',JSON.stringify(report,null,2));assert.ok(ratio>=.97,'calo FPS oltre 3% nel confronto sullo stesso host');
 console.log(`NARRATORE FPS: OFF ${off}, ON ${on}; rapporto ${ratio.toFixed(3)}.`);
}finally{await browser.close();}
