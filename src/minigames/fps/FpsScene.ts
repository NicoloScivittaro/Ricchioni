import {humanViewPlayers} from '../../core/playerViews';
import {beginWeaponReload,advanceWeaponReload} from '../../../shared/fpsReload';
import type{WeaponReload}from '../../../shared/fpsReload';
import {FpsKillHistory} from '../../../shared/fpsCombat';
import type {FpsSurface} from '../../../shared/fpsCombat';
import {FPS_BODY,FPS_KILL_TARGET,stepFpsVertical} from '../../../shared/fpsRules';
import {blastVisible} from '../../../shared/fpsCover';
import { FPS_ADS, aimBlend, aimMovement, aimSensitivity, aimSpread, aimKick } from '../../../shared/fpsAim';
import { MotionBots } from '../bots/MotionBots';
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
import type {ImportedFpsArena} from './importedFpsArena';
import type {NuketownBots} from './NuketownBots';
import type {TerminalBots} from './TerminalBots';
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
  y: number;
  groundY:number;verticalSpeed:number;grounded:boolean;crouching:boolean;eyeHeight:number;
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
  weaponReload?:WeaponReload;
  fireCooldown: number;
  dashTime: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirZ: number;
  firing: boolean;
  ads: number;
  heat: number;
  recoilPitch: number;
  recoilYaw: number;
  moving: number;
  cancelVersion: number;
  firePressSeen:number; fireBuffer:number;
  lastSafe?:{x:number;y:number;z:number};
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

