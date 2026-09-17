/**
 * Abilità specifiche di MEMORIA DA UBRIACO (una per personaggio, UNA volta
 * per partita). Nessuna regala la vittoria: danno un vantaggio personale
 * divertente.
 */
export interface MemoryAbility {
  name: string;
  desc: string;
  /** In quale fase è attivabile: 'observe' | 'repeat' | 'passive'. */
  phase: 'observe' | 'repeat' | 'passive';
}

export const MEMORY_ABILITIES: Record<string, MemoryAbility> = {
  goblin: {
    name: 'ANCORA UN GIRO',
    desc: 'Rivede la sequenza una seconda volta, solo per sé.',
    phase: 'observe'
  },
  buttafuori: {
    name: 'MO HO CAPITO',
    desc: 'Sbaglia una volta ma può correggersi e continuare (penalità tempo).',
    phase: 'passive'
  },
  dottore: {
    name: "M'HO SVEJATO",
    desc: 'Per 2 secondi si illumina la prossima casella giusta.',
    phase: 'repeat'
  },
  judoka: {
    name: 'NO, ASPETTA!',
    desc: 'Ferma il proprio tempo per 2 secondi e riprende fiato.',
    phase: 'repeat'
  },
  ciro: {
    name: 'A RATE',
    desc: 'Divide la sequenza a metà: pausa mentale prima della seconda parte.',
    phase: 'repeat'
  }
};
