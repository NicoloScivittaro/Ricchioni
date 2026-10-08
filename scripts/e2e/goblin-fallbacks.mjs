import assert from 'node:assert/strict';import {launch,HOST_URL} from './lib.mjs';import {writeFileSync} from 'node:fs';
const b=await launch();try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(`${HOST_URL}?characters=1&goblin=new`,{waitUntil:'load'});await p.waitForFunction(()=>window.__gallery?.sample().some(g=>g?.state==='ready'),{timeout:60000});
 await p.evaluate(async()=>{
  document.querySelector('#char-gallery button:last-child').click();
  const coreUrl=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/@babylonjs_core\.js\?/.test(n));const core=await import(coreUrl);
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:99999';document.body.append(canvas);
  const engine=new core.Engine(canvas,true),scene=new core.Scene(engine);new core.HemisphericLight('light',core.Vector3.Up(),scene);new core.ArcRotateCamera('cam',-Math.PI/2,1.2,9,new core.Vector3(0,1,0),scene);
  const dot=new core.DynamicTexture('dot',16,scene,false);
  const {ArenaEntity}=await import('/src/minigames/arena/arenaEntity.ts'),{KartEntity}=await import('/src/minigames/kart-race/kartEntity.ts');
  const soccer=new ArenaEntity(scene,dot,'#22cc88','goblin','👺','SOCCER',null,{context:'soccer'}),volley=new ArenaEntity(scene,dot,'#22cc88','goblin','👺','VOLLEY',null,{context:'volley'}),kart=new KartEntity(scene,'#22cc88','goblin');
  window.__fallbackProbe={engine,scene,canvas,soccer,volley,kart,core};
 });
 await p.waitForFunction(()=>{const q=window.__fallbackProbe;return q.soccer.goblinDebug()?.state==='ready'&&q.volley.goblinDebug()?.state==='ready';},{timeout:60000});
 const fallback=await p.evaluate(()=>{
  const q=window.__fallbackProbe,s={x:-2,y:0,z:0,vx:0,vz:0,facing:Math.PI,alive:true,falling:false,spin:0,dashing:false,stunTime:0,hitFlash:0};
  q.soccer.setCharge(.6);q.soccer.updateVisual(s,.016,performance.now());const charge=q.soccer.legacyAction;
  q.soccer.playKick(.8);q.soccer.updateVisual(s,.016,performance.now());const kick=q.soccer.legacyAction;
  q.volley.playSpike();q.volley.updateVisual({...s,x:2},.016,performance.now());const volley=q.volley.legacyAction;
  q.soccer.updateVisual(s,.5,performance.now());q.volley.updateVisual({...s,x:2},.5,performance.now());q.scene.render();
  return {charge,kick,volley,returnNew:!q.soccer.legacyAction&&!q.volley.legacyAction,kartImport:q.kart.goblinDebug(),kartTorso:q.kart.driverTorso?.isEnabled()};
 });assert.ok(fallback.charge&&fallback.kick&&fallback.volley&&fallback.returnNew);assert.equal(fallback.kartImport,null);assert.equal(fallback.kartTorso,true);
 await p.screenshot({path:'e2e-shots/goblin-animations/legacy-kart-driver.png'});
 await p.evaluate(()=>{const q=window.__fallbackProbe;q.soccer.dispose();q.volley.dispose();q.kart.dispose();q.engine.dispose();q.canvas.remove();});
 await p.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:99999';document.body.append(canvas);
  const {BabylonFpsGame}=await import('/src/minigames/fps/BabylonFpsGame.ts');const locals=Array.from({length:5},(_,i)=>({id:`p${i}`,name:`G${i}`,color:'#22cc88',characterId:'goblin'})),g=new BabylonFpsGame(canvas,locals);
  const states=locals.map((s,i)=>({...s,x:-20+i*2,z:-20,yaw:Math.PI/2,pitch:0,hp:100,maxHp:100,alive:true,kills:0,weaponId:'mitraglia',magazine:30,reloading:false}));g.update(.016,states);window.__fpsProbe={g,canvas,states};
 });
 await p.waitForFunction(()=>[...window.__fpsProbe.g.avatars.values()].every(a=>a.goblin?.ready),{timeout:60000});
 const fps=await p.evaluate(()=>{
  const {g,states}=window.__fpsProbe;g.update(.016,states);
  const ownHidden=[...g.avatars.values()].every((a,i)=>a.goblin.meshes.filter(m=>m.getTotalVertices()>0).every(m=>(m.layerMask&g.cams[i].camera.layerMask)===0));
  const gunsVisible=[...g.avatars.values()].every(a=>a.gun.isEnabled()&&a.gun.isVisible);
  states[1].alive=false;g.update(.016,states);g.scene.render();const dead=g.avatars.get('p1').goblin.debug().animator;
  states[1].alive=true;g.update(.016,states);const respawn=g.avatars.get('p1').goblin.debug().animator;
  return {ownHidden,gunsVisible,dead,respawn,cameras:g.cams.length};
 });assert.ok(fps.ownHidden&&fps.gunsVisible);assert.equal(fps.dead.name,'goblin.ko');assert.equal(fps.dead.duration,.45);assert.equal(fps.respawn.name,'goblin.idle');assert.equal(fps.cameras,5);
 await p.evaluate(()=>{window.__fpsProbe.g.dispose();window.__fpsProbe.canvas.remove();});assert.equal(errors.length,0,errors.join(';'));
 writeFileSync('docs/agent-work/goblin-animation-phase/fallbacks.json',JSON.stringify({fallback,fps,errors},null,2));console.log('Soccer/Volley/Kart fallbacks; FPS own-body masks, guns, KO and respawn: PASS');
}finally{await b.close();}
