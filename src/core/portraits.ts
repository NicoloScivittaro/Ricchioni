import Phaser from 'phaser';
import { CHARACTER_ORDER } from '../../shared/characters';
import { presentationOf } from '../../shared/characterPresentation';

/**
 * RITRATTI dei personaggi: UNA sola fonte (le illustrazioni in public/characters + il ritaglio della testa nel DNA del
 * personaggio), usata da lobby, risultati, classifica, podio (TV) e pannello controller / telefono (DOM). Cosi' i cinque
 * hanno ovunque la stessa faccia, non cinque versioni diverse.
 */

const SIZE = 256;

/** Chiave della texture del ritratto rotondo (creata in BootScene da createPortraitTextures). */
export function portraitKey(characterId: string | null | undefined): string | null {
  return characterId && presentationOf(characterId) ? `portrait_${characterId}` : null;
}

/** Ritaglia la testa di ogni personaggio in un cerchio con bordo nel suo colore (una volta, al boot). */
export function createPortraitTextures(scene: Phaser.Scene): void {
  for (const id of CHARACTER_ORDER) {
    const p = presentationOf(id);
    const key = `portrait_${id}`;
    if (!p || !scene.textures.exists(id) || scene.textures.exists(key)) continue;
    const src = scene.textures.get(id).getSourceImage() as HTMLImageElement;
    const tex = scene.textures.createCanvas(key, SIZE, SIZE);
    if (!tex) continue;
    const c = tex.getContext();
    const { cx, cy, r } = p.portrait;
    c.save();
    c.beginPath();
    c.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 6, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#1f2937';
    c.fillRect(0, 0, SIZE, SIZE);
    c.drawImage(src, cx - r, cy - r, r * 2, r * 2, 0, 0, SIZE, SIZE);
    c.restore();
    c.lineWidth = 10;
    c.strokeStyle = p.accent;
    c.beginPath();
    c.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 6, 0, Math.PI * 2);
    c.stroke();
    tex.refresh();
  }
}

/** Immagine del ritratto di diametro `d` (o l'icona emoji se manca la texture). */
export function addPortrait(scene: Phaser.Scene, x: number, y: number, characterId: string | null | undefined, d: number): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
  const key = portraitKey(characterId);
  if (key && scene.textures.exists(key)) return scene.add.image(x, y, key).setDisplaySize(d, d);
  return scene.add.text(x, y, presentationOf(characterId)?.icon ?? '🎮', { fontSize: `${Math.round(d * 0.8)}px` }).setOrigin(0.5);
}

export { portraitCss } from '../../shared/characterPresentation';
