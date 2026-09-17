/**
 * Abilità di DODGEBALL DEI COGLIONI: una per personaggio, una volta a partita.
 */
export interface DodgeballAbility {
  name: string;
  desc: string;
}

export const DODGEBALL_ABILITIES: Record<string, DodgeballAbility> = {
  goblin: {
    name: "N'CULO, RIPIGLIATELA!",
    desc: 'Parata a timing: se intercetti bene una palla, la rimandi al mittente più veloce. Sbagli e vieni colpito.'
  },
  buttafuori: {
    name: 'OCCHIO DA POLIGONO',
    desc: 'Per qualche secondo vedi la traiettoria precisa del tuo lancio; il primo tiro è più teso e veloce.'
  },
  dottore: {
    name: 'TRE MESI DOPO',
    desc: 'Per qualche secondo vedi le traiettorie delle palle in arrivo. Se colpito: ERA SOLO UN PERIODO.'
  },
  judoka: {
    name: 'CARICO E SCARICO',
    desc: 'Modalità camion: scatto lungo che raccoglie fino a 2 palloni, poi li spari in rapida successione.'
  },
  ciro: {
    name: 'PAGO DOMANI',
    desc: "Il colpo che ti eliminerebbe diventa un DEBITO: colpisci qualcuno in tempo o arriva l'esattore."
  }
};
