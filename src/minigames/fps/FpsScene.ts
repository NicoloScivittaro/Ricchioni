import Phaser from 'phaser';
import { splitFrameDelta } from '../../core/frameClock';
import { audio } from '../../core/AudioManager';
import { PauseMenu } from '../../core/PauseMenu';
import { telemetry } from '../../core/telemetry';
import { FPS_MAP, resolveCollisions, rayVsAabb } from '../../../shared/fpsMap';
import type { Aabb } from '../../../shared/fpsMap';
import { WEAPONS, getWeapon } from '../../../shared/fpsWeapons';
import type { WeaponConfig } from '../../../shared/fpsWeapons';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';
import { characterInitial } from '../../../shared/characters';
import { pads } from '../../input/GamepadManager';
import { HAPTIC } from '../../core/haptics';
import { getTimeScale } from '../../core/impact';
import { setGameIntensity } from '../../core/musicDirector';
import { responseCurve } from '../../input/padMath';
import type { BabylonFpsGame, FpsLocalPlayer, FpsRenderSnapshot } from './BabylonFpsGame';
import { FONT_DISPLAY, FONT_BODY } from '../../core/uiTokens';
import { AB, stateLabel } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';
import { abilityHub } from '../../core/abilityHub';
import { FpsAbilities, FPS_MAX_HP } from './fpsAbilities';
import type { FpsAbilityFeedback } from './fpsAbilities';

/**
 * MIRA COL CONTROLLER (Milestone 6.1) — TUTTI i parametri della mira in un solo posto, per poterli ritoccare
 * dopo il test con hardware reale senza andare a caccia nel file. A differenza del telefono (touch-drag = angolo
 * assoluto, invariato), lo stick destro e' letto come VELOCITA' angolare e integrato qui in yaw/pitch (come un
 * mouse): rotazione = stick * sensitivity * dt, mai "per fotogramma" (altrimenti la mira girerebbe piu' veloce
 * a FPS piu' alti — vedi il test di indipendenza dal frame-rate).
 *
 * - sensX/sensY: rad/s a deflessione piena (stick=1) con moltiplicatore di sensibilita' 1.0.
 * - curveExponent: 1 = lineare (default, NESSUN cambio di comportamento rispetto a prima); >1 disponibile per
 *   dosare meglio i movimenti piccoli una volta provato con un controller vero (vedi input/padMath.ts:responseCurve,
 *   gia' pensata per la mira FPS ma non ancora applicata da nessun gioco).
 * - maxTurnSpeed: tetto di sicurezza in rad/s DOPO sensibilita'+curva. Deve coprire tutto il range ESISTENTE
 *   di pads.settingsOf(id).sensitivity (0.5..2, vedi GamepadManager): con sensX=2.6 il tetto e' sensX*2=5.2,
 *   altrimenti la meta' superiore del range (sensibilita' > 1.0) verrebbe tagliata silenziosamente a costo
 *   zero apparente — bug reale trovato e corretto durante il collegamento di questo parametro (M6.1).
 * - pitchClamp: quanto in su/giu' si puo' guardare (radianti), invariato dal telefono.
 * - invertY e la deadzone (PAD_CONFIG.rightDeadzone) sono GIA' centralizzati altrove (GamepadManager/padMath) e
 *   si applicano automaticamente a QUALSIASI stick destro: non li ripeto qui per non avere due fonti diverse.
 * - la sensibilita' PER GIOCATORE (pads.settingsOf(id).sensitivity, 0.5..2, gia' esistente e persistita ma finora
 *   inutilizzata da nessun gioco) moltiplica sensX/sensY qui sotto: NON e' un sistema nuovo, e' quello gia' pronto.
 */
export const AIM_CONFIG = {
  sensX: 2.6,
  sensY: 2.0,
  curveExponent: 1, // 1 = lineare = comportamento IDENTICO a prima di M6.1
  maxTurnSpeed: 5.2, // sensX * 2 (limite superiore del range di sensibilita' per giocatore, 0.5..2)
  pitchClamp: 1.4
} as const;

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
const MAX_HP = FPS_MAX_HP; // stesso valore usato dalle abilita' (giubbotto, debito)
// Layout host (1280x720): intestazione in alto, radar a sinistra (sotto l'intestazione), classifica live a destra.
const RADAR_SCALE = 10; // px per unita' mondo
const RADAR_CX = 460;
const RADAR_CY = 404;
const BOARD_X = 800;

