import type{AttackSpec,WeaponDef,WeaponId,Action}from'./types';
const strike=(style:AttackSpec['style'],damage:number,wind:number,active:number,recover:number,cost:number,reach:number,width=.15):AttackSpec=>({style,damage,wind,active,recover,cost,reach,width});
export const FERRO_RULES={rounds:3,roundSeconds:90,selectionSeconds:18,countdownSeconds:3,health:100,stamina:100,regen:24,parryWindow:.13,dodgeCost:22,dodgeSeconds:.36,placementPoints:12,winPoints:12,killPoints:2,arrowGravity:9.8,arenaRadius:16}as const;
export const WEAPONS:readonly WeaponDef[]=[
 {id:'sword',name:'SPADA',title:'IL DUELLANTE',color:'#a9d8ef',description:'Equilibrio, combo a tre colpi e contrattacco dopo un parry.',speed:4,defence:.68,mobility:1,length:1.62,specialName:'CONTRATTACCO',specialHint:'Dopo una parata perfetta: affondo rapido.',cooldown:7,light:strike('slash',19,.15,.15,.21,7,2.25),heavy:strike('overhead',34,.40,.18,.48,23,2.4),special:strike('thrust',30,.06,.13,.27,14,2.65)},
 {id:'spear',name:'LANCIA',title:'IL PREDATORE',color:'#d8bc83',description:'Affondi lunghi e stretti. Sotto la punta il danno cala.',speed:3,defence:.48,mobility:.97,length:2.6,specialName:'CARICA',specialHint:'Affondo in corsa: preparazione visibile e recupero.',cooldown:8,light:strike('thrust',24,.22,.15,.28,8,3.35,.12),heavy:strike('thrust',39,.44,.18,.57,24,3.8,.16),special:{...strike('thrust',30,.32,.23,.64,27,3.6,.17),dash:7}},
 {id:'bow',name:'ARCO',title:'OCCHIO DI FALCO',color:'#9fc7a4',description:'Tieni RT per tendere, rilascia per scoccare. Dieci frecce, recupero graduale.',speed:3,defence:.20,mobility:1,length:1.55,specialName:'FRECCIA PERFORANTE',specialHint:'La prossima freccia supera difese parziali e tre bersagli.',cooldown:12,light:strike('thrust',9,.15,.10,.20,5,1.2),heavy:strike('bash',13,.22,.12,.33,10,1.4),special:strike('thrust',0,0,0,.1,15,35)},
 {id:'axe',name:'ASCIA',title:'LA FURIA',color:'#ebaa81',description:'Fendenti larghi, guardia leggera. Il colpo rotante punisce gli accerchiamenti.',speed:2,defence:.36,mobility:.96,length:1.75,specialName:'COLPO ROTANTE',specialHint:'Un giro completo con un impatto per avversario.',cooldown:10,light:strike('slash',24,.26,.19,.34,10,2.45,.22),heavy:strike('overhead',42,.54,.18,.66,29,2.55,.26),special:strike('spin',32,.52,.34,.62,30,2.65,.24)},
 {id:'hammer',name:'MARTELLO',title:'IL COLOSSO',color:'#d0a9df',description:'Potente e leggibile. Un colpo mancato lascia il fianco scoperto.',speed:1,defence:.40,mobility:.87,length:1.85,specialName:'ONDA D’URTO',specialHint:'Colpo al suolo, sbilancia i vicini senza attraversare colonne.',cooldown:11,light:strike('overhead',34,.37,.16,.49,12,2.4,.33),heavy:strike('overhead',59,.74,.18,.84,34,2.65,.4),special:strike('wave',20,.72,.22,.74,32,3.5,.3)},
 {id:'blades',name:'DOPPIE LAME',title:'L’OMBRA',color:'#e6a0b8',description:'Due mani, colpi rapidi e portata corta. Entra, colpisci, schiva.',speed:5,defence:.28,mobility:1.12,length:1.05,specialName:'ASSALTO RAPIDO',specialHint:'Scatto e due fendenti. Un colpo per finestra, nessun teletrasporto.',cooldown:8,light:strike('slash',12,.09,.11,.13,5,1.65,.15),heavy:{...strike('double',16,.19,.27,.34,18,1.8,.16),windows:[[0,.09],[.17,.27]]},special:{...strike('double',14,.13,.29,.39,25,1.85,.17),windows:[[0,.10],[.19,.29]],dash:8}},
 {id:'shield',name:'SPADA E SCUDO',title:'IL BASTIONE',color:'#8ecdc8',description:'Blocca frontalmente. Nessuna protezione alle spalle e stamina limitata.',speed:3,defence:.94,mobility:.96,length:1.5,specialName:'COLPO DI SCUDO',specialHint:'Spinta corta con interruzione breve, mai uno stunlock.',cooldown:8,light:strike('slash',21,.19,.15,.26,7,2.05),heavy:strike('overhead',35,.43,.17,.52,24,2.2),special:strike('bash',14,.23,.13,.42,20,1.6,.38)}
];
export const weapon=(id:WeaponId):WeaponDef=>WEAPONS.find(w=>w.id===id)??WEAPONS[0];
export const attackSpec=(id:WeaponId,a:Action):AttackSpec=>weapon(id)[a.kind];
export const attackLength=(s:AttackSpec)=>s.wind+s.active+s.recover;
export function activeWindow(s:AttackSpec,age:number):number{const t=age-s.wind;if(t<0||t>s.active)return-1;if(s.windows)return s.windows.findIndex(([a,b])=>t>=a&&t<=b);return 0;}
/** Presentation heft of each weapon family for contact reactions and sounds. Not a stat: damage, timing and defence live above. */
export const HEFT:Readonly<Record<WeaponId,number>>={blades:.55,bow:.5,sword:.75,shield:.75,spear:.8,axe:1.05,hammer:1.3};
/** Cosmetic model choices (Y / △ in the weapon selection). Identical statistics within a weapon. */
export const COSMETIC_VARIANTS:Readonly<Partial<Record<WeaponId,number>>>={sword:4,shield:2,axe:3};
export const variantCount=(id:WeaponId)=>COSMETIC_VARIANTS[id]??1;
/** Ferro 2.2 identity: how each weapon behaves in a guard exchange, on top of its own numbers.
 * guardCost: stamina its owner pays to block (×). pressure: stamina it drains from a blocker (×).
 * parry: size of its owner's parry window (×0.13 s). parried: how long its owner is stunned when parried (×0.27 s). */
