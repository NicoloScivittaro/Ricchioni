import { ITEM_BOX_POSITIONS } from '../track/trackData.js';

const POWER_UP_TYPES = ['nitro', 'oil', 'shield', 'missile', 'tacks'];

/**
 * Manages item boxes on the track and power-up activation.
 */
export class PowerUpManager {

  constructor(scene) {
    this.scene = scene;
    this.itemBoxes = [];
    this.activeHazards = []; // oil puddles, tacks on the track
    this.activeMissiles = [];
  }

  createItemBoxes() {
    for (const pos of ITEM_BOX_POSITIONS) {
      const box = {
        sprite: this.scene.add.image(pos.x, pos.y, 'itemBox'),
        x: pos.x,
        y: pos.y,
        active: true,
        respawnTimer: 0
      };
      box.sprite.setDepth(8);
      this.itemBoxes.push(box);
    }
  }

  update(dt, player, ai) {
    // Animate item boxes (gentle pulse)
    for (const box of this.itemBoxes) {
      if (box.active) {
        box.sprite.setScale(0.9 + Math.sin(this.scene.time.now / 300) * 0.1);
        box.sprite.setAlpha(1);

        // Check player pickup
        const pDist = this.distance(player.x, player.y, box.x, box.y);
        const pickupRange = 28 * player.stats.pickupRadius;
        if (pDist < pickupRange && !player.heldPowerUp) {
          this.collectBox(box, player);
        }

        // Check AI pickup
        const aDist = this.distance(ai.x, ai.y, box.x, box.y);
        if (aDist < 28 && !ai.heldPowerUp) {
          this.collectBox(box, ai);
        }
      } else {
        // Respawn timer
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.sprite.setVisible(true);
        }
      }
    }

    // Update active hazards
    this.updateHazards(dt, player, ai);

