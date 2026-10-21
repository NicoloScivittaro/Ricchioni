import {audio} from '../../core/AudioManager';
import * as fps from '../../controller/fpsAudio';
import type {OrdaEvent,OrdaState} from '../../../shared/orda/types';
/** Existing mixer and weapon synthesis. Horror accents use the same bounded SFX bus. */
export class OrdaAudio{
 private hum:OscillatorNode|null=null;private gain:GainNode|null=null;private lastPulse=0;
 start():void{const c=audio.getContext(),dst=audio.getOutput('ambience');if(!c||!dst||this.hum)return;const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.value=83;g.gain.value=.018;o.connect(g);g.connect(dst);o.start();this.hum=o;this.gain=g;}
 paused(on:boolean):void{const c=audio.getContext();if(c&&this.gain)this.gain.gain.setTargetAtTime(on?0:.018,c.currentTime,.05);if(on)fps.stopCombatAudio();}
 private tone(hz:number,duration=.35):void{const c=audio.getContext(),dst=audio.getOutput('sfx');if(!c||!dst||!audio.reserveVoice('sfx',duration+.05))return;const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(hz,c.currentTime);o.frequency.exponentialRampToValueAtTime(hz*.45,c.currentTime+duration);g.gain.setValueAtTime(.045,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g);g.connect(dst);o.start();o.stop(c.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect();};}
 event(e:OrdaEvent,local:Set<string>):void{
  if(e.type==='shot')fps.shot(e.weapon??'pistola',{gain:local.has(e.player??'')?.4:.12,source:'orda:'+e.player});
  else if(e.type==='hit'&&local.has(e.player??'')){fps.hitTick(e.value??20);if(e.text)fps.kill();}
  else if(e.type==='hurt'&&local.has(e.player??''))fps.hurt(e.value??15);
  else if(e.type==='reload'&&local.has(e.player??''))fps.reload(e.weapon??'pistola',e.value??1.2);
  else if(e.type==='boss')this.tone(67,1.1);
  else if(e.type==='wave')this.tone(230,.5);
  else if(e.type==='windup')this.tone(e.text==='spit'?360:100,.28);
  else if(e.type==='death')this.tone(120,.7);
  else if(e.type==='win'){audio.ui('confirm');this.tone(440,.8);}
 }
 update(s:OrdaState):void{if(s.phase==='fighting'&&s.time-this.lastPulse>Math.max(1.5,6-s.wave*.2)){this.lastPulse=s.time;this.tone(65+(s.wave%3)*9,.2);}}
 dispose():void{try{this.hum?.stop();}catch{/* already stopped */}this.hum?.disconnect();this.gain?.disconnect();this.hum=null;this.gain=null;fps.stopCombatAudio();}
}
