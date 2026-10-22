import {LoadAssetContainerAsync,TransformNode,Vector3,Quaternion,Matrix} from '@babylonjs/core';
import type {Scene,AssetContainer,InstantiatedEntries,Skeleton} from '@babylonjs/core';
import {GLTFLoaderAnimationStartMode} from '@babylonjs/loaders/glTF';
import type {Warrior,V3} from '../../../shared/ferro/types';
import {motionKey,motionProgress} from '../../../shared/ferro/motion';

// Same original skins as the rest of Party Game. This loader/pose adapter belongs only to Ferro.
const MODELS:Readonly<Record<string,string>>={goblin:'/models/goblin-tripo/green_goblin_casacarbo.glb',buttafuori:'/models/detailed-tripo/detailed_character_casacarbo.glb',judoka:'/models/judoka-tripo/judo_figure_casacarbo.glb',ciro:'/models/man-tripo/man_animated.glb'};
type Frame=Record<string,number[]>;
type Clips=Record<string,{duration:number;frames:Frame[]}>;
type Joint={node:TransformNode;rotation:Quaternion;position:Vector3};
const assets=new WeakMap<Scene,Map<string,Promise<{container:AssetContainer;clips:Clips}>>>();
function asset(scene:Scene,id:string){
 let cache=assets.get(scene);if(!cache){cache=new Map();assets.set(scene,cache);scene.onDisposeObservable.addOnce(()=>{for(const pending of cache!.values())void pending.then(a=>a.container.dispose(),()=>undefined);cache!.clear();});}
 let pending=cache.get(id);if(!pending){pending=Promise.all([LoadAssetContainerAsync(MODELS[id],scene,{pluginOptions:{gltf:{animationStartMode:GLTFLoaderAnimationStartMode.NONE}}}),fetch('/assets/ferro2/skin-'+id+'.json').then(r=>{if(!r.ok)throw new Error('Animazioni Ferro non disponibili: '+id);return r.json()as Promise<Clips>;})]).then(([container,clips])=>{
   if(scene.isDisposed){container.dispose();throw new Error('Scena Ferro chiusa durante il caricamento');}
   // No animation groups are cloned/evaluated: the retargeted sampler owns the linked nodes.
   for(const group of [...container.animationGroups])group.dispose();container.animationGroups.length=0;
   return{container,clips};
  });cache.set(id,pending);}return pending;
}
/** Original skinned geometry + supplied FBX rest-space retarget + reach-constrained hand IK.
 * No animation writes gameplay position, yaw, damage, hitbox or weapon trajectory.
 */
