import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { THEME, titleText, bodyText, sceneIn } from '../core/theme';

/** Stacco BREVE "ROUND N" prima del rullo (niente countdown: il rullo e l'intro hanno già il loro). */
export class NextRoundScene extends Phaser.Scene {
  constructor() {
    super('NextRoundScene');
  }

  create(): void {
    sceneIn(this);
    const next = (gm.state?.round ?? 0) + 1;
    const t = titleText(this, 640, 320, `ROUND ${next}`, 96, THEME.text).setScale(0.6).setAlpha(0);
    const sub = bodyText(this, 640, 410, 'Si gira!', 26, THEME.gold).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: THEME.normal, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: THEME.normal, delay: 160 });
    audio.tick();
  }
}
