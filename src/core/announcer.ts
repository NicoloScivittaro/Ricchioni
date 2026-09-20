/**
 * TELECRONISTA: frasi brevi e divertenti per i momenti chiave dei giochi 3D (scambi lunghi, gol, duello finale…).
 * Regole anti-spam: mai la stessa frase due volte di fila per lo stesso evento, e al massimo una frase ogni
 * `GAP_MS` (gli eventi `important` passano sempre). Se `say()` restituisce null il gioco usa il suo testo standard.
 */
export type AnnounceKind =
  | 'rally5'
  | 'rally8'
  | 'rally12'
  | 'goal'
  | 'ownGoal'
  | 'lastTwo'
  | 'firstBlood';

const POOLS: Record<AnnounceKind, string[]> = {
  rally5: ['SCAMBIO LUNGO! 🔥', 'NESSUNO MOLLA!', 'CHE SCAMBIO!', 'QUESTA PALLA NON VUOLE CADERE'],
  rally8: ['SCAMBIO EPICO! 🤯', 'MA QUANDO FINISCE?!', 'ANCORA IN GIOCO, INCREDIBILE!', 'STANNO SUDANDO TUTTI'],
  rally12: ['SCAMBIO LEGGENDARIO! 👑', 'ORMAI È UNA GUERRA!', 'CHIAMATE UN\'AMBULANZA!', 'QUALCUNO MOLLI LA PALLA!'],
  goal: ['GOOOOL! ⚽', 'RETE! 🔥', 'CHE GOLAZO!', 'ROBA DA CAMPIONI (O DA FORTUNATI)', 'BOMBER!'],
  ownGoal: ['AUTOGOL! 😱', 'DALLA PARTE SBAGLIATA!', 'MA CHE HAI COMBINATO?!', 'REGALO PER GLI AVVERSARI!'],
  lastTwo: ['ULTIMI DUE: RESA DEI CONTI! ⚔️', 'DUELLO FINALE!', 'ORA SI FA SUL SERIO', 'NE RIMANE UNO SOLO!'],
  firstBlood: ['PRIMO SANGUE! 🩸', 'E CE N\'È UNO IN MENO', 'COMINCIA LA MATTANZA']
};

const GAP_MS = 2200;
const last: Partial<Record<AnnounceKind, string>> = {};
let lastAt = 0;

export function say(kind: AnnounceKind, important = false): string | null {
  const now = performance.now();
  if (!important && now - lastAt < GAP_MS) return null;
  const pool = POOLS[kind];
  const options = pool.length > 1 ? pool.filter((p) => p !== last[kind]) : pool;
  const phrase = options[Math.floor(Math.random() * options.length)];
  last[kind] = phrase;
  lastAt = now;
  return phrase;
}
