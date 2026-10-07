import type { KartState } from './raceTypes';
import { applyBoost, respawnKart, hitKart } from './kartPhysics';
import { AB } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

// Tutti i numeri (durate, moltiplicatori, finestre) vivono in shared/abilityCatalog.ts (AB.kart3d): il telefono, la TV e questo
// file leggono la stessa fonte, quindi la descrizione non puo' dire 6 secondi mentre il codice ne fa 8.
const G = AB.kart3d.goblin;
const B = AB.kart3d.buttafuori;
const J = AB.kart3d.judoka;
const D = AB.kart3d.dottore;
const C = AB.kart3d.ciro;

export const KART_TRUCK = J;

/** Riga descrittiva mostrata sul telefono (controller a schermo): nome + cosa fa, una riga. */
export function abilityDescription(characterId: string | null): string {
  const d = characterId ? AB.kart3d[characterId as keyof typeof AB.kart3d] : null;
  return d ? `${d.name}: ${d.short}` : '';
}

export type AbilityFeedback =
  | { type: 'so_guidare_start' | 'so_guidare_fail' }
  | { type: 'buttafuori_window' | 'buttafuori_recovery' | 'buttafuori_missed' }
  | { type: 'dottore_light_start' }
  | { type: 'judoka_activate' | 'judoka_fail' | 'judoka_end' }
  | { type: 'ciro_armed' | 'ciro_debt_start' | 'ciro_debt_due' };

/** Esito della pressione del tasto ABILITA': 'ok' = qualcosa e' partito; altrimenti il motivo (avviso privato al giocatore). */
export type KartPressResult = 'ok' | 'notready' | 'spent' | 'busy';

/**
 * Una gimmick unica per personaggio (non bonus statistici). Goblin/Dottore/Judoka caricano una barra giocando bene (drift puliti,
 * sorpassi, item evitati, checkpoint puliti — vedi addMeter, chiamato da fuori); Buttafuori e Ciro hanno invece 1 carica fissa per
 * gara, non legata alla barra, e sono REATTIVE: servono premere il tasto nella finestra giusta dopo uno schianto / un colpo
 * (prima il Buttafuori scattava da solo e Ciro doveva indovinare in anticipo). La fisica (kartPhysics.ts) resta ignara del "perche'":
 * legge solo flag generici (driftBoostMultiplier, lightMode, steerMultiplier, speedCapMultiplier, ...) che questa classe imposta.
 */
export class CharacterAbilities {
  private raceTime = 0;

  setRaceTime(t: number): void {
    this.raceTime = t;
  }

  hasMeter(characterId: string | null): boolean {
    return characterId === 'goblin' || characterId === 'dottore' || characterId === 'judoka';
  }

  /** Da chiamare quando il kart fa qualcosa che merita di caricare la barra. */
  addMeter(k: KartState, amount: number): void {
    if (!this.hasMeter(k.characterId) || k.abilityActive) return;
    if (k.abilityMeter >= 1) return;
    k.abilityMeter = Math.min(1, k.abilityMeter + amount);
  }

  /** Stato PRESENTAZIONALE per HUD e telefono, calcolato dallo stato vero del kart (nessuna seconda simulazione). */
  status(k: KartState): AbilityStatus {
    const cid = k.characterId;
    if (!cid) return { state: 'SPENT' };
    if (this.hasMeter(cid)) {
      if (k.abilityActive) return { state: 'ACTIVE', remaining: Math.max(0, k.abilityTimer) };
      if (k.abilityMeter >= 1) return { state: 'READY', note: 'PRONTA · PREMI!' };
      return { state: 'CHARGING', meter: k.abilityMeter };
    }
    if (cid === 'buttafuori') {
      if (k.recoverWindow > 0) return { state: 'ACTIVE', remaining: k.recoverWindow, note: 'PREMI ORA!' };
      return k.abilityCharges > 0 ? { state: 'READY', note: 'PRONTA · DOPO UNO SCHIANTO' } : { state: 'SPENT' };
    }
    if (cid === 'ciro') {
      if (k.debtPending) return { state: 'ACTIVE', remaining: Math.max(0, k.debtTimer), note: `DEBITO ${Math.ceil(Math.max(0, k.debtTimer))} s` };
      if (k.refundTimer > 0) return { state: 'ACTIVE', remaining: k.refundTimer, note: 'PREMI ORA!' };
      return k.abilityCharges > 0 ? { state: 'READY', note: 'PRONTA · RIMANDA UN COLPO' } : { state: 'SPENT' };
    }
    return { state: 'SPENT' };
  }

