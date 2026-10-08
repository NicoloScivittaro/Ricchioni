import assert from 'node:assert/strict';
import {launch,HOST_URL,sleep,hostEval} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const b=await launch();try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(`${HOST_URL}?debug=1&goblin=new`,{waitUntil:'load'});
 await p.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>/GameManager\.ts/.test(e.name)),{timeout:30000});
 await hostEval(p,gm=>{
  const players=[0,1].map(i=>({id:`result${i}`,characterId:'goblin',displayName:i?'GOBLIN SCONFITTO':'GOBLIN VINCITORE',name:'Goblin',roleTitle:'',avatar:'👺',color:'#22cc88',quote:'',score:0}));
  const results=players.map((p,i)=>({playerId:p.id,placement:i+1,score:10-i,stats:['DEV risultato']}));
  gm.state={players,currentMinigame:{minigameId:'cornicione',name:'CORNICIONE',category:'action'},lastResults:{results,ranking:players.map(p=>p.id),deltas:{result0:3,result1:0},double:false}};
  gm.game.scene.stop('LobbyScene');gm.game.scene.start('ResultsScene');
 });
 await p.waitForFunction(async()=>{const url=performance.getEntriesByType('resource').find(e=>/GameManager\.ts/.test(e.name)).name,{game:gm}=await import(url);return gm.game.textures.getTextureKeys().some(k=>k.startsWith('goblin-results'));},{timeout:30000});
 await p.waitForFunction(async()=>{const url=performance.getEntriesByType('resource').find(e=>/GameManager\.ts/.test(e.name)).name,{game:gm}=await import(url);const s=gm.game.scene.getScene('ResultsScene');return s.children.list.filter(x=>x.type==='Container').flatMap(c=>c.list).filter(x=>x.texture?.key?.startsWith('goblin-results')&&x.visible).length===2;},{timeout:90000});
 await sleep(5000);await p.keyboard.press('F3');await sleep(200);await p.screenshot({path:'e2e-shots/goblin-animations/results-victory-defeat.png'});
 const visible=await hostEval(p,gm=>gm.game.scene.getScene('ResultsScene').children.list.filter(x=>x.type==='Container').flatMap(c=>c.list).filter(x=>x.texture?.key?.startsWith('goblin-results')&&x.visible).length);
 assert.equal(visible,2,'two animated result portraits');
 await hostEval(p,gm=>gm.game.scene.stop('ResultsScene'));await sleep(300);
 const disposal=await hostEval(p,gm=>gm.game.textures.getTextureKeys().filter(k=>k.startsWith('goblin-results')).length);
 assert.equal(disposal,0,'result atlas disposed');
 const counters=await p.evaluate(async()=>{const m=await import('/src/minigames/characters/goblinVisual.ts');return m.goblinVisualCounters();});
 assert.equal(counters.liveInstances,0);assert.equal(errors.length,0,errors.join(';'));
 writeFileSync('docs/agent-work/goblin-animation-phase/results.json',JSON.stringify({visible,disposal,counters,errors},null,2));console.log('Results: victory/defeat visible; atlas and instances disposed; no runtime errors');
}finally{await b.close();}
