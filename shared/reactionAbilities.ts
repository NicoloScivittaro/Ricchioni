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
    name: "M'HO SVEJATO",
    desc: "Una volta a partita, durante l'attesa: apri un FOCUS di 2 secondi. Se il VIA cade dentro senti la vibrazione e la TV lo annuncia; se no, sprecata. Il tuo tempo parte sempre dal VIA vero."
  },
  judoka: {
    name: 'ASPETTA UN ATTIMO!',
    desc: 'Finto reset di 1 secondo per tutti, poi nuovo timer casuale.'
  },
  ciro: {
    name: 'ULTIMO SECONDO',
    desc: "Una volta a partita, durante l'attesa: resti in guardia per il round. Se parte un falso allarme o qualcuno sbaglia, il telefono ti dice NON È ANCORA FINITA. Non sai quando arriva il VIA."
  }
};
