import type{WeaponConfig}from'./fpsWeapons';
/** Authoritative clock and insertion markers, shared by host simulation and all viewmodels. */
export interface WeaponReload{elapsed:number;duration:number;empty:boolean;startAmmo:number;rounds:number;inserted:number;playbackRate?:number}
export function beginWeaponReload(w:WeaponConfig,ammo:number,reserve=Infinity):WeaponReload{
 const rounds=Math.max(0,Math.min(w.magazine-ammo,reserve)),c=w.shellReload;
 return{elapsed:0,duration:c?c.start+rounds*c.insert+c.end:ammo===0?(w.reloadEmpty??w.reload):w.reload,empty:ammo===0,startAmmo:ammo,rounds,inserted:0};
}
/** Returns newly inserted rounds. This module never fires a weapon. */
export function advanceWeaponReload(w:WeaponConfig,r:WeaponReload,dt:number):number{
 r.elapsed=Math.min(r.duration,r.elapsed+Math.max(0,dt));const c=w.shellReload;
 const inserted=c?Math.max(0,Math.min(r.rounds,Math.floor((r.elapsed-c.start-c.contact+1e-7)/c.insert)+1)):r.elapsed+1e-7>=((r.empty?w.reloadInsertEmpty:undefined)??w.reloadInsert??r.duration)?r.rounds:0;
 const delta=Math.max(0,inserted-r.inserted);r.inserted=inserted;return delta;
}
