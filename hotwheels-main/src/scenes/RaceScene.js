import Phaser from 'phaser';
import { TrackRenderer } from '../track/TrackRenderer.js';
import { PlayerCar } from '../entities/PlayerCar.js';
import { AICar } from '../entities/AICar.js';
import { PowerUpManager } from '../powerups/PowerUpManager.js';
import { CheckpointSystem } from '../race/CheckpointSystem.js';
import { RaceHUD } from '../ui/RaceHUD.js';
import { SoundManager } from '../audio/SoundManager.js';
import { START_POSITIONS, TILE_SIZE, TRACK_WIDTH, TRACK_HEIGHT } from '../track/trackData.js';
import { CAR_STATS, CAR_KEYS } from '../data/carStats.js';

/**
 * Main race scene — the core gameplay loop.
 */
export class RaceScene extends Phaser.Scene {

  constructor() {
    super({ key: 'RaceScene' });
  }

  init(data) {
    this.playerCarKey = data.carKey;
    this.playerCarStats = data.carStats;
    this.difficulty = data.difficulty;
    this.difficultyName = data.difficultyName;
    this.speedClass = data.speedClass;
    this.speedClassName = data.speedClassName;
  }

  create() {
    this.raceLocked = true; // Lock controls until countdown finishes
    this.raceStarted = false;
    this.raceFinished = false;
    this.raceStartTime = 0;

    // Sound
    this.soundManager = new SoundManager(this);
    this.soundManager.init();

    // Set world bounds
    const worldW = TRACK_WIDTH * TILE_SIZE;
    const worldH = TRACK_HEIGHT * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // Render track
    this.trackRenderer = new TrackRenderer(this);
    this.trackRenderer.render();

    // Pick an AI car (different from player)
    const aiCarKey = this.pickAICar();
    const aiStats = CAR_STATS[aiCarKey];

    // Create cars at start positions
    const pStart = START_POSITIONS.player;
    const aStart = START_POSITIONS.ai;

    // Apply speed class multiplier to stats
    const sm = this.speedClass.speedMult;
    const playerStatsScaled = { ...this.playerCarStats, maxSpeed: this.playerCarStats.maxSpeed * sm, accelRate: this.playerCarStats.accelRate * sm };
    const aiStatsScaled = { ...aiStats, maxSpeed: aiStats.maxSpeed * sm, accelRate: aiStats.accelRate * sm };

    this.player = new PlayerCar(this, pStart.x, pStart.y, this.playerCarKey, playerStatsScaled);
    this.player.physics.setAngle(pStart.angle);

    this.aiCar = new AICar(this, aStart.x, aStart.y, aiCarKey, aiStatsScaled, this.difficulty);
    this.aiCar.physics.setAngle(aStart.angle);

    // Power-ups
    this.powerUpManager = new PowerUpManager(this);
    this.powerUpManager.createItemBoxes();

    // Checkpoint system
    this.checkpointSystem = new CheckpointSystem(this, 3);
    this.checkpointSystem.registerCar(this.player, 'player');
    this.checkpointSystem.registerCar(this.aiCar, 'ai');

    // Camera follow player
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);

    // HUD
    this.hud = new RaceHUD(this);

    // Pause menu state
    this.paused = false;
    this.pauseContainer = null;
    this.input.keyboard.on('keydown-ESC', () => this.togglePauseMenu());

