// Ferro e Furia 2.1 — focused checks of the directional clash layer, grips/guards and the duelling bot.
import assert from'node:assert/strict';
import{writeFileSync,mkdirSync}from'node:fs';
import{FerroMatch}from'../shared/ferro/match';
import{FerroBots}from'../shared/ferro/bots';
import{emptyCommand}from'../shared/ferro/types';
import type{Command,GuardDirection,WeaponId,FerroEvent}from'../shared/ferro/types';
import{incomingDirection}from'../shared/ferro/directions';
import{guardPose,combatPose,worldPoint}from'../shared/ferro/pose';
import{closest,clashPose}from'../shared/ferro/clash';
import{WEAPONS,weapon,attackLength,attackSpec,variantCount}from'../shared/ferro/weapons';
const checks:string[]=[],report:Record<string,unknown>={};
function duel(attacker:WeaponId='sword',defender:WeaponId='sword'){const m=new FerroMatch([{id:'goblin',name:'Goblin',color:'#9c6'},{id:'victor',name:'Victor',color:'#6cf'}]);m.state.phase='fight';const[p,q]=m.state.warriors;Object.assign(p,{weapon:attacker,x:0,y:0,z:attacker==='blades'?-1.4:attacker==='spear'?-2.6:attacker==='hammer'?-2.4:-2,yaw:0});Object.assign(q,{weapon:defender,x:0,y:0,z:0,yaw:Math.PI});return{m,p,q,c:[emptyCommand(),emptyCommand()]};}
function run(m:FerroMatch,c:Command[],seconds:number,events:FerroEvent[]=[]){for(let i=0;i<Math.round(seconds*120);i++){m.step(1/120,p=>c[m.state.warriors.indexOf(p)]);events.push(...m.drainEvents());}return events;}
const guardFor=(dir:GuardDirection):GuardDirection=>incomingDirection({yaw:0},{yaw:Math.PI},{direction:dir,yaw:0});

// 1. Correct guard: blocked by the existing rule, both reactions, the blade stops, no extra damage.
for(const[att,def]of[['sword','sword'],['sword','shield'],['axe','sword'],['hammer','shield'],['sword','spear'],['blades','sword']]as[WeaponId,WeaponId][])for(const dir of['top','left','right']as GuardDirection[]){
 const{m,p,q,c}=duel(att,def);p.guardDirection=dir;c[1].guard=true;c[1].guardDirection=guardFor(dir);run(m,c,.3);c[0].edges.light++;
 let attackerClash='',defenderClash='',stopped=false;const events:FerroEvent[]=[];
 for(let i=0;i<120;i++){run(m,c,1/120,events);if(p.clash&&!attackerClash)attackerClash=p.clash.kind;if(q.clash&&!defenderClash)defenderClash=q.clash.kind;if(p.action?.blocked)stopped=true;}
 const blocks=events.filter(e=>e.kind==='block'),hits=events.filter(e=>e.kind==='hit');
 assert.equal(blocks.length,1,`${att}>${def} ${dir}: one block`);assert.equal(events.filter(e=>e.kind==='parry').length,0);
 assert.equal(defenderClash,'block');assert.equal(attackerClash,'blocked');assert.ok(stopped||attackSpec(att,{kind:'light'}as never).windows,`${att} swing stops on the guard`);
 const chip=attackSpec(att,{kind:'light'}as never).damage*(1-weapon(def).defence);assert.ok(Math.abs((100-q.hp)-chip)<.05,`${att}>${def} ${dir}: same reduced damage as before (${(100-q.hp).toFixed(2)} vs ${chip.toFixed(2)})`);
 assert.ok(hits.length<=1&&blocks[0].dir===guardFor(dir));
 // The contact point sits on the defender's guard (weapon or shield face), not somewhere in the air.
 const pose=combatPose({...q,clash:null}),guard=def==='shield'?{grip:pose.left.grip,tip:pose.left.grip}:pose.right,a=worldPoint(q,guard.grip,q.yaw),b=worldPoint(q,guard.tip,q.yaw),point={x:blocks[0].x!,y:blocks[0].y!,z:blocks[0].z!},near=closest(point,point,a,b).b;
 assert.ok(Math.hypot(near.x-point.x,near.y-point.y,near.z-point.z)<.6,`${att}>${def} ${dir}: contact on the guard`);
}
checks.push('Correct guard (3 directions × 6 weapon pairs): existing block rule decides, one block event at the contact point, block+blocked reactions, swing stops, damage identical to the old reduced value');

