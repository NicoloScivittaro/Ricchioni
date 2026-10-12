import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,addPhone,hostEval,hostSnapshot,sleep,HOST_URL} from './lib.mjs';
import {until,startGame,gameEval} from './padmock.mjs';
const browser=await launch(),out=(process.env.BACK_OUT??'docs/agent-work/backrooms'),report={errors:[],cycles:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto(HOST_URL,{waitUntil:'load'});await until(()=>hostEval(page,gm=>gm.game?.scene.getScenes(true).some(s=>s.scene.key==='LobbyScene')),30000,'lobby');await sleep(300);
 for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await sleep(200);}await page.keyboard.press('Enter');await until(()=>hostEval(page,gm=>!!gm.roomCode),20000,'room');const code=await hostEval(page,gm=>gm.roomCode);const phone=await addPhone(browser,code,'Niko',0);
 const G=(fn,arg)=>gameEval(page,'backrooms',fn,arg);
 for(let cycle=0;cycle<4;cycle++){
  if(cycle){await phone.page.waitForSelector('#chars .char');if(!await phone.page.$('#chars .char.mine'))await phone.page.click('#chars .char');await until(()=>phone.page.$eval('#ready',b=>!b.disabled),10000,'ready enabled');if(!await phone.page.$eval('#ready',b=>/PRONTO ✅/.test(b.textContent)))await phone.page.click('#ready');await until(()=>phone.page.$eval('#ready',b=>/PRONTO ✅/.test(b.textContent)),10000,'human ready after lobby reset');}
  await startGame(page,'backrooms');await until(()=>G(g=>g?.controlsReady),60000,'ready');
  const topology=await G(g=>({seed:g.match.maze.seed,floor:Array.from(g.match.maze.floor).join('')}));if(report.cycles.length){assert.notEqual(topology.seed,report.cycles.at(-1).topology.seed);assert.notEqual(topology.floor,report.cycles.at(-1).topology.floor);}
  const before=await G(g=>{window.__backDisposed=g;window.__backSources=g.sound.hum.map(node=>{const item={ended:false};node.addEventListener('ended',()=>item.ended=true,{once:true});return item;});g.sound.event({type:'capture',player:g.match.players[0].id,point:g.match.players[0]},g.match);return{hum:g.sound.hum.length,voices:g.sound.voices.size,canvases:document.querySelectorAll('canvas').length};});assert.equal(before.hum,2);assert.ok(before.voices>0);
  await G(g=>g.setPaused(true));assert.equal(await G(g=>g.sound.voices.size),0);await G(g=>g.setPaused(false));
  await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');await sleep(1100);
  const after=await page.evaluate(()=>{const g=window.__backDisposed;return{disposed:g.disposed,hum:g.sound.hum.length,voices:g.sound.voices.size,ended:window.__backSources.every(s=>s.ended),loops:g.engine._activeRenderLoops.length,canvases:document.querySelectorAll('canvas').length,hud:!!document.querySelector('#backrooms-hud')};});assert.deepEqual(after,{disposed:true,hum:0,voices:0,ended:true,loops:0,canvases:1,hud:false});assert.equal(await phone.page.evaluate(()=>!!document.querySelector('.back-phone')),false);
  report.cycles.push({cycle,topology,before,after});await page.evaluate(()=>{delete window.__backDisposed;delete window.__backSources;});console.log('PASS lifecycle cycle',cycle,'hum stopped, voices stopped, loop/DOM/canvas/phone cleaned');
 }
 assert.deepEqual(report.errors,[]);
}finally{writeFileSync(`${out}/lifecycle.json`,JSON.stringify(report,null,2));await browser.close();}
