import {Color3,Mesh,MeshBuilder,Scene,ShaderMaterial,StandardMaterial,Vector3,VertexBuffer} from '@babylonjs/core';
import {EnvKit,seeded} from '../env/envKit';
import type {TrackSpline} from './track';

type Site={x:number;y:number;z:number;ry:number};
/** Water has no reflection render target: five cameras share the same two analytic wave fields. */
export function coastalWater(scene:Scene):ShaderMaterial {
 const mat=new ShaderMaterial('coastalWater3',scene,{
  vertexSource:`precision highp float;attribute vec3 position;uniform mat4 world;uniform mat4 worldViewProjection;varying vec3 p;void main(){p=(world*vec4(position,1.)).xyz;gl_Position=worldViewProjection*vec4(position,1.);}`,
  fragmentSource:`precision highp float;varying vec3 p;uniform float time;uniform vec3 eye;
  void main(){vec2 q=p.xz;float a=sin(q.x*.27+q.y*.19+time*.65),b=sin(q.x*.43-q.y*.31-time*.43);vec3 n=normalize(vec3(a*.12,1.,b*.09));vec3 v=normalize(eye-p);float f=pow(1.-max(dot(v,n),0.),3.);float depth=smoothstep(0.,65.,min(abs(p.x-217.),abs(p.z-251.)));vec3 col=mix(vec3(.065,.62,.65),vec3(.025,.30,.49),depth);col=mix(col,vec3(.45,.74,.84),f*.65);float glint=pow(max(dot(reflect(normalize(vec3(.55,-1.,.35)),n),v),0.),72.);float wave=smoothstep(.89,.99,a*.55+b*.45)*.13;col+=vec3(.48,.78,.8)*wave+vec3(1.,.85,.56)*glint*.55;float coast=min(abs(p.x-217.),abs(p.z-251.));col=mix(col,vec3(.82,.94,.87),(1.-smoothstep(0.,2.2,coast))*(.22+.22*sin(time+q.x*.3+q.y*.3)));gl_FragColor=vec4(col,1.);}`
 },{attributes:['position'],uniforms:['world','worldViewProjection','time','eye']});
 mat.backFaceCulling=false;mat.setFloat('time',0);mat.setVector3('eye',Vector3.Zero());
 scene.onBeforeCameraRenderObservable.add(camera=>mat.setVector3('eye',camera.globalPosition));return mat;
}

