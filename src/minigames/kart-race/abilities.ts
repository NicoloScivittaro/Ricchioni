import type { PlayerId } from '../../../shared/types';
import type { KartState } from './raceTypes';
import { applyBoost, respawnKart, hitKart } from './kartPhysics';

const SO_GUIDARE_DURATION = 6; // Goblin: durata della finestra "sfida"
const SO_GUIDARE_DRIFT_MULT = 1.6; // moltiplicatore potenza mini-turbo durante la finestra

const BUTTAFUORI_SEVERE_STUN = 1; // soglia oltre la quale uno stordimento da colpo conta come "schianto grave"
const BUTTAFUORI_RECOVERY_BOOST_POWER = 20;
const BUTTAFUORI_RECOVERY_BOOST_DURATION = 0.9;

const DOTTORE_LIGHT_DURATION = 6; // Dottore: durata della modalità "leggerissimo"
const DOTTORE_ACCEL_MULT = 1.35;
const DOTTORE_DRIFT_RATE_MULT = 1.8;

const JUDOKA_RANGE_S = 9; // raggio (lungo il percorso) entro cui i rivali davanti sono "vicini"
const JUDOKA_LAT_RANGE = 6; // tolleranza laterale
const JUDOKA_SLOW_FACTOR = 0.55; // velocità massima dei rivali rallentati
const JUDOKA_SLOW_DURATION = 1.4;
const JUDOKA_RESOLVE_WINDOW = 3.5; // tempo per superare almeno un rivale rallentato
const JUDOKA_PENALTY_STUN = 0.5; // piccola penalità se non supera nessuno

const CIRO_PRESS_BUFFER = 0.5; // finestra retroattiva: ABILITÀ premuta negli ultimi N secondi "arma" il rinvio
const CIRO_DEBT_DELAY = 4; // secondi prima che il DEBITO venga riscosso

/** Riga descrittiva mostrata sul telefono: cosa fa l'abilità di QUESTO personaggio. */
export function abilityDescription(characterId: string | null): string {
  switch (characterId) {
    case 'goblin':
      return 'SO GUIDARE IO: a barra piena, per 6s i drift caricati bene danno mini-turbo più forti. Sbatti o esci di pista e lo perdi.';
    case 'buttafuori':
      return "RIBALTATO MA NON MORTO: dopo uno schianto grave, torni subito in pista con un piccolo boost (1 volta a gara).";
    case 'dottore':
      return '20 KG IN UN MESE: per 6s sei leggerissimo — accelerazione e drift facili, ma chi ti urta ti manda lontanissimo.';
    case 'judoka':
      return "MI SO' CADUTI GLI OCCHIALI!: rallenta un attimo i rivali vicini. Superane almeno uno o prendi una penalità.";
    case 'ciro':
      return 'PAGO DOPO: premi ABILITÀ poco prima di un colpo per rimandarlo. Torna dopo qualche secondo come DEBITO (1 volta a gara).';
    default:
      return '';
  }
}

export type AbilityFeedback =
  | { type: 'so_guidare_start' | 'so_guidare_fail' }
  | { type: 'buttafuori_recovery' }
  | { type: 'dottore_light_start' }
  | { type: 'judoka_activate' | 'judoka_success' | 'judoka_fail' }
  | { type: 'ciro_debt_start' | 'ciro_debt_due' };

