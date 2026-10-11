import assert from 'node:assert/strict';
import {COURSES,selectCourses,supportAt,heightAt} from '../src/minigames/minigolf/minigolfCourses';
import {GOLF} from '../src/minigames/minigolf/minigolfTypes';
import {createBall,physicsStep,impulse,speed,restoreBall,predict} from '../src/minigames/minigolf/minigolfPhysics';
import {MinigolfMatch} from '../src/minigames/minigolf/minigolfRules';
import type {GolfCommand} from '../src/minigames/minigolf/minigolfRules';
import {activateAbility} from '../src/minigames/minigolf/minigolfAbilities';
import {MinigolfBot} from '../src/minigames/minigolf/minigolfBot';
import type {PlayerSnapshot} from '../shared/types';
import {AB} from '../shared/abilityCatalog';
const chars=['goblin','buttafuori','dottore','judoka','ciro'];
const roster=(n:number)=>Array.from({length:n},(_,i)=>({id:`p${i}`,characterId:chars[i],displayName:`P${i}`,name:`P${i}`,color:'#22cc88',bot:true,score:0,avatar:'',roleTitle:'',quote:''} satisfies PlayerSnapshot));
const cmd=(extra:Partial<GolfCommand>={}):GolfCommand=>({aim:{x:0,z:-1},pressed:false,held:false,released:false,cancel:false,ability:false,version:0,...extra});
const c={...COURSES[0],walls:[],bumpers:[],hole:{x:8,z:-11}};
const b=createBall('a',{x:0,z:0});impulse(b,{x:0,z:-1},.5);
const initial=speed(b);for(let i=0;i<120;i++)physicsStep([b],c,i/120,1/120);
assert.ok(speed(b)<initial&&b.z< -5);for(let i=0;i<1200;i++)physicsStep([b],c,i/120,1/120);assert.equal(speed(b),0);
const run=(hz:number)=>{const ball=createBall('a',{x:0,z:8});impulse(ball,{x:.2,z:-1},.4);let acc=0,t=0;for(let i=0;i<hz*2;i++){acc+=1/hz;while(acc+1e-9>=GOLF.step){physicsStep([ball],c,t,GOLF.step);acc-=GOLF.step;t+=GOLF.step;}}return ball;};
for(const hz of [20,30,60,144]){const q=run(hz),ref=run(120);assert.ok(Math.abs(q.x-ref.x)<1e-8&&Math.abs(q.z-ref.z)<1e-8,'frame independent');}
const a=createBall('a',{x:-1,z:0}),d=createBall('b',{x:1,z:0});a.vx=28;d.vx=-28;
let hit=false;for(let i=0;i<20;i++)hit=physicsStep([a,d],c,i/120,GOLF.step).some(e=>e.type==='ball')||hit;
assert.ok(hit&&a.x<d.x&&a.vx<0&&d.vx>0,'fast balls transfer impulse, no crossing');
const near=createBall('near',{x:.8,z:2});near.vx=8;const alone=createBall('alone',{x:.8,z:2});alone.vx=8;
physicsStep([createBall('s',{x:0,z:2}),near],c,0,GOLF.step);physicsStep([alone],c,0,GOLF.step);assert.equal(near.vx,alone.vx,'no proximity braking');
const w=createBall('w',{x:10,z:0});w.vx=28;for(let i=0;i<10;i++)physicsStep([w],COURSES[0],i/120,GOLF.step);assert.ok(w.vx<0&&w.x<11,'wall no tunneling');
const slope=createBall('slope',{x:0,z:2},2);for(let i=0;i<120;i++)physicsStep([slope],COURSES[4],i/120,GOLF.step);assert.ok(slope.z<2&&speed(slope)>1,'gravity on slope');
const sand=createBall('sand',{x:0,z:-7},.015),ice=createBall('ice',{x:0,z:4},.015);sand.vx=ice.vx=1;
for(let i=0;i<30;i++){physicsStep([sand],COURSES[3],i/120,GOLF.step);physicsStep([ice],COURSES[3],i/120,GOLF.step);}assert.ok(speed(ice)>speed(sand));
const mobile=createBall('mobile',{x:3,z:.6});let mobileHit=false;for(let i=0;i<120;i++)mobileHit=physicsStep([mobile],COURSES[1],i/120,GOLF.step).some(e=>e.type==='wall')||mobileHit;assert.ok(mobileHit&&mobile.travel>0,'rotating arms transfer velocity');
const out=createBall('out',{x:0,z:11});out.x=20;let fell=false;for(let i=0;i<180;i++)fell=physicsStep([out],COURSES[2],i/120,GOLF.step).some(e=>e.type==='fall')||fell;assert.ok(fell);assert.equal(out.x,0);
const hole=createBall('hole',COURSES[0].hole);assert.ok(physicsStep([hole],COURSES[0],0,GOLF.step).some(e=>e.type==='hole'));assert.ok(hole.done);assert.equal(physicsStep([hole],COURSES[0],1,GOLF.step).length,0);
const fast=createBall('fast',{x:0,z:-11});fast.vz=-8;physicsStep([fast],COURSES[0],0,GOLF.step);assert.ok(!fast.done,'fast balls overshoot cup');
const corrupt=createBall('bad',{x:0,z:11});corrupt.vx=NaN;assert.ok(physicsStep([corrupt],COURSES[0],0,GOLF.step).some(e=>e.type==='stuck'));assert.ok(Number.isFinite(corrupt.x));
for(const course of COURSES){assert.ok(supportAt(course,course.spawn,0));assert.ok(supportAt(course,course.hole,0));assert.ok(course.par<=course.maxStrokes);assert.equal(course.maxStrokes,course.difficulty==='easy'?5:6);}
for(let seed=0;seed<60;seed++){const cs=selectCourses(()=>seed/60);assert.equal(cs.length,1);assert.ok(COURSES.includes(cs[0]));}
assert.equal(new Set(Array.from({length:6},(_,i)=>selectCourses(()=>(i+.5)/6)[0].id)).size,6);

