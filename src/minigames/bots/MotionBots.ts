import { ARENA_COMBAT as ARENA_C } from '../../../shared/arenaCombat';
import { BotInputs } from './BotInputs';
import type { ArenaPlayer } from '../arena/arenaTypes';
import type { Ball, DodgeballPlayer } from '../dodgeball/dodgeballTypes';
import type { SoccerBall, SoccerPlayer } from '../soccer/soccerTypes';
import type { VolleyballBall, VolleyballPlayer } from '../volleyball/volleyballTypes';
import type { KartState } from '../kart-race/raceTypes';
import type { TrackSpline } from '../kart-race/track';
import { FPS_MAP, rayVsAabb } from '../../../shared/fpsMap';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const angle = (v: number): number => Math.atan2(Math.sin(v), Math.cos(v));
interface Position { id: string; x: number; z: number }
interface FpsActor extends Position { alive: boolean; yaw: number; pitch: number; magazine: number; spawnProtection: number }
const nearest = <T extends Position>(p: Position, choices: T[]): T | undefined =>
  choices.reduce<T | undefined>((best, q) => !best || Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? q : best, undefined);

/** Per-game tactics produce normal commands, never positions, damage or results. */
export class MotionBots extends BotInputs {
  private volleyReads = new Map<string, { touch: string; miss: boolean }>();
  private waypoints = new Map<string, { x: number; z: number }>();
  private targets = new Map<string, { id: string; since: number }>();
  arena(dt: number, players: ArenaPlayer[], radius: number): void {
    this.tick(dt);
    for (const p of players) if (this.ids.has(p.id)) {
      if (!p.alive) { this.move(p.id,0,0); this.hold(p.id,'attack',false); continue; }
      const e = nearest(p, players.filter((q) => q.id !== p.id && q.alive));
      const edge = Math.hypot(p.x,p.z)>radius-3;
      const retreat=edge || p.instability>=70;
      const dist=e?Math.hypot(e.x-p.x,e.z-p.z):Infinity;
      this.move(p.id,retreat?-p.x:(e?.x??0)-p.x,retreat?-p.z:(e?.z??0)-p.z,true);
      if (p.charging) {
        if (retreat || !e || dist>8) { this.tap(p.id,'attackCancel'); this.hold(p.id,'attack',false); }
        else this.hold(p.id,'attack',p.chargeTime<.65);
      } else if (!retreat && e && p.stunTime<=0 && p.attackCooldown<=0 && !p.dashing && p.recoveryTime<=0) {
        this.hold(p.id,'attack',false); // Re-arm after an interrupted/cancelled charge.
        if (dist<=ARENA_C.pushRange && this.every(p.id,'push',.35,.65)) this.tap(p.id,'attack');
        else if (dist>3 && dist<7 && this.every(p.id,'shoulder',.8,1.6)) this.hold(p.id,'attack',true);
      } else this.hold(p.id,'attack',false);
      if (e?.charging && dist<5 && !edge && !p.charging && this.every(p.id,'evade',.45,.8)) {
        this.move(p.id,-(e.z-p.z),e.x-p.x,true); this.tap(p.id,'dash');
      }
      if (e && dist<5 && !p.charging) this.ability(p.id);
    }
  }
  dodgeball(dt: number, players: DodgeballPlayer[], balls: Ball[]): void {
    this.tick(dt);
    for (const p of players) if (this.ids.has(p.id)) {
      if (!p.alive) { this.move(p.id, 0, 0); continue; }
      const e = nearest(p, players.filter((q) => q.id !== p.id && q.alive));
      const free = nearest(p, balls.filter((b) => b.state === 'free').map((b, i) => ({ ...b, id: String(i) })));
      const hasBall = p.hasBall || p.truckBalls.length > 0;
      const target = hasBall ? e : free ?? e;
      this.move(p.id, (target?.x ?? 0) - p.x, (target?.z ?? 0) - p.z, true);
      if (hasBall && e && this.every(p.id, 'throw', 0.55, 1.1)) this.tap(p.id, 'throw');
      const threat = balls.some((b) => b.state === 'flying' && b.throwerId !== p.id && Math.hypot(b.x - p.x, b.z - p.z) < 4);
      if (threat && this.every(p.id, 'dodge', 0.25, 0.55)) this.tap(p.id, 'dodge');
      if (hasBall || threat) this.ability(p.id);
    }
  }
  soccer(dt: number, players: SoccerPlayer[], ball: SoccerBall): void {
    this.tick(dt);
    for (const p of players) if (this.ids.has(p.id)) {
      if (!p.alive) { this.move(p.id, 0, 0); this.hold(p.id, 'shoot', false); continue; }
      const gx = p.team === 'red' ? 16 : -16;
      const carrier = players.find((q) => q.hasBall);
      if (p.hasBall) {
        this.move(p.id, gx - p.x, -p.z);
        const range = Math.abs(gx - p.x);
        this.hold(p.id, 'shoot', range < 10 && (!p.charging || p.chargeTime < 0.6));
        if (range < 12) this.ability(p.id);
      } else {
        this.hold(p.id, 'shoot', false);
        // Teammates spread into passing/support positions instead of tackling one another.
        const target = carrier?.team === p.team ? { x: carrier.x + Math.sign(gx) * 3, z: p.id.charCodeAt(p.id.length - 1) % 2 ? 3 : -3 } : carrier ?? ball;
        this.move(p.id, target.x - p.x, target.z - p.z);
        if (carrier && carrier.team !== p.team && Math.hypot(carrier.x - p.x, carrier.z - p.z) < 5 && this.every(p.id, 'tackle', 0.4, 0.9)) this.tap(p.id, 'dash');
      }
    }
  }
  volleyball(dt: number, players: VolleyballPlayer[], ball: VolleyballBall): void {
    this.tick(dt);
    for (const p of players) if (this.ids.has(p.id)) {
      const side = p.team === 'red' ? -1 : 1;
      const onSide = ball.z * side > -0.5;
      const t = clamp((ball.vy + Math.sqrt(ball.vy * ball.vy + 24 * Math.max(0, ball.y - 1.8))) / 12, 0, 1.4);
      const tx = ball.state === 'flying' && onSide ? clamp(ball.x + ball.vx * t, -10.5, 10.5) : 0;
      const tz = ball.state === 'flying' && onSide ? side * clamp(side * (ball.z + ball.vz * t), 1.3, 6.8) : side * 4;
      const mates = players.filter((q) => q.team === p.team);
      const receiver = nearest({ id: '', x: tx, z: tz }, mates);
      const primary = receiver?.id === p.id;
      const homeX = (mates.indexOf(p) - (mates.length - 1) / 2) * 6;
      this.move(p.id, (primary ? tx : homeX) - p.x, (primary ? tz : side * 5) - p.z);
      const touch = `${ball.state}:${ball.lastTouchId}:${ball.teamTouches}`;
      if (this.volleyReads.get(p.id)?.touch !== touch) this.volleyReads.set(p.id, { touch, miss: this.rng.chance(0.17) });
      const near = Math.hypot(ball.x - p.x, ball.z - p.z) < 2.4;
      if (ball.state === 'held' && ball.holderId === p.id && this.every(p.id, 'serve', 1, 1.5)) this.tap(p.id, 'hit');
      if (ball.state === 'flying' && ball.lastTouchId !== p.id && primary && onSide && near && !this.volleyReads.get(p.id)!.miss) {
        if (ball.y > 3 && ball.y < 4.7 && p.y <= 0.01 && this.every(p.id, 'jump', 0.2, 0.4)) this.tap(p.id, 'jump');
        if (ball.y <= p.y + 2.85 && ball.y >= p.y - 0.3 && this.every(p.id, 'hit', 0.2, 0.4)) this.tap(p.id, 'hit');
        this.ability(p.id);
      }
    }
  }
  kart(dt: number, karts: KartState[], spline: TrackSpline): void {
    this.tick(dt);
    for (const k of karts) if (this.ids.has(k.playerId)) {
      const id = k.playerId;
      if (k.finished) { this.hold(id, 'up', false); this.hold(id, 'drift', false); continue; }
      // Tangent feed-forward + lane correction; real steering/acceleration/collisions remain in kartPhysics.
      const tangent = spline.tangentAngleAt(k.distance);
      const future = spline.tangentAngleAt(k.distance + 7 + Math.abs(k.speed) * 0.23);
      const desired = future - clamp(k.lateral * 0.055, -0.45, 0.45);
      const error = angle(desired - k.absHeading);
      const turn = clamp(error * 2.5, -1, 1);
      this.ctx.input.get(id).setAxis('steer', this.ctx.modifier?.id === 'controlli_invertiti' ? -turn : turn, 0);
      const tight = Math.abs(angle(future - tangent)) > 0.5 || Math.abs(error) > 0.85;
      this.hold(id, 'up', !tight || k.speed < 28);
      this.hold(id, 'down', tight && k.speed > 34);
      this.hold(id, 'drift', Math.abs(turn) > 0.35 && Math.abs(turn) < 0.8 && k.speed > 24 && Math.abs(k.lateral) < 3);
      if (k.heldItem && this.every(id, 'item', 1, 2)) this.tap(id, 'item');
      if (k.recoverWindow > 0 || k.refundTimer > 0) {
        if (this.every(id, 'recover', 0.12, 0.25)) this.tap(id, 'ability');
      } else if (k.abilityMeter >= 1) this.ability(id);
    }
  }
  fps(dt: number, players: FpsActor[]): void {
    this.tick(dt);
    for (const p of players) if (this.ids.has(p.id)) {
      if (!p.alive) { this.ctx.input.cancelPlayer(p.id); this.targets.delete(p.id); this.waypoints.delete(p.id); continue; }
      const enemies = players.filter((q) => q.id !== p.id && q.alive);
      const visible = enemies.filter((q) => clearShot(p, q));
      const e = nearest(p, visible) ?? nearest(p, enemies);
      if (!e) { this.ctx.input.cancelPlayer(p.id); continue; }
      let target = this.targets.get(p.id);
      if (target?.id !== e.id) { target = { id: e.id, since: this.time }; this.targets.set(p.id, target); }
      const dx = e.x - p.x, dz = e.z - p.z, dist = Math.hypot(dx, dz);
      const aim = Math.atan2(dx, dz) + Math.sin(this.time * 2.7 + p.id.length) * 0.045;
      const yaw = p.yaw + clamp(angle(aim - p.yaw), -dt * 2.5, dt * 2.5);
      this.ctx.input.get(p.id).setAxis('look', yaw, 0);
      const canSee = clearShot(p, e);
      let dest: { x: number; z: number } = e;
      if (canSee) this.waypoints.delete(p.id);
      else {
        const old = this.waypoints.get(p.id);
        dest = old && Math.hypot(old.x - p.x, old.z - p.z) > 0.45 ? old : nextFpsWaypoint(p, e);
        this.waypoints.set(p.id, dest);
      }
      let wx = dest.x - p.x, wz = dest.z - p.z;
      const n = Math.max(1, Math.hypot(wx, wz)); wx /= n; wz /= n;
      if (canSee && dist < 9) { wx = Math.cos(yaw) * Math.sin(this.time); wz = -Math.sin(yaw) * Math.sin(this.time); }
      // Local forward/strafe input, as produced by the phone joystick.
      this.ctx.input.get(p.id).setAxis('move', wx * Math.cos(p.yaw) - wz * Math.sin(p.yaw), -(wx * Math.sin(p.yaw) + wz * Math.cos(p.yaw)));
      const firing = canSee && e.spawnProtection <= 0 && this.time - target!.since > 0.45 && Math.abs(angle(aim - yaw)) < 0.12 && this.time % 2.2 < 1.6;
      this.hold(p.id, 'aim', canSee && dist > 10 && Math.abs(angle(aim - yaw)) < 0.18);
      this.hold(p.id, 'fire', firing);
      if (p.magazine === 0 && this.every(p.id, 'reload', 0.4, 0.7)) this.tap(p.id, 'reload');
      if (firing) this.ability(p.id);
    }
  }
}

