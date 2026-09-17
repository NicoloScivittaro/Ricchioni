import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import type { Rng } from '../../../shared/rng';
import type { PlayerId } from '../../../shared/types';
import type { MinigameContext } from '../types';
import type { KartState, ItemId } from './raceTypes';
import type { ItemBoxPlacement, TrackSpline } from './track';
import { applyBoost, hitKart } from './kartPhysics';
import { ChoiceManager, CharacterAbilities } from './abilities';
import type { AbilityFeedback } from './abilities';

const BOX_PICKUP_RADIUS_LAT = 4.2;
const BOX_PICKUP_RADIUS_S = 3.4;
const BOX_RESPAWN_TIME = 5;
const ROULETTE_TIME = 0.55;
const EXPLOIT_CHOICE_TIME = 3.5;

const PROJECTILE_SPEED = 46;
const PROJECTILE_LIFE = 3.5;
const PROJECTILE_HIT_S = 1.8;
const PROJECTILE_HIT_LAT = 2.2;
const PROJECTILE_NEARMISS_S = 3.2;
const PROJECTILE_NEARMISS_LAT = 3.6;
const PROJECTILE_STUN = 1.3;
const NEARMISS_METER = 0.15;

const TRAP_LIFE = 18;
const TRAP_HIT_S = 1.4;
const TRAP_HIT_LAT = 1.9;
const TRAP_STUN = 0.6;

const ALL_ITEMS: ItemId[] = ['turbo', 'sfera', 'olio', 'scudo', 'super_turbo', 'disturbo'];

const ITEM_COLORS: Record<ItemId, Color3> = {
  turbo: new Color3(1, 0.55, 0.1),
  sfera: new Color3(0.95, 0.2, 0.25),
  olio: new Color3(0.35, 0.15, 0.4),
  scudo: new Color3(0.25, 0.75, 0.95),
  super_turbo: new Color3(1, 0.85, 0.1),
  disturbo: new Color3(0.55, 0.9, 0.3)
};

interface ItemBox {
  s: number;
  lateral: number;
  taken: boolean;
  respawnTimer: number;
  mesh: Mesh;
}

interface Projectile {
  firedBy: PlayerId;
  distance: number;
  lateral: number;
  speed: number;
  life: number;
  mesh: Mesh;
  nearMissed: Set<PlayerId>;
}

interface Trap {
  distance: number;
  lateral: number;
  life: number;
  mesh: Mesh;
}

export interface PendingRoulette {
  playerId: PlayerId;
  timer: number;
  result: ItemId;
}

/**
 * Gestisce box bonus, inventario oggetto per kart, proiettili e trappole.
 * Il bilanciamento pesa la probabilità in base alla posizione in gara:
 * ultimi favoriti su oggetti offensivi/di recupero, primi su oggetti difensivi/deboli.
 */
export class ItemManager {
  private boxes: ItemBox[] = [];
  private projectiles: Projectile[] = [];
  private traps: Trap[] = [];
  private roulettes = new Map<PlayerId, PendingRoulette>();
  private root: TransformNode;

  constructor(
    private scene: Scene,
    placements: ItemBoxPlacement[],
    private spline: TrackSpline,
    private rng: Rng,
    private abilities: CharacterAbilities,
    private choices: ChoiceManager,
    private ctx: MinigameContext,
    private onFeedback: (playerId: PlayerId, f: AbilityFeedback) => void
  ) {
    this.root = new TransformNode('itemsRoot', scene);
    const mat = new StandardMaterial('itemBoxMat', scene);
    mat.diffuseColor = new Color3(0.15, 0.8, 0.75);
    mat.emissiveColor = new Color3(0.2, 0.7, 0.65);
    mat.specularColor = new Color3(0.5, 0.7, 0.7);

    for (const p of placements) {
      const mesh = MeshBuilder.CreatePolyhedron('itemBox', { type: 1, size: 1.15 }, scene);
      mesh.material = mat;
      mesh.parent = this.root;
      mesh.position.copyFrom(this.spline.worldPoint(p.s, p.lateral, 0.9));
      this.boxes.push({ s: p.s, lateral: p.lateral, taken: false, respawnTimer: 0, mesh });
    }
  }

  /** Da chiamare ogni frame: aggiorna box/proiettili/trappole e rileva i pickup. */
  update(dt: number, karts: KartState[], placement: (playerId: PlayerId) => number, totalPlayers: number): void {
    for (const box of this.boxes) {
      if (box.taken) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.taken = false;
          box.mesh.setEnabled(true);
        }
        continue;
      }
      const bob = Math.sin(performance.now() * 0.003 + box.s) * 0.25;
      const worldPos = this.spline.worldPoint(box.s, box.lateral, 1.1 + bob);
      box.mesh.position.copyFrom(worldPos);
      box.mesh.rotation.y += dt * 2.2;
      box.mesh.rotation.x += dt * 0.6;

