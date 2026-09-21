/**
 * CALCIO — bilanciamento delle squadre DISPARI (2 contro 1, 3 contro 2) con bot "umani" (reazione lenta, mira imprecisa).
 * Riproduce le regole di BabylonSoccerGame senza grafica: movimento (ACCEL/FRICTION/MAX_SPEED), dash-tackle con scivolata, carica del tiro,
 * ricezione assistita, deviazioni, possesso, gol. Le costanti sono quelle di soccerTypes.ts.
 * Domanda: la squadra numericamente superiore (con handicap) vince troppo? E la piu' piccola e' condannata?
 *   npx tsx scripts/soccer-team-balance.ts             (400 partite per configurazione)      MATCHES=1500 per piu' precisione
 * Non cerca il 50/50 (party game): cerca "non impossibile" per chi e' in inferiorita', "non automatico" per chi e' in superiorita'.
 */
import {
  FIELD_HALF_W as FW, FIELD_HALF_D as FD, GOAL_HALF_W, PLAYER_RADIUS as PR, BALL_RADIUS as BR, ACCEL, MAX_SPEED, FRICTION, DASH_SPEED, DASH_TIME,
  DASH_COOLDOWN, POSSESSION_RADIUS, RECEIVE_RADIUS, RECEIVE_SPEED, LUNGE_REACH, LUNGE_ATTEMPT_RANGE, WHIFF_STUN, KICK_MIN, KICK_MAX, CHARGE_TIME,
  BALL_FRICTION, BALL_MAX_SPEED, MATCH_SECONDS, HANDICAP
} from '../src/minigames/soccer/soccerTypes';
import { Rng } from '../shared/rng';

interface Handicap {
  speedMult: number;
  kickMult: number;
  dashCooldownMult: number;
}
interface P {
  team: 0 | 1;
  x: number; z: number; vx: number; vz: number; facing: number;
  dodgeTime: number; dodgeCd: number; stun: number;
  hasBall: boolean; charging: boolean; chargeT: number; hold: number;
  lunge: boolean;
  speedMult: number; kickMult: number; dashCdMult: number;
  aim: number; aimNoise: number; think: number;
  ax: number; az: number; wantDash: boolean;
}
interface Ball { x: number; z: number; vx: number; vz: number; owner: P | null; lastKicker: P | null; grace: number }
interface Stats {
  goals: [number, number];
  ownedTime: [number, number];
  freeTime: number;
  shots: [number, number];
  onTarget: [number, number];
  tackles: [number, number];
  recoveries: [number, number];
}

const DT = 1 / 60;
// Aggressivita' dei tackle dei bot: tarata perche' i contrasti a partita restino "umani" (qualche decina di secondi tra un dash e l'altro), non uno spam continuo
const DASH_RANGE = Number(process.env.DASH_RANGE ?? 3.4);
const DASH_PROB = Number(process.env.DASH_PROB ?? 0.1);
const rngGlobal = new Rng(20260921);
const gauss = (r: Rng): number => Math.sqrt(-2 * Math.log(Math.max(1e-9, r.next()))) * Math.cos(2 * Math.PI * r.next());

function makeTeams(sizes: [number, number], hc: [Handicap, Handicap]): P[] {
  const ps: P[] = [];
  for (const team of [0, 1] as const) {
    for (let i = 0; i < sizes[team]; i++) {
      ps.push({
        team, x: 0, z: 0, vx: 0, vz: 0, facing: 0, dodgeTime: 0, dodgeCd: 0, stun: 0, hasBall: false, charging: false, chargeT: 0, hold: 0, lunge: false,
        speedMult: hc[team].speedMult, kickMult: hc[team].kickMult, dashCdMult: hc[team].dashCooldownMult, aim: 0, aimNoise: 0, think: 0, ax: 0, az: 0, wantDash: false
      });
    }
  }
  return ps;
}
function spawn(ps: P[]): void {
  const idx = [0, 0];
  for (const p of ps) {
    const i = idx[p.team]++;
    const dir = p.team === 0 ? -1 : 1; // rosso (0) attacca +X e parte a sinistra
    p.x = dir * FW * 0.55 + dir * i * 1.2;
    p.z = (i % 2 === 0 ? 1 : -1) * 3;
    p.vx = p.vz = 0;
    p.facing = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
    p.hasBall = false;
    p.charging = false;
    p.stun = 0;
    p.lunge = false;
  }
}

