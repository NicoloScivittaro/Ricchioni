import type {Scene} from '@babylonjs/core';

// Scene-local promises include instance attachment, which Babylon's network queue
// alone cannot see. Retain failures so a broken asset cannot silently reveal a fallback.
const assets=new WeakMap<Scene,Promise<unknown>[]>();
export function trackVisualAsset<T>(scene:Scene,task:Promise<T>):Promise<T>{
 let list=assets.get(scene);if(!list){list=[];assets.set(scene,list);scene.onDisposeObservable.addOnce(()=>assets.delete(scene));}
 list.push(task);void task.catch(()=>{});return task;
}
export async function prepareVisuals(scene:Scene):Promise<void>{
 let seen=0;
 do{const list=assets.get(scene)??[];seen=list.length;await Promise.all(list);if(scene.isDisposed)return;
  // Skinning and shadow defines need a render to finish shader preparation.
  // Warm sparsely behind the opaque loader; never advance game simulation here.
  const warm=setInterval(()=>{if(!scene.isDisposed&&(scene.activeCamera||scene.activeCameras?.length))scene.render();},100);
  const observer=scene.onDisposeObservable.addOnce(()=>clearInterval(warm));
  try{await scene.whenReadyAsync();}finally{clearInterval(warm);scene.onDisposeObservable.remove(observer);}
 }
 while(!scene.isDisposed&&seen!==(assets.get(scene)?.length??0));
 // Upload/compile the actual visible camera set while it is still covered.
 if(!scene.isDisposed&&(scene.activeCamera||scene.activeCameras?.length))scene.render();
}
