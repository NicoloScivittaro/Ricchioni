import { Rng } from '../../../shared/rng';
import { ArcRotateCamera, Color3, DynamicTexture, Engine, Matrix, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { PlayerId, PlayerResult } from '../../../shared/types';
import type { MinigameContext } from '../types';
import { AB } from '../../../shared/abilityCatalog';
import { audio } from '../../core/AudioManager';
import { setGameIntensity } from '../../core/musicDirector';
import { abilityHub } from '../../core/abilityHub';
import { runSteps } from '../../core/frameClock';
import { guardLoop, safely } from '../../core/loopGuard';
import { applyQuality, engineOptions } from '../../core/quality';
import { debugEnabled, registerDebugSection } from '../../core/debug';
import { telemetry } from '../../core/telemetry';
import { ArenaEntity } from '../arena/arenaEntity';
import type { VisualSubject } from '../arena/arenaEntity';
import { registerEnvScene } from '../env/envDebug';
import { CasaCarboWorld } from './waterCore';
import { drainRoute } from './ccNavigation';
import { CCBot, botRoles } from './ccBot';
import { CC } from './ccTuning';
import { CC_NO_INPUT } from './ccTypes';
import type { CCEvent, CCInput, CCPlayer } from './ccTypes';
import { DOORS, DRAINS, TV_POINT, toWorldX, toWorldZ } from './mapData';
import { buildCasaCarboEnvironment } from './casaCarboEnvironment';
import { CasaCarboHud } from './casaCarboHud';
import { contribution, drainedOf, titles } from './scoring';
import { CasaCarboAnimation, hasCasaCarboAnimations } from './casaCarboAnimation';

const COUNTDOWN_S = 3.2;
const ENDING_S = 6.5;
const SHORT: Record<string, string> = { goblin: 'GOBLIN', buttafuori: 'BOSCHI', judoka: 'CARBO', dottore: 'VICTOR', ciro: 'CIRO' };
const DOOR_NAME: Record<string, string> = { front: 'PORTA DAVANTI', back: 'PORTA DIETRO' };
const DRAIN_NAME: Record<string, string> = { bagno: 'SCARICO DEL BAGNO', lavello: 'LAVELLO', tombino: 'TOMBINO' };
const SIZE = 0.86;

type Phase = 'tutorial' | 'countdown' | 'playing' | 'ending';

let activeGame: CasaCarboGame | null = null;
let debugRegistered = false;

/** Etichetta 3D sempre rivolta alla camera (porte, scarichi, TV): testo ridisegnato SOLO quando cambia. */
class Label {
  readonly mesh: Mesh;
  private tex: DynamicTexture;
  private last = '';
  constructor(scene: Scene, name: string, x: number, y: number, z: number, w = 2.6, h = 0.7) {
    this.tex = new DynamicTexture(`${name}Tex`, { width: 512, height: 128 }, scene, false);
    this.tex.hasAlpha = true;
    const m = new StandardMaterial(`${name}Mat`, scene);
    m.diffuseTexture = this.tex;
    m.useAlphaFromDiffuseTexture = true;
    m.emissiveColor = Color3.White();
    m.disableLighting = true;
    m.backFaceCulling = false;
    this.mesh = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
    this.mesh.material = m;
    this.mesh.position.set(x, y, z);
    this.mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.mesh.isPickable = false;
  }
  set(text: string, color: string, bg = 'rgba(12,16,28,0.82)'): void {
    const key = text + color + bg;
    if (key === this.last) return;
    this.last = key;
    const c = this.tex.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 512, 128);
    if (!text) {
      this.tex.update();
      this.mesh.isVisible = false;
      return;
    }
    this.mesh.isVisible = true;
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(8, 14, 496, 100, 26);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 6;
    c.stroke();
    let size = 54;
    c.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    while (c.measureText(text).width > 470 && size > 24) {
      size -= 4;
      c.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    }
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 66);
    this.tex.update();
  }
  dispose(): void {
    this.mesh.dispose(false, true);
    this.tex.dispose();
  }
}

/** Orchestratore 3D di CASA CARBO: input -> simulatore (waterCore) -> disegno, suoni, HUD, abilita', risultati. */
export class CasaCarboGame {
  private engine: Engine;
  private scene: Scene;
  private world: CasaCarboWorld;
  private env: ReturnType<typeof buildCasaCarboEnvironment>;
  private camera: ArcRotateCamera;
  private hud: CasaCarboHud;
  private entities = new Map<PlayerId, ArenaEntity>();
  private buckets = new Map<PlayerId, Mesh>();
  private squeegees = new Map<PlayerId, Mesh>();
  private characterAnimations = new Map<PlayerId, CasaCarboAnimation>();
  private doorLabels = new Map<string, Label>();
  private drainLabels = new Map<string, Label>();
  private tvLabel: Label;
  private emergencyLabel: Label;
  private neighbor: ArenaEntity | null = null;
  private names = new Map<PlayerId, string>();
  private colors = new Map<PlayerId, string>();
  private chars = new Map<PlayerId, string>();
  private botRng = new Rng();
  private bots = new Map<PlayerId, CCBot>();

  private phase: Phase = 'tutorial';
  private matchWorld: CasaCarboWorld | null = null;
  private tutorialT = 0;
  private tutorialStage = 0;
  private tutorialStarted = false;
  private guidance = new Map<string,Label>();
  private actionFeedback = new Map<string,{text:string;until:number}>();
  private controlsDone = false;
  private countdown = COUNTDOWN_S;
  private lastCountInt = 4;
  private endingT = 0;
  private endLines: { at: number; text: string; sub: string; color: string; done: boolean }[] = [];
  private saved = false;
  private dryAtEnd = 0;
  private resultsSent = false;
  private disposed = false;
  private paused = false;
  private waterT = 0;
  private labelsT = 0;
  private shakeT = 0;
  private gameTime = 0;
  private lastCount = 0;
  private lastPeakWarned = false;
  private camBase = new Vector3();
  private interiorMask: Uint8Array;

