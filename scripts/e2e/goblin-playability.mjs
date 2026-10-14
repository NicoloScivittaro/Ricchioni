import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {GoblinGame} from '../../server/goblinTime/core.ts';
import {CARD_BY_ID} from '../../shared/goblinTime/catalog.ts';
process.env.HOST_URL='http://localhost:5176/';process.env.CTRL_URL='http://localhost:5176/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const browser=await launch(),errors=[],out='docs/agent-work/playability-performance';
const until=async(fn,label,ms=60000)=>{const first=Date.now();while(Date.now()-first<ms){if(await fn())return;await sleep(80);}throw Error('Timeout '+label);};
async function wire(page){const c=await page.target().createCDPSession();await c.send('Network.enable');const state={private:null,public:null};c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [e,s]=JSON.parse(response.payloadData.slice(2));if(e==='private:data'&&s.type==='goblinPrivate')state.private=s;if(e==='goblin:public')state.public=s;}catch{}});page.on('pageerror',e=>errors.push(e.message));return state;}
async function answer(page,s){await page.evaluate(s=>{const press=q=>{const e=document.querySelector(q);if(e&&!e.disabled)e.click();};if(s.choice){const c=s.choice,ids=c.kind==='reaction'?['pass']:c.options.slice(0,c.min).map(o=>o.id);for(const id of ids){const b=[...document.querySelectorAll('[data-option]')].find(e=>e.dataset.option===id);if(b&&!b.classList.contains('chosen'))b.click();}press('[data-op=choose]');}else if(s.canDeclare)press('[data-op=declare]');else if(s.canDraw)press('[data-op=draw]');},s);}
try{
 const {page:host,code}=await createRoomOnHost(browser);host.on('pageerror',e=>errors.push(e.message));const hostWire=await wire(host),phones=[];
 for(let i=0;i<2;i++){const p=await addPhone(browser,code,['Niko','Boschi'][i],i);phones.push({page:p.page,state:await wire(p.page)});}
 await hostEval(host,gm=>{gm.selectMinigame('goblinTime');gm.startGame();});await until(()=>hostEval(host,gm=>gm.game.scene.getScenes(true).some(s=>s.scene.key==='goblinTime')),'scena');await host.screenshot({path:`${out}/goblin-rules-tv.png`});await host.mouse.click(890,420);
 await until(()=>phones.every(p=>p.state.private),'mani');await host.screenshot({path:`${out}/goblin-turn-tv.png`});
 assert.equal(hostWire.private,null);assert.ok(hostWire.public.players.every(p=>!('hand'in p)));
 const first=phones.find(p=>p.state.private.canDraw);assert.ok(first);await first.page.click('[data-op=draw]');await until(()=>first.state.private.choice,'prima scelta');const choiceId=first.state.private.choice.id;
 assert.ok(first.state.private.choice.remaining>58);await first.page.screenshot({path:`${out}/goblin-choice-phone.png`,fullPage:true});await host.screenshot({path:`${out}/goblin-choice-tv.png`});
 await sleep(13000);assert.equal(first.state.private.choice?.id,choiceId);assert.ok(first.state.private.choice.remaining>44&&first.state.private.choice.remaining<48);
 await hostEval(host,gm=>gm.setPaused(true));await sleep(250);const before=first.state.private.choice.remaining;await sleep(1000);assert.ok(Math.abs(before-first.state.private.choice.remaining)<.01);await hostEval(host,gm=>gm.setPaused(false));
 await first.page.reload({waitUntil:'load'});await first.page.waitForSelector('.gt-decision');assert.equal(first.state.private.choice.id,choiceId);
 for(const size of [{width:320,height:568,isMobile:true,hasTouch:true},{width:740,height:360,isMobile:true,hasTouch:true},{width:390,height:800,isMobile:true,hasTouch:true}]){
  await first.page.setViewport(size);await sleep(150);assert.equal(await first.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const option=first.state.private.choice.options.find(o=>o.cardId);assert.ok((await first.page.$eval(`[data-option="${option.id}"]`,e=>e.textContent)).includes(CARD_BY_ID[option.cardId].effect));await first.page.screenshot({path:`${out}/goblin-choice-${size.width}.png`,fullPage:true});
 }
 await answer(first.page,first.state.private);
 const started=Date.now();while(Date.now()-started<240000&&hostWire.public.phase!=='finished'){for(const p of phones)if(p.state.private&&!p.state.private.table.paused)await answer(p.page,p.state.private);await sleep(140);}
 assert.equal(hostWire.public.phase,'finished');assert.ok(hostWire.public.winner);assert.equal(hostWire.public.results.length,2);await until(()=>hostEval(host,gm=>gm.state.phase!=='MINIGAME_PLAYING'),'risultati');assert.equal(await host.$('#goblin-avatars'),null);
 // Schermata risposta alimentata dal vero motore puro, con l'interfaccia normale.
 const g=new GoblinGame(50,[{id:'a',name:'Niko',characterId:'goblin'},{id:'b',name:'Boschi',characterId:'buttafuori'}]);g.move('R01',g.player('b').hand);g.run(g.reactions(g.event('Action','a','b')));const fixture=g.privateState('b');
 const preview=await browser.newPage();await preview.goto('http://localhost:5176/controller.html');await preview.setViewport({width:320,height:568,isMobile:true,hasTouch:true});
 await preview.evaluate(async state=>{const {mountGoblin}=await import('/src/controller/goblinTimeController.ts');const root=document.getElementById('app');window.__preview=mountGoblin(root,(_,cb)=>cb({ok:true}));window.__preview.update(state);},fixture);
 assert.match(await preview.$eval('.gt-status',e=>e.textContent),/PUOI RISPONDERE/);assert.match(await preview.$eval('.gt-clock',e=>e.textContent),/1:00/);assert.ok(await preview.$('[data-option=R01] .gt-option-effect'));await preview.screenshot({path:`${out}/goblin-reaction-320.png`,fullPage:true});
 await preview.click('[data-option=pass]');assert.match(await preview.$eval('[data-op=choose]',e=>e.textContent),/LASCIA PASSARE/);
 await preview.evaluate(()=>window.__preview.destroy());assert.equal(await preview.$eval('#app',e=>e.style.overflowY),'');
 assert.deepEqual(errors,[]);writeFileSync(`${out}/goblin-browser.json`,JSON.stringify({naturalWinner:true,mode:'personal',players:2,choiceSurvivesOldTimeout:true,choiceSeconds:60,pause:true,reload:true,mobileWidths:[320,390,740],fullOptionEffects:true,reactionReadable:true,hostPrivacy:true,avatarsCleanup:true,overflowRestored:true,errors},null,2));console.log('GOBLIN: partita naturale, scelta oltre 12s, pausa/reload, effetti completi, risposta e telefoni piccoli OK.');
}finally{await browser.close();}
