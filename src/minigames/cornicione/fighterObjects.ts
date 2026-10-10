import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode } from '@babylonjs/core';
import type { Geometry } from '@babylonjs/core';
import type { Fighter, FighterProjectile } from './fighterTypes';

export const OBJECT_SKINS: Readonly<Record<string, { name: string; color: string; effect: 'coins' | 'splash' | 'foam' | 'glass' }>> = {
  ciro: { name: 'MONETE', color: '#ffd34f', effect: 'coins' },
  judoka: { name: 'GRANITA', color: '#ee53c6', effect: 'splash' },
  buttafuori: { name: 'BIRRA', color: '#fff3cc', effect: 'foam' },
  goblin: { name: 'JÄGERMEISTER', color: '#50cf6d', effect: 'glass' },
  dottore: { name: 'SHAKER PROTEICO', color: '#d9b993', effect: 'splash' }
};
interface Prop { root: TransformNode; pieces: Mesh[]; characterId: string }
interface Fragment { mesh: Mesh; t: number; vx: number; vy: number; vz: number; effect: string }

/** Bounded cosmetic pools: five held/flying props and sixty short-lived impact fragments. No physics. */
export class FighterObjects {
  private props = new Map<string, Prop>();
  private fragments: Fragment[] = [];
  private materials: StandardMaterial[] = [];
  private textures: DynamicTexture[] = [];
  private fragmentShapes = new Map<string, Geometry>();
  private shapeTemplates: Mesh[] = [];
  private gold: StandardMaterial;
  private white: StandardMaterial;
  private green: StandardMaterial;
  private pink: StandardMaterial;
  private tan: StandardMaterial;

  constructor(private scene: Scene, actors: { id: string; characterId: string }[]) {
    this.gold = this.mat('coinGold', '#fbc538');
    this.white = this.mat('foamWhite', '#fff6e6');
    this.green = this.mat('bottleGreen', '#16763a');
    this.pink = this.mat('granitaPink', '#ec4abd');
    this.tan = this.mat('proteinTan', '#d9b993');
    for (const [kind, mesh] of [
      ['coins',MeshBuilder.CreateCylinder('fragmentCoin',{height:1,diameter:1,tessellation:12},scene)],
      ['splash',MeshBuilder.CreateSphere('fragmentDrop',{diameter:1,segments:4},scene)],
      ['glass',MeshBuilder.CreateBox('fragmentGlass',{size:1},scene)]
    ] as const) {
      this.fragmentShapes.set(kind,mesh.geometry!);mesh.setEnabled(false);this.shapeTemplates.push(mesh);
    }
    for (const actor of actors) this.props.set(actor.id, this.makeProp(actor.characterId));
    for (let i=0;i<60;i++) {
      const mesh = MeshBuilder.CreateBox('objectFragment', { size: 1 }, scene);
      mesh.isPickable = false; mesh.setEnabled(false);
      this.fragments.push({mesh,t:0,vx:0,vy:0,vz:0,effect:'splash'});
    }
  }

