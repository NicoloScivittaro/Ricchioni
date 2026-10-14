import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch } from './lib.mjs';
const browser=await launch();
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5175/audio/narrator/prototypes.html');
 const result=await page.evaluate(async()=>{
  const {audio}=await import('/src/core/AudioManager.ts');
  const {NarratorPlayer,NARRATOR_MEDIA}=await import('/src/audio/narrator/NarratorPlayer.ts');
  const {NARRATOR_LINES}=await import('/src/audio/narrator/NarratorLines.ts');
  const {narratorSettings:prefs}=await import('/src/audio/narrator/NarratorSettings.ts');
  const {narrator}=await import('/src/audio/narrator/NarratorDirector.ts');
  const {game:gm}=await import('/src/core/GameManager.ts');
  const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
  const check=(value,label)=>{if(!value)throw Error(label);checks.push(label);};
  audio.unlock();await wait(100);const ctx=audio.getContext();
  check(ctx.state==='running','contesto audio reale attivo');
  const before=localStorage.getItem('ricchioni.audio');
  prefs.set({enabled:true,volume:.72,subtitles:true,frequency:'chatty'});
  const p=new NarratorPlayer();p.refreshPrefs();
  check(audio.getNarratorVolume()===.72&&localStorage.getItem('ricchioni.audio')===before,'volume separato e preferenze legacy preservate');
  const line=NARRATOR_LINES.find(l=>l.id==='roller-1');
  const buffer=await ctx.decodeAudioData(await (await fetch(line.asset)).arrayBuffer());
  let released=0;const first=audio.playNarration(buffer,0,()=>released++);check(!!first,'riproduzione clip registrata');
  await wait(150);check(audio.stats().duck>=.59,'musica abbassata durante parlato');
  audio.duck(.8,250);await wait(550);check(audio.stats().duck>=.59,'duck legacy non ripristina musica prima della voce');
  const second=audio.playNarration(buffer,0,()=>released++);check(released===1&&audio.stats().voices.voice===1,'esclusione globale di due voci');
  second.stop();second.stop();await wait(1300);check(released===2&&audio.stats().voices.voice===0&&audio.stats().duck<=.01,'stop idempotente libera voce e ripristina musica');
  const create=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=()=>{throw Error('test nodo indisponibile');};
  check(audio.playNarration(buffer,0,()=>{})===null&&audio.stats().voices.voice===0,'errore creazione nodo senza perdita budget');ctx.createBufferSource=create;
  check(await p.play(line,performance.now()+10000,()=>{}),'player avviato');await wait(220);p.pause();
  check(p.stats().paused&&audio.stats().voices.voice===0&&!document.getElementById('narrator-subtitles'),'pausa rilascia voce e sottotitoli');
  const startOffsets=[];ctx.createBufferSource=()=>{const source=create(),start=source.start.bind(source);source.start=(when,offset,...rest)=>{startOffsets.push(offset??0);return start(when,offset,...rest);};return source;};
  p.resume();await wait(100);check(startOffsets[0]>.1&&p.played.length===1,'ripresa dal punto esatto senza duplicare evento');ctx.createBufferSource=create;
  prefs.set({subtitles:false});p.refreshPrefs();check(!document.getElementById('narrator-subtitles')&&!!p.stats().active,'sottotitoli OFF lascia voce attiva');
  prefs.set({subtitles:true});p.refreshPrefs();check(!!document.getElementById('narrator-subtitles'),'sottotitoli ON sincronizzati');
  prefs.set({volume:0});p.refreshPrefs();check(!p.stats().active&&audio.stats().voices.voice===0,'volume zero interrompe voce');
  check(!await p.play(line,performance.now()+10000,()=>{}),'volume zero non crea nuova voce');
  prefs.set({volume:.9,enabled:false});p.refreshPrefs();check(!await p.play(line,performance.now()+10000,()=>{}),'narratore OFF');
  prefs.set({enabled:true});p.refreshPrefs();audio.toggleMute();check(!await p.play(line,performance.now()+10000,()=>{}),'muto generale rispettato');audio.toggleMute();
  check(!await p.play({...line,id:'missing-test',asset:'/audio/narrator/missing-test.ogg'},performance.now()+10000,()=>{})&&!p.stats().pending,'asset mancante risolto senza blocco');
  check(!await p.play(line,performance.now()+50,()=>{}),'clip troppo lunga per finestra non avviata');
  const decoded=[];
  for(const [id,meta] of Object.entries(NARRATOR_MEDIA)){
   const response=await fetch(meta.asset),data=await response.arrayBuffer(),bytes=data.byteLength,b=await ctx.decodeAudioData(data);
   check(Math.abs(b.duration-meta.duration)<.15&&bytes===meta.bytes&&b.numberOfChannels===1,`asset decodificato ${id} (${b.duration}/${meta.duration}s, ${bytes}/${meta.bytes} byte)`);
   decoded.push({id,duration:b.duration,containerDuration:meta.duration,bytes});
  }
  for(const l of NARRATOR_LINES.slice(0,10)){await p.play(l,performance.now()+10000,()=>{});p.stop();}
  check(p.stats().cache===8,'cache decodificata limitata a otto clip');
  p.stop();narrator.init();narrator.init();check(narrator.stats().listeners===8,'init idempotente');
  const room={roomCode:'AUDIO-TEST',roundId:100,phase:'MINIGAME_ROULETTE',paused:false,players:[],currentMinigame:{minigameId:'quiz'}};
  let seq=100;
  const state=(phase,paused=false)=>gm.events.emit('state',{...room,roundId:seq,phase,paused});
  const playDirector=async()=>{seq++;state('MINIGAME_ROULETTE');gm.events.emit('narrator.roller');await wait(150);check(!!narrator.stats().active,'director voce attiva '+seq);};
  await playDirector();document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));check(!narrator.stats().active&&!document.getElementById('narrator-subtitles'),'Spazio interrompe narratore');
  await playDirector();state('MINIGAME_ROULETTE',true);await wait(160);check(narrator.stats().paused,'pausa director mantenuta');state('MINIGAME_ROULETTE');check(!narrator.stats().paused,'ripresa director');
  gm.events.emit('narrator.controls',true);check(!narrator.stats().active,'tutorial interrompe voce');gm.events.emit('narrator.controls',false);
  await playDirector();audio.toggleMute();await wait(150);check(!narrator.stats().active,'muto interrompe voce entro heartbeat');audio.toggleMute();
  const originalFetch=window.fetch;window.fetch=(url,opts)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>originalFetch(url,opts).then(resolve,reject),800);opts?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));});});
  seq++;state('MINIGAME_ROULETTE');gm.events.emit('narrator.game');check(narrator.stats().pending,'caricamento ritardato osservato');state('MINIGAME_PLAYING');await wait(1000);check(!narrator.stats().pending&&!narrator.stats().active,'cambio fase cancella caricamento tardivo');window.fetch=originalFetch;
  for(const phase of ['MINIGAME_PLAYING','MINIGAME_FINISHED','NEXT_ROUND','LOBBY']){seq++;state(phase);gm.events.emit('narrator.roller');gm.events.emit('narrator.game');gm.events.emit('narrator.results');check(!narrator.stats().active&&!narrator.stats().pending,'silenzio fase '+phase);}
  narrator.dispose();await wait(1300);check(narrator.stats().listeners===0&&!narrator.stats().initialized&&audio.stats().voices.voice===0&&audio.stats().duck<=.01,'cleanup finale audio eventi e duck');
  return {checks:checks.length,decoded:decoded.length,allAssets:decoded,mixer:true,legacyPrefs:true,pauseOffset:true,exclusiveVoice:true,loadFailure:true,lateFetchCancelled:true,cacheBound:8,cleanup:true};
 });
 assert.deepEqual(errors,[]);writeFileSync('docs/agent-work/narrator/mixer-tests.json',JSON.stringify({...result,errors},null,2));
 console.log(`NARRATORE MIXER: ${result.checks} verifiche, ${result.decoded} clip decodificate in Chrome.`);
} finally {await browser.close();}
