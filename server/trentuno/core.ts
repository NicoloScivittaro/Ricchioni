import { randomUUID, randomInt } from 'node:crypto';
import { Rng } from '../../shared/rng';
import { DECK } from '../../shared/trentuno/deck';
import { bestDiscard,handScore } from '../../shared/trentuno/scoring';
import { RULES } from '../../shared/trentuno/rules';
import type { Ack,Command,HandResult,Phase,PrivateState,PublicState,Seat } from '../../shared/trentuno/types';
import type { PlayerResult } from '../../shared/types';
import { AB,abilityFor } from '../../shared/abilityCatalog';

/** RNG di produzione non predicibile da UUID/stato pubblico; seed solo nei test. */
class SecretRng extends Rng { override next():number {return randomInt(0,0x100000000)/0x100000000;} }
export class TrentunoGame {
  readonly matchId=randomUUID();version=1;paused=false;phase:Phase='draw';handNumber=0;turnIndex=0;turnNumber=0;
  deck:string[]=[];discard:string[]=[];hands=new Map<string,string[]>();used=new Set<string>();history:HandResult[]=[];results:PlayerResult[]|null=null;
  knocker:string|null=null;finalTurns:number|null=null;blockedFor:string|null=null;
  private drawn:string|null=null;private source:'deck'|'discard'|null=null;private peek:string[]=[];private extended=false;
  private deadline=0;private handStart=0;private now=0;private botAt=0;private sequence=0;
  private log:PublicState['log']=[];private accepted=new Map<string,Ack>();private rng:Rng;private first:number;
  constructor(readonly roundId:number,readonly seats:readonly Seat[],seed?:number) {
    if(seats.length<2||seats.length>5||new Set(seats.map(s=>s.id)).size!==seats.length)throw Error('Servono 2–5 giocatori unici');
    this.rng=seed===undefined?new SecretRng():new Rng(seed);this.first=this.rng.int(0,seats.length-1);this.startHand();
  }
  get turn():string{return this.seats[this.turnIndex].id;}
  private event(kind:string,text:string,playerId?:string,cardId?:string):void {this.log.push({id:++this.sequence,kind,text,playerId,cardId});this.log=this.log.slice(-12);}
  private enter(phase:Phase,duration:number):void {this.phase=phase;this.deadline=this.now+duration;this.botAt=this.now+RULES.botDelay;}
  private startHand():void {
    this.handNumber++;this.deck=this.rng.shuffle(DECK.map(c=>c.id));this.discard=[];this.hands.clear();
    for(const s of this.seats)this.hands.set(s.id,this.deck.splice(0,3));this.discard.push(this.deck.shift()!);
    this.turnIndex=(this.first+this.handNumber-1)%this.seats.length;this.turnNumber=1;this.knocker=null;this.finalTurns=null;this.blockedFor=null;this.extended=false;this.drawn=null;this.source=null;this.peek=[];this.handStart=this.now;
    this.enter('draw',RULES.decision);this.event('deal',`Mano ${this.handNumber} di ${RULES.hands} · carte distribuite`);this.check31();this.assertInvariants();
  }
  private ensureDeck(min=1):void {
    if(this.deck.length<min&&this.discard.length>1){const top=this.discard.pop()!;this.deck.push(...this.rng.shuffle(this.discard));this.discard=[top];this.event('shuffle','Gli scarti tornano nel mazzo · cima conservata');}
  }
  private draw(take=false):void {
    const hand=this.hands.get(this.turn)!;this.ensureDeck();
    this.drawn=take?this.discard.pop()!:this.deck.shift()!;hand.push(this.drawn);this.source=take?'discard':'deck';
    this.event(take?'take':'draw',`${this.name(this.turn)} ${take?'prende dagli scarti':'pesca coperto'}`,this.turn,take?this.drawn:undefined);this.enter('discard',RULES.discard);
  }
  private drop(cardId:string):void {
    const hand=this.hands.get(this.turn)!;hand.splice(hand.indexOf(cardId),1);this.discard.push(cardId);this.event('discard',`${this.name(this.turn)} scarta`,this.turn,cardId);
    this.drawn=null;this.source=null;if(!this.check31())this.nextTurn();
  }
  private nextTurn():void {
    if(this.blockedFor===this.turn)this.blockedFor=null;
    if(this.finalTurns!==null){this.finalTurns--;if(this.finalTurns<=0){this.endHand('bussata');return;}}
    this.turnIndex=(this.turnIndex+1)%this.seats.length;this.turnNumber++;this.enter('draw',RULES.decision);
  }
  private check31():boolean {
    if(this.seats.some(s=>{const hand=this.hands.get(s.id)!;return hand.length===3&&handScore(hand)===31;})){this.endHand('31');return true;}return false;
  }
  private endHand(reason:HandResult['reason']):void {
    const sorted=this.seats.map(s=>({playerId:s.id,cards:[...this.hands.get(s.id)!],score:handScore(this.hands.get(s.id)!)})).sort((a,b)=>b.score-a.score);
    const rows=sorted.map((r,i)=>{const placement=1+sorted.filter(q=>q.score>r.score).length;return {...r,placement,points:this.seats.length-placement};});
    this.history.push({number:this.handNumber,reason,rows});this.event(reason==='31'?'31':'reveal',reason==='31'?"TRENTUNO! VE L'HO MESSA IN CULO A TUTTI!":`Fine mano · ${reason}`);
    if(this.handNumber>=RULES.hands||reason==='limite totale'){this.finish();}else this.enter('handResult',RULES.resultHold);
  }
  private finish():void {
    const totals=this.seats.map(s=>({playerId:s.id,score:this.history.reduce((sum,h)=>sum+h.rows.find(r=>r.playerId===s.id)!.points,0),sum:this.history.reduce((sum,h)=>sum+h.rows.find(r=>r.playerId===s.id)!.score,0)})).sort((a,b)=>b.score-a.score||b.sum-a.sum);
    this.results=totals.map(r=>({playerId:r.playerId,score:r.score,placement:1+totals.filter(q=>q.score>r.score||q.score===r.score&&q.sum>r.sum).length,stats:[`Punti delle mani: ${r.score}`,`Somma carte: ${r.sum}`,`Mani giocate: ${this.history.length}`]}));this.enter('finished',RULES.resultHold);
  }
  private name(id:string):string{return this.seats.find(s=>s.id===id)!.name;}
  private available(id:string):boolean {
    if(this.used.has(id)||this.paused)return false;
    const char=this.seats.find(s=>s.id===id)!.characterId;
    if(char==='judoka')return this.phase==='knockWindow'&&this.knocker!==id&&!this.extended;
    if(id!==this.turn)return false;
    if(char==='goblin')return this.phase==='discard'&&this.source==='deck';
    return ['buttafuori','dottore','ciro'].includes(char)&&this.phase==='draw';
  }
  private ability(id:string,c:Command):void {
    const char=this.seats.find(s=>s.id===id)!.characterId;
    if(char==='ciro'&&(!c.cardId||!this.hands.get(id)!.includes(c.cardId)||!c.targetId||c.targetId===id||!this.hands.has(c.targetId)))throw Error('Scegli una tua carta e un avversario');
    this.used.add(id);this.event('ability',`${this.name(id)} · ${abilityFor('trentuno',char)!.name}`,id);
    if(char==='goblin'){
      const hand=this.hands.get(id)!,old=this.drawn!;hand.splice(hand.indexOf(old),1);this.ensureDeck();this.deck.push(old);this.drawn=this.deck.shift()!;hand.push(this.drawn);
      // La seconda sostituisce la prima, che non è più una scelta in mano.
    }else if(char==='buttafuori')this.blockedFor=this.seats[(this.turnIndex+AB.trentuno.buttafuori.p.turns)%this.seats.length].id;
    else if(char==='dottore'){this.ensureDeck(AB.trentuno.dottore.p.peek);this.peek=this.deck.slice(0,AB.trentuno.dottore.p.peek);this.enter('peek',RULES.peek);}
    else if(char==='judoka'){this.finalTurns!+=AB.trentuno.judoka.p.extra*this.seats.length;this.extended=true;}
    else if(char==='ciro'){
      const own=this.hands.get(id)!,other=this.hands.get(c.targetId!)!,a=own.indexOf(c.cardId!),b=this.rng.int(0,other.length-1);[own[a],other[b]]=[other[b],own[a]];this.check31();
    }
  }
  /** I bot consultano soltanto il proprio snapshot autorizzato. */
  private runBot(id:string):void {
    const s=this.privateState(id),char=this.seats.find(p=>p.id===id)!.characterId;
    const send=(op:Command['op'],extra:Partial<Command>={})=>this.command(id,{roundId:this.roundId,matchId:this.matchId,version:this.version,requestId:`bot-${++this.sequence}`,op,...extra});
    if(s.ability.available){
      const want=char==='judoka'||char==='buttafuori'||char==='dottore'||char==='ciro'||char==='goblin'&&handScore(s.hand.slice(0,-1))>=handScore(s.hand.filter(c=>c!==bestDiscard(s.hand)));
      if(want&&this.rng.chance(.7)){
        if(char==='ciro'){const targets=s.table.players.filter(p=>p.id!==id).sort((a,b)=>b.points-a.points);send('ability',{cardId:bestDiscard(s.hand),targetId:targets[0].id});}else send('ability');this.botAt=this.now+RULES.botDelay;return;
      }
    }
    if(this.phase==='peek'&&id===this.turn){const first=s.peek[0],second=s.peek[1];send('order',{reverse:handScore([...s.hand,second].filter(c=>c!==bestDiscard([...s.hand,second])))>handScore([...s.hand,first].filter(c=>c!==bestDiscard([...s.hand,first])))});}
    else if(s.canKnock&&s.score>=25)send('knock');
    else if(s.canDraw){const top=s.table.discardTop,h=[...s.hand,top];const better=top&&handScore(h.filter(c=>c!==bestDiscard(h,top)))>s.score;send(s.canTake&&better&&!this.rng.chance(.06)?'take':'draw');}
    else if(s.discardable.length){const best=bestDiscard(s.hand,s.discardable.length===3?s.hand.find(c=>!s.discardable.includes(c))!:null);send('discard',{cardId:this.rng.chance(.04)?this.rng.pick(s.discardable):best});}
    this.botAt=this.now+RULES.botDelay;
  }
  command(id:string,c:Command):Ack {
    if(!c||typeof c.requestId!=='string'||c.requestId.length<1||c.requestId.length>100)return {ok:false,error:'Richiesta non valida'};
    const key=id+':'+c.requestId,previous=this.accepted.get(key);if(previous)return previous;
    if(!this.seats.some(s=>s.id===id)||c.roundId!==this.roundId||c.matchId!==this.matchId)return {ok:false,error:'Partita non valida'};
    if(c.version!==this.version)return {ok:false,error:'Tavolo aggiornato: riprova'};
    if(this.paused||this.phase==='finished'||this.phase==='handResult')return {ok:false,error:'Attendi il tavolo'};
    const privateState=this.privateState(id);
    switch(c.op){
      case 'draw':if(!privateState.canDraw)return {ok:false,error:'Non puoi pescare ora'};this.draw();break;
      case 'take':if(!privateState.canTake)return {ok:false,error:'Scarti bloccati o vuoti'};this.draw(true);break;
      case 'discard':if(!c.cardId||!privateState.discardable.includes(c.cardId))return {ok:false,error:'Scarto non valido'};this.drop(c.cardId);break;
      case 'knock':if(!privateState.canKnock)return {ok:false,error:'Non puoi bussare ora'};if(this.blockedFor===id)this.blockedFor=null;this.knocker=id;this.finalTurns=this.seats.length-1;this.event('knock',`${this.name(id)} · HA BUSSATO STO INFAME!`,id);this.enter('knockWindow',RULES.knockWindow);break;
      case 'ability':if(!privateState.ability.available)return {ok:false,error:'Abilità non disponibile'};try{this.ability(id,c);}catch(e){return {ok:false,error:(e as Error).message};}break;
      case 'order':if(id!==this.turn||this.phase!=='peek'||typeof c.reverse!=='boolean')return {ok:false,error:'Ordine non valido'};if(c.reverse)[this.deck[0],this.deck[1]]=[this.deck[1],this.deck[0]];this.peek=[];this.enter('draw',RULES.decision);break;
      default:return {ok:false,error:'Comando sconosciuto'};
    }
    this.version++;this.assertInvariants();const ack={ok:true,version:this.version};this.accepted.set(key,ack);if(this.accepted.size>256)this.accepted.delete(this.accepted.keys().next().value!);return ack;
  }
  tick(dt:number):void {
    if(this.paused||this.phase==='finished')return;this.now+=Math.max(0,dt);
    if(this.phase==='handResult'){if(this.now>=RULES.matchLimit){this.finish();this.version++;}else if(this.now>=this.deadline){this.startHand();this.version++;}return;}
    if(this.now>=RULES.matchLimit||this.now-this.handStart>=RULES.handLimit){
      if(this.phase==='discard'){this.drop(bestDiscard(this.hands.get(this.turn)!,this.source==='discard'?this.drawn:null));if(this.phase as Phase==='finished'||this.phase as Phase==='handResult'){this.version++;return;}}
      this.peek=[];this.endHand(this.now>=RULES.matchLimit?'limite totale':'tempo mano');this.version++;this.assertInvariants();return;
    }
    if(this.now>=this.deadline){
      if(this.phase==='draw')this.draw();else if(this.phase==='discard')this.drop(bestDiscard(this.hands.get(this.turn)!,this.source==='discard'?this.drawn:null));
      else if(this.phase==='peek'){this.peek=[];this.enter('draw',RULES.decision);}else if(this.phase==='knockWindow'){this.turnIndex=(this.turnIndex+1)%this.seats.length;this.turnNumber++;this.enter('draw',RULES.decision);}
      this.version++;this.assertInvariants();
    }
    if(this.now>=this.botAt){const bot=this.phase==='knockWindow'?this.seats.find(s=>s.bot&&s.characterId==='judoka'&&this.available(s.id)):this.seats.find(s=>s.bot&&s.id===this.turn);if(bot)this.runBot(bot.id);}
  }
  publicState():PublicState {
    return {type:'trentunoPublic',roundId:this.roundId,matchId:this.matchId,version:this.version,phase:this.phase,handNumber:this.handNumber,turn:this.turn,turnNumber:this.turnNumber,remaining:Math.max(0,this.deadline-this.now),handRemaining:Math.max(0,RULES.handLimit-this.now+this.handStart),matchRemaining:Math.max(0,RULES.matchLimit-this.now),paused:this.paused,deckCount:this.deck.length,discardTop:this.discard.at(-1)??'',knocker:this.knocker,finalTurns:this.finalTurns,blockedFor:this.blockedFor,players:this.seats.map(s=>({...s,count:this.hands.get(s.id)!.length,abilityUsed:this.used.has(s.id),points:this.history.reduce((sum,h)=>sum+h.rows.find(r=>r.playerId===s.id)!.points,0)})),history:structuredClone(this.history),results:this.results?structuredClone(this.results):null,log:structuredClone(this.log)};
  }
  privateState(id:string):PrivateState {
    const hand=[...this.hands.get(id)!],active=id===this.turn&&!this.paused,drawing=active&&this.phase==='draw';
    const ability=abilityFor('trentuno',this.seats.find(s=>s.id===id)!.characterId)!;
    return {type:'trentunoPrivate',roundId:this.roundId,matchId:this.matchId,version:this.version,playerId:id,hand,score:handScore(hand),table:this.publicState(),canDraw:drawing,canTake:drawing&&this.blockedFor!==id&&this.discard.length>0,canKnock:drawing&&!this.knocker,discardable:active&&this.phase==='discard'?hand.filter(c=>this.source!=='discard'||c!==this.drawn):[],peek:active&&this.phase==='peek'?[...this.peek]:[],ability:{name:ability.name,full:ability.full,used:this.used.has(id),available:this.available(id)}};
  }
  assertInvariants():void {
    const cards=[...this.deck,...this.discard,...this.hands.values()].flat();
    if(cards.length!==40||new Set(cards).size!==40||cards.some(c=>!DECK.some(q=>q.id===c)))throw Error('Conservazione delle 40 carte violata');
    for(const s of this.seats){const count=this.hands.get(s.id)!.length;if(count!==(this.phase==='discard'&&s.id===this.turn?4:3))throw Error('Mano di dimensione illegale');}
  }
}
