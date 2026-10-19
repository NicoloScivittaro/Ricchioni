import {ArcRotateCamera,Color3,Color4,DirectionalLight,Engine,FreeCamera,HemisphericLight,ImageProcessingConfiguration,Scene,SceneLoader,StandardMaterial,Vector3}from'@babylonjs/core';
import'@babylonjs/loaders/glTF';

const canvas=document.querySelector<HTMLCanvasElement>('#view')!,status=document.querySelector<HTMLElement>('#status')!;
const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
const scene=new Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new Color4(.24,.32,.38,1);
scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.1;
const sky=new HemisphericLight('inspectionFill',Vector3.Up(),scene);sky.intensity=1.2;sky.groundColor=new Color3(.35,.36,.4);
const sun=new DirectionalLight('inspectionSun',new Vector3(-.35,-1,.5),scene);sun.intensity=2.2;
const orbit=new ArcRotateCamera('orbit',-Math.PI/2,1.04,180,Vector3.Zero(),scene);orbit.minZ=.04;orbit.maxZ=4000;orbit.lowerRadiusLimit=.8;orbit.upperRadiusLimit=1600;orbit.wheelDeltaPercentage=.012;orbit.panningSensibility=70;orbit.attachControl(canvas,true);
const fly=new FreeCamera('inspectionFly',new Vector3(0,10,0),scene);fly.minZ=.04;fly.maxZ=4000;fly.speed=.65;fly.angularSensibility=2300;fly.keysUp=[87,38];fly.keysDown=[83,40];fly.keysLeft=[65,37];fly.keysRight=[68,39];fly.keysUpward=[69];fly.keysDownward=[81];
scene.activeCamera=orbit;
const api:any={engine,scene,orbit,fly,ready:false,presets:{},errors:[]};(window as any).__terminal=api;
const choose=(name:string)=>{
 const preset=api.presets[name];if(!preset)return;
 fly.detachControl();scene.activeCamera=orbit;orbit.attachControl(canvas,true);orbit.setTarget(Vector3.FromArray(preset.target));orbit.alpha=preset.alpha??-Math.PI/2;orbit.beta=preset.beta??1.05;orbit.radius=preset.radius;
};
for(const name of['airport','plane','stairs','overview'])document.getElementById(name)!.onclick=()=>choose(name);
document.getElementById('fly')!.onclick=()=>{fly.position.copyFrom(scene.activeCamera!.position);fly.setTarget(orbit.target);orbit.detachControl();scene.activeCamera=fly;fly.attachControl(canvas,true);canvas.focus();};
canvas.onclick=()=>{if(scene.activeCamera===fly)void canvas.requestPointerLock();};
const neutral=new StandardMaterial('inspectionNeutral',scene);neutral.diffuseColor=new Color3(.65,.7,.73);neutral.backFaceCulling=false;
const materials=new Map<any,any>();
document.querySelector<HTMLInputElement>('#neutral')!.onchange=e=>{const on=(e.target as HTMLInputElement).checked;for(const m of scene.meshes){if(!m.getTotalVertices())continue;if(on){materials.set(m,m.material);m.material=neutral;}else if(materials.has(m))m.material=materials.get(m);}};
document.querySelector<HTMLInputElement>('#wire')!.onchange=e=>{for(const m of scene.materials)m.wireframe=(e.target as HTMLInputElement).checked;};
async function main(){
 const [report,inspections]=await Promise.all([fetch('/docs/agent-work/terminal-conversion/conversion.json').then(r=>r.json()),fetch('/docs/agent-work/terminal-conversion/inspection.json').then(r=>r.json())]);
 api.report=report;api.presets=inspections.presets;
 const result=await SceneLoader.ImportMeshAsync('','/assets/fps/terminal/','terminal.glb',scene,p=>{document.querySelector('#progress')!.textContent=p.lengthComputable?Math.round(p.loaded/p.total*100)+'%':'Lettura delle risorse…';});
 for(const m of result.meshes){m.isPickable=true;m.checkCollisions=false;}
 await scene.whenReadyAsync();choose('airport');api.ready=true;api.importedMeshes=result.meshes.length;api.importedMaterials=scene.materials.length;
 status.textContent=`PARZIALE · ${report.prefabFilesRecovered} prefab · ${report.counts.modelInstancesRecovered.toLocaleString('it-IT')} oggetti recuperati · ${report.uniqueModelsUnavailable} tipi di modello assenti`;
 document.getElementById('loading')!.classList.add('hidden');
}
main().catch(error=>{api.errors.push(String(error));document.querySelector('#progress')!.textContent='Errore: '+error;console.error(error);});
engine.runRenderLoop(()=>scene.render());window.addEventListener('resize',()=>engine.resize());
