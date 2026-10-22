import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {launch} from './lib.mjs';
process.env.GOBLIN_GPU='1';
const root='http://localhost:3012',out='docs/agent-work/ferro-2',r={errors:[],assets:[]},b=await launch();
try{
 const p=await b.newPage();p.on('pageerror',e=>r.errors.push(e.message));await p.goto(root,{waitUntil:'networkidle0'});await p.waitForSelector('#pm-create',{timeout:30000});r.compiledHome=true;
 for(const id of ['goblin','buttafuori','judoka','ciro']){
  const path='assets/ferro2/skin-'+id+'.json',response=await fetch(root+'/'+path);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer()),local=readFileSync('public/'+path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(local).digest('hex'));assert.deepEqual(bytes,readFileSync('dist/'+path));
  const clips=JSON.parse(bytes);assert.equal(Object.keys(clips).length,15);assert.ok(Object.values(clips).every(c=>c.frames.length>1));r.assets.push({character:id,bytes:bytes.length,clips:15,status:response.status});
 }
 assert.deepEqual(r.errors,[]);r.status='passed';console.log(JSON.stringify(r));
}catch(e){r.failure=String(e);console.error(e);process.exitCode=1;}finally{await b.close();writeFileSync(out+'/production-skins.json',JSON.stringify(r,null,2));}
