import Phaser from 'phaser';
import { CarPhysics } from '../physics/CarPhysics.js';

/**
 * Player-controlled car entity.
 */
export class PlayerCar {

  constructor(scene, x, y, carKey, stats) {
    this.scene = scene;
    this.carKey = carKey;
    this.stats = stats;

    // Create sprite
    this.sprite = scene.add.image(x, y, `car_${carKey}`);
    this.sprite.setDepth(10);
    this.sprite.setOrigin(0.5, 0.5);

    // Physics
    this.physics = new CarPhysics(stats);
    this.x = x;
    this.y = y;

    // Power-up state
    this.heldPowerUp = null;
    this.shielded = false;
    this.nitroActive = false;
    this.slowed = false;
    this.slowTimer = 0;
    this.spinningOut = false;
    this.spinTimer = 0;

    // Speed display
    this.currentSpeed = 0;

    // Input
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.spaceBar = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Particle emitters
    this.setupParticles();

    // Set initial sprite rotation
    this.updateSprite();
  }

  setupParticles() {
    // Exhaust smoke
    this.smokeEmitter = this.scene.add.particles(0, 0, 'particle_smoke', {
      speed: { min: 10, max: 30 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 400,
      frequency: 100,
      follow: this.sprite,
      followOffset: { x: 0, y: 20 },
      emitting: false
    });
    this.smokeEmitter.setDepth(5);

    // Spark emitter (for wall collisions)
    this.sparkEmitter = this.scene.add.particles(0, 0, 'particle_spark', {
      speed: { min: 50, max: 150 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 200,
      frequency: -1, // manual emit
      emitting: false
    });
    this.sparkEmitter.setDepth(15);

    // Nitro flame
    this.nitroEmitter = this.scene.add.particles(0, 0, 'nitroFlame', {
      speed: { min: 20, max: 60 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 200,
      frequency: 30,
      follow: this.sprite,
      followOffset: { x: 0, y: 24 },
      emitting: false
    });
    this.nitroEmitter.setDepth(5);
  }

  update(dt, isOnRoad) {
    if (this.scene.raceLocked) return;

    // Handle spin-out state
    if (this.spinningOut) {
      this.spinTimer -= dt;
      this.physics.angle += 8 * dt; // Spin rapidly
      this.physics.speed *= 0.95;
      const result = this.physics.update(dt, { accelerate: false, brake: false, left: false, right: false }, isOnRoad, this.x, this.y);
      this.x = result.x;
      this.y = result.y;
      this.updateSprite();
      if (this.spinTimer <= 0) {
        this.spinningOut = false;
      }
      return;
    }

    // Handle slow state
    if (this.slowed) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowed = false;
      }
    }

    // Gather input
    const input = {
      accelerate: this.cursors.up.isDown || this.wasd.up.isDown,
      brake: this.cursors.down.isDown || this.wasd.down.isDown,
      left: this.cursors.left.isDown || this.wasd.left.isDown,
      right: this.cursors.right.isDown || this.wasd.right.isDown
    };

    // Temporarily modify max speed if nitro or slowed
    const originalMax = this.physics.maxSpeed;
    if (this.nitroActive) {
      this.physics.maxSpeed = this.stats.maxSpeed * 1.6;
    }
    if (this.slowed) {
      this.physics.maxSpeed = this.stats.maxSpeed * 0.5;
    }

    // Update physics
    const result = this.physics.update(dt, input, isOnRoad, this.x, this.y);

    // Restore max speed
    this.physics.maxSpeed = originalMax;

    this.x = result.x;
    this.y = result.y;
    this.currentSpeed = result.speed;

    // Wall collision effects
    if (result.collided) {
      this.sparkEmitter.emitParticleAt(this.x, this.y, 8);
      if (this.scene.soundManager) {
        this.scene.soundManager.play('wallHit');
      }
    }

    // Exhaust when accelerating
    this.smokeEmitter.emitting = input.accelerate && this.currentSpeed > 20;
    this.nitroEmitter.emitting = this.nitroActive;

    this.updateSprite();

    // Spacebar — use power-up
    if (Phaser.Input.Keyboard.JustDown(this.spaceBar) && this.heldPowerUp) {
      this.scene.powerUpManager.usePowerUp(this, this.heldPowerUp);
      this.heldPowerUp = null;
    }
  }

  updateSprite() {
    this.sprite.x = this.x;
    this.sprite.y = this.y;
    // Phaser rotation: 0 = right, so add PI/2 since our angle 0 = right
    this.sprite.rotation = this.physics.angle + Math.PI / 2;
  }

  // Power-up effects
  activateNitro(duration) {
    this.nitroActive = true;
    this.physics.speed = Math.max(this.physics.speed, this.stats.maxSpeed * 1.2);
    this.scene.time.delayedCall(duration, () => {
      this.nitroActive = false;
    });
  }

  applySlow(duration) {
    if (this.shielded) {
      this.shielded = false;
      if (this.shieldSprite) {
        this.shieldSprite.destroy();
        this.shieldSprite = null;
      }
      return;
    }
    this.slowed = true;
    this.slowTimer = duration / 1000;
  }

  applySpinOut(duration) {
    if (this.shielded) {
      this.shielded = false;
      if (this.shieldSprite) {
        this.shieldSprite.destroy();
        this.shieldSprite = null;
      }
      return;
    }
    this.spinningOut = true;
    this.spinTimer = duration / 1000;
  }

  activateShield() {
    this.shielded = true;
    this.shieldSprite = this.scene.add.image(this.x, this.y, 'shieldBubble');
    this.shieldSprite.setDepth(11);
    this.shieldSprite.setAlpha(0.6);
    // Follow car
    this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.shieldSprite && this.shielded) {
          this.shieldSprite.x = this.x;
          this.shieldSprite.y = this.y;
        } else if (this.shieldSprite) {
          this.shieldSprite.destroy();
          this.shieldSprite = null;
        }
      }
    });
    // Shield lasts 10 seconds max
    this.scene.time.delayedCall(10000, () => {
      this.shielded = false;
      if (this.shieldSprite) {
        this.shieldSprite.destroy();
        this.shieldSprite = null;
      }
    });
  }

  collectPowerUp(type) {
    if (!this.heldPowerUp) {
      this.heldPowerUp = type;
      if (this.scene.soundManager) {
        this.scene.soundManager.play('pickup');
      }
    }
  }

  getAngle() {
    return this.physics.angle;
  }

  getSpeed() {
    return this.currentSpeed;
  }

  destroy() {
    this.sprite.destroy();
    this.smokeEmitter.destroy();
    this.sparkEmitter.destroy();
    this.nitroEmitter.destroy();
    if (this.shieldSprite) this.shieldSprite.destroy();
  }
}
