import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {COURSES,supportAt,heightAt,wallAt} from '../src/minigames/minigolf/minigolfCourses';
import {createBall,physicsStep,impulse,speed} from '../src/minigames/minigolf/minigolfPhysics';
import {GOLF} from '../src/minigames/minigolf/minigolfTypes';
import type {GolfBall,Course,Point} from '../src/minigames/minigolf/minigolfTypes';
import {MinigolfMatch} from '../src/minigames/minigolf/minigolfRules';
import type {GolfCommand} from '../src/minigames/minigolf/minigolfRules';
import type {PlayerSnapshot} from '../shared/types';
const clone=(b:GolfBall):GolfBall=>({...b,safe:{...b.safe},lastMotion:{...b.lastMotion},contacts:new Set(b.contacts)});
function clear(c:Course,a:Point,b:Point):boolean {
 const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15);
 for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},f=supportAt(c,p,0);if(!f)return false;
  for(const w of c.walls.filter(w=>!w.rotation)){const dx=w.b.x-w.a.x,dz=w.b.z-w.a.z,t=Math.max(0,Math.min(1,((p.x-w.a.x)*dx+(p.z-w.a.z)*dz)/(dx*dx+dz*dz||1)));
   if(Math.abs(heightAt(f,p)-w.y)<.7&&Math.hypot(p.x-w.a.x-t*dx,p.z-w.a.z-t*dz)<GOLF.radius+w.radius+.06)return false;}
 }return true;
}
function cost(c:Course,b:GolfBall):number {
 if(b.done)return -1000;
 let tail=0,best=Infinity;const pts=c.waypoints;
 for(let i=pts.length-1;i>=0;i--){if(i<pts.length-1)tail+=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].z-pts[i].z);
  if(clear(c,b,pts[i]))best=Math.min(best,Math.hypot(b.x-pts[i].x,b.z-pts[i].z)+tail);}
 return best;
}
/** Test-only shot search. Uses the real solver, no altered ball physics/teleports. */
function choose(c:Course,start:GolfBall,time:number){
 let best:{ball:GolfBall;aim:Point;power:number;cost:number;elapsed:number;wait:number}|null=null;
 const targets=c.waypoints.filter(p=>clear(c,start,p));
 for(const target of targets)for(const offset of [0,-.07,.07])for(let pi=0;pi<=32;pi++){
  const angle=Math.atan2(target.x-start.x,target.z-start.z)+offset,aim={x:Math.sin(angle),z:Math.cos(angle)},power=pi/40,b=clone(start);
  impulse(b,aim,power);let elapsed=0,bad=false;
  while(elapsed<19&&!b.done){const es=physicsStep([b],c,time+elapsed,1/60);elapsed+=1/60;if(es.some(e=>e.type==='fall'||e.type==='stuck')){bad=true;break;}if(b.grounded&&b.readyFor>=.18)break;}
  if(bad||!b.done&&b.readyFor<.18)continue;
  const score=cost(c,b);if(!best||score<best.cost)best={ball:b,aim,power,cost:score,elapsed,wait:0};
 }
 return best;
}
const roster:PlayerSnapshot[]=[{id:'test',name:'Tester',displayName:'Tester',characterId:'goblin',color:'#fff',bot:false,score:0,roleTitle:'',avatar:'',quote:''}];
const command=(aim:Point,extra:Partial<GolfCommand>={}):GolfCommand=>({aim,pressed:false,released:false,held:false,cancel:false,ability:false,version:0,...extra});
const rows=[];
for(const c of COURSES){
 const m=new MinigolfMatch(roster,()=>.5,[c]),shots=[];m.advance(GOLF.intro+.01);
 for(let stroke=0;stroke<c.maxStrokes&&!m.players[0].records.length;stroke++){
  const p=m.active;for(let i=0;i<120&&!m.aiming;i++){m.command(p,command(p.aim),1/60);m.advance(1/60);m.events=[];}
  m.command(p,command(p.aim),1/60);const plan=choose(c,p.ball,m.time+GOLF.chargeTime*.4);
  if(!plan){console.log('NO PATH',c.id,stroke,p.ball);break;}
  m.command(p,command(plan.aim,{pressed:true,held:true}),plan.power*GOLF.chargeTime);
  m.command(p,command(plan.aim,{released:true}),1/60);let fall=false;
  for(let i=0;i<20*60&&(m.stage==='rolling'||m.stage==='switch')&&m.phase==='playing';i++){m.advance(1/60);fall||=m.events.some(e=>e.type==='fall');m.events=[];}
  shots.push({power:plan.power,aim:plan.aim,x:p.ball.x,z:p.ball.z,time:m.time,fall,cost:plan.cost});
  console.log(c.id,stroke+1,+p.ball.x.toFixed(2),+p.ball.z.toFixed(2),p.finished?'DONE':'',+plan.cost.toFixed(2));
 }
 const p=m.players[0];rows.push({id:c.id,completed:p.completed>0,shots,records:p.records});
 writeFileSync('docs/agent-work/minigolf-2/completion.json',JSON.stringify(rows,null,2));
}
assert.equal(rows.length,10);assert.ok(rows.every(r=>r.completed),'every course must be physically holed, not DNF');
console.log('PASS ten courses holed from tee through production commands/solver; no teleports or physics overrides');