      for (const k of karts) {
        if (k.heldItem || k.finished || k.itemImmune) continue;
        const ds = Math.abs(this.spline.wrap(k.distance - box.s));
        const dsAlt = this.spline.totalLength - ds;
        const dist = Math.min(ds, dsAlt);
        if (dist < BOX_PICKUP_RADIUS_S && Math.abs(k.lateral - box.lateral) < BOX_PICKUP_RADIUS_LAT) {
          box.taken = true;
          box.respawnTimer = BOX_RESPAWN_TIME;
          box.mesh.setEnabled(false);
          this.grantItem(k, placement(k.playerId), totalPlayers);
        }
      }
    }

    for (const [pid, r] of this.roulettes) {
      r.timer -= dt;
      if (r.timer <= 0) {
        const k = karts.find((kk) => kk.playerId === pid);
        if (k) k.heldItem = r.result;
        this.roulettes.delete(pid);
      }
    }

    this.updateProjectiles(dt, karts);
    this.updateTraps(dt, karts);
  }

  isRouletteSpinning(playerId: PlayerId): boolean {
    return this.roulettes.has(playerId);
  }

  /** GOBLIN — EXPLOIT: durante la finestra attiva, la box mostra 2 scelte invece di 1. */
  private grantItem(k: KartState, placement: number, totalPlayers: number): void {
    if (this.abilities.isExploitActive(k)) {
      let a = this.pickWeighted(placement, totalPlayers);
      let b = this.pickWeighted(placement, totalPlayers);
      // Molto indietro: piccola chance che uno dei due sia un raro esplicito.
      if (placement >= totalPlayers && this.rng.chance(0.35) && b !== 'super_turbo') b = 'super_turbo';
      let guard = 0;
      while (b === a && guard < 4) {
        b = this.pickWeighted(placement, totalPlayers);
        guard++;
      }
      this.choices.ask(
        this.ctx,
        k.playerId,
        'EXPLOIT — SCEGLI',
        [
          { id: `exploit_${a}`, label: itemLabel(a) },
          { id: `exploit_${b}`, label: itemLabel(b) }
        ],
        EXPLOIT_CHOICE_TIME,
        (chosenId) => {
          const id = chosenId.replace('exploit_', '') as ItemId;
          k.heldItem = ALL_ITEMS.includes(id) ? id : a;
        }
      );
      return;
    }
    const result = this.pickWeighted(placement, totalPlayers);
    this.roulettes.set(k.playerId, { playerId: k.playerId, timer: ROULETTE_TIME, result });
  }

  private pickWeighted(placement: number, totalPlayers: number): ItemId {
    const isLast = placement >= totalPlayers;
    const isFirst = placement <= 1;
    const table: { item: ItemId; weight: number }[] = isFirst
      ? [
          { item: 'scudo', weight: 3 },
          { item: 'disturbo', weight: 1.2 },
          { item: 'turbo', weight: 1 },
          { item: 'olio', weight: 1 },
          { item: 'sfera', weight: 0.4 },
          { item: 'super_turbo', weight: 0.15 }
        ]
      : isLast
        ? [
            { item: 'super_turbo', weight: 1.8 },
            { item: 'sfera', weight: 2.6 },
            { item: 'turbo', weight: 2.2 },
            { item: 'olio', weight: 1.6 },
            { item: 'disturbo', weight: 1 },
            { item: 'scudo', weight: 0.8 }
          ]
        : [
            { item: 'turbo', weight: 2.4 },
            { item: 'sfera', weight: 1.6 },
            { item: 'olio', weight: 1.6 },
            { item: 'scudo', weight: 1.6 },
            { item: 'disturbo', weight: 1.4 },
            { item: 'super_turbo', weight: 0.3 }
          ];
    return this.rng.weighted(table);
  }

  /** Usa l'oggetto posseduto dal giocatore (tasto ITEM). */
  useItem(k: KartState, allKarts: KartState[], rankOf: (pid: PlayerId) => number): void {
    const item = k.heldItem;
    if (!item) return;
    k.heldItem = null;

    switch (item) {
      case 'turbo':
        // Divertente e utile, ma non ribalta la gara da solo.
        applyBoost(k, 18, 1.1);
        break;
      case 'super_turbo':
        // Raro e potente: deve sentirsi come un vero cambio di passo.
        applyBoost(k, 38, 2.4);
        break;
      case 'scudo':
        k.shielded = true;
        break;
      case 'olio':
        this.spawnTrap(k);
        break;
      case 'sfera':
        this.spawnProjectile(k);
        break;
      case 'disturbo': {
        // Fastidioso ma leggero: mai frustrante, solo simpatico.
        const target = this.findTargetAhead(k, allKarts, rankOf);
        if (target) target.disturbTimer = 2.6;
        break;
      }
    }
  }

  private findTargetAhead(k: KartState, allKarts: KartState[], rankOf: (pid: PlayerId) => number): KartState | null {
    const myRank = rankOf(k.playerId);
    let best: KartState | null = null;
    let bestRank = Infinity;
    for (const other of allKarts) {
      if (other.playerId === k.playerId || other.finished) continue;
      const r = rankOf(other.playerId);
      if (r < myRank && r < bestRank) {
        bestRank = r;
        best = other;
      }
    }
    return best;
  }

  private spawnProjectile(k: KartState): void {
    const mat = new StandardMaterial('projMat', this.scene);
    mat.diffuseColor = ITEM_COLORS.sfera;
    mat.emissiveColor = ITEM_COLORS.sfera.scale(0.7);
    const mesh = MeshBuilder.CreateSphere('projectile', { diameter: 0.5 }, this.scene);
    mesh.material = mat;
    mesh.parent = this.root;
    this.projectiles.push({
      firedBy: k.playerId,
      distance: k.distance + 2.5,
      lateral: k.lateral,
      speed: k.speed + PROJECTILE_SPEED,
      life: PROJECTILE_LIFE,
      mesh,
      nearMissed: new Set()
    });
  }

  private spawnTrap(k: KartState): void {
    const mat = new StandardMaterial('trapMat', this.scene);
    mat.diffuseColor = ITEM_COLORS.olio;
    mat.alpha = 0.85;
    const mesh = MeshBuilder.CreateCylinder('trap', { diameter: 1.6, height: 0.08, tessellation: 14 }, this.scene);
    mesh.material = mat;
    mesh.parent = this.root;
    this.traps.push({ distance: k.distance - 3.2, lateral: k.lateral, life: TRAP_LIFE, mesh });
  }

  private updateProjectiles(dt: number, karts: KartState[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.distance += p.speed * dt;
      p.life -= dt;
      p.mesh.position.copyFrom(this.spline.worldPoint(p.distance, p.lateral, 0.4));
      p.mesh.rotation.y += dt * 10;

      let hit = false;
      if (p.life > 0) {
        for (const k of karts) {
          if (k.playerId === p.firedBy || k.finished) continue;
          const ds = Math.abs(k.distance - p.distance);
          const dl = Math.abs(k.lateral - p.lateral);
          if (ds < PROJECTILE_HIT_S && dl < PROJECTILE_HIT_LAT) {
            this.applyHit(k, PROJECTILE_STUN);
            hit = true;
            break;
          }
          if (!p.nearMissed.has(k.playerId) && ds < PROJECTILE_NEARMISS_S && dl < PROJECTILE_NEARMISS_LAT) {
            p.nearMissed.add(k.playerId);
            this.abilities.addMeter(k, NEARMISS_METER);
          }
        }
      }
      if (hit || p.life <= 0) {
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateTraps(dt: number, karts: KartState[]): void {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      t.life -= dt;
      let hit = false;
      for (const k of karts) {
        if (k.finished) continue;
        if (Math.abs(k.distance - t.distance) < TRAP_HIT_S && Math.abs(k.lateral - t.lateral) < TRAP_HIT_LAT) {
          this.applyHit(k, TRAP_STUN);
          hit = true;
          break;
        }
      }
      if (hit || t.life <= 0) {
        t.mesh.dispose();
        this.traps.splice(i, 1);
      }
    }
  }

  /** Applica un colpo passando prima dal sistema abilità (Napoletano può annullarlo). */
  private applyHit(k: KartState, baseStun: number): void {
    if (this.abilities.tryCancelHit(k, (f) => this.onFeedback(k.playerId, f))) return;
    hitKart(k, baseStun);
  }

  dispose(): void {
    for (const b of this.boxes) b.mesh.dispose();
    for (const p of this.projectiles) p.mesh.dispose();
    for (const t of this.traps) t.mesh.dispose();
    this.root.dispose();
  }
}

export function itemLabel(id: ItemId): string {
  switch (id) {
    case 'turbo':
      return '🔥 TURBO';
    case 'super_turbo':
      return '💫 SUPER TURBO';
    case 'sfera':
      return '🔴 SFERA D\'URTO';
    case 'olio':
      return '🟣 OLIO';
    case 'scudo':
      return '🛡️ SCUDO';
    case 'disturbo':
      return '⚡ DISTURBO';
  }
}

/** Riga descrittiva mostrata sul telefono, così è chiaro cosa fa ogni oggetto. */
export function itemDescription(id: ItemId): string {
  switch (id) {
    case 'turbo':
      return 'Accelerazione forte e immediata.';
    case 'super_turbo':
      return 'RARO E FORTISSIMO: può ribaltare la gara.';
    case 'sfera':
      return "Proiettile: stordisce chi colpisce davanti a te.";
    case 'olio':
      return 'Lascia una chiazza scivolosa dietro di te.';
    case 'scudo':
      return 'Ti protegge dal prossimo colpo subito.';
    case 'disturbo':
      return 'Simpatico: inverte per un attimo lo sterzo di chi hai davanti.';
  }
}
