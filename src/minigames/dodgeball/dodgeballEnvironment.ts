import { Color3, Mesh, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { ARENA_HALF_W, ARENA_HALF_D } from './dodgeballTypes';
import { EnvKit, PAL, SIGN_FONT, seeded } from '../env/envKit';
import type { Xf } from '../env/envKit';

/**
 * DODGEBALL DEI COGLIONI — palestra / palazzetto scolastico trasformato in evento sportivo assurdo.
 * Campo e muretti di gioco: stesse misure di prima (solo l'aspetto cambia).
 *  - campo in resina grigio-petrolio: la palla arancione e gli anelli gialli di raccolta staccano su tutto
 *    (niente giallo/arancio sul pavimento, niente punti gialli: prima i punti di spawn sembravano palle)
 *  - PRIMARY: parete di fondo con il TABELLONE "TORNEO DEL DISAGIO", due canestri, finestroni alti
 *  - SECONDARY: tribunetta telescopica con il pubblico, armadietti, panchine, distributore
 *  - TERTIARY: poster ("VIETATO PIANGERE", "PALESTRA APERTA FINO ALLE 6") e bandierine
 * Il cartello DODGEBALL davanti alla camera (copriva il fondo campo) non c'e' piu'.
 */

export interface DodgeballEnvironment {
  update(now: number): void;
  /** colpo a segno / eliminazione: il pubblico salta */
  cheer(amount: number): void;
}

const W = ARENA_HALF_W * 2;
const D = ARENA_HALF_D * 2;
const BACK_Z = ARENA_HALF_D + 10;
const SIDE_X = ARENA_HALF_W + 11;

export function buildDodgeballEnvironment(scene: Scene): DodgeballEnvironment {
  const kit = new EnvKit(scene);
  // al chiuso: il "cielo" e' il buio del soffitto
  kit.sky([[0, '#1c1d26'], [0.6, '#2a2b36'], [1, '#3a3a46']]);
  kit.lightRig({
    key: [-0.25, -1, 0.35],
    keyColor: '#fff6e6',
    keyI: 0.85,
    sky: '#f2f4ff',
    ground: '#6b5a48',
    fillI: 0.72,
    rim: { dir: [0.2, -0.4, -1], color: '#cfe6ff', i: 0.28 }
  });
  kit.glow(0.45);

  // ---- PAVIMENTO DELLA PALESTRA (parquet) + CAMPO (gameplay: stesse misure) ----
  const parquet = kit.texture('gymParquet', 512, 512, (c, s) => {
    c.fillStyle = '#c99a62';
    c.fillRect(0, 0, s, s);
    const r = seeded(31);
    for (let y = 0; y < s; y += 16) {
      let x = -r() * 120;
      while (x < s) {
        const l = 70 + r() * 90;
        const t = 0.9 + r() * 0.2;
        c.fillStyle = `rgb(${Math.round(201 * t)},${Math.round(154 * t)},${Math.round(98 * t)})`;
        c.fillRect(x + 1, y + 1, l - 2, 14);
        x += l;
      }
    }
  }, { wrap: true });
  parquet.uScale = 6;
  parquet.vScale = 5;
  const hall = MeshBuilder.CreateGround('gymFloor', { width: SIDE_X * 2 + 4, height: BACK_Z * 2 + 4 }, scene);
  hall.position.y = -0.02;
  hall.material = kit.mat('#ffffff', { tex: parquet, spec: 0.12, key: 'gymFloorMat' });
  kit.freeze(hall);

  const court = kit.texture('dodgeCourt', 1024, 660, (c, w, h) => {
    // resina SCURA: la palla arancione deve staccare anche in scala di grigi (test G), non solo per colore
    c.fillStyle = '#34494f';
    c.fillRect(0, 0, w, h);
    // meta' campo appena piu' chiara: si legge "di qua / di la'" senza colori squadra
    c.fillStyle = '#3a5057';
    c.fillRect(0, 0, w / 2, h);
    // zona esterna (corridoio vicino al muretto) piu' scura
    c.strokeStyle = '#2b3c42';
    c.lineWidth = 40;
    c.strokeRect(20, 20, w - 40, h - 40);
    // linee bianche
    c.strokeStyle = '#f4f1e8';
    c.lineWidth = 9;
    c.strokeRect(42, 42, w - 84, h - 84);
    c.beginPath();
    c.moveTo(w / 2, 42);
    c.lineTo(w / 2, h - 42);
    c.stroke();
    c.beginPath();
    c.arc(w / 2, h / 2, h * 0.2, 0, Math.PI * 2);
    c.stroke();
    // linee d'attacco tratteggiate
    c.setLineDash([22, 18]);
    c.lineWidth = 6;
    for (const fx of [0.3, 0.7]) {
      c.beginPath();
      c.moveTo(w * fx, 42);
      c.lineTo(w * fx, h - 42);
      c.stroke();
    }
    c.setLineDash([]);
    // stemma tenue al centro (non rumore: sotto il 15% di contrasto)
    c.fillStyle = 'rgba(244,241,232,0.1)';
    c.font = `900 46px ${SIGN_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('TORNEO', w / 2, h / 2 - 26);
    c.fillText('DEL DISAGIO', w / 2, h / 2 + 26);
  });
  const floorMat = new StandardMaterial('floorMat', scene);
  floorMat.diffuseTexture = court;
  floorMat.specularColor = new Color3(0.1, 0.1, 0.1);
  const floor = MeshBuilder.CreateBox('dodgeFloor', { width: W, height: 1.4, depth: D }, scene);
  floor.position.y = -0.7; // top a y=0
  floor.material = floorMat;
  kit.freeze(floor);

  // ---- MURETTI DEL CAMPO (gameplay: stesse misure) con le protezioni imbottite della palestra ----
  const pad = kit.texture('gymPad', 256, 128, (c, w, h) => {
    c.fillStyle = '#3e5a8a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#35507c';
    for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 3, h);
    c.fillStyle = '#f4f1e8';
    c.fillRect(0, 10, w, 6);
  }, { wrap: true });
  const wallMat = kit.mat('#ffffff', { tex: pad, spec: 0.05, key: 'gymPadMat' });
  const trimMat = kit.mat('#e8e2d2', { spec: 0.1 });
  const wallH = 2.2;
  const wallT = 0.5;
  const walls: { x: number; z: number; w: number; d: number }[] = [
    { x: 0, z: -D / 2 - wallT / 2, w: W + wallT * 2, d: wallT },
    { x: 0, z: D / 2 + wallT / 2, w: W + wallT * 2, d: wallT },
    { x: -W / 2 - wallT / 2, z: 0, w: wallT, d: D },
    { x: W / 2 + wallT / 2, z: 0, w: wallT, d: D }
  ];
  const wallMeshes: Mesh[] = [];
  const trims: Mesh[] = [];
  for (const w of walls) {
    wallMeshes.push(kit.box('wall', w.w, wallH, w.d, { x: w.x, y: wallH / 2, z: w.z }, wallMat));
    trims.push(kit.box('wallTrim', w.w + 0.04, 0.14, w.d + 0.04, { x: w.x, y: wallH + 0.05, z: w.z }, trimMat));
  }
  kit.merge('courtWalls', wallMeshes, wallMat);
  kit.merge('courtTrim', trims, trimMat);

  // ---- PARETE DI FONDO (PRIMARY): mattoni chiari, finestroni, tabellone, canestri ----
  const brick = kit.texture('gymBrick', 512, 512, (c, s) => {
    c.fillStyle = '#d9d2c4';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#c9c1b1';
    for (let y = 0; y < s; y += 32) {
      const off = (y / 32) % 2 === 0 ? 0 : 32;
      for (let x = -off; x < s; x += 64) c.fillRect(x + 2, y + 2, 60, 28);
    }
    // zoccolo verniciato
    c.fillStyle = '#5b7f8c';
    c.fillRect(0, s * 0.82, s, s * 0.18);
  }, { wrap: true });
  brick.uScale = 7;
  const backWall = MeshBuilder.CreatePlane('gymBackWall', { width: SIDE_X * 2 + 4, height: 18 }, scene);
  backWall.position.set(0, 9 - 0.02, BACK_Z);
  backWall.material = kit.mat('#ffffff', { tex: brick, emissive: 0.15, key: 'gymBrickMat' });
  kit.freeze(backWall);
  for (const sx of [-1, 1]) {
    const side = MeshBuilder.CreatePlane('gymSideWall', { width: BACK_Z * 2 + 4, height: 18 }, scene);
    side.position.set(sx * SIDE_X, 9, 0);
    side.rotation.y = sx * Math.PI / 2;
    side.material = backWall.material;
    kit.freeze(side);
  }
  // finestroni alti (una mesh)
  const winMat = kit.mat('#cfe6f5', { unlit: true, key: 'gymWindows' });
  const wins: Mesh[] = [];
  for (let i = -4; i <= 4; i++) wins.push(kit.box('gymWin', 4.2, 2.6, 0.1, { x: i * 6, y: 13.2, z: BACK_Z - 0.06 }, winMat));
  kit.merge('gymWindows', wins, winMat);
  // tabellone
  const board = kit.texture('gymScoreboard', 512, 256, (c, w, h) => {
    c.fillStyle = '#121418';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f4f1e8';
    c.lineWidth = 6;
    c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = PAL.neonAmber;
    c.font = `900 40px ${SIGN_FONT}`;
    c.textAlign = 'center';
    c.fillText('TORNEO DEL DISAGIO', w / 2, 58);
    c.fillStyle = '#ff6b4a';
    c.font = `900 88px ${SIGN_FONT}`;
    c.fillText('88 : 00', w / 2, 158);
    c.fillStyle = '#9ad7ff';
    c.font = `900 28px ${SIGN_FONT}`;
    c.fillText('CASA        PERIODO 4        OSPITI', w / 2, 220);
  });
  const sb = MeshBuilder.CreatePlane('gymScoreboard', { width: 9, height: 4.5 }, scene);
  sb.position.set(0, 8.8, BACK_Z - 0.3);
  sb.material = kit.mat('#ffffff', { unlit: true, tex: board, key: 'gymScoreboardMat' });
  kit.freeze(sb);
  kit.freeze(kit.box('gymScoreboardFrame', 9.6, 5.1, 0.3, { x: 0, y: 8.8, z: BACK_Z - 0.02 }, kit.mat(PAL.metalDark)));
  // canestri (tabellone + ferro arancio + retina)
  const glass = kit.mat('#f4f1e8', { spec: 0.2 });
  const rimMat = kit.mat('#e0703a', { emissive: 0.3 });
  const hoopParts: Mesh[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * 13;
    hoopParts.push(kit.box('hoopBoard', 3.2, 2, 0.12, { x, y: 7.4, z: BACK_Z - 1.4 }, glass));
    hoopParts.push(kit.box('hoopArm', 0.2, 0.2, 1.3, { x, y: 7.4, z: BACK_Z - 0.7 }, glass));
  }
  kit.merge('hoopBoards', hoopParts, glass);
  const rims: Mesh[] = [];
  for (const sx of [-1, 1]) {
    const t = MeshBuilder.CreateTorus('hoopRim', { diameter: 1, thickness: 0.07, tessellation: 18 }, scene);
    t.position.set(sx * 13, 6.6, BACK_Z - 2);
    rims.push(t);
  }
  kit.merge('hoopRims', rims, rimMat);
  const net = kit.mat('#f4f1e8', { alpha: 0.6, key: 'hoopNet' });
  const nets: Mesh[] = [];
  for (const sx of [-1, 1]) nets.push(kit.cyl('hoopNet', 0.95, 0.55, 0.8, { x: sx * 13, y: 6.2, z: BACK_Z - 2 }, net, 10));
  kit.merge('hoopNets', nets, net);

  // ---- TRIBUNETTA telescopica (SECONDARY) con il pubblico ----
  const benchWood = kit.mat('#b8875a', { spec: 0.05 });
  const benchMetal = kit.mat(PAL.metalDark);
  const rows: Mesh[] = [];
  const legs: Mesh[] = [];
  const seats: { x: number; y: number; z: number }[] = [];
  for (let r = 0; r < 5; r++) {
    const z = ARENA_HALF_D + 3 + r * 1.3;
    const y = 0.45 + r * 0.75;
    rows.push(kit.box('bleacher', 34, 0.18, 0.7, { x: 0, y, z }, benchWood));
    legs.push(kit.box('bleacherRiser', 34, y, 0.1, { x: 0, y: y / 2, z: z + 0.4 }, benchMetal));
    for (let i = 0; i < 26; i++) seats.push({ x: -16 + (i + 0.5) * (32 / 26), y: y + 0.1, z: z + 0.15 });
  }
  kit.merge('bleachers', rows, benchWood);
  kit.merge('bleacherRisers', legs, benchMetal);
  const crowd = kit.crowd(seats, { face: [0, -6], scale: 0.95, seed: 41 });

  // ---- LATI: armadietti, panchine, distributore (SECONDARY) ----
  const lockerTex = kit.texture('gymLocker', 128, 256, (c, w, h) => {
    c.fillStyle = '#6f8f96';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#4f6a70';
    c.lineWidth = 6;
    c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#4f6a70';
    for (let y = 20; y < 60; y += 10) c.fillRect(30, y, 68, 4);
    c.fillRect(96, 120, 10, 26);
  });
  const locker = MeshBuilder.CreateBox('lockers', { width: 0.9, height: 2.4, depth: 0.6 }, scene);
  locker.material = kit.mat('#ffffff', { tex: lockerTex, key: 'gymLockerMat' });
  const lockerSpots: Xf[] = [];
  for (let i = 0; i < 14; i++) lockerSpots.push({ x: -SIDE_X + 0.4, y: 1.2, z: -2 + i * 0.92, ry: Math.PI / 2 });
  kit.thin(locker, lockerSpots);
  kit.freeze(locker);
  const benches: Mesh[] = [];
  for (const z of [-4, 3]) benches.push(kit.box('bench', 0.5, 0.12, 4.5, { x: SIDE_X - 3, y: 0.5, z }, benchWood));
  kit.merge('benches', benches, benchWood);
  // distributore automatico (luce fredda)
  const vend = kit.texture('gymVending', 128, 256, (c, w, h) => {
    c.fillStyle = '#3a3f4f';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#bfe6ff';
    c.fillRect(10, 20, 76, 170);
    const cols = ['#e05a4a', '#f0c040', '#5ab0e0', '#70c070'];
    for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) {
      c.fillStyle = cols[(r + k) % 4];
      c.fillRect(16 + k * 18, 28 + r * 27, 12, 18);
    }
    c.fillStyle = '#9aa3b2';
    c.fillRect(92, 60, 26, 60);
    c.fillStyle = '#f4f1e8';
    c.font = `900 18px ${SIGN_FONT}`;
    c.fillText('SNACK', 18, 228);
  });
  const vm = kit.box('vending', 1.4, 2.6, 1, { x: SIDE_X - 1.2, y: 1.3, z: 8, ry: -Math.PI / 2 }, kit.mat('#ffffff', { tex: vend, emissive: 0.5, key: 'gymVendingMat' }));
  kit.freeze(vm);

  // ---- POSTER e STRISCIONI (TERTIARY): pochi, sulle pareti, mai sul campo ----
  kit.sign('VIETATO\nPIANGERE', { style: 'poster', color: '#b03a3a', w: 3, h: 3.6, x: -SIDE_X + 0.05, y: 4.6, z: 6, ry: -Math.PI / 2 });
  kit.sign('PALESTRA APERTA\nFINO ALLE 6', { style: 'board', color: '#2a3550', w: 5, h: 2.2, x: SIDE_X - 0.05, y: 4.4, z: -3, ry: Math.PI / 2 });
  kit.sign('DODGEBALL DEI COGLIONI', { style: 'neon', color: PAL.neonPink, w: 11, h: 1.5, x: 0, y: 11.2, z: BACK_Z - 0.1 });
  // bandierine appese tra le travi (una mesh)
  const flagCols = ['#e6dccb', '#7aa3b8', '#c9a46b', '#a6a0c8'];
  const flag = MeshBuilder.CreateCylinder('gymFlags', { diameterTop: 0, diameterBottom: 0.7, height: 0.8, tessellation: 3 }, scene);
  flag.material = kit.mat('#ffffff', { spec: 0, key: 'gymFlagMat' });
  const flagSpots: Xf[] = [];
  for (let i = 0; i < 30; i++) {
    const x = -SIDE_X + 2 + (i / 29) * (SIDE_X * 2 - 4);
    flagSpots.push({ x, y: 12.2 - Math.sin((i / 29) * Math.PI) * 1.4, z: ARENA_HALF_D + 6, rx: Math.PI, ry: Math.PI / 2 });
  }
  kit.thin(flag, flagSpots, flagCols);
  kit.freeze(flag);
  // travi del soffitto con le plafoniere
  const beam = kit.mat(PAL.metal);
  const beams: Mesh[] = [];
  for (const z of [-6, 2, 10, 18]) beams.push(kit.box('beam', SIDE_X * 2, 0.5, 0.4, { x: 0, y: 15.5, z }, beam));
  kit.merge('gymBeams', beams, beam);
  const lamps: Mesh[] = [];
  const lampMat = kit.neon('#fff8e8');
  for (const z of [-6, 2, 10, 18]) for (let i = -3; i <= 3; i++) lamps.push(kit.box('gymLamp', 2.2, 0.15, 0.6, { x: i * 6, y: 15.15, z }, lampMat));
  kit.merge('gymLamps', lamps, lampMat);

  return {
    update(): void {
      /* la folla si anima da sola (kit.onFrame) */
    },
    cheer(amount: number): void {
      crowd.cheer(amount);
    }
  };
}

