import {Color3,PBRMaterial,SceneLoader,StandardMaterial,TransformNode} from '@babylonjs/core';
import type {AbstractMesh,AssetContainer,Scene} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
export const FPS_WEAPON_MODELS:Record<string,{file:string;length:number}>={
 mitraglia:{file:'ak47',length:.65},raffica:{file:'m4a1',length:.65},laser:{file:'sniper',length:.85},
 spaccatutto:{file:'raygun-v1',length:.5},bombarda:{file:'raygun',length:.5},sparapiselli:{file:'minigun',length:.65},pistola:{file:'usp45',length:.4}
};
const cache=new WeakMap<Scene,Map<string,Promise<AssetContainer>>>();
function source(scene:Scene,file:string):Promise<AssetContainer>{
 let models=cache.get(scene);if(!models){models=new Map();cache.set(scene,models);scene.onDisposeObservable.addOnce(()=>{cache.delete(scene);for(const pending of models!.values())void pending.then(c=>c.dispose()).catch(()=>{});});}
 let pending=models.get(file);if(!pending){pending=SceneLoader.LoadAssetContainerAsync('/assets/fps/weapons/',file+'.glb',scene).then(c=>{if(scene.isDisposed){c.dispose();throw new Error('Weapon scene disposed');}const converted=new Map<PBRMaterial,StandardMaterial>();
      for(const mesh of c.meshes){if(!(mesh.material instanceof PBRMaterial))continue;const p=mesh.material;let m=converted.get(p);if(!m){m=new StandardMaterial('weapon:'+p.name,scene);m.diffuseColor=(p.albedoColor??Color3.White()).toGammaSpace();m.diffuseTexture=p.albedoTexture;m.bumpTexture=p.bumpTexture;m.emissiveColor=p.emissiveColor.clone();m.emissiveTexture=p.emissiveTexture;m.specularColor.setAll(.14);m.specularPower=64;m.backFaceCulling=false;m.twoSidedLighting=true;m.alpha=p.alpha;m.transparencyMode=p.transparencyMode;m.alphaCutOff=p.alphaCutOff;m.useAlphaFromDiffuseTexture=p.useAlphaFromAlbedoTexture;m.disableLighting=p.unlit;if(p.unlit){m.emissiveTexture=p.albedoTexture;m.emissiveColor=(p.albedoColor??Color3.White()).toGammaSpace();m.diffuseColor=Color3.Black();}m.maxSimultaneousLights=2;m.freeze();converted.set(p,m);}mesh.material=m;}
      for(const p of converted.keys())p.dispose(false,false);c.materials=[...converted.values()];return c;});models.set(file,pending);void pending.catch(()=>{if(models!.get(file)===pending)models!.delete(file);});}return pending;
}
export interface WeaponMeshHandle {root:TransformNode;meshes:AbstractMesh[];sightY:number}
/** One download/geometry/material set per scene and asset, shared by all views. */
export async function attachWeaponModel(scene:Scene,id:string,parent:TransformNode,layerMask?:number):Promise<WeaponMeshHandle>{
 const profile=FPS_WEAPON_MODELS[id];if(!profile)throw new Error('Unknown weapon model '+id);
 const container=await source(scene,profile.file);if(scene.isDisposed||parent.isDisposed())throw new Error('Weapon attachment disposed');
 const instance=container.instantiateModelsToScene(name=>'weapon:'+profile.file+':'+name,false,{doNotInstantiate:false});
 const root=new TransformNode('weaponModel:'+profile.file,scene);root.parent=parent;root.metadata={weaponId:id,source:profile.file};
 for(const n of instance.rootNodes)n.parent=root;
 const meshes=root.getChildMeshes();for(const mesh of meshes){mesh.isPickable=false;mesh.checkCollisions=false;if(layerMask!==undefined)mesh.layerMask=layerMask;}
 let sightY=.17;for(const mesh of container.meshes){if(!mesh.getTotalVertices())continue;mesh.computeWorldMatrix(true);sightY=Math.max(sightY,mesh.getBoundingInfo().boundingBox.maximumWorld.y+.006);}
 return{root,meshes,sightY};
}
/** Opponents use the same asset, attached independently of avatar fallback meshes. */
export class RemoteWeaponModel{
 readonly root:TransformNode;readonly muzzle:TransformNode;private id='';private version=0;private visual:TransformNode|null=null;
 constructor(private scene:Scene,parent:TransformNode,private layerMask?:number,private fallback?:AbstractMesh){this.root=new TransformNode('remoteWeapon',scene);this.root.parent=parent;this.root.position.set(.24,.4,.35);this.root.scaling.setAll(1.3);this.muzzle=new TransformNode('remoteWeaponMuzzle',scene);this.muzzle.parent=this.root;}
 equip(id:string):void{if(id===this.id)return;this.id=id;this.muzzle.position.set(0,.17,(FPS_WEAPON_MODELS[id]?.length??.65)*.75);const version=++this.version;this.visual?.dispose();this.visual=null;if(this.fallback)this.fallback.isVisible=true;void attachWeaponModel(this.scene,id,this.root,this.layerMask).then(v=>{if(version!==this.version||this.root.isDisposed()){v.root.dispose();return;}this.visual=v.root;if(this.fallback)this.fallback.isVisible=false;}).catch(e=>{if(!this.scene.isDisposed&&!this.root.isDisposed())console.warn('Remote weapon unavailable',id,e);});}
 setEnabled(enabled:boolean):void{if(!this.root.isDisposed())this.root.setEnabled(enabled);}
 dispose():void{this.version++;this.root.dispose();}
}
