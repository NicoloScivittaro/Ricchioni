/**
 * Abilità di PALLAVOLO DEI DISAGIATI: una per personaggio, una volta a partita.
 */
export interface VolleyballAbility {
  name: string;
  desc: string;
}

export const VOLLEYBALL_ABILITIES: Record<string, VolleyballAbility> = {
  goblin: {
    name: 'JÄGER BOMB',
    desc: 'Il prossimo smash perfetto diventa potentissimo. Se sbagli il timing, è sprecata.'
  },
  buttafuori: {
    name: 'MURO DEL POLIGONO',
    desc: 'Per qualche secondo vedi la zona di caduta precisa; il primo muro/ricezione è più stabile.'
  },
  dottore: {
    name: '20 KG IN UN MESE',
    desc: 'Per qualche secondo salti più alto e ti muovi più veloce, ma gli atterraggi sono più scivolosi.'
  },
  judoka: {
    name: 'CARICO E SCARICO',
    desc: 'Per qualche secondo grande accelerazione laterale per recuperare palloni lontani, poi colpo più forte.'
  },
  ciro: {
    name: 'PAGO DOMANI',
    desc: 'Una volta: se stai per perdere il punto su una palla vicina a te, hai 1 secondo extra per un salvataggio disperato.'
  }
};