function runMatch(sizes: [number, number], hc: [Handicap, Handicap], seed: number, skill: number): Stats {
  const rng = new Rng(seed);
  const ps = makeTeams(sizes, hc);
  spawn(ps);
  const ball: Ball = { x: 0, z: 0, vx: 0, vz: 0, owner: null, lastKicker: null, grace: 0 };
  const st: Stats = { goals: [0, 0], ownedTime: [0, 0], freeTime: 0, shots: [0, 0], onTarget: [0, 0], tackles: [0, 0], recoveries: [0, 0] };

  const goalX = (team: 0 | 1): number => (team === 0 ? FW : -FW); // dove attacca la squadra
  const opponents = (p: P): P[] => ps.filter((q) => q.team !== p.team);
  const mates = (p: P): P[] => ps.filter((q) => q.team === p.team && q !== p);

  const giveBall = (p: P): void => {
    const lk = ball.lastKicker;
    if (lk && lk.team !== p.team) st.recoveries[p.team]++;
    ball.owner = p;
    p.hasBall = true;
    ball.vx = ball.vz = 0;
  };
  const tryTackle = (a: P, reach: number): boolean => {
    for (const v of ps) {
      if (v.team === a.team || !v.hasBall || v.dodgeTime > 0) continue;
      const d = Math.hypot(v.x - a.x, v.z - a.z);
      if (d >= reach) continue;
      v.hasBall = false;
      a.hasBall = true;
      ball.owner = a;
      const nx = (v.x - a.x) / (d || 1);
      const nz = (v.z - a.z) / (d || 1);
      v.vx += nx * 6;
      v.vz += nz * 6;
      v.stun = Math.max(v.stun, 0.3);
      st.tackles[a.team]++;
      return true;
    }
    return false;
  };
  const kick = (p: P): void => {
    const frac = Math.min(1, p.chargeT / CHARGE_TIME);
    const power = (KICK_MIN + (KICK_MAX - KICK_MIN) * frac) * p.kickMult;
    ball.owner = null;
    ball.lastKicker = p;
    ball.vx = Math.sin(p.facing) * power;
    ball.vz = Math.cos(p.facing) * power;
    ball.grace = 0.35;
    p.hasBall = false;
    // tiro: verso la porta avversaria, e "in porta" se la traiettoria taglia la linea dentro (bocca + margine)
    const gx = goalX(p.team);
    const dirToGoal = (gx - p.x) * Math.sin(p.facing);
    if (dirToGoal > 0 && power > 14) {
      st.shots[p.team]++;
      const t = (gx - p.x) / Math.sin(p.facing);
      const zAt = p.z + Math.cos(p.facing) * t;
      if (Math.abs(zAt) < GOAL_HALF_W + 1) st.onTarget[p.team]++;
    }
  };

  // ---- bot: decisione ogni ~0.2 s (reazione umana), con rumore ----
  const decide = (p: P): void => {
    p.wantDash = false;
    const own = opponents(p);
    const gx = goalX(p.team);
    const ownGx = -gx;
    const nearestOpp = own.reduce((b, q) => (Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? q : b), own[0]);
    const dOpp = Math.hypot(nearestOpp.x - p.x, nearestOpp.z - p.z);
    const setDir = (tx: number, tz: number): void => {
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz) || 1;
      p.ax = dx / d;
      p.az = dz / d;
    };
    if (p.hasBall) {
      // sto portando palla: verso la porta, aggirando l'avversario vicino
      let tx = gx;
      let tz = 0;
      if (dOpp < 4.5) {
        const away = Math.sign(p.z - nearestOpp.z) || (rng.next() < 0.5 ? 1 : -1);
        tz = p.z + away * 5;
        tx = p.x + Math.sign(gx - p.x) * 3;
      }
      setDir(tx, tz);
      const dGoal = Math.hypot(gx - p.x, p.z);
      // tiro
      const range = 10.5 + rng.next() * 2.5;
      if (!p.charging && dGoal < range && Math.abs(p.z) < 7) {
        const target = gx > 0 ? { x: FW, z: (rng.next() - 0.5) * 3.2 } : { x: -FW, z: (rng.next() - 0.5) * 3.2 };
        p.aim = Math.atan2(target.x - p.x, target.z - p.z) + gauss(rng) * 0.16 * skill;
        p.charging = true;
        p.chargeT = 0;
        p.hold = 0.35 + rng.next() * 0.5;
        p.aimNoise = 1;
      } else if (!p.charging && dOpp < 2.7 && rng.next() < 0.55) {
        // passaggio a un compagno piu' avanti/libero
        const free = mates(p).filter((m) => Math.abs(m.x - gx) < Math.abs(p.x - gx) + 3 && Math.hypot(m.x - p.x, m.z - p.z) < 12 && Math.hypot(m.x - nearestOpp.x, m.z - nearestOpp.z) > 3);
        if (free.length) {
          const m = free[0];
          p.aim = Math.atan2(m.x - p.x, m.z - p.z) + gauss(rng) * 0.14 * skill;
          p.charging = true;
          p.chargeT = 0;
          p.hold = 0.15 + rng.next() * 0.15;
          p.aimNoise = 1;
        }
      }
      if (p.charging) {
        p.ax = Math.sin(p.aim);
        p.az = Math.cos(p.aim);
      }
      return;
    }
    // senza palla
    const carrier = ps.find((q) => q.hasBall) ?? null;
    const team = ps.filter((q) => q.team === p.team);
    const ballFree = !carrier;
    const chaser = (() => {
      if (carrier && carrier.team === p.team) return null;
      return team.reduce((b, q) => (Math.hypot(q.x - ball.x, q.z - ball.z) < Math.hypot(b.x - ball.x, b.z - ball.z) ? q : b), team[0]);
    })();
    if (carrier && carrier.team === p.team) {
      // supporto: davanti al portatore, dal lato opposto
      setDir(carrier.x + Math.sign(gx - carrier.x) * 5.5, -Math.sign(carrier.z || 1) * 4);
      return;
    }
    if (chaser === p || team.length === 1) {
      const lead = ballFree ? 0.25 : 0.1;
      setDir(ball.x + ball.vx * lead, ball.z + ball.vz * lead);
      if (carrier && Math.hypot(carrier.x - p.x, carrier.z - p.z) < DASH_RANGE && p.dodgeCd <= 0 && rng.next() < DASH_PROB * skill) p.wantDash = true;
      return;
    }
    // difensore: sta tra palla e porta propria
    setDir(ownGx + (ball.x - ownGx) * 0.4, ball.z * 0.5);
  };

  // ---- simulazione ----
  const steps = Math.round(MATCH_SECONDS / DT);
  for (let s = 0; s < steps; s++) {
    // possesso
    if (ball.owner) st.ownedTime[ball.owner.team] += DT;
    else st.freeTime += DT;
    for (const p of ps) {
      p.think -= DT;
      if (p.think <= 0) {
        decide(p);
        p.think = 0.18 + rng.next() * 0.14; // reazione ~0.2-0.3 s
      }
      p.dodgeCd = Math.max(0, p.dodgeCd - DT);
      p.dodgeTime = Math.max(0, p.dodgeTime - DT);
      p.stun = Math.max(0, p.stun - DT);
      const stunned = p.stun > 0;
      let dodging = p.dodgeTime > 0;
      const mag = Math.hypot(p.ax, p.az);
      if (!stunned && !dodging && p.wantDash && p.dodgeCd <= 0) {
        const dx = mag > 0.15 ? p.ax : Math.sin(p.facing);
        const dz = mag > 0.15 ? p.az : Math.cos(p.facing);
        p.dodgeTime = DASH_TIME;
        dodging = true;
        p.dodgeCd = DASH_COOLDOWN * p.dashCdMult;
        p.vx = dx * DASH_SPEED;
        p.vz = dz * DASH_SPEED;
        const hit = tryTackle(p, PR * 2 + 0.5);
        p.lunge = !hit && ps.some((v) => v.team !== p.team && v.hasBall && Math.hypot(v.x - p.x, v.z - p.z) < LUNGE_ATTEMPT_RANGE);
        p.wantDash = false;
      }
      if (p.charging) {
        p.chargeT = Math.min(CHARGE_TIME, p.chargeT + DT);
        if (!p.hasBall) p.charging = false;
        else if (p.chargeT >= p.hold) {
          if (p.hasBall) kick(p);
          p.charging = false;
        }
      }
      if (dodging) {
        /* velocita' del dash */
      } else if (!stunned && mag > 0.15) {
        p.facing = Math.atan2(p.ax, p.az);
        p.vx += p.ax * ACCEL * p.speedMult * DT;
        p.vz += p.az * ACCEL * p.speedMult * DT;
      }
      if (!dodging) {
        const damp = Math.exp(-FRICTION * DT);
        p.vx *= damp;
        p.vz *= damp;
        const sp = Math.hypot(p.vx, p.vz);
        const cap = MAX_SPEED * p.speedMult;
        if (sp > cap) {
          p.vx = (p.vx / sp) * cap;
          p.vz = (p.vz / sp) * cap;
        }
      }
      p.x = Math.max(-FW + PR, Math.min(FW - PR, p.x + p.vx * DT));
      p.z = Math.max(-FD + PR, Math.min(FD - PR, p.z + p.vz * DT));
      if (p.lunge) {
        if (p.dodgeTime <= 0) {
          p.lunge = false;
          p.stun = Math.max(p.stun, WHIFF_STUN);
        } else if (tryTackle(p, LUNGE_REACH)) p.lunge = false;
      }
    }

    // palla
    const b = ball;
    if (b.owner) {
      const o = b.owner;
      if (o.hasBall) {
        b.x = o.x + Math.sin(o.facing) * (PR + BR + 0.15);
        b.z = o.z + Math.cos(o.facing) * (PR + BR + 0.15);
        b.vx = b.vz = 0;
      } else b.owner = null;
      continue;
    }
    b.grace = Math.max(0, b.grace - DT);
    const damp = Math.exp(-BALL_FRICTION * DT);
    b.vx *= damp;
    b.vz *= damp;
    b.x += b.vx * DT;
    b.z += b.vz * DT;
    let scored: 0 | 1 | null = null;
    if (b.x > FW) {
      if (Math.abs(b.z) < GOAL_HALF_W) scored = 0;
      else {
        b.x = FW;
        b.vx = -Math.abs(b.vx);
      }
    } else if (b.x < -FW) {
      if (Math.abs(b.z) < GOAL_HALF_W) scored = 1;
      else {
        b.x = -FW;
        b.vx = Math.abs(b.vx);
      }
    }
    if (b.z > FD) {
      b.z = FD;
      b.vz = -Math.abs(b.vz);
    } else if (b.z < -FD) {
      b.z = -FD;
      b.vz = Math.abs(b.vz);
    }
    if (scored !== null) {
      st.goals[scored]++;
      spawn(ps);
      Object.assign(ball, { x: 0, z: 0, vx: 0, vz: 0, owner: null, lastKicker: null, grace: 0 });
      continue;
    }
    let sp = Math.hypot(b.vx, b.vz);
    if (sp > BALL_MAX_SPEED) {
      b.vx = (b.vx / sp) * BALL_MAX_SPEED;
      b.vz = (b.vz / sp) * BALL_MAX_SPEED;
      sp = BALL_MAX_SPEED;
    }
    // ricezione assistita
    const lk = b.lastKicker;
    if (lk && b.grace <= 0 && sp < RECEIVE_SPEED) {
      let mate: P | null = null;
      let md = RECEIVE_RADIUS;
      for (const q of ps) {
        if (q.hasBall || q === lk || q.team !== lk.team || q.stun > 0) continue;
        const d = Math.hypot(q.x - b.x, q.z - b.z);
        if (d < md) {
          md = d;
          mate = q;
        }
      }
      if (mate) {
        giveBall(mate);
        continue;
      }
    }
    // deviazioni
    for (const q of ps) {
      if (lk === q && b.grace > 0) continue;
      const dx = b.x - q.x;
      const dz = b.z - q.z;
      const dist = Math.hypot(dx, dz);
      if (dist < PR + BR && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const dot = b.vx * nx + b.vz * nz;
        if (dot < 0) {
          b.vx -= 2 * dot * nx;
          b.vz -= 2 * dot * nz;
          b.vx *= 0.88;
          b.vz *= 0.88;
          b.x += nx * (PR + BR - dist);
          b.z += nz * (PR + BR - dist);
          b.grace = Math.max(b.grace, 0.12);
        }
      }
    }
    // raccolta
    sp = Math.hypot(b.vx, b.vz);
    if (sp < 8 && b.grace <= 0) {
      let best: P | null = null;
      let bd = POSSESSION_RADIUS;
      for (const q of ps) {
        if (q.hasBall) continue;
        const d = Math.hypot(q.x - b.x, q.z - b.z);
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      if (best) giveBall(best);
    }
  }
  return st;
}