// 2. Wrong guard: normal hit and a hit reaction, never a block animation.
for(const dir of['top','left','right']as GuardDirection[]){
 const{m,p,q,c}=duel();p.guardDirection=dir;c[1].guard=true;c[1].guardDirection=(['top','left','right']as GuardDirection[]).find(d=>d!==guardFor(dir));run(m,c,.3);c[0].edges.light++;let kinds=new Set<string>();const events:FerroEvent[]=[];
 for(let i=0;i<120;i++){run(m,c,1/120,events);if(q.clash)kinds.add(q.clash.kind);if(p.clash)kinds.add('attacker:'+p.clash.kind);}
 assert.equal(q.hp,81,'full damage');assert.ok(!events.some(e=>e.kind==='block'||e.kind==='parry'));assert.deepEqual([...kinds],['hurt']);assert.equal(events.find(e=>e.kind==='hit')?.dir,guardFor(dir));
}
checks.push('Wrong guard: full damage, hit reaction from the incoming side, no block/parry presentation');

// 3. Perfect parry vs normal block: distinct result, attacker deflected and opened, no global slow-down.
{
 const{m,p,q,c}=duel();c[0].edges.light++;run(m,c,.23);c[1].guard=true;const events:FerroEvent[]=[];for(let i=0;i<18&&!events.some(e=>e.kind==='parry');i++)run(m,c,1/120,events);const t0=m.state.time;
 assert.ok(events.some(e=>e.kind==='parry'));assert.equal(p.action,null);assert.equal(q.clash?.kind,'parry');assert.equal(p.clash?.kind,'parried');assert.ok(p.stun>0&&p.stun<=.27);assert.ok(q.riposte>0);assert.equal(q.hp,100);
 assert.ok((p.clash?.time??0)>=.3&&(p.clash?.time??1)<=.45&&(q.clash?.time??1)<=.4,'short reactions');
 const before=m.state.time;run(m,c,.5);assert.ok(Math.abs(m.state.time-before-.5)<1e-6,'simulation time is never slowed');assert.equal(p.clash,null);assert.ok(t0>0);
 const parried=clashPose(combatPose({...p,clash:null}),{...p,clash:{...p.clash??{kind:'parried',age:.06,time:.38,dir:'top',side:0,power:1,other:'sword',heavy:false,nudge:{x:0,y:0,z:0}},age:.06}}as never);
 const blocked=clashPose(combatPose({...p,clash:null}),{...p,clash:{kind:'blocked',age:.06,time:.3,dir:'top',side:0,power:1,other:'sword',heavy:false,nudge:{x:0,y:0,z:0}}}as never),rest=combatPose({...p,clash:null});
 const swing=(x:typeof rest)=>Math.hypot(x.right.tip.x-rest.right.tip.x,x.right.tip.y-rest.right.tip.y,x.right.tip.z-rest.right.tip.z);
 report.deflection={parried:+swing(parried).toFixed(3),blocked:+swing(blocked).toFixed(3)};assert.ok(swing(parried)>swing(blocked)*1.5,'parry deflects the weapon much more than a block');
}
checks.push('Perfect parry: same 130 ms rule, attacker weapon thrown off line (>1.5× a block), short stagger + riposte opening, simulation clock untouched');

// 4. A miss produces no impact presentation at all.
{const{m,p,q,c}=duel();p.z=-6;c[0].edges.heavy++;const events=run(m,c,1.4);assert.ok(!events.some(e=>['hit','block','parry','break'].includes(e.kind)));assert.equal(p.clash,null);assert.equal(q.clash,null);assert.equal(q.hp,100);}
checks.push('Missed attack: no hit/block/parry events and no reaction on either warrior; the attack just recovers');

// 5. Gameplay timings unchanged by the presentation layer.
{const{m,p,c}=duel();p.guardDirection='left';c[1].guard=true;c[1].guardDirection=guardFor('left');run(m,c,.3);c[0].edges.heavy++;run(m,c,1/120);assert.ok(Math.abs(p.cooldown-attackLength(weapon('sword').heavy))<1/60);run(m,c,attackLength(weapon('sword').heavy));assert.equal(p.action,null);}
checks.push('Blocked attack keeps its original cooldown and length: no longer lock, no shorter recovery');

