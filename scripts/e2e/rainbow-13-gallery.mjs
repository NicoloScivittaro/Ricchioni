import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const {launch,sleep}=await import('./lib.mjs');
const browser=await launch(),errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3008/rainbow-1-3/preview.html',{waitUntil:'load'});
 const images=await page.evaluate(async()=>{const images=[...document.images];for(const i of images)i.loading='eager';await Promise.all(images.map(i=>i.complete?Promise.resolve():new Promise((resolve,reject)=>{i.onload=resolve;i.onerror=reject;})));return images.map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight}));});
 assert.equal(images.length,20);assert.ok(images.every(i=>i.width===1280&&i.height===720));
 await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
 const duration=await page.$eval('video',v=>v.duration);assert.ok(duration>167&&duration<175);
 await page.$eval('video',async v=>{v.muted=true;await v.play();});await sleep(1800);
 const playing=await page.$eval('video',v=>({time:v.currentTime,error:v.error?.message??null}));assert.ok(playing.time>1);assert.equal(playing.error,null);
 await page.$eval('video',v=>{v.pause();v.currentTime=v.duration-3;});await sleep(600);
 const end=await page.$eval('video',v=>({time:v.currentTime,ready:v.readyState,error:v.error?.message??null}));assert.ok(end.time>160);assert.equal(end.error,null);
 const report=await page.evaluate(async()=>{const r=await fetch('REPORT.md');return {status:r.status,text:await r.text()};});assert.equal(report.status,200);assert.ok(report.text.includes('56,64'));assert.ok(!report.text.includes('FINAL_'));assert.deepEqual(errors,[]);
 writeFileSync('docs/agent-work/rainbow-1-3/after/gallery-checks.json',JSON.stringify({images:images.length,allImages1280x720:true,duration,playing,end,reportServed:true,errors},null,2));console.log('PASS gallery: 20 real images, report, indexed video plays and seeks, no errors.');
}finally{await browser.close();}
