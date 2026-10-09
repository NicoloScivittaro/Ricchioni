import assert from 'node:assert/strict';
import { importedVisualSelection } from '../src/minigames/characters/importedVisualSelection';
import { GoblinAnimator } from '../src/minigames/characters/goblinAnimator';
import goblin from '../src/minigames/characters/goblinClips.json';
import boschi from '../src/minigames/characters/buttafuoriClips.json';
import carbo from '../src/minigames/characters/judokaClips.json';
import ciro from '../src/minigames/characters/ciroClips.json';
const store=new Map<string,string>(),locationMock={search:''};
Object.defineProperty(globalThis,'location',{value:locationMock,configurable:true});
Object.defineProperty(globalThis,'sessionStorage',{value:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)},configurable:true});
let checks=0;
function check(v:boolean,msg:string):void { assert.ok(v,msg);checks++; }
const base={speedFrac:0,alive:true,falling:false,dashing:false,stunned:false,grounded:true};
for(const [ns,clips] of [['goblin',goblin],['buttafuori',boschi],['judoka',carbo],['ciro',ciro]] as const) {
 locationMock.search='';store.set(`ricchioni.${ns}Visual`,'old');const selection=importedVisualSelection(ns);
 check(selection.mode()==='new',`${ns}: stored OLD cannot affect normal match`);
 selection.set('old');check(selection.mode()==='new',`${ns}: Gallery runtime choice cannot affect normal match`);
 locationMock.search='?debug=1';check(selection.mode()==='old',`${ns}: debug comparison still honors runtime selection`);
 selection.set('new');check(selection.mode()==='new',`${ns}: Gallery can return to NEW`);
 const fresh=importedVisualSelection(ns);locationMock.search=`?debug=1&${ns}=old`;
 check(fresh.mode()==='old',`${ns}: explicit debug OLD remains available`);
 locationMock.search='';check(fresh.mode()==='new',`${ns}: match restored to Tripo`);
 const animator=new GoblinAnimator(clips,ns),kick=clips.find(c=>c.name===`${ns}.frontKick`)!;
 for(const charge of [.25,.75,1]) {
  const state=Object.freeze({...base,charge}),before=JSON.stringify(state),sample=animator.update(.016,state);
  check(sample.name===kick.name&&sample.priority===20&&sample.speed===0,`${ns}: stable native wind-up`);
  check(Math.abs(sample.seconds-(kick.from+(kick.contact!-kick.from)*charge))<1e-7,`${ns}: wind-up follows charge`);
  check(before===JSON.stringify(state),`${ns}: visual state read only`);
 }
 animator.playAction('goblin.frontKick',.36,true);
 const release=animator.update(0,{...base,charge:0});
 check(release.seconds===kick.contact&&release.contactTime===0,`${ns}: foot at contact in existing kick event`);
 animator.playHitReaction('body');
 check(animator.update(.016,{...base,charge:1}).priority===80,`${ns}: hit reaction overrides charge`);
 check(animator.update(.016,{...base,charge:1,alive:false}).priority===100,`${ns}: KO overrides charge`);
}
console.log(`Tripo render selection and sports: ${checks} checks passed`);
