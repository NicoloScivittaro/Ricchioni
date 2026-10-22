"""Sample supplied FBX skeletons for Ferro-only rest-space retargeting (Blender)."""
import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'.cache/ferro-2'
report=json.loads((ROOT/'docs/agent-work/ferro-2/conversion.json').read_text())
result={}
for key,clip in report['clips'].items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(CACHE/clip['source']))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    action=rig.animation_data.action;start,end=map(float,action.frame_range)
    duration=(end-start)/bpy.context.scene.render.fps
    # Archer FBX stores centimetre scale/axis conversion on the armature object.
    # Evaluate it BEFORE reading bind matrices, just as for the animated samples.
    bpy.context.scene.frame_set(int(start),subframe=start%1)
    bpy.context.view_layer.update()
    names=[b.name for b in rig.data.bones]
    def flat(m):return [round(float(v),7) for row in m for v in row]
    # Some Archer exports animate B-root itself with the constant unit/axis conversion
    # (100x, X-up rotation). Apply that same root basis to bind, not just to samples.
    bind_root=rig.matrix_world@rig.data.bones['B-root'].matrix_local
    correction=(rig.matrix_world@rig.pose.bones['B-root'].matrix)@bind_root.inverted()
    rest={b.name:flat(correction@rig.matrix_world@b.matrix_local) for b in rig.data.bones}
    poses=[]
    for i in range(max(2,math.ceil(duration*24)+1)):
        f=start+(end-start)*i/(max(2,math.ceil(duration*24)+1)-1)
        bpy.context.scene.frame_set(int(f),subframe=f%1)
        poses.append({b.name:flat(rig.matrix_world@b.matrix) for b in rig.pose.bones})
    result[key]={'duration':duration,'rest':rest,'frames':poses}
    print('SKIN SOURCE',key,len(names),len(poses),flush=True)
(CACHE/'skin-source.json').write_text(json.dumps(result,separators=(',',':')))
