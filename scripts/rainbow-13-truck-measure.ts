import {readFileSync,writeFileSync} from 'node:fs';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {CharacterAbilities} from '../src/minigames/kart-race/abilities';
import {stepKartPhysics} from '../src/minigames/kart-race/kartPhysics';
const input={up:true,down:false,left:false,right:false,steer:0,drift:false,driftReleased:false,item:false};
const result=[];
for(const stage of ['before','after']){
 const p=JSON.parse(readFileSync(`docs/agent-work/rainbow-1-3/${stage}/ability-measure.json`,'utf8')).catalog.judoka.p;
 const v=createKartState('v',null,'#fff',''),plain=createKartState('p',null,'#fff',''),a=new CharacterAbilities();
 Object.assign(v,{speed:62,speedCapMultiplier:p.slow,speedCapTimer:p.slowTime});plain.speed=62;
 for(let i=0;i<600;i++){
  a.update(1/60,v,[v],false,false,()=>0,()=>{});
  for(const k of [v,plain])stepKartPhysics(k,input,1/60,()=>100,()=>0,false,{grip:1,speed:1,barriers:false});
 }
 result.push({stage,slow:p.slow,seconds:p.slowTime,lossMetres:plain.distance-v.distance});
}
writeFileSync('docs/agent-work/rainbow-1-3/after/truck-measure.json',JSON.stringify({protocol:'Isolated ground slowdown: baseline/final catalog, same neutral solver, 10s at 60Hz, initial speed62 on both karts; no lateral collisions',result},null,2));
console.log(JSON.stringify(result));
