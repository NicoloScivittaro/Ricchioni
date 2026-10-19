import {Scene,Mesh,MeshBuilder,StandardMaterial,ShaderMaterial,Color3,Vector3,VertexData,TransformNode} from '@babylonjs/core';

/** Low-poly coachwork with rounded shoulders. A loft, rather than a scaled cube. */
export function kartShell(scene:Scene,name:string,width:number,height:number,depth:number):Mesh {
 const positions:number[]=[],indices:number[]=[];
 const rings=[[-.5,.78,.82],[-.4,1,1],[.23,.95,1],[.5,.56,.68]];
 // Chamfered cross-section, flat underside and sloping upper shoulders.
 const profile=[[-1,-.5],[-1,.12],[-.72,.5],[.72,.5],[1,.12],[1,-.5]];
 for(const [z,w,h]of rings)for(const [x,y]of profile)positions.push(x*width*.5*w,y*height*h,z*depth);
 for(let r=0;r<rings.length-1;r++)for(let j=0;j<6;j++){const a=r*6+j,b=r*6+(j+1)%6;indices.push(a,b,a+6,b,b+6,a+6);}
 for(let j=1;j<5;j++){indices.push(0,j+1,j);const o=18;indices.push(o,o+j,o+j+1);}
 const vd=new VertexData();vd.positions=positions;vd.uvs=positions.flatMap((_,i)=>i%3===0?[positions[i]/width+.5,positions[i+2]/depth+.5]:[]);vd.indices=indices;VertexData.ComputeNormals(positions,indices,vd.normals=[]);
 const mesh=new Mesh(name,scene);vd.applyToMesh(mesh);mesh.convertToFlatShadedMesh();return mesh;
}

/** All rigid additions are merged by material at the end, so detail is not a draw call per bolt. */
export function detailCoachwork(scene:Scene,parent:TransformNode,w:number,d:number,paint:StandardMaterial,metal:StandardMaterial,dark:StandardMaterial):Mesh[] {
 const parts:Mesh[]=[];
 const add=(m:Mesh,mat:StandardMaterial,x:number,y:number,z:number)=>{m.material=mat;m.position.set(x,y,z);parts.push(m);return m;};
 const box=(name:string,x:number,y:number,z:number,a:number,b:number,c:number,mat:StandardMaterial)=>add(MeshBuilder.CreateBox(name,{width:a,height:b,depth:c},scene),mat,x,y,z);
 const tube=(name:string,path:Vector3[],r:number,mat:StandardMaterial)=>add(MeshBuilder.CreateTube(name,{path,radius:r,tessellation:6},scene),mat,0,0,0);
 const pearl=new StandardMaterial('kartIvory',scene);pearl.diffuseColor=Color3.FromHexString('#f1eee1');pearl.specularPower=64;
 const lamp=new StandardMaterial('kartHeadlight',scene);lamp.diffuseColor=Color3.FromHexString('#fff1be');lamp.emissiveColor=Color3.FromHexString('#ffe7a0').scale(.5);
 // Side pods: chamfered air intakes with contrasting black inset and white livery.
 for(const side of [-1,1]){
  const pod=kartShell(scene,'sculptedSidepod',w*.25,.36,d*.8);add(pod,paint,side*w*.49,.38,-.08);
  box('podIntake',side*w*.58,.45,.25,.035,.14,.4,dark);
  box('liveryStripe',side*w*.39,.67,-.06,.12,.025,d*.7,pearl);
  box('frontHeadlight',side*w*.3,.4,d*.62,.22,.1,.085,lamp);
  tube('bumperHoop',[new Vector3(side*w*.57,.3,d*.38),new Vector3(side*w*.64,.3,d*.64),new Vector3(side*.2,.3,d*.73)],.07,metal);
  const exhaust=add(MeshBuilder.CreateCylinder('titaniumExhaust',{diameter:.19,height:.5,tessellation:10},scene),metal,side*w*.35,.35,-d*.59);exhaust.rotation.x=Math.PI/2;
  const hole=add(MeshBuilder.CreateCylinder('exhaustBore',{diameter:.125,height:.012,tessellation:10},scene),dark,side*w*.35,.35,-d*.72);hole.rotation.x=Math.PI/2;
  box('rearWingEndplate',side*w*.58,.89,-d*.56,.07,.26,.42,paint);
  // Two exposed suspension arms at each axle.
  for(const z of [-d*.37,d*.35])tube('wishbone',[new Vector3(side*.3,.32,z-.13),new Vector3(side*w*.66,.33,z),new Vector3(side*.3,.32,z+.13)],.035,metal);
 }
 box('rearDiffuser',0,.18,-d*.5,w*.9,.14,.3,dark);
 for(const x of [-.36,-.12,.12,.36])box('diffuserFin',x,.2,-d*.6,.035,.23,.28,metal);
 tube('seatHoop',[new Vector3(-.33,.72,-.45),new Vector3(-.33,1.02,-.5),new Vector3(.33,1.02,-.5),new Vector3(.33,.72,-.45)],.045,metal);
 box('engineCover',0,.5,-d*.44,w*.65,.18,.35,dark);
 for(let i=0;i<5;i++)box('engineVent',0,.6,-d*.44+(i-2)*.05,w*.48,.02,.018,metal);
 const wheel=add(MeshBuilder.CreateTorus('steeringWheel',{diameter:.38,thickness:.055,tessellation:12},scene),dark,0,.94,.18);wheel.rotation.x=-.7;
 for(const group of new Set(parts.map(m=>m.material))){const ms=parts.filter(m=>m.material===group);const merged=Mesh.MergeMeshes(ms,true,true);if(merged){merged.material=group;merged.parent=parent;merged.isPickable=false;}}
 return parent.getChildMeshes().filter((m):m is Mesh=>m instanceof Mesh);
}

