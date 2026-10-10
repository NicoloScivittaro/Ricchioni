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
const m=new MinigolfMatch(roster(5),()=>.3);m.advance(4.1);const p=m.players[0];m.command(p,cmd(),.01);m.command(p,cmd({pressed:true,held:true}),.2);assert.ok(p.charging);m.command(p,cmd({released:true,cancel:true}),.01);assert.equal(p.strokes,0);
m.command(p,cmd(),.01);m.command(p,cmd({pressed:true,held:true}),.5);m.command(p,cmd({released:true}),.01);assert.equal(p.strokes,1);assert.ok(speed(p.ball)>0);
const was=p.strokes;m.command(p,cmd({pressed:true,held:true}),.5);m.command(p,cmd({released:true}),.01);assert.equal(p.strokes,was,'moving ball cannot shoot');
restoreBall(p.ball);m.command(p,cmd(),.01);m.command(p,cmd({pressed:true,held:true}),.5);m.command(p,cmd({version:1,released:true}),.01);assert.equal(p.strokes,was,'cancel version never fires');
for(const q of m.players){restoreBall(q.ball);q.ball.x=0;q.ball.z=0;q.ball.y=GOLF.radius;q.ball.safe={x:0,z:0};q.ball.safeY=0;q.used=false;}
const extras:any[]=[];assert.equal(activateAbility(m.players[0],m.course,0,extras),null);assert.equal(m.players[0].armed,'bounce');
assert.equal(activateAbility(m.players[1],m.course,0,extras),null);assert.equal(extras.length,1);assert.equal(extras[0].expires,AB.minigolf.buttafuori.p.duration);
assert.equal(activateAbility(m.players[1],m.course,0,extras),'ESAURITA');
assert.equal(activateAbility(m.players[2],m.course,0,extras),null);assert.ok(m.players[2].prediction>0);
m.players[3].ball.vx=10;assert.equal(activateAbility(m.players[3],m.course,0,extras),null);assert.equal(m.players[3].ball.vx,1.2);
assert.equal(activateAbility(m.players[4],m.course,0,extras),null);assert.equal(m.players[4].armed,'power');
m.players[1].used=false;m.players[1].ball.x=m.course.hole.x;m.players[1].ball.z=m.course.hole.z;assert.equal(activateAbility(m.players[1],m.course,0,extras),'ZONA NON VALIDA');
const before=JSON.stringify(m.players[0].ball);assert.ok(predict(m.players[0].ball,m.course,{x:1,z:0},.3,2).length>3);assert.equal(JSON.stringify(m.players[0].ball),before);
for(const course of COURSES){assert.ok(supportAt(course,course.spawn,0));assert.ok(supportAt(course,course.hole,0));assert.ok(course.waypoints.every(q=>supportAt(course,q,0)),course.id+' waypoints connected');}
for(let seed=0;seed<25;seed++){const cs=selectCourses(()=>seed/25);assert.equal(new Set(cs.map(q=>q.id)).size,3);assert.equal(cs[0].difficulty,'easy');}

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
const fresh=()=>{const v=new MinigolfMatch(roster(5),()=>0);v.advance(4.1);for(const p of v.players)v.command(p,cmd(),.01);return v;};
const wager=fresh(),ciro=wager.players[4];ciro.strokes=2;ciro.holeShots=2;
ciro.ball.x=0;ciro.ball.z=-10.2;ciro.ball.safe={x:0,z:-10.2};ciro.ball.readyFor=1;
wager.command(ciro,cmd({ability:true}),.01);wager.command(ciro,cmd({pressed:true,held:true}),.01);wager.command(ciro,cmd({released:true}),.01);wager.advance(1);
assert.ok(ciro.finished&&ciro.completed===1);assert.equal(ciro.strokes,2,'direct special shot earns one-stroke discount');assert.equal(ciro.penalties,0);
const debt=fresh(),cp=debt.players[4];debt.command(cp,cmd({ability:true}),.01);debt.command(cp,cmd({pressed:true,held:true}),.01);debt.command(cp,cmd({released:true}),.01);
debt.advance(6.1);assert.equal(cp.strokes,2);assert.equal(cp.penalties,1);debt.advance(1);assert.equal(cp.penalties,1,'expired wager charged once');
const again=fresh(),ap=again.players[4];again.command(ap,cmd({ability:true}),.01);again.command(ap,cmd({pressed:true,held:true}),.01);again.command(ap,cmd({released:true}),.01);restoreBall(ap.ball);ap.ball.readyFor=1;
again.command(ap,cmd({pressed:true,held:true}),.01);again.command(ap,cmd({released:true}),.01);assert.equal(ap.strokes,3);assert.equal(ap.penalties,1,'second stroke forfeits direct-shot wager');
const penalty=fresh(),fp=penalty.players[0];fp.ball.x=20;penalty.courses[0]=COURSES[2];penalty.advance(2);assert.equal(fp.penalties,1);assert.equal(fp.strokes,1);
fp.ball.vx=NaN;penalty.advance(.02);assert.equal(fp.penalties,1);assert.ok(Number.isFinite(fp.ball.x),'technical reset is free');
const eighth=fresh(),ep=eighth.players[0];ep.strokes=7;ep.holeShots=7;ep.ball.x=0;ep.ball.z=-10.2;ep.ball.readyFor=1;
eighth.command(ep,cmd({pressed:true,held:true}),.01);eighth.command(ep,cmd({released:true}),.01);eighth.advance(1);assert.equal(ep.completed,1);assert.equal(ep.strokes,8,'eighth shot may still hole');
const ranks=fresh(),[ra,rb,rc,rd,re]=ranks.players;
for(const p of ranks.players){p.total=10;p.totalPenalties=0;p.ones=0;p.completionTime=20;}
ra.total=11;rb.totalPenalties=1;rc.ones=1;rd.completionTime=15;
assert.deepEqual(ranks.results().map(p=>p.playerId),[rc.id,rd.id,re.id,rb.id,ra.id],'all ranking keys applied in order');
const outcomes=[];
for(const n of [2,3,4,5]){
 let seed=123+n;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const match=new MinigolfMatch(roster(n),rng),bot=new MinigolfBot(rng);
 for(let i=0;i<210*60&&match.phase!=='ended';i++){
  for(const q of match.players)match.command(q,bot.command(q,match.course,1/60),1/60);
  match.advance(1/60);match.events=[];
 }
 assert.equal(match.phase,'ended');assert.equal(match.results().length,n);assert.ok(match.players.every(q=>q.records.length===3&&q.total>=3&&Number.isFinite(q.completionTime)));
 outcomes.push({n,courses:match.courses.map(q=>q.id),players:match.players.map(q=>({id:q.id,colpi:q.total,buche:q.completed}))});
}
const timeout=new MinigolfMatch(roster(2),()=>0);timeout.advance(180);assert.equal(timeout.phase,'ended');assert.ok(timeout.players.every(q=>q.total===30));
assert.deepEqual(timeout.results().map(q=>q.playerId),['p0','p1'],'perfect tie deterministic roster order');
console.log('PASS minigolf physics, surfaces, slopes, contacts, continuous collisions, mobile arms, cup, falls/restore, cancel/release, abilities, six courses, 2–5p natural matches and ranking.');console.log(JSON.stringify(outcomes));
