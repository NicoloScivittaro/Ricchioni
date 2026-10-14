import assert from 'node:assert/strict';
import { readFileSync,statSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DECK,cardAsset,BACK_ASSET } from '../shared/trentuno/deck';
const hashes=new Set<string>();let checks=0,totalBytes=0;
for(const c of DECK){const file='public'+cardAsset(c.id),svg=readFileSync(file,'utf8');assert.ok(svg.startsWith('<svg'));assert.ok(svg.includes(`>${c.rank}</text>`));assert.ok(!svg.includes('href="http'));assert.ok(!svg.includes('<image'));assert.equal((svg.match(new RegExp(`>${c.rank}</text>`,'g'))??[]).length,2);checks+=5;totalBytes+=statSync(file).size;hashes.add(createHash('sha256').update(svg).digest('hex'));}
assert.equal(hashes.size,40);checks++;const back=readFileSync('public'+BACK_ASSET,'utf8');assert.ok(back.includes('rotate(180 110 170)'));assert.equal((back.match(/31 DEGLI INFAMI/g)??[]).length,2);checks+=2;
writeFileSync('docs/agent-work/trentuno/assets-tests.json',JSON.stringify({checks,distinctFronts:hashes.size,totalSvgBytes:totalBytes+Buffer.byteLength(back),originalVectors:true,sharedBack:true},null,2));console.log(`${checks} controlli degli asset superati.`);
