import {performance} from 'node:perf_hooks';
import {writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const baselinePath=resolve('docs/agent-work/volleyball-casacarbo/waterCore-baseline.ts');
const source=execFileSync('git',['show','0bb8534:src/minigames/casaCarbo/waterCore.ts'],{encoding:'utf8'}).replaceAll("from './","from '../../../src/minigames/casaCarbo/");
writeFileSync(baselinePath,source);
const {CasaCarboWorld:Before}=await import(pathToFileURL(baselinePath).href);
rmSync(baselinePath);
import {CasaCarboWorld as After} from '../src/minigames/casaCarbo/waterCore';
import {Rng} from '../shared/rng';
const costs:{before:number[];after:number[]}={before:[],after:[]};
for(let round=0;round<10;round++)for(const tag of round%2?['after','before'] as const:['before','after'] as const){
 const rng=new Rng(31),Class=tag==='before'?Before:After,w=new Class({ids:['a','b','c','d','e'],characters:['goblin','buttafuori','dottore','judoka','ciro'],rng:()=>rng.next()});
 let time=0,n=0;for(let i=0;i<7210;i++){const t=performance.now();w.step(1/60,{});time+=performance.now()-t;w.drainEvents();n++;}
 if(round>=2)costs[tag].push(time/n);
}
const mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/a.length;
const result={baseline:'0bb8534',players:5,hz:60,wholeMatches:20,beforeMeanMs:mean(costs.before),afterMeanMs:mean(costs.after),samples:costs,note:'Paired simulator-only benchmark, same seed and idle inputs; not a GPU/FPS comparison.'};
writeFileSync('docs/agent-work/volleyball-casacarbo/simulator-performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
