import { Color3, MeshBuilder, Scene } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import { EnvKit, seeded } from '../env/envKit';
import { paintSurfaceDetail } from '../env/surfaceDetail';
import type { CornicioneStage } from './fighterStages';

/** Static silhouettes stay behind z=3. No decorative mesh participates in fighter collision. */
export function buildCornicioneArena(scene:Scene,playZ:number,stage:CornicioneStage){
 const kit=new EnvKit(scene),port=stage.id==='darsena',width=stage.mainX*2;
 const palette=port?{fog:'#809da8',floor:'#a38b68',body:'#3d5660',metal:'#59767b',trim:'#e6c17e',sky:'#bcd6d6',wall:'#627d86'}
  :{fog:'#465465',floor:'#999389',body:'#4c535e',metal:'#75808b',trim:'#e3b14f',sky:'#b4c6da',wall:'#4e5968'};
 scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogColor=Color3.FromHexString(palette.fog);scene.fogStart=75;scene.fogEnd=300;
 kit.sky(port?[[0,'#203c59'],[.45,'#567b94'],[.75,'#adc3c2'],[1,'#edd6a7']]:[[0,'#141f36'],[.45,'#34445f'],[.75,'#6b7884'],[1,'#c8ad8b']]);
 kit.clouds({count:6,radius:380,yMin:95,yMax:145,tint:port?'#b7cbd0':'#8796ac',size:48,seed:port?53:72,arc:[.35,2.8]});
 kit.lightRig({key:[.35,-.7,.62],keyColor:port?'#fff0d0':'#ffe1ac',keyI:1.0,sky:palette.sky,ground:palette.body,fillI:.75,rim:{dir:[-.3,-.3,-1],color:port?'#9bd9de':'#9eb6e2',i:.3}});
 kit.glow(.28);
 const structure=kit.mat(palette.body,{emissive:.16,spec:.04});
 const metal=kit.mat(palette.metal,{emissive:.2,spec:.12});
 const trim=kit.mat(palette.trim,{emissive:.4,spec:.05});
 const dark=kit.mat(port?'#344c57':'#283747',{emissive:.18});
 const floorTex=kit.texture('arenaFloor_'+stage.id,1024,256,(c,w,h)=>{
  c.fillStyle=palette.floor;c.fillRect(0,0,w,h);paintSurfaceDetail(c,w,h,port?'wood':'stone',port?61:81);
  c.strokeStyle=port?'#584f4280':'#555f6670';c.lineWidth=2;
  const step=port?32:128;for(let x=0;x<w;x+=step){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
  const rnd=seeded(41);for(let i=0;i<55;i++){c.fillStyle='rgba(24,35,40,.08)';c.fillRect(rnd()*w,rnd()*h,30+rnd()*55,2+rnd()*8);}
  for(const x of [0,w-35]){c.fillStyle=palette.trim;c.fillRect(x,0,35,h);c.fillStyle='#273039';for(let y=-35;y<h;y+=42){c.beginPath();c.moveTo(x,y);c.lineTo(x+35,y+35);c.lineTo(x+35,y+53);c.lineTo(x,y+18);c.fill();}}
 });
 const floorMat=kit.mat('#ffffff',{tex:floorTex,emissive:.2,spec:.03});
 const body=kit.box('arenaBody',width,50,6,{x:0,y:-25,z:0},structure);kit.freeze(body);
 const top=MeshBuilder.CreatePlane('arenaFloor',{width,height:6},scene);top.rotation.x=Math.PI/2;top.position.set(0,.012,0);top.material=floorMat;kit.freeze(top);
 // Textured retaining wall: its silhouette is the same solid recovery wall used by physics.
 const wallTex=kit.texture('arenaSeawall_'+stage.id,512,512,(c,w,h)=>{
  c.fillStyle=port?'#71654e':'#697078';c.fillRect(0,0,w,h);paintSurfaceDetail(c,w,h,port?'wood':'stone',93);
  c.strokeStyle=port?'#3c443c':'#37414b';c.lineWidth=3;
  for(let y=0;y<h;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  for(let y=0;y<h;y+=64)for(let x=0;x<w;x+=64){c.strokeRect(x+(Math.floor(y/64)%2)*32,y,64,64);c.fillStyle='#bbc0b480';c.fillRect(x+8,y+8,3,3);}
  c.fillStyle=port?'#344f4e80':'#1d2a3820';c.fillRect(0,h*.45,w,h*.55);
 });
 const wall=MeshBuilder.CreatePlane('arenaFrontWall',{width,height:26},scene);wall.position.set(0,-13,-3.035);wall.rotation.y=Math.PI;wall.material=kit.mat('#ffffff',{tex:wallTex,emissive:.16,twoSided:true});kit.freeze(wall);
 // Main ledge and recovery walls retain exactly the same dimensions as the simulation.
 const rails:Mesh[]=[];
 rails.push(kit.box('mainLip',width,.16,.2,{x:0,y:-.08,z:-3.04},trim));
 for(const side of [-1,1]){
  rails.push(kit.box('edgeCap',.12,.1,6,{x:side*(stage.mainX-.08),y:.01,z:0},trim));
  for(const y of [-2,-5,-8])rails.push(kit.box('wallGuide',.16,.3,5.8,{x:side*stage.mainX,y,z:0},trim));
 }
 kit.merge('ledgeGuides',rails,trim);
 const decks:Mesh[]=[],frames:Mesh[]=[],edges:Mesh[]=[];
 for(const p of stage.platforms){
  const w=p.x1-p.x0,x=(p.x0+p.x1)/2;
  decks.push(kit.box('oneWayDeck_'+p.id,w,.24,2.8,{x,y:p.y-.12,z:0},port?floorMat:metal));
  edges.push(kit.box('oneWayStripe_'+p.id,w,.07,.12,{x,y:p.y-.015,z:-1.43},trim));
  // Open frames behind the fighters make the undersides visibly passable.
  for(const xx of [p.x0+.25,p.x1-.25])frames.push(kit.box('rearPost',.14,p.y,.14,{x:xx,y:p.y/2,z:1.5},metal));
  frames.push(kit.box('rearBrace',w,.13,.13,{x,y:p.y-1.0,z:1.5},metal));
 }
 kit.merge('oneWayDecks',decks,port?floorMat:metal);kit.merge('oneWayFrames',frames,metal);kit.merge('oneWayEdges',edges,trim);
 if(port){
  const water=MeshBuilder.CreateGround('harbourWater',{width:850,height:700},scene);water.position.set(0,-9,360);water.material=kit.mat('#3e8298',{emissive:.2,spec:.3});kit.freeze(water);
  const harbour:Mesh[]=[],ships:Mesh[]=[],lights:Mesh[]=[],cabins:Mesh[]=[],windows:Mesh[]=[];
  const boatPaint=kit.mat('#d3d2ba',{emissive:.16,spec:.09});
  const warehouseTex=kit.texture('warehouseFront',512,256,(c,w,h)=>{
   c.fillStyle='#637d84';c.fillRect(0,0,w,h);paintSurfaceDetail(c,w,h,'stone',64);
   for(let x=0;x<w;x+=16){c.fillStyle='#a7bcc12b';c.fillRect(x,0,2,h);}
   for(let x=28;x<w-20;x+=72){c.fillStyle='#253f50';c.fillRect(x,40,46,48);c.fillStyle='#e8cb87';c.fillRect(x+3,43,19,40);c.fillStyle='#456577';c.fillRect(x+25,43,18,40);}
   for(const x of [40,195,350]){c.fillStyle='#354f59';c.fillRect(x,118,116,138);c.strokeStyle='#8e9c92';c.lineWidth=2;for(let y=123;y<h;y+=13){c.beginPath();c.moveTo(x,y);c.lineTo(x+116,y);c.stroke();}}
  });
  const warehouseMat=kit.mat('#ffffff',{tex:warehouseTex,emissive:.25,twoSided:true});
  for(const side of [-1,1]){
   const x=side*42;
   harbour.push(kit.box('quay',23,5,18,{x,y:-6,z:34},structure));
   harbour.push(kit.box('warehouse',21,12,14,{x,y:2,z:46},structure));
   harbour.push(kit.box('warehouseRoof',23,.7,16,{x,y:8.3,z:46},structure));
   const front=MeshBuilder.CreatePlane('warehouseFacade',{width:21,height:12},scene);front.position.set(x,2,38.96);front.rotation.y=Math.PI;front.material=warehouseMat;kit.freeze(front);
   ships.push(kit.cyl('shipHull',12,9,2.8,{x:side*31,y:-7,z:70,sx:1.8,sz:.55},metal,8));
   cabins.push(kit.box('shipDeck',17,.45,6,{x:side*31,y:-5.45,z:70},boatPaint));
   cabins.push(kit.box('shipCabin',5,4,4,{x:side*34,y:-3.2,z:70},boatPaint));
   windows.push(kit.box('shipWheelhouseWindow',3.8,1.2,.1,{x:side*34,y:-2.4,z:67.94},dark));
   ships.push(kit.box('shipMast',.17,13,.17,{x:side*28,y:1,z:70},metal));
   lights.push(kit.box('shipFlag',2,1,.1,{x:side*28+1,y:6.5,z:70},trim));
   harbour.push(kit.box('harbourCrane',.9,30,.9,{x:x+side*9,y:11,z:40},structure));
   harbour.push(kit.box('harbourJib',23,.7,.7,{x:x+side*2,y:25,z:40},structure));
   harbour.push(kit.box('harbourCable',.1,11,.1,{x:x-side*7,y:19,z:40},structure));
  }
  for(const x of [-11,11]){
   harbour.push(kit.cyl('bollard',.45,.7,.9,{x,y:.45,z:3.6},structure));
   lights.push(kit.box('dockLamp',.3,2.7,.3,{x,y:1.35,z:4.2},trim));
  }
  kit.merge('harbourBuildings',harbour,structure);kit.merge('harbourShips',ships,metal);kit.merge('boatCabins',cabins,boatPaint);kit.merge('boatWindows',windows,dark);kit.merge('dockLights',lights,trim);
  kit.sign('DARSENA 31',{style:'poster',color:'#264959',w:4,h:.8,x:0,y:-1.2,z:-3.1,ry:Math.PI});
  kit.sign('ULTIMO MOLO',{style:'neon',color:'#edcc85',w:7,h:1.3,x:-42,y:6.3,z:38.8,ry:Math.PI});
 }else{
  kit.skyline({radius:280,height:50,y:-16,color:'#2c394d',kind:'city',seed:72,arc:[.1,3.04]});
  const concrete:Mesh[]=[],steel:Mesh[]=[],warnings:Mesh[]=[];
  for(const side of [-1,1]){
   const x=side*39,z=34;
   for(let level=0;level<7;level++){
    concrete.push(kit.box('buildingSlab',19,.6,12,{x,y:-12+level*6,z},structure));
    for(const offset of [-8,0,8])steel.push(kit.box('buildingColumn',.55,6,.55,{x:x+offset,y:-9+level*6,z:z-5.4},metal));
   }
   steel.push(kit.box('towerCrane',1.2,61,1.2,{x:x+side*12,y:5.5,z:55},metal));
   steel.push(kit.box('craneArm',40,.9,.9,{x:x+side*2,y:35,z:55},metal));
   steel.push(kit.box('craneHook',.13,15,.13,{x:x-side*14,y:27.5,z:55},metal));
   warnings.push(kit.box('workLight',1.5,.25,.25,{x:x-5*side,y:24.5,z:28},trim));
  }
  for(const x of [-11,11]){steel.push(kit.box('workLampStand',.12,2.8,.12,{x,y:1.4,z:3.5},metal));warnings.push(kit.box('workLamp',.9,.5,.35,{x,y:2.6,z:3.5},trim));}
  kit.merge('unfinishedFloors',concrete,structure);kit.merge('constructionSteel',steel,metal);kit.merge('constructionLights',warnings,trim);
  kit.sign('QUOTA +31',{style:'hazard',w:4.5,h:.9,x:0,y:-1.2,z:-3.1,ry:Math.PI});
 }
 return {playZ,update(_now:number):void{}};
}
