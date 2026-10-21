import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {io} from 'socket.io-client';
import {launch} from './lib.mjs';
import {until} from './padmock.mjs';
process.env.GOBLIN_GPU='1';
const base=process.env.BOTS_PRODUCTION_URL || 'http://localhost:3012';
const browser=await launch(), phones=[], report={checks:[],errors:[]};
try {
  const p=await browser.newPage(); p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(base); await p.waitForSelector('#pm-create',{timeout:30000});
  await p.click('[data-count="5"]'); await p.click('#pm-create'); await p.waitForSelector('#pm-bots');
  const code=await p.$eval('.pm-room-code b',e=>e.textContent); let state;
  for(let i=0;i<3;i++) {
    const s=io(base,{transports:['websocket'],reconnection:false}); phones.push(s); s.on('room:state',v=>state=v);
    await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});
    const joined=await new Promise((resolve,reject)=>s.timeout(4000).emit('player:join',{roomCode:code,displayName:`Amico ${i+1}`},(err,a)=>err?reject(err):resolve(a)));
    assert.equal(joined.ok,true); s.emit('player:selectCharacter',{characterId:['goblin','buttafuori','judoka'][i]}); s.emit('player:ready',{ready:true});
  }
  await p.waitForFunction(()=>document.querySelector('#pm-start-help')?.textContent.includes('3 persone + 2 bot'));
  // A joining player can open the existing controller-pairing dialog.
  if (await p.$('#pad-root.open')) await p.keyboard.press('Escape');
  await p.click('#pm-bots'); await until(()=>state?.fillWithBots===false,4000,'compiled off');
  await p.click('#pm-bots'); await until(()=>state?.fillWithBots===true,4000,'compiled on');
  await p.click('#pm-catalog-open');
  const cards=await p.$$eval('[data-catalog]',els=>els.filter(e=>e.querySelector('strong')?.textContent==='RIBALTATI').map(e=>e.dataset.catalog));
  assert.equal(cards.length,1); await p.click(`[data-catalog="${cards[0]}"]`);
  await until(()=>state?.selectedMinigameId==='kart3d',4000,'compiled kart');
  report.checks.push('Final compiled UI + refreshed backend: three humans, bot toggle both directions reflected on phones, one Ribaltati card selects the shared game.');
  // Leave no active game or stale test characters in the local service.
  await p.click('#pm-back'); await p.waitForSelector('#pm-create');
  for(const path of ['/bots-ribaltati/','/party-home/','/backrooms-ai/']) assert.equal((await fetch(base+path)).status,200);
  report.checks.push('New and previous galleries preserved; compiled room exit cleans up.');
  assert.deepEqual(report.errors,[]); report.status='passed'; console.log(JSON.stringify(report));
} catch(e) {
  const pages=await browser.pages(), p=pages.at(-1);
  if(p) {
    report.failure=await p.evaluate(()=>({buttons:[...document.querySelectorAll('#pm-bots,#pm-start,#pm-start-help')].map(e=>({id:e.id,text:e.textContent})),pairingOpen:document.querySelector('#pad-root')?.classList.contains('open'),topAtBot:(()=>{const b=document.querySelector('#pm-bots');if(!b)return null;const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,300);})()}));
    await p.screenshot({path:'docs/agent-work/bots-ribaltati/production-failure.png'});
  }
  throw e;
} finally {
  phones.forEach(s=>s.disconnect()); await browser.close();
  writeFileSync('docs/agent-work/bots-ribaltati/production.json',JSON.stringify(report,null,2));
}
