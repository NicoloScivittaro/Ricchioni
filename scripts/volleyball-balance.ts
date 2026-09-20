/**
 * Simulazione headless di PALLAVOLO DEI DISAGIATI per BILANCIARE la velocità della palla con dati.
 *
 * Fisica e regole di colpo portate da BabylonVolleyballGame (stepPlayer / tryHit / updateBall) usando
 * gli STESSI costanti e le STESSE funzioni pure di volleyballTypes.ts (hitDirection, clampBallSpeed).
 *
 *   npx tsx scripts/volleyball-balance.ts            # confronta PRIMA (valori originali) e DOPO (config attuale)
 *
 * Tre misure:
 *  1) SMASH: difensori in formazione, attaccante schiaccia da rete → quanti smash vengono difesi e in quanti
 *     secondi atterra la palla (finestra di reazione).
 *  2) COLPO NORMALE: colpo dal fondo campo → tempo di volo, se supera la rete, quanti vengono ricevuti.
 *  3) SCAMBI: 1v1 / 2v2 / 3v2 con giocatori-IA di tre livelli → tocchi per scambio.
 */
import {
  ACCEL,
  MAX_SPEED,
  FRICTION,
  JUMP_VY,
  GRAVITY,
  HIT_RADIUS,
  HIT_REACH,
  HIT_COOLDOWN,
  NET_HEIGHT,
  PLAYER_RADIUS,
  FIELD_HALF_W,
  FIELD_HALF_D,
  HANDICAP,
  BALL_GRAVITY,
  BALL_NORMAL_UP,
  BALL_NORMAL_SPEED,
  BALL_SMASH_DOWN,
  BALL_SMASH_SPEED,
  BALL_SERVE_UP,
  BALL_SERVE_SPEED,
  BALL_MAX_SPEED,
  BALL_MAX_HSPEED,
  BALL_AIM_ASSIST,
  BALL_AIM_MAX,
  clampBallSpeed,
  hitDirection
} from '../src/minigames/volleyball/volleyballTypes';

export interface Cfg {
  label: string;
  ballG: number;
  normalUp: number;
  normalSpeed: number;
  smashDown: number;
  smashSpeed: number;
  serveUp: number;
  serveSpeed: number;
  maxSpeed: number;
  maxH: number;
  aimAssist: number;
  aimMax: number;
  /** false = comportamento originale: vx = -x*0.12*speed (velocità orizzontale dipendente da |x|) */
  normalizeAim: boolean;
}

/** Valori ORIGINALI (prima del bilanciamento) — riferimento fisso per il confronto. */
export const BEFORE: Cfg = {
  label: 'PRIMA',
  ballG: 22,
  normalUp: 9,
  normalSpeed: 8,
  smashDown: -7.5,
  smashSpeed: 15,
  serveUp: 10,
  serveSpeed: 9,
  maxSpeed: 1000,
  maxH: 1000,
  aimAssist: 0.12,
  aimMax: 99,
  normalizeAim: false
};

/** Valori attuali del gioco (importati dal file di config reale). */
export const AFTER: Cfg = {
  label: 'DOPO',
  ballG: BALL_GRAVITY,
  normalUp: BALL_NORMAL_UP,
  normalSpeed: BALL_NORMAL_SPEED,
  smashDown: BALL_SMASH_DOWN,
  smashSpeed: BALL_SMASH_SPEED,
  serveUp: BALL_SERVE_UP,
  serveSpeed: BALL_SERVE_SPEED,
  maxSpeed: BALL_MAX_SPEED,
  maxH: BALL_MAX_HSPEED,
  aimAssist: BALL_AIM_ASSIST,
  aimMax: BALL_AIM_MAX,
  normalizeAim: true
};

type Team = 'red' | 'blue';
interface P {
  team: Team;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  cd: number;
  speedMult: number;
  jumpMult: number;
  cdMult: number;
  home: { x: number; z: number };
  decidedFor: number;
  attacking: boolean;
}
interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

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

export interface Profile {
  name: string;
  reactDelay: number; // s prima di muoversi dopo il colpo avversario
  predictErr: number; // m di errore nella stima del punto di caduta
  attack: number; // probabilità di andare a rete a schiacciare
  hitJitter: number;
}
// Giocatori umani con joystick su telefono: percezione + latenza ≈ 0,4-0,7 s prima di muoversi, stima del
// punto di caduta approssimativa (errori di 1-3 m), pressione del tasto "colpisci" non sempre perfetta.
export const NOVICE: Profile = { name: 'principiante', reactDelay: 0.7, predictErr: 3.0, attack: 0.15, hitJitter: 0.4 };
export const AVERAGE: Profile = { name: 'medio', reactDelay: 0.5, predictErr: 2.0, attack: 0.4, hitJitter: 0.25 };
export const SHARP: Profile = { name: 'bravo', reactDelay: 0.35, predictErr: 1.2, attack: 0.7, hitJitter: 0.12 };

