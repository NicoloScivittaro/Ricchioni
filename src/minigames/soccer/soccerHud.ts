import { Scene } from '@babylonjs/core';
import { Control, TextBlock } from '@babylonjs/gui';
import { GameHud, hudText } from '../hud/hudKit';

/**
 * HUD dei giochi a squadre (Calcio, Pallavolo): barra compatta in alto al centro — ROSSI ▲ n · timer · n ● BLU — con
 * colore + parola + simbolo (si legge anche senza distinguere rosso/blu). Sotto: riga di stato (GOLDEN GOAL, MATCH POINT).
 * La Pallavolo non ha timer: il riquadro centrale mostra il punteggio da raggiungere invece di un "0:00" fermo.
 */
export class SoccerHud extends GameHud {
  private action: TextBlock | null = null;
  private actionTime = 0;
  constructor(scene: Scene, titleText = '⚽ CALCIO DEI DISAGIATI') {
    super(scene, 'soccerHud', titleText);
    this.teamScoreBar();
  }
  /** Una sola riga, creata solo dal Calcio: non copre il campo e non modifica la Pallavolo. */
  actionFeedback(text: string, color: string, ms = 1400): void {
    if (!this.action) {
      this.action = hudText('soccerAction', '', 18, color);
      this.action.width = '650px'; this.action.height = '26px'; this.action.top = '-105px';
      this.action.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      this.adt.addControl(this.action);
      const scene = this.adt.getScene()!;
      scene.onBeforeRenderObservable.add(() => {
        this.actionTime = Math.max(0, this.actionTime - scene.getEngine().getDeltaTime());
        if (this.actionTime === 0) this.action!.text = '';
      });
    }
    this.action.text = text; this.action.color = color; this.actionTime = ms;
  }
}
