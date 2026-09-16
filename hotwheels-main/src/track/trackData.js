/**
 * Track layout for the city circuit.
 *
 * The track is defined as a series of waypoints forming a closed loop.
 * Buildings and decorations fill the space around the track.
 *
 * Tile legend:
 * 0 = empty/building area
 * 1 = road
 * 2 = sidewalk
 * 3 = start/finish line
 * 4 = building type 0
 * 5 = building type 1
 * 6 = building type 2
 * 7 = building type 3
 * 8 = grass/park
 */

export const TILE_SIZE = 64;

// Track is 40x40 tiles = 2560x2560 pixels
export const TRACK_WIDTH = 40;
export const TRACK_HEIGHT = 40;

// The tilemap — city circuit with curves and 90-degree turns
// Track is 3-4 tiles wide for comfortable racing
export const TRACK_MAP = generateTrackMap();

function generateTrackMap() {
  // Initialize with buildings
  const map = [];
  for (let y = 0; y < TRACK_HEIGHT; y++) {
    map[y] = [];
    for (let x = 0; x < TRACK_WIDTH; x++) {
      map[y][x] = 4 + ((x * 3 + y * 7) % 4); // varied buildings
    }
  }

  // Helper to carve road
  function setRoad(x, y) {
    if (x >= 0 && x < TRACK_WIDTH && y >= 0 && y < TRACK_HEIGHT) {
      map[y][x] = 1;
    }
  }
  function setSidewalk(x, y) {
    if (x >= 0 && x < TRACK_WIDTH && y >= 0 && y < TRACK_HEIGHT && map[y][x] !== 1 && map[y][x] !== 3) {
      map[y][x] = 2;
    }
  }
  function setStartFinish(x, y) {
    if (x >= 0 && x < TRACK_WIDTH && y >= 0 && y < TRACK_HEIGHT) {
      map[y][x] = 3;
    }
  }
  function setGrass(x, y) {
    if (x >= 0 && x < TRACK_WIDTH && y >= 0 && y < TRACK_HEIGHT && map[y][x] !== 1 && map[y][x] !== 2 && map[y][x] !== 3) {
      map[y][x] = 8;
    }
  }

  // Carve road with sidewalk borders
  function carveHorizontal(y, x1, x2, width = 3) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      for (let w = 0; w < width; w++) {
        setRoad(x, y + w);
      }
      setSidewalk(x, y - 1);
      setSidewalk(x, y + width);
    }
  }

  function carveVertical(x, y1, y2, width = 3) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      for (let w = 0; w < width; w++) {
        setRoad(x + w, y);
      }
      setSidewalk(x - 1, y);
      setSidewalk(x + width, y);
    }
  }

  function carveCorner(cx, cy, width = 3) {
    for (let dy = 0; dy < width; dy++) {
      for (let dx = 0; dx < width; dx++) {
        setRoad(cx + dx, cy + dy);
      }
    }
    // Sidewalk around corner
    for (let d = -1; d <= width; d++) {
      setSidewalk(cx + d, cy - 1);
      setSidewalk(cx + d, cy + width);
      setSidewalk(cx - 1, cy + d);
      setSidewalk(cx + width, cy + d);
    }
  }

  // === TRACK LAYOUT ===
  // A city circuit loop approx 2560px perimeter target
  // The track goes:
  // Start/finish on bottom straight, go right, turn up,
  // long straight up, curve left, across the top,
  // S-bend down-left, straight down, turn right at bottom back to start

  // Bottom straight (start/finish area) - y=32, x from 8 to 22
  carveHorizontal(32, 8, 22);

  // Start/finish line at x=14,15,16
  setStartFinish(14, 32);
  setStartFinish(14, 33);
  setStartFinish(14, 34);

  // Bottom-right corner - turn up at x=22
  carveCorner(22, 32);

  // Right straight going up - x=22, y from 10 to 32
  carveVertical(22, 10, 32);

  // Top-right corner - turn left at y=10
  carveCorner(22, 10);

  // Top straight going left - y=10, x from 8 to 22
  carveHorizontal(10, 8, 24);

  // Chicane/S-bend section in the top area
  // Slight jog: go up 2 tiles at x=12-14
  carveVertical(12, 7, 10);
  carveCorner(12, 7);

  // Short horizontal at y=7, x from 8 to 12
  carveHorizontal(7, 8, 14);

  // Back down at x=8
  carveCorner(8, 7);
  carveVertical(8, 7, 12);
  carveCorner(8, 10);

  // Left straight going down - x=8, y from 10 to 32
  carveVertical(8, 12, 32);

  // Bottom-left corner
  carveCorner(8, 32);

  // Add a small park in the center of the track
  for (let y = 16; y < 28; y++) {
    for (let x = 14; x < 20; x++) {
      setGrass(x, y);
    }
  }

  return map;
}

