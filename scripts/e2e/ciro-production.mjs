import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
process.env.CTRL_URL=process.env.PROD_CTRL??'http://localhost:3001/controller.html';
const { launch, sleep, addPhone } = await import('./lib.mjs');

const origin=process.env.PROD_HOST??'http://localhost:3001/';
const browser=await launch();
try {
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>requests.push(r.url()));
  const rows=[];
  for(const query of ['', '?characters=1&ciro=new']) {
    requests.length=0;
    await page.goto(origin+query,{waitUntil:'load'});
    await page.waitForSelector('#app canvas',{timeout:30000});
    await sleep(1200);
    const state=await page.evaluate(()=>({gallery:!!window.__gallery,debug:[...document.querySelectorAll('div')].some(d=>d.style.zIndex==='2147483000')}));
    const models=requests.filter(u=>/\.glb(?:\?|$)/.test(u));
    assert.equal(state.gallery,false);assert.equal(state.debug,false);assert.equal(models.length,0);
    rows.push({query,...state,models});
  }
  const context=await browser.createBrowserContext(),host=await context.newPage();
  let state=null;const downloads=[];
  host.on('pageerror',e=>errors.push(String(e)));
  host.on('response',r=>{if(r.url().endsWith('/models/man-tripo/man_animated.glb'))downloads.push({url:r.url(),status:r.status()});});
  const cdp=await host.createCDPSession();await cdp.send('Network.enable');
  cdp.on('Network.webSocketFrameReceived',({response})=>{
    const raw=response.payloadData??'';if(!raw.startsWith('42'))return;
    try{const [event,data]=JSON.parse(raw.slice(2));if(event==='room:state')state=data;}catch{}
  });
  const until=async(fn,what,ms=60000)=>{const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await sleep(120);}throw new Error(`Timeout ${what}`);};
  await host.goto(origin,{waitUntil:'load'});await host.waitForSelector('#app canvas');await sleep(1600);
  await host.keyboard.press('Enter');await until(()=>state?.roomCode,'normal room');
  const ciro=await addPhone(browser,state.roomCode,'Ciro',4),carbo=await addPhone(browser,state.roomCode,'Carbo',3);
  for(const p of [ciro,carbo])p.page.on('pageerror',e=>errors.push(String(e)));
  await until(()=>state.players.length===2&&state.players.every(p=>p.ready),'two ready phones');
  await host.keyboard.press('ArrowLeft');await sleep(180);await host.keyboard.press('Enter');
  await until(()=>state.phase==='MINIGAME_PLAYING'&&state.currentMinigame?.minigameId==='casacarbo','normal Casa Carbo');
  await until(()=>downloads.some(r=>r.status===200),'new Ciro default model');
  await ciro.page.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('CASA CARBO'));
  await sleep(5000);
  await host.screenshot({path:'docs/agent-work/ciro-animation-update/shots/production-casacarbo.png'});
  const normalGame={players:state.players.map(p=>({name:p.displayName,character:p.characterId})),game:state.currentMinigame.minigameId,downloads};
  assert.equal(await host.evaluate(()=>!!window.__casacarbo),false,'no DEV hook in normal production');
  await host.close();
  await page.goto(origin+'?characters=1&ciro=new&goblin=old&judoka=old&buttafuori=old&debug=1',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__gallery?.sample().some(s=>s?.state==='ready'),{timeout:60000});
  const imported=await page.evaluate(()=>window.__gallery.sample().find(s=>s?.state==='ready'));
  assert.equal(imported.clips,59);assert.equal(imported.bones,65);
  const association=await page.evaluate(()=>({
    characters:window.__gallery.sample().filter(Boolean).map(s=>s.character),
    ciroSelector:!!document.querySelector('#ciro-new'),
    dottoreSelector:!!document.querySelector('#dottore-new')
  }));
  assert.deepEqual(association.characters,['ciro']);
  assert.equal(association.ciroSelector,true);assert.equal(association.dottoreSelector,false);
  await page.evaluate(()=>window.__gallery.setCiro('old'));
  await page.waitForFunction(()=>window.__gallery.sample().every(s=>s===null),{timeout:20000});
  await page.evaluate(()=>window.__gallery.setCiro('new'));
  await page.waitForFunction(()=>window.__gallery.sample().some(s=>s?.state==='ready'),{timeout:60000});
  assert.equal(errors.length,0,errors.join(';'));
  writeFileSync('docs/agent-work/ciro-animation-update/production.json',JSON.stringify({origin,rows,normalGame,imported,association,oldNewToggle:true,errors},null,2));
  console.log('Production: normal Casa Carbo with Ciro/Carbo and default new asset HTTP 200; Gallery 65 bones / 59 clips; OLD/NEW works; no page errors: PASS');
} finally {await browser.close();}
