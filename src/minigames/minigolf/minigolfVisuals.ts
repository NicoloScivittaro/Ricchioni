import {Scene,Mesh,MeshBuilder,Vector3,StandardMaterial,Color3,TransformNode,VertexData,ShadowGenerator,Constants} from '@babylonjs/core';
import type {Course,GolfPlayer,GolfEvent,Floor} from './minigolfTypes';
import {GOLF} from './minigolfTypes';
import {floorAt,heightAt,wallAt} from './minigolfCourses';
import {predict,speed} from './minigolfPhysics';
import {AB} from '../../../shared/abilityCatalog';
export class MinigolfVisuals {
 private root:TransformNode|null=null;
 private floorMeshes:{base:Floor;mesh:Mesh}[]=[];
 private walls:Mesh[]=[];private hole:Mesh|null=null;private flag:TransformNode|null=null;
 readonly balls=new Map<string,Mesh>();readonly rings=new Map<string,Mesh>();
 private arrows=new Map<string,Mesh>();private preview=new Map<string,Mesh[]>();private trails=new Map<string,Mesh[]>();
 private bumpers=new Map<string,Mesh>();private sparks:{mesh:Mesh;life:number;velocity:Vector3}[]=[];
 private materials=new Map<string,StandardMaterial>();private previewAt=0;private holePulse=0;
 constructor(private scene:Scene,players:GolfPlayer[],private shadows:ShadowGenerator){
  for(const p of players){
   const mat=this.material(`ball:${p.id}`,p.color,.22);
   const b=MeshBuilder.CreateSphere(`golfBall:${p.id}`,{diameter:GOLF.radius*2,segments:16},scene);b.material=mat;b.renderingGroupId=1;this.shadows.addShadowCaster(b);this.balls.set(p.id,b);
   const ring=MeshBuilder.CreateTorus(`golfRing:${p.id}`,{diameter:.83,thickness:.045,tessellation:24},scene);ring.material=this.material(`ring:${p.id}`,p.color,.6);ring.renderingGroupId=1;ring.material.depthFunction=Constants.ALWAYS;ring.material.disableDepthWrite=true;this.rings.set(p.id,ring);
   const arrow=MeshBuilder.CreateCylinder(`golfAim:${p.id}`,{height:.55,diameterBottom:.3,diameterTop:0,tessellation:6},scene);arrow.material=ring.material;arrow.rotation.x=Math.PI/2;this.arrows.set(p.id,arrow);
   const dots=Array.from({length:40},(_,i)=>{const m=MeshBuilder.CreateSphere(`predict:${p.id}:${i}`,{diameter:.085,segments:4},scene);m.material=ring.material;m.isVisible=false;return m;});this.preview.set(p.id,dots);
   const trail=Array.from({length:5},(_,i)=>{const m=MeshBuilder.CreateSphere(`trail:${p.id}:${i}`,{diameter:.1,segments:4},scene);m.material=ring.material;m.isVisible=false;return m;});this.trails.set(p.id,trail);
  }
  for(let i=0;i<40;i++){const mesh=MeshBuilder.CreateSphere('golfSpark',{diameter:.08,segments:4},scene);mesh.material=this.material('spark','#fff1ad',.5);mesh.isVisible=false;this.sparks.push({mesh,life:0,velocity:Vector3.Zero()});}
 }
 private material(id:string,color:string,glow=0):StandardMaterial{
  let m=this.materials.get(id);if(m)return m;m=new StandardMaterial(id,this.scene);m.diffuseColor=Color3.FromHexString(color).toLinearSpace();m.emissiveColor=m.diffuseColor.scale(glow);m.specularColor=new Color3(.08,.08,.08);this.materials.set(id,m);return m;
 }
 build(c:Course):void {
  if(this.root)for(const mesh of this.root.getChildMeshes())this.shadows.removeShadowCaster(mesh);
  this.root?.dispose();this.bumpers.clear();this.root=new TransformNode('golfCourseRoot',this.scene);this.floorMeshes=[];this.walls=[];
  const floorMat=this.material(`turf:${c.id}`,c.color);
  for(const [i,f] of c.floors.entries()){
   const mesh=new Mesh(`golfFloor:${i}`,this.scene),pts=[[-f.w/2,-f.d/2],[f.w/2,-f.d/2],[f.w/2,f.d/2],[-f.w/2,f.d/2]];
   const positions=pts.flatMap(([x,z])=>[x,(f.slopeX??0)*x+(f.slopeZ??0)*z,z]),indices=[0,1,2,0,2,3],normals:number[]=[];
   VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.applyToMesh(mesh);
   mesh.material=f.surface==='sand'?this.material('sand','#e5be7b'):f.surface==='ice'?this.material('ice','#91e6f2',.12):floorMat;mesh.material.backFaceCulling=false;mesh.parent=this.root;mesh.position.set(f.x,f.y,f.z);mesh.receiveShadows=true;this.floorMeshes.push({base:f,mesh});
   if(!f.slopeX&&!f.slopeZ&&!f.surface)for(let z=-f.d/2+2;z<f.d/2;z+=4){const stripe=MeshBuilder.CreateGround('turfStripe',{width:f.w,height:.16},this.scene);stripe.parent=mesh;stripe.position.set(0,.012,z);stripe.material=this.material(`stripe:${c.id}`,c.color);stripe.material.alpha=.45;}
   // Lightweight solid skirt makes floating islands and slopes readable.
   for(let edge=0;edge<4;edge++){const a=pts[edge],b=pts[(edge+1)%4],wall=MeshBuilder.CreateBox('islandEdge',{width:Math.hypot(b[0]-a[0],b[1]-a[1]),height:.48,depth:.11},this.scene);wall.material=this.material('skirt','#203e51');wall.parent=mesh;wall.position.set((a[0]+b[0])/2,((f.slopeX??0)*(a[0]+b[0])/2+(f.slopeZ??0)*(a[1]+b[1])/2)-.24,(a[1]+b[1])/2);wall.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);}
  }
  for(const w of c.walls){const m=MeshBuilder.CreateBox('golfWall',{width:Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z)+w.radius*2,height:w.rotation?.45:.7,depth:w.radius*2},this.scene);m.parent=this.root;m.material=this.material(w.rotation?'movingArm':'wall',w.rotation?'#fb923c':'#f4e8c8');this.shadows.addShadowCaster(m);this.walls.push(m);}
  for(const [i,b] of c.bumpers.entries())this.makeBumper(`static${i}`,b.x,b.y,b.z,b.radius);
  this.hole=MeshBuilder.CreateDisc('golfCup',{radius:.5,tessellation:32},this.scene);this.hole.rotation.x=Math.PI/2;this.hole.position.set(c.hole.x,c.holeY+.025,c.hole.z);this.hole.material=this.material('cup','#09141c');this.hole.parent=this.root;
  const lip=MeshBuilder.CreateTorus('cupRim',{diameter:1.05,thickness:.045,tessellation:32},this.scene);lip.parent=this.root;lip.position.set(c.hole.x,c.holeY+.035,c.hole.z);lip.material=this.material('cupGold','#ffe082',.25);
  this.flag=new TransformNode('golfFlag',this.scene);this.flag.parent=this.root;this.flag.position.set(c.hole.x,c.holeY,c.hole.z);
  const pole=MeshBuilder.CreateCylinder('flagPole',{height:2.5,diameter:.055},this.scene);pole.parent=this.flag;pole.position.y=1.25;pole.material=this.material('chrome','#dce6f0');
  const flag=MeshBuilder.CreateBox('flag',{width:1,height:.6,depth:.025},this.scene);flag.parent=this.flag;flag.position.set(.5,2.2,0);flag.material=this.material('flag','#ffdb57');
  const tee=MeshBuilder.CreateBox('teeLine',{width:6,height:.025,depth:.1},this.scene);tee.parent=this.root;tee.position.set(c.spawn.x,(heightAt(c.floors[0],c.spawn))+.035,c.spawn.z+.65);tee.material=this.material('tee','#d8f9ed',.15);
 }
 private makeBumper(key:string,x:number,y:number,z:number,r:number):Mesh {
  const m=MeshBuilder.CreateCylinder(`golfBumper:${key}`,{height:.6,diameter:r*2,tessellation:24},this.scene);m.parent=this.root;m.position.set(x,y+.3,z);m.material=this.material('bumper','#f472b6',.2);this.shadows.addShadowCaster(m);this.bumpers.set(key,m);return m;
 }
 event(e:GolfEvent,players:GolfPlayer[]):void {
  const p=players.find(p=>p.id===e.id);if(e.type==='hole')this.holePulse=1;
  if(!p||!['wall','bumper','ball','hole','shot'].includes(e.type))return;
  for(const s of this.sparks.filter(s=>s.life<=0).slice(0,6)){s.life=.35;s.mesh.isVisible=true;s.mesh.position.set(e.x,p.ball.y,e.z);const i=this.sparks.indexOf(s);s.velocity.set(Math.cos(i)*1.4,1.2,Math.sin(i)*1.4);}
 }
 update(players:GolfPlayer[],c:Course,time:number,extras:import('./minigolfTypes').Bumper[],dt:number):void {
  for(const {base,mesh} of this.floorMeshes){const f=floorAt(base,time);mesh.position.set(f.x,f.y,f.z);}
  c.walls.forEach((w,i)=>{const q=wallAt(w,time),m=this.walls[i];m.position.set((q.a.x+q.b.x)/2,q.y+.35,(q.a.z+q.b.z)/2);m.rotation.y=-Math.atan2(q.b.z-q.a.z,q.b.x-q.a.x);});
  const keys=new Set(extras.map(b=>b.owner!));for(const [key,m] of this.bumpers)if(!key.startsWith('static')&&!keys.has(key)){this.shadows.removeShadowCaster(m);m.dispose();this.bumpers.delete(key);}
  for(const b of extras)if(!this.bumpers.has(b.owner!))this.makeBumper(b.owner!,b.x,b.y,b.z,b.radius);
  this.previewAt-=dt;const refresh=this.previewAt<=0;if(refresh)this.previewAt=.12;
  for(const p of players){const b=p.ball,mesh=this.balls.get(p.id)!,ring=this.rings.get(p.id)!,arrow=this.arrows.get(p.id)!;
   mesh.position.set(b.x,b.y,b.z);mesh.isVisible=ring.isVisible=!p.finished;mesh.rotation.x+=b.vz*dt/GOLF.radius;mesh.rotation.z-=b.vx*dt/GOLF.radius;
   ring.position.set(b.x,b.y-GOLF.radius+.05,b.z);ring.scaling.setAll(p.armed?1.2:1);
   arrow.isVisible=!p.finished&&b.grounded&&speed(b)<GOLF.readySpeed;
   arrow.position.set(b.x+p.aim.x*(1+p.charge*1.7),b.y+.04,b.z+p.aim.z*(1+p.charge*1.7));arrow.rotation.y=Math.atan2(p.aim.x,p.aim.z);
   const dots=this.preview.get(p.id)!;
   if(refresh&&p.prediction>0&&!p.finished&&b.grounded&&speed(b)<GOLF.readySpeed){const points=predict(b,c,p.aim,p.charging?p.charge:.35,AB.minigolf.dottore.p.preview);dots.forEach((m,i)=>{m.isVisible=i<points.length;if(m.isVisible)m.position.set(points[i].x,b.y-.15,points[i].z);});}
   else if(p.prediction<=0||p.finished||speed(b)>GOLF.readySpeed)dots.forEach(m=>m.isVisible=false);
   this.trails.get(p.id)!.forEach((m,i)=>{m.isVisible=!p.finished&&speed(b)>9;if(m.isVisible)m.position.set(b.x-b.vx*.025*(i+1),b.y,b.z-b.vz*.025*(i+1));});
  }
  for(const s of this.sparks){s.life-=dt;s.mesh.isVisible=s.life>0;if(s.life>0){s.mesh.position.addInPlace(s.velocity.scale(dt));s.velocity.y-=4*dt;}}
  this.holePulse=Math.max(0,this.holePulse-dt*1.6);this.flag?.scaling.setAll(1+this.holePulse*.12);
 }
 dispose():void {this.root?.dispose();for(const map of [this.balls,this.rings,this.arrows])for(const m of map.values())m.dispose();for(const map of [this.preview,this.trails])for(const list of map.values())list.forEach(m=>m.dispose());this.sparks.forEach(s=>s.mesh.dispose());for(const m of this.materials.values())m.dispose();}
}
