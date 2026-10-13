import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
const out='docs/agent-work/goblin-time/browser';mkdirSync(out,{recursive:true});
const browser=await launch();const errors=[],reports=[];
const until=async(fn,label,ms=30000)=>{const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await sleep(100);}throw Error(`Timeout ${label}`);};
async function capture(page){const cdp=await page.target().createCDPSession();await cdp.send('Network.enable');const store={public:null,private:null,hostPrivate:false,packets:0};cdp.on('Network.webSocketFrameReceived',({response})=>{const text=response.payloadData;if(!text.startsWith('42'))return;try{const [event,data]=JSON.parse(text.slice(2));store.packets++;if(event==='goblin:public')store.public=data;if(event==='private:data'&&data?.type==='goblinPrivate')store.private=data;}catch{}});page.on('pageerror',e=>errors.push(e.message));return store;}
async function autopilot(phone,data){
  await phone.evaluate(s=>{
    const button=selector=>document.querySelector(selector);
    const press=selector=>{const b=button(selector);if(b&&!b.disabled)b.click();};
    if(s.choice){const choice=s.choice;let chosen=[];
      if(choice.kind==='reaction')chosen=['pass'];
      else chosen=choice.options.slice(0,choice.min).map(o=>o.id);
      for(const id of chosen){const b=[...document.querySelectorAll('[data-option]')].find(e=>e.dataset.option===id);if(b&&!b.disabled&&!b.classList.contains('chosen'))b.click();}
      press('[data-op=choose]');return;
    }
    if(s.canDeclare){press('[data-op=declare]');return;}
    if(s.canDraw){press('[data-op=draw]');return;}
    if(s.playable.length){const id=s.playable[0];const c=[...document.querySelectorAll('[data-card]')].find(e=>e.dataset.card===id);if(c&&!c.classList.contains('selected'))c.click();press('[data-op=play]');return;}
    if(s.armable.length){const id=s.armable[0];const c=[...document.querySelectorAll('[data-card]')].find(e=>e.dataset.card===id);if(c&&!c.classList.contains('selected'))c.click();press('[data-op=arm]');}
  },data);
}
try {
  for(const {n,h,tag} of [{n:2,h:2,tag:'2p'},{n:3,h:3,tag:'3p'},{n:4,h:4,tag:'4p'},{n:5,h:5,tag:'5p'},{n:5,h:1,tag:'solo-5p'}]){
    const {page:host,code}=await createRoomOnHost(browser,{targetKeyPresses:n-2});const hostMessages=await capture(host);const phones=[];
    for(let i=0;i<h;i++){const p=await addPhone(browser,code,`TEST ${i+1}`,i);phones.push({page:p.page,store:await capture(p.page)});}
    await hostEval(host,gm=>{gm.selectMinigame('goblinTime');gm.startGame();});
    await until(()=>hostEval(host,gm=>gm.game.scene.getScenes(true).some(s=>s.scene.key==='goblinTime')),'scena');
    await host.mouse.click(n%2?890:390,420);
    await until(()=>!!hostMessages.public,'motore',45000);
    await until(()=>phones.every(p=>p.store.private?.hand.length===2),'mani iniziali');
    const initialCards=phones.flatMap(p=>p.store.private.hand);assert.equal(new Set(initialCards).size,h*2);
    assert.equal(hostMessages.private,null,'TV senza dati privati');
    for(const p of hostMessages.public.players)assert.ok(!('hand'in p));
    for(const p of phones)assert.equal(await p.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'telefono senza overflow');
    const privateBefore=phones[0].store.private;await hostEval(host,gm=>gm.setPaused(true));await sleep(300);const clock=hostMessages.public.remaining;await sleep(900);assert.ok(Math.abs(hostMessages.public.remaining-clock)<.15,'clock in pausa');await hostEval(host,gm=>gm.setPaused(false));
    await phones[0].page.reload({waitUntil:'load'});await until(()=>phones[0].store.private&&phones[0].store.private.matchId===privateBefore.matchId&&!!phones[0].page.url(),'riconnessione');await sleep(800);assert.deepEqual(phones[0].store.private.hand,privateBefore.hand,'riconnessione conserva mano');
    await host.screenshot({path:`${out}/${tag}-tv.png`});await phones[0].page.click('.gt-card');await phones[0].page.screenshot({path:`${out}/${tag}-phone.png`,fullPage:true});
    const started=Date.now();let actions=0;
    while(hostMessages.public?.phase!=='finished'&&Date.now()-started<450000){
      for(const p of phones)if(p.store.private&&p.store.private.table.phase!=='finished'){await autopilot(p.page,p.store.private);actions++;}
      await sleep(140);
    }
    assert.equal(hostMessages.public?.phase,'finished','partita naturale conclusa');
    assert.equal(hostMessages.public.results.length,n);assert.equal(hostMessages.public.players.length,n);assert.equal(hostMessages.private,null);
    await host.screenshot({path:`${out}/${tag}-finish.png`});
    await until(async()=>{const s=await hostSnapshot(host);return s.phase!=='MINIGAME_PLAYING';},'risultati server');
    assert.equal(await host.evaluate(()=>document.querySelectorAll('#goblin-avatars').length),0,'canvas 3D rimosso');const room=await hostEval(host,gm=>gm.state);assert.ok(room.players.some(p=>p.score>0),'ScoreManager applicato');
    reports.push({players:n,humans:h,bots:n-h,mode:hostMessages.public.mode,endReason:hostMessages.public.endReason,winner:hostMessages.public.winner,wallSeconds:+((Date.now()-started)/1000).toFixed(1),turns:hostMessages.public.turnNumber,actions,privacy:true,pause:true,reconnect:true,mobileOverflow:false,phase:room.phase});
    console.log(`GOBLIN ${n}p: ${hostMessages.public.endReason}, ${hostMessages.public.turnNumber} turni, privacy/pausa/reconnect OK`);
    writeFileSync(`${out}/results.json`,JSON.stringify({reports,errors},null,2));await hostEval(host,gm=>gm.restartMatch());await host.evaluate(()=>localStorage.clear());for(const p of phones)await p.page.close();await host.close();
  }
  assert.deepEqual(errors,[]);writeFileSync(`${out}/results.json`,JSON.stringify({reports,errors},null,2));
}finally{await browser.close();}
