import { AdvancedDynamicTexture, TextBlock, Control, StackPanel } from '@babylonjs/gui';
import { Scene } from '@babylonjs/core';
import { popCountdown } from '../../core/countdownFx';

/** HUD di CALCIO DEI DISAGIATI: tabellone + timer + countdown + feed. */
export class SoccerHud {
  private adt: AdvancedDynamicTexture;
  private scoreText: TextBlock;
  private timerText: TextBlock;
  private noteText: TextBlock;
  private countdownText: TextBlock;
  private feed: StackPanel;
  private feedTimers: number[] = [];

  constructor(scene: Scene, titleText = '⚽ CALCIO DEI DISAGIATI') {
    this.adt = AdvancedDynamicTexture.CreateFullscreenUI('soccerHud', true, scene);
    this.adt.idealHeight = 720; // l'HUD scala con lo schermo (720p = misure di progetto; 1080p/1440p/4K proporzionali)

    const title = new TextBlock('title', titleText);
    title.color = '#ffffff';
    title.fontSize = 34;
    title.fontFamily = '"Arial Black", Arial, sans-serif';
    title.top = '12px';
    title.height = '40px';
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.shadowColor = 'rgba(0,0,0,0.6)';
    this.adt.addControl(title);

    this.scoreText = new TextBlock('score', '🔴 ROSSI 0 — 0 BLU 🔵');
    this.scoreText.color = '#ffffff';
    this.scoreText.fontSize = 52;
    this.scoreText.fontFamily = '"Arial Black", Arial, sans-serif';
    this.scoreText.top = '48px';
    this.scoreText.height = '60px';
    this.scoreText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.scoreText.shadowColor = 'rgba(0,0,0,0.7)';
    this.scoreText.outlineWidth = 3;
    this.scoreText.outlineColor = 'black';
    this.adt.addControl(this.scoreText);

    this.timerText = new TextBlock('timer', '0:60');
    this.timerText.color = '#fbbf24';
    this.timerText.fontSize = 26;
    this.timerText.fontFamily = '"Arial Black", Arial, sans-serif';
    this.timerText.top = '104px';
    this.timerText.height = '30px';
    this.timerText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.timerText.shadowColor = 'rgba(0,0,0,0.6)';
    this.adt.addControl(this.timerText);

    this.noteText = new TextBlock('note', '');
    this.noteText.color = '#f87171';
    this.noteText.fontSize = 18;
    this.noteText.fontFamily = '"Arial Black", Arial, sans-serif';
    this.noteText.top = '132px';
    this.noteText.height = '24px';
    this.noteText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.noteText.shadowColor = 'rgba(0,0,0,0.6)';
    this.adt.addControl(this.noteText);

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
    this.feed.top = '166px'; // sotto tabellone, timer e nota
    this.feed.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.feed.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.adt.addControl(this.feed);
  }

  setScore(red: number, blue: number): void {
    // parole oltre ai colori: il tabellone si legge anche senza distinguere rosso e blu
    this.scoreText.text = `🔴 ROSSI ${red} — ${blue} BLU 🔵`;
  }

  setTimer(seconds: number): void {
    const s = Math.max(0, Math.ceil(seconds));
    this.timerText.text = `⏱ 0:${s.toString().padStart(2, '0')}`;
  }

  setNote(text: string, color = '#f87171'): void {
    this.noteText.text = text;
    this.noteText.color = color;
  }

  setCountdown(text: string, color = '#fbbf24'): void {
    this.countdownText.text = text;
    this.countdownText.color = color;
    if (text) popCountdown(this.countdownText, this.adt.getScene(), text === 'VIA!');
  }

  clearCountdown(): void {
    this.countdownText.text = '';
  }

  feedMessage(text: string, color = '#ffffff', ms = 2600): void {
    const t = new TextBlock('feedItem', text);
    t.color = color;
    t.fontSize = 28;
    t.fontFamily = '"Arial Black", Arial, sans-serif';
    t.shadowColor = 'rgba(0,0,0,0.7)';
    t.height = '36px';
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