/** Profiled tyre plus contrasting five-spoke hub, one merged multi-material mesh per wheel. */
export function detailedWheel(scene:Scene,diameter:number,rubber:StandardMaterial,metal:StandardMaterial,paint:StandardMaterial):Mesh {
 const r=diameter/2;
 const tyre=MeshBuilder.CreateLathe('tyre',{shape:[new Vector3(r*.72,-.19,0),new Vector3(r*.94,-.16,0),new Vector3(r,-.11,0),new Vector3(r,.11,0),new Vector3(r*.94,.16,0),new Vector3(r*.72,.19,0)],tessellation:20,closed:false,cap:Mesh.CAP_ALL},scene);tyre.material=rubber;
 const parts=[tyre];
 for(const side of [-1,1]){
  const rim=MeshBuilder.CreateTorus('rimLip',{diameter:diameter*.64,thickness:.035,tessellation:16},scene);rim.position.y=side*.192;rim.material=metal;parts.push(rim);
  const hub=MeshBuilder.CreateCylinder('hub',{diameter:diameter*.22,height:.42,tessellation:10},scene);hub.material=paint;parts.push(hub);
  for(let i=0;i<5;i++){
   const a=i*Math.PI*2/5,s=MeshBuilder.CreateBox('wheelSpoke',{width:.045,height:.035,depth:diameter*.25},scene);s.position.set(Math.sin(a)*diameter*.2,side*.196,Math.cos(a)*diameter*.2);s.rotation.y=a;s.material=metal;parts.push(s);
  }
 }
 // Fine transverse tread strips are geometry, requiring no texture or extra draw calls.
 for(let i=0;i<16;i++){const a=i*Math.PI/8;const tread=MeshBuilder.CreateBox('tyreTread',{width:.025,height:.24,depth:.012},scene);tread.position.set(Math.sin(a)*(r+.002),0,Math.cos(a)*(r+.002));tread.rotation.y=a;tread.material=rubber;parts.push(tread);}
 const result=Mesh.MergeMeshes(parts,true,true,undefined,false,true)!;result.name='kartWheel';result.rotation.z=Math.PI/2;result.bakeCurrentTransformIntoVertices();return result;
}

