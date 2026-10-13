import { GoblinGame } from './core';
import { GT } from '../../shared/goblinTime/catalog';
import type { GameSession } from '../GameSession';
import type { Command, CommandAck, PrivateState, PublicState } from '../../shared/goblinTime/types';
/** Un servizio per stanza; nessuna simulazione sull'host. */
export class GoblinService {
  game: GoblinGame;
  private timer: ReturnType<typeof setInterval>;
  private previous = performance.now(); private sent = 0; private finishedElapsed=0;
  constructor(readonly room: GameSession, mode: 'base'|'personal', private publish: (pub: PublicState, getPrivate: (id: string) => PrivateState) => void) {
    this.game = new GoblinGame(room.minigameSeq, room.players.map(p=>({id:p.id,name:p.displayName,characterId:p.characterId!,bot:p.bot})), mode);
    this.timer=setInterval(()=>this.tick(),50); this.sync();
  }
  command(id: string, command: Command): CommandAck { const ack=this.game.command(id,command); this.sync();return ack; }
  sync(): void { this.game.paused=this.room.paused; this.publish(this.game.publicState(),id=>this.game.privateState(id));this.sent=performance.now(); }
  destroy(): void { clearInterval(this.timer); }
  private tick(): void {
    const now=performance.now(),dt=(now-this.previous)/1000;this.previous=now;
    try {
      this.game.paused=this.room.paused;
      this.game.tick(dt);
      if(now-this.sent>=200)this.sync();
      if(this.game.phase==='finished'&&!this.room.paused) {
        this.finishedElapsed+=dt;
        if(this.finishedElapsed>=GT.resultHold) { const results=this.game.results!;this.destroy();this.room.finishMinigame(results,this.game.roundId); }
      }
    } catch(error) { this.destroy(); console.error('[GOBLIN TIME]',error); this.room.setPaused(true); }
  }
}
