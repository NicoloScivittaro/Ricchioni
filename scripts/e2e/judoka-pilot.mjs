import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,HOST_URL,sleep,hostEval} from './lib.mjs';
const b=await launch(),out={};
try {
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(`${HOST_URL}?characters=1&judoka=new&goblin=new`,{waitUntil:'load'});
  await p.waitForFunction(()=>window.__gallery?.sample().filter(s=>s?.state==='ready').length===2,{timeout:60000});
  const mixed=await p.evaluate(()=>window.__gallery.sample().filter(s=>s?.state==='ready'));
  assert.ok(mixed.some(s=>s.character==='goblin'&&s.clips===36));assert.ok(mixed.some(s=>s.character==='judoka'&&s.clips===37));out.mixed=mixed;
  await p.evaluate(()=>{window.__gallery.setJudokaLayout('compare');window.__gallery.setCamera(-Math.PI/2,1.32,6.5);});
  await p.waitForFunction(()=>window.__gallery.sample().filter(s=>s?.state==='ready').length===1,{timeout:60000});await sleep(700);
  await p.screenshot({path:'e2e-shots/judoka/legacy-tripo.png'});
  const names=await p.evaluate(async()=>{const {JUDOKA_PROFILE}=await import('/src/minigames/characters/judokaProfile.ts');return JUDOKA_PROFILE.clips.map(c=>c.name);});
  out.previews=[];
  for(const name of names){
    await p.evaluate(n=>window.__gallery.judokaPreview(n,.5,true),name);
    await p.waitForFunction(n=>window.__gallery.sample().find(s=>s?.character==='judoka')?.animator?.name===n,{timeout:15000},name);
    const s=await p.evaluate(()=>window.__gallery.sample().find(s=>s?.character==='judoka'));
    assert.equal(s.bones,65);assert.equal(s.activeTracks,195);assert.ok(Object.values(s.joints).flat().every(Number.isFinite));out.previews.push(s.animator);
  }
  await p.evaluate(()=>{window.__gallery.setJudokaLayout(5);window.__gallery.setState('RUN');});
  await p.waitForFunction(()=>window.__gallery.sample().filter(s=>s?.state==='ready').length===5,{timeout:60000});await sleep(800);
  out.five=await p.evaluate(()=>({samples:window.__gallery.sample(),perf:window.__gallery.perf()}));
  assert.equal(new Set(out.five.samples.map(s=>s.skeletonId)).size,5);
  assert.equal(new Set(out.five.samples.flatMap(s=>s.geometryIds).filter(i=>i>=0)).size,1);
  await p.evaluate(()=>window.__gallery.setJudoka('old'));
  assert.ok(await p.evaluate(()=>window.__gallery.sample().every(s=>s===null)));
  await p.goto(`${HOST_URL}?fighter=1&judoka=new`,{waitUntil:'load'});
  await p.waitForFunction(()=>window.__fighterLab?.game(),{timeout:60000});await p.evaluate(()=>window.__fighterLab.restart(2,'all-judoka'));
  await p.waitForFunction(()=>[...window.__fighterLab.game().entities.values()].every(e=>e.goblinDebug()?.state==='ready'),{timeout:60000});
  await p.waitForFunction(()=>window.__fighterLab.game().phase==='playing',{timeout:30000});
  out.cornicione=await p.evaluate(async()=>{
    const g=window.__fighterLab.game(),f=g.sim.fighters[0],e=g.entities.get(f.id);g.setPaused(true);g.setBot('lab2',false);g.hud.clearCountdown();
    Object.assign(f,{x:0,y:0,grounded:true,vx:0,vy:0,hitstun:0,attack:null});g.updateVisuals(.016,performance.now());
    const {ALL_MOVES}=await import('/src/minigames/cornicione/fighterData.ts');const move=ALL_MOVES.find(m=>m.id==='nL');
    f.attack={move,t:move.startup+move.active*.35,hit:new Set(),phase:1};for(let i=0;i<8;i++)g.updateVisuals(.016,performance.now());
    const attack=e.goblinDebug();f.attack=null;f.y=3;f.grounded=false;f.vy=5;g.updateVisuals(.016,performance.now());const importedJump=!e.legacyAction&&e.goblinHandle().meshes.filter(m=>m.getTotalVertices()>0).every(m=>m.isEnabled());
    f.y=0;f.grounded=true;f.vy=0;g.updateVisuals(.016,performance.now());const returnNew=!e.legacyAction;g.scene.render();
    return {attack,importedJump,returnNew};
  });assert.equal(out.cornicione.attack.animator.name,'judoka.jab');assert.equal(out.cornicione.importedJump,true);assert.equal(out.cornicione.returnNew,true);
  await p.screenshot({path:'e2e-shots/judoka/cornicione.png'});
  await p.goto(`${HOST_URL}?debug=1&judoka=new`,{waitUntil:'load'});
  await hostEval(p,gm=>{
    const players=[0,1].map(i=>({id:`j${i}`,characterId:'judoka',displayName:i?'JUDOKA SCONFITTO':'JUDOKA VINCITORE',name:'Judoka',roleTitle:'',avatar:'🥋',color:'#8866cc',quote:'',score:0}));
    gm.state={players,currentMinigame:{minigameId:'cornicione',name:'CORNICIONE',category:'action'},lastResults:{results:players.map((p,i)=>({playerId:p.id,placement:i+1,score:10-i,stats:['DEV risultato']})),ranking:players.map(p=>p.id),deltas:{j0:3,j1:0},double:false}};
    gm.game.scene.stop('LobbyScene');gm.game.scene.start('ResultsScene');
  });
  await p.waitForFunction(async()=>{const u=performance.getEntriesByType('resource').find(e=>/GameManager\.ts/.test(e.name))?.name;if(!u)return false;const {game:gm}=await import(u);return gm.game.scene.getScene('ResultsScene').children.list.filter(x=>x.type==='Container').flatMap(c=>c.list).filter(x=>x.texture?.key?.startsWith('goblin-results')&&x.visible).length===2;},{timeout:60000});
  await sleep(900);await p.keyboard.press('F3');await p.screenshot({path:'e2e-shots/judoka/results.png'});
  await hostEval(p,gm=>gm.game.scene.stop('ResultsScene'));
  const counters=await p.evaluate(async()=>{const m=await import('/src/minigames/characters/goblinVisual.ts');return m.goblinVisualCounters();});assert.equal(counters.liveInstances,0);
  assert.equal(errors.length,0,errors.join(';'));out.errors=errors;out.counters=counters;
  writeFileSync('docs/agent-work/judoka-pilot/integration.json',JSON.stringify(out,null,2));console.log('Judoka: mixed models, all 27 previews, five independent rigs, OLD/NEW, Cornicione timing and imported jump, results and disposal: PASS');
}finally{await b.close();}
