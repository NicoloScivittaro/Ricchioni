/**
 * Arcade top-down car physics.
 * Handles acceleration, braking, turning, friction, and boundary collision.
 */
export class CarPhysics {

  /**
   * @param {object} stats - Car stats from carStats.js
   */
  constructor(stats) {
    this.maxSpeed = stats.maxSpeed;
    this.accelRate = stats.accelRate;
    this.turnRate = stats.turnRate;
    this.friction = stats.friction;

    // Current state
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.angle = -Math.PI / 2; // Facing up initially
  }

  /**
   * Update physics for one frame.
   * @param {number} dt - Delta time in seconds
   * @param {object} input - { accelerate, brake, left, right }
   * @param {function} isOnRoad - Function(x,y) → boolean
   * @param {number} x - Current x position
   * @param {number} y - Current y position
   * @returns {{ x, y, angle, speed, offRoad, collided }}
   */
  update(dt, input, isOnRoad, x, y) {
    let offRoad = false;
    let collided = false;

    // Turning — scales with speed but always allows some turning so you can escape walls
    const speedFactor = Math.max(0.7, Math.min(Math.abs(this.speed) / 50, 1));
    if (input.left) {
      this.angle -= this.turnRate * speedFactor * dt;
    }
    if (input.right) {
      this.angle += this.turnRate * speedFactor * dt;
    }

    // Acceleration
    if (input.accelerate) {
      this.speed += this.accelRate * dt;
    }

    // Braking
    if (input.brake) {
      this.speed -= this.accelRate * 1.5 * dt;
    }

    // Friction
    this.speed *= this.friction;

    // Clamp speed
    if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    if (this.speed < -this.maxSpeed * 0.3) this.speed = -this.maxSpeed * 0.3;
    if (Math.abs(this.speed) < 0.5) this.speed = 0;

    // Calculate velocity
    this.vx = Math.cos(this.angle) * this.speed * dt;
    this.vy = Math.sin(this.angle) * this.speed * dt;

    // New position
    let newX = x + this.vx;
    let newY = y + this.vy;

    // Boundary check — stay on road
    if (!isOnRoad(newX, newY)) {
      offRoad = true;
      // Check if just X movement is off-road
      const xOnly = !isOnRoad(newX, y);
      const yOnly = !isOnRoad(x, newY);

      if (xOnly && yOnly) {
        // Both directions blocked — keep most speed so player can turn out
        newX = x;
        newY = y;
        this.speed *= 0.8;
        collided = true;
      } else if (xOnly) {
        // Slide along Y
        newX = x;
        this.speed *= 0.88;
        collided = true;
      } else if (yOnly) {
        // Slide along X
        newY = y;
        this.speed *= 0.88;
        collided = true;
      } else {
        // Diagonal blocked
        newX = x;
        newY = y;
        this.speed *= 0.85;
        collided = true;
      }
    }

    return {
      x: newX,
      y: newY,
      angle: this.angle,
      speed: this.speed,
      offRoad,
      collided
    };
  }

  /**
   * Apply external speed modification (e.g., from power-ups)
   */
  applySpeedMod(mult, duration) {
    // This is handled externally by the power-up system
    // but we expose the ability to directly set speed
    this.speed *= mult;
  }

  setAngle(angle) {
    this.angle = angle;
  }

  setSpeed(speed) {
    this.speed = speed;
  }
}
