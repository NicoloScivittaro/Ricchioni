import {AssetContainer,Color3,DynamicTexture,LoadAssetContainerAsync,Mesh,MeshBuilder,PBRMaterial,Scene,StandardMaterial,TransformNode,UniversalCamera,Vector3}from'@babylonjs/core';
import {RemoteWeaponModel}from'../../controller/fpsWeaponModels';
import{STATIONS,PERKS,PAP}from'../../../shared/orda/perks';
import{floorAt}from'../../../shared/orda/arena';
import type{OrdaState,Survivor}from'../../../shared/orda/types';
import type{PerkId}from'../../../shared/orda/perks';
type BottleRig={root:TransformNode;variants:Map<PerkId,TransformNode>};
/** Four shared static props; bottle copies share textures/geometry, only their camera masks differ. */
export class PerkVisuals{
 readonly ready:Promise<void>;private disposed=false;private containers:AssetContainer[]=[];private roots:TransformNode[]=[];private bottles:AssetContainer|null=null;private drinks=new Map<string,BottleRig>();private papRoot:TransformNode;private papWeapon:RemoteWeaponModel;private papPanel:DynamicTexture|null=null;private papText='';
 constructor(private scene:Scene){this.papRoot=new TransformNode('pap-reward-root',scene);const t=STATIONS.find(t=>t.id==='pap')!;this.papRoot.position.set(t.x,floorAt(t.x,t.z)+1.05,t.z-.65);this.papWeapon=new RemoteWeaponModel(scene,this.papRoot,1);this.papWeapon.root.position.set(0,0,0);this.papWeapon.setEnabled(false);this.ready=this.load();}
 private async load():Promise<void>{
  await Promise.all(STATIONS.map(async t=>{const asset=await LoadAssetContainerAsync(`/assets/orda/perks/${t.id}.glb`,this.scene);if(this.disposed){asset.dispose();return;}asset.addAllToScene();this.containers.push(asset);const root=new TransformNode('perk-machine:'+t.id,this.scene);this.roots.push(root);root.position.set(t.x,floorAt(t.x,t.z),t.z);root.rotation.y=t.rotation;for(const n of asset.rootNodes)n.parent=root;
   for(const m of root.getChildMeshes()){m.layerMask=1;m.isPickable=false;m.checkCollisions=false;m.freezeWorldMatrix();}
   for(const m of asset.materials)if(m instanceof PBRMaterial){m.maxSimultaneousLights=2;m.environmentIntensity=.7;m.emissiveColor.addInPlace(new Color3(.025,.025,.025));m.freeze();}
   const name=t.id==='pap'?'PACK-A-PUNCH':PERKS[t.id].name,price=t.id==='pap'?PAP.price:PERKS[t.id].price;
   const texture=new DynamicTexture('perk-sign:'+t.id,{width:512,height:160},this.scene,false);this.sign(texture,`${name}\n${price} PUNTI · QUADRATO / X`);const mat=new StandardMaterial('perk-sign:'+t.id,this.scene);mat.diffuseTexture=texture;mat.emissiveTexture=texture;mat.emissiveColor.setAll(.18);mat.specularColor.setAll(0);mat.maxSimultaneousLights=2;const panel=MeshBuilder.CreatePlane('perk-price:'+t.id,{width:t.id==='pap'?1.65:1.45,height:.44,sideOrientation:Mesh.DOUBLESIDE},this.scene);panel.material=mat;panel.parent=root;panel.position.set(0,t.h+.29,.05);panel.rotation.y=Math.PI;panel.layerMask=1;panel.isPickable=false;panel.freezeWorldMatrix();mat.freeze();if(t.id==='pap')this.papPanel=texture;
  }));
  const bottles=await LoadAssetContainerAsync('/assets/orda/perks/bottles.glb',this.scene);if(this.disposed){bottles.dispose();return;}this.bottles=bottles;this.containers.push(bottles);
  // Display the supplied five-bottle set on the dock, as labelled original props.
  const table=MeshBuilder.CreateBox('perk-bottle-display',{width:2,height:.12,depth:.6},this.scene);table.position.set(-2.5,2.15,15.6);table.layerMask=1;table.isPickable=false;const wood=new StandardMaterial('bottle-shelf',this.scene);wood.diffuseColor=new Color3(.22,.16,.1);table.material=wood;table.freezeWorldMatrix();
  const copy=bottles.instantiateModelsToScene(n=>'soda-display:'+n,false,{doNotInstantiate:false});const shelf=new TransformNode('supplied-five-sodas',this.scene);this.roots.push(shelf);for(const n of copy.rootNodes)n.parent=shelf;let i=0;for(const n of shelf.getChildMeshes())if(n.getTotalVertices()){n.position.x=(i++-2)*.32;n.position.y=2.22;n.position.z=15.6;n.position.x-=2.5;n.layerMask=1;n.isPickable=false;n.freezeWorldMatrix();}
 }
 private sign(texture:DynamicTexture,text:string):void{const c=texture.getContext()as CanvasRenderingContext2D;const g=c.createLinearGradient(0,0,512,160);g.addColorStop(0,'#10242c');g.addColorStop(1,'#203338');c.fillStyle=g;c.fillRect(0,0,512,160);c.fillStyle='#71cad4';c.fillRect(0,0,7,160);c.strokeStyle='#d9bd7970';c.lineWidth=2;c.strokeRect(12,10,489,139);c.fillStyle='#f3e8c9';c.textAlign='center';c.font='bold 30px Arial';text.split('\n').forEach((line,i)=>c.fillText(line,256,60+i*48));texture.update();}
 private drinkRig(id:string,cam:UniversalCamera,mask:number):BottleRig|null{
  if(this.drinks.has(id))return this.drinks.get(id)!;if(!this.bottles)return null;
  const copy=this.bottles.instantiateModelsToScene(n=>'drink:'+id+':'+n,false,{doNotInstantiate:false});const root=new TransformNode('drink-rig:'+id,this.scene);root.parent=cam;for(const n of copy.rootNodes)n.parent=root;
  const variants=new Map<PerkId,TransformNode>();for(const n of root.getChildTransformNodes())for(const key of ['juggernog','speedcola','doubletap']as PerkId[])if(n.name.endsWith(':'+key))variants.set(key,n);
  for(const mesh of root.getChildMeshes()){mesh.layerMask=mask;mesh.isPickable=false;mesh.alwaysSelectAsActiveMesh=true;}root.setEnabled(false);const rig={root,variants};this.drinks.set(id,rig);return rig;
 }
 drink(p:Survivor,cam:UniversalCamera,mask:number,time:number):void{
  let rig=this.drinks.get(p.id);if(!p.drinking){rig?.root.setEnabled(false);return;}rig??=this.drinkRig(p.id,cam,mask)??undefined;if(!rig)return;
  const age=Math.max(0,time-p.drinking.started),up=Math.min(1,age/.45),down=Math.max(0,(age-1.45)/.55);rig.root.setEnabled(true);rig.root.position.set(.1,-.48+up*.32-down*.34,.4);rig.root.rotation.set(-Math.min(1,age/.85)*.8+down*.6,0,-.14);
  for(const mesh of rig.root.getChildMeshes()){const key=p.drinking.id;mesh.setEnabled(!mesh.getTotalVertices()||mesh.name.endsWith(':'+key));}
 }
 update(s:OrdaState):void{
  const b=s.pap,active=b.phase!=='idle'&&!!b.weapon;this.papWeapon.setEnabled(active);if(active){this.papWeapon.equip(b.weapon!);this.papRoot.rotation.y=s.time*(b.phase==='working'?2:.5);this.papRoot.position.y=2.7+Math.sin(s.time*4)*.04;}
  const text=b.phase==='working'?`PACK-A-PUNCH\nPOTENZIAMENTO · ${Math.max(0,Math.ceil(b.until-s.time))}s`:b.phase==='ready'?`ARMA PRONTA · ${Math.max(0,Math.ceil(b.until-s.time))}s\nQUADRATO / X · RITIRA`:'PACK-A-PUNCH\n5000 PUNTI · QUADRATO / X';if(text!==this.papText&&this.papPanel){this.sign(this.papPanel,text);this.papText=text;}
 }
 dispose():void{this.disposed=true;this.papWeapon.dispose();this.papRoot.dispose();for(const r of this.drinks.values())r.root.dispose();for(const r of this.roots)r.dispose();for(const c of this.containers)c.dispose();this.drinks.clear();}
}
