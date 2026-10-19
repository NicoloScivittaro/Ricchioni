import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?debug=1';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {installMock,add,XBOX,tap,btn}=await import('./padmock.mjs');
const browser=await launch(),out='docs/agent-work/map-voting',checks=[],errors=[],cases=[];
const ok=(b,label)=>{assert.ok(b,label);checks.push(label);console.log('PASS',label);};
const until=async(fn,label,ms=45000)=>{const t=Date.now();while(!await fn()){if(Date.now()-t>ms)throw Error('Timeout '+label);await sleep(100);}};
const state=p=>hostEval(p,g=>g.state);
async function vote(phone,map){await phone.page.click(`[data-map-id="${map}"]`);await phone.page.waitForFunction(id=>document.querySelector(`[data-map-id="${id}"]`)?.getAttribute('aria-pressed')==='true',{},map);}
async function gameData(page,game){return hostEval(page,(gm,id)=>{const g=gm.game.scene.getScene(id)?.game3d;if(!g)return null;return {ctxMap:gm.minigameContext?.mapId,map:g.rainbow?'arcobaleno':id==='kart3d'?'litorale':id==='backrooms'?g.match.level.id:g.match.courses[0].id,courses:g.match?.courses?.map(c=>c.id),phase:g.phase??g.race?.phase??g.match?.phase};},game);}
try{
 for(const config of [
  {game:'kart3d',n:2,map:'arcobaleno',pad:true},
  {game:'backrooms',n:3,map:'garage',reconnect:true},
  {game:'minigolf',n:5,map:'odissea'},
  {game:'kart3d',n:1,seats:5,map:'litorale'},
  {game:'backrooms',n:2,map:'lobby'},
  {game:'backrooms',n:2,map:'tunnels'}
 ]){
  const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:(config.seats??config.n)-2});
  await page.keyboard.press('F3');
  page.on('pageerror',e=>errors.push('host '+e.message));page.on('console',m=>{if(m.type()==='error'&&/\[minigioco\]|TypeError|ReferenceError/.test(m.text()))errors.push(m.text());});
  const phones=[];for(let i=0;i<config.n;i++){const p=await addPhone(browser,code,`P${i+1}`,i);p.page.on('pageerror',e=>errors.push('phone '+e.message));phones.push(p);}
  const ids=(await state(page)).players.map(p=>p.id);
  if(config.pad){await installMock(page);await add(page,0,XBOX);await sleep(200);ok(await page.evaluate(id=>window.__pads.assign(0,id),ids[0]),'pad paired for ballot');}
  await hostEval(page,(gm,c)=>gm.selectMinigame(c.game,c.game==='kart3d'?'arcobaleno':undefined),config);await sleep(150);await hostEval(page,gm=>gm.startGame());
  await until(async()=> (await state(page))?.phase==='MINIGAME_ROULETTE','roulette');await hostEval(page,gm=>gm.skip());
  await until(async()=> (await state(page))?.phase==='MINIGAME_MAP_VOTE','ballot');
  await phones[0].page.waitForSelector('[data-map-id]');
  ok((await hostEval(page,gm=>gm.activeSceneKeys())).join()==='MapVoteScene',`${config.game}/${config.n}: dedicated vote scene`);
  ok(await page.evaluate(()=>document.querySelectorAll('canvas').length===1),`${config.game}/${config.n}: game not booted during ballot`);
  if(config.pad){
    await tap(page,0,'RIGHT',150);await tap(page,0,'A',150);
    await until(async()=> (await state(page)).mapVote?.votes[ids[0]]==='arcobaleno','pad vote');
    ok(await page.evaluate(()=>document.getElementById('pad-root')?.style.display==='none'),'pairing panel cannot cover the ballot');
    await phones[0].page.evaluateOnNewDocument(()=>{const original=Date.now;Date.now=()=>original()+120000;});
    await phones[0].page.reload({waitUntil:'load'});await phones[0].page.waitForSelector('[data-map-id="arcobaleno"][aria-pressed="true"]');
    ok(true,'physical pad route navigates and confirms its own ballot');
    ok(await hostEval(page,(gm,id)=>!gm.input.get(id).peekPressed('drift'),ids[0]),'vote confirm does not enter gameplay');
    await vote(phones[0],'litorale');await vote(phones[0],'arcobaleno');ok(true,'phone clock two minutes ahead still permits voting');ok(true,'phone changes ballot even with paired pad');
  }
  for(const phone of phones)await vote(phone,config.map);
  const before=await state(page),deadline=before.mapVote.endsAt;
  ok(Object.keys(before.mapVote.votes).length===config.n,`${config.game}/${config.n}: humans counted once, bots abstain`);
  if(config.reconnect){
    await phones[0].page.reload({waitUntil:'load'});await phones[0].page.waitForSelector(`[data-map-id="${config.map}"][aria-pressed="true"]`);
    ok(true,'phone reload keeps identity and selected ballot');
    await page.reload({waitUntil:'load'});await until(async()=> (await state(page))?.phase==='MINIGAME_MAP_VOTE','host reconnect');
    await page.keyboard.press('F3');
    ok((await state(page)).mapVote.endsAt===deadline,'host reload restores ballot without extending timer');
  }
  if(config.game==='minigolf'){
    const ph=phones[0].page;
    for(const [width,height] of [[320,568],[844,390]]){
      await ph.setViewport({width,height,isMobile:true,hasTouch:true});
      const layout=await ph.evaluate(()=>{const root=document.querySelector('.map-vote-screen');root.scrollTop=root.scrollHeight;const last=document.querySelector('[data-map-id="disperati"]').getBoundingClientRect(),clock=document.querySelector('#map-vote-clock').getBoundingClientRect();const bottom=last.bottom<=innerHeight&&last.top>=0&&clock.top>=0&&clock.bottom<innerHeight;root.scrollTop=0;const first=document.querySelector('[data-map-id="lungomare"]').getBoundingClientRect();return {bottom,top:first.top>0,scrollable:root.scrollHeight>root.clientHeight};});
      ok(layout.bottom&&layout.top&&layout.scrollable,`phone ${width}x${height}: all ten choices reachable, countdown stays visible`);
      await ph.screenshot({path:`${out}/minigolf-phone-${width}.png`});
    }
    await ph.setViewport({width:390,height:800,isMobile:true,hasTouch:true});await ph.$eval('.map-vote-screen',e=>e.scrollTop=0);
  }
  await page.screenshot({path:`${out}/${config.game}-${config.n}-${config.map}-vote.png`});
  await phones[0].page.screenshot({path:`${out}/${config.game}-${config.n}-${config.map}-phone.png`,fullPage:true});
  await until(async()=> (await state(page))?.phase==='MINIGAME_INTRO','deadline -> intro');
  const intro=await state(page);ok(intro.currentMinigame.mapId===config.map,`${config.game}/${config.n}: winning map in intro`);
  ok(await phones[0].page.$('[data-map-id]')===null,'phone ballot removed at intro');
  await page.screenshot({path:`${out}/${config.game}-${config.n}-${config.map}-intro.png`});
  await until(async()=>{const d=await gameData(page,config.game);return d?.map===config.map;},'actual selected map',90000);
  const data=await gameData(page,config.game);
  ok(data.map===config.map&&data.ctxMap===config.map,`${config.game}/${config.n}: actual game uses winning map`);
  if(config.game==='minigolf')ok(data.courses.length===3&&new Set(data.courses).size===3,'golf preserves three different holes');
  await sleep(650);await page.screenshot({path:`${out}/${config.game}-${config.n}-${config.map}-playing.png`});
  cases.push({...config,data});
  await hostEval(page,gm=>gm.restartMatch());await until(async()=> (await state(page))?.phase==='LOBBY','lobby cleanup');
  ok(await page.evaluate(()=>document.querySelectorAll('canvas').length===1),`${config.game}/${config.n}: cleanup leaves one canvas`);
  await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const phone of phones)await phone.ctx.close();await page.close();
 }
 ok(errors.length===0,'no browser runtime errors');
}finally{writeFileSync(`${out}/browser-checks.json`,JSON.stringify({checks,errors,cases},null,2));await browser.close();}
