import { PartyBots } from '../bots/PartyBots';
import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { confetti } from '../../scenes/confetti';
import { PauseMenu } from '../../core/PauseMenu';
import type { CulturaQuestion } from '../../../shared/culturaQuestions';
import { selectCulturaQuestions } from './selection';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';
import { addBackdrop } from '../../scenes/backdrops';
import { phaseStepper, pill } from '../../core/uiPhaser';
import { FONT_DISPLAY, FONT_BODY } from '../../core/uiTokens';
import { AB, abilityFor } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';
import { abilityHub } from '../../core/abilityHub';

// CULTURA O CAZZATA? — bluff culturale a round.
// Fasi: intro domanda → bluff (telefono) → opzioni → voto → reveal → spiegazione.

const TOTAL_ROUNDS = 8;
// Ritmo: partita da ~5-7 minuti (prima ~8). I timer sono il TETTO: quando tutti hanno consegnato
// bluff/voto la fase si chiude dopo EARLY_GRACE_S invece di aspettare la scadenza.
const INTRO_S = 2.2;
const BLUFF_S = 20;
const OPTIONS_S = 2.5;
const VOTE_S = 12;
const REVEAL_S = 16;
const REVEAL_STEP_S = 1.8; // un passo di rivelazione per ogni risposta sbagliata
const EXPLANATION_S = 5.5;
const RANKING_S = 3.5;
const EARLY_GRACE_S = 1.5;
const FINAL_BONUS = 5;

const REVEAL_BAD = [
  'ERA UNA CAZZATA DI',
  'STRONZATA DI',
  "SE L'È INVENTATA DI SANA PIANTA:",
  'AVETE CREDUTO A'
];

type Phase = 'intro' | 'bluff' | 'options' | 'vote' | 'reveal' | 'explanation' | 'ranking' | 'results';

interface Opt {
  text: string;
  ownerId: PlayerId | null; // null = corretta o decoy di sistema
  isCorrect: boolean;
}

interface PScore {
  cultura: number;
  furbizia: number;
  correct: number;
  deceived: number; // volte che è cascato in un bluff
  deceivedOthers: number; // persone fregate dal suo bluff
}

export class CulturaScene extends Phaser.Scene {
  private soloBots!: PartyBots;
  private ctx!: MinigameContext;
  private questions: CulturaQuestion[] = [];
  private round = 0;
  private phase: Phase = 'intro';
  private stepper!: ReturnType<typeof phaseStepper>;
  private holdForControls = false;
  private gameTime = 0;
  private phaseEndsAt = 0;
  private finished = false;

  private bluffs = new Map<PlayerId, string>();
  private options: Opt[] = [];
  private votes = new Map<PlayerId, number>();
  private scores = new Map<PlayerId, PScore>();
  private usedIds = new Set<string>();
  private currentQuestion!: CulturaQuestion;

  private teConoscoUsed = new Set<PlayerId>();
  // ABILITA' DI PERSONAGGIO (una volta a partita, nella fase di scelta): distinte da TE CONOSCO (di tutti), Secchione e Avvocato (ruoli del round)
  private abilityUsed = new Set<PlayerId>();
  private wager = new Set<PlayerId>(); // Goblin: ha puntato forte su questo round
  private hidden = new Map<PlayerId, number>(); // Buttafuori: opzione buttata fuori (solo per lui)
  private hints = new Map<PlayerId, string>(); // Dottore: intuizione sulla risposta vera
  private peeking = new Set<PlayerId>(); // Ciro: vede i voti in tempo reale
  private earlyBlocked = false; // Judoka: il voto non si chiude in anticipo
  private lastPeekAt = 0;
  private voteBonus = 0; // Judoka: secondi in piu' al voto (se usata prima che il voto parta)
  private secchioneId: PlayerId | null = null;
  private advocate: { pid: PlayerId; optIndex: number } | null = null;

  private titleText!: Phaser.GameObjects.Text;
  private mainText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private pauseMenu!: PauseMenu;

