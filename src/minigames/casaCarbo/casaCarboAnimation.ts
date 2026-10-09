import { CC } from './ccTuning';
import type { CCPlayer } from './ccTypes';
import goblinClips from '../characters/goblinClips.json';
import boschiClips from '../characters/buttafuoriClips.json';
import carboClips from '../characters/judokaClips.json';
import ciroClips from '../characters/ciroClips.json';

const profiles = { goblin: goblinClips, buttafuori: boschiClips, judoka: carboClips, ciro: ciroClips };
export type CasaCarboCharacter = keyof typeof profiles;
export function hasCasaCarboAnimations(id:string|null):id is CasaCarboCharacter {
  return id!==null && Object.prototype.hasOwnProperty.call(profiles,id);
}
export interface CasaCarboClip { name: string; duration?: number; loop: boolean }

/** Reads simulation state. Cosmetic timers cannot lock movement, inputs or ability effects. */
export class CasaCarboAnimation {
  private emptyT=0;
  private riseT=0;
  private barrierT=0;
  private abilityT=0;
  private wasSlipping=false;
  private readonly names:Set<string>;
  constructor(private readonly character:CasaCarboCharacter) {
    this.names=new Set(profiles[character].map(c=>c.name));
  }
  private clip(name:string,loop=false,duration?:number):CasaCarboClip|null {
    name=`${this.character}.${name}`;
    return this.names.has(name)?{name,duration,loop}:null;
  }
  emptyBucket():void { this.emptyT=.55; }
  buildBarrier():void { if(this.character==='judoka') this.barrierT=1; }
  showExistingAbility(duration:number):void { this.abilityT=duration; }
  update(dt:number,p:Readonly<CCPlayer>):CasaCarboClip|null {
    this.emptyT=Math.max(0,this.emptyT-dt);
    this.riseT=Math.max(0,this.riseT-dt);
    this.barrierT=Math.max(0,this.barrierT-dt);
    this.abilityT=Math.max(0,this.abilityT-dt);
    if(p.slipT>0) {
      this.wasSlipping=true; this.riseT=0; this.emptyT=0; this.barrierT=0; this.abilityT=0;
      // fallBackward ends on the floor, matching getUp; the alternate slip already recovers to standing.
      return this.clip('fallBackward',false,CC.slipTime);
    }
    if(this.wasSlipping) { this.wasSlipping=false; this.riseT=.4; }
    if(p.dashT>0) { this.riseT=0; this.emptyT=0; this.barrierT=0; this.abilityT=0; return null; }
    if(this.abilityT>0 || (this.character==='goblin' && p.ab.windupT>0)) return null;
    if(this.character==='buttafuori' && p.ab.blockT>0) return this.clip('floodBlock',true);
    if(this.barrierT>0) return this.clip('floodBarrier',false,1);
    if(this.emptyT>0) return this.clip('bucketEmpty',false,.55);
    if(this.riseT>0) return this.clip('getUp',false,.4);
    if(p.containing) return this.clip('floodBlock',true) ?? this.clip('block',true);
    if(p.scooping) return this.clip('scoopB',true);
    if(p.squeegee) return this.clip('squeegee',true);
    if(p.bucket>.05 && Math.hypot(p.vx,p.vy)>5) return this.clip('bucketWalk',true);
    return null;
  }
}