// ---------- fisica condivisa ----------

function hitVelocity(cfg: Cfg, ballX: number, dirZ: number, smash: boolean): { vx: number; vy: number; vz: number } {
  const speed = smash ? cfg.smashSpeed : cfg.normalSpeed;
  let vx: number;
  let vz: number;
  if (cfg.normalizeAim) {
    const d = hitDirection(ballX, dirZ, cfg.aimAssist, cfg.aimMax);
    vx = d.dx * speed;
    vz = d.dz * speed;
  } else {
    vx = -ballX * cfg.aimAssist * speed;
    vz = dirZ * speed;
  }
  return { vx, vy: smash ? cfg.smashDown : cfg.normalUp, vz };
}

function stepBall(ball: Ball, cfg: Cfg, dt: number): 'land' | 'net' | null {
  const prevZ = ball.z;
  ball.vy -= cfg.ballG * dt;
  clampBallSpeed(ball, cfg.maxSpeed, cfg.maxH);
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;
  let ev: 'land' | 'net' | null = null;
  if ((prevZ < 0 && ball.z >= 0) || (prevZ > 0 && ball.z <= 0)) {
    if (ball.y < NET_HEIGHT) {
      ball.z = prevZ;
      ball.vz = -ball.vz * 0.55;
      ball.vx *= 0.8;
      ev = 'net';
    }
  }
  if (ball.x > FIELD_HALF_W) {
    ball.x = FIELD_HALF_W;
    ball.vx = -Math.abs(ball.vx);
  } else if (ball.x < -FIELD_HALF_W) {
    ball.x = -FIELD_HALF_W;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.z > FIELD_HALF_D) {
    ball.z = FIELD_HALF_D;
    ball.vz = -Math.abs(ball.vz);
  } else if (ball.z < -FIELD_HALF_D) {
    ball.z = -FIELD_HALF_D;
    ball.vz = Math.abs(ball.vz);
  }
  if (ball.y <= 0) return 'land';
  return ev;
}

function newPlayer(team: Team, x: number, z: number, handicapped: boolean): P {
  return {
    team,
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    cd: 0,
    speedMult: handicapped ? HANDICAP.speedMult : 1,
    jumpMult: handicapped ? HANDICAP.jumpMult : 1,
    cdMult: handicapped ? HANDICAP.hitCooldownMult : 1,
    home: { x, z },
    decidedFor: -1,
    attacking: false
  };
}

/** Un passo di movimento del giocatore verso (tx,tz) (ax/az normalizzati), come stepPlayer. */
function movePlayer(p: P, tx: number, tz: number, active: boolean, wantJump: boolean, dt: number): void {
  const dx = tx - p.x;
  const dz = tz - p.z;
  const m = Math.hypot(dx, dz);
  let ax = 0;
  let az = 0;
  if (active && m > 0.2) {
    ax = dx / m;
    az = dz / m;
  }
  const effAccel = ACCEL * p.speedMult;
  const effMax = MAX_SPEED * p.speedMult;
  p.vx += ax * effAccel * dt;
  p.vz += az * effAccel * dt;
  const damp = Math.exp(-FRICTION * dt);
  p.vx *= damp;
  p.vz *= damp;
  const sp = Math.hypot(p.vx, p.vz);
  if (sp > effMax) {
    p.vx = (p.vx / sp) * effMax;
    p.vz = (p.vz / sp) * effMax;
  }
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.x = Math.max(-FIELD_HALF_W + PLAYER_RADIUS, Math.min(FIELD_HALF_W - PLAYER_RADIUS, p.x));
  if (p.team === 'red') p.z = Math.min(-PLAYER_RADIUS - 0.2, p.z);
  else p.z = Math.max(PLAYER_RADIUS + 0.2, p.z);
  p.z = Math.max(-FIELD_HALF_D + PLAYER_RADIUS, Math.min(FIELD_HALF_D - PLAYER_RADIUS, p.z));
  if (wantJump && p.y <= 0.01) {
    p.vy = JUMP_VY * p.jumpMult;
    p.y = 0.02;
  }
  if (p.y > 0 || p.vy !== 0) {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
    }
  }
  p.cd = Math.max(0, p.cd - dt);
}

