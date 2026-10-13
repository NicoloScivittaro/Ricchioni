import { CARD_BY_ID } from '../../shared/goblinTime/catalog';
import { cardArt, htmlEscape as esc, TYPE_COLOR } from '../../shared/goblinTime/art';
import type { Command, CommandAck, PrivateState } from '../../shared/goblinTime/types';
import { portraitCss } from '../../shared/characterPresentation';

export function mountGoblin(root:HTMLElement,send:(command:Command,cb:(ack:CommandAck)=>void)=>void):{update:(data:PrivateState)=>void;destroy:()=>void} {
  let serial=0;
  let state:PrivateState|null=null, selected:string|null=null, values:string[]=[],key='',busy=false,received=performance.now(),error='';
  root.innerHTML='<div class="gt-phone"><h1>GOBLIN TIME</h1><p>Il tavolo si sta preparando… guarda la TV.</p></div>';
  const command=(op:Command['op'], extra:Partial<Command>={})=>{
    if(!state||busy)return;busy=true;error='';
    const request:Command={roundId:state.roundId,matchId:state.matchId,version:state.version,requestId:Date.now().toString(36)+'-'+(++serial).toString(36)+'-'+Math.random().toString(36).slice(2),op,...extra};
    render();send(request,ack=>{busy=false;if(!ack.ok)error=ack.error??'Riprova';render();});
  };
  const card=(id:string,active=false)=>{const c=CARD_BY_ID[id];return `<button type="button" class="gt-card${active?' selected':''}" data-card="${id}" style="--card-color:${TYPE_COLOR[c.type]}"><span class="gt-card-kind">${c.type} · ${id}</span><strong>${esc(c.name)}</strong>${cardArt(id)}<span>${esc(c.shortEffect??c.effect)}</span></button>`;};
  function render():void {
    if(!state)return;
    const handScroll=root.querySelector('.gt-hand')?.scrollLeft??0;
    const open=new Set([...root.querySelectorAll<HTMLDetailsElement>('details[open]')].map(d=>d.querySelector('summary')?.textContent?.split('·')[0]));
    const s=state,p=s.table.players.find(p=>p.id===s.playerId)!;const active=s.table.players.find(p=>p.id===s.table.turn)!;const choice=s.choice;
    root.innerHTML=`<div class="gt-phone"><header><div style="${portraitCss(p.characterId,44)}"></div><div><span class="gt-kicker">GOBLIN TIME · ${s.table.mode==='base'?'100 CARTE':'NOI CINQUE · 125'}</span><h1>${esc(p.name)}</h1></div><span class="gt-clock">${Math.ceil(choice?.remaining??s.table.remaining)} s</span></header><div class="gt-status">${s.table.phase==='finished'?esc(s.table.endReason??'Partita conclusa'):s.table.paused?'PARTITA IN PAUSA':choice?esc(choice.title):s.table.turn===s.playerId?'TOCCA A TE':`Turno di ${esc(active.name)}`}<small>${s.hand.length} carte · ${s.traps.length} trappole · ${s.deposits.length} in deposito</small></div><div class="gt-error" role="status">${esc(error)}</div>
    ${choice?`<section class="gt-decision${choice.kind==='reaction'?' reaction':''}"><h2>${choice.kind==='reaction'?'PUOI REAGIRE':'LA TUA SCELTA'}</h2><p>${esc(choice.title)}</p>${choice.ordered?'<small>Tocca nell’ordine desiderato: la prima scelta va in cima.</small>':''}<div class="gt-options">${choice.options.map(o=>`<button type="button" data-option="${esc(o.id)}" class="${values.includes(o.id)?'chosen':''}" ${busy?'disabled':''}>${choice.ordered&&values.includes(o.id)?`${values.indexOf(o.id)+1}. `:''}${o.cardId?cardArt(o.cardId):''}${esc(o.label)}</button>`).join('')}</div><button type="button" class="gt-primary" data-op="choose" ${busy||values.length<choice.min||values.length>choice.max?'disabled':''}>CONFERMA${values.length?` · ${values.length}`:''}</button></section>`:''}
    <div class="gt-actions"><button data-op="draw" ${!s.canDraw||busy?'disabled':''}>PESCA</button><button data-op="declare" class="gt-declare" ${!s.canDeclare||busy?'disabled':''}>GOBLIN TIME!</button></div><h2>LA TUA MANO <span>privata · ${s.hand.length}</span></h2><div class="gt-hand">${s.hand.map(c=>card(c,c===selected)).join('')||'<p>Mano vuota. Puoi ancora rientrare!</p>'}</div>
    ${selected&&s.hand.includes(selected)?`<section class="gt-detail"><h2>${esc(CARD_BY_ID[selected].name)}</h2><p>${esc(CARD_BY_ID[selected].effect)}</p>${CARD_BY_ID[selected].quote?`<blockquote>«${esc(CARD_BY_ID[selected].quote!)}»</blockquote>`:''}<div class="gt-actions"><button data-op="play" ${!s.playable.includes(selected)||busy?'disabled':''}>GIOCA</button><button data-op="arm" ${!s.armable.includes(selected)||busy?'disabled':''}>ARMA COPERTA</button></div>${!s.playable.includes(selected)&&!s.armable.includes(selected)?'<small>Questa carta non è giocabile adesso. Le RISPOSTE si usano nella relativa finestra.</small>':''}</section>`:''}
    <details class="gt-detail"><summary>⭐ ${esc(s.ability.name)} · ${s.ability.used?'ESAURITA':s.ability.available?'PRONTA':'ATTENDI LA FINESTRA'}</summary><p>${esc(s.ability.full)}</p><button data-op="ability" ${!s.ability.available||busy?'disabled':''}>USA ABILITÀ</button></details>
    ${s.traps.length?`<details class="gt-detail"><summary>Le tue trappole coperte</summary>${s.traps.map(t=>`<p>${esc(CARD_BY_ID[t.cardId].name)} ${t.suspended?'· SOSPESA':''}</p>`).join('')}</details>`:''}
    ${s.information.map(i=>`<section class="gt-info"><h2>🔒 ${esc(i.title)}</h2>${i.cards.map(c=>`<p><b>${esc(CARD_BY_ID[c].name)}</b> — ${esc(CARD_BY_ID[c].effect)}</p>`).join('')}</section>`).join('')}
    <details class="gt-detail"><summary>Il tavolo pubblico</summary>${s.table.players.map(x=>`<p>${esc(x.name)} · ${x.count??'?'} carte · ${x.traps} trappole ${x.declared?'· GOBLIN TIME!':''}</p>`).join('')}</details><p class="gt-rule">Vinci con esattamente 5 carte: dichiara e mantienile fino al tuo prossimo turno. Trappole e depositi non contano.</p></div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-card]').forEach(el=>el.onclick=()=>{selected=selected===el.dataset.card?null:el.dataset.card!;render();});
    root.querySelectorAll<HTMLButtonElement>('[data-option]').forEach(el=>el.onclick=()=>{const id=el.dataset.option!;if(values.includes(id))values=values.filter(x=>x!==id);else if(choice?.max===1)values=[id];else if(values.length<(choice?.max??1))values.push(id);render();});
    root.querySelectorAll<HTMLButtonElement>('[data-op]').forEach(el=>el.onclick=()=>{const op=el.dataset.op as Command['op'];command(op,op==='choose'?{choiceId:choice!.id,values}:op==='play'||op==='arm'?{cardId:selected!}:{});});
    const hand=root.querySelector('.gt-hand');if(hand)hand.scrollLeft=handScroll;
    root.querySelectorAll<HTMLDetailsElement>('details').forEach(d=>{if(open.has(d.querySelector('summary')?.textContent?.split('·')[0]))d.open=true;});
  }
  const interval=window.setInterval(()=>{if(!state)return;const clock=root.querySelector('.gt-clock');if(clock)clock.textContent=`${Math.max(0,Math.ceil((state.choice?.remaining??state.table.remaining)-(state.table.paused?0:(performance.now()-received)/1000)))} s`;},200);
  return {update(data){const next=`${data.matchId}:${data.choice?.id??''}`;if(next!==key){key=next;values=[];error='';}received=performance.now();const rerender=!state||state.version!==data.version||state.table.paused!==data.table.paused;state=data;if(selected&&!data.hand.includes(selected))selected=null;if(rerender)render();},destroy(){clearInterval(interval);state=null;}};
}