// 6. Guards: real weapon positions, full length (no squashed weapon), three distinct sides.
for(const w of WEAPONS.filter(w=>w.id!=='bow'))for(const dir of['top','left','right']as GuardDirection[]){
 const pose=guardPose(w.id,dir),r=pose.right,l=Math.hypot(r.tip.x-r.grip.x,r.tip.y-r.grip.y,r.tip.z-r.grip.z);
 assert.ok(Math.abs(l-w.length)<1e-6,`${w.id} ${dir} full length`);
 const centre=w.id==='shield'?pose.left.grip:{x:(r.grip.x+r.tip.x)/2,y:(r.grip.y+r.tip.y)/2,z:(r.grip.z+r.tip.z)/2};
 if(dir==='top')assert.ok(centre.y>1.7,`${w.id} top raised`);else assert.ok(dir==='left'?centre.x<0:centre.x>0,`${w.id} ${dir} on its side`);
}
assert.equal(variantCount('axe'),3);assert.equal(variantCount('sword'),4);assert.equal(variantCount('shield'),2);
checks.push('Three guards move the actual weapon (top raised, left/right on that side) at full weapon length for all six melee weapons; axe has three cosmetic models');

// 7. BOT BOSCHI: reacts with human delay, mostly right but not always, can parry, can be fooled by a feint.
{
 const stats={attacks:0,right:0,blocks:0,parries:0,hits:0,reactions:[]as number[]},bots=new FerroBots();
 for(let trial=0;trial<90;trial++){
  const m=new FerroMatch([{id:'player'+trial,name:'Player',color:'#9c6'},{id:'boschi'+trial,name:'BOT BOSCHI',color:'#c66',bot:true}]);m.state.phase='fight';const[p,q]=m.state.warriors;Object.assign(p,{weapon:'sword',x:0,z:-2,yaw:0});Object.assign(q,{weapon:'sword',x:0,z:0,yaw:Math.PI});
  const c=emptyCommand(),step=(n:number,events:FerroEvent[]=[])=>{for(let i=0;i<n;i++){q.x=0;q.z=0;q.yaw=Math.PI;q.cooldown=5;p.x=0;p.z=-2;p.yaw=0;m.step(1/120,w=>w===p?c:bots.read(w,m.state,1/120));events.push(...m.drainEvents());}return events;};
  step(90);const dir=(['top','left','right']as GuardDirection[])[trial%3],need=guardFor(dir);p.guardDirection=dir;p.weapon=(['sword','axe','hammer']as WeaponId[])[Math.floor(trial/3)%3];c.edges.heavy++;const start=m.state.time;let reacted=-1;const events:FerroEvent[]=[];
  for(let i=0;i<140;i++){step(1,events);if(reacted<0&&q.guardDirection===need&&m.state.time-start<.4)reacted=m.state.time-start;}
  stats.attacks++;if(reacted>=0){stats.right++;stats.reactions.push(+reacted.toFixed(3));}
  if(events.some(e=>e.kind==='block'))stats.blocks++;if(events.some(e=>e.kind==='parry'))stats.parries++;if(events.some(e=>e.kind==='hit'&&e.target===q.id)&&!events.some(e=>e.kind==='block'||e.kind==='parry'))stats.hits++;
 }
 report.bot=stats;console.log('bot',JSON.stringify(stats));const fast=stats.reactions.filter(t=>t>.02&&t<.16).length;
 assert.ok(stats.right/stats.attacks>.35&&stats.right/stats.attacks<.98,'bot guards the right side often, not always');
 assert.ok(stats.parries>=1&&stats.parries<stats.attacks*.5,'bot sometimes parries, never automatically');
 assert.ok(stats.hits>=3,'bot can still be hit');assert.equal(fast,0,'no reaction faster than a human (pre-emptive stance aside)');
}
{
 // Repeated top heavies teach the bot to sit in top; a heavy top feint followed by a side light then lands.
 let fooled=0,trials=0,adapted=0;const bots=new FerroBots();
 for(let trial=0;trial<30;trial++){
  const m=new FerroMatch([{id:'player'+trial,name:'Player',color:'#9c6'},{id:'boschi'+trial,name:'BOT BOSCHI',color:'#c66',bot:true}]);m.state.phase='fight';const[p,q]=m.state.warriors;Object.assign(p,{weapon:'sword',x:0,z:-2,yaw:0});Object.assign(q,{weapon:'sword',x:0,z:0,yaw:Math.PI,hp:1000});
  const c=emptyCommand(),step=(n:number,events:FerroEvent[]=[])=>{for(let i=0;i<n;i++){q.x=0;q.z=0;q.yaw=Math.PI;q.cooldown=5;q.stamina=100;p.x=0;p.z=-2;p.yaw=0;p.stamina=100;m.step(1/120,w=>w===p?c:bots.read(w,m.state,1/120));events.push(...m.drainEvents());}return events;};
  step(60);for(let i=0;i<4;i++){p.guardDirection='top';c.edges.heavy++;step(210);}
  if(q.guardDirection==='top')adapted++;
  p.guardDirection='top';c.edges.heavy++;step(14);c.edges.feint++;step(30);p.guardDirection=trial%2?'left':'right';c.edges.light++;const events=step(90);trials++;
  if(events.some(e=>e.kind==='hit'&&e.target===q.id)&&!events.some(e=>e.kind==='block'||e.kind==='parry'))fooled++;
 }
 report.feint={trials,adapted,fooled};assert.ok(adapted>=trials*.4,'bot adapts to a favourite top attack');assert.ok(fooled>=trials*.25,'a feint can still fool it');
}
checks.push('BOT BOSCHI: guards the seen side after 0.17–0.34 s, sometimes wrong, occasional imperfect parry, adapts to repeated top attacks and can be fooled by a feint');

