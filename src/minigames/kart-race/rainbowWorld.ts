import {buildRainbowCosmos} from './rainbowCosmos';
import {predictGlideLanding} from './glideDynamics';
import type {KartState} from './raceTypes';
import {Color3,Color4,DirectionalLight,HemisphericLight,Mesh,MeshBuilder,Scene,SceneLoader,StandardMaterial,TransformNode,Vector3,DynamicTexture,VertexData} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type {KartWorld} from './kartEnvironment';
import {RainbowTrack,RAINBOW_SCALE} from './rainbowTrack';
import type {GlideTrack} from './rainbowTrack';

export function buildRainbowWorld(scene:Scene,track:RainbowTrack):KartWorld {
  const cosmos=buildRainbowCosmos(scene);
  scene.clearColor=new Color4(.025,.018,.085,1);scene.ambientColor=new Color3(.3,.32,.45);
  const sky=new HemisphericLight('rainbowSky',Vector3.Up(),scene);sky.intensity=.8;sky.groundColor=new Color3(.2,.15,.35);
  const sun=new DirectionalLight('rainbowSun',new Vector3(-.4,-1,.3),scene);sun.intensity=1.05;
  const mat=new StandardMaterial('glideGuideMaterial',scene);mat.diffuseColor=new Color3(.2,.85,1);mat.emissiveColor=new Color3(.08,.45,.7);mat.specularColor=Color3.Black();
  const parts:Mesh[]=[];
  for(const gap of track.gaps){
    for(const s of [gap.launch-9,gap.launch-5,gap.launch-1,gap.landing+2,gap.landing+6]){
      const pad=MeshBuilder.CreateBox('glidePad',{width:11,height:.035,depth:.65},scene);pad.position.copyFrom(track.worldPoint(s,0,.08));pad.rotation.y=track.tangentAngleAt(s);parts.push(pad);
    }
    for(const s of [gap.launch-14,gap.landing+9])for(const side of [-1,1]){
      const pole=MeshBuilder.CreateBox('glideBeacon',{width:.3,height:6,depth:.3},scene);pole.position.copyFrom(track.worldPoint(s,side*7.7,3));parts.push(pole);
    }
    // Landing runway: open brackets frame the surface without painting a bridge over the gap.
    for(const side of [-1,1])for(const ahead of [1,5,9]){
      const edge=MeshBuilder.CreateBox('landingRunway',{width:.24,height:.06,depth:2.8},scene);
      edge.position.copyFrom(track.worldPoint(gap.landing+ahead,side*5.9,.13));edge.rotation.y=track.tangentAngleAt(gap.landing+ahead);parts.push(edge);
    }
    for(const side of [-1,1]){
      const upright=MeshBuilder.CreateBox('landingFrame',{width:.18,height:5.4,depth:.18},scene);upright.position.copyFrom(track.worldPoint(gap.landing+3,side*7.3,2.7));parts.push(upright);
      const cap=MeshBuilder.CreateBox('landingFrameCorner',{width:2.2,height:.18,depth:.18},scene);cap.position.copyFrom(track.worldPoint(gap.landing+3,side*6.3,5.3));cap.rotation.y=track.tangentAngleAt(gap.landing+3);parts.push(cap);
    }
    // Sparse side chevrons: the flight corridor remains open in every viewport.
    const count=gap.landing-gap.launch>100?3:1;
    for(let i=1;i<=count;i++)for(const side of [-1,1]){
      const s=gap.launch+(gap.landing-gap.launch)*i/(count+1);
      const path=[track.worldPoint(s-1,side*7,track.flightHeightAt(s)+1.5),track.worldPoint(s,side*6.4,track.flightHeightAt(s)+2),track.worldPoint(s+1,side*7,track.flightHeightAt(s)+1.5)];
      parts.push(MeshBuilder.CreateTube('glideEdgeChevron',{path,radius:.065,tessellation:4},scene));
    }
    const tex=new DynamicTexture('glideInstruction',{width:1024,height:256},scene,false);const c=tex.getContext() as CanvasRenderingContext2D;
    c.fillStyle='#101432';c.fillRect(0,0,1024,256);c.fillStyle='#6cfff1';c.font='bold 64px Arial';c.textAlign='center';c.fillText(gap.landing-gap.launch>100?'VOLO STELLARE':'SALTO AURORA',512,90);c.fillStyle='#ffffff';c.font='40px Arial';c.fillText('STERZA · VERDE = ATTERRI',512,170);tex.update();
    const signMat=new StandardMaterial('glideSign',scene);signMat.diffuseTexture=tex;signMat.emissiveTexture=tex;signMat.disableLighting=true;signMat.backFaceCulling=false;
    const sign=MeshBuilder.CreatePlane('glideSign',{width:13,height:3.25},scene);sign.position.copyFrom(track.worldPoint(gap.launch-24,10,5));sign.rotation.y=track.tangentAngleAt(gap.launch-24);sign.material=signMat;sign.isPickable=false;
  }
  const merged=Mesh.MergeMeshes(parts,true,true,undefined,false);if(merged){merged.material=mat;merged.isPickable=false;merged.freezeWorldMatrix();}
  return {sun,update:time=>cosmos.update(time)};
}