    // Update missiles
    this.updateMissiles(dt, player, ai);
  }

  collectBox(box, car) {
    box.active = false;
    box.sprite.setVisible(false);
    box.respawnTimer = 5; // 5 seconds

    const type = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
    car.collectPowerUp(type);
  }

  /**
   * Activate a power-up for the given car.
   */
  usePowerUp(car, type) {
    const opponent = car === this.scene.player ? this.scene.aiCar : this.scene.player;

    if (this.scene.soundManager) {
      this.scene.soundManager.play(`powerup_${type}`);
    }

    switch (type) {
      case 'nitro':
        car.activateNitro(2000);
        break;

      case 'oil':
        this.dropOilSlick(car);
        break;

      case 'shield':
        car.activateShield();
        break;

      case 'missile':
        this.fireMissile(car, opponent);
        break;

      case 'tacks':
        this.dropTacks(car);
        break;
    }
  }

  dropOilSlick(car) {
    const angle = car.getAngle();
    const ox = car.x - Math.cos(angle) * 40;
    const oy = car.y - Math.sin(angle) * 40;

    const sprite = this.scene.add.image(ox, oy, 'oilPuddle');
    sprite.setDepth(3);
    sprite.setAlpha(0.8);

    this.activeHazards.push({
      type: 'oil',
      sprite,
      x: ox,
      y: oy,
      owner: car,
      lifetime: 8,
      radius: 50
    });
  }

  dropTacks(car) {
    const angle = car.getAngle();
    const baseX = car.x - Math.cos(angle) * 40;
    const baseY = car.y - Math.sin(angle) * 40;

    // Scatter several tacks
    const tackSprites = [];
    for (let i = 0; i < 6; i++) {
      const tx = baseX + (Math.random() - 0.5) * 30;
      const ty = baseY + (Math.random() - 0.5) * 30;
      const sprite = this.scene.add.image(tx, ty, 'tack');
      sprite.setDepth(3);
      tackSprites.push(sprite);
    }

    this.activeHazards.push({
      type: 'tacks',
      sprites: tackSprites,
      x: baseX,
      y: baseY,
      owner: car,
      lifetime: 10,
      radius: 50
    });
  }

  fireMissile(car, target) {
    const angle = car.getAngle();
    const mx = car.x + Math.cos(angle) * 30;
    const my = car.y + Math.sin(angle) * 30;

    const sprite = this.scene.add.image(mx, my, 'missileProjectile');
    sprite.setDepth(12);
    sprite.rotation = angle + Math.PI / 2;

    this.activeMissiles.push({
      sprite,
      x: mx,
      y: my,
      angle,
      speed: 900,
      owner: car,
      target,
      distanceTraveled: 0,
      maxDistance: 1200,
      homingStrength: 3.0
    });
  }

  updateHazards(dt, player, ai) {
    for (let i = this.activeHazards.length - 1; i >= 0; i--) {
      const hazard = this.activeHazards[i];
      hazard.lifetime -= dt;

      if (hazard.lifetime <= 0) {
        // Remove
        if (hazard.sprite) hazard.sprite.destroy();
        if (hazard.sprites) hazard.sprites.forEach(s => s.destroy());
        this.activeHazards.splice(i, 1);
        continue;
      }

      // Fade out in last 2 seconds
      if (hazard.lifetime < 2) {
        const alpha = hazard.lifetime / 2;
        if (hazard.sprite) hazard.sprite.setAlpha(alpha);
        if (hazard.sprites) hazard.sprites.forEach(s => s.setAlpha(alpha));
      }

      // Check collision with cars (not the owner)
      const cars = [player, ai];
      for (const car of cars) {
        if (car === hazard.owner) continue;
        const dist = this.distance(car.x, car.y, hazard.x, hazard.y);
        if (dist < hazard.radius) {
          if (hazard.type === 'oil') {
            car.applySpinOut(1000);
          } else if (hazard.type === 'tacks') {
            car.applySlow(2000);
          }
          // Remove hazard after triggering
          if (hazard.sprite) hazard.sprite.destroy();
          if (hazard.sprites) hazard.sprites.forEach(s => s.destroy());
          this.activeHazards.splice(i, 1);
          break;
        }
      }
    }
  }

  updateMissiles(dt, player, ai) {
    for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
      const m = this.activeMissiles[i];

      // Homing: gently steer toward target
      const toTargetX = m.target.x - m.x;
      const toTargetY = m.target.y - m.y;
      const targetAngle = Math.atan2(toTargetY, toTargetX);
      let angleDiff = targetAngle - m.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      m.angle += angleDiff * m.homingStrength * dt;

      const dx = Math.cos(m.angle) * m.speed * dt;
      const dy = Math.sin(m.angle) * m.speed * dt;
      m.x += dx;
      m.y += dy;
      m.distanceTraveled += Math.sqrt(dx * dx + dy * dy);

      m.sprite.x = m.x;
      m.sprite.y = m.y;
      m.sprite.rotation = m.angle + Math.PI / 2;

      // Check if exceeded max distance
      if (m.distanceTraveled >= m.maxDistance) {
        m.sprite.destroy();
        this.activeMissiles.splice(i, 1);
        continue;
      }

      // Check collision with target
      const dist = this.distance(m.x, m.y, m.target.x, m.target.y);
      if (dist < 45) {
        this.applyMissileHit(m.target);
        m.sprite.destroy();
        this.activeMissiles.splice(i, 1);
        continue;
      }

      // Check collision with non-owner car too
      const other = m.owner === player ? ai : player;
      if (other !== m.target) {
        const dist2 = this.distance(m.x, m.y, other.x, other.y);
        if (dist2 < 45) {
          this.applyMissileHit(other);
          m.sprite.destroy();
          this.activeMissiles.splice(i, 1);
          continue;
        }
      }
    }
  }

  applyMissileHit(car) {
    // Immediate hard stop + spin out — should feel punishing
    car.physics.setSpeed(car.physics.speed * 0.15);
    car.applySpinOut(1200);
  }

  distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  destroy() {
    this.itemBoxes.forEach(b => b.sprite.destroy());
    this.activeHazards.forEach(h => {
      if (h.sprite) h.sprite.destroy();
      if (h.sprites) h.sprites.forEach(s => s.destroy());
    });
    this.activeMissiles.forEach(m => m.sprite.destroy());
  }
}
