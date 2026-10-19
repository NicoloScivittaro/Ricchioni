import {Engine,Scene,SceneLoader,UniversalCamera,Vector3,HemisphericLight,Color4} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
export async function inspect(canvas:HTMLCanvasElement){
 const engine=new Engine(canvas,true),scene=new Scene(engine);scene.clearColor=new Color4(.1,.15,.19,1);new HemisphericLight('surveyLight',Vector3.Up(),scene).intensity=1.3;
 const result=await SceneLoader.ImportMeshAsync('','/assets/tracks/','primo_karting__karting_race_track.glb',scene);
 const root=result.meshes.find(m=>!m.parent)!;root.scaling.set(-1/.0254,1/.0254,-1/.0254);
 const camera=new UniversalCamera('survey',new Vector3(0,120,0),scene);camera.setTarget(new Vector3(0,0,0));camera.maxZ=2000;scene.activeCamera=camera;
 for(const m of result.meshes){if(m.material?.name.toLowerCase().startsWith('roof'))m.setEnabled(false);m.isPickable=false;m.computeWorldMatrix(true);}
 await scene.whenReadyAsync();engine.runRenderLoop(()=>scene.render());return {engine,scene,camera,meshes:result.meshes};
}
