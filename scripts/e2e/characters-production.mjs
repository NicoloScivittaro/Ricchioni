import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
process.env.CTRL_URL=process.env.PROD_CTRL??'http://localhost:3001/controller.html';
const {launch,sleep,addPhone}=await import('./lib.mjs');
const origin=process.env.PROD_HOST??'http://localhost:3001/',out='docs/agent-work/characters-animation-update';
const browser=await launch();
const paths=['/models/detailed-tripo/detailed_character_casacarbo.glb','/models/goblin-tripo/green_goblin_casacarbo.glb','/models/judoka-tripo/judo_figure_casacarbo.glb','/models/man-tripo/man_animated.glb'];
try {
  const errors=[],downloads=[],page=await browser.newPage();
  let state=null;
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(paths.some(p=>r.url().endsWith(p)))downloads.push({url:r.url(),status:r.status()});});
  const cdp=await page.createCDPSession();await cdp.send('Network.enable');
  cdp.on('Network.webSocketFrameReceived',({response})=>{
    const raw=response.payloadData??'';if(!raw.startsWith('42'))return;
    try{const [event,data]=JSON.parse(raw.slice(2));if(event==='room:state')state=data;}catch{}
  });
  const until=async(fn,what,ms=60000)=>{const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await sleep(120);}throw new Error(`Timeout ${what}`);};
  await page.goto(origin,{waitUntil:'load'});await page.waitForSelector('#app canvas');await sleep(1600);
  assert.equal(downloads.length,0,'lobby does not eagerly fetch character assets');
  for(let i=0;i<2;i++){await page.keyboard.press('ArrowRight');await sleep(150);}
  await page.keyboard.press('Enter');await until(()=>state?.roomCode,'normal room');
  const phones=[];
  for(const [name,index] of [['Goblin',0],['BOSCHI',1],['Carbo',3],['Ciro',4]]) {
    const phone=await addPhone(browser,state.roomCode,name,index);phones.push(phone);
    phone.page.on('pageerror',e=>errors.push(String(e)));
  }
  await until(()=>state.players.length===4&&state.players.every(p=>p.ready),'four ready phones');
  await page.keyboard.press('ArrowLeft');await sleep(180);await page.keyboard.press('Enter');
  await until(()=>state.phase==='MINIGAME_PLAYING'&&state.currentMinigame?.minigameId==='casacarbo','normal Casa Carbo');
  await until(()=>paths.every(p=>downloads.some(r=>r.url.endsWith(p)&&r.status===200)),'four current assets HTTP 200');
  for(const ph of phones)await ph.page.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('CASA CARBO'));
  await sleep(5000);
  await page.screenshot({path:`${out}/shots/production-casacarbo.png`});
  assert.equal(await page.evaluate(()=>!!window.__casacarbo),false,'normal production exposes no DEV hook');
  const normalGame={players:state.players.map(p=>({name:p.displayName,character:p.characterId})),game:state.currentMinigame.minigameId,downloads};
  await page.goto(origin+'?characters=1&goblin=new&judoka=new&buttafuori=new&ciro=new&debug=1',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__gallery?.sample().filter(s=>s?.state==='ready').length===4,{timeout:60000});
  const imported=await page.evaluate(()=>window.__gallery.sample().filter(Boolean));
  assert.deepEqual(imported.map(d=>[d.character,d.clips]).sort(),[['goblin',52],['buttafuori',54],['judoka',49],['ciro',59]].sort());
  assert.ok(imported.every(d=>d.bones===65));assert.equal(await page.$('#dottore-new'),null);
  const hashes=[];
  for(const path of paths) {
    const response=await fetch(origin+path.slice(1));assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer()),sha256=createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256,createHash('sha256').update(readFileSync(`public${path}`)).digest('hex'),'served original matches public asset');
    hashes.push({path,bytes:bytes.length,sha256});
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/production.json`,JSON.stringify({origin,normalGame,imported,hashes,errors},null,2));
  console.log('PASS: normal production Casa Carbo, four phones and current original GLBs HTTP 200; Gallery 52/54/49/59 clips and correct characters; served SHA256 matches originals; no page errors');
}finally{await browser.close();}
