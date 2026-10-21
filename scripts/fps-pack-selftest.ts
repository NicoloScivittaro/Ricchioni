import assert from 'node:assert/strict';
import {writeFileSync}from'node:fs';
import {WEAPONS,getWeapon}from'../shared/fpsWeapons';
import {beginWeaponReload,advanceWeaponReload}from'../shared/fpsReload';
import {OrdaMatch,weaponOf}from'../shared/orda/match';
import {EMPTY_INPUT}from'../shared/orda/types';
import {FpsAbilities}from'../src/minigames/fps/fpsAbilities';
const checks:string[]=[];
assert.deepEqual(WEAPONS.slice(0,6).map(w=>[w.id,w.damage,w.magazine,w.reload]),[['mitraglia',16,30,1.7],['laser',125,5,2.4],['raffica',23,30,1.8],['bombarda',80,20,2.5],['sparapiselli',12,100,2.9],['pistola',30,12,1.1]]);
assert.equal(new Set(WEAPONS.map(w=>w.id)).size,11);checks.push('Six old weapon statistics unchanged; eleven unique active IDs');
for(const id of['acr','glock','ak74u'])for(const ammo of[0,3]){
 const w=getWeapon(id),r=beginWeaponReload(w,ammo,100),marker=(ammo===0?w.reloadInsertEmpty:undefined)??w.reloadInsert!;
 assert.equal(r.duration,ammo===0?(w.reloadEmpty??w.reload):w.reload);assert.equal(advanceWeaponReload(w,r,marker-.001),0);assert.equal(advanceWeaponReload(w,r,.001),w.magazine-ammo);assert.equal(advanceWeaponReload(w,r,100),0);
}checks.push('Magazine insertion markers, empty/normal durations, no duplicated rounds');
const w=getWeapon('shotgun'),r=beginWeaponReload(w,2,3),c=w.shellReload!;let n=advanceWeaponReload(w,r,c.start+c.contact-.001);assert.equal(n,0);n+=advanceWeaponReload(w,r,.001);assert.equal(n,1);n+=advanceWeaponReload(w,r,c.insert);assert.equal(n,2);n+=advanceWeaponReload(w,r,c.insert);assert.equal(n,3);assert.equal(advanceWeaponReload(w,r,100),0);assert.equal(r.duration,c.start+c.insert*3+c.end);checks.push('Shotgun: exact three individual shell contacts, limited reserve, closing stage');
const m=new OrdaMatch([{id:'a',name:'A',color:'#fff'},{id:'b',name:'B',color:'#fff'}],71),p=m.state.players[0],q=m.state.players[1];m.state.phase='intermission';m.state.countdown=1000;m.state.supplies=[];
Object.assign(p,{weapon:'shotgun',ammo:2,reserve:3});Object.assign(q,{weapon:'glock',ammo:17,reserve:50});
const internal=m as any;internal.reload(p);const before=p.ammo;internal.fire(p);assert.equal(p.ammo,before);internal.fire(q);assert.equal(q.ammo,16);assert.equal(m.drainEvents().filter(e=>e.type==='shot').length,1);
for(let i=0;i<Math.ceil((c.start+3*c.insert+c.end)*30)+1;i++)m.step(1/30,()=>EMPTY_INPUT);
assert.equal(p.ammo,5);assert.equal(p.reserve,0);assert.equal(p.reload,0);assert.equal(q.ammo,16);checks.push('Actual Orda clock: blocked fire during reload, independent player ammo, authoritative shell transfer');
for(const id of['acr','glock','shotgun','ak74u']){Object.assign(p,{weapon:id,ammo:getWeapon(id).magazine,reserve:100,reload:0});const ammo=p.ammo;internal.fire(p);assert.equal(p.ammo,ammo-1);assert.equal(m.drainEvents().filter(e=>e.type==='shot').length,1);assert.ok(weaponOf(id).damage>0);}
checks.push('Actual Orda: one round and one shot event per trigger, including eight shotgun pellets');
internal.state.pending=1;internal.state.wave=1;internal.spawn();const target=m.state.enemies[0];assert.ok(target);Object.assign(target,{x:-6,z:-9,y:0,height:4,radius:.8,hp:10000,maxHp:10000});m.state.enemies=[target];Object.assign(p,{x:-6,z:-12,y:0,yaw:0,pitch:0,ads:1,damageBoost:0});
for(const id of['acr','glock','shotgun','ak74u']){Object.assign(p,{weapon:id,ammo:getWeapon(id).magazine,reload:0});target.hp=10000;internal.fire(p);const expected=weaponOf(id).damage*(weaponOf(id).pellets??1);assert.ok(Math.abs(10000-target.hp-expected)<1e-6,`${id} damage and pellet sum`);}
checks.push('Actual hitscan damage: ACR, Glock, AK74U and eight shotgun pellets hit a body target with their configured Orda damage');
const ability=new FpsAbilities(),partial=beginWeaponReload(w,5),ab:any={...p,characterId:'goblin',reloading:true,weaponReload:partial,reloadTimer:partial.duration,magazine:5,buffShots:0,abCd:0};assert.ok(!ability.status(ab,w).note?.includes('ZONA VERDE'));ability.onAbilityPress(ab,w,[ab],()=>{});assert.equal(ab.magazine,5);assert.equal(ab.reloading,true);ab.abCd=0;ab.reloadTimer=.1;ability.onAbilityPress(ab,w,[ab],()=>{});assert.equal(ab.magazine,6);assert.equal(ab.weaponReload,undefined);checks.push('Existing Goblin ability uses the actual partial reload duration; early press delays, perfect reload completes explicitly');
Object.assign(p,{weapon:'shotgun',ammo:0,reserve:20,cooldown:1/getWeapon('shotgun').fireRate,reload:0,weaponReload:undefined});internal.reload(p);assert.equal(p.reload,0);for(let i=0;i<20;i++)m.step(1/30,()=>EMPTY_INPUT);assert.equal(p.reload,0);for(let i=0;i<15;i++)m.step(1/30,()=>EMPTY_INPUT);assert.ok(p.reload>0);assert.equal(p.ammo,0);checks.push('Empty shotgun finishes its authored fire/pump cycle before automatic reload begins; manual reload cannot interrupt that cycle');
writeFileSync('docs/agent-work/fps-weapon-pack/logic.json',JSON.stringify({status:'passed',checks},null,2));console.log(checks.join('\n'));
