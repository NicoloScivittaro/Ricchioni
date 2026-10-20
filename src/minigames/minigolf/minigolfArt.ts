import {Color3,DynamicTexture,Mesh,MeshBuilder,Scene,StandardMaterial,TransformNode,VertexData,Vector3,Texture} from '@babylonjs/core';
import imported from './minigolfImported.json';
/** Shared, deterministic textures: no per-frame painting, randomness or external texture fetches. */
export function golfSurface(scene:Scene,name:string,kind:'turf'|'stone'|'wood'|'sand'|'water'|'ball'):StandardMaterial {
 const m=new StandardMaterial(name,scene),size=kind==='ball'?256:512,t=new DynamicTexture(name+'Texture',size,scene,false),c=t.getContext() as CanvasRenderingContext2D;
 let seed=193;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 c.fillStyle={turf:'#388655',stone:'#a49b86',wood:'#986b42',sand:'#dac398',water:'#368d9b',ball:'#dadada'}[kind];c.fillRect(0,0,size,size);
 if(kind==='turf'){
  c.fillStyle='rgba(210,238,186,.085)';c.fillRect(0,0,size/2,size);
  for(let i=0;i<22000;i++){const x=rnd()*size,y=rnd()*size;c.strokeStyle=rnd()>.5?'rgba(15,48,22,.16)':'rgba(195,226,152,.18)';c.beginPath();c.moveTo(x,y);c.lineTo(x+.5,y+1+rnd()*3);c.stroke();}
 }else if(kind==='stone'){
  for(let i=0;i<18000;i++){c.fillStyle=rnd()>.5?'rgba(255,246,220,.1)':'rgba(47,43,34,.13)';c.fillRect(rnd()*size,rnd()*size,1+rnd()*3,1+rnd()*2);}
  c.strokeStyle='rgba(47,49,42,.3)';c.lineWidth=3;for(let y=0;y<=size;y+=128){c.beginPath();c.moveTo(0,y);c.lineTo(size,y);c.stroke();for(let x=(y%256?0:128);x<size;x+=256){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+128);c.stroke();}}
 }else if(kind==='wood'){
  for(let i=0;i<170;i++){c.strokeStyle=`rgba(45,26,10,${.03+rnd()*.12})`;c.lineWidth=.4+rnd()*2;c.beginPath();const y=rnd()*size;c.moveTo(0,y);c.bezierCurveTo(150,y+rnd()*12,380,y-rnd()*12,size,y);c.stroke();}
 }else if(kind==='water'){
  for(let i=0;i<400;i++){c.strokeStyle='rgba(181,229,226,.1)';c.lineWidth=1+rnd()*2;const x=rnd()*size,y=rnd()*size;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+8,y-2,x+18,y+2,x+30,y);c.stroke();}
 }else if(kind==='ball'){
  c.fillStyle='#eee';c.fillRect(0,0,size,size);for(let y=0;y<size;y+=24)for(let x=0;x<size;x+=24){const px=x+(y%48?12:0);const g=c.createRadialGradient(px-2,y-2,1,px,y,7);g.addColorStop(0,'#c9c9c9');g.addColorStop(.6,'#e4e4e4');g.addColorStop(1,'#fafafa');c.fillStyle=g;c.beginPath();c.arc(px,y,7,0,Math.PI*2);c.fill();}
 }else for(let i=0;i<26000;i++){c.fillStyle=rnd()>.5?'rgba(255,252,225,.2)':'rgba(94,70,44,.16)';c.fillRect(rnd()*size,rnd()*size,1,1);}
 t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE;t.update();t.anisotropicFilteringLevel=4;m.diffuseTexture=t;m.specularColor=new Color3(.035,.035,.035);return m;
}
export function importedMesh(scene:Scene,parent:TransformNode,data:{positions:number[];indices:number[]},name:string,material:StandardMaterial):Mesh {
 const mesh=new Mesh(name,scene),v=new VertexData(),normals:number[]=[];v.positions=data.positions;v.indices=data.indices;VertexData.ComputeNormals(data.positions,data.indices,normals);v.normals=normals;
 // World-space metre tiling stays continuous across the original CAD submeshes.
 v.uvs=data.positions.flatMap((_,i)=>i%3===0?[data.positions[i]/4,data.positions[i+2]/4]:[]);v.applyToMesh(mesh);mesh.material=material;mesh.parent=parent;mesh.receiveShadows=true;mesh.isPickable=false;return mesh;
}
/** Static club architecture sits beside play, never across a playable lane. */
export function buildGolfClub(scene:Scene):void {
 const root=new TransformNode('golfClubEnvironment',scene),stone=golfSurface(scene,'clubStone','stone'),wood=golfSurface(scene,'clubTimber','wood'),water=golfSurface(scene,'clubWater','water');water.specularColor=new Color3(.3,.39,.4);water.specularPower=96;(water.diffuseTexture as DynamicTexture).uScale=14;(water.diffuseTexture as DynamicTexture).vScale=18;
 const mat=(name:string,color:string)=>{const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=new Color3(.04,.04,.04);return m;};
 const leaf=mat('clubLeaves','#3f7550'),darkLeaf=mat('clubLeavesDark','#285943'),flowers=mat('clubFlowers','#e6a86d'),metal=mat('clubMetal','#374b48'),cream=mat('clubCream','#dfd6c1');
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,m:StandardMaterial)=>{const b=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);b.position.set(x,y,z);b.material=m;b.parent=root;return b;};
 const sea=MeshBuilder.CreateGround('clubSea',{width:280,height:300},scene);sea.position.y=-3;sea.material=water;sea.parent=root;
 for(const side of [-1,1]){
  box('stonePromenade',side*20,-.85,0,7,.7,108,stone);
  for(const z of [-43,-27,-10,9,27,44]){
   box('planter',side*20,-.05,z,3,.85,3,stone);
   for(let j=0;j<3;j++){const shrub=MeshBuilder.CreateSphere('gardenShrub',{diameter:1.7,segments:8},scene);shrub.position.set(side*20+(j-1)*.65,.45,z);shrub.scaling.y=.7+j*.15;shrub.material=j%2?darkLeaf:leaf;shrub.parent=root;}
   for(let j=0;j<4;j++){const bloom=MeshBuilder.CreateSphere('gardenFlower',{diameter:.19,segments:5},scene);bloom.position.set(side*20-1+j*.6,.65,z+1);bloom.material=flowers;bloom.parent=root;}
   if(Math.abs(z)>12){box('benchSeat',side*18.4,.18,z+4,2.3,.16,.7,wood);box('benchBack',side*18.4,.65,z+4.28,2.3,.7,.12,wood);for(const x of [-.85,.85])box('benchLeg',side*18.4+x,-.1,z+4,.1,.6,.55,metal);}
   const trunk=MeshBuilder.CreateCylinder('palmTrunk',{height:5,diameterTop:.18,diameterBottom:.32,tessellation:9},scene);trunk.position.set(side*21.4,2,z);trunk.material=wood;trunk.parent=root;trunk.rotation.z=side*.1;
   for(let j=0;j<7;j++){const a=j*Math.PI*2/7,tip=new Vector3(side*21.4+Math.cos(a)*2.5,4.1,z+Math.sin(a)*2.5),start=new Vector3(side*21.4,4.5,z);const frond=MeshBuilder.CreateRibbon('palmFrond',{pathArray:[[start,Vector3.Lerp(start,tip,.55).add(new Vector3(-Math.sin(a)*.5,.3,Math.cos(a)*.5)),tip],[start,Vector3.Lerp(start,tip,.55).add(new Vector3(Math.sin(a)*.5,.3,-Math.cos(a)*.5)),tip]],sideOrientation:Mesh.DOUBLESIDE},scene);frond.material=leaf;frond.parent=root;}
  }
  for(const z of [-36,-18,0,18,36]){const pole=MeshBuilder.CreateCylinder('clubLamp',{height:3.5,diameter:.085,tessellation:8},scene);pole.position.set(side*17.4,1.3,z);pole.material=metal;pole.parent=root;box('lampLantern',side*17.4,3.1,z,.32,.45,.32,cream);}
 }
 const mill=new TransformNode('importedWindmill',scene);mill.parent=root;mill.position.set(19.2,-.45,-4);mill.rotation.y=-Math.PI/2;mill.scaling.setAll(.9);
 const millColors=['#729daf','#b15b4a','#d9bb7d','#b6a7c0','#a2b8c3','#e7dccc','#47865a','#405551','#87a7b0','#d1bd98'];
 for(const [i,part] of imported.windmill.entries()){const m=importedMesh(scene,mill,part,'originalWindmill:'+i,mat('windmillMat:'+i,millColors[part.material]));m.material!.backFaceCulling=false;}
 // Merge by material once: dense garden dressing does not add hundreds of draw calls.
 const groups=new Map<StandardMaterial,Mesh[]>();for(const mesh of root.getChildMeshes()){if(!(mesh instanceof Mesh)||!mesh.material)continue;mesh.computeWorldMatrix(true);const a=groups.get(mesh.material as StandardMaterial)??[];a.push(mesh);groups.set(mesh.material as StandardMaterial,a);}
 for(const meshes of groups.values()){const merged=Mesh.MergeMeshes(meshes,true,true,undefined,false,false);if(merged){merged.name='clubDecorMerged';merged.isPickable=false;merged.freezeWorldMatrix();}}
}
