import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
process.env.HOST_URL=process.env.HOST_URL??'http://localhost:5175/';
const {launch}=await import('./lib.mjs');const browser=await launch();
try{
 const page=await browser.newPage();await page.setViewport({width:1500,height:1200});await page.goto(process.env.HOST_URL+'trentuno/atlas.html',{waitUntil:'networkidle0'});
 const check=await page.evaluate(async()=>{
   const all=[...document.querySelectorAll('section img')];const loaded=all.every(i=>i.complete&&i.naturalWidth===220);
   const back=new Image();back.src='/trentuno/back.svg';await back.decode();const canvas=document.createElement('canvas');canvas.width=220;canvas.height=340;const ctx=canvas.getContext('2d');ctx.drawImage(back,0,0);const data=ctx.getImageData(0,0,220,340).data;let sum=0,bad=0;
   for(let p=0;p<220*340;p++){const reverse=220*340-1-p;for(let c=0;c<3;c++){const difference=Math.abs(data[p*4+c]-data[reverse*4+c]);sum+=difference;if(difference>16)bad++;}}
   return {fronts:all.length,loaded,backRotationMeanError:sum/(220*340*3),backRotationDifferentFraction:bad/(220*340*3)};
 });
 assert.equal(check.fronts,40);assert.ok(check.loaded);assert.ok(check.backRotationMeanError<1.5);assert.ok(check.backRotationDifferentFraction<.02);
 await page.screenshot({path:'docs/agent-work/trentuno/browser/mazzo-40.png',fullPage:true});writeFileSync('docs/agent-work/trentuno/art-browser-tests.json',JSON.stringify(check,null,2));console.log(check);
}finally{await browser.close();}