function landing(ball: Ball, g: number): { x: number; z: number; t: number } {
  const disc = ball.vy * ball.vy + 2 * g * ball.y;
  const t = (ball.vy + Math.sqrt(Math.max(0, disc))) / g;
  return {
    x: Math.max(-FIELD_HALF_W, Math.min(FIELD_HALF_W, ball.x + ball.vx * t)),
    z: Math.max(-FIELD_HALF_D, Math.min(FIELD_HALF_D, ball.z + ball.vz * t)),
    t
  };
}

function canReach(p: P, ball: Ball, jitter: number, rnd: () => number): boolean {
  const dist = Math.hypot(ball.x - p.x, ball.z - p.z);
  return dist <= HIT_RADIUS * (1 - jitter * rnd()) && ball.y >= p.y - 0.4 && ball.y <= p.y + HIT_REACH;
}

/** Formazione di difesa realistica: giocatori distribuiti sul campo ma non ai due estremi. */
function formationX(i: number, n: number): number {
  if (n === 1) return 0;
  if (n === 2) return i === 0 ? -4.2 : 4.2;
  return -5.5 + i * (11 / (n - 1));
}

// ---------- 1) test SMASH ----------

export interface DefenseResult {
  n: number;
  defended: number;
  meanWindow: number;
  p10Window: number;
}

/** Attaccante rosso a rete schiaccia; difensori blu in formazione con la reazione del profilo. */
export function smashTest(cfg: Cfg, nDef: number, prof: Profile, trials = 400, seed = 7): DefenseResult {
  const rnd = rng(seed);
  let defended = 0;
  const windows: number[] = [];
  for (let k = 0; k < trials; k++) {
    // difensori in formazione (metà campo blu, un po' avanti al fondo)
    const defs: P[] = [];
    for (let i = 0; i < nDef; i++) {
      defs.push(newPlayer('blue', formationX(i, nDef), 4.8, false));
    }
    const ball: Ball = { x: (rnd() - 0.5) * 2 * (FIELD_HALF_W - 3), y: 2.9, z: -1.6, vx: 0, vy: 0, vz: 0 };
    const v = hitVelocity(cfg, ball.x, 1, true);
    ball.vx = v.vx;
    ball.vy = v.vy;
    ball.vz = v.vz;
    clampBallSpeed(ball, cfg.maxSpeed, cfg.maxH);
    let t = 0;
    let returned = false;
    const dt = 1 / 60;
    while (t < 6) {
      t += dt;
      // i difensori reagiscono dopo reactDelay: il più vicino al punto di caduta stimato (con errore) va lì
      const L = landing(ball, cfg.ballG);
      const ordered = [...defs].sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z));
      for (const d of defs) {
        const resp = ordered[0] === d && t >= prof.reactDelay;
        const ex = (rnd() - 0.5) * 2 * prof.predictErr * 0.3;
        const ez = (rnd() - 0.5) * 2 * prof.predictErr * 0.3;
        movePlayer(d, resp ? L.x + ex : d.home.x, resp ? Math.max(0.8, L.z + ez) : d.home.z, resp, false, dt);
        if (resp && d.cd <= 0 && canReach(d, ball, prof.hitJitter, rnd) && (ball.vy <= 0.5 || ball.y < 2.4)) {
          returned = true;
        }
      }
      if (returned) break;
      const ev = stepBall(ball, cfg, dt);
      if (ev === 'land') break;
    }
    windows.push(t);
    if (returned) defended++;
  }
  windows.sort((a, b) => a - b);
  return {
    n: trials,
    defended,
    meanWindow: windows.reduce((a, b) => a + b, 0) / windows.length,
    p10Window: windows[Math.floor(windows.length * 0.1)]
  };
}

// ---------- 2) test COLPO NORMALE ----------

export interface NormalResult {
  n: number;
  crossedNet: number;
  received: number;
  meanFlight: number;
}

