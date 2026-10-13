import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { GoblinGame } from '../server/goblinTime/core';
import { CARD_BY_ID, ALL_CARDS, BASE_CARDS, PERSONAL_CARDS, validateCatalog } from '../shared/goblinTime/catalog';
import { effect, responseEligible, responseEffect, trapMatches, trapEffect } from '../server/goblinTime/effects';
import type { Flow, Work } from '../server/goblinTime/core';
import type { GameEvent, Command } from '../shared/goblinTime/types';

validateCatalog();
const characterIds=['goblin','buttafuori','dottore','judoka','ciro'];
const records:{name:string;passed:boolean}[]=[];
function test(name:string,fn:()=>void){try{fn();records.push({name,passed:true});}catch(e){console.error('FAILED',name);throw e;}}
function fixture(card?:string,n=3):GoblinGame {
  const g=new GoblinGame(1,['a','b','c'].slice(0,n).map((id,i)=>({id,name:id,characterId:characterIds[i]})),'personal',4242,{main:12,choice:12,reaction:5,limit:360});
  for(const p of g.players)for(const c of [...p.hand])g.move(c,g.deck);
  let pool=BASE_CARDS.filter(c=>c.type==='AZIONE'&&c.id!==card).map(c=>c.id);
  for(const [i,p] of g.players.entries())for(const c of pool.splice(0,i===2?3:4))g.move(c,p.hand);
  if(card)g.move(card,g.temp);
  g.traps=[];g.assertInvariants();return g;
}
function drain<T>(g:GoblinGame,flow:Flow<T>,choose?:(r:Work['requests'][number])=>string[]):T {
  let next=flow.next({}),steps=0;
  while(!next.done){assert.ok(++steps<300,'Transazione terminabile');const answers:Record<string,string[]>={};for(const r of next.value.requests)answers[r.player]=choose?.(r)??r.options.slice(0,r.min??1).map(o=>o.id);next=flow.next(answers);g.checkDeclarations();g.assertInvariants();}
  g.assertInvariants();return next.value;
}
function use(card:string,verify:(g:GoblinGame,before:number[])=>void,choose?:(r:Work['requests'][number])=>string[]):void {
  const g=fixture(card);
  if(['A26','A36','C12','PB05','PC02'].includes(card)){g.remove('T24');g.traps.push({id:'T24',owner:'b',order:500,suspended:null});}
  if(['A16','PG01'].includes(card))g.move('A40');
  if(card==='A22')g.setStatus('a','noDraw');
  if(card==='A23'){g.move('R01',g.player('b').hand);g.move('R02',g.player('b').hand);}
  if(card==='A35')g.move('T24',g.player('a').hand);
  if(card==='A34')g.player('a').stolenBy.set('b',g.turnNumber);
  if(card==='A06')g.move(g.take()[0],g.player('b').hand);
  if(card==='A13')for(const id of ['b','c'])while(g.player(id).hand.length<=4)g.move(g.take()[0],g.player(id).hand);
  if(['C01','C15'].includes(card))for(const id of ['a','b'])while(g.player(id).hand.length<6)g.move(g.take()[0],g.player(id).hand);
  const before=g.players.map(p=>p.hand.length);
  drain(g,g.applyCard(card,'a','b'),choose);if(g.temp.includes(card))g.move(card);verify(g,before);
}
const count=(g:GoblinGame,id:string)=>g.player(id).hand.length;
const firstSwap=(r:Work['requests'][number])=>r.options.some(o=>o.id==='SCAMBIA')?['SCAMBIA']:r.options.slice(0,r.min??1).map(o=>o.id);

