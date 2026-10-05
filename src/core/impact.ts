import { HAPTIC } from './haptics';

/**
 * LINGUAGGIO COMUNE DEGLI IMPATTI (solo percezione: nessun numero di gameplay qui). Ogni categoria dice quanto "pesa" un
 * evento: hitstop VISIVO, scossa della camera, scala degli effetti, vibrazione, enfasi del suono. I giochi che avevano gia'
 * valori bilanciati li tengono (Arena: hitstop 0.08 s sull'eliminazione, ecc.): questo serve ai feedback NUOVI, perche'
 * un colpo leggero non sembri un'eliminazione e viceversa.
 *
 *   LIGHT        tocco, passaggio, colpo di striscio          hitstop 25 ms, niente scossa
 *   MEDIUM       colpo pieno, tackle riuscito, ricezione forte hitstop 40 ms, scossa minima
 *   HEAVY        smash, tiro caricato, botto grosso          hitstop 65 ms, scossa breve
 *   SUCCESS      punto/gol/kill per chi lo fa               nessun hitstop, flash + vibrazione positiva
 *   DASH         scatto, schivata, turbo                     nessun hitstop, scia
 *   ABILITY      attivazione abilita'                        nessun hitstop, scossa minima
 *   ELIMINATION  eliminazione                                hitstop 80 ms, scossa piu' forte
 */
export type ImpactKind = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'SUCCESS' | 'DASH' | 'ABILITY' | 'ELIMINATION';

export interface ImpactSpec {
  /** fermo visivo (s): mai sul tempo di gioco dei giochi che non lo usano gia' */
  hitstop: number;
  /** scossa della camera: ampiezza (unita' del gioco) e durata (ms); 0 = nessuna */
  shake: { amp: number; ms: number };
  /** moltiplicatore della dimensione/quantita' degli effetti */
  vfx: number;
  /** vibrazione (ms) per chi lo subisce/fa */
  rumble: number;
  /** enfasi del suono 0..1.5 (volume/intensita' relativa) */
  sound: number;
}

export const IMPACT: Record<ImpactKind, ImpactSpec> = {
  LIGHT: { hitstop: 0.025, shake: { amp: 0, ms: 0 }, vfx: 0.6, rumble: HAPTIC.LIGHT, sound: 0.5 },
  MEDIUM: { hitstop: 0.04, shake: { amp: 0.1, ms: 140 }, vfx: 1, rumble: HAPTIC.MEDIUM, sound: 0.8 },
  HEAVY: { hitstop: 0.065, shake: { amp: 0.28, ms: 220 }, vfx: 1.5, rumble: HAPTIC.HEAVY, sound: 1.1 },
  SUCCESS: { hitstop: 0, shake: { amp: 0, ms: 0 }, vfx: 1.2, rumble: HAPTIC.SUCCESS, sound: 1 },
  DASH: { hitstop: 0, shake: { amp: 0, ms: 0 }, vfx: 0.8, rumble: HAPTIC.LIGHT, sound: 0.6 },
  ABILITY: { hitstop: 0, shake: { amp: 0.06, ms: 120 }, vfx: 1.2, rumble: HAPTIC.MEDIUM, sound: 0.8 },
  ELIMINATION: { hitstop: 0.08, shake: { amp: 0.42, ms: 280 }, vfx: 1.6, rumble: HAPTIC.HEAVY, sound: 1.2 }
};

/** Categoria di un colpo dalla sua forza normalizzata (0 = sfiorato, 1 = il massimo che il gioco produce). */
export function impactOf(strength: number): 'LIGHT' | 'MEDIUM' | 'HEAVY' {
  return strength >= 0.7 ? 'HEAVY' : strength >= 0.35 ? 'MEDIUM' : 'LIGHT';
}

// ---- RALLENTATORE DI DEBUG (0.25x / 0.5x / 1x) ----
// Solo con l'overlay di debug (tasto T in dev o con ?debug=1, vedi core/debug): scala il tempo di TUTTI i giochi 3D (stesso
// passo di simulazione per grafica e gameplay, quindi la sincronia animazione/evento si osserva identica, solo piu' lenta).
// In produzione normale vale sempre 1.
let timeScale = 1;
export function getTimeScale(): number {
  return timeScale;
}
export function setTimeScale(s: number): void {
  timeScale = s === 0.25 || s === 0.5 ? s : 1;
}
