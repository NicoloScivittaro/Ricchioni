import type { SoccerPlayer } from './soccerTypes';
import { AB } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

/**
 * Abilità di CALCIO DEI DISAGIATI. Numeri e testi: shared/abilityCatalog.ts (AB.soccer). Gestisce SOLO lo stato (flag/timer): le
 * interazioni (direzione del tiro, tackle, palla) sono orchestrate dal gioco.
 *
 *  GOBLIN     N'CULO!           tiro a giro: caricalo e rilascialo nella zona verde della barra → bomba; fuori zona → moscio
 *  BUTTAFUORI TU QUA NON ENTRI  per qualche secondo chi ti contrasta rimbalza e resta fermo
 *  JUDOKA     IPPON             presa su chi ha la palla: gliela strappi e lo butti a terra; da troppo lontano perdi tempo
 *  DOTTORE    M'HO SVEJATO      il prossimo tiro va da solo nell'angolo meno coperto; poi ti gira la testa
 *  CIRO       PAGO DOMANI       il primo contrasto e' rimandato (chi ti ha attaccato inciampa); poi il debito: passa o tira o perdi palla
 */
const G = AB.soccer.goblin;
const B = AB.soccer.buttafuori;
const J = AB.soccer.judoka;
const D = AB.soccer.dottore;
const C = AB.soccer.ciro;

export type SoccerAbilityFeedback =
  | { type: 'goblin_nculo' }
  | { type: 'goblin_perfect' }
  | { type: 'goblin_wobble' }
  | { type: 'goblin_expired' }
  | { type: 'buttafuori_wall' }
  | { type: 'buttafuori_bounce' }
  | { type: 'judoka_ippon' }
  | { type: 'judoka_whiff' }
  | { type: 'dottore_awake' }
  | { type: 'dottore_shot' }
  | { type: 'dottore_drowsy' }
  | { type: 'ciro_arm' }
  | { type: 'ciro_hold' }
  | { type: 'ciro_paid' }
  | { type: 'ciro_collect' };

/** Eventi che sono l'ATTIVAZIONE (posa + VFX + nome sopra la testa); gli altri sono esiti e restano solo nel feed. */
export const SOCCER_ACTIVATIONS = new Set<SoccerAbilityFeedback['type']>(['goblin_nculo', 'buttafuori_wall', 'judoka_ippon', 'judoka_whiff', 'dottore_awake', 'ciro_arm']);

export type SoccerPressResult = 'ok' | 'cooldown' | 'spent' | 'busy' | 'noball' | 'far';

export class SoccerAbilities {
  init(p: SoccerPlayer): void {
    const d = p.characterId ? AB.soccer[p.characterId as keyof typeof AB.soccer] : null;
    p.abCharges = d?.charges ?? 0;
  }

  private active(p: SoccerPlayer): boolean {
    return p.perfectTime > 0 || p.stanceTime > 0 || p.lucidTime > 0 || p.armTime > 0 || p.debtTime > 0;
  }

  status(p: SoccerPlayer): AbilityStatus {
    const cid = p.characterId;
    if (!cid) return { state: 'SPENT' };
    const max = AB.soccer[cid as keyof typeof AB.soccer].charges;
    if (p.debtTime > 0) return { state: 'ACTIVE', remaining: p.debtTime, note: `DEBITO ${p.debtTime.toFixed(1).replace('.', ',')} s` };
    if (p.armTime > 0) return { state: 'ACTIVE', remaining: p.armTime, note: `ARMATO ${Math.ceil(p.armTime)} s` };
    if (p.perfectTime > 0) return { state: 'ACTIVE', remaining: p.perfectTime, note: 'TIRA NELLA ZONA VERDE' };
    if (p.lucidTime > 0) return { state: 'ACTIVE', remaining: p.lucidTime, note: 'TIRA!' };
    if (p.stanceTime > 0) return { state: 'ACTIVE', remaining: p.stanceTime };
    if (p.abCharges <= 0) return { state: 'SPENT' };
    if (p.abCooldown > 0) return { state: 'COOLDOWN', remaining: p.abCooldown, charges: max > 1 ? p.abCharges : undefined };
    return { state: 'READY', charges: max > 1 ? p.abCharges : undefined };
  }