const actionChecks:Record<string,(g:GoblinGame,n:number[])=>void>={
 A01:(g,n)=>{assert.equal(count(g,'a'),n[0]+1);assert.equal(count(g,'b'),n[1]-1);assert.ok(g.log.some(e=>e.kind==='reveal'));},
 A02:(g,n)=>{assert.equal(count(g,'a'),n[0]);assert.equal(count(g,'b'),n[1]);},
 A03:(g,n)=>assert.equal(count(g,'b'),n[1]+2),A04:(g,n)=>assert.equal(count(g,'b'),n[1]-1),
 A05:(g,n)=>{assert.equal(count(g,'a'),n[0]+1);assert.equal(count(g,'b'),n[1]+1);},A06:(g,n)=>assert.equal(count(g,'b'),n[1]-1),
 A07:g=>{assert.equal(g.deposits.length,1);assert.equal(g.deposits[0].owner,'b');},
 A08:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n),A09:g=>assert.ok(g.status(g.player('b'),'noResponse')),
 A10:(g,n)=>assert.equal(count(g,'b'),n[1]-1),A11:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n),
 A12:g=>assert.equal(g.player('a').info[0].cards.length,2),A13:(g,n)=>assert.equal(count(g,'a'),n[0]+2),
 A14:(g,n)=>assert.equal(count(g,'b'),n[1]-1),A15:g=>assert.equal(g.player('b').debts[0].kind,'skip'),
 A16:(g,n)=>assert.equal(count(g,'a'),n[0]),A17:g=>assert.ok(g.status(g.player('b'),'noDraw')),
 A18:(g,n)=>{assert.deepEqual(g.players.map(p=>p.hand.length),n);assert.ok(g.log.some(e=>e.kind==='reveal'));},
 A19:g=>assert.ok(g.status(g.player('b'),'short')),A20:g=>{drain(g,g.endTurn());assert.equal(g.active.id,'a');assert.equal(g.player('a').turns,2);},A21:g=>assert.equal(g.direction,-1),
 A22:g=>{assert.ok(!g.status(g.player('a'),'noDraw'));assert.ok(g.status(g.player('b'),'noDraw'));},A23:(g,n)=>{assert.equal(count(g,'b'),n[1]-1);assert.ok(g.log.some(e=>e.text.includes('2 RISPOSTE')));},
 A24:(g,n)=>assert.equal(count(g,'a'),n[0]+1),A25:g=>assert.ok(g.status(g.player('b'),'noDeclare')),
 A26:g=>{assert.ok(g.player('a').hand.includes('T24'));assert.equal(g.traps.length,0);},A27:g=>assert.equal(g.player('a').debts[0].count,2),
 A28:g=>assert.ok(g.status(g.player('b'),'publicDraw')),A29:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n),
 A30:(g,n)=>assert.equal(count(g,'b'),n[1]-1),A31:(g,n)=>assert.equal(count(g,'a'),n[0]+1),
 A32:g=>assert.equal(g.publicState().players[0].count,null),A33:(g,n)=>assert.equal(count(g,'a'),n[0]+1),
 A34:(g,n)=>assert.equal(count(g,'b'),n[1]-1),A35:(g,n)=>{assert.equal(count(g,'a'),n[0]);assert.equal(g.traps[0].auxiliary,true);},
 A36:g=>assert.notEqual(g.traps[0].suspended,null),A37:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n),
 A38:g=>assert.equal(g.deposits[0].owner,'a'),A39:g=>assert.equal(g.player('b').giftLock.size,1),
 A40:g=>{assert.equal(g.player('a').info[0].cards.length,4);assert.ok(g.log.some(e=>e.kind==='reveal'));},
 C01:g=>assert.deepEqual(g.players.map(p=>p.hand.length),[5,5,5]),C02:g=>{g.move('R05',g.player('b').hand);let windows=0;drain(g,g.reactions(g.event('Declare','a')),r=>{windows++;return ['pass'];});assert.equal(windows,0);},
 C03:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n),C04:(g,n)=>assert.equal(count(g,'a'),n[0]-2),
 C05:(g,n)=>{assert.equal(count(g,'a'),n[0]+1);assert.equal(count(g,'b'),n[1]+3);},
 C06:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n.map(x=>x+1)),C07:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),[n[0]+1,n[1]-2,n[2]+1]),
 C08:g=>{drain(g,g.endTurn());assert.equal(g.mainUntil-g.clock,4);},C09:(g,n)=>{assert.equal(count(g,'a'),n[1]);assert.equal(count(g,'b'),n[0]);},
 C10:(g,n)=>{assert.equal(count(g,'a'),n[0]-1);assert.equal(count(g,'c'),n[2]+2);},
 C11:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n.map(x=>x-1)),C12:(g,n)=>{assert.equal(g.traps.length,0);assert.equal(count(g,'b'),n[1]+1);},
 C13:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),[n[2],n[0],n[1]]),C14:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n),C15:g=>{assert.deepEqual(g.players.map(p=>p.hand.length),[5,5,3]);assert.ok(g.player('a').resetLocked);},
 PG01:(g,n)=>{assert.equal(count(g,'a'),n[0]);assert.ok(g.player('a').hand.includes('A40'));},PG02:(g,n)=>assert.equal(count(g,'a'),n[0]+1),
 PG05:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n),PB01:g=>assert.equal(g.player('a').info[0].cards.length,1),
 PB02:g=>assert.ok(g.status(g.player('a'),'drawThree')),PB05:(g,n)=>{assert.equal(g.traps.length,0);assert.deepEqual(g.players.map(p=>p.hand.length),n);},
 PV01:g=>assert.ok(g.log.some(e=>e.kind==='reveal')),PV02:(g,n)=>assert.equal(count(g,'a'),n[0]+1),
 PV05:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n.map(x=>x+1)),PC01:g=>assert.equal(g.deposits[0].owner,'b'),
 PC02:(g,n)=>{assert.deepEqual(g.players.map(p=>p.hand.length),[n[0],n[1]+1,n[2]]);assert.ok(g.player('a').hand.includes('T24'));assert.equal(g.traps.length,0);},PC05:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n.map(x=>x+1)),
 PI01:(g,n)=>{assert.equal(count(g,'a'),n[0]-1);assert.equal(count(g,'b'),n[1]+2);},PI02:(g,n)=>assert.equal(count(g,'b'),n[1]+1),
 PI05:(g,n)=>assert.deepEqual(g.players.map(p=>p.hand.length),n.map(x=>x-1))
};
for(const c of ALL_CARDS.filter(c=>['AZIONE','CATASTROFE'].includes(c.type)))test(`${c.id} ${c.name}`,()=>use(c.id,actionChecks[c.id],c.id==='A12'?firstSwap:c.id==='C07'?r=>r.options.some(o=>o.id==='ACCUSA')?[r.player==='b'?'COPRE':'ACCUSA']:r.options.slice(0,r.min??1).map(o=>o.id):undefined));

