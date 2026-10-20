import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { RoomManager } from '../server/RoomManager';
import { EVT } from '../shared/protocol';
import type { Server, Socket } from 'socket.io';
import type { Command, PrivateState, PublicState } from '../shared/trentuno/types';
import { writeFileSync } from 'node:fs';
const packets:{to:string;event:string;data:any}[]=[];
const io={to:(to:string)=>({emit:(event:string,data:any)=>packets.push({to,event,data})})} as unknown as Server;
const manager=new RoomManager(io);
class Fake extends EventEmitter {constructor(readonly id:string){super();} }
const host=new Fake('host'),a=new Fake('phone-a'),b=new Fake('phone-b'),outsider=new Fake('outside');
for(const socket of [host,a,b,outsider])manager.handleConnection(socket as unknown as Socket);
function rpc(socket:Fake,event:string,data?:unknown):any{let ack:any;socket.emit(event,data,(value:any)=>{ack=value;});return ack;}
const roomAck=rpc(host,EVT.hostCreate,{playerCount:2,targetScore:60});assert.ok(roomAck.ok);
const identityA=rpc(a,EVT.playerJoin,{roomCode:roomAck.roomCode,displayName:'A'}),identityB=rpc(b,EVT.playerJoin,{roomCode:roomAck.roomCode,displayName:'B'});
a.emit(EVT.playerSelectCharacter,{characterId:'goblin'});b.emit(EVT.playerSelectCharacter,{characterId:'buttafuori'});a.emit(EVT.playerReady,{ready:true});b.emit(EVT.playerReady,{ready:true});host.emit(EVT.hostSelectMinigame,{minigameId:'trentuno'});host.emit(EVT.hostStart);host.emit(EVT.hostSkip);host.emit(EVT.hostSkip);
const roomState=()=>packets.filter(p=>p.to==='host'&&p.event===EVT.roomState).at(-1)!.data;
let checks=0;
try{
  assert.equal(roomState().phase,'MINIGAME_PLAYING');checks++;
  assert.ok(!rpc(outsider,EVT.trentunoReady,{roundId:roomState().roundId}).ok);checks++;
  assert.ok(rpc(host,EVT.trentunoReady,{roundId:roomState().roundId,}).ok);checks++;
  const own=(to:string)=>packets.filter(p=>p.to===to&&p.event===EVT.privateData&&p.data.type==='trentunoPrivate').at(-1)!.data as PrivateState;
  const pub=()=>packets.filter(p=>p.to==='host'&&p.event===EVT.trentunoPublic).at(-1)!.data as PublicState;
  assert.equal(own('phone-a').hand.length,3);assert.equal(own('phone-b').hand.length,3);checks+=2;
  assert.ok(!packets.some(p=>p.to==='host'&&p.event===EVT.privateData&&p.data.type==='trentunoPrivate'));checks++;
  assert.ok(!('hand' in pub().players[0]));checks++;
  const before=pub();const active=before.turn===identityA.playerId?a:b;const idle=active===a?b:a;const activeId=active===a?identityA:identityB;const activeSocket=active.id;const command:Command={roundId:before.roundId,matchId:before.matchId,version:before.version,requestId:'draw-1',op:'draw'};
  assert.ok(!rpc(idle,EVT.trentunoCommand,{...command,playerId:activeId.playerId}).ok);checks++;
  assert.ok(!rpc(outsider,EVT.trentunoCommand,command).ok);checks++;
  assert.ok(rpc(active,EVT.trentunoCommand,command).ok);const first=own(activeSocket);assert.equal(first.hand.length,4);checks++;
  const duplicate=rpc(active,EVT.trentunoCommand,command);assert.ok(duplicate.ok);assert.deepEqual(own(activeSocket).hand,first.hand);assert.equal(own(activeSocket).discardable.length,4);checks++;
  const forged:Command={...command,version:first.version,requestId:'forged',op:'discard',cardId:'NOT-A-CARD'};assert.ok(!rpc(active,EVT.trentunoCommand,forged).ok);checks++;
  host.emit(EVT.hostMinigameFinished,{roundId:before.roundId,results:[{playerId:identityA.playerId,placement:1,score:99999}]});assert.equal(roomState().phase,'MINIGAME_PLAYING');assert.equal(roomState().players[0].score,0);checks++;
  const len=packets.length;host.emit(EVT.hostPrivateData,{playerId:identityA.playerId,data:{type:'trentunoPrivate',hand:['FORGED']}});assert.equal(packets.length,len);checks++;
  const reconnect=new Fake('phone-a-new');manager.handleConnection(reconnect as unknown as Socket);const ack=rpc(reconnect,EVT.playerJoin,{reconnectToken:activeId.reconnectToken});assert.ok(ack.ok);assert.deepEqual(own('phone-a-new').hand,first.hand);assert.equal(own('phone-a-new').discardable.length,4);checks++;
  assert.ok(!rpc(active,EVT.trentunoCommand,{...command,requestId:'old-socket',version:pub().version}).ok);checks++;
  assert.ok(rpc(host,EVT.trentunoReady,{roundId:before.roundId,restart:true}).ok);assert.notEqual(pub().matchId,before.matchId);assert.ok(!rpc(reconnect,EVT.trentunoCommand,{...command,requestId:'old-match',version:pub().version}).ok);checks++;
  assert.ok(!rpc(host,EVT.trentunoCommand,{...command,version:pub().version,requestId:'host-pretends-phone'}).ok);checks++;
  const paused=pub();host.emit(EVT.hostPause,{paused:true});assert.equal(pub().paused,true);assert.ok(!rpc(reconnect,EVT.trentunoCommand,{...command,matchId:pub().matchId,version:pub().version,requestId:'paused'}).ok);checks++;
  host.emit(EVT.hostPause,{paused:false});assert.equal(pub().paused,false);checks++;
  const room=(manager as any).rooms.get(roomAck.roomCode);
  room.finishMinigame([{playerId:identityA.playerId,placement:1,score:5},{playerId:identityB.playerId,placement:1,score:5}],pub().roundId);
  assert.equal(roomState().lastResults.results[0].placement,1);assert.equal(roomState().lastResults.results[1].placement,1);assert.equal(roomState().players[0].score,roomState().players[1].score);checks++;
  writeFileSync('docs/agent-work/trentuno-2/network-checks.json',JSON.stringify({checks,privacy:true,authority:true,reconnection:true,oldSocketDenied:true,restartIdentity:true},null,2));console.log(`${checks} controlli del trasporto superati.`);
}finally{host.emit(EVT.hostRestartMatch);}
