/**
 * AudioManager — UNICO sistema audio: sintetizza i suoni via WebAudio e li instrada in BUS con volume proprio:
 *
 *   sfx       effetti di gioco (colpi, punti, motori)
 *   ui        interfaccia e jingle (tick, selezione, conferme)
 *   music     musica procedurale (core/music.ts), passa per il DUCKING
 *   voice     telecronista: stinger degli annunci (VIA, GOL, VINCE...)
 *   ambience  letti sonori continui (folla del calcio)
 *
 * Grafo: [voci] → bus → master → compressore → LIMITER → uscita. Il compressore tiene insieme il mix, il limiter
 * impedisce il clipping quando tutto succede insieme (4 armi + colpi + esplosione + musica). PRIORITA' percettiva:
 * eventi critici > annunci > azioni > UI > musica > ambiente: la musica si abbassa un attimo (ducking) sugli eventi
 * importanti e ogni bus ha un BUDGET di voci contemporanee (oltre, i suoni meno importanti non vengono creati).
 * Volumi e muto sono persistenti (localStorage): M = muto, [ / ] = volume generale, V = pannello volumi (core/audioSettings).
 */
export type AudioCategory = 'master' | 'music' | 'sfx' | 'ui' | 'voice' | 'ambience';
type Bus = Exclude<AudioCategory, 'master'>;
const BUSES: Bus[] = ['music', 'sfx', 'ui', 'voice', 'ambience'];

interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  voice: number;
  ambience: number;
  muted: boolean;
}