const responseEvents:Record<string,Partial<GameEvent>&{kind:GameEvent['kind']}>= {
 R01:{kind:'Action',card:'A03'},R02:{kind:'Draw',count:2},R03:{kind:'Steal',count:1},R04:{kind:'Discard',count:1},R05:{kind:'Declare'},R06:{kind:'Trap'},R07:{kind:'Action',card:'C06'},R08:{kind:'Status',source:'A19'},R09:{kind:'Steal'},R10:{kind:'Draw',count:3,target:'c'},R11:{kind:'Response',response:'R03'},R12:{kind:'Discard',count:9},R13:{kind:'Action',card:'A03'},R14:{kind:'Reveal',public:false},R15:{kind:'Gain',source:'A03',target:'c'},R16:{kind:'Extra'},R17:{kind:'Arm'},R18:{kind:'Deposit'},R19:{kind:'RandomTarget'},R20:{kind:'Reveal',public:true},PG04:{kind:'Discard',count:1},PB04:{kind:'Action',card:'A01'},PV04:{kind:'Reveal',public:true},PC04:{kind:'Extra'},PI04:{kind:'Discard',count:2}
};
for(const c of ALL_CARDS.filter(c=>c.type==='RISPOSTA'))test(`${c.id} ${c.name}`,()=>{
  const g=fixture(c.id),conf=responseEvents[c.id];const e=g.event(conf.kind,'b','a',conf);
  if(c.id==='R15'){const card=g.take()[0];e.card=card;}
  if(c.id==='R17')e.card=g.player('b').hand[0];
  if(c.id==='R19')g.rng.next=()=>.99;
  if(c.id==='R11')e.origin=g.event('Steal','b','a');
  assert.ok(responseEligible(c.id,'a',e,g),'Finestra compatibile');
  const before=JSON.stringify({e,hand:g.players.map(p=>p.hand),info:g.players.map(p=>p.info)});
  drain(g,responseEffect(c.id,'a',e,g));
  assert.notEqual(JSON.stringify({e,hand:g.players.map(p=>p.hand),info:g.players.map(p=>p.info)}),before,'Effetto reale osservabile');
});

