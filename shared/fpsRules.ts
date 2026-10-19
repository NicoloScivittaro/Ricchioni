/** Shared authoritative FPS rules and body dimensions (metres). */
export const FPS_KILL_TARGET = 10;
export const FPS_BODY = {standing:1.8,crouched:1.05,eye:1.5,crouchEye:.86,crouchSpeed:.52,jumpSpeed:6.2,gravity:18} as const;
export interface FpsVerticalBody {y:number;verticalSpeed:number;grounded:boolean}
/** Analytic integration keeps the jump independent of the simulation frame rate. */
export function stepFpsVertical(p:FpsVerticalBody,dt:number,floor:number,ceiling:number,height:number):void {
  if(p.grounded){p.y=floor;p.verticalSpeed=0;return;}
  const next=p.y+p.verticalSpeed*dt-.5*FPS_BODY.gravity*dt*dt;
  p.verticalSpeed-=FPS_BODY.gravity*dt;
  p.y=Math.min(next,Math.max(floor,ceiling-height));
  if(p.y<next&&p.verticalSpeed>0)p.verticalSpeed=0;
  if(p.verticalSpeed<=0&&p.y<=floor+.002){p.y=floor;p.verticalSpeed=0;p.grounded=true;}
}
