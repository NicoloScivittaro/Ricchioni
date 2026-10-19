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
import { KART_ITEMS, pickKartItem, ITEM_POWER } from './itemCatalog';
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
const PROJECTILE_STUN = ITEM_POWER.sphereStun;
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
  kind: 'sfera' | 'piccione' | 'missile';
  target?:PlayerId;
  warning:number;
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
  blocked:Set<PlayerId>;
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
  private thefts:{source:PlayerId;target:PlayerId;timer:number}[]=[];
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
    private onPresentation: (source:PlayerId,target:PlayerId|null,kind:ItemId,hit:boolean,warning?:boolean)=>void = ()=>undefined
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
        if (k.heldItem || k.finished || k.respawnTimer > 0 || this.roulettes.has(k.playerId)||this.thefts.some(t=>t.source===k.playerId)) continue;
        const ds = Math.abs(this.spline.wrap(k.distance - box.s));
        const dsAlt = this.spline.totalLength - ds;
        const dist = Math.min(ds, dsAlt);
        if (dist < BOX_PICKUP_RADIUS_S && Math.abs(k.lateral - box.lateral) < BOX_PICKUP_RADIUS_LAT) {
          box.taken = true;
          box.respawnTimer = BOX_RESPAWN_TIME;
          box.mesh.setEnabled(false);
          this.grantItem(k, placement(k.playerId), totalPlayers,Math.max(0,(Math.max(...karts.map(v=>v.distance))-k.distance)/44));
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

    this.updateThefts(dt,karts);
    this.updateProjectiles(dt, karts);
    this.updateTraps(dt, karts);
    this.updateTimed(dt, karts);
    for (const k of karts) this.previous.set(k.playerId, { distance: k.distance, lateral: k.lateral });
  }

  isRouletteSpinning(playerId: PlayerId): boolean {
    return this.roulettes.has(playerId);
  }

  private grantItem(k: KartState, placement: number, totalPlayers: number,gapSeconds:number): void {
    const result = this.pickWeighted(placement, totalPlayers,gapSeconds);
    this.roulettes.set(k.playerId, { playerId: k.playerId, timer: ROULETTE_TIME, result });
  }

  private pickWeighted(placement: number, totalPlayers: number,gapSeconds:number): ItemId {
    return pickKartItem(this.rng, placement, totalPlayers,gapSeconds);
  }

  /** Usa l'oggetto posseduto dal giocatore (tasto ITEM). */
  useItem(k: KartState, allKarts: KartState[], rankOf: (pid: PlayerId) => number): boolean {
    if(k.finished || k.respawnTimer>0)return false;
    const item = k.heldItem;
    if (!item) return false;
    if(k.flight==='FALL')return false;
    if(k.flight==='GLIDE'&&['olio','buca','raffica','mollone','calamita'].includes(item))return false;
    if(item==='scudo'&&k.shielded)return false;
    if(['olio','buca','raffica'].includes(item)&&!this.spline.hasRoadAt(k.distance-5.5))return false;
    k.heldItem = null;

    let outcome:{target:PlayerId;hit:boolean}|null=null;
    switch (item) {
      case 'turbo':
        // Finite overtaking burst; the ordinary drift mini-turbo stays unchanged.
        applyBoost(k, ITEM_POWER.turbo.power,ITEM_POWER.turbo.time);
        break;
      case 'super_turbo':
        // Raro e potente: deve sentirsi come un vero cambio di passo.
        applyBoost(k, ITEM_POWER.super_turbo.power,ITEM_POWER.super_turbo.time);
        break;
      case 'scudo':
        k.shielded = true;k.shieldPerfectTimer=ITEM_POWER.shield.perfect;
        break;
      case 'olio':
        this.spawnTrap(k);
        break;
      case 'sfera':
        this.spawnProjectile(k);
        break;
      case 'disturbo': {
        // Reachable local rival only, with the same visible attack corridor as other items.
        const target = this.findTargetAhead(k, allKarts,45);
        if(!target){k.heldItem=item;return false;}
        const hit=this.applyEffect(target, { disturb: 1.6 });outcome={target:target.playerId,hit};
        break;
      }
      case 'calamita': {
        const target=this.findTargetAhead(k,allKarts.filter(v=>v.jumpHeight<.4),ITEM_POWER.magnet.range);
        if(!target||k.jumpHeight>.4||k.stunTimer>0){k.heldItem=item;return false;} // nessun collegamento inventato: conserva l'oggetto
        k.magnetTarget=target.playerId;k.magnetTimer=ITEM_POWER.magnet.time;this.spawnTimed(k,item);break;
      }
      case 'piccione': this.spawnProjectile(k,'piccione');break;
      case 'turbo_difettoso': applyBoost(k,ITEM_POWER.faulty.power,ITEM_POWER.faulty.time);k.faultyTimer=ITEM_POWER.faulty.time;this.spawnTimed(k,item);break;
      case 'buca': case 'raffica': this.spawnGround(k,item);break;
      case 'paraurti': k.bumperTimer=ITEM_POWER.bumperTime;this.spawnTimed(k,item);break;
      case 'missile': {
        const target=this.findTargetAhead(k,allKarts,ITEM_POWER.missile.range);
        if(!target){k.heldItem=item;return false;}
        this.spawnProjectile(k,'missile',target.playerId);target.incomingItemTimer=1;target.incomingItemKind='missile';
        this.onPresentation(k.playerId,target.playerId,item,true,true);break;
      }
      case 'furto': {
        const target=allKarts.filter(v=>v!==k&&v.heldItem&&this.reachable(k,v,ITEM_POWER.theft.range)).sort((a,b)=>Math.abs(a.distance-k.distance)-Math.abs(b.distance-k.distance))[0];
        if(!target){k.heldItem=item;return false;}
        this.thefts.push({source:k.playerId,target:target.playerId,timer:ITEM_POWER.theft.warning});target.incomingItemTimer=ITEM_POWER.theft.warning;target.incomingItemKind='furto';
        this.onPresentation(k.playerId,target.playerId,item,true,true);break;
      }
      case 'mollone':
        if(k.jumpHeight>.05||k.jumpVelocity>0){k.heldItem=item;return false;}
        k.jumpVelocity=ITEM_POWER.springJump;k.springLandingBoost=true;this.spawnTimed(k,item);break;
    }
    this.onPresentation(k.playerId,null,item,true);
    if(outcome)this.onPresentation(k.playerId,outcome.target,item,outcome.hit);
    audio.kartItem(item);
    return true;
  }

  /** Range follows real race progress and the same road/air corridor, never another lap or height layer. */
  private reachable(a:KartState,b:KartState,range:number):boolean {
    const ds=b.distance-a.distance;
    if(b.finished||b.respawnTimer>0||b.flight==='FALL'||a.flight!==b.flight||Math.abs(ds)>range||Math.abs(a.lateral-b.lateral)>4)return false;
    if(a.flight==='GLIDE')return a.glideStart===b.glideStart&&a.glideEnd===b.glideEnd;
    if(Math.abs(a.jumpHeight-b.jumpHeight)>.8)return false;
    for(let d=0;d<=Math.abs(ds);d+=4)if(!this.spline.hasRoadAt(a.distance+Math.sign(ds)*d))return false;
    return this.spline.hasRoadAt(b.distance);
  }
  private findTargetAhead(k:KartState,allKarts:KartState[],range:number):KartState|null {
    return allKarts.filter(v=>v!==k&&v.distance>k.distance+2&&this.reachable(k,v,range)).sort((a,b)=>a.distance-b.distance)[0]??null;
  }
  private updateThefts(dt:number,karts:KartState[]):void {
    for(let i=this.thefts.length-1;i>=0;i--){
      const t=this.thefts[i];t.timer-=dt;if(t.timer>0)continue;
      const source=karts.find(k=>k.playerId===t.source),target=karts.find(k=>k.playerId===t.target);
      let hit=false;
      if(source&&!source.finished&&source.flight!=='FALL'&&source.respawnTimer<=0&&!source.heldItem&&target?.heldItem&&this.reachable(source,target,ITEM_POWER.theft.range)&&!this.abilities.blockHit(target,f=>this.onFeedback(target.playerId,f))){
        source.heldItem=target.heldItem;target.heldItem=null;hit=true;
      }
      this.onPresentation(t.source,t.target,'furto',hit);this.thefts.splice(i,1);
    }
  }

  private spawnProjectile(k: KartState, kind: 'sfera'|'piccione'|'missile' = 'sfera',target?:PlayerId): void {
    const mesh = kind==='piccione'?this.visuals.object(kind):kind==='missile'?MeshBuilder.CreateCylinder('revengeMissile',{height:1.1,diameterTop:0,diameterBottom:.5,tessellation:8},this.scene):MeshBuilder.CreateSphere('projectile', { diameter: 0.5 }, this.scene);
    if(kind==='missile')mesh.material=this.visuals.material('#ff354e',.65);
    if(kind==='sfera') {mesh.material = this.visuals.material('#ee3344',.35);const belt=MeshBuilder.CreateTorus('impactSphereBand',{diameter:.51,thickness:.055,tessellation:12},this.scene);belt.material=this.visuals.material('#ffe0a1',.3);belt.parent=mesh;}
    mesh.parent = this.root;
    this.projectiles.push({
      kind,target,warning:kind==='missile'?ITEM_POWER.missile.warning:0,
      firedBy: k.playerId,
      airborne:k.flight==='GLIDE',
      distance: k.distance + 2.5,
      lateral: k.lateral,
      speed:kind==='missile'?ITEM_POWER.missile.speed:kind==='piccione'?k.speed+32:k.speed+PROJECTILE_SPEED,
      lateralVelocity: Math.sin(k.heading)*(kind==='piccione'?6:10),
      life:kind==='missile'?ITEM_POWER.missile.life:kind==='piccione'?3:PROJECTILE_LIFE,
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
    this.traps.push({ kind:'olio',rs:TRAP_RADIUS_S,rl:TRAP_RADIUS_LAT,wind:0,firedBy: k.playerId, distance, lateral, life: TRAP_LIFE, mesh, visitors: new Set(),blocked:new Set() });
  }

  private updateProjectiles(dt: number, karts: KartState[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if(p.kind==='missile'){
        const target=karts.find(k=>k.playerId===p.target),source=karts.find(k=>k.playerId===p.firedBy);
        const ds=target?target.distance-p.distance:Infinity;
        const sameAir=target&&(p.airborne?target.flight==='GLIDE'&&target.glideStart===(source?.glideStart):target.flight==='DRIVE');
        let clear=!!sameAir&&!!target&&!target.finished&&target.respawnTimer<=0&&ds>-3&&ds<ITEM_POWER.missile.range;
        if(clear&&!p.airborne)for(let d=p.distance;d<=target!.distance;d+=4)if(!this.spline.hasRoadAt(d)){clear=false;break;}
        if(!clear){p.mesh.dispose();this.projectiles.splice(i,1);continue;}
        target!.incomingItemTimer=1;target!.incomingItemKind='missile';
        if(p.warning>0){if(source){p.distance=source.distance+2.5;p.lateral=source.lateral;}p.warning=Math.max(0,p.warning-dt);p.mesh.position.copyFrom(this.spline.worldPoint(p.distance,p.lateral,.8));if(p.airborne)p.mesh.position.y+=this.spline.flightHeightAt(p.distance);continue;}
        p.lateralVelocity=Math.max(-3.5,Math.min(3.5,(target!.lateral-p.lateral)*3));
      }
      const oldDistance=p.distance,oldLateral=p.lateral;
      p.distance += p.speed * dt;
      p.lateral += p.lateralVelocity * dt;
      p.life -= dt;
      if(!p.airborne&&!this.spline.hasRoadAt(p.distance))p.life=0;
      p.mesh.position.copyFrom(this.spline.worldPoint(p.distance, p.lateral, p.kind==='piccione'?.7:.4));
      if(p.airborne)p.mesh.position.y+=this.spline.flightHeightAt(p.distance);
      if(p.kind==='missile'){p.mesh.rotation.set(Math.PI/2,this.spline.tangentAngleAt(p.distance),0);}
      else if(p.kind==='piccione') {
        p.mesh.rotation.y=this.spline.tangentAngleAt(p.distance);
        for(const wing of p.mesh.getChildMeshes().filter(m=>m.name==='birdWing'))wing.rotation.z=Math.sign(wing.position.x)*(.2+Math.sin(p.life*24)*.35);
      } else p.mesh.rotation.y += dt * 10;

      let hit = false;
      if (p.life > 0) {
        for (const k of karts) {
          if (k.playerId === p.firedBy || k.finished || k.flight==='FALL'||k.respawnTimer>0 || (p.kind==='missile'&&k.playerId!==p.target)|| Math.abs(k.jumpHeight-(p.airborne?this.spline.flightHeightAt(p.distance):0))>.8) continue;
          const ds = Math.abs(trackDelta(k.distance,p.distance,this.spline.totalLength));
          const dl = Math.abs(k.lateral - p.lateral);
          const previous=this.previous.get(k.playerId)??k;
          const relativeFrom={distance:trackDelta(previous.distance,oldDistance,this.spline.totalLength),lateral:previous.lateral-oldLateral};
          const relativeTo={distance:relativeFrom.distance+(k.distance-previous.distance)-(p.distance-oldDistance),lateral:k.lateral-p.lateral};
          if (crossesSurface(relativeFrom,relativeTo,0,0,PROJECTILE_HIT_S+(p.kind==='piccione'?.15:0),PROJECTILE_HIT_LAT+(p.kind==='piccione'?.15:0),this.spline.totalLength)) {
            const applied=this.applyEffect(k, p.kind==='piccione'?{stun:ITEM_POWER.birdStun,oil:ITEM_POWER.birdOil}:{stun:PROJECTILE_STUN});
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
        if (k.finished || k.flight!=='DRIVE'||k.respawnTimer > 0 || k.jumpHeight>.4 || (k.playerId === t.firedBy && t.life > initialLife - 1)) continue;
        const from = this.previous.get(k.playerId) ?? k;
        if (crossesSurface(from, k, t.distance, t.lateral, t.rs + 1.4, t.rl + 1, this.spline.totalLength)) {
          if(t.kind==='raffica'){
            // Una forza ambientale continua, compensabile; non uno stun o un taglio di velocità.
            if(!t.visitors.has(k.playerId)){
              t.visitors.add(k.playerId);
              if(this.applyEffect(k,{oil:.3})){audio.kartItem('raffica');this.onPresentation(t.firedBy,k.playerId,'raffica',true);}else t.blocked.add(k.playerId);
            }
            if(!t.blocked.has(k.playerId)){
              if((k.shielded||k.abilityArmor>0)&&this.abilities.blockHit(k,f=>this.onFeedback(k.playerId,f)))t.blocked.add(k.playerId);
              else k.slipVelocity=Math.max(-6,Math.min(6,k.slipVelocity+t.wind*10*dt));
            }
            continue;
          }
          if (!t.visitors.has(k.playerId)) {
            t.visitors.add(k.playerId);
            const applied=this.applyEffect(k,t.kind==='buca'?{oil:ITEM_POWER.bumpOil,bounce:ITEM_POWER.bumpJump}:{oil:ITEM_POWER.oilTime});
            this.onPresentation(t.firedBy,k.playerId,t.kind,applied);
            if(applied){
              audio.kartSkid();
              if(t.kind==='buca')audio.kartBump(.3);
            }
          }
        } else {
          t.visitors.delete(k.playerId);t.blocked.delete(k.playerId);
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
    this.traps.push({kind,rs,rl,wind,firedBy:k.playerId,distance,lateral,life:kind==='buca'?12:7,mesh,visitors:new Set(),blocked:new Set()});
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
        if(!target||target.finished||target.respawnTimer>0||k.finished||k.respawnTimer>0||k.stunTimer>0||k.flight!=='DRIVE'||!this.reachable(k,target,ITEM_POWER.magnet.breakRange)||k.jumpHeight>.4||target.jumpHeight>.4||gap<2||gap>ITEM_POWER.magnet.breakRange||Math.abs(target.lateral-k.lateral)>5){k.magnetTimer=0;k.magnetTarget=null;}
        else {k.magnetTimer=Math.max(0,k.magnetTimer-dt);applyBoost(k,ITEM_POWER.magnet.power,.12);k.speed=Math.min(60,k.speed+14*dt);}
      }
    }
    for(const [key,v] of this.timed){
      const k=karts.find(other=>other.playerId===v.playerId);
      const active=k&&!k.finished&&k.respawnTimer<=0&&(v.kind==='paraurti'?k.bumperTimer>0:v.kind==='turbo_difettoso'?k.faultyTimer>0:v.kind==='calamita'?k.magnetTimer>0:k.jumpHeight>.01||k.jumpVelocity>0);
      if(!active){if(k?.springLandingBoost&&v.kind==='mollone'&&!k.finished&&k.flight==='DRIVE'&&k.jumpHeight<=.01){k.springLandingBoost=false;applyBoost(k,24,1.1);}v.mesh.dispose();v.tether?.dispose();this.timed.delete(key);continue;}
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
    if(k.flight==='GLIDE')effect={stun:Math.min(.4,effect.stun??0),disturb:Math.min(.65,effect.disturb??0),oil:Math.min(.6,effect.oil??0)};
    if(this.abilities.blockHit(k,f=>this.onFeedback(k.playerId,f)))return false;
    if (this.abilities.tryDelayHit(k, effect, (f) => this.onFeedback(k.playerId, f))) return false;
    const previousSpeed=k.speed;
    k.boostTimer=0;k.boostPower=0;
    if (effect.stun) hitKart(k, effect.stun);
    if (effect.disturb) k.disturbTimer = Math.max(k.disturbTimer, effect.disturb);
    if (effect.oil) k.oilTimer = Math.max(k.oilTimer, effect.oil);
    if (effect.bounce) k.jumpVelocity = Math.max(k.jumpVelocity,effect.bounce);
    if(k.flight==='GLIDE')k.speed=Math.max(32,k.speed);
    k.invulnTimer=Math.max(k.invulnTimer,1);
    this.abilities.noteHit(k, effect,previousSpeed); // Ciro: subito dopo il colpo puo' ancora premere ABILITA' e trasformarlo in debito
    return true;
  }

  dispose(): void {
    for (const b of this.boxes) b.mesh.dispose();
    for (const p of this.projectiles) p.mesh.dispose();
    for (const t of this.traps) t.mesh.dispose(false, true);
    this.previous.clear(); this.roulettes.clear();this.thefts.length=0;
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