interface FpsPlayer {
  id: PlayerId;
  name: string;
  avatar: string;
  /** iniziale del personaggio (G/B/D/J/C) per il radar */
  initial: string;
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
  characterId: string | null;
  // ABILITA' (cariche, ricarica e stato dell'effetto: logica in fpsAbilities.ts, numeri in shared/abilityCatalog.ts)
  abCharges: number;
  abCd: number;
  buffShots: number; // Goblin: colpi rimasti col danno extra
  guardTime: number; // Buttafuori: giubbotto
  guardAbsorbed: number; // Buttafuori: danno assorbito, in parte restituito come vita
  wallTime: number; // Dottore: vede tutti
  drowsyTime: number; // Dottore: dopo, la mira trema
  armTime: number; // Ciro: armato
  debtTime: number; // Ciro: debito (resta a 1 di vita)
  lockTime: number; // Judoka (subito): non puoi sparare ne' ricaricare
  stunTime: number; // Judoka IPPON (subito): a terra, non ti muovi
  abKills: number; // kill fatte durante la finestra dell'abilita' (statistica)
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
  private radarTags: Phaser.GameObjects.Text[] = [];
  private radarNames: Phaser.GameObjects.Text[] = [];
  private blasts: Blast[] = [];
  private fpsAb = new FpsAbilities();
  private clock = 0; // secondi di gioco (tempi di esplosione)

  /** false finche' la schermata CONTROLLI (chi ha il controller) e' visibile: vedi update(). */
  private controlsDone = false;
  private splitScreen: BabylonFpsGame | null = null;
  private splitScreenCanvas: HTMLCanvasElement | null = null;
  /** true se la scena e' stata chiusa/riavviata MENTRE il modulo Babylon dello split-screen si stava caricando. */
  private splitScreenCancelled = false;

