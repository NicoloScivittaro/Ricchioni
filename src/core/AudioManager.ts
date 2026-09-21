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

  /** Mini-turbo raggiunto (livello 1..3) durante la derapata: blip che sale di tono a ogni livello. */
  driftLevel(level: number): void {
    const f = 520 + level * 260;
    this.tone(f, 0.07, 'square', 0.05, 0);
    this.tone(f * 1.5, 0.09, 'triangle', 0.05, 0.05);
  }

  /** Partenza di un boost (mini-turbo, item, partenza lanciata): whoosh che sale + colpo. `power` ~ 8..30. */
  kartBoost(power = 15): void {
    const ctx = this.ensure();
    const out = this.getOutput('sfx');
    if (!ctx || !out) return;
    try {
      const t = ctx.currentTime;
      const k = Math.min(1.4, 0.7 + power / 40);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(900 * k, t + 0.32);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * k, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.45);
    } catch {
      /* ignora errori audio */
    }
    this.tone(110, 0.14, 'sine', 0.09, 0);
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
 * Motore del kart, uno per kart (split-screen: ognuno il proprio). NON e' un tono che sale e basta:
 *  - MARCE: 4 rapporti, i giri salgono dentro la marcia e cadono al cambio (il ritmo evita la monotonia e da'
 *    la sensazione di accelerare)
 *  - GAS: al rilascio i giri scendono piu' piano (freno motore) e il timbro si "chiude" (filtro)
 *  - DRIFT: fruscio di gomme filtrato che cresce con la derapata
 *  - BOOST: spinta di giri e un sibilo acuto finche' dura
 * Suono morbido: filtro passa-basso, due oscillatori leggermente scordati e un sub; volume basso e diviso per il numero di motori.
 */
export class EngineSound {
  private osc: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private sub: OscillatorNode | null = null;
  private whine: OscillatorNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private whineGain: GainNode | null = null;
  private rpm = 0.25;
  private gear = 0;
  private lastT = 0;
  private kick = 0;

  constructor(private manager: AudioManager) {}

  start(): void {
    const ctx = this.manager.getContext();
    const out = this.manager.getOutput('sfx');
    if (!ctx || !out || this.osc) return;
    try {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      filter.Q.value = 0.9;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      filter.connect(gain);
      gain.connect(out);
      const mk = (type: OscillatorType, f: number): OscillatorNode => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.connect(filter);
        o.start();
        return o;
      };
      this.osc = mk('sawtooth', 55);
      this.osc2 = mk('square', 55.6);
      this.sub = mk('sine', 27);
      // fruscio delle gomme (rumore in loop -> passa-banda -> gain a zero finche' non si deriva)
      const len = Math.floor(ctx.sampleRate * 0.6);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 1100;
      nf.Q.value = 1.1;
      const ng = ctx.createGain();
      ng.gain.value = 0.0001;
      src.connect(nf);
      nf.connect(ng);
      ng.connect(out);
      src.start();
      // sibilo del boost
      const w = ctx.createOscillator();
      w.type = 'sine';
      w.frequency.value = 900;
      const wg = ctx.createGain();
      wg.gain.value = 0.0001;
      w.connect(wg);
      wg.connect(out);
      w.start();
      this.filter = filter;
      this.gain = gain;
      this.noise = src;
      this.noiseFilter = nf;
      this.noiseGain = ng;
      this.whine = w;
      this.whineGain = wg;
      this.lastT = performance.now();
      activeEngines++;
    } catch {
      /* ignora errori audio */
    }
  }

  /** Un colpo di giri (partenza di un boost). */
  boostKick(): void {
    this.kick = 1;
  }

  /** speedFrac 0..1; boosting = boost attivo; throttle 0..1 (gas premuto); drift 0..1 (intensita' della derapata). */
  update(speedFrac: number, boosting: boolean, throttle = 1, drift = 0): void {
    const ctx = this.manager.getContext();
    if (!ctx || !this.osc || !this.osc2 || !this.sub || !this.gain || !this.filter || !this.noiseGain || !this.noiseFilter || !this.whine || !this.whineGain) return;
    const t = ctx.currentTime;
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0.001, (now - this.lastT) / 1000));
    this.lastT = now;
    const sp = Math.max(0, Math.min(1, speedFrac));

    // marce: i giri salgono dentro la marcia e calano al cambio
    const bounds = [0, 0.22, 0.46, 0.72, 1.001];
    let g = 0;
    while (g < 3 && sp >= bounds[g + 1]) g++;
    const inGear = (sp - bounds[g]) / (bounds[g + 1] - bounds[g]);
    const target = 0.3 + inGear * 0.7;
    if (g > this.gear) this.rpm = Math.max(0.25, this.rpm - 0.32); // cambio salito: crollo dei giri
    this.gear = g;
    const wanted = throttle > 0.5 ? target : target * 0.72; // senza gas: freno motore
    this.rpm += (wanted - this.rpm) * (1 - Math.exp(-dt * (wanted > this.rpm ? 9 : 4)));
    this.kick = Math.max(0, this.kick - dt * 2.2);
    const wob = Math.sin(now * 0.009) * 0.006; // leggera vibrazione: il motore "vive"
    const rpm = Math.min(1.15, this.rpm + wob + this.kick * 0.22 + (boosting ? 0.06 : 0));

    const f = 42 + rpm * 165;
    this.osc.frequency.setTargetAtTime(f, t, 0.045);
    this.osc2.frequency.setTargetAtTime(f * 1.012, t, 0.045);
    this.sub.frequency.setTargetAtTime(f * 0.5, t, 0.045);
    this.filter.frequency.setTargetAtTime(380 + rpm * 1250 + (throttle > 0.5 ? 650 : 0) + (boosting ? 450 : 0), t, 0.07);
    const share = 1 / Math.sqrt(Math.max(1, activeEngines));
    this.gain.gain.setTargetAtTime((0.012 + sp * 0.026 + (throttle > 0.5 ? 0.014 : 0)) * share, t, 0.09);

    const skid = Math.max(0, Math.min(1, drift));
    this.noiseGain.gain.setTargetAtTime((skid * 0.05 + sp * 0.006) * share, t, 0.06);
    this.noiseFilter.frequency.setTargetAtTime(800 + sp * 900 + skid * 500, t, 0.08);
    this.whine.frequency.setTargetAtTime(700 + sp * 900 + this.kick * 500, t, 0.05);
    this.whineGain.gain.setTargetAtTime((boosting ? 0.014 : 0.0001) * share, t, 0.05);
  }

  stop(): void {
    const ctx = this.manager.getContext();
    const t = ctx?.currentTime ?? 0;
    const wasRunning = this.osc !== null;
    try {
      this.gain?.gain.setTargetAtTime(0, t, 0.05);
      this.noiseGain?.gain.setTargetAtTime(0, t, 0.05);
      this.whineGain?.gain.setTargetAtTime(0, t, 0.05);
      for (const n of [this.osc, this.osc2, this.sub, this.whine, this.noise]) n?.stop(t + 0.3);
    } catch {
      /* ignora errori audio */
    }
    this.osc = this.osc2 = this.sub = this.whine = null;
    this.noise = null;
    this.filter = null;
    this.gain = this.noiseGain = this.whineGain = null;
    this.noiseFilter = null;
    if (wasRunning) activeEngines = Math.max(0, activeEngines - 1);
  }
}
