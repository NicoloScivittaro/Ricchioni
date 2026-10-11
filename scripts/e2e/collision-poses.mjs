import {writeFileSync} from 'node:fs';
import {launch,HOST_URL,sleep} from './lib.mjs';
const b=await launch(),p=await b.newPage(),out='docs/agent-work/physics-update';
try{
 await p.goto(`${HOST_URL}?fighter=1`);await p.waitForFunction(()=>window.__fighterLab?.game());await p.evaluate(()=>window.__fighterLab.restart(5,'goblin'));
 await p.waitForFunction(()=>[...window.__fighterLab.game().entities.values()].filter(e=>e.goblinDebug()).every(e=>e.goblinDebug().state==='ready'),{timeout:60000});
 await p.evaluate(()=>{const g=window.__fighterLab.game();g.paused=true;g.engine.runRenderLoop(()=>{if(!g.scene.isDisposed)g.scene.render()});g.hud.clearCountdown();g.camera.camera.radius=12;g.camera.camera.target.set(0,1.5,0);g.setShowBoxes(true);});
 const rows=[];
 for(let i=0;i<5;i++)for(const id of ['nL','kick'])for(const phase of ['startup','active','recovery']){
  const row=await p.evaluate(async({i,id,phase})=>{const g=window.__fighterLab.game(),url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/fighterData.ts'));const d=await import(url),m=id==='kick'?d.STRATEGY_MOVES.kick:d.GROUND_MOVES.nL;
   g.world.fighters.forEach((f,n)=>{f.dead=n!==i;f.inGame=true;f.x=0;f.y=0;f.vx=f.vy=0;f.facing=1;f.invuln=f.hitstun=0;f.attack=null;});const f=g.world.fighters[i];f.attack={move:m,t:phase==='startup'?m.startup*.7:phase==='active'?m.startup:m.startup+m.active+.02,phase:phase==='startup'?0:phase==='active'?1:2,hit:new Set()};g.updateVisuals(.1,performance.now());g.updateBoxes();const e=g.entities.get(f.id);
   if(phase==='active' && e.goblinVisual){const sample=e.goblinVisual.animator.controller.last,spec=e.goblinVisual.profile.clips.find(c=>c.name===sample.name);if(Math.abs(sample.seconds-spec.contact)>1e-6)throw new Error('pose contact mismatch');}
   if(g.boxes[i*3+1].isVisible!==(phase==='active'))throw new Error('offensive box outside window');
   return {character:f.characterId,move:id,phase,debug:e.goblinDebug(),hand:e.goblinAttachment('RIGHT_HAND',true)?.asArray(),foot:e.goblinAttachment('RIGHT_FOOT',true)?.asArray(),front:m.hit.x+m.hit.w/2};
  },{i,id,phase});rows.push(row);await sleep(300);await p.screenshot({path:`${out}/corn-after-${row.character}-${id}-${phase}.png`});
 }
 for(let i=0;i<5;i++){
  const impact=await p.evaluate(async i=>{const g=window.__fighterLab.game(),url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/fighterData.ts')),d=await import(url);g.world.fighters.forEach((f,n)=>{f.dead=n!==i&&n!==(i+1)%5;f.inGame=true;f.x=n===i?0:1.7;f.y=0;f.vx=f.vy=0;f.facing=n===i?1:-1;f.invuln=f.intang=f.hitstun=f.percent=0;f.attack=null;f.ab.stanceT=f.ab.whiffT=0;});g.world.phase='fight';const a=g.world.fighters[i],v=g.world.fighters[(i+1)%5];a.attack={move:d.GROUND_MOVES.nL,t:d.GROUND_MOVES.nL.startup,phase:1,hit:new Set()};g.world.step(.001,{});for(const e of g.world.drainEvents())g.handle(e);g.updateVisuals(.1,performance.now());g.updateBoxes();if(v.percent!==d.GROUND_MOVES.nL.dmg)throw new Error('actual contact not registered');return {character:a.characterId,damage:v.percent,contacts:g.world.contacts.slice(-1)};},i);
  rows.push({impact});await sleep(250);await p.screenshot({path:`${out}/corn-contact-${impact.character}.png`});
 }
 writeFileSync(`${out}/corn-after.json`,JSON.stringify(rows,null,2));console.log('saved after poses');
}finally{await b.close()}
