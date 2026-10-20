import { CORNICIONE_MAPS } from '../../../shared/minigameMaps';
import { STAGE } from './fighterData';
import type { FighterStage } from './fighterData';
export interface CornicioneStage extends FighterStage { readonly id:string; readonly name:string }
const layouts:Record<string,FighterStage>={
 tetto:STAGE,
 darsena:{mainX:13,platforms:[{id:1,x0:-11.5,x1:-4.8,y:2.8},{id:2,x0:4.8,x1:11.5,y:2.8},{id:3,x0:-4,x1:4,y:6}]},
 cantiere:{mainX:13,platforms:[{id:1,x0:-11,x1:-5,y:4.4},{id:2,x0:5,x1:11,y:4.4},{id:3,x0:-2.4,x1:2.4,y:8}]}
};
export const CORNICIONE_STAGES:readonly CornicioneStage[]=CORNICIONE_MAPS.map(m=>({...layouts[m.id],id:m.id,name:m.name}));
export function cornicioneStage(id?:string):CornicioneStage {return CORNICIONE_STAGES.find(s=>s.id===id)??CORNICIONE_STAGES[0];}
