import assert from 'node:assert/strict';
import{writeFileSync}from'node:fs';
import{launch}from'./lib.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1600x900';
const browser=await launch(),out='docs/agent-work/solid-collision-fixes',result={errors:[]};let page;
try{
 page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto('http://localhost:5191/tools/orda/graphics-preview.html?humans=2');
 await page.waitForFunction(()=>window.ready,{timeout:240000});
 result.damage=await page.evaluate(()=>{
  const f=window.fixture;f.stop();const d=f.display,s=f.match.state,rigs=d.rigs;
  const alpha=()=>rigs.map(r=>Number(r.flash.style.opacity));
  d.update(s,0);d.update(s,.016,[{type:'hurt',player:'fixture1',value:20}]);const bot=alpha();
  s.players[0].hp-=20;d.update(s,.016,[{type:'hurt',player:'fixture0',value:20}]);d.render();
  const human=alpha(),background=getComputedStyle(rigs[0].flash).backgroundImage;
  return{bot,human,background,views:rigs.map(r=>r.id)};
 });
 assert.deepEqual(result.damage.bot,[0,0]);assert.ok(result.damage.human[0]>.9);assert.equal(result.damage.human[1],0);assert.match(result.damage.background,/radial-gradient/);
 await page.screenshot({path:out+'/orda-damage.png'});
 result.fade=await page.evaluate(()=>{
  const d=window.fixture.display,s=window.fixture.match.state,alpha=()=>d.rigs.map(r=>Number(r.flash.style.opacity));
  d.update(s,.325);const middle=alpha();d.update(s,.35);const clear=alpha();
  s.players[2].hp-=20;d.update(s,.016);const snapshot=alpha();
  d.update(s,.3,[{type:'hurt',player:'fixture2',value:20}]);const repeated=alpha();
  s.players[2].alive=false;d.update(s,.016);const dead=alpha();return{middle,clear,snapshot,repeated,dead};
 });
 assert.ok(result.fade.middle[0]>.4&&result.fade.middle[0]<.6);assert.deepEqual(result.fade.clear,[0,0]);assert.ok(result.fade.snapshot[1]>.9);assert.equal(result.fade.snapshot[0],0);assert.ok(result.fade.repeated[1]>.5);assert.equal(result.fade.dead[1],0);
 result.phoneAxe=await page.evaluate(async()=>{
  window.fixture.dispose();document.body.replaceChildren();
  const{mountFerro}=await import('/src/controller/ferroController.ts'),{FerroMatch}=await import('/shared/ferro/match.ts');
  const m=new FerroMatch([{id:'one',name:'One',color:'#eeaa22'},{id:'two',name:'Two',color:'#22aaee'}]);
  const s=m.state,p=s.warriors[0];p.weapon='axe';p.variant=1;const sent=[];
  const app=document.createElement('div');document.body.append(app);const controller=mountFerro(app,'one',e=>sent.push(e));
  const update=()=>controller.update({type:'ferroState',roundId:1,state:s});update();
  const button=app.querySelector('.ferro-phone-cosmetic'),war=button.textContent;button.click();p.variant=2;update();const volcanic=button.textContent;
  p.weapon='bow';update();const bowHidden=button.hidden;
  controller.destroy();return{war,volcanic,bowHidden,cosmeticEvents:sent.filter(e=>e.controlId==='cosmetic')};
 });
 assert.match(result.phoneAxe.war,/ASCIA DA GUERRA/);assert.match(result.phoneAxe.volcanic,/ASCIA VULCANICA/);assert.equal(result.phoneAxe.cosmeticEvents.length,1);
 assert.deepEqual(result.errors,[]);result.status='passed';console.log(JSON.stringify(result));
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}
finally{await browser.close();writeFileSync(out+'/orda-browser.json',JSON.stringify(result,null,2));}
