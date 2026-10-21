import{BoundingInfo,DynamicTexture,Mesh,MeshBuilder,Scene,StandardMaterial,Vector3}from'@babylonjs/core';
import'@babylonjs/core/Meshes/thinInstanceMesh';
import type{OrdaState}from'../../../shared/orda/types';
import{floorAt}from'../../../shared/orda/arena';
/** One tiny instanced draw per camera gives moving actors a soft grounding cue. */
export class OrdaContactShadows{
 private mesh:Mesh;private matrices=new Float32Array(32*16);private material:StandardMaterial;private texture:DynamicTexture;
 constructor(scene:Scene){
  const texture=this.texture=new DynamicTexture('orda-actor-contact',{width:64,height:64},scene,true),c=texture.getContext()as CanvasRenderingContext2D,g=c.createRadialGradient(32,32,3,32,32,31);g.addColorStop(0,'#00000075');g.addColorStop(.45,'#00000040');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,64,64);texture.hasAlpha=true;texture.update();
  const mat=this.material=new StandardMaterial('orda-actor-contact',scene);mat.diffuseTexture=texture;mat.useAlphaFromDiffuseTexture=true;mat.disableLighting=true;mat.alpha=.65;mat.freeze();
  const mesh=this.mesh=MeshBuilder.CreateGround('orda-actor-contacts',{width:1,height:1},scene);mesh.material=mat;mesh.layerMask=1;mesh.isPickable=false;mesh.alwaysSelectAsActiveMesh=true;mesh.thinInstanceSetBuffer('matrix',this.matrices,16,false);mesh.setBoundingInfo(new BoundingInfo(new Vector3(-23,-.1,-19),new Vector3(23,3.5,19)));mesh.doNotSyncBoundingInfo=true;mesh.setEnabled(false);
 }
 update(s:OrdaState):void{
  let count=0;const add=(x:number,z:number,r:number,y:number)=>{if(count>=32)return;const at=count++*16,floor=floorAt(x,z),size=r*Math.max(.5,1-Math.max(0,y-floor)*.15);this.matrices.set([size,0,0,0,0,1,0,0,0,0,size,0,x,floor+.017,z,1],at);};
  for(const e of s.enemies)add(e.x,e.z,e.radius*3.8,e.y);for(const p of s.players)if(p.alive)add(p.x,p.z,1.4,p.y);
  this.mesh.thinInstanceCount=count;this.mesh.setEnabled(count>0);if(count)this.mesh.thinInstanceBufferUpdated('matrix');
 }
 dispose():void{this.mesh.dispose();this.material.dispose();this.texture.dispose();}
}