  private onResize = (): void => {
    this.engine.resize();
    this.fitCamera();
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: MinigameContext,
    opts: { lab?: boolean } = {}
  ) {
    this.engine = new Engine(canvas, engineOptions().antialias, engineOptions());
    this.scene = new Scene(this.engine);
    this.world = new CasaCarboWorld({ ids: ctx.players.map((p) => p.id), characters: ctx.players.map((p) => p.characterId ?? 'goblin'), rng: () => ctx.rng.next() });
    for (const p of ctx.players) if (p.bot) this.setBot(p.id, true);
    this.env = buildCasaCarboEnvironment(this.scene);
    this.interiorMask = new Uint8Array(this.world.h.length);
    for (const k of this.world.grid.interiorCells) this.interiorMask[k] = 1;
    registerEnvScene(this.scene);
    this.camera = new ArcRotateCamera('ccCam', -Math.PI / 2, 0.5, 26, new Vector3(0, 0, toWorldZ(470)), this.scene);
    this.camera.fov = 0.8;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 600;
    this.camera.inputs.clear();
    this.scene.activeCamera = this.camera;
    this.fitCamera();
    this.hud = new CasaCarboHud(this.scene);

    const dotTex = new DynamicTexture('ccDot', 16, this.scene, false);
    const dc = dotTex.getContext() as unknown as CanvasRenderingContext2D;
    dc.fillStyle = 'white';
    dc.beginPath();
    dc.arc(8, 8, 7, 0, Math.PI * 2);
    dc.fill();
    dotTex.update();

    abilityHub.begin('casacarbo', ctx);
    const bucketMat = new StandardMaterial('ccBucketMat', this.scene);
    bucketMat.diffuseColor = Color3.FromHexString('#c9ced6');
    bucketMat.emissiveColor = new Color3(0.2, 0.22, 0.25);
    const bladeMat = new StandardMaterial('ccBladeMat', this.scene);
    bladeMat.diffuseColor = Color3.FromHexString('#ffcc33');
    bladeMat.emissiveColor = new Color3(0.3, 0.25, 0.05);
    for (const snap of ctx.players) {
      const e = new ArenaEntity(this.scene, dotTex, snap.color, snap.characterId, snap.avatar, snap.displayName, null, { context: 'casacarbo' });
      e.setSizeMul(SIZE);
      this.entities.set(snap.id, e);
      if (hasCasaCarboAnimations(snap.characterId)) this.characterAnimations.set(snap.id,new CasaCarboAnimation(snap.characterId));
      this.names.set(snap.id, snap.displayName);
      this.colors.set(snap.id, snap.color);
      this.chars.set(snap.id, snap.characterId ?? 'goblin');
      const b = MeshBuilder.CreateCylinder('ccBucket', { diameterTop: 0.42, diameterBottom: 0.32, height: 0.38, tessellation: 12 }, this.scene);
      b.material = bucketMat;
      b.parent = e.root;
      b.position.set(0.55, 0.55, 0.05);
      b.isPickable = false;
      this.buckets.set(snap.id, b);
      const blade = MeshBuilder.CreateBox('ccSqueegee', { width: 1.1, height: 0.12, depth: 0.12 }, this.scene);
      blade.material = bladeMat;
      blade.parent = e.root;
      blade.position.set(0, 0.08, 0.95);
      blade.isPickable = false;
      blade.isVisible = false;
      const handle = MeshBuilder.CreateCylinder('ccSqueegeeHandle', { diameter: 0.06, height: 1.1, tessellation: 6 }, this.scene);
      handle.material = bladeMat;
      handle.parent = blade;
      handle.position.set(0, 0.42, -0.35);
      handle.rotation.x = -0.9;
      handle.isPickable = false;
      this.squeegees.set(snap.id, blade);
      this.hud.attachTag(snap.id, e.root, snap.color);
      this.guidance.set(snap.id,new Label(this.scene,'ccGuide_'+snap.id,0,.2,0,1.8,.5));
    }
    this.hud.buildBoard(ctx.players.map((s) => ({ id: s.id, label: SHORT[s.characterId ?? ''] ?? s.displayName.toUpperCase(), characterId: s.characterId, color: s.color })));
    for (const d of DOORS) {
      const out = d.inward === -1 ? d.cy - 55 : d.cy + 55;
      this.doorLabels.set(d.id, new Label(this.scene, `ccDoorLabel_${d.id}`, toWorldX(d.cx), 2.2, toWorldZ(out), 3.2, 0.8));
    }
    for (const d of DRAINS) this.drainLabels.set(d.id, new Label(this.scene, `ccDrainLabel_${d.id}`, toWorldX(d.cx), 1.9, toWorldZ(d.cy), 2.4, 0.6));
    this.tvLabel = new Label(this.scene, 'ccTvLabel', toWorldX(TV_POINT.cx + 40), 2.3, toWorldZ(TV_POINT.cy), 2.6, 0.7);
    this.tvLabel.set('', '#ffffff');
    this.emergencyLabel=new Label(this.scene,'ccBedroomLabel',toWorldX(420),2.2,toWorldZ(260),3.2,.8);
    this.emergencyLabel.set('','#fff');
    this.hud.clearCountdown();
    if(opts.lab)this.phase='countdown';
    this.hud.setTime(this.world.duration);
    this.hud.setDry(1);

    if (ctx.showControls && !opts.lab) void ctx.showControls().then(() => (this.controlsDone = true));
    else this.controlsDone = true;

    applyQuality(this.engine, this.scene);
    this.engine.runRenderLoop(
      guardLoop(() => {
        if (this.disposed || this.paused) return;
        runSteps(this.engine.getDeltaTime(), (dt) => this.step(dt));
        this.scene.render();
      })
    );
    window.addEventListener('resize', this.onResize);
    activeGame = this;
    if (debugEnabled()) {
      (window as unknown as Record<string, unknown>).__casacarbo = this;
      if (!debugRegistered) {
        debugRegistered = true;
        registerDebugSection(() => (activeGame ? activeGame.debugLines() : []));
      }
    }
  }

