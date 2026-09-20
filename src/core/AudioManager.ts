/**
 * AudioManager — sintetizza i suoni via WebAudio e li instrada in CATEGORIE con volume proprio:
 *
 *   sfx    effetti di gioco (colpi, punti, motori)
 *   ui     interfaccia e jingle (tick, selezione, fanfara)
 *   music  musiche (pronta per gli asset futuri)
 *   voice  annunci/voci registrate (pronta per gli asset futuri)
 *
 * Grafo: [oscillatori] → gain di categoria → master → compressore → uscita. Il compressore evita i picchi
 * quando molti effetti si sovrappongono (5 giocatori che colpiscono nello stesso frame).
 * Volumi e muto sono persistenti (localStorage) e regolabili dall'host: M = muto, [ / ] = volume generale.
 */
export type AudioCategory = 'master' | 'music' | 'sfx' | 'ui' | 'voice';

interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  voice: number;
  muted: boolean;
}

const STORE_KEY = 'ricchioni.audio';
const DEFAULTS: AudioSettings = { master: 0.85, music: 0.6, sfx: 1, ui: 0.9, voice: 1, muted: false };
/** Lo stesso suono ripetuto entro questo intervallo (ms) viene ignorato (effetti duplicati nello stesso frame). */
const DEDUPE_MS = 35;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cats: Partial<Record<AudioCategory, GainNode>> = {};
  private settings: AudioSettings = this.load();
  private lastPlayed = new Map<string, number>();
  private toastEl: HTMLDivElement | null = null;
  private toastTimer: number | null = null;

  // ---- contesto e grafo ----

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.buildGraph(this.ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private buildGraph(ctx: AudioContext): void {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    const master = ctx.createGain();
    master.connect(comp);
    this.master = master;
    for (const c of ['music', 'sfx', 'ui', 'voice'] as const) {
      const g = ctx.createGain();
      g.connect(master);
      this.cats[c] = g;
    }
    this.applySettings();
  }

  private applySettings(): void {
    if (!this.master) return;
    this.master.gain.value = this.settings.muted ? 0 : this.settings.master;
    for (const c of ['music', 'sfx', 'ui', 'voice'] as const) {
      const g = this.cats[c];
      if (g) g.gain.value = this.settings[c];
    }
  }

  /** Da chiamare sul primo input utente per sbloccare l'audio (policy browser). */
  unlock(): void {
    this.ensure();
  }

  /** Accesso al contesto condiviso (per suoni continui gestiti altrove, es. motore kart). */
  getContext(): AudioContext | null {
    return this.ensure();
  }

  /** Nodo di uscita di una categoria (i suoni continui si collegano qui, non a ctx.destination). */
  getOutput(cat: Exclude<AudioCategory, 'master'> = 'sfx'): AudioNode | null {
    const ctx = this.ensure();
    return ctx ? (this.cats[cat] ?? ctx.destination) : null;
  }

  createEngine(): EngineSound {
    return new EngineSound(this);
  }

  // ---- volumi / muto ----

  getVolume(cat: AudioCategory): number {
    return cat === 'master' ? this.settings.master : this.settings[cat];
  }

  setVolume(cat: AudioCategory, v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    if (cat === 'master') this.settings.master = clamped;
    else this.settings[cat] = clamped;
    this.applySettings();
    this.save();
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.applySettings();
    this.save();
    return this.settings.muted;
  }

  /** Scorciatoie da tastiera dell'HOST: M muto, [ e ] volume generale. Ignora i campi di testo. */
  enableHotkeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input,textarea,[contenteditable]')) return;
      if (e.key === 'm' || e.key === 'M') {
        this.showToast(this.toggleMute() ? '🔇 AUDIO SILENZIATO (M)' : `🔊 AUDIO ${Math.round(this.settings.master * 100)}%`);
      } else if (e.key === '[' || e.key === ']') {
        this.settings.muted = false;
        this.setVolume('master', this.settings.master + (e.key === ']' ? 0.1 : -0.1));
        this.showToast(`🔊 VOLUME ${Math.round(this.settings.master * 100)}%`);
      }
    });
  }

  private showToast(text: string): void {
    try {
      if (!this.toastEl) {
        const el = document.createElement('div');
        el.style.cssText =
          'position:fixed;left:16px;bottom:16px;z-index:40000;padding:8px 14px;border-radius:10px;' +
          'background:rgba(11,11,20,.92);border:1px solid rgba(255,255,255,.25);color:#fff;' +
          'font:700 14px Arial,sans-serif;pointer-events:none;transition:opacity .2s;';
        document.body.appendChild(el);
        this.toastEl = el;
      }
      this.toastEl.textContent = text;
      this.toastEl.style.opacity = '1';
      if (this.toastTimer) window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(() => {
        if (this.toastEl) this.toastEl.style.opacity = '0';
      }, 1400);
    } catch {
      /* ignora */
    }
  }

  private load(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
    } catch {
      /* ignora */
    }
    return { ...DEFAULTS };
  }

  private save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignora */
    }
  }

  // ---- suoni ----

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, cat: Exclude<AudioCategory, 'master'> = 'sfx'): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const out = this.cats[cat];
    if (!out) return;
    // stesso suono nello stesso istante (più giocatori/eventi nello stesso frame): un solo colpo
    if (when === 0) {
      const key = `${cat}|${type}|${Math.round(freq)}`;
      const now = performance.now();
      const last = this.lastPlayed.get(key);
      if (last !== undefined && now - last < DEDUPE_MS) return;
      this.lastPlayed.set(key, now);
    }
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      /* ignora errori audio */
    }
  }

  correct(): void {
    this.tone(880, 0.12, 'sine', 0.08);
  }

  wrong(): void {
    this.tone(180, 0.2, 'sawtooth', 0.06);
  }

  /** Tick dell'interfaccia (rullo, countdown). `pitch` > 1 = più acuto. */
  tick(pitch = 1): void {
    this.tone(520 * pitch, 0.05, 'square', 0.04, 0, 'ui');
  }

  select(): void {
    this.tone(660, 0.08, 'triangle', 0.07, 0, 'ui');
  }

  fanfare(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.09, i * 0.13, 'ui'));
  }

  boost(): void {
    this.tone(220, 0.05, 'sawtooth', 0.08);
    this.tone(660, 0.18, 'sawtooth', 0.08, 0.04);
  }

  hit(): void {
    this.tone(140, 0.16, 'square', 0.09);
  }

  /** Tono libero (es. nota di una tile di memoria): freq Hz, dur secondi. */
  playTone(freq: number, dur = 0.18, type: OscillatorType = 'triangle', gain = 0.08): void {
    this.tone(freq, dur, type, gain);
  }

  /** Nota della tile i (0..3) di MEMORIA DA UBRIACO, stile Simon. */
  tileTone(index: number): void {
    const freqs = [329.63, 246.94, 196.0, 146.83];
    this.tone(freqs[index] ?? 440, 0.22, 'triangle', 0.09);
  }
}

