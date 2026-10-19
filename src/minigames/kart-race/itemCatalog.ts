import type { ItemId, KartState } from './raceTypes';
import type { Rng } from '../../../shared/rng';
/** Fonte unica per HUD, telefono e distribuzione. Pesi [primo, centro, ultimo]: nessun item garantito. */
export const ITEM_POWER = {
  turbo:{power:28,time:2},super_turbo:{power:48,time:3.8},faulty:{power:52,time:3.4},
  shield:{perfect:.8,counterPower:28,counterTime:1.2},
  sphereStun:1.4,oilTime:2.2,birdStun:.45,birdOil:1.3,bumpOil:1.2,bumpJump:4.2,
  magnet:{time:4,range:36,breakRange:44,power:34},bumperTime:6.5,springJump:7.2,
  missile:{range:90,warning:.8,speed:82,life:4,stun:1.4},theft:{range:14,warning:.7}
} as const;
export const KART_ITEMS: Record<ItemId, { icon: string; name: string; description: string; weights: [number,number,number] }> = {
  turbo:{icon:'🔥',name:'TURBO',description:'Scatto +21% per 2 s: utile per completare un sorpasso.',weights:[2,2.8,4]},
  super_turbo:{icon:'💫',name:'SUPER TURBO',description:'Scatto raro +36% per 3,8 s. Rallenta prima delle curve.',weights:[.22,.9,2.8]},
  sfera:{icon:'🔴',name:"SFERA D’URTO",description:'Proiettile frontale: interrompe il turbo e rallenta. Schivalo, salta o usa lo scudo.',weights:[.8,1.8,2]},
  olio:{icon:'🛢️',name:'OLIO',description:'Chiazza per 18 s: cancella il turbo e riduce il grip per 2,2 s. Salta o passa fuori.',weights:[2,1.4,.8]},
  scudo:{icon:'🛡️',name:'SCUDO',description:'Blocca un attacco. Entro 0,8 s dall’attivazione: parata perfetta e contro-turbo di 1,2 s.',weights:[3,2,1.5]},
  disturbo:{icon:'⚡',name:'DISTURBO',description:'Interrompe il turbo e inverte lo sterzo per 1,6 s. Solo un rivale davanti entro 45 m sullo stesso tratto.',weights:[.8,1.3,1.3]},
  calamita:{icon:'🧲',name:'CALAMITA INFAME',description:'Scia potente per 4 s verso un rivale entro 36 m. Si spezza oltre 44 m, fuori corsia, in salto o dopo un urto.',weights:[.25,1.4,2.2]},
  piccione:{icon:'🐦',name:'PICCIONE KAMIKAZE',description:'Vola dritto: breve impatto, turbo interrotto e grip perso per 1,3 s. Si può schivare o parare.',weights:[1.1,1.7,1.5]},
  turbo_difettoso:{icon:'🚀',name:'TURBO DIFETTOSO',description:'Scatto +39% per 3,4 s, ma sterzo al 68%: rischio forte nelle curve.',weights:[.25,.75,1.8]},
  buca:{icon:'🕳️',name:'BUCA DEL COMUNE',description:'Trappola per 12 s: sobbalzo, turbo interrotto e grip ridotto per 1,2 s. Salta o aggirala.',weights:[1.5,1.2,.7]},
  raffica:{icon:'🌬️',name:'RAFFICA LATERALE',description:'Vento per 7 s: spinta limitata, turbo interrotto al primo impatto. Frecce, sterzo e scudo permettono di reagire.',weights:[1.2,1,.6]},
  paraurti:{icon:'🚧',name:'PARAURTI ABUSIVO',description:'Per 6,5 s resisti meglio agli urti e spingi più forte. Sterzo al 90%. Non ferma i proiettili.',weights:[1.3,1.2,.9]},
  mollone:{icon:'🌀',name:'MOLLONE',description:'Salto per evitare trappole; all’atterraggio ricevi un mini-turbo di 1,1 s.',weights:[1,1.1,1]},
  missile:{icon:'🎯',name:'MISSILE VENDETTA',description:'Insegue un rivale davanti entro 90 m: preavviso di 0,8 s. Scudo, parata o uscita dal corridoio possono salvarlo.',weights:[.12,.55,1.2]},
  furto:{icon:'🦹',name:'FURTO DEL SECOLO',description:'Ruba un oggetto non usato entro 14 m. Il bersaglio ha 0,7 s per usarlo, difendersi o allontanarsi. Non ruba abilità.',weights:[.25,.7,.9]}
};
export const ITEM_IDS = Object.keys(KART_ITEMS) as ItemId[];
/** Rank gives a small bias in a close pack; a real time deficit strengthens it. Never touches kart speed. */
export function kartItemWeights(place:number,count:number,gapSeconds=0):{item:ItemId;weight:number}[] {
  const rank=count<=1?.5:Math.max(0,Math.min(1,(place-1)/(count-1)));
  const deficit=Number.isFinite(gapSeconds)?Math.max(0,Math.min(1,(gapSeconds-2)/18)):0;
  const t=rank*(.25+.75*deficit);
  return ITEM_IDS.map(item=>{const w=KART_ITEMS[item].weights;return {item,weight:t<.5?w[0]+(w[1]-w[0])*t*2:w[1]+(w[2]-w[1])*(t-.5)*2};});
}
export function pickKartItem(rng:Rng,place:number,count:number,gapSeconds=0):ItemId {
  return rng.weighted(kartItemWeights(place,count,gapSeconds));
}
export function activeItemLabel(k: KartState): string {
  if(k.magnetTimer>0)return `🧲 TRAZIONE ${k.magnetTimer.toFixed(1)}s`;
  if(k.faultyTimer>0)return `🚀 DIFETTOSO ${k.faultyTimer.toFixed(1)}s`;
  if(k.bumperTimer>0)return `🚧 PARAURTI ${k.bumperTimer.toFixed(1)}s`;
  if(k.flight==='GLIDE')return 'PLANATA';
  if(k.flight==='FALL')return 'RECUPERO';
  if(k.jumpHeight>.05)return '🌀 IN VOLO';
  if(k.oilTimer>0)return `🛢️ SLITTA ${k.oilTimer.toFixed(1)}s`;
  return '—';
}
