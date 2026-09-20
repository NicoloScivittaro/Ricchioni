/**
 * Simulazione headless di RIBALTATI (kart) per BILANCIARE velocità e maneggevolezza con dati.
 *
 * Usa la PISTA reale (buildTrack) e la FISICA reale (stepKartPhysics + KART_CONFIG): niente copie.
 * Tre piloti simulati con sterzo on/off (come i tasti del telefono), ritardo di reazione e imprecisione:
 *   principiante · medio · esperto (usa drift e mini-turbo)
 *
 *   npx tsx scripts/kart-balance.ts
 *
 * Per ogni configurazione misura, su 3 giri: tempo, % di tempo fuori pista, colpi al muro, respawn.
 */
import { buildTrack, LAPS } from '../src/minigames/kart-race/track';
import { stepKartPhysics, KART_CONFIG } from '../src/minigames/kart-race/kartPhysics';
import type { KartInputSnapshot } from '../src/minigames/kart-race/kartPhysics';
import { createKartState } from '../src/minigames/kart-race/raceTypes';

type Cfg = typeof KART_CONFIG;

/** Copia profonda dei valori ORIGINALI (prima del bilanciamento): riferimento fisso per il confronto. */
export const ORIGINAL: Cfg = JSON.parse(JSON.stringify(KART_CONFIG));
ORIGINAL.maxSpeed = 62;
ORIGINAL.accel = 36;
ORIGINAL.maxTurnRate = 2.4;
ORIGINAL.highSpeedSteerLoss = 0;
ORIGINAL.boostSpeedGain = 0;
ORIGINAL.boostAccel = 40;
ORIGINAL.driftExtraRate = 1.15;

/** Valori attuali del gioco. */
export const CURRENT: Cfg = JSON.parse(JSON.stringify(KART_CONFIG));

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Driver {
  name: string;
  delay: number; // s di ritardo di reazione
  lookT: number; // s di anticipo sulla curva
  deadband: number; // rad di errore tollerato prima di sterzare
  noise: number; // probabilità/s di un "errore" (sterzo sbagliato per 0.2s)
  brakes: boolean; // rallenta prima delle curve strette
  drifts: boolean;
}
export const NOVICE: Driver = { name: 'principiante', delay: 0.3, lookT: 0.3, deadband: 0.09, noise: 0.35, brakes: false, drifts: false };
export const AVERAGE: Driver = { name: 'medio', delay: 0.2, lookT: 0.6, deadband: 0.05, noise: 0.15, brakes: true, drifts: false };
export const EXPERT: Driver = { name: 'esperto', delay: 0.12, lookT: 0.5, deadband: 0.03, noise: 0.03, brakes: true, drifts: true };

