import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {OrdaMatch,ARCHETYPES} from '../shared/orda/match';
import {WARROK} from '../shared/orda/warrok';
import {COVERS} from '../shared/orda/arena';
import {ORDA_WEAPONS} from '../shared/orda/match';
import {EMPTY_INPUT} from '../shared/orda/types';
const checks:string[]=[];
const participants=Array.from({length:5},(_,i)=>({id:'p'+i,name:'P'+i,color:'#ababab'}));
function fixture(){const m=new OrdaMatch(participants);m.state.phase='fighting';m.state.pending=1;(m as any).spawn();m.state.pending=0;const e=m.state.enemies[0];Object.assign(e,{...ARCHETYPES.warrok,kind:'warrok',maxHp:540,x:0,z:-10,y:0,yaw:0,target:'p0',memory:{x:0,z:-8.5},action:'punch',actionAt:0,roared:true,think:100,nav:100,attack:100});const p=m.state.players[0];Object.assign(p,{x:0,z:-8.5,y:0});return{m,e,p};}
function step(m:OrdaMatch,seconds:number){for(let i=0;i<Math.ceil(seconds*30);i++)m.step(1/30,()=>EMPTY_INPUT);}
function check(name:string,fn:()=>void){fn();checks.push(name);}
check('Punch: preparation, single impact and recovery; animation timeline authoritative',()=>{const {m,e,p}=fixture();step(m,.25);assert.equal(p.hp,100);step(m,.1);assert.equal(p.hp,70);step(m,.6);assert.equal(p.hp,70);assert.equal(e.action,'punch');step(m,.2);assert.equal(e.action,'walk');assert.ok(e.attack>0);});
check('Punch evaded behind, airborne, out of reach or behind cover',()=>{for(const mode of ['behind','air','range','wall']){const {m,e,p}=fixture();if(mode==='behind')e.yaw=Math.PI;if(mode==='range')p.z=-7;if(mode==='air'){p.y=3;p.vy=8;}if(mode==='wall')COVERS.push({x:0,z:-9.25,w:2,d:.2,h:3,kind:'wall'});try{step(m,.9);assert.equal(p.hp,100,mode);}finally{if(mode==='wall')COVERS.pop();}}});
check('All six weapons can damage Warrok; lethal hit counted once and corpse retained',()=>{const {m,e,p}=fixture();const before=p.kills;(m as any).hurtEnemy(e,99999,p);assert.equal(e.action,'dead');assert.equal(p.kills,before+1);(m as any).hurtEnemy(e,10,p);assert.equal(p.kills,before+1);step(m,1);assert.ok(m.state.enemies.includes(e));assert.equal(p.hp,100);step(m,WARROK.death);assert.ok(!m.state.enemies.includes(e));});
check('Existing six ballistic paths hit the actual Warrok hitbox',()=>{for(const weapon of ORDA_WEAPONS){const {m,e,p}=fixture();p.weapon=weapon.id;p.yaw=Math.PI;p.pitch=0;p.ammo=100;p.reload=0;(m as any).fire(p);for(let i=0;i<15;i++)(m as any).projectiles(1/30);assert.ok(e.hp<540,weapon.id);}});
check('Advanced waves only, maximum two living Warroks; corpse does not block wave',()=>{const m=new OrdaMatch(participants);m.state.phase='fighting';m.state.wave=1;for(let i=0;i<10;i++){m.state.pending=7;(m as any).spawn();}assert.ok(m.state.enemies.every(e=>e.kind!=='warrok'));m.state.wave=6;m.state.enemies=[];for(let i=0;i<10;i++){m.state.pending=7;(m as any).spawn();}assert.equal(m.state.enemies.filter(e=>e.kind==='warrok').length,2);for(const e of m.state.enemies)(m as any).hurtEnemy(e,999999,m.state.players[0]);m.state.pending=0;m.step(1/30);assert.equal(m.state.phase,'intermission');assert.ok(m.state.enemies.length>0);});
check('Jump cannot cross cover; death stops AI and offense immediately',()=>{const {m,e,p}=fixture();e.action='jump';e.actionAt=0;e.x=-14;e.z=-6;e.yaw=Math.PI/2;p.x=-8;p.z=-6;step(m,.7);assert.ok(e.x<=-13.5);(m as any).hurtEnemy(e,999999,p);const x=e.x,z=e.z;step(m,.7);assert.equal(e.x,x);assert.equal(e.z,z);assert.equal(p.hp,100);});
writeFileSync('docs/agent-work/monster-system/logic-tests.json',JSON.stringify({status:'passed',checks},null,2));console.log('PASS',checks.length,'targeted checks');
