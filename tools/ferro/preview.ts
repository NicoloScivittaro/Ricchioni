import{FerroMatch}from'../../shared/ferro/match';
import{FerroBots}from'../../shared/ferro/bots';
import{emptyCommand}from'../../shared/ferro/types';
import{FerroRenderer}from'../../src/minigames/ferro/FerroRenderer';
import{CHARACTERS,CHARACTER_ORDER}from'../../shared/characters';
const query=new URLSearchParams(location.search),humanCount=Number(query.get('humans')??5),mode=query.get('mode')??'selection',ids=CHARACTER_ORDER.slice(0,5),names=ids.map(id=>id==='goblin'?'Goblin':CHARACTERS[id].name);
const participants=ids.map((id,i)=>{const c=CHARACTERS[id];return{id:'ferro-preview'+i,name:c.name,displayName:names[i],bot:i>=humanCount,characterId:id,color:c.color,roleTitle:c.roleTitle,quote:c.quote,avatar:c.avatar,score:0};});
const mapId=query.get('map')??'colosseum';const match=new FerroMatch(participants.map(p=>({...p,name:p.displayName})),{mapId}),bots=new FerroBots(),commands=participants.map(emptyCommand);
const display=new FerroRenderer(document.querySelector('canvas')!,participants,(id,i)=>{commands[participants.findIndex(p=>p.id===id)].edges.choices[i]++;},id=>{commands[participants.findIndex(p=>p.id===id)].edges.dodge++;},match.state.mapId,id=>{commands[participants.findIndex(p=>p.id===id)].edges.cosmetic++;});
await display.ready;display.update(match.state,0);await display.scene.whenReadyAsync();
if(mode==='combat'){match.state.phase='fight';const positions=[[-2,-2],[0,1],[3,-1],[2,4],[-4,3]],weapons=['sword','spear','bow','hammer','blades']as const;match.state.warriors.forEach((p,i)=>Object.assign(p,{weapon:weapons[i],...(mapId==='colosseum'?{x:positions[i][0],z:positions[i][1]}:{}),yaw:i===0?.35:Math.PI,hp:1000}));}
await display.warm(match.state);
let last=performance.now(),frames=0,stopped=false;const costs:{simulation:number;presentation:number;render:number;draws:number}[]=[];
display.engine.runRenderLoop(()=>{if(stopped)return;const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;const t=performance.now();match.advance(dt,p=>mode==='combat'?bots.read(p,match.state,1/120):commands[participants.findIndex(s=>s.id===p.id)]);const sim=performance.now()-t,events=match.drainEvents();display.update(match.state,dt,events);const update=performance.now()-t-sim;display.render();costs.push({simulation:sim,presentation:update,render:performance.now()-t-sim-update,draws:(display.engine as any)._drawCalls.current});if(costs.length>800)costs.shift();frames++;});
(window as any).fixture={display,match,bots,commands,costs,get frames(){return frames;},reset(){costs.length=0;last=performance.now();},stop(){stopped=true;},dispose(){stopped=true;display.dispose();}};(window as any).ready=true;
