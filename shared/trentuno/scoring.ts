import { CARDS, SUITS } from './deck';
export function handScore(hand:readonly string[]):number {
  const sums=Object.fromEntries(SUITS.map(s=>[s,0]));
  for(const id of hand){const c=CARDS[id];if(!c)throw Error(`Carta inesistente ${id}`);sums[c.suit]+=c.value;}
  return Math.max(...Object.values(sums));
}
export function bestDiscard(hand:readonly string[],forbidden:string|null=null):string {
  const legal=hand.filter(id=>id!==forbidden);
  return legal.sort((a,b)=>handScore(hand.filter(id=>id!==b))-handScore(hand.filter(id=>id!==a))||CARDS[a].value-CARDS[b].value||a.localeCompare(b))[0];
}
