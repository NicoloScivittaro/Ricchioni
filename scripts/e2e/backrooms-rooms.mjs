import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {launch,addPhone,hostEval,hostSnapshot,sleep,HOST_URL} from './lib.mjs';
import {startGame,until} from './padmock.mjs';
const out=(process.env.BACK_OUT??'docs/agent-work/backrooms'),counts=(process.env.BACK_COUNTS??'2,3,4,5').split(',').map(Number);let rows=[];try{rows=JSON.parse(readFileSync(`${out}/rooms.json`,'utf8')).filter(r=>!counts.includes(r.n));}catch{};
for(const n of counts){
 const browser=await launch();const errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>{errors.push(e.stack??String(e));console.log('pageerror',e.stack??String(e));});await page.goto(HOST_URL,{waitUntil:'load'});await until(()=>hostEval(page,gm=>gm.game?.scene.getScenes(true).some(s=>s.scene.key==='LobbyScene')),30000,'lobby');await sleep(300);
  // Distinct render frames avoid the legacy helper's known rapid-arrow double-count.
  for(let i=0;i<n-2;i++){await page.keyboard.press('ArrowRight');await sleep(200);}await page.keyboard.press('Enter');await until(()=>hostEval(page,gm=>!!gm.roomCode),20000,'room');const code=await hostEval(page,gm=>gm.roomCode);
  const ph=await addPhone(browser,code,'Niko',0);ph.page.on('pageerror',e=>errors.push('phone '+e));await startGame(page,'backrooms');
  await until(()=>hostEval(page,gm=>gm.game.scene.getScene('backrooms').game3d?.controlsReady),60000,'ready');
  await until(()=>hostEval(page,gm=>{const g=gm.game.scene.getScene('backrooms').game3d;return [...g.entities.values()].filter(e=>e.importedBody).length===g.ctx.players.filter(p=>p.characterId!=='dottore').length&&g.scene.getActiveMeshes().length>0;}),60000,'imported skins and rendered scene');await sleep(500);
  const actual=await hostEval(page,gm=>({server:gm.state.players.length,game:gm.game.scene.getScene('backrooms').game3d.match.players.length}));assert.deepEqual(actual,{server:n,game:n});
  await page.screenshot({path:`${out}/room-playing-${n}p.png`});
  const result=await hostEval(page,gm=>{const g=gm.game.scene.getScene('backrooms').game3d;g.engine.stopRenderLoop();g.match.players.forEach(p=>p.bot=true);for(let i=0;i<90000&&!g.match.ended;i++)g.step(1/60);const res={seed:g.match.maze.seed,mode:g.match.mode,puzzle:g.match.puzzle,seconds:g.match.time,players:g.match.players.map(p=>({id:p.id,state:p.state,lives:p.lives,visited:p.visited.size})),ended:g.match.ended};for(let i=0;i<185;i++)g.step(1/60);return res;});
  assert.equal(result.ended,true);await until(async()=>(await hostSnapshot(page)).phase==='ROUND_RESULTS',15000,'result');await sleep(4500);const score=await hostEval(page,gm=>gm.state.lastResults);assert.equal(score.results.length,n);assert.equal(Object.keys(score.deltas).length,n);assert.ok(Object.values(score.deltas).every(v=>v>0));await page.screenshot({path:`${out}/room-results-${n}p.png`});
  await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(errors,[]);rows.push({n,...actual,...result,score,errors});console.log('PASS real room',n,'natural',result.seconds.toFixed(1),'simulation seconds');
 }finally{await browser.close();writeFileSync(`${out}/rooms.json`,JSON.stringify(rows,null,2));}
}
