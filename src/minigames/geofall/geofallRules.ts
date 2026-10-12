import {Rng} from '../../../shared/rng';
import {GeoDeck} from '../../../shared/geofallQuestions';
import type {GeoAnswer,GeoQuestion} from '../../../shared/geofallQuestions';
import type {PlayerResult} from '../../../shared/types';
export const GEO={tile:5,halfWidth:12.5,halfDepth:5,radius:.46,speed:6.5,step:1/120,pushRange:2.25,pushSpeed:13,immunity:.7,stun:.18,intro:1.8,collapse:1.8,rebuild:.9} as const;
export type GeoPhase='intro'|'answer'|'collapse'|'rebuild'|'ended';
export interface GeoActor {id:string;name:string;color:string;characterId:string|null;bot:boolean;x:number;z:number;vx:number;vz:number;dx:number;dz:number;facing:number;lives:number;correct:number;eliminatedRound:number;pushUsed:boolean;immunity:number;stun:number;dash:number;hit:number;lockedTile:number|null;lost:boolean;version:number}
export interface GeoPlayer {id:string;name:string;color:string;characterId:string|null;bot?:boolean}
export interface GeoEvent {type:'push'|'hit'|'snapshot'|'round'|'tie'|'win';id?:string}
export const roundSeconds=(round:number):number=>round<=5?10:round<=10?8:6;
export function tileCenter(index:number):{x:number;z:number}{return{x:(index%5-2)*GEO.tile,z:(Math.floor(index/5)-.5)*GEO.tile};}
/** Centro del collider: intervalli semiaperti, bordo esterno incluso, spawn escluso. */
export function occupiedTile(x:number,z:number):number|null{
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<-12.5||x>12.5||z<-5||z>5)return null;
 return Math.min(1,Math.floor((z+5)/5))*5+Math.min(4,Math.floor((x+12.5)/5));
}
export function contain(p:Pick<GeoActor,'x'|'z'>):void{
 const r=GEO.radius;p.x=Math.max(-12.5+r,Math.min(12.5-r,p.x));p.z=Math.max(-8+r,Math.min(5-r,p.z));
 if(p.z<-5&&Math.abs(p.x)>6-r){const arena={x:p.x,z:-5+r},spawn={x:Math.sign(p.x)*(6-r),z:p.z};
  if(Math.hypot(p.x-arena.x,p.z-arena.z)<Math.hypot(p.x-spawn.x,p.z-spawn.z))Object.assign(p,arena);else Object.assign(p,spawn);}
}
export class GeofallMatch {
 readonly players:GeoActor[];readonly deck:GeoDeck;round=0;phase:GeoPhase='intro';remaining:number=GEO.intro;phaseTime:number=GEO.intro;time=0;
 question!:GeoQuestion;answers:GeoAnswer[]=[];correctIndex=0;tie=false;winner:string|null=null;events:GeoEvent[]=[];
 private accumulator=0;private nextTie:string[]=[];private pendingWinner:string|null=null;
 constructor(players:GeoPlayer[],rng:Rng){if(players.length<2||players.length>5)throw new Error('GEOFALL richiede 2–5 giocatori');
  this.players=players.map(p=>({...p,bot:!!p.bot,x:0,z:0,vx:0,vz:0,dx:0,dz:0,facing:0,lives:3,correct:0,eliminatedRound:0,pushUsed:false,immunity:0,stun:0,dash:0,hit:0,lockedTile:null,lost:false,version:-1}));this.deck=new GeoDeck(rng);this.newRound();
 }
 get alive():GeoActor[]{return this.players.filter(p=>p.lives>0);}
 get ended():boolean{return this.phase==='ended';}
 cancel():void{for(const p of this.players){p.dx=p.dz=0;}}
 command(id:string,x:number,z:number,push:boolean,version=0):void{
  const p=this.players.find(v=>v.id===id);if(!p)return;
  if(p.version!==version){p.version=version;p.dx=p.dz=0;return;}
  if(this.phase!=='answer'||p.lives<=0||this.remaining<=0){p.dx=p.dz=0;return;}
  x=Number.isFinite(x)?x:0;z=Number.isFinite(z)?z:0;const len=Math.hypot(x,z),factor=Math.max(1,len);p.dx=x/factor;p.dz=z/factor;
  if(len>.1)p.facing=Math.atan2(x,z);
  if(push)this.push(p);
 }
 push(p:GeoActor):void{
  if(this.phase!=='answer'||this.remaining<=0||p.lives<=0||p.pushUsed||p.stun>0)return;
  p.pushUsed=true;p.dash=.18;this.events.push({type:'push',id:p.id});const nx=Math.sin(p.facing),nz=Math.cos(p.facing);
  const targets=this.alive.filter(v=>v!==p&&v.immunity<=0).map(v=>({v,dx:v.x-p.x,dz:v.z-p.z})).filter(({dx,dz})=>Math.hypot(dx,dz)<=GEO.pushRange&&(dx*nx+dz*nz)/Math.max(.001,Math.hypot(dx,dz))>.35);
  // Una spinta può colpire il più vicino; nessun vantaggio di carattere o aggancio automatico.
  targets.sort((a,b)=>Math.hypot(a.dx,a.dz)-Math.hypot(b.dx,b.dz));const target=targets[0]?.v;
  if(target){target.vx=nx*GEO.pushSpeed;target.vz=nz*GEO.pushSpeed;target.stun=GEO.stun;target.immunity=GEO.immunity;target.hit=.3;this.events.push({type:'hit',id:target.id});}
 }
 advance(dt:number):void{
  if(!Number.isFinite(dt)||dt<=0||this.phase==='ended')return;this.accumulator+=Math.min(dt,.25);
  while(this.accumulator+1e-10>=GEO.step){this.accumulator-=GEO.step;this.tick(GEO.step);if(this.ended){this.accumulator=0;break;}}
 }
 private tick(dt:number):void{
  this.time+=dt;
  for(const p of this.players){p.immunity=Math.max(0,p.immunity-dt);p.stun=Math.max(0,p.stun-dt);p.dash=Math.max(0,p.dash-dt);p.hit=Math.max(0,p.hit-dt);}
  if(this.phase==='answer'){
   const h=Math.min(dt,this.remaining);this.move(h);this.remaining=Math.max(0,this.remaining-h);
   if(this.remaining<1e-8)this.snapshot();return;
  }
  this.phaseTime=Math.max(0,this.phaseTime-dt);
  if(this.phaseTime>1e-8)return;
  if(this.phase==='intro'){this.phase='answer';this.remaining=roundSeconds(this.round);this.cancel();}
  else if(this.phase==='collapse'){
   if(this.pendingWinner){this.winner=this.pendingWinner;this.phase='ended';this.events.push({type:'win',id:this.winner});}
   else{this.phase='rebuild';this.phaseTime=GEO.rebuild;}
  }else if(this.phase==='rebuild')this.newRound();
 }
 private move(dt:number):void{
  for(const p of this.alive){const mobility=p.stun>0?.2:1;p.x+=(p.dx*GEO.speed*mobility+p.vx)*dt;p.z+=(p.dz*GEO.speed*mobility+p.vz)*dt;
   p.vx*=Math.exp(-9*dt);p.vz*=Math.exp(-9*dt);contain(p);}
  // Separazione morbida: tutti e cinque entrano nello stesso quadrato senza muri umani.
  const active=this.alive;
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){const a=active[i],b=active[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),over=GEO.radius*2-d;
   if(over<=0)continue;const nx=d>1e-5?dx/d:1,nz=d>1e-5?dz/d:0,amount=Math.min(over*.3,.06);a.x-=nx*amount;a.z-=nz*amount;b.x+=nx*amount;b.z+=nz*amount;contain(a);contain(b);}
 }
 private snapshot():void{
  const contenders=this.alive.map(p=>p.id);this.cancel();
  for(const p of this.players){if(p.lives<=0)continue;p.lockedTile=occupiedTile(p.x,p.z);p.lost=p.lockedTile!==this.correctIndex;p.vx=p.vz=0;
   if(p.lost){p.lives--;if(p.lives===0)p.eliminatedRound=this.round;}else p.correct++;}
  const alive=this.alive;
  if(alive.length===1)this.pendingWinner=alive[0].id;
  else if(alive.length===0){this.nextTie=contenders;this.events.push({type:'tie'});}
  this.phase='collapse';this.phaseTime=GEO.collapse;this.events.push({type:'snapshot'});
 }
 private newRound():void{
  if(this.nextTie.length){this.tie=true;for(const p of this.players)if(this.nextTie.includes(p.id)){p.lives=1;p.eliminatedRound=0;}this.nextTie=[];}
  this.round++;const drawn=this.deck.next(this.round);this.question=drawn.question;this.answers=drawn.answers;this.correctIndex=drawn.correctIndex;
  this.phase='intro';this.phaseTime=GEO.intro;this.remaining=roundSeconds(this.round);this.pendingWinner=null;
  for(const p of this.players){p.lost=false;p.lockedTile=null;}
  this.alive.forEach((p,i)=>{p.x=(i-(this.alive.length-1)/2)*1.4;p.z=-6.5;p.vx=p.vz=p.dx=p.dz=0;p.pushUsed=false;p.stun=p.immunity=p.dash=p.hit=0;p.facing=0;p.lockedTile=null;p.lost=false;});this.events.push({type:'round'});
 }
 results():PlayerResult[]{
  return [...this.players].sort((a,b)=>Number(b.id===this.winner)-Number(a.id===this.winner)||b.eliminatedRound-a.eliminatedRound||b.correct-a.correct||this.players.indexOf(a)-this.players.indexOf(b)).map((p,i)=>({playerId:p.id,placement:i+1,score:p.correct,stats:[`${p.correct} risposte corrette`,p.id===this.winner?'ULTIMO SOPRAVVISSUTO':`Eliminato al round ${p.eliminatedRound}`,this.tie?'SPAREGGIO FINALE':`${p.lives} vite residue`]}));
 }
}