  /** Da chiamare quando il giocatore preme il tasto ABILITÀ. */
  onAbilityPress(k: KartState, allKarts: KartState[], onFeedback: (f: AbilityFeedback) => void, trackAngleAt: (distance: number) => number = () => 0): KartPressResult {
    void allKarts;
    k.lastAbilityPressAt = this.raceTime;

    switch (k.characterId) {
      case 'goblin':
        if (k.abilityActive) return 'busy';
        if (k.abilityMeter < 1) return 'notready';
        k.abilityActive = true;
        k.abilityTimer = G.p.duration;
        k.driftBoostMultiplier = G.p.driftMult;
        k.abilityMeter = 0;
        onFeedback({ type: 'so_guidare_start' });
        return 'ok';

      case 'dottore':
        if (k.abilityActive) return 'busy';
        if (k.abilityMeter < 1) return 'notready';
        k.abilityActive = true;
        k.abilityTimer = D.p.duration;
        k.lightMode = true;
        k.accelMultiplier = D.p.accel;
        k.driftChargeRateMultiplier = D.p.driftRate;
        k.abilityMeter = 0;
        onFeedback({ type: 'dottore_light_start' });
        return 'ok';

      case 'judoka':
        // CARICO E SCARICO: camion. Spinge via chi tocca (vedi BabylonKartGame.resolveKartCollisions), sterza peggio.
        if (k.abilityActive) return 'busy';
        if (k.abilityMeter < 1) return 'notready';
        k.abilityActive = true;
        k.abilityTimer = J.p.duration;
        k.truckMode = true;
        k.steerMultiplier = J.p.steer;
        k.abilityMeter = 0;
        onFeedback({ type: 'judoka_activate' });
        return 'ok';

      case 'buttafuori':
        // RIBALTATO MA NON MORTO: reattiva. Funziona solo nella finestra aperta da uno schianto grave.
        if (k.recoverWindow > 0 && k.abilityCharges > 0) {
          k.recoverWindow = 0;
          k.abilityCharges -= 1;
          k.respawnTimer = 0;
          k.stunTimer = 0;
          this.recover(k, trackAngleAt);
          onFeedback({ type: 'buttafuori_recovery' });
          return 'ok';
        }
        return k.abilityCharges > 0 ? 'busy' : 'spent';

      case 'ciro':
        if (k.abilityCharges <= 0) return 'spent';
        if (k.debtPending) return 'busy';
        // PAGO DOPO retroattivo: appena subito un colpo (finestra `after`), annulla lo stordimento e lo trasforma in DEBITO
        if (k.refundTimer > 0) {
          const stun = k.refundStun;
          const disturb = k.refundDisturb;
          k.refundTimer = 0;
          k.abilityCharges -= 1;
          if (stun > 0) k.stunTimer = 0;
          if (disturb > 0) k.disturbTimer = 0;
          k.debtPending = true;
          k.debtTimer = C.p.debt;
          k.debtStun = stun;
          k.debtDisturb = disturb;
          k.lastAbilityPressAt = -99;
          onFeedback({ type: 'ciro_debt_start' });
          return 'ok';
        }
        // altrimenti il tasto "arma" per un attimo (`before`): se un colpo arriva subito dopo, viene rimandato (vedi tryDelayHit)
        onFeedback({ type: 'ciro_armed' });
        return 'ok';
    }
    return 'busy';
  }

  /** Da chiamare ogni frame per ogni kart in gara. */
  update(
    dt: number,
    k: KartState,
    allKarts: KartState[],
    crashedThisFrame: boolean,
    respawnTriggeredThisFrame: boolean,
    trackAngleAt: (distance: number) => number,
    onFeedback: (f: AbilityFeedback) => void
  ): void {
    void allKarts;
    // Rallentamento subito per un urto del camion del Judoka (vale per QUALSIASI kart bersaglio, non solo Judoka).
    if (k.speedCapTimer > 0) {
      k.speedCapTimer -= dt;
      if (k.speedCapTimer <= 0) k.speedCapMultiplier = 1;
    }

    // Ciro: il DEBITO scade e la penalità posticipata viene applicata.
    if (k.debtPending) {
      k.debtTimer -= dt;
      if (k.debtTimer <= 0) {
        k.debtPending = false;
        if (k.debtStun > 0) hitKart(k, k.debtStun);
        if (k.debtDisturb > 0) k.disturbTimer = Math.max(k.disturbTimer, k.debtDisturb);
        onFeedback({ type: 'ciro_debt_due' });
      }
    }
    // Ciro: la finestra "subito dopo il colpo" si chiude
    if (k.refundTimer > 0) k.refundTimer = Math.max(0, k.refundTimer - dt);

    // Buttafuori: la finestra di recupero si chiude senza che il giocatore abbia premuto → si rialza lentamente come tutti
    if (k.recoverWindow > 0) {
      k.recoverWindow -= dt;
      if (k.recoverWindow <= 0) {
        k.recoverWindow = 0;
        onFeedback({ type: 'buttafuori_missed' });
      }
    }

    // Goblin/Dottore/Judoka: finestra a tempo attiva.
    if (k.abilityTimer > 0) {
      k.abilityTimer -= dt;
      if (k.abilityTimer <= 0) {
        const wasTruck = k.truckMode;
        this.endTimedAbility(k);
        if (wasTruck) onFeedback({ type: 'judoka_end' });
      }
    }

    this.reactToCrash(k, crashedThisFrame, respawnTriggeredThisFrame, trackAngleAt, onFeedback);
  }

