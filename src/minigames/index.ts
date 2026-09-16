import Phaser from 'phaser';
import { MinigameRegistry } from '../core/MinigameRegistry';
import type { MinigameModule } from './types';

/**
 * AUTO-DISCOVERY dei minigiochi.
 * Per aggiungere un gioco: crea la cartella minigames/<nome>/index.ts che esporta
 * un MinigameModule di default. Qui sotto non cambia nulla.
 */
const modules = import.meta.glob<{ default: MinigameModule }>('./*/index.ts', {
  eager: true
});

export const MINIGAME_SCENES: (typeof Phaser.Scene)[] = [];

for (const path of Object.keys(modules).sort()) {
  const mod = modules[path].default;
  MinigameRegistry.register(mod.definition);
  MINIGAME_SCENES.push(mod.scene);
}
