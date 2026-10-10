import {AB} from '../../../shared/abilityCatalog';
import type {PlayerSnapshot,PlayerResult} from '../../../shared/types';
import {GOLF} from './minigolfTypes';
import type {Course,GolfPlayer,GolfEvent,Bumper,Point} from './minigolfTypes';
import {createBall,physicsStep,impulse,speed} from './minigolfPhysics';
import {heightAt,supportAt,selectCourses} from './minigolfCourses';
import {activateAbility} from './minigolfAbilities';
export interface GolfCommand {aim:Point;pressed:boolean;released:boolean;held:boolean;cancel:boolean;ability:boolean;version:number}
/** Pure authority. Rendering/networking/audio only consume its events and state. */
export class MinigolfMatch {
 readonly players:GolfPlayer[];
 readonly courses:Course[];
 courseIndex=0;phase:'intro'|'playing'|'transition'|'ended'='intro';phaseTime=GOLF.intro as number;
 time=0;remaining=GOLF.holeSeconds as number;extras:Bumper[]=[];events:GolfEvent[]=[];
 private accumulator=0;
 constructor(roster:PlayerSnapshot[],next:()=>number,courses?:Course[]){
  this.courses=courses??selectCourses(next);
  this.players=roster.map(p=>({id:p.id,characterId:p.characterId,name:p.displayName,color:p.color,bot:!!p.bot,ball:createBall(p.id,{x:0,z:0}),
   aim:{x:0,z:-1},charge:0,charging:false,blocked:true,cancelVersion:0,strokes:0,penalties:0,total:0,totalPenalties:0,finished:false,
   completed:0,ones:0,completionTime:0,holeShots:0,used:false,armed:null,prediction:0,debt:0,specialShot:false,records:[]}));
  this.spawn();
 }
 get course():Course{return this.courses[this.courseIndex];}
 spawn():void {
  this.time=0;this.remaining=GOLF.holeSeconds;this.extras=[];
  // Rotating lane assignment prevents a persistent inside-lane advantage across the three holes.
  this.players.forEach((p,i)=>{const lane=(i+this.courseIndex)%this.players.length,pos={x:this.course.spawn.x+(lane-(this.players.length-1)/2)*.8,z:this.course.spawn.z},f=supportAt(this.course,pos,0)!;
   p.ball=createBall(p.id,pos,heightAt(f,pos));Object.assign(p,{aim:{x:0,z:-1},strokes:0,penalties:0,finished:false,holeShots:0,charge:0,charging:false,blocked:true,used:false,armed:null,prediction:0,debt:0,specialShot:false});});
 }
 cancel(p:GolfPlayer):void {p.charging=false;p.charge=0;p.blocked=true;}
 cancelAll():void {for(const p of this.players)this.cancel(p);}
 command(p:GolfPlayer,c:GolfCommand,dt:number):void {
  if(p.cancelVersion!==c.version){this.cancel(p);p.cancelVersion=c.version;}
  if(this.phase!=='playing'||p.finished){this.cancel(p);return;}
  const len=Math.hypot(c.aim.x,c.aim.z);if(len>.18)p.aim={x:c.aim.x/len,z:c.aim.z/len};
  // Cancel precedes release, so B/pointercancel + up never launch a shot.
  if(c.cancel){this.cancel(p);return;}
  if(p.blocked){if(!c.held&&!c.pressed)p.blocked=false;return;}
  if(c.ability){const fail=activateAbility(p,this.course,this.time,this.extras);this.events.push({type:'ability',id:p.id,x:p.ball.x,z:p.ball.z,other:fail??undefined});}
  if(p.charging&&(!p.ball.grounded||speed(p.ball)>GOLF.readySpeed)){this.cancel(p);return;}
  if(c.pressed&&p.ball.grounded&&p.ball.readyFor>=.18&&p.strokes<GOLF.maxStrokes){p.charging=true;p.charge=0;}
  if(p.charging&&c.held)p.charge=Math.min(1,p.charge+dt/GOLF.chargeTime);
  if(p.charging&&c.released){
   // A second stroke ends Ciro's direct-shot wager; no credit for a later shot.
   if(p.specialShot)this.payDebt(p);
   p.holeShots++;p.strokes++;const special=p.armed==='power';
   impulse(p.ball,p.aim,p.charge,special?AB.minigolf.ciro.p.power:1);
   if(p.armed==='bounce')p.ball.bounceBoost=AB.minigolf.goblin.p.bounce;
   if(special){p.debt=AB.minigolf.ciro.p.window;p.specialShot=true;}
   p.armed=null;p.charge=0;p.charging=false;
   this.events.push({type:'shot',id:p.id,x:p.ball.x,z:p.ball.z});
  }
 }
 advance(delta:number):void {
  this.accumulator+=Math.max(0,Number.isFinite(delta)?delta:0);
  while(this.accumulator+1e-9>=GOLF.step){this.accumulator-=GOLF.step;this.tick(GOLF.step);}
 }
 private tick(dt:number):void {
  if(this.phase==='ended')return;
  if(this.phase!=='playing'){
   this.phaseTime-=dt;
   if(this.phaseTime<=0){
    if(this.phase==='transition'){this.courseIndex++;this.spawn();this.phase='intro';this.phaseTime=GOLF.intro;}
    else{this.phase='playing';this.cancelAll();}
   }return;
  }
  this.time+=dt;const was=this.remaining;this.remaining=Math.max(0,GOLF.holeSeconds-this.time);
  if(was>8&&this.remaining<=8)this.events.push({type:'last',id:'',x:0,z:0});
  const physics=physicsStep(this.players.map(p=>p.ball),this.course,this.time,dt,this.extras);
  for(const ev of physics){
   const p=this.players.find(p=>p.id===ev.id)!;
   if(ev.type==='fall'){p.strokes++;p.penalties++;this.cancel(p);this.payDebt(p);}
   if(ev.type==='stuck')this.cancel(p);
   if(ev.type==='hole'){
    if(p.specialShot&&p.debt>0){p.strokes=Math.max(1,p.strokes-AB.minigolf.ciro.p.discount);p.debt=0;p.specialShot=false;}
    this.finishHole(p,true);
   }
   this.events.push(ev);
  }
  for(const p of this.players){if(p.finished)continue;
   p.prediction=Math.max(0,p.prediction-dt);
   if(p.debt>0){p.debt-=dt;if(p.debt<=0)this.payDebt(p);}
   if((p.strokes>=GOLF.maxStrokes&&p.ball.readyFor>.18)||this.remaining<=0){this.payDebt(p);this.finishHole(p,false);
    this.events.push({type:'limit',id:p.id,x:p.ball.x,z:p.ball.z});}
  }
  this.extras=this.extras.filter(b=>(b.expires??Infinity)>this.time);
  if(this.players.every(p=>p.finished)){
   this.cancelAll();this.phase=this.courseIndex===this.courses.length-1?'ended':'transition';this.phaseTime=GOLF.transition;
  }
 }
 private payDebt(p:GolfPlayer):void {
  if(!p.specialShot)return;p.debt=0;p.specialShot=false;p.strokes+=AB.minigolf.ciro.p.penalty;p.penalties+=AB.minigolf.ciro.p.penalty;
  this.events.push({type:'penalty',id:p.id,x:p.ball.x,z:p.ball.z,value:AB.minigolf.ciro.p.penalty});
 }
 private finishHole(p:GolfPlayer,completed:boolean):void {
  if(p.finished)return;p.finished=true;p.ball.done=true;p.ball.vx=p.ball.vy=p.ball.vz=0;this.cancel(p);
  if(!completed)p.strokes=Math.max(GOLF.incomplete,p.strokes+2);
  p.total+=p.strokes;p.totalPenalties+=p.penalties;p.completed+=completed?1:0;
  if(completed&&p.holeShots===1&&p.penalties===0)p.ones++;
  const seconds=completed?this.time:GOLF.holeSeconds;p.completionTime+=seconds;
  p.records.push({course:this.course.id,strokes:p.strokes,penalties:p.penalties,completed,seconds});
 }
 results():PlayerResult[] {
  return [...this.players].sort((a,b)=>a.total-b.total||a.totalPenalties-b.totalPenalties||b.ones-a.ones||a.completionTime-b.completionTime||this.players.indexOf(a)-this.players.indexOf(b))
   .map((p,i)=>({playerId:p.id,placement:i+1,score:p.total,stats:[`${p.total} colpi · ${p.totalPenalties} penalità`,`${p.completed}/${this.courses.length} buche · ${p.ones} hole-in-one`,`${p.completionTime.toFixed(1)} s`]}));
 }
}
