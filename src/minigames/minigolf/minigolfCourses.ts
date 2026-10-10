import type {Course,Floor,Point,Wall} from './minigolfTypes';
const floor=(x:number,z:number,w:number,d:number,y=0,extra:Partial<Floor>={}):Floor=>({x,z,w,d,y,...extra});
const wall=(x:number,z:number,xx:number,zz:number,y=0):Wall=>({a:{x,z},b:{x:xx,z:zz},y,radius:.18});
const rim=(w:number,d:number):Wall[]=>[wall(-w,-d,w,-d),wall(-w,d,w,d),wall(-w,-d,-w,d),wall(w,-d,w,d)];
export const COURSES: readonly Course[] = [
 {id:'corridoio',name:'IL CORRIDOIO MALEDETTO',difficulty:'easy',color:'#42bd82',tip:'Dosala. Usa le sponde, oppure rischia il passaggio stretto a sinistra.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,
  floors:[floor(0,0,22,28)],walls:[...rim(11,14),wall(-11,5,3,5),wall(-3,-3,11,-3)],
  bumpers:[{x:3,z:0,y:0,radius:.75,power:2}],waypoints:[{x:5,z:7},{x:5,z:2},{x:-5,z:0},{x:-5,z:-6},{x:0,z:-11}]},
 {id:'rotonda',name:'LA ROTONDA DEL DISAGIO',difficulty:'medium',color:'#35b9ad',tip:'Due bracci, un tempismo. Puoi passare fuori o prendere la spinta.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,floors:[floor(0,0,22,28)],
  walls:[...rim(11,14),... [0,Math.PI/2].map(phase=>({...wall(-6,0,6,0),rotation:{center:{x:0,z:0},speed:.65,phase}}))],
  bumpers:[],waypoints:[{x:7,z:4},{x:8,z:-4},{x:0,z:-11}]},
 {id:'ponte',name:'IL PONTE DEL LITORALE',difficulty:'medium',color:'#52bfa3',tip:'Bordi senza parapetto. Il ponte scorre: aspetta il passaggio.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,
  floors:[floor(0,10,12,8),floor(-3,2,3.2,10,.35,{slopeZ:.07}),floor(-3,-4,4,4,0,{motion:{axis:'x',amplitude:.8,speed:.7}}),floor(0,-10,12,8)],
  walls:[wall(-6,14,6,14)],bumpers:[],waypoints:[{x:-3,z:7},{x:-3,z:1},{x:-3,z:-5},{x:0,z:-11}]},
 {id:'flipper',name:'IL FLIPPER DEI COGLIONI',difficulty:'medium',color:'#707fcb',tip:'I bumper spingono sempre allo stesso modo. Cerca una sponda buona.',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,floors:[floor(0,0,20,28),floor(0,4,8,3,.015,{surface:'ice'}),floor(0,-7,10,2,.015,{surface:'sand'})],
  walls:rim(10,14),bumpers:[[-4,4],[3,3],[0,-1],[-5,-4],[5,-5]].map(([x,z])=>({x,z,y:0,radius:1,power:4.5})),
  waypoints:[{x:6,z:6},{x:7,z:-1},{x:2,z:-8},{x:0,z:-11}]},
 {id:'discesa',name:'LA DISCESA INFAME',difficulty:'hard',color:'#69a56a',tip:'La pendenza fa il lavoro. Frena prima della curva e gira a sinistra.',
  spawn:{x:0,z:11},hole:{x:5,z:-11},holeY:0,
  floors:[floor(0,10,12,8,3),floor(0,1,6,10,1.75,{slopeZ:.25}),floor(3,-5,12,4,.25,{surface:'sand'}),floor(5,-10,4,8,0)],
  walls:[wall(-6,14,6,14,3),wall(-3,-7,3,-7,.25),wall(7,-7,9,-7,.25)],bumpers:[{x:-1,z:-4.5,y:.25,radius:.65,power:1}],
  waypoints:[{x:0,z:7},{x:0,z:0},{x:1,z:-4.5},{x:5,z:-5},{x:5,z:-11}]},
 {id:'ultima',name:"L'ULTIMA BUCA",difficulty:'hard',color:'#b299ce',tip:'A destra la strada sicura. La rampa centrale è una scommessa!',
  spawn:{x:0,z:11},hole:{x:0,z:-11},holeY:0,
  floors:[floor(0,10,14,8),floor(-5,0,4,20),floor(0,5,3,6,.75,{slopeZ:-.25}),
   floor(0,-4,4,4,.2,{motion:{axis:'x',amplitude:1.2,speed:.6}}),floor(0,-10,14,8)],
  walls:[wall(-7,14,7,14),wall(-7,7,-7,-10),wall(-3,5,-3,-5)],
  bumpers:[{x:-5,z:-2,y:0,radius:.6,power:1.8}],waypoints:[{x:-5,z:8},{x:-6,z:1},{x:-6,z:-4.5},{x:-5,z:-6},{x:-3,z:-10},{x:0,z:-11}]}
];
export function selectCourses(next:()=>number):Course[] {
 const pick=(level:Course['difficulty'])=>{const a=COURSES.filter(c=>c.difficulty===level);return a[Math.min(a.length-1,Math.floor(next()*a.length))];};
 return [pick('easy'),pick('medium'),pick('hard')];
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
