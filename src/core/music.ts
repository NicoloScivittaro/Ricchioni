import { audio } from './AudioManager';
import { THEMES, midiToHz, stepEvents } from './musicThemes';
import type { Theme, ThemeId, Wave } from './musicThemes';

/**
 * MUSICA PROCEDURALE (host). Suona i temi di core/musicThemes.ts con piccoli sintetizzatori WebAudio, sullo STESSO
 * AudioContext di tutto il resto, nel bus "music" (che passa dal ducking dell'AudioManager).
 *  - scheduler a "lookahead": un intervallo da 25 ms programma le note dei prossimi 120 ms sull'orologio audio
 *    (tempo preciso anche se il frame del gioco rallenta), ATTIVO solo mentre una musica suona
 *  - cambio tema = CROSSFADE (niente musica troncata), stop = dissolvenza
 *  - ogni nota e' una voce breve che si chiude da sola (nessun oscillatore lasciato acceso): i nodi tornano stabili
 * In produzione la musica esiste solo sulla TV: i telefoni non la suonano mai.
 */

const LOOKAHEAD = 0.12;

/** Oscillatori della musica vivi adesso, letti dal test di leak (scripts/e2e/leak.mjs) per distinguerli da quelli rimasti accesi. */
function publish(n: number): void {
  (globalThis as unknown as { __musicOsc?: number }).__musicOsc = n;
}
const TICK_MS = 25;

interface Track {
  theme: Theme;
  out: GainNode;
  nextTime: number;
  step: number; // semicrome dall'inizio
  stopped: boolean;
}

class MusicEngine {
  private track: Track | null = null;
  private fading: Track[] = [];
  private timer: number | null = null;
  private level: 0 | 1 | 2 = 1;
  private noise: AudioBuffer | null = null;
  private notes = 0;

  /** Tema in riproduzione (null = silenzio). */
  current(): ThemeId | null {
    return this.track && !this.track.stopped ? this.track.theme.id : null;
  }

  getLevel(): 0 | 1 | 2 {
    return this.level;
  }

  /** Voci musicali attive in questo istante (per il debug e il test di leak). */
  activeNotes(): number {
    return this.notes;
  }

  /** Avvia un tema con crossfade da quello corrente (stesso tema = nessun riavvio). */
  play(id: ThemeId, level: 0 | 1 | 2 = 1, fadeSec = 0.8): void {
    this.level = level;
    if (this.current() === id) return;
    const ctx = audio.getContext();
    const input = audio.getMusicInput();
    if (!ctx || !input) return;
    const theme = THEMES[id];
    this.fadeOut(fadeSec * 0.8);
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.gain.setTargetAtTime(theme.gain, ctx.currentTime, fadeSec / 3);
    out.connect(input);
    this.track = { theme, out, nextTime: ctx.currentTime + 0.06, step: 0, stopped: false };
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  /** Livello d'intensita' (0 sotto, 1 normale, 2 finale): cambia gli strati, mai il tempo. */
  setLevel(level: 0 | 1 | 2): void {
    this.level = level;
  }

  /**
   * Dissolvenza e stop del tema corrente. `only` = ferma solo se sta suonando QUEL tema (es. il rullo allo stop: se nel
   * frattempo e' gia' partito il tema del gioco, non va toccato).
   */
  stop(fadeSec = 0.6, only?: ThemeId): void {
    if (only && this.current() !== only) return;
    this.fadeOut(fadeSec);
  }

  private fadeOut(sec: number): void {
    const ctx = audio.getContext();
    const t = this.track;
    if (!t || !ctx) return;
    t.stopped = true;
    t.out.gain.cancelScheduledValues(ctx.currentTime);
    t.out.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.05, sec / 3));
    this.fading.push(t);
    this.track = null;
    // stacca il gain quando la coda e' finita (le note gia' programmate si chiudono da sole)
    window.setTimeout(() => {
      try {
        t.out.disconnect();
      } catch {
        /* ignora */
      }
      this.fading = this.fading.filter((f) => f !== t);
      if (!this.track && this.fading.length === 0 && this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }, Math.max(200, sec * 1000 + 600));
  }

  private schedule(): void {
    const ctx = audio.getContext();
    const tr = this.track;
    if (!ctx || !tr || tr.stopped) return;
    if (ctx.state !== 'running') {
      tr.nextTime = ctx.currentTime + 0.05;
      return;
    }
    // dopo un blocco lungo (tab in background) non recupera mille note: riparte da adesso
    if (tr.nextTime < ctx.currentTime - 0.25) tr.nextTime = ctx.currentTime + 0.02;
    const sixteenth = 60 / tr.theme.bpm / 4;
    while (tr.nextTime < ctx.currentTime + LOOKAHEAD) {
      const bar = Math.floor(tr.step / 16);
      const step = tr.step % 16;
      const swing = step % 2 === 1 ? tr.theme.swing * sixteenth : 0;
      this.playStep(ctx, tr, bar, step, tr.nextTime + swing, sixteenth);
      tr.nextTime += sixteenth;
      tr.step++;
    }
  }

