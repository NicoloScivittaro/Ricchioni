import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {BackroomsMatch} from '../src/minigames/backrooms/backroomsRules';
const m=new BackroomsMatch([{id:'p',name:'Niko'}],92,{monsters:[]}),p=m.players[0];m.intro=0;
const command={x:1,z:0,lookX:0,lookY:0,sprint:true,interact:false};
m.command(p.id,command);for(let i=0;i<234;i++)m.advance(1/60);assert.ok(p.stamina<.03);for(let i=0;i<10;i++)m.advance(1/60);assert.equal(p.exhausted,true);assert.equal(p.running,false);
m.command(p.id,{...command,sprint:false});for(let i=0;i<95;i++)m.advance(1/60);assert.ok(p.stamina>=.3);m.command(p.id,command);m.advance(1/60);assert.equal(p.running,true);
writeFileSync('docs/agent-work/ferro-furia/stamina.json',JSON.stringify({status:'passed',sprintSeconds:4,previousSeconds:7,recoverySeconds:5,restartThreshold:.3,exhaustionLatch:true},null,2));console.log('Backrooms: sprint 4s, fatigue latch and recovery verified.');
