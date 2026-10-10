import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL=process.env.PROD_CTRL??'http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch();
const report={phones:5,questions:[],errors:[],accelerated:false};
const until=async(fn,what,ms=45000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await sleep(100);}throw Error(`Timeout ${what}`);};
async function observe(page,callback){
 page.on('pageerror',e=>report.errors.push(String(e)));
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');
 cdp.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{callback(...JSON.parse(response.payloadData.slice(2)));}catch{}});
}
try{
 const host=await browser.newPage();let state;
 await observe(host,(event,data)=>{if(event==='room:state')state=data;});
 await host.goto(process.env.PROD_HOST??'http://127.0.0.1:3001/',{waitUntil:'load'});
 await host.waitForSelector('#app canvas');await sleep(1500);
 for(let i=0;i<3;i++){await host.keyboard.press('ArrowRight');await sleep(180);}
 await host.keyboard.press('Enter');await until(()=>state?.roomCode,'stanza');
 assert.equal(state.playerCount,5);
 const phones=[];
 for(const [name,char] of [['Niko',0],['BOSCHI',1],['Christian',2],['Carbo',3],['Ciro',4]]){
  const p=await addPhone(browser,state.roomCode,name,char);await observe(p.page,(event,data)=>{if(event==='private:data'&&data.type==='quizState')p.quiz=data;});phones.push(p);
 }
 await until(()=>state.players.length===5&&state.players.every(p=>p.ready),'cinque pronti');
 await host.keyboard.press('ArrowRight');await sleep(180);await host.keyboard.press('Enter');
 await until(()=>state.phase==='MINIGAME_PLAYING'&&state.currentMinigame?.minigameId==='quiz','Quiz');
 for(let n=1;n<=10;n++){
  await until(()=>phones.every(p=>p.quiz?.questionNumber===n&&p.quiz.phase==='question'),`domanda ${n}`);
  const q=phones[0].quiz;
  for(const p of phones){
   assert.equal(await p.page.$eval('#quiz-question',el=>el.textContent),q.question);
   assert.deepEqual(await p.page.$$eval('.quiz-answer-text',es=>es.map(e=>e.textContent)),q.answers);
   assert.equal(p.quiz.correctIndex,null);
  }
  if(n===2){
   await host.keyboard.press('Escape');await phones[0].page.waitForSelector('#pause-overlay');
   phones[0].quiz=null;await phones[0].page.reload({waitUntil:'load'});
   await until(()=>phones[0].quiz?.questionKey===q.questionKey,'recupero privato in pausa',5000);
   assert.equal(await phones[0].page.$eval('#quiz-question',el=>el.textContent),q.question);
   await host.keyboard.press('Escape');await phones[0].page.waitForFunction(()=>!document.querySelector('#pause-overlay'));
  }
  for(const p of phones){
   await p.page.click('.quiz-ans-b');assert.equal(p.quiz.myAnswerIndex,null);
   await p.page.click('#quiz-confirm');
   await until(()=>p.quiz.myAnswerIndex===1,`${p.name}: conferma`,5000);
   assert.ok(await p.page.$eval('#quiz-confirm',el=>el.disabled));
  }
  report.questions.push({number:n,question:q.question,fivePhonesConfirmed:true});
  await until(()=>phones.every(p=>p.quiz?.phase!=='question'),`fine domanda ${n}`);
 }
 await until(()=>state.phase==='ROUND_RESULTS'||state.phase==='MATCH_END','risultati',20000);
 assert.equal(state.lastResults.results.length,5);
 assert.deepEqual(report.errors,[]);
 writeFileSync('docs/agent-work/post-playtest/quiz-production.json',JSON.stringify(report,null,2));
 console.log('PASS produzione senza debug: 5 telefoni, 10 domande a tempo reale, selezione/conferma, recupero in pausa e risultati naturali; nessun errore.');
}finally{await browser.close();}