/** Default LH glTF loader converts original XY/Z-up to Babylon XZ/Y-up. */
export async function importRainbow(scene:Scene,track:RainbowTrack):Promise<void>{
  const result=await SceneLoader.ImportMeshAsync('', '/assets/tracks/', 'gba_rainbow_road.glb',scene);
  if(scene.isDisposed){for(const mesh of result.meshes)mesh.dispose();return;}
  const anchor=new TransformNode('rainbowAssetAnchor',scene);anchor.scaling.set(-RAINBOW_SCALE,RAINBOW_SCALE,-RAINBOW_SCALE);anchor.position.set(-800,40,-240);
  const roots=result.meshes.filter(m=>!m.parent);for(const root of roots)root.parent=anchor;
  // Replace the large opaque star billboard with the sparse original guide rings:
  // at chase-camera height it obscures the landing platform.
  for(const mesh of result.meshes)if(mesh.material?.name.startsWith('M_StarRing')||mesh.material?.name.startsWith('M_Sfcmc_VR'))mesh.setEnabled(false);
  const probes=Array.from({length:Math.ceil(track.totalLength/2)},(_,i)=>({s:i*2,p:track.positionAt(i*2),r:track.rightAt(i*2)}));
  for(const mesh of result.meshes){
    if(!mesh.material?.name.startsWith('Nila_1'))continue;
    // The supplied UV transform repeats 128 times and aliases at kart height.
    // Reproject only the driving surface; retain its original embedded tile artwork.
    const positions=mesh.getVerticesData('position');if(!positions)continue;
    const matrix=mesh.computeWorldMatrix(true),uv:number[]=[];
    for(let i=0;i<positions.length;i+=3){
      const p=Vector3.TransformCoordinates(new Vector3(positions[i],positions[i+1],positions[i+2]),matrix);let best=Infinity,probe=probes[0];
      for(const q of probes){const d=(q.p.x-p.x)**2+(q.p.z-p.z)**2;if(d<best){best=d;probe=q;}}
      const lateral=(p.x-probe.p.x)*probe.r.x+(p.z-probe.p.z)*probe.r.z;
      uv.push(.5+lateral/14.4,probe.s/32);
    }
    // Unwrap the finish seam separately on each disconnected road piece, so a
    // triangle never interpolates across an entire lap of repeated artwork.
    const indices=mesh.getIndices(),adj=Array.from({length:uv.length/2},()=>new Set<number>()),seen=new Set<number>(),period=track.totalLength/32;
    if(indices)for(let i=0;i<indices.length;i+=3)for(let a=0;a<3;a++){const x=indices[i+a],y=indices[i+(a+1)%3];adj[x].add(y);adj[y].add(x);}
    for(let start=0;start<adj.length;start++)if(!seen.has(start)){
      const queue=[start];seen.add(start);for(let i=0;i<queue.length;i++)for(const next of adj[queue[i]])if(!seen.has(next)){
        uv[next*2+1]+=Math.round((uv[queue[i]*2+1]-uv[next*2+1])/period)*period;seen.add(next);queue.push(next);
      }
    }
    mesh.setVerticesData('uv',uv);
    const source=mesh.material as unknown as {albedoTexture?:import('@babylonjs/core').Texture;emissiveTexture?:import('@babylonjs/core').Texture};
    const road=new StandardMaterial('rainbowRoadTiles',scene);road.diffuseColor=Color3.White();road.specularColor=new Color3(.32,.38,.46);road.specularPower=48;road.emissiveColor=new Color3(.48,.5,.57);
    for(const [key,texture]of [['diffuseTexture',source.albedoTexture],['emissiveTexture',source.emissiveTexture]] as const){
      if(!texture)continue;const t=texture.clone();if(!t)continue;t.uScale=t.vScale=1;t.uOffset=t.vOffset=t.wAng=0;t.uRotationCenter=t.vRotationCenter=0;t.anisotropicFilteringLevel=4;road[key]=t;
    }
    mesh.material=road;road.backFaceCulling=false;
  }
  const converted=new Map<NonNullable<Mesh['material']>,StandardMaterial>();
  for(const mesh of result.meshes){
    const original=mesh.material;if(!original||original.getClassName()!=='PBRMaterial'||!mesh.isEnabled())continue;
    let material=converted.get(original);
    if(!material){
      const source=original as unknown as {albedoTexture?:import('@babylonjs/core').Texture;albedoColor:Color3;emissiveTexture?:import('@babylonjs/core').Texture;emissiveColor:Color3};
      material=new StandardMaterial(original.name+'_arcade',scene);material.diffuseColor=source.albedoColor.clone();material.diffuseTexture=source.albedoTexture??null;material.specularColor=new Color3(.06,.06,.08);
      material.emissiveTexture=source.emissiveTexture??null;material.emissiveColor=source.emissiveColor.clone();material.backFaceCulling=false;
      if(original.name.startsWith('M_Sfcmc_VR')){material.disableLighting=true;material.emissiveTexture=source.albedoTexture??null;material.emissiveColor=new Color3(.65,.72,.85);}
      if(original.name.includes('Gold')||original.name.startsWith('Nila_2')){material.specularColor=new Color3(.65,.42,.16);material.specularPower=48;material.emissiveColor=new Color3(.12,.07,.015);}
      converted.set(original,material);
    }
    mesh.material=material;
  }
  for(const mesh of result.meshes){mesh.isPickable=false;mesh.receiveShadows=mesh.material?.name==='rainbowRoadTiles'||!!mesh.material?.name.startsWith('Nila_');mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();}
  for(const material of scene.materials.filter(m=>result.meshes.some(mesh=>mesh.material===m))){material.backFaceCulling=false;material.freeze();}
}

