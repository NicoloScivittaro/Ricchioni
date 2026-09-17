/**
 * Abilità di ARENA DEL DISAGIO (brawl/sumo): una per personaggio, una volta a
 * partita. Leggibili, tematiche, senza regalare la vittoria.
 */
export interface ArenaAbility {
  name: string;
  desc: string;
}

export const ARENA_ABILITIES: Record<string, ArenaAbility> = {
  goblin: {
    name: 'NCULO!',
    desc: 'Dash sporco imprevedibile: knockback potenziato e traiettoria storta.'
  },
  buttafuori: {
    name: "MO M'IMPEGNO",
    desc: 'Per 5 secondi resisti molto meglio ai knockback.'
  },
  dottore: {
    name: '20 KG IN UN MESE',
    desc: 'Per 5 secondi sei più veloce, ma molto più facile da sbalzare.'
  },
  judoka: {
    name: 'IPPON',
    desc: "Onda d'urto: spinge via con forza chi ti sta vicino."
  },
  ciro: {
    name: 'PAGO DOPO',
    desc: 'Rimanda di qualche secondo la prossima spinta che subisci.'
  }
};