  constructor() {
    super('fps');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    this.players = [];
    this.finished = false;
    this.broadcastAcc = 0;
    this.rankTexts = [];
    this.radarTags = [];
    this.radarNames = [];
    this.matchTime = Math.min(100, data.ctx.durationSec);
    this.controlsDone = false;
    this.splitScreen = null;
    this.splitScreenCanvas = null;
    this.splitScreenCancelled = false;
    audio.unlock();
    this.cameras.main.setBackgroundColor('#0b1220');

    this.graphics = this.add.graphics();
    this.add.text(640, 24, '🔫 SPARATORIA DEI DISAGIATI', { fontFamily: FONT_DISPLAY, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(640, 58, 'RADAR / REGIA — i giocatori guardano il telefono', { fontFamily: FONT_BODY, fontSize: '16px', color: '#9ca3af' }).setOrigin(0.5);
    this.timerText = this.add.text(640, 90, '', { fontFamily: FONT_DISPLAY, fontSize: '26px', color: '#fbbf24' }).setOrigin(0.5);
    this.add.text(BOARD_X, 136, 'CLASSIFICA', { fontFamily: FONT_DISPLAY, fontSize: '22px', color: '#94a3b8' });
    this.ctx.players.forEach((_, i) => {
      this.rankTexts.push(
        this.add.text(BOARD_X, 176 + i * 92, '', { fontFamily: FONT_DISPLAY, fontSize: '30px', color: '#ffffff', lineSpacing: 6 })
      );
    });

    this.ctx.players.forEach((snap) => {
      const spawn = this.pickSpawn(this.players);
      this.players.push({
        id: snap.id,
        name: snap.name,
        avatar: snap.avatar,
        initial: characterInitial(snap.characterId),
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
        burstTimer: 0,
        characterId: snap.characterId,
        abCharges: 0,
        abCd: 0,
        buffShots: 0,
        guardTime: 0,
        guardAbsorbed: 0,
        wallTime: 0,
        drowsyTime: 0,
        armTime: 0,
        debtTime: 0,
        lockTime: 0,
        stunTime: 0,
        abKills: 0
      });
    });
    abilityHub.begin('fps', this.ctx);
    for (const p of this.players) this.fpsAb.init(p);

    for (const p of this.players) this.equipNext(p); // prima arma di ognuno (dal sacchetto)

    // Invia subito lo stato (i telefoni devono conoscere la mappa + spawn).
    this.broadcastState();

    this.pauseMenu = new PauseMenu(this, '🔫 SPARATORIA DEI DISAGIATI', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));

    // Split-screen (Milestone 6): chi ha il controller ALL'AVVIO del round gioca in prima persona sul PC (viewport
    // multipli, stessa scena Babylon); chi non ce l'ha continua dal telefono, ESATTAMENTE come prima (nessuna
    // modifica al percorso telefono). L'ordine e' quello dei giocatori in stanza: stabile, mai per indice del pad.
    const locals: FpsLocalPlayer[] = this.ctx.players
      .filter((p) => pads.slotOf(p.id)?.state === 'paired')
      .map((p) => ({ id: p.id, name: p.displayName, color: p.color, characterId: p.characterId }));
    if (locals.length > 0) void this.bootSplitScreen(locals);

    // Intercetta i segnali (stesso ctx.signal usato dai telefoni: nessun percorso nuovo) SOLO per il feedback
    // locale hitmarker/vignetta dello split-screen — il contenuto/la consegna ai telefoni resta invariata.
    const originalSignal = this.ctx.signal.bind(this.ctx);
    this.ctx.signal = (pid: PlayerId | null, msg: Record<string, unknown>): void => {
      originalSignal(pid, msg);
      if (!this.splitScreen) return;
      this.splitScreen.onSignal(pid, msg);
      // conferma del colpo sul CONTROLLER (il telefono ha gia' la sua): solo chi gioca nello split-screen, mai due volte
      if (pid && msg.type === 'hit' && msg.kill !== true && this.splitScreen.isLocal(pid)) this.ctx.vibrate(pid, HAPTIC.LIGHT);
    };

    // Schermata CONTROLLI: finche' e' su, la simulazione resta ferma (vedi update()).
    if (this.ctx.showControls) void this.ctx.showControls().then(() => (this.controlsDone = true));
    else this.controlsDone = true;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.disposeSplitScreen, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.disposeSplitScreen, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => abilityHub.end());
  }

  private async bootSplitScreen(locals: FpsLocalPlayer[]): Promise<void> {
    const { BabylonFpsGame } = await import('./BabylonFpsGame');
    if (this.splitScreenCancelled) return; // scena chiusa/riavviata mentre il modulo si caricava

    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '10000';
    canvas.style.touchAction = 'none';
    canvas.style.outline = 'none';
    document.body.appendChild(canvas);
    this.splitScreenCanvas = canvas;
    this.splitScreen = new BabylonFpsGame(canvas, locals);
  }

  private disposeSplitScreen(): void {
    this.splitScreenCancelled = true;
    try {
      this.splitScreen?.dispose();
    } catch (e) {
      console.warn('[cleanup] dispose split-screen FPS fallito', e);
    }
    this.splitScreen = null;
    this.splitScreenCanvas?.remove();
    this.splitScreenCanvas = null;
  }

  private toRenderSnapshot(p: FpsPlayer): FpsRenderSnapshot {
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      characterId: this.ctx.players.find((s) => s.id === p.id)?.characterId ?? null,
      displayName: this.ctx.players.find((s) => s.id === p.id)?.displayName,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      hp: p.hp,
      maxHp: MAX_HP,
      alive: p.alive,
      kills: p.kills,
      weaponId: p.weaponId,
      magazine: p.magazine,
      reloading: p.reloading,
      ability: this.fpsAb.status(p, getWeapon(p.weaponId)),
      guard: p.guardTime > 0,
      wall: p.wallTime > 0,
      locked: p.lockTime > 0 || p.stunTime > 0,
      reloadFrac: p.reloading ? Math.max(0, Math.min(1, 1 - p.reloadTimer / getWeapon(p.weaponId).reload)) : 0,
      sweetFrom: p.characterId === 'goblin' ? AB.fps.goblin.p.from : null
    };
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
    if (this.pauseMenu.update()) {
      this.splitScreen?.setPaused(true);
      return;
    }
    this.splitScreen?.setPaused(false);
    if (this.finished) return;
    if (!this.controlsDone) {
      this.ctx.input.update(); // schermata CONTROLLI: nessuna fase avanza, nessun input di gioco consumato
      return;
    }
    // Tempo reale (vedi core/frameClock): il timer scala con l'orologio, la simulazione va a sotto-passi.
    const steps = splitFrameDelta((delta / 1000) * getTimeScale()); // getTimeScale: 1, salvo rallentatore di debug
    const dt = steps.reduce((a, b) => a + b, 0);
    this.matchTime -= dt;
    if (this.matchTime <= 20) setGameIntensity(2); // ultimi 20 secondi: strato musicale finale (nessun effetto sul tempo)
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

