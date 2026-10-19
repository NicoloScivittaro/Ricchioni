import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, TransformNode, Vector3 } from '@babylonjs/core';
import type { Rng } from '../../../shared/rng';
import type { PlayerId } from '../../../shared/types';
import type { MinigameContext } from '../types';
import type { KartState, ItemId } from './raceTypes';
import type { ItemBoxPlacement, TrackSpline } from './track';
import { applyBoost, hitKart } from './kartPhysics';
import { CharacterAbilities } from './abilities';
import type { AbilityFeedback } from './abilities';
import { itemSurface, crossesSurface, trackDelta } from './itemSurface';
import { audio } from '../../core/AudioManager';
import { KART_ITEMS, pickKartItem } from './itemCatalog';
import { KartItemVisuals } from './itemVisuals';

const BOX_PICKUP_RADIUS_LAT = 4.2;
const BOX_PICKUP_RADIUS_S = 3.4;
const BOX_RESPAWN_TIME = 5;
const ROULETTE_TIME = 0.55;

const PROJECTILE_SPEED = 46;
const PROJECTILE_LIFE = 3.5;
const PROJECTILE_HIT_S = 1.65;
const PROJECTILE_HIT_LAT = 1.25;
const PROJECTILE_NEARMISS_S = 3.2;
const PROJECTILE_NEARMISS_LAT = 3.6;
const PROJECTILE_STUN = 1.3;
const NEARMISS_METER = 0.15;

const TRAP_LIFE = 18;
const TRAP_RADIUS_S = 2.4;
const TRAP_RADIUS_LAT = 1.7;

interface ItemBox {
  s: number;
  lateral: number;
  taken: boolean;
  respawnTimer: number;
  mesh: Mesh;
}

interface Projectile {
  kind: 'sfera' | 'piccione';
  airborne:boolean;
  firedBy: PlayerId;
  distance: number;
  lateral: number;
  speed: number;
  lateralVelocity: number;
  life: number;
  mesh: Mesh;
  nearMissed: Set<PlayerId>;
}

interface Trap {
  kind: 'olio' | 'buca' | 'raffica';
  rs: number;
  rl: number;
  wind: number;
  firedBy: PlayerId;
  distance: number;
  lateral: number;
  life: number;
  mesh: Mesh;
  visitors: Set<PlayerId>;
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
  private previous = new Map<PlayerId, { distance: number; lateral: number }>();
  private visuals: KartItemVisuals;
  private timed = new Map<string, {playerId:PlayerId;kind:'paraurti'|'turbo_difettoso'|'mollone'|'calamita';mesh:Mesh;tether?:Mesh}>();

