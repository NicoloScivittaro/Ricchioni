import {audio} from '../core/AudioManager';
import type {MonsterCue} from './MonsterAnimator';
/** Original bounded synthesis, through the existing mixer. No copied game recordings. */
export function monsterSfx(cue:MonsterCue|'impact',distance=0,heavy=false):void{
 const c=audio.getContext(),dst=audio.getOutput('sfx');if(!c||!dst||distance>20)return;
 const duration=cue==='roar'?1.15:cue==='death'?.7:cue==='swing'?.16:.12;
 if(!audio.reserveVoice('sfx',duration+.02))return;
 const o=c.createOscillator(),g=c.createGain(),filter=c.createBiquadFilter(),now=c.currentTime;
 const freq=cue==='roar'?82:cue==='death'?66:cue==='swing'?350:cue==='impact'?110:heavy?70:125;
 o.type=cue==='roar'?'sawtooth':'triangle';o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(24,freq*.45),now+duration);filter.type='lowpass';filter.frequency.value=cue==='roar'?420:850;
 g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime((cue==='roar'?.1:cue==='step'?.035:.06)/(1+distance*.18),now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+duration);
 o.connect(filter);filter.connect(g);g.connect(dst);o.start();o.stop(now+duration);o.onended=()=>{o.disconnect();filter.disconnect();g.disconnect();};
}
