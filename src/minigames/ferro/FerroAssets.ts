import{Scene,LoadAssetContainerAsync,Mesh,Quaternion,PBRMaterial,StandardMaterial,Color3,TransformNode,Matrix,Vector3,VertexBuffer}from'@babylonjs/core';
import'@babylonjs/loaders/glTF';
import type{ArenaId,WeaponId}from'../../../shared/ferro/types';
const cache=new WeakMap<Scene,Map<string,Mesh[]>>();
export const SWORD_MODELS=['crystal','steampunk','autumn','victory']as const;
export const SHIELD_MODELS=['medieval','scutum']as const;
/** Axe variants: the original forged axe, then the two Ferro 2.1 models (identical statistics). */
export const AXE_MODELS=['forged','axe','volcanic']as const;
export const AXE_NAMES=['ASCIA FORGIATA','ASCIA DA GUERRA','ASCIA VULCANICA']as const;
export const modelId=(id:WeaponId|'shieldFace'|'arrow',variant=0):string|null=>id==='sword'||id==='shield'?SWORD_MODELS[variant%4]:id==='shieldFace'?SHIELD_MODELS[variant%2]:id==='spear'?'longinus':id==='blades'?'dagger':id==='hammer'?'warhammer':id==='axe'?(variant%3?AXE_MODELS[variant%3]:null):id;
type Axis='+x'|'-x'|'+y'|'-y'|'+z'|'-z';
/** Per-model grip calibration in the model's own (baked, Babylon) space — never one global offset.
 * up: axis from the hand towards the tip/head; edge: where the cutting edge / striking face points;
 * grip: centre of the handle inside the fist; tip: hand→tip distance after scaling (= weapon length, so the
 * visible tip matches the authoritative hitbox). Measured from the vertex profile of each GLB. */
