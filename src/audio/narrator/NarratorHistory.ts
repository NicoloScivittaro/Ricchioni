import { NARRATOR_LINES } from './NarratorLines';
import type { NarratorLine,NarratorEvent } from './NarratorLines';
import type { ResultFacts } from './NarratorFacts';
import type { PlayerPublic } from '../../../shared/types';
interface Record {id:string;time:number}
export class NarratorHistory {
  private recent:Record[]=[];private events:string[]=[];private cursor=0;
  constructor(private storage:Pick<Storage,'getItem'|'setItem'>|null=null){try{const data=JSON.parse(storage?.getItem('ricchioni.narrator.history')??'{}');this.recent=Array.isArray(data.recent)?data.recent.filter((r:Record)=>typeof r.id==='string'&&Number.isFinite(r.time)).slice(-60):[];this.events=Array.isArray(data.events)?data.events.filter((e:unknown)=>typeof e==='string').slice(-256):[];}catch{}}
  private save():void{try{this.storage?.setItem('ricchioni.narrator.history',JSON.stringify({recent:this.recent,events:this.events}));}catch{}}
  claim(id:string):boolean{if(this.events.includes(id))return false;this.events.push(id);this.events=this.events.slice(-256);this.save();return true;}
  played(line:NarratorLine,now=Date.now()):void{this.recent.push({id:line.id,time:now});this.recent=this.recent.slice(-60);this.cursor++;this.save();}
  select(event:NarratorEvent,game:string|null,facts:ResultFacts|null,players:readonly PlayerPublic[],maxDuration:number,duration:(id:string)=>number|null,now=Date.now(),random=Math.random):NarratorLine|null{
    const candidates=NARRATOR_LINES.filter(line=>{
      if(line.event!==event||line.game&&line.game!==game)return false;
      const seconds=duration(line.id);if(seconds===null||seconds>maxDuration)return false;
      if(line.condition&&(!facts||!facts.conditions.has(line.condition)))return false;
      if(line.character&&(!line.condition||!facts?.subjects[line.condition]?.some(id=>players.some(p=>p.id===id&&!p.bot&&p.characterId===line.character))))return false;
      if(this.recent.slice(-12).some(r=>r.id===line.id))return false;
      return !this.recent.some(r=>r.id===line.id&&now-r.time<line.cooldown*1000);
    });
    if(!candidates.length)return null;
    // Alterna personale/generico nelle occasioni comuni; eventi speciali hanno precedenza.
    const special=candidates.filter(c=>c.priority>=3);let pool=special.length?special:candidates.filter(c=>this.cursor%2===0?!!c.character:!c.character);if(!pool.length)pool=candidates;
    const priority=Math.max(...pool.map(c=>c.priority));pool=pool.filter(c=>c.priority===priority);
    let ticket=random()*pool.reduce((sum,c)=>sum+c.weight,0);for(const c of pool){ticket-=c.weight;if(ticket<0)return c;}return pool.at(-1)!;
  }
}
