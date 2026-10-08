import {launch,sleep,HOST_URL} from './lib.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='e2e-shots/goblin-animations';mkdirSync(out,{recursive:true});
const browser=await launch();
try {
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${HOST_URL}?characters=1&goblin=new`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__gallery?.sample().some(e=>e?.state==='ready'||e?.state==='error'),{timeout:45000}).catch(async e=>{console.log(JSON.stringify({errors,url:page.url(),body:await page.evaluate(()=>document.body.innerText.slice(0,3000)),gallery:await page.evaluate(()=>window.__gallery?Object.keys(window.__gallery):null)},null,2));throw e;});
  console.log(JSON.stringify({initial:await page.evaluate(()=>window.__gallery.sample()),errors},null,2));
  if(await page.evaluate(()=>window.__gallery.sample().some(e=>e?.state==='error')))throw new Error('Import failed; see initial probe');
  await page.evaluate(()=>{window.__gallery.setLayout('compare');window.__gallery.setCamera(-Math.PI/2,1.32,6.5);});
  await page.waitForFunction(()=>window.__gallery.sample().filter(e=>e?.state==='ready').length===1,{timeout:60000});
  await sleep(1000);
  const result=await page.evaluate(()=>({stats:window.__gallery.stats(),samples:window.__gallery.sample(),perf:window.__gallery.perf()}));
  await page.screenshot({path:`${out}/legacy-tripo-idle.png`});
  for(const clip of ['jab','heavy','frontKick','roundhouse','ballThrow','pickup','victory','defeat','ko','fall']) {
    await page.evaluate(c=>window.__gallery.preview(`goblin.${c}`,.25,false),clip);
    await sleep(2200);
    await page.screenshot({path:`${out}/gallery-${clip}.png`});
    result[clip]=await page.evaluate(()=>window.__gallery.sample());
  }
  result.errors=errors;writeFileSync('docs/agent-work/goblin-animation-phase/visual-probe.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({errors,stats:result.stats,idle:result.samples.map(e=>e?.animator),clips:result.samples.map(e=>e?.clips)},null,2));
} finally {await browser.close();}
