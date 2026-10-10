/** Common combat tuning: character differences remain owned by their abilities. */
export const ARENA_COMBAT = {
  chargeThreshold: .18, chargeMax: 1, chargeMove: .4,
  pushRange: 2.9, pushCone: .45, pushPower: 6.5, pushCooldown: .45,
  shoulderSpeedMin: 18, shoulderSpeedMax: 28,
  shoulderTimeMin: .20, shoulderTimeMax: .36,
  shoulderPowerMin: 18, shoulderPowerMax: 28,
  shoulderCooldown: 2.5, recovery: .38,
  momentumTime: .48, momentumFriction: 3, momentumCap: 65,
  recoveryDelay: 2.5, recoveryRate: 14, vulnerability: 1.2,
} as const;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export function shoulderValues(seconds: number): { charge: number; speed: number; time: number; power: number } {
  const c = ARENA_COMBAT;
  const charge = clamp((seconds-c.chargeThreshold)/(c.chargeMax-c.chargeThreshold),0,1);
  return { charge, speed:c.shoulderSpeedMin+(c.shoulderSpeedMax-c.shoulderSpeedMin)*charge,
    time:c.shoulderTimeMin+(c.shoulderTimeMax-c.shoulderTimeMin)*charge,
    power:c.shoulderPowerMin+(c.shoulderPowerMax-c.shoulderPowerMin)*charge };
}
export function instabilityMultiplier(value: number): number { return 1+clamp(value,0,100)/100*ARENA_COMBAT.vulnerability; }
export function recoverInstability(value: number, lastImpact: number, now: number, dt: number): number {
  const recovering = Math.min(Math.max(0,dt),Math.max(0,now-lastImpact-ARENA_COMBAT.recoveryDelay));
  return clamp(value-recovering*ARENA_COMBAT.recoveryRate,0,100);
}
export function instabilityStage(value: number): string { return value>=70?'CRITICO':value>=35?'SBILANCIATO':'STABILE'; }
/** Earliest contact of two moving circles. Also catches an entire crossing within one simulation step. */
export function sweptContact(ax: number, az: number, bx: number, bz: number, dx: number, dz: number, radius: number): number | null {
  const x=ax-bx,z=az-bz,c=x*x+z*z-radius*radius;
  if(c<=0)return 0;
  const a=dx*dx+dz*dz;if(a<1e-12)return null;
  const b=2*(x*dx+z*dz),disc=b*b-4*a*c;if(disc<0)return null;
  const t=(-b-Math.sqrt(disc))/(2*a);
  return t>=0&&t<=1?t:null;
}
