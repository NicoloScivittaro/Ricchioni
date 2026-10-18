import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { RoomManager } from '../server/RoomManager';
import { EVT } from '../shared/protocol';
import type { Server, Socket } from 'socket.io';
import type { Command, PrivateState, PublicState } from '../shared/goblinTime/types';
import { writeFileSync } from 'node:fs';
import { getMinigame } from '../shared/minigames';
// Il gioco è disattivato nel rullo, ma il motore resta verificato: lo riattiviamo solo in questo processo.
getMinigame('goblinTime')!.enabled = true;
const packets:{to:string;event:string;data:any}[]=[];
const io={to:(to:string)=>({emit:(event:string,data:any)=>packets.push({to,event,data})})} as unknown as Server;
const manager=new RoomManager(io);
class Fake extends EventEmitter {constructor(readonly id:string){super();} }
const host=new Fake('host'),a=new Fake('phone-a'),b=new Fake('phone-b'),outsider=new Fake('outside');
for(const socket of [host,a,b,outsider])manager.handleConnection(socket as unknown as Socket);
function rpc(socket:Fake,event:string,data?:unknown):any{let ack:any;socket.emit(event,data,(value:any)=>{ack=value;});return ack;}
const roomAck=rpc(host,EVT.hostCreate,{playerCount:2,targetScore:60});assert.ok(roomAck.ok);
const identityA=rpc(a,EVT.playerJoin,{roomCode:roomAck.roomCode,displayName:'A'}),identityB=rpc(b,EVT.playerJoin,{roomCode:roomAck.roomCode,displayName:'B'});
a.emit(EVT.playerSelectCharacter,{characterId:'goblin'});b.emit(EVT.playerSelectCharacter,{characterId:'buttafuori'});a.emit(EVT.playerReady,{ready:true});b.emit(EVT.playerReady,{ready:true});host.emit(EVT.hostSelectMinigame,{minigameId:'goblinTime'});host.emit(EVT.hostStart);host.emit(EVT.hostSkip);host.emit(EVT.hostSkip);
const roomState=()=>packets.filter(p=>p.to==='host'&&p.event===EVT.roomState).at(-1)!.data;
let checks=0;
try{
  assert.equal(roomState().phase,'MINIGAME_PLAYING');checks++;
  assert.ok(!rpc(outsider,EVT.goblinReady,{roundId:roomState().roundId}).ok);checks++;
  assert.ok(rpc(host,EVT.goblinReady,{roundId:roomState().roundId,mode:'personal'}).ok);checks++;
  const own=(to:string)=>packets.filter(p=>p.to===to&&p.event===EVT.privateData&&p.data.type==='goblinPrivate').at(-1)!.data as PrivateState;
  const pub=()=>packets.filter(p=>p.to==='host'&&p.event===EVT.goblinPublic).at(-1)!.data as PublicState;
  assert.equal(own('phone-a').hand.length,2);assert.equal(own('phone-b').hand.length,2);checks+=2;
  assert.ok(!packets.some(p=>p.to==='host'&&p.event===EVT.privateData&&p.data.type==='goblinPrivate'));checks++;
  assert.ok(!('hand' in pub().players[0]));checks++;
  const before=pub();const command:Command={roundId:before.roundId,matchId:before.matchId,version:before.version,requestId:'draw-1',op:'draw'};
  assert.ok(!rpc(b,EVT.goblinCommand,{...command,playerId:identityA.playerId}).ok);checks++;
  assert.ok(!rpc(outsider,EVT.goblinCommand,command).ok);checks++;
  assert.ok(rpc(a,EVT.goblinCommand,command).ok);const first=own('phone-a');assert.ok(first.choice);checks++;
  const duplicate=rpc(a,EVT.goblinCommand,command);assert.ok(duplicate.ok);assert.deepEqual(own('phone-a').hand,first.hand);assert.equal(own('phone-a').choice?.id,first.choice?.id);checks++;
  const forged:Command={...command,version:first.version,requestId:'forged',op:'choose',choiceId:first.choice!.id,values:['NOT-A-CARD']};assert.ok(!rpc(a,EVT.goblinCommand,forged).ok);checks++;
  host.emit(EVT.hostMinigameFinished,{roundId:before.roundId,results:[{playerId:identityA.playerId,placement:1,score:99999}]});assert.equal(roomState().phase,'MINIGAME_PLAYING');assert.equal(roomState().players[0].score,0);checks++;
  const len=packets.length;host.emit(EVT.hostPrivateData,{playerId:identityA.playerId,data:{type:'goblinPrivate',hand:['FORGED']}});assert.equal(packets.length,len);checks++;
  const reconnect=new Fake('phone-a-new');manager.handleConnection(reconnect as unknown as Socket);const ack=rpc(reconnect,EVT.playerJoin,{reconnectToken:identityA.reconnectToken});assert.ok(ack.ok);assert.deepEqual(own('phone-a-new').hand,first.hand);assert.equal(own('phone-a-new').choice?.id,first.choice?.id);checks++;
  assert.ok(!rpc(a,EVT.goblinCommand,{...command,requestId:'old-socket',version:pub().version}).ok);checks++;
  assert.ok(rpc(host,EVT.goblinReady,{roundId:before.roundId,mode:'personal',restart:true}).ok);assert.notEqual(pub().matchId,before.matchId);assert.ok(!rpc(reconnect,EVT.goblinCommand,{...command,requestId:'old-match',version:pub().version}).ok);checks++;
  writeFileSync('docs/agent-work/goblin-time/network-tests.json',JSON.stringify({checks,privacy:true,authority:true,reconnection:true,oldSocketDenied:true,restartIdentity:true},null,2));console.log(`${checks} controlli del trasporto superati.`);
}finally{host.emit(EVT.hostRestartMatch);}
