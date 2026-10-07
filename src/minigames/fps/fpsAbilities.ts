import { AB } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';
import type { WeaponConfig } from '../../../shared/fpsWeapons';

/**
 * Abilità della SPARATORIA DEI DISAGIATI (prima RB era riservato e non faceva niente). Una per personaggio, arcade e leggibile in
 * split-screen. Numeri e testi: shared/abilityCatalog.ts (AB.fps) — qui solo la logica, sullo stato di FpsScene (unica autorita').
 * NON cambia armi ne' danni base: lavora su ricarica, bersagli, visibilita', mira e sopravvivenza.
 *
 *  GOBLIN     N'CULO!           ricarica perfetta (premi nella zona verde della ricarica): finisce subito + danno extra per qualche colpo
 *  BUTTAFUORI TU QUA NON ENTRI  giubbotto: subisci poco danno; alla fine ne recuperi una parte come vita
 *  JUDOKA     NO, ASPETTA!      spinta davanti a te: chi colpisci non puo' sparare ne' ricaricare; da vicino e' IPPON (a terra)
 *  DOTTORE    M'HO SVEJATO      vedi tutti anche dietro i muri; poi la mira ti trema
 *  CIRO       PAGO DOMANI       il colpo che ti uccide ti lascia a 1 di vita: una kill entro il debito e sei salvo, altrimenti muori
 */
export const FPS_MAX_HP = 100;

const G = AB.fps.goblin;
const B = AB.fps.buttafuori;
const J = AB.fps.judoka;
const D = AB.fps.dottore;
const C = AB.fps.ciro;

/** Il sottoinsieme di FpsPlayer che la logica delle abilita' legge/scrive (FpsPlayer lo soddisfa in modo strutturale). */
export interface AbPlayer {
  id: string;
  characterId: string | null;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  spawnProtection: number;
  reloading: boolean;
  reloadTimer: number;
  magazine: number;
  burstLeft: number;
  abCharges: number;
  abCd: number;
  buffShots: number;
  guardTime: number;
  guardAbsorbed: number;
  wallTime: number;
  drowsyTime: number;
  armTime: number;
  debtTime: number;
  lockTime: number;
  stunTime: number;
  abKills: number;
}

export type FpsAbilityFeedback =
  | { type: 'activated' }
  | { type: 'perfect_reload' }
  | { type: 'early_reload' }
  | { type: 'guard_end'; healed: number }
  | { type: 'shove'; hit: number; ippon: boolean }
  | { type: 'wall_end'; kills: number }
  | { type: 'debt_start' }
  | { type: 'debt_paid' }
  | { type: 'debt_collect' }
  | { type: 'buff_kill' }
  | { type: 'arm_expired' };

export type FpsPressResult = 'ok' | 'cooldown' | 'spent' | 'busy' | 'notreloading' | 'nobody';

export class FpsAbilities {
  init(p: AbPlayer): void {
    const d = p.characterId ? AB.fps[p.characterId as keyof typeof AB.fps] : null;
    p.abCharges = d?.charges ?? 0;
  }

  /** Stato PRESENTAZIONALE (HUD sulla TV, card sul telefono), calcolato dallo stato vero. */
  status(p: AbPlayer, weapon?: WeaponConfig): AbilityStatus {
    const cid = p.characterId;
    if (!cid) return { state: 'SPENT' };
    switch (cid) {
      case 'goblin': {
        if (p.buffShots > 0) return { state: 'ACTIVE', note: `+${Math.round((G.p.buff - 1) * 100)}% · ${p.buffShots} COLPI` };
        if (p.abCd > 0) return { state: 'COOLDOWN', remaining: p.abCd };
        if (p.reloading && weapon && 1 - p.reloadTimer / weapon.reload >= G.p.from) return { state: 'READY', note: 'ZONA VERDE: PREMI!' };
        return { state: 'READY', note: 'PRONTA · DURANTE LA RICARICA' };
      }
      case 'buttafuori':
        if (p.guardTime > 0) return { state: 'ACTIVE', remaining: p.guardTime };
        return p.abCd > 0 ? { state: 'COOLDOWN', remaining: p.abCd } : { state: 'READY' };
      case 'judoka':
        return p.abCd > 0 ? { state: 'COOLDOWN', remaining: p.abCd } : { state: 'READY' };
      case 'dottore':
        if (p.wallTime > 0) return { state: 'ACTIVE', remaining: p.wallTime, note: `VEDI TUTTI ${Math.ceil(p.wallTime)} s` };
        if (p.drowsyTime > 0) return { state: 'ACTIVE', remaining: p.drowsyTime, note: 'GIRA LA TESTA' };
        return p.abCd > 0 ? { state: 'COOLDOWN', remaining: p.abCd } : { state: 'READY' };
      case 'ciro':
        if (p.debtTime > 0) return { state: 'ACTIVE', remaining: p.debtTime, note: `DEBITO ${p.debtTime.toFixed(1).replace('.', ',')} s · FAI UNA KILL!` };
        if (p.armTime > 0) return { state: 'ACTIVE', remaining: p.armTime, note: `ARMATA ${Math.ceil(p.armTime)} s` };
        return p.abCharges > 0 ? { state: 'READY', charges: p.abCharges } : { state: 'SPENT' };
    }
    return { state: 'SPENT' };
  }

