import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {Rng} from '../shared/rng';
import {GEO_QUESTIONS,GEO_CATEGORIES,GeoDeck} from '../shared/geofallQuestions';
import {AB,abilityFor} from '../shared/abilityCatalog';
import {GeofallMatch,tileCenter,roundSeconds} from '../src/minigames/geofall/geofallRules';
import {geoAbilityStatus} from '../src/minigames/geofall/geofallAbilities';
import {GeofallBots} from '../src/minigames/geofall/geofallBot';
let tests=0;const test=(name:string,f:()=>void)=>{f();tests++;console.log('PASS',name);};
const chars=['goblin','buttafuori','judoka','dottore','ciro'];
const create=(n=5,seed=2)=>new GeofallMatch(chars.slice(0,n).map((characterId,i)=>({id:String(i),name:characterId,characterId,color:'#fff',bot:true})),new Rng(seed));
const advance=(m:GeofallMatch,t:number)=>{for(let left=t;left>1e-7;left-=1/120)m.advance(Math.min(left,1/120));};
const ready=(m:GeofallMatch)=>{advance(m,1.9);assert.equal(m.phase,'answer');m.players.forEach(p=>m.command(p.id,0,0,false));};
test('original100 objects retained unchanged;175 unique questions;15 new/category;all10 options exactly one correct',()=>{
 const before=JSON.parse(readFileSync('docs/agent-work/geofall-2/original-100.json','utf8'));assert.deepEqual(GEO_QUESTIONS.slice(0,100),before);
 assert.equal(GEO_QUESTIONS.length,175);assert.equal(new Set(GEO_QUESTIONS.map(q=>q.id)).size,175);
 for(const category of GEO_CATEGORIES){const added=GEO_QUESTIONS.slice(100).filter(q=>q.category===category);assert.equal(added.length,15);assert.ok(added.some(q=>q.difficulty===3));assert.ok(added.some(q=>q.difficulty===4));}
 for(const q of GEO_QUESTIONS){const answers=[q.correct,...q.wrong];assert.equal(q.wrong.length,9);assert.equal(new Set(answers.map(a=>a.id)).size,10);assert.equal(new Set(answers.map(a=>a.label)).size,10);assert.ok(q.sources.length&&q.sources.every(s=>s.startsWith('https://')));
  for(const a of answers)if(a.image){assert.ok(existsSync('public'+a.image));const svg=readFileSync('public'+a.image,'utf8');assert.ok(!/<script|foreignObject|\sonload=/i.test(svg));if(q.id.startsWith('advanced-')&&q.category==='monumenti')assert.ok(!/<text|<title/i.test(svg));}
 }
});
test('new boundaries independently compared with source snapshot, including omitted Botswana/Zambia boundary',()=>{
 const lines=readFileSync('docs/agent-work/geofall-2/geonames.txt','utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('\t'));
 const neighbors=new Map(lines.map(r=>[r[0],r[17].split(',')]));neighbors.get('BW')!.push('ZM');neighbors.get('ZM')!.push('BW');
 for(const q of GEO_QUESTIONS.slice(100).filter(q=>q.category==='confini')){assert.ok(neighbors.get(q.target)!.includes(q.correct.id));for(const a of q.wrong){assert.ok(!neighbors.get(q.target)!.includes(a.id));assert.ok(!neighbors.get(a.id)!.includes(q.target));}}
 const bw=GEO_QUESTIONS.find(q=>q.id==='advanced-confini-BW')!;assert.ok(!bw.wrong.some(a=>a.id==='ZM'));
});
test('flag national proportions and similar pairs; no shade-only Chad/Romania pair',()=>{
 const audit=JSON.parse(readFileSync('docs/agent-work/geofall-2/flag-audit.json','utf8'));
 for(const[c,ratio]of [['MC',1.25],['ID',1.5],['IE',2],['CI',1.5]])assert.equal(audit.find((a:any)=>a.country===c).ratio,ratio);
 assert.ok(GEO_QUESTIONS.find(q=>q.id==='advanced-bandiere-ID')!.wrong.some(a=>a.id==='MC'));
 assert.ok(GEO_QUESTIONS.find(q=>q.id==='advanced-bandiere-CI')!.wrong.some(a=>a.id==='IE'));
 assert.ok(!GEO_QUESTIONS.find(q=>q.id==='advanced-bandiere-TD')!.wrong.some(a=>a.id==='RO'));
});
test('category cycles and requested tier progression over100 seeds, long session anti-repeat and every option slot',()=>{
 const totals=[0,0,0,0],higher=[0,0,0,0],slots=new Set<number>();
 for(let seed=1;seed<=100;seed++){
  const d=new GeoDeck(new Rng(seed));let block:string[]=[],lastCategory='',lastId='';const seen=new Map<string,number>();
  for(let round=1;round<=200;round++){
   const v=d.next(round),level=v.question.difficulty,band=round<=5?0:round<=10?1:round<=15?2:3;
   totals[band]++;if(level===[2,3,3,4][band])higher[band]++;
   assert.ok(band===0?[1,2].includes(level):band===1?[2,3].includes(level):band===2?level===3:[3,4].includes(level));
   assert.notEqual(v.question.category,lastCategory);assert.notEqual(v.question.id,lastId);assert.ok(round-(seen.get(v.question.id)??-Infinity)>=25);
   seen.set(v.question.id,round);lastId=v.question.id;lastCategory=v.question.category;block.push(lastCategory);
   if(round%5===0){assert.equal(new Set(block).size,5);block=[];}assert.equal(v.answers.length,10);assert.equal(v.answers[v.correctIndex].id,v.question.correct.id);slots.add(v.correctIndex);
  }
 }
 assert.ok(higher[1]/totals[1]>.25&&higher[1]/totals[1]<.5);assert.ok(higher[3]/totals[3]>.7);assert.equal(slots.size,10);
 assert.deepEqual([1,5,6,10,11,15,16,60].map(roundSeconds),[10,10,8,8,6,6,6,6]);
});
test('all5 abilities: valid/invalid activation, no phantom charges, proper shared statuses and one-round resources',()=>{
 for(let i=0;i<5;i++){
  const m=create(),p=m.players[i];assert.equal(m.activate(p.id),'NON ORA');ready(m);m.players.forEach((p,n)=>{p.x=n*1.2;p.z=0;});
  if(p.characterId==='judoka')p.vx=7;if(p.characterId==='ciro'){p.x=0;p.z=-1.5;p.facing=0;}
  const charges=p.ab.charges;assert.equal(m.activate(p.id),null);assert.equal(p.ab.charges,charges-1);assert.ok(['ACTIVE','SPENT','COOLDOWN'].includes(geoAbilityStatus(p,m.phase).state));
  assert.notEqual(m.activate(p.id),null);const lives=m.players.map(p=>p.lives);advance(m,.9);assert.deepEqual(m.players.map(p=>p.lives),lives);
  m.players.forEach(p=>Object.assign(p,tileCenter(m.correctIndex)));m.remaining=.005;advance(m,.01);assert.equal(m.phase,'collapse');assert.ok(m.players.every(p=>p.ab.active===0&&p.confusion===0&&p.confusionWarning===0));
  advance(m,4.6);assert.equal(m.phase,'answer');assert.equal(p.ab.charges,abilityFor('geofall',p.characterId)!.charges);assert.equal(p.ab.cooldown,0);
 }
});
test('Goblin timed shield consumes one received push only, does not grant extra attacks or life, cooldown5s',()=>{
 const m=create(),g=m.players[0],a=m.players[1];ready(m);g.x=a.x=0;g.z=0;a.z=-1;a.facing=0;
 assert.equal(m.activate(g.id),null);m.push(a);assert.equal(a.pushUsed,true);assert.equal(g.vx,0);assert.equal(g.vz,0);assert.equal(g.ab.shield,false);assert.ok(m.events.some(e=>e.type==='blocked'));
 assert.equal(m.activate(g.id),'IN RICARICA');advance(m,5.01);assert.equal(m.activate(g.id),null);advance(m,.5);assert.equal(g.ab.shield,false);assert.equal(m.activate(g.id),'IN RICARICA');
});
test('Boschi resists without retaliatory wave; Carbo brakes impulse; Victor faster but no auto movement/answer',()=>{
 const m=create();ready(m);const[a,b,c,v]=m.players;a.x=b.x=0;a.z=-1;b.z=0;a.facing=0;
 m.activate(b.id);m.push(a);assert.ok(Math.abs(b.vz-13*AB.geofall.buttafuori.p.resist)<1e-8);assert.equal(m.events.filter(e=>e.type==='push').length,1);
 c.vx=8;c.vz=4;c.stun=.15;m.activate(c.id);assert.equal(c.vx,8*.12);assert.equal(c.stun,0);
 v.x=-10;v.z=-2;m.activate(v.id);const x=v.x;advance(m,.1);assert.equal(v.x,x);m.command(v.id,1,0,false);advance(m,.2);assert.ok(v.x-x>6.5*.2);
 assert.ok(m.players.every(p=>p.lives===3));
});
test('confusion warns, then reverses both axes, expires with recovery time; no stacking or late/no-target activation',()=>{
 const m=create(),a=m.players[4],b=m.players[0];ready(m);m.players.slice(1,4).forEach(p=>{p.x=10;p.z=3;});a.x=b.x=0;a.z=-1;b.z=0;a.facing=0;
 assert.equal(m.activate(a.id),null);assert.equal(b.confusion,0);assert.ok(b.confusionWarning>0);m.command(b.id,1,0,false);const x=b.x;advance(m,.25);assert.ok(b.x>x);
 advance(m,.2);assert.ok(b.confusion>0);const midpoint=b.x;advance(m,.15);assert.ok(b.x<midpoint);
 a.ab.charges=1;assert.equal(m.activate(a.id),'NESSUNO DAVANTI');advance(m,1);assert.equal(b.confusion,0);assert.ok(m.remaining>7);assert.ok(b.confusionImmunity>0);
 m.remaining=2.4;assert.equal(m.activate(a.id),'TROPPO TARDI');assert.equal(a.ab.charges,1);
});
test('simultaneous abilities and wrong tile at deadline: exactly1 life lost, positions locked, no collapse abilities or extra normal push',()=>{
 const m=create();ready(m);m.players.forEach((p,i)=>{p.x=i*.8;p.z=-1;});m.players[2].vx=5;m.players[4].facing=Math.PI/2;
 for(const p of m.players)m.activate(p.id);m.players.forEach(p=>{const c=tileCenter((m.correctIndex+1)%10);p.x=c.x;p.z=c.z;});
 m.remaining=.005;advance(m,.01);assert.deepEqual(m.players.map(p=>p.lives),[2,2,2,2,2]);const locked=m.players.map(p=>p.lockedTile);
 for(const p of m.players){assert.equal(m.activate(p.id),'NON ORA');m.push(p);}advance(m,.4);assert.deepEqual(m.players.map(p=>p.lockedTile),locked);assert.deepEqual(m.players.map(p=>p.lives),[2,2,2,2,2]);
});
test('48 full2–5 player simulations with actual bot abilities, variable tiers, natural winner and rankings',()=>{
 const rows=[];let uses=0;
 for(const n of [2,3,4,5])for(let seed=1;seed<=12;seed++){
  const m=create(n,seed),bots=new GeofallBots(new Rng(seed*73));for(let i=0;i<90000&&!m.ended;i++){
   const commands=m.players.map(p=>({p,c:bots.command(p,m,1/60)}));for(const{p,c}of commands)if(c.ability&&m.activate(p.id)===null)uses++;
   for(const{p,c}of commands)m.command(p.id,c.x,c.z,c.push);m.advance(1/60);m.events=[];
  }
  assert.ok(m.ended&&m.winner);assert.equal(new Set(m.results().map(r=>r.placement)).size,n);rows.push({n,seed,time:m.time,rounds:m.round,winner:m.winner});
 }assert.ok(uses>20);writeFileSync('docs/agent-work/geofall-2/simulations.json',JSON.stringify({rows,abilityUses:uses},null,2));
});
console.log(`Geofall2: ${tests} test groups passed`);
