import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,sleep} from './lib.mjs';
const browser=await launch(),out='docs/agent-work/ribaltati-3';
try{
 const page=await browser.newPage();await page.goto('http://localhost:5179/docs/agent-work/ribaltati-3/comparison.html',{waitUntil:'load'});
 await page.waitForFunction(()=>document.querySelector('video').readyState>=1,{timeout:20000});
 await page.$eval('video',async v=>{v.muted=true;await v.play();});await sleep(700);
 const result=await page.$eval('video',async v=>{const played=v.currentTime;v.pause();await new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=18;});return{played,duration:v.duration,width:v.videoWidth,height:v.videoHeight,at:v.currentTime,error:v.error?.message??null};});
 assert.ok(result.played>0);assert.ok(result.duration>=40);assert.equal(result.width,1280);assert.equal(result.height,720);assert.equal(result.error,null);
 await (await page.$('video')).screenshot({path:`${out}/video-playback.png`});
 writeFileSync(`${out}/video-playback.json`,JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
