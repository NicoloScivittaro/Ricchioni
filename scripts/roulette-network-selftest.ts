import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { EVT } from '../shared/protocol';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';
import type { MinigameSelectedPayload } from '../shared/protocol';
const url=process.env.ROULETTE_TEST_URL??'http://localhost:3003';
const host=io(url,{transports:['websocket']}),phones=[io(url,{transports:['websocket']}),io(url,{transports:['websocket']})];
const until=async(test:()=>boolean,label:string)=>{const start=Date.now();while(!test()){if(Date.now()-start>15000)throw Error('Timeout '+label);await new Promise(r=>setTimeout(r,30));}};
const rpc=(socket:typeof host,event:string,payload:unknown)=>new Promise<any>((resolve,reject)=>{socket.timeout(5000).emit(event,payload,(error:unknown,ack:any)=>error?reject(error):resolve(ack));});
let current:MinigameSelectedPayload|null=null;const seen:string[]=[];host.on(EVT.minigameSelected,p=>{current=p;seen.push(p.minigameId);});
try{
 await until(()=>host.connected&&phones.every(p=>p.connected),'socket');const room=await rpc(host,EVT.hostCreate,{playerCount:2,targetScore:200});assert.ok(room.ok);
 for(let i=0;i<2;i++){assert.ok((await rpc(phones[i],EVT.playerJoin,{roomCode:room.roomCode,displayName:'Ciclo '+i})).ok);phones[i].emit(EVT.playerSelectCharacter,{characterId:i?'buttafuori':'goblin'});phones[i].emit(EVT.playerReady,{ready:true});}
 await new Promise(r=>setTimeout(r,150));host.emit(EVT.hostStart);await until(()=>!!current,'primo giro');
 const count=MINIGAME_DEFINITIONS.filter(d=>d.enabled!==false&&d.minPlayers<=2&&d.maxPlayers>=2).length;
 for(let i=1;i<count*3;i++){const previous=seen.length;host.emit(EVT.hostSkipMinigame);await until(()=>seen.length>previous,'estrazione '+i);}
 assert.equal(new Set(seen.slice(0,count)).size,count);for(let i=count;i<seen.length;i++)assert.equal(seen[i],seen[i-count]);assert.equal(seen.length,count*3);
 host.emit(EVT.hostRestartMatch);console.log(`RULLO rete reale: ${seen.length} estrazioni Socket.IO, ${count} giochi per giro, zero ripetizioni anticipate.`);
}finally{host.disconnect();phones.forEach(p=>p.disconnect());}
