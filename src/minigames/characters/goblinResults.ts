import Phaser from 'phaser';
import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, TransformNode, Vector3, Viewport } from '@babylonjs/core';
import { GoblinVisualInstance } from './goblinVisual';
import type { ImportedCharacterProfile } from './goblinVisual';

/** One transparent atlas/scene per results screen. Original geometry/material/texture shared by all slots. */
export function goblinResultPortraits(owner:Phaser.Scene): { add:(x:number,y:number,size:number,result:'victory'|'defeat'|null,fallback:Phaser.GameObjects.GameObject,profile?:ImportedCharacterProfile)=>Phaser.GameObjects.Image } {
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=128;
  const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,premultipliedAlpha:true});
  engine.setSize(640,128,true);
  const scene=new Scene(engine);scene.clearColor=new Color4(0,0,0,0);
  new HemisphericLight('resultsLight',Vector3.Up(),scene).intensity=1;
  const key=`goblin-results-${Phaser.Utils.String.UUID()}`;
  const atlas=document.createElement('canvas');atlas.width=640;atlas.height=128;
  const context=atlas.getContext('2d')!;
  const texture=owner.textures.addCanvas(key,atlas)!;
  const slots:{g:GoblinVisualInstance;result:'victory'|'defeat'|null}[]=[];
  const cameras:ArcRotateCamera[]=[];
  const update=(_time:number,delta:number):void=>{
    if(!slots.length)return;
    for(const s of slots)s.g.update(Math.min(.05,delta/1000),{speedFrac:0,alive:true,falling:false,dashing:false,stunned:false,result:s.result});
    scene.render();context.clearRect(0,0,640,128);context.drawImage(canvas,0,0);texture.refresh();
  };
  owner.events.on(Phaser.Scenes.Events.UPDATE,update);
  owner.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
    owner.events.off(Phaser.Scenes.Events.UPDATE,update);
    for(const s of slots)s.g.dispose();engine.dispose();owner.textures.remove(key);
  });
  return {add:(x,y,size,result,fallback,profile)=>{
    const i=slots.length;
    texture.add(`slot${i}`,0,i*128,0,128,128);
    const image=owner.add.image(x,y,key,`slot${i}`).setDisplaySize(size,size).setVisible(false);
    const root=new TransformNode(`resultGoblin${i}`,scene);root.position.x=i*4;root.rotation.y=Math.PI;
    const camera=new ArcRotateCamera(`resultCamera${i}`,-Math.PI/2,1.38,3,new Vector3(i*4,1,0),scene);
    camera.viewport=new Viewport(i/5,0,1/5,1);camera.layerMask=1<<i;cameras.push(camera);scene.activeCameras=cameras;
    const g=new GoblinVisualInstance(scene,root,{height:2,profile,onReady:ok=>{
      if(!ok||!owner.sys.isActive())return;
      for(const m of g.meshes)m.layerMask=1<<i;
      const visible=fallback as Phaser.GameObjects.GameObject&{setVisible?:(v:boolean)=>void};
      visible.setVisible?.(false);image.setVisible(true);
    }});
    slots.push({g,result});return image;
  }};
}