  constructor() {
    super('cultura');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    this.soloBots = new PartyBots(this.ctx);
    this.round = 0;
    this.phase = 'intro';
    this.gameTime = 0;
    this.finished = false;
    this.bluffs = new Map();
    this.votes = new Map();
    this.scores = new Map();
    this.usedIds = new Set();
    this.teConoscoUsed = new Set();
    this.abilityUsed = new Set();
    this.wager = new Set();
    this.hidden = new Map();
    this.hints = new Map();
    this.peeking = new Set();
    this.earlyBlocked = false;
    this.voteBonus = 0;
    this.secchioneId = null;
    this.advocate = null;
    abilityHub.begin('cultura', this.ctx);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => abilityHub.end());

    audio.unlock();
    this.cameras.main.setBackgroundColor('#12082a');

    addBackdrop(this, 'cultura'); // scenografia: quiz da bar, lavagna dietro la domanda (solo sfondo)
    this.titleText = this.add.text(640, 58, '🧠 CULTURA O CAZZATA?', { fontFamily: FONT_DISPLAY, fontSize: '36px', color: '#fbbf24' }).setOrigin(0.5).setStroke('#000000', 3);
    // fasi sempre visibili: si capisce cosa fare senza leggere spiegazioni
    this.stepper = phaseStepper(this, 106, ['SCRIVI LA CAZZATA', 'SCEGLI', 'RIVELAZIONE', 'RISPOSTA VERA']);
    this.stepper.set(-1);
    this.mainText = this.add.text(640, 250, '', { fontFamily: FONT_BODY, fontSize: '26px', color: '#ffffff', align: 'center', wordWrap: { width: 1100 } }).setOrigin(0.5);
    this.subText = this.add.text(640, 470, '', { fontFamily: FONT_BODY, fontStyle: 'bold', fontSize: '22px', color: '#c4b5fd', align: 'center', wordWrap: { width: 1100 } }).setOrigin(0.5);
    this.scoreText = this.add.text(30, 100, '', { fontFamily: FONT_BODY, fontSize: '18px', color: '#9ca3af' }).setOrigin(0, 0);
    this.timerText = this.add.text(1232, 58, '', { fontFamily: FONT_DISPLAY, fontSize: '40px', color: '#fbbf24' }).setOrigin(1, 0.5).setStroke('#000000', 3);
    this.statusText = this.add.text(640, 648, '', { fontFamily: FONT_DISPLAY, fontSize: '22px', color: '#c4b5fd', align: 'center', wordWrap: { width: 1150 } }).setOrigin(0.5);

    this.ctx.players.forEach((p) => this.scores.set(p.id, { cultura: 0, furbizia: 0, correct: 0, deceived: 0, deceivedOthers: 0 }));
    // Prepara le domande senza ripetizioni.
    this.prepareQuestions();

