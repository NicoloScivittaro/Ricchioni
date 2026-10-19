import {Color3,Color4,DirectionalLight,Engine,FreeCamera,HemisphericLight,Scene,Vector3,Viewport} from '@babylonjs/core';
import {attachWeaponModel} from '../../src/controller/fpsWeaponModels';
import {FpsViewmodel} from '../../src/controller/fpsViewmodel';
import {WEAPONS} from '../../shared/fpsWeapons';
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,engine=new Engine(canvas,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);
scene.clearColor=new Color4(.12,.16,.21,1);const hemi=new HemisphericLight('fill',Vector3.Up(),scene);hemi.intensity=1.3;const sun=new DirectionalLight('sun',new Vector3(-.3,-1,.5),scene);sun.intensity=1.4;
const cameras:FreeCamera[]=[],roots:any[]=[];const viewCam=new FreeCamera('firstPerson',Vector3.Zero(),scene);viewCam.minZ=.04;viewCam.fov=1.05;viewCam.layerMask=1<<20;
const vm=new FpsViewmodel(scene,viewCam,false,1<<20);const api:any={engine,scene,cameras,roots,vm,ready:false};(window as any).__weapons=api;
const labels=document.querySelector<HTMLElement>('#labels')!;
for(let i=0;i<WEAPONS.length;i++){
 const w=WEAPONS[i],camera=new FreeCamera('asset:'+w.id,new Vector3(1,.48,-.25),scene);camera.setTarget(new Vector3(0,.1,.14));camera.fov=.95;camera.minZ=.01;camera.viewport=new Viewport((i%4)/4,1-(Math.floor(i/4)+1)/2,1/4,1/2);camera.layerMask=1<<i;cameras.push(camera);
 const label=document.createElement('div');label.textContent=w.name;labels.append(label);
}
scene.activeCameras=cameras;const choose=async(id:string)=>{scene.activeCameras=[viewCam];vm.equip(id);await vm.whenReady();vm.update(1/60,0,0,0,0,false);};api.choose=choose;
const select=document.querySelector<HTMLSelectElement>('#weapon')!;for(const w of WEAPONS){const option=document.createElement('option');option.value=w.id;option.text=w.name;select.add(option);}
select.onchange=()=>void choose(select.value);document.querySelector<HTMLButtonElement>('#gallery')!.onclick=()=>{scene.activeCameras=cameras;labels.style.display='grid';};document.querySelector<HTMLButtonElement>('#fp')!.onclick=()=>{labels.style.display='none';void choose(select.value);};
const ads=document.querySelector<HTMLInputElement>('#ads')!;engine.runRenderLoop(()=>{if(scene.activeCameras?.[0]===viewCam){vm.ads=ads.checked?1:0;vm.update(1/60,0,0,0,api.reload??0,false);}scene.render();});
document.querySelector<HTMLButtonElement>('#fire')!.onclick=()=>vm.fire();
Promise.all(WEAPONS.map(async(w,i)=>{const {TransformNode}=await import('@babylonjs/core');const parent=new TransformNode('gallery:'+w.id,scene);const handle=await attachWeaponModel(scene,w.id,parent,1<<i);roots.push({id:w.id,handle});})).then(async()=>{await scene.whenReadyAsync();api.ready=true;document.querySelector('#status')!.textContent='7 modelli originali caricati';}).catch(e=>{console.error(e);document.querySelector('#status')!.textContent=String(e);});window.addEventListener('resize',()=>engine.resize());
