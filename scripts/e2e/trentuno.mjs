import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
process.env.HOST_URL=process.env.HOST_URL??'http://localhost:5175/';process.env.CTRL_URL=process.env.CTRL_URL??'http://localhost:5175/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const prod=process.env.T31_PROD==='1',base=process.env.HOST_URL,out=`docs/agent-work/trentuno/${prod?'production':'browser'}`;mkdirSync(out,{recursive:true});
const browser=await launch(),errors=[],reports=[];
const until=async(fn,label,ms=50000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(100);}throw Error('Timeout '+label);};
async function capture(page){const cdp=await page.target().createCDPSession();await cdp.send('Network.enable');const store={pub:null,priv:null,room:null};cdp.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [event,data]=JSON.parse(response.payloadData.slice(2));if(event==='trentuno:public')store.pub=data;if(event==='private:data'&&data?.type==='trentunoPrivate')store.priv=data;if(event==='room:state')store.room=data;}catch{}});page.on('pageerror',e=>errors.push(e.message));return store;}
const value=id=>id.endsWith('-A')?11:/-[FCR]$/.test(id)?10:Number(id.split('-')[1]);
const score=hand=>Math.max(...['DENARI','COPPE','SPADE','BASTONI'].map(s=>hand.filter(id=>id.startsWith(s+'-')).reduce((sum,id)=>sum+value(id),0)));
const best=(hand,legal=hand)=>legal.slice().sort((a,b)=>score(hand.filter(id=>id!==b))-score(hand.filter(id=>id!==a))||value(a)-value(b))[0];
async function autopilot(page,s){
 const me=s.table.players.find(p=>p.id===s.playerId),top=s.table.discardTop,withTop=[...s.hand,top],take=s.canTake&&score(withTop.filter(c=>c!==best(withTop,withTop.filter(c=>c!==top))))>s.score;
 const drop=best(s.hand,s.discardable),gift=best(s.hand),target=s.table.players.find(p=>p.id!==s.playerId)?.id;
 const reverse=s.peek.length===2&&score([...s.hand,s.peek[1]].filter(c=>c!==best([...s.hand,s.peek[1]])))>score([...s.hand,s.peek[0]].filter(c=>c!==best([...s.hand,s.peek[0]])));
 await page.evaluate(({s,char,drop,gift,target,take,reverse})=>{
  const press=q=>{const b=document.querySelector(q);if(b&&!b.disabled)b.click();};
  const choose=id=>{const b=[...document.querySelectorAll('[data-card]')].find(b=>b.dataset.card===id);if(b&&!b.classList.contains('selected'))b.click();};
  if(s.table.paused||s.table.phase==='finished'||s.table.phase==='handResult')return;
  if(s.ability.available){if(char==='ciro'){choose(gift);const select=document.querySelector('[data-target]');if(select){select.value=target;select.dispatchEvent(new Event('change',{bubbles:true}));}}press('[data-op=ability]');return;}
  if(s.peek.length){press(`[data-op=order][data-reverse=${reverse}]`);return;}
  if(s.discardable.length){choose(drop);press('[data-op=discard]');return;}
  if(s.canKnock&&s.score>=25){press('[data-op=knock]');return;}
  if(s.canDraw)press(take?'[data-op=take]':'[data-op=draw]');
 },{s,char:me.characterId,drop,gift,target,take,reverse});
}
try{
 const atlas=await browser.newPage();await atlas.setViewport({width:1500,height:1200});await atlas.goto(base+'trentuno/atlas.html',{waitUntil:'networkidle0'});assert.equal(await atlas.$$eval('section img',imgs=>imgs.filter(i=>i.complete&&i.naturalWidth>0).length),40);await atlas.screenshot({path:`${out}/mazzo-40.png`,fullPage:true});await atlas.close();
 for(const {n,h,tag} of (prod?[{n:2,h:2,tag:'2p'},{n:5,h:1,tag:'solo-5p'}]:[{n:2,h:2,tag:'2p'},{n:3,h:3,tag:'3p'},{n:4,h:4,tag:'4p'},{n:5,h:5,tag:'5p'},{n:5,h:1,tag:'solo-5p'}])){
  let host,code,wire;
  if(prod){host=await browser.newPage();wire=await capture(host);await host.goto(base,{waitUntil:'load'});await host.waitForSelector('canvas');await sleep(1000);for(let i=2;i<n;i++){await host.keyboard.press('ArrowRight');await sleep(150);}await host.keyboard.press('Enter');await until(()=>wire.room?.roomCode,'stanza');code=wire.room.roomCode;}
  else {({page:host,code}=await createRoomOnHost(browser,{targetKeyPresses:n-2}));wire=await capture(host);}
  const phones=[];for(let i=0;i<h;i++){const p=await addPhone(browser,code,['Nicolò','Boschi','Victor','Carbo','Ciro'][i],i);phones.push({page:p.page,wire:await capture(p.page)});await p.page.evaluateOnNewDocument(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true}));}
  if(prod){for(let i=0;i<17;i++){await host.keyboard.press('ArrowRight');await sleep(120);}await until(()=>wire.room.selectedMinigameId==='trentuno','selezione');await host.keyboard.press('Enter');}else await hostEval(host,gm=>{gm.selectMinigame('trentuno');gm.startGame();});
  await until(()=>wire.pub&&phones.every(p=>p.wire.priv),'tavolo e mani');assert.equal(wire.priv,null);assert.equal(wire.pub.players.length,n);assert.equal(new Set(phones.flatMap(p=>p.wire.priv.hand)).size,h*3);assert.ok(wire.pub.players.every(p=>!('hand' in p)));
  const pause=async on=>{if(prod)await host.keyboard.press('Escape');else await hostEval(host,(gm,on)=>gm.setPaused(on),on);await until(()=>wire.pub.paused===on,'pausa');};
  await pause(true);await sleep(300);const remaining=wire.pub.remaining;await sleep(1000);assert.ok(Math.abs(wire.pub.remaining-remaining)<.1);
  const handBefore=phones[0].wire.priv.hand.slice();await phones[0].page.reload({waitUntil:'load'});await until(()=>phones[0].page.$('.t31-hand'),'riconnessione');assert.deepEqual(phones[0].wire.priv.hand,handBefore);await pause(false);
  for(const size of [{width:320,height:568,isMobile:true,hasTouch:true},{width:740,height:360,isMobile:true,hasTouch:true},{width:390,height:800,isMobile:true,hasTouch:true}]){await phones[0].page.setViewport(size);await sleep(100);assert.equal(await phones[0].page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(size.width!==390)await phones[0].page.screenshot({path:`${out}/${tag}-phone-${size.width}.png`,fullPage:true});}
  await host.screenshot({path:`${out}/${tag}-tv.png`});await phones[0].page.screenshot({path:`${out}/${tag}-phone.png`,fullPage:true});
  const performanceData=await host.evaluate(async()=>{const stamps=[];await new Promise(resolve=>{const first=performance.now();const frame=t=>{stamps.push(t);if(t-first<2500)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});const durations=stamps.slice(1).map((t,i)=>t-stamps[i]).sort((a,b)=>a-b);const c=document.querySelector('canvas'),gl=c.getContext('webgl2')??c.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return{fps:+((stamps.length-1)*1000/(stamps.at(-1)-stamps[0])).toFixed(1),p95FrameMs:+durations[Math.floor(durations.length*.95)].toFixed(2),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'Canvas',canvases:document.querySelectorAll('canvas').length};});
  const started=Date.now();let screenshot4=false;while(wire.pub?.phase!=='finished'&&Date.now()-started<400000){for(const p of phones)if(p.wire.priv)await autopilot(p.page,p.wire.priv);if(!screenshot4&&phones[0].wire.priv?.hand.length===4){await phones[0].page.screenshot({path:`${out}/${tag}-phone-discard.png`,fullPage:true});screenshot4=true;}await sleep(170);}
  assert.equal(wire.pub.phase,'finished');assert.equal(wire.pub.history.length,3);assert.equal(wire.pub.results.length,n);assert.equal(wire.priv,null);await sleep(650);await host.screenshot({path:`${out}/${tag}-finish.png`});await until(()=>wire.room.phase!=='MINIGAME_PLAYING','ScoreManager');assert.ok(wire.room.players.some(p=>p.score>0));
  if(!prod){const resources=await hostEval(host,gm=>({textures:gm.game.textures.getTextureKeys().filter(k=>k.startsWith('t31-')).length,active:gm.game.scene.getScenes(true).map(s=>s.scene.key)}));assert.equal(resources.textures,0);assert.ok(!resources.active.includes('trentuno'));await hostEval(host,gm=>gm.restartMatch());await until(()=>wire.room.phase==='LOBBY','ritorno lobby');}
  reports.push({players:n,humans:h,bots:n-h,compiled:prod,privacy:true,reconnect:true,pause:true,smallPortraitAndLandscape:true,threeNaturalHands:true,handReasons:wire.pub.history.map(h=>h.reason),abilitiesUsed:wire.pub.players.filter(p=>p.abilityUsed).map(p=>p.characterId),performance:performanceData,wallSeconds:+((Date.now()-started)/1000).toFixed(1),lobby:!prod,resourcesDisposed:!prod});console.log(`TRENTUNO ${tag}: 3 mani, ${performanceData.fps} FPS, privacy e reconnect OK`);writeFileSync(`${out}/results.json`,JSON.stringify({reports,errors},null,2));
  await host.evaluate(()=>localStorage.clear());for(const p of phones)await p.page.close();await host.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
