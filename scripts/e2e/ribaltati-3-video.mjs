import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5179/?quality=high';process.env.CTRL_URL='http://localhost:5179/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const browser=await launch(),out='docs/agent-work/ribaltati-3',report={errors:[],audio:[],samples:[]};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(e.message));await addPhone(browser,code,'VIDEO',0);
 await hostEval(page,gm=>{gm.selectMinigame('kart3d');gm.startGame();});const G=(f,a)=>gameEval(page,'kart3d',f,a);
 await until(()=>G(g=>g.race.phase==='racing'),90000,'race');await page.mouse.click(900,640);await sleep(1500);
 report.capture=await G(async g=>{
  g.soloBots.ids=new Set(g.karts.keys());g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};
  const url=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/AudioManager.ts/.test(n));const {audio}=await import(url);window.__recordAudio=audio;window.__audioEvents={};for(const key of ['kartBoost','driftLevel','kartBump','kartItem','kartFinish','thump','hit']){const original=audio[key];audio[key]=function(...args){window.__audioEvents[key]=(window.__audioEvents[key]??0)+1;return original.apply(this,args);};}
  const stream=g.engine.getRenderingCanvas().captureStream(30),destination=audio.ctx.createMediaStreamDestination();audio.analyser.connect(destination);
  for(const t of destination.stream.getAudioTracks())stream.addTrack(t);
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm';
  window.__recordChunks=[];window.__recordDestination=destination;window.__recordStream=stream;
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000,audioBitsPerSecond:128000});window.__recorder=recorder;
  recorder.ondataavailable=e=>{if(e.data.size)window.__recordChunks.push(e.data);};recorder.start(1000);
  return{mime,videoTracks:stream.getVideoTracks().length,audioTracks:stream.getAudioTracks().length,initial:audio.stats(),renderer:g.engine.getGlInfo(),views:g.scene.activeCameras.length};
 });
 for(let i=0;i<9;i++){await sleep(5000);report.samples.push(await G(g=>({time:g.race.raceTime,karts:[...g.karts.values()].map(k=>({distance:k.distance,lap:k.lap,jump:k.jumpHeight})),audio:window.__recordAudio.stats()})));console.log('REC '+(i+1)*5+'s');}
 const base64=await page.evaluate(async()=>{await new Promise(resolve=>{window.__recorder.onstop=resolve;window.__recorder.stop();});const blob=new Blob(window.__recordChunks,{type:window.__recorder.mimeType});return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(';base64,')[1]);r.readAsDataURL(blob);});});
 const bytes=Buffer.from(base64,'base64');assert.ok(bytes.length>100000);assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3');writeFileSync(`${out}/ribaltati-3-gameplay.webm`,bytes);
 await page.screenshot({path:`${out}/video-frame.png`});
 const live=await page.evaluate(()=>window.__recordAudio.stats());report.audio.push({stage:'live',...live});assert.equal(live.state,'running');assert.ok(report.samples.some(s=>s.audio.peak>0));
 await page.evaluate(()=>{window.__recordAudio.toggleMute();});await sleep(300);report.audio.push({stage:'muted',...await page.evaluate(()=>window.__recordAudio.stats())});assert.equal(report.audio.at(-1).muted,true);
 await page.evaluate(()=>{window.__recordAudio.toggleMute();window.__recordAudio.analyser.disconnect(window.__recordDestination);for(const t of window.__recordStream.getTracks())t.stop();});await sleep(300);report.audio.push({stage:'restored',...await page.evaluate(()=>window.__recordAudio.stats())});assert.equal(report.audio.at(-1).muted,false);
 report.naturalCues=await page.evaluate(()=>window.__audioEvents);
 await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>gm.state.paused),5000,'audio pause');report.audio.push({stage:'pause',...await page.evaluate(()=>window.__recordAudio.stats())});
 await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>!gm.state.paused),5000,'audio resume');await sleep(300);report.audio.push({stage:'resume',...await page.evaluate(()=>window.__recordAudio.stats())});assert.equal(report.audio.at(-1).state,'running');
 report.volumeProbe=await page.evaluate(()=>{const a=window.__recordAudio,old=a.getVolume('sfx');a.setVolume('sfx',.25);const result={requested:a.getVolume('sfx'),gain:a.cats.sfx.gain.value};a.setVolume('sfx',old);return result;});assert.equal(report.volumeProbe.gain,.25);
 report.itemCueProbe=await page.evaluate(async()=>{const a=window.__recordAudio,result=[];for(const kind of ['turbo','super_turbo','sfera','olio','scudo','disturbo','calamita','piccione','turbo_difettoso','buca','raffica','paraurti','mollone']){a.kartItem(kind);await new Promise(r=>setTimeout(r,180));result.push({kind,...a.stats()});}a.kartFinish(true);a.kartFinish(false);return result;});assert.equal(report.itemCueProbe.length,13);
 await hostEval(page,gm=>gm.restartMatch());assert.deepEqual(report.errors,[]);
}finally{writeFileSync(`${out}/video-audio-checks.json`,JSON.stringify(report,null,2));await browser.close();}
