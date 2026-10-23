import assert from 'node:assert/strict';
import{readFileSync,writeFileSync}from'node:fs';
import{FpsBodyGeometry}from'../src/minigames/fps/FpsBodyGeometry';
import{TerminalArena}from'../src/minigames/fps/terminalArena';
import{GOLF}from'../src/minigames/minigolf/minigolfTypes';
import type{Course}from'../src/minigames/minigolf/minigolfTypes';
import{createBall,impulse,physicsStep}from'../src/minigames/minigolf/minigolfPhysics';
import{COURSES}from'../src/minigames/minigolf/minigolfCourses';
const report:any={};
const wall=new Float32Array([0,0,-2,0,2,-2,0,2,2,0,0,-2,0,2,2,0,0,2]),geometry=new FpsBodyGeometry(wall);
assert.ok(Math.abs(geometry.ray(-1,1,0,1,0,0,3)-1)<1e-6);assert.ok(Math.abs(geometry.ray(1,1,0,-1,0,0,3)-1)<1e-6);report.doubleSidedFps=true;
const data={cell:1,radius:.22,bounds:[-5,5,-5,5],triangles:[[-5,0,-5,5,0,-5,5,0,5],[-5,0,-5,5,0,5,-5,0,5]],nodes:[[-1,0,0],[0,0,0],[1,0,0]],edges:[[1],[0,2],[1]],spawns:[0,0,0,2,2],barriers:[],headroom:[12,12,12]};
const arena=new TerminalArena(data,wall);
assert.ok(arena.move({x:-1,y:0,z:0},{x:1,y:0,z:0}).x<-.2);assert.ok(arena.move({x:1,y:0,z:0},{x:-1,y:0,z:0}).x>.2);
assert.ok(arena.moveAir({x:-1,y:.2,z:0},{x:1,y:.2,z:0},1.8).x<-.2);report.fpsWalkAndJumpBothSides=true;
assert.equal(arena.headroomAt(-1,0,1),11);
const base:Course={id:'solid-fixture',name:'Solid',difficulty:'easy',par:3,maxStrokes:12,color:'#fff',tip:'',spawn:{x:-4,z:0},hole:{x:9,z:9},holeY:0,floors:[{x:0,z:0,w:20,d:20,y:-2},{x:0,z:0,w:2,d:4,y:1}],walls:[],bumpers:[],waypoints:[]};
for(const side of [-1,1]){const b=createBall('side',{x:side*2,z:0},.5);b.grounded=false;b.vx=-side*24;for(let n=0;n<30;n++)physicsStep([b],base,n/120,GOLF.step);assert.ok(side*b.x>1,'slab side blocks '+side);}
const under=createBall('under',{x:0,z:0},-.6);under.grounded=false;under.vy=9;let ceiling=-Infinity;for(let n=0;n<20;n++){physicsStep([under],base,n/120,GOLF.step);ceiling=Math.max(ceiling,under.y);}assert.ok(ceiling<=1-.95-GOLF.radius+.002);report.golfSidesAndUnderside=true;
const ramp:Course={...base,id:'ramp-fixture',spawn:{x:0,z:5},floors:[{x:0,z:7,w:8,d:6,y:0},{x:0,z:0,w:8,d:8,y:1,slopeZ:-.25},{x:0,z:-8,w:8,d:8,y:2}],hole:{x:3,z:-9},holeY:2};
report.ramp=[];
for(const hz of [30,60,120]){const ball=createBall('ramp',ramp.spawn);impulse(ball,{x:0,z:-1},1);let peak=0,air=0,launch=false;for(let n=0;n<hz*2;n++){physicsStep([ball],ramp,n/hz,1/hz);if(ball.z<-4&&ball.vy>2)launch=true;if(ball.z<-4){peak=Math.max(peak,ball.y-GOLF.radius-2);if(!ball.grounded)air+=1/hz;}}assert.ok(launch&&peak>.5,'high ramp flight '+hz);report.ramp.push({hz,peak,air});}
assert.ok(Math.max(...report.ramp.map((v:any)=>v.peak))-Math.min(...report.ramp.map((v:any)=>v.peak))<.025);
// Every existing cup still captures at its own elevation with the solid mesh enabled.
for(const c of COURSES){const b=createBall('cup',{x:c.hole.x+.42,z:c.hole.z},c.holeY);for(let n=0;n<240&&!b.done;n++)physicsStep([b],c,n/120,GOLF.step);assert.ok(b.done,c.id+' reachable cup');}report.cups=COURSES.length;
const bytes=readFileSync('public/assets/fps/terminal/body-props.bin'),props=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const real=new TerminalArena(JSON.parse(readFileSync('public/assets/fps/terminal/arena.json','utf8')),props);
assert.equal(real.spawns.length>=5,true);report.terminalPropTriangles=props.length/9;report.status='passed';
writeFileSync('docs/agent-work/solid-collision-fixes/physics.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
