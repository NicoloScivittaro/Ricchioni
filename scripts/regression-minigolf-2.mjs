import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const names=['minigolf-2-selftest','minigolf-camera-selftest','minigolf-selftest','pad-selftest','rounds-selftest','ability-selftest','solo-bots-selftest','quality-selftest','controller-url-selftest','characters-animation-selftest','audio-selftest','geofall-selftest','backrooms-fixes-selftest','kart-abilities-selftest','fighter-abilities-selftest','fps-ads-selftest'];const rows=[];
for(const name of names){const p=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs',`scripts/${name}.ts`],{encoding:'utf8'});rows.push({name,status:p.status,output:(p.stdout+p.stderr).slice(-6000)});console.log(p.status===0?'PASS':'FAIL',name);if(p.status!==0)console.log(p.stdout+p.stderr);}
writeFileSync('docs/agent-work/minigolf-2/regression.json',JSON.stringify(rows,null,2));if(rows.some(p=>p.status!==0))process.exitCode=1;
