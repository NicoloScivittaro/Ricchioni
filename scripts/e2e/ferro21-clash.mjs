// Ferro 2.1: the target duel, recorded from the real renderer and the real rules.
// Goblin (sword, the formerly inverted "victory" model) vs Victor: top guard blocks a top heavy (CLANG),
// Victor shifts to left, Goblin attacks top again, Victor re-guards top on time: perfect parry + riposte.
// Frames: cinematic side camera (no HUD) and the two split-screen views (HUD + guard indicators).
import assert from'node:assert/strict';
import{writeFileSync,mkdirSync,rmSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{launch}from'./lib.mjs';
process.env.GOBLIN_GPU??='1';process.env.VIEWPORT??='1280x720';
const out=process.env.OUT??'docs/agent-work/ferro-21',frames=`${out}/frames`,browser=await launch(),result={errors:[],runs:{}};
mkdirSync(out,{recursive:true});
try{
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))console.log(m.text());});
 for(const mode of ['side','views','wrong']){
  rmSync(`${frames}-${mode}`,{recursive:true,force:true});mkdirSync(`${frames}-${mode}`,{recursive:true});
  await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=2&cast=goblin,dottore&map=colosseum',{timeout:240000});await page.waitForFunction(()=>window.ready,{timeout:180000});
  await page.evaluate(mode=>{
   const f=window.fixture;f.stop();const d=f.display,m=f.match,s=m.state,[g,v]=s.warriors,[cg,cv]=f.commands;
   s.phase='fight';s.fightTime=5;Object.assign(g,{weapon:'sword',variant:3,x:0,y:0,z:-2.05,yaw:0,hp:100,stamina:100});Object.assign(v,{weapon:'sword',variant:2,x:0,y:0,z:0,yaw:Math.PI,hp:100,stamina:100});
   window.duel={events:[],log:[],time:0,t:0,mode,
    step(n){for(let i=0;i<n;i++){g.x=0;g.z=this.far?-5.5:-2.05;v.x=0;v.z=0;m.step(1/120,p=>f.commands[s.warriors.indexOf(p)]);this.events.push(...m.drainEvents().map(e=>({...e,at:+s.time.toFixed(3)})));}},
    frame(n=4){const before=this.events.length;this.step(n);d.update(s,n/120,this.events.slice(before).map(e=>({...e})));
     if(mode!=='views'){d.root.style.display='none';const V=d.overview.target.constructor;d.overview.setTarget(new V(0,2.05,-.6));d.overview.alpha=-1.98;d.overview.beta=1.4;d.overview.radius=4.4;d.overview.fov=.86;d.scene.activeCameras=[d.overview];for(const label of d.labels.values())label.setEnabled(false);}
     d.render();this.log.push({t:+s.time.toFixed(3),g:{action:g.action?.kind??null,dir:g.action?.direction??null,clash:g.clash?.kind??null,stun:+g.stun.toFixed(2),hp:+g.hp.toFixed(1)},v:{guard:v.guard,dir:v.guardDirection,clash:v.clash?.kind??null,hp:+v.hp.toFixed(1)},me:d.rigs.find(r=>r.id===v.id)?.me.debug()});}};
   cv.guard=true;cv.guardDirection='top';cg.guardDirection='top';
  },mode);
  let index=0;if(mode==='wrong'){
   // Wrong guard: Victor covers his left, Goblin swings from his own left = Victor's right. Then a clean miss.
   await page.evaluate(()=>{const[cg,cv]=window.fixture.commands;cv.guardDirection='left';cg.guardDirection='left';});
   const shotW=async()=>{await page.screenshot({path:`${frames}-wrong/${String(index++).padStart(4,'0')}.png`});};
   for(let i=0;i<12;i++){await page.evaluate(()=>window.duel.frame(4));await shotW();}
   await page.evaluate(()=>{window.fixture.commands[0].edges.light++;});
   for(let i=0;i<24;i++){await page.evaluate(()=>window.duel.frame(4));await shotW();}
   await page.evaluate(()=>{window.duel.far=true;window.fixture.commands[0].edges.heavy++;});
   for(let i=0;i<40;i++){await page.evaluate(()=>window.duel.frame(4));await shotW();}
   result.runs.wrong=await page.evaluate(()=>({events:window.duel.events.filter(e=>['attack','block','parry','hit','break'].includes(e.kind)).map(e=>({kind:e.kind,at:e.at,dir:e.dir,value:e.value})),log:window.duel.log}));
   const ev=result.runs.wrong.events,hit=ev.find(e=>e.kind==='hit');assert.ok(hit&&hit.dir==='right'&&hit.value===19,'wrong guard: full light damage from the right of Victor');assert.ok(!ev.some(e=>e.kind==='block'||e.kind==='parry'));
   assert.equal(ev.filter(e=>e.kind==='attack').length,2);assert.equal(ev.filter(e=>e.kind==='hit').length,1,'the far heavy whiffs: no impact');
   assert.ok(result.runs.wrong.log.slice(-30).every(x=>x.v.clash===null&&x.g.clash===null),'no reaction to the miss');
   execFileSync('ffmpeg',['-loglevel','error','-y','-framerate','30','-i',`${frames}-wrong/%04d.png`,'-vf','scale=1280:-2,format=yuv420p','-c:v','libx264','-crf','20',`${out}/wrong-guard-and-miss.mp4`]);continue;}const shot=async()=>{await page.screenshot({path:`${frames}-${mode}/${String(index++).padStart(4,'0')}.png`});};
  const frame=async(n=4)=>{await page.evaluate(n=>window.duel.frame(n),n);await shot();};
  const goblin=()=>page.evaluate(()=>window.fixture.match.state.warriors[0].action?.age??-1);
  // 1. Victor holds top guard, Goblin winds a top heavy into it: block.
  for(let i=0;i<14;i++)await frame();
  await page.evaluate(()=>{window.fixture.commands[0].edges.heavy++;});
  for(let i=0;i<40;i++)await frame();
  // 2. Victor shifts his guard to the left.
  await page.evaluate(()=>{window.fixture.commands[1].guardDirection='left';});
  for(let i=0;i<16;i++)await frame();
  // 3. Goblin attacks top again; Victor lets go and re-guards top ~70 ms before the blade lands: perfect parry.
  await page.evaluate(()=>{window.fixture.commands[0].edges.heavy++;});
  for(let i=0;i<30;i++){const age=await goblin();
   if(age>=.06&&age<.25)await page.evaluate(()=>{window.fixture.commands[1].guard=false;});
   if(age>=.45)await page.evaluate(()=>{const c=window.fixture.commands[1];c.guard=true;c.guardDirection='top';});
   await frame(age>.3&&age<.7?2:4);}
  // 4. The opening: Victor's sword riposte (CONTRATTACCO) while Goblin is still off balance.
  await page.evaluate(()=>{const c=window.fixture.commands[1];c.guard=false;c.edges.special++;});
  for(let i=0;i<30;i++)await frame();
  result.runs[mode]=await page.evaluate(()=>({events:window.duel.events.filter(e=>['attack','block','parry','hit','special','break'].includes(e.kind)).map(e=>({kind:e.kind,at:e.at,player:e.player,target:e.target,dir:e.dir,weapon:e.weapon,value:e.value})),log:window.duel.log}));
  const ev=result.runs[mode].events;
  assert.ok(ev.some(e=>e.kind==='block'&&e.dir==='top'),'first heavy blocked by top guard');
  assert.ok(ev.some(e=>e.kind==='parry'),'second heavy parried');
  assert.ok(ev.some(e=>e.kind==='hit'&&e.player===ev.find(x=>x.kind==='parry').player),'riposte lands after the parry');
  assert.equal(ev.filter(e=>e.kind==='hit'&&e.target!==ev.find(x=>x.kind==='parry').target).length,1,'only the blocked chip hit Victor');
  // Video preview (H.264) + a light GIF of the cinematic run.
  execFileSync('ffmpeg',['-loglevel','error','-y','-framerate','30','-i',`${frames}-${mode}/%04d.png`,'-vf','scale=1280:-2,format=yuv420p','-c:v','libx264','-crf','20',`${out}/clash-${mode}.mp4`]);
  if(mode==='side')execFileSync('ffmpeg',['-loglevel','error','-y','-framerate','30','-i',`${frames}-${mode}/%04d.png`,'-vf','fps=20,scale=720:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer','-loop','0',`${out}/clash-side.gif`]);
 }
 assert.deepEqual(result.errors,[]);result.status='passed';
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/clash.json',JSON.stringify(result,null,1));}