  /** Inquadratura fissa: tutta la casa + la striscia del giardino posteriore col tombino (i giardini non devono rubare spazio). */
  private fitCamera(): void {
    const aspect = Math.max(1, this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight()));
    // la casa e' larga 34 m: col bordo piu' lontano (in alto) che si restringe in prospettiva serve un po' di margine
    const halfW = 19.6;
    const r = halfW / (Math.tan(this.camera.fov / 2) * aspect);
    this.camera.radius = Math.max(22, Math.min(46, r));
    this.camBase.set(0, 0, toWorldZ(485));
    this.camera.target.copyFrom(this.camBase);
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  // ------------------------------------------------------------------ loop

  private step(dt: number): void {
    const now = performance.now();
    if (this.phase === 'tutorial') {
      if(this.controlsDone)this.stepTutorial(dt);
    } else if (this.phase === 'countdown') {
      if (!this.controlsDone) dt = 0;
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.lastCountInt && n > 0) {
        this.lastCountInt = n;
        this.hud.setCountdown(String(n));
        audio.countdown(n);
        this.ctx.signal(null, { type: 'countdown', value: n });
      } else if (this.countdown <= 0) {
        this.phase = 'playing';
        this.hud.setCountdown('VIA!', '#4ade80');
        audio.go();
        this.ctx.signal(null, { type: 'countdown', value: 0 });
        window.setTimeout(() => {
          if (!this.disposed) this.hud.clearCountdown();
        }, 700);
        this.hud.feedMessage('«REGÀ VENITE SUBITO CHE ME SE STA ALLAGÀ CASA!»', '#93c5fd', 3200);
      }
    } else if (this.phase === 'playing') {
      this.gameTime += dt;
      const inputs = new Map<PlayerId, CCInput>();
      for (const p of this.ctx.players) inputs.set(p.id, this.readInput(p.id, dt));
      this.world.step(dt, inputs);
      for (const e of this.world.drainEvents()) this.handle(e);
      if (this.world.over) this.startEnding();
    } else if (this.phase === 'ending') {
      this.endingT += dt;
      for (const l of this.endLines) {
        if (!l.done && this.endingT >= l.at) {
          l.done = true;
          if (l.at === 0) this.hud.announce(l.text, l.sub, l.color, (ENDING_S + 1) * 1000, 46);
          else this.hud.say(l.sub, l.text, l.color, 2300);
        }
      }
      if (this.endingT >= ENDING_S && !this.resultsSent) {
        this.resultsSent = true;
        this.ctx.finish({ results: this.buildResults() });
      }
    }

