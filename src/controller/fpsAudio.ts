import { audio } from '../core/AudioManager';

/**
 * AUDIO DELLA SPARATORIA: tutti i suoni sono sintetizzati (WebAudio), stile CARTONE animato, non militare:
 * ogni arma ha una firma sonora riconoscibile. Passano dalla categoria SFX (volume generale e muto rispettati).
 * `opt.gain`/`opt.pan` servono per i colpi dei nemici (attenuati in base alla distanza e spostati a destra/sinistra).
 */
export interface SfxOpt {
  gain?: number;
  pan?: number; // -1 sinistra … +1 destra
}

interface Bus {
  ctx: AudioContext;
  dst: AudioNode;
}

let noiseBuf: AudioBuffer | null = null;

function bus(): Bus | null {
  const ctx = audio.getContext();
  const dst = audio.getOutput('sfx');
  if (!ctx || !dst || ctx.state === 'closed') return null;
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, dst };
}

function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.7);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

function chain(b: Bus, g: GainNode, opt?: SfxOpt): void {
  if (opt?.pan !== undefined && typeof b.ctx.createStereoPanner === 'function') {
    const p = b.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, opt.pan));
    g.connect(p);
    p.connect(b.dst);
  } else {
    g.connect(b.dst);
  }
}

/** Oscillatore con glissando f0 → f1 e inviluppo veloce. */
function tone(b: Bus, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0, opt?: SfxOpt): void {
  try {
    const t = b.ctx.currentTime + delay;
    const o = b.ctx.createOscillator();
    const g = b.ctx.createGain();
    const peak = gain * (opt?.gain ?? 1);
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.006, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    chain(b, g, opt);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* ignora errori audio */
  }
}