    this.pauseMenu = new PauseMenu(this, '🧠 CULTURA O CAZZATA?', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));

    // "PRENDETE I TELEFONI" (solo se in stanza c'e' chi gioca col controller): il gioco parte a schermata chiusa
    this.holdForControls = true;
    const ready = this.ctx.showControls ? this.ctx.showControls() : Promise.resolve();
    void ready.then(() => (this.holdForControls = false));
    this.startRound();
  }

  private prepareQuestions(): void {
    // mescolate con l'rng della partita, senza ripetere le domande recenti, categorie diverse fra i round (selection.ts)
    this.questions = selectCulturaQuestions(this.ctx.rng, TOTAL_ROUNDS);
  }

  private total(p: PScore): number {
    return p.cultura + p.furbizia;
  }

  // ---- Fasi ----

  private startRound(): void {
    this.phase = 'intro';
    this.currentQuestion = this.questions[this.round];
    this.bluffs = new Map();
    this.votes = new Map();
    this.advocate = null;
    this.wager = new Set(); // le scommesse e gli effetti valgono per il round in cui si usano
    this.hidden = new Map();
    this.hints = new Map();
    this.peeking = new Set();
    this.earlyBlocked = false;
    this.voteBonus = 0;
    this.phaseEndsAt = this.gameTime + INTRO_S;
    // I testi dei telefoni persistono tra un round e l'altro: senza questo chi non rispondeva riusava il
    // bluff (o il voto!) del round precedente.
    for (const p of this.ctx.players) {
      const inp = this.ctx.input.get(p.id);
      inp.clearText('bluff');
      inp.clearText('vote');
    }

    // Secchione Infame: round 3 e 6 (1-based)
    const isSecchioneRound = this.round === 2 || this.round === 5;
    this.secchioneId = isSecchioneRound ? this.ctx.playerIds[Math.floor(this.ctx.rng.next() * this.ctx.playerIds.length)] : null;
    if (isSecchioneRound) audio.culturaRole('secchione'); // campanella: questo round c'e' il Secchione

    // Avvocato della cazzata: round 2 e 5 (1-based)
    const isAdvocateRound = this.round === 1 || this.round === 4;

    this.titleText.setText(`ROUND ${this.round + 1}/${TOTAL_ROUNDS} · ${this.currentQuestion.category.toUpperCase()}`);
    this.mainText.setText(`"${this.currentQuestion.question}"`).setFontSize(40).setColor('#ffffff'); // grande: si legge dal divano
    this.subText.setText('✍️ INVENTATE UNA CAZZATA CREDIBILE').setFontSize(28).setColor('#c4b5fd');
    audio.culturaQuestion();

    this.broadcastState();
    if (isAdvocateRound) this.advocatePending = true;
  }

  private advocatePending = false;
  private earlyBluff = false;
  private earlyVote = false;

  private hasValidVote(pid: PlayerId): boolean {
    const idx = parseInt(this.ctx.input.get(pid).text('vote'), 10);
    return !Number.isNaN(idx) && idx >= 0 && idx < this.options.length;
  }

  private enterBluff(): void {
    this.earlyBluff = false;
    this.phase = 'bluff';
    this.stepper.set(0);
    this.phaseEndsAt = this.gameTime + BLUFF_S;
  }

  private endBluff(): void {
    // Raccogli bluff (fallback decoy per chi non ha risposto / duplicati / risposta vera).
    // `used` confronta i testi normalizzati: un bluff "sette" e il decoy "Sette" sono la stessa opzione, non due.
    const used = new Set<string>();
    const decoys = [...this.currentQuestion.fallbackDecoys];
    for (const p of this.ctx.players) {
      let text = this.normalize(this.ctx.input.get(p.id).text('bluff'));
      const isCorrect = text.length > 0 && this.isSame(text, this.currentQuestion.correctAnswer);
      if (text.length === 0 || used.has(text) || isCorrect) {
        // sostituisci con un decoy
        text = decoys.shift() ?? `${this.currentQuestion.correctAnswer} (ma sbagliato)`;
        while (used.has(this.normalize(text)) && decoys.length > 0) text = decoys.shift()!;
      }
      used.add(this.normalize(text));
      this.bluffs.set(p.id, text);
    }
    // Costruisci opzioni: bluff + risposta vera + eventuali decoy fino a 5-6.
    this.options = [];
    for (const p of this.ctx.players) {
      this.options.push({ text: this.bluffs.get(p.id)!, ownerId: p.id, isCorrect: false });
    }
    this.options.push({ text: this.currentQuestion.correctAnswer, ownerId: null, isCorrect: true });
    let di = 0;
    while (this.options.length < 5 && di < this.currentQuestion.fallbackDecoys.length) {
      const d = this.currentQuestion.fallbackDecoys[di++];
      if (!this.options.some((o) => this.isSame(o.text, d))) this.options.push({ text: d, ownerId: null, isCorrect: false });
    }
    // Shuffle
    for (let i = this.options.length - 1; i > 0; i--) {
      const j = Math.floor(this.ctx.rng.next() * (i + 1));
      [this.options[i], this.options[j]] = [this.options[j], this.options[i]];
    }
    // Avvocato (se previsto)
    if (this.advocatePending) {
      const pid = this.ctx.playerIds[Math.floor(this.ctx.rng.next() * this.ctx.playerIds.length)];
      const optIndex = Math.floor(this.ctx.rng.next() * this.options.length);
      this.advocate = { pid, optIndex };
      this.advocatePending = false;
      audio.culturaRole('avvocato'); // martelletto: entra l'Avvocato della cazzata
    }

    this.phase = 'options';
    this.stepper.set(1);
    this.phaseEndsAt = this.gameTime + OPTIONS_S;
    this.renderOptions();
    this.broadcastState();
  }

  private enterVote(): void {
    this.earlyVote = false;
    this.phase = 'vote';
    this.phaseEndsAt = this.gameTime + VOTE_S + this.voteBonus;
    this.renderOptions();
    this.broadcastState();
  }

  private endVote(): void {
    for (const p of this.ctx.players) {
      const raw = this.ctx.input.get(p.id).text('vote');
      const idx = parseInt(raw, 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < this.options.length) this.votes.set(p.id, idx);
    }
    this.resolveScoring();
    this.phase = 'reveal';
    this.stepper.set(2);
    this.phaseEndsAt = this.gameTime + REVEAL_S;
    this.revealStep = 0;
    this.revealTimer = 0;
    this.renderRevealFrame();
    this.broadcastState();
  }

  private revealStep = 0;
  private revealTimer = 0;

  private resolveScoring(): void {
    const finalRound = this.round === TOTAL_ROUNDS - 1;
    const points = finalRound ? FINAL_BONUS : 3;
    // GOBLIN — N'CULO!: la puntata si risolve col voto FINALE (dopo i punti normali, che restano invariati)
    for (const pid of this.wager) {
      const idx = this.votes.get(pid);
      const s = this.scores.get(pid);
      if (!s || idx === undefined) continue; // niente voto: nessuna vincita e nessuna perdita
      if (this.options[idx]?.isCorrect) {
        s.cultura += AB.cultura.goblin.p.bonus;
        abilityHub.succeeded(pid, 'punti vinti', AB.cultura.goblin.p.bonus);
      } else {
        const lost = Math.min(s.cultura + s.furbizia, AB.cultura.goblin.p.penalty);
        s.cultura = Math.max(0, s.cultura - AB.cultura.goblin.p.penalty);
        abilityHub.wasted(pid);
        abilityHub.impact(pid, 'punti persi', lost);
      }
    }
    for (const o of this.options) {
      if (o.isCorrect) {
        for (const [pid, idx] of this.votes) {
          if (idx === this.options.indexOf(o)) {
            const s = this.scores.get(pid)!;
            if (pid !== this.secchioneId) s.cultura += points;
            s.correct++;
          }
        }
      } else if (o.ownerId) {
        let victims = 0;
        for (const [pid, idx] of this.votes) {
          if (idx === this.options.indexOf(o) && pid !== o.ownerId) {
            victims++;
            this.scores.get(pid)!.deceived++;
          }
        }
        this.scores.get(o.ownerId)!.furbizia += victims;
        this.scores.get(o.ownerId)!.deceivedOthers += victims;
      }
    }
  }

  private renderRevealFrame(): void {
    const wrongOpts = this.options.filter((o) => !o.isCorrect);
    const correctOpt = this.options.find((o) => o.isCorrect)!;
    const o = wrongOpts[this.revealStep];
    if (o) {
      const label = o.ownerId ? `${REVEAL_BAD[this.revealStep % REVEAL_BAD.length]} ${this.playerName(o.ownerId).toUpperCase()}` : 'RISPOSTA DEL SISTEMA';
      const victims = [...this.votes.entries()].filter(([, idx]) => idx === this.options.indexOf(o) && (!o.ownerId || idx !== this.options.indexOf(o))).map(([pid]) => this.playerName(pid));
      this.mainText.setText(`${o.text.toUpperCase()}`).setFontSize(44).setColor('#f87171');
      this.subText.setText(`❌ ${label}\n${victims.length > 0 ? 'CI SONO CASCATI: ' + victims.join(', ') : 'NESSUNO GLI HA CREDUTO. MIRACOLO.'}`);
      audio.bluffReveal(o.ownerId ? this.ctx.players.find((pl) => pl.id === o.ownerId)?.characterId === 'ciro' : false); // ogni cazzata: piccolo stinger (quella di Ciro con la monetina)
    } else {
      const winners = [...this.votes.entries()].filter(([, idx]) => idx === this.options.indexOf(correctOpt)).map(([pid]) => this.playerName(pid));
      this.stepper.set(3);
      this.mainText.setText(`✅ ${correctOpt.text.toUpperCase()}`).setFontSize(44).setColor('#4ade80');
      this.subText.setText(`RISPOSTA CORRETTA.\n${winners.length > 0 ? 'L\'HANNO SCELTA: ' + winners.join(', ') : 'NESSUNO L\'HA TROVATA!'}`);
      audio.culturaCorrect(); // la risposta vera: stinger piu' importante
      confetti(this, 640, 300);
    }
  }

  private enterExplanation(): void {
    this.phase = 'explanation';
    this.stepper.set(3);
    this.phaseEndsAt = this.gameTime + EXPLANATION_S;
    this.mainText.setText(`📚 PERCHÉ?\n\n${this.currentQuestion.explanation}`).setFontSize(22).setColor('#ffffff');
    this.subText.setText(this.currentQuestion.funFact ? `💡 CURIOSITÀ\n${this.currentQuestion.funFact}` : '');
    this.renderScores();
    this.broadcastState();
  }

  private afterExplanation(): void {
    this.round++;
    if (this.round >= this.questions.length || this.round >= TOTAL_ROUNDS) {
      this.phase = 'results';
      this.stepper.set(-1);
      this.finished = true;
      this.renderResults();
      this.broadcastState();
      this.ctx.finish({ results: this.buildResults() });
      return;
    }
    if (this.round % 2 === 0) {
      this.phase = 'ranking';
      this.stepper.set(-1);
      this.phaseEndsAt = this.gameTime + RANKING_S;
      this.renderRanking();
    } else {
      this.startRound();
    }
  }

  // ---- UI ----

  private renderOptions(): void {
    const letters = 'ABCDE';
    const lines = this.options.map((o, i) => `${letters[i]} — ${o.text.toUpperCase()}`);
    this.mainText.setText('🔥 ECCO LE STRONZATE').setFontSize(32).setColor('#ffffff');
    this.subText.setText(lines.join('\n')).setFontSize(22).setColor('#e0e7ff');
  }

  private renderScores(): void {
    this.scoreText.setText(this.playersSorted().map((p) => `${p.avatar} ${p.name} — ${this.total(this.scores.get(p.id)!)}`).join('\n'));
  }

  private renderRanking(): void {
    this.mainText.setText('📊 CLASSIFICA').setFontSize(40).setColor('#fbbf24');
    this.subText.setText(this.playersSorted().map((p, i) => `${i + 1}. ${p.avatar} ${p.name} — ${this.total(this.scores.get(p.id)!)}`).join('\n'));
    audio.select();
  }

  private renderResults(): void {
    const sorted = this.playersSorted();
    this.mainText.setText('🏁 RISULTATI FINALI').setFontSize(40).setColor('#fbbf24');
    this.subText.setText(sorted.map((p, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`} ${p.avatar} ${p.name} — ${this.total(this.scores.get(p.id)!)}`).join('\n'));
    audio.fanfare();
  }

  private playersSorted() {
    return [...this.ctx.players].sort((a, b) => {
      const sa = this.scores.get(a.id)!;
      const sb = this.scores.get(b.id)!;
      if (this.total(sa) !== this.total(sb)) return this.total(sb) - this.total(sa);
      if (sa.correct !== sb.correct) return sb.correct - sa.correct;
      return sb.deceivedOthers - sa.deceivedOthers;
    });
  }

  private buildResults() {
    return this.playersSorted().map((p, i) => {
      const sc = this.scores.get(p.id)!;
      return {
        playerId: p.id,
        placement: i + 1,
        score: this.total(sc),
        stats: [`${sc.correct} risposte esatte`, `${sc.deceivedOthers} persone fregate`]
      };
    });
  }

  private playerName(id: PlayerId): string {
    return this.ctx.players.find((p) => p.id === id)?.name ?? '?';
  }

  private normalize(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!]+$/g, '').trim();
  }

  private isSame(a: string, b: string): boolean {
    return this.normalize(a) === this.normalize(b);
  }

  // ---- Abilità di personaggio ----

  /** Legge le richieste di abilita' dai telefoni (il tasto manda un testo 'ability'): una pressione = un tentativo. */
  private handleAbilityRequests(): void {
    for (const p of this.ctx.players) {
      const inp = this.ctx.input.get(p.id);
      if (inp.text('ability')) {
        inp.clearText('ability');
        const why = this.useAbility(p.id);
        if (why) abilityHub.failed(p.id, why); // premuta ma non partita: avviso privato col motivo
      }
      abilityHub.setStatus(p.id, this.abilityStatus(p.id)); // card/HUD (solo presentazione)
    }
  }

  /** null = partita; altrimenti il motivo (breve, in maiuscolo) per cui non puo' partire ora. */
  private useAbility(pid: PlayerId): string | null {
    if (this.abilityUsed.has(pid)) return 'ESAURITA';
    if (this.phase !== 'options' && this.phase !== 'vote') return "SOLO QUANDO SI VOTA";
    const player = this.ctx.players.find((x) => x.id === pid);
    const cid = player?.characterId;
    if (!player || !cid) return 'NON ORA';
    const sc = this.scores.get(pid)!;
    switch (cid) {
      case 'goblin':
        if (this.secchioneId === pid) return 'SEI IL SECCHIONE';
        this.wager.add(pid);
        break;
      case 'buttafuori': {
        const cand = this.options.map((o, i) => ({ o, i })).filter(({ o, i }) => !o.isCorrect && o.ownerId !== pid && !this.hidden.has(pid) && i !== this.hidden.get(pid));
        if (cand.length === 0) return 'NIENTE DA BUTTARE';
        this.hidden.set(pid, cand[Math.floor(this.ctx.rng.next() * cand.length)].i);
        abilityHub.succeeded(pid, 'risposte buttate fuori');
        break;
      }
      case 'judoka': {
        const extra = AB.cultura.judoka.p.extra;
        this.earlyBlocked = true;
        if (this.phase === 'vote') this.phaseEndsAt = Math.max(this.phaseEndsAt, this.gameTime) + extra;
        else this.voteBonus += extra;
        abilityHub.succeeded(pid, 'secondi aggiunti', extra);
        break;
      }
      case 'dottore': {
        if (this.secchioneId === pid) return 'SAI GIÀ LA RISPOSTA';
        const correct = this.currentQuestion.correctAnswer.trim();
        const words = correct.split(/\s+/).filter(Boolean);
        const article = /^(il|lo|la|le|gli|i|un|uno|una|l'|un')$/i;
        let main = words.find((w, i) => !(article.test(w) && i < words.length - 1)) ?? words[0] ?? correct;
        main = main.replace(/^[a-zà-ú]'/i, '');
        this.hints.set(pid, `INIZIA PER "${main.charAt(0).toUpperCase()}" · ${words.length} ${words.length === 1 ? 'PAROLA' : 'PAROLE'}`);
        // la parcella: costa punti, ma mai sotto zero
        const cost = AB.cultura.dottore.p.cost;
        if (sc.cultura >= cost) sc.cultura -= cost;
        else if (sc.furbizia >= cost) sc.furbizia -= cost;
        abilityHub.impact(pid, 'parcelle pagate', cost);
        break;
      }
      case 'ciro': {
        this.peeking.add(pid);
        if (this.phase === 'vote') this.phaseEndsAt = Math.max(this.phaseEndsAt, this.gameTime + AB.cultura.ciro.p.extra);
        abilityHub.impact(pid, 'round con i voti in vista');
        break;
      }
      default:
        return 'NON ORA';
    }
    this.abilityUsed.add(pid);
    abilityHub.activated(pid);
    audio.select();
    const def = abilityFor('cultura', cid);
    // sulla TV si vede CHE e' partita (nome sopra), mai l'effetto privato
    const tag = pill(this, 640, 596, `${player.avatar} ${player.name.toUpperCase()} — ${def?.name ?? 'ABILITÀ'}!`, player.color, 26).setDepth(950);
    this.tweens.add({ targets: tag, alpha: 0, y: 576, delay: 1100, duration: 400, onComplete: () => tag.destroy() });
    this.ctx.vibrate(pid, 80);
    this.ctx.sendPrivate(pid, this.buildPhoneState(pid));
    if (cid === 'judoka') this.broadcastState(); // il timer di tutti e' cambiato
    return null;
  }

  /** Conteggio dei voti correnti per opzione, senza i nomi e senza il proprio (per ULTIMO GIORNO UTILE). */
  private peekCounts(pid: PlayerId): number[] {
    const counts = this.options.map(() => 0);
    for (const p of this.ctx.players) {
      if (p.id === pid) continue;
      const idx = parseInt(this.ctx.input.get(p.id).text('vote'), 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < counts.length) counts[idx]++;
    }
    return counts;
  }

  /** Stato PRESENTAZIONALE dell'abilita' (telefono e card), calcolato dallo stato vero. */
  private abilityStatus(pid: PlayerId): AbilityStatus {
    if (this.wager.has(pid) && this.phase !== 'intro' && this.phase !== 'bluff') return { state: 'ACTIVE', note: `ALL-IN: +${AB.cultura.goblin.p.bonus} / −${AB.cultura.goblin.p.penalty}` };
    if (this.peeking.has(pid) && this.phase === 'vote') return { state: 'ACTIVE', note: 'VEDI I VOTI' };
    if (this.hints.has(pid) && (this.phase === 'options' || this.phase === 'vote')) return { state: 'ACTIVE', note: 'INTUIZIONE ARRIVATA' };
    if (this.hidden.has(pid) && (this.phase === 'options' || this.phase === 'vote')) return { state: 'ACTIVE', note: 'UNA RISPOSTA BUTTATA FUORI' };
    if (this.abilityUsed.has(pid)) return { state: 'SPENT' };
    return { state: 'READY', note: this.phase === 'vote' ? 'PRONTA · PREMI ORA' : 'PRONTA · QUANDO SI VOTA' };
  }

  private abilityPayload(pid: PlayerId): { name: string; short: string; full: string; state: string; note: string } | null {
    const p = this.ctx.players.find((x) => x.id === pid);
    const def = abilityFor('cultura', p?.characterId);
    if (!def) return null;
    const st = this.abilityStatus(pid);
    return { name: def.name, short: def.short, full: def.full, state: st.state, note: st.note ?? '' };
  }

  // ---- Stato ai telefoni ----

  private broadcastState(): void {
    for (const p of this.ctx.players) {
      const state = this.buildPhoneState(p.id);
      this.ctx.sendPrivate(p.id, state);
    }
  }

  private buildPhoneState(pid: PlayerId): unknown {
    const p = this.ctx.players.find((x) => x.id === pid)!;
    const myBluff = this.bluffs.get(pid);
    const myVote = this.votes.get(pid);
    const isSecchione = this.secchioneId === pid;
    const isAdvocate = this.advocate?.pid === pid;
    return {
      type: 'cultura',
      phase: this.phase,
      round: this.round + 1,
      totalRounds: TOTAL_ROUNDS,
      question: this.currentQuestion?.question ?? '',
      category: this.currentQuestion?.category ?? '',
      myScore: this.total(this.scores.get(pid)!),
      ranking: this.playersSorted().map((x) => ({ name: x.name, avatar: x.avatar, score: this.total(this.scores.get(x.id)!) })),
      // bluff
      myBluff,
      // voto
      options: this.phase === 'vote' || this.phase === 'options' ? this.options.map((o, i) => ({ text: o.text, isMine: o.ownerId === pid, disabled: o.ownerId === pid || this.hidden.get(pid) === i, thrownOut: this.hidden.get(pid) === i })) : [],
      myVote: myVote ?? null,
      canTeConosco: this.phase === 'vote' && !this.teConoscoUsed.has(pid),
      teConoscoTargets: this.ctx.players.filter((x) => x.id !== pid).map((x) => ({ id: x.id, name: x.name })),
      teConoscoReveal: this.teConoscoReveals.get(pid) ?? null,
      // secchione
      isSecchione,
      correctAnswer: isSecchione ? this.currentQuestion?.correctAnswer ?? '' : undefined,
      // avvocato
      isAdvocate,
      defendText: isAdvocate && this.advocate ? this.options[this.advocate.optIndex]?.text ?? '' : undefined,
      // ABILITA' DI PERSONAGGIO (solo per questo giocatore: l'effetto resta privato)
      ability: this.abilityPayload(pid),
      hint: this.hints.get(pid) ?? null,
      voteCounts: this.peeking.has(pid) ? this.peekCounts(pid) : null,
      wager: this.wager.has(pid),
      // reveal
      reveal: this.revealFor(pid)
    };
  }

  private teConoscoReveals = new Map<PlayerId, string>();

  private revealFor(pid: PlayerId): unknown {
    if (this.phase !== 'reveal' && this.phase !== 'explanation') return null;
    const myVote = this.votes.get(pid);
    if (myVote === undefined) return { text: 'Non hai votato', correct: false };
    const opt = this.options[myVote];
    return { text: opt.text, correct: opt.isCorrect };
  }

  // ---- Loop ----

  update(_t: number, delta: number): void {
    if (this.pauseMenu.update()) return;
    if (this.holdForControls) {
      this.ctx.input.update();
      return; // schermata "PRENDETE I TELEFONI": nessun timer parte
    }
    if (this.finished) {
      this.ctx.input.update();
      return;
    }
    const dt = Math.min(delta, 250) / 1000; // tempo reale fino a ~4 FPS
    this.gameTime += dt;
    this.soloBots.cultura(dt, this.phase, this.round, this.currentQuestion.fallbackDecoys, this.options, this.hidden);
    this.handleAbilityRequests();

    switch (this.phase) {
      case 'intro':
        if (this.gameTime >= this.phaseEndsAt) this.enterBluff();
        break;
      case 'bluff':
        if (!this.earlyBluff && this.ctx.players.every((p) => this.normalize(this.ctx.input.get(p.id).text('bluff')).length > 0)) {
          this.earlyBluff = true; // tutti hanno scritto: chiudi dopo una breve pausa
          this.phaseEndsAt = Math.min(this.phaseEndsAt, this.gameTime + EARLY_GRACE_S);
        }
        if (this.gameTime >= this.phaseEndsAt) this.endBluff();
        break;
      case 'options':
        if (this.gameTime >= this.phaseEndsAt) this.enterVote();
        break;
      case 'vote': {
        // Te Conosco (una volta a partita)
        for (const p of this.ctx.players) {
          const target = this.ctx.input.get(p.id).text('teConosco');
          if (target && !this.teConoscoUsed.has(p.id)) {
            this.teConoscoUsed.add(p.id);
            const t = this.ctx.players.find((x) => x.id === target || x.name === target);
            if (t && this.bluffs.has(t.id)) {
              this.teConoscoReveals.set(p.id, `${t.name} ha scritto: ${this.bluffs.get(t.id)}`);
              this.ctx.sendPrivate(p.id, this.buildPhoneState(p.id));
            }
          }
        }
        // CIRO (ULTIMO GIORNO UTILE): i conteggi dei voti si aggiornano in tempo reale solo sul suo telefono
        if (this.peeking.size > 0 && this.gameTime - this.lastPeekAt >= 0.5) {
          this.lastPeekAt = this.gameTime;
          for (const pid of this.peeking) this.ctx.sendPrivate(pid, this.buildPhoneState(pid));
        }
        if (!this.earlyVote && !this.earlyBlocked && this.ctx.players.every((p) => this.hasValidVote(p.id))) {
          this.earlyVote = true; // tutti hanno votato
          this.phaseEndsAt = Math.min(this.phaseEndsAt, this.gameTime + EARLY_GRACE_S);
        }
        if (this.gameTime >= this.phaseEndsAt) this.endVote();
        break;
      }
      case 'reveal': {
        this.revealTimer += dt;
        if (this.revealTimer >= REVEAL_STEP_S) {
          this.revealTimer = 0;
          this.revealStep++;
          this.renderRevealFrame();
        }
        if (this.revealStep > this.options.filter((o) => !o.isCorrect).length) {
          this.enterExplanation();
        }
        break;
      }
      case 'explanation':
        if (this.gameTime >= this.phaseEndsAt) this.afterExplanation();
        break;
      case 'ranking':
        if (this.gameTime >= this.phaseEndsAt) this.startRound();
        break;
      case 'results':
        break;
    }

    this.updateHud();
    this.ctx.input.update();
  }

  /** Timer della fase e chi ha gia' risposto: tensione sullo schermo condiviso (solo durante scrittura e voto). */
  private updateHud(): void {
    let timer = '';
    let status = '';
    if (this.phase === 'bluff' || this.phase === 'vote') {
      const left = Math.max(0, Math.ceil(this.phaseEndsAt - this.gameTime));
      timer = `⏱ ${left}`;
      this.timerText.setColor(left <= 10 ? '#f87171' : '#fbbf24');
      const bluff = this.phase === 'bluff';
      status = this.ctx.players
        .map((p) => `${(bluff ? this.normalize(this.ctx.input.get(p.id).text('bluff')).length > 0 : this.hasValidVote(p.id)) ? '✅' : bluff ? '✍️' : '🗳️'} ${p.name}`)
        .join('     ');
    }
    if (this.timerText.text !== timer) this.timerText.setText(timer);
    if (this.statusText.text !== status) this.statusText.setText(status);
  }
}
