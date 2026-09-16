import type { KartState } from './raceTypes';

export interface KartInputSnapshot {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  drift: boolean;
  item: boolean;
}

export const MAX_SPEED = 62;
const ACCEL = 34;
const BRAKE = 55;
const REVERSE_ACCEL = 22;
const MAX_REVERSE = -18;
const COAST_DRAG = 20; // decelerazione naturale (unità/s²) quando non si accelera né frena

const MAX_STEER_ANGLE = 0.42; // angolo bersaglio (rad) in guida normale, a piena velocità
const GRIP_ONROAD = 1;
const GRIP_OFFROAD = 0.45;
const OFFROAD_SPEED_FACTOR = 0.42;
const WALL_MARGIN = 1.6;

export const DRIFT_MIN_SPEED = 20;
const DRIFT_HEADING_EXTRA = 0.5;
export const DRIFT_THRESHOLDS: [number, number, number] = [0.55, 1.2, 2.1];
const DRIFT_T = DRIFT_THRESHOLDS;
const DRIFT_BOOST = [
  { power: 11, dur: 0.5 },
  { power: 17, dur: 0.9 },
  { power: 26, dur: 1.5 }
];

const STUCK_SPEED = 4;
const OFFTRACK_STUCK_TIME = 2.2;
const RESPAWN_DELAY = 1;

export function applyBoost(k: KartState, power: number, dur: number): void {
  if (power > k.boostPower) k.boostPower = power;
  k.boostTimer = Math.max(k.boostTimer, dur);
}

function releaseDrift(k: KartState): void {
  if (k.driftCharge >= DRIFT_T[2]) applyBoost(k, DRIFT_BOOST[2].power, DRIFT_BOOST[2].dur);
  else if (k.driftCharge >= DRIFT_T[1]) applyBoost(k, DRIFT_BOOST[1].power, DRIFT_BOOST[1].dur);
  else if (k.driftCharge >= DRIFT_T[0]) applyBoost(k, DRIFT_BOOST[0].power, DRIFT_BOOST[0].dur);
  k.drifting = false;
  k.driftCharge = 0;
  k.driftDir = 0;
}

/**
 * Avanza la fisica arcade di un kart di un frame. Il modello è "ribbon-relative":
 * la posizione è (distanza percorsa lungo la spline, offset laterale, imbardata
 * relativa alla tangente) invece di una rigid-body 3D piena — economico, robusto
 * per split-screen multiplo, ed elimina strutturalmente le scorciatoie (non si
 * può avanzare lungo il percorso se non guidando in avanti).
 */