/** Rumore filtrato (soffio, schiocco, fruscio). */
function hiss(b: Bus, kind: BiquadFilterType, f0: number, f1: number, dur: number, gain: number, delay = 0, q = 0.8, opt?: SfxOpt): void {
  try {
    const t = b.ctx.currentTime + delay;
    const s = b.ctx.createBufferSource();
    s.buffer = noise(b.ctx);
    const f = b.ctx.createBiquadFilter();
    f.type = kind;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = b.ctx.createGain();
    const peak = gain * (opt?.gain ?? 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.005, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    chain(b, g, opt);
    s.start(t, Math.random() * 0.4);
    s.stop(t + dur + 0.02);
  } catch {
    /* ignora errori audio */
  }
}

const jit = (): number => 0.93 + Math.random() * 0.14;

/** Sparo: ogni arma ha la sua firma. */
export function shot(weaponId: string, opt?: SfxOpt): void {
  const b = bus();
  if (!b) return;
  const j = jit();
  switch (weaponId) {
    case 'spaccatutto': // BUM secco + pompa "ka-ciak"
      hiss(b, 'lowpass', 1400, 300, 0.2, 0.32, 0, 0.7, opt);
      tone(b, 'sine', 130 * j, 42, 0.24, 0.34, 0, opt);
      tone(b, 'square', 900, 300, 0.05, 0.08, 0, opt);
      tone(b, 'square', 420, 300, 0.03, 0.09, 0.32, opt);
      tone(b, 'square', 300, 220, 0.04, 0.09, 0.42, opt);
      break;
    case 'laser': // pew energetico con brillio
      tone(b, 'sawtooth', 1500 * j, 260, 0.24, 0.13, 0, opt);
      tone(b, 'sine', 2200 * j, 700, 0.16, 0.1, 0, opt);
      tone(b, 'triangle', 780, 1300, 0.12, 0.08, 0.02, opt);
      hiss(b, 'highpass', 6500, 3000, 0.07, 0.07, 0, 0.7, opt);
      break;
    case 'raffica': // tk secco (ogni impulso della raffica)
      hiss(b, 'bandpass', 2300, 1400, 0.035, 0.2, 0, 1.2, opt);
      tone(b, 'square', 420 * j, 190, 0.045, 0.11, 0, opt);
      break;
    case 'bombarda': // POP di tappo + FOMP grave
      tone(b, 'sine', 320, 620, 0.06, 0.16, 0, opt);
      hiss(b, 'lowpass', 900, 120, 0.42, 0.34, 0.02, 0.7, opt);
      tone(b, 'sine', 95 * j, 30, 0.5, 0.4, 0.02, opt);
      break;
    case 'sparapiselli': // ptù ptù comico
      tone(b, 'sine', 900 * j, 1500, 0.045, 0.1, 0, opt);
      hiss(b, 'bandpass', 3200, 2400, 0.025, 0.06, 0, 1.5, opt);
      break;
    default: // mitraglia: tatatata
      hiss(b, 'bandpass', 1900, 900, 0.05, 0.2, 0, 0.9, opt);
      tone(b, 'square', 230 * j, 105, 0.055, 0.1, 0, opt);
  }
}

/** Inizio ricarica: la sequenza dura quanto la ricarica reale, con il "clack" finale che segnala arma pronta. */
export function reload(weaponId: string, dur: number): void {
  const b = bus();
  if (!b) return;
  const end = Math.max(0.3, dur);
  switch (weaponId) {
    case 'laser': // batteria che si carica: whine crescente + ping
      tone(b, 'sawtooth', 220, 1100, end * 0.85, 0.06);
      tone(b, 'sine', 440, 1760, end * 0.85, 0.05);
      tone(b, 'sine', 1900, 1900, 0.16, 0.1, end - 0.1);
      break;
    case 'spaccatutto': // cartucce una a una + pompa
      for (let i = 0; i < 3; i++) tone(b, 'square', 520 - i * 40, 300, 0.04, 0.1, 0.18 + (i * (end - 0.6)) / 3);
      tone(b, 'square', 380, 260, 0.05, 0.12, end - 0.32);
      tone(b, 'square', 260, 180, 0.06, 0.13, end - 0.2);
      break;
    case 'bombarda': // clunk metallico, ogiva, chiusura
      tone(b, 'triangle', 130, 80, 0.12, 0.22, 0.05);
      tone(b, 'sine', 1200, 800, 0.2, 0.07, end * 0.5);
      tone(b, 'triangle', 90, 55, 0.16, 0.25, end - 0.18);
      break;
    case 'sparapiselli': // piselli che rotolano
      for (let i = 0; i < 7; i++) hiss(b, 'bandpass', 3000 + Math.random() * 1500, 2500, 0.02, 0.06, 0.1 + Math.random() * (end - 0.35), 2);
      tone(b, 'sine', 700, 1100, 0.07, 0.1, end - 0.12);
      break;
    default: // caricatore fuori, dentro, otturatore
      hiss(b, 'highpass', 3200, 2800, 0.03, 0.12, 0.04, 0.8);
      tone(b, 'square', 500, 300, 0.03, 0.08, 0.04);
      tone(b, 'square', 260, 170, 0.045, 0.12, end * 0.58);
      hiss(b, 'bandpass', 1600, 1100, 0.04, 0.12, end * 0.58, 1);
      tone(b, 'square', 340, 220, 0.04, 0.12, end - 0.1);
  }
}

/** Grilletto premuto a caricatore vuoto. */
export function empty(): void {
  const b = bus();
  if (!b) return;
  tone(b, 'square', 1100, 700, 0.03, 0.09);
  tone(b, 'square', 500, 380, 0.04, 0.06, 0.03);
}

/** Colpo a segno confermato dall'host: un "tic" brillante (piu' grave e pesante se il danno e' grosso). */
export function hitTick(dmg: number): void {
  const b = bus();
  if (!b) return;
  const heavy = dmg >= 40;
  tone(b, 'sine', heavy ? 900 : 1500, heavy ? 600 : 1100, 0.07, 0.16);
  tone(b, 'triangle', heavy ? 2100 : 2600, 2400, 0.05, 0.08);
  if (heavy) tone(b, 'sine', 160, 90, 0.12, 0.16);
}

/** Kill: doppio "ding" ascendente + botto. */
export function kill(): void {
  const b = bus();
  if (!b) return;
  tone(b, 'triangle', 880, 880, 0.14, 0.16);
  tone(b, 'triangle', 1318, 1318, 0.22, 0.16, 0.09);
  tone(b, 'sine', 1760, 1760, 0.3, 0.09, 0.18);
  tone(b, 'sine', 150, 70, 0.18, 0.2);
}

/** Danno subito: "ouch" cartoon + tonfo. */
export function hurt(amount: number): void {
  const b = bus();
  if (!b) return;
  const big = amount >= 30;
  tone(b, 'sawtooth', big ? 360 : 300, big ? 110 : 150, big ? 0.24 : 0.16, 0.13);
  tone(b, 'sine', 95, 50, 0.16, 0.26);
  hiss(b, 'lowpass', 700, 200, 0.1, 0.13);
}

/** Passo: tonfo morbido, alterna due altezze. */
export function step(alt: boolean): void {
  const b = bus();
  if (!b) return;
  tone(b, 'sine', alt ? 92 : 108, 55, 0.07, 0.07);
  hiss(b, 'lowpass', alt ? 480 : 380, 200, 0.05, 0.05);
}

/** Dash: whoosh. */
export function dash(): void {
  const b = bus();
  if (!b) return;
  hiss(b, 'bandpass', 350, 2600, 0.24, 0.2, 0, 1.4);
  tone(b, 'sine', 180, 520, 0.2, 0.05);
}

/** Estrazione dell'arma: due clic e un tono che sale, diverso per arma. */
export function equip(weaponId: string): void {
  const b = bus();
  if (!b) return;
  const base: Record<string, number> = { mitraglia: 520, spaccatutto: 300, laser: 900, raffica: 460, bombarda: 200, sparapiselli: 760 };
  const f = base[weaponId] ?? 500;
  tone(b, 'square', f, f * 0.6, 0.035, 0.09);
  tone(b, 'square', f * 1.4, f * 0.9, 0.04, 0.09, 0.09);
  tone(b, 'triangle', f, f * 1.8, 0.14, 0.07, 0.14);
}

/** Esplosione (bombarda): botto grave + ondata di rumore; piu' lontana = piu' bassa di volume. */
export function boom(opt?: SfxOpt): void {
  const b = bus();
  if (!b) return;
  hiss(b, 'lowpass', 1500, 120, 0.6, 0.4, 0, 0.7, opt);
  tone(b, 'sine', 110, 26, 0.6, 0.5, 0, opt);
  tone(b, 'square', 300, 60, 0.18, 0.1, 0, opt);
}

/** Fischio del proiettile lento in volo. */
export function whistle(dur: number): void {
  const b = bus();
  if (!b) return;
  tone(b, 'sine', 900, 500, Math.max(0.2, dur), 0.035);
}
