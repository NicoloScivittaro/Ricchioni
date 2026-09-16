import { WAYPOINTS, TRACK_WIDTH, TRACK_HEIGHT, TILE_SIZE } from '../track/trackData.js';

/**
 * Race HUD overlay — rendered on a separate unzoomed camera.
 * Shows: lap counter, position, minimap, power-up slot, speed.
 */
export class RaceHUD {

  constructor(scene) {
    this.scene = scene;

    // Create a dedicated HUD camera (no zoom, no scroll)
    this.hudCamera = scene.cameras.add(0, 0, 800, 600);
    this.hudCamera.setScroll(0, 0);

    // Container for all HUD elements
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);

    // Main camera should ignore the HUD container
    scene.cameras.main.ignore(this.container);

    // HUD camera should only see the HUD container — ignore everything else
    // We'll track non-HUD objects to ignore them on the HUD camera
    this.hudCamera.ignore(scene.children.list.filter(c => c !== this.container));

    this.createLapCounter();
    this.createPositionDisplay();
    this.createPowerUpSlot();
    this.createSpeedometer();
    this.createMinimap();

    // Re-ignore newly added children on the HUD camera after setup
    this.refreshCameraIgnore();
  }

  refreshCameraIgnore() {
    // Make the HUD camera ignore everything except our container and its children
    const allChildren = this.scene.children.list;
    for (const child of allChildren) {
      if (child === this.container) continue;
      try {
        this.hudCamera.ignore(child);
      } catch (e) { /* ignore errors for non-renderable objects */ }
    }
  }

  createLapCounter() {
    this.lapText = this.scene.add.text(20, 20, 'LAP 1/3', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.container.add(this.lapText);
  }

  createPositionDisplay() {
    this.posText = this.scene.add.text(20, 48, '1ST', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.container.add(this.posText);
  }

  createPowerUpSlot() {
    const cx = 400, cy = 560;
    this.powerUpBg = this.scene.add.graphics();
    this.powerUpBg.fillStyle(0x222222, 0.8);
    this.powerUpBg.fillRoundedRect(cx - 20, cy - 20, 40, 40, 4);
    this.powerUpBg.lineStyle(2, 0x666666);
    this.powerUpBg.strokeRoundedRect(cx - 20, cy - 20, 40, 40, 4);
    this.container.add(this.powerUpBg);

    this.powerUpIcon = this.scene.add.image(cx, cy, 'icon_nitro');
    this.powerUpIcon.setVisible(false);
    this.container.add(this.powerUpIcon);

    this.powerUpLabel = this.scene.add.text(cx, cy + 28, 'SPACE', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#888888',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.container.add(this.powerUpLabel);
  }

  createSpeedometer() {
    this.speedText = this.scene.add.text(20, 560, '0 km/h', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.container.add(this.speedText);
  }

  createMinimap() {
    const mmX = 680, mmY = 480;
    const mmW = 100, mmH = 100;

    this.minimapBg = this.scene.add.graphics();
    this.minimapBg.fillStyle(0x111111, 0.8);
    this.minimapBg.fillRect(mmX, mmY, mmW, mmH);
    this.minimapBg.lineStyle(1, 0x444444);
    this.minimapBg.strokeRect(mmX, mmY, mmW, mmH);
    this.container.add(this.minimapBg);

    this.minimapTrack = this.scene.add.graphics();
    this.drawMinimapTrack(mmX, mmY, mmW, mmH);
    this.container.add(this.minimapTrack);

    this.playerDot = this.scene.add.graphics();
    this.aiDot = this.scene.add.graphics();
    this.container.add(this.playerDot);
    this.container.add(this.aiDot);

    this.mmX = mmX;
    this.mmY = mmY;
    this.mmW = mmW;
    this.mmH = mmH;
  }

  drawMinimapTrack(mmX, mmY, mmW, mmH) {
    const worldW = TRACK_WIDTH * TILE_SIZE;
    const worldH = TRACK_HEIGHT * TILE_SIZE;

    this.minimapTrack.lineStyle(2, 0x555555);
    this.minimapTrack.beginPath();

    for (let i = 0; i < WAYPOINTS.length; i++) {
      const wp = WAYPOINTS[i];
      const sx = mmX + (wp.x / worldW) * mmW;
      const sy = mmY + (wp.y / worldH) * mmH;
      if (i === 0) {
        this.minimapTrack.moveTo(sx, sy);
      } else {
        this.minimapTrack.lineTo(sx, sy);
      }
    }

    const first = WAYPOINTS[0];
    this.minimapTrack.lineTo(mmX + (first.x / worldW) * mmW, mmY + (first.y / worldH) * mmH);
    this.minimapTrack.strokePath();
  }

  update(playerCar, aiCar, checkpointSystem) {
    // Lap counter
    const lap = Math.min(checkpointSystem.getLap('player') + 1, checkpointSystem.getTotalLaps());
    this.lapText.setText(`LAP ${lap}/${checkpointSystem.getTotalLaps()}`);

    // Position
    const pos = checkpointSystem.getPosition('player');
    if (pos === 1) {
      this.posText.setText('1ST');
      this.posText.setColor('#ffd700');
    } else {
      this.posText.setText('2ND');
      this.posText.setColor('#c0c0c0');
    }

    // Power-up slot
    if (playerCar.heldPowerUp) {
      this.powerUpIcon.setTexture(`icon_${playerCar.heldPowerUp}`);
      this.powerUpIcon.setVisible(true);
    } else {
      this.powerUpIcon.setVisible(false);
    }

    // Speed
    const speed = Math.abs(Math.round(playerCar.getSpeed() * 0.8));
    this.speedText.setText(`${speed} km/h`);

    // Minimap dots
    this.updateMinimapDots(playerCar, aiCar);

    // Keep HUD camera ignoring new scene objects (particles, etc.)
    this.refreshCameraIgnore();
  }

  updateMinimapDots(playerCar, aiCar) {
    const worldW = TRACK_WIDTH * TILE_SIZE;
    const worldH = TRACK_HEIGHT * TILE_SIZE;

    this.playerDot.clear();
    this.playerDot.fillStyle(0x00ff00);
    this.playerDot.fillCircle(
      this.mmX + (playerCar.x / worldW) * this.mmW,
      this.mmY + (playerCar.y / worldH) * this.mmH,
      3
    );

    this.aiDot.clear();
    this.aiDot.fillStyle(0xff0000);
    this.aiDot.fillCircle(
      this.mmX + (aiCar.x / worldW) * this.mmW,
      this.mmY + (aiCar.y / worldH) * this.mmH,
      3
    );
  }

  destroy() {
    this.scene.cameras.remove(this.hudCamera);
    this.container.destroy();
  }
}
