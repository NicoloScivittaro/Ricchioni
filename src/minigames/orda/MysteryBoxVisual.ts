import {Color3,LoadAssetContainerAsync,Mesh,MeshBuilder,PBRMaterial,Scene,StandardMaterial,TransformNode}from'@babylonjs/core';
import {RemoteWeaponModel}from'../../controller/fpsWeaponModels';
import {MYSTERY_BOX,ZOMBIES}from'../../../shared/orda/zombiesRules';
import type{OrdaState}from'../../../shared/orda/types';
import '@babylonjs/loaders/glTF';
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
/** One articulated world box shared across all cameras. Motion follows the host clock. */
export class MysteryBoxVisual{
 readonly ready:Promise<void>;private disposed=false;private root:TransformNode|null=null;private hinge:TransformNode|null=null;private angle=-Math.PI*105/180;
 private rewardRoot:TransformNode;private reward:RemoteWeaponModel;private roulette:RemoteWeaponModel[]=[];private glow:Mesh;private glowMaterial:StandardMaterial;
 constructor(private scene:Scene){
  this.rewardRoot=new TransformNode('mystery-box-reward',scene);this.rewardRoot.position.set(MYSTERY_BOX.x,1.15,MYSTERY_BOX.z);
  this.reward=this.model();this.roulette=['pistola','raffica','laser'].map(id=>{const model=this.model();model.equip(id);return model;});
  this.glow=MeshBuilder.CreateBox('mystery-box-interior-glow',{width:1.95,height:.012,depth:.32},scene);this.glow.position.set(MYSTERY_BOX.x,.445,MYSTERY_BOX.z);this.glow.layerMask=1;this.glow.isPickable=false;this.glow.checkCollisions=false;
  this.glowMaterial=new StandardMaterial('mystery-box-glow',scene);this.glowMaterial.disableLighting=true;this.glowMaterial.emissiveColor=new Color3(.32,.66,.9);this.glowMaterial.alpha=.42;this.glow.material=this.glowMaterial;this.glow.setEnabled(false);this.glow.freezeWorldMatrix();this.ready=this.load();
 }
 private model():RemoteWeaponModel{const model=new RemoteWeaponModel(this.scene,this.rewardRoot,1);model.root.position.set(0,0,0);model.root.scaling.setAll(1.2);model.setEnabled(false);return model;}
 private async load():Promise<void>{
  const asset=await LoadAssetContainerAsync('/assets/orda/mystery-box.glb',this.scene);if(this.disposed||this.scene.isDisposed){asset.dispose();return;}asset.addAllToScene();
  const root=this.root=new TransformNode('mystery-box',this.scene);root.position.set(MYSTERY_BOX.x,MYSTERY_BOX.y,MYSTERY_BOX.z);root.rotation.y=Math.PI;for(const node of asset.rootNodes)node.parent=root;
  this.hinge=root.getChildTransformNodes().find(n=>n.name==='lidHinge')??null;
  if(!this.hinge)throw Error('Mystery Box articulated lid missing');
  // glTF may supply an identity quaternion: use one explicit local hinge rotation.
  this.hinge.rotationQuaternion=null;
  for(const mesh of root.getChildMeshes()){mesh.layerMask=1;mesh.isPickable=false;mesh.checkCollisions=false;if(mesh.name!=='MysteryBox_lid')mesh.freezeWorldMatrix();}
  for(const mat of asset.materials)if(mat instanceof PBRMaterial){mat.maxSimultaneousLights=2;mat.environmentIntensity=.5;mat.roughness=Math.max(.45,mat.roughness??1);mat.emissiveColor=mat.emissiveColor.add(new Color3(.015,.012,.008));}
 }
 update(s:OrdaState):void{
  if(this.disposed)return;const b=s.box,age=s.time-b.started;
  const opening=b.phase==='rolling'?smooth(age/.6):b.phase==='ready'?1:b.phase==='closing'?1-smooth((s.time-(b.until-ZOMBIES.closeSeconds))/.65):0;
  if(this.hinge)this.hinge.rotation.x=this.angle*opening;
  this.reward.setEnabled(false);for(const model of this.roulette)model.setEnabled(false);
  const rolling=b.phase==='rolling'&&age>.35,ready=b.phase==='ready'&&!!b.weapon;
  if(rolling){this.roulette[Math.floor(Math.max(0,age-.35)/.19)%this.roulette.length].setEnabled(true);this.rewardRoot.position.y=.55+smooth((age-.35)/.5)*.6+Math.sin(age*17)*.025;this.rewardRoot.rotation.y=age*1.8;}
  if(ready){this.reward.equip(b.weapon!);this.reward.setEnabled(true);this.rewardRoot.position.y=1.15+Math.sin(s.time*2.5)*.045;this.rewardRoot.rotation.y=s.time*.6;}
  this.glow.setEnabled(opening>.05);if(opening>.05){const pulse=.85+Math.sin(s.time*8)*.15;this.glowMaterial.alpha=opening*.42;this.glowMaterial.emissiveColor.set(.25*pulse,.58*pulse,.9*pulse);}
 }
 dispose():void{this.disposed=true;this.reward.dispose();for(const model of this.roulette)model.dispose();this.rewardRoot.dispose();this.root?.dispose();this.glow.dispose();this.glowMaterial.dispose();}
}
