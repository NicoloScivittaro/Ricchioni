/** Lightweight map metadata shared by server, TV and phones. No scene or geometry imports. */
export interface MapOption { id:string; name:string; description:string; color:string; icon:string }
export const BACKROOM_MAPS:readonly MapOption[]=[
  {id:'lobby',name:'LIVELLO 0 · LA HALL',description:'Carta da parati, ronzio e presenze.',color:'#b9c78b',icon:'▦'},
  {id:'garage',name:'LIVELLO 1 · IL PARCHEGGIO',description:'Cemento e buio. Non fare rumore.',color:'#8cb9df',icon:'▤'},
  {id:'tunnels',name:'LIVELLO 2 · LE CALDAIE',description:'Tubi roventi. Resta nella luce.',color:'#e69b64',icon:'◈'}
];
export const GOLF_MAPS:readonly MapOption[]=[
  {id:'dune',name:'LE DUNE DEL CLUB',description:'Media · pista 3D con rampe ondulate e green circolare',color:'#539b66',icon:'⌁'},
  {id:'palme',name:'IL GREEN DELLE PALME',description:'Facile · pista 3D, tre sponde oblique e green circolare',color:'#65ab7a',icon:'⚑'},
  {id:'lungomare',name:'IL LUNGOMARE INFINITO',description:'Facile · prato e corridoio',color:'#74b848',icon:'➜'},
  {id:'scampagnata',name:'LA SCAMPAGNATA',description:'Facile · prato e salite',color:'#8bbf55',icon:'⌁'},
  {id:'giostra',name:'LA GIOSTRA DEI DANNATI',description:'Media · bracci e cancelli',color:'#35b9ad',icon:'✦'},
  {id:'flipperone',name:'IL FLIPPERONE',description:'Media · bumper e montagne',color:'#707fcb',icon:'◆'},
  {id:'traversata',name:'LA TRAVERSATA',description:'Media · cancelli e ponte',color:'#58a8c0',icon:'▰'},
  {id:'altalena',name:'SU E GIÙ PER LA ROTONDA',description:'Media · salite e rotonda',color:'#c09b62',icon:'⌁'},
  {id:'maratona',name:'LA MARATONA DEL DISAGIO',description:'Media · tre sezioni larghe',color:'#42bd82',icon:'➜'},
  {id:'inferno',name:'IL GIRO DELL’INFERNO',description:'Difficile · discesa e serpentina',color:'#9981c5',icon:'◈'},
  {id:'odissea',name:'L’ODISSEA',description:'Difficile · flipper e discesa',color:'#b299ce',icon:'◆'},
  {id:'disperati',name:'IL PERCORSO DEI DISPERATI',description:'Difficile · ponte e serpentina',color:'#52bfa3',icon:'▰'}
];
export const FPS_MAPS:readonly MapOption[]=[
  {id:'cantiere',name:'CANTIERE DEL DISAGIO',description:'2–5 giocatori · container e coperture.',color:'#ddaa55',icon:'▤'},
  {id:'nuketown',name:'NUKETOWN',description:'2–5 giocatori · case, cortili e veicoli.',color:'#65b4dd',icon:'⌂'},
  {id:'terminal',name:'TERMINAL',description:'2–5 giocatori · aeroporto, corridoi e aereo.',color:'#c9b784',icon:'✈'}
];
export const CORNICIONE_MAPS:readonly MapOption[]=[
  {id:'tetto',name:'TETTO DEL DISAGIO',description:'Tramonto in città · tre ponteggi e recuperi sul muro.',color:'#efb582',icon:'⌂'},
  {id:'darsena',name:'DARSENA DEGLI SCHIAFFI',description:'Mare, moli e passerelle larghe · combattimento ravvicinato.',color:'#7cc6cf',icon:'⚓'},
  {id:'cantiere',name:'CANTIERE IN QUOTA',description:'Travi, gru e piattaforme alte · duelli verticali.',color:'#e7b85e',icon:'▤'}
];
const KART_MAPS:readonly MapOption[]=[
  {id:'litorale',name:'CIRCUITO DEL LITORALE',description:'Curve, rampe e derapate sul mare.',color:'#ffbf69',icon:'⌁'},
  {id:'arcobaleno',name:'STRADA ARCOBALENO',description:'Pista sospesa e passaggi in planata.',color:'#74e7e0',icon:'✦'},
  {id:'sydney',name:'SYDNEY SPRINT',description:'Città, Harbour Bridge e volo dall’Opera House.',color:'#62c9ff',icon:'⌁'},
  {id:'primo',name:'PRIMO KARTING',description:'Tornanti, staccate e derapate tra le barriere.',color:'#ffcc55',icon:'⚑'}
];
export const mapsFor=(minigameId:string):readonly MapOption[]=>
  minigameId==='cornicione'?CORNICIONE_MAPS:minigameId==='fps'?FPS_MAPS:minigameId==='kart3d'?KART_MAPS:minigameId==='backrooms'?BACKROOM_MAPS:minigameId==='minigolf'?GOLF_MAPS:[];
export const mapById=(game:string,id:unknown):MapOption|undefined=>mapsFor(game).find(m=>m.id===id);
export interface MapVoteState {
  roundId:number;
  options:MapOption[];
  /** Stable human identities; bots abstain. Votes can change until the deadline. */
  eligible:string[];
  votes:Record<string,string>;
  endsAt:number;
  /** Server clock at snapshot time: phones may have a different wall clock. */
  serverNow:number;
}
