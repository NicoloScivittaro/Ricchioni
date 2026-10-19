import {Color3,MeshBuilder,StandardMaterial,Vector3} from '@babylonjs/core';
import type {Mesh,Scene} from '@babylonjs/core';

export interface EnergyLaunch {id:number;ox:number;oy:number;oz:number;dx:number;dy:number;dz:number;speed:number;range:number}
export interface EnergyImpact {id:number;x:number;y:number;z:number;r:number}
/** Shared bounded pool for all TV cameras or one phone. Geometry never grows with shots. */
export class FpsEnergyFx {
  private bolts:{mesh:Mesh;id:number;dx:number;dy:number;dz:number;speed:number;left:number}[]=[];
  private impacts:{mesh:Mesh;life:number;radius:number}[]=[];
  private cursor=0;private impactCursor=0;
  constructor(scene:Scene){
    const material=new StandardMaterial('rayEnergy',scene);
    material.disableLighting=true;material.emissiveColor=new Color3(.28,1,.055);
    material.diffuseColor=Color3.Black();material.backFaceCulling=false;material.freeze();
    for(let i=0;i<32;i++){
      const mesh=MeshBuilder.CreateTorus('rayBolt',{diameter:.32,thickness:.075,tessellation:12},scene);
      // Torus normal is +Y; local +Z follows its direction of travel.
      mesh.rotation.x=Math.PI/2;mesh.bakeCurrentTransformIntoVertices();mesh.rotation.setAll(0);
      mesh.material=material;mesh.isVisible=false;mesh.isPickable=false;
      this.bolts.push({mesh,id:-1,dx:0,dy:0,dz:1,speed:0,left:0});
    }
    for(let i=0;i<8;i++){
      const mesh=MeshBuilder.CreateTorus('rayImpact',{diameter:2,thickness:.07,tessellation:20},scene);
      mesh.material=material;mesh.isVisible=false;mesh.isPickable=false;
      this.impacts.push({mesh,life:0,radius:0});
    }
  }
  launch(p:EnergyLaunch):void {
    const b=this.bolts[this.cursor++%this.bolts.length];Object.assign(b,{id:p.id,dx:p.dx,dy:p.dy,dz:p.dz,speed:p.speed,left:p.range});
    // Visual starts ahead of the eye to avoid covering the shooter's screen.
    const offset=Math.min(.9,p.range);b.left-=offset;
    b.mesh.position.set(p.ox+p.dx*offset,p.oy+p.dy*offset,p.oz+p.dz*offset);
    b.mesh.lookAt(new Vector3(p.ox+p.dx*2,p.oy+p.dy*2,p.oz+p.dz*2));b.mesh.isVisible=true;
  }
  impact(p:EnergyImpact):void {
    const b=this.bolts.find(b=>b.id===p.id);if(b){b.left=0;b.mesh.isVisible=false;b.id=-1;}
    if(p.r<=0)return;
    const a=this.impacts[this.impactCursor++%this.impacts.length];a.life=.32;a.radius=p.r;
    a.mesh.position.set(p.x,p.y,p.z);a.mesh.scaling.setAll(.15);a.mesh.visibility=1;a.mesh.isVisible=true;
  }
  update(dt:number):void {
    for(const b of this.bolts)if(b.left>0){const d=Math.min(b.left,b.speed*dt);b.left-=d;b.mesh.position.x+=b.dx*d;b.mesh.position.y+=b.dy*d;b.mesh.position.z+=b.dz*d;if(b.left<=0)b.mesh.isVisible=false;}
    for(const a of this.impacts)if(a.life>0){a.life=Math.max(0,a.life-dt);a.mesh.scaling.setAll((1-a.life/.32)*a.radius+.15);a.mesh.visibility=a.life/.32;if(!a.life)a.mesh.isVisible=false;}
  }
}
