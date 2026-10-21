import {AnimationGroup,Color3,DirectionalLight,HemisphericLight,ImageProcessingConfiguration,PBRMaterial,Quaternion,SceneLoader,TransformNode,Vector3} from '@babylonjs/core';
import type {AssetContainer,Scene} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import sourceClips from '../../shared/fpsClips.json';

export type FpsPose='Draw'|'Idle'|'Walk'|'Run'|'Fire'|'Reload'|'ReloadEmpty'|'Inspect'|'Holster'|'ReloadStart'|'ReloadEnd'|'OneShot';
type Profile={file:string;clips:Partial<Record<FpsPose,string>>;hip:[number,number,number];ads:[number,number,number];adsRotation?:[number,number];muzzle:[number,number,number];world:string};
export const AUTHORED_WEAPONS:Record<string,Profile>={
 acr:{file:'acr',clips:{Draw:'Draw',Idle:'Idle',Walk:'Walk',Run:'Run',Fire:'Shoot',OneShot:'OneShot',Reload:'Reload_Fast',Inspect:'rifle_inspect'},hip:[.13,-.08,.16],ads:[-.052,-.017,.08],muzzle:[.055,-.085,1.08],world:'raffica'},
 glock:{file:'glock',clips:{Draw:'Draw',Idle:'Idle',Fire:'Fire',Reload:'Reload',ReloadEmpty:'ReloadEmpty',Holster:'Holster'},hip:[.12,-.035,.015],ads:[-.061,.02,.03],muzzle:[.061,-.035,.43],world:'pistola'},
 shotgun:{file:'shotgun',clips:{Draw:'Take',Idle:'Shoot',Fire:'Shoot',Inspect:'Watch',ReloadStart:'ReloadStart',Reload:'Reload',ReloadEnd:'ReloadEnd',Holster:'Hide'},hip:[.12,-.05,.16],ads:[-.055,.038,-.12],adsRotation:[-.026,-.0086],muzzle:[.062,-.07,.80],world:'shotgun'},
 ak74u:{file:'ak74u',clips:{Draw:'DRAW',Idle:'IDLE',Fire:'SHOOT',Inspect:'INSPEC',Reload:'RELOAD1',ReloadEmpty:'RELOAD2',Holster:'OLSER'},hip:[.14,-.07,.30],ads:[.014,-.031,.44],adsRotation:[.029,0],muzzle:[-.014,0,.221],world:'mitraglia'}
};
type Clip={group:AnimationGroup;from:number;seconds:number};
type Pose={p:Vector3;q:Quaternion;s:Vector3};
/** Samples immutable keyframes against an independent cloned rig. No gameplay callbacks. */
export class FpsAnimator{
 readonly clips=new Map<string,Clip>();state:FpsPose='Draw';clock=0;private fade=1;private old=new Map<TransformNode,Pose>();private bind=new Map<TransformNode,Pose>();private q=Quaternion.Identity();private v=Vector3.Zero();
 constructor(groups:AnimationGroup[],readonly profile:Profile){
  for(const group of groups){group.stop();const fps=group.targetedAnimations[0]?.animation.framePerSecond??60;const name=group.name.split('|').pop()!.split(':').pop()!;
   // Babylon normalizes AnimationGroups to frame zero, inserting synthetic hold
   // keys. Use original GLB sampler ranges, not those expanded engine bounds.
   const info=(sourceClips as Record<string,Record<string,{from:number;seconds:number}>>)[profile.file]?.[name];
   this.clips.set(name,{group,from:(info?.from??0)*fps,seconds:info?.seconds??(group.to-group.from)/fps});for(const a of group.targetedAnimations){const n=a.target;if(n instanceof TransformNode&&!this.bind.has(n))this.bind.set(n,{p:n.position.clone(),q:(n.rotationQuaternion??Quaternion.FromEulerVector(n.rotation)).clone(),s:n.scaling.clone()});}}
 }
 private clip(state:FpsPose):Clip|undefined{const name=this.profile.clips[state];return name?[...this.clips].find(([key])=>key===name||key.endsWith('_'+name))?.[1]:undefined;}
 has(state:FpsPose):boolean{return !!this.clip(state);}
 duration(state:FpsPose):number{return this.clip(state)?.seconds??0;}
 play(state:FpsPose,restart=false):void{if(state===this.state&&!restart)return;this.old.clear();for(const[n,b]of this.bind){this.old.set(n,{p:n.position.clone(),q:(n.rotationQuaternion??b.q).clone(),s:n.scaling.clone()});}this.state=state;this.clock=0;this.fade=0;}
 sample(state:FpsPose,seconds:number,dt:number):void{
  this.play(state);this.clock=seconds;this.fade=Math.min(1,this.fade+dt/.065);const clip=this.clip(state)??this.clip('Idle');if(!clip)return;
  // Missing channels return to authored bind, avoiding a magazine left in the reload pose.
  for(const[n,b]of this.bind){n.position.copyFrom(b.p);n.scaling.copyFrom(b.s);n.rotationQuaternion??=Quaternion.Identity();n.rotationQuaternion.copyFrom(b.q);}
  const time=state==='Idle'&&this.profile.file==='shotgun'?0:Math.min(clip.seconds,Math.max(0,seconds));for(const t of clip.group.targetedAnimations){const n=t.target;if(!(n instanceof TransformNode))continue;const value=t.animation.evaluate(clip.from+time*t.animation.framePerSecond),property=t.animation.targetProperty;if(property==='rotationQuaternion')n.rotationQuaternion!.copyFrom(value);else if(property==='position'||property==='scaling')n[property].copyFrom(value);}
  if(this.fade<1)for(const[n,p]of this.old){Vector3.LerpToRef(p.p,n.position,this.fade,this.v);n.position.copyFrom(this.v);Vector3.LerpToRef(p.s,n.scaling,this.fade,this.v);n.scaling.copyFrom(this.v);Quaternion.SlerpToRef(p.q,n.rotationQuaternion!,this.fade,this.q);n.rotationQuaternion!.copyFrom(this.q);}
 }
}
const cache=new WeakMap<Scene,Map<string,Promise<AssetContainer>>>();const lights=new WeakMap<Scene,HemisphericLight>();
async function source(scene:Scene,file:string):Promise<AssetContainer>{let assets=cache.get(scene);if(!assets){assets=new Map();cache.set(scene,assets);scene.onDisposeObservable.addOnce(()=>{for(const c of assets!.values())void c.then(v=>v.dispose()).catch(()=>{});cache.delete(scene);});}let pending=assets.get(file);if(!pending){pending=SceneLoader.LoadAssetContainerAsync('/assets/fps/animated/',file+'.glb',scene).then(c=>{for(const m of c.materials)if(m instanceof PBRMaterial){const color=new ImageProcessingConfiguration();color.toneMappingEnabled=false;m.imageProcessingConfiguration=color;m.environmentIntensity=.7;m.directIntensity=1.1;m.maxSimultaneousLights=2;}return c;});assets.set(file,pending);void pending.catch(()=>assets!.delete(file));}return pending;}
export async function attachAuthored(scene:Scene,id:string,parent:TransformNode,layerMask?:number){
 const profile=AUTHORED_WEAPONS[id],c=await source(scene,profile.file);if(scene.isDisposed||parent.isDisposed())throw Error('Disposed weapon attachment');const entries=c.instantiateModelsToScene(n=>'fps:'+n,false,{doNotInstantiate:true});const root=new TransformNode('authored:'+id,scene);root.parent=parent;for(const n of entries.rootNodes)n.parent=root;
 let light=lights.get(scene);if(!light){light=new HemisphericLight('authoredWeaponFill',new Vector3(-.3,1,-.6),scene);light.intensity=1.65;light.groundColor=new Color3(.5,.55,.62);light.includedOnlyMeshes=[];light.renderPriority=101;const key=new DirectionalLight('authoredWeaponKey',new Vector3(.4,-.6,.8),scene);key.intensity=1.3;key.diffuse=new Color3(.94,.97,1);key.specular=new Color3(.65,.68,.72);key.includedOnlyMeshes=light.includedOnlyMeshes;key.renderPriority=102;lights.set(scene,light);scene.onMeshRemovedObservable.add(m=>{const list=light!.includedOnlyMeshes,i=list.indexOf(m);if(i>=0)list.splice(i,1);});}
 for(const mesh of root.getChildMeshes()){mesh.isPickable=false;mesh.checkCollisions=false;mesh.alwaysSelectAsActiveMesh=true;if(layerMask!==undefined)mesh.layerMask=layerMask;light.includedOnlyMeshes.push(mesh);if(/shape_pose|crosshair_crosshair/.test(mesh.name))mesh.setEnabled(false);}
 return{root,animator:new FpsAnimator(entries.animationGroups,profile),profile};
}
