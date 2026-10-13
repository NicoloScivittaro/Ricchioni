import { CARD_BY_ID } from '../../shared/goblinTime/catalog';
import type { GameEvent, Option } from '../../shared/goblinTime/types';
import type { Flow, GoblinGame, Player } from './core';

const actions = Array.from({ length: 40 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`);
const traps = Array.from({ length: 25 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`);
const responses = Array.from({ length: 20 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`);
const catastrophes = Array.from({ length: 15 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`);
const personal = ['PG','PB','PV','PC','PI'].flatMap(p => [1,2,3,4,5].map(i => `${p}0${i}`));
export const HANDLERS = new Set([...actions, ...traps, ...responses, ...catastrophes, ...personal]);
const types: Option[] = ['AZIONE','TRAPPOLA','RISPOSTA','CATASTROFE'].map(x => ({ id: x, label: x }));
const cards = (g: GoblinGame, ids: string[]): Option[] => ids.map(c => g.cardOption(c));
const random = (g: GoblinGame, ids: string[], n = 1): string[] => g.rng.shuffle(ids).slice(0, n);

export function* effect(id: string, a: string, g: GoblinGame, initialTarget?: string): Flow {
  const p = g.player(a); let t = initialTarget;
  const getTarget = function* (valid = g.rivals(a)): Flow<string | null> { return t ?? (yield* g.target(a, 'Scegli il bersaglio', valid)); };
  const discardOne = function* (who: string, n = 1): Flow { yield* g.lose(a, who, n); };
  const pickHand = function* (who: string): Flow<string | undefined> { return (yield* g.ask(who,'Scegli una carta',g.handOptions(who,true)))[0]; };
  switch (id) {
    case 'A01': if (t) yield* g.steal(a, t, 1, true); return;
    case 'A02': { if (!t || !g.player(t).hand.length) { yield* g.mainDraw(a); return; } const own = yield* pickHand(a); if (own) { yield* g.give(a, t, [own]); yield* g.steal(a, t); } return; }
    case 'A03': if (t) yield* g.draw(a, t, 2); return;
    case 'A04': if (t) { if (g.player(t).hand.length >= 4) yield* g.steal(a, t); else yield* g.draw(a, t); } return;
    case 'A05': { const drawn = yield* g.draw(a, a, 2); t = (yield* getTarget()) ?? undefined; if (t && drawn.length) { const c = (yield* g.ask(a, 'Dona una delle due carte pescate', cards(g, drawn)))[0]; yield* g.give(a, t, [c]); } return; }
    case 'A06': if (t && g.player(t).hand.length > p.hand.length) yield* discardOne(t); else yield* g.draw(a); return;
    case 'A07': if (t && g.player(t).hand.length) yield* g.deposit(a, t, g.rng.pick(g.player(t).hand)); else yield* g.mainDraw(a); return;
    case 'A08': case 'C14': { const seats = g.ordered().filter(x=>!g.immune(x.id)).filter(x => x.hand.length); const choices = yield* g.simultaneous('Scegli una carta segreta per lo scambio collettivo', seats, x => g.handOptions(x.id,true)); const selected = seats.flatMap(x => choices[x.id] ?? []); if (!selected.length) return;
      const e = g.event('Exchange', a, a, { cards: selected }); yield* g.before(e); if (e.cancel) return;
      const shuffled = g.rng.shuffle(selected); g.atomic(() => { for (const c of selected) g.move(c, g.temp); seats.forEach((x, i) => { if (choices[x.id]?.length && shuffled[i]) g.move(shuffled[i], x.hand); }); }); g.note('Scambio collettivo risolto senza rivelare le scelte.', 'exchange'); yield* g.after(e); return; }
    case 'A09': if (t) yield* g.changeStatus(a, t, 'noResponse'); return;
    case 'A10': { if (!t) return; const opt = yield* g.option(t, 'Fidati di me: consegna una carta o mostra la mano', ['CONSEGNA','MOSTRA']); if (opt === 'CONSEGNA') yield* g.steal(a, t); else yield* g.reveal(a, t, [...g.player(t).hand]); return; }
    case 'A11': { if (!t) return; yield* g.draw(a); yield* g.draw(a, t); const answers = yield* g.simultaneous('Scegli la carta da scartare dopo il patto', [p,g.player(t)], x => g.handOptions(x.id,true)); for (const who of [a,t]) yield* g.discardCards(a, who, answers[who] ?? []); return; }
    case 'A12': { if (!t) return; const viewed = random(g, g.player(t).hand, 2); if(!(yield* g.reveal(a, t, viewed)))return; if (!p.hand.length || !viewed.length) return; if ((yield* g.option(a, 'Scambi una carta osservata?', ['NO','SCAMBIA'])) === 'SCAMBIA') { const c = (yield* g.ask(a, 'Scegli la carta osservata', cards(g, viewed)))[0]; yield* g.exchange(a, a, t, g.rng.pick(p.hand), c); } return; }
    case 'A13': yield* g.draw(a, a, Math.min(2, g.rivals(a).filter(x => x.hand.length > p.hand.length).length)); return;
    case 'A14': { if (!t) return; const opt = yield* g.option(t, 'Bancomat rotto: scarta oppure consegna', ['SCARTA','CONSEGNA']); if (opt === 'SCARTA') yield* discardOne(t); else yield* g.steal(a, t); return; }
    case 'A15': if (t) g.player(t).debts.push({ kind: 'skip', due: g.player(t).turns + 1, count: 1 }); return;
    case 'A16': { const avail = g.discard.slice(-3); if (!avail.length) { yield* g.mainDraw(a); return; } const c = (yield* g.ask(a, 'Recupera una delle ultime tre carte scartate', cards(g, avail)))[0]; g.move(c, p.hand); yield* g.lose(a, a, 1, true); return; }
    case 'A17': if (t) yield* g.changeStatus(a, t, 'noDraw'); return;
    case 'A18': { if (!t || !p.hand.length) { yield* g.mainDraw(a); return; } const viewed = random(g,g.player(t).hand,2); const visible=yield* g.reveal(a,t,viewed,true); if (viewed.length) { const value=(yield* g.ask(a,'Scegli quale rubare',visible?cards(g,viewed):viewed.map((c,i)=>({id:String(i),label:'Carta coperta '+(i+1)}))))[0];const c=visible?value:viewed[Number(value)]; const own = g.rng.pick(p.hand); yield* g.exchange(a,a,t,own,c); } return; }
    case 'A19': if (t) yield* g.changeStatus(a,t,'short'); return;
    case 'A20': yield* g.grantExtra(a); return;
    case 'A21': { const next = g.players[(g.turnIndex+g.direction+g.players.length)%g.players.length]; g.direction *= -1; yield* g.draw(a,next.id); return; }
    case 'A22': { const negative = (['noResponse','noDraw','noDeclare','short','publicDraw'] as const).filter(k => g.status(p,k)); if (!negative.length) { yield* g.mainDraw(a); return; } const k = (yield* g.ask(a,'Quale effetto negativo trasferisci?',negative.map(k => ({ id:k,label:k }))))[0] as typeof negative[number]; delete p.status[k]; if (t) yield* g.changeStatus(a,t,k); return; }
    case 'A23': if (t && g.player(t).hand.length>=3) { const count = g.player(t).hand.filter(c => CARD_BY_ID[c].type==='RISPOSTA').length; g.note(`${g.player(t).name} possiede ${count} RISPOSTE.`); if(count>=2) { const c=(yield* g.ask(t,'Scarta una RISPOSTA',cards(g,g.player(t).hand.filter(c=>CARD_BY_ID[c].type==='RISPOSTA'))))[0]; yield* g.discardCards(a,t,[c]); } } return;
    case 'A24': { const offer=g.take(3); for(const c of offer) g.note(`Sul tavolo: ${CARD_BY_ID[c].name}`,'reveal',c); if(!offer.length)return; const keep=(yield* g.ask(a,'Scegli la carta da tenere',cards(g,offer)))[0]; g.move(keep,p.hand); const rest=offer.filter(c=>c!==keep); const order=yield* g.ask(a,'Ordina le altre carte al fondo',cards(g,rest),rest.length,rest.length,true); for(const c of order)g.move(c,g.deck); return; }
    case 'A25': if(t) { g.player(t).declaredAt=null; yield* g.changeStatus(a,t,'noDeclare'); } return;
    case 'A26': { const ts=g.traps.filter(x=>x.owner===t); if(!ts.length) { if(t)yield* g.draw(a,t); return; } const slot=(yield* g.ask(a,'Scegli uno slot coperto',ts.map((x,i)=>({id:String(x.order),label:`Trappola ${i+1}`}))))[0]; const trap=ts.find(x=>String(x.order)===slot)!; g.move(trap.id,p.hand); return; }
    case 'A27': yield* g.draw(a,a,3); p.debts.push({kind:'loan',due:p.turns+1,count:2}); return;
    case 'A28': if(t)yield* g.changeStatus(a,t,'publicDraw'); return;
    case 'A29': { const seats=g.ordered().filter(x=>x.hand.length); const one=yield* g.target(a,'Primo giocatore dello scambio',seats); const two=yield* g.target(a,'Secondo giocatore dello scambio',seats.filter(x=>x.id!==one)); if(one&&two)yield* g.exchange(a,one,two,g.rng.pick(g.player(one).hand),g.rng.pick(g.player(two).hand)); else yield* g.mainDraw(a); return; }
    case 'A30': if(t) { if((yield* g.option(t,'Prima paghi tu: scarta o fai pescare l’autore',['SCARTA','PESCA AUTORE']))==='SCARTA')yield* discardOne(t); else yield* g.draw(a); } return;
    case 'A31': { const seats=g.ordered().filter(x=>x.hand.length===5); if(!seats.length)yield* g.draw(a); else for(const x of seats)yield* g.draw(a,x.id); return; }
    case 'A32': g.setStatus(a,'hidden'); return;
    case 'A33': { if(!t)return; const type=(yield* g.ask(a,'Nomina il tipo da rubare',types))[0]; const matches=g.player(t).hand.filter(c=>CARD_BY_ID[c].type===type); if(matches.length)yield* g.steal(a,t,1,false,g.rng.pick(matches)); else { const c=yield* pickHand(a); if(c)yield* g.give(a,t,[c]); } return; }
    case 'A34': if(t&&(p.stolenBy.get(t)??-1)>=p.previousStart)yield* g.steal(a,t); else yield* g.draw(a,a,1,true); return;
    case 'A35': { const ts=p.hand.filter(c=>CARD_BY_ID[c].type==='TRAPPOLA'); if(ts.length) { const c=(yield* g.ask(a,'Arma una trappola ausiliaria',cards(g,ts)))[0]; yield* g.arm(a,c,true); } yield* g.draw(a); return; }
    case 'A36': { const ts=g.traps.filter(x=>x.owner===t); if(!ts.length) { yield* g.mainDraw(a); return; } const order=(yield* g.ask(a,'Sospendi uno slot coperto',ts.map((x,i)=>({id:String(x.order),label:`Trappola ${i+1}`}))))[0]; const trap=ts.find(x=>String(x.order)===order)!;trap.suspended=g.turnNumber+g.players.length;trap.releaseOwner=a;trap.releaseTurn=p.turns+1; return; }
    case 'A37': { if(!t)return; const answers=yield* g.simultaneous('Proposta indecente: scambio o rifiuto?',[p,g.player(t)],()=>[{id:'SCAMBIO',label:'SCAMBIO'},{id:'RIFIUTO',label:'RIFIUTO'}]); if(answers[a]?.[0]==='SCAMBIO'&&answers[t]?.[0]==='SCAMBIO'&&p.hand.length&&g.player(t).hand.length)yield* g.exchange(a,a,t,g.rng.pick(p.hand),g.rng.pick(g.player(t).hand)); else { yield* g.draw(a); yield* g.draw(a,t); } return; }
    case 'A38': { const c=yield* pickHand(a); if(c)yield* g.deposit(a,a,c); return; }
    case 'A39': { if(!t)return; const c=yield* pickHand(a); if(c) { yield* g.give(a,t,[c]); if(g.player(t).hand.includes(c))g.player(t).giftLock.set(c,g.player(t).turns+1); } return; }
    case 'A40': { if(!t)return; const viewed=[...g.player(t).hand]; if(!(yield* g.reveal(a,t,viewed)))return; if(viewed.length&&(yield* g.option(a,'Rivela una carta o pesca',['RIVELA','PESCA']))==='RIVELA') { const c=(yield* g.ask(a,'Quale carta riveli?',cards(g,viewed)))[0]; yield* g.reveal(a,t,[c],true); } else yield* g.draw(a); return; }
    case 'C01': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const lowest=[...seats].sort((x,y)=>x.hand.length-y.hand.length)[0]; const donors=seats.filter(x=>x.hand.length>=5); const choices=yield* g.simultaneous('Consegna una carta al giocatore con meno carte',donors,x=>g.handOptions(x.id,true)); for(const x of donors)yield* g.give(x.id,lowest.id,choices[x.id]??[],false); return; }
    case 'C02': g.blackout(1); return;
    case 'C03': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const sizes=seats.map(x=>x.hand.length); const all=g.rng.shuffle(seats.flatMap(x=>x.hand)); g.atomic(()=>{for(const c of all)g.move(c,g.temp); for(let i=0;i<seats.length;i++) for(let j=0;j<sizes[i];j++)g.move(all.shift()!,seats[i].hand);}); g.note('Identità delle mani cambiate; conteggi conservati.','exchange'); return; }
    case 'C04': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const votes=yield* g.simultaneous('Gogna: vota un altro giocatore',seats,x=>seats.filter(y=>y.id!==x.id).map(y=>({id:y.id,label:y.name}))); const counts=new Map<string,number>(); Object.values(votes).forEach(v=>counts.set(v[0],(counts.get(v[0])??0)+1)); const max=Math.max(...counts.values()); const winners=seats.filter(x=>counts.get(x.id)===max); for(const x of winners)yield* discardOne(x.id,winners.length===1?2:1); return; }
    case 'C05': { const offer=g.take(4); for(const c of offer)g.note(`Mercatino: ${CARD_BY_ID[c].name}`,'reveal',c); if(!offer.length)return; const own=(yield* g.ask(a,'Prendi una carta dal mercatino',cards(g,offer)))[0]; g.move(own,p.hand); for(const c of offer.filter(c=>c!==own)) { const to=yield* getTarget(); if(to)yield* g.give(a,to,[c]);if(g.temp.includes(c))g.move(c); } return; }
    case 'C06': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const chosen=yield* g.simultaneous('Scarta una RISPOSTA se la possiedi',seats,x=>cards(g,x.hand.filter(c=>CARD_BY_ID[c].type==='RISPOSTA'))); for(const x of seats) { if(chosen[x.id])yield* g.discardCards(a,x.id,chosen[x.id]); yield* g.draw(a,x.id); } return; }
    case 'C07': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const votes=yield* g.simultaneous('Processo: accusa o copri?',seats,()=>[{id:'ACCUSA',label:'ACCUSA'},{id:'COPRE',label:'COPRE'}]); const covering=seats.filter(x=>votes[x.id]?.[0]==='COPRE'); if(covering.length===seats.length) { for(const x of seats)yield* g.draw(a,x.id); } else for(const x of seats.filter(x=>votes[x.id]?.[0]==='ACCUSA')) { const candidates=covering.filter(y=>y.hand.length); const to=yield* g.target(x.id,'Da chi rubi?',candidates); if(to)yield* g.steal(x.id,to); } return; }
    case 'C08': g.fastRound(); return;
    case 'C09': { const one=yield* g.target(a,'Primo giocatore del colpo di stato',g.ordered().filter(x=>!g.immune(x.id))); const two=yield* g.target(a,'Secondo giocatore del colpo di stato',g.ordered().filter(x=>!g.immune(x.id)).filter(x=>x.id!==one)); if(one&&two) { const x=g.player(one),y=g.player(two); g.atomic(()=>{const hand=x.hand;x.hand=y.hand;y.hand=hand;}); x.declaredAt=null;y.declaredAt=null; g.note('Due mani interamente scambiate.','exchange',undefined,one,two); } return; }
    case 'C10': { const sorted=[...g.ordered().filter(x=>!g.immune(x.id))].sort((x,y)=>y.hand.length-x.hand.length); const high=sorted[0], low=[...g.ordered().filter(x=>!g.immune(x.id))].sort((x,y)=>x.hand.length-y.hand.length)[0]; yield* discardOne(high.id); yield* g.draw(a,low.id,2); return; }
    case 'C11': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const answers=yield* g.simultaneous('Scarta una carta o rivela tutte le AZIONI',seats,x=>x.hand.length?[{id:'SCARTA',label:'SCARTA'},{id:'RIVELA',label:'RIVELA'}]:[{id:'RIVELA',label:'RIVELA'}]); for(const x of seats)if(answers[x.id]?.[0]==='SCARTA')yield* discardOne(x.id);else yield* g.reveal(a,x.id,x.hand.filter(c=>CARD_BY_ID[c].type==='AZIONE'),true); return; }
    case 'C12': { const seats=g.ordered().filter(x=>!g.immune(x.id)).filter(x=>g.traps.some(t=>t.owner===x.id)); for(const x of seats) { const ts=g.traps.filter(t=>t.owner===x.id); const trap=(yield* g.ask(x.id,'Scegli una tua trappola',cards(g,ts.map(t=>t.id))))[0]; const opt=x.hand.length?yield* g.option(x.id,'Riprendi la trappola o scarta dalla mano',['RIPRENDI','SCARTA']):'RIPRENDI'; if(opt==='SCARTA')yield* discardOne(x.id);else g.move(trap,x.hand); } return; }
    case 'C13': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const hands=seats.map(x=>[...x.hand]); g.atomic(()=>{for(const h of hands)for(const c of h)g.move(c,g.temp); hands.forEach((h,i)=>h.forEach(c=>g.move(c,seats[(i+1)%seats.length].hand)));}); seats.forEach(x=>x.declaredAt=null); g.note('Tutte le mani passate al posto successivo.','exchange'); return; }
    case 'C15': for(const x of g.ordered().filter(x=>!g.immune(x.id)))if(x.hand.length>5) { yield* discardOne(x.id,x.hand.length-5); x.declaredAt=null; x.resetLocked=true; } return;
    // Carte originali dei cinque amici: handler dedicati, non reskin di PESCA.
    case 'PG01': { const type=(yield* g.ask(a,'Tipo da recuperare',types))[0]; const opts=g.discard.slice(-5).filter(c=>CARD_BY_ID[c].type===type); if(!opts.length)return; const take=(yield* g.ask(a,'Carta da recuperare',cards(g,opts)))[0]; const pay=yield* pickHand(a); if(pay) { g.move(pay,g.deck); if(g.discard.includes(take))g.move(take,p.hand); } return; }
    case 'PG02': yield* g.draw(a,a,g.rivals(a).every(x=>p.hand.length<x.hand.length)?2:1,!g.rivals(a).every(x=>p.hand.length<x.hand.length)); return;
    case 'PG05': { const seats=g.ordered().filter(x=>!g.immune(x.id)).filter(x=>x.hand.length); const picked=yield* g.simultaneous('Patch: scegli una carta da mettere al fondo',seats,x=>g.handOptions(x.id,true)); for(const x of seats)for(const c of picked[x.id]??[])g.move(c,g.deck); for(const x of seats)yield* g.draw(a,x.id); return; }
    case 'PB01': if(t) { const c=yield* pickHand(t); if(c) { if((yield* g.option(t,'Documento: mostra in privato o scarta',['MOSTRA','SCARTA']))==='MOSTRA')yield* g.reveal(a,t,[c]);else yield* g.discardCards(a,t,[c]); } } return;
    case 'PB02': g.setStatus(a,'drawThree'); return;
    case 'PB05': { const seats=g.ordered().filter(x=>!g.immune(x.id)).filter(x=>g.traps.some(t=>t.owner===x.id)); const decisions=yield* g.simultaneous('Buttafuori: perdi una trappola o paga due carte',seats,x=>x.hand.length>=2?[{id:'TRAPPOLA',label:'TRAPPOLA'},{id:'DUE',label:'DUE CARTE'}]:[{id:'TRAPPOLA',label:'TRAPPOLA'}]); for(const x of seats)if(decisions[x.id]?.[0]==='DUE')yield* discardOne(x.id,2);else { const trap=(yield* g.ask(x.id,'Quale trappola espelli?',cards(g,g.traps.filter(t=>t.owner===x.id).map(t=>t.id))))[0]; if(trap)g.move(trap); } return; }
    case 'PV01': { const type=(yield* g.ask(a,'Prevedi il tipo',types))[0]; const offer=g.take(); if(!offer.length)return; const c=offer[0]; g.note(`Previsione: ${CARD_BY_ID[c].name}`,'reveal',c); if(CARD_BY_ID[c].type===type) { if((yield* g.option(a,'Hai indovinato: tieni o scarta?',['TIENI','SCARTA']))==='TIENI')g.move(c,p.hand);else g.move(c); } else { g.move(c); const to=yield* getTarget(); if(to)yield* g.draw(a,to); } return; }
    case 'PV02': { const opts=g.handOptions(a); const selected=yield* g.ask(a,'Scarta zero, una o due carte prima di pescare',opts,0,Math.min(2,opts.length)); yield* g.discardCards(a,a,selected,false); yield* g.draw(a); return; }
    case 'PV05': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const answers=yield* g.simultaneous('Pausa: pesca oppure riprendi una trappola',seats,x=>[{id:'PESCA',label:'PESCA UNA'},...(g.traps.some(t=>t.owner===x.id)?[{id:'TRAPPOLA',label:'RIPRENDI TRAPPOLA'}]:[])]); for(const x of seats)if(answers[x.id]?.[0]==='TRAPPOLA') { const c=(yield* g.ask(x.id,'Quale trappola riprendi?',cards(g,g.traps.filter(t=>t.owner===x.id).map(t=>t.id))))[0]; if(c)g.move(c,x.hand); } else yield* g.draw(a,x.id); return; }
    case 'PC01': if(t) { const opt=g.player(t).hand.length?yield* g.option(t,'Granita: deposita una carta o pesca',['DEPOSITO','PESCA']):'PESCA'; if(opt==='DEPOSITO') { const c=yield* pickHand(t); if(c)yield* g.deposit(a,t,c); }else yield* g.draw(a,t); } return;
    case 'PC02': { if(!t)return; const ts=g.traps.filter(x=>x.owner===t); if(!ts.length)return; const pay=yield* pickHand(a); const order=(yield* g.ask(a,'Scegli la trappola coperta da scambiare',ts.map((x,i)=>({id:String(x.order),label:`Slot ${i+1}`}))))[0]; const trap=ts.find(x=>String(x.order)===order); if(pay&&trap) { const e=g.event('Exchange',a,t,{cards:[pay,trap.id]});yield* g.before(e);if(!e.cancel)g.atomic(()=>{g.move(trap.id,p.hand);g.move(pay,g.player(t!).hand);});yield* g.after(e); } return; }
    case 'PC05': { const seats=g.ordered().filter(x=>!g.immune(x.id)); const votes=yield* g.simultaneous('Casa mia: riempi o svuota?',seats,()=>[{id:'RIEMPI',label:'RIEMPI'},{id:'SVUOTA',label:'SVUOTA'}]); const yes=Object.values(votes).filter(v=>v[0]==='RIEMPI').length; const fill=yes>seats.length/2||(yes===seats.length/2&&votes[a]?.[0]==='RIEMPI');for(const x of seats)if(fill)yield* g.draw(a,x.id);else yield* discardOne(x.id); return; }
    case 'PI01': case 'PI02': { if(!t)return; const offer=yield* pickHand(a);if(!offer)return;g.move(offer,g.temp); const opt=yield* g.option(t,`${CARD_BY_ID[offer].name}: accetti il dono?`,['ACCETTA','RIFIUTA']);if(opt==='ACCETTA'){yield* g.give(a,t,[offer]);if(id==='PI01')yield* g.draw(a,t);}else{g.move(offer,p.hand);yield* g.draw(a,a,id==='PI01'?2:1);}if(g.temp.includes(offer))g.move(offer,p.hand);return; }
    case 'PI05': { const seats=g.ordered().filter(x=>!g.immune(x.id));const votes=yield* g.simultaneous('Il conto: pago o scappo?',seats,()=>[{id:'PAGO',label:'PAGO'},{id:'SCAPPO',label:'SCAPPO'}]);const any=Object.values(votes).some(v=>v[0]==='PAGO');for(const x of seats)if(votes[x.id]?.[0]==='PAGO')yield* discardOne(x.id);else if(any)yield* g.draw(a,x.id);else x.debts.push({kind:'discard',due:x.turns+1,count:1});return; }
    default: throw Error(`Effetto principale assente: ${id}`);
  }
}

