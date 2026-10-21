import {WEAPONS,WUNDERWAFFE}from'../fpsWeapons';
import type{WeaponConfig}from'../fpsWeapons';
import type{Survivor}from'./types';
export const ORDA_WEAPONS:readonly WeaponConfig[]=[...WEAPONS.map(w=>({...w,damage:w.damage*(w.id==='sparapiselli'?1.45:w.id==='pistola'?1.15:1.12),splashDamage:w.splashDamage?65:undefined})),WUNDERWAFFE];
export const weaponOf=(id:string)=>ORDA_WEAPONS.find(w=>w.id===id)??ORDA_WEAPONS.find(w=>w.id==='pistola')!;
/** Only Orda derives modifiers; shared gun configs remain unchanged. */
export function survivorWeapon(p:Survivor):WeaponConfig{
 const base=weaponOf(p.weapon),w={...base},speed=p.perks.includes('speedcola')?2:1;
 if(p.packed){w.name=p.weapon==='wunderwaffe'?'WUNDERWAFFE DG-3 JZ':base.name+' · PACK-A-PUNCH';w.damage*=2;w.magazine*=2;if(w.splashDamage)w.splashDamage*=2;if(p.weapon==='wunderwaffe')w.reload=4.7;}
 if(p.perks.includes('doubletap')){w.fireRate*=4/3;if(w.burstGap)w.burstGap*=.75;}
 w.reload/=speed;if(w.reloadEmpty)w.reloadEmpty/=speed;if(w.reloadInsert)w.reloadInsert/=speed;if(w.reloadInsertEmpty)w.reloadInsertEmpty/=speed;
 if(w.shellReload)w.shellReload=Object.fromEntries(Object.entries(w.shellReload).map(([k,v])=>[k,v/speed]))as NonNullable<WeaponConfig['shellReload']>;
 return w;
}
