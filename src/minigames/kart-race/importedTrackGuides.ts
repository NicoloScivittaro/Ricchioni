import {Color3,Mesh,MeshBuilder,StandardMaterial,Vector3} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import type {TrackSpline} from './track';
import type {PhysicalTrackData} from './importedTrackCollision';
import {detectCurves} from './trackGuides';
import type {KartState} from './raceTypes';

/** Restrained painted arrows and a visible closure of the non-racing pit bays.
 * These meshes use exactly the footprint added to the physical edge data. */
export function buildImportedTrackGuides(scene:Scene,track:TrackSpline,cps:number[],physical?:PhysicalTrackData,paintColor='#eee8c8'):void{
  const white=new StandardMaterial('importedPaint',scene);white.diffuseColor=Color3.FromHexString(paintColor);white.emissiveColor=white.diffuseColor.scale(.15);white.backFaceCulling=false;
  const parts:Mesh[]=[];
  const arrows=[...cps.map(s=>track.wrap(s+9)),...detectCurves(track).flatMap(c=>[track.wrap(c.s0+5),track.wrap(c.sApex)])].sort((a,b)=>a-b).filter((s,i,list)=>i===0||s-list[i-1]>10);
  for(const s of arrows.filter(s=>track.hasRoadAt(s))){
    const p=track.worldPoint(s,0,.07),right=track.rightAt(s),forward=track.tangentAt(s);
    const mesh=new Mesh('paintedRouteArrow',scene),verts=[-.8,0,-1.8,.8,0,-1.8,.8,0,.2,1.7,0,.2,0,0,2,-1.7,0,.2,-.8,0,.2];
    for(let i=0;i<verts.length;i+=3){const point=p.add(right.scale(verts[i])).add(forward.scale(verts[i+2]));verts[i]=point.x;verts[i+1]=point.y;verts[i+2]=point.z;}
    mesh.setVerticesData('position',verts);mesh.setIndices([0,1,2,0,2,6,6,2,3,6,3,4,6,4,5]);mesh.createNormals(false);mesh.material=white;parts.push(mesh);
  }
  const merged=Mesh.MergeMeshes(parts,true,true);if(merged){merged.name='importedPaintedArrows';merged.material=white;merged.isPickable=false;merged.freezeWorldMatrix();}
  if(physical){
    const yellow=new StandardMaterial('importedPitBarrier',scene);yellow.diffuseColor=Color3.FromHexString('#e8bb33');yellow.specularColor.setAll(.05);
    const dark=new StandardMaterial('importedPitStripe',scene);dark.diffuseColor=Color3.FromHexString('#252a2c');
    for(const b of physical.barriers){
      const mesh=MeshBuilder.CreateBox('visiblePitClosure',{width:b.w,height:b.h,depth:b.d},scene);mesh.position.set(b.x,b.h/2,b.z);mesh.material=yellow;mesh.isPickable=false;mesh.freezeWorldMatrix();
      for(const y of [.5,1.65]){const stripe=MeshBuilder.CreateBox('pitClosureStripe',{width:b.w+.012,height:.22,depth:b.d+.012},scene);stripe.position.set(b.x,y,b.z);stripe.material=dark;stripe.isPickable=false;stripe.freezeWorldMatrix();}
    }
  }
}

/** Opt-in DEV geometry. No diagnostics are created in production builds. */
export function showImportedTrackDebug(scene:Scene,track:TrackSpline,cps:number[],physical?:PhysicalTrackData,getBots?:()=>KartState[]):void{
  if(!import.meta.env.DEV||typeof window==='undefined'||new URLSearchParams(window.location.search).get('trackDebug')!=='1')return;
  const route=[];for(let s=0;s<=track.totalLength;s+=2)route.push(track.worldPoint(s,0,track.flightHeightAt(s)+.35));
  const spline=MeshBuilder.CreateLines('DEV_route',{points:route},scene);spline.color=Color3.Green();
  const gates=cps.flatMap(s=>[[track.worldPoint(s,-track.widthAt(s)/2,.6),track.worldPoint(s,track.widthAt(s)/2,.6)],[track.worldPoint(s,0,.6),track.worldPoint(s+4,0,.6)]]);
  const checkpoints=MeshBuilder.CreateLineSystem('DEV_checkpoints_respawn',{lines:gates},scene);checkpoints.color=new Color3(0,1,1);
  const widths:Vector3[][]=[];for(let s=0;s<track.totalLength;s+=15)if(track.hasRoadAt(s))widths.push([track.worldPoint(s,-track.widthAt(s)/2,.2),track.worldPoint(s,track.widthAt(s)/2,.2)]);
  const corridor=MeshBuilder.CreateLineSystem('DEV_driveableCorridor',{lines:widths},scene);corridor.color=new Color3(.3,.6,.3);
  if(getBots){
    const trails=new Map<string,{points:Vector3[];mesh:ReturnType<typeof MeshBuilder.CreateLines>}>();let last=0;
    scene.onBeforeRenderObservable.add(()=>{
      const now=performance.now();if(now-last<150)return;last=now;
      for(const k of getBots()){
        const p=track.worldPoint(k.distance,k.lateral,k.jumpHeight+.8);let trail=trails.get(k.playerId);
        if(!trail){const points=Array.from({length:64},()=>p.clone()),mesh=MeshBuilder.CreateLines('DEV_botTrail',{points,updatable:true},scene);mesh.color=Color3.Yellow();trails.set(k.playerId,trail={points,mesh});}
        trail.points.shift();trail.points.push(p);MeshBuilder.CreateLines('DEV_botTrail',{points:trail.points,instance:trail.mesh},scene);
      }
    });
  }
  if(physical){
    const lines=physical.segments.map(s=>[new Vector3(s[0],.2,s[1]),new Vector3(s[2],.2,s[3])]);
    for(const t of physical.triangles??[])lines.push([new Vector3(t[0],t[1],t[2]),new Vector3(t[3],t[4],t[5]),new Vector3(t[6],t[7],t[8]),new Vector3(t[0],t[1],t[2])]);
    if(lines.length){const collisions=MeshBuilder.CreateLineSystem('DEV_actualCollisions',{lines},scene);collisions.color=Color3.Red();}
  }
}