const STORE_KEY = 'ricchioni.audio';
// musica sotto gli effetti: non deve mai coprire countdown, colpi, annunci, risultati
const DEFAULTS: AudioSettings = { master: 0.85, music: 0.55, sfx: 1, ui: 0.9, voice: 1, ambience: 0.6, muted: false };
/** Voci contemporanee massime per bus (oltre: il suono non viene creato, salvo `force` per gli eventi critici). */
const VOICE_BUDGET: Record<Bus, number> = { sfx: 36, ui: 12, voice: 10, music: 48, ambience: 6 };
/** Lo stesso suono ripetuto entro questo intervallo (ms) viene ignorato (effetti duplicati nello stesso frame). */
const DEDUPE_MS = 35;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cats: Partial<Record<AudioCategory, GainNode>> = {};
  private settings: AudioSettings = this.load();
  private lastPlayed = new Map<string, number>();
  private noiseBuf: AudioBuffer | null = null;
  private toastEl: HTMLDivElement | null = null;
  private toastTimer: number | null = null;
  private duckNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private peakBuf: Float32Array | null = null;
  private voices: Record<Bus, number> = { music: 0, sfx: 0, ui: 0, voice: 0, ambience: 0 };
  private dropped = 0;
  private duckUntil = 0;
  private duckDepth = 0;

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
    // LIMITER: tetto duro appena sotto 0 dBFS (il compressore da solo, con molti colpi insieme, lasciava passare picchi)
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    comp.connect(limiter);
    limiter.connect(ctx.destination);
    // misuratore di picco (solo letto dal debug audio): nessun effetto sul suono
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    limiter.connect(an);
    this.analyser = an;
    const master = ctx.createGain();
    master.connect(comp);
    this.master = master;
    // la musica passa da un gain di DUCKING (si abbassa un attimo sugli eventi importanti)
    const duck = ctx.createGain();
    duck.connect(master);
    this.duckNode = duck;
    for (const c of BUSES) {
      const g = ctx.createGain();
      g.connect(c === 'music' ? duck : master);
      this.cats[c] = g;
    }
    this.applySettings();
  }

  private applySettings(): void {
    if (!this.master) return;
    this.master.gain.value = this.settings.muted ? 0 : this.settings.master;
    for (const c of BUSES) {
      const g = this.cats[c];
      if (g) g.gain.value = this.settings[c];
    }
  }

  // ---- priorita' / budget / ducking ----

  /** Il bus ha ancora voci libere? `force` = evento critico (VIA, gol, eliminazione): passa sempre. */
  private claim(bus: Bus, force = false): boolean {
    if (!force && this.voices[bus] >= VOICE_BUDGET[bus]) {
      this.dropped++;
      return false;
    }
    this.voices[bus]++;
    return true;
  }

  /** Da chiamare quando l'ultimo nodo di una voce finisce (onended). */
  private release(bus: Bus): void {
    this.voices[bus] = Math.max(0, this.voices[bus] - 1);
  }

  /** Voce esterna (motore, armi della Sparatoria, musica): prenota un posto nel budget del bus; false = saltala. */
  reserveVoice(bus: Bus, durSec: number, force = false): boolean {
    if (!this.claim(bus, force)) return false;
    window.setTimeout(() => this.release(bus), Math.max(10, durSec * 1000));
    return true;
  }

  /**
   * DUCKING della musica: scende di `depth` (0..1) quasi subito e risale dopo `ms`. Solo per eventi importanti (VIA, gol,
   * eliminazione, match point, vincitore, abilita' forte): non deve sembrare una radio che si abbassa ogni due secondi.
   */
  duck(depth = 0.45, ms = 650): void {
    const ctx = this.ctx;
    if (!ctx || !this.duckNode) return;
    const now = performance.now();
    // un ducking gia' in corso non si "riapre" piu' piano: si tiene il piu' profondo e si allunga la coda
    if (now < this.duckUntil) {
      this.duckDepth = Math.max(this.duckDepth, depth);
      this.duckUntil = Math.max(this.duckUntil, now + ms);
    } else {
      this.duckDepth = depth;
      this.duckUntil = now + ms;
    }
    const g = this.duckNode.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(1 - this.duckDepth, t, 0.02);
    g.setTargetAtTime(1, t + (this.duckUntil - now) / 1000, 0.22);
  }

  /** Ingresso della musica (sotto al ducking): core/music.ts collega qui le sue tracce. */
  getMusicInput(): AudioNode | null {
    const ctx = this.ensure();
    return ctx ? (this.cats.music ?? null) : null;
  }

  /** Statistiche per il debug audio (?audio=1 / F3): volumi, voci attive, ducking, picco d'uscita, stato del contesto. */
  stats(): { state: string; master: number; music: number; sfx: number; muted: boolean; voices: Record<string, number>; dropped: number; duck: number; peak: number } {
    let peak = 0;
    if (this.analyser) {
      if (!this.peakBuf || this.peakBuf.length !== this.analyser.fftSize) this.peakBuf = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(this.peakBuf as unknown as Float32Array<ArrayBuffer>);
      for (let i = 0; i < this.peakBuf.length; i++) peak = Math.max(peak, Math.abs(this.peakBuf[i]));
    }
    return {
      state: this.getState(),
      master: this.settings.master,
      music: this.settings.music,
      sfx: this.settings.sfx,
      muted: this.settings.muted,
      voices: { ...this.voices },
      dropped: this.dropped,
      duck: this.duckNode ? Math.round((1 - this.duckNode.gain.value) * 100) / 100 : 0,
      peak: Math.round(peak * 1000) / 1000
    };
  }

  /**
   * Da chiamare DENTRO un gesto dell'utente (tap/click/tasto) per sbloccare l'audio (policy dei browser, iOS compreso):
   * crea/riprende il contesto e suona un buffer vuoto (su iOS serve una riproduzione reale nel gesto).
   * true = il contesto e' gia' attivo (il passaggio a 'running' puo' completarsi subito dopo: si controlla con getState()).
   */
  unlock(): boolean {
    const ctx = this.ensure();
    if (!ctx) return false;
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignora errori audio */
    }
    return ctx.state === 'running';
  }

  /** Stato del contesto SENZA crearlo: 'none' se nessun suono e' mai stato richiesto, altrimenti suspended / running / closed. */
  getState(): 'none' | AudioContextState {
    return this.ctx ? this.ctx.state : 'none';
  }

  /** Accesso al contesto condiviso (per suoni continui gestiti altrove, es. motore kart). */
  getContext(): AudioContext | null {
    return this.ensure();
  }

  /** Nodo di uscita di una categoria (i suoni continui si collegano qui, non a ctx.destination). */
  getOutput(cat: Bus = 'sfx'): AudioNode | null {
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
        this.showToast(this.toggleMute() ? '🔇 AUDIO OFF (M)' : `🔊 AUDIO ON · ${Math.round(this.settings.master * 100)}%`);
      } else if (e.key === '[' || e.key === ']') {
        this.settings.muted = false;
        this.setVolume('master', this.settings.master + (e.key === ']' ? 0.1 : -0.1));
        this.showToast(`🔊 VOLUME ${Math.round(this.settings.master * 100)}%`);
      }
    });
  }

  showToast(text: string): void {
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

  /** Uscita con panning opzionale (-1 sinistra .. +1 destra): spazializzazione semplice, nessun HRTF. */
  private outWithPan(ctx: AudioContext, out: AudioNode, pan: number | undefined): AudioNode {
    if (pan === undefined || Math.abs(pan) < 0.02 || typeof ctx.createStereoPanner !== 'function') return out;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(out);
    return p;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, cat: Bus = 'sfx', pan?: number, force = false): void {
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
    if (!this.claim(cat, force)) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.outWithPan(ctx, out, pan));
      osc.onended = () => this.release(cat);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      this.release(cat);
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

  /** Scatto / dash: fruscio d'aria corto + blip che sale (non piu' un "bip" seghettato uguale ovunque). */
  boost(pan?: number): void {
    this.noiseBurst(0.16, 900, 3200, 0.06, 0, 0.8, pan);
    this.sweep('triangle', 330, 880, 0.12, 0.05, 0, pan);
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

  /** Oscillatore con glissando esponenziale da f0 a f1: base di whoosh, colpi e pop. */
  private sweep(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, when = 0, pan?: number, cat: Bus = 'sfx', force = false): void {
    const ctx = this.ensure();
    const out = ctx ? this.cats[cat] : null;
    if (!ctx || !out) return;
    if (!this.claim(cat, force)) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, f0), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.outWithPan(ctx, out, pan));
      o.onended = () => this.release(cat);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      this.release(cat);
    }
  }

  /** Rumore filtrato (passa-banda che scivola da f0 a f1): fruscii e schiocchi. Buffer di rumore condiviso. */
  private noiseBurst(dur: number, f0: number, f1: number, gain: number, when = 0, q = 1.2, pan?: number, cat: Bus = 'sfx', force = false): void {
    const ctx = this.ensure();
    const out = ctx ? this.cats[cat] : null;
    if (!ctx || !out) return;
    if (!this.claim(cat, force)) return;
    try {
      if (!this.noiseBuf || this.noiseBuf.sampleRate !== ctx.sampleRate) {
        const len = Math.floor(ctx.sampleRate * 0.5);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      }
      const t = ctx.currentTime + when;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.outWithPan(ctx, out, pan));
      src.onended = () => this.release(cat);
      src.start(t);
      src.stop(t + Math.min(dur + 0.02, 0.5));
    } catch {
      this.release(cat);
    }
  }

  /** Lancio di una palla: fruscio d'aria che sale. `power` 0.6..1.4 (tiro potenziato = piu' acuto e lungo). */
  throwWhoosh(power = 1, pan?: number): void {
    this.noiseBurst(Math.min(0.5, 0.16 + 0.06 * power), 500 * power, 2400 * power, 0.07 * power, 0, 0.9, pan);
    this.sweep('triangle', 240 * power, 520 * power, 0.09, 0.04, 0, pan);
  }

  /** Presa di una palla/oggetto: pop asciutto. */
  pickupPop(pan?: number): void {
    this.sweep('sine', 380, 760, 0.09, 0.08, 0, pan);
    this.tone(1140, 0.05, 'triangle', 0.035, 0.04, 'sfx', pan);
  }

  /** Rimbalzo contro una parete: colpo sordo corto (non il tick dell'interfaccia). */
  bounce(power = 1, pan?: number): void {
    this.sweep('sine', 230 + power * 40, 90, 0.11, 0.07 * Math.min(1.3, power), 0, pan);
  }

  /** Colpo pesante (eliminazione, spinta forte): botto grave + schiocco + sfregamento di rumore. `power` 0.6..1.5. */
  thump(power = 1, pan?: number): void {
    this.sweep('sine', 190, 48, 0.24, 0.16 * Math.min(1.4, power), 0, pan);
    this.sweep('square', 320, 90, 0.09, 0.06 * power, 0, pan);
    this.noiseBurst(0.14, 1800, 300, 0.09 * power, 0, 0.7, pan);
  }

  /** Caduta nel vuoto (arena): fischio discendente + soffio d'aria. */
  fall(pan?: number): void {
    this.sweep('sine', 880, 130, 0.7, 0.07, 0, pan, 'sfx', true);
    this.sweep('triangle', 660, 100, 0.6, 0.03, 0.05, pan);
    this.noiseBurst(0.45, 1600, 240, 0.04, 0, 0.8, pan);
  }

  /** Fischio d'arbitro (calcio): due note vibranti. `long` = fischio lungo (fine partita). */
  whistle(long = false): void {
    const d = long ? 0.75 : 0.32;
    this.sweep('sine', 2600, 2450, d, 0.05);
    this.sweep('sine', 2810, 2660, d, 0.04);
    this.noiseBurst(Math.min(0.5, d), 3200, 2900, 0.018, 0, 6);
  }

  /** Gol: boato di folla (rumore che gonfia e scende) + fanfara + colpo di tamburo. */
  goalRoar(): void {
    this.noiseBurst(0.5, 700, 260, 0.14, 0, 0.5);
    this.noiseBurst(0.5, 600, 240, 0.1, 0.4, 0.5);
    this.sweep('sine', 150, 55, 0.35, 0.18);
    [392, 523, 659, 784].forEach((fr, i) => this.tone(fr, 0.32, 'triangle', 0.09, 0.05 + i * 0.09, 'ui'));
  }

  /**
   * Calcio/tocco di pallone. `power` 0.5..1.5: il PASSAGGIO (debole) e' un "tok" corto e chiaro, il TIRO (forte) ha in piu'
   * lo schiocco secco e il fruscio della palla che parte: due suoni riconoscibili a occhi chiusi.
   */
  kick(power = 1, pan?: number): void {
    const shot = power >= 1.1;
    this.sweep('sine', (shot ? 170 : 260) * power, shot ? 55 : 110, shot ? 0.16 : 0.08, 0.13 * Math.min(1.3, power), 0, pan);
    this.noiseBurst(0.05, 1500, 700, 0.06 * power, 0, 1.4, pan);
    if (shot) {
      this.noiseBurst(0.04, 4200, 2600, 0.07, 0, 2, pan); // schiocco
      this.noiseBurst(0.26, 600, 2400, 0.04, 0.03, 0.8, pan); // la palla che parte
    }
  }

  /** Tono libero (es. nota di una tile di memoria): freq Hz, dur secondi. */
  playTone(freq: number, dur = 0.18, type: OscillatorType = 'triangle', gain = 0.08): void {
    this.tone(freq, dur, type, gain);
  }

  /**
   * Nota della tile i (0..3) di MEMORIA DA UBRIACO, stile Simon: QUATTRO note fisse (Mi4, Si3, Sol3, Re3) che non cambiano mai
   * fra i round. `input` = la stessa nota quando la premi tu, con un'armonica in piu' (piu' brillante, stessa altezza).
   */
  tileTone(index: number, input = false): void {
    const f = TILE_FREQS[index] ?? 440;
    this.tone(f, 0.22, 'triangle', 0.09);
    if (input) this.tone(f * 2, 0.12, 'sine', 0.025, 0.005);
  }

  /**
   * Memoria, fase TOCCA: tic NEUTRO per ogni tessera premuta, identico per tutte (nessuna altezza legata alla tessera): la TV
   * non rivela le scelte dei giocatori. Le note specifiche restano solo in OSSERVA.
   */
  memoryInputTick(): void {
    this.noiseBurst(0.025, 2600, 2200, 0.03, 0, 3, undefined, 'ui');
  }

  /** Errore inequivocabile (Memoria, risposta sbagliata): ronzio basso doppio, impossibile confonderlo con una nota. */
  error(): void {
    this.tone(110, 0.16, 'sawtooth', 0.07, 0, 'sfx', undefined, true);
    this.tone(104, 0.22, 'square', 0.05, 0.13, 'sfx', undefined, true);
  }

  // ==================================================================== GRAMMATICA COMUNE (tutto il party game)

  private chord(freqs: number[], dur: number, type: OscillatorType, gain: number, when = 0, cat: Bus = 'ui', force = false): void {
    for (const f of freqs) this.tone(f, dur, type, gain / Math.sqrt(freqs.length), when, cat, undefined, force);
  }

  /** 3 · 2 · 1: toni CRESCENTI (stessi in tutti i giochi), corti, sopra la musica. */
  countdown(n: number): void {
    const f = n >= 3 ? 440 : n === 2 ? 554 : 659;
    this.tone(f, 0.12, 'square', 0.05, 0, 'ui', undefined, true);
    this.tone(f * 2, 0.08, 'triangle', 0.025, 0, 'ui', undefined, true);
    this.duck(0.2, 220);
  }

  /** VIA: colpo forte ma breve (cassa + accordo stoppato + schiocco), la musica si fa da parte un attimo. */
  go(): void {
    this.sweep('sine', 160, 45, 0.22, 0.17, 0, undefined, 'ui', true);
    this.chord([880, 1109, 1319], 0.16, 'sawtooth', 0.09, 0, 'ui', true);
    this.noiseBurst(0.08, 5000, 2500, 0.05, 0, 1.5, undefined, 'ui', true);
    this.duck(0.5, 700);
  }

  /** Tick del RULLO: l'altezza segue la velocita' (0 lento .. 1 velocissimo). */
  rouletteTick(speed01: number): void {
    const k = Math.max(0, Math.min(1, speed01));
    this.tone(380 + k * 520, 0.04, 'square', 0.03 + k * 0.012, 0, 'ui');
  }

  /** Stop del rullo: CLUNK meccanico (cricchetto + botto). */
  rouletteClunk(): void {
    this.sweep('sine', 180, 42, 0.3, 0.17, 0, undefined, 'ui', true);
    this.noiseBurst(0.06, 2400, 900, 0.07, 0, 2, undefined, 'ui', true);
    this.noiseBurst(0.05, 1800, 700, 0.05, 0.07, 2, undefined, 'ui', true);
  }

  /**
   * STINGER del gioco (fine rullo, intro): 4-5 note col timbro e la scala del gioco, cosi' si riconosce a occhi chiusi.
   * `big` (giochi lunghi/spettacolari, es. Sparatoria e Kart): un colpo grave e un'ottava in piu' — piu' spettacolare, NON un
   * "jackpot" (le probabilita' del rullo non cambiano).
   */
  private lastSting = { id: '', at: 0 };

  /** true se lo stinger di quel gioco e' appena suonato (il rullo lo suona allo stop: l'intro non lo ripete). */
  recentSting(gameId: string, ms = 4000): boolean {
    return this.lastSting.id === gameId && performance.now() - this.lastSting.at < ms;
  }

  gameSting(gameId: string, big = false): void {
    this.lastSting = { id: gameId, at: performance.now() };
    const st = GAME_STINGS[gameId] ?? GAME_STINGS.default;
    st.notes.forEach((m, i) => {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      this.tone(f, st.len, st.wave, 0.075, i * st.step, 'ui', undefined, true);
      if (big) this.tone(f * 2, st.len * 0.8, 'triangle', 0.03, i * st.step + 0.01, 'ui', undefined, true);
    });
    if (big) this.sweep('sine', 140, 40, 0.45, 0.16, 0, undefined, 'ui', true);
    this.duck(0.35, 600);
  }

  /** RISULTATI dall'ultimo al primo: ultimo = piccolo "fail", intermedi = neutro, primo = sting del vincitore. */
  resultReveal(kind: 'last' | 'mid' | 'first'): void {
    if (kind === 'last') {
      this.sweep('triangle', 392, 262, 0.32, 0.07, 0, undefined, 'ui');
      this.sweep('triangle', 330, 220, 0.38, 0.05, 0.12, undefined, 'ui');
    } else if (kind === 'mid') {
      this.tone(587, 0.09, 'triangle', 0.055, 0, 'ui');
      this.tone(880, 0.07, 'sine', 0.03, 0.05, 'ui');
    } else {
      this.chord([523, 659, 784], 0.22, 'triangle', 0.1, 0, 'ui', true);
      this.chord([659, 784, 1047], 0.36, 'triangle', 0.11, 0.16, 'ui', true);
      this.sweep('sine', 130, 50, 0.3, 0.12, 0, undefined, 'ui', true);
      this.duck(0.45, 900);
    }
  }

  /**
   * TELECRONISTA (bus voice): stinger degli annunci importanti. Il testo resta dei giochi (core/announcer.ts); qui c'e' il
   * "colpo" sonoro, sempre con un ducking breve. Mai per micro-eventi.
   */
  announcer(event: AnnounceEvent): void {
    const v: Bus = 'voice';
    switch (event) {
      case 'VIA':
        this.go();
        return;
      case 'GOAL':
        this.sweep('sine', 140, 50, 0.3, 0.16, 0, undefined, v, true);
        this.chord([392, 494, 587, 784], 0.4, 'sawtooth', 0.08, 0.05, v, true);
        this.duck(0.6, 1200);
        return;
      case 'ELIMINATION':
        this.sweep('sawtooth', 520, 130, 0.3, 0.05, 0, undefined, v, true);
        this.sweep('sine', 120, 40, 0.25, 0.12, 0, undefined, v, true);
        this.duck(0.35, 450);
        return;
      case 'MATCH_POINT':
        for (let i = 0; i < 3; i++) {
          this.tone(880, 0.09, 'square', 0.05, i * 0.16, v, undefined, true);
          this.tone(1175, 0.09, 'square', 0.04, i * 0.16 + 0.08, v, undefined, true);
        }
        this.duck(0.4, 700);
        return;
      case 'NEW_LEADER':
        [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.07, i * 0.07, v, undefined, true));
        this.noiseBurst(0.3, 6000, 9000, 0.02, 0.25, 3, undefined, v, true);
        this.duck(0.3, 600);
        return;
      case 'WINNER':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.1, i * 0.12, v, undefined, true));
        this.chord([523, 659, 784, 1047], 0.9, 'sawtooth', 0.07, 0.5, v, true);
        this.sweep('sine', 120, 40, 0.5, 0.15, 0.5, undefined, v, true);
        this.duck(0.6, 1800);
        return;
      case 'LAST_ROUND':
      case 'FINAL_ROUND':
        for (let i = 0; i < 8; i++) this.noiseBurst(0.06, 1400, 900, 0.03 + i * 0.006, i * 0.06, 1.2, undefined, v, true); // rullante
        this.chord([196, 247, 294], 0.7, 'sawtooth', 0.08, 0.5, v, true);
        this.sweep('sine', 98, 49, 0.8, 0.13, 0.5, undefined, v, true);
        this.duck(0.5, 1500);
        return;
      case 'SUDDEN_DEATH':
        for (let i = 0; i < 3; i++) {
          this.sweep('sine', 70, 40, 0.18, 0.16, i * 0.42, undefined, v, true); // battito
          this.sweep('sine', 64, 38, 0.16, 0.12, i * 0.42 + 0.16, undefined, v, true);
        }
        this.chord([110, 131, 156], 1.2, 'sawtooth', 0.06, 1.2, v, true); // gong scuro
        this.duck(0.6, 2000);
        return;
    }
  }

  /** Suoni d'INTERFACCIA uniformi in tutto il gioco (lobby, pannello controller, pausa, conferme). */
  ui(kind: UiKind): void {
    switch (kind) {
      case 'focus':
        this.tone(1320, 0.03, 'sine', 0.03, 0, 'ui');
        return;
      case 'move':
        this.tone(660, 0.06, 'triangle', 0.05, 0, 'ui');
        return;
      case 'confirm':
        this.tone(660, 0.07, 'triangle', 0.06, 0, 'ui');
        this.tone(990, 0.1, 'triangle', 0.06, 0.06, 'ui');
        return;
      case 'cancel':
        this.tone(660, 0.07, 'triangle', 0.05, 0, 'ui');
        this.tone(440, 0.1, 'triangle', 0.05, 0.06, 'ui');
        return;
      case 'error':
        this.tone(160, 0.14, 'square', 0.05, 0, 'ui');
        this.tone(150, 0.16, 'square', 0.04, 0.12, 'ui');
        return;
      case 'lock':
        this.noiseBurst(0.03, 3000, 2000, 0.04, 0, 3, undefined, 'ui');
        this.tone(330, 0.08, 'sine', 0.06, 0.01, 'ui');
        return;
      case 'ready':
        this.chord([784, 988, 1175], 0.18, 'triangle', 0.07, 0, 'ui');
        return;
      case 'pair':
        this.noiseBurst(0.025, 4000, 3000, 0.04, 0, 3, undefined, 'ui');
        [523, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.06, 0.04 + i * 0.06, 'ui'));
        return;
      case 'disconnect':
        for (let i = 0; i < 2; i++) {
          this.tone(740, 0.09, 'square', 0.045, i * 0.2, 'ui', undefined, true);
          this.tone(523, 0.11, 'square', 0.045, i * 0.2 + 0.09, 'ui', undefined, true);
        }
        return;
      case 'reconnect':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.06, i * 0.06, 'ui', undefined, true));
        return;
    }
  }

  /**
   * IDENTITA' SONORA dei personaggi (nessuna voce): Goblin scatto aggressivo, Buttafuori impulso grave, Judoka colpo secco,
   * Dottore "lampadina", Ciro monetina + tic-tac. `soft` = versione piccola per le battute (testo) e i segnali minori.
   */
  characterSting(characterId: string | null | undefined, soft = false): void {
    const g = soft ? 0.45 : 1;
    switch (characterId) {
      case 'goblin':
        [0, 4, 7, 12].forEach((st, i) => this.tone(587 * Math.pow(2, st / 12), 0.06, 'square', 0.05 * g, i * 0.045, 'sfx'));
        if (!soft) this.noiseBurst(0.12, 1500, 5000, 0.04, 0, 0.9);
        return;
      case 'buttafuori':
        this.sweep('sine', 95, 38, soft ? 0.18 : 0.32, 0.17 * g, 0);
        this.sweep('sawtooth', 110, 70, 0.18, 0.04 * g, 0.01);
        return;
      case 'judoka':
        this.noiseBurst(0.03, 6000, 4500, 0.06 * g, 0, 3);
        this.tone(1047, 0.07, 'square', 0.05 * g, 0.015);
        if (!soft) this.tone(1568, 0.09, 'square', 0.04, 0.08);
        return;
      case 'dottore':
        this.tone(1319, soft ? 0.25 : 0.5, 'sine', 0.06 * g, 0);
        this.tone(1976, soft ? 0.2 : 0.4, 'sine', 0.03 * g, 0.01);
        if (!soft) [2637, 3136, 3951].forEach((f, i) => this.tone(f, 0.08, 'sine', 0.015, 0.12 + i * 0.05));
        return;
      case 'ciro':
        this.tone(1976, 0.06, 'triangle', 0.05 * g, 0);
        this.tone(2637, soft ? 0.14 : 0.24, 'triangle', 0.05 * g, 0.05);
        if (!soft) for (let i = 0; i < 3; i++) this.noiseBurst(0.02, 3500, 3000, 0.035, 0.22 + i * 0.14, 4); // tic-tac
        return;
      default:
        this.tone(880, 0.08, 'triangle', 0.05 * g);
    }
  }

  // ==================================================================== SFX SPECIFICI DEI GIOCHI

  /** Arena: avviso di bordo (discreto, doppio bip basso). */
  edgeWarn(pan?: number): void {
    this.tone(330, 0.06, 'square', 0.025, 0, 'sfx', pan);
    this.tone(294, 0.08, 'square', 0.025, 0.08, 'sfx', pan);
  }

  /** Dodgeball: schivata (fruscio rapido piu' acuto dello scatto). */
  dodge(pan?: number): void {
    this.noiseBurst(0.12, 2400, 6000, 0.05, 0, 1.2, pan);
    this.sweep('sine', 900, 1500, 0.07, 0.03, 0, pan);
  }

  /** Calcio: contrasto (corpo contro corpo + strisciata). */
  tackle(pan?: number): void {
    this.sweep('sine', 150, 60, 0.14, 0.12, 0, pan);
    this.noiseBurst(0.18, 900, 300, 0.06, 0.02, 0.8, pan);
  }

  /** Calcio: la palla entra in rete (fruscio della rete + colpo) — il primo colpo della sequenza del gol. */
  goalNet(pan?: number): void {
    this.noiseBurst(0.35, 1200, 400, 0.09, 0, 0.6, pan, 'sfx', true);
    this.sweep('sine', 120, 45, 0.25, 0.14, 0, pan, 'sfx', true);
  }

  private crowd: { src: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;

  /** Letto di FOLLA leggerissimo (calcio): rumore filtrato in loop sul bus ambience. */
  startCrowd(level = 1): void {
    const ctx = this.ensure();
    const out = this.cats.ambience;
    if (!ctx || !out || this.crowd) return;
    try {
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; // rumore "marrone": mormorio, non fruscio
        d[i] = last * 6;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 520;
      lp.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(0.05 * level, ctx.currentTime, 0.8);
      // onda lenta: la folla "respira" (niente loop riconoscibile)
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.012 * level;
      lfo.connect(lfoG);
      lfoG.connect(gain.gain);
      src.connect(lp);
      lp.connect(gain);
      gain.connect(out);
      src.start();
      lfo.start();
      this.crowd = { src, gain, lfo };
    } catch {
      /* ignora */
    }
  }

  /** Boato della folla (gol, punto): il letto si gonfia e torna giu'. */
  crowdSwell(amount = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.crowd) return;
    const g = this.crowd.gain.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.05 + 0.13 * amount, t, 0.08);
    g.setTargetAtTime(0.05, t + 1.4, 0.6);
  }

  stopCrowd(): void {
    const ctx = this.ctx;
    if (!ctx || !this.crowd) return;
    const { src, gain, lfo } = this.crowd;
    this.crowd = null;
    try {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      src.stop(ctx.currentTime + 1);
      lfo.stop(ctx.currentTime + 1);
      src.onended = () => {
        try {
          gain.disconnect();
        } catch {
          /* ignora */
        }
      };
    } catch {
      /* ignora */
    }
  }

  /** Pallavolo: battuta (colpo di mano + aria). */
  serve(pan?: number): void {
    this.sweep('sine', 420, 160, 0.08, 0.1, 0, pan);
    this.noiseBurst(0.18, 800, 2600, 0.04, 0.02, 0.8, pan);
  }

  /** Pallavolo: ricezione/palleggio (pom morbido). */
  bump(pan?: number): void {
    this.sweep('sine', 330, 180, 0.09, 0.09, 0, pan);
  }

  /** Pallavolo: SMASH = transiente forte + fruscio d'aria + impatto. */
  smash(pan?: number): void {
    this.noiseBurst(0.035, 5000, 3200, 0.1, 0, 2.5, pan, 'sfx', true); // schiaffo
    this.sweep('sine', 260, 70, 0.18, 0.15, 0, pan, 'sfx', true); // impatto
    this.noiseBurst(0.3, 700, 3600, 0.05, 0.03, 0.7, pan); // aria
  }

  /** Pallavolo: atterraggio sulla sabbia (pff sordo). */
  sand(pan?: number): void {
    this.noiseBurst(0.12, 500, 180, 0.04, 0, 0.6, pan);
  }

  /** Punto (pallavolo): stinger corto, non la fanfara (quella resta per la fine partita). */
  pointSting(): void {
    this.chord([659, 784, 988], 0.2, 'triangle', 0.08, 0, 'ui', true);
    this.tone(1319, 0.16, 'triangle', 0.04, 0.1, 'ui', undefined, true);
  }

  /** Kart: urto (piccolo = colpetto, grosso = botta metallica). `power` 0..1. */
  kartBump(power: number): void {
    const k = Math.max(0.2, Math.min(1, power));
    this.sweep('sine', 160, 60, 0.12 + 0.1 * k, 0.06 + 0.1 * k);
    if (k > 0.6) this.noiseBurst(0.12, 2600, 900, 0.06 * k, 0, 1.6);
  }

  /** Kart: traguardo (il primo ha la fanfara; gli altri un arrivo pulito). */
  kartFinish(first: boolean): void {
    if (first) this.announcer('WINNER');
    else {
      this.chord([523, 784], 0.2, 'triangle', 0.07, 0, 'ui');
      this.tone(1047, 0.18, 'triangle', 0.05, 0.12, 'ui');
    }
  }

  /** Botta al Volo: VIA (attacco brillante + corpo). */
  reactionGo(): void {
    this.reactionAttack();
    this.chord([659, 988, 1319], 0.3, 'sawtooth', 0.09, 0.03, 'ui', true);
    this.duck(0.6, 600);
  }

  /**
   * Botta al Volo: FALSO ALLARME. Ha lo STESSO attacco del VIA (sentito senza guardare inganna quanto il lampo verde): solo
   * il corpo del suono manca. Cosi' l'audio non da' un modo facile per distinguerlo a orecchio prima di aver reagito.
   */
  reactionFake(): void {
    this.reactionAttack();
  }

  private reactionAttack(): void {
    this.noiseBurst(0.04, 6000, 4000, 0.07, 0, 2, undefined, 'ui', true);
    this.tone(1319, 0.05, 'square', 0.05, 0, 'ui', undefined, true);
  }

  /** Botta al Volo: falsa partenza (bonk breve). */
  falseStart(): void {
    this.sweep('square', 220, 90, 0.16, 0.06);
  }

  /** Quiz: entra la domanda (stile game show). */
  quizQuestion(): void {
    this.sweep('sine', 110, 55, 0.2, 0.12, 0, undefined, 'ui');
    this.chord([523, 659, 784], 0.25, 'square', 0.05, 0.05, 'ui');
  }

  /** Quiz: ultimi secondi (tic piu' urgente). */
  quizTick(urgent: boolean): void {
    this.tone(urgent ? 1046 : 784, 0.04, 'square', urgent ? 0.04 : 0.025, 0, 'ui');
  }

  /** Quiz: rivelazione della risposta. */
  quizReveal(): void {
    for (let i = 0; i < 6; i++) this.noiseBurst(0.04, 1600, 1100, 0.02 + i * 0.006, i * 0.04, 1.2, undefined, 'ui');
    this.chord([784, 988, 1175], 0.3, 'triangle', 0.08, 0.26, 'ui', true);
  }

  /** Cultura: entra la domanda (bar/lounge: due accordi morbidi, diverso dal Quiz). */
  culturaQuestion(): void {
    this.chord([220, 277, 330, 415], 0.6, 'sine', 0.07, 0, 'ui');
    this.chord([247, 294, 370, 440], 0.7, 'sine', 0.06, 0.32, 'ui');
  }

  /** Cultura: una CAZZATA rivelata (pernacchia breve col vibrato). `ciro` = quella di Ciro: in piu' la monetina. */
  bluffReveal(ciro = false): void {
    const ctx = this.ensure();
    const out = this.cats.ui;
    if (ctx && out && this.claim('ui')) {
      try {
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(240, t);
        o.frequency.exponentialRampToValueAtTime(140, t + 0.4);
        lfo.frequency.value = 22;
        lg.gain.value = 18;
        lfo.connect(lg);
        lg.connect(o.frequency);
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        o.connect(g);
        g.connect(out);
        o.onended = () => this.release('ui');
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.44);
        lfo.stop(t + 0.44);
      } catch {
        this.release('ui');
      }
    }
    if (ciro) this.characterSting('ciro', true);
  }

  /** Cultura: risposta corretta rivelata (stinger piu' importante). */
  culturaCorrect(): void {
    this.chord([523, 659, 784, 1047], 0.5, 'triangle', 0.1, 0, 'ui', true);
    this.noiseBurst(0.4, 6000, 9000, 0.02, 0.1, 3, undefined, 'ui');
    this.duck(0.35, 700);
  }

  /** Cultura: il SECCHIONE (campanella) / l'AVVOCATO (martelletto due colpi). */
  culturaRole(role: 'secchione' | 'avvocato'): void {
    if (role === 'secchione') {
      this.tone(1568, 0.5, 'sine', 0.06, 0, 'ui');
      this.tone(2349, 0.4, 'sine', 0.03, 0.01, 'ui');
    } else {
      this.sweep('sine', 200, 90, 0.08, 0.13, 0, undefined, 'ui');
      this.sweep('sine', 200, 90, 0.08, 0.13, 0.16, undefined, 'ui');
    }
  }
}

