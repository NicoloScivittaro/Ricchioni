/**
 * MATEMATICA DEGLI STICK (pura: nessun DOM, nessuna Gamepad API, testabile con tsx).
 *
 * - deadzone RADIALE (non per asse): sotto la soglia l'uscita e' (0,0); sopra, la grandezza viene rimappata (soglia..1) -> (0..1),
 *   cosi' non c'e' scalino e la diagonale resta una diagonale;
 * - la grandezza e' limitata a 1: molti stick fisici arrivano a ~1.4 sulle diagonali (cancello quadrato) e senza clamp una
 *   diagonale correrebbe piu' forte di una direzione dritta.
 */

export interface PadConfig {
  /** Deadzone radiale dello stick sinistro (movimento). */
  leftDeadzone: number;
  /** Deadzone radiale dello stick destro (mira/camera). */
  rightDeadzone: number;
  /** Deadzone dei grilletti analogici. */
  triggerDeadzone: number;
  /** Soglia (0..1) oltre la quale un grilletto analogico conta come tasto premuto. */
  triggerButtonThreshold: number;
  /** Soglia (0..1) oltre la quale lo stick sinistro conta come D-pad (per i menu/quiz). */
  stickAsDpadThreshold: number;
}

export const DEFAULT_PAD_CONFIG: PadConfig = {
  leftDeadzone: 0.16,
  rightDeadzone: 0.12,
  triggerDeadzone: 0.05,
  triggerButtonThreshold: 0.4,
  stickAsDpadThreshold: 0.55
};

export const PAD_CONFIG: PadConfig = { ...DEFAULT_PAD_CONFIG };

const STORAGE_KEY = 'ricchioni.padConfig';

/** Aggiorna la configurazione (valori fuori scala vengono ignorati) e la salva nel browser. */
export function setPadConfig(partial: Partial<PadConfig>): void {
  for (const k of Object.keys(partial) as (keyof PadConfig)[]) {
    const v = partial[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1) PAD_CONFIG[k] = v;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PAD_CONFIG));
  } catch {
    /* storage non disponibile */
  }
}

/** Ricarica la configurazione salvata (se c'e'). */
export function loadPadConfig(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setPadConfigNoSave(JSON.parse(raw) as Partial<PadConfig>);
  } catch {
    /* ignora */
  }
}

function setPadConfigNoSave(partial: Partial<PadConfig>): void {
  for (const k of Object.keys(partial) as (keyof PadConfig)[]) {
    const v = partial[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1) PAD_CONFIG[k] = v;
  }
}

export interface Vec2 {
  x: number;
  y: number;
}

/** Deadzone radiale + rimappatura + clamp a grandezza 1. Ingresso nan/undefined => (0,0). */
export function radialDeadzone(x: number, y: number, deadzone: number): Vec2 {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const mag = Math.hypot(x, y);
  if (mag <= deadzone || mag === 0) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  const k = scaled / mag;
  return { x: x * k, y: y * k };
}

/** Deadzone di un asse singolo (grilletti): (soglia..1) -> (0..1). */
export function axisDeadzone(v: number, deadzone: number): number {
  if (!Number.isFinite(v)) return 0;
  const a = Math.abs(v);
  if (a <= deadzone) return 0;
  return Math.sign(v) * Math.min(1, (a - deadzone) / (1 - deadzone));
}

/**
 * Curva di risposta per la mira (FPS): piccoli movimenti = precisi, stick a fondo = rotazione veloce.
 * `exponent` 1 = lineare; 1.6-2 = morbido al centro.
 */
export function responseCurve(mag: number, exponent = 1.7): number {
  return Math.pow(Math.max(0, Math.min(1, mag)), exponent);
}

/** Il grilletto puo' essere un asse (0..1) o solo un tasto (value 0/1): unifica in 0..1 con deadzone. */
export function triggerValue(button: { pressed: boolean; value: number } | undefined, deadzone: number): number {
  if (!button) return 0;
  const v = Number.isFinite(button.value) ? button.value : button.pressed ? 1 : 0;
  const d = axisDeadzone(v, deadzone);
  return d === 0 && button.pressed ? 1 : d;
}

/** Bordi (down / pressedThisFrame / releasedThisFrame) di un tasto tra un campionamento e il successivo. */
export interface ButtonEdge {
  down: boolean;
  pressed: boolean;
  released: boolean;
}

export function edge(prevDown: boolean, nowDown: boolean): ButtonEdge {
  return { down: nowDown, pressed: nowDown && !prevDown, released: !nowDown && prevDown };
}