export function stepKartPhysics(
  k: KartState,
  input: KartInputSnapshot,
  dt: number,
  halfWidthAt: (distance: number) => number,
  invertSteer: boolean
): void {
  if (k.respawnTimer > 0) {
    k.respawnTimer -= dt;
    k.speed = 0;
    return;
  }

  const stunned = k.stunTimer > 0;
  if (stunned) k.stunTimer = Math.max(0, k.stunTimer - dt);
  if (k.invulnTimer > 0) k.invulnTimer = Math.max(0, k.invulnTimer - dt);
  if (k.disturbTimer > 0) k.disturbTimer = Math.max(0, k.disturbTimer - dt);

  let steerDir = stunned ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (invertSteer) steerDir *= -1;
  if (k.disturbTimer > 0) steerDir *= -1;

  const up = !stunned && input.up;
  const down = !stunned && input.down;

  if (up) {
    k.speed += ACCEL * dt;
  } else if (down) {
    if (k.speed > 0.5) k.speed -= BRAKE * dt;
    else k.speed = Math.max(MAX_REVERSE, k.speed - REVERSE_ACCEL * dt);
  } else if (Math.abs(k.speed) > 0.01) {
    k.speed -= Math.sign(k.speed) * COAST_DRAG * dt;
  } else {
    k.speed = 0;
  }

  if (k.boostTimer > 0) {
    k.boostTimer = Math.max(0, k.boostTimer - dt);
    k.speed = Math.max(k.speed, k.boostPower);
  } else {
    k.boostPower = 0;
  }

  const half = halfWidthAt(k.distance);
  k.offRoad = Math.abs(k.lateral) > half;
  const grip = k.offRoad ? GRIP_OFFROAD : GRIP_ONROAD;
  const maxSpeed = k.offRoad ? MAX_SPEED * OFFROAD_SPEED_FACTOR : MAX_SPEED;
  if (k.offRoad && k.speed > maxSpeed) k.speed -= (k.speed - maxSpeed) * Math.min(1, dt * 2);
  k.speed = clamp(k.speed, MAX_REVERSE, maxSpeed);

  // --- Drift ---
  const wantsDrift = input.drift && !stunned && Math.abs(steerDir) > 0 && k.speed > DRIFT_MIN_SPEED;
  if (wantsDrift && !k.drifting) {
    k.drifting = true;
    k.driftDir = steerDir > 0 ? 1 : -1;
    k.driftCharge = 0;
  }
  if (k.drifting) {
    const stillValid = input.drift && k.speed > DRIFT_MIN_SPEED * 0.6 && Math.abs(steerDir) > 0;
    if (!stillValid) releaseDrift(k);
    else k.driftCharge += dt;
  }

  // --- Sterzata / imbardata (dipendente dalla velocità) ---
  // Modello a "angolo target": l'imbardata insegue un angolo bersaglio invece di
  // accumularsi liberamente. Risultato: risposta immediata e prevedibile, e un
  // rilascio dello sterzo che ricentra rapidamente invece di continuare a scivolare.
  const speedFactor = clamp(Math.abs(k.speed) / MAX_SPEED, 0.3, 1);
  const targetHeading = k.drifting ? k.driftDir * DRIFT_HEADING_EXTRA : steerDir * MAX_STEER_ANGLE * speedFactor;
  const responsiveness = (k.drifting ? 3.4 : 9) * grip;

  if (!stunned) k.heading += (targetHeading - k.heading) * Math.min(1, responsiveness * dt);
  else k.heading += (0 - k.heading) * Math.min(1, 3 * dt);
  k.heading = clamp(k.heading, -1.15, 1.15);

  // La componente laterale della velocità nasce dall'imbardata (modello bicicletta semplificato).
  const lateralSpeed = Math.sin(k.heading) * k.speed;
  k.lateral += lateralSpeed * dt;

  // Collisione con i muri esterni: clamp + perdita di velocità.
  const wallLimit = half + WALL_MARGIN * 4;
  if (Math.abs(k.lateral) > wallLimit) {
    k.lateral = Math.sign(k.lateral) * wallLimit;
    k.speed *= 0.55;
    k.heading *= 0.3;
  }

  // Fuori pista / bloccato troppo a lungo → richiedi respawn.
  const farOff = Math.abs(k.lateral) > half + WALL_MARGIN * 2.2;
  if (farOff && Math.abs(k.speed) < STUCK_SPEED) {
    k.offTrackTimer += dt;
    if (k.offTrackTimer > OFFTRACK_STUCK_TIME) {
      k.respawnTimer = RESPAWN_DELAY;
      k.offTrackTimer = 0;
    }
  } else {
    k.offTrackTimer = Math.max(0, k.offTrackTimer - dt * 2);
  }

  k.distance += k.speed * dt;
  if (k.distance < 0) k.distance = 0;
}

export function respawnKart(k: KartState): void {
  k.distance = k.lastValidCheckpointS;
  k.lateral = 0;
  k.heading = 0;
  k.speed = 0;
  k.driftCharge = 0;
  k.drifting = false;
  k.boostTimer = 0;
  k.invulnTimer = 1.4;
  k.respawnTimer = 0;
  k.offTrackTimer = 0;
}

export function hitKart(k: KartState, stunDur: number): boolean {
  if (k.shielded) {
    k.shielded = false;
    return false;
  }
  if (k.invulnTimer > 0) return false;
  k.stunTimer = Math.max(k.stunTimer, stunDur);
  k.speed *= 0.35;
  if (k.drifting) {
    k.drifting = false;
    k.driftCharge = 0;
  }
  return true;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
