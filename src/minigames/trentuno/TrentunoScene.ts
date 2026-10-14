import Phaser from 'phaser';
import type { MinigameContext } from '../types';
import type { PublicState } from '../../../shared/trentuno/types';
import { BACK_ASSET,CARDS,DECK,cardAsset } from '../../../shared/trentuno/deck';
import { game as gm } from '../../core/GameManager';
import { PauseMenu } from '../../core/PauseMenu';
import { abilityHub } from '../../core/abilityHub';
import { addPortrait } from '../../core/portraits';
import { FONT_BODY,FONT_DISPLAY } from '../../core/uiTokens';
import { audio } from '../../core/AudioManager';
import { presentationOf } from '../../../shared/characterPresentation';
export class TrentunoScene extends Phaser.Scene {
  private ctx!:MinigameContext;private menu!:PauseMenu;private state:PublicState|null=null;private view:Phaser.GameObjects.GameObject[]=[];
  private stop:(()=>void)|null=null;private seen=new Set<number>();private positions=new Map<string,{x:number;y:number}>();private received=0;private generation=0;
  constructor(){super('trentuno');}
  preload():void {for(const c of DECK)this.load.svg(`t31-${c.id}`,cardAsset(c.id),{width:220,height:340});this.load.svg('t31-back',BACK_ASSET,{width:220,height:340});}
  create(data:{ctx:MinigameContext}):void{
    this.ctx=data.ctx;this.state=null;this.view=[];this.seen=new Set();this.generation++;const stamp=this.generation;
    this.menu=new PauseMenu(this,'31 DEGLI INFAMI',this.ctx.input,()=>{gm.startTrentuno(true);this.scene.restart({ctx:this.ctx});});abilityHub.begin('trentuno',this.ctx);
    this.stop=gm.events.on('trentuno',s=>this.render(s as PublicState));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.generation++;this.stop?.();this.stop=null;this.clear();abilityHub.end();this.tweens.killAll();for(const c of DECK)this.textures.remove(`t31-${c.id}`);this.textures.remove('t31-back');});
    if(gm.trentunoState&&gm.trentunoState.roundId===this.ctx.roundId){this.render(gm.trentunoState);gm.startTrentuno();return;}
    this.keep(this.add.rectangle(640,360,1280,720,0x092c25));this.text(640,300,'31 DEGLI INFAMI',50,'#e7c577');this.text(640,372,'Preparate i telefoni · tre mani, nessuna pietà',22);
    (this.ctx.showControls?.()??Promise.resolve()).then(()=>{if(stamp===this.generation&&this.scene.isActive())gm.startTrentuno();});
  }
  private keep<T extends Phaser.GameObjects.GameObject>(o:T):T{this.view.push(o);return o;}
  private text(x:number,y:number,label:string,size=20,color='#f4ead0',width=1100):Phaser.GameObjects.Text{return this.keep(this.add.text(x,y,label,{fontFamily:FONT_BODY,fontSize:`${size}px`,color,align:'center',wordWrap:{width}}).setOrigin(.5));}
  private card(id:string,x:number,y:number,height=160):Phaser.GameObjects.Image{return this.keep(this.add.image(x,y,`t31-${id||'back'}`).setDisplaySize(height*220/340,height));}
  private clear():void{for(const o of this.view)o.destroy();this.view=[];}
  private render(s:PublicState):void{
    if(s.roundId!==this.ctx.roundId)return;this.received=performance.now();const previous=this.state;this.state=s;
    if(previous?.matchId===s.matchId&&previous.version===s.version&&previous.paused===s.paused)return;
    if(previous?.matchId!==s.matchId)this.seen.clear();this.clear();this.keep(this.add.rectangle(640,360,1280,720,0x092a23));
    const g=this.keep(this.add.graphics());g.fillStyle(0x493324);g.fillEllipse(640,359,1170,522,128);g.lineStyle(4,0xcfa653);g.strokeEllipse(640,359,1150,507,128);g.fillStyle(0x0e4435);g.fillEllipse(640,359,1128,480,128);g.lineStyle(1,0x77934e,.4);g.strokeEllipse(640,359,1095,450,128);
    g.lineStyle(1,0xb19a62,.22);for(let i=0;i<4;i++)g.strokeEllipse(640,359,1140+i*6,488+i*6,128);
    // Trama statica, nessuno shader/texture ad alta risoluzione o motore 3D aggiuntivo.
    g.lineStyle(1,0xb0b376,.025);for(let y=151;y<570;y+=10){const w=Math.sqrt(Math.max(0,1-((y-359)/227)**2))*546;g.lineBetween(640-w,y,640+w,y);}
    this.text(640,37,'31 DEGLI INFAMI',34,'#edcf8c').setFontFamily(FONT_DISPLAY);this.text(640,74,`MANO ${s.handNumber}/3 · ${s.phase==='finished'?'TORNEO CONCLUSO':s.phase==='handResult'?'CARTE SUL TAVOLO':s.paused?'PAUSA':s.phase==='knockWindow'?'FINESTRA: NO, ASPETTA!':`TURNO DI ${s.players.find(p=>p.id===s.turn)!.name}`}`,16,'#aebfa5');
    this.text(1150,40,`${Math.ceil(s.remaining)}s`,28,'#f2cc6c').setName('t31-timer');this.text(1160,73,`Mano ${Math.ceil(s.handRemaining)}s`,13,'#bfc4a4');
    this.positions.clear();s.players.forEach((p,i)=>{
      const angle=s.players.length===2?Math.PI+i*Math.PI:-Math.PI/2+i*2*Math.PI/s.players.length;
      const x=640+Math.cos(angle)*442,y=350+Math.sin(angle)*191;this.positions.set(p.id,{x,y});
      this.keep(this.add.rectangle(x,y,202,129,0x092d27,.97).setStrokeStyle(p.id===s.turn?3:1,p.id===s.turn?0xe4c16a:0x517b60));
      this.keep(addPortrait(this,x-60,y-19,p.characterId,51));this.text(x+25,y-34,p.name,17,'#f3e5c1',119);this.text(x+25,y-8,presentationOf(p.characterId)?.shortName??p.characterId,12,'#b8caa9',117);
      this.text(x+25,y+16,`${p.points} PT · ${p.count} CARTE`,14,'#e5c46c');for(let k=0;k<p.count;k++)this.card('',x-79+k*14,y+36,23);
      this.text(x+28,y+45,p.abilityUsed?'ABILITÀ ESAURITA':'ABILITÀ PRONTA',10,p.abilityUsed?'#96a493':'#d9cfa8');
      abilityHub.setStatus(p.id,{state:p.abilityUsed?'SPENT':'READY'});if(p.abilityUsed&&!previous?.players.find(q=>q.id===p.id)?.abilityUsed)abilityHub.activated(p.id);
    });
    this.card('',544,352,165).setAngle(-5);this.text(544,461,`MAZZO · ${s.deckCount}`,14,'#d9c08c');this.card(s.discardTop,736,352,165).setAngle(5);this.text(736,461,'SCARTI',14,'#d9c08c');
    if(s.blockedFor)this.text(640,502,`SCARTI BLOCCATI PER ${s.players.find(p=>p.id===s.blockedFor)!.name}`,13,'#f19d84');
    if(s.knocker)this.text(640,238,`HA BUSSATO ${s.players.find(p=>p.id===s.knocker)!.name} · ${s.finalTurns} TURNI FINALI`,15,'#eed7a3',750);
    this.text(640,641,s.log.at(-1)?.text??'',22,'#f4d486',1170);this.text(640,677,'Asso 11 · figure 10 · conta un solo seme · abilità una volta nelle tre mani',14,'#adbca1');
    if(s.phase==='handResult'||s.phase==='finished')this.reveal(s);
    for(const e of s.log)if(!this.seen.has(e.id)){this.seen.add(e.id);if(previous)this.animate(e,s);}if(this.seen.size>400)this.seen=new Set(s.log.map(e=>e.id));
  }
  private reveal(s:PublicState):void{
    const h=s.history.at(-1)!;this.keep(this.add.rectangle(640,355,940,508,0x08271f,.98).setStrokeStyle(3,0xcfa653));
    this.text(640,126,s.phase==='finished'?'TRE MANI · ECCO GLI INFAMI':h.reason==='31'?'TRENTUNO!':'MANO '+h.number+' · '+h.reason.toUpperCase(),27,'#efd188');
    const rows=s.phase==='finished'?s.results!.map(result=>h.rows.find(r=>r.playerId===result.playerId)!):h.rows;
    rows.forEach((r,i)=>{const y=196+i*77;this.text(332,y,s.players.find(p=>p.id===r.playerId)!.name,18,'#f2e5be',205);r.cards.forEach((c,k)=>this.card(c,538+k*56,y,70));this.text(811,y,`${r.score} PUNTI`,21,'#e7c264');this.text(972,y,s.phase==='finished'?`${s.results!.find(q=>q.playerId===r.playerId)!.placement}° · ${s.players.find(p=>p.id===r.playerId)!.points} PT`:`${r.placement}° · +${r.points}`,16);});
    this.text(640,588,s.phase==='finished'?'Pari risolti per somma carte; parità effettive condivise.':'Nuova distribuzione tra pochi secondi…',14,'#b8c8a6');
  }
  private animate(e:PublicState['log'][number],s:PublicState):void{
    const p=e.playerId?this.positions.get(e.playerId):null;
    if((e.kind==='draw'||e.kind==='take'||e.kind==='discard')&&p){const from=e.kind==='discard'?p:{x:e.kind==='draw'?544:736,y:352},to=e.kind==='discard'?{x:736,y:352}:p;const image=this.add.image(from.x,from.y,`t31-${e.cardId??'back'}`).setDisplaySize(43,66).setDepth(40);this.tweens.add({targets:image,x:to.x,y:to.y,angle:e.kind==='discard'?185:15,duration:350,onComplete:()=>image.destroy()});}
    if(e.kind==='knock'){for(let i=0;i<3;i++)this.time.delayedCall(i*170,()=>{this.cameras.main.shake(90,.002);audio.ui('confirm');});}
    if(e.kind==='ability'){const label=this.add.text(640,210,e.text,{fontFamily:FONT_BODY,fontSize:'25px',color:'#f7d985',backgroundColor:'#133e2d'}).setOrigin(.5).setPadding(14).setDepth(44);this.tweens.add({targets:label,y:180,alpha:0,delay:700,duration:600,onComplete:()=>label.destroy()});}
    if(e.kind==='31'){this.cameras.main.flash(250,139,117,28);this.cameras.main.zoomTo(1.035,180);this.time.delayedCall(800,()=>this.cameras.main.zoomTo(1,180));const winner=s.history.at(-1)!.rows.find(r=>r.score===31)!;const portrait=addPortrait(this,1040,172,s.players.find(p=>p.id===winner.playerId)!.characterId,70).setDepth(48);this.tweens.add({targets:portrait,scaleX:'+=0.05',scaleY:'+=0.05',duration:180,yoyo:true,repeat:4,onComplete:()=>portrait.destroy()});audio.ui('confirm');}
  }
  update():void{if(this.menu.update())return;if(this.state){const clock=this.children.getByName('t31-timer') as Phaser.GameObjects.Text|null;clock?.setText(`${Math.max(0,Math.ceil(this.state.remaining-(this.state.paused?0:(performance.now()-this.received)/1000)))}s`);}}
}
