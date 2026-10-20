import {launch,createRoomOnHost,addPhone,hostEval,sleep,HOST_URL} from './lib.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='docs/agent-work/trentuno-italiano';mkdirSync(out,{recursive:true});
const browser=await launch(),errors=[],report={};
const french=/[♥♦♣♠]|\b(cuori|quadri|fiori|picche|regina|jack|queen|king)\b/i;
try{
 const atlas=await browser.newPage();await atlas.setViewport({width:1500,height:1160});
 await atlas.goto(new URL('/trentuno/atlas.html',HOST_URL).href);
 await atlas.waitForFunction(()=>document.images.length===40&&[...document.images].every(i=>i.complete&&i.naturalWidth===240));
 const deck=await atlas.evaluate(()=>({names:[...document.images].map(i=>i.alt),sources:[...document.images].map(i=>i.getAttribute('src')),labels:document.body.innerText}));
 assert.equal(new Set(deck.sources).size,40);assert.ok(!french.test(deck.names.join(' ')+deck.labels));
 assert.equal(deck.names.filter(n=>n.startsWith('Cavallo')).length,4);
 report.fullDeck={cards:40,loaded:true,italianLabels:true};
 await atlas.screenshot({path:out+'/deck.png',fullPage:true});
 const {page:host,code}=await createRoomOnHost(browser);host.on('pageerror',e=>errors.push(e.message));
 const phones=[];for(let i=0;i<2;i++)phones.push(await addPhone(browser,code,['Niko','Boschi'][i],i));
 for(const p of phones)p.page.on('pageerror',e=>errors.push(e.message));
 await hostEval(host,gm=>{gm.selectMinigame('trentuno');gm.startGame();});
 for(const p of phones)await p.page.waitForSelector('.t31-hand img',{timeout:60000});
 await sleep(800);
 const textureInfo=await hostEval(host,async gm=>{
  const {DECK}=await import('/shared/trentuno/deck.ts');const scene=gm.game.scene.getScene('trentuno');
  return {active:scene.scene.isActive(),loaded:DECK.filter(c=>scene.textures.exists('t31-'+c.id)).length,labels:DECK.map(c=>c.name),remaining:gm.trentunoState.remaining};
 });assert.equal(textureInfo.loaded,40);assert.equal(textureInfo.active,true);assert.equal(textureInfo.remaining,null);assert.ok(!french.test(textureInfo.labels.join(' ')));
 report.tv={all40TexturesLoaded:true,italianLabels:true};
 for(const p of phones){
  await p.page.waitForFunction(()=>[...document.querySelectorAll('.t31-hand img')].every(i=>i.complete&&i.naturalWidth===240));
  const data=await p.page.evaluate(()=>({names:[...document.querySelectorAll('.t31-hand img')].map(i=>i.alt),text:document.querySelector('.t31-hand').innerText,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.ok(!french.test(data.names.join(' ')+data.text));assert.equal(data.overflow,false);
 }
 report.phone={italianLabels:true,assetsLoaded:true,noHorizontalOverflow:true};
 await phones[0].page.evaluate(()=>{document.querySelector('#app').scrollTop=0;window.scrollTo(0,0);});
 await phones[0].page.screenshot({path:out+'/phone.png',fullPage:true});
 await host.screenshot({path:out+'/table.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/visual-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
