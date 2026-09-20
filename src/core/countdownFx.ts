import type { Scene } from '@babylonjs/core';
import type { TextBlock } from '@babylonjs/gui';

/**
 * Effetti condivisi del COUNTDOWN 3-2-1-VIA dei giochi 3D: il numero "pulsa" (parte grande e si assesta),
 * e su VIA! parte anche un lampo a schermo intero. Audio e vibrazione dei telefoni restano nel loop di
 * ciascun gioco (tick a tono crescente, boost su VIA, ctx.vibrate a tutti). Tutto basato sul tempo reale.
 */
const POP_MS = 420;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Anima la scala del testo del countdown (1.9 → 1.0 con leggero rimbalzo). Sicura anche se la scena viene distrutta. */
export function popCountdown(tb: TextBlock, scene: Scene | null | undefined, go: boolean): void {
  if (!scene) return;
  const start = performance.now();
  const peak = go ? 2.3 : 1.9;
  tb.scaleX = tb.scaleY = peak;
  const obs = scene.onBeforeRenderObservable.add(() => {
    const t = Math.min(1, (performance.now() - start) / POP_MS);
    const s = peak + (1 - peak) * easeOutBack(t);
    tb.scaleX = tb.scaleY = s;
    if (t >= 1) {
      tb.scaleX = tb.scaleY = 1;
      scene.onBeforeRenderObservable.remove(obs);
    }
  });
  if (go) flash();
}

/** Lampo bianco a schermo intero (DOM, sopra il canvas 3D); si auto-rimuove. */
export function flash(color = 'rgba(255,255,255,0.5)'): void {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;inset:0;z-index:20000;pointer-events:none;background:${color};opacity:1;transition:opacity 420ms ease-out;`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => (el.style.opacity = '0')));
  setTimeout(() => el.remove(), 600);
}