/** Finite-speed projectile; collision is evaluated during flight. */
interface EnergyBolt {
  id:number; owner:PlayerId; x:number;y:number;z:number; dx:number;dy:number;dz:number;
  remaining:number; speed:number; damage:number; splashDamage:number; radius:number;
}

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
  private soloBots!: MotionBots;
  private nuketown:ImportedFpsArena|null=null;
  private nuketownBots:NuketownBots|TerminalBots|null=null;
  private map=FPS_MAP;
  private roundReady=false;
  private worldReady=true;
  private bootVersion=0;
  private ctx!: MinigameContext;
  private players: FpsPlayer[] = [];
  private matchTime = 0;
  private finished = false;
  private winnerId:PlayerId|null=null;
  private killHistory=new FpsKillHistory();
  private broadcastAcc = 0;
  private pauseMenu!: PauseMenu;
  private graphics!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private rankTexts: Phaser.GameObjects.Text[] = [];
  private radarTags: Phaser.GameObjects.Text[] = [];
  private radarNames: Phaser.GameObjects.Text[] = [];
  private blasts: Blast[] = [];
  private energyBolts:EnergyBolt[]=[];
  private nextBoltId=0;
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
    this.roundReady=false;this.nuketown=null;this.nuketownBots=null;this.map=FPS_MAP;this.worldReady=true;
    const version=++this.bootVersion;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.bootVersion++;this.roundReady=false;});
    if(data.ctx.mapId==='terminal'){
      void Promise.all([import('./terminalArena'),import('./TerminalBots')]).then(async ([{TerminalArena},{TerminalBots}])=>{
        const arena=await TerminalArena.load();if(version!==this.bootVersion)return;
        this.nuketown=arena;this.map=arena;this.nuketownBots=new TerminalBots(data.ctx);this.createRound(data);
      }).catch(e=>{console.error('Terminal loading failed',e);if(version===this.bootVersion)this.add.text(100,300,'TERMINAL: caricamento fallito. Torna alla lobby.',{fontSize:'24px'});});
    }else if(data.ctx.mapId==='nuketown'){
      void Promise.all([import('./nuketownArena'),import('./NuketownBots')]).then(([{NuketownArena},{NuketownBots}])=>{
        if(version!==this.bootVersion)return;
        this.nuketown=new NuketownArena();this.map=this.nuketown;this.nuketownBots=new NuketownBots(data.ctx);this.createRound(data);
      }).catch(e=>{console.error('Nuketown loading failed',e);if(version===this.bootVersion)this.add.text(100,300,'NUKETOWN: caricamento fallito. Torna alla lobby.',{fontSize:'24px'});});
    }else this.createRound(data);
  }

  private createRound(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    for(const p of this.ctx.players)this.ctx.input.get(p.id).clearText('fpsWorldReady');
    this.soloBots = new MotionBots(this.ctx);
    this.players = [];
    this.finished = false;this.winnerId=null;this.killHistory=new FpsKillHistory();
    this.broadcastAcc = 0;
    this.clock=0;this.blasts=[];this.energyBolts=[];this.nextBoltId=0;
    this.rankTexts = [];
    this.radarTags = [];
    this.radarNames = [];
    this.matchTime = 0; // Score race: there is no gameplay time limit.
    this.controlsDone = false;
    this.splitScreen = null;
    this.splitScreenCanvas = null;
    this.splitScreenCancelled = false;
    audio.unlock();
    this.cameras.main.setBackgroundColor('#0b1220');

    this.graphics = this.add.graphics();
    this.add.text(640, 24, '🔫 SPARATORIA DEI DISAGIATI', { fontFamily: FONT_DISPLAY, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(640, 58, this.ctx.mapId==='terminal'?'TERMINAL · AEROPORTO, CORRIDOI E AEREO':this.nuketown?'NUKETOWN · CASE, CORTILI E COPERTURE':'RADAR / REGIA — i giocatori guardano il telefono', { fontFamily: FONT_BODY, fontSize: '16px', color: '#9ca3af' }).setOrigin(0.5);
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
        y: spawn.y??this.nuketown?.floorAt(spawn.x,spawn.z)??0,
        groundY:spawn.y??this.nuketown?.floorAt(spawn.x,spawn.z)??0,verticalSpeed:0,grounded:true,crouching:false,eyeHeight:FPS_BODY.eye,
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
        firing: false, ads: 0, heat: 0, recoilPitch: 0, recoilYaw: 0, moving: 0, cancelVersion: this.ctx.input.get(snap.id).cancellationVersion,
        firePressSeen:this.ctx.input.get(snap.id).pressCount('fire'),fireBuffer:0,
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

    // One TV view per human, whether they use a pad or phone. Bots stay in the match.
    const locals: FpsLocalPlayer[] = humanViewPlayers(this.ctx.players)
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
    this.roundReady=true;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.disposeSplitScreen, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.disposeSplitScreen, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => abilityHub.end());
  }

  private async bootSplitScreen(locals: FpsLocalPlayer[]): Promise<void> {
    const version=this.bootVersion;
    this.worldReady=!this.nuketown;
    const { BabylonFpsGame } = await import('./BabylonFpsGame');
    if (this.splitScreenCancelled||version!==this.bootVersion) return;

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
    this.splitScreen = new BabylonFpsGame(canvas, locals,this.ctx.mapId==='terminal'?'terminal':this.nuketown?'nuketown':'cantiere');
    this.worldReady=!this.nuketown;
    try{await this.splitScreen.ready;if(!this.splitScreenCancelled&&version===this.bootVersion){this.splitScreen.update(0,this.players.map(p=>this.toRenderSnapshot(p)));this.worldReady=true;}}
    catch(e){console.error('Nuketown rendering failed',e);this.splitScreen?.setRoundEndMessage('ERRORE CARICAMENTO MAPPA');}
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
      y:p.y,spawnProtection:p.spawnProtection,crouching:p.crouching,grounded:p.grounded,eyeHeight:p.eyeHeight,
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
      ads: p.ads, recoilPitch: p.recoilPitch, recoilYaw: p.recoilYaw, heat: p.heat, moving: p.moving,
      ability: this.fpsAb.status(p, getWeapon(p.weaponId)),
      guard: p.guardTime > 0,
      wall: p.wallTime > 0,
      locked: p.lockTime > 0 || p.stunTime > 0,
      reloadFrac: p.reloading ? Math.max(0, Math.min(1, 1 - p.reloadTimer / (p.weaponReload?.duration??getWeapon(p.weaponId).reload))) : 0, weaponReload:p.reloading?p.weaponReload:undefined,
      sweetFrom: p.characterId === 'goblin' ? AB.fps.goblin.p.from : null
    };
  }

  private pickSpawn(exclude: FpsPlayer[]): { x: number; z: number; y?:number } {
    // Sceglie lo spawn più lontano dai nemici vivi.
    let best = this.map.spawns[0];
    let bestScore = -Infinity;
    for (const s of this.map.spawns) {
      let minD = Infinity;
      for (const p of exclude) {
        if (!p.alive) continue;
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        minD = Math.min(minD, d);
      }
      if(this.nuketown){
        let exposure=0;
        for(const p of exclude)if(p.alive){
          const d=Math.hypot(s.x-p.x,s.z-p.z);
          if(this.nuketown.visible(s,p)){
            exposure+=Math.max(0,38-d)*.8;
            const aim=Math.abs(Math.atan2(Math.sin(Math.atan2(s.x-p.x,s.z-p.z)-p.yaw),Math.cos(Math.atan2(s.x-p.x,s.z-p.z)-p.yaw)));
            if(aim<.45)exposure+=p.firing?25:12;
          }
          if(d<5)exposure+=50;
        }
        minD=Math.min(45,minD)-exposure+this.ctx.rng.next()*.5;
      }
      if (minD > bestScore) {
        bestScore = minD;
        best = s;
      }
    }
    return { x: best.x, z: best.z, y:(best as {y?:number}).y };
  }

  update(_t: number, delta: number): void {
    if(!this.roundReady)return;
    if (this.pauseMenu.update()) {
      for (const p of this.players) { this.resetAim(p); this.ctx.input.get(p.id).setUp('aim'); this.ctx.input.get(p.id).setUp('fire'); p.firing = false; p.burstLeft = 0; }
      this.splitScreen?.setPaused(true);
      return;
    }
    this.splitScreen?.setPaused(false);
    if (this.finished) return;
    const waiting=this.ctx.mapId==='terminal'?this.ctx.players.filter(p=>!p.bot&&pads.slotOf(p.id)?.state!=='paired'&&this.ctx.input.get(p.id).text('fpsWorldReady')!==String(this.ctx.roundId??0)):[];
    if (!this.controlsDone || !this.worldReady || waiting.length>0) {
      if(waiting.length>0)this.timerText.setText('CARICAMENTO TERMINAL · '+waiting.map(p=>p.displayName).join(', '));
      this.ctx.input.update(); // schermata CONTROLLI: nessuna fase avanza, nessun input di gioco consumato
      return;
    }
    // Tempo reale (vedi core/frameClock): il timer scala con l'orologio, la simulazione va a sotto-passi.
    const steps = splitFrameDelta((delta / 1000) * getTimeScale()); // getTimeScale: 1, salvo rallentatore di debug
    const dt = steps.reduce((a, b) => a + b, 0);
    this.matchTime += dt;
    const leader=Math.max(0,...this.players.map(p=>p.kills));
    if(leader>=FPS_KILL_TARGET-2)setGameIntensity(2);
    this.timerText.setText(`PRIMO A ${FPS_KILL_TARGET} UCCISIONI · ${leader}/${FPS_KILL_TARGET}`);

    for (const sub of steps) {
      this.clock += sub;
      if(this.nuketown)this.nuketownBots!.step(sub,this.players,this.nuketown);else this.soloBots.fps(sub, this.players);
      for (const p of this.players) this.stepPlayer(p, sub);
      this.stepEnergyBolts(sub);
      this.stepBlasts();
      if(this.winnerId){this.endGame();return;}
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
    if(this.winnerId)return;
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
    // The authored Remington Shoot already contains its full pump cycle.
    if(weapon.shellReload&&!noFire&&!p.reloading&&p.magazine===0&&p.fireCooldown<=0)this.startReload(p,weapon);

    // Reload
    if (p.reloading) {
      if(p.weaponReload){
        const r=p.weaponReload,expected=r.duration-r.elapsed;
        const hold=Math.max(0,p.reloadTimer-expected),advance=Math.max(0,dt-hold);
        p.magazine+=advanceWeaponReload(weapon,r,advance);p.reloadTimer=Math.max(0,p.reloadTimer-dt);
        if(p.reloadTimer<=0){p.reloading=false;p.weaponReload=undefined;}
      }else{p.reloadTimer-=dt;if(p.reloadTimer<=0){p.reloading=false;p.magazine=weapon.magazine;}}
    }

    const input = this.ctx.input.get(p.id);
    if (p.cancelVersion !== input.cancellationVersion) { this.resetAim(p); p.burstLeft = 0; p.firing = false; p.cancelVersion = input.cancellationVersion; }
    p.fireBuffer=Math.max(0,p.fireBuffer-dt);
    const presses=input.pressCount('fire');
    if(presses!==p.firePressSeen){p.firePressSeen=presses;if(!noFire&&!p.reloading)p.fireBuffer=.12;}
    if(noFire||p.reloading)p.fireBuffer=0;
    p.ads = aimBlend(p.ads, input.pressed('aim') && !noFire && !p.reloading && p.dashTime <= 0, dt);
    p.heat = Math.max(0, p.heat - dt * FPS_ADS.heatDecay);
    const recoilDecay = Math.exp(-FPS_ADS.recoilDecay * dt);
    p.recoilPitch *= recoilDecay; p.recoilYaw *= recoilDecay;
    // ABILITA' (premuta ma non partita: avviso privato, mai silenzio)
    if (input.justPressed('ability')) {
      const res = this.fpsAb.onAbilityPress(p, weapon, this.players, (f) => this.onAbilityFeedback(p, f),this.nuketown?{
        visible:(a,b)=>this.nuketown!.visible(a,b),move:(a,b)=>this.nuketown!.move(a,b)
      }:undefined);
      if (res !== 'ok') abilityHub.failed(p.id, res === 'cooldown' ? 'IN RICARICA' : res === 'spent' ? 'ESAURITA' : res === 'notreloading' ? 'RICARICA PRIMA' : res === 'nobody' ? 'NESSUNO DAVANTI' : 'NON ORA');
    }
    const room=p.grounded?(this.nuketown?.headroomAt?.(p.x,p.z,p.groundY)??12):12;
    p.crouching=(!stunned&&input.pressed('crouch'))||room<FPS_BODY.standing;
    p.eyeHeight=p.crouching?FPS_BODY.crouchEye:FPS_BODY.eye;
    if(!stunned&&input.justPressed('jump')&&p.grounded&&!p.crouching){
      p.grounded=false;p.verticalSpeed=FPS_BODY.jumpSpeed;
      this.ctx.signal(p.id,{type:'jump'});
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
    p.moving = Math.min(1, mag);
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
      const sens = pads.settingsOf(p.id).sensitivity * aimSensitivity(p.ads,weapon.scopeZoom? .3:FPS_ADS.sensitivity); // 0.5..2 per giocatore, gia' esistente (prima inutilizzato)
      const rateX = Math.max(-AIM_CONFIG.maxTurnSpeed, Math.min(AIM_CONFIG.maxTurnSpeed, stick.x * curved * AIM_CONFIG.sensX * sens));
      const rateY = Math.max(-AIM_CONFIG.maxTurnSpeed, Math.min(AIM_CONFIG.maxTurnSpeed, stick.y * curved * AIM_CONFIG.sensY * sens));
      p.yaw += rateX * dt;
      p.pitch = Math.max(-AIM_CONFIG.pitchClamp, Math.min(AIM_CONFIG.pitchClamp, p.pitch - rateY * dt));
    } else {
      const look = input.axis('look');
      // look.x = yaw assoluto, look.y = pitch assoluto (inviato dal telefono, touch-drag) — invariato.
      if (input.hasAxis('look')) {
        p.yaw = look.x;
        p.pitch = Math.max(-AIM_CONFIG.pitchClamp, Math.min(AIM_CONFIG.pitchClamp, look.y));
      }
    }

    // Dash
    if (!stunned && !p.crouching && input.justPressed('dash') && p.dashCooldown <= 0 && p.dashTime <= 0) {
      p.ads = 0;
      p.dashTime = DASH_TIME;
      p.dashCooldown = DASH_COOLDOWN;
      p.dashDirX = mag > 0.15 ? ax : Math.sin(p.yaw);
      p.dashDirZ = mag > 0.15 ? az : Math.cos(p.yaw);
      audio.boost();
      this.ctx.vibrate(p.id, HAPTIC.LIGHT);
      this.ctx.signal(p.id, { type: 'dash' });
    }

    const previous={x:p.x,y:p.y,z:p.z};
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashDirX * DASH_SPEED * dt;
      p.z += p.dashDirZ * DASH_SPEED * dt;
    } else if (mag > 0.15) {
      const sp = PLAYER_SPEED * (p.crouching?FPS_BODY.crouchSpeed:1) * weapon.movementModifier * this.fpsAb.speedFactor(p) * aimMovement(p.ads);
      p.x += ax * sp * dt;
      p.z += az * sp * dt;
    }

    let supportFloor:number|null=p.groundY;
    if(this.nuketown){
      const height=p.crouching?FPS_BODY.crouched:FPS_BODY.standing;
      if(!p.grounded&&this.nuketown.moveAir){
        const moved=this.nuketown.moveAir(previous,p,height);p.x=moved.x;p.z=moved.z;
        supportFloor=this.nuketown.floorBelow?.(p.x,p.z,p.y+.1)??null;
        if(supportFloor!==null)p.groundY=supportFloor;
      }else {
        const moved=this.nuketown.move({...previous,y:p.groundY},p,height);
        p.x=moved.x;p.z=moved.z;p.groundY=moved.y??0;supportFloor=p.groundY;
      }
    }
    else {
      const res = resolveCollisions(p.x, p.z, PLAYER_RADIUS, FPS_MAP.obstacles);
      p.x = Math.max(-FPS_MAP.halfSize+PLAYER_RADIUS,Math.min(FPS_MAP.halfSize-PLAYER_RADIUS,res.x));
      p.z = Math.max(-FPS_MAP.halfSize+PLAYER_RADIUS,Math.min(FPS_MAP.halfSize-PLAYER_RADIUS,res.z));
    }

    const headroom=supportFloor===null?12:this.nuketown?.headroomAt?.(p.x,p.z,p.groundY)??12;
    if(headroom<FPS_BODY.standing){p.crouching=true;p.eyeHeight=FPS_BODY.crouchEye;}
    stepFpsVertical(p,dt,supportFloor??-50,supportFloor===null?50:p.groundY+headroom,p.crouching?FPS_BODY.crouched:FPS_BODY.standing);

    // Only anomalous loss of support triggers recovery; normal jumps/drops keep
    // using the same physical floor and walls as bots and human players.
    if(this.ctx.mapId==='terminal'&&(!Number.isFinite(p.y)||p.y<(supportFloor===null?p.groundY-.7:-5))){
      const safe=p.lastSafe??this.pickSpawn(this.players.filter(q=>q.id!==p.id));
      p.x=safe.x;p.z=safe.z;p.y=safe.y??0;p.groundY=p.y;p.verticalSpeed=0;p.grounded=true;
      this.resetAim(p);p.firing=false;p.burstLeft=0;this.ctx.signal(p.id,{type:'recovered'});
    }
    if(p.grounded&&supportFloor!==null)p.lastSafe={x:p.x,y:p.y,z:p.z};
    if(p.y < -6){this.collectDebt(p,'CADUTA');return;}

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

    // Semi fire consumes one monotonic press; holding an automatic weapon repeats.
    p.firing = !noFire && (weapon.fireMode==='semi'?p.fireBuffer>0:input.pressed('fire'));
    if (p.firing && p.fireCooldown <= 0 && !p.reloading && p.burstLeft <= 0) {
      if (p.magazine > 0) {
        p.fireBuffer=0;
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
    if(weapon.shellReload&&p.fireCooldown>0)return;
    p.ads = 0; p.fireBuffer=0;
    p.reloading = true;
    p.weaponReload=weapon.reloadInsert!==undefined||weapon.shellReload?beginWeaponReload(weapon,p.magazine):undefined;
    p.reloadTimer = p.weaponReload?.duration??weapon.reload;
    p.burstLeft = 0;
    this.ctx.signal(p.id, { type: 'reload', duration: p.reloadTimer, weaponId: weapon.id });
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
    this.resetAim(p);
    p.weaponId = next;
    p.magazine = w.magazine;
    p.reloading = false;
    p.reloadTimer = 0;p.weaponReload=undefined;
    p.burstLeft = 0;
    p.fireCooldown = 0.35; // breve tempo di estrazione
    this.ctx.signal(p.id, { type: 'equip', weaponId: next });
  }

  /** One shot: ballistic weapons use hitscan; the Ray Gun launches a swept energy bolt. */
  private fireShot(p: FpsPlayer, weapon: WeaponConfig): void {
    p.spawnProtection = 0; // spara → protezione rimossa subito
    p.magazine--;
    p.shotsFired++;
    this.ctx.signal(null,{type:'weaponShot',owner:p.id,weaponId:weapon.id});
    p.firing = true;
    // sulla TV senza split-screen solo un tick per le armi lente; con lo split-screen ogni arma ha il suo suono (BabylonFpsGame)
    if (weapon.fireRate < 4 && !this.splitScreen) audio.tick(0.75);
    const segs: { ox: number; oy: number; oz: number; ex: number; ey: number; ez: number }[] = [];

    const ox = p.x;
    const oy = p.eyeHeight+p.y;
    const oz = p.z;
    const pellets = weapon.pellets ?? 1;
    const spread = aimSpread(weapon.spread, p.ads, p.moving, p.heat,weapon.hipSpread) * this.fpsAb.spreadFactor(p); // Dottore dopo M'HO SVEJATO: la mira trema
    const dmgMult = this.fpsAb.damageFactor(p); // Goblin dopo la ricarica perfetta: piu' danno
    const damageBy = new Map<FpsPlayer, number>(); // un solo hit/danno per bersaglio per colpo, anche con 8 pallini
    let electricalTarget:FpsPlayer|null=null;
    for (let i = 0; i < pellets; i++) {
      // Dispersione
      const yaw = p.yaw + p.recoilYaw + (this.ctx.rng.next() - 0.5) * 2 * spread;
      const pitch = Math.max(-AIM_CONFIG.pitchClamp, Math.min(AIM_CONFIG.pitchClamp, p.pitch + p.recoilPitch + (this.ctx.rng.next() - 0.5) * 2 * spread));
      const dx = Math.sin(yaw) * Math.cos(pitch);
      const dy = Math.sin(pitch);
      const dz = Math.cos(yaw) * Math.cos(pitch);

      if(weapon.projectileKind==='energy'){
        const bolt:EnergyBolt={id:++this.nextBoltId,owner:p.id,x:ox,y:oy,z:oz,dx,dy,dz,remaining:weapon.range,speed:weapon.projectileSpeed,damage:weapon.damage*dmgMult,splashDamage:(weapon.splashDamage??0)*dmgMult,radius:weapon.splashRadius};
        // At six players the fire rate/range allow fewer than 24 live bolts.
        if(this.energyBolts.length>=32){const old=this.energyBolts.shift()!;this.ctx.signal(null,{type:'energyImpact',id:old.id,x:old.x,y:old.y,z:old.z,r:0});}
        this.energyBolts.push(bolt);
        this.ctx.signal(null,{type:'energyBolt',id:bolt.id,ox,oy,oz,dx,dy,dz,speed:bolt.speed,range:bolt.remaining});
        segs.push({ox,oy,oz,ex:ox+dx,ey:oy+dy,ez:oz+dz});
        continue;
      }
      // Raggio contro ostacoli + altri giocatori
      let bestT = weapon.range;
      if(dy<0&&!this.nuketown)bestT=Math.min(bestT,Math.max(0,(.2-oy)/dy));
      let surface:FpsSurface='unknown';
      let hitPlayer: FpsPlayer | null = null;
      if(this.nuketown){bestT=this.nuketown.ray(ox,oy,oz,dx,dy,dz,bestT);surface=this.nuketown.raySurface??'unknown';}
      else for (const b of FPS_MAP.obstacles) {
        const t = rayVsAabb(ox, oy, oz, dx, dy, dz, b);
        if (t !== null && t < bestT){bestT = t;surface=b.h>=4||b.h===2.5?'concrete':b.x>6&&b.z<-6?'wood':b.x>6&&b.z>6?'concrete':'metal';}
      }
      for (const other of this.players) {
        if (other.id === p.id || !other.alive) continue;
        const box: Aabb = { x: other.x, z: other.z, w: 0.8, d: 0.8, h: other.crouching?FPS_BODY.crouched:FPS_BODY.standing,base:other.y };
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
        if(weapon.id==='wunderwaffe'&&hitPlayer.spawnProtection<=0)electricalTarget=hitPlayer;
      }
      if(!hitPlayer&&bestT<weapon.range-.001)this.ctx.signal(null,{type:'surfaceImpact',x:ox+dx*bestT,y:oy+dy*bestT,z:oz+dz*bestT,nx:-dx,ny:-dy,nz:-dz,surface});
      segs.push({ ox, oy, oz, ex: ox + dx * bestT, ey: oy + dy * bestT, ez: oz + dz * bestT });
    }
    // Short PvP chain, never through cover, without duplicating the direct hit or spending extra rounds.
    if(electricalTarget){
      let from:FpsPlayer=electricalTarget;const visited=new Set([p.id,from.id]);
      for(let hop=0;hop<2;hop++){
        const origin={x:from.x,y:from.y+(from.crouching?.5:.9),z:from.z};
        const candidates=this.players.filter(q=>q.alive&&q.spawnProtection<=0&&!visited.has(q.id)).map(q=>{
          const y=q.y+(q.crouching?.5:.9),dx=q.x-origin.x,dy=y-origin.y,dz=q.z-origin.z,d=Math.hypot(dx,dy,dz);
          return{q,y,dx,dy,dz,d};
        }).filter(q=>q.d>1e-6&&q.d<=5).sort((a,b)=>a.d-b.d||a.q.id.localeCompare(b.q.id));
        const next=candidates.find(q=>this.nuketown?this.nuketown.ray(origin.x,origin.y,origin.z,q.dx/q.d,q.dy/q.d,q.dz/q.d,q.d)>=q.d-.001:!FPS_MAP.obstacles.some(b=>{const t=rayVsAabb(origin.x,origin.y,origin.z,q.dx/q.d,q.dy/q.d,q.dz/q.d,b);return t!==null&&t<q.d-.001;}));
        if(!next)break;visited.add(next.q.id);damageBy.set(next.q,65*dmgMult);
        segs.push({ox:origin.x,oy:origin.y,oz:origin.z,ex:next.q.x,ey:next.y,ez:next.q.z});from=next.q;
      }
    }
    // solo grafica/suono, nello stesso istante del colpo: rinculo, lampo e traccianti fino al punto colpito VERO
    this.splitScreen?.notifyShot(p.id, weapon.id, segs);
    if(!weapon.projectileKind)this.ctx.signal(null,{type:'shotTrace',owner:p.id,weaponId:weapon.id,segs});

    let connected = false;
    for (const [victim, dmg] of damageBy) if (this.applyDamage(victim, Math.round(dmg), p)) connected = true;
    if (connected) p.shotsHit++;
    const kick = aimKick(weapon.id, p.ads, this.ctx.rng.next());
    p.recoilPitch = Math.min(0.18, p.recoilPitch + kick.pitch);
    p.recoilYaw = Math.max(-0.06, Math.min(0.06, p.recoilYaw + kick.yaw));
    p.heat = Math.min(1, p.heat + 0.3);
    this.fpsAb.onShotFired(p); // Goblin: un colpo del bonus in meno
    if (p.magazine <= 0&&!weapon.shellReload) this.startReload(p, weapon); // Remington finishes its authored pump first.
  }

  /** Bombarda: il proiettile vola (visibile sui telefoni) e la SUA esplosione fa danno ad area nel punto calcolato allo sparo. */
  private launchBlast(p: FpsPlayer, weapon: WeaponConfig, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, t: number, dmgMult = 1): void {
    const impactT=Math.max(0,t-.02); // keep splash just outside the impacted wall
    const tx = ox + dx * impactT;
    const ty = Math.max(0.2, oy + dy * impactT);
    const tz = oz + dz * impactT;
    const dur = t / (weapon.projectileSpeed || 20);
    this.blasts.push({ x: tx, y: ty, z: tz, at: this.clock + dur, owner: p.id, dmg: weapon.damage * dmgMult, radius: weapon.splashRadius });
    this.ctx.signal(null, { type: 'proj', ox, oy: oy - 0.25, oz, tx, ty, tz, dur });
  }

  /** Sweep each real energy projectile against current bodies and map geometry. */
  private stepEnergyBolts(dt:number):void {
    for(let i=this.energyBolts.length-1;i>=0;i--){
      const b=this.energyBolts[i],travel=Math.min(b.remaining,b.speed*dt);
      let hit=this.nuketown?this.nuketown.ray(b.x,b.y,b.z,b.dx,b.dy,b.dz,travel):travel;
      if(!this.nuketown)for(const box of FPS_MAP.obstacles){const t=rayVsAabb(b.x,b.y,b.z,b.dx,b.dy,b.dz,box);if(t!==null&&t<hit)hit=t;}
      if(b.dy<0){const t=(.05-b.y)/b.dy;if(t>=0&&t<hit)hit=t;}
      let victim:FpsPlayer|null=null;
      for(const q of this.players){
        if(q.id===b.owner||!q.alive)continue;
        const t=rayVsAabb(b.x,b.y,b.z,b.dx,b.dy,b.dz,{x:q.x,z:q.z,w:1,d:1,base:q.y-.1,h:(q.crouching?FPS_BODY.crouched:FPS_BODY.standing)+.2});
        if(t!==null&&t<hit){hit=t;victim=q;}
      }
      const collided=hit<travel;
      const advance=Math.max(0,hit-(collided ? .025 : 0));
      b.x+=b.dx*advance;b.y+=b.dy*advance;b.z+=b.dz*advance;b.remaining-=travel;
      if(!collided&&b.remaining>0)continue;
      this.energyBolts.splice(i,1);
      this.ctx.signal(null,{type:'energyImpact',id:b.id,x:b.x,y:b.y,z:b.z,r:collided?b.radius:0});
      const owner=this.players.find(q=>q.id===b.owner);if(!owner||!collided)continue;
      let connected=false;
      if(victim)connected=this.applyDamage(victim,Math.round(b.damage),owner,b);
      for(const q of this.players){
        if(q===victim||q.id===b.owner||!q.alive)continue;
        const dist=Math.max(0,Math.hypot(q.x-b.x,q.y+(q.crouching ? .5 : .9)-b.y,q.z-b.z)-.4);
        if(dist>b.radius||!(this.nuketown?this.nuketown.blastVisible(b,q):blastVisible(b,q,FPS_MAP.obstacles)))continue;
        if(this.applyDamage(q,Math.round(b.splashDamage*(1-.7*dist/b.radius)),owner,b))connected=true;
      }
      if(connected)owner.shotsHit++;
    }
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
        if (dist > b.radius || b.y>q.y+1.8+b.radius || !(this.nuketown?this.nuketown.blastVisible(b,q):blastVisible(b,q,FPS_MAP.obstacles))) continue;
        // colpo diretto = danno pieno; poi cala fino al 30% al bordo dello splash
        const k = dist <= 1 ? 1 : Math.max(0.3, 1 - (0.7 * (dist - 1)) / (b.radius - 1));
        this.applyDamage(q, Math.round(b.dmg * k), owner, b);
      }
    }
  }

  /** Applica il danno; ritorna false se non e' stato inflitto (bersaglio protetto). L'hit al tiratore parte SOLO da qui: conferma reale. */
  private applyDamage(target: FpsPlayer, damage: number, source: FpsPlayer, origin: { x: number; z: number } = source): boolean {
    if(this.winnerId)return false;
    if (!target.alive || target.spawnProtection > 0) return false;
    // BUTTAFUORI: il giubbotto assorbe parte del danno (che poi in parte torna come vita)
    const taken = this.fpsAb.reduceDamage(target, damage);
    damage = taken;
    target.hp -= damage;
    source.damageDealt += damage;
    this.ctx.signal(target.id, { type: 'damaged', amount: damage, from: source.id, direction: Math.atan2(origin.x - target.x, origin.z - target.z) - target.yaw - target.recoilYaw });
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
    if(this.winnerId)return;
    target.hp = 0;
    target.alive = false;
    this.resetAim(target); this.ctx.input.get(target.id).setUp('aim'); this.ctx.input.get(target.id).setUp('fire'); target.firing = false; target.burstLeft = 0;
    target.respawnTimer = RESPAWN_TIME;
    target.deaths++;
    const wasLeader=target.kills>0&&target.kills===Math.max(...this.players.map(q=>q.kills));
    const badge=this.killHistory.record(killer.id,target.id,this.clock,wasLeader);
    killer.kills++;
    if(killer.kills>=FPS_KILL_TARGET&&!this.winnerId)this.winnerId=killer.id;
    this.fpsAb.onKill(killer, (f) => this.onAbilityFeedback(killer, f), (hp) => (killer.hp = Math.min(MAX_HP, killer.hp + hp)));
    this.fpsAb.onDeath(target); // le finestre aperte non sopravvivono alla morte (le cariche restano com'erano)
    audio.wrong();
    this.ctx.vibrate(target.id, HAPTIC.HEAVY);
    this.ctx.vibrate(killer.id, HAPTIC.SUCCESS);
    this.ctx.signal(target.id, { type: 'eliminated', by: killer.id });
    this.ctx.signal(killer.id, { type: 'killed', name: target.name, badge });
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
  private collectDebt(p: FpsPlayer,by='ESATTORE'): void {
    if (!p.alive) return;
    p.hp = 0;
    p.alive = false;
    this.resetAim(p); this.ctx.input.get(p.id).setUp('aim'); this.ctx.input.get(p.id).setUp('fire'); p.firing = false; p.burstLeft = 0;
    p.respawnTimer = RESPAWN_TIME;
    p.deaths++;
    this.fpsAb.onDeath(p);
    audio.wrong();
    this.ctx.vibrate(p.id, HAPTIC.HEAVY);
    this.ctx.signal(p.id, { type: 'eliminated', by });
  }

  private resetAim(p: FpsPlayer): void {
    p.ads = p.heat = p.recoilPitch = p.recoilYaw = p.moving = 0;
    p.fireBuffer=0;p.firePressSeen=this.ctx.input.get(p.id).pressCount('fire');
  }

  private respawn(p: FpsPlayer): void {
    const spawn = this.pickSpawn(this.players.filter((q) => q.id !== p.id));
    p.x = spawn.x;
    p.y=spawn.y??this.nuketown?.floorAt(spawn.x,spawn.z)??0;
    p.lastSafe={x:p.x,y:p.y,z:spawn.z};
    p.groundY=p.y;p.grounded=true;p.verticalSpeed=0;p.crouching=false;p.eyeHeight=FPS_BODY.eye;
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
      mapId:this.ctx.mapId==='terminal'?'terminal':this.nuketown?'nuketown':'cantiere',
      matchTime: this.matchTime,killTarget:FPS_KILL_TARGET,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        x: p.x,
        y:p.y,crouching:p.crouching,grounded:p.grounded,eyeHeight:p.eyeHeight,
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
        reloading: p.reloading, weaponReload:p.reloading?p.weaponReload:undefined,reloadFrac:p.reloading?Math.max(0,Math.min(1,1-p.reloadTimer/(p.weaponReload?.duration??getWeapon(p.weaponId).reload))):0,
        ads: p.ads, recoilPitch: p.recoilPitch, recoilYaw: p.recoilYaw, heat: p.heat, moving: p.moving,
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
    const scale = this.ctx.mapId==='terminal'?3.1:this.nuketown?6.3:RADAR_SCALE;
    const cx = RADAR_CX;
    const cy = RADAR_CY;

    g.lineStyle(2, 0x334155, 1);
    g.fillStyle(0x0f172a, 1);
    g.fillRoundedRect(cx - this.map.halfSize * scale - 20, cy - this.map.halfSize * scale - 20, this.map.halfSize * scale * 2 + 40, this.map.halfSize * scale * 2 + 40, 12);
    g.strokeRoundedRect(cx - this.map.halfSize * scale - 20, cy - this.map.halfSize * scale - 20, this.map.halfSize * scale * 2 + 40, this.map.halfSize * scale * 2 + 40, 12);

    // Ostacoli
    g.fillStyle(0x475569, 1);
    for (const b of this.map.obstacles) {
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
    for (const p of this.players) { this.resetAim(p); p.firing = false; p.burstLeft = 0; this.ctx.input.get(p.id).setUp('aim'); this.ctx.input.get(p.id).setUp('fire'); }
    this.splitScreen?.setRoundEndMessage(`🏆 ${this.players.find(p=>p.id===this.winnerId)?.name??'VITTORIA'} · ${FPS_KILL_TARGET} UCCISIONI`);
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
        `${p.kills}/${FPS_KILL_TARGET} kill · ${p.deaths} morti`,
        p.shotsFired > 0 ? `precisione ${Math.round((p.shotsHit / p.shotsFired) * 100)}%` : 'nessun colpo sparato'
      ]
    }));
    telemetry.metrics('fps', {
      kills: this.players.reduce((a, p) => a + p.kills, 0),
      deaths: this.players.reduce((a, p) => a + p.deaths, 0),
      accuracyPct: Math.round((this.players.reduce((a, p) => a + p.shotsHit, 0) / Math.max(1, this.players.reduce((a, p) => a + p.shotsFired, 0))) * 100)
    });
    abilityHub.end();
    this.ctx.signal(null, { type: 'fpsEnd', winnerId:this.winnerId,killTarget:FPS_KILL_TARGET,players: sorted.map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths })) });
    this.ctx.finish({ results });
  }
}
