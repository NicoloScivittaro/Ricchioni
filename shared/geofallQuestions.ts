import data from './geofallQuestions.json';
import type {Rng} from './rng';
export const GEO_CATEGORIES=['bandiere','confini','capitali','sagome','monumenti'] as const;
export type GeoCategory=typeof GEO_CATEGORIES[number];
export const CATEGORY_NAMES:Record<GeoCategory,string>={bandiere:'BANDIERE',confini:'CONFINI TERRESTRI',capitali:'CAPITALI',sagome:'SAGOME',monumenti:'MONUMENTI'};
export interface GeoAnswer {id:string;label:string;image?:string}
export interface GeoQuestion {id:string;category:GeoCategory;prompt:string;target:string;correct:GeoAnswer;wrong:GeoAnswer[];difficulty:number;sources:string[]}
export const GEO_QUESTIONS=data as GeoQuestion[];
/** Categorie senza ripetizioni nel ciclo; domande senza ripetizioni nel proprio sacchetto. */
export class GeoDeck {
 private categories:GeoCategory[]=[];private bags=new Map<GeoCategory,GeoQuestion[]>();private lastQuestionId='';
 constructor(private rng:Rng){}
 next(round:number):{question:GeoQuestion;answers:GeoAnswer[];correctIndex:number}{
  if(!this.categories.length)this.categories=this.rng.shuffle(GEO_CATEGORIES);
  const category=this.categories.pop()!;let bag=this.bags.get(category);
  if(!bag?.length){bag=this.rng.shuffle(GEO_QUESTIONS.filter(q=>q.category===category));this.bags.set(category,bag);}
  const preferred=round<=5?1:2;let idx=bag.findIndex(q=>q.difficulty<=preferred&&q.id!==this.lastQuestionId);
  if(idx<0)idx=bag.findIndex(q=>q.id!==this.lastQuestionId);
  const question=bag.splice(idx<0?0:idx,1)[0],answers=this.rng.shuffle([question.correct,...question.wrong]);this.lastQuestionId=question.id;
  return{question,answers,correctIndex:answers.findIndex(a=>a.id===question.correct.id)};
 }
}