export const audio = new AudioManager();

/** Motori attualmente accesi: il volume di ciascuno scala con 1/√n (5 kart insieme non sono 5 volte più forti). */
let activeEngines = 0;

/**
 * Motore continuo con pitch legato alla velocità (0..1). Un'istanza per kart:
 * più giocatori guidano insieme in split-screen, ognuno col proprio motore.
 */
export class EngineSound {
  private osc: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  constructor(private manager: AudioManager) {}

  start(): void {
    const ctx = this.manager.getContext();
    const out = this.manager.getOutput('sfx');
    if (!ctx || !out || this.osc) return;
    try {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc2.type = 'triangle';
      osc.frequency.value = 55;
      osc2.frequency.value = 82;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(out);
      osc.start();
      osc2.start();
      this.osc = osc;
      this.osc2 = osc2;
      this.gain = gain;
      activeEngines++;
    } catch {
      /* ignora errori audio */
    }
  }

  /** speedFrac 0..1 (rispetto alla velocità massima); boosting per un timbro più aggressivo. */
  update(speedFrac: number, boosting: boolean): void {
    const ctx = this.manager.getContext();
    if (!ctx || !this.osc || !this.osc2 || !this.gain) return;
    const t = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, speedFrac));
    const f = 50 + clamped * 190 + (boosting ? 35 : 0);
    const share = 1 / Math.sqrt(Math.max(1, activeEngines));
    this.osc.frequency.setTargetAtTime(f, t, 0.06);
    this.osc2.frequency.setTargetAtTime(f * 1.5, t, 0.06);
    this.gain.gain.setTargetAtTime((0.018 + clamped * 0.045) * share, t, 0.1);
  }

  stop(): void {
    const ctx = this.manager.getContext();
    const t = ctx?.currentTime ?? 0;
    const wasRunning = this.osc !== null;
    try {
      this.gain?.gain.setTargetAtTime(0, t, 0.05);
      this.osc?.stop(t + 0.3);
      this.osc2?.stop(t + 0.3);
    } catch {
      /* ignora errori audio */
    }
    this.osc = null;
    this.osc2 = null;
    this.gain = null;
    if (wasRunning) activeEngines = Math.max(0, activeEngines - 1);
  }
}
