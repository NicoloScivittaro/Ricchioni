import Phaser from 'phaser';
import type {MinigameContext} from '../types';
import type {OrdaInput,OrdaPacket,Survivor} from '../../../shared/orda/types';
import {OrdaMatch} from '../../../shared/orda/match';
import {game as gm} from '../../core/GameManager';
import {audio} from '../../core/AudioManager';
import {PauseMenu} from '../../core/PauseMenu';
import {showLoading} from '../../core/theme';
import {pads} from '../../input/GamepadManager';
import type {OrdaRenderer} from './OrdaRenderer';

export class OrdaScene extends Phaser.Scene{
 private ctx!:MinigameContext;private match!:OrdaMatch;private display:OrdaRenderer|null=null;private canvas:HTMLCanvasElement|null=null;
 private menu!:PauseMenu;private cancelled=false;private playing=false;private paused=false;private sent=0;private finishedAt=0;private resultSent=false;
 private hideLoading:(()=>void)|null=null;private eventBuffer:OrdaPacket['events']=[];private last=0;
 private cancellations=new Map<string,number>();
 private bootVersion=0;
 constructor(){super('orda');}
 create(data:{ctx:MinigameContext}):void{
  this.ctx=data.ctx;this.cancelled=false;this.playing=false;this.paused=false;this.sent=0;this.finishedAt=0;this.resultSent=false;this.eventBuffer=[];this.cancellations.clear();
  this.cameras.main.setBackgroundColor('#102022');audio.unlock();
  this.menu=new PauseMenu(this,'ORDA FINALE',this.ctx.input,()=>this.scene.restart({ctx:this.ctx}));
  this.hideLoading=showLoading(this,'☣','ORDA FINALE · IL DEPOSITO INFETTO');
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.cleanup());
  const version=++this.bootVersion;gm.minigameLoadStarted();void this.boot(version).catch(e=>{if(!this.cancelled&&version===this.bootVersion)gm.reportMinigameError(e);});
 }
 private async boot(version:number):Promise<void>{
  const {OrdaRenderer}=await import('./OrdaRenderer');if(this.cancelled||version!==this.bootVersion)return;
  const participants=this.ctx.players.map(p=>({id:p.id,name:p.displayName||p.name,color:p.color,bot:!!p.bot}));
  this.match=new OrdaMatch(participants,Math.floor(this.ctx.rng.next()*2147483647));
  const c=document.createElement('canvas');c.id='orda-canvas';c.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:10000;touch-action:none';document.body.appendChild(c);this.canvas=c;
  this.display=new OrdaRenderer(c,participants,participants.map(p=>p.id));await this.display.ready;if(this.cancelled||version!==this.bootVersion)return;
  this.display.update(this.match.state,0);this.display.render();
  this.hideLoading?.();this.hideLoading=null;gm.minigameLoadFinished();
  await this.ctx.showControls?.();if(this.cancelled||version!==this.bootVersion)return;
  // One packet after the controls gate initializes late-joining phone visualizers too.
  for(const p of this.match.state.players){const i=this.ctx.input.get(p.id);i.cancelAll();this.cancellations.set(p.id,i.cancellationVersion);p.lastFire=i.pressCount('fire');p.lastJump=i.pressCount('jump');p.lastReload=i.pressCount('reload');p.lastDash=i.pressCount('dash');p.lastInteract=i.pressCount('interact');}
  this.playing=true;this.last=performance.now();this.display.engine.runRenderLoop(()=>this.frame());
 }
 private read(p:Survivor):OrdaInput{
  const i=this.ctx.input.get(p.id),m=i.axis('move'),s=i.axis('lookStick'),look=i.axis('look'),pad=pads.handles(p.id);
  if(this.cancellations.get(p.id)!==i.cancellationVersion){this.cancellations.set(p.id,i.cancellationVersion);p.lastFire=i.pressCountAtCancellation('fire');p.lastJump=i.pressCountAtCancellation('jump');p.lastReload=i.pressCountAtCancellation('reload');p.lastDash=i.pressCountAtCancellation('dash');p.lastInteract=i.pressCountAtCancellation('interact');}
  return{mx:m.x,my:m.y,lx:s.x,ly:s.y,...(!pad&&i.hasAxis('look')?{look:{yaw:look.x,pitch:look.y}}:{}),fire:i.pressed('fire'),press:i.pressCount('fire'),aim:i.pressed('aim'),reload:i.pressCount('reload'),jump:i.pressCount('jump'),crouch:i.pressed('crouch'),dash:i.pressCount('dash'),interact:i.pressCount('interact'),sensitivity:pad?pads.settingsOf(p.id).sensitivity:1};
 }
 update():void{if(!this.menu)return;const pause=this.menu.update();if(this.paused!==pause){this.paused=pause;this.display?.setPaused(pause);if(this.canvas)this.canvas.style.visibility=pause?'hidden':'visible';this.display?.show(!pause);}}
 private frame():void{
  if(!this.display||!this.playing||this.cancelled)return;const now=performance.now(),dt=Math.min(.25,(now-this.last)/1000);this.last=now;
  if(this.paused||gm.state?.paused)return;
  this.match.advance(dt,p=>this.read(p));const events=this.match.drainEvents();this.eventBuffer.push(...events);
  for(const e of events)if(e.player&&(e.type==='hurt'||e.type==='death'||e.type==='hit'))this.ctx.vibrate(e.player,e.type==='death'?220:e.type==='hurt'?70:18);
  this.display.update(this.match.state,dt,events);this.display.render();
  this.sent+=dt;if(this.sent>=.1||events.some(e=>e.type==='death'||e.type==='win')){this.sent=0;this.ctx.signal(null,{type:'ordaState',roundId:this.ctx.roundId??0,state:this.match.packet(),events:this.eventBuffer.splice(0)} satisfies OrdaPacket);}
  if(this.match.state.phase==='finished'){
   if(!this.finishedAt)this.finishedAt=now;
   // Winner is fixed immediately; the short celebration doesn't keep combat running.
   if(!this.resultSent&&now-this.finishedAt>2300){this.resultSent=true;this.ctx.finish({results:this.match.ranking().map((p,i)=>({playerId:p.id,placement:i+1,score:p.kills,stats:[`${p.kills} mostri`,`${Math.round(p.damage)} danni`,`Ondata ${this.match.state.wave}`]}))});}
  }
 }
 private cleanup():void{this.bootVersion++;this.cancelled=true;this.playing=false;this.display?.dispose();this.display=null;this.canvas?.remove();this.canvas=null;this.hideLoading?.();this.hideLoading=null;}
}
