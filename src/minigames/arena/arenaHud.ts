import { Scene } from '@babylonjs/core';
import { GameHud } from '../hud/hudKit';
import type { HudPlayer } from '../hud/hudKit';
import { UI } from '../../core/uiTokens';

/**
 * HUD dei giochi tutti-contro-tutti (Arena, Dodgeball): costruito sul kit comune (hud/hudKit.ts).
 * In alto: chip del gioco (piccolo) a sinistra, IN GARA a destra; in basso la striscia dei giocatori (chi e' fuori si spegne).
 * Il centro dello schermo resta libero per l'arena.
 */
export class ArenaHud extends GameHud {
  private suddenDeath = false;

  setSuddenDeath(): void { this.suddenDeath = true; }
  constructor(scene: Scene, titleText = '🤼 ARENA DEL DISAGIO') {
    super(scene, 'arenaHud', titleText);
  }

  setAlive(n: number, total?: number): void {
    const prefix = this.suddenDeath ? '🔥 SUDDEN DEATH' : 'IN GARA';
    this.setRight(total ? `${prefix} ${n}/${total}` : `${prefix} ${n}`, this.suddenDeath || n <= 2 ? UI.color.accent : UI.color.success);
  }

  /** Striscia giocatori in basso (icona, nome, stato). */
  setPlayers(players: HudPlayer[]): void {
    this.playerStrip(players);
  }
}
