import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
import { CHROME, HOST_URL, sleep } from './lib.mjs';
const out = process.env.BACK_OUT ?? 'docs/agent-work/backrooms-fixes';
const report = { errors: [], checks: [], samples: {} };
// Override the usual E2E autoplay bypass. A genuine keyboard/pointer event is required.
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width:1280,height:720 }, args: ['--no-sandbox','--enable-gpu','--use-angle=d3d11','--autoplay-policy=document-user-activation-required','--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies','--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
try {
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto(HOST_URL,{waitUntil:'load'});
 const cdp=await page.createCDPSession();
 const initial=await cdp.send('Runtime.evaluate',{userGesture:false,awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const {audio}=await import('/src/core/AudioManager.ts'),{music}=await import('/src/core/music.ts');music.stop(0);
  const {BackroomsAudio}=await import('/src/minigames/backrooms/backroomsAudio.ts');
  const {BackroomsMatch}=await import('/src/minigames/backrooms/backroomsRules.ts');
  window.ba=audio;window.bs=new BackroomsAudio();window.bm=new BackroomsMatch([{id:'a',name:'A'},{id:'b',name:'B'}],123,{monsters:['runner']});
  window.bs.start();
  window.saved={master:audio.getVolume('master'),ambience:audio.getVolume('ambience'),sfx:audio.getVolume('sfx'),muted:audio.isMuted(),music:audio.getVolume('music')};
  // Isolate Backrooms at normal default gains, then restore user settings in finally below.
  if(audio.isMuted())audio.toggleMute();audio.setVolume('master',.85);audio.setVolume('ambience',.6);audio.setVolume('sfx',1);audio.setVolume('music',0);
  await new Promise(r=>setTimeout(r,400));return {state:ba.getState(),button:!!document.querySelector('#backrooms-audio-unlock'),peak:ba.stats().peak};
 })()`});if(initial.exceptionDetails)throw new Error(JSON.stringify(initial.exceptionDetails));report.before=initial.result.value;
 assert.equal(report.before.state,'suspended');assert.equal(report.before.button,true);assert.equal(report.before.peak,0);
 await page.screenshot({path:`${out}/audio-blocked.png`});await page.click('#backrooms-audio-unlock');await sleep(500);
 assert.equal(await page.evaluate(()=>ba.getState()),'running');assert.equal(await page.$('#backrooms-audio-unlock'),null);report.checks.push('default restricted autoplay: suspended/no signal before genuine click, running after click');
 const sample=async(name)=>{
  const result=await page.evaluate(async()=>{
   const an=ba.analyser, data=new Float32Array(an.fftSize), freq=new Float32Array(an.frequencyBinCount);let rms=0,peak=0,energy=0;
   for(let i=0;i<20;i++){an.getFloatTimeDomainData(data);an.getFloatFrequencyData(freq);rms+=Math.sqrt(data.reduce((n,v)=>n+v*v,0)/data.length);peak=Math.max(peak,...data.map(Math.abs));
    for(let k=0;k<freq.length;k++){const hz=k*ba.getContext().sampleRate/an.fftSize;if(hz>=100&&hz<=1500)energy+=10**(freq[k]/10);}await new Promise(r=>setTimeout(r,20));}
   return{state:ba.getState(),rms:rms/20,peak,midrangeEnergy:energy/20};
  });report.samples[name]=result;return result;
 };
 const hum=await sample('exploration');assert.ok(hum.rms>.01);assert.ok(hum.midrangeEnergy>.00001);assert.ok(hum.peak<.95);
 await page.evaluate(()=>ba.setVolume('ambience',0));await sleep(250);assert.ok((await sample('ambience-bus-zero')).peak<.00001);
 await page.evaluate(()=>{ba.setVolume('ambience',.6);ba.setVolume('master',.425);});await sleep(350);assert.ok((await sample('master-half')).rms<hum.rms*.7);
 await page.evaluate(()=>ba.setVolume('master',.85));await sleep(350);
 await page.evaluate(()=>ba.isMuted()||ba.toggleMute());await sleep(250);assert.ok((await sample('muted')).peak<.00001);
 await page.evaluate(()=>ba.isMuted()&&ba.toggleMute());await sleep(250);
 await page.evaluate(()=>bs.setPaused(true));await sleep(650);assert.ok((await sample('paused')).rms<.00002);
 await page.evaluate(()=>bs.setPaused(false));await sleep(350);assert.ok((await sample('resumed')).rms>.01);
 await page.evaluate(async()=>{await ba.getContext().suspend();});await sleep(50);report.afterExternalSuspend=await page.evaluate(()=>({state:ba.getState(),button:!!document.querySelector('#backrooms-audio-unlock')}));
 await page.keyboard.press('Shift');await sleep(250);assert.equal(await page.evaluate(()=>ba.getState()),'running');assert.ok((await sample('keyboard-recovered')).rms>.01);
 await page.evaluate(()=>{const p=bm.players[0],m=bm.monsters[0];Object.assign(m,{x:p.x+2,z:p.z,state:'chase'});bs.update(bm);});await sleep(600);
 const danger=await sample('danger');assert.ok(danger.rms>hum.rms*1.15);
 await page.evaluate(()=>{bm.monsters.forEach(m=>{m.x=1000;m.z=1000;});bm.time=27;bs.update(bm);});await sleep(1400);
 assert.ok((await sample('quiet-gap')).rms<.001);
 const room=await page.evaluate(()=>{bm.time=29;bs.update(bm);const old=bs.hum[0].frequency.value;bm.players.forEach(p=>p.x+=3.2);bs.update(bm);return old;});await sleep(600);
 assert.notEqual(await page.evaluate(()=>bs.hum[0].frequency.value),room);report.checks.push('ambience bus/master gain respected; brief quiet gap and room-dependent fluorescent frequency');
 await page.evaluate(()=>bs.setPaused(true));await sleep(500);
 await page.evaluate(()=>{bs.setPaused(false);bs.humGain.gain.setValueAtTime(0,ba.getContext().currentTime);});await sleep(500);
 for(const type of ['step','monsterStep','door','generator','task','capture','escape','reveal']) {
  await page.evaluate(type=>bs.event({type,player:'a',point:bm.players[0],kind:'runner',power:1},bm),type);
  const s=await sample(type);assert.ok(s.peak>.008,`${type} produces output`);assert.ok(s.peak<.95);
 }
 // Saturated transient budget must not drop capture. The three capture voices have priority.
 await page.evaluate(()=>{for(let i=0;i<12;i++)bs.voice(300,1,.02,0);bs.event({type:'capture',player:'a',point:bm.players[0],kind:'stalker'},bm);});
 assert.ok((await sample('capture-budget')).peak>.06);
 await page.evaluate(()=>{bs.dispose();Object.entries(saved).forEach(([k,v])=>k==='muted'?(ba.isMuted()!==v&&ba.toggleMute()):ba.setVolume(k,v));});await sleep(1200);
 assert.equal(await page.evaluate(()=>bs.voices.size+bs.hum.length),0);assert.equal(await page.$('#backrooms-audio-unlock'),null);
 report.checks.push('post-limiter analyser on destination branch: audible-band RMS; mute, pause/resume, suspension recovery, danger, all event sounds, critical priority and disposal');
 assert.deepEqual(report.errors,[]);console.log('PASS audio actual Chrome signal',JSON.stringify(report.samples));
} finally { writeFileSync(`${out}/audio.json`,JSON.stringify(report,null,2));await browser.close(); }
