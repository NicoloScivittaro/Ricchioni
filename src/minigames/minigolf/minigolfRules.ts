import {AB} from '../../../shared/abilityCatalog';
import type {PlayerSnapshot,PlayerResult} from '../../../shared/types';
import {GOLF} from './minigolfTypes';
import type {Course,GolfPlayer,GolfEvent,Bumper,Point} from './minigolfTypes';
import {createBall,physicsStep,impulse,speed,restoreBall} from './minigolfPhysics';
import {heightAt,supportAt,selectCourses} from './minigolfCourses';
import {activateAbility} from './minigolfAbilities';
import {GOLF_TOURNAMENT as TOURNAMENT} from '../../../shared/minigolfTournament';
export interface GolfOptions {holeSeconds?:number;aimSeconds?:number}
const PLAYOFF:Course={id:'spareggio',name:'SPAREGGIO DI PRECISIONE',difficulty:'easy',par:1,maxStrokes:1,color:'#57bc92',tip:'Un solo tiro: vince chi imbuca o si avvicina di più. Abilità sospese nello spareggio.',
 spawn:{x:0,z:4},hole:{x:0,z:-4},holeY:0,floors:[{x:0,z:0,w:12,d:16,y:0}],walls:[],bumpers:[],waypoints:[{x:0,z:-4}]};
