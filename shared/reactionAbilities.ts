/**
 * Abilità specifiche di BOTTA AL VOLO (una per personaggio, una volta per round).
 * Regola condivisa: nessuna regala automaticamente un tempo migliore.
 */
export interface ReactionAbility {
  name: string;
  desc: string;
}

export const REACTION_ABILITIES: Record<string, ReactionAbility> = {
  goblin: {
    name: 'NCULO!',
    desc: 'Annulla il fake-out appena apparso e forza un nuovo timer. Se troppo presto: effetto ubriaco.'
  },
  buttafuori: {
    name: 'MO HO CAPITO',
    desc: 'Falsa partenza? Una seconda chance nello stesso round (penalità +120 ms).'
  },
  dottore: {
    name: 'SONO PIÙ SVEGLIO',
    desc: 'Focus di 2s durante l\'attesa: se VIA arriva in quel lasso, il telefono vibra insieme al segnale.'
  },
  judoka: {
    name: 'ASPETTA UN ATTIMO!',
    desc: 'Finto reset di 1 secondo per tutti, poi nuovo timer casuale.'
  },
  ciro: {
    name: 'ULTIMO MOMENTO',
    desc: 'Se qualcun altro ha già fatto falsa partenza, vedi "ORA NON È ANCORA" per 1s.'
  }
};
