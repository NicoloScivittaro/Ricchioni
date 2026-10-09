/**
 * CASA CARBO — GEOMETRIA (dati puri, nessun Babylon). Tutto e' scritto in PIXEL della planimetria disegnata dall'utente
 * (immagine 1448 x 1086: giardino anteriore in alto, giardino posteriore e cancello "CASA CARBO" in basso) e convertito in metri
 * di gioco: cosi' pareti e porte rosse restano dove sono nel disegno.
 *
 * Mondo: x a destra, z verso il giardino ANTERIORE (in alto nel disegno). 1 m = 40 px. La camera guarda dal giardino posteriore.
 * Griglia unica a celle da 20 px (0,5 m): ogni cella sa se si puo' camminare e se puo' contenere acqua (solo il pavimento di casa,
 * soglie delle due porte comprese). I giardini sono camminabili ma non tengono acqua (la pioggia entra SOLO dalle porte).
 */

export type Rect = [number, number, number, number]; // x0, y0, x1, y1 in px

export const PX_PER_M = 40;
/** Centro della casa nel disegno (px): diventa l'origine del mondo. */
const CX = 737.5;
const CY = 438.5;
export const toWorldX = (px: number): number => (px - CX) / PX_PER_M;
export const toWorldZ = (py: number): number => (CY - py) / PX_PER_M;
export const toPxX = (x: number): number => x * PX_PER_M + CX;
export const toPxY = (z: number): number => CY - z * PX_PER_M;

/** Interno calpestabile della casa (px). */
export const INTERIOR: Rect = [85, 175, 1390, 700];
/** Giardini camminabili (px): l'anteriore e' una striscia, il posteriore ospita il tombino. */
export const GARDENS: Rect[] = [
  [85, 60, 1390, 155],
  [85, 722, 1390, 880]
];

/** Le DUE porte dei giardini: uniche sorgenti d'acqua. Il varco e' una fessura nel muro esterno. */
export interface DoorDef {
  id: 'front' | 'back';
  label: string;
  gap: Rect;
  /** centro della porta (px) */
  cx: number;
  cy: number;
  /** verso l'interno (segno di z nel mondo) */
  inward: 1 | -1;
}
export const DOORS: DoorDef[] = [
  { id: 'front', label: 'PORTA ANTERIORE', gap: [815, 155, 880, 176], cx: 847, cy: 166, inward: -1 },
  { id: 'back', label: 'PORTA POSTERIORE', gap: [672, 699, 752, 722], cx: 712, cy: 711, inward: 1 }
];

/** Pareti (px). Le porte rosse interne sono VUOTI fra due segmenti. */
export const WALLS: Rect[] = [
  // perimetro (con le due porte dei giardini)
  [60, 155, 815, 175],
  [880, 155, 1415, 175],
  [60, 700, 672, 722],
  [752, 700, 1415, 722],
  [60, 155, 85, 722],
  [1390, 155, 1415, 722],
  // camera: divisorio parziale verso l'angolo del mobile
  [518, 175, 532, 262],
  // armadio (corridoio stretto, aperto verso la camera in fondo a destra)
  [85, 318, 500, 330],
  [492, 318, 505, 345],
  // muro sopra il bagno (e sotto camera/armadio)
  [85, 392, 792, 405],
  // camera -> corridoio (porta rossa)
  [778, 175, 792, 305],
  [778, 355, 792, 405],
  // doccia | bagno (porta rossa)
  [255, 405, 268, 448],
  [255, 482, 268, 515],
  // bagno -> cucina (porta rossa in basso)
  [85, 508, 270, 522],
  [345, 508, 792, 522],
  // bagno -> corridoio (porta rossa)
  [778, 405, 792, 440],
  [778, 492, 792, 522],
  // corridoio | palestra (porta)
  [940, 175, 955, 225],
  [940, 300, 955, 405],
  // palestra | salotto
  [955, 395, 1390, 408],
  // corridoio/pranzo | salotto (porta rossa)
  [962, 408, 975, 450],
  [962, 520, 975, 700]
];

