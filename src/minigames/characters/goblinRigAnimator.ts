import { Quaternion, Vector3 } from '@babylonjs/core';
import type { AnimationGroup, Bone, TransformNode } from '@babylonjs/core';
import { clipOf, GoblinAnimator } from './goblinAnimator';
import type { GoblinAnimationState } from './goblinAnimator';

type Target = TransformNode | Bone;
type Value = Vector3 | Quaternion;
interface Track { target: Target; property: 'position' | 'rotationQuaternion' | 'scaling'; times: number[]; values: Value[] }
interface Pose { p: Vector3; q: Quaternion | null; s: Vector3 }
/** One sampler per instance. Groups are data; no engine autoplay or overlapping full-body animatables. */
export class GoblinRigAnimator {
  readonly controller = new GoblinAnimator();
  private tracks = new Map<string, Track[]>();
  private nodes = new Set<Target>();
  private from = new Map<Target, Pose>();
  private token = '';
  private blendT = 0;
  private hips: Target | null = null;
  private restHips: Vector3 | null = null;
  private v = Vector3.Zero();
  private q = Quaternion.Identity();
  private seamV = Vector3.Zero();
  private seamQ = Quaternion.Identity();
  sampleMs = 0;
  constructor(groups: readonly AnimationGroup[], hips: Target | null) {
    this.hips = hips; this.restHips = hips?.position.clone() ?? null;
    for (const group of groups) {
      group.stop();
      const name = group.name.replace(/~g\d+$/, '');
      const tracks: Track[] = [];
      for (const ta of group.targetedAnimations) {
        const property = ta.animation.targetProperty;
        if (property!=='position'&&property!=='rotationQuaternion'&&property!=='scaling') continue;
        const target = ta.target as Target, keys = ta.animation.getKeys();
        if (!keys.length) continue;
        this.nodes.add(target);
        tracks.push({target,property,times:keys.map(k=>k.frame/ta.animation.framePerSecond),values:keys.map(k=>k.value as Value)});
      }
      this.tracks.set(name,tracks);
    }
  }
  private evaluate(track: Track, t: number, out: Value): void {
    const ts = track.times;
    let low = 0, high = ts.length - 1;
    while (low<high) { const mid=(low+high)>>1; if(ts[mid]<t) low=mid+1; else high=mid; }
    const b=low, a=Math.max(0,b-1);
    const k=b===a?0:Math.max(0,Math.min(1,(t-ts[a])/(ts[b]-ts[a])));
    if(track.property==='rotationQuaternion') Quaternion.SlerpToRef(track.values[a] as Quaternion,track.values[b] as Quaternion,k,out as Quaternion);
    else Vector3.LerpToRef(track.values[a] as Vector3,track.values[b] as Vector3,k,out as Vector3);
  }
  update(dt: number, state: GoblinAnimationState): void {
    const begin=performance.now(), sample=this.controller.update(dt,state), spec=clipOf(sample.name)!;
    const tracks=this.tracks.get(spec.original);
    if(!tracks) return;
    if(sample.token!==this.token) {
      this.token=sample.token; this.blendT=0;
      for(const target of this.nodes) this.from.set(target,{p:target.position.clone(),q:target.rotationQuaternion?.clone()??null,s:target.scaling.clone()});
    }
    this.blendT+=dt;
    const blend=Math.min(1,this.blendT/sample.blend);
    // The release/catch instant is authoritative: no blend delay on an event fired at contact.
    const mix=sample.contactTime===0?1:blend;
    for(const track of tracks) {
      const rotation=track.property==='rotationQuaternion'; const value=rotation?this.q:this.v;
      this.evaluate(track,sample.seconds,value);
      if(sample.loop && spec.to-sample.seconds<.10) {
        const seam=rotation?this.seamQ:this.seamV;
        this.evaluate(track,spec.from,seam);
        const k=1-(spec.to-sample.seconds)/.10;
        if(rotation) Quaternion.SlerpToRef(value as Quaternion,seam as Quaternion,k,value as Quaternion);
        else Vector3.LerpToRef(value as Vector3,seam as Vector3,k,value as Vector3);
      }
      const from=this.from.get(track.target);
      if(rotation) {
        track.target.rotationQuaternion ??= Quaternion.Identity();
        Quaternion.SlerpToRef(from?.q??value as Quaternion,value as Quaternion,mix,track.target.rotationQuaternion);
      } else {
        const old=track.property==='position'?from?.p:from?.s;
        Vector3.LerpToRef(old??value as Vector3,value as Vector3,mix,track.target[track.property] as Vector3);
      }
    }
    if(this.hips && this.restHips) {
      // Every clip has a different constant root offset. No animation translation may move the actor.
      this.hips.position.x=this.restHips.x; this.hips.position.z=this.restHips.z;
      if(state.grounded===false || state.falling) this.hips.position.y=this.restHips.y;
    }
    this.sampleMs=performance.now()-begin;
  }
  get activeTracks(): number { return this.controller.last?this.tracks.get(clipOf(this.controller.last.name)!.original)?.length??0:0; }
}
