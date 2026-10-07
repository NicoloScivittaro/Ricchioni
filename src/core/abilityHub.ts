import type { MinigameContext } from '../minigames/types';
import type { PlayerId } from '../../shared/types';
import { abilityFor } from '../../shared/abilityCatalog';
import type { AbilityGameId, AbilityStatus } from '../../shared/abilityCatalog';
import { HAPTIC } from './haptics';
import { telemetry } from './telemetry';
import { debugEnabled } from './debug';

/**
 * ABILITY HUB (host). NON simula niente: ogni minigioco resta l'unica autorita' sullo stato della propria abilita' e qui lo
 * PUBBLICA (setStatus) con le stesse 5 parole per tutti i giochi: READY / CHARGING / ACTIVE / COOLDOWN / SPENT. Da questo stato
 * leggono l'HUD sulla TV (onStatus) e la Companion Card sul telefono (messaggio privato 'ability') — mai due stati indipendenti.
 *
 * Fa anche tre altri lavori, tutti solo di presentazione/diagnostica:
 *  - failed(): feedback PRIVATO quando il tasto e' premuto ma l'abilita' non puo' partire ("NON ORA", "ESAURITA"...), mai silenzio;
 *  - activated(): conta l'uso e manda al telefono il lampo col nome dell'abilita' ("ha funzionato?" non deve restare un dubbio);
 *  - statistiche per il report di sessione (F4): usi, riusciti, falliti, impatto. Solo debug, nessun effetto sul gameplay.
 */

export type AbilityListener = (playerId: PlayerId, status: AbilityStatus) => void;

interface PState {
  characterId: string | null;
  last: AbilityStatus | null;
  sentKey: string;
  sentAt: number;
  uses: number;
  successes: number;
  failures: number;
  impact: Record<string, number>;
  lastFailAt: number;
  lastFailText: string;
}

/** Minimo tra due messaggi di errore identici allo stesso giocatore (premere a raffica non deve intasare il telefono). */
const FAIL_GAP_MS = 450;
/** Con un tempo residuo il telefono lo scala da solo: basta un riallineamento ogni secondo. */
const RESYNC_MS = 1000;

export interface AbilityRow {
  playerId: PlayerId;
  characterId: string | null;
  abilityName: string;
  uses: number;
  successes: number;
  failures: number;
  impact: Record<string, number>;
}

class AbilityHub {
  private ctx: MinigameContext | null = null;
  private game: AbilityGameId | null = null;
  private players = new Map<PlayerId, PState>();
  private listeners = new Set<AbilityListener>();
  private now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /** Inizio round: azzera tutto (nessun residuo del round precedente) e dice ai telefoni che l'abilita' e' PRONTA. */
  begin(game: AbilityGameId, ctx: MinigameContext): void {
    this.end();
    this.ctx = ctx;
    this.game = game;
    this.players = new Map();
    for (const p of ctx.players) {
      this.players.set(p.id, {
        characterId: p.characterId,
        last: null,
        sentKey: '',
        sentAt: 0,
        uses: 0,
        successes: 0,
        failures: 0,
        impact: {},
        lastFailAt: -1e9,
        lastFailText: ''
      });
    }
  }

  /** Fine round / scena chiusa / restart: consegna le statistiche, spegne la card sui telefoni, dimentica tutto. Idempotente. */
  end(): void {
    const ctx = this.ctx;
    const game = this.game;
    if (!ctx || !game) {
      this.reset();
      return;
    }
    const rows = this.rows();
    if (rows.length) telemetry.abilities(game, rows);
    for (const id of this.players.keys()) this.send(id, { type: 'ability', game, status: null });
    this.reset();
  }

  private reset(): void {
    this.ctx = null;
    this.game = null;
    this.players = new Map();
  }

