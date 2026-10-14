import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {BackroomsMatch} from '../src/minigames/backrooms/backroomsRules';
import type {BackPlayer,Prompt} from '../src/minigames/backrooms/backroomsRules';
import {center,lineOfSight} from '../src/minigames/backrooms/maze';
import {Rng} from '../shared/rng';
// Riferimento precedente all'ottimizzazione: stessa selezione, nuove aperture/occlusioni e pari punteggio.
function previous(m:BackroomsMatch,p:BackPlayer):Prompt|null {
 if(p.state!=='exploring')return null;if(p.hiding)return{kind:'hide',index:-1,text:'ESCI DAL NASCONDIGLIO',point:p};
 const targets:(Prompt&{y:number})[]=[{kind:'exit',index:0,text:m.unlocked||m.keyHolder===p.id?'APRI · FUGGI':m.mode==='key'?'PORTA BLOCCATA · SERVE UNA CHIAVE':'PORTA BLOCCATA · MANCA CORRENTE',point:{...center(m.maze,m.maze.exit),z:center(m.maze,m.maze.exit).z+.55},y:1.25}];
 if(m.key)targets.push({kind:'key',index:0,text:'RACCOGLI LA CHIAVE',point:m.key,y:.65});
 m.tasks.forEach((cell,i)=>{if(m.taskProgress[i]<1){const v=center(m.maze,cell);targets.push({kind:'task',index:i,text:m.puzzle==='switches'?'ATTIVA INTERRUTTORE':`TIENI PREMUTO · ATTIVA GENERATORE ${Math.round(m.taskProgress[i]*100)}%`,point:{x:v.x,z:v.z+.24},y:.9});}});
 m.maze.doors.forEach((d,i)=>targets.push({kind:'door',index:i,text:d.open?'CHIUDI LA PORTA':'APRI LA PORTA',point:center(m.maze,d.cell),y:1.3}));
 m.maze.refuges.forEach((c,i)=>{const v=center(m.maze,c);targets.push({kind:'hide',index:i,text:'NASCONDITI · RESTA IN SILENZIO',point:{x:v.x+.9,z:v.z+.38},y:1.35});});
 const score=(t:typeof targets[number])=>{const dx=t.point.x-p.x,dz=t.point.z-p.z,dy=t.y-1.58,d=Math.hypot(dx,dz),alignment=(Math.sin(p.yaw)*Math.cos(p.pitch)*dx+Math.cos(p.yaw)*Math.cos(p.pitch)*dz-Math.sin(p.pitch)*dy)/Math.max(.01,Math.hypot(d,dy));if(d>=2.4||d>=.8&&alignment<.45)return-Infinity;const maze=t.kind==='door'?{...m.maze,doors:m.maze.doors.filter((_,i)=>i!==t.index)}:m.maze;return lineOfSight(maze,p,t.point)?alignment*2-d*.15:-Infinity;};
 return targets.map(t=>({t,score:score(t)})).filter(v=>Number.isFinite(v.score)).sort((a,b)=>b.score-a.score)[0]?.t??null;
}
let checks=0;const rng=new Rng(88531);
for(const mode of ['free','key','puzzle'] as const)for(let seed=1;seed<=12;seed++){
 const m=new BackroomsMatch([{id:'a',name:'A'},{id:'b',name:'B'}],seed,{mode,puzzle:seed%2?'switches':'generators'}),p=m.players[0];
 for(let i=0;i<500;i++){
  const cells=[m.maze.exit,m.maze.key,...m.tasks,...m.maze.doors.map(d=>d.cell),...m.maze.refuges],near=center(m.maze,rng.pick(cells));p.x=near.x+(rng.next()-.5)*5;p.z=near.z+(rng.next()-.5)*5;p.yaw=rng.next()*Math.PI*2;p.pitch=(rng.next()-.5)*1.8;
  m.maze.doors.forEach(d=>d.open=rng.next()>.5);m.taskProgress=m.tasks.map(()=>rng.next()>.7?1:rng.next());m.unlocked=rng.next()>.5;m.keyHolder=rng.next()>.7?p.id:null;
  if(mode==='key')m.key=rng.next()>.5?{x:near.x+.2,z:near.z-.3}:null;p.hiding=i%71===0;p.state=i%57===0?'eliminated':'exploring';
  assert.deepEqual(m.prompt(p),previous(m,p));checks++;
 }
 p.state='exploring';p.hiding=false;p.pitch=NaN;assert.equal(m.prompt(p),null);checks++;
}
writeFileSync('docs/agent-work/playability-performance/backrooms-prompt.json',JSON.stringify({checks,previousSemanticsPreserved:true,liveDoors:true,keyMoves:true,tasks:true,hiding:true,occlusion:true},null,2));console.log(`BACKROOMS PROMPT: ${checks} confronti con il comportamento precedente superati.`);
