import assert from 'node:assert/strict';
import { RouletteEngine } from '../shared/roulette';
import type { RouletteHistoryEntry } from '../shared/roulette';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';
import { getModifier } from '../shared/modifiers';
import { Rng } from '../shared/rng';
import { GameSession } from '../server/GameSession';
import { PlayerSession } from '../server/PlayerSession';

let checks=0;
function check(value:unknown,label:string){assert.ok(value,label);checks++;}
const compatible=(n:number)=>MINIGAME_DEFINITIONS.filter(d=>d.enabled!==false&&n>=d.minPlayers&&n<=d.maxPlayers);
function append(history:RouletteHistoryEntry[],id:string){const def=MINIGAME_DEFINITIONS.find(d=>d.id===id)!;history.push({round:history.length+1,minigameId:id,category:def.category});}
function verify(n:number,history:RouletteHistoryEntry[],id:string){
 const eligible=compatible(n);check(eligible.some(d=>d.id===id),'solo giochi compatibili');
 const last=history.findLastIndex(h=>h.minigameId===id);
 if(last>=0){const between=new Set(history.slice(last+1).map(h=>h.minigameId));check(eligible.every(d=>d.id===id||between.has(d.id)),'prima di ogni ripetizione sono usciti TUTTI gli altri');}
}
for(let n=2;n<=5;n++)for(let seed=0;seed<30;seed++)for(const pity of [true,false]){
 const history:RouletteHistoryEntry[]=[],rng=new Rng(seed),eligible=compatible(n),first:string[]=[];
 for(let i=0;i<eligible.length*4;i++){
  const pick=RouletteEngine.pick(n,history,rng,{pity});verify(n,history,pick.minigameId);
  if(i<eligible.length)first.push(pick.minigameId);
  else check(pick.minigameId===first[i%eligible.length],'ordine continua anche attraverso il confine dei giri');
  if(pick.modifierId)check(MINIGAME_DEFINITIONS.find(d=>d.id===pick.minigameId)!.compatibleModifiers.includes(pick.modifierId)&&!!getModifier(pick.modifierId),'modificatore compatibile');
  append(history,pick.minigameId);
 }
 check(new Set(first).size===eligible.length,'primo giro contiene tutti una volta');
}
// Storia precedente con duplicati/scelte manuali: il vincolo si applica subito.
{
 const history:RouletteHistoryEntry[]=[];for(const d of compatible(5)){append(history,d.id);if(d.id==='quiz')append(history,d.id);}
 append(history,'goblinTime');append(history,'trentuno');
 const pick=RouletteEngine.pick(5,history,new Rng(11));verify(5,history,pick.minigameId);check(pick.minigameId==='quiz','storia precedente: torna il gioco più lontano, senza azzerare la storia');
}
// Pool dinamico, giochi disattivati e caso unico: nessun blocco né attesa di giochi impossibili.
{
 const old=MINIGAME_DEFINITIONS.map(d=>d.enabled);
 try{
  const history:RouletteHistoryEntry[]=[];for(const d of compatible(5))append(history,d.id);
  MINIGAME_DEFINITIONS.forEach(d=>d.enabled=d.id==='trentuno');
  check(RouletteEngine.pick(5,history,new Rng(1)).minigameId==='trentuno','unico disponibile può ripetersi');
  const empty:RouletteHistoryEntry[]=[];check(RouletteEngine.available(5,empty).length===1,'disattivati esclusi');
  MINIGAME_DEFINITIONS.forEach(d=>d.enabled=false);check(RouletteEngine.available(5,history).length===0,'nessun compatibile');assert.throws(()=>RouletteEngine.pick(5,history,new Rng(1)));checks++;
 }finally{MINIGAME_DEFINITIONS.forEach((d,i)=>d.enabled=old[i]);}
 const history:RouletteHistoryEntry[]=[];for(const d of compatible(1))append(history,d.id);
 check(RouletteEngine.available(5,history).every(d=>d.minPlayers>1),'cambio pool: prima i giochi mai usciti');
}
// FSM server vera: uscita completata, skip senza punti, stanza distinta e restart.
for(let n=2;n<=5;n++){
 const room=new GameSession('CYCLE'+n,n,200,'host');
 for(let i=0;i<n;i++){const p=new PlayerSession(String(i),'P'+i,'token'+i);p.characterId=['goblin','buttafuori','dottore','judoka','ciro'][i];p.ready=true;room.addPlayer(p);}
 const history:RouletteHistoryEntry[]=[];
 try{
  room.selectMinigame('trentuno');room.startGame();
  for(let i=0;i<compatible(n).length*2;i++){
   const id=room.currentMinigame!.minigameId;verify(n,history,id);append(history,id);
   if(i===0){room.skip();room.skip();room.finishMinigame(room.players.map((p,k)=>({playerId:p.id,placement:k+1,score:0})),room.minigameSeq);while(room.phase!=='MINIGAME_ROULETTE')room.skip();}
   else room.skipMinigame();
  }
  check(room.players.some(p=>p.score>0),'risultato completato passa dal sistema punti');
  check(compatible(n).length===17,'pool attuale:17 giochi');
  room.restartMatch();room.players.forEach(p=>p.ready=true);room.selectMinigame('trentuno');room.startGame();check(room.currentMinigame!.minigameId==='trentuno','nuova partita riparte senza giochi bloccati');
 }finally{room.resetToLobby();}
}
check(RouletteEngine.available(5,[]).length===17,'nessuno stato condiviso tra stanze');
console.log(`RULLO: ${checks} controlli superati · nessuna ripetizione prima di tutti gli altri, anche tra giri.`);
