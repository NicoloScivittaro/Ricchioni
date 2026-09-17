import Phaser from 'phaser';
import { game as gm } from './GameManager';
import { audio } from './AudioManager';
import type { InputManager } from '../network/InputManager';

type MenuMode = 'none' | 'main' | 'confirmRestart' | 'confirmLobby';

/**
 * Menu di pausa riutilizzabile (ESC): PAUSA → RIPRENDI / RICOMINCIA MINIGIOCO
 * / TORNA ALLA LOBBY, ciascuno con conferma. Ogni minigioco lo istanzia in
 * create() e lo interroga a inizio update():
 *
 *   this.pauseMenu = new PauseMenu(this, title, this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));
 *   ...
 *   update(...): void {
 *     if (this.pauseMenu.update()) return; // menu aperto: salta la logica di gioco
 *     ...
 *   }
 *
 * "Ricomincia" è specifico per minigioco (di solito scene.restart con lo
 * stesso ctx); "torna alla lobby" è sempre gm.backToLobby().
 */
export class PauseMenu {
  private mode: MenuMode = 'none';
  private index = 0;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private escKey: Phaser.Input.Keyboard.Key;
  private upKey: Phaser.Input.Keyboard.Key;
  private downKey: Phaser.Input.Keyboard.Key;
  private enterKey: Phaser.Input.Keyboard.Key;

  constructor(
    private scene: Phaser.Scene,
    private title: string,
    private input: InputManager,
    private onRestart: () => void
  ) {
    const kb = scene.input.keyboard!;
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.upKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  /** Da chiamare a inizio update(): true se il menu ha "consumato" il frame (salta la logica di gioco). */
  update(): boolean {
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.toggle();
    if (this.mode === 'none') return false;
    this.handleKeys();
    this.input.update();
    return true;
  }

  private toggle(): void {
    if (this.mode === 'none') this.open();
    else if (this.mode === 'main') this.close();
    else this.open();
  }

  private open(): void {
    this.mode = 'main';
    this.index = 0;
    this.render();
  }

  private close(): void {
    this.mode = 'none';
    this.clear();
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  private itemCount(): number {
    return this.mode === 'main' ? 3 : 2;
  }

  private render(): void {
    this.clear();
    const mk = (obj: Phaser.GameObjects.GameObject): void => {
      this.objects.push(obj);
    };
    mk(this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.72).setDepth(90));
    mk(
      this.scene.add
        .text(640, 160, this.title, { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '40px', color: '#fbbf24' })
        .setOrigin(0.5)
        .setDepth(91)
    );
    mk(
      this.scene.add
        .text(640, 208, 'PAUSA', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '28px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(91)
    );

    const items =
      this.mode === 'main'
        ? ['RIPRENDI', 'RICOMINCIA MINIGIOCO', 'TORNA ALLA LOBBY']
        : this.mode === 'confirmRestart'
          ? ['ANNULLA', 'RICOMINCIA']
          : ['ANNULLA', 'TORNA ALLA LOBBY'];

    if (this.mode !== 'main') {
      const msg =
        this.mode === 'confirmRestart'
          ? 'Vuoi davvero ricominciare il minigioco?'
          : 'Vuoi davvero abbandonare il minigioco e tornare alla lobby?';
      mk(
        this.scene.add
          .text(640, 270, msg, { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#e5e7eb', align: 'center', wordWrap: { width: 720 } })
          .setOrigin(0.5)
          .setDepth(91)
      );
    }

    items.forEach((label, i) => {
      const y = this.mode === 'main' ? 300 + i * 88 : 380 + i * 88;
      const sel = i === this.index;
      mk(
        this.scene.add
          .rectangle(640, y, 520, 62, sel ? 0xfbbf24 : 0x1f2937, sel ? 0.95 : 0.85)
          .setStrokeStyle(2, 0xffffff)
          .setDepth(91)
      );
      mk(
        this.scene.add
          .text(640, y, label, { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '24px', color: sel ? '#111827' : '#ffffff' })
          .setOrigin(0.5)
          .setDepth(92)
      );
    });
  }

  private handleKeys(): void {
    if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
      this.index = (this.index - 1 + this.itemCount()) % this.itemCount();
      audio.select();
      this.render();
    } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
      this.index = (this.index + 1) % this.itemCount();
      audio.select();
      this.render();
    } else if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.confirm();
    }
  }

  private confirm(): void {
    if (this.mode === 'main') {
      if (this.index === 0) {
        this.close();
      } else if (this.index === 1) {
        this.mode = 'confirmRestart';
        this.index = 0;
        this.render();
      } else {
        this.mode = 'confirmLobby';
        this.index = 0;
        this.render();
      }
    } else if (this.mode === 'confirmRestart') {
      if (this.index === 1) {
        audio.select();
        this.onRestart();
      } else {
        this.open();
      }
    } else {
      if (this.index === 1) {
        audio.select();
        gm.backToLobby();
        this.scene.scene.start('LobbyScene');
      } else {
        this.open();
      }
    }
  }
}
