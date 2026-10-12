import { audio } from '../../core/AudioManager';
import { lineOfSight } from './maze';
import { splitScreenLayout } from '../kart-race/cameraHud';
import type { BackroomsMatch, BackEvent } from './backroomsRules';

/** Shared mixer, capped transient voices and exactly two sustained hum oscillators. */
export class BackroomsAudio {
  private ctx: AudioContext | null = null; private hum: OscillatorNode[] = []; private humGain: GainNode | null = null;
  private voices = new Set<AudioScheduledSourceNode>(); private nodes = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private noise: AudioBuffer | null = null; private disposed = false; private quiet = false; private lastAmbient = 0;
  start(): void {
    if (this.disposed || this.hum.length) return; this.ctx = audio.getContext(); const output = audio.getOutput('ambience'); if (!this.ctx || !output) return;
    const c = this.ctx; this.humGain = c.createGain(); this.humGain.gain.value = .025; this.humGain.connect(output);
    for (const hz of [50, 100.5]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.connect(this.humGain); o.start(); this.hum.push(o); }
    this.noise = c.createBuffer(1, c.sampleRate / 2, c.sampleRate); const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  setPaused(on: boolean): void { this.quiet = on; if (this.ctx && this.humGain) this.humGain.gain.setTargetAtTime(on ? 0 : .025, this.ctx.currentTime, .05); if (on) this.stopVoices(); }
  private voice(freq: number, duration: number, gain: number, pan: number, noise = false, endFreq?: number): void {
    const c = this.ctx, output = audio.getOutput('sfx'); if (!c || !output || this.disposed || this.quiet || this.voices.size >= 12) return;
    const source = noise ? c.createBufferSource() : c.createOscillator(), filter = c.createBiquadFilter(), envelope = c.createGain(), stereo = c.createStereoPanner();
    filter.type = 'lowpass'; filter.frequency.value = noise ? freq : 2500;
    if (source instanceof OscillatorNode) { source.type = 'sine'; source.frequency.setValueAtTime(freq, c.currentTime); if (endFreq) source.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + duration); }
    else source.buffer = this.noise;
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
    if (event.type === 'capture') { this.voice(60, .5, .12, viewportPan, false, 22); this.voice(1600, .38, .07, viewportPan, true); this.voice(420, .28, .05, viewportPan, false, 70); }
    else if (event.type === 'escape') { this.voice(220, .8, .05, viewportPan, false, 880); this.voice(1800, .35, .025, viewportPan, true); }
    else if (event.type === 'monsterStep') { this.voice(event.kind === 'runner' ? 65 : 42, .15, .08 * attenuation, pan); this.voice(550, .1, .028 * attenuation, pan, true); }
    else if (event.type === 'step') this.voice(800, .065, .035 * attenuation * (event.power ?? 1), pan, true);
    else if (event.type === 'door') this.voice(190, .45, .045 * attenuation, pan, false, 70);
    else if (event.type === 'reveal') this.voice(90, .4, .08 * attenuation, pan, false, 30);
    else this.voice(880, .12, .025 * attenuation, pan);
  }
  update(match: BackroomsMatch): void {
    if (!this.ctx || !this.humGain || this.quiet) return;
    const silence = match.time % 29 > 25; this.humGain.gain.setTargetAtTime(silence ? .001 : .018 + Math.sin(match.time * 1.4) * .004, this.ctx.currentTime, .2);
    if (match.time - this.lastAmbient > 12) { this.lastAmbient = match.time; const p = match.players.find(p => p.state === 'exploring'); if (p && !silence) this.voice(120, .35, .012, Math.sin(match.time * .13), false, 85); }
  }
  private stopVoices(): void { for (const source of this.voices) { try { source.stop(); } catch { /* already ended */ } source.disconnect(); this.nodes.get(source)?.forEach(n => n.disconnect()); } this.voices.clear(); this.nodes.clear(); }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.stopVoices(); this.hum.forEach(o => { o.stop(); o.disconnect(); }); this.hum = []; this.humGain?.disconnect(); this.humGain = null; this.noise = null; }
}
