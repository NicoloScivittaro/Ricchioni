import type { PlayerId } from '../../../shared/types';
import type { MinigameContext } from '../types';
import type { KartState } from './raceTypes';
import { applyBoost, hitKart } from './kartPhysics';
import { ChoiceManager } from './choice';
import type { ChoiceOption } from './choice';

const EXPLOIT_DURATION = 6;
const TANK_MODE_DURATION = 5.5;
const DOTTORE_EFFECT_DURATION = 6.5;
const CIRO_PRESS_BUFFER = 0.5; // finestra retroattiva: ABILITÀ premuta negli ultimi N secondi annulla un colpo

const IPPON_WINDOW = 0.6;
const IPPON_S_RADIUS = 2.4;
const IPPON_LAT_RADIUS = 2.8;
const IPPON_MIN_LAT = 0.6;
const IPPON_MIN_SPEED = 14;
const IPPON_PUSH = 3.4;
const IPPON_MISS_PENALTY = 0.7;

const DOTTORE_OPTIONS: ChoiceOption[] = [
  { id: 'dottore_turbo', label: 'SIRINGA A', icon: '💉' },
  { id: 'dottore_grip', label: 'SIRINGA B', icon: '💉' },
  { id: 'dottore_immune', label: 'SIRINGA C', icon: '💉' }
];

/** Riga descrittiva mostrata sul telefono: cosa fa l'abilità di QUESTO personaggio. */
export function abilityDescription(characterId: string | null): string {
  switch (characterId) {
    case 'goblin':
      return 'EXPLOIT: a barra piena, le item box ti fanno scegliere tra 2 oggetti.';
    case 'buttafuori':
      return "MO M'IMPEGNO: modalità carro armato per alcuni secondi — resisti ai colpi, ma sterzi peggio.";
    case 'dottore':
      return 'TRATTAMENTO SPERIMENTALE: scegli una siringa anonima, buff forte + effetto collaterale.';
    case 'judoka':
      return 'IPPON!: affianca un rivale (il telefono vibra), premi ABILITÀ al momento giusto per lanciarlo via.';
    case 'ciro':
      return 'I DUE CAPELLI DEL DESTINO: 2 cariche. Premi ABILITÀ appena prima di un colpo per annullarlo.';
    default:
      return '';
  }
}

export type AbilityFeedback =
  | { type: 'exploit_ready' | 'exploit_start' | 'tank_start' | 'tank_end' }
  | { type: 'dottore_effect'; effect: string }
  | { type: 'ippon_window' }
  | { type: 'ippon_hit'; targetId: PlayerId }
  | { type: 'ippon_miss' }
  | { type: 'ciro_pelato' };

/**
 * Una gimmick unica per personaggio (non bonus statistici). Goblin/Buttafuori/
 * Dottore/Judoka caricano una barra giocando bene (drift puliti, sorpassi,
 * item evitati, checkpoint puliti — vedi addMeter, chiamato da fuori); il
 * Napoletano ha invece 2 cariche fisse per gara, non legate alla barra.
 * La fisica (kartPhysics.ts) resta ignara del "perché": legge solo flag
 * generici (tankMode, turnRateMultiplier, itemImmune, ...) che questa classe
 * imposta e ripristina.
 */
export class CharacterAbilities {
  private raceTime = 0;

  constructor(private choices: ChoiceManager) {}

  setRaceTime(t: number): void {
    this.raceTime = t;
  }

  hasMeter(characterId: string | null): boolean {
    return characterId === 'goblin' || characterId === 'buttafuori' || characterId === 'dottore' || characterId === 'judoka';
  }

  /** Da chiamare quando il kart fa qualcosa che merita di caricare la barra. */
  addMeter(k: KartState, amount: number): void {
    if (!this.hasMeter(k.characterId) || k.abilityActive) return;
    if (k.characterId === 'judoka' && k.ipponArmed) return;
    if (k.abilityMeter >= 1) return;
    k.abilityMeter = Math.min(1, k.abilityMeter + amount);
    if (k.characterId === 'judoka' && k.abilityMeter >= 1) k.ipponArmed = true;
  }

