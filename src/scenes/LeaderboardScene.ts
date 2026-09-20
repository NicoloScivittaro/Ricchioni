import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';
import { THEME, panel, titleText, bodyText, hexInt, sceneIn } from '../core/theme';

const ROW_H = 84;
const ROW_W = 1040;
const TOP = 176;
const BAR_W = 380;

/**
 * CLASSIFICA GENERALE, dal primo all'ultimo: punteggio con count-up, variazione (+N),
 * cambio di posizione (▲▼) e distanza dal target con barra di avanzamento.
 */
export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  create(): void {
    sceneIn(this);
    const st = gm.state;
    if (!st) {
      this.scene.start('RoomScene');
      return;
    }
    const out = st.lastResults;
    const target = Math.max(1, st.targetScore);

    titleText(this, 640, 50, 'CLASSIFICA GENERALE', 46, THEME.blue);
    bodyText(this, 640, 100, `🎯 TARGET ${st.targetScore} PUNTI`, 24, THEME.gold);

    // posizione PRIMA di questo round (per le frecce ▲▼): stessi punteggi meno i punti appena assegnati
    const before = [...st.players]
      .map((p, i) => ({ id: p.id, old: p.score - (out?.deltas[p.id] ?? 0), i }))
      .sort((a, b) => b.old - a.old || a.i - b.i)
      .map((x) => x.id);

    const standings = [...st.players].sort((a, b) => b.score - a.score);
    standings.forEach((p, i) => {
      const y = TOP + i * (ROW_H + 8) + ROW_H / 2;
      const c = p.characterId ? getCharacter(p.characterId) : null;
      const color = c?.color ?? '#ffffff';
      const delta = out?.deltas[p.id] ?? 0;
      const old = p.score - delta;
      const reached = p.score >= target;
      const oldRank = before.indexOf(p.id);
      const move = oldRank - i; // >0 = ha guadagnato posizioni

      const row = this.add.container(640, y + 24).setAlpha(0);
      row.add(panel(this, 0, 0, ROW_W, ROW_H, { fill: i === 0 ? 0x1d2440 : THEME.panel, stroke: hexInt(color), strokeWidth: i === 0 ? 3 : 2 }));
      row.add(this.add.text(-ROW_W / 2 + 44, 0, `${i + 1}`, { fontFamily: THEME.title, fontSize: '34px', color: i === 0 ? THEME.gold : THEME.muted }).setOrigin(0.5));
      row.add(this.add.text(-ROW_W / 2 + 112, 0, c?.avatar ?? '🎮', { fontSize: '38px' }).setOrigin(0.5));
      row.add(
        this.add.text(-ROW_W / 2 + 160, -14, p.displayName, { fontFamily: THEME.title, fontSize: '27px', color }).setOrigin(0, 0.5)
      );

      // barra di avanzamento verso il target
      const barX = -ROW_W / 2 + 160;
      row.add(this.add.rectangle(barX, 18, BAR_W, 12, THEME.line).setOrigin(0, 0.5));
      const fill = this.add.rectangle(barX, 18, BAR_W * Math.min(1, old / target), 12, hexInt(color)).setOrigin(0, 0.5);
      row.add(fill);
      row.add(this.add.rectangle(barX + BAR_W, 18, 4, 20, THEME.goldInt).setOrigin(0.5)); // segno del target
      this.tweens.add({ targets: fill, displayWidth: Math.max(2, BAR_W * Math.min(1, p.score / target)), duration: 700, delay: 350, ease: 'Cubic.easeOut' });

      // punteggio (count-up) + variazione
      const scoreText = this.add
        .text(ROW_W / 2 - 250, -4, `${old} PT`, { fontFamily: THEME.title, fontSize: '36px', color: '#ffffff' })
        .setOrigin(1, 0.5);
      row.add(scoreText);
      this.tweens.addCounter({
        from: old,
        to: p.score,
        duration: 800,
        delay: 350,
        ease: 'Cubic.easeOut',
        onUpdate: (tw) => scoreText.setText(`${Math.round(tw.getValue() ?? 0)} PT`)
      });
      if (delta > 0) {
        row.add(this.add.text(ROW_W / 2 - 230, -4, `+${delta}`, { fontFamily: THEME.title, fontSize: '26px', color: THEME.green }).setOrigin(0, 0.5));
      }
      // distanza dal target
      row.add(
        this.add
          .text(ROW_W / 2 - 250, 26, reached ? '🎯 TARGET RAGGIUNTO' : `mancano ${target - p.score}`, {
            fontFamily: THEME.body,
            fontSize: '16px',
            color: reached ? THEME.gold : THEME.muted
          })
          .setOrigin(1, 0.5)
      );
      // freccia di posizione
      if (move !== 0) {
        row.add(
          this.add
            .text(ROW_W / 2 - 46, 0, `${move > 0 ? '▲' : '▼'}${Math.abs(move)}`, {
              fontFamily: THEME.title,
              fontSize: '24px',
              color: move > 0 ? THEME.green : THEME.red
            })
            .setOrigin(0.5)
        );
      }

      // ingresso dal primo all'ultimo
      this.time.delayedCall(120 + i * 170, () => {
        this.tweens.add({ targets: row, alpha: 1, y, duration: THEME.normal, ease: 'Cubic.easeOut' });
        audio.tick();
      });
    });

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') gm.skip();
    });
  }
}
