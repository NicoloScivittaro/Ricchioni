import type {Course,Floor,Point,Wall} from './minigolfTypes';
import {GOLF_TOURNAMENT} from '../../../shared/minigolfTournament';
const floor=(x:number,z:number,w:number,d:number,y=0,extra:Partial<Floor>={}):Floor=>({x,z,w,d,y,...extra});
const wall=(x:number,z:number,xx:number,zz:number,y=0):Wall=>({a:{x,z},b:{x:xx,z:zz},y,radius:.18});
const rim=(w:number,d:number):Wall[]=>[wall(-w,-d,w,-d),wall(-w,d,w,d),wall(-w,-d,-w,d),wall(w,-d,w,d)];
/** Single-screen holes (28 m). They are no longer played alone: long courses chain 2–3 of them. */
export const SECTIONS: readonly Course[] = [
 {id:'corridoio',name:'IL CORRIDOIO MALEDETTO',difficulty:'easy',par:4,maxStrokes:5,color:'#42bd82',tip:'Dosala. Usa le sponde, oppure rischia il passaggio stretto a sinistra.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,
  floors:[floor(0,0,22,28)],walls:[...rim(11,14),wall(-11,5,3,5),wall(-3,-3,11,-3)],
  bumpers:[{x:3,z:0,y:0,radius:.75,power:2}],waypoints:[{x:5,z:7},{x:5,z:2},{x:-5,z:0},{x:-5,z:-6},{x:0,z:-11}]},
 {id:'rotonda',name:'LA ROTONDA DEL DISAGIO',difficulty:'medium',par:4,maxStrokes:6,color:'#35b9ad',tip:'Due bracci, un tempismo. Puoi passare fuori o prendere la spinta.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,floors:[floor(0,0,22,28)],
  walls:[...rim(11,14),... [0,Math.PI/2].map(phase=>({...wall(-6,0,6,0),rotation:{center:{x:0,z:0},speed:.65,phase}}))],
  bumpers:[],waypoints:[{x:7,z:4},{x:8,z:-4},{x:0,z:-11}]},
 {id:'ponte',name:'IL PONTE DEL LITORALE',difficulty:'medium',par:4,maxStrokes:6,color:'#52bfa3',tip:'Bordi senza parapetto. Il ponte scorre: aspetta il passaggio.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,
  floors:[floor(0,10,12,8),floor(-3,2,3.2,10,.35,{slopeZ:-.07}),floor(-3,-4,4,4,0,{motion:{axis:'x',amplitude:.8,speed:.7}}),floor(0,-10,12,8)],
  walls:[wall(-6,14,6,14)],bumpers:[],waypoints:[{x:-3,z:7},{x:-3,z:1},{x:-3,z:-5},{x:0,z:-11}]},
 {id:'flipper',name:'IL FLIPPER DEI COGLIONI',difficulty:'medium',par:4,maxStrokes:6,color:'#707fcb',tip:'I bumper spingono sempre allo stesso modo. Cerca una sponda buona.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,floors:[floor(0,0,20,28),floor(0,4,8,3,.015,{surface:'ice'}),floor(0,-7,10,2,.015,{surface:'sand'})],
  walls:rim(10,14),bumpers:[[-4,4],[3,3],[0,-1],[-5,-4],[5,-5]].map(([x,z])=>({x,z,y:0,radius:1,power:4.5})),
  waypoints:[{x:6,z:6},{x:7,z:-1},{x:2,z:-8},{x:0,z:-11}]},
 {id:'discesa',name:'LA DISCESA INFAME',difficulty:'hard',par:5,maxStrokes:6,color:'#69a56a',tip:'La pendenza fa il lavoro. Frena prima della curva e gira a sinistra.',
  spawn:{x:0,z:11},hole:{x:5,z:-11},holeY:0,
  floors:[floor(0,10,12,8,3),floor(0,1,6,10,1.75,{slopeZ:.25}),floor(3,-5,12,4,.25,{surface:'sand'}),floor(5,-10,4,8,0)],
  walls:[wall(-6,14,6,14,3),wall(-3,-7,3,-7,.25),wall(7,-7,9,-7,.25)],bumpers:[{x:-1,z:-4.5,y:.25,radius:.65,power:1}],
  waypoints:[{x:0,z:7},{x:0,z:0},{x:1,z:-4.5},{x:5,z:-5},{x:5,z:-11}]},
 {id:'ultima',name:"L'ULTIMA BUCA",difficulty:'hard',par:5,maxStrokes:6,color:'#b299ce',tip:'A sinistra la strada sicura. La rampa centrale è una scommessa!',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,
  floors:[floor(0,10,14,8),floor(-5,0,4,20),floor(0,5,3,6,.75,{slopeZ:-.25}),
   floor(0,-4,4,4,.2,{motion:{axis:'x',amplitude:1.2,speed:.6}}),floor(0,-10,14,8)],
  walls:[wall(-7,14,7,14),wall(-7,7,-7,-10),wall(-3,5,-3,-5)],
   bumpers:[{x:-5,z:-2,y:0,radius:.6,power:1.8}],waypoints:[{x:-5,z:8},{x:-6,z:1},{x:-6,z:-4.5},{x:-5,z:-6},{x:-3,z:-10},{x:0,z:-11}]},
 {id:'prato',name:'IL PRATO TRANQUILLO',difficulty:'easy',par:3,maxStrokes:12,color:'#74b848',tip:'Un tiro lungo, poi un putt dosato. Le isole di sabbia frenano.',
  spawn:{x:0,z:11},hole:{x:3,z:-10},holeY:0,floors:[floor(0,0,18,28),floor(-4,-1,4,4,.015,{surface:'sand'}),floor(4,4,3,3,.015,{surface:'sand'})],
  walls:[...rim(9,14),wall(-7,-6,-3,-6)],bumpers:[],waypoints:[{x:1,z:0},{x:3,z:-10}]},
 {id:'saliscendi',name:'LE MONTAGNE DEL DISAGIO',difficulty:'medium',par:4,maxStrokes:12,color:'#c09b62',tip:'Sali con forza e dosa la discesa. La cima piatta è un checkpoint.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,
  floors:[floor(0,11,12,6),floor(0,5,6,6,.3,{slopeZ:-.1}),floor(0,0,6,4,.6),floor(0,-5,6,6,.3,{slopeZ:.1}),floor(0,-11,12,6)],
  walls:[wall(-6,14,6,14),wall(-3,8,-3,-8),wall(3,8,3,-8)],bumpers:[],waypoints:[{x:0,z:8},{x:0,z:0},{x:0,z:-8},{x:0,z:-11}]},
 {id:'cancelli',name:'I CANCELLI IMPAZZITI',difficulty:'medium',par:4,maxStrokes:12,color:'#58a8c0',tip:'Due cancelli con cadenze fisse. Passa dal lato libero o aspetta.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,floors:[floor(0,0,16,28)],
  walls:[...rim(8,14),... [{x:-2,z:4,s:.45,phase:0},{x:2,z:-4,s:-.55,phase:Math.PI/2}].map(p=>({...wall(p.x-4,p.z,p.x+4,p.z),rotation:{center:{x:p.x,z:p.z},speed:p.s,phase:p.phase}}))],
  bumpers:[],waypoints:[{x:6,z:6},{x:6,z:1},{x:-6,z:-2},{x:-6,z:-7},{x:0,z:-11}]},
 {id:'serpentina',name:'LA SERPENTINA SUL MARE',difficulty:'hard',par:5,maxStrokes:12,color:'#9981c5',tip:'Tre curve senza parapetti. Scegli le soste larghe, non tagliare sul mare.',
  spawn:{x:0,z:11},hole:{x:3,z:-11},holeY:0,
  floors:[floor(0,11,12,6),floor(4,6,4,8),floor(0,2,12,4),floor(-4,-2,4,8),floor(0,-6,12,4),floor(3,-10,4,8)],
  walls:[wall(-6,14,6,14)],bumpers:[],waypoints:[{x:4,z:10},{x:4,z:2},{x:-4,z:2},{x:-4,z:-6},{x:3,z:-6},{x:3,z:-11}]}
].map(c=>({...c,maxStrokes:GOLF_TOURNAMENT.maxStrokes})) as Course[];
const SECTION_LENGTH=28;
const shift=(p:Point,dz:number):Point=>({x:p.x,z:p.z+dz});
/** X span where the floors of two adjacent sections meet on the shared edge. */
function junctionGap(upper:Floor[],lower:Floor[],z:number):[number,number] {
 const touching=(fs:Floor[],edge:(f:Floor)=>number)=>fs.filter(f=>!f.motion&&Math.abs(edge(f)-z)<1e-6);
 const span=(fs:Floor[])=>[Math.min(...fs.map(f=>f.x-f.w/2)),Math.max(...fs.map(f=>f.x+f.w/2))];
 const [a0,a1]=span(touching(upper,f=>f.z-f.d/2)),[b0,b1]=span(touching(lower,f=>f.z+f.d/2));
 const lo=Math.max(a0,b0),hi=Math.min(a1,b1);
 if(!(hi-lo>1.5))throw new Error(`Minigolf: giunzione troppo stretta a z=${z}`);
 return [lo,hi];
}
/** A rail lying on the junction keeps its stretches beside the gap, never across it. */
function openGap(walls:Wall[],z:number,[lo,hi]:[number,number]):Wall[] {
 return walls.flatMap(w=>{
  if(w.rotation||Math.abs(w.a.z-z)>1e-6||Math.abs(w.b.z-z)>1e-6)return [w];
  const x0=Math.min(w.a.x,w.b.x),x1=Math.max(w.a.x,w.b.x),parts:Wall[]=[];
  if(lo-x0>.3)parts.push({...w,a:{x:x0,z},b:{x:Math.min(lo,x1),z}});
  if(x1-hi>.3)parts.push({...w,a:{x:Math.max(hi,x0),z},b:{x:x1,z}});
  return parts;
 });
}
/**
 * Chains sections from the tee (+z) to the cup (−z). Heights are matched so each section starts
 * where the previous ended; intermediate cups disappear and the bot route passes through each gap.
 */
