// Ferro 2.1: a short real-render duel against BOT BOSCHI, then a five-view layout check.
// The "player" is a scripted human: it attacks in random directions/strengths, feints sometimes and guards
// what it sees after a human delay. The bot only gets FerroBots.read (perceived state).
import assert from'node:assert/strict';
import{writeFileSync,mkdirSync}from'node:fs';
import{launch}from'./lib.mjs';
process.env.GOBLIN_GPU??='1';process.env.VIEWPORT??='1280x720';
const out=process.env.OUT??'docs/agent-work/ferro-21',browser=await launch(),result={errors:[]};mkdirSync(out,{recursive:true});
try{
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=1&cast=goblin,buttafuori&map=colosseum',{timeout:240000});await page.waitForFunction(()=>window.ready,{timeout:180000});
 await page.evaluate(()=>{
  const f=window.fixture;f.stop();const d=f.display,m=f.match,s=m.state,[g,b]=s.warriors,c=f.commands[0];
  s.phase='fight';s.fightTime=5;Object.assign(g,{weapon:'sword',variant:3,x:0,z:-3,yaw:0,hp:400});Object.assign(b,{weapon:'sword',variant:1,x:0,z:1,yaw:Math.PI,hp:400});
  let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
  const st={next:.8,feintAt:0,react:null,events:[],guards:[],lastGuard:b.guardDirection,shots:0};
  window.duel={st,
   frame(){for(let i=0;i<4;i++){
     const t=s.time;c.look={yaw:Math.atan2(b.x-g.x,b.z-g.z),pitch:0};c.guard=!!(st.react&&t>=st.react.at&&b.action?.serial===st.react.serial);c.mx=0;c.my=Math.hypot(g.x-b.x,g.z-b.z)>2.1?-.8:0;
     // Human-like defence: notice the bot's swing after 0.25 s and guard that side 60% of the time.
     if(b.action&&(!st.react||st.react.serial!==b.action.serial))st.react={serial:b.action.serial,at:t+.25,dir:rnd()<.6?null:(['top','left','right'])[Math.floor(rnd()*3)]};
     if(st.react&&t>=st.react.at&&b.action?.serial===st.react.serial)c.guardDirection=st.react.dir??(b.action.direction==='top'?'top':b.action.direction==='left'?'right':'left');
     if(t>=st.next&&!g.action&&g.stun<=0){const dir=(['top','left','right'])[Math.floor(rnd()*3)];c.guardDirection=dir;if(rnd()<.5){c.edges.heavy++;if(rnd()<.3)st.feintAt=t+.12;}else c.edges.light++;st.next=t+.9+rnd()*.8;}
     if(st.feintAt&&t>=st.feintAt){c.edges.feint++;st.feintAt=0;}
     m.step(1/120,p=>p.bot?f.bots.read(p,s,1/120):c);
     const ev=m.drainEvents();st.events.push(...ev.filter(e=>['attack','block','parry','hit','feint','break','guardBreak','counter'].includes(e.kind)).map(e=>({kind:e.kind,at:+s.time.toFixed(2),player:e.player===b.id?'bot':'player',target:e.target===b.id?'bot':e.target?'player':undefined,dir:e.dir,value:e.value})));
     if(b.guardDirection!==st.lastGuard){st.guards.push({at:+s.time.toFixed(2),dir:b.guardDirection});st.lastGuard=b.guardDirection;}
     d.update(s,1/120,ev);}
    d.render();return{t:s.time,phase:s.phase,hp:[g.hp,b.hp]};}};
 });
 let last;for(let i=0;i<600;i++){last=await page.evaluate(()=>window.duel.frame());if(i%150===75)await page.screenshot({path:`${out}/duel-boschi-${i}.png`});if(last.phase!=='fight')break;}
 result.duel=await page.evaluate(()=>{const st=window.duel.st,count=(k,who)=>st.events.filter(e=>e.kind===k&&(!who||e.player===who)).length;return{seconds:+window.fixture.match.state.time.toFixed(1),final:window.fixture.match.state.warriors.map(p=>({name:p.name,hp:+p.hp.toFixed(1),alive:p.alive})),bot:{attacks:count('attack','bot'),blocks:count('block','bot'),parries:count('parry','bot'),feints:count('feint','bot'),hitsLanded:st.events.filter(e=>e.kind==='hit'&&e.player==='bot').length,guardChanges:st.guards.length},player:{attacks:count('attack','player'),blocks:count('block','player'),parries:count('parry','player'),feints:count('feint','player')},guards:st.guards.slice(0,40),events:st.events};});
 const r=result.duel;console.log(JSON.stringify({seconds:r.seconds,final:r.final,bot:r.bot,player:r.player}));
 assert.ok(r.bot.guardChanges>=4,'bot changes guard during the duel');assert.ok(r.bot.blocks>=1,'bot blocks');assert.ok(r.bot.attacks>=4,'bot attacks');
 assert.ok(r.events.some(e=>e.kind==='hit'&&e.target==='bot'),'bot can be hit');

 // Five views: everybody fighting at once (bots drive all five); indicators per view stay inside their view.
 await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=5&mode=combat&map=colosseum',{timeout:240000});await page.waitForFunction(()=>window.ready,{timeout:180000});
 await page.evaluate(()=>{const s=window.fixture.match.state;s.warriors.forEach((p,i)=>{p.weapon=['sword','axe','shield','spear','blades'][i];p.variant=i===1?2:i;p.hp=1000;});});
 await page.waitForFunction(()=>window.fixture.frames>=240,{timeout:120000});
 result.five=await page.evaluate(()=>{const d=window.fixture.display;return d.rigs.map(r=>{const b=r.panel.getBoundingClientRect(),me=r.me.root.getBoundingClientRect(),foe=r.foe.root.getBoundingClientRect(),inside=(x)=>x.width===0||(x.left>=b.left-2&&x.right<=b.right+2&&x.top>=b.top-2&&x.bottom<=b.bottom+2);return{id:r.id,view:[b.width|0,b.height|0],me:{shown:me.width>0,inside:inside(me),size:me.width|0},foe:{shown:foe.width>0,inside:inside(foe)},state:r.me.debug()};});});
 await page.screenshot({path:`${out}/five-views.png`});
 assert.equal(result.five.length,5);assert.ok(result.five.every(v=>v.me.shown&&v.me.inside),'own indicator visible inside each of the five views');
 assert.deepEqual(result.errors,[]);result.status='passed';
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/duel.json',JSON.stringify(result,null,1));}