/** Porte interne (solo per disegnare i telai rossi). */
export const INNER_DOORS: Rect[] = [
  [778, 305, 792, 355],
  [255, 448, 268, 482],
  [270, 508, 345, 522],
  [778, 440, 792, 492],
  [940, 225, 955, 300],
  [962, 450, 975, 520]
];

/** Mobili: ostacoli per persone e acqua (l'acqua ci si accumula contro). `kind` serve solo al disegno. */
export interface Furniture {
  kind: 'desk' | 'bed' | 'night' | 'fridge' | 'counter' | 'stove' | 'table' | 'sofa' | 'coffee' | 'tv' | 'bench' | 'rack' | 'ball' | 'toilet' | 'sink' | 'cabinet' | 'shelf';
  r: Rect;
  h: number; // altezza (m) per il disegno
}
export const FURNITURE: Furniture[] = [
  { kind: 'desk', r: [100, 190, 175, 300], h: 0.8 },
  { kind: 'bed', r: [600, 195, 720, 345], h: 0.6 },
  { kind: 'night', r: [545, 190, 585, 225], h: 0.6 },
  { kind: 'night', r: [728, 190, 768, 225], h: 0.6 },
  { kind: 'fridge', r: [88, 522, 146, 660], h: 1.8 },
  { kind: 'counter', r: [146, 522, 250, 562], h: 0.9 },
  { kind: 'stove', r: [146, 562, 188, 632], h: 0.9 },
  { kind: 'table', r: [372, 588, 522, 668], h: 0.75 },
  { kind: 'sofa', r: [1055, 470, 1262, 540], h: 0.8 },
  { kind: 'coffee', r: [1095, 588, 1200, 640], h: 0.45 },
  { kind: 'tv', r: [1302, 495, 1385, 665], h: 0.7 },
  { kind: 'bench', r: [1010, 240, 1110, 330], h: 0.5 },
  { kind: 'rack', r: [1330, 255, 1385, 390], h: 1.2 },
  { kind: 'ball', r: [1140, 178, 1190, 218], h: 0.6 },
  { kind: 'toilet', r: [724, 420, 764, 495], h: 0.5 },
  { kind: 'sink', r: [495, 410, 540, 440], h: 0.9 },
  { kind: 'cabinet', r: [868, 655, 958, 698], h: 0.8 },
  { kind: 'shelf', r: [985, 410, 1140, 448], h: 0.9 }
];

/** I tre punti di scarico. `squeegee` = accetta anche l'acqua spinta col tiracqua (solo il bagno). */
export interface DrainDef {
  id: 'bagno' | 'lavello' | 'tombino';
  label: string;
  cx: number;
  cy: number;
  squeegee: boolean;
}
export const DRAINS: DrainDef[] = [
  { id: 'bagno', label: 'SCARICO DEL BAGNO', cx: 600, cy: 465, squeegee: true },
  { id: 'lavello', label: 'LAVELLO', cx: 215, cy: 575, squeegee: false },
  { id: 'tombino', label: 'TOMBINO', cx: 880, cy: 795, squeegee: false }
];

/** La TV del salotto: zona d'acqua che la minaccia e punto in cui la si mette in salvo. */
export const TV_ZONE: Rect = [1225, 480, 1300, 680];
export const TV_POINT = { cx: 1290, cy: 580 };

/** Posti in cui il tappeto bagnato si puo' spostare diventando un ostacolo (evento "ME SO ROTTO ER CAZZO!"). */
export const RUG_SPOTS: Rect[] = [
  [800, 440, 935, 485],
  [560, 545, 700, 585],
  [980, 452, 1040, 518]
];

/** Partenze (px) per 2..5 giocatori, tutte dentro casa e lontane dalle porte. */
export function spawnPx(n: number): { x: number; y: number }[] {
  const all = [
    { x: 600, y: 620 },
    { x: 1150, y: 600 },
    { x: 865, y: 300 },
    { x: 420, y: 250 },
    { x: 1180, y: 345 }
  ];
  return all.slice(0, Math.max(1, Math.min(5, n)));
}