/** Architectural detail is generated once, then batched into one tinted atlas draw (no per-frame traversal). */
export function buildCoastalDetails(scene:Scene,spline:TrackSpline,beside:(f:number,side:number,off:number)=>Site,clear:(x:number,z:number,r:number)=>boolean):void {
 const kit=new EnvKit(scene),rnd=seeded(308),parts:Mesh[]=[];
 const stone=kit.mat('#e7dbc2',{spec:.08,key:'coastal3Stone'}),wood=kit.mat('#996344',{spec:.12,key:'coastal3Wood'}),metal=kit.mat('#304759',{spec:.55,key:'coastal3Steel'}),white=kit.mat('#f4ebd5',{spec:.15,key:'coastal3Ivory'}),glass=kit.mat('#356579',{spec:.8,key:'coastal3Glass'});
 const sand=kit.mat('#e7cd98',{spec:0});
 const coral=kit.mat('#df7054',{spec:.15}),teal=kit.mat('#328f94',{spec:.2}),green=kit.mat('#459579',{spec:.05});
 const put=(b:Site,x:number,y:number,z:number)=>({x:b.x+x*Math.cos(b.ry)+z*Math.sin(b.ry),y:b.y+y,z:b.z-x*Math.sin(b.ry)+z*Math.cos(b.ry),ry:b.ry});
 const box=(name:string,b:Site,x:number,y:number,z:number,w:number,h:number,d:number,mat:StandardMaterial)=>{const m=kit.box(name,w,h,d,put(b,x,y,z),mat);parts.push(m);return m;};
 const cyl=(name:string,b:Site,x:number,y:number,z:number,top:number,bot:number,h:number,mat:StandardMaterial)=>{const m=kit.cyl(name,top,bot,h,put(b,x,y,z),mat,10);parts.push(m);return m;};
 const sign=(b:Site,text:string,w=4)=>kit.sign(text,{...put(b,0,3.1,-.08),w,h:.75,style:'board',bg:'#173e50',color:'#fff1cb',ry:b.ry+Math.PI});
 // Coastal sand follows the actual circuit. Beach furniture sits at sea level, not at viaduct height.
 const shorePaths=[2,60].map(offset=>Array.from({length:71},(_,i)=>{const d=(.008+i/70*.23)*spline.totalLength,p=spline.worldPoint(d,spline.widthAt(d)/2+offset);p.y=-1.66;return p;}));
 const shore=MeshBuilder.CreateRibbon('coastalBeach',{pathArray:shorePaths,sideOrientation:Mesh.DOUBLESIDE},scene);shore.material=sand;parts.push(shore);
 const foundation=(b:Site,w:number,d:number)=>{const height=b.y+1.8;if(height>.1)box('coastalFoundation',b,0,-height/2,0,w,height,d,stone);};
 // Promenade furniture and actual beach clubs follow the revised spline, rather than old world coordinates.
 for(let i=0;i<17;i++){
  const b=beside(.015+i*.013,1,5);if(!clear(b.x,b.z,1.5))continue;
  box('promenadePaving',b,0,-.28,0,4.8,.35,7,stone);
  box('benchSeat',b,-.7,.55,0,2.3,.12,.65,wood);box('benchBack',b,-.7,.95,.32,2.3,.65,.09,wood);
  for(const x of [-1.5,.15])box('benchLeg',b,x,.25,0,.1,.5,.5,metal);
  cyl('planter',b,1.5,.35,0,.8,1,.7,stone);cyl('clippedShrub',b,1.5,1,0,0,1.4,1.2,green);
  if(i%3===0){const c=beside(.015+i*.013,1,12);if(!clear(c.x,c.z,4))continue;
   foundation(c,5.4,4.1);
   box('beachKiosk',c,0,1.4,0,5,2.8,3.5,i%2?teal:coral);box('kioskCounter',c,0,1.3,-1.8,4,.18,.7,wood);box('kioskRecess',c,0,1.9,-1.77,3.8,1.1,.05,metal);
   const roof=box('kioskAwning',c,0,3.05,-.9,5.8,.17,5,white);roof.rotation.x=.09;sign(c,['LIDO AZZURRO','GRANITE & MARE','BAGNI RIBALTATI','RIVA CLUB','CHIOSCO 31','IL MOLO'][Math.floor(i/3)]);
  }
 }
 // Beach parasols, loungers, striped cabins: repeated parts, shared materials.
 for(let i=0;i<28;i++){
  const b={...beside(.018+i*.0075,1,19+(i%2)*8),y:-1.6};if(!clear(b.x,b.z,3))continue;
  cyl('parasolCanopy',b,0,2.6,0,.18,3.4,.7,i%2?coral:teal);cyl('parasolPole',b,0,1.3,0,.06,.06,2.6,white);
  for(const x of [-1.1,1.1]){box('loungerFrame',b,x,.3,1.8,.78,.12,2.1,white);const back=box('loungerBack',b,x,.65,2.48,.78,.75,.1,i%2?teal:coral);back.rotation.x=-.45;box('loungerLeg',b,x,.15,1.3,.7,.3,.08,wood);}
  if(i%4===0){box('cabinFrame',b,0,1.3,5,2,2.6,2,white);for(let j=0;j<5;j++)box('cabinSlat',b,(j-2)*.35,1.3,3.98,.16,2.4,.05,i%2?teal:coral);cyl('cabinRoof',b,0,2.9,5,0,2.9,.8,coral);}
 }
 // Village frontages: deep window reveals, balconies with rails, roof cornices and canvas shop awnings.
 for(let i=0;i<24;i++){
  const b=beside(.255+i*.0095,i%2?1:-1,9);if(!clear(b.x,b.z,3.8))continue;
  const h=5.5+(i%4)*1.8,w=5.2+(i%3)*.6;foundation(b,w,4.2);box('villageFacade',b,0,h/2,0,w,h,4.2,[stone,coral,white,teal][i%4]);
  box('villageCornice',b,0,h,0,w+.4,.25,4.55,white);
  for(let floor=0;floor<Math.floor(h/2.7);floor++)for(const x of [-1.5,1.5]){
   box('windowReveal',b,x,2.2+floor*2.5,-2.13,1.25,1.6,.12,metal);box('windowGlass',b,x,2.2+floor*2.5,-2.21,.95,1.35,.05,glass);
   box('windowSill',b,x,1.4+floor*2.5,-2.35,1.5,.13,.45,white);
   for(const side of [-1,1])box('shutter',b,x+side*.72,2.2+floor*2.5,-2.2,.3,1.6,.1,i%2?teal:wood);
   if(floor>0){box('balconySlab',b,x,1.3+floor*2.5,-2.6,1.8,.16,1.1,stone);box('balconyRail',b,x,1.9+floor*2.5,-3.05,1.8,.06,.06,metal);for(let j=-2;j<=2;j++)box('balconyBaluster',b,x+j*.36,1.65+floor*2.5,-3.05,.035,.5,.035,metal);}
  }
  box('shopDoor',b,0,.95,-2.17,1.15,1.9,.08,glass);
  for(let j=0;j<8;j++){const a=box('stripedShopAwning',b,(j-3.5)*w/8,2.65,-2.8,w/8,.09,1.7,j%2?white:(i%2?coral:teal));a.rotation.x=-.14;}
  if(i%4===0){const c={...b,...put(b,0,0,-2.25)};sign(c,['CAFFÈ DEL PORTO','GELATI ARTIGIANALI','OSTERIA DEL BORGO','ALIMENTARI','BAR DELLA CURVA','BOTTEGA 14'][Math.floor(i/4)],w);}
 }
 // Porto: timber decks, mooring bollards/ropes, fishing hulls and ribbed freight containers.
 for(let i=0;i<12;i++){
  const b=beside(.515+i*.011,-1,9);if(!clear(b.x,b.z,4))continue;
  for(const x of [-2.8,2.8])for(const z of [-2.8,2.8]){const h=b.y+1.8;box('harbourPilings',b,x,-h/2,z,.35,h,.35,wood);}
  box('harbourDeck',b,0,-.35,0,7,.5,7,wood);for(const x of [-2.7,2.7]){cyl('mooringBollard',b,x,.3,-2.6,.3,.4,.6,metal);box('bollardCap',b,x,.65,-2.6,.65,.12,.25,metal);}
  const rope=MeshBuilder.CreateTube('mooringRope',{path:[new Vector3(-2.7,.45,-2.6),new Vector3(0,.2,-2.6),new Vector3(2.7,.45,-2.6)],radius:.04,tessellation:5},scene);rope.material=stone;rope.position.set(b.x,b.y,b.z);rope.rotation.y=b.ry;parts.push(rope);
  if(i%2){const hull=MeshBuilder.CreateCylinder('fishingHull',{diameterTop:2.8,diameterBottom:1.8,height:1,tessellation:8},scene);hull.scaling.z=2;hull.material=i%3?teal:coral;const hp=put(b,0,-.3,7);hull.position.set(hp.x,hp.y,hp.z);hull.rotation.y=b.ry;parts.push(hull);box('boatCabin',b,0,.55,7,1.6,1.3,1.8,white);box('boatWindow',b,0,.7,6.05,1.3,.65,.06,glass);cyl('boatMast',b,0,2,7,.07,.07,3.8,metal);}
  else {box('freightContainer',b,0,1.3,0,5,2.6,2.4,i%3?teal:coral);for(let j=-5;j<=5;j++)box('containerRib',b,j*.43,1.3,-1.23,.055,2.4,.07,metal);}
 }
 // Belvedere stone parapets and high cantilever lookout platforms. All outside the driving envelope.
 for(let i=0;i<11;i++){
  const b=beside(.12+i*.011,1,3.2);if(!clear(b.x,b.z,1))continue;
  box('lookoutWalk',b,0,-.35,0,5,.5,6,stone);for(const x of [-2,2]){box('lookoutPost',b,x,.4,1.9,.2,.9,.2,stone);box('lookoutCap',b,x,.92,1.9,.4,.12,.4,white);}box('lookoutHandrail',b,0,.85,1.9,4.2,.1,.1,metal);
 }
 // Paddock race scenery, pit structures and unambiguous lane direction.
 for(let i=0;i<10;i++){
  const b=beside(.77+i*.022,i%2?1:-1,8);if(!clear(b.x,b.z,3))continue;
  foundation(b,5.5,4.5);box('pitGarage',b,0,1.8,0,5.5,3.6,4.5,metal);box('pitOpening',b,0,1.4,-2.27,4.7,2.8,.05,glass);box('pitFascia',b,0,3.15,-2.4,5.7,.55,.3,i%2?teal:coral);
  for(const x of [-2,2]){cyl('paddockTyre',b,x,.28,-3.2,.7,.7,.55,metal);cyl('paddockTyre',b,x,.82,-3.2,.7,.7,.55,metal);}
 }
 // Checker motif beside the finish, clear of every chase camera.
 for(const side of [-1,1]){const b=beside(.995,side,5);for(let y=0;y<4;y++)for(let x=0;x<4;x++)box('finishChecker',b,(x-1.5)*.65,2+y*.65,0,.65,.65,.12,(x+y)%2?white:metal);}
 // One four-surface atlas and vertex tint: preserve wood/stucco variation without a draw per colour.
 const atlas=kit.texture('coastal3Atlas',512,128,(c,w,h)=>{
  for(let tile=0;tile<4;tile++){c.fillStyle=tile===1?'#e3ccb2':'#eeeae2';c.fillRect(tile*128,0,128,h);
   for(let j=0;j<800;j++){c.fillStyle=j%2?'rgba(40,30,20,.08)':'rgba(255,255,255,.12)';c.fillRect(tile*128+rnd()*128,rnd()*h,tile===1?12:1,tile===1?1:2);}
   if(tile===1){c.fillStyle='#57422c33';for(let y=0;y<h;y+=16)c.fillRect(tile*128,y,128,1);}
  }
 });
 const batchMat=kit.mat('#ffffff',{tex:atlas,spec:.25,key:'coastal3AtlasMaterial'});
 const groups=new Map<string,Mesh[]>();
 for(const mesh of parts){
  const source=mesh.material as StandardMaterial,color=source.diffuseColor,tile=source===wood?1:source===metal||source===glass?2:source===stone||source===sand?0:3;
  const colors=new Float32Array(mesh.getTotalVertices()*4);for(let i=0;i<mesh.getTotalVertices();i++)colors.set([color.r,color.g,color.b,1],i*4);mesh.setVerticesData(VertexBuffer.ColorKind,colors);
  const uv=mesh.getVerticesData(VertexBuffer.UVKind);if(uv){for(let i=0;i<uv.length;i+=2)uv[i]=(tile+.02+uv[i]*.96)/4;mesh.setVerticesData(VertexBuffer.UVKind,uv);}
  mesh.material=batchMat;const key='coastal-shared';const a=groups.get(key)??[];a.push(mesh);groups.set(key,a);
 }
 for(const list of groups.values()){const m=Mesh.MergeMeshes(list,true,true);if(m){m.name='coastalDetailBatch';m.material=batchMat;m.isPickable=false;m.freezeWorldMatrix();}}
}
