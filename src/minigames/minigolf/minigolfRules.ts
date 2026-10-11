import {AB} from '../../../shared/abilityCatalog';
import type {PlayerSnapshot,PlayerResult} from '../../../shared/types';
import {GOLF} from './minigolfTypes';
import type {Course,GolfPlayer,GolfEvent,Bumper,Point} from './minigolfTypes';
import {createBall,physicsStep,impulse,speed,restoreBall} from './minigolfPhysics';
import {heightAt,supportAt,selectCourses} from './minigolfCourses';
import {activateAbility} from './minigolfAbilities';
export interface GolfCommand {aim:Point;pressed:boolean;released:boolean;held:boolean;cancel:boolean;ability:boolean;version:number}
/** Pure authority: one shot per turn, all balls keep participating in physics. */
export class MinigolfMatch {
 readonly players:GolfPlayer[];readonly courses:Course[];readonly turnOrder:number[];
 courseIndex=0;phase:'intro'|'playing'|'transition'|'ended'='intro';phaseTime=GOLF.intro as number;
 time=0;remaining=GOLF.holeSeconds as number;extras:Bumper[]=[];events:GolfEvent[]=[];
 activeIndex=0;turn=0;stage:'aim'|'rolling'|'switch'='aim';aimRemaining=GOLF.aimSeconds as number;rollTime=0;
 private orderIndex=0;private accumulator=0;private switchTime=0;private consumed=false;
 constructor(roster:PlayerSnapshot[],next:()=>number,courses?:Course[]){
  this.courses=(courses??selectCourses(next)).slice(0,1);
  this.players=roster.map(p=>({id:p.id,characterId:p.characterId,name:p.displayName,color:p.color,bot:!!p.bot,ball:createBall(p.id,{x:0,z:0}),
   aim:{x:0,z:-1},charge:0,charging:false,blocked:true,cancelVersion:0,strokes:0,penalties:0,total:0,totalPenalties:0,finished:false,
   completed:0,ones:0,completionTime:0,holeShots:0,used:false,armed:null,prediction:0,debt:0,specialShot:false,records:[]}));
  this.turnOrder=this.players.map((_,i)=>i);
  for(let i=this.turnOrder.length-1;i>0;i--){const j=Math.max(0,Math.min(i,Math.floor(next()*(i+1))));[this.turnOrder[i],this.turnOrder[j]]=[this.turnOrder[j],this.turnOrder[i]];}
  this.spawn();
 }
 get course():Course{return this.courses[this.courseIndex];}
 get active():GolfPlayer{return this.players[this.activeIndex];}
 get aiming():boolean{return this.phase==='playing'&&this.stage==='aim'&&!this.active.finished&&this.remaining>0;}
 get allResting():boolean{return this.players.every(p=>p.finished||(p.ball.grounded&&p.ball.readyFor>=.18));}
 spawn():void {
  this.time=0;this.remaining=GOLF.holeSeconds;this.extras=[];this.orderIndex=0;this.turn=0;this.stage='aim';this.aimRemaining=GOLF.aimSeconds;this.rollTime=0;this.consumed=false;
  this.activeIndex=this.turnOrder[0];
  this.players.forEach((p,i)=>{const pos={x:this.course.spawn.x+(i-(this.players.length-1)/2)*.8,z:this.course.spawn.z},f=supportAt(this.course,pos,0)!;
   p.ball=createBall(p.id,pos,heightAt(f,pos));const target=this.course.waypoints[0]??this.course.hole,dx=target.x-pos.x,dz=target.z-pos.z,len=Math.hypot(dx,dz)||1;
   Object.assign(p,{aim:{x:dx/len,z:dz/len},strokes:0,penalties:0,finished:false,holeShots:0,charge:0,charging:false,blocked:true,used:false,armed:null,prediction:0,debt:0,specialShot:false});});
 }
 cancel(p:GolfPlayer):void {p.charging=false;p.charge=0;p.blocked=true;}
 cancelAll():void {for(const p of this.players)this.cancel(p);}
 command(p:GolfPlayer,c:GolfCommand,dt:number):void {
  if(p.cancelVersion!==c.version){this.cancel(p);p.cancelVersion=c.version;}
  if(this.phase!=='playing'||p.finished||p!==this.active||this.stage==='switch'){this.cancel(p);return;}
  if(this.aiming){const len=Math.hypot(c.aim.x,c.aim.z);if(Number.isFinite(len)&&len>.18)p.aim={x:c.aim.x/len,z:c.aim.z/len};}
  if(c.cancel){this.cancel(p);return;}
  if(p.blocked){if(!c.held&&!c.pressed)p.blocked=false;return;}
  if(c.ability){const fail=this.stage==='rolling'&&p.characterId!=='judoka'?'ASPETTA IL TUO TIRO':activateAbility(p,this.course,this.time,this.extras);
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
  if(this.phase!=='playing'){this.phaseTime-=dt;if(this.phaseTime<=0){this.phase='playing';this.cancelAll();}return;}
  this.time+=dt;const was=this.remaining;this.remaining=Math.max(0,GOLF.holeSeconds-this.time);
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
    this.active.completionTime+=dt;this.aimRemaining=Math.max(0,this.aimRemaining-dt);
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
   this.activeIndex=index;this.turn++;this.stage='aim';this.aimRemaining=GOLF.aimSeconds;this.rollTime=0;this.consumed=false;this.cancelAll();return;}
  this.end();
 }
 private end():void {this.cancelAll();this.phase='ended';}
 private limit(p:GolfPlayer):void {this.finishHole(p,false);this.events.push({type:'limit',id:p.id,x:p.ball.x,z:p.ball.z});}
 private payDebt(p:GolfPlayer):void {
  if(!p.specialShot)return;p.debt=0;p.specialShot=false;p.strokes+=AB.minigolf.ciro.p.penalty;p.penalties+=AB.minigolf.ciro.p.penalty;
  this.events.push({type:'penalty',id:p.id,x:p.ball.x,z:p.ball.z,value:AB.minigolf.ciro.p.penalty});
 }
 private finishHole(p:GolfPlayer,completed:boolean):void {
  if(p.finished)return;p.finished=true;p.ball.done=true;p.ball.vx=p.ball.vy=p.ball.vz=0;this.cancel(p);
  if(!completed){p.strokes=Math.max(this.course.maxStrokes+2,p.strokes+2);p.penalties+=2;}
  p.total+=p.strokes;p.totalPenalties+=p.penalties;p.completed+=completed?1:0;
  if(completed&&p.holeShots===1&&p.penalties===0)p.ones++;
  p.records.push({course:this.course.id,strokes:p.strokes,penalties:p.penalties,completed,seconds:p.completionTime});
 }
 results():PlayerResult[] {
  return [...this.players].sort((a,b)=>a.total-b.total||a.totalPenalties-b.totalPenalties||a.completionTime-b.completionTime||this.players.indexOf(a)-this.players.indexOf(b))
   .map((p,i)=>({playerId:p.id,placement:i+1,score:p.total,stats:[`${p.total} colpi · ${p.totalPenalties} penalità`,`${p.completed?'✓ IMBUCATA':'DNF'} · PAR ${this.course.par}`,`${p.completionTime.toFixed(1)} s di mira`]}));
 }
}
