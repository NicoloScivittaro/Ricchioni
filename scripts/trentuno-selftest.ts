import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { TrentunoGame } from '../server/trentuno/core';
import { DECK,RANKS,SUITS } from '../shared/trentuno/deck';
import { handScore,bestDiscard } from '../shared/trentuno/scoring';
import { RULES } from '../shared/trentuno/rules';
import type { Command,Seat } from '../shared/trentuno/types';
const chars=['goblin','buttafuori','dottore','judoka','ciro'];
let checks=0;const ok=(value:unknown,label:string)=>{assert.ok(value,label);checks++;};
export const make=(n=5,seed=42)=>new TrentunoGame(3,chars.slice(0,n).map((characterId,i)=>({id:String(i),name:characterId,characterId})),seed);
let serial=0;
export function cmd(g:TrentunoGame,id:string,op:Command['op'],extra:Partial<Command>={}){return g.command(id,{roundId:g.roundId,matchId:g.matchId,version:g.version,requestId:String(++serial),op,...extra});}
export function rig(g:TrentunoGame,hands:string[][],top='SPADE-7',firstDeck:string[]=[]){const occupied=[...hands.flat(),top,...firstDeck];assert.equal(new Set(occupied).size,occupied.length);g.hands=new Map(g.seats.map((s,i)=>[s.id,hands[i]]));g.discard=[top];g.deck=[...firstDeck,...DECK.map(c=>c.id).filter(c=>!occupied.includes(c))];g.assertInvariants();}
ok(DECK.length===40&&new Set(DECK.map(c=>c.id)).size===40,'40 carte uniche');
for(const suit of SUITS)ok(DECK.filter(c=>c.suit===suit).map(c=>c.rank).join()==RANKS.join(),`10 ranghi ${suit}`);
ok(!DECK.some(c=>['11','31','8','9','10','J'].includes(c.rank)),'nessun rango aggiunto');
ok(handScore(['DENARI-A','DENARI-R','DENARI-C'])===31,'31 dello stesso seme');
ok(handScore(['COPPE-A','COPPE-7','BASTONI-R'])===18,'18, seme diverso escluso');
ok(handScore(['COPPE-A','DENARI-R','SPADE-C'])===11,'semi misti non sommati');
ok(handScore(['COPPE-F','COPPE-R','SPADE-C'])===20,'figure 10');
for(let n=2;n<=5;n++){
 const g=make(n);ok(g.hands.size===n&&[...g.hands.values()].every(h=>h.length===3),'distribuzione '+n);g.assertInvariants();
 const player=g.turn,before=g.hands.get(player)!.slice();ok(cmd(g,player,'draw').ok,'pesca '+n);ok(g.hands.get(player)!.length===4&&g.phase==='discard','pescata distinta '+n);
 ok(!cmd(g,g.seats.find(s=>s.id!==player)!.id,'discard',{cardId:before[0]}).ok,'scarto altrui vietato');
 ok(cmd(g,player,'discard',{cardId:bestDiscard(g.hands.get(player)!)}).ok,'scarto '+n);g.assertInvariants();
}
{
 const g=make(2);const p=g.turn,top=g.discard.at(-1)!;ok(cmd(g,p,'take').ok,'presa scarti');ok(!cmd(g,p,'discard',{cardId:top}).ok,'vietato rescarta stessa carta');ok(cmd(g,p,'discard',{cardId:g.privateState(p).discardable[0]}).ok,'scarta altra carta');
}
{
 const g=make(5),knocker=g.turn;ok(cmd(g,knocker,'knock').ok,'bussata');g.tick(RULES.knockWindow+.1);let turns=0;
 while(g.phase==='draw'){ok(g.turn!==knocker,'bussante non riceve turno finale standard');const id=g.turn;cmd(g,id,'draw');cmd(g,id,'discard',{cardId:bestDiscard(g.hands.get(id)!)});turns++;}
 ok(turns===4&&g.history.length===1,'ultimo giro esatto');
}
{
 const g=make(2);rig(g,[['DENARI-A','DENARI-R','COPPE-2'],['SPADE-2','SPADE-3','BASTONI-4']],'SPADE-7',['DENARI-C']);g.turnIndex=0;
 cmd(g,'0','draw');ok(g.history.length===0,'quattro carte non confermano 31');cmd(g,'0','discard',{cardId:'COPPE-2'});ok(g.history[0].reason==='31'&&g.history[0].rows[0].score===31,'31 dopo scarto');
}
{
 const g=make(2);g.paused=true;const before=g.publicState();g.tick(80);ok(g.publicState().remaining===before.remaining,'pausa congela');ok(!cmd(g,g.turn,'draw').ok,'comandi in pausa negati');g.paused=false;
 const starters=[g.turnIndex];for(let i=0;i<3;i++){g.tick(101);ok(g.history.length===i+1,'cap AFK rivela mano reale');if(i<2){g.tick(4.1);starters.push(g.turnIndex);}}
 ok(g.phase==='finished'&&g.results!.length===2,'tre mani e classifica');ok(starters[0]!==starters[1]&&starters[0]===starters[2],'rotazione equa');ok(g.history.every(h=>h.reason==='tempo mano'),'cap senza falso31');
}
{
 const g=make(2);rig(g,[['DENARI-A','SPADE-2','BASTONI-3'],['COPPE-A','DENARI-2','SPADE-3']]);g.tick(101);ok(g.history[0].rows.every(r=>r.placement===1&&r.points===1),'parità reale stessa posizione/punti');
 const pub=g.publicState();ok(!('hand' in pub.players[0])&&!JSON.stringify(g.publicState().log).includes('DENARI-A'),'privacy prima reveal: log mai pesca privata');
}
for(let seed=0;seed<80;seed++){
 const g=make(2+seed%4,seed);for(let step=0;g.phase!=='finished'&&step<1500;step++){
  if(g.phase==='draw'){const s=g.privateState(g.turn);if(s.score>=24&&s.canKnock)cmd(g,g.turn,'knock');else cmd(g,g.turn,'draw');}
  else if(g.phase==='discard')cmd(g,g.turn,'discard',{cardId:bestDiscard(g.hands.get(g.turn)!)});
  g.tick(.8);g.assertInvariants();
 }ok(g.phase==='finished'&&g.history.length===3,`partita naturale ${seed}`);
}
{
 const g=make(5);g.turnIndex=0;cmd(g,'0','draw');const first=g.hands.get('0')!.at(-1)!,second=g.deck[0];ok(cmd(g,'0','ability').ok,'Goblin sostituisce');ok(g.hands.get('0')!.at(-1)===second&&!g.hands.get('0')!.includes(first)&&g.deck.at(-1)===first,'prima carta fondo, seconda obbligatoria');ok(!cmd(g,'0','ability').ok,'Goblin non doppio uso');g.assertInvariants();
}
{
 const g=make(5);g.turnIndex=1;ok(cmd(g,'1','ability').ok,'Boschi blocca');cmd(g,'1','draw');cmd(g,'1','discard',{cardId:bestDiscard(g.hands.get('1')!)});ok(g.turn==='2'&&!g.privateState('2').canTake&&!cmd(g,'2','take').ok,'blocco effettivo prossimo');cmd(g,'2','draw');cmd(g,'2','discard',{cardId:bestDiscard(g.hands.get('2')!)});ok(g.blockedFor===null,'blocco un turno');
}
{
 const g=make(5);g.turnIndex=2;const top=g.deck.slice(0,3);ok(cmd(g,'2','ability').ok,'Victor');ok(g.privateState('2').peek.join()===top.slice(0,2).join()&&g.privateState('0').peek.length===0,'peek solo proprietario');ok(!('peek' in g.publicState())&&top.slice(0,2).every(c=>!JSON.stringify(g.publicState()).includes(c)),'nessun peek pubblico');cmd(g,'2','order',{reverse:true});ok(g.deck[0]===top[1]&&g.deck[1]===top[0]&&g.deck[2]===top[2]&&g.hands.get('2')!.length===3,'solo prime due invertite');ok(!cmd(g,'2','ability').ok,'Victor consumato');
}
{
 const g=make(5);g.turnIndex=0;cmd(g,'0','knock');ok(cmd(g,'3','ability').ok&&g.finalTurns===9,'Carbo aggiunge giro completo');ok(!cmd(g,'3','ability').ok,'Carbo non doppio');g.tick(3.1);let turns=0;
 while(g.phase==='draw'){const id=g.turn;cmd(g,id,'draw');cmd(g,id,'discard',{cardId:bestDiscard(g.hands.get(id)!)});turns++;}ok(turns===9,'ultimo giro esteso N-1+N');
 const own=make(5);own.turnIndex=3;cmd(own,'3','knock');ok(!cmd(own,'3','ability').ok,'non prolunga propria bussata');
}
{
 const g=make(5);g.turnIndex=4;const own=g.hands.get('4')!.slice(),other=g.hands.get('0')!.slice();ok(!cmd(g,'4','ability',{cardId:other[0],targetId:'0'}).ok&&!g.used.has('4'),'scelta estranea non consuma');ok(cmd(g,'4','ability',{cardId:own[0],targetId:'0'}).ok,'Ciro scambia');ok(g.hands.get('4')!.length===3&&g.hands.get('0')!.length===3&&g.hands.get('0')!.includes(own[0]),'Ciro conserva dimensioni');ok(g.hands.get('4')!.filter(c=>other.includes(c)).length===1,'ricevuta casuale tra avversarie');g.assertInvariants();
}
{
 const g=make(5);const hand=[['DENARI-A','DENARI-R','COPPE-2'],['SPADE-2','SPADE-3','SPADE-4'],['COPPE-3','COPPE-4','COPPE-5'],['BASTONI-2','BASTONI-3','BASTONI-4'],['DENARI-C','BASTONI-A','BASTONI-R']];rig(g,hand);g.turnIndex=4;
 // Ciro regala la carta che completa il 31 avversario. La scelta casuale può toglierne una: cerchiamo seed con l'Asso/Re conservati.
 let confirmed=false;for(let seed=0;seed<20&&!confirmed;seed++){const q=make(5,seed);rig(q,hand.map(h=>h.slice()));q.turnIndex=4;cmd(q,'4','ability',{cardId:'DENARI-C',targetId:'0'});if(q.phase==='handResult'){confirmed=true;ok(q.history[0].reason==='31'&&q.history[0].rows[0].playerId==='0','scambio conferma31 anche avversario');ok(!cmd(q,'3','ability').ok,'Carbo non annulla31');}}
 ok(confirmed,'caso31 da Ciro raggiunto');
}
for(let seed=0;seed<80;seed++){
 const g=new TrentunoGame(7,chars.slice(0,2+seed%4).map((characterId,i)=>({id:String(i),name:characterId,characterId,bot:true})),seed);
 for(let step=0;g.phase!=='finished'&&step<1500;step++){g.tick(.7);g.assertInvariants();}
 ok(g.phase==='finished'&&g.history.length===3,`bot naturali ${seed}`);ok(g.used.size>0,'bot usano abilità');
}
// Casi limite: riciclo, autorità dei comandi, capacità e due 31 simultanei.
{
 const g=make(2);for(let i=0;i<45;i++){const id=g.turn;cmd(g,id,'draw');cmd(g,id,'discard',{cardId:g.hands.get(id)!.at(-1)!});g.tick(.1);g.assertInvariants();}
 ok(g.publicState().log.some(e=>e.kind==='shuffle')||g.deck.length>10,'riciclo mazzo conserva40 e cima');
 const id=g.turn,v=g.version;ok(!cmd(g,id,'draw',{version:v-1}).ok,'versione vecchia negata');ok(!cmd(g,id,'draw',{matchId:'wrong'}).ok,'match estraneo negato');
 const request:Command={roundId:g.roundId,matchId:g.matchId,version:g.version,requestId:'duplicate-case',op:'draw'};ok(g.command(id,request).ok,'comando accettato');const hand=g.hands.get(id)!.slice();ok(g.command(id,request).ok&&g.hands.get(id)!.join()===hand.join(),'duplicato non pesca di nuovo');ok(!cmd(g,id,'knock').ok,'bussata dopo pesca vietata');g.tick(10.1);ok(g.hands.get(id)!.length===3,'AFK termina scarto');
}
{
 const g=make(5);g.turnIndex=1;cmd(g,'1','ability');cmd(g,'1','draw');cmd(g,'1','discard',{cardId:g.hands.get('1')!.at(-1)!});cmd(g,'2','knock');ok(g.blockedFor===null,'bussata consuma turno bloccato');
 const q=make(5);q.turnIndex=0;cmd(q,'0','draw');cmd(q,'0','ability');q.tick(101);q.tick(4.1);ok(q.used.has('0')&&!q.privateState('0').ability.available,'uso persiste seconda mano');
}
{
 let both=false;
 for(let seed=0;seed<25&&!both;seed++){
  const g=make(5,seed);rig(g,[['DENARI-A','DENARI-R','COPPE-C'],['SPADE-2','SPADE-3','SPADE-4'],['COPPE-3','COPPE-4','COPPE-5'],['BASTONI-2','BASTONI-3','BASTONI-4'],['COPPE-A','COPPE-R','DENARI-C']]);g.turnIndex=4;cmd(g,'4','ability',{cardId:'DENARI-C',targetId:'0'});
  if(g.history.length&&g.history[0].rows.filter(r=>r.score===31).length===2){both=true;ok(g.history[0].rows.filter(r=>r.score===31).every(r=>r.placement===1),'scambio: due31 simultanei condividono primo posto');}
 }ok(both,'due31 simultanei testati');
}
{
 const g=make(2);cmd(g,g.turn,'draw');g.tick(1000);ok(g.phase==='finished'&&g.history.length===1&&g.history[0].reason==='limite totale','hard cap reale conclude senza inventare31');g.assertInvariants();
 const q=make(2);const top=q.discard.at(-1)!;cmd(q,q.turn,'take');const id=q.turn;q.tick(10.1);ok(q.hands.get(id)!.includes(top),'timeout non rescarta presa visibile');
}
writeFileSync('docs/agent-work/trentuno/core-tests.json',JSON.stringify({checks,naturalGames:160},null,2));console.log(`${checks} controlli Trentuno superati · 160 partite naturali.`);
