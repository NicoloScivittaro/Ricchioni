import type{OrdaState,Survivor}from'./types';
import {survivorWeapon}from'./weapons';
export type PerkId='juggernog'|'speedcola'|'doubletap';
export const PERKS:Record<PerkId,{name:string;price:number;effect:string;color:string}>={
 juggernog:{name:'JUGGER-NOG',price:2500,effect:'RESISTI A 5 COLPI',color:'#e27778'},
 speedcola:{name:'SPEED COLA',price:3000,effect:'RICARICA IN METÀ TEMPO',color:'#8fdda2'},
 doubletap:{name:'DOUBLE TAP 2.0',price:2000,effect:'CADENZA +33% · DUE PROIETTILI',color:'#edbf6f'}
};
export const STATIONS=[
 {id:'juggernog',x:-18.8,z:-6,w:.85,d:.85,h:2.2,rotation:Math.PI/2},
 {id:'speedcola',x:18.7,z:6,w:1.15,d:.9,h:2.2,rotation:-Math.PI/2},
 {id:'doubletap',x:-5.7,z:15,w:1.22,d:.75,h:2.15,rotation:Math.PI},
 {id:'pap',x:5.5,z:15,w:1.8,d:1.1,h:1.9,rotation:Math.PI}
]as const;
export type Station=typeof STATIONS[number];
export const PAP={price:5000,workSeconds:5,claimSeconds:10,range:2.4}as const;
export function maxHits(p:Survivor):number{return p.perks.includes('juggernog')?5:3;}
export function playerHealth(p:Survivor):number{return Math.max(0,100*(maxHits(p)-p.hitsTaken)/maxHits(p));}
export function deposited(s:OrdaState,p:Survivor):boolean{return s.pap.owner===p.id&&s.pap.phase!=='idle';}
export function stationPrompt(s:OrdaState,p:Survivor,t:Station):string{
 if(p.drinking)return `BEVI ${PERKS[p.drinking.id].name}…`;
 if(t.id!=='pap'){const perk=PERKS[t.id];return p.perks.includes(t.id)?`${perk.name} · GIÀ ATTIVO`:`${perk.name} · ${perk.price} PUNTI\n${perk.effect}\n${p.points>=perk.price?'QUADRATO / X · BEVI':`TI MANCANO ${perk.price-p.points} PUNTI`}`;}
 const b=s.pap;
 if(b.phase==='working')return b.owner===p.id?`PACK-A-PUNCH · POTENZIAMENTO ${Math.ceil(b.until-s.time)}s`:'PACK-A-PUNCH · OCCUPATO';
 if(b.phase==='ready')return b.owner===p.id?`ARMA POTENZIATA · ${Math.ceil(b.until-s.time)}s\nQUADRATO / X · RITIRA`:'ARMA RISERVATA AL PROPRIETARIO';
 if(p.packed)return 'PACK-A-PUNCH · ARMA GIÀ POTENZIATA';
 return `PACK-A-PUNCH · ${PAP.price} PUNTI\n${survivorWeapon(p).name}\n${p.points>=PAP.price?'QUADRATO / X · DEPOSITA':`TI MANCANO ${PAP.price-p.points} PUNTI`}`;
}
