import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,HOST_URL,sleep,hostEval} from './lib.mjs';
const b=await launch(),out={};
try {
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(`${HOST_URL}?characters=1&ciro=new&goblin=new&judoka=new&buttafuori=new`,{waitUntil:'load'});
  await p.waitForFunction(()=>window.__gallery?.sample().filter(s=>s?.state==='ready').length===4,{timeout:60000});
  const mixed=await p.evaluate(()=>window.__gallery.sample().filter(s=>s?.state==='ready'));
  assert.equal(await p.evaluate(async()=>{const {CHARACTER_ORDER}=await import('/shared/characters.ts');return window.__gallery.sample()[CHARACTER_ORDER.indexOf('dottore')];}),null,'Dottore keeps its original body');
  assert.equal(await p.$('#dottore-new'),null,'no accidental Dottore model selector');
  assert.ok(await p.$('#ciro-new'),'Ciro selector present');
  assert.ok(mixed.some(s=>s.character==='goblin'&&s.clips===36));assert.ok(mixed.some(s=>s.character==='ciro'&&s.clips===46));assert.ok(mixed.some(s=>s.character==='judoka'&&s.clips===37));assert.ok(mixed.some(s=>s.character==='buttafuori'&&s.clips===43));out.mixed=mixed;
  await p.evaluate(()=>{window.__gallery.setCiroLayout('compare');window.__gallery.setCamera(-Math.PI/2,1.32,6.5);});
  await p.waitForFunction(()=>window.__gallery.sample().filter(s=>s?.state==='ready').length===1,{timeout:60000});await sleep(700);
  await p.screenshot({path:'e2e-shots/man-character/legacy-tripo.png'});
  const names=await p.evaluate(async()=>{const {CIRO_PROFILE}=await import('/src/minigames/characters/ciroProfile.ts');return CIRO_PROFILE.clips.map(c=>c.name);});
  out.previews=[];
  for(const name of names){
    await p.evaluate(n=>window.__gallery.ciroPreview(n,.5,true),name);
    await p.waitForFunction(n=>window.__gallery.sample().find(s=>s?.character==='ciro')?.animator?.name===n,{timeout:15000},name);
    const s=await p.evaluate(()=>window.__gallery.sample().find(s=>s?.character==='ciro'));
    if(['idle','run','jump','fall','frontKick','jab','hook','uppercut','roundhouse','heavy','block','victory','defeat','ko'].includes(name.split('.')[1])){await sleep(250);await p.screenshot({path:`e2e-shots/man-character/preview-${name.split('.')[1]}.png`});}
    assert.equal(s.procedural,false);assert.equal(s.clips,46);assert.equal(s.bones,65);assert.equal(s.activeTracks,195);assert.ok(Object.values(s.joints).flat().every(Number.isFinite));out.previews.push(s.animator);
  }
  await p.evaluate(()=>{window.__gallery.setCiroLayout(5);window.__gallery.setState('RUN');});
  await p.waitForFunction(()=>window.__gallery.sample().filter(s=>s?.state==='ready').length===5,{timeout:60000});await sleep(800);
  out.five=await p.evaluate(()=>({samples:window.__gallery.sample(),perf:window.__gallery.perf()}));
  assert.equal(new Set(out.five.samples.map(s=>s.skeletonId)).size,5);
  assert.equal(new Set(out.five.samples.flatMap(s=>s.geometryIds).filter(i=>i>=0)).size,1);
  await p.evaluate(()=>window.__gallery.setCiro('old'));
  assert.ok(await p.evaluate(()=>window.__gallery.sample().every(s=>s===null)));
  await p.goto(`${HOST_URL}?fighter=1&ciro=new`,{waitUntil:'load'});
  await p.waitForFunction(()=>window.__fighterLab?.game(),{timeout:60000});await p.evaluate(()=>window.__fighterLab.restart(2,'all-ciro'));
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
  });assert.equal(out.cornicione.attack.animator.name,'ciro.jab');assert.equal(out.cornicione.importedJump,true);assert.equal(out.cornicione.returnNew,true);
  await p.screenshot({path:'e2e-shots/man-character/cornicione.png'});
  const resultAssets=[];p.on('request',r=>{if(/\.glb(?:\?|$)/.test(r.url()))resultAssets.push(r.url());});
  await p.goto(`${HOST_URL}?debug=1&ciro=new`,{waitUntil:'load'});
  await hostEval(p,gm=>{
    const players=[0,1].map(i=>({id:`j${i}`,characterId:'ciro',displayName:i?'CIRO SCONFITTO':'CIRO VINCITORE',name:'Ciro',roleTitle:'',avatar:'🥋',color:'#8866cc',quote:'',score:0}));
    gm.state={players,currentMinigame:{minigameId:'cornicione',name:'CORNICIONE',category:'action'},lastResults:{results:players.map((p,i)=>({playerId:p.id,placement:i+1,score:10-i,stats:['DEV risultato']})),ranking:players.map(p=>p.id),deltas:{j0:3,j1:0},double:false}};
    gm.game.scene.stop('LobbyScene');gm.game.scene.start('ResultsScene');
  });
  await p.waitForFunction(async()=>{const u=performance.getEntriesByType('resource').find(e=>/GameManager\.ts/.test(e.name))?.name;if(!u)return false;const {game:gm}=await import(u);return gm.game.scene.getScene('ResultsScene').children.list.filter(x=>x.type==='Container').flatMap(c=>c.list).filter(x=>x.texture?.key?.startsWith('goblin-results')&&x.visible).length===2;},{timeout:60000});
  await sleep(900);await p.keyboard.press('F3');await p.screenshot({path:'e2e-shots/man-character/results.png'});
  assert.ok(resultAssets.some(u=>u.endsWith('/models/man-tripo/man.glb')),'results use Ciro asset');
  assert.ok(!resultAssets.some(u=>u.includes('/models/goblin-tripo/')),'results cannot use Goblin default');
  await hostEval(p,gm=>gm.game.scene.stop('ResultsScene'));
  const counters=await p.evaluate(async()=>{const m=await import('/src/minigames/characters/goblinVisual.ts');return m.goblinVisualCounters();});assert.equal(counters.liveInstances,0);
  assert.equal(errors.length,0,errors.join(';'));out.errors=errors;out.counters=counters;
  writeFileSync('docs/agent-work/man-character-pilot/integration.json',JSON.stringify(out,null,2));console.log('Ciro: mixed models, all 46 original clip previews, five independent rigs, OLD/NEW, Cornicione timing and imported jump, results and disposal: PASS');
}finally{await b.close();}
