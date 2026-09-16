import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import type { MinigameContext } from '../types';
import type { BabylonKartGame } from './BabylonKartGame';

/**
 * Wrapper Phaser per il minigioco 3D "RIBALTATI — CIRCUITO DEL LITORALE".
 * Il rendering vero e proprio è delegato a Babylon.js su un <canvas> dedicato,
 * sovrapposto al canvas di Phaser mentre questa scena è attiva: Babylon guida
 * il proprio render loop, questa scena Phaser gestisce solo il ciclo di vita
 * (creazione/distruzione del canvas e del motore 3D) restando compatibile con
 * il resto dell'architettura (ctx.input, ctx.finish, transizioni di scena).
 *
 * Babylon.js viene importato dinamicamente (non in cima al file): così resta
 * in un chunk separato, scaricato solo quando questo minigioco viene davvero
 * selezionato, invece di appesantire il caricamento iniziale di tutto il party
 * game (lobby + altri minigiochi) con una libreria 3D che non usano.
 */
export class KartRaceScene extends Phaser.Scene {
  private game3d: BabylonKartGame | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private cancelled = false;
  private loadingText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('kart3d');
  }

  create(data: { ctx: MinigameContext }): void {
    this.cancelled = false;
    this.cameras.main.setBackgroundColor('#0b0b14');
    audio.unlock();

    this.loadingText = this.add
      .text(640, 360, 'Caricamento circuito 3D…', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '28px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    void this.boot(data.ctx);
  }

  private async boot(ctx: MinigameContext): Promise<void> {
    const { BabylonKartGame } = await import('./BabylonKartGame');
    if (this.cancelled) return;

    this.loadingText?.destroy();
    this.loadingText = null;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '10000';
    canvas.style.touchAction = 'none';
    canvas.style.outline = 'none';
    document.body.appendChild(canvas);
    this.overlayCanvas = canvas;

    this.game3d = new BabylonKartGame(canvas, ctx);
  }

  private cleanup(): void {
    this.cancelled = true;
    this.game3d?.dispose();
    this.game3d = null;
    this.overlayCanvas?.remove();
    this.overlayCanvas = null;
    this.loadingText?.destroy();
    this.loadingText = null;
  }
}