const millis=(n:number)=>Math.round(n*1000);
export interface GolfCommand {aim:Point;pressed:boolean;released:boolean;held:boolean;cancel:boolean;ability:boolean;version:number}
/** Pure authority: one shot per turn, all balls keep participating in physics. */
export class MinigolfMatch {
 readonly players:GolfPlayer[];readonly courses:Course[];readonly turnOrder:number[];
 courseIndex=0;phase:'intro'|'playing'|'transition'|'ended'='intro';phaseTime=GOLF.intro as number;
 time=0;remaining=GOLF.holeSeconds as number;extras:Bumper[]=[];events:GolfEvent[]=[];
 activeIndex=0;turn=0;stage:'aim'|'rolling'|'switch'='aim';aimRemaining=GOLF.aimSeconds as number;rollTime=0;
 private orderIndex=0;private accumulator=0;private switchTime=0;private consumed=false;
 readonly holeSeconds:number;readonly aimSeconds:number;playoff=false;
 private playoffPending=false;private playoffIds=new Set<string>();
 readonly playoffScores=new Map<string,{distance:number;seconds:number}>();
 constructor(roster:PlayerSnapshot[],next:()=>number,courses?:Course[],options:GolfOptions={}){
  this.courses=(courses??selectCourses(next)).slice(0,TOURNAMENT.holes);
  if(!this.courses.length)throw new Error('Minigolf requires at least one course');
  this.holeSeconds=Number.isFinite(options.holeSeconds)?Math.max(1,Math.min(TOURNAMENT.maxHoleSeconds,options.holeSeconds!)):GOLF.holeSeconds;
  this.aimSeconds=Number.isFinite(options.aimSeconds)?Math.max(1,Math.min(30,options.aimSeconds!)):GOLF.aimSeconds;
  this.players=roster.map(p=>({id:p.id,characterId:p.characterId,name:p.displayName,color:p.color,bot:!!p.bot,ball:createBall(p.id,{x:0,z:0}),
   aim:{x:0,z:-1},charge:0,charging:false,blocked:true,cancelVersion:0,strokes:0,penalties:0,total:0,totalPenalties:0,finished:false,
   completed:0,ones:0,completionTime:0,holeTime:0,holeShots:0,used:false,armed:null,prediction:0,debt:0,specialShot:false,records:[]}));
  this.turnOrder=this.players.map((_,i)=>i);
  for(let i=this.turnOrder.length-1;i>0;i--){const j=Math.max(0,Math.min(i,Math.floor(next()*(i+1))));[this.turnOrder[i],this.turnOrder[j]]=[this.turnOrder[j],this.turnOrder[i]];}
  this.spawn();
 }
 get course():Course{return this.playoff?PLAYOFF:this.courses[this.courseIndex];}
 get holeNumber():number{return this.courseIndex+1;}
 get shotSeconds():number{return this.playoff?TOURNAMENT.playoffAimSeconds:this.aimSeconds;}
 get active():GolfPlayer{return this.players[this.activeIndex];}
 get aiming():boolean{return this.phase==='playing'&&this.stage==='aim'&&!this.active.finished&&this.remaining>0;}
 get allResting():boolean{return this.players.every(p=>p.finished||(p.ball.grounded&&p.ball.readyFor>=.18));}
 spawn():void {
  this.time=0;this.remaining=this.playoff?200:this.holeSeconds;this.extras=[];this.orderIndex=this.courseIndex%this.turnOrder.length;this.turn++;this.stage='aim';this.aimRemaining=this.shotSeconds;this.rollTime=0;this.consumed=false;
  if(this.playoff)this.orderIndex=this.turnOrder.findIndex(i=>this.playoffIds.has(this.players[i].id));
  this.activeIndex=this.turnOrder[this.orderIndex];
  this.players.forEach((p,i)=>{const pos=this.playoff?{...PLAYOFF.spawn}:this.teePosition((i+this.courseIndex)%this.players.length),f=supportAt(this.course,pos,0)!;
   p.ball=createBall(p.id,pos,heightAt(f,pos));const target=this.course.waypoints[0]??this.course.hole,dx=target.x-pos.x,dz=target.z-pos.z,len=Math.hypot(dx,dz)||1;
   Object.assign(p,{aim:{x:dx/len,z:dz/len},strokes:0,penalties:0,finished:this.playoff&&!this.playoffIds.has(p.id),holeTime:0,holeShots:0,charge:0,charging:false,blocked:true,used:this.playoff,armed:null,prediction:0,debt:0,specialShot:false});
   if(this.playoff)p.ball.done=p!==this.active;});
 }
 /** Equal distance to the first target, rather than advantaging the inside tee. */
 teePosition(slot:number):Point {
  const s=this.course.spawn,t=this.course.waypoints[0]??this.course.hole,dx=s.x-t.x,dz=s.z-t.z,r=Math.hypot(dx,dz)||1;
  const angle=Math.atan2(dx,dz)+(slot-(this.players.length-1)/2)*.8/r;
  return {x:t.x+Math.sin(angle)*r,z:t.z+Math.cos(angle)*r};
 }
 cancel(p:GolfPlayer):void {p.charging=false;p.charge=0;p.blocked=true;}
 cancelAll():void {for(const p of this.players)this.cancel(p);}
 command(p:GolfPlayer,c:GolfCommand,dt:number):void {
  if(p.cancelVersion!==c.version){this.cancel(p);p.cancelVersion=c.version;}
  if(this.phase!=='playing'||p.finished||p!==this.active||this.stage==='switch'){this.cancel(p);return;}
  if(this.aiming){const len=Math.hypot(c.aim.x,c.aim.z);if(Number.isFinite(len)&&len>.18)p.aim={x:c.aim.x/len,z:c.aim.z/len};}
  if(c.cancel){this.cancel(p);return;}
  if(p.blocked){if(!c.held&&!c.pressed)p.blocked=false;return;}
  if(c.ability){const fail=this.playoff?'SPAREGGIO: SOLO PRECISIONE':this.stage==='rolling'&&p.characterId!=='judoka'?'ASPETTA IL TUO TIRO':activateAbility(p,this.course,this.time,this.extras);
   this.events.push({type:'ability',id:p.id,x:p.ball.x,z:p.ball.z,other:fail??undefined});}
  if(!this.aiming){if(p.charging)this.cancel(p);return;}
  if(p.charging&&(!p.ball.grounded||speed(p.ball)>GOLF.readySpeed)){this.cancel(p);return;}
  if(c.pressed&&p.ball.grounded&&p.ball.readyFor>=.18&&p.strokes<this.course.maxStrokes){p.charging=true;p.charge=0;}
  if(p.charging&&c.held)p.charge=Math.min(1,p.charge+Math.max(0,dt)/GOLF.chargeTime);
  if(p.charging&&c.released){
   if(p.specialShot)this.payDebt(p);
   p.holeShots++;p.strokes++;const special=p.armed==='power';
   impulse(p.ball,p.aim,p.charge,special?AB.minigolf.ciro.p.power:1);
   if(p.armed==='bounce')p.ball.bounceBoost=AB.minigolf.goblin.p.bounce;
   if(special){p.debt=AB.minigolf.ciro.p.window;p.specialShot=true;}
   p.armed=null;p.charge=0;p.charging=false;this.consumed=true;this.stage='rolling';this.rollTime=0;
   this.events.push({type:'shot',id:p.id,x:p.ball.x,z:p.ball.z});
  }
 }
 advance(delta:number):void {
  this.accumulator+=Math.max(0,Number.isFinite(delta)?delta:0);
  while(this.accumulator+1e-9>=GOLF.step){this.accumulator-=GOLF.step;this.tick(GOLF.step);}
 }
 private tick(dt:number):void {
  if(this.phase==='ended')return;
  if(this.phase!=='playing'){this.phaseTime-=dt;if(this.phaseTime<=0){
   if(this.phase==='transition'){if(this.playoffPending){this.playoff=true;this.playoffPending=false;}else this.courseIndex++;this.spawn();this.phase='intro';this.phaseTime=GOLF.intro;}
   else {this.phase='playing';this.cancelAll();}
  }return;}
  if(!this.active.finished&&(this.stage==='aim'||this.stage==='rolling'))this.active.holeTime+=dt;
  this.time+=dt;const was=this.remaining;this.remaining=Math.max(0,(this.playoff?200:this.holeSeconds)-this.time);
  if(was>8&&this.remaining<=8)this.events.push({type:'last',id:'',x:0,z:0});
  for(const ev of physicsStep(this.players.map(p=>p.ball),this.course,this.time,dt,this.extras)){
   const p=this.players.find(p=>p.id===ev.id)!;
   if(ev.type==='fall'){
    // A victim displaced by another player's shot gets a free restore, never an extra stroke.
    if(p===this.active&&this.consumed){p.strokes++;p.penalties++;ev.value=1;this.payDebt(p);}else ev.value=0;
    this.cancel(p);
   }
   if(ev.type==='stuck')this.cancel(p);
   if(ev.type==='hole'){
    if(p===this.active&&this.consumed&&p.specialShot&&p.debt>0){p.strokes=Math.max(1,p.strokes-AB.minigolf.ciro.p.discount);p.debt=0;p.specialShot=false;}
    this.finishHole(p,true);
   }
   this.events.push(ev);
  }
  for(const p of this.players){if(p.finished)continue;p.prediction=Math.max(0,p.prediction-dt);
   if(p.debt>0){p.debt-=dt;if(p.debt<=0)this.payDebt(p);}}
  this.extras=this.extras.filter(b=>(b.expires??Infinity)>this.time);
  if(this.players.every(p=>p.finished)){this.end();return;}
  if(this.stage==='aim'){
   if(this.active.finished){this.consumed=true;this.stage='rolling';this.rollTime=0;}
   else if(!this.allResting){this.cancel(this.active);this.stage='rolling';this.rollTime=0;this.consumed=false;}
   else if(this.remaining>0){
    this.aimRemaining=Math.max(0,this.aimRemaining-dt);
    if(this.aimRemaining<=0){this.active.strokes++;this.active.holeShots++;this.cancel(this.active);this.consumed=true;this.stage='rolling';this.rollTime=0;
     this.events.push({type:'penalty',id:this.active.id,x:this.active.ball.x,z:this.active.ball.z,other:'TEMPO SCADUTO · +1 COLPO',value:1});}
   }
  }
  if(this.stage==='rolling'){
   this.rollTime+=dt;
   if(this.rollTime>=GOLF.rollSeconds){for(const p of this.players)if(!p.finished&&p.ball.readyFor<.18){restoreBall(p.ball);p.ball.readyFor=1;this.events.push({type:'stuck',id:p.id,x:p.ball.x,z:p.ball.z});}}
   if(this.allResting){
    if(this.consumed){this.payDebt(this.active);if(!this.active.finished&&this.active.strokes>=this.course.maxStrokes)this.limit(this.active);
     this.cancelAll();this.stage='switch';this.switchTime=GOLF.transition;
    }else this.stage='aim';
   }
  }
  // A published round deadline closes new turns, but lets the shot already in flight settle.
  if(this.remaining<=0&&(this.stage!=='rolling'||this.allResting)){
   for(const p of this.players)if(!p.finished){this.payDebt(p);this.limit(p);}this.end();return;
  }
  if(this.players.every(p=>p.finished)){this.end();return;}
  if(this.stage==='switch'){
   this.switchTime-=dt;if(this.switchTime<=0)this.nextTurn();
  }
 }
 private nextTurn():void {
  for(let i=0;i<this.turnOrder.length;i++){this.orderIndex=(this.orderIndex+1)%this.turnOrder.length;const index=this.turnOrder[this.orderIndex];if(this.players[index].finished)continue;
   this.activeIndex=index;this.turn++;this.stage='aim';this.aimRemaining=this.shotSeconds;this.rollTime=0;this.consumed=false;this.cancelAll();
   if(this.playoff)this.active.ball.done=false;
   return;}
  this.end();
 }
 private end():void {
  this.cancelAll();
  if(this.playoff){this.phase='ended';return;}
  if(this.courseIndex<this.courses.length-1){this.phase='transition';this.phaseTime=TOURNAMENT.intermission;return;}
  const sorted=this.ranked();
  for(let i=1;i<sorted.length;i++)if(this.compareBase(sorted[i-1],sorted[i])===0){this.playoffIds.add(sorted[i-1].id);this.playoffIds.add(sorted[i].id);}
  if(this.playoffIds.size){this.playoffPending=true;this.phase='transition';this.phaseTime=TOURNAMENT.intermission;}
  else this.phase='ended';
 }
 private limit(p:GolfPlayer):void {this.finishHole(p,false);this.events.push({type:'limit',id:p.id,x:p.ball.x,z:p.ball.z});}
 private payDebt(p:GolfPlayer):void {
  if(!p.specialShot)return;p.debt=0;p.specialShot=false;p.strokes+=AB.minigolf.ciro.p.penalty;p.penalties+=AB.minigolf.ciro.p.penalty;
  this.events.push({type:'penalty',id:p.id,x:p.ball.x,z:p.ball.z,value:AB.minigolf.ciro.p.penalty});
 }
 private finishHole(p:GolfPlayer,completed:boolean):void {
  if(p.finished)return;p.finished=true;p.ball.done=true;p.ball.vx=p.ball.vy=p.ball.vz=0;this.cancel(p);
  if(this.playoff){this.playoffScores.set(p.id,{distance:completed?0:Math.round(Math.hypot(p.ball.x-PLAYOFF.hole.x,p.ball.z-PLAYOFF.hole.z)*1000),seconds:completed?millis(p.holeTime):0});return;}
  if(!completed){p.strokes=Math.max(this.course.maxStrokes+2,p.strokes+2);p.penalties+=2;}
  p.total+=p.strokes;p.totalPenalties+=p.penalties;p.completed+=completed?1:0;
  if(completed)p.completionTime+=p.holeTime;
  if(completed&&p.holeShots===1&&p.penalties===0)p.ones++;
  p.records.push({course:this.course.id,strokes:p.strokes,penalties:p.penalties,completed,seconds:p.holeTime});
 }
 private compareBase(a:GolfPlayer,b:GolfPlayer):number {return a.total-b.total||millis(a.completionTime)-millis(b.completionTime);}
 private compareFinal(a:GolfPlayer,b:GolfPlayer):number {
  const base=this.compareBase(a,b);if(base)return base;
  const x=this.playoffScores.get(a.id),y=this.playoffScores.get(b.id);
  return x&&y?x.distance-y.distance||x.seconds-y.seconds:0;
 }
 ranked():GolfPlayer[]{return [...this.players].sort((a,b)=>this.compareFinal(a,b));}
 provisional():GolfPlayer[]{return [...this.players].sort((a,b)=>(a.total+(a.finished||this.playoff?0:a.strokes))-(b.total+(b.finished||this.playoff?0:b.strokes))||millis(a.completionTime)-millis(b.completionTime));}
 rankOf(p:GolfPlayer):number {const score=(q:GolfPlayer)=>q.total+(q.finished||this.playoff?0:q.strokes);return 1+this.players.filter(q=>score(q)<score(p)||score(q)===score(p)&&millis(q.completionTime)<millis(p.completionTime)).length;}
 results():PlayerResult[] {
  const sorted=this.ranked();let placement=1;
  return sorted.map((p,i)=>{if(i&&this.compareFinal(sorted[i-1],p)!==0)placement=i+1;
   const equal=sorted.some(q=>q!==p&&this.compareFinal(q,p)===0);
   return {playerId:p.id,placement,score:p.total,stats:[equal?`EX AEQUO · ${p.total} colpi`:`${p.total} colpi · ${p.completionTime.toFixed(1)}s attivi`,p.records.map((r,j)=>`B${j+1}: ${r.strokes}${r.completed?'':' DNF'}`).join(' · '),equal?'EX AEQUO':`${p.completed}/${this.courses.length} imbucate · ${p.totalPenalties} penalità`]};});
 }
}
