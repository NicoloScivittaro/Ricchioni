import type {Engine} from '@babylonjs/core';
import {Color3,Color4,DirectionalLight,HemisphericLight,ImageProcessingConfiguration,InstancedMesh,Mesh,MeshBuilder,PBRMaterial,Matrix,Scene,SceneLoader,ShaderMaterial,StandardMaterial,TransformNode} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {terminalAtlasMaterial} from './terminalAtlasMaterial';
import type {TerminalAtlas} from './terminalAtlasMaterial';
import type {Aabb} from '../../shared/fpsMap';
/** Shared TV/phone scene. Source models retain their transforms in spatial
 * thin-instance groups; architecture is offline-batched in 16 metre cells. */
export async function buildTerminalWorld(scene:Scene):Promise<void>{
  const started=performance.now();scene.clearColor=new Color4(.57,.7,.78,1);scene.ambientColor=new Color3(.23,.24,.26);
  // Only Terminal needs extra fill for the recovered, unbaked source textures.
  for(const light of scene.lights){if(light instanceof HemisphericLight)light.intensity=1.2;if(light instanceof DirectionalLight)light.intensity=1.5;}
  scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.05;
  const [result,collision,layouts]=await Promise.all([SceneLoader.ImportMeshAsync('','/assets/fps/terminal/','terminal-play.glb',scene),fetch('/assets/fps/terminal/arena.json').then(r=>{if(!r.ok)throw new Error('Terminal boundary HTTP '+r.status);return r.json() as Promise<{barriers:Aabb[]}>;}),fetch('/assets/fps/terminal/atlas.json').then(r=>{if(!r.ok)throw new Error('Terminal atlas HTTP '+r.status);return r.json() as Promise<TerminalAtlas[]>;})]);
  if(scene.isDisposed){for(const m of result.meshes)m.dispose();return;}
  // Babylon AUTO imports glTF into LH by mirroring X. The arena conversion
  // uses the equivalent Z mirror, so rotate the entire imported hierarchy once.
  const coordinates=new TransformNode('terminalLHCoordinates',scene);coordinates.rotation.y=Math.PI;
  for(const root of result.meshes.filter(m=>!m.parent))root.parent=coordinates;coordinates.computeWorldMatrix(true);
  const materials=new Map<NonNullable<Mesh['material']>,ShaderMaterial>();
  const material=(original:NonNullable<Mesh['material']>)=>{
    let m=materials.get(original);if(m)return m;
    const index=Number(original.name.split('-').at(-1)),texture=(original as PBRMaterial).albedoTexture;
    if(!layouts[index]||!texture)throw new Error('Terminal: atlante non disponibile '+original.name);
    m=terminalAtlasMaterial(scene,original.name,texture,layouts[index]);materials.set(original,m);return m;
  };
  const models=new Map<string,{source:Mesh;mat:ShaderMaterial|null;matrices:number[]}>(),kept:Mesh[]=[],staticGroups=new Map<string,Mesh[]>();let instances=0,triangles=0,instanceGroups=0;
  const staticNode=(source:Mesh,matrix:Matrix,mat:ShaderMaterial|null)=>{
    const node=new Mesh('terminalStatic',scene);source.geometry?.applyToMesh(node);node.makeGeometryUnique();node.bakeTransformIntoVertices(matrix);node.material=mat;node.computeWorldMatrix(true);
    const c=node.getBoundingInfo().boundingBox.centerWorld,k=`${mat?.uniqueId}:${Math.floor(c.x/32)}:${Math.floor(c.z/32)}`,list=staticGroups.get(k);if(list)list.push(node);else staticGroups.set(k,[node]);
  };
  // Gather transforms before disposing any imported hierarchy/source geometry.
  for(const imported of result.meshes){
    if(!imported.getTotalVertices())continue;
    const source=imported instanceof InstancedMesh?imported.sourceMesh:imported;if(!(source instanceof Mesh))continue;
    imported.computeWorldMatrix(true);const matrix=imported.getWorldMatrix().clone(),mat=imported.material?material(imported.material):null;
    triangles+=source.getTotalIndices()/3;
    if(imported.name.startsWith('terminalZone/')){
      staticNode(source,matrix,mat);
    }else{
      const center=imported.getBoundingInfo().boundingBox.centerWorld;
      const k=`${source.geometry?.uniqueId}:${mat?.uniqueId}:${Math.floor(center.x/16)}:${Math.floor(center.z/16)}`;
      let group=models.get(k);if(!group){group={source,mat,matrices:[]};models.set(k,group);}group.matrices.push(...matrix.asArray());instances++;
    }
  }
  for(const [key,g]of models){
    // Rare props join the nearby static atlas batch; repeated furniture stays
    // instanced. This avoids a draw call per tiny one-off decoration.
    if(g.matrices.length/16<4){for(let i=0;i<g.matrices.length;i+=16)staticNode(g.source,Matrix.FromArray(g.matrices,i),g.mat);continue;}
    instanceGroups++;
    const mesh=new Mesh('terminalInstances:'+key,scene);g.source.geometry?.applyToMesh(mesh);mesh.material=g.mat;mesh.isPickable=false;mesh.checkCollisions=false;
    mesh.thinInstanceSetBuffer('matrix',new Float32Array(g.matrices),16,true);mesh.thinInstanceRefreshBoundingInfo(true);mesh.freezeWorldMatrix();
    const size=g.source.getBoundingInfo().boundingBox.extendSize.length()*2;
    // Cull small repeated props by the size of ONE prop, not the whole cell.
    // Large structural models (including the aircraft) keep their full range.
    mesh.addLODLevel(size<.7?24:size<2?38:size<4?58:size<10?95:190,null);
    mesh.doNotSyncBoundingInfo=true;kept.push(mesh);
  }
  for(const [key,list]of staticGroups){const mesh=list.length>1?Mesh.MergeMeshes(list,true,true,undefined,false,false):list[0];if(!mesh)continue;mesh.name='terminalBatch:'+key;mesh.isPickable=false;mesh.checkCollisions=false;mesh.freezeWorldMatrix();mesh.doNotSyncBoundingInfo=true;kept.push(mesh);}
  coordinates.dispose();for(const node of result.transformNodes)if(!node.isDisposed())node.dispose();
  for(const original of materials.keys())original.dispose(false,false);for(const m of materials.values())m.freeze();
  // Original-design, visibly marked safety fence; its exact volumes are shared
  // with authoritative movement/shot data. These are not recovered CoD assets.
  const yellow=new StandardMaterial('terminalArenaBoundary',scene);yellow.diffuseColor=new Color3(.77,.57,.17);yellow.specularColor.setAll(.01);
  const dark=new StandardMaterial('terminalArenaBoundaryStripe',scene);dark.diffuseColor=new Color3(.11,.14,.17);
  for(const b of collision.barriers){
    const m=MeshBuilder.CreateBox('terminal:limite-visibile',{width:b.w,depth:b.d,height:b.h},scene);m.position.set(b.x,(b.base??0)+b.h/2,b.z);m.material=yellow;m.freezeWorldMatrix();m.isPickable=false;
    for(const y of [.45,1.3]){const band=MeshBuilder.CreateBox('terminal:limite-striscia',{width:b.w+.01,depth:b.d+.01,height:.16},scene);band.position.set(b.x,(b.base??0)+y,b.z);band.material=dark;band.freezeWorldMatrix();band.isPickable=false;}
  }
  // No additional shadow pass multiplied by 2–5 cameras. Source details and
  // existing avatar blob shadows remain; per-camera frustum culling stays on.
  scene.skipPointerMovePicking=true;
  // Static spatial selection, while avatars, effects and camera HUDs always
  // remain in the dynamic list and keep working after movement/late imports.
  const staticWorld=new Set(kept);const octree=scene.createOrUpdateSelectionOctree(48,3);
  octree.dynamicContent=scene.meshes.filter(m=>!staticWorld.has(m as Mesh));
  scene.onNewMeshAddedObservable.add(m=>{if(!staticWorld.has(m as Mesh))octree.dynamicContent.push(m);});
  // Asset containers temporarily add their source meshes to the scene. They
  // must leave the dynamic octree when removed, before visible instances load.
  scene.onMeshRemovedObservable.add(m=>{const i=octree.dynamicContent.indexOf(m);if(i>=0)octree.dynamicContent.splice(i,1);});

  scene.metadata={...scene.metadata,terminal:{partial:true,spatialBatches:kept.length-instanceGroups,instanceGroups,modelPrimitives:instances,triangles,materials:materials.size,loadMs:performance.now()-started,source:'terminal-play.glb',staticBatchMeters:32,stableAtlasGradients:(scene.getEngine() as Engine).webGLVersion>=2,shadows:'existing character blobs; no dynamic map shadow pass'}};
}
