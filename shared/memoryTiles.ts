/**
 * Tile condivise di MEMORIA DA UBRIACO: stessa disposizione, stessi colori,
 * stesse icone su host e telefono. I toni sono le classiche note di Simon
 * (E4, B3, G3, D3) per rinforzare la memoria anche via orecchio.
 */
export interface MemoryTile {
  /** Indice 0..3, = controlId c0..c3. */
  index: number;
  color: string;
  icon: string;
  label: string;
  tone: number;
}

export const MEMORY_TILES: MemoryTile[] = [
  { index: 0, color: '#ef4444', icon: '🍺', label: 'ROSSO', tone: 329.63 },
  { index: 1, color: '#3b82f6', icon: '🧊', label: 'BLU', tone: 246.94 },
  { index: 2, color: '#22c55e', icon: '🥒', label: 'VERDE', tone: 196.0 },
  { index: 3, color: '#eab308', icon: '🥨', label: 'GIALLO', tone: 146.83 }
];

export const MEMORY_SEQ_LENS = [3, 4, 5, 6, 7];
export const MEMORY_ROUNDS = MEMORY_SEQ_LENS.length;

/**
 * Il minigioco Memoria è finito dopo il round `roundIndex` (0-based)?
 * Fine ROUND ≠ fine MINIGIOCO: si esce solo dopo l'ULTIMO round, oppure se non è rimasto nessuno in gara.
 * Un solo superstite NON chiude il gioco (prima chiudeva al round in cui gli altri sbagliavano).
 */
export function isMemoryOver(roundIndex: number, totalRounds: number, aliveCount: number): boolean {
  return roundIndex + 1 >= totalRounds || aliveCount <= 0;
}
