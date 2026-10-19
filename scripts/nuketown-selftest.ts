import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {NuketownArena} from '../src/minigames/fps/nuketownArena';
import {mapsFor} from '../shared/minigameMaps';
import {FPS_MAP,rayVsAabb} from '../shared/fpsMap';
import {NuketownBots} from '../src/minigames/fps/NuketownBots';
import {InputManager} from '../src/network/InputManager';
import type {MinigameContext} from '../src/minigames/types';
import {FpsAbilities} from '../src/minigames/fps/fpsAbilities';
import {WEAPONS} from '../shared/fpsWeapons';

const arena=new NuketownArena();
assert.equal(arena.spawns.length,16);assert.ok(arena.nav.length>3000);
assert.ok(arena.spawns.every(s=>arena.isClear(s.x,s.z)&&arena.floorAt(s.x,s.z)!==null));
assert.equal(new Set(arena.spawns.map(s=>`${s.x}:${s.z}`)).size,16);
assert.deepEqual(mapsFor('fps').map(m=>m.id),['cantiere','nuketown']);
assert.equal(FPS_MAP.obstacles.length,19);assert.equal(FPS_MAP.spawns.length,5);
// Existing slab rays still start at zero unless an explicit base is supplied.
assert.equal(rayVsAabb(0,1.5,-10,0,0,1,FPS_MAP.obstacles[4]),7.5);
const open={x:-12,z:-30,y:arena.floorAt(-12,-30)??0};
assert.ok(arena.visible(open,{...open,z:-28}));
// Actual house wall at x=-5.15, z=-17; doorway at z=-11.6 remains open.
const wall={from:{x:-6.5,z:-16,y:.245},to:{x:-3.5,z:-16,y:.245}};
assert.equal(arena.visible(wall.from,wall.to),false);
const movement=arena.move(wall.from,wall.to);assert.ok(movement.x<-5.3);
assert.equal(arena.blastVisible({x:-6.5,y:1,z:-16},wall.to),false);
// Sweep dash/shove distance across a thin visible perimeter barrier.
const edge=arena.move({x:-15,z:0},{x:-25,z:0});assert.ok(edge.x>-17);
const path=arena.nextWaypoint(arena.spawns[0],arena.spawns[10]);assert.ok(arena.canTraverse(arena.spawns[0],path));
assert.ok(arena.ray(-5,1.5,-6,0,0,1,10)<2); // Solid bus body.
assert.ok(arena.ray(-5,1.5,0,0,0,1,6)<1.1); // Solid truck side.
const input=new InputManager(),bots=new NuketownBots({input,players:[{id:'bot',bot:true}]}as unknown as MinigameContext);
const bot={...open,id:'bot',alive:true,yaw:0,magazine:30,spawnProtection:0,weaponId:'mitraglia'};
const enemy={...bot,id:'enemy',z:-27};bots.step(.5,[bot,enemy],arena);
const memory=(bots as unknown as{memory:Map<string,{point:{x:number;z:number}}>}).memory;
assert.equal(memory.get('bot')?.point.z,-27);
Object.assign(bot,wall.from,{yaw:Math.PI/2});Object.assign(enemy,wall.to);
bots.step(.2,[bot,enemy],arena);assert.equal(memory.get('bot')?.point.z,-27);
bots.step(2.1,[bot,enemy],arena);assert.equal(memory.has('bot'),false);
const judoka={...bot,x:-12,z:-30,yaw:0,characterId:'judoka',abCd:0,spawnProtection:1.5};
const victim={...enemy,x:-12,z:-28,spawnProtection:0,lockTime:0,stunTime:0};
const ab=new FpsAbilities();
assert.equal(ab.onAbilityPress(judoka as never,WEAPONS[0],[victim]as never,()=>{},{visible:(a,b)=>arena.visible(a,b),move:(a,b)=>arena.move(a,b)}),'ok');
assert.equal(judoka.spawnProtection,0);
const report={checks:15,vehicleCover:true,finiteBotMemory:true,offensiveAbilityEndsProtection:true,spawnCount:arena.spawns.length,connectedNavCells:arena.nav.length,movementBoxes:arena.obstacles.length,wall,movement,edge,path,arenaMaps:mapsFor('fps').map(m=>m.id)};
writeFileSync('docs/agent-work/nuketown/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
