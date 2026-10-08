import {launch,HOST_URL,sleep} from './lib.mjs';import {writeFileSync} from 'node:fs';
const b=await launch(),result={};try{const p=await b.newPage();await p.goto(`${HOST_URL}?characters=1&goblin=new`,{waitUntil:'load'});await p.waitForFunction(()=>window.__gallery?.sample().some(g=>g?.state==='ready'),{timeout:60000});
for(const n of [1,2,5])for(const mode of ['old','new']){
 await p.evaluate(({n,mode})=>{window.__gallery.setLayout(n);window.__gallery.setGoblin(mode);window.__gallery.setState('RUN');}, {n,mode});
 if(mode==='new')await p.waitForFunction(n=>window.__gallery.sample().filter(g=>g?.state==='ready').length===n,{timeout:60000},n);
 await sleep(1800);const rows=[];
 for(let i=0;i<40;i++){rows.push(await p.evaluate(()=>({perf:window.__gallery.perf(),cost:window.__gallery.animationCost(),stats:window.__gallery.stats()})));await sleep(100);}
 result[`${n}-${mode}`]={triangles:mode==='new'?35624*n:null,rows};console.log(`${n} ${mode}: 40 samples`);
}writeFileSync(`docs/agent-work/goblin-animation-phase/${process.env.GOBLIN_GPU==='1'?'hardware-':''}gallery-performance.json`,JSON.stringify(result,null,2));
}finally{await b.close();}
