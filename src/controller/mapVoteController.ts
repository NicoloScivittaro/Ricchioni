import type {MapVoteState} from '../../shared/minigameMaps';

/** Stable DOM during tally updates: taps, scroll and focus survive other players voting. */
export function mountMapVote(root:HTMLElement,vote:MapVoteState,playerId:string,minigameId:string,send:(mapId:string,done:(ok:boolean)=>void)=>void):{update:(vote:MapVoteState)=>void;destroy:()=>void} {
  let current=vote,destroyed=false,deadline=performance.now()+vote.endsAt-vote.serverNow;
  root.innerHTML='<div class="screen map-vote-screen"><div class="map-vote-heading"><span>SCEGLI DOVE GIOCARE</span><strong id="map-vote-clock" aria-label="Tempo rimasto"></strong></div><h1>VOTA LA MAPPA</h1><p class="sub" id="map-vote-help"></p><div id="map-vote-options" role="group" aria-label="Mappe disponibili"></div><p id="map-vote-status" role="status" aria-live="polite"></p><p class="sub map-vote-foot">Un voto a testa · modificabile fino allo scadere.<br>Parità: sorteggio tra le più votate. I bot si astengono.</p></div>';
  root.querySelector('#map-vote-help')!.textContent=minigameId==='minigolf'?'Scegli la prima buca. Poi altre due nel torneo.':'Tocca una mappa. I voti compaiono anche sulla TV.';
  const list=root.querySelector('#map-vote-options')!,status=root.querySelector('#map-vote-status')!,clock=root.querySelector('#map-vote-clock')!;
  const buttons=new Map<string,{button:HTMLButtonElement;count:HTMLElement}>();
  for(const option of vote.options){
    const button=document.createElement('button');button.type='button';button.className='map-vote-option';button.dataset.mapId=option.id;button.style.setProperty('--map-color',option.color);button.setAttribute('aria-pressed','false');
    const icon=document.createElement('span');icon.className='map-vote-icon';icon.textContent=option.icon;
    const name=document.createElement('strong');name.textContent=option.name;
    const description=document.createElement('small');description.textContent=option.description;
    const count=document.createElement('span');count.className='map-vote-count';
    button.append(icon,name,description,count);list.appendChild(button);buttons.set(option.id,{button,count});
    button.addEventListener('click',()=>{
      if(destroyed||performance.now()>=deadline)return;
      status.textContent='Invio del voto…';
      send(option.id,ok=>{if(destroyed)return;status.textContent=ok?'Voto ricevuto. Puoi ancora cambiarlo.':'Voto non ricevuto: controlla la connessione o il tempo rimasto.';});
    });
  }
  const tick=()=>{const left=Math.max(0,Math.ceil((deadline-performance.now())/1000));clock.textContent=`${left} s`;for(const {button} of buttons.values())button.disabled=left===0||!current.eligible.includes(playerId);};
  const update=(v:MapVoteState)=>{
    current=v;deadline=performance.now()+v.endsAt-v.serverNow;
    for(const [id,{button,count}] of buttons){const n=Object.values(v.votes).filter(x=>x===id).length,selected=v.votes[playerId]===id;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));count.textContent=`${selected?'✓ IL TUO VOTO · ':''}${n} ${n===1?'VOTO':'VOTI'}`;}
    tick();
  };
  const timer=window.setInterval(tick,200);update(vote);
  return {update,destroy:()=>{destroyed=true;window.clearInterval(timer);}};
}
