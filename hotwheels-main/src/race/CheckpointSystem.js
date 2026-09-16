import { CHECKPOINT_GATES, TILE_SIZE } from '../track/trackData.js';

/**
 * Tracks laps and checkpoints for both cars.
 * Uses line-segment gates placed across straight sections of the track.
 * Gate 0 = finish line. Gates 1+ = mid-track checkpoints.
 * Detection: checks if the car's movement vector crosses the gate line each frame.
 */
export class CheckpointSystem {

  constructor(scene, totalLaps = 3) {
    this.scene = scene;
    this.totalLaps = totalLaps;

    this.finishGate = CHECKPOINT_GATES[0];
    this.midGates = CHECKPOINT_GATES.slice(1);

    this.cars = new Map();
  }

  registerCar(car, id) {
    this.cars.set(id, {
      car,
      prevX: car.x,
      prevY: car.y,
      nextMidGate: 0,
      allMidPassed: false,
      lap: 0,
      lapTimes: [],
      lapStartTime: 0,
      totalTime: 0,
      finished: false,
      leftStart: false
    });
  }

  startRace() {
    const now = this.scene.time.now;
    for (const state of this.cars.values()) {
      state.lapStartTime = now;
      state.lap = 0;
      state.nextMidGate = 0;
      state.allMidPassed = false;
      state.leftStart = false;
      state.prevX = state.car.x;
      state.prevY = state.car.y;
    }
  }

  /**
   * Do line segments (a1→a2) and (b1→b2) intersect?
   */
  segmentsCross(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    const d1 = this.side(bx1, by1, bx2, by2, ax1, ay1);
    const d2 = this.side(bx1, by1, bx2, by2, ax2, ay2);
    const d3 = this.side(ax1, ay1, ax2, ay2, bx1, by1);
    const d4 = this.side(ax1, ay1, ax2, ay2, bx2, by2);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    // Collinear / touching cases — treat as crossing
    if (d1 === 0 && this.onSegment(bx1, by1, bx2, by2, ax1, ay1)) return true;
    if (d2 === 0 && this.onSegment(bx1, by1, bx2, by2, ax2, ay2)) return true;
    return false;
  }

  side(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  }

  onSegment(px, py, qx, qy, rx, ry) {
    return Math.min(px, qx) <= rx && rx <= Math.max(px, qx) &&
           Math.min(py, qy) <= ry && ry <= Math.max(py, qy);
  }

  carCrossedGate(prevX, prevY, curX, curY, gate) {
    return this.segmentsCross(
      prevX, prevY, curX, curY,
      gate.x1, gate.y1, gate.x2, gate.y2
    );
  }

  update() {
    for (const [id, state] of this.cars.entries()) {
      if (state.finished) continue;

      const curX = state.car.x;
      const curY = state.car.y;

      // Must leave the finish area before we accept a finish-line crossing
      if (!state.leftStart) {
        const dx = curX - this.finishGate.x1;
        const dy = curY - ((this.finishGate.y1 + this.finishGate.y2) / 2);
        if (Math.sqrt(dx * dx + dy * dy) > 3 * TILE_SIZE) {
          state.leftStart = true;
        }
      }

      // Check mid-gate crossings in order
      if (!state.allMidPassed && state.nextMidGate < this.midGates.length) {
        const gate = this.midGates[state.nextMidGate];
        if (this.carCrossedGate(state.prevX, state.prevY, curX, curY, gate)) {
          state.nextMidGate++;
          if (state.nextMidGate >= this.midGates.length) {
            state.allMidPassed = true;
          }
        }
      }

      // Check finish line
      if (state.allMidPassed && state.leftStart) {
        if (this.carCrossedGate(state.prevX, state.prevY, curX, curY, this.finishGate)) {
          state.lap++;
          const now = this.scene.time.now;
          const lapTime = now - state.lapStartTime;
          state.lapTimes.push(lapTime);
          state.lapStartTime = now;

          if (state.lap >= this.totalLaps) {
            state.finished = true;
            state.totalTime = state.lapTimes.reduce((a, b) => a + b, 0);
          } else {
            this.scene.showLapNotification(id, state.lap);
          }

          // Reset for next lap
          state.nextMidGate = 0;
          state.allMidPassed = false;
          state.leftStart = false;
        }
      }

      // Store for next frame
      state.prevX = curX;
      state.prevY = curY;
    }
  }

  getLap(id) {
    const state = this.cars.get(id);
    return state ? state.lap : 0;
  }

  getTotalLaps() {
    return this.totalLaps;
  }

  isFinished(id) {
    const state = this.cars.get(id);
    return state ? state.finished : false;
  }

  getResults(id) {
    const state = this.cars.get(id);
    if (!state) return null;
    return {
      totalTime: state.totalTime,
      lapTimes: state.lapTimes,
      bestLap: state.lapTimes.length > 0 ? Math.min(...state.lapTimes) : 0
    };
  }

  getProgress(id) {
    const state = this.cars.get(id);
    if (!state) return 0;
    const total = this.midGates.length + 1;
    const gateProgress = state.nextMidGate / total;
    const finishBonus = state.allMidPassed ? this.midGates.length / total : 0;
    return state.lap + Math.max(gateProgress, finishBonus);
  }

  getPosition(id) {
    const entries = [...this.cars.entries()];
    if (entries.length < 2) return 1;
    const [id1] = entries[0];
    const [id2] = entries[1];
    const prog1 = this.getProgress(id1);
    const prog2 = this.getProgress(id2);
    if (id === id1) return prog1 >= prog2 ? 1 : 2;
    return prog2 >= prog1 ? 1 : 2;
  }
}
