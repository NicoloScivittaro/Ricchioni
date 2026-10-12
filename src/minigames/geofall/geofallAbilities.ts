import { abilityFor, type AbilityDef, type AbilityStatus } from '../../../shared/abilityCatalog';
import type { GeoActor, GeofallMatch } from './geofallRules';
export interface GeoAbilityState { charges: number; cooldown: number; active: number; shield: boolean }
export function geoAbility(p: GeoActor): AbilityDef | null { return abilityFor('geofall', p.characterId); }
export function resetGeoAbility(p: GeoActor): void {
  p.ab = { charges: geoAbility(p)?.charges ?? 0, cooldown: 0, active: 0, shield: false };
  clearGeoEffects(p);
}
export function clearGeoEffects(p: GeoActor): void {
  p.ab.active = 0; p.ab.shield = false; p.confusion = p.confusionWarning = p.confusionImmunity = 0;
}
export function activateGeoAbility(p: GeoActor, match: GeofallMatch): string | null {
  const def = geoAbility(p); if (!def) return 'NON DISPONIBILE';
  if (p.lives <= 0 || match.phase !== 'answer' || match.remaining <= 0) return 'NON ORA';
  if (p.ab.cooldown > 0) return 'IN RICARICA';
  if (p.ab.charges <= 0) return 'ESAURITA';
  if (p.ab.active > 0) return 'GIÀ ATTIVA';
  let target: GeoActor | undefined;
  if (p.characterId === 'judoka' && Math.hypot(p.vx,p.vz) < 1 && p.stun <= 0) return 'SERVE UNO SPINTONE';
  if (p.characterId === 'ciro') {
    if (match.remaining < def.p.minimum) return 'TROPPO TARDI';
    const nx=Math.sin(p.facing),nz=Math.cos(p.facing);
    target=match.alive.filter(v=>v!==p&&v.confusion<=0&&v.confusionWarning<=0&&v.confusionImmunity<=0)
      .filter(v=>{const dx=v.x-p.x,dz=v.z-p.z,d=Math.hypot(dx,dz);return d<=def.p.range&&(dx*nx+dz*nz)/Math.max(.01,d)>.45;})
      .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
    if (!target) return 'NESSUNO DAVANTI';
  }
  p.ab.charges--; p.ab.cooldown=def.cooldown;
  if(p.characterId==='goblin'){p.ab.active=def.p.window;p.ab.shield=true;}
  else if(p.characterId==='buttafuori'||p.characterId==='dottore')p.ab.active=def.p.duration;
  else if(p.characterId==='judoka'){p.vx*=def.p.speedFactor;p.vz*=def.p.speedFactor;p.stun=0;}
  else if(target){target.confusionWarning=def.p.warning;match.events.push({type:'confusionWarning',id:target.id});}
  match.events.push({type:'ability',id:p.id}); return null;
}
export function tickGeoAbility(p: GeoActor,dt:number):void {
  p.ab.cooldown=Math.max(0,p.ab.cooldown-dt);p.ab.active=Math.max(0,p.ab.active-dt);
  if(p.ab.active<=0)p.ab.shield=false;
  p.confusionImmunity=Math.max(0,p.confusionImmunity-dt);
  if(p.confusionWarning>0){p.confusionWarning=Math.max(0,p.confusionWarning-dt);if(p.confusionWarning<=1e-8){p.confusionWarning=0;p.confusion=abilityFor('geofall','ciro')!.p.duration;}}
  else if(p.confusion>0){p.confusion=Math.max(0,p.confusion-dt);if(p.confusion<=1e-8){p.confusion=0;p.confusionImmunity=abilityFor('geofall','ciro')!.p.immunity;}}
}
export function geoAbilityStatus(p:GeoActor,phase:GeofallMatch['phase']):AbilityStatus {
  if(p.lives<=0)return{state:'SPENT',charges:0,note:'SPETTATORE'};
  if(phase!=='answer')return{state:'SPENT',charges:p.ab.charges,note:'ATTENDI IL VIA'};
  if(p.ab.active>0)return{state:'ACTIVE',remaining:p.ab.active,charges:p.ab.charges};
  if(p.ab.charges<=0)return{state:'SPENT',charges:0,note:'USATA · PROSSIMA DOMANDA'};
  if(p.ab.cooldown>0)return{state:'COOLDOWN',remaining:p.ab.cooldown,charges:p.ab.charges};
  return{state:'READY',charges:p.ab.charges};
}
