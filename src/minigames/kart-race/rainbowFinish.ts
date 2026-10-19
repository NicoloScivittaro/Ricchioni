import type {KartState} from './raceTypes';
import type {PlayerSnapshot} from '../../../shared/types';
import {fmtTime} from '../../core/format';

/** Finite finish presentation inside this scene; ScoreManager still owns the subsequent results. */
export function showRainbowFinish(karts:KartState[],players:PlayerSnapshot[]):HTMLElement {
  const root=document.createElement('section');root.id='rainbow-finish';root.setAttribute('aria-label','Arrivi Strada Arcobaleno');
  root.style.cssText='position:fixed;inset:0;z-index:12000;background:radial-gradient(ellipse at 50% 10%,#324e7bdd,#10112bef 65%);color:#eef9ff;font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;pointer-events:none';
  const label=document.createElement('div');label.textContent='STRADA ARCOBALENO · TRE GIRI TRA LE STELLE';label.style.cssText='color:#89ffe5;font-weight:bold;letter-spacing:.16em;font-size:clamp(12px,2vw,20px)';
  const title=document.createElement('h1');title.textContent='TRAGUARDO STELLARE';title.style.cssText='margin:0 0 12px;font-size:clamp(26px,4vw,52px);text-shadow:0 3px 18px #79b5ff80';root.append(label,title);
  for(const k of [...karts].sort((a,b)=>a.placement-b.placement)){
    const p=players.find(p=>p.id===k.playerId),row=document.createElement('div');row.dataset.playerId=k.playerId;
    row.style.cssText=`width:min(820px,88vw);display:flex;align-items:center;gap:20px;padding:14px 24px;border-left:5px solid ${p?.color??'#83ffe0'};background:${k.placement===1?'#89703b55':'#172239cc'};border-radius:10px;font-size:clamp(16px,2vw,25px)`;
    const rank=document.createElement('strong');rank.textContent=k.placement===1?'★ 1°':`${k.placement}°`;rank.style.width='70px';
    const name=document.createElement('span');name.textContent=p?.displayName??'Pilota';name.style.flex='1';
    const time=document.createElement('span');time.textContent=k.lap>=3?fmtTime(k.finishTime*1000):`GIRO ${Math.min(3,k.lap+1)}/3`;row.append(rank,name,time);root.append(row);
  }
  const footer=document.createElement('div');footer.textContent='PUNTI PARTITA E CLASSIFICA IN ARRIVO';footer.style.cssText='font-size:14px;color:#b3c6e1;margin-top:8px;letter-spacing:.08em';root.append(footer);document.body.append(root);return root;
}
