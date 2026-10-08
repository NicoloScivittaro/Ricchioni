import assert from 'node:assert/strict';
import { launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep } from './lib.mjs';
const browser=await launch();
const until=async(fn,what)=>{const t=Date.now();while(Date.now()-t<60000){if(await fn())return;await sleep(100);}throw new Error(`Timeout ${what}`);};
try{
 const {page,code}=await createRoomOnHost(browser),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const p=await addPhone(browser,code,'BOSCHI',1);await addPhone(browser,code,'Carbo',3);
 p.page.on('pageerror',e=>errors.push(String(e)));
 const pid=await p.page.evaluate(()=>localStorage.getItem('ricchioni.pid'));
 await hostEval(page,gm=>gm.selectMinigame('fps'));await sleep(150);await page.keyboard.press('Enter');
 await until(async()=>(await hostSnapshot(page)).phase==='MINIGAME_PLAYING','FPS');
 await p.page.waitForFunction(()=>document.querySelector('#fps-fire')&&!document.querySelector('#fps-fire').disabled,{timeout:60000});
 const pressed=()=>hostEval(page,(gm,pid)=>gm.input.get(pid).peekPressed('fire'),pid);
 await p.page.evaluate(()=>document.querySelector('#fps-fire').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:71})));
 await until(pressed,'held fire received');
 await p.page.evaluate(()=>window.dispatchEvent(new Event('blur')));await until(async()=>!await pressed(),'blur releases fire');
 await p.page.evaluate(()=>document.querySelector('#fps-fire').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:72})));
 await until(pressed,'new fire gesture after blur');
 await p.page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await until(async()=>!await pressed(),'hidden tab releases fire');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('FPS phone: held fire released on blur and hidden document; new gesture works after focus interruption; no page errors: PASS');
}finally{await browser.close();}
