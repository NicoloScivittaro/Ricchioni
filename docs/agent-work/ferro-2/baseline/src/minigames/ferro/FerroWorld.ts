import{Scene,Mesh,MeshBuilder,StandardMaterial,DynamicTexture,Color3,Vector3,TransformNode,Texture}from'@babylonjs/core';
import{SOLIDS,VENTS,RADIUS}from'../../../shared/ferro/arena';
import type{FerroState}from'../../../shared/ferro/types';
import{ferroMaterial}from'./FerroWeapons';
import{Rng}from'../../../shared/rng';
export class FerroWorld{
 private torches:Mesh[]=[];private fires:Mesh[]=[];private warnings:Mesh[]=[];private ring:Mesh;private danger:Mesh;private paths:Vector3[][];private lastRing=-1;private flameMaterial:StandardMaterial;readonly shadowMaterial:StandardMaterial;
 constructor(private scene:Scene){
  const staticParts:Mesh[]=[],stone=ferroMaterial(scene,'limestone','#a6a091'),darkStone=ferroMaterial(scene,'dark-stone','#676c68'),sand=ferroMaterial(scene,'sandstone','#9e8a71'),gold=ferroMaterial(scene,'world-bronze','#ad8c52',true),iron=ferroMaterial(scene,'gate-iron','#354751',true),teal=ferroMaterial(scene,'banner-teal','#326c70'),red=ferroMaterial(scene,'banner-red','#803f43');
  const put=(m:Mesh,mat:StandardMaterial,x:number,y:number,z:number,rotation=0)=>{m.position.set(x,y,z);m.rotation.y=rotation;m.material=mat;m.isPickable=false;staticParts.push(m);return m;};
  const box=(name:string,w:number,h:number,d:number,mat:StandardMaterial,x:number,y:number,z:number,r=0)=>put(MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),mat,x,y,z,r);
  const cylinder=(name:string,diameter:number,height:number,mat:StandardMaterial,x:number,y:number,z:number,n=12)=>put(MeshBuilder.CreateCylinder(name,{diameter,height,tessellation:n},scene),mat,x,y,z);
  const floor=this.floor();const ground=MeshBuilder.CreateGround('ferro-floor',{width:34,height:34},scene);ground.material=floor;ground.isPickable=false;staticParts.push(ground);
  const shadeTexture=new DynamicTexture('ferro-contact-texture',64,scene,true),ctx=shadeTexture.getContext()as CanvasRenderingContext2D,gradient=ctx.createRadialGradient(32,32,3,32,32,31);gradient.addColorStop(0,'#00000080');gradient.addColorStop(1,'#00000000');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);shadeTexture.hasAlpha=true;shadeTexture.update();
  const shadow=this.shadowMaterial=new StandardMaterial('ferro-contact',scene);shadow.diffuseTexture=shadeTexture;shadow.useAlphaFromDiffuseTexture=true;shadow.disableLighting=true;shadow.alpha=.5;shadow.freeze();
  for(const b of SOLIDS){
   if(b.kind==='column'){
    box('column-plinth',b.w,.23,b.d,darkStone,b.x,.115,b.z);box('column-base',b.w*.92,.18,b.d*.92,stone,b.x,.32,b.z);
    cylinder('column-shaft',1.08,b.h-.85,stone,b.x,(b.h-.85)/2+.42,b.z,16);for(let j=0;j<12;j++){const a=j*Math.PI/6;cylinder('fluted-stone',.07,b.h-1.1,darkStone,b.x+Math.sin(a)*.52,(b.h-1.1)/2+.5,b.z+Math.cos(a)*.52,5);}
    box('column-capital',1.55,.23,1.55,stone,b.x,b.h-.23,b.z);box('column-bronze-band',1.37,.08,1.37,gold,b.x,b.h-.43,b.z);
   }else{box('stone-cover',b.w,b.h,b.d,darkStone,b.x,b.h/2,b.z);box('stone-cover-cap',b.w,.12,b.d,stone,b.x,b.h-.06,b.z);box('cover-inscription',b.w*.6,.18,.025,gold,b.x,b.h*.65,b.z+b.d/2+.015);}
   const shade=MeshBuilder.CreateGround('column-shadow',{width:3.4,height:4.4},scene);put(shade,shadow,b.x+.7,.015,b.z+.75);
  }
  for(let i=0;i<48;i++){const a=i*Math.PI/24,x=Math.sin(a)*16.3,z=Math.cos(a)*16.3;box('arena-stone-wall',2.18,2.7,.6,i%3?stone:darkStone,x,1.35,z,a);box('arena-wall-coping',2.24,.16,.8,sand,x,2.78,z,a);}
  for(let i=0;i<36;i++){const a=i*Math.PI/18;
   for(let row=0;row<4;row++){const r=18+row*1.25;box('colosseum-terrace',r*Math.PI/17.5,.65,1.35,i%3?darkStone:sand,Math.sin(a)*r,1+row*.7,Math.cos(a)*r,a);box('seating-step',r*Math.PI/19,.11,.70,stone,Math.sin(a)*r,1.36+row*.7,Math.cos(a)*r,a);}
   const r=24;box('outer-arcade-pier',.8,9,.9,darkStone,Math.sin(a)*r,4.5,Math.cos(a)*r,a);box('outer-frieze',4.2,.6,1.2,stone,Math.sin(a)*r,9,Math.cos(a)*r,a);
   const arch=MeshBuilder.CreateTube('roman-arch',{path:Array.from({length:17},(_,j)=>new Vector3(Math.cos(j/16*Math.PI)*1.7,Math.sin(j/16*Math.PI)*1.7,0)),radius:.18,tessellation:6},scene);put(arch,sand,Math.sin(a+.087)*r,6.7,Math.cos(a+.087)*r,a);
  }
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,r=17.2,x=Math.sin(a)*r,z=Math.cos(a)*r;
   cylinder('banner-column',.7,7.6,sand,x,3.8,z);box('banner-cap',1.2,.3,1.2,gold,x,7.65,z,a);
   const flag=MeshBuilder.CreatePlane('tournament-banner',{width:1.12,height:2.7,sideOrientation:Mesh.DOUBLESIDE},scene);put(flag,i%2?teal:red,Math.sin(a)*16.8,5.6,Math.cos(a)*16.8,a);box('banner-rod',1.4,.06,.08,gold,Math.sin(a)*16.8,7,Math.cos(a)*16.8,a);
   const emblem=MeshBuilder.CreateTorus('banner-crest',{diameter:.52,thickness:.045,tessellation:16},scene);put(emblem,gold,Math.sin(a)*16.74,5.6,Math.cos(a)*16.74,a);emblem.rotation.x=Math.PI/2;
   if(i%3===0){const rr=16.0;for(let j=-2;j<=2;j++)box('sealed-gate-bar',.055,2.3,.08,iron,Math.sin(a)*rr+Math.cos(a)*j*.25,1.2,Math.cos(a)*rr-Math.sin(a)*j*.25,a);box('gate-hinge',1.3,.08,.13,gold,Math.sin(a)*rr,2.4,Math.cos(a)*rr,a);}
  }
  for(let i=0;i<4;i++){
   const a=(i+.5)*Math.PI/2,r=19.5,x=Math.sin(a)*r,z=Math.cos(a)*r;
   box('statue-plinth',2,1.2,2,darkStone,x,1.2,z);cylinder('bronze-warrior-body',.9,1.7,gold,x,2.55,z,8);put(MeshBuilder.CreateSphere('statue-helmet',{diameter:.7,segments:8},scene),iron,x,3.75,z);for(const side of[-1,1])cylinder('statue-leg',.3,1.4,iron,x+side*.3,1.9,z);box('statue-spear',.07,4,.07,gold,x+.85,3,z);const shield=MeshBuilder.CreateCylinder('statue-shield',{diameter:1.2,height:.13,tessellation:10},scene);put(shield,iron,x-.65,2.9,z-.3);shield.rotation.x=Math.PI/2;
  }
  const crest=MeshBuilder.CreateTorus('arena-inlaid-ring',{diameter:5.3,thickness:.035,tessellation:64},scene);put(crest,gold,0,.018,0);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const line=box('arena-inlaid-ray',.035,.018,2.1,gold,Math.sin(a)*3.8,.022,Math.cos(a)*3.8,a);void line;}
  const flame=this.flameMaterial=new StandardMaterial('ferro-flame',scene);flame.disableLighting=true;flame.emissiveColor=new Color3(1,.39,.07);flame.diffuseColor=flame.emissiveColor;flame.freeze();
  for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/6,r=16.1,x=Math.sin(a)*r,z=Math.cos(a)*r;box('torch-bracket',.12,.65,.25,iron,x,2.25,z,a);const fire=MeshBuilder.CreateCylinder('torch-fire',{diameterTop:0,diameterBottom:.28,height:.65,tessellation:6},scene);fire.position.set(x,2.9,z);fire.material=flame;fire.isPickable=false;this.torches.push(fire);}
  for(const v of VENTS){
   const plate=MeshBuilder.CreateCylinder('fire-vent',{diameter:1.2,height:.055,tessellation:16},scene);put(plate,iron,v.x,.028,v.z);for(let j=-2;j<=2;j++)box('vent-grid',.055,.06,.85,gold,v.x+j*.16,.06,v.z);
   const warning=MeshBuilder.CreateTorus('vent-warning',{diameter:2.5,thickness:.045,tessellation:32},scene);warning.position.set(v.x,.045,v.z);warning.material=flame;warning.setEnabled(false);warning.isPickable=false;this.warnings.push(warning);
   const fire=MeshBuilder.CreateCylinder('announced-flame-jet',{diameterTop:.13,diameterBottom:.8,height:2.5,tessellation:7},scene);fire.position.set(v.x,1.2,v.z);fire.material=flame;fire.setEnabled(false);fire.isPickable=false;this.fires.push(fire);
  }
  const grouped=new Map<unknown,Mesh[]>();for(const mesh of staticParts){const list=grouped.get(mesh.material)??[];list.push(mesh);grouped.set(mesh.material,list);}
  for(const list of grouped.values()){const mesh=list.length===1?list[0]:Mesh.MergeMeshes(list,true,true,undefined,false,false)!;mesh.freezeWorldMatrix();mesh.isPickable=false;}
  this.ring=MeshBuilder.CreateTorus('sudden-death-boundary',{diameter:2,thickness:.012,tessellation:96},scene);this.ring.position.y=.07;this.ring.material=flame;this.ring.isPickable=false;this.ring.setEnabled(false);
  this.paths=[0,1].map(row=>Array.from({length:65},(_,i)=>new Vector3(Math.sin(i/64*Math.PI*2)*(row?RADIUS:15.9),.035,Math.cos(i/64*Math.PI*2)*(row?RADIUS:15.9))));
  this.danger=MeshBuilder.CreateRibbon('danger-zone',{pathArray:this.paths,updatable:true,sideOrientation:Mesh.DOUBLESIDE},scene);const dm=new StandardMaterial('danger-zone',scene);dm.disableLighting=true;dm.emissiveColor=new Color3(.93,.22,.04);dm.alpha=.18;dm.disableDepthWrite=true;dm.freeze();this.danger.material=dm;this.danger.isPickable=false;this.danger.setEnabled(false);
 }
 private floor():StandardMaterial{
  const texture=new DynamicTexture('ferro-mosaic',{width:1024,height:1024},this.scene,true),c=texture.getContext()as CanvasRenderingContext2D,rng=new Rng(8301),image=c.createImageData(1024,1024);
  for(let i=0;i<image.data.length;i+=4){const n=rng.int(-9,9);image.data[i]=137+n;image.data[i+1]=133+n;image.data[i+2]=121+n;image.data[i+3]=255;}c.putImageData(image,0,0);
  c.strokeStyle='#4d544c80';c.lineWidth=2;for(let y=0;y<1024;y+=44){c.beginPath();c.moveTo(0,y);c.lineTo(1024,y);c.stroke();for(let x=(y/44)%2?22:0;x<1024;x+=74){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+44);c.stroke();}}
  for(let i=0;i<1300;i++){c.fillStyle=i%2?'#242e251b':'#f0e1b51d';c.fillRect(rng.int(0,1024),rng.int(0,1024),rng.int(1,12),rng.int(1,3));}
  for(const radius of[91,220,340,460,479]){c.strokeStyle=radius===479?'#302f2b':'#b29b64aa';c.lineWidth=radius===479?14:4;c.beginPath();c.arc(512,512,radius,0,Math.PI*2);c.stroke();}
  c.strokeStyle='#c0a16399';c.lineWidth=3;for(let i=0;i<24;i++){const a=i*Math.PI/12;c.beginPath();c.moveTo(512+Math.sin(a)*345,512+Math.cos(a)*345);c.lineTo(512+Math.sin(a)*456,512+Math.cos(a)*456);c.stroke();}texture.update();texture.anisotropicFilteringLevel=4;
  const material=new StandardMaterial('ferro-paved-mosaic',this.scene);material.diffuseTexture=texture;material.specularColor.setAll(.1);material.maxSimultaneousLights=2;material.freeze();return material;
 }
 update(s:FerroState):void{
  for(let i=0;i<this.torches.length;i++){const scale=.9+Math.sin(s.time*8+i*2)*.12;this.torches[i].scaling.set(1,scale,1);}
  const active=s.phase==='fight';for(let i=0;i<this.fires.length;i++){this.fires[i].setEnabled(active&&s.flame==='active');this.fires[i].scaling.y=.88+Math.sin(s.time*20+i)*.12;this.warnings[i].setEnabled(active&&s.flame!=='off');this.warnings[i].scaling.setAll(s.flame==='warning'?1+Math.sin(s.time*11)*.06:1);}
  const show=active&&s.ringRadius<RADIUS-.01;this.ring.setEnabled(show);this.danger.setEnabled(show);if(show){this.ring.scaling.set(s.ringRadius,1,s.ringRadius);if(Math.abs(s.ringRadius-this.lastRing)>.025){this.lastRing=s.ringRadius;for(let i=0;i<65;i++){const a=i/64*Math.PI*2;this.paths[0][i].x=Math.sin(a)*s.ringRadius;this.paths[0][i].z=Math.cos(a)*s.ringRadius;}MeshBuilder.CreateRibbon('danger-zone',{pathArray:this.paths,instance:this.danger});}}
 }
}