  onAbilityPress(p: AbPlayer, weapon: WeaponConfig, players: AbPlayer[], fb: (f: FpsAbilityFeedback) => void): FpsPressResult {
    if (!p.alive) return 'busy';
    switch (p.characterId) {
      case 'goblin': {
        if (p.abCd > 0) return 'cooldown';
        if (p.buffShots > 0) return 'busy';
        if (!p.reloading) return 'notreloading';
        fb({ type: 'activated' });
        p.abCd = G.cooldown;
        if (1 - p.reloadTimer / weapon.reload >= G.p.from) {
          // RICARICA PERFETTA: finisce subito e i prossimi colpi fanno piu' danno
          p.reloading = false;
          p.reloadTimer = 0;
          p.magazine = weapon.magazine;
          p.buffShots = G.p.buffShots;
          fb({ type: 'perfect_reload' });
        } else {
          p.reloadTimer += G.p.early; // troppo presto: la ricarica si inceppa
          fb({ type: 'early_reload' });
        }
        return 'ok';
      }
      case 'buttafuori': {
        if (p.abCd > 0) return 'cooldown';
        if (p.guardTime > 0) return 'busy';
        p.abCd = B.cooldown;
        p.guardTime = B.p.duration;
        p.guardAbsorbed = 0;
        fb({ type: 'activated' });
        return 'ok';
      }
      case 'judoka': {
        if (p.abCd > 0) return 'cooldown';
        const fx = Math.sin(p.yaw);
        const fz = Math.cos(p.yaw);
        const hits: { t: AbPlayer; d: number; dx: number; dz: number }[] = [];
        for (const t of players) {
          if (t.id === p.id || !t.alive || t.spawnProtection > 0) continue;
          const dx = t.x - p.x;
          const dz = t.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d > J.p.range || d < 0.001) continue;
          if ((dx * fx + dz * fz) / d < Math.cos(J.p.cone)) continue;
          hits.push({ t, d, dx: dx / d, dz: dz / d });
        }
        if (hits.length === 0) return 'nobody'; // nessuno davanti: non costa niente
        p.abCd = J.cooldown;
        let ippon = false;
        for (const h of hits) {
          h.t.lockTime = Math.max(h.t.lockTime, J.p.lock);
          h.t.reloading = false; // interrotto: la ricarica a meta' va persa
          h.t.reloadTimer = 0;
          h.t.burstLeft = 0;
          const k = J.p.push * (1 - 0.5 * (h.d / J.p.range));
          h.t.x += h.dx * k;
          h.t.z += h.dz * k;
          if (h.d <= J.p.ipponRange) {
            ippon = true;
            h.t.stunTime = Math.max(h.t.stunTime, J.p.ipponStun);
            h.t.lockTime = Math.max(h.t.lockTime, J.p.ipponStun);
          }
        }
        fb({ type: 'activated' });
        fb({ type: 'shove', hit: hits.length, ippon });
        return 'ok';
      }
      case 'dottore': {
        if (p.abCd > 0) return 'cooldown';
        if (p.wallTime > 0 || p.drowsyTime > 0) return 'busy';
        p.abCd = D.cooldown;
        p.wallTime = D.p.duration;
        p.abKills = 0;
        fb({ type: 'activated' });
        return 'ok';
      }
      case 'ciro': {
        if (p.abCharges <= 0) return 'spent';
        if (p.armTime > 0 || p.debtTime > 0) return 'busy';
        p.abCharges--;
        p.armTime = C.p.arm;
        fb({ type: 'activated' });
        return 'ok';
      }
    }
    return 'busy';
  }

  update(p: AbPlayer, dt: number, fb: (f: FpsAbilityFeedback) => void): void {
    p.abCd = Math.max(0, p.abCd - dt);
    p.lockTime = Math.max(0, p.lockTime - dt);
    p.stunTime = Math.max(0, p.stunTime - dt);
    if (p.guardTime > 0) {
      p.guardTime -= dt;
      if (p.guardTime <= 0) {
        p.guardTime = 0;
        // alla fine del giubbotto: una parte di quello che ha assorbito torna come vita
        const heal = Math.min(FPS_MAX_HP - p.hp, p.guardAbsorbed * B.p.heal);
        p.hp += Math.max(0, heal);
        p.guardAbsorbed = 0;
        fb({ type: 'guard_end', healed: Math.max(0, heal) });
      }
    }
    if (p.wallTime > 0) {
      p.wallTime -= dt;
      if (p.wallTime <= 0) {
        p.wallTime = 0;
        p.drowsyTime = D.p.drowsy;
        fb({ type: 'wall_end', kills: p.abKills });
      }
    }
    if (p.drowsyTime > 0) p.drowsyTime = Math.max(0, p.drowsyTime - dt);
    if (p.armTime > 0) {
      p.armTime -= dt;
      if (p.armTime <= 0) {
        p.armTime = 0;
        fb({ type: 'arm_expired' });
      }
    }
    if (p.debtTime > 0) {
      p.debtTime -= dt;
      if (p.debtTime <= 0) {
        p.debtTime = 0;
        fb({ type: 'debt_collect' });
      }
    }
  }

  speedFactor(p: AbPlayer): number {
    if (p.guardTime > 0) return B.p.speed;
    if (p.debtTime > 0) return C.p.speed;
    return 1;
  }
  spreadFactor(p: AbPlayer): number {
    return p.drowsyTime > 0 ? D.p.spreadMult : 1;
  }
  damageFactor(p: AbPlayer): number {
    return p.buffShots > 0 ? G.p.buff : 1;
  }
  onShotFired(p: AbPlayer): void {
    if (p.buffShots > 0) p.buffShots--;
  }

  /** Il giubbotto del Buttafuori: ritorna il danno che passa davvero (e accumula quello assorbito). */
  reduceDamage(target: AbPlayer, dmg: number): number {
    if (target.guardTime <= 0) return dmg;
    const through = Math.max(1, Math.round(dmg * B.p.taken));
    target.guardAbsorbed += dmg - through;
    return through;
  }

  /** CIRO: il colpo che ti ucciderebbe diventa un debito. true = salvato (il chiamante lo lascia a 1 di vita). */
  rescue(target: AbPlayer, fb: (f: FpsAbilityFeedback) => void): boolean {
    if (target.characterId !== 'ciro' || target.armTime <= 0 || target.debtTime > 0) return false;
    target.armTime = 0;
    target.debtTime = C.p.debt;
    fb({ type: 'debt_start' });
    return true;
  }

  onKill(killer: AbPlayer, fb: (f: FpsAbilityFeedback) => void, heal: (hp: number) => void): void {
    if (killer.debtTime > 0) {
      killer.debtTime = 0;
      heal(C.p.heal);
      fb({ type: 'debt_paid' });
    }
    if (killer.buffShots > 0) fb({ type: 'buff_kill' });
    if (killer.wallTime > 0) killer.abKills++;
  }

  /** La morte chiude ogni finestra aperta (le cariche e la ricarica restano com'erano). */
  onDeath(p: AbPlayer): void {
    p.buffShots = 0;
    p.guardTime = 0;
    p.guardAbsorbed = 0;
    p.wallTime = 0;
    p.drowsyTime = 0;
    p.armTime = 0;
    p.debtTime = 0;
    p.lockTime = 0;
    p.stunTime = 0;
  }
}
