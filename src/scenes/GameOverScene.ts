import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';
import type { PlayerPublic } from '../../shared/types';
import { THEME, titleText, bodyText, panel, hexInt, sceneIn } from '../core/theme';
import { UI } from '../core/uiTokens';
import { confetti } from './confetti';
import { addPortrait, portraitKey } from '../core/portraits';
import { bark, presentationOf } from '../../shared/characterPresentation';

const KEY_LOCK_MS = 1500; // ignora tasti residui della schermata precedente
const BASE_Y = 618; // base del podio (sotto: solo la riga RIVINCITA)
const COL_W = 176;
// colonne del podio: [posizione, x, altezza, colore]
const PODIUM: { place: number; x: number; h: number; color: number }[] = [
  { place: 1, x: 460, h: 200, color: 0xfbbf24 },
  { place: 2, x: 250, h: 145, color: 0x9ca3af },
  { place: 3, x: 670, h: 105, color: 0xb45309 }
];

/** Statistiche divertenti della serata, ricavate dal registro dei round della partita. */
function funStats(players: PlayerPublic[]): string[] {
  const log = gm.roundLog;
  if (log.length === 0) return [];
  const name = (id: string): string => players.find((p) => p.id === id)?.displayName ?? '?';
  const wins = new Map<string, number>();
  const lasts = new Map<string, number>();
  let best: { id: string; delta: number; game: string } | null = null;
  for (const r of log) {
    const n = r.results.length;
    for (const res of r.results) {
      if (res.placement === 1) wins.set(res.playerId, (wins.get(res.playerId) ?? 0) + 1);
      if (n > 1 && res.placement === n) lasts.set(res.playerId, (lasts.get(res.playerId) ?? 0) + 1);
    }
    for (const [id, d] of Object.entries(r.deltas)) if (!best || d > best.delta) best = { id, delta: d, game: r.name };
  }
  const top = (m: Map<string, number>): [string, number] | null => {
    let out: [string, number] | null = null;
    for (const e of m) if (!out || e[1] > out[1]) out = e;
    return out;
  };
  const lines: string[] = [];
  const w = top(wins);
  if (w) lines.push(`🏅 RE DEI MINIGIOCHI\n${name(w[0])} — ${w[1]} ${w[1] === 1 ? 'vittoria' : 'vittorie'}`);
  const l = top(lasts);
  if (l && l[1] >= 2) lines.push(`😅 IL SFIGATO\n${name(l[0])} — ${l[1]} volte ultimo`);
  if (best && best.delta > 0) lines.push(`🚀 MIGLIOR ROUND\n${name(best.id)} +${best.delta} a ${best.game}`);
  lines.push(`🎮 ${log.length} minigiochi giocati`);
  return lines.slice(0, 4);
}