/**
 * Una gimmick unica per personaggio (non bonus statistici). Goblin/Dottore/
 * Judoka caricano una barra giocando bene (drift puliti, sorpassi, item
 * evitati, checkpoint puliti — vedi addMeter, chiamato da fuori); Buttafuori e
 * Ciro hanno invece 1 carica fissa per gara, non legata alla barra. La fisica
 * (kartPhysics.ts) resta ignara del "perché": legge solo flag generici
 * (driftBoostMultiplier, lightMode, speedCapMultiplier, ...) che questa
 * classe imposta e ripristina.
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
    if (!this.hasMeter(k.characterId) || k.abilityActive || k.judokaPending) return;
    if (k.abilityMeter >= 1) return;
    k.abilityMeter = Math.min(1, k.abilityMeter + amount);
  }

  /** Da chiamare quando il giocatore preme il tasto ABILITÀ. */
  onAbilityPress(k: KartState, allKarts: KartState[], onFeedback: (f: AbilityFeedback) => void): void {
    k.lastAbilityPressAt = this.raceTime;

    switch (k.characterId) {
      case 'goblin':
        if (k.abilityMeter >= 1 && !k.abilityActive) {
          k.abilityActive = true;
          k.abilityTimer = SO_GUIDARE_DURATION;
          k.driftBoostMultiplier = SO_GUIDARE_DRIFT_MULT;
          k.abilityMeter = 0;
          onFeedback({ type: 'so_guidare_start' });
        }
        break;

      case 'dottore':
        if (k.abilityMeter >= 1 && !k.abilityActive) {
          k.abilityActive = true;
          k.abilityTimer = DOTTORE_LIGHT_DURATION;
          k.lightMode = true;
          k.accelMultiplier = DOTTORE_ACCEL_MULT;
          k.driftChargeRateMultiplier = DOTTORE_DRIFT_RATE_MULT;
          k.abilityMeter = 0;
          onFeedback({ type: 'dottore_light_start' });
        }
        break;

      case 'judoka':
        if (k.abilityMeter >= 1 && !k.judokaPending) {
          const targets = allKarts.filter((other) => {
            if (other.playerId === k.playerId || other.finished) return false;
            const ds = other.distance - k.distance;
            return ds > 0.5 && ds < JUDOKA_RANGE_S && Math.abs(other.lateral - k.lateral) < JUDOKA_LAT_RANGE;
          });
          for (const target of targets) {
            target.speedCapMultiplier = JUDOKA_SLOW_FACTOR;
            target.speedCapTimer = JUDOKA_SLOW_DURATION;
          }
          k.judokaPending = true;
          k.judokaResolveTimer = JUDOKA_RESOLVE_WINDOW;
          k.judokaTargets = targets.map((t) => t.playerId);
          k.abilityMeter = 0;
          onFeedback({ type: 'judoka_activate' });
        }
        break;

      case 'buttafuori':
        // Nessuna azione diretta: si attiva da sola dopo uno schianto grave (vedi update()).
        break;

      case 'ciro':
        // Nessuna azione diretta: il press viene solo registrato (vedi tryDelayHit in items.ts),
        // così il giocatore deve anticipare il colpo per rimandarlo.
        break;
    }
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
    // Judoka: decadimento del rallentamento subito (vale per QUALSIASI kart bersaglio, non solo Judoka).
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

    // Goblin/Dottore: finestra a tempo attiva.
    if (k.abilityTimer > 0) {
      k.abilityTimer -= dt;
      if (k.abilityTimer <= 0) this.endTimedAbility(k);
    }

    // Judoka: risoluzione del proprio tentativo (ha superato almeno un bersaglio?).
    if (k.judokaPending) {
      k.judokaResolveTimer -= dt;
      if (k.judokaResolveTimer <= 0) {
        const overtookOne = k.judokaTargets.some((tid) => {
          const target = allKarts.find((o) => o.playerId === tid);
          return target ? k.distance > target.distance : false;
        });
        k.judokaPending = false;
        k.judokaTargets = [];
        if (overtookOne) {
          onFeedback({ type: 'judoka_success' });
        } else {
          k.stunTimer = Math.max(k.stunTimer, JUDOKA_PENALTY_STUN);
          onFeedback({ type: 'judoka_fail' });
        }
      }
    }

    this.reactToCrash(k, crashedThisFrame, respawnTriggeredThisFrame, trackAngleAt, onFeedback);
  }

  /**
   * Reazione a un urto avvenuto in QUESTO frame (muro/fuori pista, rilevati
   * subito dopo stepKartPhysics, OPPURE un item incassato più tardi nello
   * stesso frame — vedi il secondo punto di chiamata in BabylonKartGame.step).
   * Goblin: perde SO GUIDARE IO se attiva. Buttafuori: recupero automatico
   * dopo uno schianto grave (1 volta a gara).
   */
  reactToCrash(
    k: KartState,
    crashedThisFrame: boolean,
    respawnTriggeredThisFrame: boolean,
    trackAngleAt: (distance: number) => number,
    onFeedback: (f: AbilityFeedback) => void
  ): void {
    if (k.abilityActive && k.characterId === 'goblin' && (crashedThisFrame || respawnTriggeredThisFrame)) {
      // "Se durante l'effetto sbatte o va fuori pista, perde il bonus."
      this.endTimedAbility(k);
      onFeedback({ type: 'so_guidare_fail' });
    }

    if (k.characterId === 'buttafuori' && k.abilityCharges > 0) {
      const severeHit = crashedThisFrame && k.stunTimer >= BUTTAFUORI_SEVERE_STUN;
      if (respawnTriggeredThisFrame || severeHit) {
        k.abilityCharges -= 1;
        k.respawnTimer = 0;
        k.stunTimer = 0;
        respawnKart(k, trackAngleAt);
        applyBoost(k, BUTTAFUORI_RECOVERY_BOOST_POWER, BUTTAFUORI_RECOVERY_BOOST_DURATION);
        onFeedback({ type: 'buttafuori_recovery' });
      }
    }
  }

  private endTimedAbility(k: KartState): void {
    k.abilityActive = false;
    k.abilityTimer = 0;
    k.driftBoostMultiplier = 1;
    k.lightMode = false;
    k.accelMultiplier = 1;
    k.driftChargeRateMultiplier = 1;
  }

  /**
   * CIRO — PAGO DOPO: se ha appena premuto ABILITÀ (entro CIRO_PRESS_BUFFER) e
   * ha ancora la carica, rimanda l'effetto di un item invece di annullarlo.
   * Ritorna true se l'effetto è stato rimandato (chi chiama non deve applicarlo ora).
   */
  tryDelayHit(k: KartState, effect: { stun?: number; disturb?: number }, onFeedback: (f: AbilityFeedback) => void): boolean {
    if (k.characterId !== 'ciro' || k.abilityCharges <= 0 || k.debtPending) return false;
    if (this.raceTime - k.lastAbilityPressAt > CIRO_PRESS_BUFFER) return false;
    k.abilityCharges -= 1;
    k.lastAbilityPressAt = -99;
    k.debtPending = true;
    k.debtTimer = CIRO_DEBT_DELAY;
    k.debtStun = effect.stun ?? 0;
    k.debtDisturb = effect.disturb ?? 0;
    onFeedback({ type: 'ciro_debt_start' });
    return true;
  }
}