  private playStep(ctx: AudioContext, tr: Track, bar: number, step: number, t: number, six: number): void {
    const th = tr.theme;
    const ev = stepEvents(th, bar, step, this.level);
    const o = tr.out;
    if (ev.kick) this.kick(ctx, o, t);
    if (ev.snare) this.snare(ctx, o, t, ev.fill ? 0.6 : 1);
    if (ev.hat) this.hat(ctx, o, t, ev.hat === 2 ? 1 : 0.5);
    if (ev.perc) this.perc(ctx, o, t, th.perc.kind);
    if (ev.bass !== null) this.synth(ctx, o, t, midiToHz(ev.bass), six * (th.bass.pattern.length === 16 && /^1+5*$/.test(th.bass.pattern) ? 0.9 : 1.8), th.bass.wave, 0.07, 600);
    if (ev.chord) {
      const dur = th.chords.style === 'pad' ? six * 15 : six * 1.6;
      const g = th.chords.style === 'pad' ? 0.022 : 0.03;
      for (const n of ev.chord) this.synth(ctx, o, t, midiToHz(n), dur, th.chords.wave, g, th.chords.style === 'pad' ? 1400 : 2400, th.chords.style === 'pad');
    }
    if (ev.lead !== null) this.synth(ctx, o, t, midiToHz(ev.lead), six * 1.8, th.lead.wave, 0.04, 3200);
  }

  // ---- strumenti (voci brevi, si chiudono da sole) ----

  private voice(node: AudioScheduledSourceNode): void {
    this.notes++;
    const osc = node instanceof OscillatorNode;
    if (osc) this.oscs++;
    publish(this.oscs);
    node.onended = () => {
      this.notes = Math.max(0, this.notes - 1);
      if (osc) this.oscs = Math.max(0, this.oscs - 1);
      publish(this.oscs);
    };
  }
  private oscs = 0;

  private kick(ctx: AudioContext, out: AudioNode, t: number): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    g.connect(out);
    this.voice(o);
    o.start(t);
    o.stop(t + 0.22);
  }

  private noiseSrc(ctx: AudioContext): AudioBufferSourceNode {
    if (!this.noise || this.noise.sampleRate !== ctx.sampleRate) {
      const len = Math.floor(ctx.sampleRate * 0.4);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    return s;
  }

  private filteredNoise(ctx: AudioContext, out: AudioNode, t: number, type: BiquadFilterType, f: number, gain: number, dur: number): void {
    const s = this.noiseSrc(ctx);
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(out);
    this.voice(s);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  private snare(ctx: AudioContext, out: AudioNode, t: number, k: number): void {
    this.filteredNoise(ctx, out, t, 'bandpass', 1900, 0.07 * k, 0.14);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(190, t);
    g.gain.setValueAtTime(0.04 * k, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g);
    g.connect(out);
    this.voice(o);
    o.start(t);
    o.stop(t + 0.1);
  }

  private hat(ctx: AudioContext, out: AudioNode, t: number, k: number): void {
    this.filteredNoise(ctx, out, t, 'highpass', 7500, 0.022 * k, 0.045);
  }

  private perc(ctx: AudioContext, out: AudioNode, t: number, kind: Theme['perc']['kind']): void {
    switch (kind) {
      case 'tom':
      case 'stomp': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f0 = kind === 'stomp' ? 90 : 160;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.18);
        g.gain.setValueAtTime(kind === 'stomp' ? 0.12 : 0.09, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g);
        g.connect(out);
        this.voice(o);
        o.start(t);
        o.stop(t + 0.24);
        if (kind === 'stomp') this.filteredNoise(ctx, out, t + 0.01, 'bandpass', 1500, 0.05, 0.1); // battimani della curva
        return;
      }
      case 'clap':
        this.filteredNoise(ctx, out, t, 'bandpass', 1500, 0.06, 0.12);
        return;
      case 'shaker':
        this.filteredNoise(ctx, out, t, 'highpass', 5500, 0.016, 0.06);
        return;
      case 'rim':
        this.filteredNoise(ctx, out, t, 'bandpass', 3400, 0.05, 0.03);
        return;
      case 'brush':
        this.filteredNoise(ctx, out, t, 'bandpass', 4200, 0.014, 0.16);
        return;
    }
  }

  private synth(ctx: AudioContext, out: AudioNode, t: number, f: number, dur: number, wave: Wave, gain: number, cutoff: number, pad = false): void {
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(f, t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    const atk = pad ? Math.min(0.25, dur * 0.3) : 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + atk);
    g.gain.setTargetAtTime(0.0001, t + Math.max(atk, dur * (pad ? 0.7 : 0.4)), dur * 0.25);
    o.connect(lp);
    lp.connect(g);
    g.connect(out);
    this.voice(o);
    o.start(t);
    o.stop(t + dur + 0.4);
  }
}

export const music = new MusicEngine();
