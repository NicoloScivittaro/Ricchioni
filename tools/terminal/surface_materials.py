"""Classify existing shot triangles from source materials; never regenerate collision data."""
from prepare_arena import ROOT,read,world,access
import numpy as np,json,hashlib
from collections import Counter

def run():
 d,b=read();path=ROOT/'public/assets/fps/terminal/arena.json';arena=json.loads(path.read_text());triangles=arena['triangles']
 lookup={tuple(t):i for i,t in enumerate(triangles)};labels=np.zeros(len(triangles),dtype=np.uint8)
 for node in d['nodes']:
  if 'mesh' not in node:continue
  for pr in d['meshes'][node['mesh']]['primitives']:
   m=d['materials'][pr['material']];name=m['name'].lower()
   kind=3 if 'glass' in name else 4 if any(x in name for x in ('wood','particleboard','plywood','lumber')) else 2 if any(x in name for x in ('metal','steel','alumin','chrome','727','aircraft','airplane','fuselage')) else 1 if any(x in name for x in ('concrete','brick','plaster','wall','floor','marble','tile','cement','asphalt')) else 0
   ps=world(d,b,node,pr);ps[:,2]*=-1
   for t in np.round(ps[access(d,b,pr['indices']).reshape(-1,3)],4).reshape(-1,9):
    i=lookup.get(tuple(t))
    if i is not None:labels[i]=kind
 (ROOT/'public/assets/fps/terminal/surfaces.bin').write_bytes(labels.tobytes())
 report={'collisionSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'triangleCount':len(triangles),'palette':['unknown','concrete','metal','glass','wood'],'counts':dict(Counter(map(int,labels))),'bytes':len(labels)}
 (ROOT/'docs/agent-work/sparatoria-3/surfaces.json').write_text(json.dumps(report,indent=2));print(report)
if __name__=='__main__':run()
