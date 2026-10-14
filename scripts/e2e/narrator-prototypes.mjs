import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch } from './lib.mjs';
const browser=await launch();try{
 const page=await browser.newPage();await page.goto('http://localhost:5175/audio/narrator/prototypes.html',{waitUntil:'networkidle0'});
 const report=await page.evaluate(async()=>{const results=[];for(const el of document.querySelectorAll('audio')){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('audio timeout')),10000);el.onended=()=>{clearTimeout(timer);resolve();};el.onerror=()=>{clearTimeout(timer);reject(Error('audio decode'));};el.play().catch(reject);});results.push({asset:el.src,duration:el.duration,played:true,decoded:el.readyState>=2});}return results;});
 assert.equal(report.length,3);assert.ok(report.every(r=>r.played&&r.decoded&&r.duration>2&&r.duration<5));await page.screenshot({path:'docs/agent-work/narrator/prototypes.png',fullPage:true});writeFileSync('docs/agent-work/narrator/prototype-tests.json',JSON.stringify(report,null,2));console.log('Tre clip parlate: riproduzione reale Chrome superata.');
}finally{await browser.close();}
