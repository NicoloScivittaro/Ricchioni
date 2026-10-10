import {Scene} from '@babylonjs/core';
import {AdvancedDynamicTexture,Control,Rectangle,TextBlock} from '@babylonjs/gui';
import {hudText} from '../hud/hudKit';
import type {MinigolfMatch} from './minigolfRules';
import {abilityStatus} from './minigolfAbilities';
import {stateLabel} from '../../../shared/abilityCatalog';
/** Fixed safe-area rows; no floating black player labels. */
export class MinigolfHud {
 readonly adt:AdvancedDynamicTexture;
 private course:TextBlock;private clock:TextBlock;private phase:TextBlock;private notice:TextBlock;private help:TextBlock;
 private rows=new Map<string,{name:TextBlock;score:TextBlock;ability:TextBlock;bar:Rectangle;box:Rectangle}>();
 private noticeTime=0;
 constructor(scene:Scene,match:MinigolfMatch){
  this.adt=AdvancedDynamicTexture.CreateFullscreenUI('minigolfHud',true,scene);this.adt.idealHeight=720;
  const text=(key:string,label:string,size:number,color:string,top:number,width='90%')=>{
   const t=hudText(key,label,size,color,false);t.height='28px';t.width=width;t.top=`${top}px`;t.verticalAlignment=Control.VERTICAL_ALIGNMENT_TOP;t.isHitTestVisible=false;this.adt.addControl(t);return t;};
  text('golfTitle','⛳ MINIGOLF DEI DISAGIATI',18,'#d4f9da',20);
  this.course=text('golfCourse','',24,'#ffffff',51);this.clock=text('golfClock','',19,'#fde047',85);
  this.phase=text('golfPhase','',19,'#c4b5fd',113);this.help=text('golfHelp','',14,'#d1fae5',141);
  this.notice=text('golfNotice','',17,'#fde047',594);this.notice.height='24px';
  for(const [i,p] of match.players.entries()){
   const box=new Rectangle(`golfPlayer:${p.id}`);box.width=`${90/match.players.length}%`;box.height='74px';box.top='-14px';box.thickness=1;box.color=p.color;box.background='rgba(9,24,32,.82)';box.cornerRadius=10;box.isHitTestVisible=false;
   box.horizontalAlignment=Control.HORIZONTAL_ALIGNMENT_LEFT;box.left=`${5+i*90/match.players.length}%`;box.verticalAlignment=Control.VERTICAL_ALIGNMENT_BOTTOM;this.adt.addControl(box);
   const add=(key:string,size:number,color:string,top:number)=>{const t=hudText(key,'',size,color,false);t.height='23px';t.top=`${top}px`;t.width='94%';t.isHitTestVisible=false;box.addControl(t);return t;};
   const name=add('nickname',14,p.color,-23),score=add('strokes',17,'#ffffff',0),ability=add('ability',11,'#d1fae5',23);
   const bar=new Rectangle('power');bar.height='3px';bar.width='0%';bar.thickness=0;bar.background=p.color;bar.verticalAlignment=Control.VERTICAL_ALIGNMENT_BOTTOM;bar.horizontalAlignment=Control.HORIZONTAL_ALIGNMENT_LEFT;box.addControl(bar);
   name.text=`${i+1} · ${Array.from(p.name).slice(0,14).join('')}`;this.rows.set(p.id,{name,score,ability,bar,box});
  }
 }
 feedback(text:string,color='#fde047'):void {this.notice.text=text;this.notice.color=color;this.noticeTime=2.1;}
 update(m:MinigolfMatch,dt:number):void {
  this.course.text=`BUCA ${m.courseIndex+1}/${m.courses.length} · ${m.course.name}`;
  this.clock.text=`${Math.ceil(m.remaining)} s  ·  MENO COLPI VINCE`;
  this.phase.text=m.phase==='intro'?`PRONTI TRA ${Math.max(1,Math.ceil(m.phaseTime))}…`:m.phase==='transition'?'BUCA CHIUSA · SI CAMBIA CAMPO':m.phase==='ended'?'TRE BUCHE · ECCO CHI PAGA':'TUTTI INSIEME · LE PALLINE SI POSSONO BOCCIARE';
  this.help.text=m.phase==='intro'?m.course.tip:'STICK = MIRA · A/✕ TIENI E RILASCIA · B/◯ ANNULLA · RB/R1 ABILITÀ';
  for(const p of m.players){const r=this.rows.get(p.id)!;
   r.score.text=p.finished?`${p.records.at(-1)?.completed?'✓':'DNF'} ${p.strokes} · TOT ${p.total}`:`${p.strokes}/8 COLPI · TOT ${p.total+p.strokes}`;
   r.ability.text=p.charging?`CARICA ${Math.round(p.charge*100)}%`:!p.finished&&!p.ball.grounded?'IN VOLO':stateLabel(abilityStatus(p,m.time,m.extras));
   r.bar.width=`${p.charging?p.charge*100:0}%`;r.box.alpha=p.finished?.7:1;
  }
  this.noticeTime=Math.max(0,this.noticeTime-dt);if(!this.noticeTime)this.notice.text='';
 }
 dispose():void{this.adt.dispose();}
}
