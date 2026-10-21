import {AssetContainer,LoadAssetContainerAsync,PBRMaterial,Scene,Color3,Mesh} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {BackActor} from '../backrooms/backroomsAssets';
import type {BackAsset} from '../backrooms/backroomsAssets';
import type {EnemyKind} from '../../../shared/orda/types';
const FILES={hazmat:'escape_the_backrooms_hazmat',partygoer:'partygoer_from_backrooms_updated',bacteria:'bacteria_-_kane_pixels_backrooms',smiler:'smiler_entity3_backrooms'} as const;
export const ENEMY_ART:Record<EnemyKind,{model:keyof typeof FILES;scale:number;color:string}>={
 infetto:{model:'hazmat',scale:1,color:'#8f9774'},corridore:{model:'partygoer',scale:1,color:'#e7ad62'},
 colosso:{model:'hazmat',scale:1.47,color:'#c78362'},assalitore:{model:'smiler',scale:1,color:'#96ddd1'},
 cacciatore:{model:'bacteria',scale:1,color:'#a3b798'},macellaio:{model:'bacteria',scale:1.19,color:'#ff775d'}
};
/** Actor-only loader. No Backrooms maze, wall templates, game logic or original environment assets. */
export class OrdaAssets{
 readonly containers=new Map<BackAsset,AssetContainer>();
 private variants=new Map<string,PBRMaterial>();
 constructor(readonly scene:Scene){}
 async load():Promise<void>{
  await Promise.all(Object.entries(FILES).map(async([id,file])=>{const c=await LoadAssetContainerAsync(`/assets/backrooms/${file}.glb`,this.scene);if(this.scene.isDisposed){c.dispose();return;}this.containers.set(id as BackAsset,c);
   for(const m of c.materials)if(m instanceof PBRMaterial){m.maxSimultaneousLights=2;m.environmentIntensity=.4;m.roughness=Math.max(.6,m.roughness??1);if(id==='bacteria'){m.albedoColor.set(.07,.075,.06);m.emissiveColor.set(.008,.009,.006);m.roughness=.9;}for(const t of m.getActiveTextures())t.anisotropicFilteringLevel=2;}
  }));
 }
 actor(kind:EnemyKind|'player',name:string,color?:string,label?:string):BackActor{
  const a=kind==='player'?{model:'hazmat' as const,scale:1,color:color??'#75b5b6'}:ENEMY_ART[kind];
  const actor=new BackActor(this,a.model,name,a.color,label);actor.root.scaling.setAll(a.scale);if(kind!=='player')actor.showLabel(false);
  if(a.model==='bacteria'){
   // These source parts have no skin. Batch the rigid trunk/legs while keeping the authored
   // head/arm pivot subtrees intact, so the existing procedural animations still work.
   const rigid=actor.meshes.filter(mesh=>{if(mesh.skeleton||mesh.getTotalVertices()===0||!mesh.subMeshes?.length)return false;for(let p=mesh.parent;p&&p!==actor.body;p=p.parent)if(p.name.includes(':pivot:'))return false;return true;});
   const groups=new Map<string,Mesh[]>();for(const mesh of rigid){const key=[mesh.material?.uniqueId,mesh.sideOrientation,...mesh.getVerticesDataKinds().sort().map(k=>k+':'+mesh.getVertexBuffer(k)?.getSize())].join('|'),list=groups.get(key)??[];list.push(mesh);groups.set(key,list);}
   // The source mixes UV/tangent layouts; only identical attribute sets and materials can be merged.
   for(const list of groups.values())if(list.length>1){const merged=Mesh.MergeMeshes(list,true,true,undefined,false,false);if(merged){merged.name=name+':rigid-body';merged.setParent(actor.body);merged.isPickable=false;for(let i=actor.meshes.length-1;i>=0;i--)if(actor.meshes[i].isDisposed())actor.meshes.splice(i,1);actor.meshes.push(merged);}}
  }
  if(kind==='infetto'||kind==='colosso')for(const mesh of actor.meshes)if(mesh.material instanceof PBRMaterial){const source=mesh.material,key=kind+':'+source.uniqueId;let mat=this.variants.get(key);if(!mat){mat=source.clone('orda:'+key)!;mat.albedoColor=source.albedoColor.multiply(Color3.FromHexString(kind==='infetto'?'#809c85':'#b56c4c'));this.variants.set(key,mat);}mesh.material=mat;}
  return actor;
 }
 dispose():void{for(const m of this.variants.values())m.dispose(false,false);this.variants.clear();for(const c of this.containers.values())c.dispose();this.containers.clear();}
}
