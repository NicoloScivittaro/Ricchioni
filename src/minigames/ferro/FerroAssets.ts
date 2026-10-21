import{Scene,LoadAssetContainerAsync,Mesh,Quaternion,PBRMaterial,StandardMaterial,Color3,TransformNode}from'@babylonjs/core';
import'@babylonjs/loaders/glTF';
import type{ArenaId,WeaponId}from'../../../shared/ferro/types';
const cache=new WeakMap<Scene,Map<string,Mesh[]>>();
export const SWORD_MODELS=['crystal','steampunk','autumn','victory']as const;
export const SHIELD_MODELS=['medieval','scutum']as const;
export const modelId=(id:WeaponId|'shieldFace'|'arrow',variant=0):string|null=>id==='sword'||id==='shield'?SWORD_MODELS[variant%4]:id==='shieldFace'?SHIELD_MODELS[variant%2]:id==='spear'?'longinus':id==='blades'?'dagger':id==='hammer'?'warhammer':id==='axe'?null:id;
/** Textured local models share geometry/materials across actors and views. No network environment map. */
export async function loadFerroAssets(scene:Scene,mapId:ArenaId):Promise<void>{
 const models=new Map<string,Mesh[]>();cache.set(scene,models);
 await Promise.all([...SWORD_MODELS,...SHIELD_MODELS,'longinus','bow','arrow','dagger','warhammer',...(mapId==='colosseum'?[]:[mapId])].map(async id=>{
  const container=await LoadAssetContainerAsync('/assets/ferro2/'+id+'.glb',scene);if(scene.isDisposed){container.dispose();return;}container.addAllToScene();
  for(const root of container.rootNodes)if(root.name==='__root__'&&root instanceof TransformNode)root.rotationQuaternion=Quaternion.Identity();
  const materials=new Map<PBRMaterial,StandardMaterial>(),equivalent=new Map<string,StandardMaterial>();
  for(const material of container.materials)if(material instanceof PBRMaterial){
   const m=new StandardMaterial('ferro2:'+id+':'+material.name,scene);m.diffuseTexture=material.albedoTexture;m.diffuseColor=material.albedoColor.clone();m.bumpTexture=material.bumpTexture;m.emissiveTexture=material.emissiveTexture;m.emissiveColor=material.emissiveColor.clone();m.specularColor=new Color3(.22,.22,.22);m.specularPower=24+(1-(material.roughness??.6))*48;m.backFaceCulling=material.backFaceCulling;m.alpha=material.alpha;m.useAlphaFromDiffuseTexture=material.useAlphaFromAlbedoTexture;m.maxSimultaneousLights=2;const signature=JSON.stringify({textures:[m.diffuseTexture,m.bumpTexture,m.emissiveTexture].map(t=>t?[t.getInternalTexture()?.uniqueId,t.coordinatesIndex,t.level,t.wrapU,t.wrapV,t.getTextureMatrix().asArray(),t.gammaSpace]:null),diffuse:m.diffuseColor.asArray(),emissive:m.emissiveColor.asArray(),specular:m.specularColor.asArray(),power:m.specularPower,alpha:m.alpha,cull:m.backFaceCulling,useAlpha:m.useAlphaFromDiffuseTexture});const shared=equivalent.get(signature);if(shared){m.dispose(false,false);materials.set(material,shared);}else{m.freeze();equivalent.set(signature,m);materials.set(material,m);}
  }
  const groups=new Map<unknown,Mesh[]>();for(const node of [...container.meshes]){if(!(node instanceof Mesh)||!node.getTotalVertices())continue;
   node.computeWorldMatrix(true);node.bakeTransformIntoVertices(node.getWorldMatrix());node.parent=null;node.position.setAll(0);node.rotation.setAll(0);node.rotationQuaternion=Quaternion.Identity();node.scaling.setAll(1);if(node.material instanceof PBRMaterial)node.material=materials.get(node.material)!;node.isPickable=false;node.layerMask=1;
   const group=groups.get(node.material)??[];group.push(node);groups.set(node.material,group);
  }
  const meshes:Mesh[]=[];for(const group of groups.values()){const mesh=group.length===1?group[0]:Mesh.MergeMeshes(group,true,true,undefined,false,false)!;mesh.name='ferro2-source:'+id;mesh.isPickable=false;mesh.layerMask=1;mesh.setEnabled(id===mapId);if(id===mapId)mesh.freezeWorldMatrix();meshes.push(mesh);}models.set(id,meshes);
  const retained=new Set([...equivalent.values()].flatMap(m=>[m.diffuseTexture,m.bumpTexture,m.emissiveTexture]).filter(Boolean));for(const texture of container.textures)if(!retained.has(texture))texture.dispose();for(const original of materials.keys())original.dispose(false,false);
  // Scene owns the converted templates. Container roots have no remaining geometry.
 }));
 await Promise.all([...models.values()].flat().map(mesh=>mesh.material?.forceCompilationAsync(mesh)));
}
export function cloneImported(scene:Scene,id:WeaponId|'shieldFace'|'arrow',parent:TransformNode,variant=0):Mesh[]|null{
 const key=modelId(id,variant),source=key?cache.get(scene)?.get(key):null;if(!source)return null;
 return source.map((mesh,i)=>{const copy=mesh.clone('ferro-model:'+id+':'+i,parent)!;copy.setEnabled(true);copy.layerMask=1;copy.isPickable=false;return copy;});
}
