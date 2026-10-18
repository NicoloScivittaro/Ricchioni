import assert from 'node:assert/strict';
import {NullEngine,Scene,Vector3,Matrix} from '@babylonjs/core';
import {CameraManager,splitScreenLayout} from '../src/minigames/kart-race/cameraHud';
import {buildTrack} from '../src/minigames/kart-race/track';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
const engine=new NullEngine({renderWidth:1280,renderHeight:720,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4}),scene=new Scene(engine),sp=buildTrack(),manager=new CameraManager(scene);let samples=0;
const ids=['a','b','c','d','e'];for(const id of ids)manager.ensure(id,sp.worldPoint(0,0,3));
for(const n of [2,3,4,5]){
 const layout=splitScreenLayout(n);assert.ok(Math.abs(layout.reduce((a,r)=>a+r.w*r.h,0)-1)<1e-9);manager.applyLayout(ids.slice(0,n));
 for(let sector=0;sector<24;sector++)for(const [i,id] of ids.slice(0,n).entries()){
  const k=createKartState(id,'goblin','#fff','x');k.distance=sp.totalLength*sector/24;k.lateral=(i%2?1:-1)*Math.min(4,sp.widthAt(k.distance)/3);k.jumpHeight=sector%2?1.15:0;k.speed=44;
  for(let j=0;j<90;j++)manager.update(1/60,id,k,sp);
  const cam=scene.activeCameras![i],floor=sp.worldPoint(k.distance-6.4,k.lateral);assert.ok(cam.position.y>=floor.y+1.14);
  const trans=cam.getViewMatrix().multiply(cam.getProjectionMatrix(true)),vp=cam.viewport.toGlobal(1280,720),p=Vector3.Project(sp.worldPoint(k.distance,k.lateral,1+k.jumpHeight),Matrix.Identity(),trans,vp);
  assert.ok(p.x>=vp.x&&p.x<=vp.x+vp.width&&p.y>=vp.y&&p.y<=vp.y+vp.height&&p.z>0&&p.z<1,'kart stays inside its own camera frame');samples++;
 }
}
manager.dispose();scene.dispose();engine.dispose();console.log('PASS camera: '+samples+' elevated/banked/jumping positions, 2–5 split layouts, full coverage, road clearance and kart projection.');