const trapEvents:Record<string,{kind:GameEvent['kind'];before:boolean;actor?:string;target?:string;count?:number;source?:string}>= {
 T01:{kind:'Steal',before:false,target:'a'},T02:{kind:'DrawChoice',before:true},T03:{kind:'Declare',before:false},T04:{kind:'Draw',before:false},T05:{kind:'Reveal',before:false},T06:{kind:'Arm',before:true},T07:{kind:'Discard',before:false},T08:{kind:'Discard',before:true,target:'a'},T09:{kind:'Cancel',before:false},T10:{kind:'Transfer',before:true,target:'c'},T11:{kind:'Start',before:true},T12:{kind:'Extra',before:true},T13:{kind:'Reveal',before:false},T14:{kind:'Transfer',before:true,target:'c'},T15:{kind:'Discard',before:false},T16:{kind:'Discard',before:false},T17:{kind:'Action',before:false,target:'a'},T18:{kind:'End',before:false},T19:{kind:'Status',before:true,source:'A22'},T20:{kind:'Draw',before:false,source:'T02'},T21:{kind:'Action',before:true},T22:{kind:'Return',before:true},T23:{kind:'Action',before:false},T24:{kind:'Draw',before:false,count:2,source:'A03'},T25:{kind:'Exchange',before:false},PG03:{kind:'DrawChoice',before:true},PB03:{kind:'Transfer',before:true,target:'c'},PV03:{kind:'End',before:false},PC03:{kind:'End',before:false},PI03:{kind:'Steal',before:false,target:'a'}
};
for(const c of ALL_CARDS.filter(c=>c.type==='TRAPPOLA'))test(`${c.id} ${c.name}`,()=>{
  const g=fixture(c.id),conf=trapEvents[c.id]; const e=g.event(conf.kind,conf.actor??'b',conf.target??'b',{count:conf.count??1,source:conf.source,cards:[],deferred:false});
  if(['T02','PG03'].includes(c.id)){e.cards=g.take(2);e.card=e.cards[0];}
  if(['T01','PI03'].includes(c.id))e.cards=[g.player('b').hand[0]];
  if(['T10','T14','PB03'].includes(c.id)){e.cards=[g.player('b').hand[0]];e.deferred=true;}
  if(['T07','T16'].includes(c.id)){e.cards=g.player('b').hand.slice(0,c.id==='T07'?1:2);for(const card of e.cards)g.move(card);}
  if(['T04','T15','T20'].includes(c.id)){e.kind='HandChanged';e.previousCount=c.id==='T15'?2:c.id==='T04'?5:3;e.newCount=c.id==='T15'?1:c.id==='T04'?6:4;}
  if(c.id==='T04')for(const card of g.take(2))g.move(card,g.player('b').hand);
  if(c.id==='T11'){g.move(g.take()[0],g.player('b').hand);g.player('b').declaredAt=0;}
  if(c.id==='T15')for(const card of g.player('b').hand.slice(1))g.move(card);
  if(c.id==='T19')e.target='c';
  if(c.id==='T21')e.card='C01';
  if(c.id==='T22'){e.card=g.player('b').hand[0];g.remove(e.card);g.deposits.push({id:e.card,owner:'b',due:1});}
  if(c.id==='T23'){e.lastCard=true;}
  if(c.id==='T23')for(const card of [...g.player('b').hand])g.move(card);
  if(c.id==='T24')e.cards=g.player('b').hand.slice(0,2);
  if(c.id==='T25')e.cards=[g.player('b').hand[0],g.player('c').hand[0]];
  if(c.id==='PV03')g.move(g.take()[0],g.player('b').hand);
  if(c.id==='PC03')g.move(g.player('b').hand[0]);
  assert.ok(trapMatches(c.id,'a',e,conf.before?'before':'after',g),'Trigger compatibile');
  const old=JSON.stringify({e,hand:g.players.map(p=>p.hand),status:g.players.map(p=>[...p.noTarget]),debts:g.players.map(p=>p.debts),deposits:g.deposits,info:g.players.map(p=>p.info)});
  drain(g,trapEffect(c.id,'a',e,g));
  assert.notEqual(JSON.stringify({e,hand:g.players.map(p=>p.hand),status:g.players.map(p=>[...p.noTarget]),debts:g.players.map(p=>p.debts),deposits:g.deposits,info:g.players.map(p=>p.info)}),old,'Effetto distinto osservabile');
});