export function responseEligible(id: string, p: string, e: GameEvent, g: GoblinGame): boolean {
  const own=e.target===p, other=e.actor!==p; const player=g.player(p);
  switch(id) {
    case 'R01': return e.kind==='Action'&&own&&other;
    case 'R02': return own&&other&&['Draw','Discard'].includes(e.kind)||e.kind==='Transfer'&&e.actor===p&&e.effectActor!==p&&!e.deferred;
    case 'R03': case 'R09': return e.kind==='Steal'&&own&&other;
    case 'R04': return own&&other&&['Discard','Steal','Deposit'].includes(e.kind);
    case 'R05': return e.kind==='Declare'&&other;
    case 'R06': return e.kind==='Trap'&&own&&other;
    case 'R07': return e.kind==='Action'&&CARD_BY_ID[e.card??'']?.type==='CATASTROFE';
    case 'R08': return (e.kind==='Status'||e.kind==='Action')&&own&&other&&['A19','A15'].includes(e.source??'');
    case 'R10': return e.kind==='Draw'&&e.target!==p&&(e.count??0)>=3;
    case 'R11': return e.kind==='Response'&&!e.copy&&e.response!=='R11'&&e.actor!==p;
    case 'R12': return (own&&['Discard','Steal','Deposit'].includes(e.kind)||e.kind==='Transfer'&&e.actor===p)&&(e.count??1)>=player.hand.length-1&&player.hand.length>=1;
    case 'R13': return e.kind==='Action'&&own&&other;
    case 'R14': return e.kind==='Reveal'&&own&&other&&!e.public;
    case 'R15': return e.kind==='Gain'&&other&&e.target!==p&&CARD_BY_ID[e.source??'']?.type==='AZIONE';
    case 'R16': return e.kind==='Extra'&&other;
    case 'R17': return e.kind==='Arm'&&other;
    case 'R18': return e.kind==='Deposit'&&own&&other;
    case 'R19': return e.kind==='RandomTarget';
    case 'R20': return e.kind==='Reveal'&&own&&other&&!!e.public;
    case 'PG04': return e.kind==='Discard'&&own&&other&&e.count===1&&!e.deferred;
    case 'PB04': return e.kind==='Action'&&own&&other;
    case 'PV04': return e.kind==='Reveal'&&own&&other&&!!e.public;
    case 'PC04': return e.kind==='Extra'&&other;
    case 'PI04': return (own&&other&&e.kind==='Discard'||e.kind==='Transfer'&&e.actor===p&&e.effectActor!==p&&!e.deferred)&&(e.count??0)>=2;
    default:return false;
  }
}
export function* responseEffect(id: string, p: string, e: GameEvent, g: GoblinGame): Flow {
  switch(id) {
    case 'R01': case 'R04': case 'R06': e.cancel=true; if(id==='R04'&&g.player(e.actor).hand.length)yield* g.reveal(p,e.actor,random(g,g.player(e.actor).hand),true); return;
    case 'R02':if(e.kind==='Transfer'){e.actor=e.effectActor!;e.cards=yield* g.selectCard(e.actor,'Consegna riflessa',e.count??1);}else e.target=e.actor; return;
    case 'R03': e.cancel=true;yield* g.draw(p);return;
    case 'R05': yield* g.draw(p,e.actor);return;
    case 'R07': e.used.push(`immune:${p}`);g.exclude(p);return;
    case 'R08': e.cancel=true;g.setStatus(e.actor,'short');return;
    case 'R09': e.chooseLoss=true;return;
    case 'R10': e.reduced=(e.reduced??0)+2;yield* g.draw(p);return;
    case 'R11': { if(!e.copy&&e.response&&e.response!=='R11'&&e.origin){yield* responseEffect(e.response,p,e.origin,g);}return; }
    case 'R12': e.cancel=true;yield* g.draw(p);return;
    case 'R13': { const to=yield* g.target(p,'Nuovo bersaglio',g.ordered().filter(x=>x.id!==p));if(to)e.target=to;return; }
    case 'R14': e.cancel=true;yield* g.reveal(p,e.actor,random(g,g.player(e.actor).hand));return;
    case 'R15': if(e.card&&g.temp.includes(e.card)){g.move(e.card,g.player(p).hand);e.cancel=true;}return;
    case 'R16': e.cancel=true;yield* g.draw(p);return;
    case 'R17': if(e.card) { yield* g.reveal(p,e.actor,[e.card]);if((yield* g.option(p,'Rimandi la trappola in mano?',['SÌ','NO']))==='SÌ'){e.cancel=true;e.keepArmedCard=true;} }return;
    case 'R18': e.cancel=true;yield* g.lose(p,e.actor,1,true);return;
    case 'R19': if(e.cards?.length)e.card=g.rng.pick(e.cards);else e.target=g.rng.pick(g.ordered()).id;return;
    case 'R20': e.cancel=true;yield* g.reveal(p,e.actor,random(g,g.player(e.actor).hand),true);return;
    case 'PG04': e.cancel=true;yield* g.draw(p);return;
    case 'PB04': if(g.player(e.actor).hand.length&&(yield* g.option(e.actor,'Paga una carta o annulla la tua AZIONE',['ANNULLA','PAGA']))==='PAGA')yield* g.lose(e.actor,e.actor);else e.cancel=true;return;
    case 'PV04': e.hide=true;e.public=false;return;
    case 'PC04': if(g.player(e.actor).hand.length>=2&&(yield* g.option(e.actor,'Paga due carte per conservare il turno extra',['ANNULLA','PAGA']))==='PAGA')yield* g.lose(e.actor,e.actor,2);else e.cancel=true;return;
    case 'PI04': e.reduced=(e.reduced??0)+1;return;
    default:throw Error(`RISPOSTA non implementata ${id}`);
  }
}

