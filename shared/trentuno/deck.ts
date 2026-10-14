export const SUITS = ['DENARI','COPPE','SPADE','BASTONI'] as const;
export const RANKS = ['A','2','3','4','5','6','7','F','C','R'] as const;
export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export interface Card { id:string; suit:Suit; rank:Rank; value:number; name:string }
export const SUIT_CHARACTER = {DENARI:'goblin',COPPE:'ciro',SPADE:'buttafuori',BASTONI:'judoka'} as const;
const names:Record<Rank,string>={A:'Asso','2':'Due','3':'Tre','4':'Quattro','5':'Cinque','6':'Sei','7':'Sette',F:'Fante',C:'Cavallo',R:'Re'};
export const DECK:readonly Card[]=SUITS.flatMap(suit=>RANKS.map(rank=>({id:`${suit}-${rank}`,suit,rank,value:rank==='A'?11:['F','C','R'].includes(rank)?10:Number(rank),name:`${names[rank]} di ${suit.toLowerCase()}`})));
export const CARDS:Record<string,Card>=Object.fromEntries(DECK.map(c=>[c.id,c]));
export const cardAsset=(id:string):string=>`/trentuno/${id}.svg`;
export const BACK_ASSET='/trentuno/back.svg';