test('Pausa, duplicati, versioni e identità partita',()=>{
  const g=fixture();const c:Command={roundId:1,matchId:g.matchId,version:g.version,requestId:'one',op:'draw'};
  const ack=g.command('a',c);assert.ok(ack.ok);const serialized=JSON.stringify(g.privateState('a'));assert.deepEqual(g.command('a',c),ack);assert.equal(JSON.stringify(g.privateState('a')),serialized);
  assert.equal(g.command('b',{...c,requestId:'two',version:-1}).ok,false);
  assert.equal(g.command('a',{...c,matchId:'old'}).ok,false);g.paused=true;const clock=g.clock;g.tick(20);assert.equal(g.clock,clock);assert.equal(g.command('a',{...c,requestId:'three',version:g.version}).ok,false);
});
test('Privacy: TV e ogni altro giocatore senza mani/trappole segrete',()=>{
  const g=fixture();g.move('T01',g.player('a').hand);drain(g,g.arm('a','T01'));
  const pub=g.publicState(),priv=g.privateState('b');assert.equal('hand' in pub.players[0],false);assert.equal(JSON.stringify(pub).includes('T01'),false);assert.equal(JSON.stringify(priv).includes('T01'),false);assert.ok(g.privateState('a').traps.some(t=>t.cardId==='T01'));
});
test('Dichiarazione non istantanea e invalidazione per variazione intermedia',()=>{
  const g=fixture();g.move(g.take()[0],g.player('a').hand);drain(g,g.declare('a'));assert.equal(g.winner,null);const p=g.player('a');assert.notEqual(p.declaredAt,null);const c=p.hand[0];g.move(c,g.temp);g.move(c,p.hand);assert.equal(p.declaredAt,null);
});

