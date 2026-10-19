import type {KartState} from './raceTypes';

/** Critically damped heading response: input aims the nose, release settles it,
 * but neither this controller nor the landing predictor moves the kart to a lane. */
export const GLIDE = {yaw: .24, frequency: 6, safetyYaw: .48, landingTime: .3} as const;
export const smooth01=(t:number):number=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};

/** Same lift profile for karts, guides and airborne items. Zero vertical speed at both ends. */
export function glideLift(t:number,height:number):number {
  const u=Math.max(0,Math.min(1,t));return Math.sin(Math.PI*u)**2*height;
}

/** Predict the lateral touchdown if steering is released now. Includes residual
 * yaw and contact impulses; it is information, never an aim/position assist. */
export function predictGlideLanding(k:KartState):number {
  const time=Math.max(0,(k.glideEnd-k.distance)/Math.max(20,k.speed*Math.cos(k.heading)));
  const w=GLIDE.frequency,e=Math.exp(-w*time),yaw=k.heading,rate=k.glideYawVelocity;
  const integral=yaw*(1-e)/w+(w*yaw+rate)*(1-(1+w*time)*e)/(w*w);
  // Oil retains its reduced lateral grip; do not display a dry-road forecast for it.
  const decay=Math.max(.6,4.5-Math.min(1,k.oilTimer/.4)*3.9);
  return k.lateral+k.speed*integral+k.slipVelocity*(1-Math.exp(-decay*time))/decay;
}