// Waypoints define the racing line (centerline of the track)
// Used by AI and for lap/checkpoint tracking
// Format: { x, y } in pixel coordinates (center of the tile)
export const WAYPOINTS = [
  // Start/finish straight (moving right)
  { x: 14.5 * TILE_SIZE, y: 33.5 * TILE_SIZE },
  { x: 16 * TILE_SIZE, y: 33.5 * TILE_SIZE },
  { x: 18 * TILE_SIZE, y: 33.5 * TILE_SIZE },
  { x: 20 * TILE_SIZE, y: 33.5 * TILE_SIZE },

  // Bottom-right corner (turning up)
  { x: 22.5 * TILE_SIZE, y: 33.5 * TILE_SIZE },
  { x: 23.5 * TILE_SIZE, y: 32 * TILE_SIZE },

  // Right straight (going up)
  { x: 23.5 * TILE_SIZE, y: 28 * TILE_SIZE },
  { x: 23.5 * TILE_SIZE, y: 24 * TILE_SIZE },
  { x: 23.5 * TILE_SIZE, y: 20 * TILE_SIZE },
  { x: 23.5 * TILE_SIZE, y: 16 * TILE_SIZE },
  { x: 23.5 * TILE_SIZE, y: 13 * TILE_SIZE },

  // Top-right corner (turning left)
  { x: 23.5 * TILE_SIZE, y: 11.5 * TILE_SIZE },
  { x: 22 * TILE_SIZE, y: 11.5 * TILE_SIZE },

  // Top straight (going left)
  { x: 20 * TILE_SIZE, y: 11.5 * TILE_SIZE },
  { x: 18 * TILE_SIZE, y: 11.5 * TILE_SIZE },
  { x: 16 * TILE_SIZE, y: 11.5 * TILE_SIZE },

  // S-bend chicane
  { x: 14 * TILE_SIZE, y: 11.5 * TILE_SIZE },
  { x: 13.5 * TILE_SIZE, y: 10 * TILE_SIZE },
  { x: 13.5 * TILE_SIZE, y: 8.5 * TILE_SIZE },
  { x: 12 * TILE_SIZE, y: 8.5 * TILE_SIZE },
  { x: 10 * TILE_SIZE, y: 8.5 * TILE_SIZE },
  { x: 9.5 * TILE_SIZE, y: 10 * TILE_SIZE },
  { x: 9.5 * TILE_SIZE, y: 11.5 * TILE_SIZE },

  // Left straight (going down)
  { x: 9.5 * TILE_SIZE, y: 14 * TILE_SIZE },
  { x: 9.5 * TILE_SIZE, y: 18 * TILE_SIZE },
  { x: 9.5 * TILE_SIZE, y: 22 * TILE_SIZE },
  { x: 9.5 * TILE_SIZE, y: 26 * TILE_SIZE },
  { x: 9.5 * TILE_SIZE, y: 30 * TILE_SIZE },

  // Bottom-left corner (turning right)
  { x: 9.5 * TILE_SIZE, y: 33.5 * TILE_SIZE },
  { x: 11 * TILE_SIZE, y: 33.5 * TILE_SIZE },

  // Back to start
  { x: 12.5 * TILE_SIZE, y: 33.5 * TILE_SIZE },
];

