import{Scene,TransformNode,Mesh,MeshBuilder,Vector3,Matrix,StandardMaterial}from'@babylonjs/core';
import{buildCharacterRig,makeCharMaterials}from'../characters/characterModel';
import type{CharRig,CharMaterials}from'../characters/characterModel';
import{presentationOf}from'../../../shared/characterPresentation';
import type{Warrior,WeaponId,V3}from'../../../shared/ferro/types';
import type{PlayerSnapshot}from'../../../shared/types';
import{motionFrame,point}from'../../../shared/ferro/motion';
import{combatPose}from'../../../shared/ferro/pose';
import{FerroWeapon,alignSegment}from'./FerroWeapons';
interface Arm{shoulder:TransformNode;upper:TransformNode;fore:TransformNode;hand:Mesh;length:number}
export class FerroActor{
 readonly root:TransformNode;readonly rig:CharRig;private mats:CharMaterials;private arms:Arm[];private held:FerroWeapon|null=null;private id:WeaponId|null=null;private variant=-1;private lastPose:ReturnType<typeof combatPose>|null=null;private inv=Matrix.Identity();private death=0;private cameraOpacity=1;
 constructor(private scene:Scene,snapshot:PlayerSnapshot){
  this.root=new TransformNode('ferro-warrior:'+snapshot.id,scene);const pres=presentationOf(snapshot.characterId);this.mats=makeCharMaterials(scene,pres,snapshot.color);this.rig=buildCharacterRig(scene,this.root,pres,this.mats,false);this.rig.prop?.dispose();this.rig.prop=null;
  this.arms=[this.arm(this.rig.armR,pres?.accessories.includes('boxingGloves')??false),this.arm(this.rig.armL,pres?.accessories.includes('boxingGloves')??false)];
  for(const m of this.root.getChildMeshes()){m.isPickable=false;const mat=m.material as StandardMaterial|null;if(mat){mat.maxSimultaneousLights=2;mat.freeze();}}
  this.batchBody();
 }
 private arm(shoulder:TransformNode,glove:boolean):Arm{
  for(const child of shoulder.getChildren())child.dispose();const upper=new TransformNode('ferro-upper-arm',this.scene),fore=new TransformNode('ferro-forearm',this.scene);upper.parent=fore.parent=this.root;
  const cylinder=(parent:TransformNode,material:StandardMaterial)=>{const m=MeshBuilder.CreateCylinder('ferro-arm',{diameter:.23,height:1,tessellation:8},this.scene);m.parent=parent;m.position.y=.5;m.material=material;};cylinder(upper,this.mats.garment);cylinder(fore,this.mats.skin);
  const hand=MeshBuilder.CreateSphere(glove?'ferro-boxing-glove':'ferro-hand',{diameter:glove?.29:.22,segments:8},this.scene);hand.parent=this.root;hand.material=glove?this.mats.accent:this.mats.skin;
  return{shoulder,upper,fore,hand,length:Math.max(.95,this.rig.armLen*1.42)};
 }
 private batchBody():void{
  const joints=new Set<TransformNode>([this.root,this.rig.upper,this.rig.head,this.rig.legL,this.rig.legR]),groups=new Map<TransformNode,Map<unknown,Mesh[]>>();
  for(const mesh of this.root.getChildMeshes()){if(!(mesh instanceof Mesh)||!mesh.getTotalVertices()||!mesh.isEnabled())continue;let parent=mesh.parent as TransformNode|null;while(parent&&!joints.has(parent))parent=parent.parent as TransformNode|null;if(!parent||mesh.name.startsWith('ferro-'))continue;mesh.setParent(parent);let mats=groups.get(parent);if(!mats){mats=new Map();groups.set(parent,mats);}const list=mats.get(mesh.material)??[];list.push(mesh);mats.set(mesh.material,list);}
  for(const[parent,mats]of groups)for(const list of mats.values())if(list.length>1){const merged=Mesh.MergeMeshes(list,true,true,undefined,false,false);if(merged){merged.setParent(parent);merged.isPickable=false;}}
 }
 private grip(arm:Arm,target:V3,side:number):void{
  const origin=Vector3.TransformCoordinates(arm.shoulder.getAbsolutePosition(),this.inv),end=new Vector3(target.x,target.y,target.z),delta=end.subtract(origin),d=Math.max(.001,delta.length()),length=arm.length/2,reach=Math.min(d,arm.length*.995),dir=delta.scale(1/d),middle=origin.add(dir.scale(reach/2)),bend=Math.sqrt(Math.max(0,length*length-reach*reach/4));
  const normal=new Vector3(side*.8,-.65,-.35),projected=normal.subtract(dir.scale(Vector3.Dot(normal,dir))).normalize(),elbow=middle.add(projected.scale(bend));
  alignSegment(arm.upper,origin,elbow);alignSegment(arm.fore,elbow,end);arm.hand.position.copyFrom(end);
 }
 setCameraFade(opacity:number):void{if(this.cameraOpacity===opacity)return;this.cameraOpacity=opacity;for(const mesh of this.root.getChildMeshes())mesh.visibility=opacity;}
 update(p:Warrior,time:number,dt:number,victory=false):void{
  if(!p.eligible&&!p.alive){this.root.setEnabled(false);return;}this.root.setEnabled(true);if(!p.alive)this.death=Math.min(1,this.death+dt*2);else this.death=0;
  this.root.position.set(p.x,p.y,p.z);this.root.rotation.y=p.action?.yaw??p.yaw;this.root.rotation.z=-this.death*1.5;
  const speed=Math.hypot(p.vx,p.vz),walk=Math.sin(time*(speed>5?13:9))*Math.min(.65,speed*.12),sampled=combatPose(p),pose=sampled,dodge= p.dodge>0?Math.sin((.36-p.dodge)/.36*Math.PI):0;
  if(!p.action&&!p.feint&&this.lastPose&&dt>0){const t=1-Math.exp(-dt*23);for(const hand of ['right','left']as const)for(const endpoint of ['grip','tip']as const)for(const axis of ['x','y','z']as const)pose[hand][endpoint][axis]=this.lastPose[hand][endpoint][axis]+(pose[hand][endpoint][axis]-this.lastPose[hand][endpoint][axis])*t;}this.lastPose=pose;
  this.rig.legL.rotation.x=walk;this.rig.legR.rotation.x=-walk;this.rig.upper.rotation.x=pose.lean+dodge*.4+(p.hurt>0?Math.sin(p.hurt*40)*.09:0);this.rig.upper.position.y=this.rig.hipY-dodge*.2+Math.sin(time*2)*.012;const frame=motionFrame(p,p.action?.age??0,time),hip=point(frame,'B-hips',{x:0,y:.94,z:0}),chest=point(frame,'B-chest',{x:0,y:1.25,z:0});
  this.rig.upper.rotation.x+=Math.atan2(chest.z-hip.z,Math.max(.15,chest.y-hip.y))*.28;
  this.rig.upper.rotation.z=(chest.x-hip.x)*.65;this.rig.upper.position.y+=(hip.y-.94)*.25;
  const thighR=point(frame,'B-thigh.R',{x:0,y:.9,z:0}),shinR=point(frame,'B-shin.R',{x:0,y:.45,z:0}),thighL=point(frame,'B-thigh.L',{x:0,y:.9,z:0}),shinL=point(frame,'B-shin.L',{x:0,y:.45,z:0});
  this.rig.legR.rotation.x=Math.atan2(shinR.z-thighR.z,Math.max(.1,thighR.y-shinR.y));this.rig.legL.rotation.x=Math.atan2(shinL.z-thighL.z,Math.max(.1,thighL.y-shinL.y));
  this.rig.head.rotation.y=(chest.x-hip.x)*.6;
  if(this.id!==p.weapon||this.variant!==p.variant){this.held?.dispose();this.id=p.weapon;this.variant=p.variant;this.held=new FerroWeapon(this.scene,p.weapon,this.root,p.variant);if(this.cameraOpacity<1)for(const mesh of this.root.getChildMeshes())mesh.visibility=this.cameraOpacity;}
  const right={...pose.right,grip:{...pose.right.grip},tip:{...pose.right.tip}},left={...pose.left,grip:{...pose.left.grip},tip:{...pose.left.tip}};
  if(victory){right.grip.y+=.65;right.tip.y+=.65;this.rig.legL.rotation.x=this.rig.legR.rotation.x=0;}
  if(p.dodge>0){right.grip.y-=dodge*.2;right.tip.y-=dodge*.2;left.grip.y-=dodge*.2;left.tip.y-=dodge*.2;}
  this.root.computeWorldMatrix(true).invertToRef(this.inv);this.rig.upper.computeWorldMatrix(true);this.rig.armR.computeWorldMatrix(true);this.rig.armL.computeWorldMatrix(true);
  this.grip(this.arms[0],right.grip,1);this.grip(this.arms[1],left.grip,-1);this.held!.update(right,left,p.charge,p.pitch);
 }
 dispose():void{this.held?.dispose();this.root.dispose();}
}
