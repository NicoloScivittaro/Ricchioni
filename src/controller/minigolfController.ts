import type {InputEvent} from '../../shared/types';
import {abilityFor,stateLabel} from '../../shared/abilityCatalog';
import type {AbilityStatus} from '../../shared/abilityCatalog';
import {createVirtualJoystick} from './joystick';
export interface GolfPhoneStatus {available:boolean;ready:boolean;charge:number|null;strokes:number;total:number;hole:number;finished:boolean;ability:AbilityStatus}
export function mountMinigolf(root:HTMLElement,send:(ev:InputEvent)=>void,character:string|null){
 const ab=abilityFor('minigolf',character);root.innerHTML=`<div class="golf-phone">
  <div class="golf-phone-title">⛳ MINIGOLF DEI DISAGIATI</div><p id="golf-status">GUARDA LA TV · ATTENDI IL VIA</p>
  <div class="golf-phone-board"><div class="golf-phone-joy"><div class="arena-joy-thumb"></div></div>
  <div class="golf-phone-actions"><button id="golf-shoot">⛳ TIRA<span>TIENI E RILASCIA</span></button>
  <button id="golf-cancel">ANNULLA</button><button id="golf-ability">⭐ ABILITÀ<span id="golf-ability-status">PRONTA</span></button></div></div>
  <p id="golf-phone-power">STICK = DIREZIONE · UN COLPO SOLO QUANDO LA PALLA È FERMA</p>
  <p id="golf-phone-desc"></p></div>`;
 root.querySelector('#golf-phone-desc')!.textContent=ab?`${ab.name} · ${ab.full}`:'ABILITÀ';
 const shoot=root.querySelector<HTMLButtonElement>('#golf-shoot')!,cancelButton=root.querySelector<HTMLButtonElement>('#golf-cancel')!,ability=root.querySelector<HTMLButtonElement>('#golf-ability')!;
 let owner:number|null=null,available=false,ready=false;
 const cancel=()=>{if(owner!==null){send({kind:'action',controlId:'cancel'});send({kind:'up',controlId:'shoot'});owner=null;}shoot.classList.remove('golf-held');};
 const joy=createVirtualJoystick(root.querySelector<HTMLElement>('.golf-phone-joy')!,root.querySelector<HTMLElement>('.arena-joy-thumb')!,{enabled:()=>available,onAxis:(x,y)=>send({kind:'axis',controlId:'aim',x,y})});
 shoot.addEventListener('pointerdown',e=>{e.preventDefault();if(!available||!ready||owner!==null)return;owner=e.pointerId;shoot.setPointerCapture(e.pointerId);shoot.classList.add('golf-held');send({kind:'down',controlId:'shoot'});});
 shoot.addEventListener('pointerup',e=>{e.preventDefault();if(owner!==e.pointerId)return;owner=null;shoot.classList.remove('golf-held');send({kind:'up',controlId:'shoot'});});
 shoot.addEventListener('pointercancel',e=>{if(e.pointerId===owner)cancel();});
 shoot.addEventListener('lostpointercapture',e=>{if(e.pointerId===owner)cancel();});
 cancelButton.addEventListener('pointerdown',e=>{e.preventDefault();cancel();send({kind:'action',controlId:'cancel'});});
 ability.addEventListener('pointerdown',e=>{e.preventDefault();if(available)send({kind:'action',controlId:'ability'});});
 return {
  cancel(){cancel();joy.reset();},
  update(s:GolfPhoneStatus){available=s.available;ready=s.ready;
   if(!available)cancel();shoot.disabled=!available||(!ready&&owner===null);ability.disabled=!available||s.ability.state==='SPENT';cancelButton.disabled=!available;
   root.querySelector('#golf-ability-status')!.textContent=stateLabel(s.ability);
   root.querySelector('#golf-status')!.textContent=`BUCA ${s.hole}/3 · ${s.strokes}/8 COLPI · TOTALE ${s.finished?s.total:s.total+s.strokes}${s.finished?' · TERMINATA':!available?' · ATTENDI':!ready?' · PALLA IN MOVIMENTO':''}`;
   root.querySelector('#golf-phone-power')!.textContent=s.charge!==null?`CARICA ${Math.round(s.charge*100)}% · RILASCIA PER TIRARE`:'MIRA CON LO STICK · TIENI TIRA · ANNULLA PER RIPENSARCI';
   shoot.style.setProperty('--golf-power',`${(s.charge??0)*100}%`);
  },
  destroy(){cancel();joy.destroy();}
 };
}
