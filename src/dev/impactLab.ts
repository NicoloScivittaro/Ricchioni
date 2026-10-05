import { Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight, Vector3, Color3, Color4, MeshBuilder, StandardMaterial, DynamicTexture, Mesh } from '@babylonjs/core';
import { ArenaEntity } from '../minigames/arena/arenaEntity';
import type { VisualSubject } from '../minigames/arena/arenaEntity';
import { ShockRings, makeBallTrail } from '../minigames/arena/impactFx';
import { KartEntity } from '../minigames/kart-race/kartEntity';
import type { KartState } from '../minigames/kart-race/raceTypes';
import type { TrackSpline } from '../minigames/kart-race/track';
import { BabylonFpsGame } from '../minigames/fps/BabylonFpsGame';
import type { FpsRenderSnapshot } from '../minigames/fps/BabylonFpsGame';
import { CHARACTER_PRESENTATION } from '../../shared/characterPresentation';
import { WEAPONS as FPS_WEAPONS } from '../../shared/fpsWeapons';
import { audio } from '../core/AudioManager';
import { IMPACT } from '../core/impact';

/**
 * IMPACT LAB — SOLO SVILUPPO (`npm run dev`) o `?debug=1`, aperto con `?impact=1`. Non esiste nella UX normale.
 * Prova a ripetizione il feedback delle azioni (non il gameplay: niente regole, niente punteggi) per confrontarle e
 * controllarne la sincronia, anche al rallentatore (1x / 0.5x / 0.25x):
 *   Arena spinta · Dodgeball colpo · Calcio tiro caricato / tackle · Pallavolo smash · Kart boost / urto · FPS sparo/colpo/kill
 * `window.__lab` = { run(nome), setSpeed(x), time(), impactAt(), ready } per i test che fotografano anticipo/impatto/recupero.
 */
type Scn = 'arena' | 'dodgeball' | 'soccerShot' | 'soccerTackle' | 'volley' | 'kartBoost' | 'kartCrash' | 'fps';
const SCENARIOS: { id: Scn; label: string }[] = [
  { id: 'arena', label: 'ARENA SPINTA' },
  { id: 'dodgeball', label: 'DODGEBALL COLPO' },
  { id: 'soccerShot', label: 'CALCIO TIRO' },
  { id: 'soccerTackle', label: 'CALCIO TACKLE' },
  { id: 'volley', label: 'PALLAVOLO SMASH' },
  { id: 'kartBoost', label: 'KART BOOST' },
  { id: 'kartCrash', label: 'KART URTO' },
  { id: 'fps', label: 'FPS' }
];

const mkSubject = (x: number, z: number, facing: number): VisualSubject => ({ x, y: 0, z, vx: 0, vz: 0, facing, alive: true, falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 });

