import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,addPhone,hostEval,sleep,HOST_URL} from './lib.mjs';
import {startGame,until,gameEval,installMock,add,tap,btn,XBOX,DS,GENERIC} from './padmock.mjs';
const browser=await launch(),out=process.env.BACK_OUT??'docs/agent-work/backrooms-fixes',report={errors:[],checks:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto(`${HOST_URL}?backroomsDebug=1`,{waitUntil:'load'});
 await until(()=>hostEval(page,gm=>gm.game?.scene.getScenes(true).some(s=>s.scene.key==='LobbyScene')),30000,'lobby');await sleep(300);
 for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await sleep(200);}await page.keyboard.press('Enter');await until(()=>hostEval(page,gm=>!!gm.roomCode),20000,'room');const code=await hostEval(page,gm=>gm.roomCode);
 const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,`Fix${i}`,i));const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
 await installMock(page,5);for(let i=0;i<3;i++){await add(page,i,[XBOX,DS,GENERIC][i]);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A');}await page.evaluate(()=>window.__pads.setTarget(null));
 await startGame(page,'backrooms');const G=(fn,arg)=>gameEval(page,'backrooms',fn,arg);await until(()=>G(g=>g?.controlsReady&&g.match.intro<=0),60000,'ready');
 assert.ok(await page.$('#backrooms-debug'));await page.screenshot({path:`${out}/perception-debug-1280x720.png`});
 await G(g=>{g.match.monsters.forEach(m=>{m.state='rest';m.timer=-9999;});g.match.players.forEach(p=>{p.immunity=9999;p.hiding=true;});});
 const fixture=async i=>G((g,i)=>{const m=g.match,p=m.players[i],d=m.maze.doors[0],pos={x:(d.cell%m.maze.size+.5)*3.2,z:(Math.floor(d.cell/m.maze.size)+.5)*3.2};m.players.forEach(p=>p.hiding=true);Object.assign(p,{x:pos.x-(d.horizontal?0:1),z:pos.z-(d.horizontal?1:0),yaw:d.horizontal?0:Math.PI/2,pitch:0,hiding:false,state:'exploring'});d.open=false;return m.prompt(p)?.kind;},i);
 for(let i=0;i<3;i++){
  assert.equal(await fixture(i),'door');let open=false;
  for(let n=0;n<4;n++){await btn(page,i,'A',true);await sleep(90);await btn(page,i,'A',false);await sleep(90);open=!open;assert.equal(await G(g=>g.match.maze.doors[0].open),open);}
  await btn(page,i,'A',true);await sleep(700);assert.equal(await G(g=>g.match.maze.doors[0].open),true);await btn(page,i,'A',false);await sleep(90);
  report.checks.push(`${[XBOX,DS,GENERIC][i]}: four 90ms presses toggle reliably, 700ms hold toggles once`);
 }
 assert.equal(await fixture(3),'door');await until(()=>phones[3].page.$eval('#back-interact',b=>!b.disabled),10000,'phone enabled');
 // A 12ms network tap is not tied to gamepad polling frames.
 for(let n=0;n<4;n++){
  await phones[3].page.evaluate(()=>{const b=document.querySelector('#back-interact');b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,bubbles:true}));setTimeout(()=>b.dispatchEvent(new PointerEvent('pointerup',{pointerId:99,bubbles:true})),12);});await sleep(130);
  assert.equal(await G(g=>g.match.maze.doors[0].open),n%2===0);
 }
 report.checks.push('phone four 12ms taps traverse Socket.IO/InputManager/game authority');
 const slow=await G(g=>{g.engine.stopRenderLoop();const p=g.match.players[3],input=g.ctx.input.get(p.id),door=g.match.maze.doors[0];door.open=false;input.tap('interact');input.clearFrame();g.step(.25);const first=door.open;g.step(.25);const hold=door.open;input.tap('interact');g.step(.25);const next=door.open;g.engine.runRenderLoop(()=>{g.step(1/60);g.scene.render();});return{first,hold,next};});assert.deepEqual(slow,{first:true,hold:true,next:false});report.checks.push('250ms authority frames: cleared tap retained, no repeated edge, next tap without neutral frame retained');
 // Same phone button must permit looking/moving with two other fingers.
 await fixture(3);const cdp=await phones[3].page.createCDPSession(),coords=await phones[3].page.evaluate(()=>['#back-move','#back-look','#back-interact'].map(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};}));
 const before=await G(g=>({x:g.match.players[3].x,z:g.match.players[3].z,yaw:g.match.players[3].yaw}));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:coords[0].x+25,y:coords[0].y},{id:2,x:coords[1].x+25,y:coords[1].y},{id:3,...coords[2]}]});await sleep(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await G(g=>g.match.maze.doors[0].open),true);assert.ok(await G((g,p)=>Math.hypot(g.match.players[3].x-p.x,g.match.players[3].z-p.z)>.1,before));assert.ok(await G((g,p)=>g.match.players[3].yaw>p.yaw+.1,before));report.checks.push('real CDP multitouch: two sticks + INTERAGISCI concurrently');
 // Generator held through phone network; elapsed progress, no repeated-press requirement.
 await G(g=>{const m=g.match,p=m.players[3],cell=m.maze.tasks[0],x=(cell%m.maze.size+.5)*3.2,z=(Math.floor(cell/m.maze.size)+.5)*3.2;m.puzzle='generators';m.tasks=[cell];m.taskProgress=[0];m.unlocked=false;Object.assign(p,{x,z:z-1,yaw:0,pitch:.2,hiding:false});});await sleep(300);
 await phones[3].page.evaluate(()=>document.querySelector('#back-interact').dispatchEvent(new PointerEvent('pointerdown',{pointerId:88,bubbles:true})));await sleep(2800);
 await phones[3].page.evaluate(()=>document.querySelector('#back-interact').dispatchEvent(new PointerEvent('pointerup',{pointerId:88,bubbles:true})));assert.equal(await G(g=>g.match.taskProgress[0]),1);report.checks.push('phone hold activates generator in 2.5 simulation seconds');
 await fixture(3);await sleep(150);assert.match(await page.$eval('.back-view:nth-of-type(4) .back-prompt',e=>e.textContent),/APRI LA PORTA/);await page.screenshot({path:`${out}/interaction-door-five-1280x720.png`});await phones[3].page.screenshot({path:`${out}/interaction-phone-390x800.png`});
 await hostEval(page,gm=>gm.restartMatch());await sleep(1100);assert.equal(await page.$('#backrooms-debug'),null);assert.deepEqual(report.errors,[]);console.log('PASS interaction fixes',report.checks);
}finally{writeFileSync(`${out}/interactions.json`,JSON.stringify(report,null,2));await browser.close();}
