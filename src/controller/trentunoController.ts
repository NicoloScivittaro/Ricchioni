import { CARDS,cardAsset } from '../../shared/trentuno/deck';
import type { Ack,Command,PrivateState } from '../../shared/trentuno/types';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function mountTrentuno(root:HTMLElement,send:(c:Command,cb:(ack:Ack)=>void)=>void){
  const oldOverflow=root.style.overflowY,oldOverscroll=root.style.overscrollBehavior;
  root.style.overflowY='auto';root.style.overscrollBehavior='contain';
  let state:PrivateState|null=null,selected='',target='',busy=false,error='',serial=0,destroyed=false;
  let entering=new Map<string,number>();
  let pending:ReturnType<typeof setTimeout>|null=null;
  function command(op:Command['op'],extra:Partial<Command>={}){
    if(!state||busy)return;busy=true;error='';render();
    const c:Command={roundId:state.roundId,matchId:state.matchId,version:state.version,requestId:`${Date.now().toString(36)}-${++serial}-${Math.random().toString(36).slice(2)}`,op,...extra};
    pending=setTimeout(()=>{if(destroyed)return;busy=false;error='Connessione lenta: controlla il tavolo e riprova.';render();},4000);
    send(c,ack=>{if(destroyed)return;if(pending)clearTimeout(pending);pending=null;busy=false;error=ack.ok?'':ack.error??'Riprova';render();});
  }
  const picture=(id:string)=>`<img src="${cardAsset(id)}" alt="${esc(CARDS[id].name)}" draggable="false">`;
  function render(){
    if(!state){root.innerHTML='<main class="t31-phone"><h1>31 DEGLI INFAMI</h1><p>Il tavolo sta distribuendo le carte…</p></main>';return;}
    const s=state,t=s.table,me=t.players.find(p=>p.id===s.playerId)!,active=t.players.find(p=>p.id===t.turn)!;
    const isCiro=me.characterId==='ciro',isDiscard=s.discardable.length>0,peeking=s.peek.length>0;
    const status=t.paused?'PARTITA IN PAUSA':t.phase==='handResult'?'MANO CONCLUSA':t.phase==='finished'?'TRE MANI · RISULTATO FINALE':s.playerId===t.turn?'È IL TUO TURNO':`Turno di ${active.name}`;
    root.innerHTML=`<main class="t31-phone"><header><div><small>PARTY GAME · MANO ${t.handNumber}/3</small><h1>31 DEGLI INFAMI</h1></div><b class="t31-unlimited">SENZA FRETTA</b></header><section class="t31-status"><b>${esc(status)}</b>${s.playerId===t.turn?`<small>${peeking?'Ordina le due carte':isDiscard?'Scegli la carta da scartare':'Pesca oppure bussa quando vuoi'}</small>`:''}<span>${esc(me.name)} · <strong>${s.score}</strong> punti ${s.hand.length===4?'provvisori':'nel miglior seme'}</span>${t.knocker?`<small>Ultimi turni: ${t.finalTurns} · ha bussato ${esc(t.players.find(p=>p.id===t.knocker)!.name)}</small>`:''}</section><p class="t31-error" role="status">${esc(error)}</p>
      ${peeking?`<section class="t31-peek"><h2>SOLO TU PUOI VEDERLE</h2><div>${s.peek.map(picture).join('')}</div><div class="t31-actions"><button data-op="order" data-reverse="false" ${busy||t.paused?'disabled':''}>MANTIENI</button><button data-op="order" data-reverse="true" ${busy||t.paused?'disabled':''}>INVERTI</button></div></section>`:''}
      <div class="t31-actions t31-turn-actions">${isDiscard?`<button class="t31-primary" data-op="discard" ${busy||!s.discardable.includes(selected)?'disabled':''}>SCARTA ${selected?esc(CARDS[selected].name):'· scegli una carta'}</button>`:`<button data-op="draw" ${!s.canDraw||busy?'disabled':''}>PESCA COPERTO</button><button data-op="take" ${!s.canTake||busy?'disabled':''}>PRENDI SCARTO</button><button data-op="knock" class="t31-knock" ${!s.canKnock||busy?'disabled':''}>BUSSA</button>`}</div>
      <section><h2>LA TUA MANO <small>privata · ${s.hand.length} carte</small></h2><div class="t31-hand ${s.hand.length===4?'four':''}">${s.hand.map(id=>`<button data-card="${id}" class="${selected===id?'selected':''} ${entering.has(id)?'t31-arrive':''}" style="--deal-delay:${entering.get(id)??0}ms" aria-label="${esc(CARDS[id].name)}${s.discardable.includes(id)?', scartabile':''}" aria-pressed="${selected===id}" ${busy?'disabled':''}>${picture(id)}<span>${esc(CARDS[id].name)} · ${CARDS[id].value} pt</span>${isDiscard&&!s.discardable.includes(id)?'<i>NON SCARTABILE ORA</i>':''}</button>`).join('')}</div></section>
      <section class="t31-ability"><h2>${esc(s.ability.name)} <small>${s.ability.used?'ESAURITA':s.ability.available?'PRONTA':'ATTENDI'}</small></h2><p>${esc(s.ability.full)}</p>${isCiro&&s.ability.available?`<label>Destinatario <select data-target><option value="">Scegli avversario</option>${t.players.filter(p=>p.id!==s.playerId).map(p=>`<option value="${esc(p.id)}" ${p.id===target?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><small>Seleziona sopra la tua carta da consegnare.</small>`:''}<button data-op="ability" ${busy||!s.ability.available||isCiro&&(!selected||!target)?'disabled':''}>USA ABILITÀ</button></section>
      <details class="t31-table"><summary>Scarto visibile e punteggi delle mani</summary>${t.discardTop?`<img class="t31-top" src="${cardAsset(t.discardTop)}" alt="${esc(CARDS[t.discardTop].name)}">`:'Nessuno scarto'}${t.blockedFor===s.playerId?'<p>Gli scarti sono bloccati per questo turno.</p>':''}${t.players.map(p=>`<p>${esc(p.name)} · ${p.points} punti delle mani · ${p.abilityUsed?'abilità usata':'abilità pronta'}</p>`).join('')}</details>
      <details class="t31-rules"><summary>Regole del tavolo</summary><p>Asso 11, figure 10, numeri 2–7 nominali. Conta soltanto il miglior seme. Non puoi scartare subito la carta appena presa dagli scarti. Bussa prima di pescare: gli altri hanno un ultimo turno. Un 31 con tre carte chiude subito. Abilità una volta nelle tre mani.</p></details>
      ${t.history.length?`<section class="t31-history"><h2>MANI RIVELATE</h2>${t.history.map(h=>`<details ${t.phase==='handResult'&&h.number===t.handNumber?'open':''}><summary>Mano ${h.number} · ${esc(h.reason)}</summary>${h.rows.map(r=>`<p>${esc(t.players.find(p=>p.id===r.playerId)!.name)}: ${r.score} · posizione ${r.placement} · +${r.points}</p><div class="t31-reveal">${r.cards.map(picture).join('')}</div>`).join('')}</details>`).join('')}</section>`:''}</main>`;
    entering.clear();
    root.querySelectorAll<HTMLButtonElement>('[data-card]').forEach(el=>el.onclick=()=>{selected=selected===el.dataset.card?'':el.dataset.card!;render();});
    root.querySelectorAll<HTMLButtonElement>('[data-op]').forEach(el=>el.onclick=()=>command(el.dataset.op as Command['op'],{cardId:selected||undefined,targetId:target||undefined,reverse:el.dataset.reverse==='true'}));
    const select=root.querySelector<HTMLSelectElement>('[data-target]');if(select)select.onchange=()=>{target=select.value;render();};
  }
  render();
  return {update(s:PrivateState){
    const previous=state,changed=!previous||previous.matchId!==s.matchId||previous.version!==s.version||previous.table.paused!==s.table.paused;
    if(previous?.matchId!==s.matchId){selected='';target='';error='';root.scrollTop=0;}
    if(changed){
      entering=new Map(s.hand.filter(id=>!previous||previous.matchId!==s.matchId||previous.table.handNumber!==s.table.handNumber||!previous.hand.includes(id)).map((id,i)=>[id,i*45]));
      const discarded=s.table.log.find(e=>e.kind==='discard'&&e.playerId===s.playerId&&e.cardId&&previous?.hand.includes(e.cardId)&&!s.hand.includes(e.cardId));
      if(discarded){const img=root.querySelector<HTMLImageElement>(`[data-card="${discarded.cardId}"] img`);if(img){const r=img.getBoundingClientRect(),ghost=img.cloneNode() as HTMLImageElement;ghost.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:3000;pointer-events:none;border-radius:9px`;document.body.appendChild(ghost);ghost.animate([{transform:'translate(0,0)'},{transform:'translate(0,-110px) scale(.35) rotate(12deg)',opacity:0}],{duration:240,easing:'ease-out'}).onfinish=()=>ghost.remove();}}
    }
    state=s;if(!s.hand.includes(selected))selected='';if(changed)render();
  },destroy(){destroyed=true;if(pending)clearTimeout(pending);state=null;root.style.overflowY=oldOverflow;root.style.overscrollBehavior=oldOverscroll;}};
}
