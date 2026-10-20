import { createVirtualJoystick } from './joystick';
import type { InputEvent } from '../../shared/types';
export interface BackPhoneStatus { type: 'backroomsStatus'; state: string; lives: number; available: boolean; stamina: number; prompt: string; notice: string; seconds: number; key: boolean;flashlight?:boolean;respawnIn?:number }
export function backStatusText(s: BackPhoneStatus): string {
  return s.state === 'escaped' ? 'SEI FUGGITO · OSSERVA GLI ALTRI' : s.state === 'eliminated' ? 'ELIMINATO · SPETTATORE' : s.state === 'captured' ? `CATTURATO · RITORNO TRA ${s.respawnIn??7}s` : `${s.lives === 2 ? 'DUE POSSIBILITÀ' : 'ULTIMA POSSIBILITÀ'}${s.key ? ' · HAI LA CHIAVE' : ''} · ${Math.ceil(s.seconds / 60)} MIN`;
}
export function mountBackrooms(app: HTMLElement, send: (event: InputEvent) => void) {
  let enabled = false, spectating = false;
  app.innerHTML = `<style>
  .back-phone{height:100dvh;box-sizing:border-box;padding:calc(18px + env(safe-area-inset-top,0px)) 16px calc(15px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(ellipse at top,#33382a,#10140f);color:#d2d3aa;text-align:center;font-family:Arial;touch-action:none;overflow:hidden}
  .back-phone h1{font:700 19px monospace;letter-spacing:2px;margin:0 0 9px}.back-phone p{font:12px monospace;min-height:2em;margin:5px}.back-sticks{display:flex;justify-content:space-around;gap:16px}.back-stick{width:clamp(110px,33vw,155px);aspect-ratio:1;position:relative;border:1px solid #8c94734f;border-radius:50%;background:#ffffff07;touch-action:none}.back-thumb{width:48px;height:48px;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;border:1px solid #a1ab82;background:#555e3d}.back-label{font:12px monospace;margin-top:8px}.back-actions{display:flex;gap:10px;justify-content:center}.back-actions button{flex:1;max-width:190px;min-height:65px;background:#3b432b;color:#e2e6c4;border:1px solid #929b6e;border-radius:10px;font:bold 14px monospace;touch-action:none}.back-actions button:disabled{opacity:.3}.back-actions button[aria-pressed=true]{background:#646e40}.back-stamina{height:4px;background:#555b37;border-radius:4px}.back-stamina i{display:block;height:100%;background:#c6ce91;width:100%}@media(max-height:480px){.back-phone{padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.back-header{grid-column:1/3}.back-phone h1{font-size:14px;margin:0}.back-phone p{margin:0;min-height:1.1em}.back-sticks{grid-column:1/2}.back-stick{width:110px}.back-actions{grid-column:2/3;align-items:center}.back-stamina{grid-column:1/3}.back-label{margin-top:3px}}
  body:has(#pad-fallback-badge) .back-phone{padding-top:calc(60px + env(safe-area-inset-top,0px))}@media(max-height:480px){body:has(#pad-fallback-badge) .back-phone{padding-top:48px}}
  </style><div class="back-phone"><div class="back-header"><h1>BACKROOMS 2.0</h1><p id="back-phone-status">ATTENDI IL VIA · GUARDA LA TUA FINESTRA SULLA TV</p><p id="back-phone-notice"></p></div><div class="back-sticks"><div><div id="back-move" class="back-stick"><div class="back-thumb"></div></div><div class="back-label">MUOVITI</div></div><div><div id="back-look" class="back-stick"><div class="back-thumb"></div></div><div class="back-label">GUARDA</div></div></div><div class="back-actions"><button id="back-run" disabled>CORRI<br>TIENI</button><button id="back-interact" disabled>INTERAGISCI</button><button id="back-torch" disabled>TORCIA ON</button></div><div class="back-stamina"><i></i></div></div>`;
  const sticks = ['move', 'look'].map(id => { const base = app.querySelector<HTMLElement>(`#back-${id}`)!; return createVirtualJoystick(base, base.querySelector('.back-thumb')!, { enabled: () => enabled, onAxis: (x, y) => send({ kind: 'axis', controlId: id === 'look' ? 'lookStick' : 'move', x, y }) }); });
  const run = app.querySelector<HTMLButtonElement>('#back-run')!, interact = app.querySelector<HTMLButtonElement>('#back-interact')!;
  const torch=app.querySelector<HTMLButtonElement>('#back-torch')!;torch.addEventListener('pointerdown',e=>{e.preventDefault();if(enabled)send({kind:'action',controlId:'flashlight'});});
  const holds = new Map<string, number>();
  for (const [button, control] of [[run, 'sprint'], [interact, 'interact']] as const) {
    button.addEventListener('pointerdown', event => { event.preventDefault(); if (button.disabled || holds.has(control)) return; holds.set(control, event.pointerId); try { button.setPointerCapture(event.pointerId); } catch { /* test */ } button.setAttribute('aria-pressed', 'true'); send({ kind: 'down', controlId: control }); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => { if (holds.get(control) !== (event as PointerEvent).pointerId) return; holds.delete(control); button.setAttribute('aria-pressed', 'false'); send({ kind: 'up', controlId: control }); });
  }
  function cancel() { sticks.forEach(s => s.reset()); for (const control of holds.keys()) send({ kind: 'up', controlId: control }); holds.clear(); run.setAttribute('aria-pressed', 'false'); interact.setAttribute('aria-pressed', 'false'); }
  return {
    cancel,
    update(s: BackPhoneStatus) {
      const was = enabled; enabled = s.available; spectating = s.state === 'escaped' || s.state === 'eliminated'; if (was && !enabled) cancel();
      app.querySelector('#back-phone-status')!.textContent = backStatusText(s); app.querySelector('#back-phone-notice')!.textContent = s.notice;
      torch.disabled=!enabled;torch.textContent=s.flashlight===false?'TORCIA OFF':'TORCIA ON';torch.setAttribute('aria-pressed',String(s.flashlight!==false));
      run.disabled = !enabled; interact.disabled = !enabled && !spectating; interact.textContent = spectating ? 'CAMBIA SPETTATORE' : s.prompt || 'INTERAGISCI';
      (app.querySelector('.back-stamina i') as HTMLElement).style.width = `${s.stamina * 100}%`;
    },
    destroy() { cancel(); sticks.forEach(s => s.destroy()); }
  };
}
