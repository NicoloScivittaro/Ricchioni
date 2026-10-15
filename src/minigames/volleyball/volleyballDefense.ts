import type { VolleyballBall, VolleyballPlayer } from './volleyballTypes';
import { BALL_RADIUS } from './volleyballTypes';

export const DEFENSE = { sprintMult: 2.1, sprintSeconds: 2.4, rechargeSeconds: 3.2, diveSeconds: .34, diveCooldown: 1.7, diveSpeed: 13, diveRadius: 3.1, diveReach: 2.1 } as const;

/** No recovery from across the net, after ground contact, or from your own previous hit. */
export function canDiveReceive(p: VolleyballPlayer, b: VolleyballBall): boolean {
  return p.diveTime > 0 && !p.diveReceived && p.hitCooldown <= 0 && b.state === 'flying'
    && b.lastTouchId !== p.id && b.z * (p.team === 'red' ? -1 : 1) >= 0
    && b.y >= BALL_RADIUS && b.y <= DEFENSE.diveReach
    && Math.hypot(b.x-p.x,b.z-p.z) <= DEFENSE.diveRadius;
}

/** Release to recharge: holding an exhausted sprint never causes automatic bursts. */
export function updateSprint(p: VolleyballPlayer, held: boolean, moving: boolean, allowed: boolean, dt: number): void {
  p.sprinting = allowed && held && moving && p.y <= .01 && p.diveTime <= 0 && p.sprintEnergy > 0;
  p.sprintEnergy = Math.max(0, Math.min(1, p.sprintEnergy + (p.sprinting ? -dt/DEFENSE.sprintSeconds : !held ? dt/DEFENSE.rechargeSeconds : 0)));
}

export function beginDive(p: VolleyballPlayer, b: VolleyballBall, mx: number, mz: number): boolean {
  if (p.y > .01 || p.diveCooldown > 0 || p.stunTime > 0 || b.state !== 'flying' || b.holderId === p.id) return false;
  let dx=mx, dz=mz;
  if (Math.hypot(dx,dz)<.15) { dx=b.x-p.x; dz=b.z-p.z; }
  const len=Math.hypot(dx,dz);
  if (len<.01) { dx=Math.sin(p.facing); dz=Math.cos(p.facing); }
  else { dx/=len; dz/=len; }
  p.vx=dx*DEFENSE.diveSpeed; p.vz=dz*DEFENSE.diveSpeed; p.facing=Math.atan2(dx,dz);
  p.diveTime=DEFENSE.diveSeconds; p.diveCooldown=DEFENSE.diveCooldown; p.diveReceived=false; p.sprinting=false;
  return true;
}