  private mat(name: string, color: string): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(color); m.emissiveColor = m.diffuseColor.scale(.25);
    m.specularColor = Color3.White().scale(.25); this.materials.push(m); return m;
  }

  private label(text: string, bg: string, fg: string): StandardMaterial {
    const t = new DynamicTexture(`objectLabel_${text}`, {width:256,height:128}, this.scene, false);
    const c = t.getContext() as unknown as CanvasRenderingContext2D;
    c.fillStyle=bg; c.fillRect(0,0,256,128); c.fillStyle=fg;
    c.font='bold 32px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(text,128,64,240); t.update();
    this.textures.push(t); const m=this.mat(`objectLabelMat_${text}`,bg); m.diffuseTexture=t; m.emissiveTexture=t; return m;
  }

  private makeProp(characterId: string): Prop {
    const root=new TransformNode(`cornicioneObject_${characterId}`,this.scene), pieces:Mesh[]=[];
    const cylinder=(h:number,top:number,bottom:number,mat:StandardMaterial,y=0):Mesh=>{
      const mesh=MeshBuilder.CreateCylinder('objectPart',{height:h,diameterTop:top,diameterBottom:bottom,tessellation:12},this.scene);
      mesh.parent=root;mesh.material=mat;mesh.position.y=y;mesh.isPickable=false;pieces.push(mesh);return mesh;
    };
    const label=(text:string,bg:string,fg:string,y=0,w=.38,h=.25):void=>{
      const mesh=MeshBuilder.CreatePlane('objectLabel',{width:w,height:h},this.scene);
      mesh.parent=root;mesh.position.set(0,y,-.27);mesh.material=this.label(text,bg,fg);mesh.isPickable=false;pieces.push(mesh);
    };
    if(characterId==='ciro') {
      for(let i=0;i<7;i++){const c=cylinder(.055,.28,.28,this.gold);c.rotation.x=Math.PI/2;c.position.set((i%3-1)*.19,(Math.floor(i/3)-1)*.16,(i%2)*.055);}
    } else if(characterId==='judoka') {
      cylinder(.62,.51,.32,this.white);cylinder(.20,.49,.49,this.pink,.24);
      const straw=cylinder(.48,.045,.045,this.white,.52);straw.position.x=.12;straw.rotation.z=-.25;
      label('GRANITA','#ec4abd','#ffffff',-.08);
    } else if(characterId==='buttafuori') {
      cylinder(.72,.46,.46,this.gold);cylinder(.05,.47,.47,this.white,.38);cylinder(.04,.47,.47,this.white,-.38);
      label('BIRRA','#f2b934','#392400');
    } else if(characterId==='dottore') {
      cylinder(.70,.52,.43,this.tan);cylinder(.14,.55,.55,this.white,.40);
      const cap=cylinder(.10,.18,.18,this.white,.52);cap.position.x=.12;
      label('PROTEINE','#242f43','#ffffff');
    } else {
      cylinder(.58,.43,.43,this.green,-.08);cylinder(.20,.18,.40,this.green,.30);cylinder(.18,.17,.17,this.green,.48);
      cylinder(.07,.20,.20,this.gold,.60);label('JÄGER','#d45127','#ffffff',-.04);
    }
    root.setEnabled(false);return {root,pieces,characterId};
  }

  impact(p: FighterProjectile, burst: boolean): void {
    if (!burst) return;
    const skin=OBJECT_SKINS[p.characterId]??OBJECT_SKINS.goblin;
    for(let i=0;i<12;i++) {
      const f=this.fragments.find(f=>f.t<=0);if(!f)break;
      const a=i*Math.PI*2/12;
      f.t=.45;f.effect=skin.effect;f.vx=Math.cos(a)*(2.2+(i%3));f.vy=Math.sin(a)*3+2;f.vz=(i%3-1)*1.2;
      f.mesh.position.set(p.x,p.y,-.4);f.mesh.setEnabled(true);
      this.fragmentShapes.get(skin.effect==='foam'?'splash':skin.effect)!.applyToMesh(f.mesh);
      f.mesh.material=skin.effect==='coins'?this.gold:skin.effect==='foam'?this.white:skin.effect==='glass'?this.green:p.characterId==='judoka'?this.pink:this.tan;
      f.mesh.scaling.set(.18,skin.effect==='coins'?.035:skin.effect==='glass'?.22:.13,.18);
      f.mesh.rotation.set(skin.effect==='coins'?Math.PI/2:0,0,0);f.mesh.visibility=1;
    }
  }

  update(fighters: readonly Fighter[], projectiles: readonly FighterProjectile[], dt: number): void {
    for(const [id, prop] of this.props) {
      const p=projectiles.find(p=>p.owner===id), f=fighters.find(f=>f.id===id);
      const held=f?.objectThrow;
      const on=!!p||!!held&&!!f&&!f.dead&&f.inGame;
      prop.root.setEnabled(on);if(!on)continue;
      if(p){prop.root.position.set(p.x,p.y,-.35);prop.root.rotation.z=-p.age*(prop.characterId==='buttafuori'?15:9)*Math.sign(p.dx||1);}
      else if(f&&held){prop.root.position.set(f.x+held.dx*.85,f.y+1.25+held.dy*.5,-.35);prop.root.rotation.z=held.dx>0?-.2:.2;}
      // Charge readability without touching the common projectile collider.
      const scale=p?1:1+.18*(held?.charge??0);prop.root.scaling.setAll(scale);
    }
    for(const f of this.fragments){if(f.t<=0)continue;f.t-=dt;
      if(f.t<=0){f.mesh.setEnabled(false);continue;}
      f.mesh.position.x+=f.vx*dt;f.mesh.position.y+=f.vy*dt;f.mesh.position.z+=f.vz*dt;f.vy-=10*dt;
      f.mesh.rotation.z+=dt*8;f.mesh.visibility=Math.min(1,f.t/.18);
    }
  }

  dispose(): void {
    for(const p of this.props.values())p.root.dispose();this.props.clear();
    for(const f of this.fragments)f.mesh.dispose();this.fragments=[];
    for(const m of this.shapeTemplates)m.dispose();this.shapeTemplates=[];this.fragmentShapes.clear();
    for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();
  }
}
