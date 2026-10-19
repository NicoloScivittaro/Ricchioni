import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{TerminalArena}from'../src/minigames/fps/terminalArena';import{FPS_BODY,stepFpsVertical}from'../shared/fpsRules';
const d=JSON.parse(readFileSync('public/assets/fps/terminal/arena.json','utf8')),a:any=new TerminalArena(d),nav=a.nav;
const start=a.closest({x:4.6,y:1.22,z:-35.2}),parents=new Int32Array(nav.length).fill(-1),queue=[start];parents[start]=start;
for(let n=0;n<queue.length;n++)for(const v of d.edges[queue[n]])if(parents[v]<0){parents[v]=queue[n];queue.push(v);}
const routes=[];for(const z of[-42,-45,-50,-55]){const goal=a.closest({x:-39.4,y:5.14,z});assert.ok(parents[goal]>=0,'aircraft cabin route '+z);const path=[goal];while(path.at(-1)!==start)path.push(parents[path.at(-1)!]);path.reverse();let p=nav[start],failures=0;for(const v of path.slice(1)){const q=nav[v],m=a.move(p,q,1.05);if(Math.hypot(m.x-q.x,m.z-q.z)>.06||Math.abs((m.y??0)-q.y)>.03)failures++;p=m;}assert.equal(failures,0);routes.push({target:nav[goal],nodes:path.length,failures});}
const air={...nav[a.closest({x:-39.3,y:5.14,z:-54.9})],verticalSpeed:0,grounded:true};let airborneFrames=0,jumpCount=0;
for(let n=0;n<180&&air.z>-59.9;n++){
 const target={...air,z:air.z-.15};let floor:number|null=air.y;
 if(air.grounded){const next=a.move(air,target);if(Math.abs(next.z-air.z)<.04){air.grounded=false;air.verticalSpeed=6.2;jumpCount++;}else Object.assign(air,next);}
 if(!air.grounded){const next=a.moveAir(air,target,1.8);air.x=next.x;air.z=next.z;floor=a.floorBelow(air.x,air.z,air.y+.1);airborneFrames++;}
 const room=floor===null?12:a.headroomAt(air.x,air.z,floor);stepFpsVertical(air,1/60,floor??-50,floor===null?50:floor+room,1.8);
}
for(let n=0;n<90;n++){const floor=a.floorBelow(air.x,air.z,air.y+.1);stepFpsVertical(air,1/60,floor??-50,floor===null?50:floor+a.headroomAt(air.x,air.z,floor),1.8);}
assert.ok(air.grounded&&Math.abs(air.y-5.13)<.12,'aircraft landing');
console.log('AIR '+JSON.stringify({air,jumpCount,airborneFrames}));assert.ok(air.z<-59.7,'jump across aircraft floor opening');
const jumps=[];for(const hz of[30,60,120]){const p={y:0,verticalSpeed:FPS_BODY.jumpSpeed as number,grounded:false};let apex=0;for(let n=0;n<hz*2;n++){stepFpsVertical(p,1/hz,0,12,FPS_BODY.standing);apex=Math.max(apex,p.y);}assert.ok(apex>1.05&&apex<1.08&&p.grounded&&p.y===0);jumps.push({hz,apex});}
const blocked={y:0,verticalSpeed:6.2,grounded:false};for(let n=0;n<120;n++)stepFpsVertical(blocked,1/60,0,1.9,1.8);assert.ok(blocked.grounded&&blocked.y===0);
const spawnClear=a.spawns.every((p:any)=>a.headroomAt(p.x,p.z,p.y)>=FPS_BODY.standing);assert.ok(spawnClear,'standing spawn clearance');
const old=JSON.parse(readFileSync('docs/agent-work/terminal-2/initial-browser-checks.json','utf8')).geometry.covered;
const dest=a.move(old[0],old[1],1.05);assert.ok(Math.hypot(dest.x-old[1].x,dest.z-old[1].z)>.5,'solid cover remains blocking');assert.equal(a.visible(...old),false);
const low=d.headroom.findIndex((h:number,i:number)=>h>=1.05&&h<1.8&&d.edges[i].length>0);assert.ok(low>=0);const point=nav[low];assert.ok(a.headroomAt(point.x,point.z,point.y)<1.8);
const report={nodes:nav.length,reachableFromApron:queue.length,walkableSquareMetres:nav.length*d.cell*d.cell,cabinRoutes:routes,aircraftJump:{end:air,jumpCount,airborneFrames},jumpFrameRates:jumps,spawnClear,coverBlocked:true,crouchPassage:point};writeFileSync('docs/agent-work/terminal-fixes/navigation-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