export type UiKind = 'focus' | 'move' | 'confirm' | 'cancel' | 'error' | 'lock' | 'ready' | 'pair' | 'disconnect' | 'reconnect';
export type AnnounceEvent = 'VIA' | 'LAST_ROUND' | 'MATCH_POINT' | 'GOAL' | 'ELIMINATION' | 'NEW_LEADER' | 'WINNER' | 'SUDDEN_DEATH' | 'FINAL_ROUND';

/** Note delle 4 tessere di Memoria (Hz): FISSE, uguali in osservazione e in risposta, in ogni round. */
export const TILE_FREQS = [329.63, 246.94, 196.0, 146.83];

/** Stinger dei giochi (note MIDI, passo, durata, timbro): la "sigla" di ogni minigioco, coerente col suo tema musicale. */
const GAME_STINGS: Record<string, { notes: number[]; step: number; len: number; wave: OscillatorType }> = {
  arena: { notes: [45, 52, 57, 60, 64], step: 0.08, len: 0.18, wave: 'sawtooth' },
  dodgeball: { notes: [62, 66, 69, 74], step: 0.06, len: 0.12, wave: 'square' },
  soccer: { notes: [60, 64, 67, 72, 76], step: 0.09, len: 0.2, wave: 'triangle' },
  volleyball: { notes: [67, 71, 74, 79], step: 0.08, len: 0.18, wave: 'triangle' },
  kart3d: { notes: [55, 62, 67, 74, 79], step: 0.07, len: 0.16, wave: 'sawtooth' },
  cornicione: { notes: [52, 59, 64, 71, 76], step: 0.07, len: 0.15, wave: 'sawtooth' },
  fps: { notes: [50, 53, 57, 62], step: 0.1, len: 0.22, wave: 'square' },
  memory: { notes: [64, 59, 55, 50], step: 0.13, len: 0.22, wave: 'triangle' },
  reaction: { notes: [72, 72, 79], step: 0.11, len: 0.1, wave: 'square' },
  quiz: { notes: [60, 67, 72, 76, 79], step: 0.08, len: 0.2, wave: 'square' },
  cultura: { notes: [57, 61, 64, 68], step: 0.14, len: 0.4, wave: 'sine' },
  default: { notes: [60, 64, 67, 72], step: 0.1, len: 0.18, wave: 'triangle' }
};

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
    // 5 motori insieme non sono 5 volte piu' forti (ne' devono coprire stinger e annunci): quota per motore ~ n^-0.75
    const share = 1 / Math.pow(Math.max(1, activeEngines), 0.75);
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
