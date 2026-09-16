/**
 * AudioManager — per ora sintetizza suoni via WebAudio.
 * Qui in futuro andranno: versi reali degli amici, urla, frasi registrate,
 * musiche, sound effect e gli annunci del rullo.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
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

  createEngine(): EngineSound {
    return new EngineSound(this);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(ctx.destination);
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

  tick(): void {
    this.tone(520, 0.05, 'square', 0.04);
  }

  select(): void {
    this.tone(660, 0.08, 'triangle', 0.07);
  }

  fanfare(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.09, i * 0.13));
  }

  boost(): void {
    this.tone(220, 0.05, 'sawtooth', 0.08);
    this.tone(660, 0.18, 'sawtooth', 0.08, 0.04);
  }

  hit(): void {
    this.tone(140, 0.16, 'square', 0.09);
  }
}

export const audio = new AudioManager();

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
    if (!ctx || this.osc) return;
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
      gain.connect(ctx.destination);
      osc.start();
      osc2.start();
      this.osc = osc;
      this.osc2 = osc2;
      this.gain = gain;
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
    this.osc.frequency.setTargetAtTime(f, t, 0.06);
    this.osc2.frequency.setTargetAtTime(f * 1.5, t, 0.06);
    this.gain.gain.setTargetAtTime(0.018 + clamped * 0.045, t, 0.1);
  }

  stop(): void {
    const ctx = this.manager.getContext();
    const t = ctx?.currentTime ?? 0;
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
  }
}
