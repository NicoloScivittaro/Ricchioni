import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {BackroomsMatch,type CreatureKind} from '../src/minigames/backrooms/backroomsRules';
import {CELL,center,cellAt,distances,canStand,lineOfSight,neighbors} from '../src/minigames/backrooms/maze';
const report:{checks:string[]}={checks:[]};
function test(name:string,f:()=>void){f();report.checks.push(name);console.log('PASS',name);}
function advance(m:BackroomsMatch,seconds:number){for(let t=0;t<seconds;t+=1/60)m.advance(1/60);}
function fixture(kind:CreatureKind){
 const m=new BackroomsMatch([{id:'a',name:'A'},{id:'b',name:'B'}],42,{monsters:[kind]});m.time=20;m.intro=0;
 const size=9,floor=new Uint8Array(size*size);for(let z=1;z<8;z++)for(let x=1;x<8;x++)floor[z*size+x]=1;
 Object.assign(m.maze,{size,floor,cells:Array.from(floor.keys()).filter(c=>floor[c]),doors:[],rooms:[],dark:new Set(),spawn:10,exit:70,key:69});
 const c=m.monsters[0],p=m.players[0];Object.assign(c,center(m.maze,20),{yaw:0,destination:60});Object.assign(p,center(m.maze,22),{immunity:0,hiding:true,flashlight:false});m.players[1].state='escaped';
 return{m,c,p,privateMatch:m as any};
}
test('Observed movement gives a short interception; wall-blocked prediction falls back to the actual sighting',()=>{
 const{m,c,p,privateMatch}=fixture('bacteria');p.hiding=false;c.yaw=Math.PI/2;p.dx=3.25;privateMatch.updateMonster(c,1/60);
 const lead=privateMatch.pursuitPoint(c,p);assert.ok(lead.x>p.x);assert.ok(lead.x-p.x<=1.31);assert.equal(c.memory?.x,p.x);
 p.x=5*CELL-.5;const blocked=cellAt(m.maze,{x:p.x+1.3,z:p.z});m.maze.floor[blocked]=0;
 assert.deepEqual(privateMatch.pursuitPoint(c,p),{x:p.x,z:p.z});
});
test('Search checks nearby branches in the last observed direction, ignores hidden movement, then forgets',()=>{
 const{m,c,p,privateMatch}=fixture('bacteria');Object.assign(c,{memory:center(m.maze,22),memoryTime:m.time,observedMotion:{x:3,z:0},target:p.id,seen:true});privateMatch.transition(c,'search','fixture lost sight');
 const anchor=22,range=distances(m.maze,anchor);assert.equal(c.searchCells[0],anchor);assert.ok(center(m.maze,c.searchCells[1]).x>c.memory!.x);assert.ok(c.searchCells.every(n=>range.get(n)!<=3));
 const plan=[...c.searchCells],memory={...c.memory};p.x=22;p.z=22;advance(m,.5);assert.deepEqual(c.searchCells,plan);assert.deepEqual(c.memory,memory);
 advance(m,5);assert.ok(c.searched.includes(anchor));assert.ok(c.x>memory.x!);advance(m,6);assert.equal(c.memory,null);assert.equal(c.target,null);
});
test('A search sweep can reacquire a genuinely visible player initially outside the field of view',()=>{
 const{m,c,p,privateMatch}=fixture('bacteria');Object.assign(c,{memory:{x:c.x,z:c.z},memoryTime:m.time,target:p.id,seen:true});privateMatch.transition(c,'search','fixture');
 p.hiding=false;p.x=c.x+Math.sin(2.1)*3;p.z=c.z+Math.cos(2.1)*3;assert.equal(m.canSee(c,p),false);advance(m,.8);
 assert.ok(['watch','chase'].includes(c.state));assert.deepEqual(c.memory,{x:p.x,z:p.z});
});
test('Hearing prioritizes an audible strong cue over a newer quiet footstep without granting visual knowledge',()=>{
 const{m,c,p,privateMatch}=fixture('bacteria');privateMatch.noise=[{point:center(m.maze,29),id:p.id,loud:17,time:20.001},{point:center(m.maze,22),id:p.id,loud:4,time:20.002}];advance(m,.02);
 assert.equal(c.noiseTime,20.002);const area=cellAt(m.maze,c.noiseArea!);assert.ok([29,...neighbors(m.maze,29)].includes(area));advance(m,.1);assert.equal(cellAt(m.maze,c.noiseArea!),area);assert.equal(c.target,null);assert.equal(c.memory,null);assert.equal(c.state,'suspicious');assert.equal(c.noiseArea!.radius,CELL);
});
test('Smiler patrol favors nearby darkness and avoids another creature destination',()=>{
 const{m,c,privateMatch}=fixture('smiler');const distance=distances(m.maze,cellAt(m.maze,c));for(const[n,d]of distance)if(d>=4&&d<=8)m.maze.dark.add(n);
 const first=privateMatch.patrolCell(c);assert.ok(m.maze.dark.has(first));m.monsters.push({...c,destination:first});
 const next=privateMatch.patrolCell(c);assert.notEqual(next,first);assert.ok(m.maze.dark.has(next));
});
test('Partygoer reaches a party room before setting its early lure',()=>{
 const{m,c}=fixture('partygoer');m.maze.rooms=[{x:5,z:2,w:2,h:2,kind:'party'}];c.timer=3.1;advance(m,.02);assert.equal(c.state,'patrol');
 Object.assign(c,center(m.maze,23),{timer:2});advance(m,.02);assert.equal(c.state,'lure');assert.ok(m.events.some(e=>e.type==='lure'));
});
test('Smiler physically retreats on valid floor, keeps a bounded recoil and cannot be permanently stunned',()=>{
 const{m,c,p}=fixture('smiler');Object.assign(p,center(m.maze,38),{hiding:false,flashlight:true,yaw:Math.PI});const before=Math.hypot(c.x-p.x,c.z-p.z);advance(m,.02);assert.equal(c.state,'recoil');const cooldown=c.lightResistUntil;
 for(let i=0;i<60;i++){m.advance(1/60);assert.ok(canStand(m.maze,c));}assert.ok(Math.hypot(c.x-p.x,c.z-p.z)>before+.5);advance(m,.6);assert.notEqual(c.state,'recoil');assert.equal(c.lightResistUntil,cooldown);assert.equal(m.events.filter(e=>e.type==='repel').length,1);
});
test('A blocked corner never permits a capture through walls or an invalid monster position',()=>{
 const{m,c,p,privateMatch}=fixture('runner');for(let z=2;z<=5;z++)m.maze.floor[z*9+3]=0;
 Object.assign(c,{memory:center(m.maze,24),memoryTime:m.time,target:p.id,seen:true});privateMatch.transition(c,'search','lost around corner');Object.assign(p,center(m.maze,24),{hiding:true});
 assert.equal(lineOfSight(m.maze,c,p),false);for(let i=0;i<4*60;i++){m.advance(1/60);assert.ok(canStand(m.maze,c));assert.equal(p.lives,2);}
});
writeFileSync('docs/agent-work/backrooms-ai/rules.json',JSON.stringify(report,null,2));
