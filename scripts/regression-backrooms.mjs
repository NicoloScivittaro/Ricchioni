import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const names=['backrooms-selftest','fps-ads-selftest','geofall-selftest','pad-selftest','ability-selftest','rounds-selftest','solo-bots-selftest','audio-selftest','minigolf-selftest','quality-selftest','characters-animation-selftest'];const rows=[];
for(const name of names){const p=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs',`scripts/${name}.ts`],{encoding:'utf8'});rows.push({name,status:p.status,output:(p.stdout+p.stderr).slice(-6000)});console.log(p.status===0?'PASS':'FAIL',name);if(p.status!==0)console.log(p.stdout+p.stderr);}
writeFileSync(`${process.env.BACK_OUT??'docs/agent-work/backrooms'}/regression.json`,JSON.stringify(rows,null,2));if(rows.some(p=>p.status!==0))process.exitCode=1;
