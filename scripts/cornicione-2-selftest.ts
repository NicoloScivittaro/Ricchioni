import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {FighterWorld} from '../src/minigames/cornicione/fighterCore';
import {FighterBot} from '../src/minigames/cornicione/fighterBot';
import {CORNICIONE_STAGES} from '../src/minigames/cornicione/fighterStages';
import {CORNICIONE_MAPS} from '../shared/minigameMaps';
import {KO} from '../src/minigames/cornicione/fighterData';
import {Rng} from '../shared/rng';
import {GameSession} from '../server/GameSession';
import {PlayerSession} from '../server/PlayerSession';
const chars=['goblin','buttafuori','judoka','dottore','ciro'];
const report:{stages:unknown[];untimed:boolean;server?:unknown;bots:unknown[]}={stages:[],untimed:false,bots:[]};
const make=(n:number,stage=CORNICIONE_STAGES[0])=>{const r=new Rng(378);return new FighterWorld({ids:chars.slice(0,n),characters:chars.slice(0,n),stage,rng:()=>r.next()});};
assert.deepEqual(CORNICIONE_STAGES.map(s=>s.id),CORNICIONE_MAPS.map(m=>m.id));
for(const stage of CORNICIONE_STAGES){
 for(let n=2;n<=5;n++){
  const w=make(n,stage);assert.equal(w.fighters.length,n);
  for(const f of w.fighters){assert.ok(Math.abs(f.x)<stage.mainX-.7);if(f.support)assert.ok(stage.platforms.some(p=>p.id===f.support&&p.y===f.y&&f.x>=p.x0&&f.x<=p.x1));else assert.equal(f.y,0);}
  w.step(.1,{});for(const f of w.fighters)assert.equal(f.grounded,true);
 }
 for(const p of stage.platforms){
  const w=make(2,stage),f=w.fighters[0];Object.assign(f,{x:(p.x0+p.x1)/2,y:p.y+.15,vy:-4,grounded:false,support:-1});
  w.step(.1,{});assert.equal(f.support,p.id);assert.equal(f.y,p.y);
 }
 const r=new Rng(500),w=new FighterWorld({ids:chars,characters:chars,stage,rng:()=>r.next()});
 const bots=chars.map(id=>new FighterBot(id,()=>r.next(),.65));
 for(let tick=0;tick<600*60&&w.phase!=='over';tick++){
  w.step(1/60,Object.fromEntries(bots.map(b=>[b.id,b.input(w,1/60)])));w.drainEvents();
 }
 assert.equal(w.endReason,'lastStanding','Bots must reach a natural finish on '+stage.id);
 assert.equal(new Set(w.ranking().map(f=>f.id)).size,5);
 for(const f of w.fighters)assert.ok(Number.isFinite(f.x)&&Number.isFinite(f.y));
 report.bots.push({map:stage.id,players:5,seconds:Math.round(w.time),reason:w.endReason,kos:w.fighters.reduce((a,f)=>a+f.stats.deaths,0)});
 report.stages.push({map:stage.id,spawns2to5:true,allPlatformsLandable:true});
}
{
 const w=make(2);for(let i=0;i<601*60;i++){w.step(1/60,{});w.drainEvents();}
 assert.equal(w.phase,'fight');assert.equal(w.endReason,null);assert.equal(w.timeLimit,Infinity);report.untimed=true;
 const f=w.fighters[1];f.lives=1;f.y=KO.minY-1;f.grounded=false;w.step(1/60,{});assert.equal(w.endReason,'lastStanding');
}
{
 const s=new GameSession('CORN',2,60,'host');
 try{
  for(let i=0;i<2;i++){const p=new PlayerSession('p'+i,'P'+i,'token'+i);p.characterId=chars[i];p.ready=true;p.attach('s'+i);s.addPlayer(p);}
  s.selectMinigame('cornicione');s.startGame();s.skip();assert.equal(s.phase,'MINIGAME_MAP_VOTE');assert.equal(s.mapVote!.options.length,3);
  for(let i=0;i<2;i++)s.castMapVote('p'+i,s.minigameSeq,'darsena');
  const now=Date.now;try{Date.now=()=>s.mapVote!.endsAt;(s as any).advanceFrom('MINIGAME_MAP_VOTE');}finally{Date.now=now;}
  assert.equal(s.currentMinigame!.mapId,'darsena');s.skip();assert.equal(s.phase,'MINIGAME_PLAYING');assert.equal((s as any).timer,null);
  (s as any).armPlayingSafetyNet();assert.equal((s as any).timer,null);
  report.server={mapVote:true,selectedMap:'darsena',noPlayingDeadline:true,rearmHasNoDeadline:true};
 }finally{s.resetToLobby();}
}
writeFileSync('docs/agent-work/cornicione-2/core-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