function wrap(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export interface RaceStat {
  time: number;
  finished: boolean;
  offRoadFrac: number;
  wallHits: number;
  respawns: number;
  avgSpeed: number;
  maxSpeed: number;
}

export function race(cfg: Cfg, driver: Driver, seed: number, timeCap = 300): RaceStat {
  // applica la config (in-place: gli array esportati restano gli stessi oggetti)
  Object.assign(KART_CONFIG, cfg);
  const spline = buildTrack();
  const half = (d: number): number => spline.widthAt(d) / 2;
  const angle = (d: number): number => spline.tangentAngleAt(d);
  const k = createKartState('p', null, '#ffffff', '🏎️');
  const rnd = rng(seed);
  k.lateral = 2.3;
  k.distance = -1;
  k.absHeading = angle(k.distance);

  const dt = 1 / 60;
  let t = 0;
  let offRoadT = 0;
  let wallHits = 0;
  let respawns = 0;
  let speedSum = 0;
  let maxSp = 0;
  // ritardo di reazione: coda di comandi
  const queue: KartInputSnapshot[] = [];
  const delaySteps = Math.round(driver.delay / dt);
  let errUntil = 0;
  let errDir = 0;
  let driftHeldFor = 0;
  const total = spline.totalLength;

  while (t < timeCap && k.distance < LAPS * total) {
    // ---- decisione (basata sullo stato ATTUALE; verrà applicata con ritardo) ----
    const v = Math.max(8, k.speed);
    const L = Math.max(6, v * driver.lookT);
    const ahead = angle(k.distance + L);
    const centerBias = -Math.max(-1, Math.min(1, k.lateral / Math.max(3, half(k.distance)))) * 0.28;
    const desired = ahead + centerBias;
    const err = wrap(desired - k.absHeading);
    let steer = 0;
    if (err > driver.deadband) steer = 1;
    else if (err < -driver.deadband) steer = -1;
    // errori umani: sterzo sbagliato / esitazione
    if (t >= errUntil && rnd() < driver.noise * dt) {
      errUntil = t + 0.2;
      errDir = rnd() < 0.5 ? -1 : 1;
    }
    if (t < errUntil) steer = errDir;

    // curvatura imminente → frenata (piloti medi/esperti): richiesta angolare = Δangolo tra ora e L avanti
    let up = true;
    let down = false;
    if (driver.brakes) {
      const dAng = Math.abs(wrap(angle(k.distance + L * 1.4) - angle(k.distance)));
      const needOmega = (dAng / (L * 1.4)) * v; // rad/s necessari a seguire la curva a questa velocità
      const turnCap = cfg.maxTurnRate * (1 - cfg.highSpeedSteerLoss * Math.min(1, v / cfg.maxSpeed) ** 2);
      if (needOmega > turnCap * 0.9) {
        up = false;
        down = needOmega > turnCap * 1.15 && k.speed > 30;
      }
    }
    // fuori pista: rallenta e rientra
    if (Math.abs(k.lateral) > half(k.distance)) {
      up = k.speed < 25;
      down = false;
    }
    // drift (esperto): solo in curva decisa e con sterzo coerente col verso della derapata (sterzare
    // contro il verso del drift lo rende lentissimo a rispondere); al rilascio parte il mini-turbo.
    let drift = false;
    if (driver.drifts) {
      const curveDelta = wrap(angle(k.distance + Math.max(20, v * 0.9)) - angle(k.distance));
      const curveDir = curveDelta > 0 ? 1 : -1;
      // entra in derapata solo in una curva vera e sterzando NEL verso della curva
      const wantDrift = Math.abs(curveDelta) > 0.3 && steer === curveDir && k.speed > cfg.driftMinSpeed + 4 && Math.abs(err) > 0.12;
      if (k.drifting) {
        // resta in derapata finché lo sterzo è coerente e c'è ancora da girare; poi rilascia (mini-turbo)
        drift = steer === k.driftDir && Math.abs(err) > 0.04 && driftHeldFor < 2.2;
      } else {
        drift = wantDrift;
      }
      if (drift) driftHeldFor += dt;
      else driftHeldFor = 0;
      // in derapata l'imbardata extra (driftExtraRate) fa già parte del giro: non sovrasterzare
      if (k.drifting && Math.abs(err) < driver.deadband * 3) steer = k.driftDir;
    }

    queue.push({ left: steer < 0, right: steer > 0, up, down, drift, item: false });
    const applied: KartInputSnapshot = queue.length > delaySteps ? queue.shift()! : { left: false, right: false, up: true, down: false, drift: false, item: false };

    const wasStunned = k.stunTimer > 0;
    const wasResp = k.respawnTimer > 0;
    stepKartPhysics(k, applied, dt, half, angle, false);
    if (!wasStunned && k.stunTimer > 0) wallHits++;
    if (!wasResp && k.respawnTimer > 0) respawns++;
    if (k.respawnTimer <= 0.001 && wasResp) {
      // come RaceManager: al termine del respawn riposiziona sull'ultimo checkpoint pulito
      k.distance = Math.max(0, Math.floor(k.distance / (total / 8)) * (total / 8));
      k.lateral = 0;
      k.absHeading = angle(k.distance);
      k.speed = 0;
      k.invulnTimer = 1.4;
    }
    if (Math.abs(k.lateral) > half(k.distance)) offRoadT += dt;
    speedSum += Math.abs(k.speed);
    maxSp = Math.max(maxSp, k.speed);
    t += dt;
  }
  return {
    time: t,
    finished: k.distance >= LAPS * total,
    offRoadFrac: offRoadT / t,
    wallHits,
    respawns,
    avgSpeed: speedSum / (t / dt),
    maxSpeed: maxSp
  };
}

export function measure(cfg: Cfg, driver: Driver, runs = 12): { time: number; finished: number; off: number; walls: number; resp: number; avg: number } {
  let time = 0;
  let fin = 0;
  let off = 0;
  let walls = 0;
  let resp = 0;
  let avg = 0;
  for (let i = 0; i < runs; i++) {
    const r = race(cfg, driver, 100 + i);
    time += r.time;
    fin += r.finished ? 1 : 0;
    off += r.offRoadFrac;
    walls += r.wallHits;
    resp += r.respawns;
    avg += r.avgSpeed;
  }
  return { time: time / runs, finished: fin / runs, off: off / runs, walls: walls / runs / LAPS, resp: resp / runs, avg: avg / runs };
}

export function report(label: string, cfg: Cfg): void {
  const sp = buildTrack();
  console.log(`\n=== ${label}: vmax ${cfg.maxSpeed} · accel ${cfg.accel} · sterzo ${cfg.maxTurnRate} (−${(cfg.highSpeedSteerLoss * 100).toFixed(0)}% a vel. piena) · drift +${cfg.driftExtraRate} · boost gain ${cfg.boostSpeedGain} ===`);
  console.log(`    pista: ${sp.totalLength.toFixed(0)} u/giro × ${LAPS} giri; giro ideale a vmax ≈ ${(sp.totalLength / cfg.maxSpeed).toFixed(1)} s`);
  for (const d of [NOVICE, AVERAGE, EXPERT]) {
    const m = measure(cfg, d);
    console.log(
      `  ${d.name.padEnd(12)} gara ${m.time.toFixed(0).padStart(3)}s · completa ${(m.finished * 100).toFixed(0).padStart(3)}% · fuori pista ${(m.off * 100).toFixed(0).padStart(2)}% · muro/giro ${m.walls.toFixed(1)} · respawn ${m.resp.toFixed(1)} · vel.media ${m.avg.toFixed(0)}`
    );
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/kart-balance.ts')) {
  report('PRIMA', ORIGINAL);
  report('DOPO', CURRENT);
}