    for (const q of this.players) abilityHub.setStatus(q.id, this.fpsAb.status(q, getWeapon(q.weaponId))); // HUD + Companion Card (solo presentazione)
    this.renderRadar();
    this.renderBoard();
    if (this.splitScreen) this.splitScreen.update(dt, this.players.map((p) => this.toRenderSnapshot(p)));
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
    this.fpsAb.update(p, dt, (f) => this.onAbilityFeedback(p, f));
    if (!p.alive) return; // l'esattore di Ciro puo' averlo appena eliminato
    const stunned = p.stunTime > 0; // IPPON del Judoka: a terra, non muove ne' spara
    const noFire = stunned || p.lockTime > 0; // NO, ASPETTA!: niente spari e niente ricarica

    // Reload
    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        p.reloading = false;
        p.magazine = weapon.magazine;
      }
    }

    const input = this.ctx.input.get(p.id);
    // ABILITA' (premuta ma non partita: avviso privato, mai silenzio)
    if (input.justPressed('ability')) {
      const res = this.fpsAb.onAbilityPress(p, weapon, this.players, (f) => this.onAbilityFeedback(p, f));
      if (res !== 'ok') abilityHub.failed(p.id, res === 'cooldown' ? 'IN RICARICA' : res === 'spent' ? 'ESAURITA' : res === 'notreloading' ? 'RICARICA PRIMA' : res === 'nobody' ? 'NESSUNO DAVANTI' : 'NON ORA');
    }
    const mv = stunned ? { x: 0, y: 0 } : input.axis('move');
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
    if (pads.slotOf(p.id)?.state === 'paired') {
      // Controller: lo stick destro e' una VELOCITA' angolare (come un mouse), integrata qui — mai un angolo assoluto.
      // Deadzone e invertY sono GIA' applicati a monte (GamepadManager/padMath), generici per qualsiasi stick destro.
      const stick = input.axis('lookStick');
      const mag = Math.hypot(stick.x, stick.y);
      // Riscala la GRANDEZZA con la curva di risposta (mantiene la direzione): con curveExponent=1 e' l'identita',
      // quindi con i valori di default il comportamento resta ESATTAMENTE quello di prima di M6.1.
      const curved = mag > 0 ? responseCurve(mag, AIM_CONFIG.curveExponent) / mag : 0;
      const sens = pads.settingsOf(p.id).sensitivity; // 0.5..2 per giocatore, gia' esistente (prima inutilizzato)
      const rateX = Math.max(-AIM_CONFIG.maxTurnSpeed, Math.min(AIM_CONFIG.maxTurnSpeed, stick.x * curved * AIM_CONFIG.sensX * sens));
      const rateY = Math.max(-AIM_CONFIG.maxTurnSpeed, Math.min(AIM_CONFIG.maxTurnSpeed, stick.y * curved * AIM_CONFIG.sensY * sens));
      p.yaw += rateX * dt;
      p.pitch = Math.max(-AIM_CONFIG.pitchClamp, Math.min(AIM_CONFIG.pitchClamp, p.pitch - rateY * dt));
    } else {
      const look = input.axis('look');
      // look.x = yaw assoluto, look.y = pitch assoluto (inviato dal telefono, touch-drag) — invariato.
      p.yaw = look.x;
      p.pitch = Math.max(-AIM_CONFIG.pitchClamp, Math.min(AIM_CONFIG.pitchClamp, look.y));
    }

    // Dash
    if (!stunned && input.justPressed('dash') && p.dashCooldown <= 0 && p.dashTime <= 0) {
      p.dashTime = DASH_TIME;
      p.dashCooldown = DASH_COOLDOWN;
      p.dashDirX = mag > 0.15 ? ax : Math.sin(p.yaw);
      p.dashDirZ = mag > 0.15 ? az : Math.cos(p.yaw);
      audio.boost();
      this.ctx.vibrate(p.id, HAPTIC.LIGHT);
      this.ctx.signal(p.id, { type: 'dash' });
    }

    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashDirX * DASH_SPEED * dt;
      p.z += p.dashDirZ * DASH_SPEED * dt;
    } else if (mag > 0.15) {
      const sp = PLAYER_SPEED * weapon.movementModifier * this.fpsAb.speedFactor(p);
      p.x += ax * sp * dt;
      p.z += az * sp * dt;
    }

    const res = resolveCollisions(p.x, p.z, PLAYER_RADIUS, FPS_MAP.obstacles);
    p.x = res.x;
    p.z = res.z;
    p.x = Math.max(-FPS_MAP.halfSize + PLAYER_RADIUS, Math.min(FPS_MAP.halfSize - PLAYER_RADIUS, p.x));
    p.z = Math.max(-FPS_MAP.halfSize + PLAYER_RADIUS, Math.min(FPS_MAP.halfSize - PLAYER_RADIUS, p.z));

    // Ricarica manuale (pulsante): serve per non restare a secco nel momento sbagliato
    if (!noFire && input.justPressed('reload') && !p.reloading && p.magazine < weapon.magazine) this.startReload(p, weapon);

    // Raffica in corso: i colpi successivi partono a intervalli fissi
    if (noFire) p.burstLeft = 0;
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
    p.firing = !noFire && input.pressed('fire');
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
    if (p.reloading || p.lockTime > 0 || p.stunTime > 0) return;
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
    // sulla TV senza split-screen solo un tick per le armi lente; con lo split-screen ogni arma ha il suo suono (BabylonFpsGame)
    if (weapon.fireRate < 4 && !this.splitScreen) audio.tick(0.75);
    const segs: { ox: number; oy: number; oz: number; ex: number; ey: number; ez: number }[] = [];

    const ox = p.x;
    const oy = EYE_HEIGHT;
    const oz = p.z;
    const pellets = weapon.pellets ?? 1;
    const spread = weapon.spread * this.fpsAb.spreadFactor(p); // Dottore dopo M'HO SVEJATO: la mira trema
    const dmgMult = this.fpsAb.damageFactor(p); // Goblin dopo la ricarica perfetta: piu' danno
    const damageBy = new Map<FpsPlayer, number>(); // un solo hit/danno per bersaglio per colpo, anche con 8 pallini
    for (let i = 0; i < pellets; i++) {
      // Dispersione
      const yaw = p.yaw + (Math.random() - 0.5) * 2 * spread;
      const pitch = p.pitch + (Math.random() - 0.5) * 2 * spread;
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
        this.launchBlast(p, weapon, ox, oy, oz, dx, dy, dz, bestT, dmgMult);
      } else if (hitPlayer) {
        damageBy.set(hitPlayer, (damageBy.get(hitPlayer) ?? 0) + weapon.damage * dmgMult);
      }
      segs.push({ ox, oy, oz, ex: ox + dx * bestT, ey: oy + dy * bestT, ez: oz + dz * bestT });
    }
    // solo grafica/suono, nello stesso istante del colpo: rinculo, lampo e traccianti fino al punto colpito VERO
    this.splitScreen?.notifyShot(p.id, weapon.id, segs);

    let connected = false;
    for (const [victim, dmg] of damageBy) if (this.applyDamage(victim, Math.round(dmg), p)) connected = true;
    if (connected) p.shotsHit++;
    this.fpsAb.onShotFired(p); // Goblin: un colpo del bonus in meno
    if (p.magazine <= 0) this.startReload(p, weapon); // caricatore vuoto: ricarica automatica
  }

  /** Bombarda: il proiettile vola (visibile sui telefoni) e la SUA esplosione fa danno ad area nel punto calcolato allo sparo. */
  private launchBlast(p: FpsPlayer, weapon: WeaponConfig, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, t: number, dmgMult = 1): void {
    const tx = ox + dx * t;
    const ty = Math.max(0.2, oy + dy * t);
    const tz = oz + dz * t;
    const dur = t / (weapon.projectileSpeed || 20);
    this.blasts.push({ x: tx, y: ty, z: tz, at: this.clock + dur, owner: p.id, dmg: weapon.damage * dmgMult, radius: weapon.splashRadius });
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
    // BUTTAFUORI: il giubbotto assorbe parte del danno (che poi in parte torna come vita)
    const taken = this.fpsAb.reduceDamage(target, damage);
    damage = taken;
    target.hp -= damage;
    source.damageDealt += damage;
    this.ctx.signal(target.id, { type: 'damaged', amount: damage, from: source.id });
    // CIRO: il colpo che ti ucciderebbe diventa un debito (resti a 1 di vita) se avevi armato PAGO DOMANI
    if (target.hp <= 0 && this.fpsAb.rescue(target, (f) => this.onAbilityFeedback(target, f))) {
      target.hp = 1;
      this.ctx.signal(source.id, { type: 'hit', dmg: damage, kill: false });
      return true;
    }
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
    this.fpsAb.onKill(killer, (f) => this.onAbilityFeedback(killer, f), (hp) => (killer.hp = Math.min(MAX_HP, killer.hp + hp)));
    this.fpsAb.onDeath(target); // le finestre aperte non sopravvivono alla morte (le cariche restano com'erano)
    audio.wrong();
    this.ctx.vibrate(target.id, HAPTIC.HEAVY);
    this.ctx.vibrate(killer.id, HAPTIC.SUCCESS);
    this.ctx.signal(target.id, { type: 'eliminated', by: killer.id });
    this.ctx.signal(killer.id, { type: 'killed', name: target.name });
  }

  /** Esiti delle abilita' (i numeri e il perche' sono in fpsAbilities.ts): qui feedback, statistiche e consegna ai telefoni. */
  private onAbilityFeedback(p: FpsPlayer, f: FpsAbilityFeedback): void {
    const name = AB.fps[(p.characterId ?? 'goblin') as keyof typeof AB.fps].name;
    switch (f.type) {
      case 'activated':
        abilityHub.activated(p.id);
        this.ctx.signal(p.id, { type: 'abilityFx', name });
        break;
      case 'perfect_reload':
        abilityHub.succeeded(p.id, 'ricariche perfette');
        audio.boost();
        this.ctx.vibrate(p.id, HAPTIC.MEDIUM);
        break;
      case 'early_reload':
        abilityHub.wasted(p.id);
        break;
      case 'guard_end':
        if (f.healed > 0) abilityHub.succeeded(p.id, 'vita restituita', Math.round(f.healed));
        else abilityHub.wasted(p.id);
        break;
      case 'shove': {
        abilityHub.succeeded(p.id, f.ippon ? 'IPPON' : 'interruzioni', f.hit);
        this.splitScreen?.notifyShove(p.id, p.x, p.z, p.yaw);
        audio.hit();
        break;
      }
      case 'wall_end':
        abilityHub.impact(p.id, 'kill mentre vedeva', f.kills);
        if (f.kills === 0) abilityHub.wasted(p.id);
        break;
      case 'debt_start':
        abilityHub.impact(p.id, 'morti evitate');
        audio.thump(0.9);
        this.ctx.vibrate(p.id, HAPTIC.HEAVY);
        break;
      case 'debt_paid':
        abilityHub.succeeded(p.id, 'debiti saldati');
        audio.go();
        break;
      case 'debt_collect':
        abilityHub.wasted(p.id);
        this.collectDebt(p);
        break;
      case 'buff_kill':
        abilityHub.impact(p.id, 'kill col bonus');
        break;
      case 'arm_expired':
        abilityHub.wasted(p.id);
        break;
    }
  }

  /** L'esattore: il debito di Ciro scade e muore (senza regalare una kill a nessuno). */
  private collectDebt(p: FpsPlayer): void {
    if (!p.alive) return;
    p.hp = 0;
    p.alive = false;
    p.respawnTimer = RESPAWN_TIME;
    p.deaths++;
    this.fpsAb.onDeath(p);
    audio.wrong();
    this.ctx.vibrate(p.id, HAPTIC.HEAVY);
    this.ctx.signal(p.id, { type: 'eliminated', by: 'ESATTORE' });
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
    this.fpsAb.onDeath(p);
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
        dashing: p.dashTime > 0,
        ability: this.fpsAb.status(p, getWeapon(p.weaponId)),
        guard: p.guardTime > 0,
        wall: p.wallTime > 0,
        locked: p.lockTime > 0 || p.stunTime > 0
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
    this.players.forEach((p, i) => {
      const x = cx + p.x * scale;
      const y = cy + p.z * scale;
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      // ogni giocatore: cerchio colorato + INIZIALE dentro + freccia di direzione + nome breve sotto (simboli semplici, niente faccine illeggibili)
      let tag = this.radarTags[i];
      let nameTag = this.radarNames[i];
      if (!tag) {
        tag = this.add.text(0, 0, p.initial, { fontFamily: FONT_DISPLAY, fontSize: '15px', color: '#ffffff', stroke: '#0b1220', strokeThickness: 3 }).setOrigin(0.5).setDepth(3);
        nameTag = this.add.text(0, 0, p.name.slice(0, 6).toUpperCase(), { fontFamily: FONT_BODY, fontSize: '11px', fontStyle: 'bold', color: '#e2e8f0', stroke: '#0b1220', strokeThickness: 3 }).setOrigin(0.5).setDepth(3);
        this.radarTags[i] = tag;
        this.radarNames[i] = nameTag;
      }
      tag.setPosition(x, y).setVisible(p.alive);
      nameTag.setPosition(x, y + 19).setVisible(p.alive);
      if (!p.alive) {
        g.fillStyle(0x64748b, 0.5);
        g.fillCircle(x, y, 8);
        return;
      }
      // freccia di direzione: triangolo che esce dal cerchio
      const sx = Math.sin(p.yaw);
      const sz = Math.cos(p.yaw);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(x + sx * 20, y + sz * 20, x + sx * 10 - sz * 6, y + sz * 10 + sx * 6, x + sx * 10 + sz * 6, y + sz * 10 - sx * 6);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, 11);
      g.lineStyle(2.5, 0xffffff, 1);
      g.strokeCircle(x, y, 11);
      // HP bar
      g.fillStyle(0x111827, 1);
      g.fillRect(x - 12, y - 24, 24, 4);
      g.fillStyle(p.hp > 40 ? 0x4ade80 : 0xf87171, 1);
      g.fillRect(x - 12, y - 24, 24 * (p.hp / MAX_HP), 4);
    });
  }

  /** Classifica live: per kill (poi meno morti), con il colore di ogni giocatore; chi e' a terra ha il teschio. */
  private renderBoard(): void {
    const order = [...this.players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    order.forEach((p, i) => {
      const row = this.rankTexts[i];
      if (!row) return;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`;
      const ab = this.fpsAb.status(p, getWeapon(p.weaponId));
      const t = `${medal} ${p.avatar} ${p.name} ${getWeapon(p.weaponId).icon}${p.alive ? '' : '  💀'}\n      ${p.kills} kill · ${p.deaths} morti · ⚡ ${stateLabel(ab)}`;
      if (row.text !== t) row.setText(t);
      row.setColor(p.color);
    });
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    this.splitScreen?.setRoundEndMessage('⏱ TEMPO SCADUTO');
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
    telemetry.metrics('fps', {
      kills: this.players.reduce((a, p) => a + p.kills, 0),
      deaths: this.players.reduce((a, p) => a + p.deaths, 0),
      accuracyPct: Math.round((this.players.reduce((a, p) => a + p.shotsHit, 0) / Math.max(1, this.players.reduce((a, p) => a + p.shotsFired, 0))) * 100)
    });
    abilityHub.end();
    this.ctx.signal(null, { type: 'fpsEnd', players: sorted.map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths })) });
    this.ctx.finish({ results });
  }
}