export class FerroSkin{
 static available(id:string|null):boolean{return !!id&&!!MODELS[id];}
 readonly ready:Promise<void>;
 private entries:InstantiatedEntries|null=null;private skeleton:Skeleton|null=null;
 private pivot:TransformNode;private joints=new Map<string,Joint>();private clips:Clips={};private disposed=false;
 private rootInverse=Matrix.Identity();private pose=Quaternion.Identity();private delta=Quaternion.Identity();
 constructor(private scene:Scene,private root:TransformNode,readonly character:string,height:number){
  this.pivot=new TransformNode('ferro-skin:'+character,scene);this.pivot.parent=root;
  this.ready=asset(scene,character).then(({container,clips})=>{
   if(this.disposed||scene.isDisposed)return;
   const entries=container.instantiateModelsToScene(n=>n+'~ferro'+root.uniqueId,false);this.entries=entries;this.skeleton=entries.skeletons[0]??null;
   if(!this.skeleton)throw new Error('Skin Ferro priva di scheletro: '+character);
   for(const node of entries.rootNodes)node.parent=this.pivot;
   let min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
   for(const mesh of this.pivot.getChildMeshes()){
    mesh.computeWorldMatrix(true);mesh.refreshBoundingInfo({applySkeleton:true});const box=mesh.getBoundingInfo().boundingBox;
    min=Vector3.Minimize(min,box.minimumWorld);max=Vector3.Maximize(max,box.maximumWorld);mesh.layerMask=1;mesh.isPickable=false;
    if(mesh.material){if('maxSimultaneousLights' in mesh.material)mesh.material.maxSimultaneousLights=2;mesh.material.freeze();}
   }
   // Constructor root is at origin. Normalize the bind bounds, never an animated pose.
   const scale=height/Math.max(.001,max.y-min.y);this.pivot.scaling.setAll(scale);this.pivot.position.set(-(min.x+max.x)*.5*scale,-min.y*scale,-(min.z+max.z)*.5*scale);
   for(const bone of this.skeleton.bones){const node=bone.getTransformNode();if(!node)continue;this.joints.set(bone.name.split('~')[0],{node,rotation:node.rotationQuaternion?.clone()??Quaternion.FromEulerVector(node.rotation),position:node.position.clone()});}
   for(const name of ['Hips','Head','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand'])if(!this.joints.has('mixamorig:'+name))throw new Error('Osso richiesto assente: '+character+'/'+name);
   this.clips=clips;this.reset();this.skeleton.prepare();
  });
 }
 private reset():void{for(const joint of this.joints.values()){joint.node.rotationQuaternion??=Quaternion.Identity();joint.node.rotationQuaternion.copyFrom(joint.rotation);joint.node.position.copyFrom(joint.position);}}
 private joint(name:string):TransformNode{return this.joints.get('mixamorig:'+name)!.node;}
 private local(node:TransformNode):Vector3{return Vector3.TransformCoordinates(node.computeWorldMatrix(true).getTranslation(),this.rootInverse);}
 private aim(node:TransformNode,child:TransformNode,target:Vector3):void{
  const parent=node.parent as TransformNode;const inv=Matrix.Invert(parent.computeWorldMatrix(true));
  const origin=Vector3.TransformCoordinates(node.computeWorldMatrix(true).getTranslation(),inv);
  const current=Vector3.TransformCoordinates(child.computeWorldMatrix(true).getTranslation(),inv).subtract(origin).normalize();
  const desired=Vector3.TransformCoordinates(Vector3.TransformCoordinates(target,this.root.getWorldMatrix()),inv).subtract(origin).normalize();
  Quaternion.FromUnitVectorsToRef(current,desired,this.delta);node.rotationQuaternion=this.delta.multiply(node.rotationQuaternion??Quaternion.FromEulerVector(node.rotation));node.computeWorldMatrix(true);
 }
 private hand(side:'Right'|'Left',target:V3):void{
  const upper=this.joint(side+'Arm'),fore=this.joint(side+'ForeArm'),hand=this.joint(side+'Hand'),a=this.local(upper);
  // The common arcade grips were authored for long-armed cartoon rigs. A bounded
  // translation correction closes short-arm gaps without moving the blade/hitbox.
  const length=Vector3.Distance(a,this.local(fore))+Vector3.Distance(this.local(fore),this.local(hand));
  const stretch=Math.max(1,Math.min(1.65,Vector3.Distance(a,new Vector3(target.x,target.y,target.z))/Math.max(.001,length-.002)));
  fore.position.scaleInPlace(stretch);hand.position.scaleInPlace(stretch);
  const b=this.local(fore),c=this.local(hand);
  const wristWorld=hand.computeWorldMatrix(true).clone();
  const l1=Vector3.Distance(a,b),l2=Vector3.Distance(b,c),end=new Vector3(target.x,target.y,target.z),diff=end.subtract(a),distance=Math.max(.001,diff.length()),dir=diff.scale(1/distance),reach=Math.max(Math.abs(l1-l2)+.001,Math.min(distance,l1+l2-.001));
  const along=(l1*l1-l2*l2+reach*reach)/(2*reach),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  const pole=new Vector3(side==='Right'?.85:-.85,-.65,-.35),normal=pole.subtract(dir.scale(Vector3.Dot(pole,dir))).normalize();
  const elbow=a.add(dir.scale(along)).add(normal.scale(bend));this.aim(upper,fore,elbow);this.aim(fore,hand,a.add(dir.scale(reach)));
  // IK changes the elbow, not the authored palm orientation/grip.
  const parent=hand.parent as TransformNode,wrist=wristWorld.multiply(Matrix.Invert(parent.computeWorldMatrix(true)));
  wrist.decompose(undefined,hand.rotationQuaternion!);hand.computeWorldMatrix(true);
 }
 update(p:Warrior,time:number,right:V3,left:V3,dodge:number):void{
  if(!this.entries||this.disposed)return;
  // All animated rotations are overwritten below. Restore only the translations
  // modified by hips/hand IK instead of dirtying every one of the 65 joints twice.
  for(const name of ['Hips','LeftForeArm','RightForeArm','LeftHand','RightHand']){const joint=this.joints.get('mixamorig:'+name)!;joint.node.position.copyFrom(joint.position);}
  let key=motionKey(p),progress=motionProgress(p),loop=false;
  if(!p.alive){key='death';progress=Math.min(1,(time-p.deadAt)/1.1);}
  else if(p.hurt>0&&!p.action){key='hurt';progress=1-p.hurt/.22;}
  else if(!p.action&&Math.hypot(p.vx,p.vz)>1&&p.weapon!=='bow'){const lateral=p.vx*Math.cos(p.yaw)-p.vz*Math.sin(p.yaw);key=Math.abs(lateral)>1?lateral>0?'strafeR':'strafeL':'run';loop=true;}
  const clip=this.clips[key]??this.clips.idle;if(!clip)return;
  if(loop)progress=(time%clip.duration)/clip.duration;
  const at=Math.max(0,Math.min(1,progress))*(clip.frames.length-1),i=Math.floor(at),a=clip.frames[i],b=clip.frames[Math.min(i+1,clip.frames.length-1)],t=at-i;
  // Keep the bow upper-body load/hold pose while the legs use the supplied run/strafe clip.
  const bowMoving=p.alive&&p.weapon==='bow'&&Math.hypot(p.vx,p.vz)>1&&p.hurt<=0;
  const lateral=p.vx*Math.cos(p.yaw)-p.vz*Math.sin(p.yaw),legClip=bowMoving?this.clips[Math.abs(lateral)>1?lateral>0?'strafeR':'strafeL':'run']:null;
  const legAt=legClip?(time%legClip.duration)/legClip.duration*(legClip.frames.length-1):0,li=Math.floor(legAt);
  for(const[name,joint]of this.joints){const legs=legClip&&/(UpLeg|Leg|Foot|ToeBase)$/.test(name),q=legs?legClip.frames[li][name]:a[name],next=legs?legClip.frames[Math.min(li+1,legClip.frames.length-1)][name]:b[name];if(!q||!next)continue;this.pose.set(q[0],q[1],q[2],q[3]);this.delta.set(next[0],next[1],next[2],next[3]);Quaternion.SlerpToRef(this.pose,this.delta,legs?legAt-li:t,joint.node.rotationQuaternion!);}
  const hips=this.joints.get('mixamorig:Hips')!;
  if(a.hips&&b.hips)hips.node.position.set(a.hips[0]+(b.hips[0]-a.hips[0])*t,a.hips[1]+(b.hips[1]-a.hips[1])*t,a.hips[2]+(b.hips[2]-a.hips[2])*t);
  // Crouch is a render layer; the authoritative dodge trajectory remains unchanged.
  if(dodge>0){const scale=this.pivot.scaling.y;hips.node.position.y-=dodge*.12/Math.max(.001,scale);}
  this.root.computeWorldMatrix(true).invertToRef(this.rootInverse);
  if(p.alive){this.hand('Right',right);this.hand('Left',left);}
  this.skeleton!.prepare();
 }
 debug(){return{character:this.character,ready:!!this.entries,bones:this.skeleton?.bones.length??0,meshes:this.pivot.getChildMeshes().length,clips:Object.keys(this.clips),hands:this.entries?{right:this.local(this.joint('RightHand')).asArray(),left:this.local(this.joint('LeftHand')).asArray()}:null};}
 dispose():void{this.disposed=true;this.entries?.dispose();this.entries=null;this.pivot.dispose(false,false);}
}


