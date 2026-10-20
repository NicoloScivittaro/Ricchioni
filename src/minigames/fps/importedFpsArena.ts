import type {Aabb} from '../../../shared/fpsMap';
export interface FpsArenaPoint {x:number;z:number;y?:number;eyeHeight?:number;crouching?:boolean}
/** Structural contract shared by imported FPS arenas; rendering stays separate. */
export interface ImportedFpsArena {
 raySurface?:import('../../../shared/fpsCombat').FpsSurface;
 name:string;halfSize:number;obstacles:Aabb[];spawns:FpsArenaPoint[];nav:FpsArenaPoint[];
 floorAt(x:number,z:number,y?:number):number|null;
 isClear(x:number,z:number,r?:number,y?:number):boolean;
 move(from:FpsArenaPoint,to:FpsArenaPoint,height?:number):FpsArenaPoint;
 moveAir?(from:FpsArenaPoint,to:FpsArenaPoint,height:number):FpsArenaPoint;
 floorBelow?(x:number,z:number,y:number):number|null;
 headroomAt?(x:number,z:number,y:number):number;
 ray(ox:number,oy:number,oz:number,dx:number,dy:number,dz:number,max:number):number;
 visible(p:FpsArenaPoint,q:FpsArenaPoint):boolean;
 blastVisible(origin:{x:number;y:number;z:number},target:FpsArenaPoint):boolean;
 canTraverse(p:FpsArenaPoint,q:FpsArenaPoint):boolean;
 nextWaypoint(p:FpsArenaPoint,q:FpsArenaPoint):FpsArenaPoint;
}
