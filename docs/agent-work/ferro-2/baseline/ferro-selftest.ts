import assert from'node:assert/strict';
import{writeFileSync}from'node:fs';
import{FerroMatch}from'../shared/ferro/match';
import{WEAPONS,FERRO_RULES}from'../shared/ferro/weapons';
import{emptyCommand}from'../shared/ferro/types';
import type{Command,WeaponId,Warrior}from'../shared/ferro/types';
import{SOLIDS,standable,route,visible}from'../shared/ferro/arena';
const checks:string[]=[];
const make=(count=2)=>{const m=new FerroMatch(Array.from({length:count},(_,i)=>({id:'p'+i,name:'P'+i,color:'#8ac'})));m.state.phase='fight';m.state.warriors.forEach((p,i)=>Object.assign(p,{weapon:'sword',x:0,y:0,z:i===0?-2:i*2-2,yaw:i===0?0:Math.PI}));return m;};
const command=()=>emptyCommand();
function run(m:FerroMatch,seconds:number,inputs:Command[]=m.state.warriors.map(command)){for(let i=0;i<Math.round(seconds*120);i++)m.step(1/120,p=>inputs[m.state.warriors.indexOf(p)]);}
function attack(id:WeaponId,kind:'light'|'heavy'|'special'='light',distance=2){const m=make(),[p,q]=m.state.warriors;p.weapon=id;p.z=-distance;const inputs=[command(),command()];inputs[0].edges[kind]=1;if(id==='sword'&&kind==='special')p.riposte=1;run(m,1.8,inputs);return{m,p,q};}
assert.equal(WEAPONS.length,7);assert.equal(new Set(WEAPONS.map(w=>w.id)).size,7);assert.ok(WEAPONS.every(w=>w.heavy.damage<100&&w.special.damage<100));
for(const w of WEAPONS.filter(w=>w.id!=='bow')){const{m,q}=attack(w.id);assert.ok(q.hp<100,`${w.id} light must physically hit`);assert.equal(m.drainEvents().filter(e=>e.kind==='hit'&&e.target===q.id).length,1,`${w.id} repeated active frames cannot multiply hits`);}
checks.push('Seven unique weapon configurations, distinct timings/styles, six melee light attacks hit only once per swing and no normal one-shots');
let m=make(),[p,q]=m.state.warriors,inputs=[command(),command()];inputs[0].edges.heavy=1;run(m,.1,inputs);assert.equal(q.hp,100);run(m,.8,inputs);assert.ok(q.hp<100);
const twin=attack('blades','heavy',1.3);assert.equal(twin.m.drainEvents().filter(e=>e.kind==='hit').length,2);assert.equal(twin.q.hp,68);
checks.push('Heavy windup is harmless before active window; twin heavy has exactly two defined impact windows');
m=make();[p,q]=m.state.warriors;inputs=[command(),command()];inputs[1].guard=true;run(m,.3,inputs);inputs[0].edges.light=1;run(m,.65,inputs);assert.ok(Math.abs(q.hp-(100-19*.32))<.01);assert.equal(m.drainEvents().filter(e=>e.kind==='parry').length,0);
m=make();[p,q]=m.state.warriors;inputs=[command(),command()];inputs[0].edges.light=1;run(m,.12,inputs);inputs[1].guard=true;run(m,.4,inputs);assert.equal(q.hp,100);assert.ok(q.riposte>0);assert.equal(p.action,null);assert.ok(m.drainEvents().some(e=>e.kind==='parry'));
q.stun=0;q.cooldown=0;q.guard=false;inputs[1].guard=false;inputs[1].edges.special=1;run(m,.5,inputs);assert.ok(p.hp<100);
m=make();[p,q]=m.state.warriors;q.yaw=0;inputs=[command(),command()];inputs[1].guard=true;run(m,.3,inputs);inputs[0].edges.light=1;run(m,.65,inputs);assert.equal(q.hp,81);
checks.push('Held frontal guard reduces damage without repeated automatic parries; fresh130ms parry interrupts and opens riposte; back attacks bypass guard');
m=make();[p,q]=m.state.warriors;inputs=[command(),command()];inputs[0].edges.light=1;inputs[1].edges.dodge=1;run(m,.7,inputs);assert.equal(q.hp,100);assert.ok(q.dodgeCd>0);
checks.push('Directional dodge avoids timed swing and consumes stamina/cooldown rather than allowing permanent invulnerability');
m=make();[p,q]=m.state.warriors;p.weapon='bow';inputs=[command(),command()];inputs[0].light=true;inputs[0].edges.light=1;run(m,.9,inputs);assert.equal(q.hp,100);assert.equal(m.state.arrows.length,0);inputs[0].light=false;m.step(1/120,p=>inputs[m.state.warriors.indexOf(p)]);assert.equal(q.hp,100);assert.equal(m.state.arrows.length,1);const initialY=m.state.arrows[0].y;run(m,.2,inputs);assert.ok(q.hp<100);assert.equal(p.arrows,9);
m=make();[p,q]=m.state.warriors;p.weapon='bow';p.z=5.6;q.z=8.6;inputs=[command(),command()];inputs[0].light=true;inputs[0].edges.light=1;run(m,1,inputs);inputs[0].light=false;run(m,.5,inputs);assert.equal(q.hp,100);assert.ok(m.state.arrows.some(a=>a.stuck));
m=make();[p,q]=m.state.warriors;p.weapon='bow';inputs=[command(),command()];inputs[0].light=true;run(m,.8,inputs);inputs[0].light=false;inputs[0].cancel=true;run(m,.2,inputs);assert.equal(p.arrows,10);assert.equal(m.state.arrows.length,0);
checks.push('Bow charge/release creates a moving gravity projectile, one ammo; pillars stop it and retain a brief stuck arrow; cancellation never fires');
for(const id of['sword','spear','axe','hammer','blades','shield']as WeaponId[]){const{m,p,q}=attack(id,'special',id==='blades'?1.3:id==='shield'?1.4:2);assert.ok(q.hp<100,`${id} special hits`);assert.ok(p.specialCd>0);assert.ok(m.drainEvents().some(e=>e.kind==='special'));}
m=make();[p,q]=m.state.warriors;p.weapon='spear';p.z=5.6;q.z=8.6;inputs=[command(),command()];inputs[0].edges.special=1;run(m,1.5,inputs);assert.equal(q.hp,100);assert.ok(standable(p.x,p.z));
checks.push('Six melee specials functional, sword riposte gated; spear charge cannot teleport or damage through pillar');
m=make(3);[p,q]=m.state.warriors;p.weapon='axe';p.z=0;q.x=0;q.z=2;const third=m.state.warriors[2];third.x=0;third.z=-2;inputs=m.state.warriors.map(command);inputs[0].edges.special=1;run(m,1.7,inputs);assert.ok(q.hp<100&&third.hp<100);assert.equal(m.drainEvents().filter(e=>e.kind==='hit').length,2);
checks.push('Axe spin can hit front and back opponents once each, rather than damage every rotation frame');
m=make();[p,q]=m.state.warriors;(m as any).resolve([{source:p,target:q,damage:100,point:{x:0,y:1,z:0}},{source:q,target:p,damage:100,point:{x:0,y:1,z:-2}}]);(m as any).checkRound();assert.equal(m.state.phase,'countdown');assert.equal(m.state.duel,'round');assert.equal(m.state.winner,null);assert.ok(m.state.warriors.every(p=>p.alive));
m=make();[p,q]=m.state.warriors;p.points=q.points=100;m.state.round=3;(m as any).finishOrDuel();assert.equal(m.state.duel,'final');assert.equal(m.state.phase,'selection');assert.equal(m.state.winner,null);m.state.phase='fight';(m as any).resolve([{source:p,target:q,damage:100,point:{x:0,y:1,z:0}}]);(m as any).checkRound();assert.equal(m.state.phase,'finished');assert.equal(m.ranking()[0].playerId,p.id);assert.equal(m.ranking()[0].placement,1);
assert.ok(FERRO_RULES.placementPoints>(5-1)*FERRO_RULES.killPoints);
checks.push('Simultaneous final deaths restart a real duel; equal top scores enter contender tiebreak; survivor winner is explicit; survival gap exceeds all possible kill bonuses');
m=make();m.state.roundSeconds=10;run(m,11);assert.ok(m.state.ringRadius<16&&m.state.ringRadius>15);assert.ok(m.state.warriors.every(p=>p.hp===100));
const a=make(),b=make(),c=command();c.mx=.25;for(let i=0;i<180;i++)a.advance(1/60,()=>c);for(let i=0;i<60;i++)b.advance(.05,()=>c);assert.ok(Math.abs(a.state.warriors[0].x-b.state.warriors[0].x)<1e-6);assert.ok(Math.abs(a.state.time-b.state.time)<1e-6);
for(const solid of SOLIDS)assert.equal(standable(solid.x,solid.z),false);assert.ok(route({x:-12,z:0},{x:12,z:0}).length);assert.equal(visible({x:0,y:1,z:5},{x:0,y:1,z:9}),false);
checks.push('Sudden-death circle advances progressively; fixed-step clock/movement invariant at60vs20 render updates; visible solid geometry blocks movement/LOS and has navigable routes');
m=make(5);p=m.state.warriors[0];p.weapon='bow';p.x=0;p.z=-5;p.yaw=0;p.piercing=true;
for(const[i,t]of m.state.warriors.slice(1).entries())Object.assign(t,{x:0,z:-1+i*2,yaw:Math.PI,hp:100});
inputs=m.state.warriors.map(command);inputs[0].light=true;run(m,.8,inputs);inputs[0].light=false;run(m,.6,inputs);
assert.ok(m.state.warriors.slice(1,4).every(p=>p.hp<100));assert.equal(m.state.warriors[4].hp,100);assert.equal(p.piercing,false);
checks.push('Piercing bow special damages at most three consecutive targets, consumes preparation, and stops before the fourth');
m=make();
for(let round=1;round<=3;round++){
 const winner=m.state.warriors[round===2?1:0],loser=m.state.warriors[round===2?0:1];
 (m as any).resolve([{source:winner,target:loser,damage:100,point:{x:loser.x,y:1,z:loser.z}}]);(m as any).checkRound();assert.equal(m.state.phase,'roundEnd');run(m,4.1);
 if(round<3){assert.equal(m.state.phase,'selection');assert.equal(m.state.round,round+1);m.state.phaseLeft=.01;run(m,3.1);assert.equal(m.state.phase,'fight');assert.ok(m.state.warriors.every(p=>p.hp===100));}
}
assert.equal(m.state.history.length,3);assert.equal(m.state.phase,'finished');assert.equal(m.state.winner,m.state.warriors[0].id);assert.equal(m.ranking()[0].placement,1);
checks.push('Three complete round transitions reset combat state, reopen selection, aggregate scores and finish with the actual top scorer');
writeFileSync('docs/agent-work/ferro-furia/logic.json',JSON.stringify({status:'passed',checks},null,2));console.log(checks.join('\n'));
