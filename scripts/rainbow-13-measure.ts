import {writeFileSync} from 'node:fs';
import {createKartState,type KartState} from '../src/minigames/kart-race/raceTypes';
import {CharacterAbilities} from '../src/minigames/kart-race/abilities';
import {stepKartPhysics,hitKart,KART_CONFIG} from '../src/minigames/kart-race/kartPhysics';
import {AB} from '../shared/abilityCatalog';
const stage=process.env.R13_STAGE??'after',input={up:true,down:false,left:false,right:false,steer:0,drift:false,driftReleased:false,item:false};
function run(cid:string,on:boolean,air=false,recovery=false,hit=false){
 const k=createKartState('p',cid,'#fff',''),ab=new CharacterAbilities(),events:string[]=[];let max=0,stunned=0,activations=0;
 Object.assign(k,{speed:KART_CONFIG.maxSpeed,distance:100,lastValidCheckpointS:20,abilityMeter:1,invulnTimer:0,flight:air?'GLIDE':'DRIVE'});
 const effect={stun:1.3,disturb:1};
 if(recovery){hitKart(k,1.3);ab.update(0,k,[k],true,false,()=>0,()=>{});}
 if(hit){const v=k.speed;hitKart(k,1.3);(ab.noteHit as (k:KartState,e:typeof effect,speed?:number)=>void)(k,effect,v);}
 if(on){if(ab.onAbilityPress(k,[k],f=>events.push(f.type))==='ok')activations++;}
 for(let i=0;i<600;i++){
  const t=i/60;ab.setRaceTime(t);ab.update(1/60,k,[k],false,false,()=>0,f=>events.push(f.type));
  stepKartPhysics(k,input,1/60,()=>100,()=>0,false,{grip:1,speed:1,air,barriers:false});max=Math.max(max,k.speed);if(k.stunTimer>0)stunned+=1/60;
 }
 return {distance:k.distance-100,maxSpeed:max,stunned,activations,events};
}
const rows=[];
for(const [cid,recovery,hit] of [['goblin',false,false],['dottore',false,false],['buttafuori',true,false],['ciro',false,true]] as const)for(const air of [false,true]){
 if(cid==='buttafuori'&&air)continue;
 const plain=run(cid,false,air,recovery,hit),active=run(cid,true,air,recovery,hit);
 rows.push({cid,air,plain,active,gainMetres:active.distance-plain.distance,timeEquivalent:(active.distance-plain.distance)/KART_CONFIG.maxSpeed});
}
const uses=[];
for(const cid of ['goblin','dottore','judoka','buttafuori','ciro']){
 const k=createKartState('p',cid,'#fff',''),a=new CharacterAbilities();let count=0;
 for(let i=0;i<170*60;i++){
  a.setRaceTime(i/60);a.update(1/60,k,[k],false,false,()=>0,()=>{});
  if(i%180===0){if(cid==='buttafuori'){k.stunTimer=1.3;a.reactToCrash(k,true,false,()=>0,()=>{});}if(cid==='ciro'){a.noteHit(k,{stun:1});}}
  if((a.status(k).state==='READY'||k.recoverWindow>0||k.refundTimer>0)) {const before=k.abilityCharges,active=k.abilityActive;a.onAbilityPress(k,[k],()=>{});if(k.abilityCharges<before||(!active&&k.abilityActive))count++;}
 }
 uses.push({cid,seconds:170,eligibleUses:count});
}
writeFileSync(`docs/agent-work/rainbow-1-3/${stage}/ability-measure.json`,JSON.stringify({protocol:'10 seconds, 60Hz, same straight and throttle, cruise speed 44 ground /44 air; immediate post-hit recovery; no rubber band',catalog:AB.kart3d,rows,uses},null,2));
console.log(JSON.stringify({stage,rows:rows.map(({cid,air,gainMetres})=>({cid,air,gainMetres})),uses}));
