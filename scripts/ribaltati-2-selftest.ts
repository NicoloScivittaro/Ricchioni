import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {buildTrack,buildCheckpoints,LAPS} from '../src/minigames/kart-race/track';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {stepKartPhysics,respawnKart} from '../src/minigames/kart-race/kartPhysics';
import {RaceManager} from '../src/minigames/kart-race/race';
import {TRACK_RAMPS,SWEEPER_AT,EXPRESS,stepTrackDynamics,expressLateral,trackSurface,sweeperLateral} from '../src/minigames/kart-race/trackDynamics';
import {MotionBots} from '../src/minigames/bots/MotionBots';
import {InputManager} from '../src/network/InputManager';
import {Rng} from '../shared/rng';
import type {MinigameContext} from '../src/minigames/types';
import {resolveKartContact} from '../src/minigames/kart-race/kartCollisions';
const sp=buildTrack(),L=sp.totalLength,cp=buildCheckpoints(sp),angle=(s:number)=>sp.tangentAngleAt(s),half=(s:number)=>sp.widthAt(s)/2;
const k=(id='x')=>createKartState(id,'goblin','#fff','x');
assert.ok(L>1250&&L<1450);assert.equal(LAPS,3);assert.equal(cp.length,8);
let minY=Infinity,maxY=-Infinity,minW=Infinity,maxW=0,maxGrade=0,maxBank=0;
const pts=[];
for(let s=0;s<L;s+=2){const p=sp.positionAt(s),r=sp.rightAt(s),t=sp.tangentAt(s),w=sp.widthAt(s);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);minW=Math.min(minW,w);maxW=Math.max(maxW,w);maxGrade=Math.max(maxGrade,Math.abs(t.y));maxBank=Math.max(maxBank,Math.abs(r.y));assert.ok(Number.isFinite(p.x+p.y+p.z+w));assert.ok(Math.abs(r.length()-1)<1e-6);assert.ok(Math.abs(t.dot(r))<.005);pts.push({s,p,w});}
assert.ok(maxY>=11.9&&minY>-.5);assert.ok(minW>=15&&maxW>=24);assert.ok(maxGrade<.4);assert.ok(maxBank>.02);
for(let i=0;i<pts.length;i+=3)for(let j=i+1;j<pts.length;j+=3){const a=pts[i],b=pts[j],gap=Math.min(b.s-a.s,L-(b.s-a.s));if(gap<45)continue;assert.ok(Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)>(a.w+b.w)/2+1,'non-adjacent carriageways never overlap');}
assert.ok(sp.positionAt(-.001).subtract(sp.positionAt(.001)).length()<.01,'closed seam');
for(const ramp of TRACK_RAMPS)for(const lap of [0,1,2]){
 const a=k();a.speed=40;a.invulnTimer=0;a.distance=(lap+ramp.at)*L+.2;let launches=0;
 stepTrackDynamics(a,{distance:a.distance-.4,lateral:0},L,s=>sp.widthAt(s),0,e=>{if(e==='launch')launches++;});assert.equal(launches,1);assert.ok(a.jumpVelocity>5);
 let apex=0;for(let i=0;i<180;i++){stepKartPhysics(a,{left:false,right:false,up:false,down:false,drift:false,item:false,steer:0,driftReleased:false},1/120,()=>20,()=>a.absHeading,false);apex=Math.max(apex,a.jumpHeight);}
 assert.ok(apex>1);assert.equal(a.jumpHeight,0,'safe landing');
}
{
 const a=k();a.invulnTimer=0;a.distance=SWEEPER_AT*L+.1;a.lateral=sweeperLateral(0,sp.widthAt(a.distance));a.speed=40;let hit=0;
 stepTrackDynamics(a,{distance:a.distance-6,lateral:a.lateral},L,s=>sp.widthAt(s),0,()=>hit++);assert.equal(hit,1,'swept obstacle catches a fast crossing');assert.ok(a.stunTimer>0);stepTrackDynamics(a,a,L,s=>sp.widthAt(s),0,()=>hit++);assert.equal(hit,1,'cooldown');
 const air=k();air.distance=a.distance;air.jumpHeight=2.3;air.invulnTimer=0;stepTrackDynamics(air,air,L,s=>sp.widthAt(s),0,()=>assert.fail('airborne clearance'));assert.equal(air.stunTimer,0);
 const shield=k();shield.distance=a.distance;shield.shielded=true;shield.invulnTimer=0;stepTrackDynamics(shield,shield,L,s=>sp.widthAt(s),0,()=>assert.fail('shield must absorb'));assert.equal(shield.stunTimer,0);assert.equal(shield.shielded,false);
}
{
 const a=k();a.distance=(EXPRESS[0]+.02)*L;a.lateral=expressLateral(sp.widthAt(a.distance));a.speed=35;stepTrackDynamics(a,a,L,s=>sp.widthAt(s),0,()=>{});assert.ok(a.boostTimer>0);
 const b=k();b.distance=a.distance;b.lateral=4;b.speed=35;stepTrackDynamics(b,b,L,s=>sp.widthAt(s),0,()=>{});assert.equal(b.boostTimer,0);assert.equal(b.stunTimer,0,'safe lane');
 const c=k();c.distance=a.distance;c.invulnTimer=0;c.speed=35;stepTrackDynamics(c,c,L,s=>sp.widthAt(s),0,()=>{});assert.ok(Math.abs(c.lateral)>=1.75&&c.stunTimer>0,'island collision matches visible median');
 assert.ok(trackSurface(L*.51,0,L).grip<1);assert.equal(trackSurface(L*.1,0,L).grip,1);
 a.lastValidCheckpointS=cp[3];respawnKart(a,angle);assert.equal(a.jumpHeight,0);assert.equal(a.distance,cp[3]);
}
const races=[];
{
 const a=k('a'),b=k('b'),c=k('c');a.distance=900;b.distance=300;c.distance=700;const r=new RaceManager(cp,L,1,angle,()=>{});r.phase='racing';r.update(1,[a,b,c],()=>false);assert.deepEqual(r.buildResults([a,b,c]).map(p=>p.playerId),['a','c','b'],'timeout ranks unfinished racers by real progress');
}
for(const n of [2,3,4,5])for(const seed of [11,32])for(const hz of [30,60,120]){
 const input=new InputManager(),players=Array.from({length:n},(_,i)=>({id:'bot'+i,bot:true}));
 const ctx={players,input,modifier:null,rng:new Rng(seed)} as unknown as MinigameContext;
 const bots=new MotionBots(ctx,seed),ks=players.map((p,i)=>Object.assign(k(p.id),{distance:-1-Math.floor(i/2)*3.6,lateral:(i%2?2.3:-2.3)+(ctx.rng.next()-.5)*.5,absHeading:angle(-1-Math.floor(i/2)*3.6)}));
 const race=new RaceManager(cp,L,230,angle,()=>{});let launches=0,hits=0,frames=0;
 while(race.phase!=='ended'&&frames++<245*hz){for(let sub=0;sub<120/hz;sub++){
  race.update(1/120,ks,()=>false);if(race.phase!=='racing')continue;bots.kart(1/120,ks,sp);
  for(const a of ks){if(a.finished)continue;const p=input.get(a.playerId),before={distance:a.distance,lateral:a.lateral};
   stepKartPhysics(a,{left:false,right:false,up:p.pressed('up'),down:p.pressed('down'),drift:p.pressed('drift'),item:false,steer:p.axis('steer').x,driftReleased:p.justReleased('drift')},1/120,half,angle,false,trackSurface(a.distance,a.lateral,L));
   stepTrackDynamics(a,before,L,s=>sp.widthAt(s),race.raceTime,e=>{if(e==='launch')launches++;else if(e==='obstacle')hits++;});assert.ok(Number.isFinite(a.distance+a.lateral+a.speed+a.jumpHeight));assert.ok(Math.abs(a.lateral)<=half(a.distance)+.6,'barrier keeps body on track');
  }
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const frame=(a:typeof ks[0])=>{const p=sp.worldPoint(a.distance,a.lateral);return{x:p.x,y:p.y+a.jumpHeight,z:p.z,trackAngle:angle(a.distance)};};resolveKartContact(ks[i],ks[j],frame(ks[i]),frame(ks[j]));}
  input.update();
 }}
 assert.equal(race.phase,'ended');assert.ok(ks.some(a=>a.lap===3),'actual three-lap finish, not timeout');assert.ok(race.raceTime<200);assert.ok(launches>=n*2,'bots reach both ramps');
 const results=race.buildResults(ks);assert.deepEqual(results.map(p=>p.placement).sort(),Array.from({length:n},(_,i)=>i+1));
 races.push({n,seed,hz,time:race.raceTime,completed:ks.filter(a=>a.lap===3).length,launches,hits});
 if(hz===120)console.log('RACE '+JSON.stringify(races.at(-1)));
}
writeFileSync('docs/agent-work/ribaltati-2/dynamics-races.json',JSON.stringify({length:L,minY,maxY,minW,maxW,maxGrade,maxBank,races},null,2));
console.log('PASS: geometry, seam, widths, banking, ramps, collision sweeps, shield/air clearance, split lanes, respawn, 24 complete races at 30/60/120 Hz with 2–5 bots.');
