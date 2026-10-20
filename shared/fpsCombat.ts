/** Cosmetic events originate only from confirmed host hits. */
export type FpsSurface='unknown'|'concrete'|'metal'|'glass'|'wood';
export const FPS_SURFACES:readonly FpsSurface[]=['unknown','concrete','metal','glass','wood'];
export interface SurfaceImpact {x:number;y:number;z:number;nx:number;ny:number;nz:number;surface:FpsSurface}
export interface ShotSegment {ox:number;oy:number;oz:number;ex:number;ey:number;ez:number}
export interface KillNotice {name:string;badge?:string}
/** Match-local facts: no badge is inferred from a predicted shot. */
export class FpsKillHistory {
 private lastKiller=new Map<string,string>();private streak=new Map<string,number>();private recent=new Map<string,number>();
 record(killer:string,victim:string,time:number,leader:boolean):string{
  const revenge=this.lastKiller.get(killer)===victim;this.lastKiller.set(victim,killer);if(revenge)this.lastKiller.delete(killer);
  this.streak.set(victim,0);this.recent.delete(victim);const n=(this.streak.get(killer)??0)+1;this.streak.set(killer,n);
  const double=time-(this.recent.get(killer)??-Infinity)<=3;this.recent.set(killer,time);
  return revenge?'VENDETTA':double?'DOPPIA ELIMINAZIONE':n>=3?`SERIE ${n}`:leader?'LEADER ELIMINATO':'';
 }
}
