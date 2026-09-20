import type { KartState } from './raceTypes';

export interface KartInputSnapshot {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  drift: boolean;
  item: boolean;
}

/**
 * BILANCIAMENTO KART — tutti i valori in un posto solo (unità-pista/s, rad/s).
 * scripts/kart-balance.ts guida kart simulati sulla pista reale con QUESTI valori.
 */
export const KART_CONFIG = {
  /**
   * Velocità massima su asfalto (KART_MAX_SPEED). Prima: 62 — ma la curva più stretta della pista (raggio 25)
   * a 62 richiede 2,45 rad/s, PIÙ dello sterzo massimo (2,4): impossibile da seguire a tavoletta.
   * A 44 richiede 1,74 rad/s (~72% dello sterzo): passabile con margine per le correzioni.
   */
  maxSpeed: 44,
  /** Accelerazione di base (KART_ACCELERATION); vedi accelLow/accelHigh per la curva. Prima: 36. */
  accel: 30,
  /** Curva di accelerazione: parte a accelLow×accel, scende fino a accelHigh×accel al tetto. */
  accelLow: 1.35,
  accelHigh: 0.8,
  brake: 55,
  reverseAccel: 22,
  maxReverse: -18,
  /** Decelerazione naturale (unità/s²) quando non si accelera né frena. */
  coastDrag: 24,
  /** Sterzata attiva (KART_STEERING): rad/s di velocità angolare ASSOLUTA. Prima: 2.4. */
  maxTurnRate: 2.4,
  /**
   * Sterzo ad alta velocità: a velocità piena la sterzata scende a maxTurnRate×(1 - highSpeedSteerLoss)
   * (proporzionale al quadrato della velocità): meno zig-zag/sovrasterzo in rettilineo, il basso
   * velocità resta reattivo. 0 = nessuna riduzione (comportamento originale).
   */
  highSpeedSteerLoss: 0.2,
  /**
   * Rotazione extra durante la derapata (KART_DRIFT). Prima 1.15 (+48% di sterzo: sovrasterzava e
   * mandava fuori pista); ora 0.7: aiuta a chiudere la curva stretta senza far perdere il controllo.
   */
  driftExtraRate: 0.7,
  /** Auto-allineamento senza input (grip). */
  centerRateOnRoad: 0.6,
  centerRateOffRoad: 0.22,
  wallMargin: 0.55,
  driftMinSpeed: 20,
  /** Secondi di derapata per il mini-turbo di livello 1/2/3. */
  driftThresholds: [0.55, 1.2, 2.1] as [number, number, number],
  /** Potenza (unità di boostPower) e durata del mini-turbo per livello. */
  driftBoost: [
    { power: 11, dur: 0.5 },
    { power: 17, dur: 0.9 },
    { power: 26, dur: 1.5 }
  ],
  /**
   * Guadagno di velocità del boost: durante un boost il tetto sale a maxSpeed×(1 + boostSpeedGain×boostPower)
   * e il kart accelera verso di esso a boostAccel. Prima il boost era solo un PAVIMENTO di velocità (≤38)
   * sotto il tetto 62: a velocità di crociera non cambiava nulla. 0 = comportamento originale.
   */
  boostSpeedGain: 0.0075,
  boostAccel: 45,
  /** Fine boost / sovravelocità: rientro sul tetto normale in ~0.2-0.3s invece di uno scatto brusco (u/s²). */
  overspeedDecay: 60,
  offroadSpeedFactor: 0.42
};

