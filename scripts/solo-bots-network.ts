import assert from 'node:assert/strict';
import {io, type Socket} from 'socket.io-client';
import {EVT} from '../shared/protocol';
import type {RoomState, InputRelayEvent} from '../shared/types';

const sockets: Socket[]=[];
const sleep=(ms:number):Promise<void>=>new Promise(r=>setTimeout(r,ms));
const until=async(fn:()=>boolean,label:string):Promise<void>=>{const t=Date.now();while(Date.now()-t<10000){if(fn())return;await sleep(60);}throw new Error(`Timeout ${label}`);};
const connect=async():Promise<Socket>=>{const s=io('http://127.0.0.1:3001',{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise<void>(r=>s.once('connect',()=>r()));return s;};
const ack=(s:Socket,event:string,payload:unknown):Promise<any>=>new Promise((resolve,reject)=>s.timeout(5000).emit(event,payload,(err:unknown,res:unknown)=>err?reject(err):resolve(res)));
let host:Socket|undefined;
try {
 host=await connect();let state:RoomState|undefined,selected:any,relays:InputRelayEvent[]=[];
 const observe=(s:Socket):void=>{s.on(EVT.roomState,(v:RoomState)=>{state=v;});s.on(EVT.minigameSelected,(v)=>{selected=v;});s.on(EVT.inputRelay,(v)=>relays.push(v));};observe(host);
 const created=await ack(host,EVT.hostCreate,{playerCount:4,targetScore:200});assert.equal(created.ok,true);
 let human=await connect();const joined=await ack(human,EVT.playerJoin,{roomCode:created.roomCode,displayName:'Solo network'});
 human.emit(EVT.playerSelectCharacter,{characterId:'goblin'});human.emit(EVT.playerReady,{ready:true});
 await until(()=>!!state?.players[0]?.ready,'ready');host.emit(EVT.hostSelectMinigame,{minigameId:'quiz'});host.emit(EVT.hostStart);
 await until(()=>state?.players.length===4&&state.phase==='MINIGAME_ROULETTE','bots added');
 const ids=state!.players.map(p=>p.id);assert.equal(state!.players.filter(p=>p.bot).length,3);
 assert.deepEqual(selected.players.map((p:any)=>p.id),ids);
 host.emit(EVT.hostSkip);await until(()=>state?.phase==='MINIGAME_INTRO','intro');host.emit(EVT.hostSkip);await until(()=>state?.phase==='MINIGAME_PLAYING','playing');
 human.disconnect();await until(()=>state!.players[0].connected===false,'disconnect');assert.deepEqual(state!.players.map(p=>p.id),ids);
 human=await connect();const resumed=await ack(human,EVT.playerJoin,{roomCode:created.roomCode,displayName:'Same player',reconnectToken:joined.reconnectToken});
 assert.equal(resumed.playerId,joined.playerId);await until(()=>state!.players[0].connected,'rejoin');assert.deepEqual(state!.players.map(p=>p.id),ids);
 host.disconnect();host=await connect();observe(host);
 const resumedHost=await ack(host,EVT.hostCreate,{hostToken:created.hostToken});assert.equal(resumedHost.roomCode,created.roomCode);
 await until(()=>state?.phase==='MINIGAME_PLAYING','host resume');assert.deepEqual(selected.players.map((p:any)=>p.id),ids);
 const stranger=await connect();stranger.emit(EVT.inputAction,{controlId:'answerA',playerId:ids[1]});await sleep(100);assert.equal(relays.length,0);
 human.emit(EVT.inputAction,{controlId:'answerA',playerId:ids[1]});await until(()=>relays.length===1,'real relay');assert.equal(relays[0].playerId,joined.playerId);
 const oldRound=state!.roundId;host.emit(EVT.hostMinigameFinished,{roundId:oldRound,results:ids.map((playerId,i)=>({playerId,placement:i+1,score:4-i}))});
 await until(()=>!!state?.lastResults,'results');assert.equal(state!.lastResults!.ranking.length,4);
 host.emit(EVT.hostSelectMinigame,{minigameId:'reaction'});
 for(let i=0;i<12&&state!.roundId===oldRound;i++){host.emit(EVT.hostSkip);await sleep(100);}
 await until(()=>state!.roundId!==oldRound,'next round');assert.deepEqual(state!.players.map(p=>p.id),ids);assert.equal(state!.players.filter(p=>p.bot).length,3);
 assert.deepEqual(selected.players.map((p:any)=>p.id),ids);assert.equal(selected.minigameId,'reaction');
 host.emit(EVT.hostRestartMatch);await until(()=>state?.phase==='LOBBY','restart');assert.equal(state!.players.length,1);assert.deepEqual(state!.charactersLocked,['goblin']);
 const friend=await connect();const added=await ack(friend,EVT.playerJoin,{roomCode:created.roomCode,displayName:'Friend'});assert.equal(added.ok,true);
 friend.emit(EVT.playerSelectCharacter,{characterId:'buttafuori'});friend.emit(EVT.playerReady,{ready:true});human.emit(EVT.playerReady,{ready:true});
 await until(()=>state!.players.length===2&&state!.players.every(p=>p.ready),'two real players');host.emit(EVT.hostStart);
 await until(()=>state!.phase!=='LOBBY','multiplayer');assert.equal(state!.players.length,2);assert.ok(state!.players.every(p=>!p.bot));
 console.log('PASS network: one human + 3 bots; phone/host reconnect preserve IDs; sockets cannot impersonate bots; bots survive next round; restart unlocks characters; 2 humans start without bots');
}finally{host?.emit(EVT.hostBackToLobby);await sleep(100);sockets.forEach(s=>s.disconnect());}