function chain(id:string,name:string,difficulty:Course['difficulty'],color:string,tip:string,ids:string[]):Course {
 const parts=ids.map(k=>{const c=SECTIONS.find(c=>c.id===k);if(!c)throw new Error(`Minigolf: sezione ${k} mancante`);return c;});
 const n=parts.length,dz=parts.map((_,i)=>SECTION_LENGTH*((n-1)/2-i));
 const lift=new Array<number>(n).fill(0);
 for(let i=n-2;i>=0;i--){const next=parts[i+1],start=heightAt(supportAt(next,next.spawn,0)!,next.spawn);lift[i]=lift[i+1]+start-parts[i].holeY;}
 const moved=parts.map((c,i)=>({
  floors:c.floors.map(f=>({...f,z:f.z+dz[i],y:f.y+lift[i]})),
  walls:c.walls.map(w=>({...w,a:shift(w.a,dz[i]),b:shift(w.b,dz[i]),y:w.y+lift[i],...(w.rotation?{rotation:{...w.rotation,center:shift(w.rotation.center,dz[i])}}:{})})),
  bumpers:c.bumpers.map(b=>({...b,z:b.z+dz[i],y:b.y+lift[i]})),
  waypoints:c.waypoints.map(p=>shift(p,dz[i]))
 }));
 const waypoints:Point[]=[...moved[0].waypoints];
 for(let i=0;i<n-1;i++){
  const z=dz[i]-SECTION_LENGTH/2,gap=junctionGap(moved[i].floors,moved[i+1].floors,z);
  moved[i].walls=openGap(moved[i].walls,z,gap);moved[i+1].walls=openGap(moved[i+1].walls,z,gap);
  // Wide junctions get a central divider: no straight tee-to-cup line, two side passages instead.
  const mid=(gap[0]+gap[1])/2,divided=gap[1]-gap[0]>=6,y=Math.min(...moved[i].floors.filter(f=>Math.abs(f.z-f.d/2-z)<1e-6).map(f=>f.y));
  if(divided)moved[i].walls.push({a:{x:mid-1.4,z},b:{x:mid+1.4,z},y,radius:.18});
  const pass=divided?(i%2?(mid+1.4+gap[1])/2:(gap[0]+mid-1.4)/2):mid;
  waypoints.push({x:pass,z:z+1.2},{x:pass,z},{x:pass,z:z-1.2},...moved[i+1].waypoints);
 }
 const last=parts[n-1];
 return {id,name,difficulty,color,tip,par:parts.reduce((a,c)=>a+c.par,0)-(n-1),maxStrokes:GOLF_TOURNAMENT.maxStrokes,
  spawn:shift(parts[0].spawn,dz[0]),hole:shift(last.hole,dz[n-1]),holeY:last.holeY+lift[n-1],
  floors:moved.flatMap(m=>m.floors),walls:moved.flatMap(m=>m.walls),bumpers:moved.flatMap(m=>m.bumpers),waypoints};
}
/** Tournament holes: two or three sections each, 56–84 m from tee to cup. */
export const COURSES: readonly Course[] = [
 chain('lungomare','IL LUNGOMARE INFINITO','easy','#74b848','Lungo e largo: un tiro forte nel prato, poi scegli la sponda nel corridoio.',['prato','corridoio']),
 chain('scampagnata','LA SCAMPAGNATA','easy','#8bbf55','Prato tranquillo, poi le montagne: non sottovalutare la salita.',['prato','saliscendi']),
 chain('giostra','LA GIOSTRA DEI DANNATI','medium','#35b9ad','Prima i bracci rotanti, poi i cancelli: il tempismo conta due volte.',['rotonda','cancelli']),
 chain('flipperone','IL FLIPPERONE','medium','#707fcb','I bumper ti sparano verso le montagne. Frena prima della salita.',['flipper','saliscendi']),
 chain('traversata','LA TRAVERSATA','medium','#58a8c0','Cancelli, ponte mobile e corridoio finale. Tre pezzi, nessuna fretta.',['cancelli','ponte','corridoio']),
 chain('altalena','SU E GIÙ PER LA ROTONDA','medium','#c09b62','Dopo le montagne la rotonda gira: aspetta il varco giusto.',['saliscendi','rotonda']),
 chain('maratona','LA MARATONA DEL DISAGIO','medium','#42bd82','Tre sezioni larghe: corridoio, flipper e prato. Gestisci la forza.',['corridoio','flipper','prato']),
 chain('inferno','IL GIRO DELL’INFERNO','hard','#9981c5','Rotonda, discesa e serpentina sul mare. Ogni errore costa caro.',['rotonda','discesa','serpentina']),
 chain('odissea','L’ODISSEA','hard','#b299ce','Flipper, ultima buca e una discesa finale. Il mare è sempre lì.',['flipper','ultima','discesa']),
 chain('disperati','IL PERCORSO DEI DISPERATI','hard','#52bfa3','Ponte, cancelli e serpentina: niente parapetti, tanti rimpianti.',['ponte','cancelli','serpentina'])
];
let previousTriple='';
/** Session guard compares sets, so even reordering the last triple is avoided. */
export function selectCourses(next:()=>number,previous=previousTriple):Course[] {
 const pick=(pool:readonly Course[])=>pool[Math.max(0,Math.min(pool.length-1,Math.floor(next()*pool.length)))];
 const selected=[pick(COURSES.filter(c=>c.difficulty==='easy'||c.difficulty==='medium'))];
 selected.push(pick(COURSES.filter(c=>c.difficulty==='medium'&&!selected.includes(c))));
 selected.push(pick(COURSES.filter(c=>c.difficulty!=='easy'&&!selected.includes(c))));
 const key=(cs:Course[])=>cs.map(c=>c.id).sort().join('|');
 if(key(selected)===previous){const alternatives=COURSES.filter(c=>c.difficulty!=='easy'&&!selected.includes(c));selected[2]=pick(alternatives);}
 previousTriple=key(selected);return selected;
}
export function floorAt(f:Floor,time:number):Floor {
 if(!f.motion)return f;
 const offset=Math.sin(time*f.motion.speed+(f.motion.phase??0))*f.motion.amplitude;
 return {...f,[f.motion.axis]:f[f.motion.axis]+offset};
}
export function heightAt(f:Floor,p:Point):number {return f.y+(f.slopeX??0)*(p.x-f.x)+(f.slopeZ??0)*(p.z-f.z);}
export function supportAt(course:Course,p:Point,time:number,maxY=Infinity):Floor|null {
 let best:Floor|null=null,bestY=-Infinity;
 for(const base of course.floors){const f=floorAt(base,time),h=heightAt(f,p);
  if(Math.abs(p.x-f.x)<=f.w/2&&Math.abs(p.z-f.z)<=f.d/2&&h<=maxY+.15&&h>bestY){best=f;bestY=h;}}
 return best;
}
export function wallAt(w:Wall,time:number):Wall {
 if(!w.rotation)return w;
 const r=w.rotation,a=time*r.speed+r.phase,c=Math.cos(a),s=Math.sin(a);
 const rotate=(p:Point)=>({x:r.center.x+(p.x-r.center.x)*c-(p.z-r.center.z)*s,z:r.center.z+(p.x-r.center.x)*s+(p.z-r.center.z)*c});
 return {...w,a:rotate(w.a),b:rotate(w.b)};
}