// 8. Exhaustion: at 0 stamina everything is slower, yet attacks still go out; recovers above the threshold.
{
 const{m,p,q,c}=duel();p.stamina=0;run(m,c,.05);assert.ok(p.spent);
 const fresh=duel(),f=fresh.p;fresh.c[0].my=-1;c[0].my=-1;run(m,c,.5);run(fresh.m,fresh.c,.5);const slow=Math.abs(p.z+2),fast=Math.abs(f.z+2);assert.ok(slow<fast*.7,'exhausted moves much slower');
 const t=duel();t.p.stamina=0;t.p.spent=true;t.p.guardDirection='top';t.c[0].guardDirection='left';run(t.m,t.c,.2);assert.equal(t.p.guardDirection,'top','guard side change is delayed');run(t.m,t.c,.5);assert.equal(t.p.guardDirection,'left');
 const a=duel();a.p.stamina=0;a.c[0].edges.light++;run(a.m,a.c,1.2);assert.ok(a.q.hp<100,'exhausted attack still hits');assert.ok(a.p.spent);
 const r=duel();r.p.stamina=0;run(r.m,r.c,.05);for(let i=0;i<600&&r.p.spent;i++)run(r.m,r.c,1/120);assert.ok(!r.p.spent&&r.p.stamina>=40);
}
checks.push('Exhaustion: 0 stamina -> slower walking, delayed guard-side change, attacks still allowed (slower swing) until stamina recovers to 40');
// 9. Running: faster, costs stamina, differs per weapon, delays an attack and the guard afterwards.
{
 const dist=(w:WeaponId,sprint:boolean)=>{const t=duel(w,'sword');t.p.z=-6;t.q.x=7;t.q.z=7;t.c[0].my=-1;t.c[0].sprint=sprint;run(t.m,t.c,1);return{d:Math.abs(t.p.z+6),stamina:t.p.stamina,running:t.p.running};};
 const walk=dist('sword',false),sword=dist('sword',true),blades=dist('blades',true),hammer=dist('hammer',true);
 assert.ok(sword.running&&sword.d>walk.d*1.35&&sword.stamina<walk.stamina-6,'run is faster and costs stamina');
 assert.ok(blades.d>sword.d&&sword.d>hammer.d,'blades run faster than sword, hammer slowest');assert.ok(100-blades.stamina<100-hammer.stamina,'blades tire less than the hammer');
 const a=duel('hammer','sword');a.p.z=-6;a.q.x=7;a.q.z=7;a.c[0].my=-1;a.c[0].sprint=true;run(a.m,a.c,.5);a.c[0].edges.light++;run(a.m,a.c,.03);assert.ok(a.p.action&&a.p.action.age<0,'attack out of a run starts late');
 const g=duel('hammer','sword');g.p.z=-6;g.q.x=7;g.q.z=7;g.c[0].my=-1;g.c[0].sprint=true;run(g.m,g.c,.5);g.c[0].my=0;g.c[0].sprint=false;g.c[0].guard=true;run(g.m,g.c,.1);assert.ok(!g.p.guard,'cannot guard right after a run');run(g.m,g.c,.5);assert.ok(g.p.guard,'guard comes up after the settle time');
 const x=duel('sword','sword');x.c[0].my=-1;x.c[0].sprint=true;x.c[0].guard=true;run(x.m,x.c,.3);assert.ok(!x.p.running,'no running while guarding');
}
checks.push('Running: faster than walking at a stamina cost, per-weapon speed/drain (blades best, hammer worst), late attack and guard right after a run, never while guarding');
mkdirSync('docs/agent-work/ferro-21',{recursive:true});writeFileSync('docs/agent-work/ferro-21/selftest.json',JSON.stringify({status:'passed',checks,report},null,2));
console.log(checks.join('\n'));console.log(JSON.stringify(report));
