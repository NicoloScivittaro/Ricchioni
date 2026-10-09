/**
 * CASA CARBO — NUMERI DI GIOCO (un solo posto per il bilanciamento; le abilita' stanno in shared/abilityCatalog.ts, game 'casacarbo').
 * Unita': pixel della planimetria (40 px = 1 m) e secondi; l'acqua si misura in "unita'" (una cella da 0,5 m con 1 unita' e' una
 * pozza ben visibile). VALORI INIZIALI DA PLAYTEST: non sono bilanciati con persone vere.
 */
export const CC = {
  duration: 120,
  /** soglia dell'obiettivo comune: % di pavimento asciutto a fine partita */
  saveThreshold: 0.75,
  /** una cella e' "asciutta" sotto questa quantita' d'acqua */
  dry: 0.08,

  // ---------------------------------------------------------------- pioggia (unita'/s PER PORTA, prima del fattore giocatori)
  rain: [
    { from: 0, rate: 0.4, name: 'moderata' as const },
    { from: 25, rate: 0.72, name: 'forte' as const },
    { from: 65, rate: 0.72, name: 'raffiche' as const },
    { from: 95, rate: 1.2, name: 'picco' as const },
    { from: 110, rate: 0.48, name: 'calma' as const }
  ],
  /** piu' giocatori = piu' pioggia (2p 0,79 · 3p 0,91 · 4p 1,03 · 5p 1,15) */
  rainPerPlayer: 0.12,
  rainBase: 0.55,

  // ---------------------------------------------------------------- acqua
  /** velocita' di livellamento fra celle vicine (per secondo) */
  spread: 4,
  /** sotto questa altezza una pozza non scorre piu' (le pozze hanno bordi: la % asciutta ha senso) */
  sticky: 0.22,
  /** lo scarico del bagno beve da solo l'acqua che gli arriva vicino (senza dare punti a nessuno) */
  bathPassive: 1.2,

  // ---------------------------------------------------------------- giocatore (identico per tutti)
  radius: 14,
  speed: 205,
  accel: 1600,
  squeegeeSpeed: 0.78,
  /** il secchio pieno rallenta fino a questo fattore */
  bucketSlow: 0.62,
  dashSpeed: 520,
  dashTime: 0.18,
  dashCooldown: 1.1,
  dashSpill: 0.3,

  // ---------------------------------------------------------------- tiracqua
  bladeNear: 6,
  bladeFar: 46,
  bladeHalf: 30,
  /** frazione dell'acqua di una cella della lama spostata al secondo */
  bladeRate: 9,
  /** di quanto avanti finisce l'acqua spinta (px) */
  bladePush: 22,

  // ---------------------------------------------------------------- secchio
  bucketCap: 6,
  scoopRate: 4.5,
  scoopRadius: 30,
  emptyRadius: 52,

  // ---------------------------------------------------------------- scivolate e urti
  slipSpeed: 165,
  slipDepth: 0.45,
  slipChance: 1.1,
  slipTime: 0.6,
  slipSpill: 0.5,
  bumpSpeed: 220,
  bumpSpill: 0.25,
  /** uno stesso giocatore non perde acqua per urti piu' spesso di cosi' */
  bumpCooldown: 0.8,

  // ---------------------------------------------------------------- porte e interazioni
  containRadius: 66,
  containPer: 0.45,
  containMax: 0.7,
  /** punti per unita' fermata alla porta e tetto per giocatore */
  stopPoints: 0.5,
  stopCap: 20,
  unclogTime: 1.2,
  tvTime: 1.5,
  rugTime: 1.0,
  interactRadius: 66,

  // ---------------------------------------------------------------- punteggio interno
  points: { tv: 6, unclog: 4 },

  // ---------------------------------------------------------------- eventi
  events: {
    announce: 3,
    pioggia: { window: [30, 52] as [number, number], duration: 6, mult: 1.8 },
    raffica: { windows: [[66, 77], [82, 93]] as [number, number][], amount: 9, duration: 1.2 },
    tappeto: { window: [40, 85] as [number, number], duration: 12 },
    intasato: { window: [50, 98] as [number, number], autoClear: 25 },
    tv: { after: 35, depth: 0.5, ruinAfter: 12 }
  }
} as const;
