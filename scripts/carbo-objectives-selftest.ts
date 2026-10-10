import assert from 'node:assert/strict';
import {CasaCarboWorld} from '../src/minigames/casaCarbo/waterCore';
import {CC_NO_INPUT} from '../src/minigames/casaCarbo/ccTypes';
import {CC} from '../src/minigames/casaCarbo/ccTuning';
import {cellCenterPx,TV_POINT,DOORS} from '../src/minigames/casaCarbo/mapData';
import {drainRoute,roomyGrid} from '../src/minigames/casaCarbo/ccNavigation';
import {CCBot,botRoles} from '../src/minigames/casaCarbo/ccBot';
import {Rng} from '../shared/rng';
const mk=(events=true,rain=false)=>{const rng=new Rng(25);return new CasaCarboWorld({ids:['a','b','c','d','e'],characters:['goblin','buttafuori','dottore','judoka','ciro'],rng:()=>rng.next(),events,rain});};
const run=(w:CasaCarboWorld,t:number,inputs:Record<string,any>={})=>{for(let i=0;i<t*60;i++)w.step(1/60,inputs);};
const input=(x:object)=>({...CC_NO_INPUT,...x});
const balance=(w:CasaCarboWorld)=>assert.ok(Math.abs(w.inflowTotal-w.waterOnFloor()-w.waterInBuckets()-w.drainedCredited-w.drainedPassive-w.spilledOutside)<.02);
{
 const w=mk(false);w.time=40;for(const k of w.grid.tvCells){w.h[k]=.9;w.inflowTotal+=.9;}
 run(w,.05);assert.equal(w.emergency?.kind,'tv');
 const [a,b]=w.players;a.x=TV_POINT.cx-45;a.y=TV_POINT.cy;b.x=a.x-30;b.y=a.y;
 run(w,.7,{b:input({interactHeld:true})});run(w,1.7,{a:input({interactHeld:true})});
 assert.equal(w.tv,'saved');assert.equal(a.stats.tvSaved,1);assert.ok(b.stats.emergencyBonus>0);assert.equal(w.emergency,null);balance(w);
}
{
 const w=mk();w.schedule=[];w.time=20;
 for(const k of w.grid.interiorCells){const c=cellCenterPx(k);if(c.x<778&&c.y<392){w.h[k]=.17;w.inflowTotal+=.17;}}
 run(w,.05);assert.equal(w.emergency?.kind,'bedroom');const original=w.bedroomWater();
 const a=w.players[0];let cycles=0;
 while(w.emergency && cycles++<6){
  const chosen:number[]=[];
  for(const p of w.players){
   const k=w.grid.interiorCells.filter(k=>{const c=cellCenterPx(k);return roomyGrid(w)[k]&&c.x<778&&c.y<392&&chosen.every(q=>{const d=cellCenterPx(q);return Math.hypot(c.x-d.x,c.y-d.y)>65;});}).sort((a,b)=>w.h[b]-w.h[a])[0];
   chosen.push(k);const c=cellCenterPx(k);p.x=c.x;p.y=c.y;p.vx=p.vy=0;
  }
  run(w,1.3,Object.fromEntries(w.players.map(p=>[p.id,input({bucketHeld:true})])));
  if(cycles===1)assert.equal(w.players.reduce((a,p)=>a+p.stats.emergencyBonus,0),0,'collecting/moving alone does not award bonus');
  if(!w.emergency)break;
  for(const p of w.players){p.x=215;p.y=575;p.vx=p.vy=0;w.step(1/60,{[p.id]:input({bucketPressed:true})});p.x=500;p.y=630;}
 }
 console.log('Bedroom:',{original,remaining:w.bedroomWater(),drained:w.drainedCredited,cycles});
 assert.ok(w.bedroomWater()<=original*.65);assert.equal(w.emergency,null);
 assert.ok(Math.abs(w.players.reduce((sum,p)=>sum+p.stats.emergencyBonus,0)-CC.emergency.bedroomPool)<1e-9);balance(w);
 const bonus=a.stats.emergencyBonus;run(w,3);assert.equal(a.stats.emergencyBonus,bonus,'single bounded reward');
}
{
 const w=mk(true,true);w.schedule=[{kind:'raffica',at:3,door:'back',announced:false,started:false,ended:false}];
 const a=w.players[0];a.x=DOORS[1].cx;a.y=DOORS[1].cy-30;run(w,4.5,{a:input({interactHeld:true})});
 assert.equal(a.stats.emergencyBonus,CC.emergency.doorPool);assert.equal(w.emergency,null);assert.ok(w.nominalRain('back')>0,'rain continues');balance(w);
}
{
 const w=mk();const p=w.players[0];p.x=450;p.y=250;const route=drainRoute(w,p);assert.ok(route&&route.steps>0);
 w.clogged.add(route.id);assert.notEqual(drainRoute(w,p)?.id,route.id);
 for(const d of ['bagno','lavello','tombino'])w.clogged.add(d);assert.equal(drainRoute(w,p),null);
}
{
 const w=mk(true,true), rng=new Rng(4), roles=botRoles(5);const bots=w.players.map((p,i)=>new CCBot(p.id,()=>rng.next(),roles[i]));
 for(let i=0;i<20*60;i++)w.step(1/60,Object.fromEntries(bots.map(b=>[b.id,b.input(w,1/60)])));
 assert.ok(w.drainedCredited>0,'useful scoring cleanup within first 20 seconds');balance(w);
 console.log('First 20s:',{drained:w.drainedCredited,dry:w.dryFraction(),points:w.players.map(p=>w.contribution(p))});
}
console.log('PASS: 3 emergencies, weighted assistants, actual drains only, capped awards, conservation, reachable guide, early useful actions.');

