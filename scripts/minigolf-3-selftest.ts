import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {COURSES,supportAt,heightAt} from '../src/minigames/minigolf/minigolfCourses';
import {createBall,impulse,physicsStep,predict,speed} from '../src/minigames/minigolf/minigolfPhysics';
import {GOLF} from '../src/minigames/minigolf/minigolfTypes';
import type {Course} from '../src/minigames/minigolf/minigolfTypes';
import {MinigolfMatch} from '../src/minigames/minigolf/minigolfRules';
import {MinigolfBot} from '../src/minigames/minigolf/minigolfBot';
const out='docs/agent-work/minigolf-3',flat:Course={...COURSES[0],id:'hop-fixture',floors:[{x:0,z:0,w:60,d:90,y:0}],walls:[],bumpers:[],spawn:{x:0,z:20},hole:{x:25,z:0},holeY:0};
const hops=[];
for(const power of [0,.5,.82,.9,1])for(const hz of [30,60,120]){
 const b=createBall('ball',flat.spawn);impulse(b,{x:0,z:-1},power);let peak=0,air=0,landed=false;
 for(let i=0;i<hz;i++){physicsStep([b],flat,i/hz,1/hz);peak=Math.max(peak,b.y-GOLF.radius);if(!b.grounded)air+=1/hz;else if(air>0)landed=true;}
 if(power<=GOLF.hopThreshold)assert.equal(peak,0);else {assert.ok(peak>0&&peak<.165);assert.ok(landed);}
 hops.push({power,hz,peak,air});
}
const peaks=hops.filter(h=>h.power===1).map(h=>h.peak);assert.ok(Math.max(...peaks)-Math.min(...peaks)<.006);
const boost=createBall('boost',flat.spawn);impulse(boost,{x:0,z:-1},1,1.6);assert.equal(boost.vy,GOLF.maxHopVelocity);
const rail={...flat,walls:[{a:{x:-4,z:18},b:{x:4,z:18},y:0,radius:.18}]},b=createBall('rail',flat.spawn);impulse(b,{x:0,z:-1},1);let hit=false;for(let i=0;i<80;i++)hit||=physicsStep([b],rail,i/120,GOLF.step).some(e=>e.type==='wall');assert.ok(hit,'shallow hop cannot skip a normal rail');
const trace=predict(createBall('trace',flat.spawn),flat,{x:0,z:-1},1,.4);assert.ok(trace.some(p=>p.y>GOLF.radius+.12),'guide includes real airborne height');
const spawns=[];for(const c of COURSES)for(let count=2;count<=5;count++){
 const roster=Array.from({length:count},(_,i)=>({id:String(i),displayName:'P'+i,color:'#fff',characterId:'goblin',bot:false,score:0,roleTitle:'',avatar:'',quote:'',name:'P'+i}));const m=new MinigolfMatch(roster,()=>.5,[c]);
 for(const p of m.players){const f=supportAt(c,p.ball,0);assert.ok(f,c.id+' supported tee '+count);assert.ok(Math.abs(p.ball.y-heightAt(f!,p.ball)-GOLF.radius)<.001);}
 spawns.push({id:c.id,count});
}
const bots=[];for(const c of COURSES.filter(c=>c.imported)){
 const roster=[{id:'bot',displayName:'Bot',color:'#fff',characterId:null,bot:true,score:0,roleTitle:'',avatar:'',quote:'',name:'Bot'}];let seed=819;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const m=new MinigolfMatch(roster,rnd,[c]),bot=new MinigolfBot(rnd);m.advance(GOLF.intro+.01);let falls=0;
 for(let i=0;i<240*60&&m.phase==='playing';i++){m.command(m.active,bot.command(m.active,c,1/60),1/60);m.advance(1/60);falls+=m.events.filter(e=>e.type==='fall').length;m.events=[];}
 const p=m.players[0];bots.push({id:c.id,completed:p.completed,strokes:p.strokes,falls,records:p.records});assert.ok(p.completed,c.id+' production bot must finish');
}
writeFileSync(out+'/physics.json',JSON.stringify({hops,boostLiftBound:true,railCannotBeSkipped:true,predictionHeight:true,spawns,bots},null,2));console.log('PASS calibrated hop at 30/60/120 Hz, boost bound, rail contact, 3D guide, 48 roster/map combinations, two production bots.');
