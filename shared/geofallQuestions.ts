import data from './geofallQuestions.json';
import type {Rng} from './rng';
export const GEO_CATEGORIES=['bandiere','confini','capitali','sagome','monumenti'] as const;
export type GeoCategory=typeof GEO_CATEGORIES[number];
export const CATEGORY_NAMES:Record<GeoCategory,string>={bandiere:'BANDIERE',confini:'CONFINI TERRESTRI',capitali:'CAPITALI',sagome:'SAGOME',monumenti:'MONUMENTI'};
export interface GeoAnswer {id:string;label:string;image?:string}
export interface GeoQuestion {id:string;category:GeoCategory;prompt:string;target:string;correct:GeoAnswer;wrong:GeoAnswer[];difficulty:number;sources:string[]}
export const GEO_QUESTIONS=data as GeoQuestion[];
/** Balanced category cycles and independent shuffled bags per difficulty; no repeated item before its tier bag empties. */
export class GeoDeck {
 private categories:GeoCategory[]=[];private bags=new Map<string,GeoQuestion[]>();private lastCategory:GeoCategory|null=null;
 private history=new Map<string,number>();private draw=0;
 constructor(private rng:Rng){}
 next(round:number):{question:GeoQuestion;answers:GeoAnswer[];correctIndex:number}{
  if(!this.categories.length){this.categories=this.rng.shuffle(GEO_CATEGORIES);if(this.categories.at(-1)===this.lastCategory)this.categories.reverse();}
  const category=this.categories.pop()!;this.lastCategory=category;this.draw++;
  const tier=round<=5?(this.rng.chance(.6)?1:2):round<=10?(this.rng.chance(.65)?2:3):round<=15?3:(this.rng.chance(.8)?4:3);
  const key=`${category}:${tier}`;let bag=this.bags.get(key);
  if(!bag?.length){bag=this.rng.shuffle(GEO_QUESTIONS.filter(q=>q.category===category&&q.difficulty===tier));this.bags.set(key,bag);}
  if(!bag.length)throw new Error(`GEOFALL: categoria ${category}, difficoltà ${tier} senza domande`);
  // Prefer items absent from the recent 25 draws when a tier bag refills. Never discard unused questions.
  const fresh=bag.findIndex(q=>this.draw-(this.history.get(q.id)??-Infinity)>25),question=bag.splice(fresh>=0?fresh:0,1)[0];
  this.history.set(question.id,this.draw);const answers=this.rng.shuffle([question.correct,...question.wrong]);
  return{question,answers,correctIndex:answers.findIndex(a=>a.id===question.correct.id)};
 }
}
