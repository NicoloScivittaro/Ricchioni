import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/agent-work/monster-system'
FILES=['Warrok W Kurniawan','Mutant Walking','Mutant Punch','Mutant Breathing Idle','Mutant Idle','Mutant Jumping','Mutant Run','Mutant Roaring','Mutant Dying','Mutant Jump Attack','Mutant Swiping']
records=[]
for name in FILES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path=Path('C:/Users/niluf.PC-NIKO/Downloads')/(name+'.fbx')
    bpy.ops.import_scene.fbx(filepath=str(path),use_anim=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    rec={'file':name+'.fbx','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'rigs':[],'meshes':[]}
    for a in rigs:
        bones=[{'name':b.name,'parent':b.parent.name if b.parent else None,'matrix':[list(r) for r in b.matrix_local],'head':list(b.head_local),'tail':list(b.tail_local)}for b in a.data.bones]
        rec['rigs'].append({'name':a.name,'matrix':[list(r)for r in a.matrix_world],'bones':bones,'action':a.animation_data.action.name if a.animation_data and a.animation_data.action else None})
    for o in bpy.context.scene.objects:
        if o.type=='MESH':rec['meshes'].append({'name':o.name,'vertices':len(o.data.vertices),'faces':len(o.data.polygons),'materials':[m.name for m in o.data.materials],'groups':len(o.vertex_groups)})
    rec['actions']=[{'name':a.name,'range':list(a.frame_range)}for a in bpy.data.actions]
    rec['images']=[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file),'path':i.filepath}for i in bpy.data.images]
    records.append(rec)
    print('AUDIT '+name+' '+str([(len(r['bones']),r['action'])for r in rec['rigs']])+' '+str(rec['actions']),flush=True)
(OUT/'fbx-audit.json').write_text(json.dumps(records,indent=2))
print('AUDIT COMPLETE',flush=True)
