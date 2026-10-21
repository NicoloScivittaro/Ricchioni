import{Scene,StandardMaterial,Color3,Mesh,MeshBuilder,TransformNode,Vector3,VertexData,Quaternion}from'@babylonjs/core';
import type{LinesMesh}from'@babylonjs/core';
import type{WeaponId,V3}from'../../../shared/ferro/types';
import{weapon}from'../../../shared/ferro/weapons';
import type{BladePose}from'../../../shared/ferro/pose';
const materials=new WeakMap<Scene,Map<string,StandardMaterial>>(),models=new WeakMap<Scene,Map<string,Mesh[]>>();
export function ferroMaterial(scene:Scene,id:string,color:string,metal=false):StandardMaterial{
 let cache=materials.get(scene);if(!cache){cache=new Map();materials.set(scene,cache);}let m=cache.get(id);if(!m){m=new StandardMaterial('ferro:'+id,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor.setAll(metal?.65:.08);m.specularPower=metal?64:12;m.maxSimultaneousLights=2;m.freeze();cache.set(id,m);}return m;
}
function forge(scene:Scene,id:WeaponId|'shieldFace'|'arrow'):Mesh[]{
 let cache=models.get(scene);if(!cache){cache=new Map();models.set(scene,cache);}const existing=cache.get(id);if(existing)return existing;
 const parts:Mesh[]=[],steel=ferroMaterial(scene,'steel','#b6cbd2',true),edge=ferroMaterial(scene,'edge','#e0eded',true),gold=ferroMaterial(scene,'brass','#bd985a',true),wood=ferroMaterial(scene,'oak','#76513b'),leather=ferroMaterial(scene,'leather','#352b2b'),dark=ferroMaterial(scene,'iron','#495969',true);
 const put=(m:Mesh,mat:StandardMaterial,x=0,y=0,z=0)=>{m.material=mat;m.position.set(x,y,z);m.isPickable=false;parts.push(m);return m;};
 const box=(n:string,w:number,h:number,d:number,m:StandardMaterial,x=0,y=0,z=0)=>put(MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene),m,x,y,z);
 const cyl=(n:string,r:number,h:number,m:StandardMaterial,y=0)=>put(MeshBuilder.CreateCylinder(n,{diameter:r,height:h,tessellation:10},scene),m,0,y);
 const blade=(length:number,width:number,y:number)=>{
  const stations=[[0,width/2],[length*.78,width*.39],[length,0]],positions:number[]=[],indices:number[]=[];
  for(const[h,w]of stations)positions.push(-w,h+y,0,0,h+y,.035,w,h+y,0,0,h+y,-.035);
  for(let ring=0;ring<2;ring++)for(let i=0;i<4;i++){const a=ring*4+i,b=ring*4+(i+1)%4,c=a+4,d=b+4;indices.push(a,b,c,b,d,c);}indices.push(0,3,2,0,2,1,8,9,10,8,10,11);
  const data=new VertexData(),normals:number[]=[];VertexData.ComputeNormals(positions,indices,normals);data.positions=positions;data.indices=indices;data.normals=normals;const mesh=new Mesh('forged-blade',scene);data.applyToMesh(mesh);put(mesh,steel);box('blade-ridge',.012,length*.7,.012,edge,0,y+length*.35,.036);
 };
 if(id==='arrow'){
  cyl('arrow-shaft',.024,.83,wood,.3);const tip=MeshBuilder.CreateCylinder('arrow-head',{diameterBottom:.09,diameterTop:0,height:.19,tessellation:4},scene);put(tip,steel,0,.81);for(const angle of[0,Math.PI/2]){const f=box('fletching',.14,.18,.012,leather,0,-.06);f.rotation.y=angle;}
 }else if(id==='shieldFace'){
  const face=MeshBuilder.CreateCylinder('shield',{diameter:.96,height:.08,tessellation:16},scene);put(face,dark);face.rotation.x=Math.PI/2;
  for(let i=-3;i<=3;i++){const x=i*.115,h=Math.sqrt(Math.max(0,.43*.43-x*x))*2;box('shield-plank',.105,h,.035,wood,x,0,.055);}
  const rim=MeshBuilder.CreateTorus('shield-rim',{diameter:.94,thickness:.065,tessellation:24},scene);put(rim,gold,0,0,.08);rim.rotation.x=Math.PI/2;
  put(MeshBuilder.CreateSphere('shield-boss',{diameter:.28,segments:10},scene),steel,0,0,.10).scaling.z=.5;box('shield-cross',.08,.75,.035,gold,0,0,.085);
 }else if(id==='bow'){
  const path=Array.from({length:17},(_,i)=>{const y=(i/16-.5)*1.55;return new Vector3(.14*(1-Math.pow(y/.775,2)),y,.1);});put(MeshBuilder.CreateTube('yew-bow',{path,radius:.038,tessellation:6},scene),wood);box('bow-grip',.09,.24,.10,leather,.14,0,.1);for(const y of[-.65,.65])box('bow-tip',.065,.10,.085,gold,.045,y,.1);
 }else{
  const length=weapon(id).length;
  if(id==='spear'){cyl('spear-shaft',.055,length-.35,wood,(length-.35)/2-.16);blade(.52,.23,length-.52);cyl('spear-socket',.082,.22,gold,length-.48);}
  else if(id==='axe'){cyl('axe-haft',.075,length,wood,length/2-.22);const head=box('axe-head',.78,.43,.11,steel,.26,length-.29);head.rotation.z=-.18;box('axe-edge',.12,.54,.14,edge,.65,length-.26);box('axe-socket',.13,.45,.17,dark,0,length-.29);}
  else if(id==='hammer'){cyl('hammer-haft',.085,length-.25,wood,(length-.25)/2-.2);box('hammer-head',.95,.42,.43,dark,0,length-.2);for(const x of[-.45,.45])box('hammer-caps',.1,.48,.48,steel,x,length-.2);box('hammer-inlay',.14,.31,.02,gold,0,length-.2,.225);}
  else{blade(length-.22,id==='blades'?.14:.20,.20);const guard=box('crossguard',id==='blades'?.34:.49,.07,.1,gold,0,.14);guard.rotation.z=.06;cyl('sword-grip',.095,.35,leather,-.05);put(MeshBuilder.CreateSphere('pommel',{diameter:.14,segments:8},scene),gold,0,-.25);}
  for(let i=0;i<3;i++){const ring=MeshBuilder.CreateTorus('grip-binding',{diameter:id==='spear'?.068:.103,thickness:.012,tessellation:10},scene);put(ring,gold,0,-.14+i*.07);}
 }
 const grouped=new Map<StandardMaterial,Mesh[]>();for(const p of parts){const m=p.material as StandardMaterial;const group=grouped.get(m)??[];group.push(p);grouped.set(m,group);}const merged:Mesh[]=[];
 for(const group of grouped.values()){const mesh=group.length===1?group[0]:Mesh.MergeMeshes(group,true,true,undefined,false,false)!;mesh.name='ferro-template:'+id;mesh.isPickable=false;mesh.setEnabled(false);merged.push(mesh);}cache.set(id,merged);return merged;
}
export function cloneFerroModel(scene:Scene,id:WeaponId|'shieldFace'|'arrow',parent:TransformNode):Mesh[]{return forge(scene,id).map((m,i)=>{const n=m.clone('ferro-model:'+id+':'+i,parent)!;n.setEnabled(true);return n;});}
export function alignSegment(node:TransformNode,a:V3,b:V3,length=1):void{
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz)||.001;node.position.set(a.x,a.y,a.z);node.scaling.y=d/length;
 const dir=new Vector3(dx/d,dy/d,dz/d),dot=Vector3.Dot(Vector3.Up(),dir),axis=Vector3.Cross(Vector3.Up(),dir);node.rotationQuaternion=axis.lengthSquared()<1e-8?(dot<0?Quaternion.RotationAxis(Vector3.Right(),Math.PI):Quaternion.Identity()):Quaternion.RotationAxis(axis.normalize(),Math.acos(Math.max(-1,Math.min(1,dot))));
}
export class FerroWeapon{
 readonly right:TransformNode;readonly left:TransformNode;private string:LinesMesh|null=null;private drawn:TransformNode|null=null;
 constructor(private scene:Scene,readonly id:WeaponId,parent:TransformNode){
  this.right=new TransformNode('ferro-right:'+id,scene);this.left=new TransformNode('ferro-left:'+id,scene);this.right.parent=this.left.parent=parent;
  cloneFerroModel(scene,id,this.right);if(id==='shield')cloneFerroModel(scene,'shieldFace',this.left);else if(id==='blades')cloneFerroModel(scene,id,this.left);
  if(id==='bow'){this.string=MeshBuilder.CreateLines('bow-string',{points:[new Vector3(0,-.775,.1),new Vector3(.48,0,-.1),new Vector3(0,.775,.1)],updatable:true},scene);this.string.parent=this.left;this.string.color=new Color3(.85,.81,.7);this.drawn=new TransformNode('drawn-arrow',scene);this.drawn.parent=parent;cloneFerroModel(scene,'arrow',this.drawn);}
 }
 update(right:BladePose,left:BladePose,charge:number):void{
  if(this.id==='bow'){
   this.right.setEnabled(false);this.left.position.set(left.grip.x,left.grip.y,left.grip.z);this.left.rotationQuaternion=null;this.left.scaling.setAll(1);
   // Bow body is held by the left hand; right hand draws the string and arrow nock.
   if(!this.left.getChildMeshes().some(m=>m.name.startsWith('ferro-model:bow')))cloneFerroModel(this.scene,'bow',this.left);
   if(this.string)MeshBuilder.CreateLines('bow-string',{points:[new Vector3(0,-.775,.1),new Vector3(right.grip.x-left.grip.x,right.grip.y-left.grip.y,right.grip.z-left.grip.z),new Vector3(0,.775,.1)],instance:this.string});
   if(this.drawn){this.drawn.setEnabled(charge>.03);alignSegment(this.drawn,right.grip,{x:right.grip.x,y:right.grip.y,z:right.grip.z+1});}
  }else{alignSegment(this.right,right.grip,right.tip,weapon(this.id).length);if(this.id==='blades')alignSegment(this.left,left.grip,left.tip,weapon(this.id).length);else if(this.id==='shield'){this.left.position.set(left.grip.x,left.grip.y,left.grip.z);this.left.scaling.setAll(1);}}
 }
 dispose():void{this.right.dispose();this.left.dispose();this.drawn?.dispose();}
}
