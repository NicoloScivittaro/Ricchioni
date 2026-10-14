import { game as gm } from '../../core/GameManager';
import { audio } from '../../core/AudioManager';
import { NarratorFacts } from './NarratorFacts';
import { NarratorHistory } from './NarratorHistory';
import { NarratorPlayer,NARRATOR_MEDIA } from './NarratorPlayer';
import { narratorSettings } from './NarratorSettings';
import type { NarratorEvent } from './NarratorLines';
import type { RoomState } from '../../../shared/types';
const player=new NarratorPlayer(),facts=new NarratorFacts();let storage:Storage|null=null;try{storage=sessionStorage;}catch{}
const history=new NarratorHistory(storage);let state:RoomState|null=null,started=false,controls=false,lastRoom='',previousPhase='LOBBY';let heartbeat:ReturnType<typeof setInterval>|null=null;const stops:(()=>void)[]=[];
function permitted(event:NarratorEvent):boolean{
  if(!state||controls||state.paused||!narratorSettings.get().enabled||narratorSettings.get().volume<=0||audio.isMuted())return false;
  return event==='result'?['ROUND_RESULTS','GLOBAL_LEADERBOARD'].includes(state.phase):event==='game'?['MINIGAME_ROULETTE','MINIGAME_INTRO'].includes(state.phase):state.phase==='MINIGAME_ROULETTE';
}
function speak(event:NarratorEvent,maxSeconds:number,result:ReturnType<NarratorFacts['analyse']>|null=null):void{
  if(!permitted(event)||!state)return;
  const line=history.select(event,state.currentMinigame?.minigameId??null,result,state.players,maxSeconds,id=>NARRATOR_MEDIA[id]?.duration??null);if(!line)return;
  void player.play(line,performance.now()+maxSeconds*1000,()=>history.played(line));
}
function shown(kind:'roller'|'game'|'result'):void{
  if(!state)return;const id=`${state.roomCode}:${state.roundId}:${kind}`;if(!history.claim(id))return;
  if(kind==='result'){
    if(!state.lastResults||state.phase!=='ROUND_RESULTS')return;
    const context=facts.analyse(state.players,state.lastResults);speak(kind,5.1,context);
  }else if(kind==='game')speak(kind,state.phase==='MINIGAME_INTRO'?2.3:4.4);
  else if(narratorSettings.get().frequency==='chatty'||Math.random()<.6)speak(kind,4.1);
}
export const narrator={
  init():void{
    if(started)return;started=true;player.refreshPrefs();
    stops.push(gm.events.on('state',payload=>{
      const next=payload as RoomState;const newSession=next.roomCode!==lastRoom||next.phase==='LOBBY'&&previousPhase!=='LOBBY';
      if(newSession){facts.reset();player.stop('lobby');}lastRoom=next.roomCode;previousPhase=next.phase;state=next;
      const current=player.stats();if(next.paused)player.pause();else if(current.paused&&current.event&&permitted(current.event))player.resume();
      if(current.event&&!permitted(current.event)&&!next.paused)player.stop('phase');
    }),gm.events.on('narrator.roller',()=>shown('roller')),gm.events.on('narrator.game',()=>shown('game')),gm.events.on('narrator.results',()=>shown('result')),
    gm.events.on('narrator.controls',value=>{controls=!!value;if(controls)player.stop('controls');}),narratorSettings.on(()=>player.refreshPrefs()));
    const skip=(event:KeyboardEvent)=>{if(event.code==='Space'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!(event.target as HTMLElement|null)?.closest('input,select,textarea,[contenteditable]'))player.stop('skipped');};window.addEventListener('keydown',skip,true);stops.push(()=>window.removeEventListener('keydown',skip,true));
    const leaving=()=>player.stop('page');window.addEventListener('pagehide',leaving);stops.push(()=>window.removeEventListener('pagehide',leaving));
    heartbeat=setInterval(()=>{const current=player.stats();if(current.event&&!permitted(current.event)&&!(current.paused&&state?.paused&&narratorSettings.get().enabled&&!audio.isMuted()))player.stop('unavailable');},100);
  },
  dispose():void{stops.splice(0).forEach(fn=>fn());if(heartbeat)clearInterval(heartbeat);heartbeat=null;player.stop('dispose');started=false;state=null;controls=false;},
  stats:()=>({...player.stats(),listeners:stops.length,initialized:started}),
  skip:()=>player.stop('skipped')
};
