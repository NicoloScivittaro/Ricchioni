import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { PauseMenu } from '../../core/PauseMenu';
import { FPS_MAP, resolveCollisions, rayVsAabb } from '../../../shared/fpsMap';
import type { Aabb } from '../../../shared/fpsMap';
import { getWeapon } from '../../../shared/fpsWeapons';
import type { WeaponConfig } from '../../../shared/fpsWeapons';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

// SPARATORIA DEI DISAGIATI — Milestone 1: FPS free-for-all.
// L'HOST (PC) è l'autorità: simula movimento/collisioni/hitscan/HP/kill/respawn,
// renderizza il RADAR e trasmette lo stato ai telefoni (che fanno il rendering FPS).

const TICK = 0.05; // 20 Hz broadcast
const EYE_HEIGHT = 1.5;
const PLAYER_RADIUS = 0.7;
const PLAYER_SPEED = 9;
const DASH_SPEED = 20;
const DASH_TIME = 0.18;
const DASH_COOLDOWN = 4;
const RESPAWN_TIME = 2.5;
const SPAWN_PROTECTION = 1.5;
const MAX_HP = 100;

interface FpsPlayer {
  id: PlayerId;
  name: string;
  avatar: string;
  color: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  alive: boolean;
  respawnTimer: number;
  spawnProtection: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  weaponId: string;
  magazine: number;
  reloading: boolean;
  reloadTimer: number;
  fireCooldown: number;
  dashTime: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirZ: number;
  firing: boolean;
}

