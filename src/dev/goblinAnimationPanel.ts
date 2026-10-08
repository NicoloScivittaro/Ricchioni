import { Color3, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { LinesMesh, Mesh, Scene } from '@babylonjs/core';
import type { ArenaEntity } from '../minigames/arena/arenaEntity';
import { GOBLIN_CLIPS } from '../minigames/characters/goblinAnimator';
import type { GoblinClip } from '../minigames/characters/goblinAnimator';
import { GOBLIN_ATTACHMENTS } from '../minigames/characters/goblinVisual';
import { presentationOf } from '../../shared/characterPresentation';
import type { GoblinAttachment } from '../minigames/characters/goblinVisual';

/** DEV only: playback and diagnostic geometry have no references to gameplay state. */
export function goblinAnimationPanel(scene:Scene,wrap:HTMLElement,entities:()=>ArenaEntity[],layout:(n:'compare'|1|2|5|'characters')=>void, clips:readonly GoblinClip[]=GOBLIN_CLIPS, character='goblin'): { update:()=>void; preview:(name:string|null,speed?:number,loop?:boolean)=>void; diagnostics:(flags:{skeleton?:boolean;bones?:boolean;root?:boolean;attachments?:boolean})=>void } {
  const targets=()=>entities().filter(e=>e.goblinDebug()?.character===character);
  const panel=document.createElement('details'); panel.id=`${character}-animation-panel`;
  panel.style.cssText=`${character==='goblin'?'position:absolute;right:10px;top:10px;':'position:relative;flex-shrink:0;'}width:310px;max-height:65%;overflow:auto;background:#0f1320ed;color:#eee;padding:10px;border-radius:8px;font:12px Arial;z-index:2`;
  const label=presentationOf(character)?.shortName??character.toUpperCase();
  const summary=document.createElement('summary');summary.textContent=`${label} · ${clips.length?'ANIMATION LAB':'POSE LAB (0 CLIP)'}`;panel.append(summary);
  const select=document.createElement('select');select.id=`${character}-clip`;select.style.cssText='width:100%;margin:8px 0';
  for(const c of clips) {const o=document.createElement('option');o.value=c.name;o.textContent=c.name.slice(c.name.indexOf('.')+1).toUpperCase();select.append(o);}
  panel.append(select);
  const info=document.createElement('pre');info.id=`${character}-clip-info`;info.style.cssText='white-space:pre-wrap;font:11px monospace';panel.append(info);
  let speed=1,loop=false,name:string|null=null;
  const preview=(n:string|null,s=1,l=false):void=>{name=n;speed=s;loop=l;for(const e of targets())e.goblinPreview(n,s,l);details();};
  const details=():void=>{
    const c=clips.find(c=>c.name===select.value)!;
    if(!c){info.textContent='0 animazioni embedded. Pose procedurali provvisorie sul rig originale. Usa gli stati della galleria.';return;}
    info.textContent=`${c.original}\n\n${c.name}\nOriginal ${c.originalDuration.toFixed(3)}s\nRange ${(c.from*60).toFixed(1)} → ${(c.to*60).toFixed(1)} frames @60\nPlayback ${((c.to-c.from)/speed).toFixed(3)}s · speed ${speed}x\nGame default ${c.duration.toFixed(3)}s (warped to actual move)\nLoop ${loop?'YES':'NO'}\nContact candidate ${c.contact??'—'}s\nContact requires visual review`;
  };
  const button=(text:string,fn:()=>void):void=>{const b=document.createElement('button');b.textContent=text;b.style.cssText='margin:3px;padding:5px;cursor:pointer';b.onclick=fn;panel.append(b);};
  if(clips.length){button('PLAY',()=>preview(select.value,speed,false));button('LOOP',()=>preview(select.value,speed,true));button('GAME STATE',()=>preview(null));
  for(const s of [.25,.5,1,2])button(`${s}x`,()=>preview(select.value,s,loop));
  }else select.hidden=true;
  select.onchange=()=>{details();if(name)preview(select.value,speed,loop);};
  panel.append(document.createElement('hr'));
  button('LEGACY / TRIPO',()=>{preview(null);layout('compare');});
  for(const n of [1,2,5] as const)button(`${n} ${label}`,()=>{preview(null);layout(n);});
  button('5 PERSONAGGI',()=>{preview(null);layout('characters');});
  const flags={skeleton:false,bones:false,root:false,attachments:false};
  const diagnostics=(f:Partial<typeof flags>):void=>{Object.assign(flags,f);};
  for(const key of ['skeleton','bones','root','attachments'] as const){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.onchange=()=>{flags[key]=input.checked;};label.append(input,key.toUpperCase());label.style.display='inline-block';panel.append(label);}
  wrap.append(panel);details();
  const material=new StandardMaterial('goblinDebugPoints',scene);material.disableLighting=true;material.emissiveColor=Color3.Yellow();
  let skeleton:LinesMesh|null=null, roots:LinesMesh|null=null;
  const markers:Mesh[]=[];
  const update=():void=>{
    if(!flags.skeleton&&!flags.bones&&!flags.root&&!flags.attachments){skeleton?.setEnabled(false);roots?.setEnabled(false);for(const m of markers)m.setEnabled(false);return;}
    const es=targets().filter(e=>e.goblinDebug()?.state==='ready');
    const lines=es.flatMap(e=>e.goblinJointLines());
    if(flags.skeleton&&lines.length){
      if(!skeleton || skeleton.getTotalVertices()!==lines.length*2){skeleton?.dispose();skeleton=MeshBuilder.CreateLineSystem('goblinSkeleton',{lines,updatable:true},scene);skeleton.color=new Color3(0,1,1);}
      else MeshBuilder.CreateLineSystem('goblinSkeleton',{lines,instance:skeleton},scene);
    }
    if(skeleton)skeleton.setEnabled(flags.skeleton&&!!lines.length);
    const axes=es.flatMap(e=>{const p=e.root.position;return [Vector3.Right(),Vector3.Up(),Vector3.Forward()].map(v=>[p.clone(),p.add(v.scale(.6))]);});
    if(flags.root&&axes.length){
      if(!roots||roots.getTotalVertices()!==axes.length*2){roots?.dispose();roots=MeshBuilder.CreateLineSystem('goblinRoots',{lines:axes,updatable:true},scene);roots.color=Color3.Magenta();}
      else MeshBuilder.CreateLineSystem('goblinRoots',{lines:axes,instance:roots},scene);
    }
    if(roots)roots.setEnabled(flags.root&&!!axes.length);
    const points:Vector3[]=[];
    if(flags.bones)for(const line of lines)points.push(line[1]);
    if(flags.attachments)for(const e of es)for(const key of Object.keys(GOBLIN_ATTACHMENTS) as GoblinAttachment[]){const p=e.goblinAttachment(key);if(p)points.push(p);}
    points.forEach((p,i)=>{if(!markers[i]){markers[i]=MeshBuilder.CreateSphere('goblinAttachment',{diameter:.065,segments:4},scene);markers[i].material=material;markers[i].isPickable=false;}markers[i].position.copyFrom(p);markers[i].setEnabled(true);});
    for(let i=points.length;i<markers.length;i++)markers[i].setEnabled(false);
  };
  return {update,preview,diagnostics};
}