interface Result {
  superWin: number;
  draw: number;
  smallWin: number;
  goalsSuper: number;
  goalsSmall: number;
  posSuper: number;
  shotsSuper: number;
  shotsSmall: number;
  onTargetSuper: number;
  onTargetSmall: number;
  tacklesSuper: number;
  tacklesSmall: number;
  recSuper: number;
  recSmall: number;
}

/** Squadra 0 = grande (handicappata), squadra 1 = piccola; alterno il lato di partenza mescolando i seed. */
function evaluate(nBig: number, nSmall: number, hcBig: Handicap, matches: number, skill: number): Result {
  const r: Result = { superWin: 0, draw: 0, smallWin: 0, goalsSuper: 0, goalsSmall: 0, posSuper: 0, shotsSuper: 0, shotsSmall: 0, onTargetSuper: 0, onTargetSmall: 0, tacklesSuper: 0, tacklesSmall: 0, recSuper: 0, recSmall: 0 };
  const none: Handicap = { speedMult: 1, kickMult: 1, dashCooldownMult: 1 };
  for (let m = 0; m < matches; m++) {
    // metà partite la squadra grande e' quella rossa (attacca +X), metà la blu
    const bigIsRed = m % 2 === 0;
    const sizes: [number, number] = bigIsRed ? [nBig, nSmall] : [nSmall, nBig];
    const hc: [Handicap, Handicap] = bigIsRed ? [hcBig, none] : [none, hcBig];
    const st = runMatch(sizes, hc, 1000 + m * 7 + nBig * 100000, skill);
    const bi = bigIsRed ? 0 : 1;
    const si = 1 - bi;
    const gb = st.goals[bi];
    const gs = st.goals[si];
    if (gb > gs) r.superWin++;
    else if (gb < gs) r.smallWin++;
    else r.draw++;
    r.goalsSuper += gb;
    r.goalsSmall += gs;
    const owned = st.ownedTime[0] + st.ownedTime[1] || 1;
    r.posSuper += st.ownedTime[bi] / owned;
    r.shotsSuper += st.shots[bi];
    r.shotsSmall += st.shots[si];
    r.onTargetSuper += st.onTarget[bi];
    r.onTargetSmall += st.onTarget[si];
    r.tacklesSuper += st.tackles[bi];
    r.tacklesSmall += st.tackles[si];
    r.recSuper += st.recoveries[bi];
    r.recSmall += st.recoveries[si];
  }
  return r;
}

