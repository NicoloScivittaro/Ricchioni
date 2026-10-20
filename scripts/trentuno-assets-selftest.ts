import assert from 'node:assert/strict';
import { readFileSync,statSync,writeFileSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DECK,SUITS,RANKS,cardAsset,BACK_ASSET,RANK_DISPLAY,SUIT_DISPLAY } from '../shared/trentuno/deck';
const out='docs/agent-work/trentuno-italiano';mkdirSync(out,{recursive:true});
const hashes=new Set<string>();let totalBytes=0;
const french=/[♥♦♣♠]|\b(cuori|quadri|fiori|picche|regina|jack|queen|king)\b|>[JQK]<\/text>/i;
assert.equal(DECK.length,40);
assert.deepEqual([...RANKS],['A','2','3','4','5','6','7','F','C','R']);
for(const s of SUITS){
 assert.equal(DECK.filter(c=>c.suit===s).length,10);
 assert.equal(SUIT_DISPLAY[s].name,s.toLowerCase());
}
for(const c of DECK){
 const file='public'+cardAsset(c.id),svg=readFileSync(file,'utf8');
 assert.ok(svg.startsWith('<svg'));
 assert.equal((svg.match(new RegExp(`>${RANK_DISPLAY[c.rank]}</text>`,'g'))??[]).length,2);
 assert.ok(!svg.includes('href="http')&&!svg.includes('<image'));
 assert.ok(svg.includes(`<title>${c.name}</title>`));
 assert.ok(!french.test(svg),c.id);
 assert.ok(svg.includes(`data-suit="${c.suit}"`));
 assert.equal(c.value,c.rank==='A'?11:['F','C','R'].includes(c.rank)?10:Number(c.rank));
 if(c.rank==='C'){assert.match(c.name,/Cavallo/);assert.ok(svg.includes('data-figure="cavallo"'));}
 totalBytes+=statSync(file).size;hashes.add(createHash('sha256').update(svg).digest('hex'));
}
assert.equal(hashes.size,40);
const back=readFileSync('public'+BACK_ASSET,'utf8'),backHash=createHash('sha256').update(back).digest('hex');
assert.equal(backHash,'006841aa9bc40dcd3b044979522302ac2bc7222fa3457daeb81c0f41e918e260');
assert.ok(!DECK.some(c=>back.includes(c.id)));
for(const f of ['atlas.html','showcase.html'])assert.ok(!french.test(readFileSync('public/trentuno/'+f,'utf8')),f);
writeFileSync(out+'/assets-checks.json',JSON.stringify({distinctFronts:hashes.size,cardsPerSuit:10,ranks:[...RANKS],suits:SUITS,figures:['Fante','Cavallo','Re'],frenchReferences:false,totalSvgBytes:totalBytes+Buffer.byteLength(back),originalVectors:true,backUnchanged:true,valuesUnchanged:true},null,2));
console.log('Mazzo italiano: 40 carte, quattro semi, figure corrette; valori e dorso invariati.');
