"""Static asset checks, including preservation of existing Backrooms bind/mesh/material data."""
import json,struct,hashlib
from pathlib import Path
from gltf import accessor,parents,globalize,trs,np
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/agent-work/monster-system';DEST=ROOT/'public/assets/monsters'
def load(path):
 d=path.read_bytes();n=struct.unpack_from('<I',d,12)[0];return json.loads(d[20:20+n]),d[28+n:]
audit=json.loads((OUT/'fbx-audit.json').read_text());base=audit[0]['rigs'][0];records=[]
for row in audit:
 rig=row['rigs'][0];assert [(b['name'],b['parent'])for b in rig['bones']]==[(b['name'],b['parent'])for b in base['bones']]
 assert rig['matrix']==base['matrix'];assert all(b['matrix']==c['matrix']for b,c in zip(rig['bones'],base['bones']))
 assert hashlib.sha256((Path('C:/Users/niluf.PC-NIKO/Downloads')/row['file']).read_bytes()).hexdigest()==row['sha256']
for name in ['warrok','hazmat-animated','partygoer-animated']:
 path=DEST/(name+'.glb');g,b=load(path);clips=[a['name']for a in g['animations']];assert len(clips)==8 and set(clips)=={'IDLE','BREATHING_IDLE','WALK','RUN','JUMP','ROAR','ATTACK','DEATH'}
 assert any('JOINTS_0'in p['attributes']and'WEIGHTS_0'in p['attributes']for m in g['meshes']for p in m['primitives'])
 records.append({'asset':name+'.glb','bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'meshes':len(g['meshes']),'rigs':len(g['skins']),'bones':len(g['skins'][0]['joints']),'clips':clips,'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes']for p in m['primitives']),'embeddedImages':len(g.get('images',[]))})
for name,source in [('hazmat','escape_the_backrooms_hazmat'),('partygoer','partygoer_from_backrooms_updated')]:
 a,ab=load(ROOT/'public/assets/backrooms'/(source+'.glb'));b,bb=load(DEST/(name+'-animated.glb'))
 for key in ['nodes','meshes','skins','materials','textures','images']:assert a.get(key)==b.get(key),(name,key)
 assert ab==bb[:len(ab)],name+' original mesh/texture binary changed'
g,b=load(DEST/'warrok.glb');par=parents(g);rest=globalize([trs(n)for n in g['nodes']],par);hips=next(i for i,n in enumerate(g['nodes'])if n.get('name')=='mixamorig:Hips');drift={}
for a in g['animations']:
 c=next((c for c in a['channels']if c['target']=={'node':hips,'path':'translation'}),None)
 values=accessor(g,b,a['samplers'][c['sampler']]['output'])if c else np.array([g['nodes'][hips].get('translation',[0,0,0])]);parent=rest[par[hips]];points=(parent@np.column_stack((values,np.ones(len(values)))).T).T[:,:3];delta=np.ptp(points,axis=0)
 assert max(delta[0],delta[2])<1e-4,(a['name'],delta)
 if a['name']=='JUMP':assert max(delta)<1e-4
 drift[a['name']]=delta.tolist()
result={'status':'passed','rigCompatibility':'81 imported bones; exact hierarchy, rest matrices, armature transforms in all eleven FBX','originalsUnchanged':True,'retargetPreservesOriginalGeometryBindMaterials':True,'rootMotionRangeXYZ':drift,'assets':records,'extraAnimations':'Jump Attack and Swiping inspected, not included in the requested eight-clip set'}
(OUT/'asset-checks.json').write_text(json.dumps(result,indent=2));print('PASS exact FBX rigs, untouched originals, eight clips, original Backrooms geometry/binds/materials retained')
