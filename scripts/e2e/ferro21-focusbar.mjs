// Ferro 2.1: the controller focus warning, before (old style, top) vs now (smaller, bottom). Behaviour untouched.
import{launch}from'./lib.mjs';
process.env.VIEWPORT??='1280x720';
const browser=await launch(),out=process.env.OUT??'docs/agent-work/ferro-21';
try{
 const page=await browser.newPage();await page.goto('http://localhost:5191/',{timeout:240000});await page.waitForFunction(()=>!!document.getElementById('pad-focus'),{timeout:120000});
 const info=await page.evaluate(()=>{const bar=document.getElementById('pad-focus');bar.style.display='block';bar.textContent='⚠ CLICCA SULLA FINESTRA DEL GIOCO · i controller funzionano solo con il focus';
  const old=document.createElement('div');old.className='ui-alert warn';old.style.cssText='z-index:99000;top:auto;bottom:16vh;display:block';old.textContent='⚠️ CLICCA SULLA FINESTRA DEL GIOCO — senza focus il browser può ignorare i controller';document.body.appendChild(old);
  const r=e=>{const b=e.getBoundingClientRect();return{w:Math.round(b.width),h:Math.round(b.height),font:getComputedStyle(e).fontSize};};return{now:r(bar),before:r(old)};});
 console.log(JSON.stringify(info));await page.screenshot({path:`${out}/focus-warning.png`,clip:{x:0,y:430,width:1280,height:290}});
}finally{await browser.close();}
