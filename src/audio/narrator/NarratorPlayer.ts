import { audio } from '../../core/AudioManager';
import { narratorSettings } from './NarratorSettings';
import { NarratorSubtitles } from './NarratorSubtitles';
import type { NarratorLine } from './NarratorLines';
import media from '../../../public/audio/narrator/manifest.json';
// Tipi e metadati importati staticamente: il file è prodotto dal generatore offline.
export interface NarratorMedia {asset:string;duration:number;bytes:number}
export const NARRATOR_MEDIA=media as Record<string,NarratorMedia>;
export class NarratorPlayer {
  private cache=new Map<string,AudioBuffer>();private abort:AbortController|null=null;private generation=0;
  private lease:ReturnType<typeof audio.playNarration>=null;private caption=new NarratorSubtitles();
  private active:NarratorLine|null=null;private buffer:AudioBuffer|null=null;private offset=0;private deadline=0;private paused=false;
  readonly played:{id:string;event:string;started:number;ended?:number;reason?:string}[]=[];
  async play(line:NarratorLine,deadline:number,onStarted:()=>void):Promise<boolean>{
    this.stop('superseded');const stamp=this.generation;this.abort=new AbortController();this.deadline=deadline;
    try{
      let buffer=this.cache.get(line.id);const ctx=audio.getContext();if(!ctx)return false;
      if(!buffer){const response=await fetch(line.asset,{signal:this.abort.signal});if(!response.ok)throw Error('Asset voce mancante');buffer=await ctx.decodeAudioData(await response.arrayBuffer());if(stamp!==this.generation)return false;this.cache.set(line.id,buffer);while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value!);}
      if(stamp!==this.generation||performance.now()+buffer.duration*1000>deadline||!narratorSettings.get().enabled||audio.isMuted())return false;
      this.active=line;this.buffer=buffer;this.offset=0;this.paused=false;
      if(!this.resumeSource()){this.active=null;this.buffer=null;return false;}
      this.played.push({id:line.id,event:line.event,started:performance.now()});this.played.splice(0,Math.max(0,this.played.length-100));onStarted();return true;
    }catch{return false;}finally{if(stamp===this.generation)this.abort=null;}
  }
  private resumeSource():boolean{
    if(!this.active||!this.buffer)return false;
    const stamp=this.generation;this.lease=audio.playNarration(this.buffer,this.offset,()=>{if(stamp===this.generation&&!this.paused)this.stop('ended');});
    if(!this.lease)return false;if(narratorSettings.get().subtitles)this.caption.show(this.active.subtitle,this.active.event);return true;
  }
  pause():void{if(!this.active||this.paused)return;this.paused=true;this.offset=this.lease?.position()??this.offset;this.lease?.stop();this.lease=null;this.caption.hide();}
  resume():void{if(!this.paused||!this.buffer)return;if(performance.now()+(this.buffer.duration-this.offset)*1000>this.deadline){this.stop('expired');return;}this.paused=false;if(!this.resumeSource())this.stop('unavailable');}
  stop(reason='cancelled'):void{this.generation++;this.abort?.abort();this.abort=null;this.caption.hide();const lease=this.lease;this.lease=null;this.active=null;this.buffer=null;this.paused=false;lease?.stop();const last=this.played.at(-1);if(last&&!last.ended){last.ended=performance.now();last.reason=reason;}}
  refreshPrefs():void{audio.setNarratorVolume(narratorSettings.get().volume);if(!narratorSettings.get().enabled||narratorSettings.get().volume===0)this.stop('disabled');else if(!narratorSettings.get().subtitles)this.caption.hide();else if(this.active&&!this.paused)this.caption.show(this.active.subtitle,this.active.event);}
  stats(){return{active:this.active?.id??null,event:this.active?.event??null,paused:this.paused,cache:this.cache.size,pending:!!this.abort,history:this.played.slice()};}
}
