import { CarPhysics } from '../physics/CarPhysics.js';
import { WAYPOINTS } from '../track/trackData.js';

/**
 * AI-controlled opponent car.
 */
export class AICar {

  constructor(scene, x, y, carKey, stats, difficulty) {
    this.scene = scene;
    this.carKey = carKey;
    this.stats = stats;
    this.difficulty = difficulty;

    // Create sprite
    this.sprite = scene.add.image(x, y, `car_${carKey}`);
    this.sprite.setDepth(10);
    this.sprite.setOrigin(0.5, 0.5);

    // Physics
    this.physics = new CarPhysics(stats);
    this.x = x;
    this.y = y;

    // AI state
    this.currentWaypointIndex = 0;
    this.waypoints = WAYPOINTS;
    this.baseSpeedMult = difficulty.baseSpeedMult;
    this.rubberBandStrength = difficulty.rubberBandStrength;
    this.mistakeChance = difficulty.mistakeChance;
    this.mistakeTimer = 0;
    this.mistakeOffset = { x: 0, y: 0 };

    // Power-up state
    this.heldPowerUp = null;
    this.powerUpUseDelay = difficulty.powerUpDelay;
    this.powerUpTimer = 0;
    this.shielded = false;
    this.nitroActive = false;
    this.slowed = false;
    this.slowTimer = 0;
    this.spinningOut = false;
    this.spinTimer = 0;

    this.currentSpeed = 0;

    // Particles
    this.setupParticles();

    // Set initial sprite rotation
    this.updateSprite();
  }

  setupParticles() {
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

  update(dt, isOnRoad, playerProgress) {
    if (this.scene.raceLocked) return;

    // Handle spin-out
    if (this.spinningOut) {
      this.spinTimer -= dt;
      this.physics.angle += 8 * dt;
      this.physics.speed *= 0.95;
      const result = this.physics.update(dt, { accelerate: false, brake: false, left: false, right: false }, isOnRoad, this.x, this.y);
      this.x = result.x;
      this.y = result.y;
      this.updateSprite();
      if (this.spinTimer <= 0) this.spinningOut = false;
      return;
    }

    // Handle slow
    if (this.slowed) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowed = false;
    }

    // Get target waypoint
    const target = this.waypoints[this.currentWaypointIndex];

    // Add mistake offset
    this.mistakeTimer -= dt;
    if (this.mistakeTimer <= 0) {
      if (Math.random() < this.mistakeChance) {
        this.mistakeOffset = {
          x: (Math.random() - 0.5) * 40,
          y: (Math.random() - 0.5) * 40
        };
      } else {
        this.mistakeOffset = { x: 0, y: 0 };
      }
      this.mistakeTimer = 0.5 + Math.random() * 1.0;
    }

    const targetX = target.x + this.mistakeOffset.x;
    const targetY = target.y + this.mistakeOffset.y;

    // Calculate angle to target
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const targetAngle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Steer toward target
    let angleDiff = targetAngle - this.physics.angle;
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const input = {
      accelerate: true,
      brake: false,
      left: angleDiff < -0.05,
      right: angleDiff > 0.05
    };

    // Slow down for tight turns
    if (Math.abs(angleDiff) > 0.8) {
      input.brake = true;
      input.accelerate = false;
    } else if (Math.abs(angleDiff) > 0.4) {
      input.accelerate = true;
      // Reduce speed slightly
    }

    // Apply rubber-banding
    let speedMult = this.baseSpeedMult;
    if (playerProgress !== undefined) {
      const aiProgress = this.getTrackProgress();
      const progressDiff = aiProgress - playerProgress;

      if (progressDiff > 0) {
        // AI is ahead — slow down
        speedMult -= progressDiff * this.rubberBandStrength * 0.3;
      } else {
        // AI is behind — speed up slightly
        speedMult += Math.abs(progressDiff) * this.rubberBandStrength * 0.15;
      }
      speedMult = Math.max(0.5, Math.min(1.1, speedMult));
    }

    // Modify max speed
    const originalMax = this.physics.maxSpeed;
    this.physics.maxSpeed = this.stats.maxSpeed * speedMult;

    if (this.nitroActive) {
      this.physics.maxSpeed *= 1.6;
    }
    if (this.slowed) {
      this.physics.maxSpeed *= 0.5;
    }

    const result = this.physics.update(dt, input, isOnRoad, this.x, this.y);
    this.physics.maxSpeed = originalMax;

    this.x = result.x;
    this.y = result.y;
    this.currentSpeed = result.speed;

    // Advance waypoint when close enough
    if (dist < 40) {
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
    }

    // Particle effects
    this.smokeEmitter.emitting = this.currentSpeed > 20;
    this.nitroEmitter.emitting = this.nitroActive;

    this.updateSprite();

    // AI power-up usage
    if (this.heldPowerUp) {
      this.powerUpTimer += dt * 1000;
      if (this.powerUpTimer >= this.powerUpUseDelay) {
        // Decide whether to waste it
        if (Math.random() > this.difficulty.powerUpWasteChance) {
          this.scene.powerUpManager.usePowerUp(this, this.heldPowerUp);
        }
        this.heldPowerUp = null;
        this.powerUpTimer = 0;
      }
    }
  }

  updateSprite() {
    this.sprite.x = this.x;
    this.sprite.y = this.y;
    this.sprite.rotation = this.physics.angle + Math.PI / 2;
  }

  getTrackProgress() {
    // Returns a 0-1 value representing progress along the track
    return this.currentWaypointIndex / this.waypoints.length;
  }

  // Power-up effects (same interface as PlayerCar)
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
      if (this.shieldSprite) { this.shieldSprite.destroy(); this.shieldSprite = null; }
      return;
    }
    this.slowed = true;
    this.slowTimer = duration / 1000;
  }

  applySpinOut(duration) {
    if (this.shielded) {
      this.shielded = false;
      if (this.shieldSprite) { this.shieldSprite.destroy(); this.shieldSprite = null; }
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
    this.scene.time.delayedCall(10000, () => {
      this.shielded = false;
      if (this.shieldSprite) { this.shieldSprite.destroy(); this.shieldSprite = null; }
    });
  }

  collectPowerUp(type) {
    if (!this.heldPowerUp) {
      this.heldPowerUp = type;
      this.powerUpTimer = 0;
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
    this.nitroEmitter.destroy();
    if (this.shieldSprite) this.shieldSprite.destroy();
  }
}