  constructor(
    private scene: Scene,
    placements: ItemBoxPlacement[],
    private spline: TrackSpline,
    private rng: Rng,
    private abilities: CharacterAbilities,
    private onFeedback: (playerId: PlayerId, f: AbilityFeedback) => void,
    private onPresentation: (source:PlayerId,target:PlayerId|null,kind:ItemId,hit:boolean)=>void = ()=>undefined
  ) {
    this.root = new TransformNode('itemsRoot', scene);
    this.visuals = new KartItemVisuals(scene);
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
        if (k.heldItem || k.finished || k.respawnTimer > 0 || this.roulettes.has(k.playerId)) continue;
        const ds = Math.abs(this.spline.wrap(k.distance - box.s));
        const dsAlt = this.spline.totalLength - ds;
        const dist = Math.min(ds, dsAlt);
        if (dist < BOX_PICKUP_RADIUS_S && Math.abs(k.lateral - box.lateral) < BOX_PICKUP_RADIUS_LAT) {
          box.taken = true;
          box.respawnTimer = BOX_RESPAWN_TIME;
          box.mesh.setEnabled(false);
          this.grantItem(k, placement(k.playerId), totalPlayers);
          break;
        }
      }
    }

    for (const [pid, r] of this.roulettes) {
      r.timer -= dt;
      if (r.timer <= 0) {
        const k = karts.find((kk) => kk.playerId === pid);
        if (k && !k.finished) k.heldItem = r.result;
        this.roulettes.delete(pid);
      }
    }

    this.updateProjectiles(dt, karts);
    this.updateTraps(dt, karts);
    this.updateTimed(dt, karts);
    for (const k of karts) this.previous.set(k.playerId, { distance: k.distance, lateral: k.lateral });
  }

  isRouletteSpinning(playerId: PlayerId): boolean {
    return this.roulettes.has(playerId);
  }

  private grantItem(k: KartState, placement: number, totalPlayers: number): void {
    const result = this.pickWeighted(placement, totalPlayers);
    this.roulettes.set(k.playerId, { playerId: k.playerId, timer: ROULETTE_TIME, result });
  }

  private pickWeighted(placement: number, totalPlayers: number): ItemId {
    return pickKartItem(this.rng, placement, totalPlayers);
  }

  /** Usa l'oggetto posseduto dal giocatore (tasto ITEM). */
  useItem(k: KartState, allKarts: KartState[], rankOf: (pid: PlayerId) => number): void {
    if(k.finished || k.respawnTimer>0)return;
    const item = k.heldItem;
    if (!item) return;
    if(k.flight==='FALL')return;
    if(k.flight==='GLIDE'&&['olio','buca','raffica','mollone','calamita'].includes(item))return;
    k.heldItem = null;

    let outcome:{target:PlayerId;hit:boolean}|null=null;
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
        if (target) {const hit=this.applyEffect(target, { disturb: 2.6 });outcome={target:target.playerId,hit};}
        break;
      }
      case 'calamita': {
        const target=allKarts.filter(other=>other!==k&&!other.finished&&other.respawnTimer<=0&&other.jumpHeight<.4)
          .map(other=>({other,ds:trackDelta(other.distance,k.distance,this.spline.totalLength)}))
          .filter(({other,ds})=>ds>3&&ds<24&&Math.abs(other.lateral-k.lateral)<3)
          .sort((a,b)=>a.ds-b.ds)[0]?.other;
        if(!target){k.heldItem=item;return;} // nessun collegamento inventato: conserva l'oggetto
        k.magnetTarget=target.playerId;k.magnetTimer=3;this.spawnTimed(k,item);break;
      }
      case 'piccione': this.spawnProjectile(k,'piccione');break;
      case 'turbo_difettoso': applyBoost(k,48,1.8);k.faultyTimer=1.8;this.spawnTimed(k,item);break;
      case 'buca': case 'raffica': this.spawnGround(k,item);break;
      case 'paraurti': k.bumperTimer=5;this.spawnTimed(k,item);break;
      case 'mollone':
        if(k.jumpHeight>.05){k.heldItem=item;return;}
        k.jumpVelocity=6.2;this.spawnTimed(k,item);break;
    }
    this.onPresentation(k.playerId,null,item,true);
    if(outcome)this.onPresentation(k.playerId,outcome.target,item,outcome.hit);
    audio.kartItem(item);
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

  private spawnProjectile(k: KartState, kind: 'sfera'|'piccione' = 'sfera'): void {
    const mesh = kind==='piccione'?this.visuals.object(kind):MeshBuilder.CreateSphere('projectile', { diameter: 0.5 }, this.scene);
    if(kind==='sfera') {mesh.material = this.visuals.material('#ee3344',.35);const belt=MeshBuilder.CreateTorus('impactSphereBand',{diameter:.51,thickness:.055,tessellation:12},this.scene);belt.material=this.visuals.material('#ffe0a1',.3);belt.parent=mesh;}
    mesh.parent = this.root;
    this.projectiles.push({
      kind,
      firedBy: k.playerId,
      airborne:k.flight==='GLIDE',
      distance: k.distance + 2.5,
      lateral: k.lateral,
      speed: kind==='piccione'?k.speed*.65+24:k.speed+PROJECTILE_SPEED,
      lateralVelocity: Math.sin(k.heading)*(kind==='piccione'?6:10),
      life: kind==='piccione'?3:PROJECTILE_LIFE,
      mesh,
      nearMissed: new Set()
    });
  }

  private spawnTrap(k: KartState): void {
    const distance = k.distance - 4.5;
    const lateral = Math.max(-this.spline.widthAt(distance) / 2 + TRAP_RADIUS_LAT + .4, Math.min(this.spline.widthAt(distance) / 2 - TRAP_RADIUS_LAT - .4, k.lateral));
    const mesh = itemSurface(this.scene, this.spline, distance, lateral, TRAP_RADIUS_S, TRAP_RADIUS_LAT);
    mesh.parent = this.root;
    // Bordo iridescente sottile e riflessi chiari: leggibili anche con la luce sfavorevole.
    for (const [scale, color] of [[1.08, new Color3(.25, .65, .7)], [.74, new Color3(.45, .48, .6)]] as const) {
      const ring = itemSurface(this.scene, this.spline, distance, lateral, TRAP_RADIUS_S * scale, TRAP_RADIUS_LAT * scale, 'oilSheen');
      ring.position.y = scale > 1 ? -.018 : .012;
      const mat = ring.material as StandardMaterial; mat.diffuseColor = color; mat.emissiveColor = color.scale(.2);
      if (scale < 1) mat.alpha = .18;
      ring.parent = mesh;
    }
    this.traps.push({ kind:'olio',rs:TRAP_RADIUS_S,rl:TRAP_RADIUS_LAT,wind:0,firedBy: k.playerId, distance, lateral, life: TRAP_LIFE, mesh, visitors: new Set() });
  }

  private updateProjectiles(dt: number, karts: KartState[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const oldDistance=p.distance,oldLateral=p.lateral;
      p.distance += p.speed * dt;
      p.lateral += p.lateralVelocity * dt;
      p.life -= dt;
      p.mesh.position.copyFrom(this.spline.worldPoint(p.distance, p.lateral, p.kind==='piccione'?.7:.4));
      if(p.airborne)p.mesh.position.y+=this.spline.flightHeightAt(p.distance);
      if(p.kind==='piccione') {
        p.mesh.rotation.y=this.spline.tangentAngleAt(p.distance);
        for(const wing of p.mesh.getChildMeshes().filter(m=>m.name==='birdWing'))wing.rotation.z=Math.sign(wing.position.x)*(.2+Math.sin(p.life*24)*.35);
      } else p.mesh.rotation.y += dt * 10;

      let hit = false;
      if (p.life > 0) {
        for (const k of karts) {
          if (k.playerId === p.firedBy || k.finished || k.respawnTimer>0 || Math.abs(k.jumpHeight-(p.airborne?this.spline.flightHeightAt(p.distance):0))>.8) continue;
          const ds = Math.abs(trackDelta(k.distance,p.distance,this.spline.totalLength));
          const dl = Math.abs(k.lateral - p.lateral);
          const previous=this.previous.get(k.playerId)??k;
          const relativeFrom={distance:trackDelta(previous.distance,oldDistance,this.spline.totalLength),lateral:previous.lateral-oldLateral};
          const relativeTo={distance:relativeFrom.distance+(k.distance-previous.distance)-(p.distance-oldDistance),lateral:k.lateral-p.lateral};
          if (crossesSurface(relativeFrom,relativeTo,0,0,PROJECTILE_HIT_S+(p.kind==='piccione'?.15:0),PROJECTILE_HIT_LAT+(p.kind==='piccione'?.15:0),this.spline.totalLength)) {
            const applied=this.applyEffect(k, p.kind==='piccione'?{oil:.85}:{stun:PROJECTILE_STUN});
            this.onPresentation(p.firedBy,k.playerId,p.kind,applied);
            if(p.kind==='piccione')audio.kartSkid();
            hit = true;
            break;
          }
          if (!p.nearMissed.has(k.playerId) && ds < PROJECTILE_NEARMISS_S && dl < PROJECTILE_NEARMISS_LAT) {
            p.nearMissed.add(k.playerId);
            this.abilities.addMeter(k, NEARMISS_METER);
          }
        }
      }
      if (hit || p.life <= 0 || Math.abs(p.lateral)>this.spline.widthAt(p.distance)/2) {
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateTraps(dt: number, karts: KartState[]): void {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      t.life -= dt;
      for (const k of karts) {
        const initialLife=t.kind==='olio'?TRAP_LIFE:t.kind==='buca'?12:7;
        if (k.finished || k.respawnTimer > 0 || k.jumpHeight>.4 || (k.playerId === t.firedBy && t.life > initialLife - 1)) continue;
        const from = this.previous.get(k.playerId) ?? k;
        if (crossesSurface(from, k, t.distance, t.lateral, t.rs + 1.4, t.rl + 1, this.spline.totalLength)) {
          if(t.kind==='raffica'){
            // Una forza ambientale continua, compensabile; non uno stun o un taglio di velocità.
            k.slipVelocity=Math.max(-18,Math.min(18,k.slipVelocity+t.wind*8*dt));
            if(!t.visitors.has(k.playerId))audio.kartItem('raffica');
            t.visitors.add(k.playerId);continue;
          }
          if (!t.visitors.has(k.playerId)) {
            t.visitors.add(k.playerId);
            const applied=this.applyEffect(k,t.kind==='buca'?{oil:.7,bounce:3}:{oil:1.6});
            this.onPresentation(t.firedBy,k.playerId,t.kind,applied);
            if(applied){
              audio.kartSkid();
              if(t.kind==='buca')audio.kartBump(.3);
            }
          }
        } else {
          t.visitors.delete(k.playerId);
        }
      }
      if (t.life <= 0) {
        t.mesh.dispose(false, true);
        this.traps.splice(i, 1);
      }
    }
  }

  private spawnGround(k:KartState,kind:'buca'|'raffica'):void {
    const rs=kind==='buca'?1.7:4,rl=kind==='buca'?1.3:2.4,distance=k.distance-5.5;
    const limit=this.spline.widthAt(distance)/2-rl-.5;
    const lateral=Math.max(-limit,Math.min(limit,k.lateral)),wind=k.steerVisual===0?(this.rng.chance(.5)?1:-1):Math.sign(k.steerVisual);
    const mesh=itemSurface(this.scene,this.spline,distance,lateral,rs,rl,'surface-'+kind);mesh.parent=this.root;
    const rim=itemSurface(this.scene,this.spline,distance,lateral,rs*1.12,rl*1.12,'rim-'+kind,kind==='raffica'?.9:0);rim.position.y=-.018;rim.parent=mesh;
    const rimMat=rim.material as StandardMaterial;rimMat.diffuseColor=Color3.FromHexString(kind==='buca'?'#ffb72e':'#5b9abb');rimMat.emissiveColor=rimMat.diffuseColor.scale(.15);
    if(kind==='raffica'){
      const mat=mesh.material as StandardMaterial;mat.diffuseColor=new Color3(.3,.65,.85);mat.alpha=.3;
      for(let i=0;i<3;i++){
        const marker=MeshBuilder.CreateCylinder('windArrow',{diameterTop:0,diameterBottom:.6,height:1,tessellation:3},this.scene);
        // Mesh in coordinate mondo, quindi non si scala/ruota una superficie con vertici già mondiali.
        marker.position.copyFrom(this.spline.worldPoint(distance+(i-1)*1.8,lateral,.23));
        const right=this.spline.rightAt(distance);marker.rotation.z=-Math.PI/2*wind;marker.rotation.y=this.spline.tangentAngleAt(distance);
        marker.material=rimMat;marker.parent=this.root;
        // I segni sono posseduti dalla stessa trappola per una pulizia unica.
        marker.setParent(mesh);marker.metadata={wind:true,direction:wind,base:marker.position.clone(),right};
      }
    }
    this.traps.push({kind,rs,rl,wind,firedBy:k.playerId,distance,lateral,life:kind==='buca'?12:7,mesh,visitors:new Set()});
  }

  private spawnTimed(k:KartState,kind:'paraurti'|'turbo_difettoso'|'mollone'|'calamita'):void {
    const key=k.playerId+kind,old=this.timed.get(key);old?.mesh.dispose();old?.tether?.dispose();
    const mesh=this.visuals.object(kind);mesh.parent=this.root;
    this.timed.set(key,{playerId:k.playerId,kind,mesh});
  }

  private updateTimed(dt:number,karts:KartState[]):void {
    for(const k of karts){
      if(k.magnetTimer>0){
        const target=karts.find(other=>other.playerId===k.magnetTarget);
        const gap=target?trackDelta(target.distance,k.distance,this.spline.totalLength):Infinity;
        if(!target||target.finished||target.respawnTimer>0||k.finished||k.respawnTimer>0||k.stunTimer>0||k.jumpHeight>.4||target.jumpHeight>.4||gap<2||gap>30||Math.abs(target.lateral-k.lateral)>5){k.magnetTimer=0;k.magnetTarget=null;}
        else {k.magnetTimer=Math.max(0,k.magnetTimer-dt);applyBoost(k,12,.08);k.speed=Math.min(68,k.speed+9*dt);}
      }
    }
    for(const [key,v] of this.timed){
      const k=karts.find(other=>other.playerId===v.playerId);
      const active=k&&!k.finished&&k.respawnTimer<=0&&(v.kind==='paraurti'?k.bumperTimer>0:v.kind==='turbo_difettoso'?k.faultyTimer>0:v.kind==='calamita'?k.magnetTimer>0:k.jumpHeight>.01||k.jumpVelocity>0);
      if(!active){v.mesh.dispose();v.tether?.dispose();this.timed.delete(key);continue;}
      v.mesh.position.copyFrom(this.spline.worldPoint(k.distance,k.lateral,.05));v.mesh.position.y+=k.jumpHeight;v.mesh.rotation.y=k.absHeading;
      if(v.kind==='mollone')v.mesh.scaling.y=.7+Math.min(1,k.jumpHeight)*.5;
      if(v.kind==='turbo_difettoso')for(const flame of v.mesh.getChildMeshes().filter(m=>m.name==='rocketFlame'))flame.scaling.z=1.4+Math.sin(k.faultyTimer*45)*.5;
      if(v.kind==='calamita'){
        const target=karts.find(other=>other.playerId===k.magnetTarget)!;
        const path=[this.spline.worldPoint(k.distance,k.lateral,1),this.spline.worldPoint(target.distance,target.lateral,.8)];
        v.tether=MeshBuilder.CreateTube('magnetTether',{path,radius:.065,tessellation:5,updatable:true,instance:v.tether},this.scene);
        v.tether.material=this.visuals.material('#ff84ed',.8);v.tether.parent=this.root;
      }
    }
    for(const t of this.traps)for(const marker of t.mesh.getChildMeshes()){
      if(marker.metadata?.wind)marker.position.copyFrom(marker.metadata.base.add(marker.metadata.right.scale(Math.sin(t.life*8)*.3*t.wind)));
    }
  }

  /**
   * Applica l'effetto di un item (stordimento e/o sterzo invertito) dopo aver
   * verificato scudo/invulnerabilità: se il colpo atterrerebbe comunque, offre
   * a Ciro (PAGO DOPO) la possibilità di rimandarlo invece di subirlo subito.
   */
  private applyEffect(k: KartState, effect: { stun?: number; disturb?: number; oil?:number; bounce?:number }): boolean {
    if (k.invulnTimer > 0) return false;
    if (k.shielded) {
      k.shielded = false;
      return false;
    }
    if (this.abilities.tryDelayHit(k, effect, (f) => this.onFeedback(k.playerId, f))) return false;
    if (effect.stun) hitKart(k, effect.stun);
    if (effect.disturb) k.disturbTimer = Math.max(k.disturbTimer, effect.disturb);
    if (effect.oil) k.oilTimer = Math.max(k.oilTimer, effect.oil);
    if (effect.bounce) k.jumpVelocity = Math.max(k.jumpVelocity,effect.bounce);
    this.abilities.noteHit(k, effect); // Ciro: subito dopo il colpo puo' ancora premere ABILITA' e trasformarlo in debito
    return true;
  }

  dispose(): void {
    for (const b of this.boxes) b.mesh.dispose();
    for (const p of this.projectiles) p.mesh.dispose();
    for (const t of this.traps) t.mesh.dispose(false, true);
    this.previous.clear(); this.roulettes.clear();
    for(const v of this.timed.values()){v.mesh.dispose();v.tether?.dispose();}this.timed.clear();
    this.visuals.dispose();
    this.root.dispose();
  }
}

export function itemLabel(id: ItemId): string {
  const item=KART_ITEMS[id];return `${item.icon} ${item.name}`;
}

/** La stessa descrizione usata nell'inventario telefono. */
export function itemDescription(id: ItemId): string { return KART_ITEMS[id].description; }
