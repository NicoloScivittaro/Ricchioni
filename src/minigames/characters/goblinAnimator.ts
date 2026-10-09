import manifest from './goblinClips.json';

/** Render-only contract. No gameplay objects, callbacks or Babylon scene access. */
export interface GoblinAttack {
  id: string;
  elapsed: number;
  startup: number;
  active: number;
  recovery: number;
}
export interface GoblinAnimationState {
  speedFrac: number; alive: boolean; falling: boolean; dashing: boolean; stunned: boolean;
  grounded?: boolean; vy?: number; dodge?: boolean; knockback?: boolean; hitFlash?: number;
  attack?: GoblinAttack | null; ability?: boolean; result?: 'victory' | 'defeat' | null;
  koDuration?: number;
  /** Held soccer wind-up, read only. The actual kick event still owns ball contact. */
  charge?: number;
}
export type GoblinClip = (typeof manifest)[number];
export const GOBLIN_CLIPS: readonly GoblinClip[] = manifest;
const byName = new Map(manifest.map(c => [c.name, c]));
export const clipOf = (name: string): GoblinClip | undefined => byName.get(name);
export const GOBLIN_LODS = { LOD0: {url:'/models/goblin-tripo/green_goblin_casacarbo.glb',triangles:35624,textureSize:4096}, LOD1: null, LOD2: null } as const;

/** All fourteen existing move IDs, plus the existing ability follow-up. */
export const GOBLIN_MOVES: Readonly<Record<string, string>> = {
  nL: 'goblin.jab', sL: 'goblin.hook', uL: 'goblin.uppercut', dL: 'goblin.frontKick',
  sH: 'goblin.heavy', uH: 'goblin.uppercut', dH: 'goblin.roundhouse',
  nAL: 'goblin.jab', sAL: 'goblin.frontKick', uAL: 'goblin.uppercut', dAL: 'goblin.frontKick',
  sAH: 'goblin.heavy', dAH: 'goblin.roundhouse', uAH: 'goblin.uppercut', follow: 'goblin.heavy'
};
export const GOBLIN_ACTIONS: Readonly<Record<string, string>> = {
  jab: 'goblin.jab', side: 'goblin.hook', up: 'goblin.uppercut', down: 'goblin.frontKick',
  smashWind: 'goblin.heavy', smash: 'goblin.heavy', upHeavy: 'goblin.uppercut',
  sweepHeavy: 'goblin.roundhouse', air: 'goblin.jab', airSpike: 'goblin.roundhouse',
  recovery: 'goblin.uppercut', follow: 'goblin.heavy', dodge: 'goblin.dodge',
  brace: 'goblin.block', grab: 'goblin.grab', fling: 'goblin.judoThrow',
  throw: 'goblin.ballThrow', pickup: 'goblin.pickup', absorb: 'goblin.ballCatch',
  kick: 'goblin.frontKick', spike: 'goblin.ballThrow', recoil: 'goblin.knockback'
};
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
interface Request { name: string; t: number; duration: number; contactNow: boolean; priority: number; token: number }
export interface GoblinSample {
  name: string; seconds: number; blend: number; speed: number; priority: number;
  loop: boolean; token: string; contactTime: number | null; duration: number;
}
/** Warp animation contact into the EXISTING active interval; all three phases remain unchanged. */
export function attackSeconds(c: GoblinClip, a: GoblinAttack): number {
  const total = a.startup + a.active + a.recovery;
  const contactAt = a.startup + a.active * .35;
  const candidate = a.id==='dL' ? c.lowContact ?? c.contact : c.contact;
  const contact = clamp(candidate ?? (c.from + (c.to - c.from) * .4), c.from + .001, c.to - .001);
  const t = clamp(a.elapsed, 0, total);
  if (t <= contactAt) return c.from + (contact - c.from) * t / Math.max(.001, contactAt);
  return contact + (c.to - contact) * (t - contactAt) / Math.max(.001, total - contactAt);
}

