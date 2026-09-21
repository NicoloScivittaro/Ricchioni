import Phaser from 'phaser';
import { splitFrameDelta } from '../../core/frameClock';
import { audio } from '../../core/AudioManager';
import { PauseMenu } from '../../core/PauseMenu';
import { FPS_MAP, resolveCollisions, rayVsAabb } from '../../../shared/fpsMap';
import type { Aabb } from '../../../shared/fpsMap';
import { WEAPONS, getWeapon } from '../../../shared/fpsWeapons';
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
// Layout host (1280x720): intestazione in alto, radar a sinistra (sotto l'intestazione), classifica live a destra.
const RADAR_SCALE = 10; // px per unita' mondo
const RADAR_CX = 460;
const RADAR_CY = 404;
const BOARD_X = 800;

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
  /** Sacchetto di armi: a ogni vita se ne pesca una, e non si ripete finche' non le hai usate tutte. */
  bag: string[];
  burstLeft: number;
  burstTimer: number;
}

/** Proiettile lento (bombarda): esplode dopo il tempo di volo nel punto d'impatto calcolato allo sparo. */
interface Blast {
  x: number;
  y: number;
  z: number;
  at: number;
  owner: PlayerId;
  dmg: number;
  radius: number;
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
  private blasts: Blast[] = [];
  private clock = 0; // secondi di gioco (tempi di esplosione)

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
    this.timerText = this.add.text(640, 90, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '26px', color: '#fbbf24' }).setOrigin(0.5);
    this.add.text(BOARD_X, 136, 'CLASSIFICA', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '22px', color: '#94a3b8' });
    this.ctx.players.forEach((_, i) => {
      this.rankTexts.push(
        this.add.text(BOARD_X, 176 + i * 92, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '30px', color: '#ffffff', lineSpacing: 6 })
      );
    });

    this.ctx.players.forEach((snap) => {
      const spawn = this.pickSpawn(this.players);
      this.players.push({
        id: snap.id,
        name: snap.name,
        avatar: snap.avatar,
        color: snap.color,
        x: spawn.x,
        z: spawn.z,
        yaw: Math.atan2(-spawn.x, -spawn.z), // verso il centro (il telefono allinea la visuale al primo stato)
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
        firing: false,
        bag: [],
        burstLeft: 0,
        burstTimer: 0
      });
    });

    for (const p of this.players) this.equipNext(p); // prima arma di ognuno (dal sacchetto)

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
    // Tempo reale (vedi core/frameClock): il timer scala con l'orologio, la simulazione va a sotto-passi.
    const steps = splitFrameDelta(delta / 1000);
    const dt = steps.reduce((a, b) => a + b, 0);
    this.matchTime -= dt;
    this.timerText.setText(`TEMPO ${Math.max(0, Math.ceil(this.matchTime))}`);
    if (this.matchTime <= 0) {
      this.endGame();
      return;
    }

    for (const sub of steps) {
      this.clock += sub;
      for (const p of this.players) this.stepPlayer(p, sub);
      this.stepBlasts();
    }

    this.renderRadar();
    this.renderBoard();
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
      this.ctx.signal(p.id, { type: 'dash' });
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

    // Ricarica manuale (pulsante): serve per non restare a secco nel momento sbagliato
    if (input.justPressed('reload') && !p.reloading && p.magazine < weapon.magazine) this.startReload(p, weapon);

    // Raffica in corso: i colpi successivi partono a intervalli fissi
    if (p.burstLeft > 0) {
      p.burstTimer -= dt;
      if (p.burstTimer <= 0) {
        if (p.magazine > 0 && !p.reloading) {
          this.fireShot(p, weapon);
          p.burstLeft--;
          p.burstTimer = weapon.burstGap ?? 0.07;
        } else {
          p.burstLeft = 0;
        }
      }
    }

    // Spara (hold)
    p.firing = input.pressed('fire');
    if (p.firing && p.fireCooldown <= 0 && !p.reloading && p.burstLeft <= 0) {
      if (p.magazine > 0) {
        const burst = weapon.burst ?? 1;
        p.fireCooldown = burst / weapon.fireRate; // cadenza MEDIA: la raffica e' compressa all'inizio del ciclo
        this.fireShot(p, weapon);
        p.burstLeft = burst - 1;
        p.burstTimer = weapon.burstGap ?? 0.07;
      } else {
        this.startReload(p, weapon); // a secco: ricarica da sola
      }
    }
  }

  private startReload(p: FpsPlayer, weapon: WeaponConfig): void {
    if (p.reloading) return;
    p.reloading = true;
    p.reloadTimer = weapon.reload;
    p.burstLeft = 0;
    this.ctx.signal(p.id, { type: 'reload', duration: weapon.reload, weaponId: weapon.id });
  }

  /** Pesca la prossima arma dal sacchetto del giocatore (si rimescola quando e' vuoto, senza ripetere l'ultima). */
  private equipNext(p: FpsPlayer): void {
    if (p.bag.length === 0) {
      const ids = WEAPONS.map((w) => w.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(this.ctx.rng.next() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      // la prima che verra' pescata (in fondo) non deve essere quella appena usata
      if (ids.length > 1 && ids[ids.length - 1] === p.weaponId) [ids[0], ids[ids.length - 1]] = [ids[ids.length - 1], ids[0]];
      p.bag = ids;
    }
    const next = p.bag.pop()!;
    const w = getWeapon(next);
    p.weaponId = next;
    p.magazine = w.magazine;
    p.reloading = false;
    p.reloadTimer = 0;
    p.burstLeft = 0;
    p.fireCooldown = 0.35; // breve tempo di estrazione
    this.ctx.signal(p.id, { type: 'equip', weaponId: next });
  }

  /** Un colpo (tutti i pallini): hitscan; la bombarda lancia invece un proiettile lento con esplosione ad area. */
  private fireShot(p: FpsPlayer, weapon: WeaponConfig): void {
    p.spawnProtection = 0; // spara → protezione rimossa subito
    p.magazine--;
    p.shotsFired++;
    p.firing = true;
    if (weapon.fireRate < 4) audio.tick(0.75); // sulla TV solo le armi lente: la mitraglia sarebbe un ticchettio continuo

    const ox = p.x;
    const oy = EYE_HEIGHT;
    const oz = p.z;
    const pellets = weapon.pellets ?? 1;
    const damageBy = new Map<FpsPlayer, number>(); // un solo hit/danno per bersaglio per colpo, anche con 8 pallini
    for (let i = 0; i < pellets; i++) {
      // Dispersione
      const yaw = p.yaw + (Math.random() - 0.5) * 2 * weapon.spread;
      const pitch = p.pitch + (Math.random() - 0.5) * 2 * weapon.spread;
      const dx = Math.sin(yaw) * Math.cos(pitch);
      const dy = Math.sin(pitch);
      const dz = Math.cos(yaw) * Math.cos(pitch);

      // Raggio contro ostacoli + altri giocatori
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

      if (weapon.splashRadius > 0) {
        this.launchBlast(p, weapon, ox, oy, oz, dx, dy, dz, bestT);
      } else if (hitPlayer) {
        damageBy.set(hitPlayer, (damageBy.get(hitPlayer) ?? 0) + weapon.damage);
      }
    }

    let connected = false;
    for (const [victim, dmg] of damageBy) if (this.applyDamage(victim, dmg, p)) connected = true;
    if (connected) p.shotsHit++;
    if (p.magazine <= 0) this.startReload(p, weapon); // caricatore vuoto: ricarica automatica
  }

  /** Bombarda: il proiettile vola (visibile sui telefoni) e la SUA esplosione fa danno ad area nel punto calcolato allo sparo. */
  private launchBlast(p: FpsPlayer, weapon: WeaponConfig, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, t: number): void {
    const tx = ox + dx * t;
    const ty = Math.max(0.2, oy + dy * t);
    const tz = oz + dz * t;
    const dur = t / (weapon.projectileSpeed || 20);
    this.blasts.push({ x: tx, y: ty, z: tz, at: this.clock + dur, owner: p.id, dmg: weapon.damage, radius: weapon.splashRadius });
    this.ctx.signal(null, { type: 'proj', ox, oy: oy - 0.25, oz, tx, ty, tz, dur });
  }

  private stepBlasts(): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      if (this.clock < b.at) continue;
      this.blasts.splice(i, 1);
      this.ctx.signal(null, { type: 'boom', x: b.x, y: b.y, z: b.z, r: b.radius });
      const owner = this.players.find((q) => q.id === b.owner);
      if (!owner) continue;
      for (const q of this.players) {
        if (!q.alive || q.id === b.owner) continue; // niente danno a se stessi: arcade
        const dist = Math.max(0, Math.hypot(q.x - b.x, q.z - b.z) - 0.4);
        if (dist > b.radius) continue;
        // colpo diretto = danno pieno; poi cala fino al 30% al bordo dello splash
        const k = dist <= 1 ? 1 : Math.max(0.3, 1 - (0.7 * (dist - 1)) / (b.radius - 1));
        this.applyDamage(q, Math.round(b.dmg * k), owner);
      }
    }
  }

  /** Applica il danno; ritorna false se non e' stato inflitto (bersaglio protetto). L'hit al tiratore parte SOLO da qui: conferma reale. */
  private applyDamage(target: FpsPlayer, damage: number, source: FpsPlayer): boolean {
    if (!target.alive || target.spawnProtection > 0) return false;
    target.hp -= damage;
    source.damageDealt += damage;
    this.ctx.signal(target.id, { type: 'damaged', amount: damage, from: source.id });
    this.ctx.signal(source.id, { type: 'hit', dmg: damage, kill: target.hp <= 0 });
    if (target.hp <= 0) this.kill(target, source);
    return true;
  }

  private kill(target: FpsPlayer, killer: FpsPlayer): void {
    target.hp = 0;
    target.alive = false;
    target.respawnTimer = RESPAWN_TIME;
    target.deaths++;
    killer.kills++;
    audio.wrong();
    this.ctx.vibrate(target.id, 130);
    this.ctx.vibrate(killer.id, 40);
    this.ctx.signal(target.id, { type: 'eliminated', by: killer.id });
    this.ctx.signal(killer.id, { type: 'killed', name: target.name });
  }

  private respawn(p: FpsPlayer): void {
    const spawn = this.pickSpawn(this.players.filter((q) => q.id !== p.id));
    p.x = spawn.x;
    p.z = spawn.z;
    p.yaw = Math.atan2(-spawn.x, -spawn.z);
    p.pitch = 0;
    p.hp = MAX_HP;
    p.alive = true;
    p.spawnProtection = SPAWN_PROTECTION;
    this.equipNext(p); // a ogni vita un'arma diversa
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
        firing: p.firing,
        magazine: p.magazine,
        reloading: p.reloading,
        dashing: p.dashTime > 0
      }))
    });
  }

  private renderRadar(): void {
    const g = this.graphics;
    g.clear();
    const scale = RADAR_SCALE;
    const cx = RADAR_CX;
    const cy = RADAR_CY;

    g.lineStyle(2, 0x334155, 1);
    g.fillStyle(0x0f172a, 1);
    g.fillRoundedRect(cx - FPS_MAP.halfSize * scale - 20, cy - FPS_MAP.halfSize * scale - 20, FPS_MAP.halfSize * scale * 2 + 40, FPS_MAP.halfSize * scale * 2 + 40, 12);
    g.strokeRoundedRect(cx - FPS_MAP.halfSize * scale - 20, cy - FPS_MAP.halfSize * scale - 20, FPS_MAP.halfSize * scale * 2 + 40, FPS_MAP.halfSize * scale * 2 + 40, 12);

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

  /** Classifica live: per kill (poi meno morti), con il colore di ogni giocatore; chi e' a terra ha il teschio. */
  private renderBoard(): void {
    const order = [...this.players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    order.forEach((p, i) => {
      const row = this.rankTexts[i];
      if (!row) return;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`;
      const t = `${medal} ${p.avatar} ${p.name} ${getWeapon(p.weaponId).icon}${p.alive ? '' : '  💀'}\n      ${p.kills} kill · ${p.deaths} morti`;
      if (row.text !== t) row.setText(t);
      row.setColor(p.color);
    });
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
    const results = sorted.map((p, i) => ({
      playerId: p.id,
      placement: i + 1,
      score: p.kills,
      stats: [
        `${p.kills} kill · ${p.deaths} morti`,
        p.shotsFired > 0 ? `precisione ${Math.round((p.shotsHit / p.shotsFired) * 100)}%` : 'nessun colpo sparato'
      ]
    }));
    this.ctx.signal(null, { type: 'fpsEnd', players: sorted.map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths })) });
    this.ctx.finish({ results });
  }
}
