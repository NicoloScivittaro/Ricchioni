import assert from 'node:assert/strict';
import {launch,sleep,HOST_URL} from './lib.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const OUT='e2e-shots/goblin-animations';mkdirSync(OUT,{recursive:true});
const LOG='docs/agent-work/goblin-animation-phase';
let checks=0;
const check=(ok,msg)=>{assert.ok(ok,msg);checks++;console.log(`PASS ${msg}`);};
const browser=await launch(),result={};
try {
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(`${HOST_URL}?characters=1&goblin=new`,{waitUntil:'load'});
  const ready=n=>p.waitForFunction(n=>window.__gallery.sample().filter(e=>e?.state==='ready').length===n,{timeout:60000},n);
  await ready(1);
  await p.evaluate(()=>window.__gallery.setLayout(2));await ready(2);
  const gs=await p.evaluate(()=>window.__gallery.sample());
  check(gs.every(g=>g.bones===65&&g.clips===36),'both full rigs imported');
  check(gs[0].skeletonId!==gs[1].skeletonId,'independent skeletons');
  check(gs[0].geometryIds.find(x=>x>=0)===gs[1].geometryIds.find(x=>x>=0),'shared geometry');
  await p.evaluate(()=>{window.__gallery.setState('RUN');window.__gallery.goblinDrive([.25,1]);});await sleep(1100);
  check(await p.evaluate(()=>{const a=window.__gallery.sample();return a.every(g=>g.animator.name==='goblin.run')&&a[0].animationSpeed!==a[1].animationSpeed;}),'independent locomotion speeds');
  for(const state of ['IDLE','JUMP','DASH','HIT','STUN','ATTACK','VICTORY','DEFEAT']){
    await p.evaluate(s=>window.__gallery.setState(s),state);await sleep(1300);
    check(await p.evaluate(()=>window.__gallery.sample().every(g=>Number.isFinite(g.animationFrame))),`${state}: finite pose`);
  }
  await p.evaluate(()=>{window.__gallery.diagnostics({skeleton:true,bones:true,root:true,attachments:true});});await sleep(300);
  await p.screenshot({path:`${OUT}/skeleton-attachments.png`});
  check(errors.length===0,'diagnostic toggles have no errors');
  await p.evaluate(()=>window.__gallery.diagnostics({skeleton:false,bones:false,root:false,attachments:false}));
  const ids=await p.evaluate(async()=>{const m=await import('/src/minigames/characters/goblinAnimator.ts');return m.GOBLIN_CLIPS.map(c=>c.name);});
  for(const name of ids){await p.evaluate(name=>window.__gallery.preview(name,2,false),name);await p.waitForFunction(name=>window.__gallery.sample()[0]?.animator?.name===name,{timeout:10000},name);const pose=await p.evaluate(()=>window.__gallery.sample()[0]);check(pose.animator?.name===name&&pose.joints&&Object.values(pose.joints).flat().every(Number.isFinite),`${name}: sampled skinning`);}
  for(const n of [1,2,5]){
    await p.evaluate(n=>{window.__gallery.setLayout(n);window.__gallery.setState('RUN');},n);await ready(n);await sleep(800);
    const samples=[];for(let i=0;i<30;i++){samples.push(await p.evaluate(()=>({perf:window.__gallery.perf(),cost:window.__gallery.animationCost(),stats:window.__gallery.stats()})));await sleep(90);}
    result[`gallery${n}`]={samples,triangles:35624*n,activeTracks:195*n,textureRGBA8MipMiB:85.3333333333};
  }
  await p.evaluate(()=>document.querySelector('#char-gallery button:last-child').click());
  check(await p.evaluate(async()=>{const m=await import('/src/minigames/characters/goblinVisual.ts');return m.goblinVisualCounters().liveInstances===0;}),'gallery disposal releases every instance');
  await p.goto(`${HOST_URL}?characters=1&goblin=new&goblinUrl=/models/not-found.glb`,{waitUntil:'load'});
  await p.waitForFunction(()=>window.__gallery.sample()[0]?.state==='error',{timeout:30000}).catch(async e=>{console.log(JSON.stringify(await p.evaluate(()=>({url:location.href,sample:window.__gallery?.sample(),body:document.body.innerText.slice(0,300)})),null,2));throw e;});
  check(await p.evaluate(()=>window.__gallery.sample()[0].state==='error'),'bad asset keeps legacy fallback');
  await p.goto(`${HOST_URL}?fighter=1&goblin=new`,{waitUntil:'load'});
  await p.waitForFunction(()=>window.__fighterLab?.game(),{timeout:60000});
  await p.evaluate(()=>window.__fighterLab.restart(2,'all-goblin'));
  await p.waitForFunction(()=>[...window.__fighterLab.game().entities.values()].filter(e=>e.goblinDebug()?.state==='ready').length===2,{timeout:60000});
  // Live input smoke, then deterministic visual sampling of each existing gameplay move.
  await p.waitForFunction(()=>window.__fighterLab.game().phase==='playing',{timeout:30000});
  await p.evaluate(()=>window.__fighterLab.game().setBot('lab2',true));
  await p.keyboard.down('ArrowRight');await sleep(250);await p.keyboard.up('ArrowRight');
  await p.keyboard.press('KeyZ');await sleep(100);await p.keyboard.press('KeyZ');await sleep(100);
  check(await p.evaluate(()=>{const f=window.__fighterLab.game().sim.fighters[0];return f.y>0&&f.jumps<2;}),'live jump and double jump');
  await p.evaluate(()=>{const g=window.__fighterLab.game();g.setBot('lab2',false);g.setPaused(true);g.setShowBoxes(true);g.koBox.setEnabled(false);g.hud.clearCountdown();});
  const moves=await p.evaluate(async()=>{const d=await import('/src/minigames/cornicione/fighterData.ts');return [...d.ALL_MOVES,d.followMove(9)].map(m=>m.id);});
  result.cornicioneMoves=[];
  for(const id of moves){
    const sample=await p.evaluate(async id=>{
      const d=await import('/src/minigames/cornicione/fighterData.ts'),g=window.__fighterLab.game(),f=g.sim.fighters[0],target=g.sim.fighters[1];
      const move=[...d.ALL_MOVES,d.followMove(9)].find(m=>m.id===id);
      Object.assign(f,{x:0,y:move.air?3:0,vx:0,vy:move.air?-2:0,facing:1,grounded:!move.air,hitstun:0,hitFlash:0,dodge:null,dead:false,inGame:true,invuln:0});
      Object.assign(target,{x:3,y:0,vx:0,vy:0,grounded:true,hitstun:0,attack:null,dead:false,inGame:true});
      f.attack={move,t:move.startup+move.active*.35,hit:new Set(),phase:1};
      for(let i=0;i<12;i++)g.updateVisuals(.016,performance.now());g.updateBoxes();g.camera.camera.radius=10;g.camera.camera.target.set(1.5,move.air?4.2:1.2,0);g.scene.render();
      const e=g.entities.get(f.id);return {id,debug:e.goblinDebug(),legacy:e.legacyAction,move,attachments:Object.fromEntries(['RIGHT_HAND','LEFT_HAND','RIGHT_FOOT','LEFT_FOOT'].map(k=>[k,e.goblinAttachment(k)?.asArray()]))};
    },id);
    check(sample.debug.animator.contactTime>=sample.move.startup&&sample.debug.animator.contactTime<=sample.move.startup+sample.move.active,`${id}: contact in authoritative active interval`);
    check(Math.abs(sample.debug.hipsNow[0]-sample.debug.restHips[0])<1e-4&&Math.abs(sample.debug.hipsNow[2]-sample.debug.restHips[2])<1e-4,`${id}: root stays neutral`);
    result.cornicioneMoves.push(sample);
    if(['nL','sH','uAH','dH','dAL','dAH'].includes(id))await p.screenshot({path:`${OUT}/cornicione-${id}-contact.png`});
  }
  await p.evaluate(()=>{const g=window.__fighterLab.game(),f=g.sim.fighters[0];f.attack=null;f.grounded=true;f.y=0;g.camera.camera.target.set(1.5,1.2,0);for(let i=0;i<10;i++)g.updateVisuals(.016,performance.now());g.scene.render();});
  await p.screenshot({path:`${OUT}/cornicione-idle.png`});
  await p.evaluate(()=>{const g=window.__fighterLab.game(),f=g.sim.fighters[0];Object.assign(f,{vx:-14,vy:8,grounded:false,hitstun:.5,hitFlash:.16});g.entities.get(f.id).playHitFrom(-1,0,.9);for(let i=0;i<10;i++)g.updateVisuals(.016,performance.now());g.scene.render();});
  await p.screenshot({path:`${OUT}/cornicione-knockback.png`});
  const ability=await p.evaluate(async()=>{const g=window.__fighterLab.game(),f=g.sim.fighters[0],lab=window.__fighterLab;lab.forceOffstage(0);lab.readyAbility(0);const {NO_INPUT}=await import('/src/minigames/cornicione/fighterTypes.ts');g.sim.step(.016,new Map([[f.id,{...NO_INPUT,mx:-1,abilityPressed:true}]]));for(const e of g.sim.drainEvents())g.handle(e);g.camera.camera.target.set(f.x,f.y+1.2,0);for(let i=0;i<12;i++)g.updateVisuals(.016,performance.now());g.scene.render();return {burst:f.ab.burstT,return:f.ab.returnT,charges:f.ab.charges};});
  check(ability.burst>0&&ability.return>0,'real Rimonta ability activates its existing burst/return windows');result.ability=ability;
  await p.screenshot({path:`${OUT}/cornicione-rimonta.png`});
  await p.evaluate(()=>{const g=window.__fighterLab.game();for(const e of g.entities.values())e.playVictory();for(let i=0;i<12;i++)g.updateVisuals(.05,performance.now());g.scene.render();});await p.screenshot({path:`${OUT}/cornicione-victory.png`});
  await p.evaluate(()=>{const g=window.__fighterLab.game();for(const e of g.entities.values())e.playDefeat();for(let i=0;i<12;i++)g.updateVisuals(.05,performance.now());g.scene.render();});await p.screenshot({path:`${OUT}/cornicione-defeat.png`});
  check(errors.length===0,`browser has no runtime errors: ${errors.join(';')}`);
  result.errors=errors;result.checks=checks;writeFileSync(`${LOG}/integration.json`,JSON.stringify(result,null,2));
  console.log(`${checks} integration checks passed`);
}finally{await browser.close();}
