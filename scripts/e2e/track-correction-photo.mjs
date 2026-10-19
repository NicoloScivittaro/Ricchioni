import{launch,sleep}from'./lib.mjs';import{readFileSync,writeFileSync}from'node:fs';
const mode=process.env.TRACK_PHOTO??'primo-before',out='docs/agent-work/track-corrections',probe=JSON.parse(readFileSync(out+'/primo-before.json')).selected;
const browser=await launch();try{
 const page=await browser.newPage();await page.evaluateOnNewDocument(()=>performance.setResourceTimingBufferSize(10000));await page.goto('http://localhost:5180/');await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('GameManager.ts')));
 const info=await page.evaluate(async({mode,probe})=>{
  if(mode.startsWith('sydney'))probe={...probe,s:201,lateral:0};
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('GameManager.ts'));const{game:gm}=await import(url);while(!gm.game)await new Promise(r=>setTimeout(r,100));gm.game.loop.sleep();gm.game.canvas.style.display='none';
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:10001';document.body.append(canvas);
  const[{BabylonKartGame},{InputManager},{Rng}]=await Promise.all([import('/src/minigames/kart-race/BabylonKartGame.ts'),import('/src/network/InputManager.ts'),import('/shared/rng.ts')]);
  const transformed=await(await fetch('/src/minigames/kart-race/BabylonKartGame.ts')).text();const coreUrl=transformed.match(/from \"([^\"]*\/@babylonjs_core\.js[^\"]*)\"/)?.[1]??performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/@babylonjs_core.js'));const{MeshBuilder,Color3}=await import(coreUrl);
  const player={id:'probe',characterId:'goblin',displayName:'PROVA PISTA',color:'#71def2',avatar:'',bot:false,connected:true,ready:true,score:0};
  const g=window.__correctionGame=new BabylonKartGame(canvas,{kartTrackId:mode.startsWith('sydney')?'sydney':'primo',players:[player],playerIds:[player.id],input:new InputManager(),rng:new Rng(37),durationSec:230,modifier:null,modifiers:new Map(),consume:()=>false,sendPrivate:()=>{},vibrate:()=>{},signal:()=>{},finish:()=>{}});g.paused=true;await g.ready;await g.scene.whenReadyAsync();
  const k=g.karts.get('probe');Object.assign(k,{distance:probe.s,lateral:probe.lateral,absHeading:g.trackAngleAt(probe.s),speed:0});g.present(1/60);
  const cam=g.cameraManager.rigs.get('probe').camera;cam.layerMask=0x000fffff;cam.position=g.spline.worldPoint(probe.s-11,probe.lateral+12,9);cam.setTarget(g.spline.worldPoint(probe.s+5,probe.lateral,1));
  if(mode==='sydney-entry-overview'){cam.position.set(201,33,-68);cam.setTarget(cam.position.clone().set(178,4,-89));}
  // DEV-only annotation of the verified former physical boundary. The scene and
  // materials underneath are the unmodified game renderer in the before capture.
  if(mode==='primo-before'){
   const points=[];for(let ds=-11;ds<=11;ds+=1)points.push(g.spline.worldPoint(probe.s+ds,g.spline.widthAt(probe.s+ds)/2+.55,.3));
   const line=MeshBuilder.CreateLines('formerInvisibleWall',{points},g.scene);line.color=Color3.FromHexString('#ff6055');
  }
  g.scene.render();g.scene.render();return{mode,length:g.spline.totalLength,probe};
 },{mode,probe});await sleep(120);await page.screenshot({path:`${out}/${mode}.png`});writeFileSync(`${out}/${mode}.capture.json`,JSON.stringify(info,null,2));console.log(JSON.stringify(info));
}finally{await browser.close();}
