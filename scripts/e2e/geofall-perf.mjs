import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,addPhone,hostEval,hostSnapshot,sleep,HOST_URL} from './lib.mjs';
import {startGame,until} from './padmock.mjs';
const browser=await launch(),out='docs/agent-work/geofall',report={errors:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto(HOST_URL,{waitUntil:'load'});await until(()=>hostEval(page,gm=>gm.game?.scene.getScenes(true).some(s=>s.scene.key==='LobbyScene')),30000,'lobby');
 for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await sleep(200);}await page.keyboard.press('Enter');await until(()=>hostEval(page,gm=>!!gm.roomCode),20000,'room');const code=await hostEval(page,gm=>gm.roomCode);await addPhone(browser,code,'Niko',0);await startGame(page,'geofall');
 await until(()=>hostEval(page,gm=>{const g=gm.game.scene.getScene('geofall').game3d;return g?.controlsReady&&[...g.entities.values()].filter(e=>e.importedBody).length===4;}),60000,'4 original Tripo ready');await sleep(1500);
 report.performance=await hostEval(page,async gm=>{const g=gm.game.scene.getScene('geofall').game3d;let frames=0;const start=performance.now(),obs=g.scene.onAfterRenderObservable.add(()=>frames++);await new Promise(r=>setTimeout(r,6000));g.scene.onAfterRenderObservable.remove(obs);const seconds=(performance.now()-start)/1000,gl=g.engine._gl,ext=gl.getExtension('WEBGL_debug_renderer_info');return{frames,seconds,fps:frames/seconds,viewport:[g.engine.getRenderWidth(),g.engine.getRenderHeight()],meshes:g.scene.meshes.length,textures:g.scene.textures.length,materials:g.scene.materials.length,skins:[...g.entities.values()].map(e=>e.importedBody),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'};});
 assert.ok(report.performance.frames>0);assert.deepEqual(report.performance.viewport,[1280,720]);await page.screenshot({path:`${out}/performance-five.png`});
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);console.log('PASS actual render FPS',report.performance.fps.toFixed(1));
}finally{writeFileSync(`${out}/performance.json`,JSON.stringify(report,null,2));await browser.close();}
