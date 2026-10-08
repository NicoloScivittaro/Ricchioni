import { Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight, Vector3, Color3, Color4, MeshBuilder, StandardMaterial, DynamicTexture } from '@babylonjs/core';
import { ArenaEntity } from '../minigames/arena/arenaEntity';
import type { VisualSubject } from '../minigames/arena/arenaEntity';
import { MAX_SPEED } from '../minigames/arena/arenaTypes';
import { CHARACTER_ORDER } from '../../shared/characters';
import { CHARACTER_PRESENTATION, resetBarks } from '../../shared/characterPresentation';
import { ARENA_ABILITIES } from '../../shared/arenaAbilities';
import { goblinVisualCounters, goblinVisualDebug, goblinVisualMode, setGoblinVisualMode } from '../minigames/characters/goblinVisual';
import type { GoblinVisualMode } from '../minigames/characters/goblinVisual';
import { SceneInstrumentation } from '@babylonjs/core';
import { goblinAnimationPanel } from './goblinAnimationPanel';

/**
 * GALLERIA PERSONAGGI — SOLO SVILUPPO (`npm run dev`) o `?debug=1`, aperta con `?characters=1`. Non esiste nella UX normale.
 * I 5 personaggi affiancati, stessa luce, stato a scelta (IDLE, RUN, JUMP, DASH, HIT, STUN, ABILITY, VICTORY, DEFEAT) e tre viste:
 *  - COLORI: come in partita (colore del giocatore + targhetta)
 *  - SILHOUETTE: tutti grigi, senza nomi — il test vero: si devono riconoscere dalla forma
 *  - SQUADRE: maglie rosse/blu (calcio/pallavolo): la squadra deve restare chiarissima
 * `window.__gallery` permette ai test E2E di cambiare vista/stato e fare screenshot.
 *
 * GOBLIN TRIPO (pilota, solo DEV): il selettore OLD/NEW cambia il modello del Goblin per TUTTE le entità della
 * galleria, sullo STESSO posto, con camera, luci, facing, tempo della posa e root identici: è il confronto onesto.
 * Nessun controllo qui tocca il gioco: il selettore vale per le scene 3D della sessione (Arena, Cornicione,
 * Kart, Sparatoria) e in produzione non esiste.
 */
type Mode = 'colors' | 'silhouette' | 'teams';
type State = 'IDLE' | 'RUN' | 'JUMP' | 'DASH' | 'HIT' | 'STUN' | 'ATTACK' | 'ABILITY' | 'VICTORY' | 'DEFEAT' | 'BARK';
const STATES: State[] = ['IDLE', 'RUN', 'JUMP', 'DASH', 'HIT', 'STUN', 'ATTACK', 'ABILITY', 'VICTORY', 'DEFEAT', 'BARK'];
const SPACING = 3.1;

