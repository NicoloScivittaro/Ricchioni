import{io}from'socket.io-client';import assert from'node:assert/strict';import{readFileSync,readdirSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';import{EVT}from'../shared/protocol';import{DECK}from'../shared/trentuno/deck';
const out='docs/agent-work/trentuno-2',report:any={},socket=io('http://localhost:3012',{transports:['websocket'],reconnection:false});
try{
 await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);setTimeout(()=>reject(Error('connection timeout')),4000).unref();});
 const ack:any=await new Promise(resolve=>socket.emit(EVT.hostCreate,{playerCount:2,targetScore:60},resolve));assert.ok(ack.ok);
 const select=(id:string)=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('state timeout')),4000);const changed=(s:any)=>{if(s.selectedMinigameId!=='trentuno')return;socket.off(EVT.roomState,changed);clearTimeout(timer);resolve(s);};socket.on(EVT.roomState,changed);socket.emit(EVT.hostSelectMinigame,{minigameId:id});});
 assert.equal((await select('trentuno')).selectedMinigameId,'trentuno');assert.equal((await select('casacarbo')).selectedMinigameId,'trentuno');report.removedSelectionRejected=true;
 for(const card of [...DECK.map(c=>c.id),'back']){const a=readFileSync('public/trentuno/'+card+'.svg'),b=readFileSync('dist/trentuno/'+card+'.svg');assert.equal(createHash('sha256').update(a).digest('hex'),createHash('sha256').update(b).digest('hex'));}
 report.builtCardsMatch=true;assert.ok(!readdirSync('dist/assets').some(n=>/^CasaCarbo/.test(n)));report.retiredChunksAbsent=true;
 for(const path of ['/','/trentuno-2/','/trentuno-2/table.png','/trentuno-2/phone.png','/trentuno-2/cards.png'])assert.equal((await fetch('http://localhost:3012'+path,{method:'HEAD'})).status,200);report.localPreview=true;
 console.log(JSON.stringify(report));
}finally{socket.disconnect();writeFileSync(out+'/production-checks.json',JSON.stringify(report,null,2));}
