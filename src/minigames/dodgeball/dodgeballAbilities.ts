import type { DodgeballPlayer } from './dodgeballTypes';
import {
  PARRY_TIME,
  AIM_TIME,
  VISION_TIME,
  TRUCK_BEEP_TIME,
  TRUCK_TIME,
  CIRO_ARM_WINDOW,
  CIRO_DEBT_TIME
} from './dodgeballTypes';
import { AB } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

export type DodgeballAbilityFeedback =
  | { type: 'goblin_parry' }
  | { type: 'goblin_reflect' }
  | { type: 'goblin_whiff' }
  | { type: 'buttafuori_aim' }
  | { type: 'buttafuori_charged' }
  | { type: 'dottore_vision' }
  | { type: 'dottore_hit_anyway' }
  | { type: 'judoka_beep' }
  | { type: 'judoka_truck' }
  | { type: 'judoka_wall' }
  | { type: 'judoka_scarica' }
  | { type: 'ciro_arm' }
  | { type: 'ciro_debt' }
  | { type: 'ciro_debt_cancelled' }
  | { type: 'ciro_debt_due' };

/** Esito della pressione del tasto: 'ok' = partita; altrimenti il motivo per cui NON e' partita (feedback privato). */
export type DodgeballPressResult = 'ok' | 'cooldown' | 'spent' | 'busy';

const goblin = AB.dodgeball.goblin;

/**
 * Abilità di DODGEBALL DEI COGLIONI (v2). La classe gestisce SOLO lo stato (timer/flag); le interazioni fisiche (rimbalzo parata,
 * raccolta camion, eliminazione per debito) sono orchestrate dal gioco. Numeri e testi: shared/abilityCatalog.ts (AB.dodgeball).
 */
export class DodgeballAbilities {
  /** Cariche iniziali del round, dal catalogo. */
  init(p: DodgeballPlayer): void {
    const d = p.characterId ? AB.dodgeball[p.characterId as keyof typeof AB.dodgeball] : null;
    p.abCharges = d?.charges ?? 0;
  }

  /** L'effetto e' in corso (parata, mira, visione, camion, armato, debito)? */
  private active(p: DodgeballPlayer): boolean {
    return p.parryTime > 0 || (p.aimTime > 0 && !p.aimThrown) || p.visionTime > 0 || p.truckBeepTimer > 0 || p.truckTime > 0 || p.truckBalls.length > 0 || p.deferArmed || p.debtActive;
  }

  /** Stato PRESENTAZIONALE per HUD e telefono, calcolato dallo stato vero (nessuna seconda simulazione). */
  status(p: DodgeballPlayer): AbilityStatus {
    const cid = p.characterId;
    if (!cid) return { state: 'SPENT' };
    const max = AB.dodgeball[cid as keyof typeof AB.dodgeball].charges;
    if (p.debtActive) return { state: 'ACTIVE', remaining: Math.max(0, p.debtTimer), note: `DEBITO ${Math.max(0, p.debtTimer).toFixed(1).replace('.', ',')} s` };
    if (p.deferArmed) return { state: 'ACTIVE', remaining: Math.max(0, p.armTimer), note: `ARMATO ${Math.ceil(Math.max(0, p.armTimer))} s` };
    if (p.parryTime > 0) return { state: 'ACTIVE', remaining: p.parryTime };
    if (p.aimTime > 0 && !p.aimThrown) return { state: 'ACTIVE', remaining: p.aimTime, note: 'MIRA · TIRA!' };
    if (p.visionTime > 0) return { state: 'ACTIVE', remaining: p.visionTime };
    if (p.truckBeepTimer > 0 || p.truckTime > 0) return { state: 'ACTIVE', note: 'CAMION!' };
    if (p.truckBalls.length > 0) return { state: 'ACTIVE', note: `${p.truckBalls.length} PALLE · TIRA!` };
    if (p.abCharges <= 0) return { state: 'SPENT' };
    if (p.abCooldown > 0) return { state: 'COOLDOWN', remaining: p.abCooldown, charges: max > 1 ? p.abCharges : undefined };
    return { state: 'READY', charges: max > 1 ? p.abCharges : undefined };
  }

