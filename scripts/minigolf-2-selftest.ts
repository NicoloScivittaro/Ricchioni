import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {COURSES,selectCourses,heightAt,supportAt} from '../src/minigames/minigolf/minigolfCourses';
import {MinigolfMatch} from '../src/minigames/minigolf/minigolfRules';
import {MinigolfBot} from '../src/minigames/minigolf/minigolfBot';
import {GOLF} from '../src/minigames/minigolf/minigolfTypes';
import {GOLF_TOURNAMENT} from '../shared/minigolfTournament';
import {ScoreManager} from '../shared/scoring';
import {GameSession} from '../server/GameSession';
import {PlayerSession} from '../server/PlayerSession';
import {Rng} from '../shared/rng';
import {MINIGAME_DEFINITIONS,safetyCapSec} from '../shared/minigames';
import type {PlayerSnapshot} from '../shared/types';
import type {GolfCommand} from '../src/minigames/minigolf/minigolfRules';
let tests=0;const test=(name:string,fn:()=>void)=>{fn();tests++;console.log('PASS',name);};
const chars=['goblin','buttafuori','dottore','judoka','ciro'];
const roster=(n:number):PlayerSnapshot[]=>chars.slice(0,n).map((characterId,i)=>({id:String(i),characterId,name:`P${i}`,displayName:`P${i}`,color:'#fff',bot:true,score:0,avatar:'',roleTitle:'',quote:''}));
const idle:GolfCommand={aim:{x:0,z:-1},pressed:false,held:false,released:false,cancel:false,ability:false,version:0};
const key=(cs:readonly {id:string}[])=>cs.map(c=>c.id).sort().join('|');
test('All physical layouts;3 unique selections;progression;no immediately repeated triple;all maps selected',()=>{
 const ids=new Set<string>();let previous='';const rng=new Rng(28);
 for(let i=0;i<3000;i++){const cs=selectCourses(()=>rng.next(),previous);assert.equal(cs.length,3);assert.equal(new Set(cs.map(c=>c.id)).size,3);assert.notEqual(key(cs),previous);previous=key(cs);
  assert.notEqual(cs[0].difficulty,'hard');assert.equal(cs[1].difficulty,'medium');assert.notEqual(cs[2].difficulty,'easy');cs.forEach(c=>ids.add(c.id));}
 assert.equal(ids.size,COURSES.length);assert.equal(new Set(COURSES.map(c=>JSON.stringify([c.floors,c.walls,c.bumpers,c.hole]))).size,COURSES.length);
 for(const r of [0,.99]){const a=selectCourses(()=>r,''),b=selectCourses(()=>r,key(a));assert.notEqual(key(a),key(b));}
});
test('default hole budget and 60s turn;bounded configurable timer;metadata/watchdog cover the longest option',()=>{
 const m=new MinigolfMatch(roster(5),()=>.4);assert.equal(m.courses.length,3);assert.equal(m.remaining,GOLF_TOURNAMENT.holeSeconds);assert.equal(m.aimRemaining,60);
 assert.equal(new MinigolfMatch(roster(2),()=>.2,undefined,{holeSeconds:200}).remaining,200);
 assert.equal(new MinigolfMatch(roster(2),()=>.2,undefined,{holeSeconds:NaN}).remaining,GOLF_TOURNAMENT.holeSeconds);
 const d=MINIGAME_DEFINITIONS.find(d=>d.id==='minigolf')!;assert.equal(d.durationSec,GOLF_TOURNAMENT.holes*GOLF_TOURNAMENT.holeSeconds);
 assert.ok(safetyCapSec(d)>=(GOLF_TOURNAMENT.holes*GOLF_TOURNAMENT.maxHoleSeconds+325)*1.25);
});
test('2–5 tees supported, no overlaps, identical distance to first target on all courses',()=>{
 for(const c of COURSES)for(let n=2;n<=5;n++){const m=new MinigolfMatch(roster(n),()=>.5,[c]),target=c.waypoints[0];
  const distances=m.players.map(p=>Math.hypot(p.ball.x-target.x,p.ball.z-target.z));assert.ok(Math.max(...distances)-Math.min(...distances)<1e-8);
  for(const p of m.players){const f=supportAt(c,p.ball,0);assert.ok(f);assert.ok(Math.abs(p.ball.y-GOLF.radius-heightAt(f!,p.ball))<1e-8);}
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)assert.ok(Math.hypot(m.players[i].ball.x-m.players[j].ball.x,m.players[i].ball.z-m.players[j].ball.z)>GOLF.radius*2);
 }
});
test('deadline freezes during no advance/pause contract;timeout3holes,resets,rotating starts and AFK playoff bounded',()=>{
 const cs=[COURSES[0],COURSES[1],COURSES[2]],m=new MinigolfMatch(roster(5),()=>.99,cs,{holeSeconds:1});const identities=m.players.map(p=>p.id);let records=0,starts:number[]=[];
 for(let i=0;i<200*60&&m.phase!=='ended';i++){
  if(m.phase==='playing'&&m.time===0){starts.push(m.activeIndex);}
  const before=m.courseIndex;m.advance(1/60);
  if(before!==m.courseIndex){records++;assert.equal(m.remaining,1);assert.equal(m.time,0);assert.equal(m.phase,'intro');assert.equal(m.extras.length,0);
   for(const p of m.players){assert.equal(p.records.length,records);assert.equal(p.total,records*(GOLF.maxStrokes+2));assert.equal(p.strokes,0);assert.equal(p.used,false);assert.equal(p.armed,null);assert.equal(p.debt,0);assert.equal(p.charging,false);assert.equal(p.ball.vx,0);assert.equal(p.ball.vz,0);assert.ok(p.blocked);}}
 }
 assert.equal(m.phase,'ended');assert.equal(m.courseIndex,2);assert.equal(m.playoff,true);assert.deepEqual(m.players.map(p=>p.id),identities);
 assert.ok(m.players.every(p=>p.records.length===3&&p.total===3*(GOLF.maxStrokes+2)&&p.completionTime===0));assert.equal(m.playoffScores.size,5);assert.ok(m.results().every(r=>r.placement===1));
 // Same zero-input outcome cannot turn roster position into an arbitrary champion.
 assert.equal(m.results().filter(r=>r.placement===1).length,5);
});
test('intermission holds scores and cancels held shots;new hole resets resources and temporary blockers',()=>{
 const m=new MinigolfMatch(roster(2),()=>.5,[COURSES[0],COURSES[1],COURSES[2]],{holeSeconds:1});m.advance(4.1);
 const p=m.active;p.blocked=false;m.command(p,{...idle,pressed:true,held:true},.3);assert.ok(p.charging);
 p.used=true;p.armed='bounce';p.prediction=5;m.extras.push({x:3,z:3,y:0,radius:.5,power:1,owner:p.id,expires:20});
 m.advance(1.1);assert.equal(m.phase,'transition');assert.equal(p.charging,false);const total=p.total;m.advance(2);assert.equal(p.total,total);assert.equal(m.courseIndex,0);
 m.advance(2.1);assert.equal(m.courseIndex,1);assert.equal(m.phase,'intro');assert.equal(p.used,false);assert.equal(p.armed,null);assert.equal(p.prediction,0);assert.equal(m.extras.length,0);
 m.command(p,{...idle,released:true},.1);assert.equal(p.strokes,0);
});
test('strokes first,completed active time second;penalties not double-counted;exact ties and playoff distances',()=>{
 const m=new MinigolfMatch(roster(5),()=>.5);const[a,b,c,d,e]=m.players;
 for(const p of m.players){p.total=10;p.completionTime=20;p.totalPenalties=0;}
 a.total=11;b.completionTime=15;c.totalPenalties=5;d.completionTime=22;
 assert.deepEqual(m.results().map(r=>r.playerId),[b.id,c.id,e.id,d.id,a.id]);assert.deepEqual(m.results().map(r=>r.placement),[1,2,2,4,5]);
 m.playoffScores.set(c.id,{distance:50,seconds:0});m.playoffScores.set(e.id,{distance:100,seconds:0});assert.deepEqual(m.results().map(r=>r.placement),[1,2,3,4,5]);
});
test('actual one-putt playoff,one isolated ball per turn,does not add fourth scoring record',()=>{
 const m=new MinigolfMatch(roster(2),()=>.99,[COURSES[0],COURSES[1],COURSES[2]],{holeSeconds:1});
 for(let i=0;i<3000&&!m.playoff;i++)m.advance(1/60);assert.ok(m.playoff);m.advance(4.1);const p=m.active;
 assert.equal(m.players.filter(p=>!p.ball.done).length,1);m.command(p,idle,.01);
 const power=(Math.sqrt(2*GOLF.drag*8)-GOLF.minSpeed)/(GOLF.maxSpeed-GOLF.minSpeed);
 m.command(p,{...idle,pressed:true,held:true},power*GOLF.chargeTime);m.command(p,{...idle,released:true},.01);
 m.advance(80);assert.equal(m.phase,'ended');assert.equal(m.playoffScores.get(p.id)!.distance,0);assert.equal(m.results()[0].playerId,p.id);assert.ok(m.players.every(p=>p.records.length===3&&p.total===3*(GOLF.maxStrokes+2)));
});
test('shared ex-aequo points scoped to Minigolf;double and catch-up preserved;missing/duplicate sanitization',()=>{
 const scores=new Map([['a',0],['b',0],['c',0]]),rank=['a','b','c'];
 assert.deepEqual(ScoreManager.awardRound(scores,rank,60),{a:10,b:6,c:3});assert.deepEqual(ScoreManager.awardRound(scores,rank,60,true,{a:1,b:1,c:3}),{a:16,b:16,c:6});
 scores.set('c',30);assert.deepEqual(ScoreManager.awardRound(scores,rank,60,false,{a:1,b:1,c:3}),{a:12,b:12,c:3});
 for(const game of ['minigolf','arena']){const s=new GameSession('TEST',3,60,'host');
  for(const id of rank){const p=new PlayerSession(id,id,`token:${id}`);p.characterId=chars[rank.indexOf(id)];p.ready=true;p.attach('socket:'+id);s.addPlayer(p);}
  s.selectMinigame(game);s.startGame();s.phase='MINIGAME_PLAYING';s.currentMinigame!.modifierId=null; // fixed scoring fixture; double/catchup tested above
  s.finishMinigame([{playerId:'a',placement:1,score:42},{playerId:'b',placement:1,score:42},{playerId:'b',placement:1,score:42}]);
  assert.equal(s.lastResults!.results.length,3);assert.deepEqual(s.lastResults!.results.map(r=>r.placement),game==='minigolf'?[1,1,3]:[1,2,3]);
  assert.deepEqual(s.lastResults!.deltas,game==='minigolf'?{a:8,b:8,c:3}:{a:10,b:6,c:3});if(game==='minigolf')assert.equal(s.lastRound!.winnerId,null);s.resetToLobby();
 }
});
const simulations:any[]=[];
test('24 complete3hole bot tournaments:2–5 players,6 seeds each,unique courses,no skipped record,finite scoring',()=>{
 for(let n=2;n<=5;n++)for(let seed=1;seed<=6;seed++){
  const rng=new Rng(seed*91+n),m=new MinigolfMatch(roster(n),()=>rng.next()),bot=new MinigolfBot(()=>rng.next());let elapsed=0;
  for(let i=0;i<(3*(GOLF.holeSeconds+GOLF.rollSeconds+10)+300)*60&&m.phase!=='ended';i++){m.command(m.active,bot.command(m.active,m.course,1/60),1/60);m.advance(1/60);m.events=[];elapsed+=1/60;}
  assert.equal(m.phase,'ended');assert.equal(new Set(m.courses.map(c=>c.id)).size,3);assert.ok(m.players.every(p=>p.records.length===3&&p.total===p.records.reduce((a,r)=>a+r.strokes,0)&&Number.isFinite(p.completionTime)));
  assert.ok(m.players.every(p=>Math.abs(p.completionTime-p.records.filter(r=>r.completed).reduce((a,r)=>a+r.seconds,0))<1e-6));
  simulations.push({n,seed,seconds:+elapsed.toFixed(2),courses:m.courses.map(c=>c.id),playoff:m.playoff,results:m.results(),completed:m.players.map(p=>p.completed)});
 }
});
writeFileSync('docs/agent-work/minigolf-2/tournaments.json',JSON.stringify(simulations,null,2));console.log(`PASS ${tests} Minigolf2 groups;24 full tournaments`);