  /** Da chiamare quando il giocatore preme il tasto ABILITÀ. */
  onAbilityPress(ctx: MinigameContext, k: KartState, allKarts: KartState[], onFeedback: (f: AbilityFeedback) => void): void {
    k.lastAbilityPressAt = this.raceTime;

    switch (k.characterId) {
      case 'goblin':
        if (k.abilityMeter >= 1 && !k.abilityActive) {
          k.abilityActive = true;
          k.abilityTimer = EXPLOIT_DURATION;
          k.abilityMeter = 0;
          onFeedback({ type: 'exploit_start' });
        }
        break;

      case 'buttafuori':
        if (k.abilityMeter >= 1 && !k.abilityActive) {
          k.abilityActive = true;
          k.abilityTimer = TANK_MODE_DURATION;
          k.tankMode = true;
          k.abilityMeter = 0;
          onFeedback({ type: 'tank_start' });
        }
        break;

      case 'dottore':
        if (k.abilityMeter >= 1 && !k.abilityActive && !this.choices.isPending(k.playerId)) {
          k.abilityMeter = 0;
          this.choices.ask(ctx, k.playerId, 'TRATTAMENTO SPERIMENTALE', DOTTORE_OPTIONS, 4, (chosenId) => {
            this.applyDottoreEffect(k, chosenId);
            onFeedback({ type: 'dottore_effect', effect: chosenId });
          });
        }
        break;

      case 'judoka':
        if (k.ipponWindow && k.ipponTargetId) {
          const target = allKarts.find((o) => o.playerId === k.ipponTargetId);
          k.ipponWindow = false;
          k.ipponTargetId = null;
          k.ipponArmed = false;
          k.abilityMeter = 0;
          if (target) {
            this.executeIppon(k, target);
            onFeedback({ type: 'ippon_hit', targetId: target.playerId });
          }
        } else if (k.ipponArmed) {
          k.speed *= IPPON_MISS_PENALTY;
          k.ipponArmed = false;
          k.abilityMeter = 0;
          onFeedback({ type: 'ippon_miss' });
        }
        break;

      case 'ciro':
        // Nessuna azione diretta: il press viene solo registrato. L'annullamento
        // è reattivo (vedi tryCancelHit), così il giocatore deve anticipare il colpo.
        break;
    }
  }

  private applyDottoreEffect(k: KartState, id: string): void {
    k.abilityActive = true;
    k.effectTimer = DOTTORE_EFFECT_DURATION;
    if (id === 'dottore_turbo') {
      applyBoost(k, 28, 1.2);
      k.turnRateMultiplier = 1.55;
      k.gripMultiplier = 0.4;
    } else if (id === 'dottore_grip') {
      k.gripMultiplier = 2.6;
      k.speedCapMultiplier = 0.8;
    } else if (id === 'dottore_immune') {
      k.itemImmune = true;
    }
  }

  private executeIppon(attacker: KartState, target: KartState): void {
    const pushDir = Math.sign(target.lateral - attacker.lateral) || 1;
    target.lateral += pushDir * IPPON_PUSH;
    hitKart(target, 0.9);
  }

  /** Da chiamare ogni frame per ogni kart in gara. */
  update(dt: number, k: KartState, allKarts: KartState[], onFeedback: (f: AbilityFeedback) => void): void {
    if (k.abilityTimer > 0) {
      k.abilityTimer -= dt;
      if (k.abilityTimer <= 0) {
        const wasTank = k.tankMode;
        k.abilityActive = false;
        k.tankMode = false;
        if (wasTank) onFeedback({ type: 'tank_end' });
      }
    }
    if (k.effectTimer > 0) {
      k.effectTimer -= dt;
      if (k.effectTimer <= 0) {
        k.turnRateMultiplier = 1;
        k.gripMultiplier = 1;
        k.speedCapMultiplier = 1;
        k.itemImmune = false;
        k.abilityActive = false;
      }
    }

    if (k.characterId === 'judoka') this.updateIppon(dt, k, allKarts, onFeedback);
  }

  private updateIppon(dt: number, k: KartState, allKarts: KartState[], onFeedback: (f: AbilityFeedback) => void): void {
    if (k.ipponWindow) {
      k.ipponWindowTimer -= dt;
      if (k.ipponWindowTimer <= 0) {
        k.ipponWindow = false;
        k.ipponTargetId = null;
      }
      return;
    }
    if (!k.ipponArmed || Math.abs(k.speed) < IPPON_MIN_SPEED) return;
    for (const other of allKarts) {
      if (other.playerId === k.playerId || other.finished) continue;
      const ds = Math.abs(k.distance - other.distance);
      const dl = Math.abs(k.lateral - other.lateral);
      if (ds < IPPON_S_RADIUS && dl < IPPON_LAT_RADIUS && dl > IPPON_MIN_LAT && Math.abs(other.speed) > IPPON_MIN_SPEED * 0.5) {
        k.ipponWindow = true;
        k.ipponWindowTimer = IPPON_WINDOW;
        k.ipponTargetId = other.playerId;
        onFeedback({ type: 'ippon_window' });
        break;
      }
    }
  }

  /** Napoletano: prova ad annullare un colpo in arrivo se ha premuto ABILITÀ di recente. */
  tryCancelHit(k: KartState, onFeedback: (f: AbilityFeedback) => void): boolean {
    if (k.characterId !== 'ciro' || k.abilityCharges <= 0) return false;
    if (this.raceTime - k.lastAbilityPressAt > CIRO_PRESS_BUFFER) return false;
    k.abilityCharges -= 1;
    k.lastAbilityPressAt = -99;
    if (k.abilityCharges === 0) onFeedback({ type: 'ciro_pelato' });
    return true;
  }

  isExploitActive(k: KartState): boolean {
    return k.characterId === 'goblin' && k.abilityActive;
  }
}

export { ChoiceManager };
