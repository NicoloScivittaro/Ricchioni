import assert from'node:assert/strict';
import{writeFileSync}from'node:fs';
import{OrdaMatch}from'../shared/orda/match';
import{STATIONS,PERKS,maxHits,playerHealth}from'../shared/orda/perks';
import{ORDA_WEAPONS,survivorWeapon}from'../shared/orda/weapons';
import{WEAPONS}from'../shared/fpsWeapons';
import{EMPTY_INPUT}from'../shared/orda/types';
import type{Enemy}from'../shared/orda/types';
import{floorAt,move}from'../shared/orda/arena';
const checks:string[]=[];
function make(){const m=new OrdaMatch(['a','b','c'].map(id=>({id,name:id,color:'#fff'})));m.state.phase='intermission';m.state.countdown=1000;m.state.supplies=[];return m;}
function step(m:OrdaMatch,t:number){for(let i=0;i<Math.ceil(t*30);i++)m.step(1/30);}
function at(m:OrdaMatch,id:string,index=0){const t=STATIONS.find(t=>t.id===id)!,p=m.state.players[index];Object.assign(p,{x:t.x+Math.sin(t.rotation)*1.5,z:t.z+Math.cos(t.rotation)*1.5,y:floorAt(t.x,t.z),vy:0});assert.equal((m.interactionTarget(p)as any)?.id,id);return p;}
for(const id of ['juggernog','speedcola','doubletap']as const){const m=make(),p=at(m,id);p.points=PERKS[id].price-1;m.interact(p);assert.equal(p.drinking,null);p.points++;m.interact(p);assert.equal(p.points,0);assert.equal(p.perks.length,0);assert.equal(p.drinking?.id,id);m.interact(p);assert.equal(p.points,0);step(m,2.1);assert.ok(p.perks.includes(id));p.points=9999;m.interact(p);assert.equal(p.points,9999);const packet=m.packet();packet.players[0].perks.length=0;assert.equal(p.perks.length,1);}
checks.push('Three real station prices, 1-point shortage, single debit, delayed drink effect, no duplicate perk, cloned packet');
let m=make(),p=at(m,'juggernog');p.points=2500;m.interact(p);step(m,2.1);assert.equal(maxHits(p),5);for(let i=0;i<4;i++){m.damagePlayer(p,999,m.state.time+i*.7);assert.equal(p.alive,true);}m.damagePlayer(p,1,m.state.time+2.8);assert.equal(p.alive,false);assert.equal(p.perks.length,0);
m=make();p=m.state.players[0];m.damagePlayer(p,20,0);m.damagePlayer(p,20,.7);m.damagePlayer(p,20,1.4);assert.equal(p.alive,false);
m=make();p=at(m,'juggernog');m.damagePlayer(p,10,0);p.points=2500;m.interact(p);step(m,2.1);assert.equal(p.hitsTaken,1);assert.equal(p.hp,playerHealth(p));m.state.supplies=[{id:0,kind:'health',x:p.x,z:p.z,cooldown:0}];m.step(1/30);assert.equal(p.hitsTaken,0);assert.equal(p.hp,100);
checks.push('Base third-hit death, Jugger fifth-hit death, damage already taken conserved, first aid restores one hit, death clears perks');
for(const id of ['acr','glock','shotgun','ak74u']){m=make();p=m.state.players[0];Object.assign(p,{weapon:id,ammo:0,reserve:100,x:0,z:-10});const base=survivorWeapon(p);(m as any).reload(p);const duration=p.reload;p.reload=0;p.weaponReload=undefined;p.perks=['speedcola'];(m as any).reload(p);assert.equal(p.reload,duration/2);assert.equal(p.weaponReload?.playbackRate,2);step(m,p.reload+.1);assert.equal(p.ammo,base.magazine);assert.equal(p.reload,0);}
checks.push('Speed Cola halves ordinary/empty and shell reload durations and insertion timings; animation playback metadata 2x; correct ammo conservation');
// Place a known target in a cover-free firing lane.
function enemy(m:OrdaMatch,x:number,z:number,hp=10000,kind:Enemy['kind']='infetto'):Enemy{(m as any).spawn();const e=m.state.enemies[m.state.enemies.length-1];Object.assign(e,{x,z,y:0,height:1.8,radius:.4,hp,maxHp:hp,kind});return e;}
m=make();p=m.state.players[0];Object.assign(p,{x:0,z:-10,y:0,yaw:0,pitch:.06,weapon:'pistola',ammo:12});let e=enemy(m,0,-6);(m as any).fire(p);const damage=10000-e.hp;p.perks=['doubletap'];e.hp=10000;(m as any).fire(p);assert.equal(p.ammo,10);assert.ok(Math.abs(10000-e.hp-damage*2)<1e-6);assert.ok(Math.abs(survivorWeapon(p).fireRate/7-4/3)<1e-6);
checks.push('Double Tap 2.0 fires two ballistic bullets for one ammo, doubles same target damage and adds 33% cadence');
m=make();p=at(m,'pap');p.weapon='wunderwaffe';p.ammo=3;p.reserve=15;p.points=4999;m.interact(p);assert.equal(m.state.pap.phase,'idle');p.points=5000;m.interact(p);assert.equal(p.points,0);assert.equal(m.state.pap.phase,'working');(m as any).fire(p);assert.equal(p.ammo,3);p.points=5000;m.interact(p);assert.equal(p.points,5000);const q=at(m,'pap',1);q.points=5000;m.interact(q);assert.equal(q.points,5000);step(m,5.1);assert.equal(m.state.pap.phase,'ready');m.interact(q);assert.equal(q.packed,false);m.interact(p);assert.equal(p.packed,true);assert.equal(p.ammo,6);assert.equal(p.reserve,30);assert.equal(survivorWeapon(p).name,'WUNDERWAFFE DG-3 JZ');assert.equal(m.state.pap.phase,'idle');m.interact(p);assert.equal(p.points,5000);
checks.push('Pack-a-Punch 5000 debit once; no shooting deposited weapon; exclusive five-second process, owner pickup, DG-3 JZ 6/30; no repeat upgrade');
m=make();p=at(m,'pap');p.points=5000;p.weapon='acr';m.interact(p);step(m,15.2);assert.equal(p.weapon,'pistola');assert.equal(p.packed,false);assert.equal(m.state.pap.phase,'idle');assert.equal(p.points,0);
m=make();p=at(m,'pap');p.points=5000;m.interact(p);m.damagePlayer(p,99,0);m.damagePlayer(p,99,.7);m.damagePlayer(p,99,1.4);step(m,.1);assert.equal(m.state.pap.owner,null);
checks.push('Unclaimed Pack weapon expires, no refund/upgrade; owner death releases machine');
m=make();p=m.state.players[0];Object.assign(p,{x:0,z:-10,y:0,yaw:0,pitch:.06,weapon:'wunderwaffe',ammo:3,perks:['doubletap']});for(let i=0;i<12;i++)enemy(m,.15*(i%3),-6+i*.25,1000);m.drainEvents();(m as any).fire(p);assert.equal(p.ammo,2);assert.equal(p.kills,10);assert.equal(p.points,500);assert.equal(m.drainEvents().filter(e=>e.type==='lightning').length,10);
m=make();p=m.state.players[0];Object.assign(p,{x:0,z:-10,y:0,yaw:0,pitch:.06,weapon:'wunderwaffe',ammo:3});e=enemy(m,0,-6,3000,'warrok');(m as any).fire(p);assert.equal(e.hp,2400);p.packed=true;(m as any).fire(p);assert.equal(e.hp,1200);
m=make();p=m.state.players[0];Object.assign(p,{x:-8,z:-6,y:0,yaw:-Math.PI/2,pitch:0,weapon:'wunderwaffe',ammo:3});e=enemy(m,-13,-6,1000);(m as any).fire(p);assert.equal(e.hp,1000);
checks.push('Wunderwaffe 10 unique targets max, 50 points per kill, one ammo per discharge even with Double Tap, bounded boss damage600/1200, no shooting through cover');
assert.equal(WEAPONS.length,11);assert.equal(WEAPONS.some(w=>w.id==='wunderwaffe'),true);assert.equal(ORDA_WEAPONS.length,11);assert.equal(new Set(ORDA_WEAPONS.map(w=>w.id)).size,11);
checks.push('Eleven unique weapons in both modes, including Wunderwaffe without duplicate box weighting');
m=make();for(const t of STATIONS){const goal={x:t.x+Math.sin(t.rotation)*1.5,z:t.z+Math.cos(t.rotation)*1.5};assert.ok(m.nav.path(m.state.players[0],goal).length>0,'reachable station '+t.id);}
checks.push('All four station approach points reachable through the existing navigation graph, including both raised-dock machines');
m=make();p=at(m,'juggernog');Object.assign(p,{bot:true,weapon:'acr',points:2500});step(m,.1);assert.equal(p.points,0);assert.equal(p.drinking?.id,'juggernog');step(m,2.1);assert.ok(p.perks.includes('juggernog'));checks.push('Bot uses the same station interaction and2500-point debit, waits for drink and receives Jugger-Nog');
writeFileSync('docs/agent-work/orda-perks/logic.json',JSON.stringify({status:'passed',checks},null,2));console.log(checks.join('\n'));
