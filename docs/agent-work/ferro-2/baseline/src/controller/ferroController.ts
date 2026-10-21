import type{InputEvent}from'../../shared/types';
import type{FerroPacket,FerroState,Warrior}from'../../shared/ferro/types';
import{WEAPONS,weapon}from'../../shared/ferro/weapons';
import{weaponArt}from'../../shared/ferro/art';
import{createVirtualJoystick}from'./joystick';
import type{VirtualJoystick}from'./joystick';
import'./ferroController.css';
export function mountFerro(app:HTMLElement,id:string,send:(event:InputEvent)=>void){
 const abort=new AbortController(),opts={signal:abort.signal};let state:FerroState|null=null,own:Warrior|null=null,destroyed=false,paused=false,mode='',joy:VirtualJoystick|null=null,localAbort:AbortController|null=null,yaw=0,pitch=0,touched=false;
 const holds=new Set<string>(),releases:(()=>void)[]=[];const root=document.createElement('div');root.className='ferro-phone';app.replaceChildren(root);
 const enabled=()=>!destroyed&&!paused&&!!own?.alive&&state?.phase==='fight'&&!!own.eligible;
 const action=(controlId:string)=>send({kind:'action',controlId});
 const cancel=()=>{if(destroyed)return;action('ferroCancel');joy?.reset();for(const release of releases)release();for(const controlId of holds)send({kind:'up',controlId});holds.clear();send({kind:'axis',controlId:'move',x:0,y:0});};
 function build(selection:boolean):void{
  cancel();localAbort?.abort();localAbort=new AbortController();joy?.destroy();joy=null;releases.length=0;const local={signal:localAbort.signal};
  root.innerHTML=selection?`<header><span>FERRO E FURIA</span><b>L’ULTIMO GUERRIERO</b><small class="ferro-phone-status"></small></header><section class="ferro-phone-weapons">${WEAPONS.map((w,i)=>`<button data-weapon="${i}" aria-label="${w.name}">${weaponArt(w.id)}<b>${w.name}</b><small>${w.title}</small></button>`).join('')}</section><section class="ferro-phone-detail"></section><button class="ferro-phone-confirm">CONFERMA ARMA</button>`:
  '<div class="ferro-phone-top"><strong class="ferro-phone-weapon"></strong><span class="ferro-phone-status"></span><div class="ferro-phone-bars"><i class="ferro-phone-hp"></i></div><div class="ferro-phone-bars stamina"><i class="ferro-phone-stamina"></i></div></div><div class="ferro-phone-camera"><small>SCORRI PER GUARDARE / MIRARE</small><div class="ferro-phone-reticle">+</div></div><div class="ferro-phone-joy"><i></i></div><div class="ferro-phone-buttons"><button data-hold="guard">DIFESA<br>MIRA</button><button data-hold="light">ATTACCA<br>TIENI: ARCO</button><button data-tap="heavy">PESANTE</button><button data-tap="special">SPECIAL</button><button data-tap="dodge">SCHIVA</button><button data-tap="jump">SALTA</button><button data-hold="sprint">CORRI</button></div><div class="ferro-phone-message"></div>';
  if(selection){
   root.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(button=>button.addEventListener('click',()=>{if(paused||!own?.eligible||state?.phase!=='selection')return;action('ferroChoose'+button.dataset.weapon);},local));
   root.querySelector('button.ferro-phone-confirm')!.addEventListener('click',()=>{if(!paused&&state?.phase==='selection'&&own?.eligible)action('dodge');},local);
  }else{
   const base=root.querySelector<HTMLElement>('.ferro-phone-joy')!;joy=createVirtualJoystick(base,base.firstElementChild as HTMLElement,{enabled,onAxis:(x,y)=>send({kind:'axis',controlId:'move',x,y})});
   const camera=root.querySelector<HTMLElement>('.ferro-phone-camera')!;let pointer:number|null=null,x=0,y=0;
   camera.addEventListener('pointerdown',e=>{if(!enabled()||pointer!==null)return;pointer=e.pointerId;x=e.clientX;y=e.clientY;camera.setPointerCapture(e.pointerId);},local);
   camera.addEventListener('pointermove',e=>{if(!enabled()||pointer!==e.pointerId)return;yaw=Math.atan2(Math.sin(yaw+(e.clientX-x)*.006),Math.cos(yaw+(e.clientX-x)*.006));pitch=Math.max(-.55,Math.min(.65,pitch-(e.clientY-y)*.004));x=e.clientX;y=e.clientY;touched=true;send({kind:'axis',controlId:'look',x:yaw/Math.PI,y:pitch/.65});},local);
   const stop=()=>pointer=null;for(const event of['pointerup','pointercancel','lostpointercapture'])camera.addEventListener(event,stop,local);releases.push(stop);
   for(const button of root.querySelectorAll<HTMLButtonElement>('[data-hold],[data-tap]')){let owner:number|null=null;const control=button.dataset.hold??button.dataset.tap!;
    button.addEventListener('pointerdown',e=>{e.preventDefault();if(!enabled()||owner!==null)return;if(button.dataset.tap){action(control);return;}owner=e.pointerId;button.setPointerCapture(e.pointerId);holds.add(control);send({kind:'down',controlId:control});},local);
    const release=()=>{if(owner===null)return;owner=null;holds.delete(control);send({kind:'up',controlId:control});};releases.push(release);button.addEventListener('pointerup',release,local);
    // Lost touch ownership cancels a bow draw before releasing the trigger.
    for(const event of['pointercancel','lostpointercapture'])button.addEventListener(event,()=>{if(owner!==null)action('ferroCancel');release();},local);
   }
  }
 }
 window.addEventListener('blur',cancel,opts);window.addEventListener('pagehide',cancel,opts);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},opts);
 return{
  update(packet:FerroPacket):void{
   if(destroyed)return;state=packet.state;own=state.warriors.find(p=>p.id===id)??null;if(!own)return;
   if(!touched||state.phase!=='fight'){yaw=own.yaw;pitch=own.pitch;touched=false;}
   const next=state.phase==='selection'?'selection:'+state.selectionToken:'combat';if(mode!==next){mode=next;build(state.phase==='selection');}
   const w=weapon(own.weapon),status=root.querySelector('.ferro-phone-status')!;status.textContent=state.phase==='selection'?`${state.duel==='final'?'SPAREGGIO':'ROUND '+state.round+' / 3'} · ${Math.ceil(Math.max(0,state.phaseLeft))}s`:`${state.duel==='final'?'SPAREGGIO':'ROUND '+state.round+' / 3'} · ${Math.ceil(Math.max(0,state.roundSeconds-state.fightTime))}s · ${own.points} PT`;
   if(state.phase==='selection'){
    root.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach((button,i)=>{button.classList.toggle('selected',WEAPONS[i].id===own!.weapon);button.setAttribute('aria-pressed',String(WEAPONS[i].id===own!.weapon));button.disabled=!own!.eligible||paused;});
    const detail=root.querySelector('.ferro-phone-detail')!;detail.replaceChildren();const title=document.createElement('b');title.textContent=w.specialName;const desc=document.createElement('p');desc.textContent=w.description+' '+w.specialHint;detail.append(title,desc);
    const confirm=root.querySelector<HTMLButtonElement>('.ferro-phone-confirm')!;confirm.textContent=!own.eligible?'OSSERVI LO SPAREGGIO':own.ready?'PRONTO · ATTENDI GLI ALTRI':'CONFERMA '+w.name;confirm.disabled=own.ready||!own.eligible||paused;
   }else{
    root.querySelector('.ferro-phone-weapon')!.textContent=w.name+(own.weapon==='bow'?` · ${own.arrows} FRECCE`:'');(root.querySelector('.ferro-phone-hp')as HTMLElement).style.width=own.hp+'%';(root.querySelector('.ferro-phone-stamina')as HTMLElement).style.width=own.stamina+'%';
    const special=root.querySelector('[data-tap="special"]')!;special.textContent=own.specialCd>0?`SPECIAL ${Math.ceil(own.specialCd)}s`:own.weapon==='sword'&&own.riposte<=0?'SPECIAL: PARRY':w.specialName;
    root.querySelector('.ferro-phone-message')!.textContent=state.phase==='finished'?state.notice:!own.alive?'ELIMINATO · GUARDA LA TV':state.phase==='countdown'?String(Math.ceil(Math.max(1,state.phaseLeft))):state.phase==='roundEnd'?state.notice:own.piercing?'FRECCIA PERFORANTE PRONTA':'';
    root.querySelectorAll<HTMLButtonElement>('.ferro-phone-buttons button').forEach(b=>b.disabled=!enabled());if(!own.alive&&holds.size)cancel();
   }
  },
  setPaused(value:boolean){paused=value;if(value)cancel();},cancel,
  destroy(){if(destroyed)return;cancel();destroyed=true;abort.abort();localAbort?.abort();joy?.destroy();root.remove();}
 };
}
