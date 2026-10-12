import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep,HOST_URL} from './lib.mjs';
import {installMock,add,tap,btn,until,startGame,XBOX,DS,GENERIC} from './padmock.mjs';
const browser=await launch(),out='docs/agent-work/geofall-2',report={errors:[],checks:[],states:[]};
try{
 const{page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));const phones=[];
 for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,`Ability${i}`,i));const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
 await installMock(page,5);for(let i=0;i<3;i++){await add(page,i,[XBOX,DS,GENERIC][i]);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A');}await page.evaluate(()=>window.__pads.setTarget(null));await startGame(page,'geofall');
 const G=(f,a)=>hostEval(page,(gm,a)=>new Function('g','arg',`return (${a.f})(g,arg);`)(gm.game.scene.getScene('geofall').game3d,a.a),{f:f.toString(),a});
 await until(()=>G(g=>g?.controlsReady&&g.match.phase==='answer'),60000,'ready');
 const descriptions=await phones[0].page.evaluate(()=>document.body.innerText);assert.match(descriptions,/N'CULO/);assert.match(descriptions,/RB|R1/);report.checks.push('existing Companion Card reads Geofall ability name/binding/live state');
 await G(g=>{g.match.remaining=10;g.match.players.forEach(p=>{p.bot=false;p.x=0;p.z=-2;p.pushUsed=false;});});
 await btn(page,0,'RB',true);await sleep(100);await btn(page,0,'RB',false);await sleep(70);
 assert.equal(await G(g=>g.match.players[0].ab.charges),1);assert.equal(await G(g=>g.match.players[0].pushUsed),false);
 assert.match(await phones[0].page.$eval('#cc-status',e=>e.textContent),/ATTIVA|RICARICA/);
 await btn(page,0,'RB',true);await sleep(70);await btn(page,0,'RB',false);await sleep(70);assert.equal(await G(g=>g.match.players[0].ab.charges),1);report.checks.push('Xbox RB starts shield, next press rejected by cooldown, normal A push remains available');
 await btn(page,1,'RB',true);await sleep(100);await btn(page,1,'RB',false);assert.equal(await G(g=>g.match.players[1].ab.charges),0);report.checks.push('PlayStation R1 mapping activates Boschi stability');
 // Generic pad belongs to Victor in CHARACTER_ORDER: immediate acceleration.
 await btn(page,2,'RB',true);await sleep(100);await btn(page,2,'RB',false);assert.equal(await G(g=>g.match.players[2].ab.charges),0);report.checks.push('generic RB activates Victor acceleration');
 // Phone Carbo must first receive a real push impulse; ability doesn't manufacture movement.
 await G(g=>{const p=g.match.players[3];p.vx=8;p.stun=.15;g.match.remaining=8;});await until(()=>phones[3].page.$eval('.ctl-ability',b=>!b.disabled),5000,'phone ability');
 await phones[3].page.evaluate(()=>document.querySelector('.ctl-ability').dispatchEvent(new PointerEvent('pointerdown',{pointerId:77,bubbles:true})));await sleep(80);
 assert.equal(await G(g=>g.match.players[3].ab.charges),0);report.checks.push('phone ability action traverses network to Carbo brake');
 await G(g=>{const m=g.match,p=m.players[4],q=m.players[3];m.remaining=8;p.x=0;p.z=-1;p.facing=0;q.x=0;q.z=.5;q.confusion=q.confusionWarning=q.confusionImmunity=0;m.players.slice(0,3).forEach((p,i)=>{p.x=8+i;p.z=3;});});
 await until(()=>phones[4].page.$eval('.ctl-ability',b=>!b.disabled),5000,'Ciro ready');await phones[4].page.evaluate(()=>document.querySelector('.ctl-ability').dispatchEvent(new PointerEvent('pointerdown',{pointerId:78,bubbles:true})));await sleep(120);
 assert.equal(await G(g=>g.match.players[4].ab.charges),0);assert.match(await phones[3].page.$eval('#geo-phone-status',e=>e.textContent),/INVERTITI/);await sleep(450);assert.equal(await G(g=>g.match.players[3].confusion>0),true);
 await page.screenshot({path:`${out}/abilities-five-1280x720.png`});await phones[3].page.screenshot({path:`${out}/phone-confusion-390x800.png`});await sleep(900);assert.equal(await G(g=>g.match.players[3].confusion),0);report.checks.push('Ciro warning visible on TV/phone before inversion, then expiration/recovery');
 // Render new high/extreme questions using the actual renderer; original camera and tile geometry retained.
 await G(g=>{g.engine.stopRenderLoop();g.engine.runRenderLoop(()=>g.scene.render());g.match.cancel();});
 for(const category of ['bandiere','confini','capitali','sagome','monumenti']){
  const question=await hostEval(page,async(gm,c)=>{const{GEO_QUESTIONS}=await import('/shared/geofallQuestions.ts');return GEO_QUESTIONS.find(q=>q.category===c&&q.difficulty===4);},category);
  await G((g,q)=>{g.match.question=q;g.match.answers=[q.correct,...q.wrong];g.match.correctIndex=0;g.match.phase='answer';g.match.round=16;g.match.remaining=6;g.paintAnswers();g.step(0);},question);await sleep(150);await page.screenshot({path:`${out}/advanced-${category}-1280x720.png`});
 }
 for(const[w,h]of[[1280,720],[800,600]]){await page.setViewport({width:w,height:h});await sleep(150);await G(g=>g.step(0));const b=await page.evaluate(()=>{const hint=document.querySelector('.geo-hint').getBoundingClientRect(),cards=[...document.querySelectorAll('.geo-card')].map(c=>c.getBoundingClientRect());return{hintBottom:hint.bottom,cardTop:Math.min(...cards.map(c=>c.top))};});assert.ok(b.hintBottom<b.cardTop);await page.screenshot({path:`${out}/hud-abilities-${w}x${h}.png`});}
 for(const[w,h]of[[390,800],[360,640],[844,390]]){await phones[4].page.setViewport({width:w,height:h,isMobile:true,hasTouch:true});await sleep(150);const bounds=await phones[4].page.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight+1,controls:[...document.querySelectorAll('#ctl button')].map(b=>{const r=b.getBoundingClientRect();return{right:r.right,bottom:r.bottom};})}));assert.equal(bounds.scroll,false);assert.ok(await phones[4].page.evaluate(()=>document.querySelector('.dpad-screen h1').getBoundingClientRect().top>=document.querySelector('#pad-fallback-badge').getBoundingClientRect().bottom));assert.ok(bounds.controls.every(b=>b.right<=w&&b.bottom<=h));await phones[4].page.screenshot({path:`${out}/phone-ability-${w}x${h}.png`});}
 await G(g=>{g.match.phase='collapse';g.step(0);});await sleep(200);assert.equal(await phones[4].page.$eval('.ctl-ability',b=>b.disabled),true);assert.ok(await G(g=>g.match.players.every(p=>g.match.activate(p.id)!==null)));report.checks.push('collapse disables abilities and phone inputs');
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.deepEqual(report.errors,[]);console.log('PASS Geofall2 abilities/browser',report.checks);
}finally{writeFileSync(`${out}/abilities-browser.json`,JSON.stringify(report,null,2));await browser.close();}