// Check complete corridor clearance, rather than only isolated waypoints.
for(const course of COURSES){
 const route=[course.spawn,...course.waypoints];
 for(let i=1;i<route.length;i++)for(let k=0;k<=60;k++){
  const a=route[i-1],b=route[i],q={x:a.x+(b.x-a.x)*k/60,z:a.z+(b.z-a.z)*k/60},f=supportAt(course,q,0);
  assert.ok(f,`${course.id}: continuous supported route ${i}/${k}`);
  for(const w of course.walls.filter(w=>!w.rotation)){
   const dx=w.b.x-w.a.x,dz=w.b.z-w.a.z,t=Math.max(0,Math.min(1,((q.x-w.a.x)*dx+(q.z-w.a.z)*dz)/(dx*dx+dz*dz||1)));
   if(Math.abs(heightAt(f!,q)-w.y)<.7)assert.ok(Math.hypot(q.x-w.a.x-dx*t,q.z-w.a.z-dz*t)>GOLF.radius+w.radius,`${course.id}: route crosses wall`);
  }
 }
}
// The descent's entry must actually pass its wall opening and capture the cup.
const descent=createBall('descent',{x:5,z:-6.1});descent.vz=-5;
for(let i=0;i<600&&!descent.done;i++)physicsStep([descent],COURSES[4],i/120,GOLF.step);
assert.ok(descent.done,'descent goal reachable through gate');
// A stationary ball is carried by the actual moving platform, without an impulse.
const carry=createBall('carry',{x:-3,z:-4});const initialX=carry.x;
for(let i=0;i<120;i++)physicsStep([carry],COURSES[2],i/120,GOLF.step);
assert.ok(carry.grounded&&carry.x>initialX+.4&&speed(carry)===0);
const boosted=createBall('boost',{x:10,z:10});boosted.vx=5;boosted.bounceBoost=AB.minigolf.goblin.p.bounce;
const plain=createBall('plain',{x:10,z:10});plain.vx=5;
for(let i=0;i<30;i++){physicsStep([boosted],COURSES[0],i/120,GOLF.step);physicsStep([plain],COURSES[0],i/120,GOLF.step);}
assert.ok(speed(boosted)>speed(plain)*1.2);assert.equal(boosted.bounceBoost,1,'first static bounce consumes boost');
const rotor=createBall('rotor',{x:3,z:.6});rotor.bounceBoost=AB.minigolf.goblin.p.bounce;
for(let i=0;i<20;i++)physicsStep([rotor],COURSES[1],i/120,GOLF.step);
assert.equal(rotor.bounceBoost,AB.minigolf.goblin.p.bounce,'mobile arm never consumes static boost');
// Turn authority: never mutate an inactive ball from its own controls.
const fresh=(n=5,course=COURSES[0])=>{const v=new MinigolfMatch(roster(n),()=>.99,[course]);v.advance(GOLF.intro+.02);for(const p of v.players)v.command(p,cmd(),.01);return v;};
const shoot=(m:MinigolfMatch,p=m.active,power=.3,aim={x:0,z:-1})=>{m.command(p,cmd({aim}),.01);m.command(p,cmd({aim,pressed:true,held:true}),power*GOLF.chargeTime);m.command(p,cmd({aim,released:true}),.01);};
const m=fresh(),p=m.active,other=m.players[1];const inactive=JSON.stringify(other.ball),otherAim={...other.aim};
shoot(m,other);m.command(other,cmd({ability:true}),.1);assert.equal(JSON.stringify(other.ball),inactive);assert.equal(other.used,false);assert.deepEqual(other.aim,otherAim);
m.command(p,cmd({pressed:true,held:true}),.2);assert.ok(p.charging);m.command(p,cmd({cancel:true,released:true}),.01);assert.equal(p.strokes,0);
m.command(p,cmd(),.01);shoot(m);assert.equal(p.strokes,1);assert.equal(m.stage,'rolling');const count=p.strokes;shoot(m);assert.equal(p.strokes,count);
const timer=m.aimRemaining,aimTime=p.completionTime;m.advance(.4);assert.equal(m.aimRemaining,timer);assert.equal(p.completionTime,aimTime,'follow and waiting excluded from aiming time');
const cancel=fresh(),cp=cancel.active;cancel.command(cp,cmd({pressed:true,held:true}),.3);cancel.command(cp,cmd({version:1,released:true}),.01);assert.equal(cp.strokes,0);
const timeout=fresh(5),first=timeout.active,before={x:first.ball.x,z:first.ball.z};timeout.advance(6.3);assert.equal(first.strokes,1);assert.deepEqual({x:first.ball.x,z:first.ball.z},before);assert.equal(first.penalties,0);assert.equal(timeout.activeIndex,1);assert.equal(timeout.players[2].completionTime,0,'inactive player accumulates no aiming time');
const seen=[0,1];for(let i=0;i<3;i++){timeout.advance(6.23);seen.push(timeout.activeIndex);}assert.deepEqual(seen,[0,1,2,3,4],'one stroke per rotation');
const firsts=new Set(Array.from({length:30},(_,i)=>new MinigolfMatch(roster(5),()=>i/30).activeIndex));assert.ok(firsts.size>=4,'first player not fixed');
// Last permitted shot still reaches the hole before DNF is decided.
const last=fresh(2),lp=last.active;lp.strokes=last.course.maxStrokes-1;lp.holeShots=lp.strokes;lp.ball.x=0;lp.ball.z=-10.2;lp.ball.readyFor=1;
shoot(last,lp,0);last.advance(1);assert.equal(lp.completed,1);assert.equal(lp.strokes,last.course.maxStrokes);assert.ok(lp.finished);
const exhausted=fresh(2);exhausted.advance(80);assert.equal(exhausted.phase,'ended');assert.ok(exhausted.players.every(p=>p.records.length===1&&p.total===7&&p.totalPenalties===2));
// Both balls move from a real impulse, victim's strokes and new position persist.
const bump=fresh(2,{...c,id:'collision'}),shooter=bump.active,victim=bump.players[1];
Object.assign(shooter.ball,createBall(shooter.id,{x:0,z:1}));Object.assign(victim.ball,createBall(victim.id,{x:0,z:0}));
shoot(bump,shooter,.2);bump.advance(.3);assert.ok(victim.ball.z<-.5);assert.equal(victim.strokes,0);assert.equal(bump.active.id,shooter.id,'wait for both balls');
for(let i=0;i<200&&bump.active.id===shooter.id;i++)bump.advance(.05);assert.equal(bump.active.id,victim.id);assert.ok(victim.ball.z<-.5,'bocce position persists for next turn');
const help=fresh(2,{...c,id:'help',hole:{x:0,z:-1}}),helper=help.active,helped=help.players[1];Object.assign(helper.ball,createBall(helper.id,{x:0,z:1}));Object.assign(helped.ball,createBall(helped.id,{x:0,z:-.4}));
shoot(help,helper,0);help.advance(2);assert.ok(helped.finished&&helped.completed);assert.equal(helped.strokes,0,'opponent can be holed with no extra stroke');
const falls=fresh(2,COURSES[2]),falling=falls.active,fallVictim=falls.players[1];shoot(falls,falling,0);
falling.ball.x=fallVictim.ball.x=20;falls.advance(2);assert.equal(falling.penalties,1);assert.equal(fallVictim.penalties,0);assert.equal(fallVictim.strokes,0);assert.ok(fallVictim.ball.x<6);
const bad=fresh(2);bad.active.ball.vx=NaN;bad.advance(.02);assert.equal(bad.active.penalties,0);assert.ok(Number.isFinite(bad.active.ball.x));
// All five catalog abilities stay usable with the same ball parameters.
const abilities=fresh();for(const [i,q]of abilities.players.entries()){Object.assign(q.ball,createBall(q.id,{x:-8+i*4,z:0}));q.blocked=false;q.aim={x:0,z:-1};}
const extras:any[]=[];assert.equal(activateAbility(abilities.players[0],abilities.course,0,extras),null);assert.equal(abilities.players[0].armed,'bounce');
assert.equal(activateAbility(abilities.players[1],abilities.course,0,extras),null);assert.equal(extras.length,1);assert.equal(activateAbility(abilities.players[1],abilities.course,0,extras),'ESAURITA');
assert.equal(activateAbility(abilities.players[2],abilities.course,0,extras),null);assert.ok(abilities.players[2].prediction>0);
abilities.players[3].ball.vx=10;assert.equal(activateAbility(abilities.players[3],abilities.course,0,extras),null);assert.equal(abilities.players[3].ball.vx,1.2);
assert.equal(activateAbility(abilities.players[4],abilities.course,0,extras),null);assert.equal(abilities.players[4].armed,'power');
const original=JSON.stringify(abilities.players[0].ball);assert.ok(predict(abilities.players[0].ball,abilities.course,{x:1,z:0},.3,2).length>3);assert.equal(JSON.stringify(abilities.players[0].ball),original);
const wager=fresh(1),ciro=wager.active;ciro.characterId='ciro';ciro.strokes=2;ciro.ball.x=0;ciro.ball.z=-10.2;ciro.ball.readyFor=1;
wager.command(ciro,cmd({ability:true}),.01);shoot(wager,ciro,0);wager.advance(1);assert.equal(ciro.completed,1);assert.equal(ciro.strokes,2);assert.equal(ciro.penalties,0);
const debt=fresh(2),debtor=debt.active;debtor.characterId='ciro';debt.command(debtor,cmd({ability:true}),.01);shoot(debt,debtor,.03);debt.advance(4);assert.equal(debtor.strokes,2);assert.equal(debtor.penalties,1);debt.advance(2);assert.equal(debtor.penalties,1);
const ranks=fresh(),[ra,rb,rc,rd,re]=ranks.players;for(const p of ranks.players){p.total=10;p.totalPenalties=0;p.completionTime=20;}
ra.total=11;rb.totalPenalties=1;rc.ones=1;rd.completionTime=15;assert.deepEqual(ranks.results().map(p=>p.playerId),[rd.id,rc.id,re.id,rb.id,ra.id],'strokes, penalties, active aiming time, roster; hole-in-one not an extra tie key');
const outcomes=[];
for(const n of [2,3,4,5])for(const course of COURSES){
 let seed=123+n;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const match=new MinigolfMatch(roster(n),rng,[course]),bot=new MinigolfBot(rng);
 for(let i=0;i<240*60&&match.phase!=='ended';i++){match.command(match.active,bot.command(match.active,match.course,1/60),1/60);match.advance(1/60);match.events=[];}
 assert.equal(match.phase,'ended');assert.equal(match.results().length,n);assert.ok(match.players.every(q=>q.records.length===1&&Number.isFinite(q.completionTime)));assert.ok(match.time<=230.02);
 outcomes.push({n,course:course.id,seconds:+match.time.toFixed(1),completed:match.players.reduce((a,p)=>a+p.completed,0)});
}
const deadline=fresh(2);deadline.time=GOLF.holeSeconds-.1;shoot(deadline,deadline.active,.5);deadline.advance(.3);assert.equal(deadline.phase,'playing','deadline does not interrupt shot in flight');deadline.advance(21);assert.equal(deadline.phase,'ended');assert.ok(deadline.players.every(p=>p.records.length===1));
console.log('PASS minigolf physics 30/60/120, six courses, turns/timeout/fair order, persistent ball collisions and opponent hole, cancellation, all abilities, active-time ranking, deadline grace, 24 natural bot rounds.');console.log(JSON.stringify(outcomes));
