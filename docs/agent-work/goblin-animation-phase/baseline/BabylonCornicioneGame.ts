import { Engine, Scene, Color4, DynamicTexture, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import type { PlayerId, PlayerResult } from '../../../shared/types';
import type { MinigameContext } from '../types';
import { AB } from '../../../shared/abilityCatalog';
import { audio } from '../../core/AudioManager';
import { setGameIntensity } from '../../core/musicDirector';
import { IMPACT } from '../../core/impact';
import { abilityHub } from '../../core/abilityHub';
import { runSteps } from '../../core/frameClock';
import { guardLoop, safely } from '../../core/loopGuard';
import { applyQuality, engineOptions } from '../../core/quality';
import { debugEnabled, registerDebugSection } from '../../core/debug';
import { say } from '../../core/announcer';
import { telemetry } from '../../core/telemetry';
import { winnerFeed } from '../characters/reactions';
import { ArenaEntity } from '../arena/arenaEntity';
import type { VisualSubject } from '../arena/arenaEntity';
import { registerEnvScene } from '../env/envDebug';
import { FighterWorld } from './fighterCore';
import { FighterBot } from './fighterBot';
import { IMPACT_KEYS } from './fighterAbilities';
import { KO, PHYS, STAGE } from './fighterData';
import type { MoveDef } from './fighterData';
import type { Fighter, FighterEvent, FighterInput } from './fighterTypes';
import { buildCornicioneEnvironment } from './cornicioneEnvironment';
import { FighterCamera } from './fighterCamera';
import { FighterHud } from './fighterHud';
import { FighterFx } from './fighterFx';

const COUNTDOWN_S = 3.2;
const SHORT: Record<string, string> = { goblin: 'GOBLIN', buttafuori: 'BUTTAFUORI', judoka: 'JUDOKA', dottore: 'DOTTORE', ciro: 'CIRO' };
const WITH_ARTICLE: Record<string, string> = { goblin: 'IL GOBLIN', buttafuori: 'IL BUTTAFUORI', judoka: 'IL JUDOKA', dottore: 'IL DOTTORE', ciro: 'CIRO' };
const HIT_RGB = '#ffe9a8';

type Phase = 'countdown' | 'playing' | 'celebrating';

/** Per il pannello F3 (una sola registrazione, legge la partita in corso). */
let activeGame: BabylonCornicioneGame | null = null;
let debugRegistered = false;

/** Orchestratore del minigioco 3D BOTTE SUL CORNICIONE: legge il simulatore (fighterCore) e disegna, suona, vibra, riferisce i risultati. */
export class BabylonCornicioneGame {
  private engine: Engine;
  private scene: Scene;
  private world: FighterWorld;
  private entities = new Map<PlayerId, ArenaEntity>();
  private camera: FighterCamera;
  private hud: FighterHud;
  private fx: FighterFx;
  private env: ReturnType<typeof buildCornicioneEnvironment>;
  private unsubAbility: () => void = () => undefined;
  private order: PlayerId[];
  private names = new Map<PlayerId, string>();
  private colors = new Map<PlayerId, string>();
  private chars = new Map<PlayerId, string>();

  private phase: Phase = 'countdown';
  private controlsDone = false;
  private countdown = COUNTDOWN_S;
  private lastCountInt = 4;
  private gameTime = 0;
  private resultsSent = false;
  private disposed = false;
  private paused = false;
  private celebrateTime = 0;
  private hitStop = 0;
  private lastDanger = new Map<PlayerId, number>();
  private warnedLast2 = false;
  private lastAbilitySnap = new Map<PlayerId, { ok: number; fail: number; impact: Record<string, number> }>();
  private lastEndReason = '';
  // debug (solo ?debug=1 / dev)
  private bots = new Map<PlayerId, FighterBot>();
  private boxes: Mesh[] = [];
  private showBoxes = false;
  private koBox: Mesh | null = null;

  private onResize = (): void => this.engine.resize();

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: MinigameContext,
    opts: { devArena?: boolean } = {}
  ) {
    this.engine = new Engine(canvas, engineOptions().antialias, engineOptions());
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.45, 0.2, 0.35, 1);
    const n = ctx.players.length;
    this.order = [...ctx.playerIds];
    this.world = new FighterWorld({
      ids: ctx.players.map((p) => p.id),
      characters: ctx.players.map((p) => p.characterId ?? 'goblin'),
      rng: () => ctx.rng.next()
    });
    this.env = buildCornicioneEnvironment(this.scene, 0);
    registerEnvScene(this.scene);
    this.camera = new FighterCamera(this.scene, canvas);
    this.hud = new FighterHud(this.scene);
    this.fx = new FighterFx(this.scene);

    const dotTex = new DynamicTexture('cornicioneDot', 16, this.scene, false);
    const dc = dotTex.getContext() as unknown as CanvasRenderingContext2D;
    dc.fillStyle = 'white';
    dc.beginPath();
    dc.arc(8, 8, 7, 0, Math.PI * 2);
    dc.fill();
    dotTex.update();

    abilityHub.begin('cornicione', ctx);
    this.unsubAbility = abilityHub.onStatus(() => undefined); // lo stato arriva gia' dal gioco: l'HUD lo legge da qui (vedi syncHud)
    ctx.players.forEach((snap) => {
      this.entities.set(snap.id, new ArenaEntity(this.scene, dotTex, snap.color, snap.characterId, snap.avatar, snap.displayName));
      this.names.set(snap.id, snap.displayName);
      this.colors.set(snap.id, snap.color);
      this.chars.set(snap.id, snap.characterId ?? 'goblin');
      this.lastAbilitySnap.set(snap.id, { ok: 0, fail: 0, impact: {} });
    });
    this.hud.buildCards(ctx.players.map((s) => ({ id: s.id, label: SHORT[s.characterId ?? ''] ?? s.displayName.toUpperCase(), characterId: s.characterId, color: s.color })));
    this.hud.setTimer(this.world.timeLimit);
    this.hud.setCountdown('3');
    void n;

    if (ctx.showControls && !opts.devArena) void ctx.showControls().then(() => (this.controlsDone = true));
    else this.controlsDone = true;

    applyQuality(this.engine, this.scene);
    this.engine.runRenderLoop(
      guardLoop(() => {
        if (this.disposed) return;
        if (this.paused) return;
        runSteps(this.engine.getDeltaTime(), (dt) => this.step(dt));
        this.scene.render();
      })
    );
    window.addEventListener('resize', this.onResize);

    activeGame = this;
    if (debugEnabled()) {
      (window as unknown as Record<string, unknown>).__fighter = this;
      if (!debugRegistered) {
        debugRegistered = true;
        registerDebugSection(() => (activeGame ? activeGame.debugLines() : []));
      }
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // ------------------------------------------------------------------ loop

  private step(dt: number): void {
    const now = performance.now();
    let held = false;
    if (this.phase === 'countdown') {
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
        for (const p of this.ctx.players) this.ctx.vibrate(p.id, 90);
      }
    } else if (this.phase === 'playing') {
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        held = true; // gli edge dei tasti restano per il prossimo passo di simulazione
      } else {
        this.gameTime += dt;
        const inputs = new Map<PlayerId, FighterInput>();
        for (const p of this.ctx.players) inputs.set(p.id, this.readInput(p.id, dt));
        this.world.step(dt, inputs);
        for (const e of this.world.drainEvents()) this.handle(e);
        this.syncHub();
        if (this.world.phase === 'over') this.startCelebration();
      }
    } else if (this.phase === 'celebrating') {
      this.celebrateTime -= dt;
      if (this.celebrateTime <= 0 && !this.resultsSent) {
        this.resultsSent = true;
        this.ctx.finish({ results: this.buildResults() });
      }
    }

    this.updateVisuals(dt, now);
    this.camera.update(dt, this.cameraSubjects(), now);
    this.fx.update(dt, now);
    this.env.update(now);
    this.syncHud();
    if (this.showBoxes) this.updateBoxes();
    if (!held) this.ctx.input.update();
  }

  // ------------------------------------------------------------------ input

  /** Stick/croce + tasti -> FighterInput. Dal controller arriva 'move' (stick); chi gioca dal telefono usa la croce (left/right/up/down). */
  private readInput(id: PlayerId, dt: number): FighterInput {
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
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    return {
      mx,
      my,
      jumpPressed: inp.justPressed('jump'),
      jumpHeld: inp.pressed('jump'),
      lightPressed: inp.justPressed('light'),
      heavyPressed: inp.justPressed('heavy'),
      dodgePressed: inp.justPressed('dodge'),
      abilityPressed: inp.justPressed('ability')
    };
  }

  // ------------------------------------------------------------------ eventi del simulatore

  private pan(x: number): number {
    return Math.max(-0.8, Math.min(0.8, x / 22));
  }
  private labelOf(id: string): string {
    return WITH_ARTICLE[this.chars.get(id) ?? ''] ?? (this.names.get(id) ?? '').toUpperCase();
  }
  private ent(id: string): ArenaEntity | undefined {
    return this.entities.get(id);
  }
  private colorOf(id: string): string {
    return this.colors.get(id) ?? '#ffffff';
  }
  private fighter(id: string): Fighter | undefined {
    return this.world.byId.get(id);
  }

  private moveDur(m: MoveDef): number {
    return m.startup + m.active + m.recovery;
  }

  private handle(e: FighterEvent): void {
    switch (e.t) {
      case 'attack': {
        const ent = this.ent(e.id);
        if (!ent) break;
        const m = e.move;
        if (e.phase === 'start') {
          if (m.kind === 'heavy') {
            ent.playMove('smashWind', m.startup + 0.02); // anticipo leggibile: si vede arrivare
          } else ent.playMove(m.anim === 'follow' ? 'follow' : this.lightAnim(m), this.moveDur(m));
          if (m.kind === 'light') audio.bump(this.pan(this.fighter(e.id)?.x ?? 0));
        } else {
          if (m.kind === 'heavy') {
            ent.playMove(m.anim === 'smash' ? 'smash' : m.anim === 'upHeavy' ? 'upHeavy' : m.anim === 'sweepHeavy' ? 'sweepHeavy' : m.anim === 'spike' ? 'airSpike' : 'smash', m.active + m.recovery);
            audio.smash(this.pan(this.fighter(e.id)?.x ?? 0));
          }
        }
        break;
      }
      case 'hit':
        this.onHit(e);
        break;
      case 'ko':
        this.onKo(e);
        break;
      case 'respawn': {
        const f = this.fighter(e.id);
        if (f) {
          this.fx.ring(f.x, f.y + 1, this.colorOf(e.id), 3);
          audio.pickupPop(this.pan(f.x));
          this.ent(e.id)?.react('hit', true);
        }
        break;
      }
      case 'jump': {
        const f = this.fighter(e.id);
        if (f && e.double) this.fx.ring(f.x, f.y + 0.2, '#ffffff', 1.6);
        if (f) audio.boost(this.pan(f.x));
        break;
      }
      case 'land': {
        const f = this.fighter(e.id);
        if (f && e.hard) {
          this.fx.ring(f.x, f.y + 0.1, '#ffffff', 1.8);
          audio.thump(0.4, this.pan(f.x));
        }
        break;
      }
      case 'dodge': {
        const f = this.fighter(e.id);
        this.ent(e.id)?.playMove('dodge', e.air ? 0.26 : 0.3);
        if (f) audio.dodge(this.pan(f.x));
        break;
      }
      case 'recoveryAttack': {
        const f = this.fighter(e.id);
        this.ent(e.id)?.playMove('recovery', 0.56);
        if (f) {
          this.fx.slash(f.x, f.y, Math.PI / 2, 3.4, this.colorOf(e.id));
          audio.boost(this.pan(f.x));
        }
        break;
      }
      case 'noRecovery':
        abilityHub.failed(e.id, 'RECOVERY GIÀ USATO'); // privato: dice perche' non e' successo niente
        break;
      case 'wall':
      case 'wallJump': {
        const f = this.fighter(e.id);
        if (f) {
          this.fx.ring(f.x, f.y + 1, '#ffffff', 1.4);
          audio.bounce(0.4, this.pan(f.x));
        }
        break;
      }
      case 'bounce': {
        const f = this.fighter(e.id);
        if (f) audio.bounce(0.7, this.pan(f.x));
        break;
      }
      case 'recovered': {
        const f = this.fighter(e.id);
        if (f) {
          this.fx.ring(f.x, f.y + 0.3, this.colorOf(e.id), 2.4);
          this.hud.feedMessage(`${this.labelOf(e.id)} SI È SALVATO!`, '#a3e635', 1800);
          this.ctx.vibrate(e.id, 70);
          audio.pickupPop(this.pan(f.x));
        }
        break;
      }
      case 'abilityPress':
        this.onAbilityPress(e.id, e.res);
        break;
      case 'ability':
        this.onAbility(e);
        break;
      case 'end':
        this.lastEndReason = e.reason;
        break;
    }
  }

  /** Punto portato dentro il quadro: gli effetti di cio' che accade OLTRE l'inquadratura (KO, bonifico) si vedono sul bordo. */
  private inView(x: number, y: number): { x: number; y: number } {
    const v = this.camera.view;
    return { x: Math.max(v.cx - v.hw + 2, Math.min(v.cx + v.hw - 2, x)), y: Math.max(v.cy - v.hh + 2, Math.min(v.cy + v.hh - 2, y)) };
  }

  private lightAnim(m: MoveDef): 'jab' | 'side' | 'up' | 'down' | 'air' {
    if (m.air && m.dir === 'n') return 'air';
    return m.dir === 'n' ? 'jab' : m.dir === 's' ? 'side' : m.dir === 'u' ? 'up' : 'down';
  }

  private onHit(e: Extract<FighterEvent, { t: 'hit' }>): void {
    const v = this.fighter(e.victim);
    const a = e.attacker ? this.fighter(e.attacker) : undefined;
    if (!v) return;
    const spec = IMPACT[e.impact];
    const strength = Math.min(1.4, e.speed / 32);
    this.fx.spark(e.x, e.y, HIT_RGB, 1.1 + strength * 1.4);
    if (e.impact !== 'LIGHT') this.fx.slash(e.x, e.y, Math.atan2(e.dy, e.dx), 2 + strength * 3, this.colorOf(e.victim));
    // peso del colpo: hitstop breve (mai lungo), scossa MOLTO contenuta (camera condivisa fra 5 persone), suono per categoria
    this.hitStop = Math.max(this.hitStop, e.impact === 'HEAVY' ? spec.hitstop : spec.hitstop * 0.8);
    this.camera.shake(Math.min(0.22, spec.shake.amp * 0.75), Math.min(180, spec.shake.ms));
    if (e.impact === 'LIGHT') audio.hit();
    else audio.thump(e.impact === 'HEAVY' ? 1.1 + strength * 0.3 : 0.8, this.pan(e.x));
    const ve = this.ent(e.victim);
    ve?.playHitFrom(e.dx, 0, Math.min(1, strength));
    if (e.impact !== 'LIGHT') ve?.burstHit();
    if (a) {
      const ae = this.ent(a.id);
      if (e.impact === 'HEAVY') ae?.playRecoil();
      this.ctx.vibrate(a.id, e.impact === 'HEAVY' ? 70 : 35);
    }
    this.ctx.vibrate(e.victim, e.impact === 'HEAVY' ? 90 : 50);
    if (e.percent >= 120 && (this.lastDanger.get(e.victim) ?? 0) < 120) audio.tick(1.6); // soglia di pericolo raggiunta
    this.lastDanger.set(e.victim, e.percent);
    if (e.combo >= 3 && e.attacker) {
      this.hud.showCombo(this.labelOf(e.attacker), e.combo);
      if (a) a.stats.maxCombo = Math.max(a.stats.maxCombo, e.combo);
    }
  }

  private onKo(e: Extract<FighterEvent, { t: 'ko' }>): void {
    const v = this.fighter(e.victim);
    // l'effetto si vede SEMPRE: il KO sta molto oltre l'inquadratura, lo mostriamo sul bordo del quadro
    const view = this.camera.view;
    const px = Math.max(view.cx - view.hw + 2, Math.min(view.cx + view.hw - 2, e.x));
    const py = Math.max(view.cy - view.hh + 2, Math.min(view.cy + view.hh - 2, e.y));
    const col = this.colorOf(e.victim);
    this.fx.ring(px, py, col, 6);
    this.fx.spark(px, py, '#ffffff', 5);
    this.fx.slash(px, py, Math.atan2(py - view.cy, px - view.cx) + Math.PI, 7, col);
    audio.fall(this.pan(px));
    audio.thump(1.2, this.pan(px));
    audio.duck(0.4, 450);
    this.hitStop = Math.max(this.hitStop, 0.08);
    this.camera.shake(0.28, 220);
    this.ent(e.victim)?.burstHit();
    this.hud.setIndicator(e.victim, false);
    const victimName = this.labelOf(e.victim);
    if (e.by) {
      this.hud.feedMessage(`🥊 ${this.labelOf(e.by)} HA BUTTATO FUORI ${victimName}`, '#f87171', 2600);
      this.ent(e.by)?.react('elimination');
      this.ctx.vibrate(e.by, 110);
      this.ctx.signal(e.by, { type: 'kill', name: this.names.get(e.victim) ?? '' });
    } else this.hud.feedMessage(`${victimName} È CADUTO COME UN COGLIONE`, '#f87171', 2400);
    this.ctx.vibrate(e.victim, 140);
    this.ctx.signal(e.victim, { type: e.eliminated ? 'eliminated' : 'ko', by: e.by ? this.names.get(e.by) ?? null : null, lives: e.lives });
    if (e.eliminated) {
      this.hud.feedMessage(`${victimName} È ELIMINATO`, '#fbbf24', 2200);
      const alive = this.world.livingCount();
      if (alive === 2 && this.world.fighters.length > 2 && !this.warnedLast2) {
        this.warnedLast2 = true;
        const line = say('lastTwo', true);
        if (line) this.hud.feedMessage(line, '#fbbf24', 2200);
        setGameIntensity(2);
      }
    }
    void v;
  }

  // ------------------------------------------------------------------ abilita'

  private onAbilityPress(id: string, res: string): void {
    if (res === 'ok') {
      abilityHub.activated(id);
      const ent = this.ent(id);
      const ab = AB.cornicione[(this.chars.get(id) ?? 'goblin') as keyof typeof AB.cornicione];
      ent?.playAbility(ab?.name);
      return;
    }
    if (res === 'disabled') return;
    const text = res === 'notAir' ? 'SOLO IN ARIA' : res === 'notOffstage' ? 'SOLO FUORI DAL PALCO' : res === 'spent' ? 'ESAURITA' : res === 'notNow' ? 'SOLO SE STAI PER USCIRE' : 'NON ORA';
    abilityHub.failed(id, text);
  }

  private onAbility(e: Extract<FighterEvent, { t: 'ability' }>): void {
    const f = this.fighter(e.id);
    if (!f) return;
    const ent = this.ent(e.id);
    const col = this.colorOf(e.id);
    const pan = this.pan(f.x);
    switch (e.a) {
      case 'goblin_burst':
        this.hud.announce('RIMONTA AL 90°!', '', '#10b981', 1300, 78);
        this.fx.slash(f.x, f.y, Math.atan2(f.vy, f.vx) + Math.PI, 6, '#10b981');
        this.fx.ring(f.x, f.y + 1, '#10b981', 3);
        audio.boost(pan);
        this.camera.shake(0.12, 150);
        break;
      case 'goblin_return':
        ent?.say('NON È FINITA!');
        this.hud.feedMessage(`${this.labelOf(e.id)}: NON È FINITA!`, '#a3e635', 2000);
        this.fx.ring(f.x, f.y + 0.4, '#10b981', 3.2);
        audio.fanfare();
        break;
      case 'goblin_follow':
        this.hud.feedMessage(`${this.labelOf(e.id)} RIENTRA ATTACCANDO!`, '#10b981', 1600);
        audio.smash(pan);
        break;
      case 'goblin_wasted':
        this.hud.feedMessage(`${this.labelOf(e.id)} HA SPRECATO LA RIMONTA`, '#9ca3af', 1800);
        break;
      case 'vanish':
        this.hud.announce('ULTIMO ACCESSO', '3 SETTIMANE FA', '#f97316', 1400, 78);
        this.fx.ring(f.x, f.y + 1, '#f97316', 3);
        audio.select();
        break;
      case 'telegraph':
        this.fx.marker(`v_${e.id}`, true, e.x ?? f.x, e.y ?? f.y, '#f97316');
        audio.tick(1.8);
        break;
      case 'reappear':
        this.fx.marker(`v_${e.id}`, false);
        this.fx.ring(e.x ?? f.x, (e.y ?? f.y) + 1, '#f97316', 3);
        ent?.say('OH RAGA');
        audio.pickupPop(pan);
        break;
      case 'counter_arm':
        ent?.playMove('brace', AB.cornicione.judoka.p.window);
        audio.select();
        break;
      case 'counter_hit': {
        const j = f;
        this.hud.announce('ANGORA CHE DICI?!', '', '#ef4444', 1300, 78);
        this.fx.ring(j.x, j.y + 1.2, '#ffffff', 4);
        this.fx.spark(e.x ?? j.x, (e.y ?? j.y) + 1.2, '#ef4444', 3.2);
        ent?.playMove('grab', AB.cornicione.judoka.p.freeze + 0.05);
        // freeze d'impatto: piu' lungo di un colpo normale ma sempre breve; scossa controllata
        this.hitStop = Math.max(this.hitStop, 0.16);
        this.camera.shake(0.2, 200);
        audio.hit();
        audio.thump(1.3, pan);
        this.ctx.vibrate(e.id, 140);
        break;
      }
      case 'counter_whiff':
        this.hud.feedMessage(`${this.labelOf(e.id)}: ANGORA... NIENTE`, '#9ca3af', 1500);
        break;
      case 'weight_on':
        this.hud.announce('-20 KG*', '*fonte: Victor', '#22d3ee', 1500, 90);
        this.fx.ring(f.x, f.y + 1, '#22d3ee', 3);
        audio.boost(pan);
        break;
      case 'weight_off':
        this.hud.feedMessage(`${this.labelOf(e.id)}: PESO RIPRESO`, '#9ca3af', 1400);
        break;
      case 'bonifico_open':
        this.hud.announce('BONIFICO?', 'PREMI RB / R1', '#a78bfa', 650, 96);
        this.fx.ring(this.inView(f.x, f.y).x, this.inView(f.x, f.y).y, '#a78bfa', 5);
        audio.edgeWarn(pan);
        this.hitStop = Math.max(this.hitStop, 0.05);
        break;
      case 'bonifico_yes':
        this.hud.announce('BONIFICO', 'IN LAVORAZIONE · PAGAMENTO PENDENTE 2,5 s', '#a78bfa', 1700, 96);
        this.fx.ring(f.x, f.y + 1, '#a78bfa', 4);
        audio.select();
        this.camera.shake(0.12, 150);
        break;
      case 'bonifico_paid':
        this.hud.announce('ADDEBITO ESEGUITO.', `+${e.extra ?? 25}% DI DANNO`, '#f472b6', 1400, 72);
        audio.wrong();
        this.fx.ring(f.x, f.y + 1, '#f472b6', 3);
        break;
      case 'bonifico_fail':
      case 'bonifico_declined':
        this.hud.feedMessage(`${this.labelOf(e.id)}: PAGAMENTO RIFIUTATO`, '#f87171', 1600);
        break;
    }
    void col;
  }

  /** Statistiche dell'abilita' (report F4) ricavate dai contatori del simulatore: nessun doppio conteggio. */
  private syncHub(): void {
    for (const f of this.world.fighters) {
      const prev = this.lastAbilitySnap.get(f.id);
      if (!prev) continue;
      for (let i = prev.ok; i < f.stats.abilitySuccess; i++) abilityHub.succeeded(f.id);
      for (let i = prev.fail; i < f.stats.abilityFail; i++) abilityHub.wasted(f.id);
      for (const [k, v] of Object.entries(f.stats.impact)) {
        const d = v - (prev.impact[k] ?? 0);
        if (d > 0) abilityHub.impact(f.id, k, d);
      }
      prev.ok = f.stats.abilitySuccess;
      prev.fail = f.stats.abilityFail;
      prev.impact = { ...f.stats.impact };
    }
  }

  // ------------------------------------------------------------------ disegno

  private cameraSubjects(): { x: number; y: number; active: boolean }[] {
    return this.world.fighters.map((f) => ({ x: f.x, y: f.y, active: f.inGame && !f.dead && f.ab.vanishT <= 0 }));
  }

  private laneZ(f: Fighter): number {
    return (f.index - (this.world.fighters.length - 1) / 2) * 0.12;
  }

  private updateVisuals(dt: number, now: number): void {
    for (const f of this.world.fighters) {
      const ent = this.entities.get(f.id);
      if (!ent) continue;
      const gone = f.dead || !f.inGame || f.ab.vanishT > 0;
      ent.root.setEnabled(!gone);
      if (gone) continue;
      const blink = f.invuln > 0 && Math.floor(now / 90) % 2 === 0 && f.hover <= 0;
      ent.setBodyVisible(!blink);
      const light = f.ab.weightT > 0;
      ent.setSizeMul(light ? 0.88 : 1);
      ent.setAura(light || f.percent >= 120 || f.ab.pendingT > 0 || f.ab.followT > 0);
      const vis: VisualSubject = {
        x: f.x,
        y: f.y,
        z: this.laneZ(f),
        vx: f.vx,
        vz: 0,
        facing: f.facing > 0 ? Math.PI / 2 : -Math.PI / 2,
        alive: true,
        falling: false,
        spin: 0,
        dashing: !!f.dodge || f.ab.burstT > 0,
        stunTime: f.hitstun > 0 ? Math.min(f.hitstun, 0.6) : 0,
        hitFlash: f.hitFlash,
        dodgeTime: f.dodge && !f.dodge.air ? 1 : 0,
        air: f.grounded ? 0 : 1
      };
      ent.updateVisual(vis, dt, now);
      if (f.ab.vanishT <= 0) this.fx.marker(`v_${f.id}`, false);
    }
  }

  private syncHud(): void {
    const view = this.camera.view;
    for (const f of this.world.fighters) {
      const out = !f.inGame;
      abilityHub.setStatus(f.id, this.world.abil.status(f));
      this.hud.setFighter(f.id, f.lives, f.percent, this.world.abil.status(f), { dead: f.dead, out });
      // indicatore: vivo, in gioco, ma fuori dal quadro
      let show = false;
      let nx = 0.5;
      let ny = 0.5;
      let ang = 0;
      if (f.inGame && !f.dead && f.ab.vanishT <= 0) {
        const p = this.camera.project(f.x, f.y + 1.1, 0);
        const margin = 0.035;
        if (p.nx < margin || p.nx > 1 - margin || p.ny < margin || p.ny > 0.8) {
          show = true;
          const dx = p.nx - 0.5;
          const dy = p.ny - 0.5;
          const sx = dx === 0 ? Infinity : (dx > 0 ? 0.43 : -0.43) / dx;
          const sy = dy === 0 ? Infinity : (dy > 0 ? 0.31 : -0.4) / dy;
          const k = Math.min(Math.abs(sx), Math.abs(sy));
          nx = 0.5 + dx * k;
          ny = 0.5 + dy * k;
          ang = Math.atan2(dy, dx) + Math.PI / 2;
        }
      }
      this.hud.setIndicator(f.id, show, nx, ny, ang, f.percent);
    }
    this.hud.setTimer(this.world.phase === 'sudden' ? 0 : this.world.timeLeft);
    if (this.world.phase === 'sudden') this.hud.setRight('⚡ SPAREGGIO', '#f87171');
    void view;
  }

  // ------------------------------------------------------------------ fine partita

  private startCelebration(): void {
    if (this.phase === 'celebrating') return;
    this.phase = 'celebrating';
    this.celebrateTime = 2.2;
    const rank = this.world.ranking();
    const winner = rank[0];
    for (const f of rank.slice(1)) this.entities.get(f.id)?.playDefeat();
    if (winner) {
      const w = this.entities.get(winner.id);
      w?.root.setEnabled(true);
      w?.setBodyVisible(true);
      w?.playVictory();
      w?.react('victory');
      audio.fanfare();
      audio.duck(0.5, 1300);
      this.hud.feedMessage(winnerFeed(this.ctx.players.find((p) => p.id === winner.id)?.avatar ?? '', this.names.get(winner.id) ?? '', winner.characterId), '#fbbf24', 4200);
      this.ctx.signal(winner.id, { type: 'won' });
    }
    if (this.lastEndReason === 'timeout' || this.world.endReason === 'timeout') this.hud.announce('TEMPO SCADUTO', '', '#fbbf24', 1800, 80);
  }

  private buildResults(): PlayerResult[] {
    const rank = this.world.ranking();
    const w = this.world;
    const all = w.fighters;
    const sum = (fn: (f: Fighter) => number): number => all.reduce((a, f) => a + fn(f), 0);
    const deaths = all.flatMap((f) => f.stats.deathPercents);
    telemetry.metrics('cornicione', {
      durationSec: Math.round(this.gameTime),
      endReason: w.endReason ?? 'unknown',
      players: all.length,
      kos: sum((f) => f.stats.kos),
      deaths: sum((f) => f.stats.deaths),
      avgDeathPercent: deaths.length ? Math.round(deaths.reduce((a, b) => a + b, 0) / deaths.length) : 0,
      damageDealt: Math.round(sum((f) => f.stats.dmgDealt)),
      damageReceived: Math.round(sum((f) => f.stats.dmgTaken)),
      recoveryAttempts: sum((f) => f.stats.recoveryAttempts),
      recoveriesOk: sum((f) => f.stats.recoveriesOk),
      edgeKos: sum((f) => f.stats.edgeKos),
      maxCombo: Math.max(0, ...all.map((f) => f.stats.maxCombo)),
      abilityUses: sum((f) => f.stats.abilityUses),
      abilitySuccesses: sum((f) => f.stats.abilitySuccess),
      abilityFailures: sum((f) => f.stats.abilityFail)
    });
    return rank.map((f, i) => {
      const stats: string[] = [`${f.stats.kos} KO`];
      if (f.stats.dmgDealt >= 1) stats.push(`${Math.round(f.stats.dmgDealt)}% danno`);
      const counters = f.stats.impact[IMPACT_KEYS.counterOk] ?? 0;
      if (f.characterId === 'judoka' && counters > 0) stats.push(`${counters} counter`);
      else if (f.stats.recoveriesOk > 0) stats.push(`${f.stats.recoveriesOk} recuperi`);
      return { playerId: f.id, placement: i + 1, score: f.stats.kos, stats: stats.slice(0, 3) };
    });
  }

  // ------------------------------------------------------------------ debug (solo ?debug=1 / dev)

  /** Righe del pannello F3. */
  debugLines(): string[] {
    const L: string[] = [`── CORNICIONE · t ${this.world.time.toFixed(1)}s · ${this.world.phase}`];
    for (const f of this.world.fighters) {
      const st = this.world.abil.status(f);
      L.push(
        `${(SHORT[f.characterId] ?? f.characterId).padEnd(10)} ${String(Math.round(f.percent)).padStart(3)}% ♥${f.lives} gr:${f.grounded ? 1 : 0} salti:${f.jumps} airDodge:${f.airDodgeUsed ? 0 : 1} recovery:${f.recoveryUsed ? 0 : 1} v:(${f.vx.toFixed(1)},${f.vy.toFixed(1)}) ult:${f.lastHitBy ? this.names.get(f.lastHitBy) : '-'} ab:${st.state}${st.note ? ' ' + st.note : ''}`
      );
    }
    return L;
  }

  /** Mostra/nasconde hurtbox, hitbox attive, limiti di KO e piattaforme (tasto H in debug). */
  setShowBoxes(on: boolean): void {
    this.showBoxes = on;
    if (!on) {
      for (const b of this.boxes) b.isVisible = false;
      if (this.koBox) this.koBox.isVisible = false;
      return;
    }
    if (this.boxes.length === 0) this.buildBoxes();
  }

  private wire(name: string, w: number, h: number, color: string): Mesh {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: 0.1 }, this.scene);
    const mat = new StandardMaterial(`${name}Mat`, this.scene);
    mat.wireframe = true;
    mat.disableLighting = true;
    mat.emissiveColor = Color3.FromHexString(color);
    mat.fogEnabled = false;
    m.material = mat;
    m.isPickable = false;
    m.renderingGroupId = 1;
    return m;
  }

  private buildBoxes(): void {
    for (let i = 0; i < this.world.fighters.length; i++) {
      this.boxes.push(this.wire('hurtbox', PHYS.halfW * 2, PHYS.height, '#4ade80'));
      this.boxes.push(this.wire('hitbox', 1, 1, '#f87171'));
    }
    this.koBox = this.wire('koBounds', KO.maxX - KO.minX, KO.maxY - KO.minY, '#fbbf24');
    this.koBox.position.set((KO.maxX + KO.minX) / 2, (KO.maxY + KO.minY) / 2, -0.5);
    for (const p of STAGE.platforms) {
      const b = this.wire('platformBox', p.x1 - p.x0, 0.2, '#60a5fa');
      b.position.set((p.x0 + p.x1) / 2, p.y - 0.1, -0.5);
      this.boxes.push(b);
    }
    const main = this.wire('mainBox', STAGE.mainX * 2, 40, '#60a5fa');
    main.position.set(0, -20, -0.5);
    this.boxes.push(main);
  }

  private updateBoxes(): void {
    this.world.fighters.forEach((f, i) => {
      const hurt = this.boxes[i * 2];
      const hit = this.boxes[i * 2 + 1];
      if (!hurt || !hit) return;
      hurt.isVisible = f.inGame && !f.dead;
      hurt.position.set(f.x, f.y + PHYS.height / 2, -0.6);
      const a = f.attack;
      const active = !!a && a.phase === 1;
      hit.isVisible = active;
      if (active && a) {
        const m = a.move;
        hit.scaling.set(m.hit.w, m.hit.h, 1);
        hit.position.set(f.x + f.facing * m.hit.x, f.y + m.hit.y, -0.7);
      }
    });
  }

  /** Per i test nel browser e il laboratorio ?fighter=1: accesso al simulatore. */
  get sim(): FighterWorld {
    return this.world;
  }

  setBot(id: PlayerId, on: boolean): void {
    if (!on) this.bots.delete(id);
    else this.bots.set(id, new FighterBot(id, () => this.ctx.rng.next(), 0.7));
  }

  // ------------------------------------------------------------------ ciclo di vita

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (activeGame === this) activeGame = null;
    if ((window as unknown as Record<string, unknown>).__fighter === this) delete (window as unknown as Record<string, unknown>).__fighter;
    window.removeEventListener('resize', this.onResize);
    this.unsubAbility();
    abilityHub.end();
    safely('entities', () => {
      for (const e of this.entities.values()) e.dispose();
    });
    safely('fx.dispose', () => this.fx.dispose());
    safely('camera.dispose', () => this.camera.dispose());
    safely('hud.dispose', () => this.hud.dispose());
    safely('engine.stopRenderLoop', () => this.engine.stopRenderLoop());
    safely('scene.dispose', () => this.scene.dispose());
    safely('engine.dispose', () => this.engine.dispose());
    this.bots.clear();
    this.boxes = [];
  }
}

void KO;
