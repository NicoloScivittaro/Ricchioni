import {writeFileSync} from 'node:fs';
import {launch,HOST_URL,sleep} from './lib.mjs';
const b=await launch(),p=await b.newPage(),out='docs/agent-work/physics-update';
try{
 await p.goto(`${HOST_URL}?fighter=1`);await p.waitForFunction(()=>window.__fighterLab?.game());await p.evaluate(()=>window.__fighterLab.restart(5,'goblin'));
 await p.waitForFunction(()=>[...window.__fighterLab.game().entities.values()].filter(e=>e.goblinDebug()).every(e=>e.goblinDebug().state==='ready'),{timeout:60000});
 await p.evaluate(()=>{const g=window.__fighterLab.game();g.paused=true;g.engine.runRenderLoop(()=>{if(!g.scene.isDisposed)g.scene.render()});g.hud.clearCountdown();g.camera.camera.radius=12;g.camera.camera.target.set(0,1.5,0);g.setShowBoxes(true);});
 const rows=[];
 for(let i=0;i<5;i++)for(const id of ['nL','kick']){
  const row=await p.evaluate(async({i,id})=>{const g=window.__fighterLab.game(),url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/fighterData.ts'));const d=await import(url),m=id==='kick'?d.STRATEGY_MOVES.kick:d.GROUND_MOVES.nL;
   g.world.fighters.forEach((f,n)=>{f.dead=n!==i;f.inGame=true;f.x=0;f.y=0;f.vx=f.vy=0;f.facing=1;f.invuln=f.hitstun=0;f.attack=null;});const f=g.world.fighters[i];f.attack={move:m,t:m.startup,phase:1,hit:new Set()};g.updateVisuals(.1,performance.now());g.updateBoxes();const e=g.entities.get(f.id);
   return {character:f.characterId,move:id,debug:e.goblinDebug(),hand:e.goblinAttachment('RIGHT_HAND',true)?.asArray(),foot:e.goblinAttachment('RIGHT_FOOT',true)?.asArray(),front:m.hit.x+m.hit.w/2};
  },{i,id});rows.push(row);await sleep(300);await p.screenshot({path:`${out}/corn-before-${row.character}-${id}.png`});
 }
 writeFileSync(`${out}/corn-before.json`,JSON.stringify(rows,null,2));console.log('saved before poses');
}finally{await b.close()}
