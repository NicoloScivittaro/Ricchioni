import assert from 'node:assert/strict';
import {layoutSoccerLabels,labelOverlap} from '../src/minigames/soccer/soccerLabelLayout';
import type {LabelRect,LabelAnchor} from '../src/minigames/soccer/soccerLabelLayout';
const bounds={x:10,y:188,w:1260,h:412};
function check(anchors:LabelAnchor[],protectedRects:LabelRect[]=[],area=bounds):void {
 const before=JSON.stringify({anchors,protectedRects});
 const result=layoutSoccerLabels(anchors,protectedRects,area);
 assert.equal(JSON.stringify({anchors,protectedRects}),before,'layout never writes simulation/projections');
 assert.ok(result.every(r=>r.visible),'five readable labels when safe space exists');
 for(let i=0;i<result.length;i++){
  const r=result[i];assert.ok(r.x>=area.x&&r.y>=area.y&&r.x+r.w<=area.x+area.w&&r.y+r.h<=area.y+area.h);
  assert.ok(protectedRects.every(p=>!labelOverlap(r,p,2)),'no ball/body/goal coverage');
  for(let j=0;j<i;j++)assert.ok(!labelOverlap(r,result[j],4),'no label overlap');
 }
 const old=new Map(result.map(r=>[r.id,{dx:r.dx,dy:r.dy}]));
 assert.deepEqual(layoutSoccerLabels(anchors,protectedRects,area,old),result,'stationary layout does not flicker');
 assert.deepEqual(layoutSoccerLabels([...anchors].reverse(),protectedRects,area),result,'roster iteration order does not change placement');
}
const crowd=Array.from({length:5},(_,i)=>({id:`p${i}`,x:640,y:350,w:76+i*6,h:22}));
check(crowd,[{x:610,y:366,w:60,h:95},{x:623,y:438,w:34,h:34}]);
for(const w of [960,1280,1281,1366]){
 check(crowd.map(p=>({...p,x:w/2})),[{x:w/2-30,y:367,w:60,h:100}],{x:10,y:188,w:w-20,h:412});
 check(crowd.map(p=>({...p,x:112,y:328})),[{x:20,y:300,w:112,h:118}],{x:10,y:188,w:w-20,h:412});
 check(crowd.map(p=>({...p,x:w-112,y:328})),[{x:w-132,y:300,w:112,h:118}],{x:10,y:188,w:w-20,h:412});
}
assert.ok(layoutSoccerLabels(crowd,[bounds],bounds).every(p=>!p.visible),'exhausted safe region must not cover action');
const separated=crowd.map((p,i)=>({...p,x:160+i*230}));check(separated);
assert.ok(layoutSoccerLabels(separated,[],bounds).every(p=>p.dx===0&&p.dy===0),'spread-out players need no displacement');
console.log('PASS soccer label layout: five-player crowd, ball/body/goals, small/wide screens, stable order, safe fallback and read-only inputs.');
