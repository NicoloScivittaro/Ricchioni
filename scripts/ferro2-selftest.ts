import assert from'node:assert/strict';
import{writeFileSync}from'node:fs';
import{FerroMatch}from'../shared/ferro/match';
import{emptyCommand}from'../shared/ferro/types';
import type{Command,WeaponId,GuardDirection}from'../shared/ferro/types';
import{incomingDirection}from'../shared/ferro/directions';
import{standable,move,visible}from'../shared/ferro/arena';
import{floorAt}from'../shared/ferro/terrain';
import{mapsFor}from'../shared/minigameMaps';
const checks:string[]=[];
function fixture(n=2,mapId='colosseum'){const m=new FerroMatch(Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,color:'#bcd'})),{mapId});m.state.phase='fight';if(mapId==='colosseum')m.state.warriors.forEach((p,i)=>Object.assign(p,{weapon:'sword',x:0,y:0,z:i===0?-2:i*2-2,yaw:i===0?0:Math.PI}));return m;}
function run(m:FerroMatch,seconds:number,c:Command[]=m.state.warriors.map(emptyCommand)){for(let i=0;i<Math.round(seconds*120);i++)m.step(1/120,p=>c[m.state.warriors.indexOf(p)]);}
for(const weapon of ['sword','spear','axe','hammer','blades','shield']as WeaponId[]){const m=fixture(),[p,q]=m.state.warriors;p.weapon=weapon;if(weapon==='blades')p.z=-1.4;const c=m.state.warriors.map(emptyCommand);c[0].edges.light++;run(m,1.6,c);assert.ok(q.hp<100,weapon+' physical light');assert.equal(m.drainEvents().filter(e=>e.kind==='hit').length,1);}
checks.push('Six melee categories: physical contact only, one hit per active window');
for(const dir of ['top','left','right']as GuardDirection[]){const m=fixture(),[p,q]=m.state.warriors;const c=m.state.warriors.map(emptyCommand);p.guardDirection=dir;c[1].guard=true;c[1].guardDirection=dir==='top'?'top':dir==='left'?'right':'left';run(m,.3,c);c[0].edges.light++;run(m,.8,c);assert.ok(q.hp>81&&q.hp<100,'matching '+dir);assert.ok(m.drainEvents().some(e=>e.kind==='block'));assert.equal(incomingDirection(p,q,{yaw:0,direction:dir}),c[1].guardDirection);}
checks.push('All three defender-space directions and face-to-face left/right mirror block correctly');
{
 const m=fixture(),[p,q]=m.state.warriors,c=m.state.warriors.map(emptyCommand);p.guardDirection='left';c[1].guard=true;c[1].guardDirection='left';run(m,.3,c);c[0].edges.light++;run(m,.8,c);assert.equal(q.hp,81);assert.ok(!m.drainEvents().some(e=>e.kind==='block'||e.kind==='parry'));
}
{
 const m=fixture(),[p,q]=m.state.warriors,c=m.state.warriors.map(emptyCommand);c[0].edges.light++;run(m,.23,c);c[1].guard=true;run(m,.3,c);assert.equal(q.hp,100);assert.ok(m.drainEvents().some(e=>e.kind==='parry'));assert.ok(q.riposte>0);assert.equal(p.action,null);
}
checks.push('Wrong guard takes full damage; fresh timed130ms parry interrupts and opens riposte');
{
 const m=fixture(),[p,q]=m.state.warriors,c=m.state.warriors.map(emptyCommand);c[0].guard=true;run(m,.1,c);assert.equal(p.target,q.id);q.alive=false;run(m,.01,c);assert.equal(p.target,null);
}
{
 const m=fixture(3),p=m.state.warriors[0],c=m.state.warriors.map(emptyCommand);c[0].guard=true;run(m,.1,c);const first=p.target;c[0].edges.target++;run(m,.01,c);assert.notEqual(p.target,first);c[0].guard=false;run(m,.01,c);assert.equal(p.target,null);
}
checks.push('Lock acquires visible live target, cycles deterministically, releases on death and LT-up');
{
 const m=fixture(),[p,q]=m.state.warriors,c=m.state.warriors.map(emptyCommand);c[0].edges.heavy++;run(m,.12,c);const stamina=p.stamina;c[0].edges.feint++;run(m,.1,c);assert.equal(p.action,null);assert.ok(p.stamina<stamina);run(m,.7,c);assert.equal(q.hp,100);
 const b=fixture(),d=b.state.warriors.map(emptyCommand);d[0].edges.heavy++;run(b,.42,d);d[0].edges.feint++;run(b,.01,d);assert.ok(b.state.warriors[0].action);
}
checks.push('Heavy feint costs stamina, blends out without damage, forbidden after active start');
for(const counter of [false,true]){
 const m=fixture(),[p,q]=m.state.warriors,c=m.state.warriors.map(emptyCommand);p.z=-1.2;c[0].edges.guardBreak++;run(m,.22,c);assert.ok(q.counterUntil>m.state.time);if(counter)c[1].edges.guardBreak++;run(m,.26,c);assert.equal(q.hp,100);assert.ok(counter?q.stun===0:q.stun>0);assert.ok(m.drainEvents().some(e=>e.kind===(counter?'counter':'guardBreak')));
}
{const m=fixture(),[p,q]=m.state.warriors,c=m.state.warriors.map(emptyCommand);p.z=-1.2;c[0].edges.guardBreak++;run(m,.22,c);c[1].edges.light++;run(m,.02,c);assert.equal(q.action,null);(m as any).resolve([{source:q,target:p,damage:5,stun:.2,point:{x:0,y:1,z:0}}]);assert.equal(p.breakAge,0);assert.equal(q.counterUntil,0);}
checks.push('Close guard-break has counter window and brief stagger; neither directly damages');
{
 const m=fixture(),p=m.state.warriors[0],c=m.state.warriors.map(emptyCommand);c[0].edges.dodge++;run(m,.1,c);assert.ok(p.z< -2);assert.ok(p.stamina<100);assert.ok(p.regenAt>m.state.time);
}
{
 const m=fixture(),[p,q]=m.state.warriors,c=m.state.warriors.map(emptyCommand);p.weapon='bow';c[0].light=true;run(m,.8,c);assert.equal(p.bowPhase,'hold');assert.equal(m.state.arrows.length,0);c[0].light=false;run(m,.06,c);assert.equal(m.state.arrows.length,0);run(m,.06,c);assert.equal(p.arrows,9);assert.ok(m.state.arrows.length===1);run(m,.15,c);assert.ok(q.hp<100);assert.equal(p.bowPhase,'recovery');
 const b=fixture(),bc=b.state.warriors.map(emptyCommand);b.state.warriors[0].weapon='bow';bc[0].light=true;run(b,.6,bc);bc[0].cancel=true;bc[0].light=false;run(b,.2,bc);assert.equal(b.state.warriors[0].arrows,10);assert.equal(b.state.arrows.length,0);
}
checks.push('Bow load/hold/release/recovery, projectile at0.10s release event, cancellation never shoots');
{
 const m=fixture(3),[p,q,r]=m.state.warriors;for(let i=0;i<8;i++)(m as any).pressure(q,p);assert.equal(q.pressure,0);for(let i=0;i<6;i++)(m as any).pressure(q,i%2?p:r);assert.ok(q.resistance>0);assert.equal(q.hp,100);
}
checks.push('Tenacity needs distinct recent attackers; no solo/passive charge, automatic damage or invulnerability');
assert.equal(mapsFor('ferro').length,3);
for(const mapId of ['hell','geonosis']){const m=fixture(5,mapId);for(const p of m.state.warriors){assert.ok(standable(p.x,p.z,.43,m.state.mapId));assert.equal(p.y,floorAt(m.state.mapId,p.x,p.z));const next=move(p.x,p.z,.1,.1,.43,m.state.mapId);assert.ok(standable(next.x,next.z,.43,m.state.mapId));}run(m,.1);assert.ok(m.state.warriors.every(p=>p.hp===100));}
assert.equal(visible({x:0,y:1,z:5},{x:0,y:1,z:9}),false);
checks.push('Three map-vote entries; five grounded legal spawns on each authored terrain; original column still blocks LOS');
{
 const m=fixture(),[p,q]=m.state.warriors;m.state.round=3;p.points=q.points=100;(m as any).finishOrDuel();assert.equal(m.state.duel,'final');m.state.phase='fight';(m as any).resolve([{source:p,target:q,damage:100,point:{x:0,y:1,z:0}}]);(m as any).checkRound();assert.equal(m.state.phase,'finished');assert.equal(m.ranking()[0].playerId,p.id);
 const b=fixture(),[x,y]=b.state.warriors;(b as any).resolve([{source:x,target:y,damage:100,point:{x:0,y:1,z:0}},{source:y,target:x,damage:100,point:{x:0,y:1,z:0}}]);(b as any).checkRound();assert.equal(b.state.duel,'round');assert.equal(b.state.phase,'countdown');
}
checks.push('Preserved survivor scoring and real final/simultaneous-death tiebreaks');
writeFileSync('docs/agent-work/ferro-2/rules.json',JSON.stringify({status:'passed',checks},null,2));console.log(checks.join('\n'));
