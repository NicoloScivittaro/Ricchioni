import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {RainbowTrack,stepRainbowKart} from '../src/minigames/kart-race/rainbowTrack';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
const track=new RainbowTrack(),events:string[]=[];
for(const gap of track.gaps){
 const k=createKartState('compat','goblin','#fff','');Object.assign(k,{distance:gap.launch-.1,speed:44,absHeading:track.tangentAngleAt(gap.launch-.1)});
 let landed=false;for(let i=0;i<2000&&!landed;i++)stepRainbowKart(k,{left:false,right:false,up:true,down:false,drift:false,item:false,steer:0,driftReleased:false},1/120,track,false,e=>{events.push(e);if(e==='land')landed=true;});
 assert.ok(landed);assert.equal(k.flight,'DRIVE');
}
assert.deepEqual(events,['launch','land','launch','land']);
writeFileSync('docs/agent-work/sydney-sprint/compat-checks.json',JSON.stringify({trackLength:track.totalLength,events,check:'Both existing Arcobaleno gaps still launch and land with the default flight contract'},null,2));console.log('PASS: both existing Arcobaleno glides unchanged');
