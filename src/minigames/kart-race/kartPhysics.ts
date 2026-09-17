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
const ACCEL = 36;
const BRAKE = 55;
const REVERSE_ACCEL = 22;
const MAX_REVERSE = -18;
const COAST_DRAG = 24; // decelerazione naturale (unità/s²) quando non si accelera né frena
const WHEEL_RADIUS = 0.31;

const MAX_TURN_RATE = 2.4; // rad/s di sterzata attiva (angolo ASSOLUTO, non relativo alla pista)
const DRIFT_EXTRA_RATE = 1.15; // rotazione extra durante la derapata
const CENTER_RATE_ONROAD = 0.6; // rad/s: quanto velocemente il kart si "auto-allinea" senza input
const CENTER_RATE_OFFROAD = 0.22;
const WALL_MARGIN = 0.55;

export const DRIFT_MIN_SPEED = 20;
export const DRIFT_THRESHOLDS: [number, number, number] = [0.55, 1.2, 2.1];
const DRIFT_T = DRIFT_THRESHOLDS;
const DRIFT_BOOST = [
  { power: 11, dur: 0.5 },
  { power: 17, dur: 0.9 },
  { power: 26, dur: 1.5 }
];

const OFFROAD_SPEED_FACTOR = 0.42;
const STUCK_SPEED = 4;
const OFFTRACK_STUCK_TIME = 2.2;
const RESPAWN_DELAY = 1;
const WALL_HIT_STUN = 0.18;

export function applyBoost(k: KartState, power: number, dur: number): void {
  if (power > k.boostPower) k.boostPower = power;
  k.boostTimer = Math.max(k.boostTimer, dur);
}

function releaseDrift(k: KartState): void {
  // Goblin — SO GUIDARE IO: driftBoostMultiplier > 1 durante la finestra attiva.
  if (k.driftCharge >= DRIFT_T[2]) applyBoost(k, DRIFT_BOOST[2].power * k.driftBoostMultiplier, DRIFT_BOOST[2].dur);
  else if (k.driftCharge >= DRIFT_T[1]) applyBoost(k, DRIFT_BOOST[1].power * k.driftBoostMultiplier, DRIFT_BOOST[1].dur);
  else if (k.driftCharge >= DRIFT_T[0]) applyBoost(k, DRIFT_BOOST[0].power * k.driftBoostMultiplier, DRIFT_BOOST[0].dur);
  k.drifting = false;
  k.driftCharge = 0;
  k.driftDir = 0;
}

function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

/**
 * Avanza la fisica arcade di un kart di un frame. Modello "ribbon-relative"
 * ma con imbardata ASSOLUTA persistente (k.absHeading), non relativa alla
 * tangente locale: se non sterzi, la direzione di marcia resta fissa e la
 * pista "gira sotto di te" in curva, spingendoti verso l'esterno — serve
 * sterzare attivamente per seguire una curva, niente pilota automatico.
 * k.heading (derivato ogni frame = absHeading - angolo tangente) resta il
 * valore che rendering/telecamera consumano, invariato per loro.
 */
export function stepKartPhysics(
  k: KartState,
  input: KartInputSnapshot,
  dt: number,
  halfWidthAt: (distance: number) => number,
  trackAngleAt: (distance: number) => number,
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
    // Curva di accelerazione arcade: parte pronta, si assottiglia avvicinandosi
    // al fondo scala, così il massimo si sente come un vero tetto da raggiungere.
    // accelMultiplier: Dottore "20 KG IN UN MESE" (kart leggerissimo).
    const speedFrac = Math.max(0, k.speed) / MAX_SPEED;
    k.speed += ACCEL * k.accelMultiplier * (1.35 - 0.55 * Math.min(1, speedFrac)) * dt;
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
  const centerRate = k.offRoad ? CENTER_RATE_OFFROAD : CENTER_RATE_ONROAD;
  const maxSpeed = (k.offRoad ? MAX_SPEED * OFFROAD_SPEED_FACTOR : MAX_SPEED) * k.speedCapMultiplier;
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
    // driftChargeRateMultiplier: Dottore "20 KG IN UN MESE" (deriva più facile).
    else k.driftCharge += dt * k.driftChargeRateMultiplier;
  }

  // --- Sterzata: velocità angolare ASSOLUTA (vedi commento sopra la funzione) ---
  const turnRate = MAX_TURN_RATE;
  if (!stunned) {
    k.absHeading += steerDir * turnRate * dt;
    if (k.drifting) k.absHeading += k.driftDir * DRIFT_EXTRA_RATE * dt;
  }

  let relHeading = wrapAngle(k.absHeading - trackAngleAt(k.distance));

  // Auto-allineamento naturale (grip) SOLO quando non si sterza attivamente:
  // previene una deriva laterale infinita su un rettilineo, restando comunque
  // molto più lento della curvatura di una curva vera (serve sterzare per
  // seguirla, non basta aspettare che il kart si raddrizzi da solo).
  if (!k.drifting && steerDir === 0) {
    const correction = relHeading * Math.min(1, centerRate * dt);
    k.absHeading -= correction;
    relHeading -= correction;
  }
  if (stunned) {
    const correction = relHeading * Math.min(1, 2 * dt);
    k.absHeading -= correction;
    relHeading -= correction;
  }

  relHeading = clamp(relHeading, -1.25, 1.25);
  k.heading = relHeading;

  // Avanzamento lungo il percorso e deriva laterale, scomposti rispetto alla
  // tangente locale della pista: se non sei allineato (curva non seguita),
  // avanzi di meno e scivoli di più verso il bordo — esattamente l'effetto
  // "serve sterzare in curva" richiesto.
  k.distance += k.speed * Math.cos(relHeading) * dt;
  k.lateral += k.speed * Math.sin(relHeading) * dt;
  if (k.distance < 0) k.distance = 0;

  // Collisione con le barriere: al bordo del cordolo, non 6 unità più in là.
  const wallLimit = half + WALL_MARGIN;
  if (Math.abs(k.lateral) > wallLimit) {
    const overshoot = Math.abs(k.lateral) - wallLimit;
    k.lateral = Math.sign(k.lateral) * wallLimit;
    k.speed *= 0.5;
    const straighten = relHeading * 0.6;
    k.absHeading -= straighten;
    k.heading -= straighten;
    if (overshoot > 0.15 && k.invulnTimer <= 0) {
      k.stunTimer = Math.max(k.stunTimer, WALL_HIT_STUN);
    }
  }

  // Fuori pista / bloccato troppo a lungo → richiedi respawn.
  const farOff = Math.abs(k.lateral) > half + 4;
  if (farOff && Math.abs(k.speed) < STUCK_SPEED) {
    k.offTrackTimer += dt;
    if (k.offTrackTimer > OFFTRACK_STUCK_TIME) {
      k.respawnTimer = RESPAWN_DELAY;
      k.offTrackTimer = 0;
    }
  } else {
    k.offTrackTimer = Math.max(0, k.offTrackTimer - dt * 2);
  }

  // --- Feedback puramente visivo (ruote anteriori che sterzano, rotolamento) ---
  const steerTarget = stunned ? 0 : steerDir;
  k.steerVisual += (steerTarget - k.steerVisual) * Math.min(1, 10 * dt);
  k.wheelSpin += (k.speed / WHEEL_RADIUS) * dt;
}

export function respawnKart(k: KartState, trackAngleAt: (distance: number) => number): void {
  k.distance = k.lastValidCheckpointS;
  k.lateral = 0;
  k.absHeading = trackAngleAt(k.distance);
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
