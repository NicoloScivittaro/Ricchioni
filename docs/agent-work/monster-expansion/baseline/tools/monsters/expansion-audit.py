import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/agent-work/monster-expansion';CACHE=Path('C:/Users/niluf.PC-NIKO/.cache/party-monsters/expansion-1.2')
records=[]
for kind in ['warrok','zombiegirl','yaku','pumpkinhulk']:
    base=None;rows=[]
    paths=sorted((CACHE/kind).glob('*.fbx'),key=lambda p:(p.name.lower().startswith(('mutant','left')),p.name))
    if kind=='warrok':paths+=[Path('C:/Users/niluf.PC-NIKO/Downloads')/n for n in ['Mutant Jump Attack.fbx','Mutant Swiping.fbx']]
    for path in paths:
        bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(path),use_anim=True)
        rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');bones=[{'name':b.name,'parent':b.parent.name if b.parent else None,'matrix':[list(r)for r in b.matrix_local]}for b in rig.data.bones]
        row={'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bones':bones,'matrix':[list(r)for r in rig.matrix_world],'actions':[{'name':a.name,'range':list(a.frame_range)}for a in bpy.data.actions],'fps':bpy.context.scene.render.fps,'meshes':[{'name':o.name,'verts':len(o.data.vertices),'faces':len(o.data.polygons),'groups':len(o.vertex_groups)}for o in bpy.context.scene.objects if o.type=='MESH'],'images':[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file)}for i in bpy.data.images]}
        if base is None:base=row;row['role']='model'
        else:
            bm={b['name']:b for b in base['bones']};mapped={b['name']:b for b in bones};row['hierarchyEqual']=[(b['name'],b['parent'])for b in bones]==[(b['name'],b['parent'])for b in base['bones']]
            row['restMaxDelta']=max(abs(v-w)for name in set(bm)&set(mapped)for r,s in zip(bm[name]['matrix'],mapped[name]['matrix'])for v,w in zip(r,s));row['objectMaxDelta']=max(abs(v-w)for r,s in zip(base['matrix'],row['matrix'])for v,w in zip(r,s))
        rows.append(row);print('AUDIT',kind,path.name,len(bones),'bones',row.get('hierarchyEqual'),row.get('restMaxDelta'),row['actions'],flush=True)
    records.append({'kind':kind,'files':rows});(OUT/'pack-audit.json').write_text(json.dumps(records,indent=2))
print('PACK AUDIT COMPLETE',flush=True)
