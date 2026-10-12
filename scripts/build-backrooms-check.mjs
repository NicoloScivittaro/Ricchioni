import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const commands=[['typecheck',['node_modules/typescript/bin/tsc','--noEmit']],['build',['node_modules/vite/bin/vite.js','build']]];const rows=[];
for(const[name,args]of commands){const start=Date.now();const p=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:10*1024*1024});rows.push({name,exit:p.status,seconds:(Date.now()-start)/1000,output:(p.stdout+p.stderr).slice(-4500)});console.log(name,p.status);if(p.status!==0)break;}
writeFileSync('docs/agent-work/backrooms/build.json',JSON.stringify(rows,null,2));if(rows.some(r=>r.exit!==0))process.exitCode=1;
