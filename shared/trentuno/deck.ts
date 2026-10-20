export const SUITS = ['DENARI','COPPE','SPADE','BASTONI'] as const;
export const RANKS = ['A','2','3','4','5','6','7','F','C','R'] as const;
export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export interface Card { id:string; suit:Suit; rank:Rank; value:number; name:string }
export const SUIT_CHARACTER = {DENARI:'goblin',COPPE:'ciro',SPADE:'buttafuori',BASTONI:'judoka'} as const;
export const SUIT_DISPLAY={DENARI:{name:'denari',color:'#99651d'},COPPE:{name:'coppe',color:'#a23846'},SPADE:{name:'spade',color:'#254d68'},BASTONI:{name:'bastoni',color:'#47623a'}} as const;
export const RANK_DISPLAY:Record<Rank,string>={A:'A','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7',F:'F',C:'C',R:'R'};
const names:Record<Rank,string>={A:'Asso','2':'Due','3':'Tre','4':'Quattro','5':'Cinque','6':'Sei','7':'Sette',F:'Fante',C:'Cavallo',R:'Re'};
export const DECK:readonly Card[]=SUITS.flatMap(suit=>RANKS.map(rank=>({id:`${suit}-${rank}`,suit,rank,value:rank==='A'?11:['F','C','R'].includes(rank)?10:Number(rank),name:`${names[rank]} di ${SUIT_DISPLAY[suit].name}`})));
export const CARDS:Record<string,Card>=Object.fromEntries(DECK.map(c=>[c.id,c]));
export const cardAsset=(id:string):string=>`/trentuno/${id}.svg`;
export const BACK_ASSET='/trentuno/back.svg';
