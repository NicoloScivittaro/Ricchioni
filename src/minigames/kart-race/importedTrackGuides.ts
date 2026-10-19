import {Color3,DynamicTexture,Mesh,MeshBuilder,StandardMaterial,Vector3} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import type {TrackSpline} from './track';
import type {PhysicalTrackData} from './importedTrackCollision';
import {detectCurves} from './trackGuides';

/** Restrained painted arrows and a visible closure of the non-racing pit bays.
 * These meshes use exactly the footprint added to the physical edge data. */
export function buildImportedTrackGuides(scene:Scene,track:TrackSpline,cps:number[],physical?:PhysicalTrackData):void{
  const white=new StandardMaterial('importedPaint',scene);white.diffuseColor=Color3.FromHexString('#eee8c8');white.emissiveColor=new Color3(.15,.15,.13);white.backFaceCulling=false;
  const parts:Mesh[]=[];
  const arrows=[...cps.map(s=>track.wrap(s+9)),...detectCurves(track).flatMap(c=>[track.wrap(c.s0+5),track.wrap(c.sApex)])].sort((a,b)=>a-b).filter((s,i,list)=>i===0||s-list[i-1]>10);
  for(const s of arrows){
    const p=track.worldPoint(s,0,.07),yaw=track.tangentAngleAt(s);
    const mesh=new Mesh('paintedRouteArrow',scene),verts=[-.8,0,-1.8,.8,0,-1.8,.8,0,.2,1.7,0,.2,0,0,2,-1.7,0,.2,-.8,0,.2];
    mesh.setVerticesData('position',verts);mesh.setIndices([0,1,2,0,2,6,6,2,3,6,3,4,6,4,5]);mesh.createNormals(false);mesh.position=p;mesh.rotation.y=yaw;mesh.material=white;parts.push(mesh);
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
export function showImportedTrackDebug(scene:Scene,track:TrackSpline,cps:number[],physical?:PhysicalTrackData):void{
  if(!import.meta.env.DEV||typeof window==='undefined'||new URLSearchParams(window.location.search).get('trackDebug')!=='1')return;
  const route=[];for(let s=0;s<=track.totalLength;s+=2)route.push(track.worldPoint(s,0,.35));
  const spline=MeshBuilder.CreateLines('DEV_route',{points:route},scene);spline.color=Color3.Green();
  const gates=cps.map(s=>[track.worldPoint(s,-track.widthAt(s)/2,.6),track.worldPoint(s,track.widthAt(s)/2,.6)]);
  const checkpoints=MeshBuilder.CreateLineSystem('DEV_checkpoints_respawn',{lines:gates},scene);checkpoints.color=Color3.Cyan();
  if(physical){const lines=physical.segments.map(s=>[new Vector3(s[0],.2,s[1]),new Vector3(s[2],.2,s[3])]);const collisions=MeshBuilder.CreateLineSystem('DEV_actualCollisions',{lines},scene);collisions.color=Color3.Red();}
}
