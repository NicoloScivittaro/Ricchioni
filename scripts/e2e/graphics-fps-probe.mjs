// Real GPU rendering probe for 2/5 local FPS viewports and the mobile FPS renderer.
import { launch, HOST_URL, sleep } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const stage = process.env.STAGE ?? 'before', out = 'docs/agent-work/graphics-performance';
mkdirSync(out, { recursive:true });
const browser = await launch(), report = { stage, rows:[], errors:[] };
try {
  const page = await browser.newPage(); page.on('pageerror', e => report.errors.push(String(e)));
  for (const [n,q,mobile] of [[2,'medium',false],[5,'low',false],[2,'medium',true]]) {
    await page.setViewport(mobile ? {width:390,height:800,isMobile:true,hasTouch:true} : {width:1280,height:720});
    const url = new URL(HOST_URL); url.searchParams.set('quality',q);
    await page.goto(url.href, {waitUntil:'load'});
    await page.evaluate(async ({n,mobile}) => {
      const gm = (await import('/src/core/GameManager.ts')).game;
      gm.game?.loop.sleep();
      const players = Array.from({length:n},(_,i)=>({id:`probe${i}`,name:`P${i+1}`,displayName:`P${i+1}`,characterId:['goblin','buttafuori','dottore','judoka','ciro'][i],color:['#00cd91','#ff434d','#6cb2ff','#ffd069','#df9aff'][i]}));
      const box = document.createElement(mobile?'div':'canvas'); box.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:10000'; document.body.append(box);
      let g;
      const snapshots = players.map((p,i)=>({...p,x:-8+i*4,z:-10+i*2,y:0,yaw:0,pitch:0,hp:100,maxHp:100,alive:true,kills:0,weaponId:'mitraglia',magazine:30,reloading:false}));
      if (mobile) {
        const {FpsClient} = await import('/src/controller/fpsClient.ts'); g = new FpsClient(box,players[0].id,()=>{},id=>id);
        g.updateState({matchTime:120,players:snapshots});
      } else {
        const {BabylonFpsGame} = await import('/src/minigames/fps/BabylonFpsGame.ts'); g = new BabylonFpsGame(box,players);
        g.scene.onBeforeRenderObservable.add(()=>g.update(.016,snapshots)); g.update(.016,snapshots);
      }
      const coreUrl = performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/deps\/@babylonjs_core\.js/.test(n));
      const {SceneInstrumentation} = await import(coreUrl);
      const ins = new SceneInstrumentation(g.scene); ins.captureFrameTime=true;
      window.__graphicsProbe = {g,ins,rows:[],capture:false,previous:0,box};
      g.scene.onAfterRenderObservable.add(()=>{
        const p=window.__graphicsProbe;if(!p.capture)return;const now=performance.now();
        if(p.previous)p.rows.push({ms:now-p.previous,cpu:ins.frameTimeCounter.current,draw:ins.drawCallsCounter.current});p.previous=now;
      });
    },{n,mobile});
    await sleep(7000); await page.evaluate(()=>{window.__graphicsProbe.capture=true;}); await sleep(6000);
    const row = await page.evaluate(()=>{
      const {g,rows}=window.__graphicsProbe,avg=k=>rows.reduce((sum,r)=>sum+r[k],0)/rows.length;
      const ms=rows.map(r=>r.ms).sort((a,b)=>a-b),gl=g.engine._gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {frames:rows.length,fps:1000/avg('ms'),median:ms[Math.floor(ms.length*.5)],p95:ms[Math.floor(ms.length*.95)],cpu:avg('cpu'),draw:avg('draw'),
        renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),resolution:[g.engine.getRenderWidth(),g.engine.getRenderHeight()],scale:g.engine.getHardwareScalingLevel(),meshes:g.scene.meshes.length,materials:g.scene.materials.length,textures:g.scene.textures.length,lights:g.scene.lights.length,cameras:g.scene.activeCameras?.length??1};
    });
    assert.ok(row.frames>100); if(!mobile)assert.equal(row.cameras,n);
    await page.screenshot({path:`${out}/${stage}-fps-${mobile?'phone':n+'p-'+q}.png`});
    await page.evaluate(()=>{const p=window.__graphicsProbe;p.ins.dispose();p.g.dispose();p.box.remove();});
    report.rows.push({n,q,mobile,...row}); console.log(`PASS ${stage} FPS ${n}p ${q} mobile=${mobile} ${row.fps.toFixed(1)} FPS, ${row.draw.toFixed(0)} draw`);
  }
  assert.deepEqual(report.errors,[]); report.ok=true;
} finally {writeFileSync(`${out}/${stage}-fps-probe.json`,JSON.stringify(report,null,2)); await browser.close();}