const simulations:{players:number;mode:string;seed:number;seconds:number;winner:string|null}[]=[];
test('R14 nega la mano anche alle decisioni successive di A12 e A40',()=>{
  for(const card of ['A12','A40']){const g=fixture(card);g.move('R14',g.player('b').hand);const secret=[...g.player('b').hand];const attackerOptions:string[]=[];
    drain(g,g.applyCard(card,'a','b'),r=>{if(r.player==='a')attackerOptions.push(...r.options.flatMap(o=>o.cardId?[o.cardId]:[]));if(r.kind==='reaction')return [r.player==='b'&&r.options.some(o=>o.id==='R14')?'R14':'pass'];return r.options.slice(0,r.min??1).map(o=>o.id);});
    assert.equal(g.player('a').info.length,0);assert.ok(!attackerOptions.some(c=>secret.includes(c)));}
});
test('C15 vieta una nuova dichiarazione fino a una reale variazione della mano',()=>{
  const g=fixture('C15');while(g.player('b').hand.length<7)g.move(g.take()[0],g.player('b').hand);drain(g,g.applyCard('C15','a'));g.move('C15');assert.equal(count(g,'b'),5);assert.ok(g.player('b').resetLocked);g.player('b').turns+=3;assert.equal(g.canDeclare(g.player('b')),false);g.move(g.take()[0],g.player('b').hand);g.move(g.player('b').hand.at(-1)!);assert.equal(g.canDeclare(g.player('b')),true);
});
test('T11 e debito Ciro si risolvono prima del controllo vittoria',()=>{
  for(const trap of [true,false]){const g=fixture();while(count(g,'b')<5)g.move(g.take()[0],g.player('b').hand);g.player('b').declaredAt=0;g.turnIndex=1;
    if(trap){g.remove('T11');g.traps.push({id:'T11',owner:'a',order:500,suspended:null});}else g.player('b').debts.push({kind:'discard',due:1,count:1});
    drain(g,g.startTurn());assert.equal(g.winner,null);assert.equal(g.player('b').declaredAt,null);assert.equal(count(g,'b'),4);}
});
test('Vittoria mantenuta fino al successivo turno effettivo',()=>{
  const g=fixture();while(count(g,'b')<5)g.move(g.take()[0],g.player('b').hand);g.player('b').declaredAt=0;g.turnIndex=1;drain(g,g.startTurn());assert.equal(g.winner,'b');assert.equal(g.results?.[0].playerId,'b');
});
test('A35 mantiene uno slot ausiliario e due slot ordinari',()=>{
  const g=fixture('A35');for(const c of ['T01','T02','T03','T04'])g.move(c,g.player('a').hand);drain(g,g.arm('a','T01'));drain(g,g.arm('a','T02'));drain(g,g.applyCard('A35','a'));assert.equal(g.traps.filter(t=>t.owner==='a').length,3);assert.equal(g.traps.filter(t=>t.auxiliary).length,1);assert.deepEqual(g.armable(g.player('a')),[]);
});
test('R17 riprende la nuova trappola senza scartarla',()=>{
  const g=fixture();g.move('T01',g.player('b').hand);g.move('R17',g.player('a').hand);drain(g,g.arm('b','T01'),r=>r.kind==='reaction'?[r.player==='a'&&r.options.some(o=>o.id==='R17')?'R17':'pass']:r.options.slice(0,r.min??1).map(o=>o.id));assert.ok(g.player('b').hand.includes('T01'));assert.equal(g.traps.length,0);assert.ok(g.discard.includes('R17'));
});
test('R07 esclude dal rimescolamento globale senza leggere mani private',()=>{
  const g=fixture('C03');const hand=[...g.player('b').hand];g.exclude('b');drain(g,g.applyCard('C03','a'));assert.deepEqual(g.player('b').hand,hand);g.assertInvariants();
});
test('Mazzo esaurito rimescola solo gli scarti',()=>{
  const g=fixture();for(const c of [...g.deck])g.move(c);const privateHands=g.players.flatMap(p=>p.hand);const drawn=g.take(5);assert.equal(drawn.length,5);assert.ok(!drawn.some(c=>privateHands.includes(c)));g.assertInvariants();
});
test('Mano massima: selezione effettiva degli scarti e nessuna carta persa',()=>{
  const g=fixture();while(count(g,'a')<12)g.move(g.take()[0],g.player('a').hand);drain(g,g.enforceHands());assert.equal(count(g,'a'),9);assert.equal(g.discard.length,3);
});
test('Cinque abilità: costi, ordine e uso singolo',()=>{
  for(const [i,cid]of characterIds.entries()){const g=fixture();g.player('a').characterId=cid;
    if(cid==='goblin'){drain(g,g.mainDraw('a'));assert.ok(g.abilityAvailable('a'));drain(g,g.ability('a'));}
    else if(cid==='dottore'){const old=count(g,'a');drain(g,g.ability('a'));assert.equal(count(g,'a'),old+1);}
    else {const e=g.event(cid==='judoka'?'Transfer':'Steal','b','a',{count:1,cards:[g.player('b').hand[0]]});assert.ok(g.abilityAvailable('a',e));drain(g,g.ability('a',e));if(cid==='ciro')assert.equal(g.player('a').debts.length,1);else if(cid==='buttafuori')assert.ok(e.cancel);else assert.equal(e.target,'c');}
    assert.ok(g.player('a').abilityUsed);assert.equal(g.abilityAvailable('a'),false);}
});
test('R13 rimanda una AZIONE all’autore anche con due giocatori',()=>{
  const g=fixture(undefined,2);g.move('A03',g.player('a').hand);g.move('R13',g.player('b').hand);const old=count(g,'a');
  drain(g,g.play('a','A03'),r=>{if(r.kind==='reaction')return [r.player==='b'&&r.options.some(o=>o.id==='R13')?'R13':'pass'];if(r.title==='Nuovo bersaglio')return ['a'];if(r.title==='Scegli il bersaglio')return ['b'];return r.options.slice(0,r.min??1).map(o=>o.id);});assert.equal(count(g,'a'),old+1);
});
test('T04 scatta anche su una carta recuperata dagli scarti',()=>{
  const g=fixture('A16');while(count(g,'a')<5)g.move(g.take()[0],g.player('a').hand);g.move('A40');g.remove('T04');g.traps.push({id:'T04',owner:'b',order:9999,suspended:null});
  drain(g,g.applyCard('A16','a'));assert.equal(count(g,'a'),4);assert.ok(g.discard.includes('T04'));assert.equal(g.player('b').trapHits,1);
});
test('Alla scadenza si usa la classifica tecnica, senza falsa dichiarazione di vittoria',()=>{
  const g=fixture();while(count(g,'a')<5)g.move(g.take()[0],g.player('a').hand);g.player('a').declaredAt=1;g.tick(361);assert.equal(g.phase,'finished');assert.equal(g.winner,null);assert.ok(g.endReason?.includes('emergenza'));assert.equal(g.results?.length,3);
});
test('T09 fa pagare anche chi annulla una trappola con R06',()=>{
  const g=fixture();g.move('R06',g.player('b').hand);g.remove('T09');g.traps.push({id:'T09',owner:'a',order:500,suspended:null});const old=count(g,'b');
  drain(g,g.reactions(g.event('Trap','c','b',{card:'T03'})),r=>r.kind==='reaction'?[r.player==='b'&&r.options.some(o=>o.id==='R06')?'R06':'pass']:r.options.slice(0,r.min??1).map(o=>o.id));
  assert.equal(count(g,'b'),old-2);assert.equal(g.player('a').trapHits,1);assert.ok(g.discard.includes('T09'));
});
test('Bloccare RISPOSTE lascia disponibili le abilità dei personaggi',()=>{
  const g=fixture();g.player('b').characterId='buttafuori';g.setStatus('b','noResponse');g.blackout(1);let abilityShown=false;
  drain(g,g.reactions(g.event('Steal','a','b',{count:1})),r=>{if(r.player==='b'){abilityShown=r.options.some(o=>o.id==='ability');assert.ok(!r.options.some(o=>o.cardId));}return ['pass'];});assert.ok(abilityShown);
});
test('A39 blocca gioco/scarto volontario, ma consente doni e scambi tramite altri effetti',()=>{
  const g=fixture();for(const c of [...g.player('a').hand])g.move(c,g.deck);g.move('A02',g.player('a').hand);g.move('A40',g.player('a').hand);g.player('a').giftLock.set('A40',g.player('a').turns+1);
  assert.ok(!g.playable(g.player('a')).includes('A40'));assert.ok(g.playable(g.player('a')).includes('A02'));assert.ok(g.handOptions('a',true).some(o=>o.id==='A40'));drain(g,g.play('a','A02'));assert.ok(g.log.some(e=>e.kind==='transfer'&&e.from==='a'&&e.to==='b'));g.assertInvariants();
});
test('Una vera sostituzione a conteggio costante sblocca C15',()=>{
  const g=fixture();while(count(g,'b')<5)g.move(g.take()[0],g.player('b').hand);g.checkDeclarations();g.player('b').resetLocked=true;const old=g.player('b').hand[0];const other=g.player('c').hand[0];
  drain(g,g.exchange('a','b','c',old,other));assert.equal(count(g,'b'),5);assert.equal(g.player('b').resetLocked,false);assert.ok(g.canDeclare(g.player('b')));
});
for(const mode of ['base','personal'] as const)for(let n=2;n<=5;n++)for(let seed=1;seed<=12;seed++)test(`Partita naturale bot ${mode} ${n} seed${seed}`,()=>{
  const g=new GoblinGame(1,characterIds.slice(0,n).map((characterId,i)=>({id:`p${i}`,name:`P${i}`,characterId,bot:true})),mode,seed);
  let steps=0;while(g.phase!=='finished'){g.tick(.2);g.assertInvariants();assert.ok(++steps<4000,'Partita non bloccata');}
  assert.equal(g.results?.length,n);assert.equal(new Set(g.results?.map(r=>r.playerId)).size,n);if(g.winner)assert.equal(g.player(g.winner).hand.length,5);
  simulations.push({players:n,mode,seed,seconds:+g.clock.toFixed(1),winner:g.winner});
});
mkdirSync('docs/agent-work/goblin-time',{recursive:true});writeFileSync('docs/agent-work/goblin-time/core-tests.json',JSON.stringify({passed:records.length,cards:ALL_CARDS.length,simulations,tests:records},null,2));
console.log(`${records.length} verifiche superate; ${ALL_CARDS.length} carte; ${simulations.length} partite naturali 2–5 giocatori.`);