export class FpsScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private players: FpsPlayer[] = [];
  private matchTime = 0;
  private finished = false;
  private broadcastAcc = 0;
  private pauseMenu!: PauseMenu;
  private graphics!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private rankTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('fps');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    this.players = [];
    this.finished = false;
    this.broadcastAcc = 0;
    this.rankTexts = [];
    this.matchTime = Math.min(100, data.ctx.durationSec);
    audio.unlock();
    this.cameras.main.setBackgroundColor('#0b1220');

    this.graphics = this.add.graphics();
    this.add.text(640, 24, '🔫 SPARATORIA DEI DISAGIATI', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '34px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(640, 58, 'RADAR / REGIA — i giocatori guardano il telefono', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#9ca3af' }).setOrigin(0.5);
    this.timerText = this.add.text(640, 84, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '26px', color: '#fbbf24' }).setOrigin(0.5);

    this.ctx.players.forEach((snap) => {
      const spawn = this.pickSpawn(this.players);
      this.players.push({
        id: snap.id,
        name: snap.name,
        avatar: snap.avatar,
        color: snap.color,
        x: spawn.x,
        z: spawn.z,
        yaw: Math.random() * Math.PI * 2,
        pitch: 0,
        hp: MAX_HP,
        alive: true,
        respawnTimer: 0,
        spawnProtection: SPAWN_PROTECTION,
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        shotsFired: 0,
        shotsHit: 0,
        weaponId: 'mitraglia',
        magazine: getWeapon('mitraglia').magazine,
        reloading: false,
        reloadTimer: 0,
        fireCooldown: 0,
        dashTime: 0,
        dashCooldown: 0,
        dashDirX: 0,
        dashDirZ: 0,
        firing: false
      });
    });

    // Invia subito lo stato (i telefoni devono conoscere la mappa + spawn).
    this.broadcastState();

    this.pauseMenu = new PauseMenu(this, '🔫 SPARATORIA DEI DISAGIATI', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));
  }

  private pickSpawn(exclude: FpsPlayer[]): { x: number; z: number } {
    // Sceglie lo spawn più lontano dai nemici vivi.
    let best = FPS_MAP.spawns[0];
    let bestScore = -Infinity;
    for (const s of FPS_MAP.spawns) {
      let minD = Infinity;
      for (const p of exclude) {
        if (!p.alive) continue;
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        minD = Math.min(minD, d);
      }
      if (minD > bestScore) {
        bestScore = minD;
        best = s;
      }
    }
    return { x: best.x, z: best.z };
  }

  update(_t: number, delta: number): void {
    if (this.pauseMenu.update()) return;
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;
    this.matchTime -= dt;
    this.timerText.setText(`TEMPO ${Math.max(0, Math.ceil(this.matchTime))}`);
    if (this.matchTime <= 0) {
      this.endGame();
      return;
    }

    for (const p of this.players) this.stepPlayer(p, dt);

    this.renderRadar();
    this.broadcastAcc += dt;
    if (this.broadcastAcc >= TICK) {
      this.broadcastAcc = 0;
      this.broadcastState();
    }
    this.ctx.input.update();
  }

  private stepPlayer(p: FpsPlayer, dt: number): void {
    if (!p.alive) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) this.respawn(p);
      return;
    }

    const weapon = getWeapon(p.weaponId);
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.spawnProtection = Math.max(0, p.spawnProtection - dt);

    // Reload
    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        p.reloading = false;
        p.magazine = weapon.magazine;
      }
    }

    const input = this.ctx.input.get(p.id);
    const mv = input.axis('move');
    // Movimento relativo alla visuale (yaw): su = avanti, destra = strafe destra.
    const forwardIn = -mv.y; // joystick su (y negativo) = avanti
    const strafeIn = mv.x; // destra = strafe destra
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    let ax = fx * forwardIn + rx * strafeIn;
    let az = fz * forwardIn + rz * strafeIn;
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }
    const look = input.axis('look');
    // look.x = yaw assoluto, look.y = pitch assoluto (inviato dal telefono)
    p.yaw = look.x;
    p.pitch = Math.max(-1.4, Math.min(1.4, look.y));

    // Dash
    if (input.justPressed('dash') && p.dashCooldown <= 0 && p.dashTime <= 0) {
      p.dashTime = DASH_TIME;
      p.dashCooldown = DASH_COOLDOWN;
      p.dashDirX = mag > 0.15 ? ax : Math.sin(p.yaw);
      p.dashDirZ = mag > 0.15 ? az : Math.cos(p.yaw);
      audio.boost();
      this.ctx.vibrate(p.id, 25);
    }

    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashDirX * DASH_SPEED * dt;
      p.z += p.dashDirZ * DASH_SPEED * dt;
    } else if (mag > 0.15) {
      p.x += ax * PLAYER_SPEED * weapon.movementModifier * dt;
      p.z += az * PLAYER_SPEED * weapon.movementModifier * dt;
    }

    const res = resolveCollisions(p.x, p.z, PLAYER_RADIUS, FPS_MAP.obstacles);
    p.x = res.x;
    p.z = res.z;
    p.x = Math.max(-FPS_MAP.halfSize + PLAYER_RADIUS, Math.min(FPS_MAP.halfSize - PLAYER_RADIUS, p.x));
    p.z = Math.max(-FPS_MAP.halfSize + PLAYER_RADIUS, Math.min(FPS_MAP.halfSize - PLAYER_RADIUS, p.z));

    // Spara (hold)
    p.firing = input.pressed('fire');
    if (p.firing && p.fireCooldown <= 0 && !p.reloading) {
      if (p.magazine > 0) {
        this.fire(p, weapon);
      } else {
        p.reloading = true;
        p.reloadTimer = weapon.reload;
        audio.select();
        this.ctx.signal(p.id, { type: 'reload' });
      }
    }
  }

  private fire(p: FpsPlayer, weapon: WeaponConfig): void {
    p.spawnProtection = 0; // spara → protezione rimossa subito
    p.fireCooldown = 1 / weapon.fireRate;
    p.magazine--;
    p.shotsFired++;
    p.firing = true;
    audio.tick();
    this.ctx.vibrate(p.id, 15);

    // Spread
    const spread = weapon.spread;
    const yaw = p.yaw + (Math.random() - 0.5) * 2 * spread;
    const pitch = p.pitch + (Math.random() - 0.5) * 2 * spread;
    const dx = Math.sin(yaw) * Math.cos(pitch);
    const dy = Math.sin(pitch);
    const dz = Math.cos(yaw) * Math.cos(pitch);
    const ox = p.x;
    const oy = EYE_HEIGHT;
    const oz = p.z;

    // Hitscan contro ostacoli + altri giocatori
    let bestT = weapon.range;
    let hitPlayer: FpsPlayer | null = null;
    for (const b of FPS_MAP.obstacles) {
      const t = rayVsAabb(ox, oy, oz, dx, dy, dz, b);
      if (t !== null && t < bestT) bestT = t;
    }
    for (const other of this.players) {
      if (other.id === p.id || !other.alive) continue;
      const box: Aabb = { x: other.x, z: other.z, w: 0.8, d: 0.8, h: 1.8 };
      const t = rayVsAabb(ox, oy, oz, dx, dy, dz, box);
      if (t !== null && t < bestT) {
        bestT = t;
        hitPlayer = other;
      }
    }

    if (hitPlayer) {
      p.shotsHit++;
      this.applyDamage(hitPlayer, weapon.damage, p);
      this.ctx.signal(p.id, { type: 'hit' });
    }
  }

  private applyDamage(target: FpsPlayer, damage: number, source: FpsPlayer): void {
    if (target.spawnProtection > 0) return;
    target.hp -= damage;
    target.assists = target.assists; // assist gestito alla morte
    source.damageDealt += damage;
    this.ctx.signal(target.id, { type: 'damaged', amount: damage, from: source.id });
    if (target.hp <= 0) this.kill(target, source);
  }

  private kill(target: FpsPlayer, killer: FpsPlayer): void {
    target.hp = 0;
    target.alive = false;
    target.respawnTimer = RESPAWN_TIME;
    target.deaths++;
    killer.kills++;
    audio.wrong();
    this.ctx.vibrate(target.id, 130);
    this.ctx.signal(target.id, { type: 'eliminated', by: killer.id });
  }

  private respawn(p: FpsPlayer): void {
    const spawn = this.pickSpawn(this.players.filter((q) => q.id !== p.id));
    p.x = spawn.x;
    p.z = spawn.z;
    p.yaw = Math.random() * Math.PI * 2;
    p.pitch = 0;
    p.hp = MAX_HP;
    p.alive = true;
    p.spawnProtection = SPAWN_PROTECTION;
    p.magazine = getWeapon(p.weaponId).magazine;
    p.reloading = false;
    this.ctx.signal(p.id, { type: 'respawn' });
  }

  private broadcastState(): void {
    this.ctx.signal(null, {
      type: 'fpsState',
      matchTime: Math.max(0, this.matchTime),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
        hp: p.hp,
        alive: p.alive,
        spawnProtection: p.spawnProtection,
        kills: p.kills,
        deaths: p.deaths,
        weaponId: p.weaponId,
        firing: p.firing
      }))
    });
  }

  private renderRadar(): void {
    const g = this.graphics;
    g.clear();
    const scale = 11; // px per unità mondo
    const cx = 640;
    const cy = 360;

    g.lineStyle(2, 0x334155, 1);
    g.fillStyle(0x0f172a, 1);
    g.fillRoundedRect(cx - FPS_MAP.halfSize * scale - 30, cy - FPS_MAP.halfSize * scale - 30, FPS_MAP.halfSize * scale * 2 + 60, FPS_MAP.halfSize * scale * 2 + 60, 12);
    g.strokeRoundedRect(cx - FPS_MAP.halfSize * scale - 30, cy - FPS_MAP.halfSize * scale - 30, FPS_MAP.halfSize * scale * 2 + 60, FPS_MAP.halfSize * scale * 2 + 60, 12);

    // Ostacoli
    g.fillStyle(0x475569, 1);
    for (const b of FPS_MAP.obstacles) {
      const x = cx + b.x * scale;
      const y = cy + b.z * scale;
      g.fillRect(x - (b.w * scale) / 2, y - (b.d * scale) / 2, b.w * scale, b.d * scale);
    }

    // Giocatori
    for (const p of this.players) {
      const x = cx + p.x * scale;
      const y = cy + p.z * scale;
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      if (!p.alive) {
        g.fillStyle(0x64748b, 0.5);
        g.fillCircle(x, y, 7);
        continue;
      }
      // direzione
      g.lineStyle(3, 0xffffff, 0.8);
      g.lineBetween(x, y, x + Math.sin(p.yaw) * 14, y + Math.cos(p.yaw) * 14);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, 8);
      g.lineStyle(2, 0xffffff, 1);
      g.strokeCircle(x, y, 8);
      // HP bar
      g.fillStyle(0x111827, 1);
      g.fillRect(x - 10, y - 20, 20, 4);
      g.fillStyle(p.hp > 40 ? 0x4ade80 : 0xf87171, 1);
      g.fillRect(x - 10, y - 20, 20 * (p.hp / MAX_HP), 4);
    }
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const sorted = [...this.players].sort((a, b) => {
      if (a.kills !== b.kills) return b.kills - a.kills;
      if (a.deaths !== b.deaths) return a.deaths - b.deaths;
      if (a.assists !== b.assists) return b.assists - a.assists;
      return b.damageDealt - a.damageDealt;
    });
    const results = sorted.map((p, i) => ({ playerId: p.id, placement: i + 1, score: p.kills }));
    this.ctx.signal(null, { type: 'fpsEnd', players: sorted.map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths })) });
    this.ctx.finish({ results });
  }
}
