/**
 * ICONE INTERNE dei personaggi (niente emoji del sistema operativo: su Windows, macOS, Android e TV le emoji hanno disegni
 * diversi o mancano). Un piccolo set VETTORIALE, una sola fonte per due usi:
 *  - SVG (DOM: telefono, pannello controller, HUD Babylon via data URL)
 *  - Path2D su canvas (targhette e simboli 3D, disegnati in modo sincrono su DynamicTexture)
 * Coordinate in un riquadro 64x64. Le battute e i messaggi del feed possono continuare a usare emoji: qui ci sono solo le
 * icone che IDENTIFICANO un giocatore o un'abilita'.
 */

export interface IconShape {
  /** path SVG (coordinate 0..64) */
  d?: string;
  fill?: string;
  stroke?: string;
  width?: number;
  /** testo (es. "20c" sulla moneta di Ciro) */
  text?: string;
  x?: number;
  y?: number;
  size?: number;
}

const circle = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

/** Icona del GIOCATORE (chi e'). */
export const CHAR_ICONS: Record<string, IconShape[]> = {
  // testa verde con le orecchie a punta e i riccioli
  goblin: [
    { d: 'M4 30 L24 22 L22 38 Z', fill: '#9cc45a', stroke: '#1f2937', width: 2 },
    { d: 'M60 30 L40 22 L42 38 Z', fill: '#9cc45a', stroke: '#1f2937', width: 2 },
    { d: circle(32, 34, 17), fill: '#9cc45a', stroke: '#1f2937', width: 2 },
    { d: circle(24, 18, 6) + circle(32, 15, 6) + circle(40, 18, 6), fill: '#5b3a22' },
    { d: circle(26, 33, 4.5) + circle(38, 33, 4.5), fill: '#ffffff' },
    { d: circle(27, 34, 2) + circle(39, 34, 2), fill: '#111827' },
    { d: 'M25 43 Q32 48 39 43', stroke: '#1f2937', width: 2.5 }
  ],
  // guantone da boxe rosso col polsino bianco
  buttafuori: [
    { d: 'M18 22 Q18 8 32 8 H38 Q52 8 52 24 V36 Q52 46 42 46 H28 Q18 46 18 36 Z', fill: '#ef4444', stroke: '#1f2937', width: 2.5 },
    { d: 'M18 28 Q8 28 9 38 Q10 46 20 44 Z', fill: '#dc2626', stroke: '#1f2937', width: 2.5 },
    { d: 'M22 46 H48 V58 H22 Z', fill: '#f8fafc', stroke: '#1f2937', width: 2.5 },
    { d: 'M28 16 Q34 13 42 16', stroke: '#fecaca', width: 3 }
  ],
  // judogi: risvolti bianchi a V su fondo ambra, cintura nera col nodo
  judoka: [
    { d: circle(32, 32, 28), fill: '#f59e0b', stroke: '#1f2937', width: 2.5 },
    { d: 'M18 8 L32 32 L46 8 L39 6 L32 20 L25 6 Z', fill: '#f8fafc', stroke: '#1f2937', width: 2 },
    { d: 'M6 32 H58 V40 H6 Z', fill: '#111827' },
    { d: 'M27 29 H37 V43 H27 Z', fill: '#111827', stroke: '#f8fafc', width: 1.5 },
    { d: 'M28 43 L22 58 H28 L32 46 Z', fill: '#111827' },
    { d: 'M36 43 L42 58 H36 L32 46 Z', fill: '#111827' }
  ],
  // lampadina accesa ("ogni tanto si sveglia")
  dottore: [
    { d: 'M32 3 V8 M12 12 L16 16 M52 12 L48 16 M4 30 H9 M55 30 H60', stroke: '#fde047', width: 3 },
    { d: circle(32, 28, 16), fill: '#fde047', stroke: '#1f2937', width: 2.5 },
    { d: 'M25 40 H39 V46 H25 Z', fill: '#fde047', stroke: '#1f2937', width: 2 },
    { d: 'M24 46 H40 V51 H24 Z M25 52 H39 V57 H25 Z', fill: '#94a3b8', stroke: '#1f2937', width: 1.5 },
    { d: 'M27 30 Q30 22 32 30 Q34 22 37 30', stroke: '#b45309', width: 2.5 }
  ],
  // moneta d'oro da 20 centesimi
  ciro: [
    { d: circle(32, 32, 27), fill: '#f5c542', stroke: '#92400e', width: 3 },
    { d: circle(32, 32, 20), stroke: '#b45309', width: 2 },
    { text: '20c', x: 32, y: 40, size: 20, fill: '#78350f' }
  ]
};

