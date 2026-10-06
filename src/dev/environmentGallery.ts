import { BlackAndWhitePostProcess, Color4, DynamicTexture, Engine, MeshBuilder, Scene, StandardMaterial, UniversalCamera, Vector3, Color3 } from '@babylonjs/core';
import type { Camera } from '@babylonjs/core';
import { ArenaEntity } from '../minigames/arena/arenaEntity';
import type { VisualSubject } from '../minigames/arena/arenaEntity';
import { ArenaCamera } from '../minigames/arena/arenaCamera';
import { CHARACTER_ORDER } from '../../shared/characters';
import { CHARACTERS } from '../../shared/characters';
import { buildEnvironment as buildArena } from '../minigames/arena/arenaEnvironment';
import { buildDodgeballEnvironment } from '../minigames/dodgeball/dodgeballEnvironment';
import { buildSoccerEnvironment } from '../minigames/soccer/soccerEnvironment';
import { buildVolleyballEnvironment } from '../minigames/volleyball/volleyballEnvironment';
import { buildTrack, buildTrackVisuals } from '../minigames/kart-race/track';
import { buildTrackGuides } from '../minigames/kart-race/trackGuides';
import { buildKartWorld, KART_SECTORS } from '../minigames/kart-race/kartEnvironment';
import { KartEntity } from '../minigames/kart-race/kartEntity';
import { createKartState } from '../minigames/kart-race/raceTypes';
import { buildFpsLights, buildFpsWorld, FPS_ZONE_NAMES } from '../controller/fpsWorld';
import { envStats } from '../minigames/env/envDebug';
import type { EnvStats } from '../minigames/env/envDebug';
import { getQualityLevel } from '../core/quality';
import Phaser from 'phaser';
import { addBackdrop } from '../scenes/backdrops';
import type { BackdropKind } from '../scenes/backdrops';
import { FONT_BODY } from '../core/uiTokens';

/**
 * GALLERIA AMBIENTI — SOLO SVILUPPO (`npm run dev`) o `?debug=1`, aperta con `?environments=1`. Niente HUD, niente
 * gioco: ogni ambiente con la VERA camera di gioco (o una panoramica), qualche personaggio e l'oggetto di gioco
 * (palla, kart) per giudicare leggibilita' e "dove sono". Tasto G (o bottone) = scala di grigi (test dei valori).
 * `window.__envGallery` permette ai test di scegliere vista/ambiente, leggere i conteggi e fare screenshot.
 * Le scenografie 2D (Memoria, Botta al Volo, Quiz, Cultura, Rullo) sono nella stessa galleria (vedi show2d).
 */

type View = 'game' | 'overview';
interface Entry {
  id: string;
  label: string;
  build: (scene: Scene, view: View) => Camera;
}

const ARENA_LIKE_OFFSETS: [number, number][] = [
  [-5, -3],
  [4, -2],
  [-2, 4],
  [6, 3]
];

function dotTexture(scene: Scene): DynamicTexture {
  const dot = new DynamicTexture('galleryDot', 16, scene, false);
  const dc = dot.getContext() as unknown as CanvasRenderingContext2D;
  dc.fillStyle = 'white';
  dc.beginPath();
  dc.arc(8, 8, 7, 0, Math.PI * 2);
  dc.fill();
  dot.update();
  return dot;
}

/** 4 personaggi veri (colori dei giocatori) fermi in campo. */
function addCharacters(scene: Scene, offsets: [number, number][], teams?: ('red' | 'blue')[]): void {
  const dot = dotTexture(scene);
  offsets.forEach(([x, z], i) => {
    const id = CHARACTER_ORDER[i % CHARACTER_ORDER.length];
    const ch = CHARACTERS[id];
    const team = teams?.[i] ?? null;
    const garment = team === 'red' ? '#ef4444' : team === 'blue' ? '#3b82f6' : ch.color;
    const e = new ArenaEntity(scene, dot, garment, id, ch.avatar, ch.name, team);
    const s: VisualSubject = { x, y: 0, z, vx: 0, vz: 0, facing: Math.PI, alive: true, falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 };
    scene.onBeforeRenderObservable.add(() => e.updateVisual(s, scene.getEngine().getDeltaTime() / 1000, performance.now()));
  });
}

function ball(scene: Scene, x: number, y: number, z: number, hex: string, r = 0.5): void {
  const b = MeshBuilder.CreateSphere('galleryBall', { diameter: r * 2, segments: 16 }, scene);
  b.position.set(x, y, z);
  const m = new StandardMaterial('galleryBallMat', scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.3, 0.3, 0.3);
  b.material = m;
}

