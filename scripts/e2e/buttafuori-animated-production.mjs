import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, sleep } from './lib.mjs';

const origin=process.env.PROD_HOST??'http://localhost:3001/';
const browser=await launch();
try {
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>requests.push(r.url()));
  const rows=[];
  for(const query of ['', '?characters=1&buttafuori=new']) {
    requests.length=0;
    await page.goto(origin+query,{waitUntil:'load'});
    await page.waitForSelector('#app canvas',{timeout:30000});
    await sleep(1200);
    const state=await page.evaluate(()=>({gallery:!!window.__gallery,debug:[...document.querySelectorAll('div')].some(d=>d.style.zIndex==='2147483000')}));
    const models=requests.filter(u=>/\.glb(?:\?|$)/.test(u));
    assert.equal(state.gallery,false);assert.equal(state.debug,false);assert.equal(models.length,0);
    rows.push({query,...state,models});
  }
  await page.goto(origin+'?characters=1&buttafuori=new&debug=1',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__gallery?.sample().some(s=>s?.state==='ready'),{timeout:60000});
  const imported=await page.evaluate(()=>window.__gallery.sample().find(s=>s?.state==='ready'));
  assert.equal(imported.clips,43);assert.equal(imported.bones,65);
  await page.evaluate(()=>window.__gallery.setButtafuori('old'));
  await page.waitForFunction(()=>window.__gallery.sample().every(s=>s===null),{timeout:20000});
  await page.evaluate(()=>window.__gallery.setButtafuori('new'));
  await page.waitForFunction(()=>window.__gallery.sample().some(s=>s?.state==='ready'),{timeout:60000});
  assert.equal(errors.length,0,errors.join(';'));
  writeFileSync('docs/agent-work/buttafuori-animation-phase/production.json',JSON.stringify({origin,rows,imported,oldNewToggle:true,errors},null,2));
  console.log('Production: normal Legacy gate, no GLB download; explicit debug imports 65 bones / 43 embedded clips; OLD/NEW switch works; no page errors: PASS');
} finally {await browser.close();}
