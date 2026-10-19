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
  if(Math.abs(k.heading)+Math.abs(k.glideYawVelocity)+Math.abs(k.slipVelocity)<1e-5)return k.lateral;
  const remaining=Math.max(0,k.glideEnd-k.distance),w=GLIDE.frequency;
  let speed=k.speed,forward=0,lateral=k.lateral,slip=k.slipVelocity,time=0;
  const dt=Math.max(.004,Math.min(.16,remaining/Math.max(24,speed)/48));
  // Bounded cheap integration includes cruise/boost decay and the active light mode.
  // Steering is assumed released; new input or a later collision changes the forecast.
  for(let i=0;i<96&&forward<remaining;i++){
    const mid=time+dt*.5,e=Math.exp(-w*mid),yaw=(k.heading+(k.glideYawVelocity+w*k.heading)*mid)*e,previousSpeed=speed;
    const light=k.lightMode&&time<k.abilityTimer;
    speed+=(44*(light?k.abilitySpeedFactor:1)-speed)*Math.min(1,dt*.55*(light?k.accelMultiplier:1));
    if(time<k.boostTimer)speed=Math.min(44*(1+.0075*k.boostPower),speed+45*dt);
    const cap=Math.max(44*(light?k.abilitySpeedFactor:1),time<k.boostTimer?44*(1+.0075*k.boostPower):0)*(time<k.speedCapTimer?k.speedCapMultiplier:1);
    if(speed>cap)speed=Math.max(cap,speed-60*dt);
    const average=(previousSpeed+speed)*.5,rate=Math.max(1,average*Math.cos(yaw)),step=Math.min(dt,(remaining-forward)/rate);
    const oil=Math.max(0,k.oilTimer-time);slip*=Math.exp(-(4.5-Math.min(1,oil/.4)*3.9)*step);time+=step;
    lateral+=(average*Math.sin(yaw)+slip)*step;forward+=rate*step;
  }
  return lateral;
}
