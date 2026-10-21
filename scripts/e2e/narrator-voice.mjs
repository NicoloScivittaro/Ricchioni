import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {launch} from './lib.mjs';
const b=await launch(),report={errors:[]};try{const p=await b.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://localhost:5191/audio/narrator/prototypes.html');
report.playback=await p.evaluate(async()=>{
 const {audio}=await import('/src/core/AudioManager.ts'),{NarratorPlayer}=await import('/src/audio/narrator/NarratorPlayer.ts'),{NARRATOR_LINES}=await import('/src/audio/narrator/NarratorLines.ts'),{narratorSettings}=await import('/src/audio/narrator/NarratorSettings.ts');
 audio.unlock();narratorSettings.set({enabled:true,volume:.9,subtitles:true});const player=new NarratorPlayer(),rows=[];
 for(const id of ['roller-5','result-6','personal-buttafuori-5','game-fps-1']){
  const line=NARRATOR_LINES.find(l=>l.id===id),limit={roller:4.1,result:5.1,game:4.4}[line.event];let started=false;
  if(!await player.play(line,performance.now()+limit*1000,()=>started=true))throw Error('Playback failed '+id);
  if(!started||!document.querySelector('#narrator-subtitles')?.textContent.includes(line.subtitle))throw Error('Subtitle mismatch '+id);
  if(audio.stats().voices.voice!==1)throw Error('Exclusive voice budget '+id);
  const deadline=performance.now()+6000;while(player.stats().active&&performance.now()<deadline)await new Promise(r=>setTimeout(r,30));
  const last=player.played.at(-1);if(last.reason!=='ended')throw Error('Voice did not finish '+id);
  rows.push({id,subtitle:line.subtitle,playedToEnd:true});
 }
 if(document.querySelector('#narrator-subtitles')||audio.stats().voices.voice!==0)throw Error('Playback cleanup');player.stop();return rows;
});assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify(report));
}finally{writeFileSync('docs/agent-work/narrator-voice/browser.json',JSON.stringify(report,null,2));await b.close();}
