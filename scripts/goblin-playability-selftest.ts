import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {GoblinGame} from '../server/goblinTime/core';
import {GT} from '../shared/goblinTime/catalog';
import {abilityFor} from '../shared/abilityCatalog';
import {clockText,eventLabel,tableInstruction} from '../shared/goblinTime/presentation';
import type {Command} from '../shared/goblinTime/types';
let checks=0;const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const seats=[{id:'a',name:'Goblin',characterId:'goblin'},{id:'b',name:'Boschi',characterId:'buttafuori'}];
const send=(g:GoblinGame,id:string,op:Command['op'],values?:string[])=>g.command(id,{roundId:g.roundId,matchId:g.matchId,version:g.version,requestId:'test-'+checks+'-'+g.version,op,...(values?{choiceId:g.pending!.id,values}:{} )});
ok(GT.main===60&&GT.choice===60&&GT.reaction===60,'un minuto per tutte le scelte normali');
ok(abilityFor('goblinTime','goblin')!.p.window===60,'anche la scelta dopo la pesca del Goblin dura un minuto');
{
 const g=new GoblinGame(1,seats,'personal',123);
 // Mani neutre: il test dei tempi non deve aprire una risposta casuale da una carta distribuita.
 for(const p of g.players)for(const card of [...p.hand])g.move(card,g.deck);
 for(const card of ['A01','A03'])g.move(card,g.player('a').hand);for(const card of ['A04','A06'])g.move(card,g.player('b').hand);
 ok(g.publicState().remaining===60,'turno parte da 60');g.tick(55);ok(g.turnNumber===1&&g.publicState().remaining===5,'non passa da solo a 12 secondi');
 g.paused=true;g.tick(200);ok(g.clock===55&&g.publicState().remaining===5,'pausa conserva tempo');g.paused=false;
 g.tick(4);ok(g.phase==='main','turno ancora attivo a 59 secondi');g.tick(1.05);
 ok(g.phase==='choice'&&g.privateState('a').choice!.remaining===60,'scelta della pesca parte da 60');
 ok(g.publicState().waitingFor?.join()==='a'&&!g.privateState('b').choice,'attesa pubblica indica solo chi deve scegliere');
 ok(!JSON.stringify(g.publicState()).includes('options')&&!('hand' in g.publicState().players[0]),'nessuna opzione o mano privata sulla TV');
 g.tick(55);ok(g.privateState('a').choice!.remaining===5,'scelta non scade dopo i vecchi 12 secondi');
 const first=g.privateState('a').choice!;ok(send(g,'a','choose',[first.options[0].id]).ok,'conferma immediata valida');
 ok(Math.abs(g.privateState('a').choice!.remaining-60)<1e-8,'abilità dopo pesca ha 60 secondi');
 ok(send(g,'a','choose',['confirm']).ok&&g.phase==='main'&&g.active.id==='b','conferma prosegue subito senza attendere');
}
{
 const g=new GoblinGame(2,seats,'base',321);g.move('R01',g.player('b').hand);
 (g as unknown as {run:(f:ReturnType<GoblinGame['reactions']>)=>void}).run(g.reactions(g.event('Action','a','b')));
 const c=g.privateState('b').choice!;ok(c.kind==='reaction'&&c.remaining===60,'risposta da 60 secondi');
 ok(c.title==='Carta giocata: Goblin → Boschi','evento tradotto in italiano');
 g.tick(59);ok(g.phase==='reaction'&&g.privateState('b').choice!.remaining===1,'risposta conserva il minuto intero');
 g.paused=true;g.tick(50);ok(g.privateState('b').choice!.remaining===1,'pausa della risposta');g.paused=false;
 g.tick(1.01);ok(g.phase==='main'&&!g.pending,'scadenza della risposta passa senza usare carta');
 ok(g.player('b').hand.includes('R01'),'carta risposta non consumata automaticamente');
}
ok(clockText(60)==='1:00'&&clockText(60.000000000001)==='1:00'&&clockText(12)==='0:12'&&clockText(-1)==='0:00','timer leggibile senza arrotondare 60 a 61');
ok(eventLabel('HandChanged')==='Mano cambiata','nessuna etichetta tecnica inglese');
const state=new GoblinGame(3,seats).publicState();
ok(tableInstruction({...state,phase:'choice',waitingFor:['b']}).detail.includes('Boschi'),'istruzione nomina chi deve scegliere');
ok(tableInstruction({...state,shortTurn:true}).detail.includes('accorciato'),'effetto carta sul turno breve spiegato');
writeFileSync('docs/agent-work/playability-performance/goblin-timing.json',JSON.stringify({checks,main:GT.main,choice:GT.choice,reaction:GT.reaction,goblinAbilitySeconds:60,privacy:true,pause:true,immediateConfirm:true},null,2));console.log(`GOBLIN TEMPI: ${checks} verifiche superate.`);