// ------------------------------------------------------------------ griglia
export const CELL_PX = 20;
export const GRID_X0 = 60;
export const GRID_Y0 = 40;
export const COLS = 68; // 60..1420
export const ROWS = 42; // 40..880
export const CELL_M = CELL_PX / PX_PER_M;

const inside = (r: Rect, x: number, y: number): boolean => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];

export interface MapGrid {
  /** 1 = si puo' camminare */
  walk: Uint8Array;
  /** 1 = pavimento di casa (tiene acqua) */
  floor: Uint8Array;
  /** celle d'ingresso dell'acqua, per porta */
  doorCells: Record<'front' | 'back', number[]>;
  /** celle di scarico del bagno (assorbono l'acqua spinta) */
  bathDrainCells: number[];
  /** numero di celle di pavimento interno (per la % di casa asciutta, soglie escluse) */
  interiorCells: number[];
  tvCells: number[];
}

export const cellIndex = (i: number, j: number): number => j * COLS + i;
export const cellCenterPx = (k: number): { x: number; y: number } => ({ x: GRID_X0 + ((k % COLS) + 0.5) * CELL_PX, y: GRID_Y0 + (Math.floor(k / COLS) + 0.5) * CELL_PX });
export function cellAtPx(x: number, y: number): number {
  const i = Math.floor((x - GRID_X0) / CELL_PX);
  const j = Math.floor((y - GRID_Y0) / CELL_PX);
  if (i < 0 || j < 0 || i >= COLS || j >= ROWS) return -1;
  return cellIndex(i, j);
}

export function buildGrid(extraSolid: Rect[] = []): MapGrid {
  const n = COLS * ROWS;
  const walk = new Uint8Array(n);
  const floor = new Uint8Array(n);
  const doorCells: MapGrid['doorCells'] = { front: [], back: [] };
  const interiorCells: number[] = [];
  const tvCells: number[] = [];
  const bathDrainCells: number[] = [];
  // una cella e' muro se un muro ne copre almeno il 30% (i muri sono sottili: il centro della cella puo' cadere fuori), mobile se il 45%
  const cover = (r: Rect, x: number, y: number): number => {
    const ox = Math.max(0, Math.min(r[2], x + CELL_PX / 2) - Math.max(r[0], x - CELL_PX / 2));
    const oy = Math.max(0, Math.min(r[3], y + CELL_PX / 2) - Math.max(r[1], y - CELL_PX / 2));
    return (ox * oy) / (CELL_PX * CELL_PX);
  };
  for (let k = 0; k < n; k++) {
    const { x, y } = cellCenterPx(k);
    const solid = WALLS.some((r) => cover(r, x, y) >= 0.3) || FURNITURE.some((f) => cover(f.r, x, y) >= 0.45) || extraSolid.some((r) => cover(r, x, y) >= 0.45);
    const door = DOORS.find((d) => inside(d.gap, x, y));
    const interior = inside(INTERIOR, x, y);
    const garden = GARDENS.some((r) => inside(r, x, y));
    if (door) {
      walk[k] = 1;
      floor[k] = 1;
      doorCells[door.id].push(k);
      continue;
    }
    if (solid) continue;
    if (interior) {
      walk[k] = 1;
      floor[k] = 1;
      interiorCells.push(k);
      if (inside(TV_ZONE, x, y)) tvCells.push(k);
    } else if (garden) walk[k] = 1;
  }
  const bath = DRAINS[0];
  for (const k of interiorCells) {
    const c = cellCenterPx(k);
    if (Math.hypot(c.x - bath.cx, c.y - bath.cy) <= 32) bathDrainCells.push(k);
  }
  return { walk, floor, doorCells, bathDrainCells, interiorCells, tvCells };
}
