import { PartyBots } from '../bots/PartyBots';
import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { pads } from '../../input/GamepadManager';
import { HAPTIC } from '../../core/haptics';

/** Impulso generico a ogni tessera premuta (stesso per tutte: non rivela quale). */
const HAPTIC_TILE = 14;
import { confetti } from '../../scenes/confetti';
import { PauseMenu } from '../../core/PauseMenu';
import { MEMORY_ABILITIES } from '../../../shared/memoryAbilities';
import { AB, stateLabel } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';
import { abilityHub } from '../../core/abilityHub';
import { MEMORY_TILES, MEMORY_SEQ_LENS, MEMORY_ROUNDS, isMemoryOver } from '../../../shared/memoryTiles';
import type { MinigameContext } from '../types';
import type { PlayerSnapshot } from '../../../shared/types';
import { addBackdrop } from '../../scenes/backdrops';
import { UI } from '../../core/uiTokens';
import { PlayerBadge, badgeColumns, displayText } from '../../core/uiPhaser';
import { FONT_DISPLAY, FONT_BODY } from '../../core/uiTokens';

// MEMORIA DA UBRIACO — 5 round a eliminazione, sequenze 3-4-5-6-7.
// OSSERVA → RIPETI. Chi arriva più avanti nella sequenza vince; a parità conta
// il tempo. 5 abilità (una per personaggio, una volta a partita).

const TITLE_S = 2.2;
const OBSERVE_PRE = 0.9;
const OBSERVE_INTERVAL = 0.62;
const OBSERVE_POST = 0.55;
const TIME_BUDGET_PER_TILE = 1.5; // secondi per mossa + margine
const ROUND_RESULT_S = 2.4;
// Ultimo superstite (con altri già fuori): deve comunque completare tutti i round, ma più svelti
// (osserva ~40% più rapido, stacchi più corti) così i round "da soli" non annoiano.
const SOLO_SPEED = 0.6;
const SOLO_ROUND_RESULT_S = 1.0;
const REPLAY_TILE_S = AB.memory.goblin.p.replayTile; // replay veloce (Goblin)
const REPLAY_POST_S = 0.4;
// Abilita' che toccano il TEMPO del giocatore (lo spareggio e' la somma dei tempi di completamento)
// numeri delle abilita': shared/abilityCatalog.ts (AB.memory) — la stessa fonte della card sul telefono e della schermata CONTROLLI
const PEEK_PENALTY_MS = AB.memory.dottore.p.penaltyMs; // M'HO SVEJATO: costo dello sbirciare
const PEEK_SHOW_MS = AB.memory.dottore.p.peekMs;
const PAUSE_S = AB.memory.judoka.p.pause; // NO, ASPETTA!: tempo fermo
const RATE_CREDIT_MS = AB.memory.ciro.p.creditMs; // A RATE: sconto sul tempo a meta' sequenza
const SECOND_CHANCE_PENALTY_MS = AB.memory.buttafuori.p.penaltyMs; // MO HO CAPITO: costo della seconda chance

const JUDOKA_SHOUTS = ['EH?! MA DAI!', 'NO, ASPETTA!', 'NON È COSÌ!', 'CASA MIA, REGOLE MIE!'];

type Phase = 'title' | 'observe' | 'repeat' | 'roundResult' | 'results';

interface PState {
  snap: PlayerSnapshot;
  alive: boolean;
  abilityUsed: boolean; // una volta per partita
  completedRounds: number;
  progress: number; // mosse giuste prima dell'errore (ranking)
  totalTimeMs: number; // somma tempi di completamento (spareggio)
  totalCorrect: number; // punteggio display
  inputIndex: number;
  deadline: number;
  penaltyMs: number;
  /** tempo "fermo" dalle abilita' (NO, ASPETTA! / A RATE): non conta per lo spareggio */
  pauseMs: number;
  /** fino a questo istante di gioco i tasti sono bloccati (NO, ASPETTA!) */
  pausedUntil: number;
  rateArmed: boolean;
  resolved: boolean;
  /** scheda del giocatore (badge del design system: ritratto, nome, progresso, abilita'). `card.text` = cio' che si vede */
  card: PlayerBadge;
}