    this.updateVisuals(dt, now);
    this.waterT -= dt;
    if (this.waterT <= 0) {
      this.waterT = 0.1;
      this.env.updateWater(this.world.h, this.interiorMask, this.world.blocked);
    }
    this.labelsT -= dt;
    if (this.labelsT <= 0) {
      this.labelsT = 0.25;
      this.updateLabels();
    }
    this.env.update(dt);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.camera.target.set(this.camBase.x + (Math.random() - 0.5) * 0.12, this.camBase.y, this.camBase.z + (Math.random() - 0.5) * 0.12);
    } else this.camera.target.copyFrom(this.camBase);
    this.syncHud();
    this.ctx.input.update();
  }

  /** Short interactive rehearsal uses a separate simulator: no water, points, or ability charges carry into the match. */
  private stepTutorial(dt:number):void {
    if(!this.tutorialStarted){
      this.tutorialStarted=true;this.matchWorld=this.world;
      const practiceRng=new Rng(127);
      this.world=new CasaCarboWorld({ids:this.ctx.players.map(p=>p.id),characters:this.ctx.players.map(p=>p.characterId??'goblin'),rng:()=>practiceRng.next(),events:false,duration:60});
      for(let i=0;i<15*60;i++)this.world.step(1/60,{});
      this.world.drainEvents();
      const spots=[[712,675],[675,660],[750,660],[847,205],[815,225]];
      this.world.players.forEach((p,i)=>{[p.x,p.y]=spots[i];p.fx=0;p.fy=i<3?1:-1;});
    }
    this.tutorialT+=dt;
    const inputs=new Map<PlayerId,CCInput>();
    for(const p of this.ctx.players)inputs.set(p.id,this.readInput(p.id,dt));
    this.world.step(dt,inputs);
    for(const e of this.world.drainEvents()){
      if(this.tutorialStage===0 && e.t==='waterAction' && e.via==='push')this.tutorialStage=1;
      else if(this.tutorialStage===1 && e.t==='waterAction' && e.via==='scoop'){
        this.tutorialStage=2;
        // Rehearsal shortcut: show the drain gesture without spending the tutorial crossing the house.
        this.world.players.forEach((p,i)=>{p.x=820+i*29;p.y=790;p.vx=p.vy=0;});
      } else if(this.tutorialStage===2 && e.t==='drain')this.tutorialStage=3;
      if(e.t==='drain'||e.t==='waterAction'||e.t==='spill')this.handle(e);
    }
    const instructions=['X / □ — SPINGI L’ACQUA DAVANTI A TE','Y / △ — TIENI PER RACCOGLIERE COL SECCHIO','Y / △ — PREMI VICINO AL TOMBINO PER SVUOTARE','PROVA RIUSCITA! ACQUA SCARICATA = PUNTI'];
    this.hud.tutorial(instructions[this.tutorialStage],`PROVA LIBERA · ${Math.max(0,Math.ceil(18-this.tutorialT))}s · B / ◯ contiene una porta · RB / R1 abilità`);
    if(this.tutorialT>=18 || this.tutorialStage===3){
      this.world=this.matchWorld!;this.matchWorld=null;this.phase='countdown';this.ctx.input.reset();
      this.actionFeedback.clear();this.hud.tutorial('','');this.hud.setCountdown('3');
      this.hud.feedMessage('SCARICA = +PUNTI · SOLO SPOSTARE = 0 · ASCIUTTA ALMENO 75%', '#93c5fd',3500);
    }
  }

  // ------------------------------------------------------------------ input

  private readInput(id: PlayerId, dt: number): CCInput {
    const bot = this.bots.get(id);
    if (bot) return bot.input(this.world, dt);
    const inp = this.ctx.input.get(id);
    const ax = inp.axis('move');
    let mx = ax.x;
    let my = -ax.y;
    if (inp.pressed('left')) mx -= 1;
    if (inp.pressed('right')) mx += 1;
    if (inp.pressed('up')) my += 1;
    if (inp.pressed('down')) my -= 1;
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    return {
      ...CC_NO_INPUT,
      mx,
      my,
      squeegeeHeld: inp.pressed('squeegee'),
      bucketPressed: inp.justPressed('bucket'),
      bucketHeld: inp.pressed('bucket'),
      dashPressed: inp.justPressed('dash'),
      interactHeld: inp.pressed('interact'),
      abilityPressed: inp.justPressed('ability')
    };
  }

  // ------------------------------------------------------------------ eventi

  private player(id: string): CCPlayer | undefined {
    return this.world.byId.get(id);
  }
  private label(id: string): string {
    return SHORT[this.chars.get(id) ?? ''] ?? (this.names.get(id) ?? '').toUpperCase();
  }
  private pan(px: number): number {
    return Math.max(-0.8, Math.min(0.8, toWorldX(px) / 18));
  }

  private handle(e: CCEvent): void {
    switch (e.t) {
      case 'waterAction': {
        const p=this.player(e.id);if(p){
          this.env.waterFeedback(p.x+p.fx*30,p.y+p.fy*30,e.via==='push'?p.fx:0,e.via==='push'?p.fy:0);
          this.actionFeedback.set(e.id,{text:e.via==='scoop'?`RACCOLTO ${e.amount.toFixed(1)} L`:'SPINGO → · 0 PT',until:this.gameTime+.5});
        }
        break;
      }
      case 'emergency': {
        const names={tv:'SALVA LA TV!',bedroom:'LA CAMERA SI ALLAGA!',door:'FERMATE QUELL’ACQUA!'};
        if(e.state==='start')this.hud.announce(names[e.kind],e.kind==='tv'?'B / ◯ vicino alla TV · bonus a chi aiuta':e.kind==='bedroom'?'Togli il 35%: raccogli in camera e SCARICA':'B / ◯ vicino alla porta segnalata · contiene la raffica','#fbbf24',1800);
        else{this.hud.feedMessage(e.state==='won'?'OBIETTIVO RIUSCITO!':'EMERGENZA SCADUTA',e.state==='won'?'#4ade80':'#f87171',1800);for(const [id,pts] of Object.entries(e.rewards??{}))this.actionFeedback.set(id,{text:`BONUS +${pts.toFixed(1)}`,until:this.gameTime+2});}
        break;
      }
      case 'phase':
        if (e.name === 'forte') this.hud.announce('PIOVE FORTE!', 'L\'ACQUA ENTRA DALLE PORTE', '#93c5fd', 1500, 56);
        if (e.name === 'raffiche') this.hud.announce('RAFFICHE!', 'GUARDATE LE PORTE', '#fbbf24', 1500, 56);
        if (e.name === 'picco') {
          this.hud.announce('IL TEMPORALE È AL MASSIMO', 'TUTTE E DUE LE PORTE!', '#f87171', 1800, 46);
          setGameIntensity(2);
          this.thunder(1);
        }
        if (e.name === 'calma') this.hud.announce('SPIOVE UN PO\'', 'ULTIMA OCCASIONE PER ASCIUGARE', '#4ade80', 1600, 46);
        this.env.setRain(e.name === 'moderata' ? 0.15 : e.name === 'calma' ? 0.3 : e.name === 'picco' ? 1 : 0.6);
        break;
      case 'announce':
        if (e.kind === 'pioggia') this.hud.announce("AO', MA QUANTO PIOVE?!", 'TRA POCO PIOVE PIÙ FORTE', '#93c5fd', 1800, 54);
        else this.hud.announce('CHIUDI QUELLA PORTA!', `RAFFICA IN ARRIVO: ${DOOR_NAME[e.door ?? 'front']}`, '#fbbf24', 1800, 54);
        audio.edgeWarn(e.door === 'back' ? 0.2 : -0.2);
        break;
      case 'eventStart':
        if (e.kind === 'raffica' || e.kind === 'pioggia') this.thunder(0.7);
        if (e.kind === 'tappeto') {
          this.hud.announce('ME SO ROTTO ER CAZZO!', 'UN TAPPETO BAGNATO BLOCCA IL PASSAGGIO', '#fbbf24', 1700, 50);
          this.env.showRug(this.world.rug?.rect ?? null);
          audio.thump(0.6);
        }
        if (e.kind === 'intasato') {
          this.hud.announce('È TUTTO INTASATO!', `${DRAIN_NAME[e.drain ?? 'bagno']}: TENETE "INTERAGISCI" PER LIBERARLO`, '#f87171', 1900, 50);
          audio.wrong();
        }
        break;
      case 'eventEnd':
        if (e.kind === 'tappeto') this.env.showRug(null);
        break;
      case 'tv':
        if (e.state === 'danger') {
          this.hud.announce('SALVA LA TV!', 'PORTATELA IN SALVO (INTERAGISCI VICINO ALLA TV)', '#f87171', 2000, 54);
          audio.edgeWarn(0.6);
        } else if (e.state === 'saved') {
          this.hud.feedMessage(`📺 ${this.label(e.by ?? '')} HA SALVATO LA TV (+${CC.points.tv})`, '#4ade80', 2400);
          audio.fanfare();
        } else this.hud.feedMessage('📺 LA TV È ANDATA...', '#f87171', 2400);
        break;
      case 'drain': {
        const p = this.player(e.id);
        if(e.via==='bucket' && this.characterAnimations.has(e.id)) {
          this.characterAnimations.get(e.id)!.emptyBucket();
          this.entities.get(e.id)?.overrideImportedAnimation(null); // each actual pour starts a new visual gesture
        }
        if (p) {
          this.env.waterFeedback(p.x,p.y,0,0);
          this.actionFeedback.set(e.id,{text:`SCARICATI ${e.amount.toFixed(1)} L · +${e.amount.toFixed(1)} PT`,until:this.gameTime+1.8});
          this.hud.feedMessage(`💧 ${this.label(e.id)} +${Math.round(e.amount * 10) / 10} (${DRAIN_NAME[e.drain]})`, '#93c5fd', 1400);
          audio.pickupPop(this.pan(p.x));
          this.ctx.vibrate(e.id, 40);
        }
        break;
      }
      case 'drainFull':
        abilityHub.failed(e.id, 'SCARICO INTASATO');
        break;
      case 'spill': {
        const p = this.player(e.id);
        if (p && e.amount > 0.3) {
          audio.bounce(0.5, this.pan(p.x));
          if (e.why !== 'deadline') this.hud.feedMessage(`💦 ${this.label(e.id)} HA ROVESCIATO IL SECCHIO`, '#9ca3af', 1400);
        }
        break;
      }
      case 'slip': {
        const p = this.player(e.id);
        this.entities.get(e.id)?.playHitFrom(p?.vx ?? 1, -(p?.vy ?? 0), 0.9);
        this.entities.get(e.id)?.react('hit');
        audio.thump(0.5, this.pan(p?.x ?? 700));
        this.ctx.vibrate(e.id, 80);
        break;
      }
      case 'dash':
        audio.boost(this.pan(this.player(e.id)?.x ?? 700));
        this.entities.get(e.id)?.playMove('dodge', 0.2);
        break;
      case 'contain':
        if (e.on) this.entities.get(e.id)?.playMove('brace', 0.6);
        break;
      case 'unclog':
        this.hud.feedMessage(`🔧 ${this.label(e.id)} HA LIBERATO ${DRAIN_NAME[e.drain]} (+${CC.points.unclog})`, '#4ade80', 2200);
        audio.select();
        break;
      case 'rugCleared':
        this.hud.feedMessage(`🧺 ${this.label(e.id)} HA RIMESSO A POSTO IL TAPPETO`, '#a3e635', 1800);
        this.env.showRug(null);
        break;
      case 'abilityPress':
        this.onAbilityPress(e.id, e.res);
        break;
      case 'ability':
        this.onAbility(e);
        break;
      case 'end':
        this.saved = e.saved;
        this.dryAtEnd = e.dry;
        break;
    }
  }

  private thunder(k: number): void {
    this.env.flash(k);
    audio.thump(0.8 + 0.6 * k);
    audio.duck(0.3, 400);
    this.shakeT = 0.18 * k;
  }

  private onAbilityPress(id: string, res: string): void {
    if (res === 'ok') {
      abilityHub.activated(id);
      const def = AB.casacarbo[(this.chars.get(id) ?? 'goblin') as keyof typeof AB.casacarbo];
      this.entities.get(id)?.playAbility(def?.name);
      return;
    }
    if (res === 'disabled') return;
    const text = res === 'spent' ? 'ESAURITA' : res === 'cooldown' ? 'IN RICARICA' : res === 'notNear' ? 'VAI VICINO A UNA PORTA' : 'NON ORA';
    abilityHub.failed(id, text);
  }

  private onAbility(e: Extract<CCEvent, { t: 'ability' }>): void {
    const who = this.label(e.id);
    const ent = this.entities.get(e.id);
    switch (e.a) {
      case 'goblin_windup':
        this.characterAnimations.get(e.id)?.showExistingAbility(AB.casacarbo.goblin.p.windup);
        ent?.playMove('smashWind', AB.casacarbo.goblin.p.windup);
        break;
      case 'goblin_wave':
        this.characterAnimations.get(e.id)?.showExistingAbility(.4);
        ent?.playMove('smash', 0.4);
        this.hud.announce("N'CULO, MO ASCIUGO IO!", (e.amount ?? 0) > 3 ? 'ONDA!' : 'ONDA... A VUOTO', '#10b981', 1300, 50);
        audio.smash();
        this.shakeT = 0.12;
        break;
      case 'boschi_block':
        ent?.playMove('brace', AB.casacarbo.buttafuori.p.duration);
        this.hud.announce('TU QUA NON ENTRI!', `${who} BLOCCA LA ${DOOR_NAME[e.door ?? 'front']}`, '#f97316', 1500, 56);
        break;
      case 'boschi_release':
        this.hud.feedMessage(`🌊 ${who} MOLLA: L'ACQUA TRATTENUTA RIENTRA`, '#f97316', 2000);
        break;
      case 'victor_intel':
        this.hud.feedMessage(`💡 ${who}: M'HO SVEJATO (lo sa solo lui)`, '#22d3ee', 1800);
        break;
      case 'victor_wasted':
        this.hud.feedMessage(`💡 ${who}: M'HO SVEJATO... ma non arriva niente`, '#9ca3af', 1800);
        break;
      case 'carbo_dam':
        this.characterAnimations.get(e.id)?.buildBarrier();
        this.hud.announce('NO, ASPETTA!', `${who} FA UNA DIGA`, '#f59e0b', 1300, 56);
        audio.thump(0.5);
        break;
      case 'carbo_break':
        this.hud.feedMessage(`💥 LA DIGA DI ${who} HA CEDUTO`, '#f87171', 2000);
        audio.thump(0.9);
        break;
      case 'carbo_end':
        break;
      case 'ciro_arm':
        this.hud.feedMessage(`💸 ${who}: PAGO DOMANI (secchio doppio)`, '#a78bfa', 1800);
        break;
      case 'ciro_paid':
        this.hud.feedMessage(`💸 ${who} HA SVUOTATO IL SECCHIO DOPPIO`, '#a78bfa', 2000);
        audio.fanfare();
        break;
      case 'ciro_lost':
        this.hud.feedMessage(`💸 ${who}: PAGAMENTO SCADUTO, MEZZO SECCHIO PER TERRA`, '#f87171', 2000);
        audio.wrong();
        break;
    }
  }

  // ------------------------------------------------------------------ disegno

  private updateVisuals(dt: number, now: number): void {
    for (const p of this.world.players) {
      const ent = this.entities.get(p.id);
      if (!ent) continue;
      const animator=this.characterAnimations.get(p.id);
      if(animator) {
        const pose=(this.phase==='playing'||this.phase==='tutorial')?animator.update(dt,p):null;
        ent.overrideImportedAnimation(pose?.name??null,pose?.duration,pose?.loop??false);
      }
      const vis: VisualSubject = {
        x: toWorldX(p.x),
        y: 0,
        z: toWorldZ(p.y),
        vx: p.vx / 40,
        vz: -p.vy / 40,
        facing: Math.atan2(p.fx, -p.fy),
        alive: true,
        falling: false,
        spin: 0,
        dashing: p.dashT > 0,
        stunTime: p.slipT > 0 ? p.slipT : 0,
        hitFlash: 0,
        dodgeTime: 0,
        air: 0,
        grounded: true
      };
      ent.updateVisual(vis, dt, now);
      this.squeegees.get(p.id)!.isVisible = p.squeegee;
      const b = this.buckets.get(p.id)!;
      b.scaling.setAll(p.ab.bigBucket ? 1.35 : 1);
      if(animator) {
        const hand=ent.goblinAttachment('RIGHT_HAND');
        if(hand) {
          const local=Vector3.TransformCoordinates(hand,Matrix.Invert(ent.root.computeWorldMatrix(true)));
          const halfHeight=.19*b.scaling.y;
          b.position.set(local.x,Math.max(halfHeight,local.y-halfHeight),local.z+.07);
        }
      }
    }
    if (this.neighbor) {
      this.neighbor.updateVisual({ x: toWorldX(847), y: 0, z: toWorldZ(118), vx: 0, vz: 0, facing: Math.PI, alive: true, falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 }, dt, now);
    }
  }

  private updateLabels(): void {
    const w = this.world;
    for (const d of DOORS) {
      const l = this.doorLabels.get(d.id)!;
      const gust = w.schedule.find((ev) => ev.kind === 'raffica' && ev.door === d.id && ev.announced && !ev.ended);
      const blocked = w.players.some((p) => p.ab.blockT > 0 && p.ab.blockDoor === d.id);
      const contained = w.players.some((p) => p.containing === d.id);
      const rate = w.doorRate[d.id];
      const bars = '▮'.repeat(Math.max(1, Math.min(5, Math.round(rate * 2.4))));
      if (this.phase === 'ending') l.set('', '#fff');
      else if (gust) l.set(`⚠ RAFFICA! ${bars}`, '#fbbf24');
      else if (blocked) l.set('🚫 PORTA CHIUSA', '#f97316');
      else if (contained) l.set(`✋ CONTENUTA ${bars}`, '#a3e635');
      else l.set(`ENTRA ACQUA ${bars}`, rate > 1.2 ? '#f87171' : '#93c5fd');
    }
    for (const d of DRAINS) {
      const l = this.drainLabels.get(d.id)!;
      if (this.phase === 'ending') l.set('', '#fff');
      else if (w.clogged.has(d.id)) l.set('⛔ INTASATO', '#f87171');
      else l.set(d.id === 'bagno' ? '💧 SCARICO' : d.id === 'lavello' ? '🚰 LAVELLO' : '⭕ TOMBINO', '#93c5fd');
    }
    this.emergencyLabel.set(w.emergency?.kind==='bedroom'?'CAMERA: RACCOGLI E SCARICA':'','#fbbf24');
    if (w.tv === 'danger') this.tvLabel.set('⚠ LA TV!', '#f87171');
    else if (w.tv === 'saved') this.tvLabel.set('✅ TV SALVA', '#4ade80');
    else if (w.tv === 'ruined') this.tvLabel.set('💀 TV ANDATA', '#9ca3af');
    else this.tvLabel.set('', '#fff');
  }

  private syncHud(): void {
    const w = this.world;
    this.hud.setTime(this.phase === 'countdown' ? w.duration : w.timeLeft);
    this.hud.setDry(this.phase === 'ending' ? this.dryAtEnd : w.dryFraction());
    const entries = w.players.map((p) => ({ id: p.id, pts: contribution(p.stats), status: w.abil.status(p, false) }));
    this.hud.setBoard(entries);
    for (const p of w.players) {
      abilityHub.setStatus(p.id, w.abil.status(p, true)); // telefono: stato privato (Victor vede porta e tempo)
      let label = '';
      if (p.slipT > 0) label = 'SCIVOLA!';
      else if (p.ab.blockT > 0) label = 'TU QUA NON ENTRI';
      else if (p.containing) label = 'CONTENGO';
      else if (p.ab.windupT > 0) label = 'CARICA...';
      else if (p.ab.deadlineT > 0) label = `SVUOTA! ${Math.ceil(p.ab.deadlineT)}`;
      else if (p.holdKey.startsWith('unclog')) label = `SBLOCCO ${Math.round((p.holdT / CC.unclogTime) * 100)}%`;
      else if (p.holdKey === 'tv') label = `TV ${Math.round((p.holdT / CC.tvTime) * 100)}%`;
      else if (p.holdKey === 'rug') label = `TAPPETO ${Math.round((p.holdT / CC.rugTime) * 100)}%`;
      else if(p.scooping && w.waterAt(p.x,p.y)<.01)label='POZZA VUOTA';
      else if (p.scooping) label = `RACCOLGO ${p.bucket.toFixed(1)}/${w.bucketCap(p)} L`;
      else if (p.bucket >= w.bucketCap(p) - 0.01) label = 'PIENO: ALLO SCARICO';
      else if(p.bucket<.02)label=p.squeegee?'SPINGO →':'VUOTO · Y / △';
      const feedback=this.actionFeedback.get(p.id);if(feedback && feedback.until>this.gameTime)label=feedback.text;
      const guide=this.guidance.get(p.id)!;
      if(p.bucket>=w.bucketCap(p)*.9 && this.phase!=='ending'){
        const route=drainRoute(w,p);
        if(route){const dx=route.x-p.x,dy=route.y-p.y,l=Math.hypot(dx,dy)||1;guide.mesh.position.set(toWorldX(p.x+dx/l*55),.25,toWorldZ(p.y+dy/l*55));guide.set(route.steps===0?'Y / △ SVUOTA':`→ ${route.id.toUpperCase()}`,'#fbbf24');}
        else guide.set('NESSUNO SCARICO LIBERO','#f87171');
      }else guide.set('','#fff');
      if (this.phase === 'ending') this.hud.setTag(p.id, 0, ''); // nel finale parlano banner, titoli e vicino
      else this.hud.setTag(p.id, p.bucket / CC.bucketCap, label);
    }
    const em=w.emergency;
    this.hud.objective(em?`${em.kind==='tv'?'SALVA LA TV':em.kind==='bedroom'?'CAMERA: -35% ACQUA':'CONTIENI LA '+DOOR_NAME[em.door??'front']} · ${Math.ceil(Math.max(0,em.until-w.time))}s · ${Math.round(em.progress*100)}%`:'X / □ SPINGI   ·   Y / △ RACCOGLI / SCARICA   ·   B / ◯ INTERAGISCI');
    void this.lastCount;
    void this.lastPeakWarned;
  }

  // ------------------------------------------------------------------ fine

  private startEnding(): void {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    this.endingT = 0;
    this.saved = this.world.dryFraction() >= CC.saveThreshold;
    this.dryAtEnd = this.world.dryFraction();
    const pct = Math.round(this.dryAtEnd * 100);
    // il vicino suona alla porta davanti
    try {
      this.neighbor = new ArenaEntity(this.scene, new DynamicTexture('ccDot2', 16, this.scene, false), '#8b95a5', null, '🙂', 'IL VICINO', null, { context: 'casacarbo' });
      this.neighbor.setSizeMul(SIZE);
    } catch {
      this.neighbor = null;
    }
    audio.playTone(880, 0.25, 'sine', 0.08);
    window.setTimeout(() => audio.playTone(660, 0.35, 'sine', 0.08), 260);
    if (this.saved) {
      this.endLines = [
        { at: 0, text: 'CASA SALVATA!', sub: `${pct}% ASCIUTTA`, color: '#4ade80', done: false },
        { at: 2.0, text: '«CARBO, MA CHE È SUCCESSO QUA?»', sub: 'IL VICINO', color: '#e5e7eb', done: false },
        { at: 4.0, text: '«NIENTE, ABBIAMO FATTO UN PO\' DE PULIZIE.»', sub: 'CARBO (gli altri quattro lo guardano male)', color: '#f59e0b', done: false }
      ];
      audio.fanfare();
    } else {
      this.endLines = [
        { at: 0, text: 'ALLAGAMENTO TOTALE', sub: `SOLO ${pct}% ASCIUTTA (SERVIVA IL 75%)`, color: '#f87171', done: false },
        { at: 2.0, text: '«MA CHE CAZZO AVETE COMBINATO?!»', sub: 'IL VICINO', color: '#e5e7eb', done: false },
        { at: 4.0, text: '«IO L\'AVEVO DETTO COME DOVEVAMO FA\'!»', sub: 'CARBO', color: '#f59e0b', done: false }
      ];
      audio.wrong();
    }
    const rank = this.world.ranking();
    const best = rank[0];
    for (const p of this.world.players) {
      const e = this.entities.get(p.id);
      if (this.saved && p === best) e?.playVictory();
      else if (!this.saved) e?.playDefeat();
      else e?.celebrate(3);
    }
    const t = titles(this.world.players.map((p) => ({ id: p.id, stats: p.stats })));
    const lines = [...t.entries()].map(([id, title]) => `${this.label(id)}: ${title}`);
    this.hud.endingLayout();
    lines.slice(0, 3).forEach((l, i) => window.setTimeout(() => !this.disposed && this.hud.feedMessage(`🏅 ${l}`, '#fbbf24', 3000), 1200 + i * 1400));
  }

  private buildResults(): PlayerResult[] {
    const w = this.world;
    const rank = w.ranking();
    const t = titles(w.players.map((p) => ({ id: p.id, stats: p.stats })));
    const sum = (fn: (p: CCPlayer) => number): number => w.players.reduce((a, p) => a + fn(p), 0);
    telemetry.metrics('casacarbo', {
      durationSec: Math.round(this.gameTime),
      players: w.players.length,
      dryPercent: Math.round(w.dryFraction() * 100),
      saved: this.saved,
      waterIn: Math.round(w.inflowTotal),
      drainedTotal: Math.round(w.drainedCredited),
      drainedPassive: Math.round(w.drainedPassive),
      drainedBucket: Math.round(sum((p) => p.stats.drainedBucket)),
      drainedSqueegee: Math.round(sum((p) => p.stats.drainedSqueegee)),
      drainedAbility: Math.round(sum((p) => p.stats.drainedAbility)),
      stoppedAtDoors: Math.round(sum((p) => p.stats.stopped)),
      spilled: Math.round(sum((p) => p.stats.spilled)),
      slips: sum((p) => p.stats.slips),
      tv: w.tv,
      unclogged: sum((p) => p.stats.unclogged),
      abilityUses: sum((p) => p.stats.abilityUses),
      abilitySuccesses: sum((p) => p.stats.abilitySuccess),
      abilityFailures: sum((p) => p.stats.abilityFail)
    });
    // statistiche di abilita' per il report F4
    for (const p of w.players) {
      for (let i = 0; i < p.stats.abilitySuccess; i++) abilityHub.succeeded(p.id);
      for (let i = 0; i < p.stats.abilityFail; i++) abilityHub.wasted(p.id);
      for (const [k, v] of Object.entries(p.stats.impact)) abilityHub.impact(p.id, k, v);
    }
    return rank.map((p, i) => {
      const stats = [`${Math.round(contribution(p.stats))} punti contributo`];
      const title = t.get(p.id);
      if (title) stats.push(title);
      stats.push(`${Math.round(drainedOf(p.stats) * 10) / 10} acqua tolta`);
      return { playerId: p.id, placement: i + 1, score: Math.round(contribution(p.stats)), stats: stats.slice(0, 3) };
    });
  }

  // ------------------------------------------------------------------ debug

  debugLines(): string[] {
    const w = this.world;
    const L = [`── CASA CARBO · t ${w.time.toFixed(1)}s · ${w.phaseName} · asciutta ${(w.dryFraction() * 100).toFixed(0)}% · entrata ${w.inflowTotal.toFixed(1)} · tolta ${w.drainedCredited.toFixed(1)} · intasati ${[...w.clogged].join(',') || '-'}`];
    for (const p of w.players) {
      const st = w.abil.status(p, true);
      L.push(`${(SHORT[p.characterId] ?? p.characterId).padEnd(8)} pt ${contribution(p.stats).toFixed(1).padStart(5)} secchio ${p.bucket.toFixed(1)} tiracqua:${p.squeegee ? 1 : 0} porta:${p.containing ?? '-'} scivola:${p.slipT > 0 ? 1 : 0} ab:${st.state}${st.note ? ' ' + st.note : ''}`);
    }
    return L;
  }

  get sim(): CasaCarboWorld {
    return this.matchWorld ?? this.world;
  }

  /** Bot di test (solo debug / laboratorio). */
  setBot(id: PlayerId, on: boolean): void {
    if (!on) this.bots.delete(id);
    else {
      const i = this.ctx.players.findIndex((p) => p.id === id);
      this.bots.set(id, new CCBot(id, () => this.botRng.next(), botRoles(this.ctx.players.length)[Math.max(0, i)] ?? 'bucket'));
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (activeGame === this) activeGame = null;
    if ((window as unknown as Record<string, unknown>).__casacarbo === this) delete (window as unknown as Record<string, unknown>).__casacarbo;
    window.removeEventListener('resize', this.onResize);
    abilityHub.end();
    safely('entities', () => {
      for (const e of this.entities.values()) e.dispose();
      this.neighbor?.dispose();
    });
    safely('labels', () => {
      for (const l of [...this.doorLabels.values(), ...this.drainLabels.values(), ...this.guidance.values(), this.tvLabel, this.emergencyLabel]) l.dispose();
    });
    safely('hud.dispose', () => this.hud.dispose());
    safely('engine.stopRenderLoop', () => this.engine.stopRenderLoop());
    safely('scene.dispose', () => this.scene.dispose());
    safely('engine.dispose', () => this.engine.dispose());
    this.bots.clear();
  }
}
