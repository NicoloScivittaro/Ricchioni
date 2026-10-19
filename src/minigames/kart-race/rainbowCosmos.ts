import {Color3,DynamicTexture,Mesh,MeshBuilder,Scene,StandardMaterial,Vector3} from '@babylonjs/core';

/** One painted sky draw, one merged near-star layer and three distant planets. No post processing. */
export function buildRainbowCosmos(scene:Scene):{update:(time:number)=>void} {
  let seed=9137;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const texture=new DynamicTexture('cosmicPanorama',{width:2048,height:1024},scene,false);
  const c=texture.getContext() as CanvasRenderingContext2D;c.fillStyle='#080c27';c.fillRect(0,0,2048,1024);
  for(let i=0;i<42;i++){
    const x=rand()*2048,y=200+rand()*580,r=120+rand()*260,g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,i%3===0?'rgba(58,105,160,.16)':i%3===1?'rgba(106,43,143,.16)':'rgba(31,145,154,.1)');g.addColorStop(1,'rgba(5,8,25,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  for(let i=0;i<2600;i++){
    const x=rand()*2048,y=rand()*1024,r=rand()<.96?.35+rand()*.65:1.4;
    c.fillStyle=`rgba(${i%3===0?'169,205,255':'239,224,255'},${.2+rand()*.65})`;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  }
  texture.update();const mat=new StandardMaterial('cosmosSkyMaterial',scene);mat.diffuseTexture=texture;mat.emissiveTexture=texture;mat.emissiveColor=Color3.White();mat.disableLighting=true;mat.backFaceCulling=false;mat.disableDepthWrite=true;mat.freeze();
  const sky=MeshBuilder.CreateSphere('rainbowCosmosSky',{diameter:12000,segments:24,sideOrientation:Mesh.BACKSIDE},scene);sky.material=mat;sky.infiniteDistance=true;sky.isPickable=false;sky.alwaysSelectAsActiveMesh=true;sky.freezeWorldMatrix();
  const starMat=new StandardMaterial('nearCosmicDust',scene);starMat.emissiveColor=new Color3(.55,.8,1);starMat.disableLighting=true;starMat.freeze();
  const pieces:Mesh[]=[];
  for(let i=0;i<140;i++){
    const a=rand()*Math.PI*2,r=1700+rand()*700,y=220+rand()*750;
    const star=MeshBuilder.CreateSphere('cosmicDustPart',{diameter:1.2+rand()*2,segments:3},scene);star.position.set(Math.cos(a)*r,y,Math.sin(a)*r);pieces.push(star);
  }
  const stars=Mesh.MergeMeshes(pieces,true,true)!;stars.name='cosmicDepthStars';stars.material=starMat;stars.isPickable=false;stars.freezeWorldMatrix();
  for(const [i,pos] of [[2200,730,1800],[-2200,850,900],[300,1100,-3000]].entries()){
    const t=new DynamicTexture('planetBands'+i,{width:256,height:128},scene,false),p=t.getContext() as CanvasRenderingContext2D;
    p.fillStyle=['#4f6caa','#996376','#387b8d'][i];p.fillRect(0,0,256,128);
    for(let y=0;y<128;y+=3){p.fillStyle=`rgba(${i===1?'246,180,143':'159,215,238'},${.05+rand()*.2})`;p.fillRect(0,y,256,1+rand()*5);}t.update();
    const planet=MeshBuilder.CreateSphere('cosmicPlanet'+i,{diameter:210+i*65,segments:20},scene);planet.position.copyFrom(Vector3.FromArray(pos));planet.rotation.z=.25+i*.3;
    const m=new StandardMaterial('cosmicPlanetMaterial'+i,scene);m.diffuseTexture=t;m.emissiveColor=new Color3(.12,.14,.2);m.specularColor=Color3.Black();m.freeze();planet.material=m;planet.isPickable=false;planet.freezeWorldMatrix();
    if(i===1){const ring=MeshBuilder.CreateTorus('cosmicPlanetRing',{diameter:410,thickness:6,tessellation:72},scene);ring.position.copyFrom(planet.position);ring.rotation.z=.5;ring.material=starMat;ring.isPickable=false;ring.freezeWorldMatrix();}
  }
  // Parallax comes from real world positions of the near stars and planets; the sky stays infinitely distant.
  return {update:()=>{}};
}
