import {Scene,MeshBuilder,StandardMaterial,Color3,DynamicTexture,Mesh,Vector3,VertexData,Texture} from '@babylonjs/core';
import {COVERS,ARENA_W,ARENA_D,SUPPLIES} from '../../../shared/orda/arena';
export const WORLD_LAYER=1;
/** Authored industrial arena. Every solid uses the same dimensions as simulation/navigation. */
export function buildDepot(scene:Scene):{fixtures:StandardMaterial[]}{
 const materials=new Map<string,StandardMaterial>();
 const material=(id:string,color:string,emissive=0)=>{let m=materials.get(id);if(m)return m;m=new StandardMaterial('depot:'+id,scene);m.diffuseColor=Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.scale(emissive);m.specularColor.setAll(.12);m.maxSimultaneousLights=2;materials.set(id,m);return m;};
 const concrete=material('concrete','#777d78'),metal=material('metal','#3e5350'),trim=material('steel','#222e32'),rust=material('rust','#9d6850'),yellow=material('hazard','#d5ad55'),light=material('fluorescent','#bdedd3',.9),dark=material('rubber','#19252a');
 const texture=new DynamicTexture('depotConcrete',{width:256,height:256},scene,false),ctx=texture.getContext() as CanvasRenderingContext2D;
 ctx.fillStyle='#838b8d';ctx.fillRect(0,0,256,256);let seed=7;for(let i=0;i<4300;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%256;seed=(seed*1664525+1013904223)>>>0;const y=seed%256;ctx.fillStyle=i%2?'#727d7d':'#9ba3a0';ctx.fillRect(x,y,1+i%3,1);}const edge=ctx.createLinearGradient(0,0,256,256);edge.addColorStop(0,'#00000020');edge.addColorStop(.45,'#ffffff08');edge.addColorStop(1,'#00000028');ctx.fillStyle=edge;ctx.fillRect(0,0,256,256);ctx.strokeStyle='#455358';ctx.lineWidth=1;ctx.strokeRect(.5,.5,255,255);ctx.strokeStyle='#bdc6c044';ctx.strokeRect(2,2,252,252);for(let i=0;i<16;i++){ctx.strokeStyle='#283b4426';ctx.beginPath();ctx.moveTo(i*29%256,i*73%256);ctx.lineTo(i*29%256+13,i*73%256+2);ctx.stroke();}texture.update();texture.uScale=11;texture.vScale=9;texture.wrapU=texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.anisotropicFilteringLevel=4;concrete.diffuseColor.setAll(.84);concrete.diffuseTexture=texture;concrete.specularColor.setAll(.08);
 const paint=new DynamicTexture('depotAgedPaint',{width:256,height:256},scene,false),pc=paint.getContext() as CanvasRenderingContext2D;pc.fillStyle='#c3c5bf';pc.fillRect(0,0,256,256);for(let i=0;i<1900;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%256;seed=(seed*1664525+1013904223)>>>0;pc.fillStyle=i%7===0?'#766752':'#a5aca6';pc.fillRect(x,seed%256,1+i%3,1+i%5);}pc.fillStyle='#4c5b59';for(let y=32;y<256;y+=64)pc.fillRect(0,y,256,2);paint.update();metal.diffuseTexture=paint;rust.diffuseTexture=paint;
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,m:StandardMaterial)=>{const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);mesh.material=m;mesh.isPickable=false;mesh.layerMask=WORLD_LAYER;mesh.freezeWorldMatrix();return mesh;};
 box('continuous-floor',0,-.15,0,ARENA_W,.3,ARENA_D,concrete);
 for(const b of COVERS){if(b.kind==='mystery'||b.kind==='perk')continue;const m=b.kind==='wall'?metal:b.kind==='container'?material('container'+(b.x<0?'L':'R'),b.x<0?'#43656c':'#8b5a47'):b.kind==='crate'?rust:trim;
  if(b.kind==='container')m.diffuseTexture=paint;
  box('solid:'+b.kind,b.x,b.h/2,b.z,b.w,b.h,b.d,m);
  if(b.kind==='container'){
   for(let t=-b.d/2+.3;t<b.d/2;t+=.65)for(const side of[-1,1])box('container-corrugation',b.x+side*(b.w/2+.035),b.h/2,b.z+t,.065,b.h-.18,.09,metal);
   box('container-header',b.x,b.h-.12,b.z,b.w+.08,.15,b.d+.08,trim);
   for(const side of[-1,1])box('container-door',b.x+side*b.w*.22,b.h/2,b.z-b.d/2-.04,b.w*.42,b.h-.35,.07,m);
  }else if(b.kind==='crate'){for(const h of[.25,b.h-.25])box('crate-strapping',b.x,h,b.z,b.w+.04,.12,b.d+.04,trim);}
 }
 // Loading dock ramps: exact matching six-unit analytic slope, full width.
 for(const side of[-1,1]){
  const x0=side*10,x1=side*16,z0=12.9,z1=16.5,mesh=new Mesh('loading-dock-ramp',scene),v=new VertexData();
  v.positions=[x0,1.6,z0,x0,1.6,z1,x1,0,z1,x1,0,z0];v.indices=side<0?[0,1,2,0,2,3]:[2,1,0,3,2,0];v.normals=[];VertexData.ComputeNormals(v.positions,v.indices,v.normals);v.uvs=[0,0,0,1,2,1,2,0];v.applyToMesh(mesh);mesh.material=metal;metal.backFaceCulling=false;mesh.layerMask=WORLD_LAYER;mesh.isPickable=false;mesh.freezeWorldMatrix();
 }
 // Thin floor markings do not create gameplay collision.
 for(const x of[-19,-6,6,19])for(let z=-15;z<11;z+=3)box('floor-guide',x,.012,z,.09,.015,1.5,yellow);
 for(const x of[-21,21])for(const z of[-12,0,12])box('wall-pillar',x,3,z,.25,6,.3,trim);
 for(const z of[-12,0,12]){box('roof-truss',0,6,z,43,.18,.25,trim);for(const x of[-15,0,15]){box('suspended-light',x,5.5,z,2,.11,.5,light);box('lamp-housing',x,5.65,z,2.3,.15,.7,trim);}}
 // Above-eye wall band and signage keep the arena open/readable without costly shadows/post FX.
 for(const z of[-17.45,17.45])box('warning-band',0,3.1,z,43,.16,.025,yellow);
 const sign=(text:string,x:number,y:number,z:number,w:number,rot=0)=>{const t=new DynamicTexture('sign:'+text,{width:512,height:128},scene,false),c=t.getContext() as CanvasRenderingContext2D;c.fillStyle='#152729';c.fillRect(0,0,512,128);c.strokeStyle='#d0aa60';c.lineWidth=8;c.strokeRect(6,6,500,116);c.fillStyle='#f1e8cd';c.font='bold 34px Arial';c.textAlign='center';c.fillText(text,256,77);t.update();const m=material('sign:'+text,'#ffffff',.5);m.diffuseTexture=t;const p=MeshBuilder.CreatePlane('depot-sign',{width:w,height:w/4,sideOrientation:Mesh.DOUBLESIDE},scene);p.position.set(x,y,z);p.rotation.y=rot;p.material=m;p.layerMask=WORLD_LAYER;p.isPickable=false;p.freezeWorldMatrix();};
 sign('IL DEPOSITO INFETTO',0,3.8,17.43,12);sign('CARICO 04 · NON ENTRARE',0,3.9,-17.43,10,Math.PI);
 sign('↑ PASSERELLA · DUE ACCESSI',0,2.9,12.86,7);
 for(const q of SUPPLIES){const y=q.z>12?1.6:0,col=q.kind==='ammo'?'#70bec1':q.kind==='health'?'#bce9ad':'#d7b56c',m=material(q.kind,col,.2);box('supply-pedestal',q.x,y+.4,q.z,1.25,.8,.85,dark);box('supply-body',q.x,y+.85,q.z,.95,.2,.65,m);sign(q.kind==='ammo'?'MUNIZIONI · 5s':'PRONTO SOCCORSO',q.x,y+1.3,q.z,1.9);}
 for(const side of[-1,1])for(const z of[-14,14]){box('infected-entry-door',side*21.45,1.8,z,.05,3.6,2.8,trim);box('entry-danger-strip',side*21.39,3.8,z,.06,.16,3.2,yellow);}
 // Baked-looking contact and light pools: shared textures, no shadow maps or extra lights.
 const gradient=(id:string,color:string,alpha:number)=>{const t=new DynamicTexture(id,{width:128,height:128},scene,true),c=t.getContext()as CanvasRenderingContext2D;c.clearRect(0,0,128,128);const g=c.createRadialGradient(64,64,12,64,64,63);g.addColorStop(0,color+alpha.toString(16).padStart(2,'0'));g.addColorStop(.5,color+Math.round(alpha*.5).toString(16).padStart(2,'0'));g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,128,128);t.hasAlpha=true;t.update();return t;};
 const shadow=material('contact-shadow','#ffffff');shadow.diffuseTexture=gradient('depot-contact-shadow','#000000',110);shadow.useAlphaFromDiffuseTexture=true;shadow.disableLighting=true;
 const warm=material('warm-pool','#ffffff',1);warm.diffuseTexture=gradient('depot-warm-pool','#ffd293',24);warm.useAlphaFromDiffuseTexture=true;warm.disableLighting=true;
 for(const b of COVERS)if(b.kind!=='wall'&&b.kind!=='perk'&&b.kind!=='mystery'){const plane=MeshBuilder.CreateGround('cover-contact',{width:b.w+1.7,height:b.d+1.7},scene);plane.position.set(b.x,.008,b.z);plane.material=shadow;plane.layerMask=WORLD_LAYER;plane.isPickable=false;plane.freezeWorldMatrix();}
 for(const x of[-15,0,15])for(const z of[-12,0,12]){const plane=MeshBuilder.CreateGround('lamp-pool',{width:7,height:5},scene);plane.position.set(x,.011,z);plane.material=warm;plane.layerMask=WORLD_LAYER;plane.isPickable=false;plane.freezeWorldMatrix();}
 const cyan=material('cyan-guide','#65c6d5',.65),amber=material('amber-guide','#e1a25c',.55);
 for(const x of[-21.35,21.35])for(const z of[-8,5])box('wall-guide-light',x,2.5,z,.05,.08,3,x<0?cyan:amber);
 // Static meshes/materials can be frozen; animated actors and viewmodels are added afterwards.
 // Merge only static meshes of the same material. A five-view arena otherwise repeats hundreds of trim draws.
 const groups=new Map<StandardMaterial,Mesh[]>();for(const mesh of [...scene.meshes])if(mesh instanceof Mesh&&mesh.layerMask===WORLD_LAYER&&mesh.material instanceof StandardMaterial){const list=groups.get(mesh.material)??[];list.push(mesh);groups.set(mesh.material,list);}
 for(const[mat,list]of groups)if(list.length>1){const merged=Mesh.MergeMeshes(list,true,true,undefined,false,false);if(merged){merged.name='depot-batch:'+mat.name;merged.material=mat;merged.layerMask=WORLD_LAYER;merged.isPickable=false;merged.freezeWorldMatrix();}}
 for(const m of materials.values())if(m!==light)m.freeze();
 return{fixtures:[light]};
}
