import Phaser from 'phaser';
import type { MinigameContext } from '../types';
import type { PublicState } from '../../../shared/goblinTime/types';
import { CARD_BY_ID } from '../../../shared/goblinTime/catalog';
import { TYPE_COLOR,cardArt } from '../../../shared/goblinTime/art';
import { addPortrait } from '../../core/portraits';
import { FONT_BODY, FONT_DISPLAY } from '../../core/uiTokens';
import { game as gm } from '../../core/GameManager';
import { PauseMenu } from '../../core/PauseMenu';
import { abilityHub } from '../../core/abilityHub';
import { audio } from '../../core/AudioManager';
import { presentationOf } from '../../../shared/characterPresentation';
import type { GoblinAvatars } from './avatars';
export class GoblinTimeScene extends Phaser.Scene {
  private ctx!:MinigameContext;private menu!:PauseMenu;private view:Phaser.GameObjects.GameObject[]=[];private state:PublicState|null=null;
  private mode:'base'|'personal'='base';private seen=new Set<string>();private positions=new Map<string,{x:number;y:number}>();private stop:(()=>void)|null=null;
  private avatars:GoblinAvatars|null=null;private avatarsStarted=false;
  private generation=0;
  private artKeys=new Set<string>();private artPending=new Set<string>();
  constructor(){super('goblinTime');}
  create(data:{ctx:MinigameContext}):void {
    this.ctx=data.ctx;this.view=[];this.seen=new Set();this.state=null;this.positions=new Map();this.avatars=null;this.avatarsStarted=false;this.generation++;
    this.menu=new PauseMenu(this,'GOBLIN TIME',this.ctx.input,()=>{gm.startGoblin(this.mode,true);this.scene.restart({ctx:this.ctx});});
    abilityHub.begin('goblinTime',this.ctx);
    this.stop=gm.events.on('goblin',payload=>this.renderState(payload as PublicState));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.generation++;this.stop?.();this.stop=null;this.avatars?.dispose();this.avatars=null;this.clear();for(const key of this.artKeys)this.textures.remove(key);this.artKeys.clear();this.artPending.clear();abilityHub.end();});
    const saved=gm.goblinState;
    if(saved && saved.roundId===this.ctx.roundId) {this.mode=saved.mode;this.renderState(saved);gm.startGoblin(this.mode);return;}
    this.chooseDeck();
  }
  private keep<T extends Phaser.GameObjects.GameObject>(o:T):T {this.view.push(o);return o;}
  private text(x:number,y:number,text:string,size=22,color='#eaf2ff'):Phaser.GameObjects.Text {return this.keep(this.add.text(x,y,text,{fontFamily:FONT_BODY,fontSize:`${size}px`,color,align:'center',wordWrap:{width:1080}}).setOrigin(.5));}
  private clear():void {for(const o of this.view)o.destroy();this.view=[];}
  private chooseDeck():void {
    this.clear();this.keep(this.add.rectangle(640,360,1280,720,0x0b1424));
    this.text(640,135,'GOBLIN TIME',60,'#c4ec85').setFontFamily(FONT_DISPLAY);
    this.text(640,212,'L’amicizia finisce quando qualcuno sta per vincere.',24,'#b4c7dd');
    this.text(640,290,'5 carte esatte → DICHIARA → resisti fino al tuo prossimo turno',27);
    const button=(x:number,label:string,mode:'base'|'personal')=>{
      const rect=this.keep(this.add.rectangle(x,420,440,145,0x24384f).setStrokeStyle(2,mode==='base'?0x71b8ff:0xcaa0ff).setInteractive({useHandCursor:true}));
      this.text(x,400,label,28);this.text(x,444,mode==='base'?'100 carte originali':'125 carte · incluse le nostre 25',18,'#c2cee0');
      rect.once('pointerdown',()=>{this.mode=mode;this.clear();this.text(640,340,'PRENDETE I TELEFONI',42);(this.ctx.showControls?.()??Promise.resolve()).then(()=>{if(this.scene.isActive())gm.startGoblin(mode);});});
    };button(390,'MAZZO ORIGINALE','base');button(890,'NOI CINQUE','personal');
    this.text(640,580,'Il telefono custodisce la tua mano. La TV mostra solo il tavolo.',20,'#8ea7c6');
  }
  private renderState(s:PublicState):void {
    if(s.roundId!==this.ctx.roundId)return;
    const previous=this.state;this.state=s;
    if(!this.avatarsStarted){this.avatarsStarted=true;const stamp=this.generation;import('./avatars').then(({GoblinAvatars})=>{if(!this.scene.isActive()||stamp!==this.generation)return;this.avatars=new GoblinAvatars(this.game.canvas,s.players);this.avatars.update(this.state!,this.positions);for(const o of this.view)if(o.name.startsWith('gt-portrait'))(o as Phaser.GameObjects.Image).setVisible(false);}).catch(error=>{document.getElementById('goblin-avatars')?.remove();console.warn('GOBLIN TIME: uso i ritratti esistenti, render 3D non disponibile',error);});}
    if(previous?.version===s.version&&previous.paused===s.paused)return;
    this.clear();this.keep(this.add.rectangle(640,360,1280,720,0x0a1220));
    const table=this.keep(this.add.graphics());table.fillStyle(0x243c45,.9);table.fillEllipse(640,385,1070,460);table.lineStyle(9,0x735232);table.strokeEllipse(640,385,1070,460);table.lineStyle(2,0xa58355,.5);table.strokeEllipse(640,385,1045,435);
    this.text(640,48,'GOBLIN TIME',38,'#c4ec85').setFontFamily(FONT_DISPLAY);
    this.text(640,88,`${s.mode==='base'?'MAZZO 100':'NOI CINQUE · 125'} · TURNO ${s.turnNumber} · ${s.paused?'PAUSA':s.phase==='reaction'?'FINESTRA RISPOSTE':s.phase==='choice'?'SCELTA PRIVATA':s.phase==='finished'?'PARTITA CONCLUSA':'TOCCA A '+s.players.find(p=>p.id===s.turn)?.name}`,18,'#9eb5cd');
    this.text(1160,48,`${Math.ceil(s.remaining)} s`,26,'#ffda78').setName('gt-timer');
    this.text(1120,88,`Limite ${Math.ceil(s.matchRemaining/60)} min`,14,'#9eb5cd');
    const n=s.players.length;this.positions.clear();
    s.players.forEach((p,i)=>{
      const angle=n===2?Math.PI+(i*Math.PI):-Math.PI/2+i*2*Math.PI/n;
      const x=640+Math.cos(angle)*430,y=375+Math.sin(angle)*190;this.positions.set(p.id,{x,y});
      const accent=Phaser.Display.Color.HexStringToColor(presentationOf(p.characterId)?.accent??'#69c49b').color;
      this.keep(this.add.rectangle(x,y,200,145,0x142136,.97).setStrokeStyle(p.declared?4:2,p.declared?0xff4c76:p.id===s.turn?0xffda78:accent));
      if(!this.avatars)this.keep(addPortrait(this,x-65,y-25,p.characterId,58)).setName(`gt-portrait-${p.id}`);
      this.text(x+20,y-45,p.name,20).setWordWrapWidth(120);this.text(x+20,y-10,`${p.count??'?'} CARTE`,24,p.declared?'#ff97b3':'#fff');
      this.text(x,y+38,`${p.traps} TRAPPOLE · ${p.abilityUsed?'⭐ USATA':'⭐ PRONTA'}`,13,'#a9bed4');
      if(p.declared)this.text(x,y+60,'GOBLIN TIME!',15,'#ff92a8');
      abilityHub.setStatus(p.id,{state:p.abilityUsed?'SPENT':'READY'});
      if(p.abilityUsed&&!previous?.players.find(old=>old.id===p.id)?.abilityUsed)abilityHub.activated(p.id);
    });
    this.avatars?.update(s,this.positions);
    this.keep(this.add.rectangle(430,350,86,120,0x273954).setStrokeStyle(2,0x9abddd));this.text(430,339,'GT',32,'#c4ec85');this.text(430,377,`${s.deckCount}`,18);
    this.text(430,426,'MAZZO',13,'#9bb2ca');
    this.keep(this.add.rectangle(850,350,105,120,0x3f344c).setStrokeStyle(2,0xb495c9));this.text(850,339,`${s.discardCount}`,24);this.text(850,426,'SCARTI',13,'#b2a0c5');
    const played=s.resolving??s.discardTop.at(-1);if(played) {const c=CARD_BY_ID[played];const color=Phaser.Display.Color.HexStringToColor(TYPE_COLOR[c.type]).color;this.keep(this.add.rectangle(640,381,250,244,0x142035).setStrokeStyle(2,color));this.text(640,281,c.type,10,TYPE_COLOR[c.type]);this.text(640,304,c.name,17).setWordWrapWidth(225);this.paintArt(played);this.text(640,451,brief(c.shortEffect??c.effect),13,'#c8d7e9').setWordWrapWidth(226).setLineSpacing(3);}
    const latest=s.log.at(-1);if(latest)this.text(640,620,latest.text,24,latest.kind==='declare'?'#ff9eba':'#e3edf9').setWordWrapWidth(1150);
    this.text(640,659,s.log.slice(-3,-1).map(e=>e.text).join('  ·  '),14,'#89a1bd').setWordWrapWidth(1150);
    if(s.phase==='finished') {this.keep(this.add.rectangle(640,360,920,180,0x0c1729,.97).setStrokeStyle(3,s.winner?0xa3e635:0xffb15d));this.text(640,338,s.winner?`${s.players.find(p=>p.id===s.winner)?.name} HA FATTO GOBLIN TIME!`:'TEMPO SCADUTO',34,s.winner?'#c4ec85':'#ffcc94');this.text(640,398,s.winner?'Esattamente cinque. Nessuno è riuscito a fermarlo.':'Classifica di emergenza · nessuna vittoria GOBLIN TIME',22);}
    for(const e of s.log)if(!this.seen.has(e.id)){this.seen.add(e.id);if(previous)this.animate(e);}
    if(this.seen.size>300)this.seen=new Set(s.log.map(e=>e.id));
  }
  private animate(e:PublicState['log'][number]):void {
    this.avatars?.animate(e);
    if(['steal','transfer'].includes(e.kind)&&e.from&&e.to){const a=this.positions.get(e.from),b=this.positions.get(e.to);if(a&&b){const card=this.add.rectangle(a.x,a.y,35,50,0x99c0e8).setStrokeStyle(2,0xffffff).setDepth(40);this.tweens.add({targets:card,x:b.x,y:b.y,rotation:1,duration:500,onComplete:()=>card.destroy()});}}
    if(e.kind==='trap')this.cameras.main.shake(180,.003);
    if(e.kind==='declare'){const banner=this.add.text(640,280,'GOBLIN TIME!\nFERMATE STO INFAME!',{fontFamily:FONT_DISPLAY,fontSize:'42px',align:'center',color:'#ff8fa6',backgroundColor:'#251727'}).setPadding(24).setOrigin(.5).setDepth(45);this.tweens.add({targets:banner,scale:1.1,duration:180,yoyo:true,repeat:2,onComplete:()=>{this.time.delayedCall(1800,()=>banner.destroy());}});audio.ui('confirm');}
    if(e.kind==='play'&&e.cardId&&CARD_BY_ID[e.cardId].type==='CATASTROFE')this.cameras.main.flash(180,110,60,160);
  }
  private paintArt(id:string):void {
    const key=`gt-art-${id}`;
    if(this.textures.exists(key)){this.keep(this.add.image(640,366,key).setDisplaySize(125,85));return;}
    if(this.artPending.has(key))return;this.artPending.add(key);const stamp=this.generation;const img=new Image();
    img.onload=()=>{this.artPending.delete(key);if(!this.scene.isActive()||stamp!==this.generation)return;const canvas=document.createElement('canvas');canvas.width=220;canvas.height=150;canvas.getContext('2d')!.drawImage(img,0,0);this.textures.addCanvas(key,canvas);this.artKeys.add(key);if((this.state?.resolving??this.state?.discardTop.at(-1))===id)this.keep(this.add.image(640,366,key).setDisplaySize(125,85));};
    img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardArt(id))}`;
  }
  update():void {if(this.menu.update())return;if(this.state){const timer=this.children.getByName('gt-timer') as Phaser.GameObjects.Text|null;if(timer)timer.setText(`${Math.ceil(this.state.remaining)} s`);}}
}

function brief(text:string):string {if(text.length<=112)return text;const short=text.slice(0,109);return short.slice(0,short.lastIndexOf(' '))+'…';}
