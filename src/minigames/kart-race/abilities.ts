import type { KartState } from './raceTypes';
import { applyBoost, respawnKart } from './kartPhysics';
import {ITEM_POWER} from './itemCatalog';
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
  | { type: 'dottore_light_start' | 'ability_block' }
  | { type: 'judoka_activate' | 'judoka_fail' | 'judoka_end' }
  | { type: 'ciro_armed' | 'ciro_debt_start' | 'ciro_debt_due' };

/** Esito della pressione del tasto ABILITA': 'ok' = qualcosa e' partito; altrimenti il motivo (avviso privato al giocatore). */
export type KartPressResult = 'ok' | 'notready' | 'spent' | 'busy';

/** Existing five character mechanics; finite cooldowns plus a meter earned by driving.
 * Generic physical flags are consumed by the common kart solver on both tracks. */
export class CharacterAbilities {
  private raceTime = 0;
  private truckContacts=new Map<string,number>();

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
    if(k.abilityCooldown>0&&!k.abilityActive&&!k.debtPending&&!k.recoverWindow&&!k.refundTimer&&!(cid==='buttafuori'&&k.stabilityTimer>0))return {state:'COOLDOWN',remaining:k.abilityCooldown,meter:k.abilityMeter};
    if (this.hasMeter(cid)) {
      if (k.abilityActive) return { state: 'ACTIVE', remaining: Math.max(0, k.abilityTimer) };
      if (k.abilityMeter >= 1) return { state: 'READY', note: 'PRONTA · PREMI!' };
      return { state: 'CHARGING', meter: k.abilityMeter };
    }
    if (cid === 'buttafuori') {
      if(k.stabilityTimer>0)return {state:'ACTIVE',remaining:k.stabilityTimer,note:'STABILIZZATO'};
      if (k.recoverWindow > 0) return { state: 'ACTIVE', remaining: k.recoverWindow, note: 'PREMI ORA!' };
      return k.abilityCharges > 0 ? { state: 'READY', note: 'PRONTA · DOPO UNO SCHIANTO' } : { state: 'SPENT' };
    }
    if (cid === 'ciro') {
      if (k.debtPending) return { state: 'ACTIVE', remaining: Math.max(0, k.debtTimer), note: `DEBITO ${Math.ceil(Math.max(0, k.debtTimer))} s` };
      if(k.abilityCharges>0&&this.raceTime-k.lastAbilityPressAt<C.p.before)return {state:'ACTIVE',remaining:C.p.before-(this.raceTime-k.lastAbilityPressAt),note:'DIFESA ARMATA'};
      if (k.refundTimer > 0) return { state: 'ACTIVE', remaining: k.refundTimer, note: 'PREMI ORA!' };
      return k.abilityCharges > 0 ? { state: 'READY', note: 'PRONTA · RIMANDA UN COLPO' } : { state: 'SPENT' };
    }
    return { state: 'SPENT' };
  }

  /** Da chiamare quando il giocatore preme il tasto ABILITÀ. */
  onAbilityPress(k: KartState, allKarts: KartState[], onFeedback: (f: AbilityFeedback) => void, trackAngleAt: (distance: number) => number = () => 0): KartPressResult {
    void allKarts;
    if(k.finished||k.flight==='FALL'&&k.characterId!=='buttafuori')return 'busy';
    if(k.abilityCooldown>0&&!k.debtPending)return 'notready';
    if(k.characterId==='ciro'&&this.raceTime-k.lastAbilityPressAt<C.p.before&&!k.refundTimer)return 'busy';
    k.lastAbilityPressAt = this.raceTime;

    switch (k.characterId) {
      case 'goblin':
        if (k.abilityActive) return 'busy';
        if (k.abilityMeter < 1) return 'notready';
        k.abilityActive = true;
        k.abilityTimer = G.p.duration;
        k.driftBoostMultiplier = G.p.driftMult;
        k.abilityCooldown=G.cooldown;applyBoost(k,G.p.kick,G.p.kickTime);
        k.abilityMeter = 0;
        onFeedback({ type: 'so_guidare_start' });
        return 'ok';

      case 'dottore':
        if (k.abilityActive) return 'busy';
        if (k.abilityMeter < 1) return 'notready';
        k.abilityActive = true;
        k.abilityTimer = D.p.duration;
        k.lightMode = true;
        k.abilityCooldown=D.cooldown;k.abilitySpeedFactor=D.p.topSpeed;
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
        k.abilityCooldown=J.cooldown;k.abilityArmor=1;k.stabilityTimer=J.p.duration;
        k.steerMultiplier = J.p.steer;
        k.abilityMeter = 0;
        onFeedback({ type: 'judoka_activate' });
        return 'ok';

      case 'buttafuori':
        // RIBALTATO MA NON MORTO: reattiva. Funziona solo nella finestra aperta da uno schianto grave.
        const unstableAir=k.flight==='GLIDE'&&(k.stunTimer>.2||(Math.abs(k.lateral)>2.8&&(Math.abs(k.slipVelocity)>1||Math.abs(k.heading)>.18)));
        if ((k.recoverWindow > 0||unstableAir) && k.abilityCharges > 0) {
          k.recoverWindow = 0;
          k.abilityCharges -= 1;
          k.abilityCooldown=B.cooldown;
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
          const oil = k.refundOil;
          const bounce = k.refundBounce;
          k.refundTimer = 0;
          k.abilityCharges -= 1;
          k.abilityCooldown=C.cooldown;k.speed=Math.max(k.speed,k.refundSpeed);k.invulnTimer=Math.max(k.invulnTimer,.8);
          if (stun > 0) k.stunTimer = 0;
          if (disturb > 0) k.disturbTimer = 0;
          if (oil > 0) k.oilTimer = 0;
          if (bounce > 0 && k.flight==='DRIVE') { k.jumpHeight = 0; k.jumpVelocity = 0; }
          k.debtPending = true;
          k.debtTimer = C.p.debt;
          k.debtStun = stun;
          k.debtDisturb = disturb;
          k.debtOil = oil;
          k.debtBounce = bounce;
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
    const definition=k.characterId?AB.kart3d[k.characterId as keyof typeof AB.kart3d]:null;
    k.abilityCooldown=Math.max(0,k.abilityCooldown-dt);
    k.stabilityTimer=Math.max(0,k.stabilityTimer-dt);
    if(definition&&!k.finished){
      if(this.hasMeter(k.characterId)&&!k.abilityActive)this.addMeter(k,dt/Math.max(8,definition.cooldown-(definition.p.duration??0)));
      else if(!this.hasMeter(k.characterId)&&k.abilityCooldown===0&&k.abilityCharges===0&&!k.debtPending)k.abilityCharges=1;
    }
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
        if (k.debtStun > 0) {
          k.stunTimer=Math.max(k.stunTimer,Math.min(k.flight==='GLIDE'?.4:1.6,k.debtStun*C.p.repayment));k.speed=k.flight==='GLIDE'?Math.max(32,k.speed*.65):k.speed*.65;
          k.invulnTimer=Math.max(k.invulnTimer,k.debtStun*C.p.repayment+.5);
        }
        if (k.debtDisturb > 0) k.disturbTimer = Math.max(k.disturbTimer, Math.min(k.flight==='GLIDE'?.65:Infinity,k.debtDisturb*C.p.repayment));
        if (k.debtOil > 0) k.oilTimer = Math.max(k.oilTimer, Math.min(k.flight==='GLIDE'?.6:Infinity,k.debtOil*C.p.repayment));
        if (k.debtBounce > 0&&k.flight==='DRIVE') k.jumpVelocity = Math.max(k.jumpVelocity, k.debtBounce*C.p.repayment);
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
   * premere ABILITA' per recuperare (una carica ricaricabile): prima scattava da solo.
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
    if(k.flight==='FALL'||k.respawnTimer>0){
      k.lastValidCheckpointS=Math.min(k.distance,k.lastValidCheckpointS);respawnKart(k,trackAngleAt);
    }else{
      k.stunTimer=0;k.oilTimer=0;k.disturbTimer=0;k.collisionYawVelocity=0;k.slipVelocity*=.2;
      k.heading*=k.flight==='GLIDE'?.5:.25;k.absHeading=trackAngleAt(k.distance)+k.heading;k.glideYawVelocity*=.2;
    }
    k.speed=Math.max(k.speed,32);k.stabilityTimer=2.2;k.invulnTimer=Math.max(k.invulnTimer,1.1);
    applyBoost(k, B.p.boost, B.p.boostTime);
  }

  private endTimedAbility(k: KartState): void {
    k.abilityActive = false;
    k.abilityTimer = 0;
    k.driftBoostMultiplier = 1;
    k.lightMode = false;
    k.accelMultiplier = 1;
    k.driftChargeRateMultiplier = 1;
    k.truckMode = false;k.abilityArmor=0;k.abilitySpeedFactor=1;
    k.steerMultiplier = 1;
  }

  /**
   * CIRO — PAGO DOPO: se ha appena premuto ABILITÀ (entro `before`) e ha ancora la carica, rimanda l'effetto di un item invece di
   * annullarlo. Ritorna true se l'effetto è stato rimandato (chi chiama non deve applicarlo ora).
   */
  tryDelayHit(k: KartState, effect: { stun?: number; disturb?: number; oil?: number; bounce?: number }, onFeedback: (f: AbilityFeedback) => void): boolean {
    if (k.characterId !== 'ciro' || k.abilityCharges <= 0 || k.debtPending) return false;
    if (this.raceTime - k.lastAbilityPressAt > C.p.before) return false;
    k.abilityCharges -= 1;
    k.abilityCooldown=C.cooldown;k.invulnTimer=Math.max(k.invulnTimer,.8);
    k.lastAbilityPressAt = -99;
    k.debtPending = true;
    k.debtTimer = C.p.debt;
    k.debtStun = effect.stun ?? 0;
    k.debtDisturb = effect.disturb ?? 0;
    k.debtOil = effect.oil ?? 0;
    k.debtBounce = effect.bounce ?? 0;
    applyBoost(k,C.p.counterPower,C.p.counterTime);
    onFeedback({ type: 'ciro_debt_start' });
    return true;
  }

  /**
   * CIRO: un colpo e' passato (non rimandato in anticipo): si apre la finestra `after` in cui premere ABILITÀ lo trasforma in debito.
   * Chiamato da ItemManager subito DOPO aver applicato l'effetto.
   */
  noteHit(k: KartState, effect: { stun?: number; disturb?: number; oil?: number; bounce?: number },previousSpeed=k.speed): void {
    if (k.characterId !== 'ciro' || k.abilityCharges <= 0 || k.debtPending) return;
    k.refundSpeed=previousSpeed;
    k.refundTimer = C.p.after;
    k.refundStun = effect.stun ?? 0;
    k.refundDisturb = effect.disturb ?? 0;
    k.refundOil = effect.oil ?? 0;
    k.refundBounce = effect.bounce ?? 0;
  }
  /** One object absorbed during the truck window, independent of an inventory shield. */
  blockHit(k:KartState,onFeedback:(f:AbilityFeedback)=>void):boolean {
    if(k.invulnTimer>0)return true;
    if(k.shielded){k.shielded=false;if(k.shieldPerfectTimer>0)applyBoost(k,ITEM_POWER.shield.counterPower,ITEM_POWER.shield.counterTime);k.shieldPerfectTimer=0;k.invulnTimer=Math.max(k.invulnTimer,.6);onFeedback({type:'ability_block'});return true;}
    if(k.abilityArmor>0){k.abilityArmor--;k.invulnTimer=.5;onFeedback({type:'ability_block'});return true;}
    return false;
  }

  /** One finite impulse per pair per 1.8s; contact never teleports a kart sideways. */
  truckContact(truck:KartState,other:KartState,away:number,onFeedback:(f:AbilityFeedback)=>void):boolean {
    const key=truck.playerId+'>'+other.playerId;
    if(!truck.truckMode||other.truckMode||other.finished||other.flight==='FALL'||this.raceTime-(this.truckContacts.get(key)??-99)<1.8)return false;
    this.truckContacts.set(key,this.raceTime);
    if(this.blockHit(other,onFeedback))return false;
    const air=other.flight==='GLIDE';
    other.slipVelocity=Math.max(-9,Math.min(9,other.slipVelocity+Math.sign(away)*J.p.shove*(air?.35:1)*(other.stabilityTimer>0?.35:1)));
    other.speedCapMultiplier=Math.min(other.speedCapMultiplier,air?.85:J.p.slow);
    other.speedCapTimer=J.p.slowTime;other.boostTimer=0;other.boostPower=0;
    return true;
  }

}
