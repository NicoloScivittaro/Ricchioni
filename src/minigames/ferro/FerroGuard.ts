import type{GuardDirection}from'../../../shared/ferro/types';
/** Ferro 2.1 directional guard indicator: an inverted triangle whose three edges are TOP, LEFT and RIGHT.
 * States are told apart by shape and motion, not only colour: a guarded edge is thick and solid, an incoming
 * attack adds an inward chevron and pulses, the parry window fills a timing bar and flickers, a block flashes,
 * a parry bursts and a hit breaks the edge into dashes. */
export interface GuardView{guard:GuardDirection|null;incoming:{dir:GuardDirection;progress:number;heavy:boolean;window:boolean}|null;attacking?:GuardDirection|null}
export type GuardFlash='block'|'parry'|'hit'|'break';
const DIRS=['top','left','right']as const;
// Inverted equilateral triangle centred on its centroid (side 92).
const A=[-46,-26.6],B=[46,-26.6],C=[0,53.1],EDGES:Record<GuardDirection,[number[],number[]]>={top:[A,B],left:[A,C],right:[B,C]};
const NS='http://www.w3.org/2000/svg';
function edge(dir:GuardDirection){
 const[p,q]=EDGES[dir],cut=.13,a=[p[0]+(q[0]-p[0])*cut,p[1]+(q[1]-p[1])*cut],b=[q[0]-(q[0]-p[0])*cut,q[1]-(q[1]-p[1])*cut],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,len=Math.hypot(mx,my),nx=mx/len,ny=my/len,tx=-ny,ty=nx;
 // Chevron outside the edge pointing towards the centre: "the blow comes from here".
 const o=16,w=11,h=8,chevron=`M${mx+nx*(o+h)+tx*w} ${my+ny*(o+h)+ty*w} L${mx+nx*o} ${my+ny*o} L${mx+nx*(o+h)-tx*w} ${my+ny*(o+h)-ty*w}`;
 return{a,b,chevron};
}
export class GuardIndicator{
 readonly root:HTMLDivElement;private segs={} as Record<GuardDirection,{g:SVGGElement;timer:SVGLineElement}>;private state='';private progress:Record<GuardDirection,string>={top:'',left:'',right:''};
 constructor(kind:'me'|'foe'){
  this.root=document.createElement('div');this.root.className='ferro-guard '+kind;
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','-62 -46 124 112');svg.setAttribute('aria-hidden','true');
  const plate=document.createElementNS(NS,'path');plate.setAttribute('class','plate');plate.setAttribute('d',`M${A[0]*1.18} ${A[1]*1.18-2} L${B[0]*1.18} ${B[1]*1.18-2} L${C[0]} ${C[1]*1.14} Z`);svg.appendChild(plate);
  const burst=document.createElementNS(NS,'circle');burst.setAttribute('class','burst');burst.setAttribute('r','34');svg.appendChild(burst);
  for(const dir of DIRS){
   const{a,b,chevron}=edge(dir),g=document.createElementNS(NS,'g');g.setAttribute('class','seg');g.dataset.dir=dir;
   const line=(cls:string)=>{const l=document.createElementNS(NS,'line');l.setAttribute('class',cls);l.setAttribute('x1',String(a[0]));l.setAttribute('y1',String(a[1]));l.setAttribute('x2',String(b[0]));l.setAttribute('y2',String(b[1]));l.setAttribute('pathLength','1');g.appendChild(l);return l;};
   line('base');const timer=line('timer');line('crack');
   const arrow=document.createElementNS(NS,'path');arrow.setAttribute('class','arrow');arrow.setAttribute('d',chevron);g.appendChild(arrow);
   g.addEventListener('animationend',e=>{const t=e.target as Element;if(t===g||t.parentNode===g)g.classList.remove('flash-block','flash-parry','flash-hit','flash-break');});
   svg.appendChild(g);this.segs[dir]={g,timer};
  }
  const core=document.createElementNS(NS,'circle');core.setAttribute('class','core');core.setAttribute('r','4.5');svg.appendChild(core);
  svg.addEventListener('animationend',e=>{if((e.target as Element).classList.contains('burst'))this.root.classList.remove('bursting');});
  this.root.appendChild(svg);
 }
 /** Cheap per-frame update: DOM is touched only when a state actually changes. */
 set(view:GuardView):void{
  const parts:string[]=[];
  for(const dir of DIRS){
   const incoming=view.incoming?.dir===dir?view.incoming:null,guard=view.guard===dir,cls=[guard?'guard':'',incoming?'incoming':'',incoming&&guard?'covered':'',incoming?.heavy?'heavy':'',incoming?.window?'window':'',view.attacking===dir?'attacking':''].filter(Boolean).join(' ');
   parts.push(dir+':'+cls);const seg=this.segs[dir];
   if(seg.g.dataset.state!==cls){seg.g.dataset.state=cls;for(const c of ['guard','incoming','covered','heavy','window','attacking'])seg.g.classList.toggle(c,cls.split(' ').includes(c));}
   const offset=incoming?(1-Math.max(0,Math.min(1,incoming.progress))).toFixed(2):'1';if(this.progress[dir]!==offset){this.progress[dir]=offset;seg.timer.style.strokeDashoffset=offset;}
  }
  this.state=parts.join('|');
 }
 flash(dir:GuardDirection,kind:GuardFlash):void{
  const g=this.segs[dir].g;g.classList.remove('flash-block','flash-parry','flash-hit','flash-break');void g.getBoundingClientRect();g.classList.add('flash-'+kind);
  if(kind==='parry'||kind==='block'){this.root.classList.remove('bursting','parry-burst');void this.root.offsetWidth;this.root.classList.add('bursting');this.root.classList.toggle('parry-burst',kind==='parry');}
 }
 place(x:number,y:number,visible:boolean):void{this.root.style.display=visible?'':'none';if(visible)this.root.style.transform=`translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;}
 debug():string{return this.state;}
}
