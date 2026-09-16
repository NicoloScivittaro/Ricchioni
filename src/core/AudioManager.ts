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