export class GoblinAnimator {
  private readonly clipsByName: Map<string, GoblinClip>;
  constructor(clips: readonly GoblinClip[] = GOBLIN_CLIPS, private readonly namespace = 'goblin') {
    this.clipsByName = new Map(clips.map(c=>[c.name,c]));
  }
  private name(name:string):string { return `${this.namespace}.${name.slice(name.indexOf('.')+1)}`; }
  private clip(name:string):GoblinClip|undefined { return this.clipsByName.get(this.name(name)); }
  private action: Request | null = null;
  private reaction: Request | null = null;
  private special: Request | null = null;
  private preview: { name: string; speed: number; loop: boolean; t: number; token: number } | null = null;
  private clock = 0;
  private sequence = 0;
  private bodyReactionIndex = 0;
  private previousState = '';
  private stateOverride: string | null = null;
  private stateT = 0;
  private ko = false;
  private previousAlive = true;
  private previousHit = 0;
  private result: 'victory' | 'defeat' | null = null;
  private previousAttack = '';
  private previousAttackT = 0;
  private attackToken = 0;
  last: GoblinSample | null = null;
  private request(name: string, duration: number, priority: number, contactNow = false): Request | null {
    name=this.name(name);
    if (!this.clip(name)) return null;
    return { name, duration: Math.max(.001, duration), priority, contactNow, t: 0, token: ++this.sequence };
  }
  playState(name: string | null): void { this.stateOverride=name&&this.clip(name)?this.name(name):null;this.previousState='';this.stateT=0; }
  playAction(name: string, duration = this.clip(name)?.duration ?? .3, contactNow = false): void {
    if (this.ko) return;
    this.action = this.request(name, duration, 40, contactNow);
  }
  playHitReaction(kind: 'head' | 'side' | 'body' | 'stomach' | 'knockback', duration = .38): void {
    if (this.ko) return;
    const name = kind === 'body' ? (++this.bodyReactionIndex % 2 ? 'goblin.hitBodyA' : 'goblin.hitBodyB')
      : kind === 'knockback' ? 'goblin.knockback' : `goblin.hit${kind[0].toUpperCase()}${kind.slice(1)}`;
    this.reaction = this.request(name, duration, 80);
    this.action = null; this.special = null;
  }
  private abilityPose(): string { return this.namespace==='judoka'||this.namespace==='buttafuori'?`${this.namespace}.block`:'goblin.uppercut'; }
  playAbility(duration = .3): void { if (!this.ko) this.special = this.request(this.abilityPose(), duration, 60); }
  playResult(result: 'victory' | 'defeat' | null): void {
    this.result = result; this.stateT = 0; this.previousState = ''; this.ko = false;
    if (result) this.previousAlive = true;
    this.action = this.reaction = this.special = null;
  }
  previewClip(name: string | null, speed = 1, loop = false): void {
    this.preview = name && this.clip(name) ? { name:this.name(name), speed: clamp(speed,.25,2), loop, t: 0, token: ++this.sequence } : null;
  }
  /** Scene-specific visual gesture. Duration changes playback only, never an action's simulation timer. */
  overrideClip(name: string | null, duration?: number, loop = false): void {
    const c = name ? this.clip(name) : undefined;
    this.preview = c ? { name: this.name(name!), speed: duration && duration > 0 ? (c.to-c.from)/duration : 1, loop, t: 0, token: ++this.sequence } : null;
  }
  reset(): void {
    this.ko = false; this.action = this.reaction = this.special = null;
    this.previousState = ''; this.stateT = 0; this.previousHit = 0;
    this.previousAttack = ''; this.result = null;
    this.stateOverride = null;
  }
  update(dt: number, s: Readonly<GoblinAnimationState>): GoblinSample {
    dt = clamp(dt,0,.1); this.clock += dt;
    if (s.alive && !this.previousAlive) this.reset();
    if (!s.alive && this.previousAlive && !s.falling) { this.ko = true; this.stateT = 0; }
    this.previousAlive = s.alive;
    if ((s.hitFlash ?? 0) > this.previousHit + .005 && !this.ko && this.reaction?.t!==0) this.playHitReaction(s.knockback ? 'knockback' : 'body');
    this.previousHit = s.hitFlash ?? 0;
    for (const key of ['action','reaction','special'] as const) {
      const r = this[key]; if (r) { r.t += dt; if (r.t > r.duration) this[key] = null; }
    }
    if (this.preview) {
      const p = this.preview; p.t += dt * p.speed;
      const c = this.clip(p.name)!; const span = c.to - c.from;
      return this.last = { name:p.name, seconds:c.from+(p.loop?p.t%span:Math.min(span,p.t)), blend:.06,
        speed:p.speed, priority:200, loop:p.loop, token:`preview:${p.token}`,contactTime:null,duration:span/p.speed };
    }
    let name = 'goblin.idle', priority = 0, source: Request | null = null, external: GoblinAttack | null = null;
    const result = s.result ?? this.result;
    if (this.ko && !s.falling) { name = 'goblin.ko'; priority = 100; }
    else if (result) { name = `goblin.${result}`; priority = 90; }
    else if (this.reaction) { source = this.reaction; name = source.name; priority = 80; }
    else if (s.knockback || s.stunned) { name = 'goblin.knockback'; priority = 80; }
    else if (s.attack && GOBLIN_MOVES[s.attack.id]) {
      external = s.attack; name = GOBLIN_MOVES[external.id]; priority = external.id==='follow'||external.id==='uAH'?60:40;
    } else if (this.special) { source = this.special; name = source.name; priority = 60; }
    else if (s.ability) { name = this.abilityPose(); priority = 60; }
    else if (this.action) { source = this.action; name = source.name; priority = 40; }
    else if (s.dodge) { name = 'goblin.dodge'; priority = 30; }
    else if (s.dashing) { name = 'goblin.dash'; priority = 25; }
    else if (s.falling || s.grounded===false) { name = (s.vy ?? -1)>0 ? 'goblin.jump' : 'goblin.fall'; priority = 15; }
    else if (s.speedFrac > .12) { name = 'goblin.run'; priority = 10; }
    const charging=priority<=15&&(s.charge??0)>0&&!!this.clip('goblin.frontKick');
    if(charging) { name='goblin.frontKick';priority=20; }
    else if(priority<=15&&this.stateOverride)name=this.stateOverride;
    name=this.name(name);
    // Without a dedicated jump, hold the imported rig's early aerial pose on ascent.
    // Descending starts its fall segment; gameplay still owns the vertical trajectory.
    const holdAirbornePose=!this.clip(name)&&s.grounded===false&&(s.vy??0)>0;
    if(!this.clip(name))name=this.name('goblin.fall');
    if (external) {
      if (external.id!==this.previousAttack || external.elapsed<this.previousAttackT) this.attackToken++;
      this.previousAttack = external.id; this.previousAttackT = external.elapsed;
    } else this.previousAttack = '';
    const token = source ? `${name}:${source.token}` : external ? `${name}:attack${this.attackToken}` : charging?`${name}:charge`:holdAirbornePose?`${name}:ascent`:name;
    if (token !== this.previousState) { this.previousState = token; this.stateT = 0; } else this.stateT += dt;
    const c = this.clip(name)!;
    let seconds: number, duration = source?.duration ?? (name===this.name('goblin.ko')?s.koDuration??c.duration:c.duration);
    const speed = charging?0:name===this.name('goblin.run') ? clamp(.7+s.speedFrac*1.7,.7,2.4) : (c.to-c.from)/duration;
    if (external) { seconds = attackSeconds(c,external); duration = external.startup+external.active+external.recovery; }
    else if (source) {
      const from = source.contactNow ? clamp(c.contact ?? c.from,c.from,c.to) : c.from;
      seconds = from+(c.to-from)*clamp(source.t/source.duration,0,1);
    } else if (charging) seconds=c.from+(clamp(c.contact??c.to,c.from,c.to)-c.from)*clamp(s.charge??0,0,1);
    else if (holdAirbornePose) seconds=c.from;
    else if (c.loop) seconds = c.from+(this.clock*speed)%(c.to-c.from);
    else seconds = c.from+(c.to-c.from)*clamp(this.stateT/duration,0,1);
    return this.last = { name, seconds, speed, duration, priority, loop:c.loop, token,
      blend:priority>=80?.035:priority>=40?.05:priority>=25?.06:.12,
      contactTime:external?external.startup+external.active*.35:source?.contactNow?0:null };
  }
}
