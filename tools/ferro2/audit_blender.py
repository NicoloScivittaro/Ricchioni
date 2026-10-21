import bpy,json,zipfile,sys
from pathlib import Path
from mathutils import Vector
import numpy as np
ROOT=Path(__file__).resolve().parents[2];CACHE=ROOT/'.cache/ferro-2';OUT=ROOT/'docs/agent-work/ferro-2';SRC=Path('C:/Users/niluf.PC-NIKO/Downloads')
report={}
for tag in ['melee','archer']:
 nested=next((CACHE/tag/'Animations').glob('*BlenderFiles.zip'))
 with zipfile.ZipFile(nested) as z:
  for name in z.namelist():
   target=CACHE/tag/'native'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
  for name in z.namelist():
   if 'HumanM_' not in name:continue
   with bpy.data.libraries.load(str(CACHE/tag/'native'/name),link=False) as (source,dest):report[name]={'actions':list(source.actions),'objects':list(source.objects)}
for tag,file in [('melee','Models/HumanM_Model.fbx'),('melee','Animations/Male/Combat/1H/HumanM@Attack1H01_L.fbx'),('archer','Animations/Male/Combat/Bow/HumanM@BowShot01 - Release.fbx')]:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(CACHE/tag/file))
 rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
 report[file]={'objects':[{'name':o.name,'type':o.type,'bounds':[list(o.matrix_world@Vector(v)) for v in o.bound_box] if o.type=='MESH' else None} for o in bpy.context.scene.objects],'actions':[{'name':a.name,'range':list(a.frame_range)} for a in bpy.data.actions],'fps':bpy.context.scene.render.fps,'rigs':[{'name':o.name,'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(o.matrix_world@b.head_local),'tail':list(o.matrix_world@b.tail_local)}for b in o.data.bones]}for o in rigs]}
 print('FBX',file,[(a.name,list(a.frame_range))for a in bpy.data.actions],flush=True)
for filename in ['hell_arena.glb','geonosis_arena.glb','shattered_crystal_sword.glb','free__steampunk_da_vincis_sword_game-ready.glb','autumn_sword.glb','the_sword_of_victory.glb','scutum.glb','medieval_shield.glb','bow_and_arrow.glb','lance_of_longinus.glb']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(SRC/filename));items=[];verts=[];tris=[];offset=0
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  mesh=o.data;mesh.calc_loop_triangles();v=np.array([o.matrix_world@v.co for v in mesh.vertices]);t=np.array([t.vertices[:] for t in mesh.loop_triangles]);verts.append(v);tris.append(t+offset);offset+=len(v)
  items.append({'name':o.name,'min':v.min(axis=0).tolist(),'max':v.max(axis=0).tolist(),'triangles':len(t),'materials':[s.material.name if s.material else None for s in o.material_slots]})
 v=np.vstack(verts);t=np.vstack(tris);np.savez_compressed(CACHE/(Path(filename).stem+'.npz'),vertices=v,triangles=t)
 report[filename]={'objects':items,'min':v.min(axis=0).tolist(),'max':v.max(axis=0).tolist(),'triangles':len(t)}
 print('GLB',filename,'bounds',report[filename]['min'],report[filename]['max'],'objects',len(items),flush=True)
(OUT/'blender-audit.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('AUDIT COMPLETE',flush=True)
