import { TRACK_MAP, TRACK_WIDTH, TRACK_HEIGHT, TILE_SIZE, DECORATIONS } from './trackData.js';

/**
 * Renders the tilemap track and decorations.
 */
export class TrackRenderer {

  constructor(scene) {
    this.scene = scene;
    this.trackLayer = scene.add.container(0, 0);
    this.decoLayer = scene.add.container(0, 0);
  }

  render() {
    this.renderTiles();
    this.renderDecorations();
  }

  renderTiles() {
    const tileTextures = {
      1: 'tile_road',
      2: 'tile_sidewalk',
      3: 'tile_startFinish',
      4: 'tile_building0',
      5: 'tile_building1',
      6: 'tile_building2',
      7: 'tile_building3',
      8: 'tile_grass',
    };

    for (let y = 0; y < TRACK_HEIGHT; y++) {
      for (let x = 0; x < TRACK_WIDTH; x++) {
        const tileId = TRACK_MAP[y][x];
        const texKey = tileTextures[tileId] || 'tile_building0';
        const sprite = this.scene.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          texKey
        );
        sprite.setDepth(0);
        this.trackLayer.add(sprite);
      }
    }
  }

  renderDecorations() {
    for (const deco of DECORATIONS) {
      let sprite;
      if (deco.type === 'tree') {
        sprite = this.createTree(deco.x, deco.y);
      } else if (deco.type === 'lamppost') {
        sprite = this.createLamppost(deco.x, deco.y);
      }
      if (sprite) {
        sprite.setDepth(1);
        this.decoLayer.add(sprite);
      }
    }
  }

  createTree(x, y) {
    const g = this.scene.add.graphics();
    // Trunk
    g.fillStyle(0x5a3a1a);
    g.fillRect(x - 3, y - 2, 6, 10);
    // Canopy
    g.fillStyle(0x228822);
    g.fillCircle(x, y - 6, 10);
    g.fillStyle(0x33aa33);
    g.fillCircle(x - 3, y - 8, 6);
    return g;
  }

  createLamppost(x, y) {
    const g = this.scene.add.graphics();
    // Pole
    g.fillStyle(0x666666);
    g.fillRect(x - 1, y - 16, 3, 20);
    // Light
    g.fillStyle(0xffee88);
    g.fillCircle(x, y - 18, 4);
    // Glow
    g.fillStyle(0xffee88, 0.2);
    g.fillCircle(x, y - 18, 8);
    return g;
  }

  /**
   * Check if a pixel coordinate is on the road (tiles 1 or 3)
   */
  isOnRoad(px, py) {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (tx < 0 || tx >= TRACK_WIDTH || ty < 0 || ty >= TRACK_HEIGHT) return false;
    const tile = TRACK_MAP[ty][tx];
    return tile === 1 || tile === 3;
  }

  /**
   * Get the tile type at pixel coordinates
   */
  getTileAt(px, py) {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (tx < 0 || tx >= TRACK_WIDTH || ty < 0 || ty >= TRACK_HEIGHT) return 0;
    return TRACK_MAP[ty][tx];
  }
}
