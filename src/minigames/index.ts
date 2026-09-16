import Phaser from 'phaser';
import type { MinigameSceneModule } from './types';

/**
 * AUTO-DISCOVERY delle scene Phaser dei minigiochi (lato host).
 * Le definizioni (metadata + controllerLayout) vivono in shared/minigames.ts
 * e sono usate dal server; qui raccogliamo solo le scene per il rendering.
 */
const modules = import.meta.glob<{ default: MinigameSceneModule }>('./*/index.ts', {
  eager: true
});

export const MINIGAME_SCENES: (typeof Phaser.Scene)[] = [];
export const SCENE_KEY_TO_SCENE = new Map<string, typeof Phaser.Scene>();

for (const path of Object.keys(modules).sort()) {
  const mod = modules[path].default;
  MINIGAME_SCENES.push(mod.scene);
  SCENE_KEY_TO_SCENE.set(mod.sceneKey, mod.scene);
}
