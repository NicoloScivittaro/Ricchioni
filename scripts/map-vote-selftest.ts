import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {GameSession} from '../server/GameSession';
import {PlayerSession} from '../server/PlayerSession';
import {mapsFor,BACKROOM_MAPS,GOLF_MAPS} from '../shared/minigameMaps';
import {MINIGAME_DEFINITIONS} from '../shared/minigames';
import {LEVELS} from '../src/minigames/backrooms/levels';
import {COURSES,selectCourses} from '../src/minigames/minigolf/minigolfCourses';
import {Rng} from '../shared/rng';
const checks:string[]=[];
const ok=(b:unknown,label:string)=>{assert.ok(b,label);checks.push(label);};
function room(game:string,n=3,solo=false){
  const s=new GameSession('VOTE',n,60,'host');
  for(let i=0;i<(solo?1:n);i++){
    const p=new PlayerSession(`p${i}`,`P${i}`,`t${i}`);p.characterId=['goblin','ciro','dottore','judoka','buttafuori'][i];p.ready=true;p.attach(`socket${i}`);s.addPlayer(p);
  }
  s.selectMinigame(game,game==='kart3d'?'arcobaleno':undefined);s.startGame();return s;
}
function expire(s:GameSession){const now=Date.now;try{Date.now=()=>s.mapVote!.endsAt;(s as unknown as {advanceFrom:(p:string)=>void}).advanceFrom('MINIGAME_MAP_VOTE');}finally{Date.now=now;}}
for(const game of ['kart3d','backrooms','minigolf']){
  const s=room(game);
  try{
    ok(!s.castMapVote('p0',s.minigameSeq,mapsFor(game)[0].id),'reject vote before ballot '+game);
    s.skip();ok(s.phase==='MINIGAME_MAP_VOTE','map vote after roulette '+game);
    assert.equal(s.mapVote!.options.length,mapsFor(game).length);const seq=s.minigameSeq,[a,b]=s.mapVote!.options;
    s.skip();ok(s.phase==='MINIGAME_MAP_VOTE','animation skip cannot bypass ballot '+game);
    ok(!s.castMapVote('outsider',seq,a.id)&&!s.castMapVote('p0',seq-1,a.id)&&!s.castMapVote('p0',seq,'missing'),'reject foreign identity / stale round / wrong map '+game);
    ok(s.castMapVote('p0',seq,a.id)&&s.castMapVote('p0',seq,a.id)&&s.castMapVote('p0',seq,b.id),'idempotent ballot and change '+game);
    s.castMapVote('p1',seq,b.id);s.castMapVote('p2',seq,a.id);
    ok(Object.keys(s.mapVote!.votes).length===3,'one vote per identity '+game);
    const snapshot=s.toRoomState();snapshot.mapVote!.votes.p0=a.id;snapshot.mapVote!.options[0].id='corrupt';
    ok(s.mapVote!.votes.p0===b.id&&s.mapVote!.options[0].id===a.id,'snapshot cannot mutate vote '+game);
    expire(s);ok(s.phase==='MINIGAME_INTRO'&&s.currentMinigame!.mapId===b.id&&s.lastSelectedPayload!.mapId===b.id,'majority reaches final payload '+game);
    if(game==='kart3d')assert.equal(s.lastSelectedPayload!.kartTrackId,b.id);
    ok(s.mapVote===null&&!s.castMapVote('p0',seq,a.id),'late votes rejected '+game);
    s.skip();ok(s.phase==='MINIGAME_PLAYING','game starts only after intro '+game);
  }finally{s.resetToLobby();}
}
for(let trial=0;trial<30;trial++){
  const s=room('backrooms');try{s.skip();const [a,b,c]=s.mapVote!.options;s.castMapVote('p0',s.minigameSeq,a.id);s.castMapVote('p1',s.minigameSeq,b.id);expire(s);ok([a.id,b.id].includes(s.currentMinigame!.mapId!)&&s.currentMinigame!.mapId!==c.id,'tie chooses only leading maps');}finally{s.resetToLobby();}
}
{
  const s=room('kart3d',5,true);try{
    s.skip();assert.equal(s.mapVote!.eligible.length,1);assert.equal(s.players.filter(p=>p.bot).length,4);
    ok(!s.castMapVote(s.players[1].id,s.minigameSeq,'litorale'),'bots abstain');
    ok(!s.castMapVote('p0',s.minigameSeq,'litorale',true),'host pad ballot requires association');
    s.setGamepads({p0:'Xbox'});ok(s.castMapVote('p0',s.minigameSeq,'litorale',true),'associated pad can vote');
    s.getPlayer('p0')!.detach();ok(s.castMapVote('p0',s.minigameSeq,'litorale',true),'paired pad can vote while phone is asleep');ok(!s.castMapVote('p0',s.minigameSeq,'arcobaleno'),'disconnected identity cannot vote');s.getPlayer('p0')!.attach('newSocket');
    ok(s.castMapVote('p0',s.minigameSeq,'arcobaleno'),'reconnected identity replaces previous vote');
    const now=Date.now;try{Date.now=()=>s.mapVote!.endsAt;ok(!s.castMapVote('p0',s.minigameSeq,'litorale'),'deadline enforced even before timer callback');}finally{Date.now=now;}
    s.restartMatch();ok(s.mapVote===null&&s.phase==='LOBBY'&&s.lastSelectedPayload===null,'restart clears ballots and payload');
    s.players[0].ready=true;s.selectMinigame('kart3d','arcobaleno');s.startGame();s.skip();expire(s);
    ok(s.currentMinigame!.mapId==='arcobaleno','no votes respects explicit kart fallback');
  }finally{s.resetToLobby();}
}
{
  const s=room('minigolf');try{s.skip();s.skipMinigame();ok(s.mapVote===null&&s.phase==='MINIGAME_ROULETTE','emergency skip clears vote');s.resetToLobby();ok(s.mapVote===null&&s.lastSelectedPayload===null,'lobby clears vote');}finally{s.resetToLobby();}
}
for(const def of MINIGAME_DEFINITIONS.filter(g=>g.enabled!==false&&!mapsFor(g.id).length)){
  const s=room(def.id);try{s.skip();ok(s.phase==='MINIGAME_INTRO'&&!s.mapVote,'single-map flow unchanged '+def.id);}finally{s.resetToLobby();}
}
ok(BACKROOM_MAPS.every(m=>LEVELS[m.id as keyof typeof LEVELS]?.name===m.name),'Backrooms catalogue matches actual levels');
ok(GOLF_MAPS.length===COURSES.length&&GOLF_MAPS.every(m=>COURSES.some(c=>c.id===m.id&&c.name===m.name)),'Minigolf catalogue matches every actual course');
for(const map of GOLF_MAPS)for(let seed=1;seed<=12;seed++){
  const rng=new Rng(seed),chosen=selectCourses(()=>rng.next(),undefined,map.id);
  ok(chosen.length===3&&chosen[0].id===map.id&&new Set(chosen.map(c=>c.id)).size===3,'voted opening hole, three distinct courses '+map.id);
}
writeFileSync('docs/agent-work/map-voting/session-checks.json',JSON.stringify({checks,passed:checks.length},null,2));
console.log(`PASS map voting: ${checks.length} session, catalogue and tournament checks.`);
