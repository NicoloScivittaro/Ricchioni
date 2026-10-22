import{audio}from'../../core/AudioManager';
import type{FerroEvent,FerroState}from'../../../shared/ferro/types';
import{splitScreenLayout}from'../../core/playerViews';
import{contactMaterial}from'../../../shared/ferro/clash';
import type{WeaponId}from'../../../shared/ferro/types';
export class FerroAudio{
 private voices=new Set<AudioScheduledSourceNode>();private nodes=new Map<AudioScheduledSourceNode,AudioNode[]>();private paused=false;private disposed=false;private noise:AudioBuffer|null=null;private lastDraw=new Map<string,boolean>();private lastEvent=0;
 constructor(private ids:string[]){}
 private sound(freq:number,end:number,duration:number,gain:number,pan:number,noise=false,delay=0):void{
  const c=audio.getContext(),output=audio.getOutput('sfx');if(this.paused||this.disposed||!c||!output||c.state!=='running'||this.voices.size>=20)return;
  if(!this.noise){this.noise=c.createBuffer(1,c.sampleRate/2,c.sampleRate);const data=this.noise.getChannelData(0);let seed=8241;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}}
  const source=noise?c.createBufferSource():c.createOscillator(),filter=c.createBiquadFilter(),volume=c.createGain(),stereo=c.createStereoPanner(),t=c.currentTime+delay;
  filter.type=noise?'bandpass':'lowpass';filter.Q.value=noise?.7:1;filter.frequency.setValueAtTime(noise?freq:3500,t);if(noise)filter.frequency.exponentialRampToValueAtTime(Math.max(60,end),t+duration);
  if(source instanceof OscillatorNode){source.type=freq<180?'triangle':'sine';source.frequency.setValueAtTime(freq,t);source.frequency.exponentialRampToValueAtTime(Math.max(25,end),t+duration);}else{source.buffer=this.noise;source.loop=true;}
  volume.gain.setValueAtTime(.0001,t);volume.gain.linearRampToValueAtTime(gain,t+.006);volume.gain.exponentialRampToValueAtTime(.0001,t+duration);stereo.pan.value=pan;source.connect(filter);filter.connect(volume);volume.connect(stereo);stereo.connect(output);this.voices.add(source);this.nodes.set(source,[filter,volume,stereo]);source.onended=()=>{source.disconnect();this.nodes.get(source)?.forEach(n=>n.disconnect());this.nodes.delete(source);this.voices.delete(source);};source.start(t);source.stop(t+duration+.02);
 }
 /** Struck bar: inharmonic partials with their own decays, the ear reads it as metal rather than a beep. */
 private metal(base:number,decay:number,gain:number,pan:number,delay=0):void{
  [[1,1,1],[2.76,.5,.7],[5.4,.28,.45],[8.93,.14,.3]].forEach(([ratio,level,length],i)=>this.sound(base*ratio,base*ratio*(1-.004*(i+1)),decay*length,gain*level,pan,false,delay));
 }
 /** Weapon contact sounds by material pair. Steel rings, shields thud, hafts knock, hammers boom; parry is its own. */
 private contact(kind:'block'|'parry'|'break',attacker:WeaponId,defender:WeaponId,heavy:boolean,gain:number,pan:number):void{
  const material=contactMaterial(defender);
  if(kind==='parry'){this.metal(attacker==='hammer'?1500:attacker==='axe'?1750:2100,.62,.11*gain,pan);this.sound(2400,6200,.17,.07*gain,pan,true);this.sound(230,85,.12,.13*gain,pan);return;}
  if(kind==='break'){this.sound(620,140,.24,.12*gain,pan,true);this.sound(95,42,.3,.15*gain,pan);this.metal(700,.18,.05*gain,pan);return;}
  if(material==='shield'){this.sound(attacker==='hammer'?120:175,55,.22,.17*gain,pan);this.sound(950,230,.1,.1*gain,pan,true);this.metal(760,.14,.035*gain,pan,.004);if(attacker==='hammer')this.sound(70,36,.4,.15*gain,pan);return;}
  if(material==='haft'){this.sound(1150,380,.07,.1*gain,pan,true);this.sound(3200,1300,.17,.05*gain,pan,true,.02);this.metal(1500,.16,.05*gain,pan);return;}
  const base=attacker==='hammer'?540:attacker==='axe'?900:attacker==='blades'?1950:attacker==='spear'?1600:1350;
  this.metal(base,attacker==='hammer'||attacker==='axe'?.26:.36,.085*gain,pan);this.sound(4600,1700,.05,.08*gain,pan,true);if(heavy||attacker==='hammer'||attacker==='axe')this.sound(160,62,.14,.12*gain,pan);
 }
 update(s:FerroState,events:FerroEvent[]):void{
  if(this.paused||this.disposed)return;const humans=s.warriors.filter(p=>this.ids.includes(p.id)),rects=splitScreenLayout(humans.length);
  for(const p of humans){const drawing=p.weapon==='bow'&&p.charge>.03;if(drawing&&!this.lastDraw.get(p.id))this.sound(160,480,.36,.035,0);this.lastDraw.set(p.id,drawing);}
  for(const e of events){
   const actor=s.warriors.find(p=>p.id===e.player),x=e.x??actor?.x??0,z=e.z??actor?.z??0,nearest=humans.map((p,i)=>({p,i,d:Math.hypot(p.x-x,p.z-z)})).sort((a,b)=>a.d-b.d)[0];if(!nearest)continue;
   const rect=rects[nearest.i],pan=Math.max(-.85,Math.min(.85,(rect.x+rect.w/2-.5)*1.3+Math.sin(Math.atan2(x-nearest.p.x,z-nearest.p.z)-nearest.p.yaw)*.3)),gain=Math.max(.12,1-nearest.d/23),w=e.weapon??actor?.weapon;
   if(e.kind==='win'){this.sound(330,330,.23,.11,0);this.sound(440,440,.25,.10,0,false,.16);this.sound(660,660,.35,.10,0,false,.32);continue;}
   const defender=s.warriors.find(p=>p.id===e.player)?.weapon??'sword';
   if(e.kind==='parry'){this.contact('parry',w??'sword',defender,!!e.heavy,gain,pan);continue;}
   if(e.kind==='counter'){this.sound(1300,650,.12,.12*gain,pan);continue;}
   if(e.kind==='guardBreak'){this.sound(120,60,.15,.09*gain,pan,true);continue;}
   if(e.kind==='feint'){this.sound(1600,600,.06,.035*gain,pan,true);continue;}
   if(e.kind==='block'){this.contact('block',w??'sword',defender,!!e.heavy,gain,pan);continue;}
   if(e.kind==='break'){this.contact('break',w??'sword',defender,!!e.heavy,gain,pan);continue;}
   if(e.kind==='hit'&&s.warriors.find(p=>p.id===e.target)?.clash?.kind==='block')continue; // the clang already tells it
   if(e.kind==='hit'){this.sound(w==='hammer'?75:w==='axe'?115:190,48,.15,.12*gain,pan);this.sound(1400,300,.08,.08*gain,pan,true);continue;}
   if(e.kind==='arrow'){this.sound(820,210,.11,.10*gain,pan);this.sound(2400,700,.09,.06*gain,pan,true);continue;}
   if(e.kind==='arrowImpact'){this.sound(360,120,.08,.07*gain,pan);continue;}
   if(e.kind!=='attack'&&e.kind!=='special')continue;if(s.time-this.lastEvent<.018&&this.voices.size>8)continue;this.lastEvent=s.time;
   if(w==='hammer'){this.sound(75,44,.3,.11*gain,pan);this.sound(900,170,.28,.1*gain,pan,true);}
   else if(w==='axe'){this.sound(180,70,.18,.08*gain,pan);this.sound(1300,230,.18,.1*gain,pan,true);}
   else if(w==='blades'){this.sound(2600,900,.055,.08*gain,pan,true);this.sound(3200,1200,.055,.06*gain,pan,true,.07);}
   else if(w==='spear'){this.sound(1700,400,.1,.08*gain,pan,true);this.sound(440,220,.07,.04*gain,pan);}
   else if(w==='shield'){this.sound(380,160,.14,.08*gain,pan);this.sound(2100,600,.08,.07*gain,pan,true);}
   else{this.sound(2500,600,.09,.09*gain,pan,true);this.sound(780,350,.08,.035*gain,pan);}
  }
 }
 setPaused(value:boolean):void{this.paused=value;if(value)for(const source of this.voices){try{source.stop();}catch{}}}
 dispose():void{this.disposed=true;this.setPaused(true);for(const nodes of this.nodes.values())nodes.forEach(n=>n.disconnect());this.nodes.clear();this.voices.clear();this.noise=null;}
}
