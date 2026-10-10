/** Soccer presentation only. All coordinates are GUI pixels at idealHeight=720. */
export interface LabelRect { x: number; y: number; w: number; h: number }
export interface LabelAnchor { id: string; x: number; y: number; w: number; h: number }
export interface LabelPlacement extends LabelRect { id: string; dx: number; dy: number; visible: boolean }
export function labelOverlap(a: LabelRect, b: LabelRect, gap = 0): boolean {
  return a.x < b.x+b.w+gap && a.x+a.w+gap > b.x && a.y < b.y+b.h+gap && a.y+a.h+gap > b.y;
}
/** Fixed small grid avoids the old five-card vertical tower. Previous offsets add hysteresis. */
export function layoutSoccerLabels(anchors: readonly LabelAnchor[], protectedRects: readonly LabelRect[], bounds: LabelRect,
  previous: ReadonlyMap<string, {dx:number;dy:number}> = new Map()): LabelPlacement[] {
  const placed: LabelPlacement[] = [];
  // Small fixed steps keep a long nickname from pushing every other label far away.
  const stride = 40;
  for (const a of [...anchors].sort((a,b)=>a.id.localeCompare(b.id))) {
    const old=previous.get(a.id);
    const candidates:{dx:number;dy:number}[]=[];
    if(old)candidates.push(old);
    for (let row=0;row<5;row++) for(const column of [0,-1,1,-2,2,-3,3,-4,4]) candidates.push({dx:column*stride,dy:-row*(a.h+4)});
    // A label may pass a goal above or at its side, never on the net/mouth or the ball.
    let best:LabelPlacement|undefined, score=Infinity;
    for(const offset of candidates) {
      const r={id:a.id,x:a.x+offset.dx-a.w/2,y:a.y+offset.dy-a.h/2,w:a.w,h:a.h,dx:offset.dx,dy:offset.dy,visible:true};
      if(r.x<bounds.x||r.x+r.w>bounds.x+bounds.w||r.y<bounds.y||r.y+r.h>bounds.y+bounds.h)continue;
      if(protectedRects.some(p=>labelOverlap(r,p,2))||placed.some(p=>p.visible&&labelOverlap(r,p,4)))continue;
      const cost=Math.hypot(offset.dx,offset.dy*3)+(old?Math.hypot(offset.dx-old.dx,offset.dy-old.dy)*.2:0);
      if(cost<score){best=r;score=cost;}
    }
    // No opaque fallback placed on the action if the safe region is genuinely exhausted.
    placed.push(best??{id:a.id,x:a.x-a.w/2,y:a.y-a.h/2,w:a.w,h:a.h,dx:0,dy:0,visible:false});
  }
  return placed;
}
