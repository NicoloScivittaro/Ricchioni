import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { game as gm } from '../../core/GameManager';
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
 *
 * Il menu ESC (pausa/ricomincia/lobby) qui NON può essere il PauseMenu
 * Phaser-based usato dagli altri minigiochi: il canvas Babylon ha z-index
 * 10000 e coprirebbe qualsiasi cosa disegnata da Phaser. È quindi un overlay
 * HTML dedicato (KartPauseMenu sotto), con z-index sopra il canvas Babylon.
 */
export class KartRaceScene extends Phaser.Scene {
  private game3d: BabylonKartGame | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private cancelled = false;
  private loadingText: Phaser.GameObjects.Text | null = null;
  private pauseMenu: KartPauseMenu | null = null;
  private escKey!: Phaser.Input.Keyboard.Key;

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

    this.pauseMenu = new KartPauseMenu(
      this,
      () => this.scene.restart({ ctx: data.ctx }),
      (visible) => {
        gm.setPaused(visible);
        this.game3d?.setPaused(visible);
      }
    );
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    gm.minigameLoadStarted();
    this.boot(data.ctx)
      .then(() => gm.minigameLoadFinished())
      .catch((err) => {
        if (!this.cancelled) gm.reportMinigameError(err);
      });
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      audio.select();
      this.pauseMenu?.toggle();
      this.game3d?.setPaused(this.pauseMenu?.isVisible() ?? false);
    }
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
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
  }
}

/** Overlay HTML del menu ESC per il kart 3D (sopra il canvas Babylon, z-index 10000). */
class KartPauseMenu {
  private root: HTMLDivElement;
  private visible = false;

  constructor(
    private scene: Phaser.Scene,
    onRestart: () => void,
    private onVisible: (visible: boolean) => void = () => {}
  ) {
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed; inset: 0; z-index: 20001; display: none;
      align-items: center; justify-content: center; background: rgba(0,0,0,0.72);
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #0b0b14; border: 2px solid rgba(255,255,255,0.15); border-radius: 20px;
      padding: 28px 36px; display: flex; flex-direction: column; gap: 12px;
      min-width: 320px; text-align: center; font-family: Arial, sans-serif;
    `;

    const title = document.createElement('div');
    title.textContent = '🏎️ RIBALTATI — PAUSA';
    title.style.cssText = 'color:#fbbf24; font-weight:900; font-size:20px; margin-bottom:8px;';
    panel.appendChild(title);

    panel.appendChild(
      this.makeButton('▶ RIPRENDI', '#4ade80', () => {
        this.hide();
      })
    );
    panel.appendChild(
      this.makeButton('🔄 RICOMINCIA MINIGIOCO', '#facc15', () => {
        if (!confirm('Vuoi davvero ricominciare il minigioco?')) return;
        this.hide();
        onRestart();
      })
    );
    panel.appendChild(
      this.makeButton('🏠 TORNA ALLA LOBBY', '#f87171', () => {
        if (!confirm('Vuoi davvero abbandonare il minigioco e tornare alla lobby?')) return;
        this.hide();
        gm.backToLobby();
        this.scene.scene.start('LobbyScene');
      })
    );

    panel.appendChild(
      this.makeButton('⏭ SALTA MINIGIOCO (NO PUNTI)', '#9ca3af', () => {
        if (!confirm('Saltare il minigioco SENZA assegnare punti e tornare al rullo?')) return;
        this.hide();
        gm.skipMinigame();
      })
    );

    this.root.appendChild(panel);
    document.body.appendChild(this.root);
  }

  private makeButton(label: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = `
      padding: 14px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.25);
      background: rgba(255,255,255,0.06); color: ${color}; font: 800 16px/1.2 Arial, sans-serif;
      cursor: pointer;
    `;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onClick();
    });
    return btn;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  show(): void {
    const was = this.visible;
    this.visible = true;
    this.root.style.display = 'flex';
    if (!was) this.onVisible(true);
  }

  hide(): void {
    const was = this.visible;
    this.visible = false;
    this.root.style.display = 'none';
    if (was) this.onVisible(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.root.remove();
  }
}
