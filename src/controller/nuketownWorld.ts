import {Color3,Color4,Mesh,InstancedMesh,MeshBuilder,Scene,SceneLoader,StandardMaterial,TransformNode,Vector3,VertexBuffer,VertexData,ShadowGenerator,DirectionalLight} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {NUKETOWN_BARRIERS} from '../minigames/fps/nuketownArena';
import {getQualityLevel} from '../core/quality';

/** Original map, shared TV/phone renderer. Loading failures stay visible: never
 * silently replace Nuketown with the old procedural arena. */
export async function buildNuketownWorld(scene:Scene):Promise<void>{
  scene.clearColor=new Color4(.56,.76,.91,1);scene.ambientColor=new Color3(.18,.2,.24);
  const result=await SceneLoader.ImportMeshAsync('','/assets/fps/','nuketown_from_call_of_duty_cod_warzonecodm.glb',scene);
  if(scene.isDisposed){for(const mesh of result.meshes)mesh.dispose();return;}
  const anchor=new TransformNode('nuketownSource',scene);anchor.scaling.set(-.025,.025,.025);anchor.position.set(-.75,.018,0);
  for(const m of result.meshes.filter(m=>!m.parent))m.parent=anchor;
  const materials=new Map<NonNullable<Mesh['material']>,StandardMaterial>(),groups=new Map<string,Mesh[]>();
  let importedPrimitives=0,bakedTriangles=0;
  for(const imported of result.meshes){
    if(!imported.getTotalVertices())continue;
    const source=imported instanceof InstancedMesh?imported.sourceMesh:imported;
    if(!(source instanceof Mesh))continue;
    imported.computeWorldMatrix(true);
    // The loader instances shared cube geometry, including the large lawns.
    // Extract before changing source meshes, so every instance keeps its own
    // source transform and no shared geometry gets baked repeatedly.
    const data=VertexData.ExtractFromMesh(source,true,true);data.transform(imported.getWorldMatrix());
    const node=new Mesh('nuketownStatic:'+imported.name,scene);data.applyToMesh(node);
    node.isPickable=false;node.checkCollisions=false;
    importedPrimitives++;bakedTriangles+=node.getTotalIndices()/3;
    const original=imported.material;
    if(original){
      let material=materials.get(original);
      if(!material){
        const source=original as unknown as {albedoColor:Color3;emissiveColor:Color3};
        material=new StandardMaterial('nuketown_'+original.name,scene);
        material.diffuseColor=(source.albedoColor??Color3.White()).toGammaSpace();material.emissiveColor=source.emissiveColor?.scale(.12)??Color3.Black();
        material.specularColor.set(.035,.035,.035);material.backFaceCulling=false;material.ambientColor.set(.35,.35,.35);materials.set(original,material);
      }
      node.material=material;
    }
    // Bake the exact source hierarchy before batching; dispose the 2,751-node
    // import hierarchy afterwards rather than traversing it for five cameras.
    node.computeWorldMatrix(true);
    const c=node.getBoundingInfo().boundingBox.centerWorld.clone();
    if(!node.isVerticesDataPresent(VertexBuffer.NormalKind))node.createNormals(false);
    const k=`${node.material?.uniqueId}:${Math.floor(c.x/12)}:${Math.floor(c.z/16)}`;
    const list=groups.get(k);if(list)list.push(node);else groups.set(k,[node]);
  }
  const batches:Mesh[]=[];
  for(const [k,list]of groups){
    const batch=list.length>1?Mesh.MergeMeshes(list,true,true,undefined,false,false):list[0];if(!batch)continue;
    batch.name='nuketownBatch:'+k;batch.isPickable=false;batch.receiveShadows=true;batch.freezeWorldMatrix();batches.push(batch);
  }
  anchor.dispose();
  for(const original of materials.keys())original.dispose();for(const material of materials.values())material.freeze();
  const closed=new StandardMaterial('nuketownConstruction',scene);closed.diffuseColor=Color3.FromHexString('#d5a52d');closed.specularColor.setAll(.02);
  const stripe=new StandardMaterial('nuketownBarrierStripe',scene);stripe.diffuseColor=Color3.FromHexString('#272b2c');
  const pieces:Mesh[]=[],stripes:Mesh[]=[];
  for(const b of NUKETOWN_BARRIERS){
    const m=MeshBuilder.CreateBox('areaClosed',{width:b.w,height:b.h,depth:b.d},scene);m.position.set(b.x,b.h/2,b.z);pieces.push(m);
    for(const sign of [-1,1]){const p=MeshBuilder.CreateBox('closedStripe',{width:b.w+.012,height:.14,depth:b.d+.012},scene);p.position.set(b.x,b.h*(sign<0?.3:.78),b.z);stripes.push(p);}
  }
  for(const [list,mat]of [[pieces,closed],[stripes,stripe]]as const){const merged=Mesh.MergeMeshes([...list],true,true,undefined,false,false);if(merged){merged.material=mat;merged.isPickable=false;merged.freezeWorldMatrix();}}
  // Static-only shadow map renders once, independent of split-screen count.
  const sun=scene.lights.find(l=>l instanceof DirectionalLight)as DirectionalLight|undefined;
  if(sun&&getQualityLevel()!=='low'){
    sun.position=new Vector3(-30,60,-30);sun.shadowMinZ=1;sun.shadowMaxZ=180;
    sun.autoCalcShadowZBounds=true;sun.shadowOrthoScale=.2;
    const shadow=new ShadowGenerator(1024,sun);shadow.bias=.002;shadow.normalBias=.02;shadow.setDarkness(.33);shadow.usePercentageCloserFiltering=true;
    for(const batch of batches)shadow.addShadowCaster(batch);const map=shadow.getShadowMap();if(map)map.refreshRate=0;
  }
  scene.skipPointerMovePicking=true;scene.metadata={...scene.metadata,nuketown:{sourceMeshes:1374,importedPrimitives,batches:batches.length,triangles:bakedTriangles,scale:.025}};
}
