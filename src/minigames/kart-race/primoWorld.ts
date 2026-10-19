import {Color3,Color4,DirectionalLight,HemisphericLight,Mesh,Scene,SceneLoader,StandardMaterial,TransformNode,Vector3} from '@babylonjs/core';
import type {Texture} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type {KartWorld} from './kartEnvironment';
import {PRIMO_SCALE} from './primoTrack';

export function buildPrimoWorld(scene:Scene):KartWorld{
  scene.clearColor=new Color4(.12,.15,.19,1);scene.ambientColor=new Color3(.21,.23,.27);
  const fill=new HemisphericLight('primoHallLight',Vector3.Up(),scene);fill.intensity=1.15;fill.groundColor=new Color3(.35,.38,.43);
  const sun=new DirectionalLight('primoWindowLight',new Vector3(-.25,-1,.32),scene);sun.intensity=.9;sun.diffuse=new Color3(1,.94,.84);
  return {sun,update:()=>{}};
}

/** Lazy original asset, original UVs and images. Static batches share materials
 * inside spatial cells, while roofs remain separate for culling and cutaway photos. */
export async function importPrimo(scene:Scene):Promise<void>{
  const result=await SceneLoader.ImportMeshAsync('','/assets/tracks/','primo_karting__karting_race_track.glb',scene);
  if(scene.isDisposed){for(const m of result.meshes)m.dispose();return;}
  const anchor=new TransformNode('primoAssetAnchor',scene),factor=PRIMO_SCALE/.0254;
  // FBX positions are Z-up. Sketchfab's node transforms perform the rotation;
  // reflect X/Z around the glTF LH root to match the surveyed XZ lap exactly.
  anchor.scaling.set(-factor,factor,-factor);for(const root of result.meshes.filter(m=>!m.parent))root.parent=anchor;
  const materials=new Map<NonNullable<Mesh['material']>,StandardMaterial>(),groups=new Map<string,Mesh[]>();
  for(const node of result.meshes){
    node.isPickable=false;node.checkCollisions=false;
    if(!(node instanceof Mesh)||!node.getTotalVertices())continue;
    const original=node.material;
    if(original){
      let material=materials.get(original);
      if(!material){
        const source=original as unknown as {albedoColor:Color3;albedoTexture?:Texture;bumpTexture?:Texture;emissiveColor:Color3;emissiveTexture?:Texture;alpha:number};
        material=new StandardMaterial('primo_'+original.name,scene);material.diffuseColor=source.albedoColor?.clone()??Color3.White();material.diffuseTexture=source.albedoTexture??null;
        material.bumpTexture=source.bumpTexture??null;material.emissiveTexture=source.emissiveTexture??null;material.emissiveColor=source.emissiveColor?.clone()??Color3.Black();material.ambientColor=new Color3(.28,.28,.3);
        material.alpha=source.alpha;material.backFaceCulling=false;material.specularColor=new Color3(.09,.1,.12);material.specularPower=24;
        if(material.diffuseTexture)material.diffuseTexture.anisotropicFilteringLevel=4;
        if(original.needAlphaBlending()){material.useAlphaFromDiffuseTexture=true;material.transparencyMode=StandardMaterial.MATERIAL_ALPHABLEND;}
        if(original.name==='asphalt'){
          material.specularColor.set(.035,.035,.035);material.emissiveColor.set(.18,.18,.18);
          // The source albedo is very dark indoors. A small texture-aware fill
          // keeps its grain and skid marks visible without replacing the asphalt.
          material.emissiveTexture=source.albedoTexture??null;
        }
        materials.set(original,material);
      }
      node.material=material;
    }
    node.receiveShadows=node.name.startsWith('1ROAD')||node.name.startsWith('1PIT');
    node.computeWorldMatrix(true);
    const roof=/roof/i.test(original?.name??'')?'roof':node.receiveShadows?'ground':'static';
    const bounds=node.getBoundingInfo().boundingBox,center=bounds.centerWorld;
    const lo=bounds.minimumWorld,hi=bounds.maximumWorld;
    const exterior=lo.x>65*PRIMO_SCALE||hi.x<-63*PRIMO_SCALE||lo.z>20*PRIMO_SCALE||hi.z<-20*PRIMO_SCALE;
    const key=`${roof}:${exterior?'exterior':'hall'}:${node.material?.uniqueId}:${Math.floor(center.x/220)}:${Math.floor(center.z/220)}`;
    let list=groups.get(key);if(!list){list=[];groups.set(key,list);}list.push(node);
  }
  const exteriorBatches:Mesh[]=[];
  for(const [key,list]of groups){
    const batch=list.length>1?Mesh.MergeMeshes(list,true,true,undefined,false,false):list[0];if(!batch)continue;
    batch.name='primoBatch:'+key;batch.metadata={primoRoof:key.startsWith('roof:'),originalMeshes:list.length};batch.isPickable=false;batch.checkCollisions=false;batch.receiveShadows=key.startsWith('ground:');batch.freezeWorldMatrix();
    if(key.includes(':exterior:'))exteriorBatches.push(batch);
  }
  for(const material of materials.values())material.freeze();
  // The opaque warehouse walls fully hide the separate surrounding buildings at
  // chase-camera height. Keep them for exterior/high views, but avoid drawing
  // them through the walls for every indoor viewport.
  scene.onBeforeCameraRenderObservable.add(camera=>{
    const p=camera.position,s=PRIMO_SCALE;
    const inside=p.y<10*s&&p.x>-55*s&&p.x<53*s&&p.z>-14*s&&p.z<13*s;
    for(const batch of exteriorBatches)batch.isVisible=!inside;
  });
  scene.skipPointerMovePicking=true;
}
