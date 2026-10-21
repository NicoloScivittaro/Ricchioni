import bpy,json
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath='C:/Users/niluf.PC-NIKO/Downloads/Mutant Jump Attack.fbx');a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rows=[]
for f in range(1,113):
 bpy.context.scene.frame_set(f);bpy.context.view_layer.update();points={n:list(a.matrix_world@a.pose.bones['mixamorig:'+n].matrix.translation)for n in ['Hips','LeftHand','RightHand','LeftFoot','RightFoot']};rows.append({'time':(f-1)/30,**points})
p=Path(__file__).resolve().parents[2]/'docs/agent-work/monster-expansion/jump-motion.json';p.write_text(json.dumps(rows,indent=2));print(json.dumps([r for i,r in enumerate(rows)if i%6==0]))
