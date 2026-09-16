/**
 * Manages all game sound effects.
 * Generates retro-style sounds programmatically using Web Audio API.
 */
export class SoundManager {

  constructor(scene) {
    this.scene = scene;
    this.ctx = null;
    this.sounds = {};
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;

    // Initialize on first user interaction (browser autoplay policy)
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not available');
    }
  }

  play(soundId) {
    if (!this.initialized) this.init();
    if (!this.ctx || this.muted) return;

    switch (soundId) {
      case 'countdown': this.playCountdownBeep(); break;
      case 'go': this.playGoBeep(); break;
      case 'pickup': this.playPickup(); break;
      case 'wallHit': this.playWallHit(); break;
      case 'lapComplete': this.playLapComplete(); break;
      case 'raceFinish': this.playRaceFinish(); break;
      case 'powerup_nitro': this.playNitro(); break;
      case 'powerup_oil': this.playOilDrop(); break;
      case 'powerup_shield': this.playShield(); break;
      case 'powerup_missile': this.playMissile(); break;
      case 'powerup_tacks': this.playTacks(); break;
      case 'select': this.playSelect(); break;
    }
  }

  // Engine sound — continuous loop with pitch tied to speed
  startEngine() {
    if (!this.initialized) this.init();
    if (!this.ctx || this.engineOsc) return;

    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(60, this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  updateEngineSound(speed) {
    if (!this.engineOsc || !this.ctx) return;
    const freq = 60 + Math.abs(speed) * 0.8;
    this.engineOsc.frequency.setValueAtTime(Math.min(freq, 300), this.ctx.currentTime);
    const vol = 0.03 + Math.abs(speed) / 5000;
    this.engineGain.gain.setValueAtTime(Math.min(vol, 0.1), this.ctx.currentTime);
  }

  stopEngine() {
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // Sound generators
  playTone(freq, duration, type = 'square', volume = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playNoise(duration, volume = 0.1) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }

  playCountdownBeep() {
    this.playTone(440, 0.15, 'square', 0.15);
  }

  playGoBeep() {
    this.playTone(880, 0.3, 'square', 0.2);
  }

  playPickup() {
    this.playTone(660, 0.05, 'square', 0.1);
    setTimeout(() => this.playTone(880, 0.1, 'square', 0.1), 50);
  }

  playWallHit() {
    this.playNoise(0.1, 0.15);
  }

  playLapComplete() {
    this.playTone(523, 0.1, 'square', 0.12);
    setTimeout(() => this.playTone(659, 0.1, 'square', 0.12), 100);
    setTimeout(() => this.playTone(784, 0.15, 'square', 0.12), 200);
  }

  playRaceFinish() {
    this.playTone(523, 0.1, 'square', 0.15);
    setTimeout(() => this.playTone(659, 0.1, 'square', 0.15), 100);
    setTimeout(() => this.playTone(784, 0.1, 'square', 0.15), 200);
    setTimeout(() => this.playTone(1047, 0.3, 'square', 0.15), 300);
  }

  playNitro() {
    this.playNoise(0.3, 0.2);
    this.playTone(200, 0.3, 'sawtooth', 0.1);
  }

  playOilDrop() {
    this.playTone(120, 0.15, 'sine', 0.12);
    this.playNoise(0.1, 0.08);
  }

  playShield() {
    this.playTone(800, 0.1, 'sine', 0.1);
    setTimeout(() => this.playTone(1200, 0.2, 'sine', 0.08), 100);
  }

  playMissile() {
    this.playTone(300, 0.05, 'sawtooth', 0.15);
    setTimeout(() => this.playTone(600, 0.15, 'sawtooth', 0.1), 50);
  }

  playTacks() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playTone(2000 + Math.random() * 2000, 0.03, 'square', 0.06), i * 30);
    }
  }

  playSelect() {
    this.playTone(440, 0.05, 'square', 0.1);
    setTimeout(() => this.playTone(550, 0.08, 'square', 0.1), 50);
  }

  destroy() {
    this.stopEngine();
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