const MATCHES = Number(process.env.MATCHES ?? 400);
const SKILL = Number(process.env.SKILL ?? 1); // 1 = bot "umano medio"; piu' basso = piu' preciso
const CONFIGS: { name: string; hc: Handicap }[] = [
  { name: 'nessun handicap', hc: { speedMult: 1, kickMult: 1, dashCooldownMult: 1 } },
  { name: `ATTUALE (vel ${HANDICAP.speedMult}, tiro ${HANDICAP.kickMult}, cd dash x${HANDICAP.dashCooldownMult})`, hc: { ...HANDICAP } },
  { name: 'vel 0.92 sola', hc: { speedMult: 0.92, kickMult: 1, dashCooldownMult: 1 } },
  { name: 'vel 0.95 + cd dash x1.25', hc: { speedMult: 0.95, kickMult: 1, dashCooldownMult: 1.25 } },
  { name: 'vel 0.90 + tiro 0.92', hc: { speedMult: 0.9, kickMult: 0.92, dashCooldownMult: 1 } },
  { name: 'vel 0.88 + cd dash x1.15', hc: { speedMult: 0.88, kickMult: 1, dashCooldownMult: 1.15 } },
  { name: 'vel 0.85 sola', hc: { speedMult: 0.85, kickMult: 1, dashCooldownMult: 1 } },
  // combinazioni leggere (una o due penalita' piccole, mai cinque)
  { name: 'L vel 0.97 sola', hc: { speedMult: 0.97, kickMult: 1, dashCooldownMult: 1 } },
  { name: 'L vel 0.95 sola', hc: { speedMult: 0.95, kickMult: 1, dashCooldownMult: 1 } },
  { name: 'L cd dash x1.3 solo', hc: { speedMult: 1, kickMult: 1, dashCooldownMult: 1.3 } },
  { name: 'L tiro 0.93 solo', hc: { speedMult: 1, kickMult: 0.93, dashCooldownMult: 1 } },
  { name: 'L vel 0.97 + cd dash x1.2', hc: { speedMult: 0.97, kickMult: 1, dashCooldownMult: 1.2 } },
  { name: 'L vel 0.96 + tiro 0.95', hc: { speedMult: 0.96, kickMult: 0.95, dashCooldownMult: 1 } }
];
const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const CUSTOM = process.env.HC ? (JSON.parse(process.env.HC) as Handicap) : null; // es. HC='{"speedMult":0.9,"kickMult":1,"dashCooldownMult":1.2}'
if (CUSTOM) CONFIGS.push({ name: `custom ${JSON.stringify(CUSTOM)}`, hc: CUSTOM });

