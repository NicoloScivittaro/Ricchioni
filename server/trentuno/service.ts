import { TrentunoGame } from './core';
import { RULES } from '../../shared/trentuno/rules';
import type { GameSession } from '../GameSession';
import type { Ack,Command,PrivateState,PublicState } from '../../shared/trentuno/types';
/** Un motore per stanza, clock indipendente dalla TV e fermo durante la pausa. */
export class TrentunoService {
  readonly game:TrentunoGame;private timer:ReturnType<typeof setInterval>;private previous=performance.now();private sent=0;private finishedElapsed=0;
  constructor(readonly room:GameSession,private publish:(pub:PublicState,privateState:(id:string)=>PrivateState)=>void){
    this.game=new TrentunoGame(room.minigameSeq,room.players.map(p=>({id:p.id,name:p.displayName,characterId:p.characterId!,bot:p.bot})));
    this.timer=setInterval(()=>this.tick(),50);this.sync();
  }
  command(id:string,c:Command):Ack{const ack=this.game.command(id,c);this.sync();return ack;}
  sync():void{this.game.paused=this.room.paused;this.publish(this.game.publicState(),id=>this.game.privateState(id));this.sent=performance.now();}
  destroy():void{clearInterval(this.timer);}
  private tick():void{
    const now=performance.now(),dt=(now-this.previous)/1000;this.previous=now;
    try{this.game.paused=this.room.paused;this.game.tick(dt);if(now-this.sent>=200)this.sync();
      if(this.game.phase==='finished'&&!this.room.paused){this.finishedElapsed+=dt;if(this.finishedElapsed>=RULES.resultHold){this.destroy();this.room.finishMinigame(this.game.results!,this.game.roundId);}}
    }catch(error){this.destroy();console.error('[31 DEGLI INFAMI]',error);this.room.setPaused(true);}
  }
}
