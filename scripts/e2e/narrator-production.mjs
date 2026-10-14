import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
process.env.HOST_URL=process.env.HOST_URL??'http://localhost:3004/';
process.env.CTRL_URL=process.env.CTRL_URL??'http://localhost:3004/controller.html';
const {launch,addPhone,sleep,HOST_URL}=await import('./lib.mjs');
const browser=await launch(),errors=[];
const until=async(fn,label,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(80);}throw Error('Timeout '+label);};
async function wire(page){const c=await page.target().createCDPSession();await c.send('Network.enable');const data={room:null,private:null};c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [e,d]=JSON.parse(response.payloadData.slice(2));if(e==='room:state')data.room=d;if(e==='private:data'&&d?.type==='trentunoPrivate')data.private=d;}catch{}});page.on('pageerror',e=>errors.push(e.message));return data;}
const val=id=>id.endsWith('-A')?11:/-[FCR]$/.test(id)?10:Number(id.split('-')[1]);
const score=hand=>Math.max(...['DENARI','COPPE','SPADE','BASTONI'].map(s=>hand.filter(id=>id.startsWith(s)).reduce((v,id)=>v+val(id),0)));
const drop=(hand,legal=hand)=>legal.slice().sort((a,b)=>score(hand.filter(c=>c!==b))-score(hand.filter(c=>c!==a))||val(a)-val(b))[0];
async function play(page,s){const target=drop(s.hand,s.discardable);await page.evaluate(({s,target})=>{const click=q=>{const b=document.querySelector(q);if(b&&!b.disabled)b.click();};if(s.table.paused||s.table.phase==='handResult'||s.table.phase==='finished')return;if(s.discardable.length){const c=[...document.querySelectorAll('[data-card]')].find(b=>b.dataset.card===target);if(c&&!c.classList.contains('selected'))c.click();click('[data-op=discard]');}else if(s.canKnock&&s.score>=24)click('[data-op=knock]');else if(s.canDraw)click('[data-op=draw]');},{s,target});}
try{
 const host=await browser.newPage(),data=await wire(host);
 await host.evaluateOnNewDocument(()=>{
  window.__narrAudit={contexts:0,voices:[],captions:[]};
  const AC=window.AudioContext;
  window.AudioContext=class extends AC{constructor(...args){super(...args);window.__narrAudit.contexts++;}createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=(...args)=>{if(source.buffer?.duration>1&&!source.loop){const record={started:performance.now(),duration:source.buffer.duration,ended:null};window.__narrAudit.voices.push(record);source.addEventListener('ended',()=>record.ended=performance.now());}return start(...args);};return source;}};
  document.addEventListener('DOMContentLoaded',()=>{let current=null;new MutationObserver(()=>{const e=document.getElementById('narrator-subtitles');if(e&&!current){current={event:e.dataset.event,text:e.textContent,started:performance.now(),ended:null};window.__narrAudit.captions.push(current);}else if(!e&&current){current.ended=performance.now();current=null;}}).observe(document.body,{childList:true,subtree:true});});
 });
 await host.goto(HOST_URL,{waitUntil:'load'});await host.waitForSelector('canvas');await sleep(1000);await host.keyboard.press('Enter');await until(()=>data.room?.roomCode,'stanza');
 const code=data.room.roomCode,phones=[];
 for(let i=0;i<2;i++){const p=await addPhone(browser,code,'VOCE '+i,i);phones.push({page:p.page,data:await wire(p.page)});}
 await host.keyboard.press('v');await host.waitForSelector('[data-nar=frequency]');await host.select('[data-nar=frequency]','chatty');
 const oldAudio=await host.evaluate(()=>localStorage.getItem('ricchioni.audio'));
 await host.$eval('[data-nar=volume]',e=>{e.value='75';e.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await host.evaluate(()=>JSON.parse(localStorage.getItem('ricchioni.narrator')).volume),.75);
 assert.equal(await host.evaluate(()=>localStorage.getItem('ricchioni.audio')),oldAudio);
 await host.keyboard.press('v');await host.reload({waitUntil:'load'});await until(()=>data.room?.phase==='LOBBY','riconnessione lobby');await sleep(900);
 await host.keyboard.press('v');await host.waitForSelector('[data-nar=volume]');assert.equal(await host.$eval('[data-nar=volume]',e=>e.value),'75');assert.equal(await host.$eval('[data-nar=frequency]',e=>e.value),'chatty');await host.keyboard.press('v');
 for(let i=0;i<17;i++){await host.keyboard.press('ArrowRight');await sleep(120);}await until(()=>data.room?.selectedMinigameId==='trentuno','selezione 31');await host.keyboard.press('Enter');
 await until(()=>host.$('#narrator-subtitles[data-event=roller]'),'rullo con parlato');
 await until(()=>host.$('#narrator-subtitles[data-event=game]'),'annuncio 31');await host.screenshot({path:'docs/agent-work/narrator/production-announcement.png'});
 assert.match(await host.$eval('#narrator-subtitles',e=>e.textContent),/31|Trentuno/i);
 await until(()=>phones.every(p=>p.data.private),'mani');
 const perf=await host.evaluate(async()=>{const frames=[];await new Promise(resolve=>{const first=performance.now();const frame=t=>{frames.push(t);if(t-first<2500)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});const durations=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);return{fps:+((frames.length-1)*1000/(frames.at(-1)-frames[0])).toFixed(1),p95FrameMs:+durations[Math.floor(durations.length*.95)].toFixed(2)};});
 const start=Date.now();while(Date.now()-start<340000&&data.room?.phase!=='ROUND_RESULTS'){for(const p of phones)if(p.data.private)await play(p.page,p.data.private);await sleep(160);}
 assert.equal(data.room?.phase,'ROUND_RESULTS');await until(()=>host.$('#narrator-subtitles[data-event=result]'),'commento risultati');await host.screenshot({path:'docs/agent-work/narrator/production-results.png'});
 const results=data.room.lastResults;assert.ok(results.results.length===2&&results.deltas);const resultRound=data.room.roundId;
 await until(()=>data.room?.phase==='MINIGAME_ROULETTE'&&data.room.roundId>resultRound,'round successivo');await until(()=>host.$('#narrator-subtitles[data-event=game]'),'annuncio gioco successivo');
 const next=data.room.currentMinigame.minigameId;await until(()=>data.room?.phase==='MINIGAME_PLAYING','gioco successivo avviato');await sleep(300);assert.equal(await host.$('#narrator-subtitles'),null);
 for(const p of phones){assert.equal(await p.page.$('#narrator-subtitles'),null);assert.equal(await p.page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/audio/narrator/')).length),0);}
 const audit=await host.evaluate(()=>window.__narrAudit),captions=audit.captions;
 assert.equal(audit.contexts,1);assert.equal(captions.filter(c=>c.event==='result').length,1);assert.equal(captions.filter(c=>c.event==='roller').length,2);assert.equal(captions.filter(c=>c.event==='game').length,2);
 assert.ok(captions.every((c,i)=>!i||captions[i-1].ended<=c.started));assert.ok(captions.every(c=>audit.voices.some(v=>Math.abs(v.started-c.started)<80&&v.ended!==null&&v.ended>=c.ended-80)));
 assert.deepEqual(errors,[]);writeFileSync('docs/agent-work/narrator/production-tests.json',JSON.stringify({compiled:true,naturalThreeHands:true,resultRound,nextGame:next,independentVolume:true,prefsReload:true,oneAudioContext:true,hostOnly:true,noOverlap:true,oneResultLine:true,subtitlesSynchronized:true,noGameplayVoice:true,performance:perf,captions,actualAudioSources:audit.voices,errors},null,2));
 console.log(`NARRATORE PRODUZIONE: tre mani reali, 5 annunci parlati, ${perf.fps} FPS, zero errori.`);
}finally{await browser.close();}
