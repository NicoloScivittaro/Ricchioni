/**
 * CATEGORIE DI FEEDBACK APTICO (ms), comuni a tutti i minigiochi. Si passano a `ctx.vibrate(playerId, HAPTIC.X)`: la stessa chiamata
 * va al CONTROLLER se il giocatore sta giocando col controller, altrimenti al TELEFONO (mai a entrambi — vedi GameManager.vibrate e
 * controller/main.ts phoneIsOnTable). I valori sono quelli che i giochi usavano gia': nessun gioco cambia sensazione adottandoli.
 */
export const HAPTIC = {
  /** tocco leggero: conferma di un'azione propria (dash, tap) */
  LIGHT: 25,
  /** evento normale: VIA, cambio fase, colpo dato */
  MEDIUM: 70,
  /** evento forte: eliminazione, KO, caduta */
  HEAVY: 130,
  /** esito positivo per chi lo provoca: kill, punto segnato */
  SUCCESS: 40,
  /** danno subito */
  DAMAGE: 90
} as const;

export type HapticKind = keyof typeof HAPTIC;
