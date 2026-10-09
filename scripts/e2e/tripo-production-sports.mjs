import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
process.env.CTRL_URL='http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const {MINIGAME_DEFINITIONS}=await import('../../shared/minigames.ts');
const origin='http://127.0.0.1:3001/',browser=await launch(),report={games:[],errors:[]};
const paths=['/models/goblin-tripo/green_goblin_casacarbo.glb','/models/detailed-tripo/detailed_character_casacarbo.glb','/models/judoka-tripo/judo_figure_casacarbo.glb','/models/man-tripo/man_animated.glb'];
try {
 for(const id of (process.env.SEQ??'soccer,volleyball,kart3d').split(',')){
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage(),downloads=[];let state=null;
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(paths.some(p=>r.url().endsWith(p)))downloads.push({url:r.url(),status:r.status()});});
  const cdp=await page.createCDPSession();await cdp.send('Network.enable');cdp.on('Network.webSocketFrameReceived',({response})=>{try{if(response.payloadData.startsWith('42')){const [event,data]=JSON.parse(response.payloadData.slice(2));if(event==='room:state')state=data;}}catch{}});
  const until=async(fn,what,ms=60000)=>{const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await sleep(150);}throw new Error(`Timeout ${what}`);};
  await page.evaluateOnNewDocument(()=>{for(const ns of ['goblin','buttafuori','judoka','ciro'])sessionStorage.setItem(`ricchioni.${ns}Visual`,'old');});
  await page.goto(origin,{waitUntil:'load'});await page.waitForSelector('#app canvas');await sleep(1600);assert.equal(downloads.length,0);
  for(let i=0;i<2;i++){await page.keyboard.press('ArrowRight');await sleep(160);}await page.keyboard.press('Enter');await until(()=>state?.roomCode,'room');
  const phones=[];for(const [name,index] of [['Goblin',0],['BOSCHI',1],['Carbo',3],['Ciro',4]]){const p=await addPhone(browser,state.roomCode,name,index);p.page.on('pageerror',e=>report.errors.push(String(e)));if(id==='fps')p.page.on('response',r=>{if(paths.some(path=>r.url().endsWith(path)))downloads.push({url:r.url(),status:r.status()});});phones.push(p);}
  await until(()=>state.players.length===4&&state.players.every(p=>p.ready),'four phones');
  const options=[null,...MINIGAME_DEFINITIONS.filter(d=>d.enabled!==false&&4>=d.minPlayers&&4<=d.maxPlayers).map(d=>d.id)];
  for(let i=0;i<options.indexOf(id);i++){await page.keyboard.press('ArrowRight');await sleep(160);}await until(()=>state.selectedMinigameId===id,'selected game');await page.keyboard.press('Enter');
  await until(()=>state.phase==='MINIGAME_PLAYING'&&state.currentMinigame?.minigameId===id,'game');await until(()=>paths.every(p=>downloads.some(d=>d.url.endsWith(p)&&d.status===200)),'four Tripo GLBs');
  await sleep(5500);await (id==='fps'?phones[0].page:page).screenshot({path:`docs/agent-work/general-polish/shots/production-${id}.png`});
  assert.equal(await page.evaluate(()=>!!window.__gallery),false);report.games.push({id,characters:state.players.map(p=>p.characterId),downloads});console.log(`${id}: normal production, four phones, stored OLD ignored, four original assets HTTP 200: PASS`);
  for(const p of phones)await p.ctx.close();await ctx.close();
 }
 report.hashes=[];for(const path of paths){const r=await fetch(origin+path.slice(1));assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer()),sha=createHash('sha256').update(bytes).digest('hex');assert.equal(sha,createHash('sha256').update(readFileSync(`public${path}`)).digest('hex'));report.hashes.push({path,bytes:bytes.length,sha});}
 assert.deepEqual(report.errors,[]);writeFileSync(`docs/agent-work/general-polish/production-${process.env.SEQ==='fps'?'fps':'sports'}.json`,JSON.stringify(report,null,2));
}finally{await browser.close();}