  /**
   * `carrier` = il portatore di palla avversario piu' vicino (o null): serve solo al Judoka, che lo afferra se e' a portata.
   * Ritorna 'ok' se partita (anche a vuoto: il Judoka che ci prova da troppo vicino-ma-non-abbastanza paga); altrimenti il motivo.
   */
  onAbilityPress(p: SoccerPlayer, carrier: { player: SoccerPlayer; dist: number } | null, onFeedback: (f: SoccerAbilityFeedback) => void): SoccerPressResult {
    if (!p.alive) return 'busy';
    if (this.active(p)) return 'busy';
    if (p.abCharges <= 0) return 'spent';
    if (p.abCooldown > 0) return 'cooldown';
    switch (p.characterId) {
      case 'goblin': {
        if (!p.hasBall) return 'noball'; // serve la palla: il tiro e' il momento
        p.abCharges--;
        p.perfectTime = G.p.arm;
        onFeedback({ type: 'goblin_nculo' });
        return 'ok';
      }
      case 'buttafuori': {
        p.abCharges--;
        p.stanceTime = B.p.duration;
        onFeedback({ type: 'buttafuori_wall' });
        return 'ok';
      }
      case 'judoka': {
        // nessun portatore a tiro: non costa niente. Il rischio e' tentare quando e' vicino ma non abbastanza.
        if (!carrier || carrier.dist > J.p.attempt) return 'far';
        p.abCharges--;
        p.abCooldown = J.cooldown;
        onFeedback({ type: carrier.dist <= J.p.reach ? 'judoka_ippon' : 'judoka_whiff' });
        return 'ok';
      }
      case 'dottore': {
        p.abCharges--;
        p.lucidTime = D.p.window;
        onFeedback({ type: 'dottore_awake' });
        return 'ok';
      }
      case 'ciro': {
        if (!p.hasBall) return 'noball';
        p.abCharges--;
        p.armTime = C.p.arm;
        onFeedback({ type: 'ciro_arm' });
        return 'ok';
      }
    }
    return 'busy';
  }

  update(p: SoccerPlayer, dt: number, onFeedback: (f: SoccerAbilityFeedback) => void): void {
    p.abCooldown = Math.max(0, p.abCooldown - dt);
    if (p.perfectTime > 0) {
      p.perfectTime -= dt;
      if (p.perfectTime <= 0) {
        p.perfectTime = 0;
        onFeedback({ type: 'goblin_expired' });
      }
    }
    if (p.stanceTime > 0) p.stanceTime = Math.max(0, p.stanceTime - dt);
    if (p.lucidTime > 0) {
      p.lucidTime -= dt;
      if (p.lucidTime <= 0) {
        p.lucidTime = 0;
        p.slowTime = D.p.slowTime;
        onFeedback({ type: 'dottore_drowsy' });
      }
    }
    if (p.slowTime > 0) p.slowTime = Math.max(0, p.slowTime - dt);
    if (p.armTime > 0) p.armTime = Math.max(0, p.armTime - dt);
    if (p.debtTime > 0) {
      p.debtTime -= dt;
      if (p.debtTime <= 0) {
        p.debtTime = 0;
        onFeedback({ type: 'ciro_collect' }); // il gioco gli toglie la palla se ce l'ha ancora
      }
    }
  }

  /** Dopo un gol e la ripartenza: nessuna finestra resta aperta (le cariche restano com'erano). */
  clearEffects(p: SoccerPlayer): void {
    p.perfectTime = 0;
    p.stanceTime = 0;
    p.lucidTime = 0;
    p.slowTime = 0;
    p.armTime = 0;
    p.debtTime = 0;
  }

  /** Moltiplicatore di velocita' dovuto alle abilita' (Buttafuori in postura, Dottore dopo la lucidita'). */
  speedFactor(p: SoccerPlayer): number {
    if (p.stanceTime > 0) return B.p.speed;
    if (p.slowTime > 0) return D.p.slow;
    return 1;
  }

  /**
   * Risolve un tackle: attacker prova a rubare palla a victim (che la possiede). 'steal' = riuscito. 'wall' = respinto dal Buttafuori
   * in postura (chi attacca resta fermo). 'ciro' = rimandato dal PAGO DOMANI (chi attacca inciampa, parte il debito).
   */
  resolveTackle(attacker: SoccerPlayer, victim: SoccerPlayer): 'steal' | 'wall' | 'ciro' {
    if (victim.stanceTime > 0) {
      attacker.stunTime = Math.max(attacker.stunTime, B.p.tacklerStun);
      return 'wall';
    }
    if (victim.armTime > 0) {
      victim.armTime = 0;
      victim.debtTime = C.p.debt;
      attacker.stunTime = Math.max(attacker.stunTime, C.p.tacklerStun);
      return 'ciro';
    }
    return 'steal';
  }

  /** Il tiro del Goblin e' nella zona verde? (frazione di carica 0..1) */
  inSweetSpot(frac: number): boolean {
    return frac >= G.p.sweetFrom && frac <= G.p.sweetTo;
  }
}

export const SOCCER_CIRO = C;
export const SOCCER_GOBLIN = G;
export const SOCCER_JUDOKA = J;
export const SOCCER_DOTTORE = D;
