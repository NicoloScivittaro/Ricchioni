import type {InputEvent,PlayerPublic} from '../../shared/types';
import {abilityFor,stateLabel} from '../../shared/abilityCatalog';
import type {AbilityStatus} from '../../shared/abilityCatalog';
import {createVirtualJoystick} from './joystick';
import {companionHtml,onAbilityMessage} from './abilityCard';
export interface GolfPhoneStatus {available:boolean;ready:boolean;charge:number|null;strokes:number;total:number;hole:number;finished:boolean;ability:AbilityStatus;
 holes:number;seconds:number;phase:string;playoff:boolean;records:{strokes:number;completed:boolean}[];
 activeName:string;stage:'aim'|'rolling'|'switch';aimSeconds:number;maxStrokes:number;rank:number;course:string;par:number;distance:number}
export function updateGolfCompanion(s:GolfPhoneStatus):void{
 const el=document.getElementById('golf-companion-status');if(el)el.textContent=`${s.playoff?'SPAREGGIO':`BUCA ${s.hole}/${s.holes}`} · ${s.seconds}s · TOT ${s.total} · ${s.rank}°\n${s.phase==='ended'?'GARA CONCLUSA':s.phase==='transition'?'CLASSIFICA INTERMEDIA':`TURNO: ${s.activeName} · ${s.strokes}/${s.maxStrokes} COLPI · ${s.finished?'BUCA CHIUSA':`${s.distance.toFixed(1)} m`}`}\n${s.records.map((r,i)=>`B${i+1}: ${r.strokes}${r.completed?' ✓':' DNF'}`).join(' · ')}`;
 const footer=document.querySelector('#golf-spectator .cc-ok');if(footer)footer.textContent=s.finished?'HAI CONCLUSO LA PISTA · GUARDA GLI ALTRI':'LA TUA PALLINA RESTA SULLA PISTA';
}
export function mountMinigolf(root:HTMLElement,send:(ev:InputEvent)=>void,character:string|null,me?:PlayerPublic){
 const ab=abilityFor('minigolf',character);root.innerHTML=`<section id="golf-active" class="golf-phone" hidden>
  <div class="golf-phone-title">⛳ MINIGOLF DEI DISAGIATI</div><p id="golf-status">GUARDA LA TV · ATTENDI IL VIA</p>
  <div class="golf-phone-board"><div class="golf-phone-left"><div class="golf-phone-joy"><div class="arena-joy-thumb"></div></div>
  <div id="golf-camera" role="application" aria-label="Trascina per ruotare la camera">↔ TRASCINA CAMERA</div></div>
  <div class="golf-phone-actions"><button id="golf-shoot">⛳ TIRA<span>TIENI E RILASCIA</span></button>
  <button id="golf-cancel">ANNULLA</button><button id="golf-overview">PANORAMICA<span>TIENI PREMUTO</span></button><button id="golf-ability">⭐ ABILITÀ<span id="golf-ability-status">PRONTA</span></button></div></div>
  <p id="golf-phone-power">STICK = DIREZIONE · SU = REGOLAZIONE FINE</p><p id="golf-phone-desc"></p></section>
  <section id="golf-spectator">${me?companionHtml('minigolf',me,'MINIGOLF DEI DISAGIATI',true)??'<p id="golf-companion-status">ATTENDI IL VIA</p>':'<p id="golf-companion-status">ATTENDI IL VIA</p>'}</section>`;
 root.querySelector('#golf-phone-desc')!.textContent=ab?`${ab.name} · ${ab.short}`:'ABILITÀ';
 const shoot=root.querySelector<HTMLButtonElement>('#golf-shoot')!,cancelButton=root.querySelector<HTMLButtonElement>('#golf-cancel')!,ability=root.querySelector<HTMLButtonElement>('#golf-ability')!,overview=root.querySelector<HTMLButtonElement>('#golf-overview')!,camera=root.querySelector<HTMLElement>('#golf-camera')!;
 let owner:number|null=null,cameraOwner:number|null=null,overviewOwner:number|null=null,available=false,ready=false,lastX=0,lastY=0,dragX=0,dragY=0;
 const cancel=()=>{if(owner!==null){send({kind:'action',controlId:'cancel'});send({kind:'up',controlId:'shoot'});owner=null;}shoot.classList.remove('golf-held');};
 const resetCamera=()=>{cameraOwner=null;send({kind:'axis',controlId:'camera',x:0,y:0});};
 const resetOverview=()=>{overviewOwner=null;send({kind:'up',controlId:'overview'});};
 const joy=createVirtualJoystick(root.querySelector<HTMLElement>('.golf-phone-joy')!,root.querySelector<HTMLElement>('.arena-joy-thumb')!,{enabled:()=>available&&ready,onAxis:(x,y)=>send({kind:'axis',controlId:'aim',x,y})});
 shoot.addEventListener('pointerdown',e=>{e.preventDefault();if(!available||!ready||owner!==null)return;owner=e.pointerId;shoot.setPointerCapture(e.pointerId);shoot.classList.add('golf-held');send({kind:'down',controlId:'shoot'});});
 shoot.addEventListener('pointerup',e=>{e.preventDefault();if(owner!==e.pointerId)return;owner=null;shoot.classList.remove('golf-held');send({kind:'up',controlId:'shoot'});});
 for(const name of ['pointercancel','lostpointercapture'])shoot.addEventListener(name,e=>{if((e as PointerEvent).pointerId===owner)cancel();});
 cancelButton.addEventListener('pointerdown',e=>{e.preventDefault();cancel();send({kind:'action',controlId:'cancel'});});
 ability.addEventListener('pointerdown',e=>{e.preventDefault();if(available)send({kind:'action',controlId:'ability'});});
 camera.addEventListener('pointerdown',e=>{e.preventDefault();if(!available||cameraOwner!==null)return;cameraOwner=e.pointerId;lastX=e.clientX;lastY=e.clientY;camera.setPointerCapture(e.pointerId);});
 camera.addEventListener('pointermove',e=>{if(e.pointerId!==cameraOwner)return;
  // Accumulated wrapped displacement survives coalesced events and never rotates at rest.
  dragX=(dragX+(e.clientX-lastX)/300+3)%2-1;dragY=(dragY+(e.clientY-lastY)/300+3)%2-1;
  send({kind:'axis',controlId:'cameraDrag',x:dragX,y:dragY});lastX=e.clientX;lastY=e.clientY;
 });
 for(const name of ['pointerup','pointercancel','lostpointercapture'])camera.addEventListener(name,e=>{if((e as PointerEvent).pointerId===cameraOwner)resetCamera();});
 overview.addEventListener('pointerdown',e=>{e.preventDefault();if(!available||overviewOwner!==null)return;overviewOwner=e.pointerId;overview.setPointerCapture(e.pointerId);send({kind:'down',controlId:'overview'});});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])overview.addEventListener(name,e=>{if((e as PointerEvent).pointerId===overviewOwner)resetOverview();});
 const reset=()=>{cancel();joy.reset();resetCamera();resetOverview();dragX=dragY=0;send({kind:'axis',controlId:'cameraDrag',x:0,y:0});};
 const blur=()=>reset();window.addEventListener('blur',blur);
 return {
  cancel:reset,
  update(s:GolfPhoneStatus){const was=available;available=s.available;ready=s.ready;
   if(!available){if(was)reset();}else if(!ready){cancel();joy.reset();}
   (root.querySelector('#golf-active') as HTMLElement).hidden=!available;(root.querySelector('#golf-spectator') as HTMLElement).hidden=available;
   shoot.disabled=!available||!ready;ability.disabled=!available||s.ability.state==='SPENT'||(s.stage!=='aim'&&character!=='judoka');cancelButton.disabled=!available||!ready;overview.disabled=!available;
   root.querySelector('#golf-ability-status')!.textContent=stateLabel(s.ability);onAbilityMessage({type:'ability',game:'minigolf',status:s.ability});updateGolfCompanion(s);
   root.querySelector('#golf-status')!.textContent=`${s.playoff?'SPAREGGIO':`BUCA ${s.hole}/${s.holes}`} · ${s.course} · ${s.seconds}s · TOT ${s.total} · ${s.strokes}/${s.maxStrokes} COLPI · ${s.stage==='aim'?`${s.aimSeconds.toFixed(1)}s PER TIRARE`:'IN MOVIMENTO'}`;
   root.querySelector('#golf-phone-power')!.textContent=s.charge!==null?`CARICA ${Math.round(s.charge*100)}% · RILASCIA PER TIRARE`:'STICK ←/→ MIRA · SU = FINE · TRASCINA PER OSSERVARE';
   shoot.style.setProperty('--golf-power',`${(s.charge??0)*100}%`);
  },
  destroy(){reset();joy.destroy();window.removeEventListener('blur',blur);}
 };
}
