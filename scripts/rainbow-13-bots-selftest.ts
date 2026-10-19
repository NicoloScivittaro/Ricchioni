import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {InputManager} from '../src/network/InputManager';
import {MotionBots} from '../src/minigames/bots/MotionBots';
import {CharacterAbilities} from '../src/minigames/kart-race/abilities';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {stepKartPhysics} from '../src/minigames/kart-race/kartPhysics';
import type {MinigameContext} from '../src/minigames/types';
import type {TrackSpline} from '../src/minigames/kart-race/track';

// Controlled opportunities: real bot decisions, ordinary input, common ability manager.
const straight={suspended:true,tangentAngleAt:()=>0,botLateralAt:()=>0,hasRoadAt:()=>true} as unknown as TrackSpline;
const checks:string[]=[],passes:unknown[]=[];
function attempt(cid:string,eligible:boolean,air=false,cooldown=false){
 const input=new InputManager(),ctx={input,players:[{id:'bot',bot:true},{id:'human',bot:false}]} as unknown as MinigameContext;
 const bots=new MotionBots(ctx,13),a=new CharacterAbilities(),k=createKartState('bot',cid,'#fff',''),target=createKartState('human','goblin','#fff','');
 Object.assign(k,{abilityMeter:1,abilityCharges:1,speed:44,flight:air?'GLIDE':'DRIVE',abilityCooldown:cooldown?10:0});
 target.flight=k.flight;target.distance=eligible?8:40;
 if(cid==='buttafuori'&&eligible){if(air)Object.assign(k,{lateral:3,slipVelocity:2});else k.recoverWindow=2;}
 if(cid==='ciro'&&eligible){k.refundTimer=1.2;k.refundStun=1;k.refundSpeed=44;}
 // A curved heading is an observable reason to save a speed ability.
 if(!eligible&&['goblin','dottore'].includes(cid))k.heading=.4;
 let activated=false;
 for(let i=0;i<60;i++){
  bots.kart(1/60,[k,target],straight);a.setRaceTime(i/60);
  if(input.get('bot').justPressed('ability'))activated=a.onAbilityPress(k,[k,target],()=>{})==='ok'||activated;
  assert.equal(input.get('human').justPressed('ability'),false);
  input.update();
 }
 assert.equal(activated,eligible&&!cooldown,`${cid} ${air?'air':'ground'} eligible=${eligible} cooldown=${cooldown}`);
 checks.push(`${cid}: ${air?'air':'ground'}, opportunity=${eligible}, cooldown=${cooldown}`);
}
for(const cid of ['goblin','dottore','judoka','buttafuori','ciro']){
 attempt(cid,true);attempt(cid,false);attempt(cid,true,true);attempt(cid,true,false,true);
}
// Real forward physics: the same 15m lead can be overtaken with a ready speed ability.
const throttle={up:true,down:false,left:false,right:false,steer:0,drift:false,driftReleased:false,item:false};
for(const cid of ['goblin','dottore']){
 const a=new CharacterAbilities(),k=createKartState('bot',cid,'#fff',''),rival=createKartState('rival',null,'#fff','');
 Object.assign(k,{speed:44,abilityMeter:1});Object.assign(rival,{speed:44,distance:15});a.onAbilityPress(k,[k,rival],()=>{});
 let passedAt:number|null=null;
 for(let i=0;i<600;i++){
  a.update(1/60,k,[k,rival],false,false,()=>0,()=>{});
  for(const kart of [k,rival])stepKartPhysics(kart,throttle,1/60,()=>100,()=>0,false,{grip:1,speed:1,barriers:false});
  if(passedAt===null&&k.distance>rival.distance)passedAt=(i+1)/60;
 }
 assert.ok(passedAt!==null&&k.distance>rival.distance);
 checks.push(`${cid}: overtakes a 15m lead on a controlled straight`);passes.push({cid,initialDeficit:15,passedAt,leadAfter10s:k.distance-rival.distance});
}
writeFileSync('docs/agent-work/rainbow-1-3/after/bot-opportunities.json',JSON.stringify({checks,passes,passed:checks.length},null,2));
console.log(`PASS ${checks.length} bot opportunity and controlled overtake checks.`);