export function trapMatches(id: string, p: string, e: GameEvent, when: 'before'|'after', g: GoblinGame): boolean {
  const other=e.actor!==p, own=e.target===p; const before=when==='before'; const target=g.player(e.target);
  switch(id) {
    case 'T01':return !before&&e.kind==='Steal'&&own&&other&&!!e.cards?.length;
    case 'T02':case 'PG03':return before&&e.kind==='DrawChoice'&&other&&!!e.cards?.some(c=>c!==e.card&&g.temp.includes(c));
    case 'T03':return !before&&e.kind==='Declare'&&other&&target.hand.length>0;
    case 'T04':return !before&&e.kind==='HandChanged'&&e.target!==p&&(e.previousCount??0)<=5&&(e.newCount??0)>5;
    case 'T05':return !before&&e.kind==='Reveal'&&other&&!e.public&&g.player(e.actor).hand.length>0;
    case 'T06':return before&&e.kind==='Arm'&&other;
    case 'T07':return !before&&e.kind==='Discard'&&e.target!==p&&e.cards?.length===1&&g.discard.includes(e.cards[0]);
    case 'T08':return before&&e.kind==='Discard'&&own&&other&&!e.deferred&&g.player(e.actor).hand.length>0;
    case 'T09':return !before&&e.kind==='Cancel'&&other;
    case 'T10':return before&&e.kind==='Transfer'&&other&&e.target!==p&&!!e.cards?.length;
    case 'T11':return before&&e.kind==='Start'&&other&&target.declaredAt!==null;
    case 'T12':return before&&e.kind==='Extra'&&other;
    case 'T13':return !before&&e.kind==='Reveal'&&other&&!e.public;
    case 'T14':case 'PB03':return before&&e.kind==='Transfer'&&other&&e.target!==p&&!!e.deferred&&!!e.cards?.length;
    case 'T15':return !before&&e.kind==='HandChanged'&&e.target!==p&&(e.previousCount??0)>1&&e.newCount===1;
    case 'T16':return !before&&e.kind==='Discard'&&e.target!==p&&(e.cards?.length??0)>=2&&!!e.cards?.some(c=>g.discard.includes(c));
    case 'T17':return !before&&e.kind==='Action'&&own&&other;
    case 'T18':return !before&&e.kind==='End'&&other&&target.hand.length===4;
    case 'T19':return before&&e.kind==='Status'&&e.source==='A22'&&other;
    case 'T20':return !before&&e.kind==='HandChanged'&&e.target!==p&&(e.newCount??0)>(e.previousCount??0)&&CARD_BY_ID[e.source??'']?.type==='TRAPPOLA';
    case 'T21':return before&&e.kind==='Action'&&other&&(CARD_BY_ID[e.card??'']?.type==='CATASTROFE'||['A08','A29','A31'].includes(e.card??''));
    case 'T22':return before&&e.kind==='Return'&&other;
    case 'T23':return !before&&e.kind==='Action'&&other&&!!e.lastCard;
    case 'T24':return !before&&e.kind==='Draw'&&other&&(e.count??0)>=2&&CARD_BY_ID[e.source??'']?.type==='AZIONE'&&!!e.cards?.length;
    case 'T25':return !before&&e.kind==='Exchange'&&other&&e.cards?.length===2;
    case 'PV03':return !before&&e.kind==='End'&&other&&target.hand.length===5;
    case 'PC03':return !before&&e.kind==='End'&&other&&target.hand.length===3;
    case 'PI03':return !before&&e.kind==='Steal'&&own&&other&&!!e.cards?.length;
    default:return false;
  }
}
export function* trapEffect(id: string, p: string, e: GameEvent, g: GoblinGame): Flow {
  switch(id) {
    case 'T01':for(const c of e.cards??[])if(g.player(e.actor).hand.includes(c))yield* g.give(e.actor,p,[c],false);yield* g.steal(p,e.actor);return;
    case 'T02': { const c=e.cards?.find(c=>c!==e.card&&g.temp.includes(c));if(c)g.move(c,g.player(p).hand);return; }
    case 'T03':case 'T11':yield* g.steal(p,e.actor);return;
    case 'T04':yield* g.lose(p,e.kind==='Steal'?e.actor:e.target);return;
    case 'T05': { const drawn=random(g,g.player(e.actor).hand);yield* g.reveal(p,e.actor,drawn,true);yield* g.discardCards(p,e.actor,drawn);return; }
    case 'T06':e.cancel=true;yield* g.draw(p);return;
    case 'T07':if(e.cards?.[0]&&g.discard.includes(e.cards[0]))g.move(e.cards[0],g.player(p).hand);return;
    case 'T08':e.target=e.actor;return;
    case 'T09':yield* g.lose(p,e.actor,1,true);return;
    case 'T10':e.target=p;return;
    case 'T12':e.cancel=true;yield* g.lose(p,e.actor);return;
    case 'T13': { const drawn=yield* g.draw(p);yield* g.reveal(p,p,drawn,false);g.player(e.actor).info.push({title:'Carta del curioso',cards:drawn});return; }
    case 'T14':e.cancel=true;yield* g.draw(p);return;
    case 'T15': { const drawn=g.take();if(drawn.length){yield* g.give(p,e.kind==='Transfer'?e.actor:e.target,drawn,false);for(const c of drawn)if(g.temp.includes(c))g.move(c);}return; }
    case 'T16': { const avail=e.cards?.filter(c=>g.discard.includes(c))??[];if(avail.length)g.move(g.rng.pick(avail),g.player(p).hand);return; }
    case 'T17':g.player(p).noTarget.set(e.actor,g.player(e.actor).turns+1);return;
    case 'T18':yield* g.draw(p,e.actor,2);return;
    case 'T19':e.target=e.actor;return;
    case 'T20':yield* g.lose(p,e.kind==='Steal'?e.actor:e.target,1,true);return;
    case 'T21':if(g.player(e.actor).hand.length&&(yield* g.option(e.actor,'Paga la multa per effetto multiplo',['PAGA','ANNULLA']))==='PAGA')yield* g.lose(e.actor,e.actor);else e.cancel=true;return;
    case 'T22':if(e.card&&g.deposits.some(d=>d.id===e.card))g.move(e.card,g.deck);e.cancel=true;return;
    case 'T23':yield* g.draw(p,e.actor,2);return;
    case 'T24': { const avail=e.cards?.filter(c=>g.player(e.target).hand.includes(c))??[];const c=(yield* g.ask(e.target,'Consegna una delle carte appena pescate',cards(g,avail)))[0];if(c)yield* g.give(e.target,p,[c],false);return; }
    case 'T25': { const choices=(e.cards??[]).filter(c=>g.players.some(x=>x.hand.includes(c)));const c=(yield* g.ask(p,'Intercetta una carta dello scambio',cards(g,choices)))[0];if(c) { const owner=g.players.find(x=>x.hand.includes(c))!;yield* g.steal(p,owner.id,1,false,c); }return; }
    case 'PG03':for(const c of e.cards??[])if(c!==e.card&&g.temp.includes(c))g.move(c,g.player(e.actor).hand);return;
    case 'PB03':for(const c of e.cards??[])if(g.player(e.actor).hand.includes(c)||g.temp.includes(c))g.move(c);e.cancel=true;return;
    case 'PV03':for(const x of g.ordered())if(x.id!==e.actor)yield* g.draw(p,x.id);return;
    case 'PC03':if(g.player(e.actor).hand.length===3)yield* g.lose(p,e.actor);return;
    case 'PI03':g.player(e.actor).debts.push({kind:'give',due:g.player(e.actor).turns+1,count:1,to:p});return;
    default:throw Error(`TRAPPOLA non implementata ${id}`);
  }
}