function hex(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export class MemoryScene extends Phaser.Scene {
  private soloBots!: PartyBots;
  private ctx!: MinigameContext;
  private players: PState[] = [];
  private sequences: number[][] = [];
  private round = 0;
  private phase: Phase = 'title';
  private gameTime = 0;
  private phaseEndsAt = 0;
  private observeStart = 0;
  private nextFlashIndex = 0;
  private repeatStartTime = 0;
  private goblinReplayPending = false;
  private finished = false;

  private centerText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private tileRects: Phaser.GameObjects.Rectangle[] = [];
  private tileHalos: Phaser.GameObjects.Rectangle[] = [];
  private tileIcons: Phaser.GameObjects.Text[] = [];
  private tileLabels: Phaser.GameObjects.Text[] = [];
  private drunkTint!: Phaser.GameObjects.Rectangle;
  private pauseMenu!: PauseMenu;
  /** false finche' la schermata CONTROLLI e' visibile: il gioco resta fermo (vedi update()). */
  private controlsDone = false;

  constructor() {
    super('memory');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    this.soloBots = new PartyBots(this.ctx);
    // RICOMINCIA riusa la stessa istanza: azzera tutto.
    this.players = [];
    this.sequences = [];
    this.round = 0;
    this.phase = 'title';
    this.gameTime = 0;
    this.phaseEndsAt = 0;
    this.observeStart = 0;
    this.nextFlashIndex = 0;
    this.repeatStartTime = 0;
    this.goblinReplayPending = false;
    this.finished = false;
    this.tileRects = [];
    this.tileHalos = [];
    this.tileIcons = [];
    this.tileLabels = [];

    audio.unlock();
    this.cameras.main.setBackgroundColor('#0f172a');
    addBackdrop(this, 'memory'); // scenografia: pub fuori controllo (solo sfondo)
    this.cameras.main.setRotation(0);

    this.drunkTint = this.add
      .rectangle(640, 360, 1280, 720, 0x7c2d12, 0)
      .setDepth(50)
      .setAlpha(0);

    this.centerText = displayText(this, 640, 84, '', UI.size.XL, UI.color.text).setDepth(20);
    this.subText = this.add
      .text(640, 128, '', { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: UI.color.textDim, align: 'center' })
      .setOrigin(0.5)
      .setDepth(20);

    // Diamante (non griglia 2x2): ricalca la disposizione FISICA dei 4 face button del controller (Y/B/A/X in alto/destra/
    // basso/sinistra, △/◯/✕/□ uguale) così il cervello del giocatore può usare la posizione, non il colore o la lettera —
    // c0=ALTO, c1=DESTRA, c2=BASSO, c3=SINISTRA, esattamente come il profilo in src/input/profiles.ts (memory).
    const positions = [
      { x: 640, y: 250 }, // c0 ALTO
      { x: 860, y: 410 }, // c1 DESTRA
      { x: 640, y: 570 }, // c2 BASSO
      { x: 420, y: 410 } // c3 SINISTRA
    ];
    const ARROWS = ['⬆', '➡', '⬇', '⬅']; // simbolo spaziale universale: leggibile anche con controller di famiglie diverse insieme
    for (let i = 0; i < 4; i++) {
      const t = MEMORY_TILES[i];
      const { x, y } = positions[i];
      const halo = this.add
        .rectangle(x, y, 250, 250, hex(t.color), 0)
        .setDepth(5)
        .setAlpha(0);
      const rect = this.add
        .rectangle(x, y, 200, 200, hex(t.color), 0.9)
        .setStrokeStyle(6, 0xffffff, 0.85)
        .setDepth(6);
      const icon = this.add
        .text(x, y - 26, t.icon, { fontSize: '86px' })
        .setOrigin(0.5)
        .setDepth(7);
      const label = this.add
        .text(x, y + 68, `${ARROWS[i]} ${t.label}`, { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(7);
      this.tileRects.push(rect);
      this.tileHalos.push(halo);
      this.tileIcons.push(icon);
      this.tileLabels.push(label);
    }

    // giocatori: due colonne compatte ai lati del rombo (le tessere restano il centro e non coprono nessuna scheda)
    const badges = badgeColumns(this, this.ctx.players.map((p) => ({ id: p.id, displayName: p.displayName, characterId: p.characterId, color: p.color })), 250, 232, 92, 84);
    this.ctx.players.forEach((p) => {
      const card = badges.get(p.id)!;
      card.root.setDepth(8);
      this.players.push({
        snap: p,
        alive: true,
        abilityUsed: false,
        pauseMs: 0,
        pausedUntil: 0,
        completedRounds: 0,
        progress: 0,
        totalTimeMs: 0,
        totalCorrect: 0,
        inputIndex: 0,
        deadline: 0,
        penaltyMs: 0,
        rateArmed: false,
        resolved: false,
        card
      });
    });

    abilityHub.begin('memory', this.ctx);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => abilityHub.end());
    this.sequences = MEMORY_SEQ_LENS.map((len) => Array.from({ length: len }, () => Math.floor(this.ctx.rng.next() * 4)));

    this.pauseMenu = new PauseMenu(this, '🧠 MEMORIA DA UBRIACO', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));

    // Schermata CONTROLLI: finche' e' su, il gioco resta fermo (vedi update()); alla fine gli input sono azzerati e parte il TITOLO.
    this.controlsDone = false;
    // la schermata CONTROLLI puo' chiudersi DOPO che il round e' gia' finito (salto del gioco, rete di sicurezza): in quel caso
    // la scena e' spenta e i suoi testi distrutti, scriverci farebbe lanciare Phaser. Si continua solo se e' ancora QUESTO round.
    const ctx = this.ctx;
    if (this.ctx.showControls) void this.ctx.showControls().then(() => {
      if (this.ctx !== ctx || !this.sys.isActive()) return;
      this.controlsDone = true;
      this.showTitle();
    });
    else {
      this.controlsDone = true;
      this.showTitle();
    }
  }

  // ---- Fasi ----

  private showTitle(): void {
    this.phase = 'title';
    this.phaseEndsAt = this.gameTime + TITLE_S;
    this.centerText.setText('🧠 MEMORIA DA UBRIACO').setFontSize(62).setColor('#fbbf24').setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: this.centerText, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' });
    this.subText.setText('OSSERVA la sequenza · RIPETILA · chi sbaglia è eliminato');
    audio.select();
  }

  private startObserve(): void {
    this.phase = 'observe';
    this.observeStart = this.gameTime;
    this.nextFlashIndex = 0;
    this.goblinReplayPending = false;
    const seq = this.sequences[this.round];
    const isLast = this.round === MEMORY_ROUNDS - 1;

    this.centerText.setText('👀 OSSERVA').setFontSize(88).setColor('#ffffff').setScale(1).setAlpha(1);
    this.subText
      .setText(
        this.soloSurvivor()
          ? `⭐ ULTIMO IN GARA — round ${this.round + 1}/${MEMORY_ROUNDS}, completa le sequenze!`
          : isLast
            ? '🔥 ULTIMO ROUND — attento!'
            : `Round ${this.round + 1}/${MEMORY_ROUNDS} · sequenza da ${seq.length}`
      )
      .setColor(isLast ? '#f87171' : '#9ca3af');

    for (const p of this.players) this.updateCard(p);
    this.ctx.signal(null, { type: 'observe', seqLen: seq.length });
  }

  /** true = un solo giocatore ancora in gara mentre altri sono già stati eliminati. */
  private soloSurvivor(): boolean {
    return this.players.length > 1 && this.players.filter((p) => p.alive).length === 1;
  }

  private observeTiming(): { pre: number; interval: number; post: number } {
    const k = this.soloSurvivor() ? SOLO_SPEED : 1;
    return { pre: OBSERVE_PRE * k, interval: OBSERVE_INTERVAL * k, post: OBSERVE_POST * k };
  }

  private updateObserve(): void {
    // BUG PRE-ESISTENTE (non del gamepad, c'era già col telefono): handleAbility() veniva letta SOLO qui sotto in updateRepeat(),
    // ma l'abilità del Goblin ("ANCORA UN GIRO") richiede this.phase==='observe' per attivarsi — quindi non scattava MAI, con
    // nessuna sorgente di input. L'effetto e il costo dell'abilità restano identici: cambia solo la fase in cui viene LETTA.
    for (const p of this.players) {
      if (!p.alive) continue;
      if (this.ctx.input.get(p.snap.id).justPressed('ability')) this.handleAbility(p);
    }
    const seq = this.sequences[this.round];
    while (
      this.nextFlashIndex < seq.length &&
      this.gameTime >= this.observeStart + this.observeTiming().pre + this.nextFlashIndex * this.observeTiming().interval
    ) {
      this.flashTile(seq[this.nextFlashIndex]);
      audio.tileTone(seq[this.nextFlashIndex]); // OSSERVA: ogni tessera ha la SUA nota (fissa in tutti i round)
      this.nextFlashIndex++;
    }
    const tm = this.observeTiming();
    if (this.gameTime >= this.observeStart + tm.pre + seq.length * tm.interval + tm.post) {
      this.startRepeat();
    }
  }

  private startRepeat(): void {
    this.phase = 'repeat';
    this.repeatStartTime = this.gameTime;
    const seq = this.sequences[this.round];
    const budget = seq.length * TIME_BUDGET_PER_TILE + 2.5;

    for (const p of this.players) {
      if (!p.alive) continue;
      p.inputIndex = 0;
      p.penaltyMs = 0;
      p.pauseMs = 0;
      p.pausedUntil = 0;
      p.rateArmed = false;
      p.resolved = false;
      p.deadline = this.repeatStartTime + budget;
      this.updateCard(p);
    }

    this.centerText.setText('👆 TOCCA LA SEQUENZA').setFontSize(66).setColor('#4ade80');
    this.subText.setText(`${seq.length} mosse · vai!`);
    this.ctx.signal(null, { type: 'repeat' });

    // Goblin "ANCORA UN GIRO": replay privato (solo il suo telefono).
    if (this.goblinReplayPending) {
      this.goblinReplayPending = false;
      const goblin = this.players.find((p) => p.snap.characterId === 'goblin' && p.alive);
      if (goblin) {
        const replaySec = seq.length * REPLAY_TILE_S + REPLAY_POST_S;
        this.ctx.signal(goblin.snap.id, { type: 'replay', seq });
        goblin.deadline += replaySec;
      }
    }
  }

  private updateRepeat(): void {
    const seq = this.sequences[this.round];
    for (const p of this.players) {
      if (!p.alive || p.resolved) continue;

      if (this.gameTime > p.deadline) {
        this.eliminate(p, `⏱ Tempo scaduto (mossa ${p.inputIndex + 1})`);
        continue;
      }

      const input = this.ctx.input.get(p.snap.id);
      if (input.justPressed('ability')) this.handleAbility(p);
      // NO, ASPETTA!: durante la pausa i tasti non contano (il tempo e' fermo); si riprende subito dopo, senza replay
      if (this.gameTime < p.pausedUntil) continue;
      for (let c = 0; c < 4; c++) {
        if (input.justPressed(`c${c}`)) this.handleTilePress(p, c, seq);
      }
    }

    if (!this.players.some((p) => p.alive && !p.resolved)) this.endRound();
  }

  private handleTilePress(p: PState, c: number, seq: number[]): void {
    // PRIVACY: in TOCCA la TV non deve rivelare QUALE tessera e' stata premuta (chi e' piu' lento copierebbe a occhio o a
    // orecchio). Niente lampeggio della tessera, niente nota specifica: solo un tic neutro, identico per tutte e quattro.
    // La TV mostra soltanto il progresso (scheda: ⏳ 3/6, ✅, 💀).
    audio.memoryInputTick();
    // controller: impulso generico, uguale per ogni tessera (il telefono vibra gia' da se' al tocco, sul proprio schermo)
    if (pads.slotOf(p.snap.id)?.state === 'paired') this.ctx.vibrate(p.snap.id, HAPTIC_TILE);

    if (c === seq[p.inputIndex]) {
      p.inputIndex++;
      p.totalCorrect++;
      if (p.inputIndex >= seq.length) {
        const roundMs = Math.max(150, Math.round((this.gameTime - this.repeatStartTime) * 1000) + p.penaltyMs - p.pauseMs);
        p.totalTimeMs += roundMs;
        p.completedRounds++;
        p.progress = seq.length;
        p.resolved = true;
        audio.correct();
        this.ctx.signal(p.snap.id, { type: 'completed', ms: roundMs });
        this.showBanner(p, `✅ Sequenza completata (${roundMs} ms)`);
      } else {
        // Ciro "A RATE": pausa mentale a metà sequenza.
        if (p.rateArmed && p.inputIndex === Math.ceil(seq.length / 2)) {
          p.deadline += 2;
          p.pauseMs += RATE_CREDIT_MS;
          p.rateArmed = false;
          this.ctx.signal(p.snap.id, { type: 'rate' });
          this.showBanner(p, '💸 A RATE — metà fatta, respira! (−1,5 s dal tuo tempo)');
        }
      }
      this.updateCard(p);
    } else {
      this.handleWrong(p);
    }
  }

  private handleWrong(p: PState): void {
    // Buttafuori "MO HO CAPITO": una seconda chance (penalità tempo).
    if (p.snap.characterId === 'buttafuori' && !p.abilityUsed) {
      p.abilityUsed = true;
      p.penaltyMs += SECOND_CHANCE_PENALTY_MS;
      abilityHub.activated(p.snap.id);
      abilityHub.succeeded(p.snap.id, 'errori perdonati');
      audio.select();
      this.ctx.signal(p.snap.id, { type: 'abilityUsed', name: 'MO HO CAPITO' });
      this.ctx.signal(p.snap.id, { type: 'secondChance' });
      this.showBanner(p, `🥊 MO HO CAPITO — seconda chance (+${SECOND_CHANCE_PENALTY_MS} ms)`);
      this.updateCard(p);
      return;
    }
    this.eliminate(p, `❌ Errore alla mossa ${p.inputIndex + 1}`);
  }

  private eliminate(p: PState, reason: string): void {
    p.resolved = true;
    p.alive = false;
    p.progress = p.inputIndex;
    audio.error(); // errore inequivocabile, mai confondibile con una nota
    // feedback DIVERSO solo per chi ha sbagliato: vibrazione lunga sul suo controller
    if (pads.slotOf(p.snap.id)?.state === 'paired') this.ctx.vibrate(p.snap.id, HAPTIC.HEAVY);
    this.ctx.signal(p.snap.id, { type: 'eliminated', at: p.inputIndex + 1 });
    this.showBanner(p, reason);
    this.updateCard(p);
  }

  private handleAbility(p: PState): void {
    if (!p.alive) return;
    const cid = p.snap.characterId ?? '';
    const ab = MEMORY_ABILITIES[cid];
    if (!ab) return;
    // premuta ma non partita: avviso privato, mai silenzio
    if (p.abilityUsed) return void abilityHub.failed(p.snap.id, 'ESAURITA');
    if (ab.phase === 'passive') return void abilityHub.failed(p.snap.id, 'SCATTA DA SOLA'); // Buttafuori: scatta da sola sull'errore
    if (ab.phase === 'observe' && this.phase !== 'observe') return void abilityHub.failed(p.snap.id, 'SOLO MENTRE GUARDI');
    if (ab.phase === 'repeat' && this.phase !== 'repeat') return void abilityHub.failed(p.snap.id, 'SOLO MENTRE RIPETI');
    if (ab.phase === 'repeat' && p.resolved) return void abilityHub.failed(p.snap.id, 'HAI GIÀ FINITO'); // in OSSERVA `resolved` e' ancora quello del round scorso

    p.abilityUsed = true;
    abilityHub.activated(p.snap.id);
    this.ctx.signal(p.snap.id, { type: 'abilityUsed', name: ab.name });
    audio.select();

    switch (cid) {
      case 'goblin': {
        this.goblinReplayPending = true;
        this.showBanner(p, '🍺 ANCORA UN GIRO — replay privato in arrivo');
        break;
      }
      case 'dottore': {
        // Privato: la casella si vede SOLO sul telefono del Dottore (prima si illuminava sulla TV e la vedevano tutti). Costa tempo.
        const seq = this.sequences[this.round];
        const next = seq[p.inputIndex] ?? 0;
        p.penaltyMs += PEEK_PENALTY_MS;
        this.ctx.signal(p.snap.id, { type: 'hint', tile: next, ms: PEEK_SHOW_MS });
        this.showBanner(p, "🤦‍♂️ M'HO SVEJATO — ha sbirciato (+0,8 s)");
        break;
      }
      case 'judoka': {
        abilityHub.impact(p.snap.id, 'secondi fermati', PAUSE_S);
        // Tempo fermo: la scadenza slitta, lo spareggio non conta la pausa, i tasti restano bloccati 2 s, poi si riprende SUBITO
        p.deadline += PAUSE_S;
        p.pauseMs += PAUSE_S * 1000;
        p.pausedUntil = this.gameTime + PAUSE_S;
        const shout = JUDOKA_SHOUTS[Math.floor(Math.random() * JUDOKA_SHOUTS.length)];
        this.ctx.signal(p.snap.id, { type: 'pause', ms: PAUSE_S * 1000 });
        this.showBanner(p, `🥋 ${shout} — tempo fermo 2s`);
        break;
      }
      case 'ciro': {
        p.rateArmed = true;
        this.ctx.signal(p.snap.id, { type: 'rateArmed' });
        this.showBanner(p, '💸 A RATE — pausa a metà sequenza');
        break;
      }
    }
    this.updateCard(p);
  }

  private endRound(): void {
    this.phase = 'roundResult';
    this.phaseEndsAt = this.gameTime + (this.soloSurvivor() ? SOLO_ROUND_RESULT_S : ROUND_RESULT_S);
    const survivors = this.players.filter((p) => p.alive);
    this.centerText.setText(`FINE ROUND ${this.round + 1}`).setFontSize(60).setColor('#ffffff');
    this.subText.setText(survivors.length > 0 ? `In gara: ${survivors.length}` : 'Tutti eliminati!');
    if (survivors.length < this.players.length) audio.wrong();
    else audio.select();
  }

  private advanceRound(): void {
    // Fine ROUND ≠ fine MINIGIOCO: anche se resta un solo superstite si giocano tutti i round
    // previsti (5); il minigioco finisce solo dopo l'ultimo round o se sono usciti tutti.
    const aliveCount = this.players.filter((p) => p.alive).length;
    if (isMemoryOver(this.round, MEMORY_ROUNDS, aliveCount)) {
      this.showResults();
    } else {
      this.round += 1;
      this.startObserve();
    }
  }

  // ---- Risultati ----

  private rankPlayers(): PState[] {
    return [...this.players].sort((a, b) => {
      if (a.completedRounds !== b.completedRounds) return b.completedRounds - a.completedRounds;
      if (a.progress !== b.progress) return b.progress - a.progress;
      return a.totalTimeMs - b.totalTimeMs;
    });
  }

  private showResults(): void {
    this.phase = 'results';
    this.drunkTint.setAlpha(0);
    this.cameras.main.setRotation(0);
    this.centerText.setText('RISULTATI').setFontSize(64).setColor('#ffffff');
    this.subText.setText('Chi è arrivato più avanti vince');
    // Nasconde le tile per far spazio alla classifica.
    for (const o of [...this.tileRects, ...this.tileHalos, ...this.tileIcons, ...this.tileLabels]) {
      o.setVisible(false);
    }
    const ranking = this.rankPlayers();

    let t = 0;
    for (let i = ranking.length - 1; i >= 0; i--) {
      const at = t;
      t += i === 0 ? 560 : 520;
      this.time.delayedCall(at, () => this.revealRank(ranking[i], i + 1, i === 0));
    }
    this.time.delayedCall(t + 2200, () => this.finish(ranking));
  }

  private revealRank(p: PState, placement: number, isWinner: boolean): void {
    const medal = placement === 1 ? '🥇' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : `${placement}°`;
    const info = `${p.completedRounds} round · ${p.totalCorrect} mosse`;
    const txt = this.add
      .text(640, 150 + placement * 74, `${medal}  ${p.snap.avatar} ${p.snap.name} — ${info}`, {
        fontFamily: isWinner ? '"Arial Black", Arial, sans-serif' : 'Arial, sans-serif',
        fontSize: isWinner ? '36px' : '26px',
        color: isWinner ? '#fbbf24' : p.snap.color,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setScale(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: txt, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

    if (isWinner) {
      audio.fanfare();
      confetti(this, 640, 250);
    } else {
      audio.select();
    }
  }

  private finish(ranking: PState[]): void {
    if (this.finished) return;
    this.finished = true;
    const results = ranking.map((p, i) => ({
      playerId: p.snap.id,
      placement: i + 1,
      score: p.totalCorrect,
      stats: [`${p.completedRounds}/${MEMORY_ROUNDS} sequenze`, `${p.totalCorrect} mosse esatte`]
    }));
    this.ctx.finish({ results });
  }

  // ---- Effetti ----

  private flashTile(i: number): void {
    const rect = this.tileRects[i];
    const halo = this.tileHalos[i];
    rect.setScale(0.94);
    this.tweens.add({
      targets: rect,
      scale: 1.07,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => rect.setScale(1)
    });
    halo.setAlpha(0.55);
    this.tweens.add({ targets: halo, alpha: 0, duration: 380 });

    // Doppia visione "da ubriaco" dai round più avanti.
    if (this.round >= 2) {
      const ghost = this.add
        .rectangle(rect.x + 18, rect.y + 12, 220, 220, hex(MEMORY_TILES[i].color), 0.22)
        .setDepth(4);
      this.tweens.add({ targets: ghost, alpha: 0, duration: 320, onComplete: () => ghost.destroy() });
    }
    if (this.round >= 3) this.cameras.main.shake(60, 0.003);
  }

  private highlightTile(i: number, ms: number): void {
    const rect = this.tileRects[i];
    const halo = this.tileHalos[i];
    rect.setStrokeStyle(10, 0xffffff, 1);
    halo.setAlpha(0.7);
    this.tweens.add({ targets: rect, alpha: 1, scale: 1.06, duration: 120, yoyo: true, repeat: Math.floor(ms / 240) - 1 });
    this.time.delayedCall(ms, () => {
      rect.setStrokeStyle(6, 0xffffff, 0.85);
      halo.setAlpha(0);
    });
  }

  private showBanner(p: PState, text: string): void {
    const b = this.add
      .text(640, 646, `${p.snap.avatar} ${text}`, {
        fontFamily: FONT_DISPLAY,
        fontSize: '22px',
        color: p.snap.color
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setAlpha(0);
    this.tweens.add({ targets: b, alpha: 1, duration: 150, yoyo: true, hold: 900, onComplete: () => b.destroy() });
  }

  /** Stato PRESENTAZIONALE dell'abilita' (HUD/card), calcolato dallo stato vero del giocatore. */
  private abilityStatus(p: PState): AbilityStatus {
    if (!p.alive) return { state: 'SPENT', note: 'FUORI' };
    if (p.abilityUsed) {
      if (p.snap.characterId === 'judoka' && this.gameTime < p.pausedUntil) return { state: 'ACTIVE', remaining: p.pausedUntil - this.gameTime, note: 'TEMPO FERMO' };
      if (p.snap.characterId === 'ciro' && p.rateArmed) return { state: 'ACTIVE', note: 'PAUSA A META\' SEQUENZA' };
      if (p.snap.characterId === 'goblin' && this.goblinReplayPending) return { state: 'ACTIVE', note: 'REPLAY IN ARRIVO' };
      return { state: 'SPENT' };
    }
    const ph = MEMORY_ABILITIES[p.snap.characterId ?? '']?.phase;
    if (ph === 'passive') return { state: 'READY', note: 'ATTIVA DA SOLA' };
    if (ph === 'observe') return { state: 'READY', note: this.phase === 'observe' ? 'PRONTA · PREMI ORA' : 'PRONTA · MENTRE GUARDI' };
    return { state: 'READY', note: this.phase === 'repeat' ? 'PRONTA · PREMI ORA' : 'PRONTA · MENTRE RIPETI' };
  }

  private updateCard(p: PState): void {
    const seqLen = this.sequences[this.round]?.length ?? 0;
    let status: string;
    let color: string;
    if (!p.alive) {
      status = `💀 FUORI (${p.progress})`;
      color = '#f87171';
    } else if (p.resolved) {
      status = '✅ FATTO';
      color = '#4ade80';
    } else if (this.phase === 'observe' || this.phase === 'title') {
      status = '👀 OSSERVA';
      color = p.snap.color;
    } else {
      status = `${p.inputIndex}/${seqLen}`;
      color = p.snap.color;
    }
    const abName = MEMORY_ABILITIES[p.snap.characterId ?? '']?.name ?? 'ABILITÀ';
    const ab = this.abilityStatus(p);
    const ability = ab.state === 'SPENT' ? '⭐ usata' : ab.state === 'ACTIVE' ? `⭐ ${abName} · ${stateLabel(ab)}` : `⭐ ${abName}`;
    // SOLO stato aggregato (privacy in TOCCA): progresso, ✅ o 💀 — mai quale tessera
    p.card.setValue(status, color).setStatus(ability, ab.state === 'SPENT' ? UI.color.muted : ab.state === 'ACTIVE' ? '#facc15' : '#c4b5fd');
    p.card.setState(!p.alive ? 'out' : p.resolved ? 'done' : 'normal');
  }

  private applyDrunk(): void {
    const lvl = this.round;
    if (lvl >= 2) {
      const base = lvl >= 4 ? 0.1 : lvl === 3 ? 0.08 : 0.05;
      this.drunkTint.setAlpha(base + Math.sin(this.gameTime * 1.6) * 0.015);
    } else {
      this.drunkTint.setAlpha(0);
    }
    if (lvl >= 2) {
      this.cameras.main.setRotation(Math.sin(this.gameTime * 2.1) * (lvl - 1) * 0.0022);
    } else {
      this.cameras.main.setRotation(0);
    }
  }

  // ---- Loop ----

  update(_t: number, delta: number): void {
    if (this.pauseMenu.update()) return;
    if (this.finished) return;
    if (!this.controlsDone) {
      this.ctx.input.update(); // schermata CONTROLLI: nessuna fase avanza, nessun input di gioco consumato
      return;
    }

    const dt = Math.min(delta, 250) / 1000; // tempo reale fino a ~4 FPS
    this.gameTime += dt;
    this.soloBots.memory(dt, this.phase, this.round, (this.sequences[this.round] ?? []).slice(0, this.nextFlashIndex), this.players, this.gameTime);
    this.applyDrunk();
    for (const p of this.players) {
      abilityHub.setStatus(p.snap.id, this.abilityStatus(p)); // card sul telefono (solo presentazione)
      // fuori da OSSERVA / RIPETI il tasto non fa niente: ma lo si dice
      if (this.phase !== 'observe' && this.phase !== 'repeat' && p.alive && this.ctx.input.get(p.snap.id).justPressed('ability')) abilityHub.failed(p.snap.id, 'NON ORA');
    }

    switch (this.phase) {
      case 'title':
        if (this.gameTime >= this.phaseEndsAt) this.startObserve();
        break;
      case 'observe':
        this.updateObserve();
        break;
      case 'repeat':
        this.updateRepeat();
        break;
      case 'roundResult':
        if (this.gameTime >= this.phaseEndsAt) this.advanceRound();
        break;
      case 'results':
        break;
    }

    this.ctx.input.update();
  }
}