/** Colpo normale dal fondo/metà campo rosso verso il blu: supera la rete? e viene ricevuto? */
export function normalTest(cfg: Cfg, nDef: number, prof: Profile, trials = 400, seed = 11): NormalResult {
  const rnd = rng(seed);
  let crossed = 0;
  let received = 0;
  let flightSum = 0;
  for (let k = 0; k < trials; k++) {
    const defs: P[] = [];
    for (let i = 0; i < nDef; i++) {
      defs.push(newPlayer('blue', formationX(i, nDef), 5.0, false));
    }
    const hz = -(1.5 + rnd() * 5.5); // colpitore tra rete e fondo campo
    const ball: Ball = { x: (rnd() - 0.5) * 2 * (FIELD_HALF_W - 4), y: 1.2 + rnd() * 1.2, z: hz, vx: 0, vy: 0, vz: 0 };
    const v = hitVelocity(cfg, ball.x, 1, false);
    ball.vx = v.vx;
    ball.vy = v.vy;
    ball.vz = v.vz;
    clampBallSpeed(ball, cfg.maxSpeed, cfg.maxH);
    let t = 0;
    let netFault = false;
    let cross = false;
    let returned = false;
    const dt = 1 / 60;
    while (t < 8) {
      t += dt;
      const L = landing(ball, cfg.ballG);
      const ordered = [...defs].sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z));
      for (const d of defs) {
        const resp = ball.z > -0.5 && ordered[0] === d && t >= prof.reactDelay;
        const ex = (rnd() - 0.5) * 2 * prof.predictErr * 0.3;
        const ez = (rnd() - 0.5) * 2 * prof.predictErr * 0.3;
        movePlayer(d, resp ? L.x + ex : d.home.x, resp ? Math.max(0.8, L.z + ez) : d.home.z, resp, false, dt);
        if (resp && d.cd <= 0 && canReach(d, ball, prof.hitJitter, rnd) && (ball.vy <= 0.5 || ball.y < 2.4)) returned = true;
      }
      if (ball.z > 0) cross = true;
      if (returned) break;
      const ev = stepBall(ball, cfg, dt);
      if (ev === 'net') netFault = true;
      if (ev === 'land') break;
    }
    flightSum += t;
    if (cross && !netFault) crossed++;
    if (returned) received++;
  }
  return { n: trials, crossedNet: crossed, received, meanFlight: flightSum / trials };
}

// ---------- 3) scambi completi ----------

export interface RallyResult {
  meanTouches: number;
  median: number;
  ge3: number;
  ge6: number;
  aceRate: number;
  smashPointRate: number;
}

export function rallyTest(cfg: Cfg, nRed: number, nBlue: number, profRed: Profile, profBlue: Profile, rallies = 500, seed = 3): RallyResult {
  const rnd = rng(seed);
  const touchList: number[] = [];
  let aces = 0;
  let smashPts = 0;
  let serving: Team = 'red';
  for (let r = 0; r < rallies; r++) {
    const players: P[] = [];
    const mk = (team: Team, n: number): void => {
      const handicapped = team === 'red' ? nRed > nBlue : nBlue > nRed;
      for (let i = 0; i < n; i++) {
        const z = team === 'red' ? -5.2 : 5.2;
        players.push(newPlayer(team, formationX(i, n), z, handicapped));
      }
    };
    mk('red', nRed);
    mk('blue', nBlue);
    const prof = (t: Team): Profile => (t === 'red' ? profRed : profBlue);

    const servers = players.filter((p) => p.team === serving);
    const server = servers[Math.floor(rnd() * servers.length)];
    const dirZ = server.team === 'red' ? 1 : -1;
    const ball: Ball = { x: server.x, y: 2.4, z: server.z + dirZ * 0.6, vx: (rnd() - 0.5) * 3, vy: cfg.serveUp, vz: dirZ * cfg.serveSpeed };
    clampBallSpeed(ball, cfg.maxSpeed, cfg.maxH);
    let touches = 1;
    let lastHitAt = 0;
    let lastHitTeam: Team = server.team;
    let lastWasSmash = false;
    let over = false;
    let t = 0;
    const dt = 1 / 60;
    while (t < 40 && !over) {
      t += dt;
      const L = landing(ball, cfg.ballG);
      for (const p of players) {
        const pf = prof(p.team);
        const landsMine = (L.z < 0) === (p.team === 'red');
        const mates = players.filter((q) => q.team === p.team);
        let resp = false;
        if (landsMine && lastHitTeam !== p.team && t - lastHitAt >= pf.reactDelay) {
          const sorted = [...mates].sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z));
          resp = sorted[0] === p;
        }
        if (resp && p.decidedFor !== lastHitAt) {
          p.decidedFor = lastHitAt;
          p.attacking = rnd() < pf.attack;
        }
        if (!resp) p.attacking = false;
        let tx = p.home.x;
        let tz = p.home.z * 0.85;
        let jump = false;
        if (resp) {
          tx = L.x + (rnd() - 0.5) * pf.predictErr * 0.6;
          tz = L.z + (rnd() - 0.5) * pf.predictErr * 0.6;
          if (p.attacking) {
            const netZ = p.team === 'red' ? -1.9 : 1.9;
            const tz2 = ball.vz !== 0 ? (netZ - ball.z) / ball.vz : 99;
            const by = ball.y + ball.vy * tz2 - 0.5 * cfg.ballG * tz2 * tz2;
            if (tz2 > 0 && tz2 < 2.5 && by > 1.9) {
              tx = ball.x + ball.vx * tz2;
              tz = netZ;
              if (tz2 < 0.42 && p.y <= 0.01) jump = true;
            } else p.attacking = false;
          }
        }
        movePlayer(p, tx, tz, resp || Math.hypot(tx - p.x, tz - p.z) > 0.6, jump, dt);
        if (resp && p.cd <= 0) {
          const isSmash = p.y > 0.4 && ball.y > NET_HEIGHT * 0.8 && Math.abs(p.z) < 2.4;
          const okToHit = p.attacking ? isSmash : ball.vy <= 0.5 || ball.y < 2.4;
          if (okToHit && canReach(p, ball, pf.hitJitter, rnd)) {
            p.cd = HIT_COOLDOWN * p.cdMult;
            const v = hitVelocity(cfg, ball.x, p.team === 'red' ? 1 : -1, isSmash);
            ball.vx = v.vx;
            ball.vy = v.vy;
            ball.vz = v.vz;
            clampBallSpeed(ball, cfg.maxSpeed, cfg.maxH);
            touches++;
            lastHitAt = t;
            lastHitTeam = p.team;
            lastWasSmash = isSmash;
          }
        }
      }
      const ev = stepBall(ball, cfg, dt);
      if (ev === 'land') {
        over = true;
        const scoring: Team = ball.z < 0 ? 'blue' : 'red';
        if (touches <= 1) aces++;
        if (lastWasSmash) smashPts++;
        serving = scoring;
      }
    }
    touchList.push(touches);
  }
  const sorted = [...touchList].sort((a, b) => a - b);
  return {
    meanTouches: touchList.reduce((a, b) => a + b, 0) / touchList.length,
    median: sorted[Math.floor(sorted.length / 2)],
    ge3: touchList.filter((x) => x >= 3).length / touchList.length,
    ge6: touchList.filter((x) => x >= 6).length / touchList.length,
    aceRate: aces / rallies,
    smashPointRate: smashPts / rallies
  };
}

