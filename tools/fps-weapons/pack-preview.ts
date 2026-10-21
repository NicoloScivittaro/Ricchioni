import{Color3,Color4,Engine,UniversalCamera,HemisphericLight,MeshBuilder,Scene,StandardMaterial,Vector3}from'@babylonjs/core';
import{FpsViewmodel}from'../../src/controller/fpsViewmodel';
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,engine=new Engine(canvas,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);scene.clearColor=new Color4(.13,.17,.21,1);const cam=new UniversalCamera('view',Vector3.Zero(),scene);cam.minZ=.01;cam.fov=1.05;cam.layerMask=1|(1<<20);const light=new HemisphericLight('world',Vector3.Up(),scene);light.intensity=.8;
const ground=MeshBuilder.CreateGround('floor',{width:30,height:30},scene);ground.position.set(0,-1.5,8);const mat=new StandardMaterial('floor',scene);mat.diffuseColor=new Color3(.22,.27,.28);ground.material=mat;
const vm=new FpsViewmodel(scene,cam,false,1<<20);const api:any={engine,scene,cam,vm,id:'acr',ready:false,freeze:false,move:0,run:false,reload:0,ads:0};(window as any).pack=api;
api.choose=async(id:string)=>{api.id=id;vm.equip(id);await vm.whenReady();api.ready=true;document.querySelector('#label')!.textContent=id.toUpperCase()+' · mani e animazioni originali';};
engine.runRenderLoop(()=>{if(!api.freeze){vm.ads=api.ads;vm.update(Math.min(.05,engine.getDeltaTime()/1000),api.move,0,0,api.reload,api.run);}scene.render();});void api.choose('acr');window.addEventListener('resize',()=>engine.resize());