/** La camera di gioco dei 4 giochi "da arena" (stessa classe, stessi parametri); panoramica = piu' alta e lontana. */
function arenaCam(scene: Scene, canvas: HTMLCanvasElement, view: View, spread: number): Camera {
  const cam = new ArenaCamera(scene, canvas);
  const subjects = ARENA_LIKE_OFFSETS.map(([x, z]) => ({ x: (x * spread) / 6, z: (z * spread) / 6, alive: true, falling: false }));
  for (let i = 0; i < 120; i++) cam.update(1 / 30, subjects as never, performance.now());
  const c = scene.activeCamera as Camera & { radius: number; beta: number };
  if (view === 'overview') {
    c.radius *= 2.1;
    c.beta = 0.95;
  }
  return c;
}

/** Anteprima 2D: la scenografia vera + un primo piano finto (tessere, VIA, domanda, carte) per giudicare la leggibilita'. */
function preview2d(parent: HTMLElement, kind: BackdropKind, absurd: number): Phaser.Game {
  class Preview extends Phaser.Scene {
    create(): void {
      const bd = addBackdrop(this, kind);
      const T = (x: number, y: number, t: string, size: number, color = '#ffffff'): void => {
        this.add.text(x, y, t, { fontFamily: '"Arial Black", Arial', fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);
      };
      if (kind === 'memory') {
        T(640, 74, 'OSSERVA', 72);
        const cols = [0xd94040, 0x3b7de0, 0x22b55e, 0xd4a20a];
        [[640, 250], [880, 420], [640, 590], [400, 420]].forEach(([x, y], i) => this.add.rectangle(x, y, 210, 210, cols[i]).setStrokeStyle(5, 0xffffff, 0.85));
      } else if (kind === 'reaction') {
        this.add.circle(640, 290, 110, 0x14182b).setStrokeStyle(6, 0x6366f1);
        T(640, 530, 'ATTENDI...', 72, '#e0e7ff');
      } else if (kind === 'quiz') {
        bd.setAbsurd(absurd);
        T(640, 38, 'CHI CAZZO LO SA?', 38);
        T(640, 180, "Qual e' la lingua ufficiale della Spagna?", 28);
        [0xd94040, 0x3b7de0, 0x22b55e, 0xe2900e].forEach((c, i) => this.add.rectangle(340 + i * 234, 425, 214, 128, c).setStrokeStyle(4, 0xffffff));
      } else if (kind === 'cultura') {
        T(640, 60, 'ROUND 1/8 · BIOLOGIA', 40, '#fbbf24');
        this.add.text(640, 250, '"Quale animale possiede tre cuori?"', { fontFamily: FONT_BODY, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5);
        T(640, 500, 'INVENTATE UNA CAZZATA CREDIBILE', 22, '#c4b5fd');
      } else {
        T(640, 70, 'IL RULLO DECIDE...', 48);
        [-1, 0, 1].forEach((k) => this.add.rectangle(640 + k * 290, 255, 270, 250, 0x151827).setStrokeStyle(3, k === 0 ? 0xfbbf24 : 0x5a6aa8));
        this.time.delayedCall(400, () => bd.tint('volleyball'));
      }
    }
  }
  return new Phaser.Game({ type: Phaser.AUTO, parent, width: 1280, height: 720, backgroundColor: '#000000', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: Preview, banner: false });
}

export function openEnvironmentGallery(): void {
  const wrap = document.createElement('div');
  wrap.id = 'env-gallery';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#11141c;display:flex;flex-direction:column';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'flex:1;width:100%;min-height:0;outline:none';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#0b0e16;font:700 13px Arial;color:#cbd5e1;align-items:center';
  const info = document.createElement('div');
  info.style.cssText = 'position:absolute;right:10px;top:10px;padding:6px 9px;border-radius:6px;background:rgba(0,0,0,.6);color:#a7f3d0;font:12px/1.4 Consolas,monospace;white-space:pre;pointer-events:none';
  const holder2d = document.createElement('div');
  holder2d.style.cssText = 'flex:1;min-height:0;display:none';
  wrap.append(canvas, holder2d, bar, info);
  let game2d: Phaser.Game | null = null;
  const show2d = (kind: BackdropKind, absurd = 0): void => {
    current = `2d-${kind}`;
    scene?.dispose();
    scene = null;
    game2d?.destroy(true);
    canvas.style.display = 'none';
    holder2d.style.display = 'block';
    info.textContent = `${kind.toUpperCase()} · scenografia 2D`;
    game2d = preview2d(holder2d, kind, absurd);
  };
  document.body.appendChild(wrap);
  const swallow = (e: KeyboardEvent): void => {
    e.stopPropagation();
    if ((e.key === 'g' || e.key === 'G') && !e.repeat) setGray(!gray);
  };
  window.addEventListener('keydown', swallow, true);

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  let scene: Scene | null = null;
  let current = 'arena';
  let view: View = 'game';
  let gray = false;
  let grayPP: BlackAndWhitePostProcess | null = null;
  let stats: EnvStats | null = null;
  let lastDraw = 0;

  const entries: Entry[] = [
    {
      id: 'arena',
      label: 'ARENA',
      build: (sc, v) => {
        buildArena(sc);
        addCharacters(sc, ARENA_LIKE_OFFSETS);
        return arenaCam(sc, canvas, v, 6);
      }
    },
    {
      id: 'dodgeball',
      label: 'DODGEBALL',
      build: (sc, v) => {
        buildDodgeballEnvironment(sc);
        addCharacters(sc, ARENA_LIKE_OFFSETS);
        ball(sc, 0, 0.5, 0, '#f2513a');
        ball(sc, -6, 0.5, 2, '#f2513a');
        return arenaCam(sc, canvas, v, 7);
      }
    },
    {
      id: 'soccer',
      label: 'CALCIO',
      build: (sc, v) => {
        buildSoccerEnvironment(sc);
        addCharacters(sc, ARENA_LIKE_OFFSETS, ['red', 'blue', 'red', 'blue']);
        ball(sc, 1, 0.55, 0, '#f4f4f4', 0.55);
        return arenaCam(sc, canvas, v, 8);
      }
    },
    {
      id: 'volleyball',
      label: 'PALLAVOLO',
      build: (sc, v) => {
        buildVolleyballEnvironment(sc);
        addCharacters(sc, [[-5, -4], [4, -5], [-3, 4], [5, 3]], ['red', 'red', 'blue', 'blue']);
        ball(sc, 0, 3.4, -1.5, '#faf2e6');
        return arenaCam(sc, canvas, v, 6);
      }
    },
    ...KART_SECTORS.map((sec, i) => ({
      id: `kart${i + 1}`,
      label: `KART ${i + 1} ${sec.name}`,
      build: (sc: Scene, v: View) => {
        const spline = buildTrack();
        buildKartWorld(sc, spline);
        buildTrackVisuals(sc, spline);
        buildTrackGuides(sc, spline);
        const s = (sec.from + 0.06) * spline.totalLength;
        ['goblin', 'buttafuori', 'judoka'].forEach((cid, k) => {
          const st = createKartState(`g${k}`, cid, CHARACTERS[cid].color, CHARACTERS[cid].avatar);
          st.distance = s + 4 + k * 6;
          st.lateral = (k - 1) * 3;
          const e = new KartEntity(sc, CHARACTERS[cid].color, cid);
          e.updateVisual(st, spline);
        });
        const cam = new UniversalCamera('galleryKartCam', Vector3.Zero(), sc);
        cam.fov = 0.95;
        cam.minZ = 0.3;
        cam.maxZ = 1200;
        if (v === 'overview') {
          const p = spline.positionAt(s + 30);
          cam.position = p.add(new Vector3(60, 70, -60));
          cam.setTarget(p);
        } else {
          const kart = spline.worldPoint(s, 0, 0.1);
          const fwd = spline.tangentAt(s);
          cam.position = kart.subtract(fwd.scale(6.4)).add(new Vector3(0, 2.7, 0));
          cam.setTarget(kart.add(fwd.scale(9)).add(new Vector3(0, 0.8, 0)));
        }
        sc.activeCamera = cam;
        return cam;
      }
    })),
    ...(['yard', 'shop', 'store', 'scaff', 'center'] as const).map((z) => ({
      id: `fps-${z}`,
      label: `FPS ${FPS_ZONE_NAMES[z]}`,
      build: (sc: Scene, v: View) => {
        buildFpsLights(sc);
        buildFpsWorld(sc);
        const spots = { yard: [-20, 20, 0.6], shop: [20, 20, -0.6], store: [20, -20, -2.4], scaff: [-20, -20, 2.4], center: [0, -18, 0] } as const;
        const [x, zz, yaw] = spots[z];
        addCharacters(sc, [[x * 0.4, zz * 0.4], [x * 0.2 + 4, zz * 0.3], [-x * 0.2, zz * 0.1 - 3]]);
        const cam = new UniversalCamera('galleryFpsCam', new Vector3(x, 1.5, zz), sc);
        cam.fov = 0.8;
        cam.minZ = 0.05;
        cam.maxZ = 260;
        if (v === 'overview') {
          cam.position.set(0, 70, -55);
          cam.setTarget(new Vector3(0, 0, 0));
        } else cam.rotation.set(0.02, yaw + Math.PI, 0);
        if (v === 'game') cam.setTarget(new Vector3(0, 2.2, 0).add(new Vector3(Math.sin(yaw) * 2, 0, Math.cos(yaw) * 2)));
        sc.activeCamera = cam;
        return cam;
      }
    }))
  ];

  const setGray = (on: boolean): void => {
    gray = on;
    const cam = scene?.activeCamera;
    if (!cam) return;
    if (on && !grayPP) grayPP = new BlackAndWhitePostProcess('galleryGray', 1, cam);
    if (!on && grayPP) {
      grayPP.dispose(cam);
      grayPP = null;
    }
  };

  const show = (id: string, v: View = view): void => {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    current = id;
    view = v;
    grayPP = null;
    game2d?.destroy(true);
    game2d = null;
    holder2d.style.display = 'none';
    canvas.style.display = 'block';
    engine.resize();
    scene?.dispose();
    const sc = new Scene(engine);
    sc.clearColor = new Color4(0.1, 0.1, 0.14, 1);
    scene = sc;
    e.build(sc, v);
    if (gray) setGray(true);
    const eng = engine as unknown as { _drawCalls?: { fetchNewFrame(): void; current: number } };
    sc.onBeforeRenderObservable.add(() => eng._drawCalls?.fetchNewFrame());
    sc.onAfterRenderObservable.add(() => (lastDraw = eng._drawCalls?.current ?? 0));
    let n = 0;
    sc.onAfterRenderObservable.add(() => {
      if (++n % 3 !== 0) return;
      stats = { ...envStats(sc), drawCalls: lastDraw };
      info.textContent = `${e.label} · ${v === 'game' ? 'VISTA DI GIOCO' : 'PANORAMICA'} · qualità ${getQualityLevel()}${gray ? ' · GRIGI' : ''}\n` +
        `mesh ${stats.meshes} (attive ${stats.activeMeshes}, thin ${stats.thinInstances}) · draw ${stats.drawCalls}\n` +
        `materiali ${stats.materials} · texture ${stats.textures} · luci ${stats.lights} · collidibili ${stats.collidable}`;
    });
    for (const b of bar.querySelectorAll('button')) (b as HTMLButtonElement).style.outline = b.dataset.id === id || b.dataset.view === v ? '2px solid #fbbf24' : 'none';
  };

  const btn = (label: string, onClick: () => void, data: Record<string, string> = {}): void => {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.dataset, data);
    b.style.cssText = 'padding:5px 9px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font:700 12px Arial;cursor:pointer';
    b.onclick = onClick;
    bar.appendChild(b);
  };
  for (const e of entries) btn(e.label, () => show(e.id), { id: e.id });
  for (const k of ['memory', 'reaction', 'quiz', 'cultura', 'roulette'] as BackdropKind[]) btn(`2D ${k.toUpperCase()}`, () => show2d(k), { id: `2d-${k}` });
  btn('QUIZ ASSURDO', () => show2d('quiz', 1));
  btn('VISTA DI GIOCO', () => show(current, 'game'), { view: 'game' });
  btn('PANORAMICA', () => show(current, 'overview'), { view: 'overview' });
  btn('GRIGI (G)', () => setGray(!gray));

  engine.runRenderLoop(() => scene?.render());
  window.addEventListener('resize', () => engine.resize());
  show('arena', 'game');

  (window as unknown as { __envGallery: unknown }).__envGallery = {
    ids: () => [...entries.map((e) => e.id), '2d-memory', '2d-reaction', '2d-quiz', '2d-quiz-absurd', '2d-cultura', '2d-roulette'],
    show: (id: string, v: View = 'game') => {
      if (id === '2d-quiz-absurd') show2d('quiz', 1);
      else if (id.startsWith('2d-')) show2d(id.slice(3) as BackdropKind);
      else show(id, v);
    },
    gray: (on: boolean) => setGray(on),
    scene: () => scene,
    stats: () => (scene ? { ...envStats(scene), drawCalls: lastDraw } : null)
  };
}
