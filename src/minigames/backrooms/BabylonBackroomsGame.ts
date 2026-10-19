import { Engine, Scene, Color3, Color4, UniversalCamera, Viewport, Vector3, DynamicTexture } from '@babylonjs/core';
import type { MinigameContext } from '../types';
import { ArenaEntity } from '../arena/arenaEntity';
import { splitScreenLayout } from '../kart-race/cameraHud';
import { engineOptions, applyQuality, getQualityLevel } from '../../core/quality';
import { guardLoop } from '../../core/loopGuard';
import { runSteps } from '../../core/frameClock';
import { BackroomsMatch, BackroomsBots } from './backroomsRules';
import { buildBackWorld, createCreature } from './backroomsWorld';
import { freshMazeSeed, topologySignature } from './maze';
import { LEVEL_IDS } from './levels';
import type { LevelId } from './levels';
import { BackroomsInteractionInput } from './backroomsInput';
import { BackroomsPerceptionDebug } from './backroomsDebug';
import { BackroomsAudio } from './backroomsAudio';
import type { BackPlayer } from './backroomsRules';
import type { BackPhoneStatus } from '../../controller/backroomsController';

/** One authoritative match and one Babylon scene, with a viewport for every player/device. */
export class BabylonBackroomsGame {
  readonly engine: Engine; readonly scene: Scene; readonly match: BackroomsMatch; readonly ready: Promise<void>;
  readonly cameras: UniversalCamera[] = []; readonly entities = new Map<string, ArenaEntity>();
  private bots = new BackroomsBots(); private sound = new BackroomsAudio(); private world: ReturnType<typeof buildBackWorld>;
  private creatures: ReturnType<typeof createCreature>[] = []; private imitations = new Map<number, ArenaEntity>();
  private scares: ReturnType<typeof createCreature>[] = []; private captureKinds = new Map<string, string>();
  private hud: HTMLDivElement; private panels: HTMLElement[] = []; private spectators = new Map<string, number>();
  private panelNodes: {clock:HTMLElement;life:HTMLElement;stamina:HTMLElement;center:HTMLElement;prompt:HTMLElement;scare:HTMLElement;white:HTMLElement}[]=[];
  private panelElapsed=0;private layersDirty=true;
  private signals = new Map<string, string>(); private signalTime = 0; private endTime = 3; private submitted = false;
  private interactions = new BackroomsInteractionInput();
  private perceptionDebug: BackroomsPerceptionDebug | null = null;
  private static previousSeed = -1; private static previousTopology = ''; private static previousLevel = '';
  private paused = false; private disposed = false; private controlsReady = false;
  private onResize = () => this.engine.resize();
  constructor(canvas: HTMLCanvasElement, private ctx: MinigameContext) {
    const options = engineOptions(); this.engine = new Engine(canvas, options.antialias, options); this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking=true;
    this.scene.onNewMeshAddedObservable.add(()=>{this.layersDirty=true;});
    let seed = ctx.rng.int(1, 0x7fffffff);
    const debugSeed = import.meta.env.DEV ? new URLSearchParams(location.search).get('backroomsSeed') : null;
    const replay = debugSeed !== null && /^\d{1,10}$/.test(debugSeed);
    let previousSeed = BabylonBackroomsGame.previousSeed, previousTopology = BabylonBackroomsGame.previousTopology;
    try { previousSeed = Number(sessionStorage.getItem('backrooms.lastSeed') ?? previousSeed); previousTopology = sessionStorage.getItem('backrooms.lastTopology') ?? previousTopology; } catch { /* in-memory guard remains */ }
    seed = replay ? Number(debugSeed) >>> 0 : freshMazeSeed(seed, ctx.players.length, previousSeed, previousTopology);
    // A different level (and so a different pair of creatures) every match; DEV can force one with ?backroomsLevel=.
    let previousLevel = BabylonBackroomsGame.previousLevel;
    try { previousLevel = sessionStorage.getItem('backrooms.lastLevel') ?? previousLevel; } catch { /* in-memory guard remains */ }
    const debugLevel = import.meta.env.DEV ? new URLSearchParams(location.search).get('backroomsLevel') : null;
    const choices = LEVEL_IDS.filter(id => id !== previousLevel);
    const level: LevelId = LEVEL_IDS.includes(ctx.mapId as LevelId) ? ctx.mapId as LevelId : LEVEL_IDS.includes(debugLevel as LevelId) ? debugLevel as LevelId : choices[ctx.rng.int(0, choices.length - 1)];
    this.match = new BackroomsMatch(ctx.players.map(p => ({ id: p.id, name: p.displayName, bot: p.bot })), seed, { level, duration: ctx.durationSec, imitator: true });
    if (!replay) {
      BabylonBackroomsGame.previousSeed = seed; BabylonBackroomsGame.previousTopology = topologySignature(this.match.maze); BabylonBackroomsGame.previousLevel = level;
      try { sessionStorage.setItem('backrooms.lastSeed', String(seed)); sessionStorage.setItem('backrooms.lastTopology', BabylonBackroomsGame.previousTopology); sessionStorage.setItem('backrooms.lastLevel', level); } catch { /* disabled storage */ }
    }
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('backroomsDebug') === '1') this.perceptionDebug = new BackroomsPerceptionDebug(this.scene, this.match);

