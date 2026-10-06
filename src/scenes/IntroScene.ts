import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getMinigame } from '../../shared/minigames';
import { FLOW_TIMING } from '../../shared/types';
import { THEME, titleText, bodyText, sceneIn } from '../core/theme';
import { UI } from '../core/uiTokens';
import { pill } from '../core/uiPhaser';
import { pads } from '../input/GamepadManager';

/**
 * INTRO del minigioco: icona, nome, categoria, frase e "PREPARATE I TELEFONI" con barra di avanzamento.
 * Niente 3-2-1 qui: il conto alla rovescia (con audio, vibrazione e flash) sta nei giochi in tempo reale,
 * così non si conta due volte prima di poter giocare.
 */
export class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  create(): void {
    sceneIn(this);
    const pick = gm.pendingMinigame;
    if (!pick) {
      this.scene.start('RoomScene');
      return;
    }
    const def = getMinigame(pick.minigameId);

    const icon = this.add.text(640, 150, def?.icon ?? '🎮', { fontSize: '96px' }).setOrigin(0.5).setScale(0.5).setAlpha(0);
    const name = titleText(this, 640, 265, pick.name, pick.name.length > 26 ? 52 : UI.size.XL + 4, THEME.text).setStroke(UI.outline.color, UI.outline.thick).setAlpha(0);
    const cat = pill(this, 640, 336, pick.category, THEME.gold, UI.size.S).setAlpha(0);
    const desc = bodyText(this, 640, 396, def?.description ?? 'Usa il telefono per giocare', UI.size.S + 4, THEME.textDim).setWordWrapWidth(1080).setAlpha(0);
    this.tweens.add({ targets: icon, alpha: 1, scale: 1, duration: THEME.normal, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [name, cat, desc], alpha: 1, duration: THEME.normal, delay: 120 });

    if (pick.modifierId) {
      pill(this, 640, 452, `⚠ ${pick.modifierName}${pick.modifierDescription ? ` — ${pick.modifierDescription}` : ''}`, UI.color.warning, UI.size.S);
    }

    // cosa prendere in mano: il CONTROLLER se c'e' (e il gioco lo usa), il telefono solo dove serve davvero
    const usePads = pads.pairedCount() > 0 && def?.inputMode === 'GAMEPAD';
    const label = titleText(this, 640, 545, def?.inputMode === 'PHONE_TEXT' ? '📱 PRENDETE I TELEFONI' : usePads ? '🎮 PRENDETE I CONTROLLER' : '📱 PREPARATE I TELEFONI', UI.size.L, THEME.text);
    this.tweens.add({ targets: label, scale: 1.05, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // barra che si riempie fino al VIA
    this.add.rectangle(640, 610, 420, 10, THEME.line).setOrigin(0.5);
    const bar = this.add.rectangle(430, 610, 4, 10, THEME.goldInt).setOrigin(0, 0.5);
    this.tweens.add({ targets: bar, displayWidth: 420, duration: FLOW_TIMING.introMs - 200, ease: 'Linear' });
    // stinger del gioco (se non e' gia' suonato allo stop del rullo, es. gioco scelto dall'host senza rullo)
    if (pick.minigameId && !audio.recentSting(pick.minigameId)) audio.gameSting(pick.minigameId, pick.minigameId === 'fps' || pick.minigameId === 'kart3d');
  }
}
