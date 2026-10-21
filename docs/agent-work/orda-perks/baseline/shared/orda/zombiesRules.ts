export const ZOMBIES={killPoints:50,boxCost:950,maxHits:3,hitGrace:.65,rollSeconds:2.5,claimSeconds:10,closeSeconds:1,interactRange:2.4} as const;
export const MYSTERY_BOX={x:0,z:3.8,y:0,w:2.2,d:.55,h:.64} as const;
export function healthFromHits(hits:number):number{return Math.max(0,100*(ZOMBIES.maxHits-hits)/ZOMBIES.maxHits);}
export function mysteryPrompt(s:OrdaState,p:Survivor):string{
 if(!p.alive||s.phase==='finished'||Math.hypot(p.x-MYSTERY_BOX.x,p.z-MYSTERY_BOX.z)>ZOMBIES.interactRange||Math.abs(p.y-MYSTERY_BOX.y)>.75)return '';
 const b=s.box,owner=s.players.find(p=>p.id===b.owner)?.name??'';
 if(b.phase==='idle')return p.points>=ZOMBIES.boxCost?'CASSA · 950 PUNTI\nPREMI QUADRATO / X · COMPRA':`CASSA · 950 PUNTI\nTI MANCANO ${ZOMBIES.boxCost-p.points} PUNTI`;
 if(b.phase==='rolling')return b.owner===p.id?`ESTRAZIONE…\n${WEAPONS[Math.floor((s.time-b.started)*8)%WEAPONS.length].name}`:`CASSA OCCUPATA · ${owner}`;
 if(b.phase==='ready')return b.owner===p.id?`${getWeapon(b.weapon!).name}\nQUADRATO / X · RITIRA · ${Math.max(0,Math.ceil(b.until-s.time))}s`:`ARMA RISERVATA A ${owner}`;
 return 'CASSA IN CHIUSURA…';
}
import type {OrdaState,Survivor}from './types';
import {getWeapon,WEAPONS}from '../fpsWeapons';