  /**
   * Reazione a un urto avvenuto in QUESTO frame (muro/fuori pista, rilevati subito dopo stepKartPhysics, OPPURE un item incassato più
   * tardi nello stesso frame — vedi il secondo punto di chiamata in BabylonKartGame.step).
   * Goblin: perde SO GUIDARE IO se attiva. Judoka: il camion si ferma. Buttafuori: dopo uno schianto grave si apre la FINESTRA in cui
   * premere ABILITA' per tornare subito in pista (1 volta a gara): prima scattava da solo.
   */
  reactToCrash(
    k: KartState,
    crashedThisFrame: boolean,
    respawnTriggeredThisFrame: boolean,
    trackAngleAt: (distance: number) => number,
    onFeedback: (f: AbilityFeedback) => void
  ): void {
    void trackAngleAt;
    if (k.abilityActive && k.characterId === 'goblin' && (crashedThisFrame || respawnTriggeredThisFrame)) {
      // "Se durante l'effetto sbatte o va fuori pista, perde il bonus."
      this.endTimedAbility(k);
      onFeedback({ type: 'so_guidare_fail' });
    }
    if (k.abilityActive && k.truckMode && (crashedThisFrame || respawnTriggeredThisFrame)) {
      this.endTimedAbility(k);
      onFeedback({ type: 'judoka_fail' });
    }

    if (k.characterId === 'buttafuori' && k.abilityCharges > 0 && k.recoverWindow <= 0) {
      const severeHit = crashedThisFrame && k.stunTimer >= B.p.severeStun;
      if (respawnTriggeredThisFrame || severeHit) {
        k.recoverWindow = B.p.window;
        onFeedback({ type: 'buttafuori_window' });
      }
    }
  }

  /** Torna in pista all'ultimo checkpoint con un piccolo boost (usato dal recupero del Buttafuori). */
  private recover(k: KartState, trackAngleAt: (distance: number) => number): void {
    respawnKart(k, trackAngleAt);
    applyBoost(k, B.p.boost, B.p.boostTime);
  }

  private endTimedAbility(k: KartState): void {
    k.abilityActive = false;
    k.abilityTimer = 0;
    k.driftBoostMultiplier = 1;
    k.lightMode = false;
    k.accelMultiplier = 1;
    k.driftChargeRateMultiplier = 1;
    k.truckMode = false;
    k.steerMultiplier = 1;
  }

  /**
   * CIRO — PAGO DOPO: se ha appena premuto ABILITÀ (entro `before`) e ha ancora la carica, rimanda l'effetto di un item invece di
   * annullarlo. Ritorna true se l'effetto è stato rimandato (chi chiama non deve applicarlo ora).
   */
  tryDelayHit(k: KartState, effect: { stun?: number; disturb?: number }, onFeedback: (f: AbilityFeedback) => void): boolean {
    if (k.characterId !== 'ciro' || k.abilityCharges <= 0 || k.debtPending) return false;
    if (this.raceTime - k.lastAbilityPressAt > C.p.before) return false;
    k.abilityCharges -= 1;
    k.lastAbilityPressAt = -99;
    k.debtPending = true;
    k.debtTimer = C.p.debt;
    k.debtStun = effect.stun ?? 0;
    k.debtDisturb = effect.disturb ?? 0;
    onFeedback({ type: 'ciro_debt_start' });
    return true;
  }

  /**
   * CIRO: un colpo e' passato (non rimandato in anticipo): si apre la finestra `after` in cui premere ABILITÀ lo trasforma in debito.
   * Chiamato da ItemManager subito DOPO aver applicato l'effetto.
   */
  noteHit(k: KartState, effect: { stun?: number; disturb?: number }): void {
    if (k.characterId !== 'ciro' || k.abilityCharges <= 0 || k.debtPending) return;
    k.refundTimer = C.p.after;
    k.refundStun = effect.stun ?? 0;
    k.refundDisturb = effect.disturb ?? 0;
  }
}
