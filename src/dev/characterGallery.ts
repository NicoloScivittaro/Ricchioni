import { Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight, Vector3, Color3, Color4, MeshBuilder, StandardMaterial, DynamicTexture } from '@babylonjs/core';
import { ArenaEntity } from '../minigames/arena/arenaEntity';
import type { VisualSubject } from '../minigames/arena/arenaEntity';
import { MAX_SPEED } from '../minigames/arena/arenaTypes';
import { CHARACTER_ORDER } from '../../shared/characters';
import { CHARACTER_PRESENTATION, resetBarks } from '../../shared/characterPresentation';
import { ARENA_ABILITIES } from '../../shared/arenaAbilities';

/**
 * GALLERIA PERSONAGGI — SOLO SVILUPPO (`npm run dev`) o `?debug=1`, aperta con `?characters=1`. Non esiste nella UX normale.
 * I 5 personaggi affiancati, stessa luce, stato a scelta (IDLE, RUN, JUMP, DASH, HIT, STUN, ABILITY, VICTORY, DEFEAT) e tre viste:
 *  - COLORI: come in partita (colore del giocatore + targhetta)
 *  - SILHOUETTE: tutti grigi, senza nomi — il test vero: si devono riconoscere dalla forma
 *  - SQUADRE: maglie rosse/blu (calcio/pallavolo): la squadra deve restare chiarissima
 * `window.__gallery` permette ai test E2E di cambiare vista/stato e fare screenshot.
 */
type Mode = 'colors' | 'silhouette' | 'teams';
type State = 'IDLE' | 'RUN' | 'JUMP' | 'DASH' | 'HIT' | 'STUN' | 'ABILITY' | 'VICTORY' | 'DEFEAT' | 'BARK';
const STATES: State[] = ['IDLE', 'RUN', 'JUMP', 'DASH', 'HIT', 'STUN', 'ABILITY', 'VICTORY', 'DEFEAT', 'BARK'];
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
  let stateT = 0;

  const build = (): void => {
    for (const e of entities) e.dispose();
    entities = [];
    subjects = [];
    CHARACTER_ORDER.forEach((id, i) => {
      const p = CHARACTER_PRESENTATION[id];
      const team = mode === 'teams' ? (i % 2 === 0 ? 'red' : 'blue') : null;
      const garment = team === 'red' ? '#ef4444' : team === 'blue' ? '#3b82f6' : p.accent;
      const e = new ArenaEntity(scene, dot, garment, id, p.icon, p.shortName, team, { neutral: mode === 'silhouette' });
      entities.push(e);
      subjects.push({ x: (i - 2) * SPACING, y: 0, z: 0, vx: 0, vz: 0, facing: Math.PI, alive: true, falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 });
    });
    applyState(state);
  };

  const applyState = (s: State): void => {
    state = s;
    stateT = 0;
    resetBarks();
    CHARACTER_ORDER.forEach((id, i) => {
      const e = entities[i];
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
    bar.append(sep);
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

  build();
  let last = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
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
      if (state === 'JUMP') p.y = Math.max(0, Math.sin(stateT * 3.2)) * 0.9;
      if (state === 'STUN') p.stunTime = 1;
      if (state === 'HIT' && stateT % 1.3 < dt) p.hitFlash = 0.16;
      if (state === 'ABILITY' && stateT > 2.2) {
        stateT = 0;
        const id = CHARACTER_ORDER[i];
        entities[i].playAbility(ARENA_ABILITIES[id]?.name ?? 'ABILITÀ');
      }
      entities[i].updateVisual(p, dt, now);
    });
    scene.render();
  });
  window.addEventListener('resize', () => engine.resize());

  (window as unknown as Record<string, unknown>).__gallery = {
    ready: true,
    count: () => entities.length,
    setMode: (m: Mode) => setMode(m),
    setState: (s: State) => applyState(s),
    meshes: () => scene.meshes.length,
    fps: () => engine.getFps()
  };
}
