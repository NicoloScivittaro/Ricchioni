import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const dir='docs/agent-work/physics-update',results=[];
const games='quiz,reaction,memory,arena,dodgeball,soccer,volleyball,kart3d,cultura,fps,cornicione,casacarbo,minigolf';
const tasks=[
 ['volley-pad','gamepad-volleyball.mjs',{}],['volley-five','volleyball-direction.mjs',{}],
 ['fps-five','fps-ads.mjs',{}],['arena-five','arena-combat.mjs',{}],
 ['matrix-13','matrix.mjs',{GAMES:games,MATRIX_SETTLE_MS:'10000'}],
 ['controllers-13','controllers.mjs',{GAMES:games,OUT:`${dir}/controllers`}],
 ['pause-corn','pause.mjs',{GAME:'cornicione'}],['pause-kart','pause.mjs',{GAME:'kart3d'}],
 ['reconnect','reconnect.mjs',{}],
 ['leak-five-warmed','leak.mjs',{GAMES:games,ROUNDS:'26',WARMUP_ROUNDS:'13',PHONES:'5',LEAK_SETTLE_MS:'10000',OUT_JSON:`${dir}/leak-warmed.json`}]
];
for(const [name,file,env] of tasks){
 console.log('RUN',name);const start=Date.now();let output='';
 const code=await new Promise(resolve=>{const p=spawn(process.execPath,[`scripts/e2e/${file}`],{env:{...process.env,...env},windowsHide:true});p.stdout.on('data',d=>{output+=d;process.stdout.write(d);});p.stderr.on('data',d=>{output+=d;process.stderr.write(d);});p.on('exit',resolve);});
 writeFileSync(`${dir}/${name}.log`,output);results.push({name,code,seconds:(Date.now()-start)/1000});writeFileSync(`${dir}/browser-regression.json`,JSON.stringify(results,null,2));console.log(code===0?'PASS':'FAIL',name);
}
if(results.some(r=>r.code!==0))process.exitCode=1;
