import type {Engine} from '@babylonjs/core';
import {Color3,Color4,DirectionalLight,DynamicTexture,HemisphericLight,Layer,ImageProcessingConfiguration,Mesh,MeshBuilder,PBRMaterial,Scene,SceneLoader,ShaderMaterial,StandardMaterial,TransformNode,Texture} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {terminalAtlasMaterial} from './terminalAtlasMaterial';
import type {TerminalAtlas} from './terminalAtlasMaterial';
import type {Aabb} from '../../shared/fpsMap';
/** Shared TV/phone scene. Static geometry and source GPU instance transforms
 * are prepared offline; gameplay collision data is loaded separately. */
export async function buildTerminalWorld(scene:Scene):Promise<void>{
  const started=performance.now();scene.clearColor=new Color4(.69,.73,.76,1);scene.metadata={...scene.metadata,terminalWeaponLighting:true};
  // A shared background gradient replaces the flat cyan void, with no sky
  // geometry, extra depth pass or collision surface. Each viewport uses it.
  const skyTexture=new DynamicTexture('terminalSkyGradient',{width:8,height:256},scene,false);
  const ctx=skyTexture.getContext(),gradient=ctx.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#8295a5');gradient.addColorStop(.6,'#bdc9d1');gradient.addColorStop(1,'#e0e2df');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,8,256);skyTexture.update(false);
  const sky=new Layer('terminalSky',null,scene,true);sky.texture=skyTexture;scene.ambientColor=new Color3(.23,.24,.26);
  // Only Terminal needs extra fill for the recovered, unbaked source textures.
  for(const light of scene.lights){if(light instanceof HemisphericLight)light.intensity=1.2;if(light instanceof DirectionalLight)light.intensity=1.5;}
  scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.05;
  const [result,collision,layouts]=await Promise.all([SceneLoader.ImportMeshAsync('','/assets/fps/terminal/','terminal-fast.glb',scene),fetch('/assets/fps/terminal/render-config.json').then(r=>{if(!r.ok)throw new Error('Terminal boundary HTTP '+r.status);return r.json() as Promise<{barriers:Aabb[];accessSteps?:Aabb[]}>;}),fetch('/assets/fps/terminal/atlas.json').then(r=>{if(!r.ok)throw new Error('Terminal atlas HTTP '+r.status);return r.json() as Promise<TerminalAtlas[]>;})]);
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
  // Offline batches avoid per-prop cloning/merging. Canonical world-space
  // meshes keep the same winding and instance matrices as the proven renderer.
  const kept:Mesh[]=[];let triangles=0,instanceGroups=0,instances=0;
  for(const imported of result.meshes){
    if(!imported.getTotalVertices())continue;
    if(!(imported instanceof Mesh))throw new Error('Terminal: geometria non preelaborata');
    imported.computeWorldMatrix(true);const world=imported.getWorldMatrix().clone();
    const mesh=new Mesh(imported.name,scene);imported.geometry!.applyToMesh(mesh);
    mesh.material=imported.material?material(imported.material):null;
    mesh.isPickable=false;mesh.checkCollisions=false;
    const count=imported.thinInstanceCount;triangles+=imported.getTotalIndices()/3*Math.max(1,count);
    if(count){
      instanceGroups++;instances+=count;
      const ext=imported.geometry!.extend,size=ext.maximum.subtract(ext.minimum).length();
      const matrices=imported.thinInstanceGetWorldMatrices().flatMap(m=>Array.from(m.multiply(world).asArray()));
      mesh.thinInstanceSetBuffer('matrix',new Float32Array(matrices),16,true);mesh.thinInstanceRefreshBoundingInfo(true);
      mesh.addLODLevel(size<.7?24:size<2?38:size<4?58:size<10?95:190,null);
    }else{
      mesh.makeGeometryUnique();mesh.bakeTransformIntoVertices(world);
    }
    mesh.freezeWorldMatrix();mesh.doNotSyncBoundingInfo=true;kept.push(mesh);
  }
  coordinates.dispose();for(const node of result.transformNodes)if(!node.isDisposed())node.dispose();
  for(const original of materials.keys())original.dispose(false,false);for(const m of materials.values())m.freeze();
  // These visible treads use exactly the boxes exported into arena.json.
  const stepMaterial=new StandardMaterial('terminalRearBoardingSteps',scene);
  stepMaterial.diffuseTexture=new Texture('/assets/fps/terminal/boarding-metal.jpg',scene);stepMaterial.diffuseColor=new Color3(.65,.69,.73);stepMaterial.specularColor.setAll(.12);
  const steps=(collision.accessSteps??[]).map((s,i)=>{const m=MeshBuilder.CreateBox('terminal:rear-step:'+i,{width:s.w,depth:s.d,height:s.h},scene);m.position.set(s.x,(s.base??0)+s.h/2,s.z);m.material=stepMaterial;return m;});
  if(steps.length){const mesh=Mesh.MergeMeshes(steps,true,true);if(mesh){mesh.name='terminal:rear-boarding-stairs';mesh.isPickable=false;mesh.freezeWorldMatrix();kept.push(mesh);}}
  // Neutral service perimeter, retaining every existing collision volume; its exact volumes are shared
  // with authoritative movement/shot data. These are not recovered CoD assets.
  const fence=new StandardMaterial('terminalArenaBoundary',scene);fence.diffuseTexture=stepMaterial.diffuseTexture;fence.diffuseColor=new Color3(.46,.5,.53);fence.specularColor.setAll(.04);
  const dark=new StandardMaterial('terminalArenaBoundaryStripe',scene);dark.diffuseColor=new Color3(.11,.14,.17);
  for(const b of collision.barriers){
    const m=MeshBuilder.CreateBox('terminal:limite-visibile',{width:b.w,depth:b.d,height:b.h},scene);m.position.set(b.x,(b.base??0)+b.h/2,b.z);m.material=fence;m.freezeWorldMatrix();m.isPickable=false;
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

  // Five views otherwise evaluate every other player's detailed viewmodel
  // before Babylon reaches its layer-mask check. Filter only camera layers
  // here; normal frustum/LOD selection and the octree's live dynamic list stay
  // authoritative, including late weapon imports and temporary effects.
  const selectCandidates=scene.getActiveMeshCandidates.bind(scene);
  const candidates:{data:typeof scene.meshes;length:number}={data:[],length:0};
  scene.getActiveMeshCandidates=()=>{
    const selected=selectCandidates(),mask=scene.activeCamera?.layerMask??0x0fffffff;
    let count=0;
    for(let i=0;i<selected.length;i++){
      const mesh=selected.data[i];
      if((mesh.layerMask&mask)!==0)candidates.data[count++]=mesh;
    }
    candidates.data.length=count;candidates.length=count;
    return candidates;
  };

  scene.metadata={...scene.metadata,terminal:{partial:true,spatialBatches:kept.length-instanceGroups,instanceGroups,modelPrimitives:instances,triangles,materials:materials.size,loadMs:performance.now()-started,source:'terminal-fast.glb',staticBatchMeters:64,stableAtlasGradients:(scene.getEngine() as Engine).webGLVersion>=2,shadows:'existing character blobs; no dynamic map shadow pass'}};
}