export function openCharacterGallery(): void {
  const wrap = document.createElement('div');
  wrap.id = 'char-gallery';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#1b1f2a;display:flex;flex-direction:column';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'flex:1;width:100%;min-height:0;outline:none';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#0f1320;font:700 13px Arial;color:#cbd5e1;align-items:center';
  wrap.append(canvas, bar);
  document.body.appendChild(wrap);
  // i tasti restano alla galleria (la lobby sotto non deve reagire)
  const swallow = (e: KeyboardEvent): void => e.stopPropagation();
  window.addEventListener('keydown', swallow, true);

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.42, 0.46, 0.54, 1);
  const cam = new ArcRotateCamera('galleryCam', -Math.PI / 2, 1.32, 13.5, new Vector3(0, 1.35, 0), scene);
  cam.attachControl(canvas, true);
  cam.lowerRadiusLimit = 5;
  cam.upperRadiusLimit = 40;
  const hemi = new HemisphericLight('hemi', new Vector3(0.15, 1, 0.1), scene);
  hemi.intensity = 0.7;
  hemi.groundColor = new Color3(0.3, 0.3, 0.36);
  const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.5), scene);
  sun.intensity = 0.8;
  const ground = MeshBuilder.CreateGround('galleryGround', { width: 40, height: 14 }, scene);
  const gm = new StandardMaterial('galleryGroundMat', scene);
  gm.diffuseColor = new Color3(0.55, 0.58, 0.64);
  gm.specularColor = new Color3(0, 0, 0);
  ground.material = gm;

  const dot = new DynamicTexture('galleryDot', 16, scene, false);
  const dc = dot.getContext() as unknown as CanvasRenderingContext2D;
  dc.fillStyle = 'white';
  dc.beginPath();
  dc.arc(8, 8, 7, 0, Math.PI * 2);
  dc.fill();
  dot.update();

  let mode: Mode = 'colors';
  let state: State = 'IDLE';
  let entities: ArenaEntity[] = [];
  let subjects: VisualSubject[] = [];
  let layout: 'characters'|'compare'|1|2|5 = 'characters';
  let characterIds: (typeof CHARACTER_ORDER)[number][] = [];
  /** (solo test GOBLIN) moltiplicatori di velocità per ENTITÀ GOBLIN: fanno divergere le clip per provarne l'indipendenza. */
  let goblinSpeed = new Map<number, number>();
  let stateT = 0;

  const build = (): void => {
    for (const e of entities) e.dispose();
    entities = [];
    subjects = [];
    characterIds = layout==='characters'?[...CHARACTER_ORDER]:Array.from({length:layout==='compare'?2:layout},()=> 'goblin' as const);
    characterIds.forEach((id, i) => {
      const p = CHARACTER_PRESENTATION[id];
      const team = mode === 'teams' ? (i % 2 === 0 ? 'red' : 'blue') : null;
      const garment = team === 'red' ? '#ef4444' : team === 'blue' ? '#3b82f6' : p.accent;
      const e = new ArenaEntity(scene, dot, garment, id, p.icon, layout==='compare'?(i===0?'LEGACY':'TRIPO'):p.shortName, team, { neutral: mode === 'silhouette',context:'gallery',goblinMode:layout==='compare'&&i===0?'old':undefined });
      entities.push(e);
      subjects.push({ x: (i - (characterIds.length-1)/2) * SPACING, y: 0, z: 0, vx: 0, vz: 0, facing: Math.PI, alive: true, falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 });
    });
    applyState(state);
  };

  const applyState = (s: State): void => {
    state = s;
    stateT = 0;
    resetBarks();
    entities.forEach((e, i) => {
      const id=characterIds[i]??'goblin';
      if (s === 'VICTORY') e.playVictory();
      else if (s === 'DEFEAT') e.playDefeat();
      else e.celebrate(0); // azzera eventuali celebrazioni
      if (s === 'ABILITY') e.playAbility(ARENA_ABILITIES[id]?.name ?? 'ABILITÀ');
      if (s === 'BARK') e.react('victory', true);
    });
    render();
  };

  const btn = (label: string, on: boolean, fn: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `font:800 12px Arial;padding:6px 10px;border-radius:8px;border:0;cursor:pointer;background:${on ? '#fbbf24' : '#1e293b'};color:${on ? '#111' : '#e5e7eb'}`;
    b.onclick = fn;
    return b;
  };
  const render = (): void => {
    bar.innerHTML = '<b style="margin-right:6px">👥 GALLERIA PERSONAGGI</b>';
    bar.append(
      btn('COLORI', mode === 'colors', () => setMode('colors')),
      btn('SILHOUETTE', mode === 'silhouette', () => setMode('silhouette')),
      btn('SQUADRE', mode === 'teams', () => setMode('teams'))
    );
    const sep = document.createElement('span');
    sep.style.cssText = 'width:12px';
    const bOld = btn('GOBLIN LEGACY', goblinVisualMode() === 'old', () => setGoblin('old'));
    bOld.id = 'goblin-old';
    const bNew = btn('GOBLIN TRIPO', goblinVisualMode() === 'new', () => setGoblin('new'));
    bNew.id = 'goblin-new';
    bar.append(sep, bOld, bNew);
    const sep2 = document.createElement('span');
    sep2.style.cssText = 'width:12px';
    bar.append(sep2);
    for (const s of STATES) bar.append(btn(s, state === s, () => applyState(s)));
    const close = btn('✕ CHIUDI', false, () => {
      window.removeEventListener('keydown', swallow, true);
      engine.dispose();
      wrap.remove();
    });
    close.style.marginLeft = 'auto';
    bar.append(close);
  };
  const setMode = (m: Mode): void => {
    mode = m;
    build();
  };
  const setGoblin = (m: GoblinVisualMode): void => {
    setGoblinVisualMode(m);
    build();
    render();
  };

  build();
  const panel=goblinAnimationPanel(scene,wrap,()=>entities,(n)=>{
    layout=n;setGoblinVisualMode('new');build();
    cam.setTarget(new Vector3(0,1.35,0));cam.radius=n==='compare'?6.5:n===1?5:13.5;
  });
  const instrumentation=new SceneInstrumentation(scene);
  instrumentation.captureAnimationsTime=true;
  // MISURE DEV (per il pilota): frame time della finestra scorrevole + draw call e renderer dichiarati dal motore.
  // Servono a documentare OLD/NEW con numeri reali, senza dedurre la causa di un calo (es. fill-rate) che il
  // motore non riporta: su GL software il renderer è esplicitamente SwiftShader.
  const frames: number[] = [];
  const perf = (): { fps: number; frameMsAvg: number; frameMsP95: number; drawCalls: number | null; renderer: string | null; vendor: string | null } => {
    const sorted = [...frames].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
    const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
    const info = (engine as unknown as { getGlInfo?: () => { vendor?: string; renderer?: string } }).getGlInfo?.();
    const dc = instrumentation.drawCallsCounter;
    return {
      fps: engine.getFps(),
      frameMsAvg: +avg.toFixed(2),
      frameMsP95: +p95.toFixed(2),
      drawCalls: dc.current,
      renderer: info?.renderer ?? null,
      vendor: info?.vendor ?? null
    };
  };
  let last = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const frameMs = now - last;
    const dt = Math.min(0.05, frameMs / 1000);
    last = now;
    frames.push(frameMs);
    if (frames.length > 240) frames.shift();
    stateT += dt;
    subjects.forEach((p, i) => {
      p.vx = 0;
      p.vz = 0;
      p.y = 0;
      p.dashing = false;
      p.stunTime = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (state === 'RUN') p.vz = -MAX_SPEED * 0.85; // corre verso la camera (sul posto)
      if (state === 'DASH') {
        p.vz = -MAX_SPEED * 1.4;
        p.dashing = true;
      }
      const mul = goblinSpeed.get(i);
      if (mul !== undefined && mul !== 1) {
        p.vx *= mul;
        p.vz *= mul;
      }
      if (state === 'JUMP') p.y = Math.max(0, Math.sin(stateT * 3.2)) * 0.9;
      p.grounded=p.y<=.02;
      p.vy=state==='JUMP'?Math.cos(stateT*3.2)*2.88:0;
      if (state === 'STUN') p.stunTime = 1;
      if (state === 'HIT' && stateT % 1.3 < dt) p.hitFlash = 0.16;
      if (state === 'ATTACK' && stateT % 1.3 < dt) entities[i].playMove('jab',.23);
      if (state === 'ABILITY' && stateT > 2.2) {
        stateT = 0;
        const id = characterIds[i]??'goblin';
        entities[i].playAbility(ARENA_ABILITIES[id]?.name ?? 'ABILITÀ');
      }
      entities[i].updateVisual(p, dt, now);
    });
    panel.update();
    scene.render();
  });
  window.addEventListener('resize', () => engine.resize());

  (window as unknown as Record<string, unknown>).__gallery = {
    ready: true,
    count: () => entities.length,
    setMode: (m: Mode) => setMode(m),
    setState: (s: State) => applyState(s),
    meshes: () => scene.meshes.length,
    fps: () => engine.getFps(),
    perf,
    preview: panel.preview,
    diagnostics: panel.diagnostics,
    setLayout: (n:'characters'|'compare'|1|2|5)=>{layout=n;setGoblinVisualMode('new');build();cam.setTarget(new Vector3(0,1.35,0));cam.radius=n==='compare'?6.5:n===1?5:13.5;},
    sample:()=>entities.map(e=>e.goblinDebug()),
    animationCost:()=>({engineAnimationMs:instrumentation.animationsTimeCounter.current,samplerMs:entities.reduce((n,e)=>n+(e.goblinDebug()?.sampleMs??0),0)}),
    // --- GOBLIN TRIPO (pilota, solo DEV): selettore e letture per il confronto OLD/NEW
    setGoblin,
    /** conteggi del pilota senza toccare la scena: usabile anche dopo la chiusura della galleria */
    goblinCounters: () => goblinVisualCounters(),
    /** (solo test) vista deterministica: fronte/lato/retro con la STESSA luce e lo STESSO posto. */
    setCamera: (alpha: number, beta = 1.32, radius = 13.5, targetX = 0) => {
      cam.alpha = alpha;
      cam.beta = beta;
      cam.radius = radius;
      cam.setTarget(new Vector3(targetX, 1.35, 0));
    },
    goblin: () => ({ ...goblinVisualDebug(scene), counters: goblinVisualCounters() }),
    goblins: () => entities.map((e) => e.goblinDebug()),
    /** (solo test) fa correre le istanze importate a velocità DIVERSE: prova che ogni Goblin ha scheletro e clip propri. */
    goblinDrive: (mults: number[]) => {
      const idx = entities.map((e, i) => (e.goblinDebug() ? i : -1)).filter((i) => i >= 0);
      goblinSpeed = new Map(idx.map((i, k) => [i, mults[k % Math.max(1, mults.length)] ?? 1]));
      return idx.length;
    },
    stats: () => ({
      meshes: scene.meshes.length,
      materials: scene.materials.length,
      textures: scene.textures.length,
      skeletons: scene.skeletons.length,
      animationGroups: scene.animationGroups.length,
      geometries: scene.geometries.length
    }),
    /** Aggiunge N Goblin extra (stessa entità di gioco, stesso codice del gioco) per provare l'indipendenza. */
    spawnGoblins: (n: number) => {
      for (let k = 0; k < n; k++) {
        const i = entities.length;
        const p = CHARACTER_PRESENTATION.goblin;
        const e = new ArenaEntity(scene, dot, p.accent, 'goblin', p.icon, `${p.shortName}${i}`, null,{context:'gallery'});
        characterIds.push('goblin');
        entities.push(e);
        subjects.push({ x: (i - 2) * SPACING, y: 0, z: 0, vx: 0, vz: 0, facing: Math.PI, alive: true, falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 });
      }
      applyState(state);
    }
  };
}
