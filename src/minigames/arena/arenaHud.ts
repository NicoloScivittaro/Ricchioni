import { Scene } from '@babylonjs/core';
import { GameHud, hudText, hudPanel } from '../hud/hudKit';
import { Control, StackPanel, Rectangle, TextBlock } from '@babylonjs/gui';
import type { ArenaPlayer } from './arenaTypes';
import { instabilityStage } from '../../../shared/arenaCombat';
import type { HudPlayer } from '../hud/hudKit';
import { UI } from '../../core/uiTokens';

/**
 * HUD dei giochi tutti-contro-tutti (Arena, Dodgeball): costruito sul kit comune (hud/hudKit.ts).
 * In alto: chip del gioco (piccolo) a sinistra, IN GARA a destra; in basso la striscia dei giocatori (chi e' fuori si spegne).
 * Il centro dello schermo resta libero per l'arena.
 */
export class ArenaHud extends GameHud {
  private suddenDeath = false;
  private combatEnabled: boolean;
  private combat = new Map<string,{label:TextBlock;fill:Rectangle;action:TextBlock}>();

  setSuddenDeath(): void { this.suddenDeath = true; }
  constructor(scene: Scene, titleText = '🤼 ARENA DEL DISAGIO') {
    super(scene, 'arenaHud', titleText);
    this.combatEnabled=titleText.includes('ARENA DEL DISAGIO');
  }

  setAlive(n: number, total?: number): void {
    const prefix = this.suddenDeath ? '🔥 SUDDEN DEATH' : 'IN GARA';
    this.setRight(total ? `${prefix} ${n}/${total}` : `${prefix} ${n}`, this.suddenDeath || n <= 2 ? UI.color.accent : UI.color.success);
  }

  /** Striscia giocatori in basso (icona, nome, stato). */
  setPlayers(players: HudPlayer[]): void {
    this.playerStrip(players);
    // Other games share this HUD; combat meters are exclusive to Arena.
    if (!this.combatEnabled) return;
    const row=new StackPanel('arenaCombatStrip'); row.isVertical=false; row.height='66px';
    row.top='-84px'; row.verticalAlignment=Control.VERTICAL_ALIGNMENT_BOTTOM;
    const w=Math.min(230,Math.floor(1200/players.length)-10);
    for (const p of players) {
      const card=hudPanel(`combat_${p.id}`,`${w}px`,'62px',p.color);
      const label=hudText(`instability_${p.id}`,'STABILE · 0%',17,'#4ade80');label.height='23px';label.top='-17px';
      const bar=new Rectangle();bar.width=`${w-20}px`;bar.height='7px';bar.top='1px';bar.thickness=0;bar.background='#343040';
      const fill=new Rectangle();fill.width=0;fill.height='7px';fill.thickness=0;fill.background='#4ade80';fill.horizontalAlignment=Control.HORIZONTAL_ALIGNMENT_LEFT;
      bar.addControl(fill);
      const action=hudText(`combatAction_${p.id}`,'SPINTA / TIENI: SPALLATA',12,'#c4b5fd');action.height='18px';action.top='20px';
      card.addControl(label);card.addControl(bar);card.addControl(action);row.addControl(card);this.combat.set(p.id,{label,fill,action});
    }
    this.adt.addControl(row);
  }

  setCombat(p:ArenaPlayer):void {
    const e=this.combat.get(p.id);if(!e)return;
    const color=p.instability>=70?'#f87171':p.instability>=35?'#fbbf24':'#4ade80';
    e.label.text=p.alive?`${instabilityStage(p.instability)} · ${Math.round(p.instability)}%`:'FUORI';
    e.label.color=color;e.fill.background=color;e.fill.width=Math.max(.002,p.instability/100);
    e.action.text=!p.alive?'':p.charging?`CARICA ${Math.round(p.chargeTime*100)}%`:p.recoveryTime>0?'RECUPERO':p.attackCooldown>0?`RICARICA ${p.attackCooldown.toFixed(1)}s`:'SPINTA / TIENI: SPALLATA';
  }
}
