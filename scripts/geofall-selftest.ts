import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {GEO_QUESTIONS,GEO_CATEGORIES,GeoDeck} from '../shared/geofallQuestions';
import countries from '../shared/geofallCountries.json';
import {Rng} from '../shared/rng';
import {GeofallMatch,GEO,occupiedTile,tileCenter,roundSeconds,contain} from '../src/minigames/geofall/geofallRules';
import {GeofallBots} from '../src/minigames/geofall/geofallBot';
const chars=['goblin','buttafuori','judoka','ciro','dottore'];
const create=(n=5,seed=70)=>new GeofallMatch(Array.from({length:n},(_,i)=>({id:`p${i}`,name:`P${i}`,color:'#ffffff',characterId:chars[i],bot:true})),new Rng(seed));
const run=(m:GeofallMatch,until:()=>boolean)=>{for(let i=0;i<20000&&!until();i++)m.advance(1/60);assert.ok(until());};
const answer=(m:GeofallMatch)=>run(m,()=>m.phase==='answer');
const settle=(m:GeofallMatch)=>run(m,()=>m.phase==='answer'||m.ended);
const snapshot=(m:GeofallMatch,correctIds:string[])=>{answer(m);m.players.filter(p=>p.lives>0).forEach(p=>{const c=tileCenter(correctIds.includes(p.id)?m.correctIndex:(m.correctIndex+1)%10);p.x=c.x;p.z=c.z;});m.remaining=.008;m.advance(.01);assert.equal(m.phase,'collapse');};
assert.equal(GEO_QUESTIONS.length,100);assert.equal(new Set(GEO_QUESTIONS.map(q=>q.id)).size,100);
const byId=new Map(countries.map(c=>[c.id,c]));
for(const category of GEO_CATEGORIES)assert.equal(GEO_QUESTIONS.filter(q=>q.category===category).length,20);
for(const q of GEO_QUESTIONS){const all=[q.correct,...q.wrong];assert.equal(all.length,10);assert.equal(new Set(all.map(a=>a.id)).size,10);assert.equal(new Set(all.map(a=>a.label)).size,10);assert.ok(q.prompt.length>10&&q.sources.every(s=>s.startsWith('https://')));
 if(q.category==='confini'){const source=byId.get(q.target)!;assert.ok(source.neighbors.includes(q.correct.id));assert.ok(q.wrong.every(v=>v.id!==q.target&&!source.neighbors.includes(v.id)&&!byId.get(v.id)?.neighbors.includes(q.target)));}
 else{assert.equal(q.correct.id,q.target);if(q.category==='capitali')assert.equal(q.correct.label,byId.get(q.target)!.capital);}
 for(const a of all)if(a.image){assert.ok(existsSync('public'+a.image));assert.ok(readFileSync('public'+a.image,'utf8').includes('<svg'));}
}
console.log('PASS 100 domande:20/categoria,10 opzioni uniche,confini/risposta verificati,60 SVG locali.');
assert.ok(byId.get('CA')!.neighbors.includes('DK'),'Hans Island: confine Canada/Danimarca');
assert.ok(byId.get('BR')!.neighbors.includes('FR'),'Guyana francese: confine Brasile/Francia');
assert.ok(!GEO_QUESTIONS.find(q=>q.id==='confini-BR')!.wrong.some(a=>a.id==='FR'),'Francia non può essere distrattore del Brasile');
assert.ok(GEO_QUESTIONS.find(q=>q.id==='confini-FR')!.prompt.includes('metropolitana'));
assert.ok(!['BR','SR'].includes(GEO_QUESTIONS.find(q=>q.id==='confini-FR')!.correct.id));
{
 const d=new GeoDeck(new Rng(51)),seen=new Map(GEO_CATEGORIES.map(c=>[c,new Set<string>()]));let categories:string[]=[];const slots=new Set<number>();
 for(let i=0;i<100;i++){const v=d.next(i+1);categories.push(v.question.category);if(i%5===4){assert.equal(new Set(categories).size,5);categories=[];}const s=seen.get(v.question.category)!;assert.ok(!s.has(v.question.id));s.add(v.question.id);slots.add(v.correctIndex);assert.equal(v.answers[v.correctIndex].id,v.question.correct.id);}
 assert.equal(slots.size,10);for(const s of seen.values())assert.equal(s.size,20);
 let last='';for(let i=100;i<2000;i++){const v=d.next(i+1);assert.notEqual(v.question.id,last);last=v.question.id;}
}
assert.deepEqual([1,5,6,10,11,80].map(roundSeconds),[10,10,8,8,6,6]);
assert.equal(occupiedTile(0,0),7);assert.equal(occupiedTile(-12.5,-5),0);assert.equal(occupiedTile(12.5,5),9);assert.equal(occupiedTile(12.5001,0),null);assert.equal(occupiedTile(0,-5.001),null);assert.equal(occupiedTile(NaN,0),null);
for(let tile=0;tile<10;tile++){const c=tileCenter(tile);assert.equal(occupiedTile(c.x,c.z),tile);}
{
 const m=create(2);answer(m);const a=m.players[0],b=m.players[1];m.command(a.id,0,0,false);const c=tileCenter(9);let t=0;
 for(;t<6;t+=1/120){const dx=c.x-a.x,dz=c.z-a.z,d=Math.hypot(dx,dz);if(d<.15)break;m.command(a.id,dx/d,dz/d,false);m.advance(1/120);}
 assert.ok(t<4&&occupiedTile(a.x,a.z)===9,`far tile:${t}`);assert.equal(b.lives,3);
}
{
 const m=create();snapshot(m,['p0','p1']);assert.deepEqual(m.players.map(p=>p.lives),[3,3,2,2,2]);const locks=m.players.map(p=>p.lockedTile);m.players[4].x=m.players[0].x;m.players[4].z=m.players[0].z;
 for(let i=0;i<40;i++){m.command('p4',1,1,true);m.advance(.02);}assert.deepEqual(m.players.map(p=>p.lives),[3,3,2,2,2]);assert.deepEqual(m.players.map(p=>p.lockedTile),locks);
}
{
 const m=create(3);answer(m);const[a,b,c]=m.players;a.x=0;a.z=-.9;a.facing=0;b.x=0;b.z=-.2;c.x=0;c.z=1.8;assert.equal(occupiedTile(b.x,b.z),2);
 m.push(a);assert.ok(a.pushUsed&&b.immunity===.7&&b.stun===.18);assert.equal(c.immunity,0);const n=m.events.filter(e=>e.type==='hit').length;m.push(a);assert.equal(m.events.filter(e=>e.type==='hit').length,n);
 a.immunity=.7;c.facing=Math.PI;m.push(c);assert.equal(m.events.filter(e=>e.type==='hit').length,n);for(let i=0;i<60;i++)m.advance(1/120);assert.ok(b.z>1&&b.stun===0&&b.immunity>0);assert.equal(occupiedTile(b.x,b.z),7,'spinta cambia davvero casella');
 m.command(b.id,0,0,false);m.command(b.id,0,-1,false);const z=b.z;for(let i=0;i<120;i++)m.advance(1/120);assert.ok(b.z<z-2);assert.equal(b.lives,3);
 for(const p of m.players){p.x=12;p.z=4.5;p.vx=50;p.vz=50;}for(let i=0;i<120;i++)m.advance(1/120);assert.ok(m.players.every(p=>p.lives===3&&occupiedTile(p.x,p.z)!==null));
 snapshot(m,[]);settle(m);assert.ok(m.players.every(p=>!p.pushUsed));
}
{
 const m=create(2);answer(m);const p=m.players[0];p.facing=Math.PI;m.push(p);assert.ok(p.pushUsed);assert.equal(m.events.filter(e=>e.type==='hit').length,0);
 m.command(p.id,0,1,false,2);assert.equal(p.dz,0);m.command(p.id,0,1,false,2);assert.equal(p.dz,1);m.cancel();assert.equal(p.dz,0);
}
for(let n=2;n<=5;n++){
 const m=create(n);for(let i=0;i<3;i++){snapshot(m,[]);assert.ok(m.players.every(p=>p.lives===2-i));settle(m);}assert.ok(m.tie&&m.players.every(p=>p.lives===1));
 const previous=m.question.id;snapshot(m,[]);settle(m);assert.notEqual(m.question.id,previous);assert.ok(m.players.every(p=>p.lives===1));snapshot(m,['p0']);settle(m);assert.equal(m.winner,'p0');assert.equal(m.results().length,n);assert.deepEqual(m.results().map(p=>p.placement),Array.from({length:n},(_,i)=>i+1));
}
{
 const m=create(5);m.players.slice(2).forEach(p=>{p.lives=0;p.eliminatedRound=1;});m.players[0].lives=m.players[1].lives=1;snapshot(m,[]);settle(m);assert.deepEqual(m.players.map(p=>p.lives),[1,1,0,0,0]);
 assert.ok(m.players.slice(2).every(p=>!p.lost));const spectator=m.players[2],x=spectator.x;m.command(spectator.id,1,0,true);assert.equal(spectator.x,x);assert.equal(spectator.dx,0);
 snapshot(m,['p1']);settle(m);assert.equal(m.winner,'p1');assert.ok(m.results().slice(2).every(p=>p.stats![1].includes('round 1')));
}
{
 const outcomes=[];for(const fps of [30,60,120]){const m=create(2),p=m.players[0];answer(m);m.command(p.id,0,0,false);for(let i=0;i<fps*2;i++){m.command(p.id,1,.25,false);m.advance(1/fps);}outcomes.push([p.x,p.z,m.remaining]);}for(const row of outcomes)row.forEach((v,i)=>assert.ok(Math.abs(v-outcomes[0][i])<.00001));
}
{
 const m=create();answer(m);const center=tileCenter(m.correctIndex);m.players.forEach(p=>{p.x=center.x;p.z=center.z;});for(let i=0;i<120;i++)m.advance(1/120);assert.ok(m.players.every(p=>occupiedTile(p.x,p.z)===m.correctIndex));snapshot(m,m.players.map(p=>p.id));assert.ok(m.players.every(p=>p.lives===3));
}
const natural=[];
for(let n=2;n<=5;n++)for(let seed=1;seed<=12;seed++){
 const m=create(n,seed),bots=new GeofallBots(new Rng(seed*234));for(let i=0;i<60000&&!m.ended;i++){for(const p of m.players){const c=bots.command(p,m,1/60);m.command(p.id,c.x,c.z,c.push);}m.advance(1/60);}
 assert.ok(m.ended,`round naturale n${n} seed${seed}`);assert.ok(m.winner);assert.equal(new Set(m.results().map(r=>r.playerId)).size,n);natural.push({n,seed,seconds:+m.time.toFixed(1),rounds:m.round});
}
for(const point of [{x:99,z:99},{x:-99,z:-99},{x:9,z:-7},{x:0,z:-99}]){contain(point);assert.ok(point.z>=-8+GEO.radius&&point.x<=12.5-GEO.radius);}
console.log('PASS snapshot/vite uniche/spawn/bordi; spinta singola mancata/protezione/recupero/noKO;5 su una casella;solo ultimi pari/spareggio ripetuto;30/60/120;48 partite bot naturali2–5.');
console.log(JSON.stringify(natural));