export const GRIPS:Readonly<Record<string,{up:Axis;edge:Axis;grip:[number,number,number];tip:number}>>={
 crystal:{up:'+y',edge:'+z',grip:[0,-.22,0],tip:1.62},
 steampunk:{up:'+y',edge:'+x',grip:[0,-.24,0],tip:1.62},
 autumn:{up:'+y',edge:'+x',grip:[0,-.16,0],tip:1.62},
 // Source was normalised upside down: blade below the origin, hilt (guard 1.2, pommel 1.6) above it.
 victory:{up:'-y',edge:'+x',grip:[0,1.44,0],tip:1.62},
 longinus:{up:'+y',edge:'+z',grip:[0,0,0],tip:2.6},
 dagger:{up:'+y',edge:'+x',grip:[0,-.12,0],tip:1.05},
 warhammer:{up:'+y',edge:'+x',grip:[0,-.3,0],tip:1.85},
 // Ferro 2.1 axes: haft along −X / +Y, edge on the far side of the haft.
 axe:{up:'-x',edge:'-z',grip:[.88,0,.2],tip:1.75},
 volcanic:{up:'+y',edge:'-z',grip:[0,1.0,0],tip:1.55},
 forged:{up:'+y',edge:'+x',grip:[0,-.08,0],tip:1.75},
};
const AXES:Record<Axis,Vector3>={'+x':new Vector3(1,0,0),'-x':new Vector3(-1,0,0),'+y':new Vector3(0,1,0),'-y':new Vector3(0,-1,0),'+z':new Vector3(0,0,1),'-z':new Vector3(0,0,-1)};
/** Bakes the calibration into the template vertices: handle centre at the origin, tip along +Y, edge along +Z. */
export function calibrate(meshes:Mesh[],key:string):void{
 const g=GRIPS[key];if(!g)return;for(const mesh of meshes)mesh.bakeCurrentTransformIntoVertices();const y=AXES[g.up],z=AXES[g.edge],x=Vector3.Cross(y,z),grip=new Vector3(...g.grip);
 let top=-Infinity;for(const mesh of meshes){const v=mesh.getVerticesData(VertexBuffer.PositionKind);if(v)for(let i=0;i<v.length;i+=3)top=Math.max(top,v[i]*y.x+v[i+1]*y.y+v[i+2]*y.z);}
 const scale=g.tip/Math.max(.05,top-Vector3.Dot(grip,y)),rotation=Matrix.FromValues(x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,0,0,0,1),origin=new Vector3(Vector3.Dot(grip,x),Vector3.Dot(grip,y),Vector3.Dot(grip,z));
 const transform=rotation.multiply(Matrix.Translation(-origin.x,-origin.y,-origin.z)).multiply(Matrix.Scaling(scale,scale,scale));
 for(const mesh of meshes){mesh.bakeTransformIntoVertices(transform);mesh.refreshBoundingInfo();}
}
/** Textured local models share geometry/materials across actors and views. No network environment map. */
export async function loadFerroAssets(scene:Scene,mapId:ArenaId):Promise<void>{
 const models=new Map<string,Mesh[]>();cache.set(scene,models);
 await Promise.all([...SWORD_MODELS,...SHIELD_MODELS,'longinus','bow','arrow','dagger','warhammer','axe','volcanic',...(mapId==='colosseum'?[]:[mapId])].map(async id=>{
  const container=await LoadAssetContainerAsync('/assets/ferro2/'+id+'.glb',scene);if(scene.isDisposed){container.dispose();return;}container.addAllToScene();
  for(const root of container.rootNodes)if(root.name==='__root__'&&root instanceof TransformNode)root.rotationQuaternion=Quaternion.Identity();
  const materials=new Map<PBRMaterial,StandardMaterial>(),equivalent=new Map<string,StandardMaterial>();
  for(const material of container.materials)if(material instanceof PBRMaterial){
   const m=new StandardMaterial('ferro2:'+id+':'+material.name,scene);m.diffuseTexture=material.albedoTexture;m.diffuseColor=material.albedoColor.clone();m.bumpTexture=material.bumpTexture;m.emissiveTexture=material.emissiveTexture;m.emissiveColor=material.emissiveColor.clone();
   // Standard materials ADD the emissive texture to the emissive colour: keep the glTF factor as the texture level
   // (lava of the volcanic axe glows, the rest of the model keeps its albedo instead of turning white).
   // Specular-workflow exports (victory.glb: metallic 0, near-black base colour, real colours in KHR_materials_specular)
   // rendered pitch black under the diffuse-only conversion: their specular colour map is the visible surface.
   const reflectance=(material as PBRMaterial&{reflectanceTexture?:PBRMaterial['albedoTexture']}).reflectanceTexture;if(material.metallic===0&&reflectance){m.diffuseTexture=reflectance;m.specularColor=new Color3(.45,.45,.45);}
   if(m.emissiveTexture){m.emissiveTexture.level=Math.min(1.6,Math.max(...material.emissiveColor.asArray())*(material.emissiveIntensity||1));m.emissiveColor=Color3.Black();}m.specularColor=new Color3(.22,.22,.22);m.specularPower=24+(1-(material.roughness??.6))*48;m.backFaceCulling=material.backFaceCulling;m.alpha=material.alpha;m.useAlphaFromDiffuseTexture=material.useAlphaFromAlbedoTexture;m.maxSimultaneousLights=2;const signature=JSON.stringify({textures:[m.diffuseTexture,m.bumpTexture,m.emissiveTexture].map(t=>t?[t.getInternalTexture()?.uniqueId,t.coordinatesIndex,t.level,t.wrapU,t.wrapV,t.getTextureMatrix().asArray(),t.gammaSpace]:null),diffuse:m.diffuseColor.asArray(),emissive:m.emissiveColor.asArray(),specular:m.specularColor.asArray(),power:m.specularPower,alpha:m.alpha,cull:m.backFaceCulling,useAlpha:m.useAlphaFromDiffuseTexture});const shared=equivalent.get(signature);if(shared){m.dispose(false,false);materials.set(material,shared);}else{m.freeze();equivalent.set(signature,m);materials.set(material,m);}
  }
  const groups=new Map<unknown,Mesh[]>();for(const node of [...container.meshes]){if(!(node instanceof Mesh)||!node.getTotalVertices())continue;
   node.computeWorldMatrix(true);node.bakeTransformIntoVertices(node.getWorldMatrix());node.parent=null;node.position.setAll(0);node.rotation.setAll(0);node.rotationQuaternion=Quaternion.Identity();node.scaling.setAll(1);if(node.material instanceof PBRMaterial)node.material=materials.get(node.material)!;node.isPickable=false;node.layerMask=1;
   const group=groups.get(node.material)??[];group.push(node);groups.set(node.material,group);
  }
  const merged:Mesh[]=[];for(const group of groups.values())merged.push(group.length===1?group[0]:Mesh.MergeMeshes(group,true,true,undefined,false,false)!);calibrate(merged,id);
  const meshes:Mesh[]=[];for(const mesh of merged){mesh.name='ferro2-source:'+id;mesh.isPickable=false;mesh.layerMask=1;mesh.setEnabled(id===mapId);if(id===mapId)mesh.freezeWorldMatrix();meshes.push(mesh);}models.set(id,meshes);
  const retained=new Set([...equivalent.values()].flatMap(m=>[m.diffuseTexture,m.bumpTexture,m.emissiveTexture]).filter(Boolean));for(const texture of container.textures)if(!retained.has(texture))texture.dispose();for(const original of materials.keys())original.dispose(false,false);
  // Scene owns the converted templates. Container roots have no remaining geometry.
 }));
 await Promise.all([...models.values()].flat().map(mesh=>mesh.material?.forceCompilationAsync(mesh)));
}
export function cloneImported(scene:Scene,id:WeaponId|'shieldFace'|'arrow',parent:TransformNode,variant=0):Mesh[]|null{
 const key=modelId(id,variant),source=key?cache.get(scene)?.get(key):null;if(!source)return null;
 return source.map((mesh,i)=>{const copy=mesh.clone('ferro-model:'+id+':'+i,parent)!;copy.setEnabled(true);copy.layerMask=1;copy.isPickable=false;return copy;});
}
