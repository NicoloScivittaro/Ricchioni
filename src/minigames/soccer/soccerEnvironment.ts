import { Color3, Mesh, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { FIELD_HALF_W, FIELD_HALF_D, GOAL_HALF_W, GOAL_DEPTH, TEAM_COLOR } from './soccerTypes';
import { EnvKit, PAL, SIGN_FONT, seeded } from '../env/envKit';
import type { Xf } from '../env/envKit';

/**
 * CALCIO DEI DISAGIATI — campetto di periferia, calcetto serale (non uno stadio).
 * Campo, porte e sponde: stesse misure di prima. Cambia l'aspetto:
 *  - sintetico a strisce, linee bianche nette, porte BIANCHE con la fascia del colore della squadra che segna li'
 *    (come prima) e la scritta GOL ROSSI / GOL BLU sul telo di fondo: si legge anche senza distinguere rosso/blu
 *  - rete della porta ben visibile (maglia disegnata, non un vetro trasparente) che si gonfia al GOL
 *  - PRIMARY: 4 torri faro agli angoli, palazzine con le finestre accese sullo sfondo
 *  - SECONDARY: rete alta di recinzione, muretto, panchina, chiosco BAR SPORT, motorini parcheggiati
 *  - TERTIARY: cartelloni locali e un paio di gag
 * Pubblico: pochi amici dietro la rete, non 60.000 persone.
 */

export interface SoccerEnvironment {
  update(now: number): void;
  /** GOL: la rete di quella porta si gonfia, gli amici dietro la recinzione saltano */
  goal(side: 1 | -1): void;
}

const W = FIELD_HALF_W * 2;
const D = FIELD_HALF_D * 2;
const FENCE_X = FIELD_HALF_W + 5;
const FENCE_Z = FIELD_HALF_D + 4;

export function buildSoccerEnvironment(scene: Scene): SoccerEnvironment {
  const kit = new EnvKit(scene);
  // sera: blu profondo in alto, ultima luce arancio all'orizzonte (dietro le palazzine)
  kit.sky([[0, '#0b1230'], [0.55, '#1f2d5c'], [0.82, '#4a4a7a'], [1, '#d98a5a']]);
  kit.clouds({ count: 9, radius: 300, yMin: 30, yMax: 80, tint: '#7a6f9a', size: 55, seed: 12, arc: [Math.PI / 2 - 1.2, Math.PI / 2 + 1.2] });
  kit.skyline({ radius: 210, height: 34, y: -2, color: '#232a4a', kind: 'city', seed: 5, arc: [Math.PI * 0.05, Math.PI * 0.95] });
  scene.fogMode = 3; // LINEAR
  scene.fogColor = Color3.FromHexString('#2a2f52');
  scene.fogStart = 90;
  scene.fogEnd = 260;
  // luce dei fari: bianca dall'alto, fill blu della sera abbastanza forte da leggere i personaggi
  kit.lightRig({
    key: [-0.2, -1, 0.3],
    keyColor: '#fffaf0',
    keyI: 0.9,
    sky: '#c9d4ff',
    ground: '#2f4a3a',
    fillI: 0.62,
    rim: { dir: [0.3, -0.5, -1], color: '#ffd2a0', i: 0.3 }
  });
  kit.glow(0.5);

  // ---- terreno fuori campo (asfalto/cemento del centro sportivo) ----
  const outer = MeshBuilder.CreateGround('soccerOuter', { width: 140, height: 120 }, scene);
  outer.position.y = -0.03;
  outer.material = kit.mat('#4a4d52', { spec: 0.02, key: 'soccerOuterMat' });
  kit.freeze(outer);
  const apron = MeshBuilder.CreateGround('soccerApron', { width: FENCE_X * 2, height: FENCE_Z * 2 }, scene);
  apron.position.y = -0.015;
  apron.material = kit.mat('#2f7a4a', { spec: 0.02, key: 'soccerApronMat' });
  kit.freeze(apron);

  // ---- CAMPO (gameplay: stesse misure) ----
  const floorTex = kit.texture('soccerTurf', 1024, 640, (c, w, h) => {
    for (let i = 0; i < 10; i++) {
      c.fillStyle = i % 2 === 0 ? '#3a9a55' : '#348c4d';
      c.fillRect((w / 10) * i, 0, w / 10, h);
    }
    // fibre del sintetico (rumore leggerissimo)
    const r = seeded(17);
    c.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 1400; i++) c.fillRect(r() * w, r() * h, 2, 1);
    c.strokeStyle = '#f7f5ee';
    c.lineWidth = 8;
    const m = 14;
    c.strokeRect(m, m, w - m * 2, h - m * 2);
    c.beginPath();
    c.moveTo(w / 2, m);
    c.lineTo(w / 2, h - m);
    c.stroke();
    c.beginPath();
    c.arc(w / 2, h / 2, h * 0.16, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#f7f5ee';
    c.beginPath();
    c.arc(w / 2, h / 2, 7, 0, Math.PI * 2);
    c.fill();
    // aree di rigore (lati corti) + dischetto
    for (const left of [true, false]) {
      const x0 = left ? m : w - m - w * 0.16;
      c.strokeRect(x0, h * 0.24, w * 0.16, h * 0.52);
      c.beginPath();
      c.arc(left ? m + w * 0.11 : w - m - w * 0.11, h / 2, 6, 0, Math.PI * 2);
      c.fill();
    }
  });
  const floorMat = new StandardMaterial('floorMat', scene);
  floorMat.diffuseTexture = floorTex;
  floorMat.specularColor = new Color3(0.04, 0.04, 0.04);
  const floor = MeshBuilder.CreateBox('soccerFloor', { width: W, height: 1.2, depth: D }, scene);
  floor.position.y = -0.6;
  floor.material = floorMat;
  kit.freeze(floor);

  // ---- PORTE: bianche, fascia squadra, rete a maglia che si gonfia al gol ----
  const netTex = kit.texture('goalNet', 128, 128, (c, w, h) => {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    for (let i = 0; i <= w; i += 16) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, h);
      c.moveTo(0, i);
      c.lineTo(w, i);
      c.stroke();
    }
  }, { alpha: true, wrap: true });
  netTex.uScale = 4;
  netTex.vScale = 3;
  const netMat = new StandardMaterial('netMat', scene);
  netMat.diffuseTexture = netTex;
  netMat.diffuseTexture.hasAlpha = true;
  netMat.useAlphaFromDiffuseTexture = true;
  netMat.emissiveColor = new Color3(0.55, 0.55, 0.58);
  netMat.backFaceCulling = false;
  netMat.freeze();
  const postWhite = kit.mat('#f7f5ee', { emissive: 0.25, spec: 0.2 });
  const nets: Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const team = side === -1 ? 'blue' : 'red';
    const x = side * FIELD_HALF_W;
    const teamMat = kit.mat(TEAM_COLOR[team], { emissive: 0.45 });
    const posts: Mesh[] = [];
    for (const sz of [-GOAL_HALF_W, GOAL_HALF_W]) posts.push(kit.cyl('post', 0.25, 0.25, 2.3, { x, y: 1.15, z: sz }, postWhite));
    posts.push(kit.cyl('crossbar', 0.25, 0.25, GOAL_HALF_W * 2, { x, y: 2.3, z: 0, rx: Math.PI / 2 }, postWhite));
    // sostegni posteriori
    for (const sz of [-GOAL_HALF_W, GOAL_HALF_W]) posts.push(kit.box('goalBack', GOAL_DEPTH, 0.1, 0.1, { x: x + side * GOAL_DEPTH / 2, y: 0.05, z: sz }, postWhite));
    kit.merge(`goalPosts${side}`, posts, postWhite);
    // fascia squadra sulla traversa (colore + forma: la porta e' "di qualcuno")
    kit.freeze(kit.cyl('crossbarBand', 0.3, 0.3, GOAL_HALF_W * 0.9, { x, y: 2.3, z: 0, rx: Math.PI / 2 }, teamMat));
    // rete: scatola aperta sul davanti, una mesh che si "gonfia" (scala) al gol
    const net = MeshBuilder.CreateBox('net', { width: GOAL_DEPTH, height: 2.2, depth: GOAL_HALF_W * 2 }, scene);
    net.position.set(x + side * GOAL_DEPTH / 2, 1.1, 0);
    net.material = netMat;
    net.isPickable = false;
    nets.push(net);
    // scritta sul telo di fondo: in QUESTA porta segna quella squadra (la palla qui = gol dei rossi a +X, come in gioco)
    kit.sign(team === 'red' ? 'GOL ROSSI' : 'GOL BLU', { style: 'board', color: TEAM_COLOR[team], bg: '#f1ebdc', w: 4, h: 1, x: x + side * (GOAL_DEPTH + 0.6), y: 2.9, z: 0, ry: side * -Math.PI / 2, twoSided: true });
  }

  // ---- SPONDE BASSE (gameplay: stesse misure) ----
  const boardMat = kit.mat('#2d3a4a', { spec: 0.05 });
  const boardTop = kit.mat('#f7f5ee', { emissive: 0.2 });
  const boardH = 0.6;
  const boardT = 0.4;
  const boards: Mesh[] = [];
  const tops: Mesh[] = [];
  for (const side of [-1, 1]) {
    const x = side * FIELD_HALF_W;
    const segLen = (D / 2 - GOAL_HALF_W) / 2;
    for (const sign of [-1, 1]) {
      const zCenter = sign * (GOAL_HALF_W + segLen);
      boards.push(kit.box('boardX', boardT, boardH, segLen * 2, { x, y: boardH / 2, z: zCenter }, boardMat));
      tops.push(kit.box('boardXTop', boardT + 0.02, 0.08, segLen * 2, { x, y: boardH, z: zCenter }, boardTop));
    }
  }
  for (const side of [-1, 1]) {
    const z = side * FIELD_HALF_D;
    boards.push(kit.box('boardZ', W + boardT * 2, boardH, boardT, { x: 0, y: boardH / 2, z }, boardMat));
    tops.push(kit.box('boardZTop', W + boardT * 2, 0.08, boardT + 0.02, { x: 0, y: boardH, z }, boardTop));
  }
  kit.merge('boards', boards, boardMat);
  kit.merge('boardTops', tops, boardTop);

  // ---- RECINZIONE ALTA (rete metallica) + pali ----
  const fenceTex = kit.texture('chainLink', 128, 128, (c, w, h) => {
    c.strokeStyle = '#c9d1db';
    c.lineWidth = 2.2;
    for (let i = -h; i < w + h; i += 14) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i + h, h);
      c.moveTo(i + h, 0);
      c.lineTo(i, h);
      c.stroke();
    }
  }, { alpha: true, wrap: true });
  const fenceMat = new StandardMaterial('fenceMat', scene);
  fenceMat.diffuseTexture = fenceTex;
  fenceMat.diffuseTexture.hasAlpha = true;
  fenceMat.useAlphaFromDiffuseTexture = true;
  fenceMat.backFaceCulling = false;
  fenceMat.emissiveColor = new Color3(0.25, 0.27, 0.32);
  fenceMat.freeze();
  const FH = 7;
  const fences: Mesh[] = [];
  // fondo (+Z) e lati; davanti alla camera (-Z) la rete e' bassa (non copre il campo)
  const mk = (w: number, h: number, x: number, z: number, ry: number): void => {
    const p = MeshBuilder.CreatePlane('fence', { width: w, height: h }, scene);
    p.position.set(x, h / 2, z);
    p.rotation.y = ry;
    fences.push(p);
  };
  mk(FENCE_X * 2, FH, 0, FENCE_Z, 0);
  mk(FENCE_Z * 2, FH, -FENCE_X, 0, Math.PI / 2);
  mk(FENCE_Z * 2, FH, FENCE_X, 0, Math.PI / 2);
  mk(FENCE_X * 2, 1.4, 0, -FENCE_Z, 0);
  const fence = kit.merge('fence', fences, fenceMat);
  if (fence) fenceTex.uScale = 1;
  // la maglia ripetuta in proporzione: la UV della mesh fusa va da 0 a 1 per pannello
  fenceTex.uScale = 14;
  fenceTex.vScale = 3;
  const pole = MeshBuilder.CreateCylinder('fencePoles', { diameter: 0.14, height: FH, tessellation: 6 }, scene);
  pole.material = kit.mat(PAL.metal, { spec: 0.15 });
  const poleSpots: Xf[] = [];
  for (let i = 0; i <= 12; i++) poleSpots.push({ x: -FENCE_X + (i / 12) * FENCE_X * 2, y: FH / 2, z: FENCE_Z });
  for (const sx of [-1, 1]) for (let i = 0; i <= 6; i++) poleSpots.push({ x: sx * FENCE_X, y: FH / 2, z: -FENCE_Z + (i / 6) * FENCE_Z * 2 });
  kit.thin(pole, poleSpots);
  kit.freeze(pole);

  // ---- TORRI FARO (PRIMARY) agli angoli, fuori dalla recinzione ----
  const towerMat = kit.mat('#7d8696', { spec: 0.1 });
  const lampMat = kit.neon('#fffbe8');
  const towers: Mesh[] = [];
  const heads: Mesh[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (FENCE_X + 2);
    const z = sz * (FENCE_Z + 2);
    towers.push(kit.cyl('floodPole', 0.35, 0.6, 18, { x, y: 9, z }, towerMat, 6));
    towers.push(kit.box('floodFrame', 3.6, 2.2, 0.3, { x, y: 18.4, z, ry: Math.atan2(-x, -z) + Math.PI, rx: 0.4 }, towerMat));
    heads.push(kit.box('floodLamps', 3.2, 1.8, 0.2, { x: x - Math.sign(x) * 0.12, y: 18.4, z: z - Math.sign(z) * 0.12, ry: Math.atan2(-x, -z) + Math.PI, rx: 0.4 }, lampMat));
  }
  kit.merge('floodTowers', towers, towerMat);
  kit.merge('floodLamps', heads, lampMat);

  // ---- PALAZZINE (PRIMARY) sullo sfondo: finestre accese, kit modulare con scale diverse ----
  const winTex = kit.texture('blockWindows', 256, 256, (c, w, h) => {
    // palazzina di sera: facciata in ombra (blu-viola), finestre accese a caso, balconi appena piu' chiari
    c.fillStyle = '#3a3c5c';
    c.fillRect(0, 0, w, h);
    const r = seeded(23);
    for (let y = 12; y < h; y += 42) for (let x = 14; x < w; x += 44) {
      const lit = r() < 0.4;
      c.fillStyle = lit ? (r() < 0.5 ? '#ffcf7a' : '#ffe2a8') : '#262840';
      c.fillRect(x, y, 22, 26);
      c.fillStyle = '#4c4e70';
      c.fillRect(x - 4, y + 26, 30, 5);
    }
  }, { wrap: true });
  const block = MeshBuilder.CreateBox('blocks', { width: 1, height: 1, depth: 1 }, scene);
  block.material = kit.mat('#ffffff', { tex: winTex, unlit: true, key: 'blockMat' });
  const blocks: Xf[] = [];
  const r = seeded(29);
  for (let i = 0; i < 11; i++) {
    const x = -70 + i * 14 + (r() - 0.5) * 5;
    const h = 14 + r() * 16;
    blocks.push({ x, y: h / 2 - 0.5, z: FENCE_Z + 34 + r() * 14, sx: 10 + r() * 4, sy: h, sz: 8 });
  }
  kit.thin(block, blocks);
  kit.freeze(block);

  // ---- MURETTO, PANCHINA, BAR SPORT, MOTORINI (SECONDARY) ----
  const wallMat = kit.mat(PAL.concrete, { spec: 0.02 });
  kit.freeze(kit.box('muretto', FENCE_X * 2 + 10, 1.1, 0.5, { x: 0, y: 0.55, z: FENCE_Z + 3.5 }, wallMat));
  const benchWood = kit.mat(PAL.wood);
  // panchina delle riserve: lato di fondo, fuori dal campo (davanti alla camera copriva il campo)
  kit.freeze(kit.box('bench', 6, 0.15, 0.6, { x: -4, y: 0.55, z: FIELD_HALF_D + 1.6 }, benchWood));
  kit.freeze(kit.box('benchBack', 6, 0.7, 0.12, { x: -4, y: 0.95, z: FIELD_HALF_D + 1.9 }, benchWood));
  // chiosco BAR SPORT dietro la recinzione di destra
  const bar = kit.box('barKiosk', 5, 3, 3.4, { x: FENCE_X + 6, y: 1.5, z: FENCE_Z - 6 }, kit.mat('#e9dcc3'));
  kit.freeze(bar);
  kit.freeze(kit.box('barAwning', 5.6, 0.2, 1.6, { x: FENCE_X + 6, y: 3.1, z: FENCE_Z - 7.9, rx: -0.25 }, kit.mat('#3f6d6a')));
  kit.sign('BAR SPORT', { style: 'neon', color: PAL.neonAmber, w: 4.2, h: 1.1, x: FENCE_X + 3.45, y: 2.4, z: FENCE_Z - 6, ry: -Math.PI / 2 });
  // motorini (silhouette semplici, una mesh per pezzo)
  const scooterBody = MeshBuilder.CreateBox('scooterBody', { width: 0.5, height: 0.7, depth: 1.6 }, scene);
  scooterBody.material = kit.mat('#ffffff', { spec: 0.3, key: 'scooterMat' });
  const wheel = MeshBuilder.CreateCylinder('scooterWheels', { diameter: 0.55, height: 0.18, tessellation: 10 }, scene);
  wheel.material = kit.mat('#1f2128');
  const bikes: Xf[] = [];
  const wheels: Xf[] = [];
  for (let i = 0; i < 5; i++) {
    const x = -FENCE_X - 3;
    const z = -6 + i * 1.6;
    bikes.push({ x, y: 0.65, z, ry: 0.35 });
    wheels.push({ x: x + 0.24, y: 0.28, z: z + 0.55, rz: Math.PI / 2, ry: 0.35 }, { x: x - 0.24, y: 0.28, z: z - 0.55, rz: Math.PI / 2, ry: 0.35 });
  }
  kit.thin(scooterBody, bikes, ['#c94a3a', '#e6dccb', '#3a6ea8', '#202228', '#9fc0a0']);
  kit.thin(wheel, wheels);
  kit.freeze(scooterBody);
  kit.freeze(wheel);

  // ---- AMICI dietro la rete di fondo (pochi) ----
  const fans: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 22; i++) fans.push({ x: -FENCE_X + 3 + (i / 21) * (FENCE_X * 2 - 6) + (r() - 0.5), y: 0, z: FENCE_Z + 1.3 + r() * 1.2 });
  const crowd = kit.crowd(fans, { face: [0, 0], scale: 1.05, seed: 13 });

  // ---- CARTELLONI LOCALI (TERTIARY) appesi alla recinzione di fondo ----
  kit.sign('CALCETTO\nOGNI GIOVEDÌ', { style: 'board', color: '#1f3a2a', w: 4.4, h: 2, x: -12, y: 2.6, z: FENCE_Z - 0.06 });
  kit.sign('PIZZERIA DA CIRO', { style: 'board', color: '#7a2f2a', w: 5.2, h: 1.3, x: 10, y: 2.6, z: FENCE_Z - 0.06 });
  kit.sign('MO HO CAPITO', { style: 'poster', color: '#2f4a7a', w: 3.2, h: 1, x: 22, y: 1.7, z: FENCE_Z - 0.06 });

  // ---- rete della porta: si gonfia al gol e torna giu' ----
  const swell = [0, 0];
  return {
    update(now: number): void {
      nets.forEach((n, i) => {
        if (swell[i] <= 0) return;
        swell[i] = Math.max(0, swell[i] - 0.025);
        const k = Math.sin(swell[i] * Math.PI) * 0.35;
        n.scaling.x = 1 + k;
        n.position.x = (i === 0 ? -1 : 1) * (FIELD_HALF_W + (GOAL_DEPTH * (1 + k)) / 2);
      });
      void now;
    },
    goal(side: 1 | -1): void {
      swell[side === -1 ? 0 : 1] = 1;
      crowd.cheer(1);
    }
  };
}

void SIGN_FONT;