export function openImpactLab(): void {
  const wrap = document.createElement('div');
  wrap.id = 'impact-lab';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#1b1f2a;display:flex;flex-direction:column';
  const stage = document.createElement('div');
  stage.style.cssText = 'flex:1;min-height:0;position:relative';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;outline:none';
  const fpsCanvas = document.createElement('canvas');
  fpsCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;outline:none;display:none';
  stage.append(canvas, fpsCanvas);
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#0f1320;font:700 13px Arial;color:#cbd5e1;align-items:center';
  wrap.append(stage, bar);
  document.body.appendChild(wrap);
  const swallow = (e: KeyboardEvent): void => e.stopPropagation();
  window.addEventListener('keydown', swallow, true);
  audio.unlock();

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.42, 0.46, 0.54, 1);
  const cam = new ArcRotateCamera('labCam', -Math.PI / 2 + 0.35, 1.15, 13, new Vector3(0, 1.2, 0), scene);
  cam.attachControl(canvas, true);
  const camBase = cam.target.clone();
  new HemisphericLight('hemi', new Vector3(0.15, 1, 0.1), scene).intensity = 0.75;
  new DirectionalLight('sun', new Vector3(-0.4, -1, 0.5), scene).intensity = 0.75;
  const ground = MeshBuilder.CreateGround('labGround', { width: 60, height: 30 }, scene);
  const gm = new StandardMaterial('labGroundMat', scene);
  gm.diffuseColor = new Color3(0.5, 0.56, 0.5);
  gm.specularColor = new Color3(0, 0, 0);
  ground.material = gm;
  const dot = new DynamicTexture('labDot', 16, scene, false);
  const dc = dot.getContext() as unknown as CanvasRenderingContext2D;
  dc.fillStyle = 'white';
  dc.beginPath();
  dc.arc(8, 8, 7, 0, Math.PI * 2);
  dc.fill();
  dot.update();
  const shocks = new ShockRings(scene, 4);
  const ballMat = new StandardMaterial('labBallMat', scene);
  ballMat.diffuseColor = new Color3(0.95, 0.92, 0.85);
  const ball = MeshBuilder.CreateSphere('labBall', { diameter: 0.6, segments: 12 }, scene);
  ball.material = ballMat;
  ball.isVisible = false;
  const trail = makeBallTrail(scene, ball, dot);
  const flashMat = new StandardMaterial('labFlashMat', scene);
  flashMat.emissiveColor = new Color3(1, 1, 0.92);
  flashMat.disableLighting = true;
  const flash = MeshBuilder.CreateSphere('labFlash', { diameter: 1, segments: 10 }, scene);
  flash.material = flashMat;
  flash.isVisible = false;

  // due attori: A (chi agisce) e B (chi subisce). Personaggi scelti dai menu.
  let charA = 'buttafuori';
  let charB = 'goblin';
  let a: ArenaEntity | null = null;
  let b: ArenaEntity | null = null;
  const sa = mkSubject(-3, 0, Math.PI / 2);
  const sb = mkSubject(3, 0, -Math.PI / 2);
  const buildActors = (): void => {
    a?.dispose();
    b?.dispose();
    a = new ArenaEntity(scene, dot, CHARACTER_PRESENTATION[charA].accent, charA, CHARACTER_PRESENTATION[charA].icon, 'A');
    b = new ArenaEntity(scene, dot, CHARACTER_PRESENTATION[charB].accent, charB, CHARACTER_PRESENTATION[charB].icon, 'B');
  };
  buildActors();

  // kart su un tracciato finto dritto (solo per la grafica: KartEntity legge distanza/laterale/heading e poco altro)
  const straight = {
    worldPoint: (d: number, l: number, h = 0) => new Vector3(l + 14, h, d),
    tangentAt: () => new Vector3(0, 0, 1),
    rightAt: () => new Vector3(1, 0, 0)
  } as unknown as TrackSpline;
  let kart: KartEntity | null = null;
  const ks = { distance: 0, lateral: 0, heading: 0, speed: 0, drifting: false, driftDir: 0, stunTimer: 0, steerVisual: 0, wheelSpin: 0, driftCharge: 0, boostTimer: 0, offRoad: false } as unknown as KartState & Record<string, number | boolean>;

  // ---- FPS: lo split-screen VERO (BabylonFpsGame) con una finestra sola e un bersaglio davanti
  let fps: BabylonFpsGame | null = null;
  let fpsWeapon = 'mitraglia';
  const fpsA: FpsRenderSnapshot = { id: 'A', name: 'A', displayName: 'A', color: CHARACTER_PRESENTATION[charA].accent, characterId: charA, x: -20, z: -20, yaw: Math.PI / 4, pitch: 0, hp: 100, maxHp: 100, alive: true, kills: 0, weaponId: 'mitraglia', magazine: 30, reloading: false };
  const fpsB: FpsRenderSnapshot = { id: 'B', name: 'B', displayName: 'B', color: CHARACTER_PRESENTATION[charB].accent, characterId: charB, x: -15.5, z: -15.5, yaw: Math.PI * 1.25, pitch: 0, hp: 100, maxHp: 100, alive: true, kills: 0, weaponId: 'mitraglia', magazine: 30, reloading: false };

  let scn: Scn = 'arena';
  let speed = 1;
  let clock = 0; // tempo del lab (rallentato)
  let t = 0; // tempo dall'inizio dello scenario
  let impactAt = -1;
  let shake = 0;
  const events: { at: number; fn: () => void }[] = [];
  const at = (s: number, fn: () => void): void => {
    events.push({ at: s, fn });
  };

  const reset = (): void => {
    events.length = 0;
    t = 0;
    impactAt = -1;
    Object.assign(sa, mkSubject(-3, 0, Math.PI / 2));
    Object.assign(sb, mkSubject(3, 0, -Math.PI / 2));
    a?.setCharge(0);
    a?.celebrate(0);
    b?.celebrate(0);
    ball.isVisible = false;
    trail.emitRate = 0;
  };

  const run = (s: Scn): void => {
    scn = s;
    reset();
    const isFps = s === 'fps';
    canvas.style.display = isFps ? 'none' : 'block';
    fpsCanvas.style.display = isFps ? 'block' : 'none';
    if (isFps) {
      if (!fps) fps = new BabylonFpsGame(fpsCanvas, [{ id: 'A', name: 'A', color: fpsA.color, characterId: charA }]);
      fpsA.weaponId = fpsWeapon;
      fpsB.alive = true;
      fpsB.hp = 100;
      const w = FPS_WEAPONS.find((x) => x.id === fpsWeapon);
      const fire = (when: number, kill: boolean): void => {
        at(when, () => {
          const segs = [];
          for (let i = 0; i < (w?.pellets ?? 1); i++) segs.push({ ox: fpsA.x, oy: 1.5, oz: fpsA.z, ex: fpsB.x + (Math.random() - 0.5) * (w?.pellets ? 0.8 : 0.1), ey: 1.3, ez: fpsB.z });
          fps?.notifyShot('A', fpsWeapon, segs);
          if (w && w.splashRadius > 0) {
            const dur = 8 / (w.projectileSpeed || 20);
            fps?.onSignal(null, { type: 'proj', ox: fpsA.x, oy: 1.25, oz: fpsA.z, tx: fpsB.x, ty: 1, tz: fpsB.z, dur });
            at(when + dur, () => {
              fps?.onSignal(null, { type: 'boom', x: fpsB.x, y: 1, z: fpsB.z, r: w.splashRadius });
              hitB(kill);
            });
          } else hitB(kill);
        });
      };
      const hitB = (kill: boolean): void => {
        impactAt = t;
        fps?.onSignal('A', { type: 'hit', dmg: 30, kill });
        fps?.onSignal('B', { type: 'damaged', amount: 30, from: 'A' });
        fpsB.hp = kill ? 0 : Math.max(10, fpsB.hp - 30);
        if (kill) fpsB.alive = false;
      };
      fire(0.25, false);
      fire(0.9, false);
      fire(1.6, true);
      at(3.4, () => {
        fpsB.alive = true;
        fpsB.hp = 100;
      });
      return;
    }
    switch (s) {
      case 'arena': {
        // A scatta contro B: anticipo (compressione) -> contatto (onda, hitstop visivo, B sbalzato) -> recupero
        cam.target.set(0, 1.2, 0);
        at(0.2, () => {
          sa.dashing = true;
          sa.vx = 14;
        });
        at(0.52, () => {
          impactAt = t;
          sa.dashing = false;
          sa.vx = 0;
          sb.vx = 9;
          sb.stunTime = 0.5;
          sb.hitFlash = 0.16;
          b?.playHitFrom(1, 0, 0.9);
          a?.playRecoil();
          shocks.spawn(sb.x - 0.6, sb.z, CHARACTER_PRESENTATION[charB].accent, 1.1);
          audio.thump(1.1);
          shake = IMPACT.MEDIUM.shake.amp;
        });
        break;
      }
      case 'dodgeball': {
        cam.target.set(0, 1.2, 0);
        at(0.3, () => {
          a?.playThrow();
          ball.isVisible = true;
          ball.position.set(sa.x + 0.6, 1.3, sa.z);
          trail.emitRate = 80;
          audio.throwWhoosh(1.2);
        });
        at(0.62, () => {
          impactAt = t;
          ball.isVisible = false;
          trail.emitRate = 0;
          sb.vx = 6;
          sb.stunTime = 0.35;
          sb.hitFlash = 0.16;
          b?.playHitFrom(1, 0, 0.7);
          shocks.spawn(sb.x, sb.z, CHARACTER_PRESENTATION[charB].accent, 0.9);
          audio.thump(0.8);
          shake = IMPACT.MEDIUM.shake.amp;
        });
        break;
      }
      case 'soccerShot': {
        // carica 0.8 s (wind-up visibile) -> contatto nello STESSO istante in cui parte la palla -> follow-through
        cam.target.set(0, 1.2, 0);
        ball.isVisible = true;
        ball.position.set(sa.x + 0.9, 0.3, sa.z);
        at(0.9, () => {
          impactAt = t;
          a?.playKick(1);
          trail.emitRate = 120;
          audio.kick(1.5);
          shake = IMPACT.LIGHT.shake.amp + 0.06;
        });
        break;
      }
      case 'soccerTackle': {
        cam.target.set(0, 1.2, 0);
        at(0.2, () => {
          sa.dashing = true;
          sa.vx = 12;
        });
        at(0.55, () => {
          impactAt = t;
          sa.dashing = false;
          sa.vx = 0;
          a?.playKick(0.6);
          sb.vx = 6;
          sb.stunTime = 0.3;
          sb.hitFlash = 0.14;
          b?.playHitFrom(1, 0, 0.7);
          shocks.spawn(sb.x, sb.z, '#ef4444', 0.8);
          audio.thump(0.7);
        });
        break;
      }
      case 'volley': {
        // salto (stretch, braccio caricato) -> smash all'apice (lampo + scia + scossa) -> atterraggio (compressione)
        cam.target.set(0, 2, 0);
        at(0.2, () => {
          sa.vx = 0.01;
        });
        at(0.62, () => {
          impactAt = t;
          a?.playSpike();
          ball.isVisible = true;
          ball.position.set(sa.x + 0.5, sa.y + 2.3, sa.z);
          flash.position.copyFrom(ball.position);
          flash.isVisible = true;
          trail.emitRate = 160;
          shocks.spawn(sa.x, sa.z, '#ef4444', 0.9);
          audio.hit();
          shake = IMPACT.HEAVY.shake.amp;
        });
        break;
      }
      case 'kartBoost':
      case 'kartCrash': {
        cam.target.set(14, 1, 4);
        if (!kart) kart = new KartEntity(scene, CHARACTER_PRESENTATION[charA].accent, charA);
        ks.distance = 0;
        ks.speed = 14;
        ks.boostTimer = 0;
        ks.stunTimer = 0;
        ks.drifting = s === 'kartBoost';
        ks.driftDir = 1;
        ks.driftCharge = 0;
        if (s === 'kartBoost') {
          at(0.9, () => {
            impactAt = t;
            ks.drifting = false;
            ks.boostTimer = 1.2;
            kart?.burstBoost();
            kart?.playBoost();
            audio.kartBoost(20);
          });
        } else {
          at(0.6, () => {
            impactAt = t;
            ks.stunTimer = 0.5;
            ks.speed = 4;
            audio.thump(1);
            shake = IMPACT.MEDIUM.shake.amp;
          });
        }
        break;
      }
    }
  };

  const btn = (label: string, on: boolean, fn: () => void): HTMLButtonElement => {
    const el = document.createElement('button');
    el.textContent = label;
    el.style.cssText = `font:800 12px Arial;padding:6px 9px;border-radius:8px;border:0;cursor:pointer;background:${on ? '#fbbf24' : '#1e293b'};color:${on ? '#111' : '#e5e7eb'}`;
    el.onclick = fn;
    return el;
  };
  const sel = (opts: string[], val: string, fn: (v: string) => void): HTMLSelectElement => {
    const el = document.createElement('select');
    el.style.cssText = 'font:700 12px Arial;padding:4px;border-radius:6px';
    for (const o of opts) el.add(new Option(o, o, o === val, o === val));
    el.onchange = () => fn(el.value);
    return el;
  };
  const render = (): void => {
    bar.innerHTML = '<b style="margin-right:6px">💥 IMPACT LAB</b>';
    for (const s of SCENARIOS) bar.append(btn(s.label, scn === s.id, () => { run(s.id); render(); }));
    bar.append(sel(FPS_WEAPONS.map((w) => w.id), fpsWeapon, (v) => { fpsWeapon = v; if (scn === 'fps') run('fps'); }));
    const ids = Object.keys(CHARACTER_PRESENTATION);
    bar.append(sel(ids, charA, (v) => { charA = v; buildActors(); kart?.dispose(); kart = null; run(scn); }));
    bar.append(sel(ids, charB, (v) => { charB = v; buildActors(); run(scn); }));
    for (const sp of [1, 0.5, 0.25]) bar.append(btn(`${sp}x`, speed === sp, () => { speed = sp; render(); }));
    bar.append(btn('↻ RIPETI', false, () => run(scn)));
    const close = btn('✕ CHIUDI', false, () => {
      window.removeEventListener('keydown', swallow, true);
      fps?.dispose();
      engine.dispose();
      wrap.remove();
    });
    close.style.marginLeft = 'auto';
    bar.append(close);
  };

  run('arena');
  render();
  let last = performance.now();
  const tick = (): void => {
    if (!wrap.isConnected) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000) * speed;
    last = now;
    clock += dt;
    t += dt;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].at <= t) {
        const ev = events.splice(i, 1)[0];
        ev.fn();
      }
    }
    if (scn === 'fps' && fps) {
      fps.update(dt, [fpsA, fpsB]);
    } else {
      // "fisica" finta del lab: solo per far vedere le pose (attriti, salto del volley)
      for (const s of [sa, sb]) {
        s.x += s.vx * dt;
        s.vx *= Math.max(0, 1 - dt * 3);
        s.stunTime = Math.max(0, s.stunTime - dt);
        s.hitFlash = Math.max(0, s.hitFlash - dt);
      }
      if (scn === 'soccerShot' && t < 0.9) a?.setCharge(Math.min(1, t / 0.8));
      if (scn === 'volley') sa.y = t > 0.2 && t < 1.05 ? Math.max(0, Math.sin(((t - 0.2) / 0.85) * Math.PI) * 1.4) : 0;
      if (ball.isVisible && (scn === 'dodgeball' || scn === 'soccerShot')) ball.position.x += dt * 22;
      if (ball.isVisible && scn === 'volley') {
        ball.position.x += dt * 10;
        ball.position.y = Math.max(0.3, ball.position.y - dt * 9);
      }
      if (flash.isVisible) {
        flash.scaling.scaleInPlace(1 + dt * 10);
        flash.visibility -= dt * 12;
        if (flash.visibility <= 0) {
          flash.isVisible = false;
          flash.visibility = 1;
          flash.scaling.setAll(1);
        }
      }
      a?.updateVisual(sa, dt, clock * 1000);
      b?.updateVisual(sb, dt, clock * 1000);
      shocks.update(dt);
      if (kart && (scn === 'kartBoost' || scn === 'kartCrash')) {
        ks.distance += ks.speed * dt;
        ks.wheelSpin += ks.speed * dt * 2;
        ks.steerVisual = scn === 'kartBoost' && ks.drifting ? 0.8 : 0;
        if (ks.drifting) ks.driftCharge = Math.min(2.2, ks.driftCharge + dt * 2.6);
        ks.boostTimer = Math.max(0, ks.boostTimer - dt);
        ks.stunTimer = Math.max(0, ks.stunTimer - dt);
        if (ks.distance > 26) ks.distance = 0;
        kart.updateVisual(ks, straight, 1);
        cam.target.set(14, 1, ks.distance);
      }
      shake = Math.max(0, shake - dt * 1.6);
      if (scn !== 'kartBoost' && scn !== 'kartCrash') cam.target.set(camBase.x + (Math.random() - 0.5) * shake, camBase.y + (Math.random() - 0.5) * shake, camBase.z);
      scene.render();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.addEventListener('resize', () => engine.resize());
  void Mesh;

  (window as unknown as Record<string, unknown>).__lab = {
    ready: true,
    run: (s: Scn) => run(s),
    setSpeed: (x: number) => {
      speed = x;
    },
    setWeapon: (w: string) => {
      fpsWeapon = w;
    },
    setChars: (ca: string, cb: string) => {
      charA = ca;
      charB = cb;
      buildActors();
      kart?.dispose();
      kart = null;
    },
    time: () => t,
    impactAt: () => impactAt
  };
}
