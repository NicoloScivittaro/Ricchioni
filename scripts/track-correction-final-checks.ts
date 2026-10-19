import assert from'node:assert/strict';import{writeFileSync}from'node:fs';
import{SydneyTrack}from'../src/minigames/kart-race/sydneyTrack';import{createKartState}from'../src/minigames/kart-race/raceTypes';import{mapsFor,mapById}from'../shared/minigameMaps';import{normalizeKartTrack}from'../shared/kartTracks';
const t=new SydneyTrack();let tested:any=null;
for(const s of [201,t.atSurvey(9.5),t.atSurvey(11),t.atSurvey(20),t.atSurvey(30)]){
 if(tested)break;for(const side of[-1,1]){
  for(let lat=1;lat<=10;lat+=.25){if(!t.physical.blocked(t.worldPoint(s,side*lat),t.tangentAngleAt(s)))continue;
   const k=createKartState('wall','goblin','#fff','');Object.assign(k,{distance:s,lateral:side*(lat+1),absHeading:t.tangentAngleAt(s),speed:30});
   t.physical.resolve(t,k,{distance:s,lateral:0,jumpHeight:0});assert.ok(k.wallContact,'real visible wall stops swept kart');assert.equal(t.physical.blocked(t.worldPoint(k.distance,k.lateral),k.absHeading),false);assert.ok(Math.abs(k.lateral)<lat+.1);tested={s,side,firstBlocked:lat,resolved:k.lateral};break;
  }
  if(tested)break;
 }
}
assert.ok(tested);assert.equal(t.boxes.length,10);assert.ok(t.boxes.every(p=>t.hasRoadAt(p.s)&&!t.physical.blocked(t.worldPoint(p.s,p.lateral),t.tangentAngleAt(p.s))));let blockedCentres=[];for(let s=0;s<t.totalLength;s+=.75)if(t.physical.blocked(t.worldPoint(s,0,t.flightHeightAt(s)),t.tangentAngleAt(s)))blockedCentres.push(s);assert.deepEqual(blockedCentres,[]);
const maps=mapsFor('kart3d');assert.deepEqual(maps.map(m=>m.id),['litorale','arcobaleno','sydney','primo']);for(const m of maps){assert.equal(mapById('kart3d',m.id)?.id,m.id);assert.equal(normalizeKartTrack(m.id),m.id);}
const report={visibleWallProbe:tested,fullBodyRouteStations:Math.ceil(t.totalLength/.75),blockedCentres:0,maps:maps.map(m=>m.id)};writeFileSync('docs/agent-work/track-corrections/targeted-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
