import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL=process.env.PROD_CTRL??'http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const dir='docs/agent-work/physics-update',report=[];
const until=async(fn,what)=>{const end=Date.now()+60000;while(Date.now()<end){if(await fn())return;await sleep(100);}throw Error(`Timeout ${what}`);};
// Si usano il menu vero e la rete di produzione; nessun import dei moduli di sviluppo.
for(const [id,arrows] of [['quiz',1],['volleyball',7],['minigolf',13]]){
 const browser=await launch(),row={id,errors:[],views:[]};
 try{
  const host=await browser.newPage();let state;
  host.on('pageerror',e=>row.errors.push(String(e)));
  const cdp=await host.createCDPSession();await cdp.send('Network.enable');
  cdp.on('Network.webSocketFrameReceived',({response})=>{
   if(!response.payloadData.startsWith('42'))return;
   try{const [event,data]=JSON.parse(response.payloadData.slice(2));if(event==='room:state')state=data;}catch{}
  });
  await host.goto(process.env.PROD_HOST??'http://127.0.0.1:3001/',{waitUntil:'load'});
  await host.waitForSelector('#app canvas');await sleep(1500);await host.keyboard.press('Enter');
  await until(()=>state?.roomCode,'stanza');const phone=await addPhone(browser,state.roomCode,'Layout',0);
  phone.page.on('pageerror',e=>row.errors.push(String(e)));
  await until(()=>state.players.length===1&&state.players[0].ready,'pronto');
  for(let i=0;i<arrows;i++){await host.keyboard.press('ArrowRight');await sleep(150);}
  await host.keyboard.press('Enter');
  await until(()=>state.phase==='MINIGAME_PLAYING'&&state.currentMinigame?.minigameId===id,`via ${id}`);
  await sleep(6500);
  for(const [name,width,height] of [['portrait',390,800],['landscape',800,390],['small',360,640]]){
   await phone.page.setViewport({width,height,isMobile:true,hasTouch:true});await sleep(500);
   const v=await phone.page.evaluate(()=>{
    const buttons=[...document.querySelectorAll('#app button')].filter(el=>!el.disabled&&el.getBoundingClientRect().width>0);
    return {width:innerWidth,height:innerHeight,buttons:buttons.map(el=>{
     const r=el.getBoundingClientRect();return {label:el.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,visible:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el};
    }),sourceModules:performance.getEntriesByType('resource').some(e=>e.name.includes('/src/'))};
   });
   assert.equal(v.sourceModules,false);assert.ok(v.buttons.length>=3,'tasti di gioco realmente disponibili');
   for(const b of v.buttons){assert.ok(b.w>=44&&b.h>=44,`${id}/${name}: hit area ${b.label}`);assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1,`${id}/${name}: dentro schermo ${b.label}`);assert.ok(b.visible,`${id}/${name}: nessuna copertura ${b.label}`);}
   await phone.page.screenshot({path:`${dir}/production-${id}-${name}.png`});row.views.push({name,...v});
  }
  row.assets=await host.evaluate(()=>performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname).filter(p=>/\/assets\/main-/.test(p)));
  assert.deepEqual(row.errors,[]);console.log('PASS produzione layout',id);
 }catch(e){row.failure=String(e);throw e;}finally{report.push(row);writeFileSync(`${dir}/production-controllers.json`,JSON.stringify(report,null,2));await browser.close();}
}
