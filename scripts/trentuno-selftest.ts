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
writeFileSync('docs/agent-work/trentuno/core-tests.json',JSON.stringify({checks,naturalGames:80},null,2));console.log(`${checks} controlli M1 superati.`);
