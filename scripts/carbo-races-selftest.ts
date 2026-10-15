import assert from 'node:assert/strict';
import {CasaCarboWorld} from '../src/minigames/casaCarbo/waterCore';
import {CC_NO_INPUT} from '../src/minigames/casaCarbo/ccTypes';
import {CC} from '../src/minigames/casaCarbo/ccTuning';
import {DRAINS,cellCenterPx} from '../src/minigames/casaCarbo/mapData';
import {drainRoute,roomyGrid} from '../src/minigames/casaCarbo/ccNavigation';
import {CCBot,botRoles} from '../src/minigames/casaCarbo/ccBot';
import {Rng} from '../shared/rng';
const mk=(events=true)=>new CasaCarboWorld({ids:['a','b'],characters:['goblin','ciro'],rng:()=>.4,events,rain:false});
const step=(w:CasaCarboWorld,t:number)=>{for(let i=0;i<t*60;i++)w.step(1/60,{});};
{
 const w=mk(false);step(w,30);assert.equal(w.drainRace,null,'practice disables races');
}
{
 const w=mk();step(w,8.1);const r=w.drainRace!;assert.ok(r);const [a,b]=w.players;
 // Actual input-driven bucket delivery, using real water accounting.
 const drain=DRAINS.find(d=>d.id===r.drain)!;
 a.bucket=3;w.inflowTotal=3;a.x=drain.cx;a.y=drain.cy-25;
 w.step(1/60,{a:{...CC_NO_INPUT,bucketPressed:true}});
 assert.equal(r.progress.get('a'),3);assert.equal(a.stats.raceBonus,0);assert.equal(a.bucket,0);
 a.bucket=1;w.inflowTotal++;w.step(1/60,{a:{...CC_NO_INPUT,bucketPressed:true}});
 assert.equal(w.drainRace,null);assert.equal(a.stats.raceBonus,6);assert.equal(b.stats.raceBonus,0);
 assert.ok(Math.abs(w.inflowTotal-w.waterOnFloor()-w.waterInBuckets()-w.drainedCredited-w.drainedPassive-w.spilledOutside)<.02);
 const events=w.drainEvents();assert.equal(events.filter(e=>e.t==='race'&&e.state==='won').length,1);
 step(w,4.1);assert.ok(w.drainRace);assert.notEqual(w.drainRace!.drain,r.drain);
 const r2=w.drainRace!;w.credit(a,r.drain,4,'bucket');assert.equal(r2.progress.size,0,'wrong drain gives no race progress');
 w.credit(a,r2.drain,1,'squeegee');w.credit(b,r2.drain,3.99,'ability');assert.equal(w.drainRace,r2,'per-player progress');
 step(w,18);assert.equal(w.drainRace,null,'expires with no award');assert.equal(b.stats.raceBonus,0);
 step(w,4.1);const r3=w.drainRace!;assert.ok(r3);assert.notEqual(r3.drain,r2.drain);assert.notEqual(r3.drain,r.drain,'visits all three targets');
 w.credit(a,r3.drain,4,'ability');assert.equal(a.stats.raceBonus,12,'ability drains count');
 w.credit(b,r3.drain,100,'bucket');assert.equal(b.stats.raceBonus,0,'single winner, no duplicate reward');
}
{
 const w=mk();step(w,8.1);const dest=w.drainRace!.drain;
 for(const k of w.grid.interiorCells){if(roomyGrid(w)[k]){const p=cellCenterPx(k);const r=drainRoute(w,p,dest);if(r)assert.equal(r.id,dest);}}
 w.clogged.add(dest);assert.equal(drainRoute(w,w.players[0],dest),null,'blocked target requires unclog or alternative');
}
for(const n of [2,3,4,5])for(const seed of [1,23,71]){
 const rng=new Rng(seed),w=new CasaCarboWorld({ids:Array.from({length:n},(_,i)=>String(i)),characters:['goblin','buttafuori','dottore','judoka','ciro'],rng:()=>rng.next()});
 const bots=w.players.map((p,i)=>new CCBot(p.id,()=>rng.next(),botRoles(n)[i]));let starts=0,wins=0;
 for(let i=0;i<121*30;i++){
  w.step(1/30,Object.fromEntries(bots.map(b=>[b.id,b.input(w,1/30)])));
  for(const e of w.drainEvents())if(e.t==='race'){if(e.state==='start')starts++;if(e.state==='won')wins++;}
 }
 assert.ok(w.over);assert.ok(starts>=4);assert.ok(w.drainedCredited>0);
 assert.ok(w.players.reduce((s,p)=>s+p.stats.raceBonus,0)<=starts*CC.race.prize);
 assert.ok(Math.abs(w.inflowTotal-w.waterOnFloor()-w.waterInBuckets()-w.drainedCredited-w.drainedPassive-w.spilledOutside)<.05,'conservation');
 console.log(`SIM ${n}p seed ${seed}: ${starts} races, ${wins} wins, dry ${Math.round(w.dryFraction()*100)}%`);
}
console.log('PASS: real deliveries, race rotation, expiry, bounded reward, routes, 12 full matches, conservation.');

