/**
 * Abilità di DODGEBALL DEI COGLIONI: una per personaggio, una volta a partita.
 */
export interface DodgeballAbility {
  name: string;
  desc: string;
}

export const DODGEBALL_ABILITIES: Record<string, DodgeballAbility> = {
  goblin: {
    name: 'NCULO!',
    desc: 'Schiva sporca: scatto imprevedibile con un attimo di invulnerabilità.'
  },
  buttafuori: {
    name: "MO M'IMPEGNO",
    desc: 'Per 5 secondi resisti ai colpi (vieni spinto ma non eliminato).'
  },
  dottore: {
    name: '20 KG IN UN MESE',
    desc: 'Per 5 secondi più veloce, ma se colpito voli molto più lontano.'
  },
  judoka: {
    name: 'IPPON',
    desc: "Onda d'urto: spinge via chi ti sta vicino e gli fa cadere la palla."
  },
  ciro: {
    name: 'PAGO DOPO',
    desc: 'Arma il rinvio: la prossima palla che ti prende viene respinta (ma resti stordito).'
  }
};
