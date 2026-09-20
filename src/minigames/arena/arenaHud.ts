import { AdvancedDynamicTexture, TextBlock, Control, StackPanel } from '@babylonjs/gui';
import { Scene } from '@babylonjs/core';
import { popCountdown } from '../../core/countdownFx';

/** HUD minimale ma leggibile (Babylon GUI fullscreen). */
export class ArenaHud {
  private adt: AdvancedDynamicTexture;
  private aliveText: TextBlock;
  private modifierText: TextBlock;
  private countdownText: TextBlock;
  private feed: StackPanel;
  private feedTimers: number[] = [];

  constructor(scene: Scene, titleText = '🤼 ARENA DEL DISAGIO') {
    this.adt = AdvancedDynamicTexture.CreateFullscreenUI('arenaHud', true, scene);

    const title = new TextBlock('title', titleText);
    title.color = '#ffffff';
    title.fontSize = 40;
    title.fontFamily = '"Arial Black", Arial, sans-serif';
    title.top = '18px';
    title.height = '46px';
    title.shadowColor = 'rgba(0,0,0,0.6)';
    this.adt.addControl(title);

    this.modifierText = new TextBlock('modifier', '');
    this.modifierText.color = '#f87171';
    this.modifierText.fontSize = 20;
    this.modifierText.fontFamily = '"Arial Black", Arial, sans-serif';
    this.modifierText.top = '64px';
    this.modifierText.height = '26px';
    this.modifierText.shadowColor = 'rgba(0,0,0,0.6)';
    this.adt.addControl(this.modifierText);

    this.aliveText = new TextBlock('alive', 'IN GARA: 5');
    this.aliveText.color = '#4ade80';
    this.aliveText.fontSize = 24;
    this.aliveText.fontFamily = '"Arial Black", Arial, sans-serif';
    this.aliveText.top = '18px';
    this.aliveText.left = '-24px';
    this.aliveText.height = '40px';
    this.aliveText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.aliveText.shadowColor = 'rgba(0,0,0,0.6)';
    this.adt.addControl(this.aliveText);

    this.countdownText = new TextBlock('countdown', '');
    this.countdownText.color = '#fbbf24';
    this.countdownText.fontSize = 140;
    this.countdownText.fontFamily = '"Arial Black", Arial, sans-serif';
    this.countdownText.shadowColor = 'rgba(0,0,0,0.7)';
    this.countdownText.outlineWidth = 4;
    this.countdownText.outlineColor = 'black';
    this.adt.addControl(this.countdownText);

    this.feed = new StackPanel('feed');
    this.feed.isVertical = true;
    this.feed.top = '80px';
    this.feed.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.feed.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.adt.addControl(this.feed);
  }

  setAlive(n: number): void {
    this.aliveText.text = `IN GARA: ${n}`;
    this.aliveText.color = n <= 1 ? '#fbbf24' : '#4ade80';
  }

  setModifier(label: string | null): void {
    this.modifierText.text = label ? `⚠️ ${label}` : '';
  }

  setCountdown(text: string, color = '#fbbf24'): void {
    this.countdownText.text = text;
    this.countdownText.color = color;
    if (text) popCountdown(this.countdownText, this.adt.getScene(), text === 'VIA!');
  }

  clearCountdown(): void {
    this.countdownText.text = '';
  }

  /** Messaggio temporaneo in cima (eliminazioni, abilità). */
  feedMessage(text: string, color = '#ffffff', ms = 2600): void {
    const t = new TextBlock('feedItem', text);
    t.color = color;
    t.fontSize = 30;
    t.fontFamily = '"Arial Black", Arial, sans-serif';
    t.shadowColor = 'rgba(0,0,0,0.7)';
    t.height = '38px';
    t.paddingBottom = '6px';
    this.feed.addControl(t);
    while (this.feed.children.length > 4) {
      const first = this.feed.children[0];
      this.feed.removeControl(first);
      first.dispose();
    }
    const timer = window.setTimeout(() => {
      try {
        this.feed.removeControl(t);
        t.dispose();
      } catch {
        /* già rimosso */
      }
    }, ms);
    this.feedTimers.push(timer);
  }

  dispose(): void {
    for (const id of this.feedTimers) window.clearTimeout(id);
    this.feedTimers = [];
    this.adt.dispose();
  }
}