/** Simbolo dell'ABILITA' (compare sopra la testa quando la attiva). */
export const ABILITY_SYMBOLS: Record<string, IconShape[]> = {
  // fulmine verde acido
  goblin: [{ d: 'M38 2 L12 36 H29 L24 62 L52 24 H35 Z', fill: '#a3e635', stroke: '#14532d', width: 3 }],
  // botto: stella a 8 punte rosso/arancio
  buttafuori: [
    { d: 'M32 2 L38 20 L56 10 L46 28 L62 34 L44 40 L52 58 L34 46 L26 62 L24 44 L4 48 L18 32 L4 18 L24 22 Z', fill: '#f97316', stroke: '#7f1d1d', width: 2.5 },
    { d: 'M32 18 L36 28 L46 28 L38 34 L42 44 L32 38 L22 44 L26 34 L18 28 L28 28 Z', fill: '#fde047' }
  ],
  // cartello di pericolo (carico e scarico)
  judoka: [
    { d: 'M32 4 L62 58 H2 Z', fill: '#facc15', stroke: '#111827', width: 3.5 },
    { d: 'M29 22 H35 L34 42 H30 Z', fill: '#111827' },
    { d: circle(32, 49, 3.5), fill: '#111827' }
  ],
  dottore: [
    { d: circle(32, 26, 17), fill: '#fde047', stroke: '#1f2937', width: 2.5 },
    { d: 'M25 39 H39 V45 H25 Z M26 47 H38 V53 H26 Z', fill: '#94a3b8', stroke: '#1f2937', width: 1.5 },
    { d: 'M32 1 V6 M11 10 L15 14 M53 10 L49 14', stroke: '#fde047', width: 3 }
  ],
  ciro: [
    { d: circle(32, 32, 27), fill: '#f5c542', stroke: '#92400e', width: 3 },
    { text: '20c', x: 32, y: 40, size: 20, fill: '#78350f' }
  ]
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

/** Markup SVG (64x64, scalabile). */
export function iconSvg(shapes: IconShape[] | undefined, size = 24): string {
  if (!shapes) return '';
  const body = shapes
    .map((s) =>
      s.text !== undefined
        ? `<text x="${s.x}" y="${s.y}" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${s.size}" text-anchor="middle" fill="${s.fill ?? '#000'}">${esc(s.text)}</text>`
        : `<path d="${s.d}" fill="${s.fill ?? 'none'}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.width ?? 2}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" style="vertical-align:middle;flex:none">${body}</svg>`;
}

/** Data URL dell'icona (per <img> e per le Image del GUI Babylon). */
export function iconDataUrl(shapes: IconShape[] | undefined): string {
  const svg = iconSvg(shapes, 64);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
}

/** Disegno SINCRONO su un canvas 2D (DynamicTexture): `x,y` = angolo in alto a sinistra, `size` in pixel. */
export function drawIcon(ctx: CanvasRenderingContext2D, shapes: IconShape[] | undefined, x: number, y: number, size: number): boolean {
  if (!shapes || typeof Path2D === 'undefined') return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of shapes) {
    if (s.text !== undefined) {
      ctx.fillStyle = s.fill ?? '#000';
      ctx.font = `900 ${s.size ?? 20}px "Arial Black", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(s.text, s.x ?? 32, s.y ?? 40);
      continue;
    }
    const path = new Path2D(s.d ?? '');
    if (s.fill) {
      ctx.fillStyle = s.fill;
      ctx.fill(path);
    }
    if (s.stroke) {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = s.width ?? 2;
      ctx.stroke(path);
    }
  }
  ctx.restore();
  return true;
}
