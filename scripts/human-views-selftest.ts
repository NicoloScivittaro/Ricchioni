import assert from 'node:assert/strict';
import {humanViewPlayers,splitScreenLayout} from '../src/core/playerViews';
const slots=[0,2,4,1,3];
for(let count=1;count<=5;count++){
 const roster=Array.from({length:5},(_,i)=>({id:`p${i}`,bot:!slots.slice(0,count).includes(i)}));
 const original=JSON.stringify(roster),humans=humanViewPlayers(roster),layout=splitScreenLayout(humans.length);
 assert.equal(humans.length,count);assert.deepEqual(humans,roster.filter(p=>!p.bot));assert.equal(layout.length,count);
 assert.equal(JSON.stringify(roster),original);assert.equal(splitScreenLayout(count),layout);
 assert.ok(Math.abs(layout.reduce((n,r)=>n+r.w*r.h,0)-1)<1e-9);
 for(const [i,a]of layout.entries()){assert.ok(a.w>0&&a.h>0&&a.x>=0&&a.y>=0&&a.x+a.w<=1+1e-9&&a.y+a.h<=1+1e-9);for(const b of layout.slice(i+1))assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<1e-9||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<1e-9);}
}
assert.deepEqual(humanViewPlayers([{id:'phone'},{id:'pad',bot:false},{id:'bot',bot:true}]).map(p=>p.id),['phone','pad']);
assert.deepEqual(humanViewPlayers([{bot:true}]),[]);assert.deepEqual(splitScreenLayout(0),[]);
assert.deepEqual(splitScreenLayout(1),[{x:0,y:0,w:1,h:1}]);
console.log('PASS: 1–5 human views, interleaved bots, pad/phone parity, stable order, no roster mutation, full coverage without overlaps.');
