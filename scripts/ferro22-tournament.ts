// Ferro 2.2: bot-vs-bot round robin. Each pair plays N duels (sides swapped); prints the win-rate matrix.
import{FerroMatch}from'../shared/ferro/match';
import{FerroBots}from'../shared/ferro/bots';
import{WEAPONS}from'../shared/ferro/weapons';
import type{WeaponId}from'../shared/ferro/types';
const N=Number(process.env.N??24),ids=WEAPONS.map(w=>w.id) as WeaponId[],bots=new FerroBots();
function duel(a:WeaponId,b:WeaponId,k:number):number{
 const m=new FerroMatch([{id:`a${k}`,name:'A',color:'#fff',bot:true},{id:`b${k}`,name:'B',color:'#fff',bot:true}]);const s=m.state,[x,y]=s.warriors;s.phase='fight';s.fightTime=0;s.roundSeconds=60;
 Object.assign(x,{weapon:a,x:0,z:-4,yaw:0});Object.assign(y,{weapon:b,x:0,z:4,yaw:Math.PI});
 for(let i=0;i<120*60&&s.phase==='fight';i++)m.step(1/120,p=>bots.read(p,s,1/120));
 return x.hp===y.hp?.5:x.hp>y.hp?1:0;
}
const wins:Record<string,number[]>={};for(const a of ids)wins[a]=ids.map(()=>NaN);
// Every unordered pair once (sides swapped each duel), so the matrix is exactly antisymmetric.
for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){let w=0;for(let k=0;k<N;k++)w+=k%2?1-duel(ids[j],ids[i],k*97+i*7+j):duel(ids[i],ids[j],k*97+i*7+j);wins[ids[i]][j]=w/N;wins[ids[j]][i]=1-w/N;}
console.log('att\vs '.padEnd(8)+ids.map(i=>i.padStart(7)).join('')+'   avg');
for(const a of ids){const row=wins[a],avg=row.filter(Number.isFinite).reduce((s,v)=>s+v,0)/(ids.length-1);console.log(a.padEnd(8)+row.map(v=>Number.isFinite(v)?(v*100).toFixed(0).padStart(6)+'%':'     - ').join('')+'  '+(avg*100).toFixed(0)+'%');}
