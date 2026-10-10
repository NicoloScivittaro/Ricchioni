import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL=process.env.PROD_CTRL??'http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),report={errors:[],accelerated:false};
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await sleep(100);}throw Error(`Timeout ${what}`);};
async function observe(page,callback){page.on('pageerror',e=>report.errors.push(String(e)));const c=await page.createCDPSession();await c.send('Network.enable');c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{callback(...JSON.parse(response.payloadData.slice(2)));}catch{}});}
try{
 const host=await browser.newPage();let state;
 await observe(host,(event,data)=>{if(event==='room:state')state=data;});
 await host.goto(process.env.PROD_HOST??'http://127.0.0.1:3001/',{waitUntil:'load'});await host.waitForSelector('#app canvas');await sleep(1500);
 for(let i=0;i<3;i++){await host.keyboard.press('ArrowRight');await sleep(180);}await host.keyboard.press('Enter');await until(()=>state?.roomCode,'stanza');
 const phone=await addPhone(browser,state.roomCode,'Niko',0);report.throwSignals=[];await observe(phone.page,(event,data)=>{if(event==='controller:signal'&&data.type==='objectThrowStatus'&&report.throwSignals.length<60&&(data.charge!==null||data.cooldown>0))report.throwSignals.push(data);});
 await until(()=>state.players.length===1&&state.players[0].ready,'pronto');
 for(let i=0;i<11;i++){await host.keyboard.press('ArrowRight');await sleep(180);}await host.keyboard.press('Enter');
 await until(()=>state.phase==='MINIGAME_PLAYING'&&state.currentMinigame?.minigameId==='cornicione','Cornicione');
 assert.equal(state.players.length,5);assert.equal(state.players.filter(p=>p.bot).length,4);report.players=state.players.map(p=>({id:p.id,bot:!!p.bot,character:p.characterId}));
 await phone.page.waitForSelector('.ctl-throw');await sleep(10000);
 const pointer=async(control,kind,id)=>phone.page.evaluate((control,kind,id)=>document.querySelector(`.ctl-${control}`)?.dispatchEvent(new PointerEvent(kind,{bubbles:true,pointerId:id})),control,kind,id);
 // A real opponent can interrupt charging. Retry genuine gestures, using jump to make space.
 let thrown=false;
 for(let attempt=0;attempt<12&&!thrown;attempt++) {
   await pointer('jump','pointerdown',7);await sleep(180);
   await pointer('throw','pointerdown',8);await sleep(350);await pointer('throw','pointerup',8);
   await pointer('jump','pointerup',7);await sleep(450);
   thrown=report.throwSignals.some(s=>s.cooldown>0);
   if(!thrown)await sleep(650);
 }
 assert.ok(report.throwSignals.some(s=>s.charge!==null&&s.charge>.1),'genuine live charge');
 assert.ok(thrown,'real release creates projectile and six-second cooldown');report.throw=true;
 console.log('PASS: production phone charge/release and cooldown acknowledged by the running game');
 report.throwSignals=report.throwSignals.filter(s=>s.charge!==null||s.cooldown>0).slice(0,30);
 await phone.page.evaluate(()=>document.querySelector('.ctl-kick').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7})));
 await sleep(4000);await host.screenshot({path:'docs/agent-work/cornicione-throws/fighter-production.png'});
 await phone.page.evaluate(()=>document.querySelector('.ctl-kick').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7})));
 await until(()=>state.phase==='ROUND_RESULTS'||state.phase==='MATCH_END','gara naturale',240000);
 const results=state.lastResults.results;assert.equal(results.length,5);assert.ok(results.every(r=>r.placement>=1&&r.placement<=5),'classifica completa');
 assert.deepEqual(report.errors,[]);report.results=results;
 report.assets=await host.evaluate(()=>performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname).filter(p=>/\/assets\/(BabylonCornicioneGame|main)-/.test(p)));
 writeFileSync('docs/agent-work/cornicione-throws/fighter-production.json',JSON.stringify(report,null,2));
 console.log('PASS produzione Cornicione: 5 partecipanti (1 telefono + 4 bot), input reale, battaglia e risultati naturali a tempo reale; nessun debug/accelerazione/pageerror.');
}catch(error){writeFileSync('docs/agent-work/cornicione-throws/fighter-production-failure.json',JSON.stringify({...report,failure:String(error)},null,2));throw error;}finally{await browser.close();}
