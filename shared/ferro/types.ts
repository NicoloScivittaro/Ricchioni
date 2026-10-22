export type WeaponId='sword'|'spear'|'bow'|'axe'|'hammer'|'blades'|'shield';
export type GuardDirection='top'|'left'|'right';
export type ArenaId='colosseum'|'hell'|'geonosis';
export type Phase='selection'|'countdown'|'fight'|'roundEnd'|'finished';
export type Style='slash'|'thrust'|'overhead'|'spin'|'double'|'wave'|'bash';
export interface V3{x:number;y:number;z:number}
export interface AttackSpec{wind:number;active:number;recover:number;damage:number;cost:number;reach:number;width:number;style:Style;windows?:[number,number][];dash?:number}
export interface WeaponDef{id:WeaponId;name:string;title:string;color:string;description:string;speed:number;defence:number;mobility:number;length:number;specialName:string;specialHint:string;cooldown:number;light:AttackSpec;heavy:AttackSpec;special:AttackSpec}
export interface Action{kind:'light'|'heavy'|'special';age:number;combo:number;yaw:number;hits:string[];serial:number;direction?:GuardDirection;from?:{right:{grip:V3;tip:V3};left:{grip:V3;tip:V3}};blocked?:{age:number;window:number}}
/** Presentation of a resolved contact. Written only by the combat logic; renderers read it, never the reverse. */
export type ClashKind='block'|'blocked'|'parry'|'parried'|'hurt'|'break';
export interface Clash{kind:ClashKind;age:number;time:number;dir:GuardDirection;side:number;power:number;other:WeaponId;heavy:boolean;nudge:V3}
export interface Warrior{ guardDirection:GuardDirection; clash:Clash|null; target:string|null; variant:number; deflect:number; regenAt:number; wasGuard:boolean; feint:number; feintAction:Action|null; breakAge:number; breakTarget:string|null; counterUntil:number; resistance:number; pressure:number; attackers:{id:string;time:number}[]; bowPhase:"idle"|"load"|"hold"|"release"|"recovery"; bowAge:number; bowStrength:number; bowFired:boolean;  id:string;name:string;color:string;characterId:string|null;bot:boolean;x:number;y:number;z:number;vx:number;vz:number;vy:number;yaw:number;pitch:number;hp:number;stamina:number;alive:boolean;weapon:WeaponId;ready:boolean;eligible:boolean;points:number;kills:number;roundKills:number;roundPlace:number;damage:number;action:Action|null;combo:number;comboUntil:number;cooldown:number;specialCd:number;riposte:number;guard:boolean;guardAt:number;guardReadyAt:number;guardFatigue:number;stun:number;lastStun:number;hurt:number;dodge:number;dodgeX:number;dodgeZ:number;dodgeCd:number;charge:number;piercing:boolean;arrows:number;arrowRegen:number;deadAt:number;lastSource:string|null;lastHit:number;last:FerroEdges;wasLight:boolean;navTime:number;navRepeat:number;}
export interface FerroEdges{light:number;heavy:number;dodge:number;special:number;jump:number;feint:number;guardBreak:number;target:number;cosmetic:number;prev:number;next:number;choices:number[]}
export interface Command{mx:number;my:number;lx:number;ly:number;look?:{yaw:number;pitch:number};light:boolean;guard:boolean;sprint:boolean;guardDirection?:GuardDirection;edges:FerroEdges;cancel?:boolean}
export interface Arrow extends V3{id:number;owner:string;vx:number;vy:number;vz:number;damage:number;life:number;stuck:boolean;piercing:boolean;hit:string[]}
export interface RoundScore{id:string;place:number;kills:number;points:number}
export interface RoundResult{round:number;winner:string;scores:RoundScore[]}
export interface FerroEvent{kind:'attack'|'special'|'parry'|'block'|'break'|'hit'|'arrow'|'arrowImpact'|'elimination'|'round'|'win'|'hazard'|'feint'|'guardBreak'|'counter'|'resistance';player?:string;target?:string;weapon?:WeaponId;x?:number;y?:number;z?:number;value?:number;text?:string;dir?:GuardDirection;heavy?:boolean}
export interface FerroState{mapId:ArenaId;phase:Phase;time:number;phaseLeft:number;round:number;fightTime:number;roundSeconds:number;warriors:Warrior[];arrows:Arrow[];history:RoundResult[];winner:string|null;roundWinner:string|null;duel:'none'|'round'|'final';contenders:string[];ringRadius:number;flame:'off'|'warning'|'active';flameAge:number;notice:string;selectionToken:number}
export interface FerroPacket{type:'ferroState';roundId:number;state:FerroState}
export const emptyEdges=():FerroEdges=>({light:0,heavy:0,dodge:0,special:0,jump:0,feint:0,guardBreak:0,target:0,cosmetic:0,prev:0,next:0,choices:Array(7).fill(0)});
export const emptyCommand=():Command=>({mx:0,my:0,lx:0,ly:0,light:false,guard:false,sprint:false,edges:emptyEdges()});