    // Start countdown
    this.startCountdown();
  }

  pickAICar() {
    // Pick a random car that's different from the player
    const available = CAR_KEYS.filter(k => k !== this.playerCarKey);
    return available[Math.floor(Math.random() * available.length)];
  }

  startCountdown() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Traffic light — add to HUD camera so zoom doesn't affect it
    this.trafficLight = this.add.image(width / 2, height / 2 - 60, 'trafficLight_off');
    this.trafficLight.setDepth(200);
    this.trafficLight.setScale(1.5);
    this.cameras.main.ignore(this.trafficLight);
    this.hud.container.add(this.trafficLight);

    // Countdown text
    this.countdownText = this.add.text(width / 2, height / 2 + 40, '', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(200);
    this.cameras.main.ignore(this.countdownText);
    this.hud.container.add(this.countdownText);

    // 3
    this.time.delayedCall(500, () => {
      this.trafficLight.setTexture('trafficLight_red');
      this.countdownText.setText('3');
      this.soundManager.play('countdown');
    });

    // 2
    this.time.delayedCall(1500, () => {
      this.countdownText.setText('2');
      this.soundManager.play('countdown');
    });

    // 1
    this.time.delayedCall(2500, () => {
      this.countdownText.setText('1');
      this.soundManager.play('countdown');
    });

    // GO!
    this.time.delayedCall(3500, () => {
      this.trafficLight.setTexture('trafficLight_green');
      this.countdownText.setText('GO!');
      this.countdownText.setColor('#00ff00');
      this.soundManager.play('go');

      this.raceLocked = false;
      this.raceStarted = true;
      this.raceStartTime = this.time.now;
      this.checkpointSystem.startRace();
      this.soundManager.startEngine();

      // Play random music track at 25% volume
      const trackIndex = Math.floor(Math.random() * 4);
      this.raceMusic = this.sound.add(`music_${trackIndex}`, { loop: true, volume: 0.25 });
      this.raceMusic.play();

      // Fade out countdown
      this.time.delayedCall(800, () => {
        this.trafficLight.destroy();
        this.countdownText.destroy();
      });
    });
  }

  update(time, delta) {
    const dt = delta / 1000; // Convert to seconds

    if (!this.raceStarted && !this.raceFinished) return;
    if (this.raceFinished) return;

    const isOnRoad = (x, y) => this.trackRenderer.isOnRoad(x, y);

    // Update player
    this.player.update(dt, isOnRoad);

    // Update AI with player progress for rubber-banding
    const playerProgress = this.checkpointSystem.getProgress('player');
    this.aiCar.update(dt, isOnRoad, playerProgress);

    // Update power-ups
    this.powerUpManager.update(dt, this.player, this.aiCar);

    // Update checkpoints
    this.checkpointSystem.update();

    // Update HUD
    this.hud.update(this.player, this.aiCar, this.checkpointSystem);

    // Update engine sound
    this.soundManager.updateEngineSound(this.player.getSpeed());

    // Check race finish
    if (this.checkpointSystem.isFinished('player') || this.checkpointSystem.isFinished('ai')) {
      this.finishRace();
    }
  }

  showLapNotification(carId, lap) {
    if (carId !== 'player') return;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const text = lap === 2 ? 'FINAL LAP!' : `LAP ${lap + 1}`;
    const color = lap === 2 ? '#ff4444' : '#ffffff';

    const notification = this.add.text(width / 2, height / 2, text, {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: color,
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(150);
    this.cameras.main.ignore(notification);
    this.hud.container.add(notification);

    this.soundManager.play('lapComplete');

    this.tweens.add({
      targets: notification,
      alpha: 0,
      y: height / 2 - 50,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => notification.destroy()
    });
  }

  finishRace() {
    this.raceFinished = true;
    this.raceLocked = true;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Checkered flag text
    const finishText = this.add.text(width / 2, height / 2, 'FINISH!', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(200);
    this.cameras.main.ignore(finishText);
    this.hud.container.add(finishText);

    this.soundManager.play('raceFinish');
    this.soundManager.stopEngine();
    if (this.raceMusic) {
      this.raceMusic.stop();
      this.raceMusic.destroy();
    }

    this.tweens.add({
      targets: finishText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 500,
      yoyo: true,
      repeat: 1
    });

    // Transition to results after 2.5 seconds
    this.time.delayedCall(2500, () => {
      const playerResults = this.checkpointSystem.getResults('player');
      const aiResults = this.checkpointSystem.getResults('ai');
      const playerWon = this.checkpointSystem.isFinished('player');

      this.soundManager.destroy();
      this.hud.destroy();
      this.player.destroy();
      this.aiCar.destroy();
      this.powerUpManager.destroy();

      this.scene.start('ResultsScene', {
        playerWon,
        playerResults,
        aiResults,
        carKey: this.playerCarKey,
        carStats: this.playerCarStats,
        difficulty: this.difficulty,
        difficultyName: this.difficultyName,
        speedClass: this.speedClass,
        speedClassName: this.speedClassName
      });
    });
  }

  togglePauseMenu() {
    if (this.raceFinished) return;
    if (this.paused) {
      this.closePauseMenu();
    } else {
      this.openPauseMenu();
    }
  }

  openPauseMenu() {
    this.paused = true;
    this.scene.pause();

    const width = 800;
    const height = 600;

    // Create a new overlay scene on top
    this.scene.launch('PauseScene', {
      raceScene: this,
      raceMusic: this.raceMusic
    });
  }

  closePauseMenu() {
    this.paused = false;
    this.scene.resume();
  }

  quitToTitle() {
    this.soundManager.stopEngine();
    this.soundManager.destroy();
    if (this.raceMusic) {
      this.raceMusic.stop();
      this.raceMusic.destroy();
    }
    this.hud.destroy();
    this.player.destroy();
    this.aiCar.destroy();
    this.powerUpManager.destroy();
    this.scene.start('CarSelectScene');
  }
}