// ---------- report ----------

const pct = (x: number): string => `${(x * 100).toFixed(0)}%`;

export function report(cfg: Cfg): void {
  console.log(`\n=== ${cfg.label}: g=${cfg.ballG} normale(up ${cfg.normalUp}, h ${cfg.normalSpeed}) smash(down ${cfg.smashDown}, h ${cfg.smashSpeed}) servizio(up ${cfg.serveUp}, h ${cfg.serveSpeed}) max ${cfg.maxSpeed}/${cfg.maxH} aim ${cfg.aimAssist}${cfg.normalizeAim ? ' normalizzato' : ' (orig.)'} ===`);
  for (const nDef of [1, 2, 3]) {
    for (const prof of [NOVICE, AVERAGE, SHARP]) {
      const s = smashTest(cfg, nDef, prof);
      console.log(`  SMASH vs ${nDef} difensor${nDef > 1 ? 'i' : 'e'} ${prof.name.padEnd(12)} difesi ${pct(s.defended / s.n).padStart(4)}  finestra media ${s.meanWindow.toFixed(2)}s (p10 ${s.p10Window.toFixed(2)}s)`);
    }
  }
  for (const nDef of [1, 2]) {
    for (const prof of [NOVICE, AVERAGE]) {
      const s = normalTest(cfg, nDef, prof);
      console.log(`  NORMALE vs ${nDef} dif. ${prof.name.padEnd(12)} passa la rete ${pct(s.crossedNet / s.n).padStart(4)}  ricevuti ${pct(s.received / s.n).padStart(4)}  volo medio ${s.meanFlight.toFixed(2)}s`);
    }
  }
  for (const [nr, nb] of [
    [1, 1],
    [2, 2],
    [3, 2]
  ] as const) {
    for (const [a, b] of [
      [NOVICE, NOVICE],
      [AVERAGE, AVERAGE],
      [SHARP, AVERAGE]
    ] as const) {
      const r = rallyTest(cfg, nr, nb, a, b);
      console.log(
        `  SCAMBI ${nr}v${nb} ${a.name}/${b.name}`.padEnd(38) +
          ` tocchi medi ${r.meanTouches.toFixed(1)} (mediana ${r.median}) · ≥3 tocchi ${pct(r.ge3)} · ≥6 ${pct(r.ge6)} · ace ${pct(r.aceRate)} · punti da smash ${pct(r.smashPointRate)}`
      );
    }
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/volleyball-balance.ts')) {
  report(BEFORE);
  report(AFTER);
}
