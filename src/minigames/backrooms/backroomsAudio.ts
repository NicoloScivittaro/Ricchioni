import { audio } from '../../core/AudioManager';
import { lineOfSight, cellAt } from './maze';
import { splitScreenLayout } from '../kart-race/cameraHud';
import type { BackroomsMatch, BackEvent } from './backroomsRules';

/** One TV mix through the existing global buses; two sustained fluorescent voices. */
export class BackroomsAudio {
  private ctx: AudioContext | null = null; private hum: OscillatorNode[] = []; private humGain: GainNode | null = null;
  private voices = new Set<AudioScheduledSourceNode>(); private nodes = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private noise: AudioBuffer | null = null; private disposed = false; private quiet = false; private lastAmbient = 0;
  private unlockButton: HTMLButtonElement | null = null; private listening = false; private retryAt = 0;
  private onGesture = () => { if (audio.getState() !== 'running') audio.unlock(); this.start(); };
  private onState = () => this.showUnlock();
  private showUnlock(): void {
    const blocked = !this.disposed && !!this.ctx && this.ctx.state !== 'running';
    if (!blocked) { this.unlockButton?.remove(); this.unlockButton = null; return; }
    if (this.unlockButton) return;
    const b = document.createElement('button'); b.id = 'backrooms-audio-unlock';
    b.textContent = 'ATTIVA AUDIO · CLICCA QUI O PREMI UN TASTO SULLA TV';
    b.style.cssText = 'position:fixed;top:7px;left:50%;transform:translateX(-50%);z-index:20003;background:#262c20;color:#e5e7b8;border:1px solid #899169;border-radius:5px;padding:9px;font:12px monospace;cursor:pointer';
    b.addEventListener('pointerdown', this.onGesture); document.body.appendChild(b); this.unlockButton = b;
  }
  start(): void {
    if (this.disposed) return;
    if (!this.listening) { window.addEventListener('pointerdown', this.onGesture, true); window.addEventListener('keydown', this.onGesture, true); this.listening = true; }
    if (this.hum.length) { this.showUnlock(); return; }
    this.ctx = audio.getContext(); const output = audio.getOutput('ambience'); if (!this.ctx || !output) return;
    const c = this.ctx; c.addEventListener('statechange', this.onState);
    this.humGain = c.createGain(); this.humGain.gain.value = this.quiet ? 0 : .06; this.humGain.connect(output);
    // TV speakers reproduce these harmonics; the old 50 Hz-only bed was effectively inaudible.
    for (const hz of [120, 241]) {
      const o = c.createOscillator(), filter = c.createBiquadFilter(); o.type = hz === 120 ? 'triangle' : 'sine'; o.frequency.value = hz;
      filter.type = 'lowpass'; filter.frequency.value = 650; o.connect(filter); filter.connect(this.humGain); o.onended = () => filter.disconnect(); o.start(); this.hum.push(o);
    }
    this.noise = c.createBuffer(1, c.sampleRate / 2, c.sampleRate); const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.showUnlock();
  }
  setPaused(on: boolean): void {
    this.quiet = on;
    if (this.ctx && this.humGain) this.humGain.gain.setTargetAtTime(on ? 0 : .06, this.ctx.currentTime, .05);
    if (on) this.stopVoices(); else { audio.unlock(); this.showUnlock(); }
  }
  private voice(freq: number, duration: number, gain: number, pan: number, noise = false, endFreq?: number, critical = false): void {
    const c = this.ctx, output = audio.getOutput('sfx'); if (!c || !output || this.disposed || this.quiet || c.state !== 'running') return;
    if (this.voices.size >= 12) { if (!critical) return; const oldest = this.voices.values().next().value; if (oldest) { try { oldest.stop(); } catch { /* ended */ } oldest.disconnect(); this.nodes.get(oldest)?.forEach(n => n.disconnect()); this.nodes.delete(oldest); this.voices.delete(oldest); } }
    const source = noise ? c.createBufferSource() : c.createOscillator(), filter = c.createBiquadFilter(), envelope = c.createGain(), stereo = c.createStereoPanner();
    filter.type = 'lowpass'; filter.frequency.value = noise ? freq : 2500;
    if (source instanceof OscillatorNode) { source.type = 'sine'; source.frequency.setValueAtTime(freq, c.currentTime); if (endFreq) source.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + duration); }
    else { source.buffer = this.noise; source.loop = true; }
    const now = c.currentTime; envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(gain, now + .009); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    stereo.pan.value = Math.max(-1, Math.min(1, pan)); source.connect(filter); filter.connect(envelope); envelope.connect(stereo); stereo.connect(output);
    this.voices.add(source); this.nodes.set(source, [filter, envelope, stereo]);
    source.onended = () => { source.disconnect(); this.nodes.get(source)?.forEach(n => n.disconnect()); this.nodes.delete(source); this.voices.delete(source); };
    source.start(); source.stop(now + duration);
  }
  event(event: BackEvent, match: BackroomsMatch): void {
    const listeners = match.players.filter(p => p.state === 'exploring' || p.id === event.player);
    const listener = listeners.sort((a, b) => Math.hypot(a.x - event.point.x, a.z - event.point.z) - Math.hypot(b.x - event.point.x, b.z - event.point.z))[0]; if (!listener) return;
    const distance = Math.hypot(listener.x - event.point.x, listener.z - event.point.z), i = match.players.indexOf(listener);
    const bearing = Math.atan2(event.point.x - listener.x, event.point.z - listener.z) - listener.yaw;
    const rect = splitScreenLayout(match.players.length)[i];
    const viewportPan = (rect.x + rect.w / 2 - .5) * .8, pan = viewportPan + Math.sin(bearing) * .45;
    const attenuation = Math.max(0, 1 - distance / 22) * (lineOfSight(match.maze, listener, event.point) ? 1 : .3);
    if (event.type === 'capture') { this.voice(180, .6, .22, viewportPan, false, 45, true); this.voice(2300, .45, .2, viewportPan, true, undefined, true); this.voice(620, .4, .12, viewportPan, false, 90, true); }
    else if (event.type === 'escape') { this.voice(220, .8, .05, viewportPan, false, 880, true); this.voice(1800, .35, .025, viewportPan, true, undefined, true); }
    else if (event.type === 'monsterStep') { this.voice(event.kind === 'runner' ? 145 : event.kind === 'imitator' ? 230 : 105, .2, .11 * attenuation, pan, false, 65); this.voice(1100, .12, .09 * attenuation, pan, true); }
    else if (event.type === 'step') { this.voice(1050, .11, .16 * attenuation * (event.power ?? 1), pan, true); this.voice(175, .1, .045 * attenuation, pan, false, 95); }
    else if (event.type === 'door') this.voice(330, .45, .12 * attenuation, pan, false, 100);
    else if (event.type === 'reveal') this.voice(90, .4, .08 * attenuation, pan, false, 30);
    else if (event.type === 'generator') { this.voice(150 + (event.power ?? 0) * 90, .25, .09 * Math.max(.3, attenuation), pan); this.voice(1700, .12, .055 * attenuation, pan, true); }
    else if (event.type === 'task') { this.voice(430, .3, .13 * Math.max(.45, attenuation), pan, false, 180); }
    else this.voice(880, .18, .08 * Math.max(.4, attenuation), pan);
  }
  update(match: BackroomsMatch): void {
    this.start(); if (!this.ctx || !this.humGain || this.quiet) return;
    if (this.ctx.state !== 'running') {
      if (performance.now() > this.retryAt) { this.retryAt = performance.now() + 2000; audio.unlock(); this.showUnlock(); }
      return;
    }
    const c = this.ctx, listeners = match.players.filter(p => p.state === 'exploring');
    const danger = Math.max(0, ...listeners.flatMap(p => match.monsters.map(m => {
      const d = Math.hypot(m.x - p.x, m.z - p.z), audible = lineOfSight(match.maze, p, m) ? 1 : .35;
      return Math.max(0, 1 - d / 12) * audible * (m.state === 'chase' ? 1 : .45);
    })));
    const room = listeners.length ? listeners.reduce((n, p) => n + cellAt(match.maze, p) % 7, 0) / listeners.length : 0;
    const silence = match.time % 29 > 26 && danger < .15;
    this.humGain.gain.setTargetAtTime(silence ? .0001 : .055 + Math.sin(match.time * 1.4) * .005 + danger * (.055 + Math.sin(match.time * 8) * .015), c.currentTime, .12);
    this.hum[0].frequency.setTargetAtTime(116 + room * 1.3 + danger * 25, c.currentTime, .3);
    this.hum[1].frequency.setTargetAtTime(239 + room * 1.8 + danger * 17, c.currentTime, .3);
    if (match.time - this.lastAmbient > (danger > .3 ? 2.4 : 9)) {
      this.lastAmbient = match.time;
      if (listeners.length && !silence) {
        const pan = Math.sin(match.time * .73);
        this.voice(danger > .3 ? 310 : 490, .6, danger > .3 ? .07 : .045, pan, false, 110);
        this.voice(1800, .32, danger > .3 ? .065 : .04, pan, true);
      }
    }
  }

  private stopVoices(): void { for (const source of this.voices) { try { source.stop(); } catch { /* already ended */ } source.disconnect(); this.nodes.get(source)?.forEach(n => n.disconnect()); } this.voices.clear(); this.nodes.clear(); }
  dispose(): void { if (this.disposed) return; this.disposed = true; window.removeEventListener('pointerdown', this.onGesture, true); window.removeEventListener('keydown', this.onGesture, true); this.ctx?.removeEventListener('statechange', this.onState); this.unlockButton?.remove(); this.unlockButton = null; this.stopVoices(); this.hum.forEach(o => { o.stop(); o.disconnect(); }); this.hum = []; this.humGain?.disconnect(); this.humGain = null; this.noise = null; }
}
