import type { PlayerPublic,RoundResults } from '../../../shared/types';
import type { Condition } from './NarratorLines';
export interface ResultFacts {conditions:Set<Condition>;subjects:Partial<Record<Condition,string[]>>;winners:string[];losers:string[]}
/** Solo dati del server: mai inferire kill/scarti/errori dai testi liberi delle statistiche. */
export class NarratorFacts {
  private wins=new Map<string,number>();private losses=new Map<string,number>();
  reset():void{this.wins.clear();this.losses.clear();}
  analyse(players:readonly PlayerPublic[],out:RoundResults):ResultFacts{
    const rows=out.results.filter(r=>players.some(p=>p.id===r.playerId)&&Number.isFinite(r.placement));
    const conditions=new Set<Condition>(),subjects:ResultFacts['subjects']={};if(!rows.length)return {conditions,subjects,winners:[],losers:[]};
    const first=Math.min(...rows.map(r=>r.placement)),last=Math.max(...rows.map(r=>r.placement));
    const winners=rows.filter(r=>r.placement===first).map(r=>r.playerId),losers=first===last?[]:rows.filter(r=>r.placement===last).map(r=>r.playerId);
    const human=(id:string)=>!players.find(p=>p.id===id)!.bot;
    const set=(condition:Condition,ids:string[]=[])=>{conditions.add(condition);subjects[condition]=ids;};
    if(new Set(rows.map(r=>r.placement)).size<rows.length)set('tie');
    if(winners.length===1)set(human(winners[0])?'winner':'botWinner',winners);
    if(losers.length===1)set(human(losers[0])?'loser':'botLoser',losers);
    for(const p of players){const win=winners.length===1&&winners[0]===p.id,lose=losers.length===1&&losers[0]===p.id;
      this.wins.set(p.id,win?(this.wins.get(p.id)??0)+1:0);this.losses.set(p.id,lose?(this.losses.get(p.id)??0)+1:0);
      if(!p.bot&&this.wins.get(p.id)===3)set('winningStreak',[p.id]);if(!p.bot&&this.losses.get(p.id)===3)set('losingStreak',[p.id]);
    }
    const before=players.map(p=>({id:p.id,score:p.score-(out.deltas[p.id]??0)})),after=players.map(p=>({id:p.id,score:p.score}));
    const beforeMax=Math.max(...before.map(p=>p.score)),afterMax=Math.max(...after.map(p=>p.score)),beforeLeaders=before.filter(p=>p.score===beforeMax),afterLeaders=after.filter(p=>p.score===afterMax);
    if(beforeLeaders.length===1&&afterLeaders.length===1&&beforeLeaders[0].id!==afterLeaders[0].id)set('leaderChange',[afterLeaders[0].id]);
    const bottom=before.filter(p=>p.score===Math.min(...before.map(p=>p.score)));
    if(players.length>=3&&bottom.length===1&&beforeMax>bottom[0].score&&winners.length===1&&winners[0]===bottom[0].id&&human(winners[0]))set('comeback',winners);
    const sorted=after.slice().sort((a,b)=>b.score-a.score);if(sorted.length>1&&sorted[0].score-sorted[1].score>=10)set('gap',[sorted[0].id]);
    return {conditions,subjects,winners,losers};
  }
}
