import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { installMock, add, tap, XBOX, DS, GENERIC, until, slots, sceneEval, startGame } from './padmock.mjs';
const browser = await launch();
const report = { questions: [], errors: [], acceleratedIntermissions: true };
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 });
  page.on('pageerror', e => report.errors.push(String(e)));
  assert.equal(await hostEval(page, gm => gm.state.playerCount), 5);
  const phones = [];
  for (const [name, char] of [['Goblin',0],['BOSCHI',1],['Dottore',2],['Carbo',3],['Ciro',4]]) {
    const p = await addPhone(browser,code,name,char);
    p.page.on('pageerror', e => report.errors.push(String(e)));
    const cdp = await p.page.createCDPSession(); await cdp.send('Network.enable');
    cdp.on('Network.webSocketFrameReceived', ({response}) => {
      if (!response.payloadData.startsWith('42')) return;
      try { const [event,data] = JSON.parse(response.payloadData.slice(2)); if(event === 'private:data' && data.type === 'quizState') p.quiz = data; } catch {}
    });
    phones.push(p);
  }
  const ids = await hostEval(page, gm => gm.state.players.map(p=>p.id));
  const Q = (fn,arg) => sceneEval(page,'quiz',fn,arg);
  await installMock(page);
  for (let i=0;i<5;i++) {
    await add(page,i,[XBOX,DS,GENERIC][i%3]);
    await page.evaluate(id=>window.__pads.setTarget(id),ids[i]); await tap(page,i,'A');
  }
  await page.evaluate(()=>window.__pads.setTarget(null));
  const pairing = await slots(page);
  await startGame(page,'quiz');
  await until(async()=>await Q(g=>g.controlsDone && g.manager.phase==='question'),30000,'domanda 1');
  assert.equal(await page.evaluate(()=>window.__pads.contextNow()),'PHONE_TEXT');
  await tap(page,0,'A'); await tap(page,0,'RB');
  assert.equal(await Q((g,id)=>g.manager.players.get(id).answerIndex,ids[0]),null);
  assert.equal(await Q((g,id)=>g.manager.players.get(id).abilityUsed,ids[0]),false);
  const initialKey = await Q(g=>g.manager.questionKey());
  await phones[0].page.click('#quiz-ability-btn');
  await until(async()=>await Q(g=>g.manager.questionKey())!==initialKey,5000,'Goblin rifiuta');
  await until(async()=>await Q(g=>g.manager.phase==='question'),10000,'nuova domanda');
  const confirm = async(i,index) => {
    await phones[i].page.waitForFunction(()=>!!document.querySelector('.quiz-answer:not(:disabled)'));
    await phones[i].page.click(`.quiz-ans-${'abcd'[index]}`);
    assert.equal(await Q((g,id)=>g.manager.players.get(id).answerIndex,ids[i]),null,'selezione ancora privata e non confermata');
    await phones[i].page.click('#quiz-confirm');
    await until(async()=>await Q((g,id)=>g.manager.players.get(id).answerIndex!==null,ids[i]),5000,'risposta ricevuta');
  };
  for(let n=1;n<=10;n++) {
    await until(async()=>await Q((g,number)=>g.manager.questionIndex+1===number && g.manager.phase==='question',n),15000,`domanda ${n}`);
    const q=await Q(g=>g.manager.currentQuestion());
    for(const p of phones) {
      await p.page.waitForFunction(q=>document.querySelector('#quiz-question')?.textContent===q.question,{},q);
      assert.deepEqual(await p.page.$$eval('.quiz-answer-text',es=>es.map(e=>e.textContent)),q.answers);
      assert.equal(p.quiz.correctIndex,null);
      assert.equal(p.quiz.hintText,null);
      assert.equal(p.quiz.ciroBreakdown,null);
    }
    if(n===1) {
      await phones[2].page.click('#quiz-ability-btn');
      await until(async()=>!!phones[2].quiz?.hintText,5000,'indizio Dottore');
      assert.ok(phones.filter((_,i)=>i!==2).every(p=>!p.quiz.hintText),'indizio privato');
      await phones[4].page.click('#quiz-ability-btn');
      await until(async()=>await Q((g,id)=>g.manager.players.get(id).ciroWaiting,ids[4]),5000,'Ciro aspetta');
      await confirm(3,q.correctAnswerIndex);
      await phones[3].page.click('#quiz-ability-btn');
      await until(async()=>await Q((g,id)=>!g.manager.players.get(id).hasAnsweredFinal,ids[3]),5000,'Carbo riapre');
      await confirm(3,q.correctAnswerIndex);
      assert.equal(await Q((g,id)=>g.manager.players.get(id).points,ids[3]),1,'nessun doppio accredito');
      const wrong=(q.correctAnswerIndex+1)%4;
      await confirm(1,wrong);
      await phones[1].page.click('#quiz-ability-btn');
      await until(async()=>await Q((g,id)=>g.manager.players.get(id).secondChanceArmed,ids[1]),5000,'BOSCHI riprova');
      await confirm(1,q.correctAnswerIndex);
      await confirm(0,q.correctAnswerIndex); await confirm(2,q.correctAnswerIndex);
      await Q(g=>{ for(let i=0;i<80 && !g.manager.canAnswer(g.ctx.players[4].id);i++) g.update(0,250); });
      await until(async()=>!!phones[4].quiz?.ciroBreakdown,5000,'riepilogo Ciro');
      assert.ok(phones.slice(0,4).every(p=>!p.quiz.ciroBreakdown));
      await confirm(4,q.correctAnswerIndex);
    } else {
      if(n===2) {
        await page.keyboard.press('Escape');
        await phones[0].page.waitForSelector('#pause-overlay');
        const elapsed=await Q(g=>g.manager.questionElapsed);
        await phones[0].page.reload({waitUntil:'load'});
        await phones[0].page.waitForFunction(q=>document.querySelector('#quiz-question')?.textContent===q.question,{},q);
        await phones[0].page.waitForSelector('#pause-overlay');
        await sleep(500); assert.equal(await Q(g=>g.manager.questionElapsed),elapsed);
        await page.keyboard.press('Escape');
        await phones[0].page.waitForFunction(()=>!document.querySelector('#pause-overlay'));
      }
      for(let i=0;i<5;i++) await confirm(i,q.correctAnswerIndex);
    }
    report.questions.push({number:n, question:q.question, fivePhones:true});
    if(n===2) await phones[0].page.screenshot({path:'docs/agent-work/post-playtest/quiz-phone.png'});
    await until(async()=>await Q(g=>g.manager.phase!=='question'),5000,'rivelazione');
    await Q(g=>{ for(let i=0;i<80 && g.manager.phase!=='question' && !g.manager.finished;i++) g.update(0,250); });
  }
  await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati naturali');
  const results=await hostEval(page,gm=>gm.state.lastResults.results);
  assert.equal(results.length,5);
  assert.equal(await slots(page),pairing);
  await hostEval(page,gm=>gm.backToLobby());
  await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');
  assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);
  assert.deepEqual(report.errors,[]);
  writeFileSync('docs/agent-work/post-playtest/quiz-browser.json',JSON.stringify(report,null,2));
  console.log('PASS: 5 telefoni, 10 domande, 5 abilità, pad ignorati, conferma, privacy, riconnessione in pausa, risultati naturali e lobby. Intermezzi accelerati.');
} finally { await browser.close(); }
