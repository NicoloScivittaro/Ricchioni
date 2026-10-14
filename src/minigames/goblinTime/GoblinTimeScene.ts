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
import { clockText, tableInstruction } from '../../../shared/goblinTime/presentation';
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
    ['1 · ARRIVA A 5 CARTE','2 · PREMI DICHIARA','3 · RESTA A 5 FINO AL TUO TURNO'].forEach((label,i)=>{this.keep(this.add.rectangle(230+i*410,285,390,76,0x1a3045).setStrokeStyle(1,0x6a8f6b));this.text(230+i*410,285,label,19,'#d6f2bf').setWordWrapWidth(365);});
    const button=(x:number,label:string,mode:'base'|'personal')=>{
      const rect=this.keep(this.add.rectangle(x,420,440,145,0x24384f).setStrokeStyle(2,mode==='base'?0x71b8ff:0xcaa0ff).setInteractive({useHandCursor:true}));
      this.text(x,400,label,28);this.text(x,444,mode==='base'?'100 carte originali':'125 carte · incluse le nostre 25',18,'#c2cee0');
      rect.once('pointerdown',()=>{this.mode=mode;this.clear();this.text(640,340,'PRENDETE I TELEFONI',42);(this.ctx.showControls?.()??Promise.resolve()).then(()=>{if(this.scene.isActive())gm.startGoblin(mode);});});
    };button(390,'MAZZO ORIGINALE','base');button(890,'NOI CINQUE','personal');
    this.text(640,563,'1 MINUTO PER SCEGLIERE · puoi confermare subito',22,'#ffda78');
    this.text(640,607,'Sul telefono leggi le carte, scegli e confermi. Sulla TV segui il turno.',19,'#a8c1dc');
  }
  private renderState(s:PublicState):void {
    if(s.roundId!==this.ctx.roundId)return;
    const previous=this.state;this.state=s;
    if(!this.avatarsStarted){this.avatarsStarted=true;const stamp=this.generation;import('./avatars').then(({GoblinAvatars})=>{if(!this.scene.isActive()||stamp!==this.generation)return;this.avatars=new GoblinAvatars(this.game.canvas,s.players);this.avatars.update(this.state!,this.positions);for(const o of this.view)if(o.name.startsWith('gt-portrait'))(o as Phaser.GameObjects.Image).setVisible(false);}).catch(error=>{document.getElementById('goblin-avatars')?.remove();console.warn('GOBLIN TIME: uso i ritratti esistenti, render 3D non disponibile',error);});}
    if(previous?.version===s.version&&previous.paused===s.paused)return;
    this.clear();this.keep(this.add.rectangle(640,360,1280,720,0x0a1220));
    this.text(260,40,'GOBLIN TIME',34,'#c4ec85').setFontFamily(FONT_DISPLAY);
    this.text(700,40,`${s.mode==='base'?'MAZZO ORIGINALE':'NOI CINQUE'} · TURNO ${s.turnNumber}`,16,'#9eb5cd');
    this.text(1145,40,clockText(s.remaining),30,'#ffda78').setName('gt-timer');
    const instruction=tableInstruction(s);this.keep(this.add.rectangle(640,115,1180,94,0x1c3047).setStrokeStyle(2,s.phase==='reaction'?0x69d99e:0x83bfff));
    this.text(640,97,instruction.title,27,'#f1f8ff').setName('gt-phase');
    this.text(640,137,instruction.detail,17,'#c9daed').setWordWrapWidth(1130).setName('gt-instruction');
    this.text(640,176,'OBIETTIVO: 5 CARTE IN MANO → DICHIARA → MANTIENILE FINO AL TUO TURNO',16,'#c4ec85');
    const n=s.players.length;this.positions.clear();
    s.players.forEach((p,i)=>{
      const x=640+(i-(n-1)/2)*226,y=248;this.positions.set(p.id,{x,y});
      const accent=Phaser.Display.Color.HexStringToColor(presentationOf(p.characterId)?.accent??'#69c49b').color;
      const waiting=s.waitingFor?.includes(p.id);this.keep(this.add.rectangle(x,y,210,120,0x142136,.97).setStrokeStyle(p.declared?4:2,p.declared?0xff4c76:waiting?0x6fe8bd:p.id===s.turn?0xffda78:accent));
      if(!this.avatars)this.keep(addPortrait(this,x-65,y-25,p.characterId,58)).setName(`gt-portrait-${p.id}`);
      this.text(x+24,y-34,p.name,18).setWordWrapWidth(128);this.text(x+24,y+2,`${p.count??'?'} / 5`,26,p.declared?'#ff97b3':'#fff');
      this.text(x,y+32,p.declared?'HA DICHIARATO!':waiting?'DEVE SCEGLIERE':p.id===s.turn?'GIOCATORE DI TURNO':`${p.traps} trappole · ${p.abilityUsed?'abilità usata':'abilità pronta'}`,12,p.declared?'#ff92a8':waiting?'#6fe8bd':'#a9bed4');
      abilityHub.setStatus(p.id,{state:p.abilityUsed?'SPENT':'READY'});
      if(p.abilityUsed&&!previous?.players.find(old=>old.id===p.id)?.abilityUsed)abilityHub.activated(p.id);
    });
    this.avatars?.update(s,this.positions);
    this.keep(this.add.rectangle(640,449,1180,250,0x142035).setStrokeStyle(1,0x3e5b76));
    const played=s.resolving??s.discardTop.at(-1);if(played) {const c=CARD_BY_ID[played];this.text(760,352,`${s.resolving?'CARTA IN RISOLUZIONE':'ULTIMO SCARTO'} · ${c.type}`,13,TYPE_COLOR[c.type]);this.text(760,386,c.name,25).setWordWrapWidth(820);this.paintArt(played);this.text(760,475,c.effect,20,'#e0eaf5').setWordWrapWidth(815).setLineSpacing(5);}else {this.text(640,420,'LA PARTITA È INIZIATA',26,'#c4ec85');this.text(640,473,'Quando tocca a te, pesca oppure tocca una carta sul telefono per leggerla e giocarla.',21).setWordWrapWidth(1000);}
    const latest=s.log.at(-1);this.text(640,595,'ULTIMA MOSSA',12,'#89a1bd');if(latest)this.text(640,627,latest.text,23,latest.kind==='declare'?'#ff9eba':'#e3edf9').setWordWrapWidth(1150);
    this.text(640,689,`${s.deckCount} carte nel mazzo · ${s.discardCount} negli scarti · ${Math.ceil(s.matchRemaining/60)} min alla fine · cronologia sul telefono`,14,'#89a1bd');
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
    if(this.textures.exists(key)){this.keep(this.add.image(222,449,key).setDisplaySize(160,110));return;}
    if(this.artPending.has(key))return;this.artPending.add(key);const stamp=this.generation;const img=new Image();
    img.onload=()=>{this.artPending.delete(key);if(!this.scene.isActive()||stamp!==this.generation)return;const canvas=document.createElement('canvas');canvas.width=220;canvas.height=150;canvas.getContext('2d')!.drawImage(img,0,0);this.textures.addCanvas(key,canvas);this.artKeys.add(key);if((this.state?.resolving??this.state?.discardTop.at(-1))===id)this.keep(this.add.image(222,449,key).setDisplaySize(160,110));};
    img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardArt(id))}`;
  }
  update():void {if(this.menu.update())return;if(this.state){const timer=this.children.getByName('gt-timer') as Phaser.GameObjects.Text|null;if(timer)timer.setText(clockText(this.state.remaining));}}
}

