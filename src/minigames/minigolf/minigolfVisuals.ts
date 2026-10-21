import {Scene,Mesh,MeshBuilder,Vector3,StandardMaterial,Color3,TransformNode,VertexData,ShadowGenerator,DynamicTexture} from '@babylonjs/core';
import type {Course,GolfPlayer,GolfEvent,Floor} from './minigolfTypes';
import {GOLF} from './minigolfTypes';
import {floorAt,heightAt,wallAt} from './minigolfCourses';
import {predict,speed} from './minigolfPhysics';
import {AB} from '../../../shared/abilityCatalog';
import {golfSurface,importedMesh} from './minigolfArt';
import imported from './minigolfImported.json';
export class MinigolfVisuals {
 private root:TransformNode|null=null;
 private floorMeshes:{base:Floor;mesh:Mesh}[]=[];
 private walls:Mesh[]=[];private hole:Mesh|null=null;private flag:TransformNode|null=null;
 readonly balls=new Map<string,Mesh>();readonly rings=new Map<string,Mesh>();
 private arrows=new Map<string,Mesh>();private preview=new Map<string,Mesh[]>();private trails=new Map<string,Mesh[]>();
 private bumpers=new Map<string,Mesh>();private sparks:{mesh:Mesh;life:number;velocity:Vector3}[]=[];
 private sinking=new Map<string,{x:number;y:number;z:number;elapsed:number}>();
 private materials=new Map<string,StandardMaterial>();private previewAt=0;private holePulse=0;
 constructor(private scene:Scene,players:GolfPlayer[],private shadows:ShadowGenerator){
  for(const p of players){
   const mat=this.material(`ball:${p.id}`,p.color,.015);
   if(!mat.diffuseTexture){const relief=golfSurface(scene,'golfBallRelief:'+p.id,'ball');const texture=relief.diffuseTexture as DynamicTexture,ctx=texture.getContext();ctx.fillStyle=p.color;ctx.fillRect(0,113,256,30);texture.update();mat.diffuseColor=Color3.White();mat.diffuseTexture=texture;relief.diffuseTexture=null;relief.dispose();mat.specularColor=new Color3(.32,.32,.32);mat.specularPower=72;}
   const b=MeshBuilder.CreateSphere(`golfBall:${p.id}`,{diameter:GOLF.radius*2,segments:24},scene);b.material=mat;this.shadows.addShadowCaster(b);this.balls.set(p.id,b);
   const ring=MeshBuilder.CreateTorus(`golfRing:${p.id}`,{diameter:.68,thickness:.02,tessellation:24},scene);ring.material=this.material(`ring:${p.id}`,p.color,.3);this.rings.set(p.id,ring);
   const arrow=MeshBuilder.CreateCylinder(`golfAim:${p.id}`,{height:.75,diameterBottom:.32,diameterTop:0,tessellation:6},scene);arrow.material=this.material('aimWhite','#fff5bd',.4);arrow.rotation.x=Math.PI/2;this.arrows.set(p.id,arrow);
   const dots=Array.from({length:40},(_,i)=>{const m=MeshBuilder.CreateSphere(`predict:${p.id}:${i}`,{diameter:.085,segments:4},scene);m.material=ring.material;m.isVisible=false;return m;});this.preview.set(p.id,dots);
   const trail=Array.from({length:5},(_,i)=>{const m=MeshBuilder.CreateSphere(`trail:${p.id}:${i}`,{diameter:.1,segments:4},scene);m.material=ring.material;m.isVisible=false;return m;});this.trails.set(p.id,trail);
  }
  for(let i=0;i<40;i++){const mesh=MeshBuilder.CreateSphere('golfSpark',{diameter:.08,segments:4},scene);mesh.material=this.material('spark','#fff1ad',.5);mesh.isVisible=false;this.sparks.push({mesh,life:0,velocity:Vector3.Zero()});}
 }
 private material(id:string,color:string,glow=0):StandardMaterial{
  let m=this.materials.get(id);if(m)return m;m=new StandardMaterial(id,this.scene);m.diffuseColor=Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.scale(glow);m.specularColor=new Color3(.08,.08,.08);this.materials.set(id,m);return m;
 }
 build(c:Course):void {
  if(this.root)for(const mesh of this.root.getChildMeshes())this.shadows.removeShadowCaster(mesh);
  this.root?.dispose();this.bumpers.clear();this.root=new TransformNode('golfCourseRoot',this.scene);this.floorMeshes=[];this.walls=[];
  this.sinking.clear();for(const mesh of this.balls.values())mesh.scaling.setAll(1);
  this.holePulse=0;this.previewAt=0;this.sparks.forEach(s=>{s.life=0;s.mesh.isVisible=false;});for(const dots of this.preview.values())dots.forEach(m=>m.isVisible=false);
  const surface=(id:string,kind:'turf'|'wood'|'stone'|'sand')=>{let m=this.materials.get(id);if(!m){m=golfSurface(this.scene,id,kind);this.materials.set(id,m);}return m;};
  const floorMat=surface('clubTurf','turf'),wood=surface('courseTimber','wood'),stone=surface('courseStone','stone'),sand=surface('courseSand','sand');
  if(c.imported){
   const data=imported[c.imported];
   for(const [i,part] of data.geometry.entries()){
    const name=part.material,rail=name.includes('Light_Gray'),skirt=name.includes('Golden_Beige');
    const lawn=/BROWN_GREEN|Pale_Jade|BROOM_YELLOW|LIGHT_BLUE/.test(name);const mat=rail?stone:skirt||!lawn?wood:floorMat;
    const mesh=importedMesh(this.scene,this.root,part,'importedCourse:'+c.imported+':'+i,mat);
    if(rail)this.shadows.addShadowCaster(mesh);
   }
  }
  for(const [i,f] of (c.imported?[]:c.floors).entries()){
   const mesh=new Mesh(`golfFloor:${i}`,this.scene),pts=[[-f.w/2,-f.d/2],[f.w/2,-f.d/2],[f.w/2,f.d/2],[-f.w/2,f.d/2]];
   const positions=pts.flatMap(([x,z])=>[x,(f.slopeX??0)*x+(f.slopeZ??0)*z,z]),indices=[0,1,2,0,2,3],normals:number[]=[];
   VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=[0,0,f.w/4,0,f.w/4,f.d/4,0,f.d/4];data.applyToMesh(mesh);
   const floorMaterial=f.surface==='sand'?sand:f.surface==='ice'?this.material('ice','#aecfd4',.025):floorMat;
   floorMaterial.backFaceCulling=false;floorMaterial.twoSidedLighting=true;mesh.material=floorMaterial;mesh.parent=this.root;mesh.position.set(f.x,f.y,f.z);mesh.receiveShadows=true;this.floorMeshes.push({base:f,mesh});
   // Lightweight solid skirt makes floating islands and slopes readable.
   for(let edge=0;edge<4;edge++){
    const a=pts[edge],b=pts[(edge+1)%4],top=([x,z]:number[])=>new Vector3(x,(f.slopeX??0)*x+(f.slopeZ??0)*z-.015,z);
    const ta=top(a),tb=top(b),wall=MeshBuilder.CreateRibbon('islandEdge',{pathArray:[[ta,tb],[ta.add(new Vector3(0,-.95,0)),tb.add(new Vector3(0,-.95,0))]],sideOrientation:Mesh.DOUBLESIDE},this.scene);
    wall.material=stone;wall.parent=mesh;
   }
  }
  for(const [wi,w] of c.walls.entries()){if(c.imported&&wi<imported[c.imported].walls.length)continue;const m=MeshBuilder.CreateBox('golfWall',{width:Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z)+w.radius*2,height:w.height??(w.rotation?.45:.7),depth:w.radius*2},this.scene);m.parent=this.root;m.material=w.rotation?this.material('movingArm','#cc8750'):wood;const q=wallAt(w,0);m.position.set((q.a.x+q.b.x)/2,q.y+(w.height??(w.rotation?.45:.7))/2,(q.a.z+q.b.z)/2);m.rotation.y=-Math.atan2(q.b.z-q.a.z,q.b.x-q.a.x);const cap=MeshBuilder.CreateBox('railCap',{width:Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z)+w.radius*2,height:.06,depth:w.radius*2+.035},this.scene);cap.parent=m;cap.position.y=(w.height??(w.rotation?.45:.7))/2;cap.material=this.material('railCapMat','#e3d7b9');this.shadows.addShadowCaster(m);this.walls[wi]=m;}
  for(const [i,b] of c.bumpers.entries())this.makeBumper(`static${i}`,b.x,b.y,b.z,b.radius);
  this.hole=MeshBuilder.CreateDisc('golfCup',{radius:GOLF.cupRadius,tessellation:32},this.scene);this.hole.rotation.x=Math.PI/2;this.hole.position.set(c.hole.x,c.holeY+.025,c.hole.z);this.hole.material=this.material('cup','#09141c');this.hole.parent=this.root;
  const lip=MeshBuilder.CreateTorus('cupRim',{diameter:GOLF.cupRadius*2+.05,thickness:.035,tessellation:32},this.scene);lip.parent=this.root;lip.position.set(c.hole.x,c.holeY+.035,c.hole.z);lip.material=this.material('cupGold','#d5dcd5',.015);
  this.flag=new TransformNode('golfFlag',this.scene);this.flag.parent=this.root;this.flag.position.set(c.hole.x,c.holeY,c.hole.z);
  const pole=MeshBuilder.CreateCylinder('flagPole',{height:2.5,diameter:.055},this.scene);pole.parent=this.flag;pole.position.y=1.25;pole.material=this.material('chrome','#dce6f0');
  const flag=MeshBuilder.CreateBox('flag',{width:1,height:.6,depth:.025},this.scene);flag.parent=this.flag;flag.position.set(.5,2.2,0);flag.material=this.material('flag','#dc7855');
  const tee=MeshBuilder.CreateBox('teeLine',{width:6,height:.025,depth:.1},this.scene);tee.parent=this.root;tee.position.set(c.spawn.x,(heightAt(c.floors[0],c.spawn))+.035,c.spawn.z+.65);tee.material=this.material('tee','#d8f9ed',.15);
  const moving=new Set([...this.floorMeshes.filter(f=>f.base.motion).flatMap(f=>[f.mesh,...f.mesh.getChildMeshes()]),...this.walls.filter((_,i)=>c.walls[i].rotation).flatMap(m=>[m,...m.getChildMeshes()]),...this.flag.getChildMeshes()]);
  for(const mesh of this.root.getChildMeshes())if(!moving.has(mesh))mesh.freezeWorldMatrix();
 }
 private makeBumper(key:string,x:number,y:number,z:number,r:number):Mesh {
  const m=MeshBuilder.CreateCylinder(`golfBumper:${key}`,{height:.6,diameter:r*2,tessellation:24},this.scene);m.parent=this.root;m.position.set(x,y+.3,z);m.material=this.material('bumper','#ae6a56',.025);this.shadows.addShadowCaster(m);this.bumpers.set(key,m);return m;
 }
 event(e:GolfEvent,players:GolfPlayer[]):void {
  const p=players.find(p=>p.id===e.id);if(e.type==='hole'){this.holePulse=1;if(p)this.sinking.set(p.id,{x:p.ball.x,y:p.ball.y,z:p.ball.z,elapsed:0});}
  if(!p||!['wall','bumper','ball','hole','shot'].includes(e.type))return;
  for(const s of this.sparks.filter(s=>s.life<=0).slice(0,6)){s.life=.35;s.mesh.isVisible=true;s.mesh.position.set(e.x,p.ball.y,e.z);const i=this.sparks.indexOf(s);s.velocity.set(Math.cos(i)*1.4,1.2,Math.sin(i)*1.4);}
 }
 update(players:GolfPlayer[],c:Course,time:number,extras:import('./minigolfTypes').Bumper[],dt:number,activeId?:string,aiming=true):void {
  for(const {base,mesh} of this.floorMeshes)if(base.motion){const f=floorAt(base,time);mesh.position.set(f.x,f.y,f.z);}
  c.walls.forEach((w,i)=>{if(!w.rotation)return;const q=wallAt(w,time),m=this.walls[i];m.position.set((q.a.x+q.b.x)/2,q.y+(w.height??(w.rotation?.45:.7))/2,(q.a.z+q.b.z)/2);m.rotation.y=-Math.atan2(q.b.z-q.a.z,q.b.x-q.a.x);});
  const keys=new Set(extras.map(b=>b.owner!));for(const [key,m] of this.bumpers)if(!key.startsWith('static')&&!keys.has(key)){this.shadows.removeShadowCaster(m);m.dispose();this.bumpers.delete(key);}
  for(const b of extras)if(!this.bumpers.has(b.owner!))this.makeBumper(b.owner!,b.x,b.y,b.z,b.radius);
  this.previewAt-=dt;const refresh=this.previewAt<=0;if(refresh)this.previewAt=.12;
  for(const p of players){const b=p.ball,mesh=this.balls.get(p.id)!,ring=this.rings.get(p.id)!,arrow=this.arrows.get(p.id)!;
   mesh.position.set(b.x,b.y,b.z);mesh.isVisible=ring.isVisible=!p.finished&&!b.done;mesh.rotation.x+=b.vz*dt/GOLF.radius;mesh.rotation.z-=b.vx*dt/GOLF.radius;
   const drop=this.sinking.get(p.id);mesh.scaling.setAll(1);
   if(drop){drop.elapsed+=dt;const t=Math.min(1,drop.elapsed/GOLF.cupDropTime),ease=1-(1-t)*(1-t);
    mesh.isVisible=t<1;mesh.position.set(drop.x+(c.hole.x-drop.x)*ease,drop.y-.95*t*t,drop.z+(c.hole.z-drop.z)*ease);mesh.scaling.setAll(1-.15*t);
    if(t>=1)this.sinking.delete(p.id);
   }
   ring.position.set(b.x,b.y-GOLF.radius+.05,b.z);ring.scaling.setAll(p.armed?1.2:1);
   arrow.isVisible=(!activeId||p.id===activeId)&&aiming&&!p.finished&&b.grounded&&speed(b)<GOLF.readySpeed;
   arrow.position.set(b.x+p.aim.x*(1.3+p.charge*1.2),b.y-.12,b.z+p.aim.z*(1.3+p.charge*1.2));arrow.rotation.y=Math.atan2(p.aim.x,p.aim.z);arrow.scaling.y=.8+p.charge*.6;
   const dots=this.preview.get(p.id)!;
   if(refresh&&p.prediction>0&&!p.finished&&b.grounded&&speed(b)<GOLF.readySpeed){const points=predict(b,c,p.aim,p.charging?p.charge:.35,AB.minigolf.dottore.p.preview);dots.forEach((m,i)=>{m.isVisible=i<points.length;if(m.isVisible)m.position.set(points[i].x,points[i].y-.15,points[i].z);});}
   else if(p.prediction<=0||p.finished||speed(b)>GOLF.readySpeed)dots.forEach(m=>m.isVisible=false);
   this.trails.get(p.id)!.forEach((m,i)=>{m.isVisible=!p.finished&&speed(b)>9;if(m.isVisible)m.position.set(b.x-b.vx*.025*(i+1),b.y,b.z-b.vz*.025*(i+1));});
  }
  for(const s of this.sparks){s.life-=dt;s.mesh.isVisible=s.life>0;if(s.life>0){s.mesh.position.addInPlace(s.velocity.scale(dt));s.velocity.y-=4*dt;}}
  this.holePulse=Math.max(0,this.holePulse-dt*1.6);this.flag?.scaling.setAll(1+this.holePulse*.12);
 }
 dispose():void {this.sinking.clear();this.root?.dispose();for(const map of [this.balls,this.rings,this.arrows])for(const m of map.values())m.dispose();for(const map of [this.preview,this.trails])for(const list of map.values())list.forEach(m=>m.dispose());this.sparks.forEach(s=>s.mesh.dispose());for(const m of this.materials.values())m.dispose(false,true);}
}
