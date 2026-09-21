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
    desc: 'Sbircia la prossima casella giusta per un attimo (solo tu la vedi). Costa 0,8 s sul tuo tempo.',
    phase: 'repeat'
  },
  judoka: {
    name: 'NO, ASPETTA!',
    desc: 'Ferma il TUO tempo per 2 secondi (non puoi toccare), poi riprendi subito da dove eri. Nessun replay.',
    phase: 'repeat'
  },
  ciro: {
    name: 'A RATE',
    desc: 'A metà sequenza pausa di 2 secondi e 1,5 s in meno sul tuo tempo.',
    phase: 'repeat'
  }
};
