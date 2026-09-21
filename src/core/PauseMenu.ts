import Phaser from 'phaser';
import { game as gm } from './GameManager';
import { audio } from './AudioManager';
import { telemetry } from './telemetry';
import type { InputManager } from '../network/InputManager';

type MenuMode = 'none' | 'main' | 'confirmRestart' | 'confirmLobby' | 'confirmSkip';

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
 * stesso ctx); "torna alla lobby" è sempre gm.restartMatch() (stessa stanza, giocatori mantenuti).
 */
export class PauseMenu {
  private mode: MenuMode = 'none';
  private index = 0;
  private objects: Phaser.GameObjects.GameObject[] = [];
  /**
   * Tasti premuti dall'ultimo frame. Eventi keydown invece di JustDown(): Phaser azzera _justDown se
   * pressione e rilascio cadono nello stesso frame, e su un PC host lento un colpetto su ESC andava perso.
   */
  private pressed = new Set<string>();

  constructor(
    private scene: Phaser.Scene,
    private title: string,
    private input: InputManager,
    private onRestart: () => void
  ) {
    const kb = scene.input.keyboard!;
    kb.addCapture('ESC,UP,DOWN,ENTER');
    for (const name of ['ESC', 'UP', 'DOWN', 'ENTER']) {
      kb.on(`keydown-${name}`, (e: KeyboardEvent) => {
        if (!e.repeat) this.pressed.add(name);
      });
    }
  }

  private took(name: string): boolean {
    return this.pressed.delete(name);
  }

  /** Da chiamare a inizio update(): true se il menu ha "consumato" il frame (salta la logica di gioco). */
  update(): boolean {
    if (this.took('ESC')) this.toggle();
    if (this.mode === 'none') {
      this.pressed.clear();
      return false;
    }
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
    if (this.mode === 'none') gm.setPaused(true);
    this.mode = 'main';
    this.index = 0;
    this.render();
  }

  private close(): void {
    this.mode = 'none';
    gm.setPaused(false);
    this.clear();
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  private itemCount(): number {
    return this.mode === 'main' ? 4 : 2;
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
        ? ['RIPRENDI', 'RICOMINCIA MINIGIOCO', 'TORNA ALLA LOBBY', 'SALTA MINIGIOCO (NO PUNTI)']
        : this.mode === 'confirmRestart'
          ? ['ANNULLA', 'RICOMINCIA']
          : this.mode === 'confirmSkip'
            ? ['ANNULLA', 'SALTA MINIGIOCO']
            : ['ANNULLA', 'TORNA ALLA LOBBY'];

    if (this.mode !== 'main') {
      const msg =
        this.mode === 'confirmRestart'
          ? 'Vuoi davvero ricominciare il minigioco?'
          : this.mode === 'confirmSkip'
            ? 'Saltare il minigioco SENZA assegnare punti e tornare al rullo?'
            : 'Tornare alla lobby? Il minigioco viene annullato e i punteggi ripartono da zero, ma restano tutti in stanza.';
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
    if (this.took('UP')) {
      this.index = (this.index - 1 + this.itemCount()) % this.itemCount();
      audio.select();
      this.render();
    } else if (this.took('DOWN')) {
      this.index = (this.index + 1) % this.itemCount();
      audio.select();
      this.render();
    } else if (this.took('ENTER')) {
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
      } else if (this.index === 2) {
        this.mode = 'confirmLobby';
        this.index = 0;
        this.render();
      } else {
        this.mode = 'confirmSkip';
        this.index = 0;
        this.render();
      }
    } else if (this.mode === 'confirmSkip') {
      if (this.index === 1) {
        audio.select();
        this.mode = 'none';
        this.clear();
        gm.skipMinigame();
      } else {
        this.open();
      }
    } else if (this.mode === 'confirmRestart') {
      if (this.index === 1) {
        audio.select();
        gm.setPaused(false);
        this.input.reset();
        telemetry.mark('restart');
        this.onRestart();
      } else {
        this.open();
      }
    } else {
      if (this.index === 1) {
        audio.select();
        this.mode = 'none';
        this.clear();
        gm.restartMatch(); // stessa stanza, stessi giocatori: l'host passa da solo alla RoomScene
      } else {
        this.open();
      }
    }
  }
}
