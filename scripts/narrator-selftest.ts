import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { NARRATOR_LINES } from '../src/audio/narrator/NarratorLines';
import { NarratorFacts } from '../src/audio/narrator/NarratorFacts';
import { NarratorHistory } from '../src/audio/narrator/NarratorHistory';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';
import type { PlayerPublic,RoundResults } from '../shared/types';
const media=JSON.parse(readFileSync('public/audio/narrator/manifest.json','utf8'));let checks=0;
const ok=(value:unknown,label:string)=>{assert.ok(value,label);checks++;};
ok(NARRATOR_LINES.length>=120&&new Set(NARRATOR_LINES.map(l=>l.id)).size===NARRATOR_LINES.length,'134 battute uniche');
for(const l of NARRATOR_LINES){ok(l.text.length>12&&l.subtitle===l.text&&l.weight>0&&l.cooldown>0,'metadati coerenti');ok(!!media[l.id]&&existsSync('public'+l.asset)&&media[l.id].duration>1&&media[l.id].duration<6,'audio reale per '+l.id);}
for(const character of ['goblin','buttafuori','dottore','judoka','ciro'])ok(NARRATOR_LINES.filter(l=>l.character===character).length>=10,'dieci personali '+character);
for(const game of MINIGAME_DEFINITIONS)ok(NARRATOR_LINES.filter(l=>l.game===game.id).length>=2,'annunci del gioco realmente esistente '+game.id);
ok(NARRATOR_LINES.filter(l=>l.game).every(l=>MINIGAME_DEFINITIONS.some(g=>g.id===l.game)),'nessun gioco inesistente');
const players:PlayerPublic[]=['goblin','buttafuori','dottore'].map((characterId,i)=>({id:String(i),displayName:'Persona '+i,characterId,ready:true,connected:true,score:0}));
const out=(placements=[1,2,3],deltas=[10,6,3]):RoundResults=>({results:players.map((p,i)=>({playerId:p.id,placement:placements[i],score:777,stats:['999 kill inventate']})),ranking:players.map(p=>p.id),deltas:Object.fromEntries(players.map((p,i)=>[p.id,deltas[i]])),double:false});
{
 const facts=new NarratorFacts();const state=players.map((p,i)=>({...p,score:[10,6,3][i]})),result=facts.analyse(state,out());ok(result.winners[0]==='0'&&result.losers[0]==='2','primo e ultimo corretti');ok(!result.conditions.has('comeback')&&!result.conditions.has('leaderChange')&&!result.conditions.has('gap'),'nessun evento inventato iniziale');
 facts.analyse(state,out());const third=facts.analyse(state,out());ok(third.conditions.has('winningStreak')&&third.conditions.has('losingStreak'),'terza vittoria/perdita di fila');ok(!facts.analyse(state,out()).conditions.has('winningStreak'),'quarta non raccontata come terza');facts.reset();ok(!facts.analyse(state,out()).conditions.has('winningStreak'),'reset nuova partita');
 const tie=facts.analyse(state,out([1,1,3]));ok(tie.conditions.has('tie')&&!tie.conditions.has('winner'),'ex aequo non assegna vincitore falso');const bottom=facts.analyse(state,out([1,2,2]));ok(bottom.losers.length===2&&!bottom.conditions.has('loser'),'ultimi ex aequo corretti');
 const all=facts.analyse(state,out([1,1,1]));ok(all.losers.length===0,'tutti pari non perdenti');
 const bot=facts.analyse(state.map((p,i)=>({...p,bot:i===0})),out());ok(bot.conditions.has('botWinner')&&!bot.conditions.has('winner'),'bot distinto da persona');
 const comeback=facts.analyse(players.map((p,i)=>({...p,score:[12,20,13][i]})),out([1,2,3],[10,1,1]));ok(comeback.conditions.has('comeback'),'rimonta dal fondo solo provata');
 const leader=facts.analyse(players.map((p,i)=>({...p,score:[22,20,13][i]})),out([1,2,3],[10,1,1]));ok(leader.conditions.has('leaderChange'),'leader precedente diverso provato');
 const gap=facts.analyse(players.map((p,i)=>({...p,score:[30,6,3][i]})),out());ok(gap.conditions.has('gap'),'distacco globale provato');
}
{
 const history=new NarratorHistory(),facts=new NarratorFacts().analyse(players.map((p,i)=>({...p,score:[10,6,3][i]})),out()),duration=(id:string)=>media[id]?.duration??null;
 ok(history.claim('room:1:result')&&!history.claim('room:1:result'),'evento non si duplica');
 for(let i=0;i<30;i++){const line=history.select('result',null,facts,players,5.1,duration,100000+i*1000,()=>.1);if(line){ok(line.condition==='winner'||line.condition==='loser','solo condizioni vere');ok(!line.character||line.character==='goblin'||line.character==='dottore','nome del personaggio corretto');history.played(line,100000+i*1000);const next=history.select('result',null,facts,players,5.1,duration,100000+i*1000,()=>.1);ok(next?.id!==line.id,'anti ripetizione con memoria');}}
 for(const g of MINIGAME_DEFINITIONS){const h=new NarratorHistory(),l=h.select('game',g.id,null,players,5.1,duration,Date.now(),()=>.1);ok(l?.game===g.id,'annuncio solo gioco scelto '+g.id);}
 ok(new NarratorHistory().select('roller',null,null,players,.1,duration)===null,'non accoda clip che non entra nella finestra');
 const memory=new Map<string,string>(),storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,val:string)=>{memory.set(key,val);}};const first=new NarratorHistory(storage);first.claim('reconnect-event');ok(!new NarratorHistory(storage).claim('reconnect-event'),'reload non rilegge evento già visto');
}
writeFileSync('docs/agent-work/narrator/logic-tests.json',JSON.stringify({checks,lines:NARRATOR_LINES.length,games:MINIGAME_DEFINITIONS.length,allAssets:true},null,2));console.log(`NARRATORE: ${checks} controlli logica/134 clip superati.`);