export const MAX_SPEED = KART_CONFIG.maxSpeed; // solo per HUD/camera (frazione di velocità)
const WHEEL_RADIUS = 0.31;
export const DRIFT_MIN_SPEED = KART_CONFIG.driftMinSpeed;
export const DRIFT_THRESHOLDS = KART_CONFIG.driftThresholds;
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
  const T = KART_CONFIG.driftThresholds;
  const B = KART_CONFIG.driftBoost;
  if (k.driftCharge >= T[2]) applyBoost(k, B[2].power * k.driftBoostMultiplier, B[2].dur);
  else if (k.driftCharge >= T[1]) applyBoost(k, B[1].power * k.driftBoostMultiplier, B[1].dur);
  else if (k.driftCharge >= T[0]) applyBoost(k, B[0].power * k.driftBoostMultiplier, B[0].dur);
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
  const C = KART_CONFIG;
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
    const speedFrac = Math.max(0, k.speed) / C.maxSpeed;
    k.speed += C.accel * k.accelMultiplier * (C.accelLow - (C.accelLow - C.accelHigh) * Math.min(1, speedFrac)) * dt;
  } else if (down) {
    if (k.speed > 0.5) k.speed -= C.brake * dt;
    else k.speed = Math.max(C.maxReverse, k.speed - C.reverseAccel * dt);
  } else if (Math.abs(k.speed) > 0.01) {
    k.speed -= Math.sign(k.speed) * C.coastDrag * dt;
  } else {
    k.speed = 0;
  }

  // Boost: comportamento originale = pavimento di velocità (boostSpeedGain 0); con boostSpeedGain > 0
  // il tetto sale (breve e controllabile: lo sterzo resta attivo) e il kart ci accelera contro.
  let boostCap = 0;
  if (k.boostTimer > 0) {
    k.boostTimer = Math.max(0, k.boostTimer - dt);
    if (C.boostSpeedGain > 0) {
      boostCap = C.maxSpeed * (1 + C.boostSpeedGain * k.boostPower);
      if (k.speed < boostCap) k.speed = Math.min(boostCap, k.speed + C.boostAccel * dt);
    } else {
      k.speed = Math.max(k.speed, k.boostPower);
    }
  } else {
    k.boostPower = 0;
  }

  const half = halfWidthAt(k.distance);
  k.offRoad = Math.abs(k.lateral) > half;
  const centerRate = k.offRoad ? C.centerRateOffRoad : C.centerRateOnRoad;
  const roadCap = Math.max(C.maxSpeed, boostCap);
  const maxSpeed = (k.offRoad ? C.maxSpeed * C.offroadSpeedFactor : roadCap) * k.speedCapMultiplier;
  if (C.boostSpeedGain > 0 && !k.offRoad && k.speed > maxSpeed) {
    // Boost finito: atterraggio morbido sul tetto normale.
    k.speed = Math.max(maxSpeed, k.speed - C.overspeedDecay * dt);
    k.speed = Math.max(k.speed, C.maxReverse);
  } else {
    if (k.offRoad && k.speed > maxSpeed) k.speed -= (k.speed - maxSpeed) * Math.min(1, dt * 2);
    k.speed = clamp(k.speed, C.maxReverse, maxSpeed);
  }

  // --- Drift ---
  const wantsDrift = input.drift && !stunned && Math.abs(steerDir) > 0 && k.speed > C.driftMinSpeed;
  if (wantsDrift && !k.drifting) {
    k.drifting = true;
    k.driftDir = steerDir > 0 ? 1 : -1;
    k.driftCharge = 0;
  }
  if (k.drifting) {
    const stillValid = input.drift && k.speed > C.driftMinSpeed * 0.6 && Math.abs(steerDir) > 0;
    if (!stillValid) releaseDrift(k);
    // driftChargeRateMultiplier: Dottore "20 KG IN UN MESE" (deriva più facile).
    else k.driftCharge += dt * k.driftChargeRateMultiplier;
  }

  // --- Sterzata: velocità angolare ASSOLUTA (vedi commento sopra la funzione) ---
  const speedFracForSteer = Math.min(1, Math.abs(k.speed) / C.maxSpeed);
  const turnRate = C.maxTurnRate * (1 - C.highSpeedSteerLoss * speedFracForSteer * speedFracForSteer);
  if (!stunned) {
    k.absHeading += steerDir * turnRate * dt;
    if (k.drifting) k.absHeading += k.driftDir * C.driftExtraRate * dt;
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
  const wallLimit = half + C.wallMargin;
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