    const theme = this.match.level.theme;
    this.scene.clearColor = new Color4(...theme.fog, 1); this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(...theme.fog); this.scene.fogStart = 9; this.scene.fogEnd = 27;
    this.world = buildBackWorld(this.scene, this.match.maze, this.match.tasks, this.match.puzzle, ctx.players.length <= 3 && getQualityLevel() !== 'low', theme);
    const dot = new DynamicTexture('backDot', 16, this.scene, false); dot.getContext().fillStyle = 'white'; dot.getContext().fillRect(0, 0, 16, 16); dot.update();
    const layout = splitScreenLayout(ctx.players.length);
    this.hud = document.createElement('div'); this.hud.id = 'backrooms-hud';
    this.hud.innerHTML = `<style>
    #backrooms-hud{position:fixed;inset:0;z-index:10001;pointer-events:none;font-family:monospace;color:#dddcc2}#backrooms-hud .back-view{position:absolute;box-sizing:border-box;border:2px solid #080b08;overflow:hidden;background:radial-gradient(ellipse,transparent 40%,#0008 100%);text-shadow:0 1px 3px #000}#backrooms-hud .back-name{position:absolute;left:12px;top:10px;right:12px;font:bold clamp(10px,1vw,15px) monospace;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:2px solid var(--player);padding-left:7px}#backrooms-hud .back-clock{float:right;font-size:11px;color:#adb091}#backrooms-hud .back-bottom{position:absolute;bottom:12px;left:12px;right:12px;font-size:clamp(10px,.85vw,13px)}#backrooms-hud .back-life{color:#ddd9ad}#backrooms-hud .back-stamina{height:3px;width:85px;background:#333a27;margin-top:6px}#backrooms-hud .back-stamina i{display:block;height:100%;background:#b1bf85}#backrooms-hud .back-center{position:absolute;left:7%;right:7%;top:42%;text-align:center;line-height:1.55;font-size:clamp(11px,1.1vw,17px)}#backrooms-hud .back-prompt{position:absolute;left:6%;right:6%;bottom:19%;text-align:center;font-size:clamp(10px,.9vw,14px);color:#e6e7ba}#backrooms-hud .back-reticle{position:absolute;left:50%;top:50%;width:3px;height:3px;background:#dfe0b79f;border-radius:50%}#backrooms-hud .back-scare{position:absolute;inset:0;display:none;background:#000}#backrooms-hud .back-face{width:100%;height:100%;filter:contrast(1.6);transform:scale(1.25)}#backrooms-hud .back-white{position:absolute;inset:0;opacity:0;background:#ecebd1}#backrooms-hud .back-seed{position:absolute;right:10px;bottom:3px;font:9px monospace;color:#89907160}
    @media(max-height:600px){#backrooms-hud .back-name{top:5px;left:6px}#backrooms-hud .back-bottom{bottom:7px;left:7px}#backrooms-hud .back-prompt{bottom:18%}}
    body:has(#backrooms-hud) #pad-alert{top:45%;font:12px Arial;max-width:220px}body:has(#backrooms-hud) #pad-toasts{top:45%}body:has(#backrooms-hud) #pad-toasts>div{font:700 12px/1.3 Arial!important;padding:7px!important;max-width:240px!important}
    </style>`;
    ctx.players.forEach((p, i) => {
      const rect = layout[i], camera = new UniversalCamera(`backCamera:${p.id}`, new Vector3(0, 1.65, 0), this.scene);
      camera.inputs.clear(); camera.viewport = new Viewport(rect.x, rect.y, rect.w, rect.h); camera.minZ = .06; camera.maxZ = 30; camera.fov = 1.04;
      camera.layerMask = 0x0fffffff & ~(1 << (10 + i)); this.cameras.push(camera);
      const e = new ArenaEntity(this.scene, dot, p.color, p.characterId, p.avatar, p.displayName, null, { context: 'arena', nameplate: false }); e.setSizeMul(.84); this.entities.set(p.id, e);
      // Character identity/skin stays intact; no arena hand props in this non-combat horror context.
      e.root.getChildTransformNodes(false).filter(node => node.name === 'prop').forEach(node => node.setEnabled(false));
      const panel = document.createElement('div'); panel.className = 'back-view'; panel.style.cssText = `left:${rect.x * 100}%;top:${(1 - rect.y - rect.h) * 100}%;width:${rect.w * 100}%;height:${rect.h * 100}%;--player:${p.color}`;
      panel.innerHTML = '<div class="back-name"><span></span><b class="back-clock"></b></div><div class="back-reticle"></div><div class="back-center"></div><div class="back-prompt"></div><div class="back-bottom"><div class="back-life"></div><div class="back-stamina"><i></i></div></div><div class="back-scare"><div class="back-face"></div></div><div class="back-white"></div>';
      panel.querySelector('.back-name span')!.textContent = `${p.displayName}${p.bot && !p.displayName.startsWith('BOT ') ? ' · BOT' : ''}`;
      const node=(selector:string)=>panel.querySelector<HTMLElement>(selector)!;
      node('.back-prompt').style.whiteSpace='pre-line';node('.back-face').style.display='none';
      this.panelNodes.push({clock:node('.back-clock'),life:node('.back-life'),stamina:node('.back-stamina i'),center:node('.back-center'),prompt:node('.back-prompt'),scare:node('.back-scare'),white:node('.back-white')});
      const scare = createCreature(this.scene, this.match.monsters[0]?.kind ?? 'stalker'); scare.root.getChildMeshes().forEach(mesh => mesh.layerMask = 1 << (20 + i)); scare.root.setEnabled(false); this.scares.push(scare);
      this.hud.appendChild(panel); this.panels.push(panel);
    });
    const seedLabel = document.createElement('div'); seedLabel.className = 'back-seed'; seedLabel.textContent = `${this.match.level.name} · SEED ${seed}`; this.hud.appendChild(seedLabel); document.body.appendChild(this.hud);
    this.match.monsters.forEach((m, i) => { const c = createCreature(this.scene, m.kind); this.creatures.push(c);
      if (m.kind === 'imitator') { const snap = ctx.players[ctx.rng.int(0, ctx.players.length - 1)], entity = new ArenaEntity(this.scene, dot, snap.color, snap.characterId, snap.avatar, snap.displayName, null, { context: 'arena', nameplate: false }); entity.setSizeMul(.84); entity.root.getChildTransformNodes(false).filter(node => node.name === 'prop').forEach(node => node.setEnabled(false)); this.imitations.set(i, entity); }
    });
    this.world.shadows?.getShadowMap()?.renderList?.push(...this.creatures.flatMap(c => c.root.getChildMeshes()));
    this.scene.activeCameras = this.cameras; applyQuality(this.engine, this.scene); window.addEventListener('resize', this.onResize);
    this.ready = this.initialize();
    this.engine.runRenderLoop(guardLoop(() => { if (this.disposed || this.paused) return; runSteps(this.engine.getDeltaTime(), dt => this.step(dt)); this.ctx.input.update(); this.scene.render(); }));
  }
  private async initialize(): Promise<void> {
    await (this.ctx.showControls?.() ?? Promise.resolve()); if (this.disposed) return;
    this.ctx.input.reset(); this.match.cancel(); this.controlsReady = true; this.sound.start();
  }
  setPaused(on: boolean): void { this.paused = on; this.match.cancel(); this.match.players.forEach(p => this.interactions.sync(p.id, this.ctx.input.get(p.id))); this.sound.setPaused(on); this.match.players.forEach(p => this.ctx.input.cancelPlayer(p.id)); }
  step(dt: number): void {
    if (this.disposed || this.paused) return;
    if (this.controlsReady && !this.match.ended) {
      for (const p of this.match.players) {
        const input = this.ctx.input.get(p.id), move = input.axis('move'), look = input.axis('lookStick');
        const presses = this.interactions.read(p.id, input), held = input.pressed('interact');
        if (['eliminated', 'escaped'].includes(p.state) && presses) this.spectators.set(p.id, (this.spectators.get(p.id) ?? 0) + presses);
        this.match.command(p.id, p.bot ? this.bots.command(p, this.match) : { x: move.x, z: -move.y, lookX: look.x, lookY: look.y, sprint: input.pressed('sprint'), interact: presses > 0, presses: this.match.intro > 0 ? 0 : presses, held });
      }
      this.match.advance(dt); this.sound.update(this.match);
    }
    this.perceptionDebug?.update();
    if(this.layersDirty){this.layersDirty=false;this.match.players.forEach((p,i)=>this.entities.get(p.id)!.root.getChildMeshes().forEach(mesh=>{mesh.layerMask=1<<(10+i);}));}
    this.panelElapsed+=dt;const refreshPanels=this.panelElapsed>=.05;if(refreshPanels)this.panelElapsed=0;
    const alive = this.match.players.filter(p => p.state === 'exploring');
    this.match.players.forEach((p, i) => {
      const entity = this.entities.get(p.id)!; entity.root.setEnabled(p.state === 'exploring' && !p.hiding);
      if(entity.root.isEnabled())entity.updateVisual({ x: p.x, y: 0, z: p.z, vx: p.dx, vz: p.dz, facing: p.yaw, alive: p.state === 'exploring', falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 }, dt, this.match.time * 1000);
      let subject = p;
      if (p.state === 'eliminated' || (p.state === 'escaped' && p.stateTime > 2)) subject = alive[(this.spectators.get(p.id) ?? 0) % Math.max(1, alive.length)] ?? p;
      const camera = this.cameras[i], own = this.match.players.indexOf(subject); camera.layerMask = (0x0fffffff & ~(1 << (10 + own)) & ~(0x1f << 20)) | (1 << (20 + i));
      camera.position.set(subject.x, 1.58 + (subject.hiding ? -.35 : Math.sin(this.match.time * (subject.running ? 15 : 9)) * Math.min(.025, Math.hypot(subject.dx, subject.dz) * .007)), subject.z);
      camera.rotation.set(subject.pitch, subject.yaw, 0); camera.fov += ((subject.running ? 1.1 : 1.04) - camera.fov) * Math.min(1, dt * 8);
      const captured = (p.state === 'captured' || p.state === 'eliminated') && p.stateTime < .32;
      const scare = this.scares[i]; scare.root.setEnabled(captured);
      if (captured) {
        camera.rotation.x = -.04;
        const phase = this.captureKinds.get(p.id) === 'runner' ? -1 : 1;
        scare.root.position.set(camera.position.x + Math.sin(p.yaw) * .55, camera.position.y - 2.36, camera.position.z + Math.cos(p.yaw) * .55);
        scare.root.rotation.y = p.yaw + Math.PI; scare.head.rotation.z = phase * (.18 + Math.sin(p.stateTime * 41) * .06); scare.jaw.position.y = -.31;
      }
      if(refreshPanels)this.updatePanel(p, subject, i);
    });
    this.world.doors.forEach((root, i) => { const door = this.match.maze.doors[i], base = door.horizontal ? 0 : Math.PI / 2; root.rotation.y += (base + (door.open ? Math.PI / 2 : 0) - root.rotation.y) * Math.min(1, dt * 9); });
    const key = this.match.key; this.world.key.setEnabled(!!key); if (key) { this.world.key.position.set(key.x, .65 + Math.sin(this.match.time * 2) * .035, key.z); this.world.key.rotation.y = this.match.time * .3; }
    this.world.tasks.forEach((task, i) => { const on = this.match.taskProgress[i] === 1; task.light.emissiveColor.set(on ? .03 : .35, on ? .55 : .02, 0); });
    this.world.flicker.emissiveColor.setAll(this.match.time % 17 > 16.6 && Math.sin(this.match.time * 57) > .3 ? .08 : .48);
    this.match.monsters.forEach((m, i) => { const c = this.creatures[i]; c.root.setEnabled(m.revealed); c.root.position.set(m.x, 0, m.z); c.root.rotation.y = m.yaw; c.update(this.match.time, m.state === 'chase', m.state === 'watch' || m.state === 'rest');
      const imitation = this.imitations.get(i); if (imitation) { imitation.root.setEnabled(!m.revealed); imitation.updateVisual({ x: m.x, y: 0, z: m.z, vx: Math.sin(m.yaw) * 2, vz: Math.cos(m.yaw) * 2, facing: m.yaw, alive: true, falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 }, dt, this.match.time * 1000); }
    });
    for (const event of this.match.events) { this.sound.event(event, this.match); if (event.type === 'capture' && event.player) { this.captureKinds.set(event.player, event.kind ?? 'stalker'); this.ctx.vibrate(event.player, 160); } }
    this.match.events = [];
    this.signalTime -= dt; if (this.signalTime <= 0) { this.signalTime = .15; this.match.players.forEach(p => this.sendStatus(p)); }
    if (this.match.ended && !this.submitted && this.controlsReady) { this.endTime -= dt; if (this.endTime <= 0) { this.submitted = true; this.ctx.finish({ results: this.match.results() }); } }
  }
  private updatePanel(p: BackPlayer, subject: BackPlayer, i: number): void {
    const nodes=this.panelNodes[i],m=this.match,prompt=m.prompt(p),spectator=p!==subject;
    const text=(node:HTMLElement,value:string)=>{if(node.textContent!==value)node.textContent=value;};
    text(nodes.clock,`${Math.floor(m.remaining / 60)}:${String(Math.floor(m.remaining % 60)).padStart(2, '0')}`);
    text(nodes.life,p.state === 'eliminated' ? 'ELIMINATO · SPETTATORE' : p.state === 'escaped' ? `FUGGITO · ${p.escapedAt.toFixed(1)}s` : `${p.lives === 2 ? '● ● · DUE POSSIBILITÀ' : '● ○ · ULTIMA POSSIBILITÀ'}${p.hiding ? ' · NASCOSTO' : p.immunity > 0 ? ' · PROTETTO' : ''}${m.keyHolder === p.id ? ' · CHIAVE' : ''}`);
    nodes.stamina.style.width=`${p.stamina*100}%`;
    text(nodes.center,!this.controlsReady ? 'PREPARATEVI' : m.intro > 0 ? `${m.level.name}\n${Math.ceil(m.intro)} · ${m.level.tagline}` : m.ended ? 'IL LABIRINTO HA SCELTO\nFUGGITI → SUPERSTITI → ELIMINATI\nSUPERSTITI: VITE, POI ZONE\nELIMINATI: TEMPO DI SOPRAVVIVENZA' : spectator ? `OSSERVI ${subject.name}\nA/✕ · CAMBIA GIOCATORE` : p.state === 'escaped' ? 'SEI FUORI. RESPIRA.' : p.state === 'eliminated' ? 'NON È RIMASTO NESSUNO' : p.hiding ? 'RESTA IN SILENZIO' : '');
    const action = prompt ? `A/✕ · ${prompt.text}` : '';
    const message = p.noticeTime > 0 ? p.notice : '';
    text(nodes.prompt,m.intro > 0 ? 'LS MUOVI · RS GUARDA · LB CORRI · A INTERAGISCI' : [message, action].filter(Boolean).join('\n'));
    const captured = p.state === 'captured' || (p.state === 'eliminated' && p.stateTime < 1.6);
    nodes.scare.style.display = captured && p.stateTime >= .32 ? 'block' : 'none';
    nodes.white.style.opacity = p.state === 'escaped' && p.stateTime < 2 ? String(Math.max(0, .95 - p.stateTime / 2)) : '0';
  }
  private sendStatus(p: BackPlayer): void {
    const status: BackPhoneStatus = { type: 'backroomsStatus', state: p.state, lives: p.lives, available: this.controlsReady && this.match.intro <= 0 && !this.match.ended && p.state === 'exploring', stamina: Math.round(p.stamina * 20) / 20,
      prompt: this.match.prompt(p)?.text ?? '', notice: p.noticeTime > 0 ? p.notice : '', seconds: Math.ceil(this.match.remaining), key: this.match.keyHolder === p.id };
    const text = JSON.stringify(status); if (this.signals.get(p.id) !== text) { this.signals.set(p.id, text); this.ctx.signal(p.id, status as unknown as Record<string, unknown>); }
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.engine.stopRenderLoop(); window.removeEventListener('resize', this.onResize);
    this.perceptionDebug?.dispose(); this.sound.dispose(); this.entities.forEach(e => e.dispose()); this.imitations.forEach(e => e.dispose()); this.hud.remove(); this.scene.dispose(); this.engine.dispose();
  }
}
