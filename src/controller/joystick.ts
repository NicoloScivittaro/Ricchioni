/**
 * Joystick virtuale riutilizzabile (base + thumbstick) per il controller mobile.
 * Logica corretta e stabile: aggancio a un solo tocco, deadzone configurabile,
 * clamp al bordo, normalizzazione [-1..1], reset pulito.
 *
 * Convenzione assi (coerente con l'input system del party game):
 *   moveX: -1 = sinistra, +1 = destra
 *   moveY: -1 = su (lontano dalla camera), +1 = giù
 */

export interface JoystickDebugInfo {
  centerX: number;
  centerY: number;
  dx: number;
  dy: number;
  rawDist: number;
  clampedDist: number;
  moveX: number;
  moveY: number;
  pointerId: number | null;
}

export interface VirtualJoystickOptions {
  /** Deadzone come frazione del raggio (default 0.12). */
  deadzone?: number;
  /** Ritorna false per bloccare l'input (es. giocatore eliminato). */
  enabled?: () => boolean;
  /** Output normalizzato in [-1,1] (chiamato solo quando il valore cambia). */
  onAxis: (x: number, y: number) => void;
  /** Notifica attivo/inattivo (per feedback visivo, es. glow della base). */
  onActiveChange?: (active: boolean) => void;
  /** Se true mostra un piccolo overlay di debug con i valori interni. */
  debug?: boolean;
}

export interface VirtualJoystick {
  reset(): void;
  destroy(): void;
}

export function createVirtualJoystick(
  baseEl: HTMLElement,
  thumbEl: HTMLElement,
  opts: VirtualJoystickOptions
): VirtualJoystick {
  const deadzone = opts.deadzone ?? 0.12;
  const enabled = opts.enabled ?? (() => true);

  let activePointer: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let debugEl: HTMLDivElement | null = null;

  if (opts.debug) debugEl = buildDebugOverlay();

  const emit = (x: number, y: number): void => {
    // Arrotonda a 2 decimali ed evita invii ridondanti (meno traffico, più stabile).
    const rx = Math.round(x * 100) / 100;
    const ry = Math.round(y * 100) / 100;
    if (rx === lastX && ry === lastY) return;
    lastX = rx;
    lastY = ry;
    opts.onAxis(rx, ry);
  };

  const reset = (): void => {
    if (activePointer === null) return;
    activePointer = null;
    thumbEl.style.transform = 'translate(-50%, -50%)';
    emit(0, 0);
    opts.onActiveChange?.(false);
  };

  const updateFromPointer = (clientX: number, clientY: number): void => {
    const rect = baseEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Raggio di corsa: la base meno il raggio del thumb, così il thumb resta
    // sempre dentro il cerchio e la corsa completa corrisponde al bordo.
    const baseRadius = rect.width / 2;
    const thumbRadius = thumbEl.offsetWidth / 2 || 46;
    const maxDisplacement = Math.max(1, baseRadius - thumbRadius);

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const rawDist = Math.hypot(dx, dy);
    const clampedDist = Math.min(rawDist, maxDisplacement);

    if (rawDist > maxDisplacement) {
      dx = (dx / rawDist) * maxDisplacement;
      dy = (dy / rawDist) * maxDisplacement;
    }

    // Posizione thumb: centrato (-50%,-50%) + offset in px (nessun calc() fragile).
    thumbEl.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;

    // Deadzone + normalizzazione.
    let moveX = 0;
    let moveY = 0;
    if (rawDist >= deadzone * maxDisplacement) {
      moveX = dx / maxDisplacement;
      moveY = dy / maxDisplacement;
    }

    emit(moveX, moveY);

    if (debugEl) {
      debugEl.textContent =
        `center ${centerX.toFixed(0)},${centerY.toFixed(0)}  ` +
        `dx ${dx.toFixed(0)} dy ${dy.toFixed(0)}  ` +
        `raw ${rawDist.toFixed(0)} clamp ${clampedDist.toFixed(0)}  ` +
        `move ${moveX.toFixed(2)},${moveY.toFixed(2)}  ` +
        `ptr ${activePointer ?? '-'}`;
    }
  };

  const onDown = (e: PointerEvent): void => {
    if (!enabled()) return;
    // Aggancio a UN SOLO dito: ignora altri tocchi finché non si rilascia.
    if (activePointer !== null) return;
    e.preventDefault();
    activePointer = e.pointerId;
    opts.onActiveChange?.(true);
    try {
      baseEl.setPointerCapture(e.pointerId);
    } catch {
      /* ignorato */
    }
    updateFromPointer(e.clientX, e.clientY);
  };

  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== activePointer) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== activePointer) return;
    reset();
  };

  baseEl.addEventListener('pointerdown', onDown);
  baseEl.addEventListener('pointermove', onMove);
  baseEl.addEventListener('pointerup', onUp);
  baseEl.addEventListener('pointercancel', onUp);

  return {
    reset,
    destroy(): void {
      baseEl.removeEventListener('pointerdown', onDown);
      baseEl.removeEventListener('pointermove', onMove);
      baseEl.removeEventListener('pointerup', onUp);
      baseEl.removeEventListener('pointercancel', onUp);
      if (debugEl) debugEl.remove();
      debugEl = null;
    }
  };
}

function buildDebugOverlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:99999;background:rgba(0,0,0,0.75);' +
    'color:#4ade80;font:700 11px/1.5 monospace;padding:6px 8px;border-radius:8px;' +
    'pointer-events:none;max-width:96vw;white-space:nowrap;overflow:hidden;';
  document.body.appendChild(el);
  return el;
}
