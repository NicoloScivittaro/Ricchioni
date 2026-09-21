import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { game as gm } from '../../core/GameManager';
import { showLoading } from '../../core/theme';
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
  private hideLoading: (() => void) | null = null;
  private pauseMenu: ArenaPauseMenu | null = null;
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('arena');
  }

  create(data: { ctx: MinigameContext }): void {
    this.cancelled = false;
    this.cameras.main.setBackgroundColor('#0b0b14');
    audio.unlock();

    this.hideLoading = showLoading(this, '🤼', 'ARENA DEL DISAGIO');

    this.pauseMenu = new ArenaPauseMenu(
      this,
      () => {
        data.ctx.input.reset(); // tasti/abilità tenuti prima del riavvio non passano al gioco nuovo
        this.scene.restart({ ctx: data.ctx });
      },
      (visible) => {
        gm.setPaused(visible);
        this.game3d?.setPaused(visible);
      }
    );
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC); // cattura il tasto (niente scroll)
    this.input.keyboard!.on('keydown-ESC', (e: KeyboardEvent) => {
      if (!e.repeat) this.toggleMenu();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    gm.minigameLoadStarted();
    this.boot(data.ctx)
      .then(() => gm.minigameLoadFinished())
      .catch((err) => {
        if (!this.cancelled) gm.reportMinigameError(err);
      });
  }

  /** ESC a evento keydown (JustDown perde il tasto se down+up cadono nello stesso frame: PC host lenti). */
  private toggleMenu(): void {
    audio.select();
    this.pauseMenu?.toggle();
    this.game3d?.setPaused(this.pauseMenu?.isVisible() ?? false);
  }

  private async boot(ctx: MinigameContext): Promise<void> {
    const { BabylonArenaGame } = await import('./BabylonArenaGame');
    if (this.cancelled) return;

    this.hideLoading?.();
    this.hideLoading = null;

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
    try {
      this.game3d?.dispose();
    } catch (e) {
      console.warn('[cleanup] dispose 3D fallito', e);
    }
    this.game3d = null;
    this.overlayCanvas?.remove();
    this.overlayCanvas = null;
    this.hideLoading?.();
    this.hideLoading = null;
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
        if (!confirm('Tornare alla lobby? Il minigioco viene annullato e i punteggi ripartono da zero, ma restano tutti in stanza.')) return;
        this.hide();
        gm.restartMatch(); // stessa stanza, stessi giocatori: l'host passa da solo alla RoomScene
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