/** FINALE: reveal ultimo → primo, podio, campione in grande, statistiche divertenti, NUOVA PARTITA. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(): void {
    sceneIn(this);
    const st = gm.state;
    const winnerPlayer = st?.players.find((p) => p.id === st?.winner);
    if (!st || !winnerPlayer) {
      this.scene.start('LobbyScene');
      return;
    }

    // ordine finale: il vincitore ufficiale (spareggio incluso) per primo, poi per punti
    const rest = st.players.filter((p) => p.id !== winnerPlayer.id).sort((a, b) => b.score - a.score);
    const ranked = [winnerPlayer, ...rest];

    const header = titleText(this, 640, 56, 'CLASSIFICA FINALE', 48, THEME.text);
    bodyText(this, 640, 100, `dopo ${gm.roundLog.length || st.round} minigiochi · target ${st.targetScore} punti`, 20, THEME.muted);

    // 4° e 5°: presenti ma non protagonisti — chip sotto le statistiche, a destra (rivelati per primi, dall'ultimo)
    const others = ranked.slice(3);
    others.reverse().forEach((p, i) => {
      const place = ranked.indexOf(p) + 1;
      const c = p.characterId ? getCharacter(p.characterId) : null;
      const y = 560 + (others.length - 1 - i) * 64;
      const x = 1030;
      const chip = this.add.container(x, y).setAlpha(0);
      chip.add(panel(this, 0, 0, 270, 56, { stroke: hexInt(c?.color ?? '#ffffff') }));
      chip.add(this.add.text(-108, 0, `${place}°`, { fontFamily: THEME.title, fontSize: '26px', color: THEME.muted }).setOrigin(0.5));
      // fuori dal podio: ritratto un po' spento (sconfitta), nome nel suo colore
      const face = addPortrait(this, -62, 0, p.characterId, 44);
      if ('setTint' in face) face.setTint(0xa0a4ad);
      chip.add(face);
      const nm = this.add.text(-34, 0, p.displayName.toUpperCase(), { fontFamily: THEME.title, fontSize: '18px', color: c?.color ?? '#fff' }).setOrigin(0, 0.5);
      while (nm.width > 140 && nm.text.length > 4) nm.setText(`${nm.text.replace(/…$/, '').slice(0, -1)}…`);
      chip.add(nm);
      chip.add(this.add.text(122, 0, `${p.score}`, { fontFamily: THEME.title, fontSize: '22px', color: '#ffffff' }).setOrigin(1, 0.5));
      this.time.delayedCall(400 + i * 600, () => {
        this.tweens.add({ targets: chip, alpha: 1, y: y - 8, duration: THEME.normal });
        audio.resultReveal('last');
      });
    });

    // podio: 3° → 2° → 1°
    const podiumCols = PODIUM.filter((c) => c.place <= Math.min(3, ranked.length));
    const order = [...podiumCols].sort((a, b) => b.place - a.place); // ultimo → primo
    const startAt = 400 + others.length * 600 + 500;
    order.forEach((col, i) => {
      const p = ranked[col.place - 1];
      const c = p.characterId ? getCharacter(p.characterId) : null;
      const color = c?.color ?? '#ffffff';
      const at = startAt + i * 1100;
      this.time.delayedCall(at, () => this.raiseColumn(col, p, color, c?.id ?? null, col.place === 1, header));
    });

    // statistiche divertenti (a destra), dopo il campione
    const stats = funStats(st.players);
    const winAt = startAt + (order.length - 1) * 1100;
    if (stats.length > 0) {
      const px = 1030;
      const h = 40 + stats.length * 78;
      const cy = 160 + h / 2;
      const objs: Phaser.GameObjects.GameObject[] = [
        panel(this, px, cy, 400, h, { stroke: THEME.goldInt, alpha: 0.9 }),
        titleText(this, px, cy - h / 2 + 28, 'LA SERATA IN NUMERI', 22, THEME.gold),
        ...stats.map((line, i) => bodyText(this, px, cy - h / 2 + 82 + i * 74, line, 19, THEME.text))
      ];
      for (const o of objs) (o as Phaser.GameObjects.Text).setAlpha(0);
      this.time.delayedCall(winAt + 900, () => {
        this.tweens.add({ targets: objs, alpha: 1, duration: THEME.slow });
      });
    }

    // RIVINCITA: solo da tastiera dell'host (R / INVIO) — un tasto del controller non puo' farla partire per sbaglio
    const hint = this.add
      .text(640, 720 - UI.safe.y - 14, 'R · RIVINCITA (stessa squadra, punti a zero)      INVIO · NUOVA SERATA', {
        fontFamily: THEME.title,
        fontSize: `${UI.size.S}px`,
        color: THEME.green
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.time.delayedCall(winAt + 1400, () => {
      this.tweens.add({ targets: hint, alpha: 1, duration: THEME.slow });
      this.tweens.add({ targets: hint, alpha: 0.55, duration: 900, yoyo: true, repeat: -1, delay: 600 });
    });

    const openedAt = this.time.now;
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      // Mai tornare da soli alla lobby: serve un tasto volontario, non un auto-repeat/residuo.
      if (e.repeat || this.time.now - openedAt < KEY_LOCK_MS) return;
      if (e.key === 'r' || e.key === 'R') {
        audio.select();
        gm.restartMatch();
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        audio.select();
        gm.backToLobby();
        this.scene.start('LobbyScene');
      }
    });
  }

  /** Fa "salire" una colonna del podio e poi mostra ritratto, nome e punti. */
  private raiseColumn(
    col: { place: number; x: number; h: number; color: number },
    p: PlayerPublic,
    color: string,
    textureKey: string | null,
    isWinner: boolean,
    header: Phaser.GameObjects.Text
  ): void {
    // La colonna cresce cambiando la GEOMETRIA (non la scala): con displayHeight anche il bordo si stirava.
    const rect = this.add.rectangle(col.x, BASE_Y, COL_W, 4, col.color, 0.95).setOrigin(0.5, 1).setStrokeStyle(3, 0xffffff, 0.6);
    this.tweens.addCounter({
      from: 4,
      to: col.h,
      duration: 520,
      ease: 'Back.easeOut',
      onUpdate: (tw) => rect.setSize(COL_W, Math.max(4, tw.getValue() ?? 4))
    });
    const top = BASE_Y - col.h;

    // numero grande dentro la colonna
    const num = this.add
      .text(col.x, BASE_Y - 34, String(col.place), { fontFamily: THEME.title, fontSize: '48px', color: '#000000' })
      .setOrigin(0.5)
      .setAlpha(0);

    this.time.delayedCall(430, () => {
      this.tweens.add({ targets: num, alpha: 0.4, duration: THEME.normal });
      const cy = top - 58;
      const pKey = portraitKey(textureKey);
      if (pKey && this.textures.exists(pKey)) {
        // ritratto (testa del personaggio, ritaglio unico) + reazione: il 1° esulta a lungo, 2° e 3° piu' composti
        const img = this.add.image(col.x, isWinner ? cy - 14 : cy, pKey).setDisplaySize(isWinner ? 150 : 96, isWinner ? 150 : 96);
        img.setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, duration: THEME.normal });
        if (isWinner) {
          this.tweens.add({ targets: img, y: cy - 16, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 });
          this.tweens.add({ targets: img, angle: { from: -7, to: 7 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 });
        } else {
          this.tweens.add({ targets: img, y: cy - 5, duration: 700, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', delay: 300 });
        }
      }
      const name = this.add
        .text(col.x, isWinner ? cy - 104 : cy - 70, p.displayName.toUpperCase(), { fontFamily: THEME.title, fontSize: isWinner ? '40px' : '24px', color })
        .setOrigin(0.5)
        .setAlpha(0);
      // nomi lunghi: si riducono finche' stanno nella colonna
      for (let fs = isWinner ? 40 : 24; name.width > (isWinner ? 300 : 200) && fs > 16; fs--) name.setFontSize(fs - 1);
      const pts = this.add
        .text(col.x, top + 24, `${p.score} PT`, { fontFamily: THEME.title, fontSize: isWinner ? '34px' : '28px', color: '#111827' })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: [name, pts], alpha: 1, duration: THEME.normal });
      if (isWinner) {
        header.setText('🏆 CAMPIONE DELLA SERATA 🏆').setColor(THEME.gold);
        audio.announcer('WINNER'); // fanfara del campione, separata dai risultati normali (poi il tema del podio continua)
        audio.characterSting(textureKey, true);
        // il campione dice la sua (una sola battuta in tutta la schermata) e il telecronista lo chiama per soprannome
        const alias = presentationOf(textureKey)?.announcerAlias;
        const line = bark(textureKey, 'victory', { force: true });
        if (line) {
          const bubble = this.add
            .text(col.x + 70, cy - 40, `“${line}”`, { fontFamily: THEME.title, fontSize: '22px', color: '#111827', backgroundColor: '#f8fafc', padding: { x: 12, y: 6 } })
            .setOrigin(0, 0.5)
            .setScale(0.5)
            .setAlpha(0);
          this.tweens.add({ targets: bubble, alpha: 1, scale: 1, delay: 700, duration: 300, ease: 'Back.easeOut' });
        }
        if (alias) bodyText(this, col.x, cy - 142, `${alias}!`, 20, THEME.gold).setAlpha(0.9);
        this.tweens.add({ targets: name, scale: 1.18, duration: 500, yoyo: true, ease: 'Sine.easeInOut' });
        confetti(this, 640, -30);
        this.time.delayedCall(700, () => confetti(this, 300, -30));
        this.cameras.main.flash(220, 251, 191, 36);
      } else {
        audio.select();
      }
    });
  }
}
