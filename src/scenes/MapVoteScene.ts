import Phaser from 'phaser';
import {game as gm} from '../core/GameManager';
import {pads} from '../input/GamepadManager';
import {getMinigame} from '../../shared/minigames';
import {THEME,titleText,bodyText,sceneIn} from '../core/theme';
import {hexToInt} from '../core/uiTokens';

/** Read-only TV tally; each paired pad owns its own cursor and authenticated ballot. */
export class MapVoteScene extends Phaser.Scene {
  private clock!:Phaser.GameObjects.Text;
  private deadline=0;
  private cards:{bg:Phaser.GameObjects.Rectangle;count:Phaser.GameObjects.Text;focus:Phaser.GameObjects.Text}[]=[];
  private voters:Phaser.GameObjects.Text[]=[];
  private cursors=new Map<string,number>();
  constructor(){super('MapVoteScene');}
  create():void {
    sceneIn(this);this.cards=[];this.voters=[];this.cursors.clear();
    const v=gm.state?.mapVote;if(!v)return;
    this.deadline=performance.now()+v.endsAt-v.serverNow;
    titleText(this,60,44,'VOTA LA MAPPA',42,'#ffffff').setOrigin(0);
    this.clock=titleText(this,1198,46,'15 s',38,'#83ffe0').setOrigin(1,0);
    bodyText(this,60,108,gm.state?.currentMinigame?.minigameId==='kart3d'?'RIBALTATI':getMinigame(gm.state?.currentMinigame?.minigameId??'')?.name??'',23,THEME.textDim).setOrigin(0);
    const golf=gm.state?.currentMinigame?.minigameId==='minigolf';
    bodyText(this,640,160,golf?'Scegli la prima buca · torneo da 3 buche':'Un voto a testa · puoi cambiarlo fino allo scadere',20,'#c8d5eb');
    const cols=Math.min(5,v.options.length),rows=Math.ceil(v.options.length/cols),gap=16,w=Math.min(356,(1152-gap*(cols-1))/cols),h=rows>1?150:242;
    const x0=640-(cols*w+(cols-1)*gap)/2;
    v.options.forEach((o,i)=>{
      const x=x0+(i%cols)*(w+gap),y=203+Math.floor(i/cols)*(h+gap);
      const bg=this.add.rectangle(x,y,w,h,0x172238).setOrigin(0).setStrokeStyle(2,hexToInt(o.color),.65);
      this.add.rectangle(x+16,y+18,5,h-36,hexToInt(o.color)).setOrigin(0);
      this.add.text(x+30,y+17,`${i+1}  ${o.icon}`,{fontFamily:'Arial',fontSize:rows>1?'22px':'40px',color:o.color});
      this.add.text(x+30,y+(rows>1?48:82),o.name,{fontFamily:'Arial',fontSize:rows>1?'17px':'25px',fontStyle:'bold',color:'#ffffff',wordWrap:{width:w-48}});
      if(rows===1)this.add.text(x+30,y+154,o.description,{fontFamily:'Arial',fontSize:'17px',color:'#bdcbe0',wordWrap:{width:w-48}});
      const count=this.add.text(x+w-16,y+18,'0 VOTI',{fontFamily:'Arial',fontSize:'18px',fontStyle:'bold',color:'#9bacc7'}).setOrigin(1,0);
      const focus=this.add.text(x+30,y+h-29,'',{fontFamily:'Arial',fontSize:'16px',fontStyle:'bold',color:'#83ffe0'});
      this.cards.push({bg,count,focus});
    });
    const people=gm.state!.players.filter(p=>!p.bot),width=1152/Math.max(1,people.length);
    people.forEach((p,i)=>{
      this.add.rectangle(64+i*width,558,width-12,76,0x121d30).setOrigin(0);
      const t=this.add.text(76+i*width,568,'',{fontFamily:'Arial',fontSize:'16px',color:'#b9cbe6',wordWrap:{width:width-36}});this.voters.push(t);
      this.cursors.set(p.id,Math.max(0,v.options.findIndex(o=>o.id===v.votes[p.id])));
    });
    bodyText(this,640,670,'TELEFONO: tocca una mappa · CONTROLLER: croce/stick + A/✕ · I bot si astengono',19,THEME.textDim);
    const offState=gm.events.on('state',()=>{const v=gm.state?.mapVote;if(v)this.deadline=performance.now()+v.endsAt-v.serverNow;this.refresh();});
    const offNav=pads.events.on('mapVoteNavigate',event=>{
      const e=event as {playerId:string;step:number},vote=gm.state?.mapVote;if(!vote||!vote.eligible.includes(e.playerId))return;
      this.cursors.set(e.playerId,((this.cursors.get(e.playerId)??0)+e.step+vote.options.length)%vote.options.length);this.refresh();
    });
    const offConfirm=pads.events.on('mapVoteConfirm',event=>{
      const e=event as {playerId:string},vote=gm.state?.mapVote;if(!vote)return;
      const option=vote.options[this.cursors.get(e.playerId)??0];if(option)gm.voteMapForPad(e.playerId,option.id);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{offState();offNav();offConfirm();});
    this.refresh();
  }
  private refresh():void {
    const s=gm.state,v=s?.mapVote;if(!v)return;
    const people=s.players.filter(p=>!p.bot);
    v.options.forEach((o,i)=>{
      const card=this.cards[i];if(!card)return;
      const n=Object.values(v.votes).filter(id=>id===o.id).length;
      card.count.setText(`${n} ${n===1?'VOTO':'VOTI'}`).setColor(n?'#83ffe0':'#9bacc7');card.bg.setFillStyle(n?0x203c46:0x172238);
      card.focus.setText(people.flatMap((p,j)=>p.pad&&this.cursors.get(p.id)===i?[`P${j+1}`]:[]).join(' · '));
    });
    people.forEach((p,i)=>{
      const chosen=v.options.find(o=>o.id===v.votes[p.id]);
      this.voters[i]?.setText(`P${i+1} · ${p.displayName}${p.connected?'':' · OFFLINE'}\n${chosen?`✓ ${chosen.name}`:'IN ATTESA'}`).setColor(chosen?'#b8ffe7':'#b9cbe6');
    });
  }
  update():void {
    const v=gm.state?.mapVote;if(this.clock&&v)this.clock.setText(`${Math.max(0,Math.ceil((this.deadline-performance.now())/1000))} s`);
  }
}
