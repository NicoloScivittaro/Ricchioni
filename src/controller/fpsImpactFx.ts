import {Color3,Matrix,Mesh,MeshBuilder,Quaternion,StandardMaterial,Vector3} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import type {SurfaceImpact} from '../../shared/fpsCombat';
/** One instanced draw per visible camera; fixed CPU/GPU budget for the entire scene. */
export class FpsImpactFx {
 readonly mesh:Mesh;private matrices=new Float32Array(48*16);private colors=new Float32Array(48*4);
 private slots=Array.from({length:48},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,max:1,size:.03}));private cursor=0;private matrix=Matrix.Identity();private scale=new Vector3();private pos=new Vector3();private rotation=Quaternion.Identity();private dirty=false;
 constructor(scene:Scene){for(let i=0;i<48;i++)this.matrices[i*16+15]=1;this.mesh=MeshBuilder.CreateBox('fpsSurfaceImpactPool',{size:1},scene);const m=new StandardMaterial('fpsImpactMaterial',scene);m.disableLighting=true;m.emissiveColor=Color3.White();m.diffuseColor=Color3.Black();this.mesh.material=m;this.mesh.isPickable=false;this.mesh.isVisible=false;this.mesh.alwaysSelectAsActiveMesh=true;
 this.mesh.thinInstanceSetBuffer('matrix',this.matrices,16,false);this.mesh.thinInstanceSetBuffer('color',this.colors,4,false);}
 emit(hit:SurfaceImpact):void{
  const color=hit.surface==='metal'?[1,.69,.22]:hit.surface==='wood'?[.66,.42,.21]:hit.surface==='glass'?[.64,.87,.94]:[.55,.53,.49];
  for(let n=0;n<4;n++){const i=this.cursor++%this.slots.length,s=this.slots[i];s.x=hit.x+hit.nx*.035;s.y=hit.y+hit.ny*.035;s.z=hit.z+hit.nz*.035;s.life=s.max=hit.surface==='metal'?.16:.24;s.size=hit.surface==='glass'?.035:.025+n*.008;
   s.vx=hit.nx*1.3+(Math.random()-.5)*1.3;s.vy=hit.ny*1.3+Math.random()*1.6;s.vz=hit.nz*1.3+(Math.random()-.5)*1.3;this.colors.set([...color,1],i*4);
  }this.dirty=true;this.mesh.isVisible=true;
 }
 update(dt:number):void{let active=false;for(let i=0;i<this.slots.length;i++){const s=this.slots[i];if(s.life<=0)continue;active=true;s.life=Math.max(0,s.life-dt);s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;s.vy-=3*dt;const k=s.life/s.max;this.scale.setAll(s.size*Math.sqrt(k));this.pos.set(s.x,s.y,s.z);Matrix.ComposeToRef(this.scale,this.rotation,this.pos,this.matrix);this.matrix.copyToArray(this.matrices,i*16);}
 this.mesh.isVisible=active||this.dirty;
 if(active||this.dirty){this.mesh.thinInstanceBufferUpdated('matrix');if(this.dirty)this.mesh.thinInstanceBufferUpdated('color');this.dirty=false;}}
}
