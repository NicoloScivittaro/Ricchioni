import {Matrix,Quaternion,Mesh,MeshBuilder,Scene,StandardMaterial,Vector3,VertexData} from '@babylonjs/core';
import type {Material} from '@babylonjs/core';
import {EnvKit} from '../env/envKit';
import type {Xf} from '../env/envKit';
import type {TrackSpline} from './track';
import {EXPRESS,PORT_WET,SWEEPER_AT,TRACK_RAMPS,expressLateral,sweeperLateral} from './trackDynamics';

/** Surface strip conforms to banking/elevation, one mesh per material. */
function strip(scene:Scene,spline:TrackSpline,name:string,from:number,to:number,left:(s:number)=>number,right:(s:number)=>number,mat:Material):Mesh {
 const p:number[]=[],indices:number[]=[];const step=spline.totalLength/spline.sampleCount,first=Math.floor(from/step),last=Math.ceil(to/step),count=last-first;
 for(let i=0;i<=count;i++){const s=(first+i)*step;for(const lat of [left(s),right(s)]){const v=spline.worldPoint(s,lat,.055);p.push(v.x,v.y,v.z);}}
 for(let i=0;i<count;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 const mesh=new Mesh(name,scene),vd=new VertexData();vd.positions=p;vd.indices=indices;VertexData.ComputeNormals(p,indices,vd.normals=[]);vd.applyToMesh(mesh);mat.backFaceCulling=false;if(mat instanceof StandardMaterial)mat.twoSidedLighting=true;mesh.material=mat;mesh.isPickable=false;mesh.freezeWorldMatrix();return mesh;
}

/** Matrix instances use exactly the road frame, including slope and banking. */
function roadInstances(mesh:Mesh,spline:TrackSpline,entries:{s:number;up:number;width:number;depth:number}[]):void {
 const buffer=new Float32Array(entries.length*16);
 entries.forEach((e,i)=>{const tangent=spline.tangentAt(e.s),right=spline.rightAt(e.s),up=Vector3.Cross(tangent,right).normalize(),axes=Matrix.Identity();Matrix.FromXYZAxesToRef(right,up,tangent,axes);
  Matrix.Compose(new Vector3(e.width,1,e.depth),Quaternion.FromRotationMatrix(axes),spline.worldPoint(e.s,0,e.up)).copyToArray(buffer,i*16);
 });mesh.thinInstanceSetBuffer('matrix',buffer,16,true);mesh.thinInstanceRefreshBoundingInfo();mesh.isPickable=false;mesh.freezeWorldMatrix();
}

export function buildTrackSetPieces(scene:Scene,spline:TrackSpline):{update(time:number):void} {
 const kit=new EnvKit(scene),L=spline.totalLength;
 const steel=kit.mat('#12384c',{spec:.25}),gold=kit.mat('#ffc84c',{emissive:.1}),cyan=kit.mat('#38e0d8',{emissive:.5}),dark=kit.mat('#273c53',{spec:.2});
 const at=(f:number,lat=0,up=0)=>spline.worldPoint(f*L,lat,up);
 const sign=(f:number,text:string,color:string)=>{const p=at(f,0,7);kit.sign(text,{x:p.x,y:p.y,z:p.z,w:15,h:1.7,ry:spline.tangentAngleAt(f*L),color,bg:'#102c40',style:'neon',twoSided:true});};
 // Solid bridge decks, pier pairs, safety rails and bracket supports.
 const pier=MeshBuilder.CreateBox('viaductPiers',{width:1.6,height:1,depth:2},scene);pier.material=steel;const piers:Xf[]=[];
 const brace=MeshBuilder.CreateBox('viaductCrossbeams',{width:1,height:.65,depth:1.5},scene);brace.material=dark;const braces:Xf[]=[];
 for(let s=0;s<L;s+=22){const pos=spline.positionAt(s);if(pos.y<3)continue;const half=spline.widthAt(s)/2;
  for(const side of [-1,1]){const p=spline.worldPoint(s,side*(half-.8));piers.push({x:p.x,y:(p.y-1.8)/2-.6,z:p.z,sy:Math.max(1,p.y+.6),ry:spline.tangentAngleAt(s)});}
  braces.push({x:pos.x,y:pos.y-1,z:pos.z,sx:half*2,ry:spline.tangentAngleAt(s)});
 }kit.thin(pier,piers);kit.thin(brace,braces);kit.freeze(pier);kit.freeze(brace);
 // Safety light studs: thin instances, one draw call along the whole track.
 const stud=MeshBuilder.CreateBox('coastalRailLights',{width:.16,height:.1,depth:1.8},scene);stud.material=cyan;const studs:Xf[]=[];
 for(let s=0;s<L;s+=9)for(const side of [-1,1]){const p=spline.worldPoint(s,side*(spline.widthAt(s)/2+.15),1.04);studs.push({x:p.x,y:p.y,z:p.z,ry:spline.tangentAngleAt(s)});}kit.thin(stud,studs);kit.freeze(stud);
 for(const ramp of TRACK_RAMPS){
  const s=ramp.at*L;strip(scene,spline,'rampPaint',s-9,s+2,d=>-spline.widthAt(d)/2+.8,d=>spline.widthAt(d)/2-.8,gold);
  const ribs=MeshBuilder.CreateBox('rampRibs',{width:1,height:.08,depth:.3},scene);ribs.material=dark;const transforms:{s:number;up:number;width:number;depth:number}[]=[];
  for(let j=0;j<5;j++){const d=s-8+j*1.8;transforms.push({s:d,up:.12,width:spline.widthAt(d)-2,depth:1});}roadInstances(ribs,spline,transforms);sign(ramp.at-.018,ramp.name+' ↑','#ffc84c');
 }
 const wet=kit.mat('#325f78',{spec:.85,emissive:.02});strip(scene,spline,'wetPortSurface',PORT_WET[0]*L,PORT_WET[1]*L,d=>-spline.widthAt(d)/2+1,d=>spline.widthAt(d)/2-1,wet);sign(PORT_WET[0]-.018,'PORTO · ASFALTO BAGNATO','#71d4ff');
 const lane=(s:number)=>expressLateral(spline.widthAt(s));strip(scene,spline,'expressLane',EXPRESS[0]*L,EXPRESS[1]*L,s=>lane(s)-1.3,s=>lane(s)+1.3,cyan);
 strip(scene,spline,'splitterIsland',EXPRESS[0]*L,EXPRESS[1]*L,()=>-1.05,()=>1.05,gold);
 const separator=MeshBuilder.CreateBox('laneDivider',{width:1.5,height:.9,depth:1.8},scene);separator.material=steel;const separators:{s:number;up:number;width:number;depth:number}[]=[];
 for(let s=EXPRESS[0]*L;s<EXPRESS[1]*L;s+=3){const end=Math.min(s+3,EXPRESS[1]*L);separators.push({s:(s+end)/2,up:.45,width:1,depth:(end-s+.08)/1.8});}roadInstances(separator,spline,separators);sign(EXPRESS[0]-.02,'← TURBO STRETTO    |    SICURA →','#63fff0');
 // Loading crane: obstacle position below is also the collision position in trackDynamics.
 const s=SWEEPER_AT*L,side=spline.widthAt(s)/2+3,p=spline.worldPoint(s,side,0),angle=spline.tangentAngleAt(s);
 const tower=kit.box('loadingCraneTower',1.6,12,1.6,{x:p.x,y:p.y+6,z:p.z},gold);kit.freeze(tower);
 const beam=kit.box('loadingCraneBeam',side*2,1,1,{x:spline.positionAt(s).x,y:p.y+12,z:spline.positionAt(s).z,ry:angle},gold);kit.freeze(beam);
 const load=MeshBuilder.CreateBox('swingingCargo',{width:2.7,height:2.2,depth:3.4},scene);load.material=gold;load.isPickable=false;
 const cable=MeshBuilder.CreateCylinder('cargoCable',{diameter:.08,height:1,tessellation:6},scene);cable.material=steel;cable.isPickable=false;
 const warn=kit.mat('#ff704b',{emissive:.3});strip(scene,spline,'cargoWarning',s-4,s+4,d=>-spline.widthAt(d)/2+1,d=>spline.widthAt(d)/2-1,warn);sign(SWEEPER_AT-.025,'GRU MOBILE · CAMBIA CORSIA','#ffd166');
 // Landscaped infield under the new high promenade; large details remain batched.
 const pennant=MeshBuilder.CreateCylinder('coastalPennants',{diameterTop:0,diameterBottom:1.3,height:2,tessellation:3},scene);pennant.material=gold;const flags:Xf[]=[];
 for(let f=.03;f<1;f+=.026){const d=f*L,half=spline.widthAt(d)/2+2,q=spline.worldPoint(d,half,3);flags.push({x:q.x,y:q.y,z:q.z,ry:spline.tangentAngleAt(d)});}kit.thin(pennant,flags,['#ff714c','#36d8d4','#ffd567','#bda0ff']);kit.freeze(pennant);
 return{update(time:number){const q=spline.worldPoint(s,sweeperLateral(time,spline.widthAt(s)));load.position.copyFrom(q.add(new Vector3(0,1.1,0)));load.rotation.y=angle;
  const top=q.y+12;cable.position.set(q.x,(top+q.y+2.2)/2,q.z);cable.scaling.y=top-q.y-2.2;
 }};
}