function clearShot(p: Position, q: Position): boolean {
  const d = Math.hypot(q.x - p.x, q.z - p.z) || 1;
  return !FPS_MAP.obstacles.some((b) => {
    const hit = rayVsAabb(p.x, 1.5, p.z, (q.x - p.x) / d, 0, (q.z - p.z) / d, b);
    return hit !== null && hit < d;
  });
}

// Static navigation grid with body clearance. BFS is cached per destination cell, not per frame/bot.
const GRID = 25, CELL = 2;
const point = (i: number): { x: number; z: number } => ({ x: (i % GRID) * CELL - 24, z: Math.floor(i / GRID) * CELL - 24 });
const cell = (p: { x: number; z: number }): number => clamp(Math.round((p.x + 24) / CELL), 0, 24) + GRID * clamp(Math.round((p.z + 24) / CELL), 0, 24);
const walkable = Array.from({ length: GRID * GRID }, (_, i) => {
  const p = point(i);
  return !FPS_MAP.obstacles.some((b) => Math.abs(p.x - b.x) < b.w / 2 + 0.95 && Math.abs(p.z - b.z) < b.d / 2 + 0.95);
});
const fields = new Map<number, Int16Array>();
function neighbors(i: number): number[] {
  return [i % GRID > 0 ? i - 1 : -1, i % GRID < GRID - 1 ? i + 1 : -1, i - GRID, i + GRID].filter((k) => k >= 0 && k < GRID * GRID && walkable[k]);
}
function nextFpsWaypoint(p: Position, q: Position): { x: number; z: number } {
  let goal = cell(q);
  if (!walkable[goal]) goal = walkable.reduce((best, ok, i) => ok && Math.hypot(point(i).x - q.x, point(i).z - q.z) < Math.hypot(point(best).x - q.x, point(best).z - q.z) ? i : best, walkable.findIndex(Boolean));
  let field = fields.get(goal);
  if (!field) {
    field = new Int16Array(GRID * GRID).fill(-1); field[goal] = 0;
    const queue = [goal];
    for (let i = 0; i < queue.length; i++) for (const n of neighbors(queue[i])) if (field[n] < 0) { field[n] = field[queue[i]] + 1; queue.push(n); }
    if (fields.size > 64) fields.clear();
    fields.set(goal, field);
  }
  let here = cell(p);
  if (!walkable[here]) here = neighbors(here).sort((a, b) => Math.hypot(point(a).x - p.x, point(a).z - p.z) - Math.hypot(point(b).x - p.x, point(b).z - p.z))[0] ?? here;
  // Reach the cell center before turning a corner; prevents diagonal clipping into containers.
  const next = neighbors(here).filter((n) => field![n] >= 0 && field![n] < field![here]).sort((a, b) => field![a] - field![b])[0];
  return next === undefined ? point(here) : point(next);
}
