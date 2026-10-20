import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,HOST_URL,createRoomOnHost,addPhone,hostEval,sleep} from './lib.mjs';
const out='docs/agent-work/cornicione-2',browser=await launch(),errors=[],report={maps:[]};
async function until(fn,msg,timeout=60000){const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await sleep(150);}throw Error(msg);}
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(HOST_URL+'?fighter=1&goblin=new',{waitUntil:'load'});
 await page.waitForFunction(()=>window.__fighterLab?.game(),{timeout:60000});
 await page.evaluate(()=>document.querySelector('#fighter-lab>div:last-child').style.display='none');
 for(const map of ['tetto','darsena','cantiere']){
  await page.evaluate(id=>window.__fighterLab.restart(5,'goblin',id),map);
  await page.waitForFunction(()=>window.__fighterLab.game().phase==='playing',{timeout:45000});
  await page.waitForFunction(()=>[...window.__fighterLab.game().entities.values()].every(e=>!e.goblinDebug()||e.goblinDebug().state==='ready'),{timeout:60000});
  await sleep(500);
  const data=await page.evaluate(()=>{
   const g=window.__fighterLab.game();
   const before=g.sim.time;for(const f of g.sim.fighters)g.setBot(f.id,true);
   return {map:g.ctx.mapId,platforms:g.sim.stage.platforms,hud:g.hud.adt.getControlByName('rightStat').text,before,meshes:g.scene.meshes.length};
  });assert.equal(data.map,map);assert.match(data.hud,/SENZA LIMITE/);assert.ok(!data.hud.includes('NaN'));
  await sleep(1800);
  const motion=await page.evaluate(()=>{const g=window.__fighterLab.game();return {time:g.sim.time,x:g.sim.fighters.map(f=>f.x),percent:g.sim.fighters.map(f=>f.percent)};});assert.ok(motion.time>data.before+1);assert.ok(motion.x.every(Number.isFinite));
  await sleep(1000);await page.screenshot({path:out+'/'+map+'.png'});report.maps.push({...data,motion});
 }
 await page.close();
 if(process.env.CAPTURE_ONLY){assert.deepEqual(errors,[]);console.log(JSON.stringify(report));}else{
 const {page:host,code}=await createRoomOnHost(browser);host.on('pageerror',e=>errors.push(e.message));
 const phones=[];for(let i=0;i<2;i++)phones.push(await addPhone(browser,code,['Niko','Boschi'][i],i));
 await hostEval(host,gm=>{gm.selectMinigame('cornicione');gm.startGame();});
 await until(()=>hostEval(host,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),'map vote');
 for(const p of phones){await p.page.waitForSelector('[data-map-id="darsena"]');assert.equal(await p.page.$$eval('[data-map-id]',nodes=>nodes.length),3);await p.page.click('[data-map-id="darsena"]');}
 await until(()=>hostEval(host,gm=>gm.state.phase==='MINIGAME_PLAYING'),'playing');
 await host.waitForFunction(()=>window.__fighter?.phase==='playing',{timeout:60000});
 const live=await host.evaluate(()=>({map:window.__fighter.ctx.mapId,platforms:window.__fighter.sim.stage.platforms.map(p=>p.y),untimed:!Number.isFinite(window.__fighter.sim.timeLimit)}));
 assert.equal(live.map,'darsena');assert.equal(live.untimed,true);assert.deepEqual(live.platforms,[2.8,2.8,6]);report.mapVote=live;
 await hostEval(host,gm=>gm.restartMatch());await sleep(400);assert.equal(await host.evaluate(()=>document.querySelectorAll('canvas').length),1);report.cleanup=true;
 for(const p of phones)await p.ctx.close();assert.deepEqual(errors,[]);console.log(JSON.stringify(report));}
}finally{writeFileSync(out+(process.env.CAPTURE_ONLY?'/visual-final.json':'/browser-checks.json'),JSON.stringify({...report,errors},null,2));await browser.close();}
