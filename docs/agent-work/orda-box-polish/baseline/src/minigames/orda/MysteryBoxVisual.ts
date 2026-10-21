import {Color3,LoadAssetContainerAsync,PBRMaterial,Scene,TransformNode}from'@babylonjs/core';
import {RemoteWeaponModel}from'../../controller/fpsWeaponModels';
import {MYSTERY_BOX}from'../../../shared/orda/zombiesRules';
import type{OrdaState}from'../../../shared/orda/types';
import '@babylonjs/loaders/glTF';
/** One real shared world object, never one copy per viewport. */
export class MysteryBoxVisual{
 readonly ready:Promise<void>;private closed:TransformNode[]=[];private opened:TransformNode[]=[];private disposed=false;
 private rewardRoot:TransformNode;private reward:RemoteWeaponModel;
 constructor(private scene:Scene){
  this.rewardRoot=new TransformNode('mystery-box-reward',scene);this.rewardRoot.position.set(MYSTERY_BOX.x,1.25,MYSTERY_BOX.z);this.reward=new RemoteWeaponModel(scene,this.rewardRoot,1);this.reward.root.position.set(0,0,0);this.reward.root.scaling.setAll(1.2);this.reward.setEnabled(false);this.ready=this.load();
 }
 private async load():Promise<void>{
  const asset=await LoadAssetContainerAsync('/assets/orda/mystery-box.glb',this.scene);if(this.disposed||this.scene.isDisposed){asset.dispose();return;}asset.addAllToScene();
  const root=new TransformNode('mystery-box',this.scene);root.position.set(MYSTERY_BOX.x,MYSTERY_BOX.y,MYSTERY_BOX.z);root.rotation.y=Math.PI;for(const node of asset.rootNodes)node.parent=root;
  this.closed=root.getChildTransformNodes().filter(n=>n.name==='closed');this.opened=root.getChildTransformNodes().filter(n=>n.name==='open');
  if(!this.closed.length||!this.opened.length)throw Error('Mystery Box original variants missing');
  for(const mesh of root.getChildMeshes()){mesh.layerMask=1;mesh.isPickable=false;mesh.checkCollisions=false;mesh.freezeWorldMatrix();}
  for(const mat of asset.materials)if(mat instanceof PBRMaterial){mat.maxSimultaneousLights=2;mat.environmentIntensity=.5;mat.roughness=Math.max(.45,mat.roughness??1);mat.emissiveColor=mat.emissiveColor.add(new Color3(.015,.012,.008));}
  for(const n of this.opened)n.setEnabled(false);
 }
 update(s:OrdaState):void{
  if(this.disposed)return;const b=s.box,open=b.phase==='rolling'||b.phase==='ready';for(const n of this.closed)n.setEnabled(!open);for(const n of this.opened)n.setEnabled(open);
  const show=b.phase==='ready'&&!!b.weapon;this.reward.setEnabled(show);if(show){this.reward.equip(b.weapon!);this.rewardRoot.position.y=1.15+Math.sin(s.time*2.5)*.07;this.rewardRoot.rotation.y=s.time*.6;}
 }
 dispose():void{this.disposed=true;this.reward.dispose();this.rewardRoot.dispose();}
}
