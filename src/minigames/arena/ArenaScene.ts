import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { game as gm } from '../../core/GameManager';
import type { MinigameContext } from '../types';
import type { BabylonArenaGame } from './BabylonArenaGame';

/**
 * Wrapper Phaser per ARENA DEL DISAGIO (3D Babylon.js su canvas dedicato).
 * Stessa architettura del kart 3D: la scena Phaser gestisce solo il ciclo di
 * vita (canvas + motore + menu ESC HTML), Babylon guida il render loop.
 */
export class ArenaScene extends Phaser.Scene {
  private game3d: BabylonArenaGame | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private cancelled = false;
  private loadingText: Phaser.GameObjects.Text | null = null;
  private pauseMenu: ArenaPauseMenu | null = null;
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('arena');
  }

  create(data: { ctx: MinigameContext }): void {
    this.cancelled = false;
    this.cameras.main.setBackgroundColor('#0b0b14');
    audio.unlock();

    this.loadingText = this.add
      .text(640, 360, 'Caricamento ARENA DEL DISAGIO…', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '28px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    this.pauseMenu = new ArenaPauseMenu(this, () => this.scene.restart({ ctx: data.ctx }));
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    void this.boot(data.ctx);
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      audio.select();
      this.pauseMenu?.toggle();
      this.game3d?.setPaused(this.pauseMenu?.isVisible() ?? false);
    }
  }

  private async boot(ctx: MinigameContext): Promise<void> {
    const { BabylonArenaGame } = await import('./BabylonArenaGame');
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

    this.game3d = new BabylonArenaGame(canvas, ctx);
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

/** Overlay HTML del menu ESC (sopra il canvas Babylon, z-index 10000). */
class ArenaPauseMenu {
  private root: HTMLDivElement;
  private visible = false;

  constructor(
    private scene: Phaser.Scene,
    onRestart: () => void
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
    title.textContent = '🤼 ARENA DEL DISAGIO — PAUSA';
    title.style.cssText = 'color:#fbbf24; font-weight:900; font-size:20px; margin-bottom:8px;';
    panel.appendChild(title);

    panel.appendChild(
      this.makeButton('▶ RIPRENDI', '#4ade80', () => this.hide())
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
    this.visible = true;
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.root.style.display = 'none';
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.root.remove();
  }
}
