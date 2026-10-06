import { Scene } from '@babylonjs/core';
import { GameHud } from '../hud/hudKit';

/**
 * HUD dei giochi a squadre (Calcio, Pallavolo): barra compatta in alto al centro — ROSSI ▲ n · timer · n ● BLU — con
 * colore + parola + simbolo (si legge anche senza distinguere rosso/blu). Sotto: riga di stato (GOLDEN GOAL, MATCH POINT).
 * La Pallavolo non ha timer: il riquadro centrale mostra il punteggio da raggiungere invece di un "0:00" fermo.
 */
export class SoccerHud extends GameHud {
  constructor(scene: Scene, titleText = '⚽ CALCIO DEI DISAGIATI') {
    super(scene, 'soccerHud', titleText);
    this.teamScoreBar();
  }
}
