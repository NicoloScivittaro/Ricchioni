import {Color3,Color4,DirectionalLight,DynamicTexture,HemisphericLight,ImageProcessingConfiguration,Mesh,MeshBuilder,Scene,SceneLoader,StandardMaterial,SubMesh,TransformNode,Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type {KartWorld} from './kartEnvironment';
import type {SydneyTrack} from './sydneyTrack';

export function buildSydneyWorld(scene:Scene):KartWorld{
  // The source has no image textures. Preserve its vertex palette while avoiding
  // clipped white road surfaces under the combined hemisphere and sun lights.
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=.75;
  scene.clearColor=new Color4(.57,.8,.95,1);scene.ambientColor=new Color3(.15,.17,.2);
  scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogColor=new Color3(.61,.81,.92);scene.fogStart=650;scene.fogEnd=2300;
  const sky=new HemisphericLight('sydneySky',Vector3.Up(),scene);sky.intensity=.85;sky.groundColor=new Color3(.38,.43,.48);
  const sun=new DirectionalLight('sydneySun',new Vector3(-.45,-1,.25),scene);sun.intensity=1.1;sun.diffuse=new Color3(1,.96,.86);
  return {sun,update:()=>{}};
}

/** Retain every supplied material colour and vertex colour. Spatial submeshes allow
 * Babylon to cull large city/building batches separately for each viewport. */
export async function importSydney(scene:Scene,track:SydneyTrack):Promise<void>{
  const result=await SceneLoader.ImportMeshAsync('','/assets/tracks/','sydney_sprint.glb',scene);
  if(scene.isDisposed){for(const mesh of result.meshes)mesh.dispose();return;}
  const anchor=new TransformNode('sydneyAssetAnchor',scene);
  // Sketchfab parents contribute 0.01; Babylon's LH glTF root reflects X.
  anchor.scaling.set(-65,65,65);
  for(const root of result.meshes.filter(m=>!m.parent))root.parent=anchor;
  const converted=new Map<NonNullable<Mesh['material']>,StandardMaterial>();
  for(const imported of result.meshes){
    imported.isPickable=false;imported.checkCollisions=false;
    if(imported.name.includes('ShadowCollision')){imported.setEnabled(false);continue;}
    if(!(imported instanceof Mesh)||!imported.getTotalVertices())continue;
    const original=imported.material;
    if(original){
      let mat=converted.get(original);
      if(!mat){
        const source=original as unknown as {albedoColor?:Color3;emissiveColor?:Color3};
        mat=new StandardMaterial(original.name+'_sydney',scene);mat.diffuseColor=source.albedoColor?.clone()??Color3.White();mat.emissiveColor=source.emissiveColor?.clone()??Color3.Black();
        mat.specularColor=new Color3(.07,.08,.1);mat.backFaceCulling=false;mat.twoSidedLighting=true;
        if(original.name.includes('Sea01')){mat.specularColor=new Color3(.48,.65,.75);mat.specularPower=64;mat.emissiveColor.set(.015,.04,.06);}
        if(original.name.includes('Window')){mat.specularColor=new Color3(.4,.5,.6);mat.specularPower=48;}
        if(original.name.includes('Emission'))mat.emissiveColor.set(.8,.68,.35);
        if(original.name.includes('VR1')){mat.disableLighting=true;mat.emissiveColor=mat.diffuseColor.clone();}
        converted.set(original,mat);
      }
      imported.material=mat;
    }
    imported.useVertexColors=true;imported.hasVertexAlpha=false;
    // The exported sea colours are all RGBA=0: they were masks for the original
    // game's water shader. Retain the declared blue material rather than multiply it by black.
    if(original?.name.includes('Sea01'))imported.useVertexColors=false;
    imported.receiveShadows=/N_Road|N_Operahouse.*Road/.test(imported.name);
    const matrix=imported.computeWorldMatrix(true),positions=imported.getVerticesData('position'),indices=imported.getIndices();
    // Exact duplicate coloured/UV faces fight for the same depth. Remove only
    // attribute-identical copies; keep every city part and its original palette.
    if(positions&&indices&&/FountainTop|N_Ground_M_Cmn_MainColor|FarBuildingSet_M_Mobs1_Window|TreeSet|TreeBlock_M_Cmn/.test(imported.name)){
      const colors=imported.getVerticesData('color'),uv=imported.getVerticesData('uv'),seen=new Set<string>(),clean:number[]=[];
      for(let i=0;i<indices.length;i+=3){
        const face=[indices[i],indices[i+1],indices[i+2]],key=face.map(v=>[...positions.slice(v*3,v*3+3),...(colors?.slice(v*4,v*4+4)??[]),...(uv?.slice(v*2,v*2+2)??[])].map(n=>Math.round(n*10000)).join(',')).sort().join('|');
        if(seen.has(key))continue;seen.add(key);clean.push(...face);
      }
      const removed=(indices.length-clean.length)/3;if(removed){imported.setIndices(clean);scene.metadata={...scene.metadata,sydneyDuplicateFacesRemoved:(scene.metadata?.sydneyDuplicateFacesRemoved??0)+removed};}
    }
    if(original?.name.includes('VR1')){
      // The source sky radius (~2,800 m) was outside every 1,200 m race camera.
      // A camera-centred sky preserves its vertex-colour panorama in all views.
      const world=imported.getWorldMatrix().clone();imported.makeGeometryUnique();imported.bakeTransformIntoVertices(world);imported.parent=null;imported.position.setAll(0);imported.scaling.setAll(1);imported.rotationQuaternion=null;imported.rotation.setAll(0);
      imported.infiniteDistance=true;imported.alwaysSelectAsActiveMesh=true;imported.material!.disableDepthWrite=true;imported.computeWorldMatrix(true);continue;
    }
    const visibleIndices=imported.getIndices();
    if(positions&&visibleIndices&&visibleIndices.length>1500){
      const groups=new Map<string,number[]>();
      for(let i=0;i<visibleIndices.length;i+=3){
        let x=0,y=0,z=0;for(let j=0;j<3;j++){const v=visibleIndices[i+j]*3;x+=positions[v];y+=positions[v+1];z+=positions[v+2];}
        const p=Vector3.TransformCoordinates(new Vector3(x/3,y/3,z/3),matrix),key=`${Math.floor(p.x/130)},${Math.floor(p.z/130)}`;
        let list=groups.get(key);if(!list){list=[];groups.set(key,list);}list.push(visibleIndices[i],visibleIndices[i+1],visibleIndices[i+2]);
      }
      const sorted:number[]=[];for(const list of groups.values())sorted.push(...list);
      imported.setIndices(sorted);imported.releaseSubMeshes();let start=0;
      for(const list of groups.values()){new SubMesh(0,0,imported.getTotalVertices(),start,list.length,imported);start+=list.length;}
    }
    imported.freezeWorldMatrix();
  }
  for(const mat of converted.values())mat.freeze();
  buildSydneyMarkers(scene,track);
}

/** Low, visible race fences follow exactly the same corridor as collision. They
 * close unused city junctions without hiding landmarks or creating new asphalt. */
function buildSydneyMarkers(scene:Scene,track:SydneyTrack):void{
  const rampMaterial=new StandardMaterial('sydneyAccessRamp',scene);rampMaterial.diffuseColor=new Color3(.61,.65,.69);rampMaterial.specularColor=new Color3(.08,.08,.08);
  for(const ramp of track.accessRamps){
    const paths=[-1,1].map(side=>{const points:Vector3[]=[];for(let s=ramp.start;s<ramp.end;s+=.5)points.push(track.worldPoint(s,side*track.widthAt(s)/2,.015));points.push(track.worldPoint(ramp.end,side*track.widthAt(ramp.end)/2,.015));return points;});
    const deck=MeshBuilder.CreateRibbon('sydneyStairAccessRamp',{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},scene);deck.material=rampMaterial;deck.isPickable=false;deck.receiveShadows=true;deck.freezeWorldMatrix();
    for(const edge of paths){
      const side=MeshBuilder.CreateRibbon('sydneyAccessDeckEdge',{pathArray:[edge,edge.map(p=>p.subtract(new Vector3(0,.35,0)))],sideOrientation:Mesh.DOUBLESIDE},scene);side.material=rampMaterial;side.isPickable=false;side.freezeWorldMatrix();
    }
  }
  const fence=new StandardMaterial('sydneyRaceFence',scene);fence.diffuseColor=new Color3(.88,.94,.98);fence.emissiveColor=new Color3(.07,.09,.1);
  const end=track.totalLength;
  for(let s=0;s<end;s+=65)for(const side of [-1,1]){
    let path:Vector3[]=[];
    const flush=()=>{if(path.length>1){const m=MeshBuilder.CreateTube('sydneyCorridorFence',{path,radius:.14,tessellation:4},scene);m.material=fence;m.isPickable=false;m.freezeWorldMatrix();}path=[];};
    for(let d=s;d<=Math.min(s+65,end)+.01;d+=2){if(track.gapAt(d,1)){flush();continue;}path.push(track.worldPoint(d,side*(track.widthAt(d)/2+.55),.6));}flush();
  }
  const sign=(label:string,s:number,width=10)=>{
    const texture=new DynamicTexture('sydneySign',{width:1024,height:192},scene,false),c=texture.getContext() as CanvasRenderingContext2D;
    c.fillStyle='#12384e';c.fillRect(0,0,1024,192);c.fillStyle='#62e0ff';c.fillRect(0,176,1024,16);c.fillStyle='#ffffff';c.textAlign='center';c.font='bold 68px Arial';c.fillText(label,512,112);texture.update();
    const mat=new StandardMaterial('sydneySign',scene);mat.diffuseTexture=texture;mat.emissiveTexture=texture;mat.disableLighting=true;mat.backFaceCulling=false;
    const mesh=MeshBuilder.CreatePlane('sydneyDirectionSign',{width,height:width*192/1024},scene);mesh.position.copyFrom(track.worldPoint(s,track.widthAt(s)/2+2.5,3.8));mesh.rotation.y=track.tangentAngleAt(s);mesh.material=mat;mesh.isPickable=false;mesh.freezeWorldMatrix();
  };
  sign('SYDNEY SPRINT · 3 GIRI',0,12);
  sign('OPERA HOUSE  →',track.atSurvey(5),8);
  sign('ALI APERTE · VERSO IL PONTE',track.gaps[0].launch-18,12);
  sign('HARBOUR BRIDGE',track.gaps[0].landing+12,10);
  const stripeMat=new StandardMaterial('sydneyFinishLine',scene);stripeMat.diffuseColor=Color3.White();stripeMat.emissiveColor=new Color3(.3,.3,.3);
  const finish=MeshBuilder.CreateBox('sydneyStartFinish',{width:track.widthAt(0),height:.025,depth:.6},scene);finish.position.copyFrom(track.worldPoint(0,0,.09));finish.rotation.y=track.tangentAngleAt(0);finish.material=stripeMat;finish.isPickable=false;
  // Short open brackets identify the real receiving road. No floating portal.
  const guideMat=new StandardMaterial('sydneyLandingBrackets',scene);guideMat.emissiveColor=new Color3(.25,.95,.75);guideMat.disableLighting=true;
  for(const s of [track.gaps[0].landing+1,track.gaps[0].landing+5,track.gaps[0].landing+9])for(const side of [-1,1]){
    const m=MeshBuilder.CreateBox('sydneyLandingBracket',{width:.15,height:.04,depth:2.6},scene);m.position.copyFrom(track.worldPoint(s,side*(track.widthAt(s)/2-.7),.12));m.rotation.y=track.tangentAngleAt(s);m.material=guideMat;m.isPickable=false;
  }
}
