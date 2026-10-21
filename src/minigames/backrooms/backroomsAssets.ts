import {AssetContainer,LoadAssetContainerAsync,Scene,Mesh,TransformNode,Vector3,Quaternion,Matrix,StandardMaterial,Color3,MeshBuilder,DynamicTexture,Texture,PBRMaterial,VertexBuffer,BoundingInfo} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {MonsterAnimator,MONSTER_PROFILES,loadMonsterManifest} from '../../monsters/MonsterAnimator';
import type {MonsterState} from '../../monsters/MonsterAnimator';
export type ActorModel='hazmat'|'bacteria'|'partygoer'|'smiler'|'warrok'|'zombiegirl'|'yaku'|'pumpkinhulk';
export type BackAsset='hazmat'|'bacteria'|'partygoer'|'smiler'|'original'|'environment';
const FILES:Record<BackAsset,string>={hazmat:'escape_the_backrooms_hazmat',bacteria:'bacteria_-_kane_pixels_backrooms',partygoer:'partygoer_from_backrooms_updated',smiler:'smiler_entity3_backrooms',original:'original_backrooms',environment:'backroomsish_style_environment'};
export class BackroomsAssets {
 readonly containers=new Map<string,AssetContainer>();
 readonly modules=new Map<string,Mesh>();
 private constructor(readonly scene:Scene){}
 static async load(scene:Scene,extras:('zombiegirl'|'yaku')[]=[]):Promise<BackroomsAssets>{
  const assets=new BackroomsAssets(scene);
  try{await loadMonsterManifest();await Promise.all(([...Object.keys(FILES),...new Set(extras)] as (BackAsset|'zombiegirl'|'yaku')[]).map(async id=>{const url=MONSTER_PROFILES[id]?.model??`/assets/backrooms/${FILES[id as BackAsset]}.glb`,c=await LoadAssetContainerAsync(url,scene);if(scene.isDisposed){c.dispose();throw new Error('Backrooms scene disposed during loading');}assets.containers.set(id,c);
   for(const material of c.materials){if(material instanceof PBRMaterial){material.maxSimultaneousLights=4;if(id==='original')material.unlit=false;material.environmentIntensity=.25;if(id==='bacteria'){material.albedoColor.set(.07,.075,.06);material.roughness=.9;material.emissiveColor.set(.008,.009,.006);}}for(const t of material.getActiveTextures())t.anisotropicFilteringLevel=4;}
  }));assets.prepareModules();return assets;}catch(error){assets.dispose();throw error;}
 }
 private prepareModules():void{
  const find=(id:BackAsset,mat:string)=>this.containers.get(id)!.meshes.find(m=>m instanceof Mesh&&m.material?.name===mat) as Mesh|undefined;
  const make=(key:string,source:Mesh,plane=false)=>{
   const m=source.clone('backTemplate:'+key,null,true)!;m.makeGeometryUnique();m.parent=null;m.position.setAll(0);m.rotation.setAll(0);m.rotationQuaternion=null;m.scaling.setAll(1);m.setEnabled(true);m.computeWorldMatrix(true);
   // Authored wall geometry is a separate rectangular panel, not the complete scene.
   let b=m.getBoundingInfo().boundingBox;if(!plane&&b.extendSize.z>b.extendSize.x){m.bakeTransformIntoVertices(Matrix.RotationY(Math.PI/2));m.refreshBoundingInfo();b=m.getBoundingInfo().boundingBox;}
   const size=b.maximum.subtract(b.minimum),center=b.center;m.bakeTransformIntoVertices(Matrix.Translation(-center.x,-center.y,-center.z));m.bakeTransformIntoVertices(Matrix.Scaling(1/Math.max(.001,size.x),plane?1:1/Math.max(.001,size.y),1/Math.max(.001,size.z)));
   const positions=m.getVerticesData(VertexBuffer.PositionKind)!,uvs:number[]=[];for(let i=0;i<positions.length;i+=3)uvs.push((positions[i]+.5)*(plane?2:1.5),(positions[i+(plane?2:1)]+.5)*(plane?2:1.5));m.setVerticesData(VertexBuffer.UVKind,uvs);
   if(m.material)m.material.backFaceCulling=false;m.setEnabled(false);m.isVisible=false;this.modules.set(key,m);
  };
  const wall=find('environment','Wall'),carpet=find('original','NewCarpet');if(!wall||!carpet)throw new Error('Backrooms: authored wall/carpet modules missing');make('wall',wall);make('floor',carpet,true);
  const original=this.containers.get('original')!;const wallpaper=original.materials.find(m=>m.name==='StripeWallpaper');if(wallpaper){const authored=wallpaper.clone('modularWallpaper') as PBRMaterial;authored.albedoTexture=new Texture('/assets/backrooms/original-wall-tile.jpg',this.scene);authored.albedoColor=Color3.White();authored.unlit=false;const alternate=this.modules.get('wall')!.clone('backTemplate:wallpaper',null,true)!;alternate.material=authored;alternate.setEnabled(false);this.modules.set('wallpaper',alternate);}
  const carpetMat=this.modules.get('floor')!.material!.clone('modularOriginalCarpet') as PBRMaterial;carpetMat.albedoTexture=new Texture('/assets/backrooms/original-carpet-tile.jpg',this.scene);carpetMat.albedoColor=Color3.White();carpetMat.unlit=false;this.modules.get('floor')!.material=carpetMat;
  const industrial=this.modules.get('floor')!.clone('backTemplate:industrial',null,true)!;industrial.material=this.containers.get('environment')!.materials.find(m=>m.name==='Floor')!;industrial.setEnabled(false);this.modules.set('industrialFloor',industrial);
 }
 module(kind:'wall'|'wallpaper'|'floor'|'industrialFloor',name:string,x:number,y:number,z:number,w:number,h:number,d:number):Mesh{
  const mesh=this.modules.get(kind)!.clone(name,null,true)!;mesh.setEnabled(true);mesh.isVisible=true;mesh.position.set(x,y,z);mesh.scaling.set(w,kind==='floor'||kind==='industrialFloor'?1:h,d);mesh.isPickable=false;return mesh;
 }
 actor(kind:'hazmat'|'bacteria'|'partygoer'|'smiler'|'zombiegirl'|'yaku',name:string,color?:string,label?:string):BackActor{return new BackActor(this,kind,name,color,label,kind==='partygoer'||kind==='zombiegirl'||kind==='yaku'||name.startsWith('imitation:'));}
 dispose():void{for(const m of this.modules.values())m.dispose();this.modules.clear();for(const c of this.containers.values())c.dispose();this.containers.clear();}
}
export class BackActor {
 readonly root:TransformNode;readonly body:TransformNode;readonly kind:string;readonly meshes:Mesh[]=[];
 readonly animator?:MonsterAnimator;
 private animationRequest?:{state:MonsterState;age?:number};
 private oneShot?:MonsterState;
 private poses=new Map<TransformNode,Quaternion>();private joints=new Map<string,TransformNode>();private phase=0;private baseY=0;private skinEntries:ReturnType<AssetContainer['instantiateModelsToScene']>;
 private identity:Mesh|null=null;
 constructor(assets:{scene:Scene;containers:ReadonlyMap<string,AssetContainer>},kind:ActorModel,name:string,color?:string,label?:string,animated=false){
  this.kind=kind;const scene=assets.scene;this.root=new TransformNode('backActor:'+name,scene);this.body=new TransformNode('backBody:'+name,scene);this.body.parent=this.root;
  const c=assets.containers.get(kind)!;this.skinEntries=c.instantiateModelsToScene(n=>name+':'+n,false,{doNotInstantiate:true});for(const n of this.skinEntries.rootNodes)n.parent=this.body;
  for(const m of this.body.getChildMeshes()){m.setEnabled(true);m.isVisible=true;m.isPickable=false;if(m instanceof Mesh)this.meshes.push(m);}
  let min=new Vector3(Infinity,Infinity,Infinity),max=min.negate();for(const m of this.meshes){m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;min=Vector3.Minimize(min,b.minimumWorld);max=Vector3.Maximize(max,b.maximumWorld);}
  const height=MONSTER_PROFILES[kind]?.height??(kind==='hazmat'?1.8:kind==='bacteria'?2.52:kind==='partygoer'?2.15:1.75),scale=height/Math.max(.001,max.y-min.y);this.body.scaling.setAll(scale);this.body.position.set(-(min.x+max.x)*.5*scale,-min.y*scale,-(min.z+max.z)*.5*scale);this.baseY=this.body.position.y;
  if(animated&&MONSTER_PROFILES[kind])this.animator=new MonsterAnimator(this.skinEntries.animationGroups,MONSTER_PROFILES[kind],this.root.uniqueId);
  // Conservative one-time animation bounds; no per-frame CPU skinning or frustum popping on punches/death.
  if(this.animator)for(const mesh of this.meshes){const b=mesh.getBoundingInfo().boundingBox,p=b.extendSize.length()*.45,pad=new Vector3(p,p,p);mesh.setBoundingInfo(new BoundingInfo(b.minimum.subtract(pad),b.maximum.add(pad)));}
  for(const skeleton of this.skinEntries.skeletons)for(const bone of skeleton.bones){const node=bone.getTransformNode();if(node)this.joints.set(bone.name.replace(/_\d+$/,''),node);}
  this.root.computeWorldMatrix(true);for(const n of this.body.getChildTransformNodes())n.computeWorldMatrix(true);
  if(kind==='hazmat'&&!this.animator)for(const side of ['Left','Right']){
   const arm=this.joints.get(side+'Arm'),fore=this.joints.get(side+'ForeArm');if(!arm||!fore)continue;
   const inv=Matrix.Invert(arm.parent!.getWorldMatrix()),current=Vector3.TransformNormal(fore.getAbsolutePosition().subtract(arm.getAbsolutePosition()),inv).normalize(),desired=Vector3.TransformNormal(new Vector3(side==='Left'?.12:-.12,-1,.05),inv).normalize(),q=Quaternion.Identity();Quaternion.FromUnitVectorsToRef(current,desired,q);
   arm.rotationQuaternion=q.multiply(arm.rotationQuaternion??Quaternion.FromEulerVector(arm.rotation));arm.computeWorldMatrix(true);
  }
  if(kind==='bacteria'){
   for(const [key,pattern] of [['Head',/^Head(?:_|$)/],['LeftArm',/^LeftArm(?:_|$)/],['RightArm',/^RightArm(?:_|$)/]] as const){const part=this.meshes.find(m=>pattern.test(m.name.split(':').pop()??''));if(!part)continue;
    part.computeWorldMatrix(true);const box=part.getBoundingInfo().boundingBox,parent=part.parent as TransformNode,pivot=new TransformNode(name+':pivot:'+key,scene);pivot.parent=parent;const p=box.centerWorld.clone();if(key!=='Head')p.y=box.maximumWorld.y;pivot.position.copyFrom(Vector3.TransformCoordinates(p,Matrix.Invert(parent.getWorldMatrix())));part.setParent(pivot);this.joints.set(key,pivot);
   }
  }
  for(const node of this.joints.values())this.poses.set(node,(node.rotationQuaternion??Quaternion.FromEulerVector(node.rotation)).clone());
  if(kind==='hazmat'&&color&&(!animated||label)){
   const mat=new StandardMaterial(name+':identity',scene);mat.diffuseColor=Color3.FromHexString(color);mat.emissiveColor=mat.diffuseColor.scale(.12);
   for(const side of [-1,1]){const band=MeshBuilder.CreateTorus(name+':armBand',{diameter:.18,thickness:.04,tessellation:10},scene);band.parent=this.root;const arm=this.joints.get(side<0?'LeftArm':'RightArm'),fore=this.joints.get(side<0?'LeftForeArm':'RightForeArm');if(arm&&fore){arm.computeWorldMatrix(true);fore.computeWorldMatrix(true);const a=arm.getAbsolutePosition(),b=fore.getAbsolutePosition();band.position.copyFrom(Vector3.Lerp(a,b,.6));const q=Quaternion.Identity();Quaternion.FromUnitVectorsToRef(Vector3.Up(),b.subtract(a).normalize(),q);band.rotationQuaternion=q;band.setParent(arm);}else band.position.set(side*.28,1.3,0);band.material=mat;}
   const tex=new DynamicTexture(name+':badge',{width:256,height:64},scene,false),ctx=tex.getContext() as CanvasRenderingContext2D;ctx.fillStyle='#171b17';ctx.fillRect(0,0,256,64);ctx.fillStyle=color;ctx.font='bold 27px monospace';ctx.textAlign='center';ctx.fillText((label??name).slice(0,14),128,42);tex.update();tex.hasAlpha=false;const badgeMat=new StandardMaterial(name+':badgeMat',scene);badgeMat.diffuseTexture=tex;badgeMat.emissiveColor=new Color3(.35,.35,.35);
   const badge=MeshBuilder.CreatePlane(name+':name',{width:.6,height:.15,sideOrientation:Mesh.DOUBLESIDE},scene);badge.parent=this.root;badge.position.set(0,1.98,0);badge.billboardMode=Mesh.BILLBOARDMODE_Y;badge.material=badgeMat;this.identity=badge;
  }
 }
 showLabel(on:boolean):void{if(this.identity)this.identity.isVisible=on;}
 setAnimation(state:MonsterState,age?:number):void{this.animationRequest={state,age};}
 triggerAnimation(state:MonsterState):void{if(this.animator&&(!this.oneShot||this.animator.finished))this.oneShot=state;}
 resetAnimation(seed:number):void{this.animator?.reset(seed);this.animationRequest=undefined;this.oneShot=undefined;this.root.rotation.setAll(0);this.body.rotation.setAll(0);}
 private pose(key:string,x=0,y=0,z=0):void{const node=this.joints.get(key);if(node)node.rotationQuaternion=this.poses.get(node)!.multiply(Quaternion.RotationYawPitchRoll(y,x,z));}
 update(x:number,z:number,yaw:number,speed:number,running:boolean,time:number,dt:number,action=false,fright=false):void{
  this.root.position.set(x,0,z);this.root.rotation.y=yaw;this.phase+=speed*dt*4;const amount=Math.min(1,speed/3),s=Math.sin(this.phase),c=Math.cos(this.phase),breath=Math.sin(time*1.7)*.012;
  if(this.animator){const request=this.animationRequest;this.animationRequest=undefined;this.body.position.y=this.baseY;this.body.rotation.setAll(0);const state=request?.state==='DEATH'?'DEATH':this.oneShot??request?.state??(speed>.12?(running?'RUN':'WALK'):this.animator.profile.idle);this.animator.update(dt,state,speed/Math.max(.01,this.root.scaling.x),this.oneShot&&state!=='DEATH'?undefined:request?.age);if(this.oneShot&&this.animator.finished)this.oneShot=undefined;return;}
  this.body.position.y=this.baseY+Math.abs(s)*.025*amount+breath;this.body.rotation.z=Math.sin(this.phase*.5)*.018*amount;this.body.rotation.x=fright?-.15:running?.07:0;
  if(this.kind==='hazmat'){
   for(const [side,sign] of [['Left',1],['Right',-1]] as const){this.pose(side+'UpLeg',s*sign*.52*amount);this.pose(side+'Leg',Math.max(0,-s*sign)*.65*amount);this.pose(side+'Arm',-s*sign*.34*amount+(action?-.65:0));this.pose(side+'ForeArm',-.16-(running?.4:0));}this.pose('Head',fright?-.2:breath,Math.sin(time*.6)*.025);
  }else if(this.kind==='partygoer'){
   for(const [side,sign] of [['L',1],['R',-1]] as const){this.pose('CC_Base_'+side+'_Thigh',s*sign*.45*amount);this.pose('CC_Base_'+side+'_Calf',Math.max(0,-s*sign)*.6*amount);this.pose('CC_Base_'+side+'_Upperarm',-s*sign*.25*amount+(action?-.55:0));}this.pose('CC_Base_Head',Math.sin(time*.8)*.08,Math.sin(time*.45)*.12);
  }else if(this.kind==='bacteria'){this.pose('Head',Math.sin(time*4)*.055,Math.sin(time*1.7)*.1,Math.sin(time*6)*.06);this.pose('LeftArm',s*.12*amount);this.pose('RightArm',-s*.12*amount);this.body.rotation.z+=Math.sin(time*8)*.025*(running?1:.3);}
  else{let i=0;for(const key of this.joints.keys()){if(i++>24)break;this.pose(key,Math.sin(time*3+i)*.035*amount,0,Math.sin(time*2+i)*.018);}}
 }
 dispose():void{this.animator?.dispose();this.root.dispose();this.skinEntries.dispose();}
}
