/**
 * Abilità di CALCIO DEI DISAGIATI: una per personaggio, una volta a partita.
 */
export interface SoccerAbility {
  name: string;
  desc: string;
}

export const SOCCER_ABILITIES: Record<string, SoccerAbility> = {
  goblin: {
    name: 'TRIVELA DEL GOBLIN',
    desc: 'Il prossimo tiro ha una curva accentuata, impossibile da leggere.'
  },
  buttafuori: {
    name: 'OCCHIO DA POLIGONO',
    desc: 'Per qualche secondo vedi la traiettoria del tiro e il primo è più teso e preciso.'
  },
  dottore: {
    name: '20 KG IN UN MESE',
    desc: 'Per qualche secondo più veloce, ma contrasti deboli e più facile da spostare.'
  },
  judoka: {
    name: 'CARICO E SCARICO',
    desc: 'Una carica fisica: se colpisci il portatore di palla, gliela rubi e lo sposti.'
  },
  ciro: {
    name: 'PAGO DOMANI',
    desc: 'Armato per qualche secondo: il primo contrasto che subisci non ti toglie la palla.'
  }
};