/** Swept foils and fading tip trails: one mesh per side, reused for the whole race. */
export class GlideWings {
  private wings:Mesh[]=[];private supports:Mesh;private open=0;private time=0;
  constructor(scene:Scene,parent:TransformNode,color:string){
    const supports:Mesh[]=[];
    for(const side of [-1,1]){
      const strut=MeshBuilder.CreateCylinder('glideStrut',{height:.86,diameter:.09,tessellation:6},scene);strut.position.set(side*.72,1.55,-.72);strut.rotation.z=-side*.45;supports.push(strut);
      const hinge=MeshBuilder.CreateCylinder('glideHinge',{height:.22,diameter:.24,tessellation:8},scene);hinge.position.set(side*.9,1.93,-.72);hinge.rotation.z=Math.PI/2;supports.push(hinge);
    }
    this.supports=Mesh.MergeMeshes(supports,true,true)!;this.supports.name='glideMechanicalSupports';this.supports.parent=parent;this.supports.isPickable=false;
    const metal=new StandardMaterial('glideMountMetal',scene);metal.diffuseColor=new Color3(.19,.26,.34);metal.specularColor=new Color3(.55,.7,.85);this.supports.material=metal;this.supports.setEnabled(false);
    const mat=new StandardMaterial('glideFoil',scene);mat.diffuseColor=Color3.FromHexString(color);mat.emissiveColor=new Color3(.16,.46,.58);mat.specularColor=new Color3(.7,.9,1);mat.backFaceCulling=false;
    for(const side of [-1,1]){
      const wing=new Mesh('glideWing',scene),data=new VertexData();
      // A swept, shallow V section rather than flat rectangular planks.
      const positions=[-.95,0,.62, 1.35,.08,-.15, 1.05,.02,-.95, -.9,0,-.42, .05,.14,.08,
        1.02,.025,-.85,1.12,.025,-.85,1.17,.025,-4.3,1.01,.025,-4.3,
        .65,.025,-.75,.71,.025,-.75,.76,.025,-3.2,.64,.025,-3.2];
      for(let i=0;i<positions.length;i+=3)positions[i]*=side;
      const indices=[0,1,4,1,2,4,2,3,4,3,0,4,5,6,7,5,7,8,9,10,11,9,11,12],normals:number[]=[],colors:number[]=[];
      if(side>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
      for(let i=0;i<13;i++)colors.push(1,1,1,i===7||i===8||i===11||i===12?0:i>=5?.6:.94);
      VertexData.ComputeNormals(positions,indices,normals);data.positions=positions;data.indices=indices;data.normals=normals;data.colors=colors;data.applyToMesh(wing);wing.hasVertexAlpha=true;
      wing.parent=parent;wing.position.set(side*.95,1.98,-.85);wing.material=mat;wing.isPickable=false;wing.setEnabled(false);this.wings.push(wing);
    }
  }
  update(dt:number,gliding:boolean,steer:number):void {
    this.time+=dt;this.open+=(Number(gliding)-this.open)*(1-Math.exp(-dt*11));
    this.supports.setEnabled(this.open>.015);
    this.wings.forEach((wing,i)=>{const side=i?1:-1;wing.setEnabled(this.open>.015);wing.scaling.x=Math.max(.01,this.open);wing.rotation.z=side*(1-this.open)*1.3-steer*.11+Math.sin(this.time*5)*.012*this.open;wing.position.y=1.98+Math.sin(this.open*Math.PI)*.12;});
  }
}

/** Only the owning viewport sees this prediction; no collision, light or particle system. */
export class GlideLandingGuide {
  private mesh:Mesh;private material:StandardMaterial;
  constructor(scene:Scene,layerMask:number){
    const circle=MeshBuilder.CreateTorus('landingPredictionRing',{diameter:1.8,thickness:.06,tessellation:24},scene),parts=[circle];
    const pin=MeshBuilder.CreateTorus('landingPredictionPin',{diameter:1.05,thickness:.045,tessellation:20},scene);pin.rotation.x=Math.PI/2;pin.position.y=1.1;parts.push(pin);
    const stem=MeshBuilder.CreateCylinder('landingPredictionStem',{height:.8,diameter:.045,tessellation:6},scene);stem.position.y=.4;parts.push(stem);
    for(const side of [-1,1]){const arrow=MeshBuilder.CreateBox('landingPredictionArrow',{width:.09,height:.04,depth:.95},scene);arrow.position.set(side*.26,0,.4);arrow.rotation.y=side*.6;parts.push(arrow);}
    this.mesh=Mesh.MergeMeshes(parts,true,true)!;this.mesh.name='glideLandingPrediction';this.mesh.layerMask=layerMask;this.mesh.isPickable=false;
    this.material=new StandardMaterial('landingPredictionMaterial',scene);this.material.disableLighting=true;this.mesh.material=this.material;this.mesh.setEnabled(false);
  }
  update(k:KartState,track:GlideTrack):void {
    const active=k.flight==='GLIDE';this.mesh.setEnabled(active);if(!active)return;
    const prediction=predictGlideLanding(k),safe=Math.abs(prediction)<=track.widthAt(k.glideEnd)/2-1.15;
    this.mesh.position.copyFrom(track.worldPoint(k.glideEnd+1,Math.max(-20,Math.min(20,prediction)),.16));this.mesh.rotation.y=track.tangentAngleAt(k.glideEnd);
    this.material.emissiveColor.set(safe?.35:1,safe?1:.3,safe?.65:.15);
    const pulse=1+Math.sin(k.flightTime*7)*.05;this.mesh.scaling.set(pulse,1,pulse);
  }
}