console.log(`Bot umani (skill ${SKILL}), ${MATCHES} partite da ${MATCH_SECONDS}s per configurazione. "grande" = squadra numerosa (con handicap), "piccola" = squadra in inferiorita'.\n`);
{
  const sym = evaluate(2, 2, { speedMult: 1, kickMult: 1, dashCooldownMult: 1 }, MATCHES, SKILL);
  console.log(`CONTROLLO 2v2 pari: rossi/blu vincono ${((sym.superWin / MATCHES) * 100).toFixed(0)}% / ${((sym.smallWin / MATCHES) * 100).toFixed(0)}% (pareggi ${((sym.draw / MATCHES) * 100).toFixed(0)}%), gol ${(sym.goalsSuper / MATCHES).toFixed(2)} - ${(sym.goalsSmall / MATCHES).toFixed(2)} → il simulatore e' simmetrico`);
}
for (const [nb, ns] of [[2, 1], [3, 2]] as [number, number][]) {
  console.log(`\n=== ${nb} CONTRO ${ns} ===`);
  console.log('configurazione                                   | grande vince  pari  piccola vince | gol G-P    | possesso G | tiri G-P (in porta) | contrasti G-P | recuperi G-P');
  for (const c of CONFIGS) {
    if (only && !only.test(c.name)) continue;
    const r = evaluate(nb, ns, c.hc, MATCHES, SKILL);
    const pc = (n: number): string => `${((n / MATCHES) * 100).toFixed(0)}%`.padStart(4);
    const f = (n: number): string => (n / MATCHES).toFixed(1);
    console.log(
      `${c.name.padEnd(48)} | ${pc(r.superWin)}          ${pc(r.draw)}   ${pc(r.smallWin)}          | ${f(r.goalsSuper)}-${f(r.goalsSmall)}`.padEnd(93) +
        `| ${((r.posSuper / MATCHES) * 100).toFixed(0)}%`.padEnd(13) +
        `| ${f(r.shotsSuper)}-${f(r.shotsSmall)} (${f(r.onTargetSuper)}-${f(r.onTargetSmall)})`.padEnd(22) +
        `| ${f(r.tacklesSuper)}-${f(r.tacklesSmall)}`.padEnd(16) +
        `| ${f(r.recSuper)}-${f(r.recSmall)}`
    );
  }
}
