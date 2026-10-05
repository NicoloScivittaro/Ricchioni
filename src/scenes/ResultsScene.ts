import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';
import { FLOW_TIMING } from '../../shared/types';
import type { PlayerResult, RoundResults } from '../../shared/types';
import { THEME, medal, panel, titleText, bodyText, hexInt, sceneIn } from '../core/theme';
import { confetti } from './confetti';
import { addPortrait } from '../core/portraits';
import { bark } from '../../shared/characterPresentation';

const ROW_H = 84;
const ROW_W = 980;
const TOP = 168;

/**
 * Risultati del minigioco, DALL'ULTIMO AL PRIMO, con 1-3 statistiche pertinenti per giocatore
 * (es. "7/10 corrette", "tempo 1:12.3 · miglior giro 0:24.1") e i punti partita assegnati.
 */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('ResultsScene');
  }

  create(): void {
    sceneIn(this);
    const st = gm.state;
    const out = st?.lastResults;
    if (!st || !out || out.results.length === 0) {
      this.scene.start('RoomScene');
      return;
    }

    titleText(this, 640, 50, 'RISULTATI', 50, THEME.text);
    const gameName = st.currentMinigame?.name;
    if (gameName) bodyText(this, 640, 98, gameName, 22, THEME.muted);
    if (out.double) bodyText(this, 640, 124, '⚡ PUNTI DOPPI', 20, THEME.gold);

    // Rivelazione dall'ultimo al primo.
    const revealOrder = [...out.results].sort((a, b) => b.placement - a.placement);
    let t = 250;
    for (const r of revealOrder) {
      if (r.placement === 1) t += FLOW_TIMING.revealWinnerDelayMs;
      const at = t;
      this.time.delayedCall(at, () => this.reveal(r, out));
      t += FLOW_TIMING.revealStepMs;
    }

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') gm.skip();
    });
  }

  private reveal(r: PlayerResult, out: RoundResults): void {
    const st = gm.state;
    if (!st) return;
    const player = st.players.find((p) => p.id === r.playerId);
    const c = player?.characterId ? getCharacter(player.characterId) : null;
    const color = c?.color ?? '#ffffff';
    const delta = out.deltas[r.playerId] ?? 0;
    const isWinner = r.placement === 1;
    const idx = out.results.length - r.placement; // 0 per l'ultimo
    const y = TOP + idx * (ROW_H + 8) + ROW_H / 2;

    const row = this.add.container(640 + 60, y).setAlpha(0);
    const bg = panel(this, 0, 0, ROW_W, ROW_H, {
      fill: isWinner ? 0x2a2410 : THEME.panel,
      stroke: isWinner ? THEME.goldInt : hexInt(color),
      strokeWidth: isWinner ? 4 : 2
    });
    const place = this.add
      .text(-ROW_W / 2 + 50, 0, medal(r.placement), { fontFamily: THEME.title, fontSize: isWinner ? '44px' : '36px', color: THEME.gold })
      .setOrigin(0.5);
    const avatar = addPortrait(this, -ROW_W / 2 + 130, 0, player?.characterId, isWinner ? 72 : 64);
    const name = this.add
      .text(-ROW_W / 2 + 190, isWinner ? -14 : -12, player?.displayName ?? r.playerId, {
        fontFamily: THEME.title,
        fontSize: isWinner ? '32px' : '28px',
        color
      })
      .setOrigin(0, 0.5);
    const stats = this.add
      .text(-ROW_W / 2 + 190, isWinner ? 20 : 19, (r.stats ?? []).join('   ·   '), {
        fontFamily: THEME.body,
        fontSize: '19px',
        color: THEME.textDim
      })
      .setOrigin(0, 0.5);
    const plus = this.add
      .text(ROW_W / 2 - 60, 0, delta > 0 ? `+${delta}` : '0', {
        fontFamily: THEME.title,
        fontSize: isWinner ? '40px' : '34px',
        color: delta > 0 ? THEME.green : THEME.muted
      })
      .setOrigin(0.5);
    const ptLabel = this.add
      .text(ROW_W / 2 - 60, isWinner ? 30 : 26, 'PUNTI', { fontFamily: THEME.body, fontSize: '13px', color: THEME.muted })
      .setOrigin(0.5);

    row.add([bg, place, avatar, name, stats, plus, ptLabel]);
    this.tweens.add({ targets: row, alpha: 1, x: 640, duration: THEME.normal, ease: 'Cubic.easeOut' });

    // REAZIONE del personaggio: il primo esulta (rimbalzo + la sua battuta), l'ultimo ci resta male (ritratto spento e storto,
    // e a volte una battuta). Le battute sono rare: al massimo due per schermata, quella dell'ultimo non sempre.
    const isLast = out.results.length > 1 && r.placement === out.results.length;
    const line = isWinner ? bark(player?.characterId, 'victory') : isLast && Math.random() < 0.6 ? bark(player?.characterId, 'defeat') : null;
    if (line) {
      const bubble = this.add
        .text(name.x + name.width + 18, name.y, `“${line}”`, { fontFamily: THEME.body, fontSize: '18px', color: '#111827', backgroundColor: '#f8fafc', padding: { x: 10, y: 4 } })
        .setOrigin(0, 0.5)
        .setScale(0.6)
        .setAlpha(0);
      row.add(bubble);
      this.tweens.add({ targets: bubble, alpha: 1, scale: 1, delay: 350, duration: 260, ease: 'Back.easeOut' });
    }
    if (isWinner) {
      this.tweens.add({ targets: avatar, y: -10, duration: 220, yoyo: true, repeat: 3, ease: 'Sine.easeOut', delay: 200 });
      this.tweens.add({ targets: avatar, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: 3, delay: 200 });
    } else if (isLast) {
      if ('setTint' in avatar) avatar.setTint(0x8a8f99);
      this.tweens.add({ targets: avatar, angle: -14, duration: 380, ease: 'Back.easeOut', delay: 150 });
    }

    if (isWinner) {
      audio.fanfare();
      confetti(this, 640, -30);
      this.tweens.add({ targets: row, scale: 1.04, duration: 360, yoyo: true, ease: 'Sine.easeInOut' });
    } else {
      audio.select();
    }
  }
}
