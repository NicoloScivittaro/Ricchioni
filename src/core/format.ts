/** Formattazioni condivise per statistiche e HUD. */

/** Millisecondi → "m:ss.d" (es. 72300 → "1:12.3"). */
export function fmtTime(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/** Numero con segno esplicito: 5 → "+5". */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
