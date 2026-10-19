import{writeFileSync}from'node:fs';
import{SydneyTrack}from'../src/minigames/kart-race/sydneyTrack';
const t=new SydneyTrack(),points=[];
for(let s=0;s<t.totalLength;s+=.75){const height=t.flightHeightAt(s);points.push({s,p:t.worldPoint(s,0,height).asArray(),base:t.positionAt(s).asArray(),r:t.rightAt(s).asArray(),w:t.widthAt(s),air:!t.hasRoadAt(s),height:0});}
writeFileSync('docs/agent-work/track-corrections/sydney-probes.json',JSON.stringify(points));
writeFileSync('docs/agent-work/track-corrections/sydney-route-meta.json',JSON.stringify({length:t.totalLength,gaps:t.gaps,checkpoints:t.checkpoints,access:t.accessRamps},null,2));
