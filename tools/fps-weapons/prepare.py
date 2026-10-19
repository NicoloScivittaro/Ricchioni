"""Bake source weapon bind poses and normalise camera-space geometry, locally.
Blender only, no added game dependencies. Originals remain in Downloads.
"""
import bpy,sys,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
root=Path(__file__).resolve().parents[2];out=root/'docs/agent-work/fps-weapons';dest=root/'public/assets/fps/weapons';dest.mkdir(exist_ok=True)
files=[('usp45','mwr_usp45.glb',.4),('raygun','ray_gun_-_call_of_duty.glb',.5),('raygun-v1','ray_gun_v1.glb',.5),('sniper','sniper.glb',.85),('minigun','call_of_duty_modern_warfare_2019_minigun.glb',.65),('m4a1','custom_m4a1_cod_warzone.glb',.65),('ak47','ak-47__-_game_ready_assault_rifle_weapon.glb',.65)]
records=[]
for key,name,length in files:
 bpy.ops.wm.read_factory_settings(use_empty=True);src=Path('C:/Users/niluf.PC-NIKO/Downloads')/name;bpy.ops.import_scene.gltf(filepath=str(src));deps=bpy.context.evaluated_depsgraph_get();objects=[]
 for ob in list(bpy.context.scene.objects):
  if ob.type!='MESH' or ob.hide_render or any(c.name=='glTF_not_exported' for c in ob.users_collection):continue
  evaluated=ob.evaluated_get(deps);mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps);obj=bpy.data.objects.new('weapon_'+key,mesh);bpy.context.collection.objects.link(obj);obj.matrix_world=ob.matrix_world.copy();objects.append(obj)
 for ob in list(bpy.context.scene.objects):
  if ob not in objects:bpy.data.objects.remove(ob,do_unlink=True)
 points=[ob.matrix_world@v.co for ob in objects for v in ob.data.vertices];lo=Vector([min(p[i]for p in points)for i in range(3)]);hi=Vector([max(p[i]for p in points)for i in range(3)]);extent=hi-lo;axis=max(range(2),key=lambda i:extent[i]);low=[p for p in points if p[axis]<lo[axis]+extent[axis]*.15];high=[p for p in points if p[axis]>hi[axis]-extent[axis]*.15]
 def area(ps):return math.prod(max(p[i]for p in ps)-min(p[i]for p in ps) for i in range(3)if i!=axis)
 sign=1 if area(high)<area(low)else -1
 # Direction corrections verified from the generated contact sheet when needed.
 override={'raygun':1,'raygun-v1':-1,'minigun':1}
 sign=override.get(key,sign);direction=Vector((sign if axis==0 else 0,sign if axis==1 else 0,0));angle=-math.pi/2-math.atan2(direction.y,direction.x);rotation=Matrix.Rotation(angle,4,'Z');scale=length/extent[axis]
 rotated=[rotation@p for p in points];min_y=min(p.y for p in rotated);front=[p for p in rotated if p.y<min_y+length/scale*.12];barrel=Vector((sum(p.x for p in front)/len(front),min(p.y for p in rotated),sum(p.z for p in front)/len(front)))
 translate=Vector((-barrel.x*scale, -length*.75-barrel.y*scale,.17-barrel.z*scale));matrix=Matrix.Translation(translate)@Matrix.Scale(scale,4)@rotation
 for ob in objects:ob.data.transform(matrix@ob.matrix_world);ob.matrix_world=Matrix.Identity(4)
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();combined=bpy.context.object;combined.name=key
 # All seven sources are already under 68k triangles. Retain the full geometry.
 resized=0
 for im in bpy.data.images:
  if im.type!='IMAGE' or not im.size[0]:continue
  if max(im.size)>1024:
   ratio=1024/max(im.size);im.scale(max(1,round(im.size[0]*ratio)),max(1,round(im.size[1]*ratio)));resized+=1
  if im.packed_file:im.pack()
 kwargs={'filepath':str(dest/(key+'.glb')),'export_format':'GLB','use_selection':True,'export_animations':False,'export_skins':False,'export_morph':False,'export_cameras':False,'export_lights':False}
 bpy.ops.export_scene.gltf(**kwargs)
 rec={'id':key,'source':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'originalBytes':src.stat().st_size,'bytes':(dest/(key+'.glb')).stat().st_size,'sourceBoundsBlender':[list(lo),list(hi)],'sourceForwardAxis':axis,'sourceForwardSign':sign,'length':length,'muzzle':[0,.17,length*.75],'resizedTextures':resized};records.append(rec);print('WEAPON_RESULT '+json.dumps(rec),flush=True)
(out/'assets.json').write_text(json.dumps(records,indent=2),encoding='utf8')