  onAbilityPress(
    p: DodgeballPlayer,
    dirX: number,
    dirZ: number,
    onFeedback: (f: DodgeballAbilityFeedback) => void
  ): DodgeballPressResult {
    if (!p.alive || p.falling) return 'busy';
    if (this.active(p)) return 'busy';
    if (p.abCharges <= 0) return 'spent';
    if (p.abCooldown > 0) return 'cooldown';

    switch (p.characterId) {
      case 'goblin': {
        p.abCharges--;
        p.abCooldown = goblin.cooldown;
        p.parryTime = PARRY_TIME;
        onFeedback({ type: 'goblin_parry' });
        return 'ok';
      }
      case 'buttafuori': {
        p.abCharges--;
        p.aimTime = AIM_TIME;
        p.aimThrown = false;
        onFeedback({ type: 'buttafuori_aim' });
        return 'ok';
      }
      case 'dottore': {
        p.abCharges--;
        p.visionTime = VISION_TIME;
        onFeedback({ type: 'dottore_vision' });
        return 'ok';
      }
      case 'judoka': {
        p.abCharges--;
        p.truckBeepTimer = TRUCK_BEEP_TIME;
        p.truckTime = 0;
        p.truckDirX = dirX;
        p.truckDirZ = dirZ;
        p.truckBalls = [];
        onFeedback({ type: 'judoka_beep' });
        return 'ok';
      }
      case 'ciro': {
        p.abCharges--;
        p.deferArmed = true;
        p.armTimer = CIRO_ARM_WINDOW;
        onFeedback({ type: 'ciro_arm' });
        return 'ok';
      }
    }
    return 'busy';
  }

  /**
   * Applicato quando una palla sta per colpire `p` (dopo la parata di Goblin,
   * gestita a parte). Ritorna 'survive' se il colpo è assorbito/trasformato.
   */
  handleIncomingHit(p: DodgeballPlayer, onFeedback: (f: DodgeballAbilityFeedback) => void): 'survive' | 'die' {
    if (p.invulnTime > 0) return 'survive'; // schivata
    if (p.truckTime > 0) return 'survive'; // camion: più difficile da fermare
    if (p.deferArmed) {
      p.deferArmed = false;
      p.armTimer = 0;
      p.debtActive = true;
      p.debtTimer = CIRO_DEBT_TIME;
      onFeedback({ type: 'ciro_debt' });
      return 'survive';
    }
    return 'die';
  }

  update(p: DodgeballPlayer, dt: number, onFeedback: (f: DodgeballAbilityFeedback) => void): void {
    p.abCooldown = Math.max(0, p.abCooldown - dt);
    // Goblin: fine finestra di parata (senza aver intercettato nulla).
    if (p.parryTime > 0) {
      p.parryTime -= dt;
      if (p.parryTime <= 0) {
        p.parryTime = 0;
        onFeedback({ type: 'goblin_whiff' });
      }
    }

    if (p.aimTime > 0) p.aimTime = Math.max(0, p.aimTime - dt);
    if (p.visionTime > 0) p.visionTime = Math.max(0, p.visionTime - dt);

    // Ciro: finestra "armato" senza essere stato colpito.
    if (p.armTimer > 0) {
      p.armTimer -= dt;
      if (p.armTimer <= 0) {
        p.armTimer = 0;
        p.deferArmed = false;
      }
    }

    // Ciro: countdown del debito.
    if (p.debtActive) {
      p.debtTimer -= dt;
    }

    // Judoka: BIP… BIP… BIP… poi corsa camion, poi "SCARICA".
    if (p.truckBeepTimer > 0) {
      p.truckBeepTimer -= dt;
      if (p.truckBeepTimer <= 0) {
        p.truckBeepTimer = 0;
        p.truckTime = TRUCK_TIME;
        onFeedback({ type: 'judoka_truck' });
      }
    } else if (p.truckTime > 0) {
      p.truckTime -= dt;
      if (p.truckTime <= 0) {
        p.truckTime = 0;
        onFeedback({ type: 'judoka_scarica' });
      }
    }
  }
}