  /** Chi ascolta lo stato (HUD sulla TV). Restituisce la funzione per smettere. */
  onStatus(cb: AbilityListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  statusOf(playerId: PlayerId): AbilityStatus | null {
    return this.players.get(playerId)?.last ?? null;
  }

  /**
   * Il gioco dice com'e' l'abilita' ADESSO. Chiamabile a ogni frame: il telefono riceve un messaggio solo quando cambia qualcosa
   * di visibile (stato, cariche, nota, barra al 5%) o, se c'e' un tempo residuo, una volta al secondo per riallinearsi.
   */
  setStatus(playerId: PlayerId, status: AbilityStatus): void {
    const st = this.players.get(playerId);
    if (!st || !this.ctx || !this.game) return;
    st.last = status;
    for (const l of this.listeners) l(playerId, status);
    const key = `${status.state}|${status.charges ?? ''}|${status.note ?? ''}|${status.meter !== undefined ? Math.floor(status.meter * 20) : ''}`;
    const t = this.now();
    const timed = status.remaining !== undefined && (status.state === 'ACTIVE' || status.state === 'COOLDOWN');
    if (key === st.sentKey && !(timed && t - st.sentAt >= RESYNC_MS)) return;
    st.sentKey = key;
    st.sentAt = t;
    this.send(playerId, { type: 'ability', game: this.game, status });
  }

  /** Il giocatore ha ATTIVATO l'abilita' (non solo premuto): conta l'uso e il telefono mostra il nome. */
  activated(playerId: PlayerId): void {
    const st = this.players.get(playerId);
    if (!st || !this.game) return;
    st.uses++;
    const def = abilityFor(this.game, st.characterId);
    this.send(playerId, { type: 'abilityUsed', game: this.game, name: def?.name ?? 'ABILITÀ' });
    this.ctx?.vibrate(playerId, HAPTIC.MEDIUM);
  }

  /** L'effetto ha prodotto qualcosa (parata riuscita, kill, punto...). `key` e' la metrica d'impatto specifica del gioco. */
  succeeded(playerId: PlayerId, key?: string, n = 1): void {
    const st = this.players.get(playerId);
    if (!st) return;
    st.successes++;
    if (key) st.impact[key] = (st.impact[key] ?? 0) + n;
  }

  /** Solo impatto misurabile (senza contare un "successo" in piu'). */
  impact(playerId: PlayerId, key: string, n = 1): void {
    const st = this.players.get(playerId);
    if (st) st.impact[key] = (st.impact[key] ?? 0) + n;
  }

  /** L'abilita' e' partita ma non ha prodotto effetto (parata sbagliata, ricarica a vuoto...). */
  wasted(playerId: PlayerId): void {
    const st = this.players.get(playerId);
    if (st) st.failures++;
  }

  /**
   * Tasto premuto ma abilita' NON partita: feedback privato breve (mai silenzio). `text` in maiuscolo, 1-3 parole:
   * "NON ORA", "ESAURITA", "SERVE UNA PALLA", "IN RAFFREDDAMENTO".
   */
  failed(playerId: PlayerId, text: string): void {
    const st = this.players.get(playerId);
    if (!st || !this.ctx) return;
    const t = this.now();
    if (text === st.lastFailText && t - st.lastFailAt < FAIL_GAP_MS) return;
    st.lastFailText = text;
    st.lastFailAt = t;
    st.failures++;
    this.send(playerId, { type: 'abilityFail', text });
    this.ctx.vibrate(playerId, HAPTIC.LIGHT);
  }

  rows(): AbilityRow[] {
    if (!this.game) return [];
    const out: AbilityRow[] = [];
    for (const [id, st] of this.players) {
      out.push({ playerId: id, characterId: st.characterId, abilityName: abilityFor(this.game, st.characterId)?.name ?? '?', uses: st.uses, successes: st.successes, failures: st.failures, impact: { ...st.impact } });
    }
    return out;
  }

  private send(playerId: PlayerId, data: Record<string, unknown>): void {
    try {
      this.ctx?.sendPrivate(playerId, data);
    } catch {
      /* rete non disponibile: la card resta com'era, il gioco non si ferma */
    }
  }
}

export const abilityHub = new AbilityHub();

// Solo debug (?debug=1 o dev): maniglia per i test nel browser e per ispezionare gli stati dalla console.
if (typeof window !== 'undefined' && debugEnabled()) (window as unknown as Record<string, unknown>).__abilityHub = abilityHub;
