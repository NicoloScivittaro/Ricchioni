import Phaser from 'phaser';

const KC = Phaser.Input.Keyboard.KeyCodes;

/**
 * Mappa i tasti dei 5 giocatori su uno schermo singolo.
 * Ogni giocatore ha 4 tasti → opzioni A/B/C/D.
 * (Layout provvisorio: il supporto gamepad e i controller telefono arrivano dopo.)
 */
export const PLAYER_KEYS: number[][] = [
  [KC.A, KC.S, KC.D, KC.F], // P1
  [KC.G, KC.H, KC.J, KC.K], // P2
  [KC.LEFT, KC.UP, KC.DOWN, KC.RIGHT], // P3
  [KC.ONE, KC.TWO, KC.THREE, KC.FOUR], // P4
  [KC.NUMPAD_ONE, KC.NUMPAD_TWO, KC.NUMPAD_THREE, KC.NUMPAD_FOUR] // P5
];

/** Traduce un keyCode in (indice giocatore, indice opzione). */
export function resolveKey(keyCode: number): { player: number; option: number } | null {
  for (let p = 0; p < PLAYER_KEYS.length; p++) {
    const o = PLAYER_KEYS[p].indexOf(keyCode);
    if (o >= 0) return { player: p, option: o };
  }
  return null;
}

export function playerKeyLabels(playerIndex: number): string[] {
  const codes = PLAYER_KEYS[playerIndex] ?? [];
  return codes.map((c) => {
    for (const k of Object.keys(KC)) {
      if ((KC as unknown as Record<string, number>)[k] === c) return k;
    }
    return String(c);
  });
}