export interface WeaponTraits{guardCost:number;pressure:number;parry:number;parried:number;strength:string;weakness:string}
export const TRAITS:Readonly<Record<WeaponId,WeaponTraits>>={
 sword:{guardCost:.9,pressure:1,parry:1.2,parried:1,strength:'Parry più generoso: sa rispondere a tutto',weakness:'Nessun punto forte nel danno, nella portata o nella pressione'},
 spear:{guardCost:1.1,pressure:.85,parry:.9,parried:1.1,strength:'Portata: colpisce prima di essere colpito',weakness:'Da vicino perde forza e la parata è fragile'},
 bow:{guardCost:1,pressure:1,parry:1,parried:1,strength:'Colpisce da lontano senza rischi',weakness:'Non para e da vicino è debole'},
 axe:{guardCost:1.25,pressure:1.25,parry:.85,parried:1.15,strength:'Danno alto e guardie che si consumano',weakness:'Lenta, poca difesa, parata stretta'},
 hammer:{guardCost:1.3,pressure:1.5,parry:.8,parried:1.2,strength:'Spacca le guardie: ogni colpo parato costa caro',weakness:'Lentissimo e punito dal parry; fianco scoperto se manca'},
 blades:{guardCost:1.4,pressure:.65,parry:1.1,parried:.8,strength:'Velocità e pressione continua, si riprende subito da un parry',weakness:'Danno basso, poca portata, guardia che finisce presto'},
 shield:{guardCost:.55,pressure:.9,parry:.8,parried:.8,strength:'Guardia quasi inesauribile, il miglior bastione',weakness:'Poco danno, lento e senza protezione alle spalle'}
};
