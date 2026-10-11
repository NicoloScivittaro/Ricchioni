import {Scene} from '@babylonjs/core';
import {AdvancedDynamicTexture,Control,Rectangle,TextBlock} from '@babylonjs/gui';
import {hudText} from '../hud/hudKit';
import type {MinigolfMatch} from './minigolfRules';
import {abilityStatus} from './minigolfAbilities';
import {abilityFor,stateLabel} from '../../../shared/abilityCatalog';
/** Compact fixed HUD, no names floating over balls or obstacles. */
export class MinigolfHud {
 readonly adt:AdvancedDynamicTexture;
 private course:TextBlock;private clock:TextBlock;private phase:TextBlock;private notice:TextBlock;private help:TextBlock;private power:TextBlock;private ability:TextBlock;
 private rows=new Map<string,{name:TextBlock;score:TextBlock;box:Rectangle}>();private noticeTime=0;
 constructor(scene:Scene,match:MinigolfMatch){
  this.adt=AdvancedDynamicTexture.CreateFullscreenUI('minigolfHud',true,scene);this.adt.idealHeight=720;
  const text=(key:string,size:number,color:string,top:number)=>{const t=hudText(key,'',size,color,false);t.height='25px';t.width='94%';t.top=`${top}px`;t.verticalAlignment=Control.VERTICAL_ALIGNMENT_TOP;t.isHitTestVisible=false;this.adt.addControl(t);return t;};
  this.course=text('golfCourse',16,'#d4f9da',16);this.clock=text('golfClock',14,'#fde047',42);
  this.phase=text('golfPhase',24,'#ffffff',71);this.phase.height='32px';
  this.ability=text('golfActiveAbility',13,'#d1fae5',110);
  this.notice=text('golfNotice',17,'#fde047',554);
  this.power=text('golfPower',16,'#ffffff',580);
  this.help=text('golfHelp',12,'#d1fae5',607);
  for(const [i,p] of match.players.entries()){
   const box=new Rectangle(`golfPlayer:${p.id}`);box.width=`${92/match.players.length}%`;box.height='52px';box.top='-12px';box.thickness=1;box.color=p.color;box.background='rgba(9,24,32,.72)';box.cornerRadius=8;box.isHitTestVisible=false;
   box.horizontalAlignment=Control.HORIZONTAL_ALIGNMENT_LEFT;box.left=`${4+i*92/match.players.length}%`;box.verticalAlignment=Control.VERTICAL_ALIGNMENT_BOTTOM;this.adt.addControl(box);
   const add=(key:string,size:number,color:string,top:number)=>{const t=hudText(key,'',size,color,false);t.height='22px';t.top=`${top}px`;t.width='94%';t.isHitTestVisible=false;box.addControl(t);return t;};
   this.rows.set(p.id,{name:add('nickname',13,p.color,-12),score:add('strokes',14,'#ffffff',12),box});
  }
 }
 feedback(text:string,color='#fde047'):void {this.notice.text=text;this.notice.color=color;this.noticeTime=1.4;}
 update(m:MinigolfMatch,dt:number):void {
  const p=m.active;this.course.text=`${m.course.name} · PAR ${m.course.par} · LIMITE ${m.course.maxStrokes} COLPI`;
  this.clock.text=`ROUND ${Math.ceil(m.remaining)} s · DNF = ALMENO ${m.course.maxStrokes+2} COLPI (+2)`;
  this.phase.text=m.phase==='intro'?`PRONTI TRA ${Math.max(1,Math.ceil(m.phaseTime))}…`:m.phase==='ended'?'BUCA CHIUSA':m.stage==='switch'?'CAMBIO TURNO':`${p.name} · ${m.aiming?`${m.aimRemaining.toFixed(1)} s PER TIRARE`:'PALLINE IN MOVIMENTO'}`;
  this.phase.color=p.color;
  const ab=abilityFor('minigolf',p.characterId);this.ability.text=`${p.strokes}/${m.course.maxStrokes} COLPI · ${ab?.name??'ABILITÀ'} · ${stateLabel(abilityStatus(p,m.time,m.extras))}`;
  this.power.text=m.aiming?`POTENZA ${'▰'.repeat(Math.round(p.charge*12))}${'▱'.repeat(12-Math.round(p.charge*12))} ${Math.round(p.charge*100)}%`:m.stage==='rolling'?'IL TURNO CAMBIA QUANDO TUTTE LE PALLINE SI FERMANO':'';
  this.help.text=m.phase==='intro'?m.course.tip:'LS MIRA (SU = FINE) · RS CAMERA · A/✕ CARICA/RILASCIA · B/◯ ANNULLA · Y/△ TIENI PANORAMICA · RB/R1 ABILITÀ';
  const rank=[...m.players].sort((a,b)=>(a.finished?a.total:a.strokes)-(b.finished?b.total:b.strokes)||a.penalties-b.penalties||a.completionTime-b.completionTime||m.players.indexOf(a)-m.players.indexOf(b));
  for(const q of m.players){const r=this.rows.get(q.id)!;r.name.text=`${rank.indexOf(q)+1}. ${q===p&&m.phase==='playing'?'▶ ':''}${Array.from(q.name).slice(0,14).join('')}`;
   r.score.text=q.finished?`${q.completed?'✓':'DNF'} ${q.total} COLPI`:`${q.strokes}/${m.course.maxStrokes} COLPI`;
   r.box.alpha=q.finished?.65:1;r.box.thickness=q===p?2:1;
  }
  this.noticeTime=Math.max(0,this.noticeTime-dt);if(!this.noticeTime)this.notice.text='';
 }
 dispose():void{this.adt.dispose();}
}