/** Same chassis/wheel geometry in a single depth-only submission; colour materials are irrelevant to shadows. */
export function coachworkShadow(scene:Scene,parent:TransformNode,meshes:Mesh[]):Mesh {
 const positions:number[]=[],indices:number[]=[];
 for(const mesh of meshes){const vs=mesh.getVerticesData('position'),is=mesh.getIndices();if(!vs||!is)continue;
  const base=positions.length/3,world=mesh.computeWorldMatrix(true);
  for(let i=0;i<vs.length;i+=3){const p=Vector3.TransformCoordinates(new Vector3(vs[i],vs[i+1],vs[i+2]),world);positions.push(p.x,p.y,p.z);}
  for(const i of is)indices.push(i+base);
 }
 const vd=new VertexData();vd.positions=positions;vd.indices=indices;VertexData.ComputeNormals(positions,indices,vd.normals=[]);
 const proxy=new Mesh('kartDepthCaster',scene);vd.applyToMesh(proxy);const mat=new StandardMaterial('kartDepthOnly',scene);proxy.material=mat;proxy.parent=parent;proxy.visibility=0;proxy.isPickable=false;return proxy;
}

/** Paint, rubber, metal and lamps retain distinct surface response in one material submission. */
export function paintedChassis(scene:Scene,parts:Mesh[]):Mesh {
 for(const part of parts){
  const mat=part.material as StandardMaterial,n=part.getTotalVertices(),colors=new Float32Array(n*4),surface=new Float32Array(n*2);
  const gloss=Math.max(mat.specularColor.r,mat.specularColor.g,mat.specularColor.b),glow=Math.max(mat.emissiveColor.r,mat.emissiveColor.g,mat.emissiveColor.b);
  for(let i=0;i<n;i++){colors.set([mat.diffuseColor.r,mat.diffuseColor.g,mat.diffuseColor.b,1],i*4);surface.set([gloss,glow],i*2);}
  part.setVerticesData('color',colors);part.setVerticesData('uv2',surface,false,2);
 }
 const body=Mesh.MergeMeshes(parts,true,true)!;body.name='kartPaintedChassis';
 const shader=new ShaderMaterial('kartLayeredPaint',scene,{
  vertexSource:`precision highp float;attribute vec3 position;attribute vec3 normal;attribute vec4 color;attribute vec2 uv2;uniform mat4 world;uniform mat4 worldViewProjection;varying vec3 n;varying vec3 p;varying vec4 tint;varying vec2 finish;void main(){p=(world*vec4(position,1.)).xyz;n=normalize(mat3(world)*normal);tint=color;finish=uv2;gl_Position=worldViewProjection*vec4(position,1.);}`,
  fragmentSource:`precision highp float;uniform vec3 cameraPosition;varying vec3 n;varying vec3 p;varying vec4 tint;varying vec2 finish;void main(){vec3 N=normalize(n),L=normalize(vec3(.55,1.,.35)),V=normalize(cameraPosition-p);float sun=max(dot(N,L),0.);float spec=pow(max(dot(N,normalize(L+V)),0.),16.+finish.x*90.);float rim=pow(1.-max(dot(N,V),0.),3.);vec3 col=tint.rgb*(vec3(.31,.38,.46)+vec3(.85,.77,.61)*sun);col+=vec3(1.,.94,.8)*spec*finish.x*.7+vec3(.4,.65,.8)*rim*finish.x*.18;col+=tint.rgb*finish.y*.65;gl_FragColor=vec4(col,1.);}`
 },{attributes:['position','normal','color','uv2'],uniforms:['world','worldViewProjection','cameraPosition']});
 body.material=shader;return body;
}
