import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
process.env.CTRL_URL=process.env.PROD_CTRL??'http://localhost:3001/controller.html';
const {launch,addPhone,phoneView,sleep}=await import('./lib.mjs');
const origin=process.env.PROD_HOST??'http://localhost:3001/';
const browser=await launch(),report={errors:[],models:[],responses:[]};
try{
 const page=await browser.newPage();let state=null,code=null;
 page.on('pageerror',e=>report.errors.push(`host ${e}`));
 page.on('request',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.models.push(r.url());});
 page.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.responses.push({url:r.url(),status:r.status()});});
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');
 cdp.on('Network.webSocketFrameReceived',({response})=>{
  const raw=response.payloadData??'';if(!raw.startsWith('42'))return;
  try{const [event,payload]=JSON.parse(raw.slice(2));if(event==='room:state'){state=payload;code??=payload.roomCode;}}catch{}
 });
 const until=async(fn,what,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(120);}throw new Error(`Timeout ${what}`);};
 await page.goto(origin,{waitUntil:'load'});await page.waitForSelector('#app canvas');await sleep(1700);
 assert.equal(await page.evaluate(()=>!!window.__gallery),false);
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('div')].some(d=>d.style.zIndex==='2147483000')),false);
 assert.equal(report.models.length,0,'models load on demand, never on the lobby');
 await page.keyboard.press('ArrowRight');await sleep(160);await page.keyboard.press('Enter');
 await until(()=>code,'room code');
 assert.equal(state.playerCount,3);
 const phones=[];
 for(const [name,index] of [['Nicolò',0],['BOSCHI',1],['Carbo',3]]){
  const p=await addPhone(browser,code,name,index);p.page.on('pageerror',e=>report.errors.push(`${name} ${e}`));phones.push(p);
  const labels=await p.page.$$eval('#chars .char',es=>es.map(e=>e.textContent));assert.ok(labels.some(s=>s.includes('BOSCHI'))&&labels.some(s=>s.includes('Carbo')));
 }
 await until(()=>state.players.length===3&&state.players.every(p=>p.ready),'three ready phones');
 await sleep(500);await page.screenshot({path:'docs/agent-work/morning-playtest/production-room-three.png'});
 // Room UI chooses Arena without any debug helper or explicit model selector.
 for(let i=0;i<4;i++){await page.keyboard.press('ArrowRight');await sleep(180);}
 await page.keyboard.press('Enter');await until(()=>state.phase==='MINIGAME_PLAYING','Arena starts');
 await until(()=>report.responses.filter(r=>r.status===200).length>=3,'original models downloaded');
 for(const path of ['/models/goblin-tripo/','/models/detailed-tripo/','/models/judoka-tripo/'])assert.ok(report.responses.some(r=>r.url.includes(path)&&r.status===200),path);
 for(const p of phones)await until(async()=>/ARENA/.test((await phoneView(p.page)).h1|| (await phoneView(p.page)).text),`${p.name} Arena controller`);
 await sleep(3500);await page.screenshot({path:'docs/agent-work/morning-playtest/production-arena-three.png'});
 report.room={code,players:state.players.map(p=>({name:p.displayName,character:p.characterId})),phase:state.phase};
 // Natural game completion proves the packaged scene submits a complete result without injected finish().
 await until(()=>!!state.lastResults&&state.phase!=='MINIGAME_PLAYING','natural Arena results',90000);
 assert.equal(state.lastResults.results.length,3);assert.equal(new Set(state.lastResults.ranking).size,3);
 report.naturalResults=state.lastResults;
 console.log('Production: normal UI, LAN room, BOSCHI/Carbo, three phones, default original GLBs and natural Arena finish: PASS');
 await page.close();
 const ctx=await browser.createBrowserContext(),gallery=await ctx.newPage();
 gallery.on('pageerror',e=>report.errors.push(`gallery ${e}`));
 await gallery.goto(`${origin}?debug=1&characters=1`,{waitUntil:'load'});
 await gallery.waitForFunction(()=>window.__gallery?.sample().filter(s=>s?.state==='ready').length===4,{timeout:60000});
 report.gallery=await gallery.evaluate(()=>window.__gallery.sample().filter(Boolean).map(s=>({character:s.character,bones:s.bones,clips:s.clips})));
 assert.deepEqual(report.gallery.map(s=>s.character).sort(),['buttafuori','ciro','goblin','judoka']);
 assert.ok(report.gallery.every(s=>s.bones===65));
 await gallery.evaluate(()=>{window.__gallery.setGoblin('old');window.__gallery.setJudoka('old');window.__gallery.setButtafuori('old');window.__gallery.setCiro('old');});
 await gallery.waitForFunction(()=>window.__gallery.sample().every(s=>s===null),{timeout:20000});
 await gallery.evaluate(()=>window.__gallery.setCiro('new'));
 await gallery.waitForFunction(()=>window.__gallery.sample().filter(Boolean).length===1&&window.__gallery.sample().find(Boolean)?.character==='ciro'&&window.__gallery.sample().find(Boolean)?.state==='ready',{timeout:30000});
 assert.equal(await gallery.$('#dottore-new'),null);
 assert.equal(report.errors.length,0,report.errors.join('\n'));
 report.oldNew=true;writeFileSync('docs/agent-work/morning-playtest/production.json',JSON.stringify(report,null,2));
 console.log('Production: four correct models, Dottore original, complete OLD/NEW fallback controls, no page errors: PASS');
}finally{await browser.close();}
