import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';

/** Piccoli oggetti composti, materiali riusati dal manager, nessun sistema particellare per item. */
export class KartItemVisuals {
  private mats = new Map<string, StandardMaterial>();
  constructor(private scene: Scene) {}
  material(color: string, glow = .15): StandardMaterial {
    const key=color+glow;let m=this.mats.get(key);
    if(!m){m=new StandardMaterial('item'+key,this.scene);m.diffuseColor=Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.scale(glow);m.specularColor=new Color3(.6,.6,.6);this.mats.set(key,m);}
    return m;
  }
  object(kind: 'piccione'|'paraurti'|'turbo_difettoso'|'mollone'|'calamita'): Mesh {
    const root=new Mesh('item-'+kind,this.scene);root.isPickable=false;
    const part=(mesh:Mesh,color:string,x=0,y=0,z=0)=>{mesh.parent=root;mesh.material=this.material(color);mesh.position.set(x,y,z);mesh.isPickable=false;return mesh;};
    const box=(name:string,w:number,h:number,d:number,c:string,x=0,y=0,z=0)=>part(MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},this.scene),c,x,y,z);
    const sphere=(name:string,d:number,c:string,x=0,y=0,z=0)=>part(MeshBuilder.CreateSphere(name,{diameter:d,segments:8},this.scene),c,x,y,z);
    switch(kind){
      case 'piccione':
        sphere('birdBody',.65,'#8994aa').scaling.set(.8,.8,1.3);sphere('birdHead',.38,'#9ca9c4',0,.24,.4);
        box('birdBeak',.16,.12,.25,'#ffac32',0,.22,.65);
        for(const side of [-1,1]){const wing=box('birdWing',.75,.06,.42,'#b8c6dd',side*.55,.1,0);wing.rotation.z=side*.2;}
        break;
      case 'paraurti':
        box('bumperFront',2.25,.32,.26,'#ffc24d',0,.38,1.4);box('bumperBack',2.25,.32,.26,'#ffc24d',0,.38,-1.3);
        for(const side of [-1,1]) box('bumperSide',.24,.3,2.6,'#ffad24',side*1.05,.38,0);
        for(const x of [-.7,0,.7])box('bumperStripe',.24,.34,.29,'#262433',x,.38,1.4).rotation.z=.35;
        break;
      case 'turbo_difettoso':
        for(const side of [-1,1]){const rocket=part(MeshBuilder.CreateCylinder('faultyRocket',{height:1.15,diameter:.35,tessellation:8},this.scene),'#ff6533',side*.7,.7,-.7);rocket.rotation.x=Math.PI/2;
          sphere('rocketFlame',.38,'#ffe031',side*.7,.7,-1.4).scaling.z=2;}
        break;
      case 'mollone': {
        const path=Array.from({length:49},(_,i)=>new Vector3(Math.cos(i/48*Math.PI*8)*.38,i/48*.65,Math.sin(i/48*Math.PI*8)*.38));
        part(MeshBuilder.CreateTube('spring',{path,radius:.065,tessellation:6},this.scene),'#7cf3ba',0,-.6,0);break;
      }
      case 'calamita':
        box('magnetBase',1,.18,.18,'#e352cf',0,1,-.5);
        for(const side of [-1,1]){box('magnetArm',.2,.18,.65,'#e352cf',side*.4,1,-.25);box('magnetTip',.2,.18,.15,'#e3f2ff',side*.4,1,.1);}break;
    }
    return root;
  }
  dispose():void {for(const mat of this.mats.values())mat.dispose();this.mats.clear();}
}
