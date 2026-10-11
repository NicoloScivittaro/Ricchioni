import type { ItemId, KartState } from './raceTypes';
import type { Rng } from '../../../shared/rng';
/** Fonte unica per HUD, telefono e distribuzione. Pesi [primo, centro, ultimo]: nessun item garantito. */
export const KART_ITEMS: Record<ItemId, { icon: string; name: string; description: string; weights: [number,number,number] }> = {
  turbo:{icon:'🔥',name:'TURBO',description:'Accelerazione immediata per 1,1 s.',weights:[2,2.4,2.6]},
  super_turbo:{icon:'💫',name:'SUPER TURBO',description:'Boost raro per 2,4 s: sterzo normale, attento alle curve.',weights:[.15,.3,.6]},
  sfera:{icon:'🔴',name:"SFERA D'URTO",description:'Proiettile frontale, massimo 3,5 s. Schivalo di lato, salta o usa lo scudo.',weights:[.6,1.6,2]},
  olio:{icon:'🛢️',name:'OLIO',description:'Chiazza per 18 s: grip laterale ridotto per 1,6 s. Evitala, salta o usa lo scudo.',weights:[1.3,1.4,1]},
  scudo:{icon:'🛡️',name:'SCUDO',description:'Assorbe il prossimo oggetto ostile; consumato al contatto.',weights:[3,1.8,1.4]},
  disturbo:{icon:'⚡',name:'DISTURBO',description:'Inverte per 2,6 s lo sterzo di chi hai davanti. Lo scudo protegge.',weights:[1.2,1.2,1]},
  calamita:{icon:'🧲',name:'CALAMITA INFAME',description:'Trazione per 3 s sul kart davanti entro 24 m. Si spezza oltre 30 m, fuori corsia, in salto o dopo uno schianto. Devi sterzare.',weights:[.3,1,1.6]},
  piccione:{icon:'🐦',name:'PICCIONE KAMIKAZE',description:'Vola davanti per 3 s senza inseguire. Contatto: grip perso per 0,85 s. Schivalo, salta o usa lo scudo.',weights:[1.2,1.4,1.2]},
  turbo_difettoso:{icon:'🚀',name:'TURBO DIFETTOSO',description:'Boost forte per 1,8 s ma sterzo al 58%: usalo sui rettilinei.',weights:[.3,.5,.8]},
  buca:{icon:'🕳️',name:'BUCA DEL COMUNE',description:'Buca visibile per 12 s. Piccolo sobbalzo e grip perso per 0,7 s: salta o passa di lato.',weights:[1.3,1.2,.8]},
  raffica:{icon:'🌬️',name:'RAFFICA LATERALE',description:'Zona di vento per 7 s; frecce mostrano la direzione. Compensa sterzando o passa fuori.',weights:[1.1,1,.8]},
  paraurti:{icon:'🚧',name:'PARAURTI ABUSIVO',description:'Per 5 s resisti agli urti e trasferisci più impulso. Sterzo al 85%. Non ferma i proiettili.',weights:[1.2,1.1,1]},
  mollone:{icon:'🌀',name:'MOLLONE',description:'Un salto di circa 0,9 s evita gli ostacoli a terra. Atterra dritto per conservare aderenza.',weights:[1.1,1.2,1.1]}
};
export const ITEM_IDS = Object.keys(KART_ITEMS) as ItemId[];
export function pickKartItem(rng: Rng, place:number, count:number): ItemId {
  const t = count<=1 ? .5 : Math.max(0,Math.min(1,(place-1)/(count-1)));
  return rng.weighted(ITEM_IDS.map(item=>{const w=KART_ITEMS[item].weights;return {item,weight:t<.5?w[0]+(w[1]-w[0])*t*2:w[1]+(w[2]-w[1])*(t-.5)*2};}));
}
export function activeItemLabel(k: KartState): string {
  if(k.magnetTimer>0)return `🧲 TRAZIONE ${k.magnetTimer.toFixed(1)}s`;
  if(k.faultyTimer>0)return `🚀 DIFETTOSO ${k.faultyTimer.toFixed(1)}s`;
  if(k.bumperTimer>0)return `🚧 PARAURTI ${k.bumperTimer.toFixed(1)}s`;
  if(k.jumpHeight>.05)return '🌀 IN VOLO';
  if(k.oilTimer>0)return `🛢️ SLITTA ${k.oilTimer.toFixed(1)}s`;
  return '—';
}
