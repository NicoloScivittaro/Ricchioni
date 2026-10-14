import type {CardType,EventKind,PublicState} from './types';
export const CARD_HELP:Record<CardType,{label:string;hint:string}>={
 AZIONE:{label:'AZIONE',hint:'Giocala nel tuo turno. Il suo effetto si applica subito.'},
 TRAPPOLA:{label:'TRAPPOLA',hint:'Preparala coperta nel tuo turno. Si attiva da sola quando scatta la sua condizione.'},
 RISPOSTA:{label:'RISPOSTA',hint:'Usala quando il telefono ti propone di rispondere a un effetto.'},
 CATASTROFE:{label:'CATASTROFE',hint:'Giocala nel tuo turno. Leggi chi colpisce: può cambiare tutto il tavolo.'}
};
const EVENT_LABEL:Record<EventKind,string>={Action:'Carta giocata',Draw:'Pesca',Discard:'Scarto',Steal:'Furto',Transfer:'Passaggio di carte',Exchange:'Scambio',Arm:'Trappola preparata',Trap:'Trappola scattata',Declare:'Dichiarazione GOBLIN TIME',Start:'Inizio turno',End:'Fine turno',Reveal:'Carte rivelate',Cancel:'Effetto annullato',Extra:'Turno extra',Deposit:'Carta in deposito',Return:'Carta restituita',Status:'Effetto speciale',Response:'Risposta',RandomTarget:'Scelta casuale',DrawChoice:'Carta scelta dalla pesca',Gain:'Carta ricevuta',HandChanged:'Mano cambiata'};
export const eventLabel=(kind:EventKind):string=>EVENT_LABEL[kind];
export function clockText(seconds:number):string {const n=Math.max(0,Math.ceil(seconds-1e-9));return`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function tableInstruction(s:PublicState):{title:string;detail:string} {
 const active=s.players.find(p=>p.id===s.turn)?.name??'il giocatore di turno';
 const waiting=(s.waitingFor??[]).map(id=>s.players.find(p=>p.id===id)?.name).filter(Boolean).join(', ');
 if(s.paused)return{title:'PARTITA IN PAUSA',detail:'Il tempo è fermo. Aspettate che l’host riprenda.'};
 if(s.phase==='finished')return{title:s.winner?'GOBLIN TIME RIUSCITO':'TEMPO DELLA PARTITA FINITO',detail:s.winner?`${s.players.find(p=>p.id===s.winner)?.name} ha mantenuto 5 carte fino al proprio turno.`:'Si conta chi è più vicino a 5 carte. Guardate la classifica.'};
 if(s.phase==='reaction')return{title:'SI PUÒ RISPONDERE',detail:waiting?`${waiting}: scegli sul telefono una risposta oppure lascia passare.`:'Chi ha una risposta disponibile deve scegliere sul telefono.'};
 if(s.phase==='choice')return{title:'SCELTA SUL TELEFONO',detail:waiting?`${waiting}: leggi le opzioni e conferma. Gli altri aspettano.`:'È in corso una scelta privata. Gli altri aspettano.'};
 return{title:`TOCCA A ${active.toUpperCase()}`,detail:s.shortTurn?'Una carta ha accorciato questo turno: scegli subito sul telefono.':'Una sola mossa: pesca, gioca una carta oppure prepara una trappola. Hai 1 minuto.'};
}