// Start positions (side-by-side)
export const START_POSITIONS = {
  player: { x: 13.5 * TILE_SIZE, y: 34 * TILE_SIZE, angle: 0 },
  ai: { x: 15.5 * TILE_SIZE, y: 34 * TILE_SIZE, angle: 0 }
};

// Item box locations (3-4 strategic positions on the track)
export const ITEM_BOX_POSITIONS = [
  { x: 19 * TILE_SIZE, y: 33.5 * TILE_SIZE },   // Bottom straight (before right turn)
  { x: 23.5 * TILE_SIZE, y: 18 * TILE_SIZE },    // Right straight (mid-way)
  { x: 17 * TILE_SIZE, y: 11.5 * TILE_SIZE },    // Top straight (before chicane)
  { x: 9.5 * TILE_SIZE, y: 24 * TILE_SIZE },     // Left straight (mid-way)
];

// Checkpoint indices (legacy, used by old system)
export const CHECKPOINT_INDICES = [0, 5, 11, 17, 23, 28];

// Checkpoint gates — lines spanning the full road width.
// Each gate: { x1, y1, x2, y2 } endpoints of a line across the road.
// Placed on straight sections so every car MUST cross them.
// Gate 0 = finish line, gates 1-4 = mid-track checkpoints.
//
// Track roads:
//   Bottom straight: y=32-34, x=8-22 (horizontal)
//   Right straight:  x=22-24, y=10-32 (vertical)
//   Top straight:    y=10-12, x=8-24  (horizontal)
//   Left straight:   x=8-10,  y=10-32 (vertical)
export const CHECKPOINT_GATES = [
  // Gate 0: FINISH LINE — vertical line across bottom straight at x=14
  { x1: 14 * TILE_SIZE, y1: 31 * TILE_SIZE, x2: 14 * TILE_SIZE, y2: 35 * TILE_SIZE },
  // Gate 1: Right straight mid — horizontal line at y=20
  { x1: 21 * TILE_SIZE, y1: 20 * TILE_SIZE, x2: 25 * TILE_SIZE, y2: 20 * TILE_SIZE },
  // Gate 2: Top straight mid — vertical line at x=18
  { x1: 18 * TILE_SIZE, y1: 9 * TILE_SIZE, x2: 18 * TILE_SIZE, y2: 13 * TILE_SIZE },
  // Gate 3: Left straight mid — horizontal line at y=22
  { x1: 7 * TILE_SIZE, y1: 22 * TILE_SIZE, x2: 11 * TILE_SIZE, y2: 22 * TILE_SIZE },
  // Gate 4: Bottom straight before finish — vertical line at x=11 (after the left corner)
  { x1: 11 * TILE_SIZE, y1: 31 * TILE_SIZE, x2: 11 * TILE_SIZE, y2: 35 * TILE_SIZE },
];

// Decorations placed around the track
export const DECORATIONS = [
  // Lampposts along the right straight
  { type: 'lamppost', x: 26 * TILE_SIZE, y: 15 * TILE_SIZE },
  { type: 'lamppost', x: 26 * TILE_SIZE, y: 22 * TILE_SIZE },
  { type: 'lamppost', x: 26 * TILE_SIZE, y: 29 * TILE_SIZE },
  // Lampposts along the left straight
  { type: 'lamppost', x: 6 * TILE_SIZE, y: 15 * TILE_SIZE },
  { type: 'lamppost', x: 6 * TILE_SIZE, y: 22 * TILE_SIZE },
  { type: 'lamppost', x: 6 * TILE_SIZE, y: 29 * TILE_SIZE },
  // Trees in center park
  { type: 'tree', x: 15 * TILE_SIZE, y: 18 * TILE_SIZE },
  { type: 'tree', x: 17 * TILE_SIZE, y: 20 * TILE_SIZE },
  { type: 'tree', x: 16 * TILE_SIZE, y: 24 * TILE_SIZE },
  { type: 'tree', x: 18 * TILE_SIZE, y: 22 * TILE_SIZE },
];
