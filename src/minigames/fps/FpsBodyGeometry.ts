/** Double-sided prop triangles. Separate from shot geometry so ballistic cover rules stay intact. */
export class FpsBodyGeometry{
 private cells=new Map<string,number[]>();
 constructor(private triangles:Float32Array){
  if(triangles.length%9)throw new Error('Geometria collisioni FPS incompleta');
  for(let i=0;i<triangles.length;i+=9){const t=triangles;for(let x=Math.floor(Math.min(t[i],t[i+3],t[i+6])/3);x<=Math.floor(Math.max(t[i],t[i+3],t[i+6])/3);x++)for(let z=Math.floor(Math.min(t[i+2],t[i+5],t[i+8])/3);z<=Math.floor(Math.max(t[i+2],t[i+5],t[i+8])/3);z++){const key=x+':'+z,list=this.cells.get(key)??[];list.push(i);this.cells.set(key,list);}}
 }
 ray(ox:number,oy:number,oz:number,dx:number,dy:number,dz:number,max:number):number{
  let best=max;const tested=new Set<number>(),t=this.triangles;
  const test=(x:number,z:number)=>{for(const i of this.cells.get(x+':'+z)??[]){if(tested.has(i))continue;tested.add(i);
   const ax=t[i+3]-t[i],ay=t[i+4]-t[i+1],az=t[i+5]-t[i+2],bx=t[i+6]-t[i],by=t[i+7]-t[i+1],bz=t[i+8]-t[i+2];
   const px=dy*bz-dz*by,py=dz*bx-dx*bz,pz=dx*by-dy*bx,det=ax*px+ay*py+az*pz;if(Math.abs(det)<1e-9)continue;
   const inv=1/det,tx=ox-t[i],ty=oy-t[i+1],tz=oz-t[i+2],u=(tx*px+ty*py+tz*pz)*inv;if(u<-.00001||u>1.00001)continue;
   const qx=ty*az-tz*ay,qy=tz*ax-tx*az,qz=tx*ay-ty*ax,v=(dx*qx+dy*qy+dz*qz)*inv;if(v<-.00001||u+v>1.00001)continue;
   const distance=(bx*qx+by*qy+bz*qz)*inv;if(distance>=.00001&&distance<best)best=distance;
  }};
  let x=Math.floor(ox/3),z=Math.floor(oz/3),distance=0;const sx=Math.sign(dx),sz=Math.sign(dz),strideX=dx?3/Math.abs(dx):Infinity,strideZ=dz?3/Math.abs(dz):Infinity;
  let nextX=dx?((x+(dx>0?1:0))*3-ox)/dx:Infinity,nextZ=dz?((z+(dz>0?1:0))*3-oz)/dz:Infinity;
  while(distance<=best){test(x,z);if(!dx&&!dz)break;if(nextX<nextZ){distance=nextX;nextX+=strideX;x+=sx;}else{distance=nextZ;nextZ+=strideZ;z+=sz;}}return best;
 }
}
