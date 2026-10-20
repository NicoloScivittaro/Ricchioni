import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createBall,physicsStep} from '../src/minigames/minigolf/minigolfPhysics';
import {GOLF} from '../src/minigames/minigolf/minigolfTypes';
import type {Course,GolfBall} from '../src/minigames/minigolf/minigolfTypes';
import {COURSES} from '../src/minigames/minigolf/minigolfCourses';
const c:Course={id:'physics-probe',name:'Probe',difficulty:'easy',color:'#448855',par:3,maxStrokes:12,tip:'',spawn:{x:-3,z:0},hole:{x:7,z:7},holeY:0,floors:[{x:0,z:0,w:24,d:24,y:0},{x:-2,z:0,w:4,d:6,y:2}],walls:[],bumpers:[],waypoints:[]};
function run(b:GolfBall,course:Course,seconds:number){const events=[];for(let i=0;i<seconds*120;i++)events.push(...physicsStep([b],course,i/120,GOLF.step));return events;}
const drop=createBall('drop',{x:-.05,z:0},2);drop.vx=4;run(drop,c,.04);assert.equal(drop.grounded,false);assert.ok(drop.y>2,'no snap to the lower floor');
let bounced=false;for(let i=0;i<360;i++){physicsStep([drop],c,i/120,GOLF.step);if(drop.vy>0)bounced=true;}assert.ok(bounced);assert.equal(drop.grounded,true);assert.ok(Math.abs(drop.y-GOLF.radius)<1e-7);
const floating=createBall('floating',{x:1,z:0},3);physicsStep([floating],c,0,GOLF.step);assert.equal(floating.grounded,false);assert.ok(floating.vy<0&&floating.y>3,'gravity rather than floor teleport');
const fall=createBall('fall',{x:-3,z:0});fall.x=4;run(fall,c,1);assert.ok(Math.abs(fall.safe.x-4)<.1);fall.x=20;const es=run(fall,c,2);assert.equal(es.filter(e=>e.type==='fall').length,1);assert.equal(fall.x,-3);assert.equal(fall.z,0);assert.equal(fall.y,GOLF.radius);assert.equal(fall.safe.x,-3);assert.equal(fall.vx,0);assert.equal(fall.vy,0);
const flat={...c,hole:{x:0,z:0},floors:[c.floors[0]]};
const rest=createBall('lip',{x:.48,z:0});const captures=run(rest,flat,2);assert.equal(rest.done,true,'slow ball rolls off the lip into the cup');assert.equal(captures.filter(e=>e.type==='hole').length,1);
const fast=createBall('fast',{x:-.6,z:0});fast.vx=8;run(fast,flat,.2);assert.equal(fast.done,false,'no high-speed vacuum');
const miss=createBall('miss',{x:-.6,z:.65});miss.vx=1;run(miss,flat,2);assert.equal(miss.done,false,'no attraction outside the cup');
const above=createBall('above',{x:0,z:0},2);above.grounded=false;physicsStep([above],flat,0,GOLF.step);assert.equal(above.done,false,'no capture from another height');
const cups=[];for(const course of COURSES){const b=createBall(course.id,{x:course.hole.x+.42,z:course.hole.z},course.holeY);run(b,course,2);assert.equal(b.done,true,course.id+' cup');cups.push(course.id);}
writeFileSync('docs/agent-work/minigolf-gravity/core-checks.json',JSON.stringify({gravity:true,dropBetweenLevels:true,dissipatedBounce:true,fallRestartsAtOriginalTee:true,noCheckpointRestoreAfterFall:true,oneHoleEvent:true,noFastCapture:true,noOutsideAttraction:true,noCaptureFromAbove:true,cups},null,2));
console.log('PASS gravity/step-down/landing/bounce, return to original tee, slow lip, fast pass/near miss/height, ten cups.');
