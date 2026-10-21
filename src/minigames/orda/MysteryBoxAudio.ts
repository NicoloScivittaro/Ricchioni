import {audio}from'../../core/AudioManager';
import {MYSTERY_BOX,ZOMBIES}from'../../../shared/orda/zombiesRules';
import type{OrdaState}from'../../../shared/orda/types';
type Cue='roll'|'ready'|'close';
const buffers=new WeakMap<AudioContext,Promise<Record<Cue,AudioBuffer>>>();
/** One spatially attenuated voice per scene, routed through the existing SFX mixer. */
export class MysteryBoxAudio{
 private clips:Record<Cue,AudioBuffer>|null=null;private key='';private source:AudioBufferSourceNode|null=null;private gain:GainNode|null=null;private disposed=false;private muted=false;
 start():void{const c=audio.getContext();if(!c)return;let pending=buffers.get(c);if(!pending){pending=Promise.all((['roll','ready','close']as Cue[]).map(async cue=>{const response=await fetch(`/assets/orda/audio/${cue}.wav`);if(!response.ok)throw Error('Mystery Box audio '+response.status);return[cue,await c.decodeAudioData(await response.arrayBuffer())]as const;})).then(entries=>Object.fromEntries(entries)as Record<Cue,AudioBuffer>);buffers.set(c,pending);void pending.catch(()=>buffers.delete(c));}void pending.then(clips=>{if(!this.disposed)this.clips=clips;}).catch(e=>{if(!this.disposed)console.warn('Mystery Box sound unavailable',e);});}
 update(s:OrdaState,local:Set<string>):void{
  if(this.disposed||this.muted)return;const c=audio.getContext();if(!c||!this.clips)return;
  const distance=Math.min(...s.players.filter(p=>local.has(p.id)&&p.alive).map(p=>Math.hypot(p.x-MYSTERY_BOX.x,p.z-MYSTERY_BOX.z,p.y)));
  const volume=Math.max(0,1-distance/18)*.7;
  this.gain?.gain.setTargetAtTime(volume,c.currentTime,.05);
  const b=s.box,key=s.phase==='finished'?'finished':`${b.serial}:${b.phase}`;if(key===this.key)return;this.key=key;this.stop();
  let cue:Cue,age:number;
  if(b.phase==='rolling'){cue='roll';age=s.time-b.started;}
  else if(b.phase==='ready'){cue='ready';age=s.time-(b.until-ZOMBIES.claimSeconds);}
  else if(b.phase==='closing'){cue='close';age=s.time-(b.until-ZOMBIES.closeSeconds);}
  else return;
  if(s.phase==='finished')return;
  const buffer=this.clips[cue],offset=Math.max(0,age);if(offset>=buffer.duration)return;
  const dst=audio.getOutput('sfx');if(!dst||!audio.reserveVoice('sfx',buffer.duration-offset))return;
  const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(dst);this.source=source;this.gain=gain;
  source.onended=()=>{source.disconnect();gain.disconnect();if(this.source===source){this.source=null;this.gain=null;}};source.start(0,offset);
 }
 private stop():void{const source=this.source;this.source=null;this.gain=null;if(source){try{source.stop();}catch{/* already ended */}source.disconnect();}}
 paused(value:boolean):void{this.muted=value;if(value){this.stop();this.key='';}}
 dispose():void{this.disposed=true;this.stop();this.clips=null;}
}
