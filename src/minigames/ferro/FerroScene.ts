import Phaser from'phaser';
import type{MinigameContext}from'../types';
import{FerroMatch}from'../../../shared/ferro/match';
import{FerroBots}from'../../../shared/ferro/bots';
import type{Warrior,Command,FerroPacket,FerroEdges}from'../../../shared/ferro/types';
import type{FerroRenderer}from'./FerroRenderer';
import{game as gm}from'../../core/GameManager';
import{PauseMenu}from'../../core/PauseMenu';
import{audio}from'../../core/AudioManager';
import{showLoading}from'../../core/theme';
export class FerroScene extends Phaser.Scene{
 private ctx!:MinigameContext;private match!:FerroMatch;private display:FerroRenderer|null=null;private canvas:HTMLCanvasElement|null=null;private menu!:PauseMenu;private bots=new FerroBots();
 private cancelled=false;private playing=false;private paused=false;private last=0;private sent=0;private end=0;private finished=false;private version=0;private hide:(()=>void)|null=null;
 private cancellations=new Map<string,{version:number;serial:number}>();
 constructor(){super('ferro');}
 create(data:{ctx:MinigameContext}):void{
  this.ctx=data.ctx;this.cancelled=false;this.playing=false;this.paused=false;this.sent=0;this.end=0;this.finished=false;this.cancellations.clear();this.bots=new FerroBots();
  audio.unlock();this.cameras.main.setBackgroundColor('#151b24');this.menu=new PauseMenu(this,'FERRO E FURIA',this.ctx.input,()=>this.scene.restart({ctx:this.ctx}));
  this.hide=showLoading(this,'⚔️','FERRO E FURIA · HONOR & STEEL');this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.cleanup());gm.minigameLoadStarted();const version=++this.version;
  void this.boot(version).catch(e=>{if(!this.cancelled&&version===this.version)gm.reportMinigameError(e);});
 }
 private async boot(version:number):Promise<void>{
  const{FerroRenderer}=await import('./FerroRenderer');if(this.cancelled||version!==this.version)return;
  this.match=new FerroMatch(this.ctx.players.map(p=>({id:p.id,name:p.displayName||p.name,color:p.color,characterId:p.characterId,bot:p.bot})),{roundSeconds:this.ctx.durationSec||90,mapId:this.ctx.mapId});
  const c=document.createElement('canvas');c.id='ferro-canvas';c.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:10000;touch-action:none';document.body.appendChild(c);this.canvas=c;
  this.display=new FerroRenderer(c,this.ctx.players,(id,index)=>{const i=this.ctx.input.get(id);i.tap('ferroChoose'+index);},id=>this.ctx.input.get(id).tap('dodge'),this.match.state.mapId,id=>this.ctx.input.get(id).tap('cosmetic'));
  await this.display.ready;if(this.cancelled||version!==this.version)return;await this.display.warm(this.match.state);if(this.cancelled||version!==this.version)return;this.hide?.();this.hide=null;gm.minigameLoadFinished();
  await this.ctx.showControls?.();if(this.cancelled||version!==this.version)return;this.ctx.input.reset();this.playing=true;this.last=performance.now();this.display.engine.runRenderLoop(()=>this.frame());
 }
 private read(p:Warrior):Command{
  const i=this.ctx.input.get(p.id),m=i.axis('move'),look=i.axis('lookStick'),old=this.cancellations.get(p.id),serial=i.pressCount('ferroCancel'),cancel=!!old&&(old.version!==i.cancellationVersion||old.serial!==serial);this.cancellations.set(p.id,{version:i.cancellationVersion,serial});
  const edges:FerroEdges={light:i.pressCount('light'),heavy:i.pressCount('heavy'),dodge:i.pressCount('dodge'),special:i.pressCount('special'),jump:i.pressCount('jump'),feint:i.pressCount('feint'),guardBreak:i.pressCount('guardBreak'),target:i.pressCount('target'),cosmetic:i.pressCount('cosmetic'),prev:i.pressCount('selectPrev'),next:i.pressCount('selectNext'),choices:Array.from({length:7},(_,n)=>i.pressCount('ferroChoose'+n))};
  if(p.weapon==='bow')edges.heavy=i.pressCount('light');const explicit=i.axis('ferroGuard');const direction=i.hasAxis('ferroGuard')?(explicit.y<-.5?'top':explicit.x<0?'left':'right'):undefined;
  const absolute=i.axis('look');return{mx:m.x,my:m.y,lx:look.x,ly:look.y,...(i.hasAxis('look')?{look:{yaw:absolute.x*Math.PI,pitch:absolute.y*.65}}:{}),guardDirection:direction,light:p.weapon==='bow'?(i.pressed('heavy')||i.pressed('bowDraw')):i.pressed('light'),guard:i.pressed('guard'),sprint:i.pressed('sprint'),edges,cancel};
 }
 update():void{if(!this.menu)return;const pause=this.menu.update()||!!gm.state?.paused;if(pause===this.paused)return;this.paused=pause;this.display?.setPaused(pause);this.display?.show(!pause);if(this.canvas)this.canvas.style.visibility=pause?'hidden':'visible';for(const p of this.ctx.players)this.ctx.input.cancelPlayer(p.id);if(this.match)for(const p of this.match.state.warriors)this.match.cancel(p.id,this.read(p).edges);}
 private frame():void{
  if(!this.playing||this.cancelled||!this.display)return;const now=performance.now(),dt=Math.min(.25,(now-this.last)/1000);this.last=now;if(this.paused)return;
  this.match.advance(dt,p=>p.bot?this.bots.read(p,this.match.state,1/120):this.read(p));const events=this.match.drainEvents();this.display.update(this.match.state,dt,events);this.display.render();
  for(const e of events)if(e.kind==='hit'&&e.target)this.ctx.vibrate(e.target,35);else if(e.kind==='parry'&&e.player)this.ctx.vibrate(e.player,55);else if(e.kind==='elimination'&&e.target)this.ctx.vibrate(e.target,150);
  this.sent+=dt;if(this.sent>=.1||events.some(e=>e.kind==='win'||e.kind==='elimination')){this.sent=0;this.ctx.signal(null,{type:'ferroState',roundId:this.ctx.roundId??0,state:this.match.packet()}satisfies FerroPacket);}
  this.ctx.input.update();if(this.match.state.phase==='finished'){this.end+=dt;if(this.end>4&&!this.finished){this.finished=true;this.ctx.finish({results:this.match.ranking()});}}
 }
 private cleanup():void{this.version++;this.cancelled=true;this.playing=false;this.display?.dispose();this.display=null;this.canvas?.remove();this.canvas=null;this.hide?.();this.hide=null;}
}
