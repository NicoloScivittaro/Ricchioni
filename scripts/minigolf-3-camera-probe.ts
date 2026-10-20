import assert from 'node:assert/strict';
import {NullEngine,Scene,Vector3,Matrix} from '@babylonjs/core';
import {MinigolfCamera,cameraObstructed} from '../src/minigames/minigolf/minigolfCamera';
import {COURSES,supportAt,heightAt} from '../src/minigames/minigolf/minigolfCourses';
import {MinigolfMatch} from '../src/minigames/minigolf/minigolfRules';
import type {PlayerSnapshot} from '../shared/types';
const engine=new NullEngine({renderWidth:1280,renderHeight:720,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4}),scene=new Scene(engine),rig=new MinigolfCamera(scene);
const p=new MinigolfMatch([{id:'p',name:'P',displayName:'P',color:'#00ff00',bot:false,characterId:'goblin',score:0,avatar:'',roleTitle:'',quote:''} as PlayerSnapshot],()=>.99,[COURSES[0]]).active;
const project=()=>{scene.render();const vp=rig.camera.viewport.toGlobal(1280,720);return Vector3.Project(new Vector3(p.ball.x,p.ball.y,p.ball.z),Matrix.Identity(),scene.getTransformMatrix(),vp);};
let cases=0;
for(const c of COURSES.filter(c=>c.id==='palme')){for(const point of[c.spawn,...c.waypoints]){const f=supportAt(c,point,2)!;Object.assign(p.ball,{...point,y:heightAt(f,point)+.28,vx:0,vz:0});p.aim={x:0,z:-1};
 for(const offset of[-2,-1,0,1,2]){rig.reset();rig.update(p,c,2,[],false,.016);rig.orbit=offset;for(let j=0;j<120;j++)rig.update(p,c,2,[],false,.016);
  assert.ok(!cameraObstructed(rig.camera.position,c,2,[]),c.id+' camera clear');assert.ok(Vector3.Distance(rig.camera.position,new Vector3(p.ball.x,p.ball.y,p.ball.z))>.9);const q=project();if(!(q.x>0&&q.x<1280&&q.y>0&&q.y<720&&q.z<1))console.log('CAMERA',point,offset,'eye',rig.camera.position,'ball',p.ball.x,p.ball.y,p.ball.z,'project',q);assert.ok(q.x>0&&q.x<1280&&q.y>0&&q.y<720&&q.z<1,c.id+' ball in frame');cases++;
 }
}}
// Ball at the inner wall: no zoom into its mesh and still visible, in every aim direction.
const c=COURSES[0];Object.assign(p.ball,{x:0,z:13.5,y:.28});
for(let i=0;i<16;i++){p.aim={x:Math.sin(i*Math.PI/8),z:Math.cos(i*Math.PI/8)};rig.reset();for(let j=0;j<90;j++)rig.update(p,c,0,[],false,1/60);const q=project();assert.ok(q.x>=0&&q.x<=1280&&q.y>=0&&q.y<550,'back wall ball remains above power HUD');assert.ok(!cameraObstructed(rig.camera.position,c,0,[]));cases++;}
const follow=(hz:number)=>{rig.reset();p.aim={x:0,z:-1};for(let i=0;i<hz*2;i++){Object.assign(p.ball,{x:0,z:11-5*i/hz,y:.28,vx:0,vz:-5});rig.update(p,{...c,walls:[],bumpers:[]},0,[],true,1/hz);}return rig.camera.position.clone();};
const reference=follow(120);for(const hz of[30,60])assert.ok(Vector3.Distance(follow(hz),reference)<.2,'tracking consistent across FPS');
p.ball.vz=10;const heading=rig.heading;rig.update(p,c,0,[],true,.016);assert.equal(rig.heading,heading,'bounce never changes heading');
rig.control(0,0,true,.1);rig.update(p,c,0,[],false,.5);assert.ok(rig.camera.position.y>10);rig.control(0,0,false,.1);for(let i=0;i<120;i++)rig.update(p,c,0,[],false,1/60);assert.ok(rig.camera.position.y<4,'returns to low camera');
scene.dispose();engine.dispose();console.log(`PASS minigolf camera: ${cases} course/wall/orbit cases, ball visible, no wall penetration or camera inside ball, stable follow at 30/60/120, bounce heading and temporary overview.`);
