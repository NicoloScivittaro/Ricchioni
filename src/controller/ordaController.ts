import type {InputEvent} from '../../shared/types';
import type {OrdaPacket} from '../../shared/orda/types';
import {createVirtualJoystick} from './joystick';
import type {OrdaRenderer} from '../minigames/orda/OrdaRenderer';
/** Real phone FPS viewport; the host remains authoritative for every shot and hit. */
export function mountOrda(app:HTMLElement,id:string,send:(event:InputEvent)=>void){
 const abort=new AbortController(),options={signal:abort.signal};let destroyed=false,paused=false,alive=true,touched=false,yaw=0,pitch=0,packet:OrdaPacket|null=null,renderer:OrdaRenderer|null=null,last=0;
 const queued:OrdaPacket['events']=[];
 app.innerHTML=`<div class="orda-phone" style="position:fixed;inset:0;overflow:hidden;touch-action:none;background:#102022"><canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas><div class="orda-phone-loading" style="position:absolute;top:28%;width:100%;text-align:center;color:#e8d4ac">ORDA FINALE · CARICAMENTO 3D</div><div class="orda-phone-look" style="position:absolute;left:38%;top:17%;right:0;bottom:0;z-index:10002"></div><div class="orda-phone-joy" style="position:absolute;bottom:28px;left:25px;width:105px;height:105px;border:2px solid #add1bf88;border-radius:50%;background:#17332b66;z-index:10003"><div style="position:absolute;width:42px;height:42px;left:31px;top:31px;border-radius:50%;background:#c0d0bba6"></div></div><div class="orda-phone-actions" style="position:absolute;bottom:18px;right:14px;display:grid;grid-template-columns:repeat(3,66px);gap:7px;z-index:10003"><button data-hold="aim">◎ MIRA</button><button data-hold="fire" style="background:#813c28">SPARA</button><button data-tap="reload">RICARICA</button><button data-tap="interact" style="grid-column:1 / -1">CASSA · COMPRA / RITIRA</button><button data-tap="dash">SCATTO</button><button data-tap="jump">SALTA</button><button data-hold="crouch">ABBASSA</button></div></div>`;
 const shell=app.querySelector<HTMLElement>('.orda-phone')!,canvas=shell.querySelector('canvas')!,look=shell.querySelector<HTMLElement>('.orda-phone-look')!,base=shell.querySelector<HTMLElement>('.orda-phone-joy')!;
 shell.querySelector('[data-tap="interact"]')!.textContent='USA · CASSA / BEVANDE / PACK';
 shell.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.style.cssText+=';padding:12px 2px;border:1px solid #e3d5ae66;border-radius:9px;background:#16332de8;color:#eee8d4;font:bold 10px Arial;touch-action:none;min-height:46px');
 const enabled=()=>!destroyed&&!paused&&alive;
 const joy=createVirtualJoystick(base,base.firstElementChild as HTMLElement,{enabled,onAxis:(x,y)=>send({kind:'axis',controlId:'move',x,y})});
 let pointer:number|null=null,x=0,y=0;const holds=new Set<string>(),releaseOwners:(()=>void)[]=[];
 const cancel=()=>{joy.reset();for(const release of releaseOwners)release();for(const controlId of holds)send({kind:'up',controlId});holds.clear();pointer=null;send({kind:'axis',controlId:'move',x:0,y:0});};
 look.addEventListener('pointerdown',e=>{if(!enabled()||pointer!==null)return;pointer=e.pointerId;x=e.clientX;y=e.clientY;look.setPointerCapture(e.pointerId);},options);
 look.addEventListener('pointermove',e=>{if(!enabled()||pointer!==e.pointerId)return;const ads=holds.has('aim')?.45:1;yaw+=(e.clientX-x)*.004*ads;pitch=Math.max(-1.3,Math.min(1.3,pitch+(e.clientY-y)*.004*ads));x=e.clientX;y=e.clientY;touched=true;send({kind:'axis',controlId:'look',x:yaw,y:pitch});},options);
 for(const event of ['pointerup','pointercancel','lostpointercapture'])look.addEventListener(event,()=>pointer=null,options);
 for(const button of shell.querySelectorAll<HTMLButtonElement>('button')){const controlId=button.dataset.hold??button.dataset.tap!;let owner:number|null=null;
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(!enabled()||owner!==null)return;if(button.dataset.tap){send({kind:'action',controlId});return;}owner=e.pointerId;button.setPointerCapture(e.pointerId);holds.add(controlId);send({kind:'down',controlId});},options);
  const release=()=>{if(owner===null)return;owner=null;holds.delete(controlId);send({kind:'up',controlId});};releaseOwners.push(release);for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release,options);
 }
 window.addEventListener('blur',cancel,options);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},options);
 const boot=async(p:OrdaPacket)=>{const {OrdaRenderer}=await import('../minigames/orda/OrdaRenderer');if(destroyed)return;renderer=new OrdaRenderer(canvas,p.state.players,[id],true);await renderer.ready;if(destroyed)return;shell.querySelector('.orda-phone-loading')?.remove();last=performance.now();renderer.engine.runRenderLoop(()=>{if(!renderer||!packet||destroyed)return;const now=performance.now(),dt=Math.min(.25,(now-last)/1000);last=now;if(paused)return;
   const own=packet.state.players.find(p=>p.id===id);if(own&&touched){own.yaw=yaw;own.pitch=pitch;}
   renderer.update(packet.state,dt,queued.splice(0));renderer.render();
  });};
 let booting=false;
 return{
  update(p:OrdaPacket){if(destroyed)return;packet=p;queued.push(...p.events);if(queued.length>120)queued.splice(0,queued.length-120);const own=p.state.players.find(p=>p.id===id);if(own){if(!touched){yaw=own.yaw;pitch=own.pitch;}if(alive&&!own.alive)cancel();alive=own.alive;for(const b of shell.querySelectorAll<HTMLButtonElement>('button'))b.disabled=!alive||p.state.phase==='finished';}if(!booting){booting=true;void boot(p).catch(e=>{if(!destroyed){const loading=shell.querySelector('.orda-phone-loading');if(loading)loading.textContent='3D non disponibile: usa la tua visuale sulla TV.';console.warn('Orda phone:',e);}});}},
  setPaused(value:boolean){paused=value;renderer?.setPaused(value);if(value)cancel();},cancel,
  destroy(){if(destroyed)return;cancel();destroyed=true;abort.abort();joy.destroy();renderer?.dispose();shell.remove();}
 };
}
