"""Offline, local-only conversion. Source geometry/UVs and animation authorship retained."""
import bpy, json, math, sys, hashlib, struct, base64
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]; SRC=Path('C:/Users/niluf.PC-NIKO/Downloads'); CACHE=ROOT/'.cache/ferro-2'; OUT=ROOT/'public/assets/ferro2'; OUT.mkdir(parents=True,exist_ok=True)
report={'assets':[],'clips':{}}
def load(path):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 (bpy.ops.import_scene.fbx if path.suffix=='.fbx' else bpy.ops.import_scene.gltf)(filepath=str(path))
def export(name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in bpy.context.scene.objects:
  if o.type=='MESH':o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
def transform_meshes(fn):
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  mat=o.matrix_world.copy();o.parent=None;o.matrix_world=Matrix.Identity(4)
  for v in o.data.vertices:v.co=fn(mat@v.co)
  o.data.update()
def palette():
 image=bpy.data.images.load(str(CACHE/'melee/Textures/HumanAnimations_ColorPalette.png'),check_existing=True)
 material=bpy.data.materials.new('KevinIglesias_Original_ColorPalette');material.use_nodes=True;nodes=material.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=image;material.node_tree.links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.55
 for obj in bpy.context.scene.objects:
  if obj.type=='MESH':obj.data.materials.clear();obj.data.materials.append(material)
def inventory(name,path):report['assets'].append({'output':name+'.glb','source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
# Models are canonical Blender Z-up with grip at origin; Babylon's local import resets its root yaw.
models=[('crystal','shattered_crystal_sword.glb',1.62),('steampunk','free__steampunk_da_vincis_sword_game-ready.glb',1.62),('autumn','autumn_sword.glb',1.62),('victory','the_sword_of_victory.glb',1.62),('longinus','lance_of_longinus.glb',2.6),('scutum','scutum.glb',1.15),('medieval','medieval_shield.glb',1.05),('bow','bow_and_arrow.glb',1.55),('arrow','bow_and_arrow.glb',.90)]
for name,file,length in models:
 path=SRC/file;load(path)
 if name=='victory':
  for o in list(bpy.context.scene.objects):
   if o.type=='MESH' and o.name not in ['Object_3','Object_4']:bpy.data.objects.remove(o,do_unlink=True)
 if name in ['bow','arrow']:
  for o in list(bpy.context.scene.objects):
   keep=o.name.startswith('bow_') if name=='bow' else o.name in ['arrow_arrow_mt_0','arrow_wing_mt_0']
   if o.type=='MESH' and not keep:bpy.data.objects.remove(o,do_unlink=True)
 verts=np.array([o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]);lo=verts.min(0);hi=verts.max(0);center=(lo+hi)/2
 if name in ['steampunk','longinus']:
  _,_,axes=np.linalg.svd(verts-center,full_matrices=False);axis=axes[0]
  if axis[1]<0:axis=-axis
  # Narrow grip lies near the lower end; preserve the fork/head at positive axial coordinates.
  if name=='steampunk':axis=-axis
  up=Vector(axis);rotation=up.rotation_difference(Vector((0,0,1))).to_matrix();rot=np.array(rotation);rv=(verts-center)@rot.T;length0=np.ptp(rv[:,2]);grip=rv[:,2].min()+length0*.18
  transform_meshes(lambda v:Vector((rotation@(v-Vector(center)))-Vector((0,0,grip)))*(length/(length0*.82)))
 elif name in ['scutum','medieval']:
  if name=='medieval':rotation=Matrix.Identity(3)
  else:rotation=Matrix.Identity(3)
  rv=(verts-center)@np.array(rotation).T;factor=length/np.ptp(rv[:,2]);transform_meshes(lambda v:rotation@(v-Vector(center))*factor)
 elif name=='bow':
  grip=Vector((-.15,0,.60));factor=length/(hi[2]-lo[2]);transform_meshes(lambda v:(v-grip)*factor)
 elif name=='arrow':
  grip=Vector((center[0],center[1],hi[2]-.07));factor=length/(hi[2]-lo[2]);transform_meshes(lambda v:Vector((v.x-grip.x,-(v.y-grip.y),-(v.z-grip.z)))*factor)
 else:
  if name=='autumn':rotation=Matrix.Rotation(-math.pi/2,3,'X');grip=Vector((0,1.0,0));factor=length/9.214
  else:rotation=Matrix.Identity(3);grip=Vector((center[0],center[1],lo[2]+(hi[2]-lo[2])*.22));factor=length/((hi[2]-lo[2])*.78)
  transform_meshes(lambda v:rotation@(v-grip)*factor)
 export(name);inventory(name,path)
for name,file,length in [('dagger','Human_Dagger.fbx',1.05),('warhammer','Human_Warhammer.fbx',1.85)]:
 path=CACHE/'melee/Models/Weapons'/file;load(path)
 verts=np.array([o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]);lo=verts.min(0);hi=verts.max(0);axis=int(np.argmax(hi-lo));rot=Vector(np.eye(3)[axis]).rotation_difference(Vector((0,0,1))).to_matrix();rv=verts@np.array(rot).T;origin=Vector(((rv[:,0].min()+rv[:,0].max())/2,(rv[:,1].min()+rv[:,1].max())/2,rv[:,2].min()+np.ptp(rv[:,2])*.22));factor=length/(np.ptp(rv[:,2])*.78)
 transform_meshes(lambda v:(rot@v-origin)*factor);palette();export(name);inventory(name,path)
# Grid proxies come from original triangles. No replacement arena, added blocking cubes or spawn inference.
for name,scale,base in [('hell',8,.07),('geonosis',.001,751.84)]:
 file='hell_arena.glb' if name=='hell' else 'geonosis_arena.glb';path=SRC/file;load(path)
 if name=='hell':
  for o in list(bpy.context.scene.objects):
   if o.name=='Object_4':bpy.data.objects.remove(o,do_unlink=True) # enclosing background box, not arena geometry
 transform_meshes(lambda v:Vector((v.x*scale,v.y*scale,(v.z-base)*scale)))
 vertices=[];triangles=[]
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  o.data.calc_loop_triangles();off=len(vertices);vertices.extend([tuple(v.co) for v in o.data.vertices]);triangles.extend([tuple(i+off for i in t.vertices) for t in o.data.loop_triangles])
 bvh=BVHTree.FromPolygons(vertices,triangles,all_triangles=True);step=.4;extent=36 if name=='hell' else 64;size=int(extent*2/step)+1;heights=[];blocked=[]
 for row in range(size):
  for col in range(size):
   x=(col-(size-1)/2)*step;y=(row-(size-1)/2)*step;origin=Vector((x,y,8));floor=None
   for attempt in range(12):
    hit,normal,idx,dist=bvh.ray_cast(origin,Vector((0,0,-1)),50)
    if hit is None:break
    if abs(normal.z)>.65 and hit.z>-3:floor=hit.z;break
    origin=hit-Vector((0,0,.015))
   heights.append(round(floor,2) if floor is not None else -999)
   solid=floor is None
   if floor is not None:
    for z in [.4,1.1,1.7]:
     for a in range(8):
      hit,normal,idx,dist=bvh.ray_cast(Vector((x,y,floor+z)),Vector((math.cos(a*math.pi/4),math.sin(a*math.pi/4),0)),.26)
      if hit is not None:solid=True;break
     if solid:break
   blocked.append(1 if solid else 0)
 data={'id':name,'step':step,'size':size,'extent':extent,'radius':22 if name=='hell' else 25,'heights':heights,'blocked':blocked,'triangles':len(triangles),'scale':scale,'sourceFloor':base}
 data.pop('heights');data.pop('blocked');data['heightData']=base64.b64encode(struct.pack('<'+'h'*len(heights),*[round(h*100) if h>-100 else -32768 for h in heights])).decode();bits=bytearray((len(blocked)+7)//8)
 for i,b in enumerate(blocked):bits[i//8]|=b<<(i%8)
 data['blockedData']=base64.b64encode(bits).decode()
 (ROOT/'shared/ferro'/('map-'+name+'.json')).write_text(json.dumps(data,separators=(',',':')))
 export(name);inventory(name,path);print('MAP',name,len(triangles),sum(1 for h,b in zip(heights,blocked) if not b and abs(h)<1),flush=True)
# Sample the actual supplied FBX action curves. Game basis: X=source X,Y=source Z,Z=-source Y.
clips={
 'idle':('melee','Combat/1H/HumanM@CombatIdle1H01.fbx'),
 'attackL':('melee','Combat/1H/HumanM@Attack1H01_L.fbx'), 'attackR':('melee','Combat/1H/HumanM@Attack1H01_R.fbx'),
 'attack2H':('melee','Combat/2H/HumanM@Attack2H01.fbx'), 'polearm':('melee','Combat/Polearm/HumanM@AttackPolearm01.fbx'),
 'shield':('melee','Combat/Shield/HumanM@AttackShield01.fbx'),
 'hurt':('melee','Combat/HumanM@CombatDamage01.fbx'),'death':('melee','Combat/HumanM@Death01.fbx'),
 'run':('melee','Movement/Run/HumanM@Run01_Forward.fbx'), 'strafeL':('melee','Movement/StrafeRun/HumanM@StrafeRun01_Left.fbx'),'strafeR':('melee','Movement/StrafeRun/HumanM@StrafeRun01_Right.fbx'),
 'bowIdle':('archer','Combat/Bow/HumanM@BowIdle01.fbx'),'bowLoad':('archer','Combat/Bow/HumanM@BowShot01 - Load.fbx'),'bowHold':('archer','Combat/Bow/HumanM@BowShot01 - Hold.fbx'),'bowRelease':('archer','Combat/Bow/HumanM@BowShot01 - Release.fbx')}
motion={};bones=['B-hips','B-chest','B-head','B-hand.R','B-hand.L','B-handProp.R','B-handProp.L','B-thigh.R','B-thigh.L','B-shin.R','B-shin.L','B-foot.R','B-foot.L']
for key,(tag,relative) in clips.items():
 basefolder=CACHE/tag/'Animations/Male';path=basefolder/relative
 if not path.exists():
  found=list(basefolder.rglob(Path(relative).name))
  if len(found)!=1:raise RuntimeError((key,relative,found))
  path=found[0]
 load(path);rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');action=rig.animation_data.action;start,end=map(float,action.frame_range);fps=bpy.context.scene.render.fps;duration=(end-start)/fps;samples=[]
 def game(v):
  factor=.011 if tag=='archer' else 1.1
  return [round(-v.x*factor,4),round(v.z*factor,4),round(-v.y*factor,4)]
 for i in range(max(2,math.ceil(duration*30)+1)):
  frame=start+(end-start)*i/(max(2,math.ceil(duration*30)+1)-1);bpy.context.scene.frame_set(int(frame),subframe=frame%1);row={}
  for bone in bones:
   pb=rig.pose.bones.get(bone)
   if pb:row[bone]=game(rig.matrix_world@pb.head)
  for side in ['R','L']:
   pb=rig.pose.bones.get('B-handProp.'+side)
   if pb:row['axis'+side]=[-round((rig.matrix_world.to_3x3()@pb.matrix.to_3x3()@Vector((0,1,0))).normalized().x,4),round((rig.matrix_world.to_3x3()@pb.matrix.to_3x3()@Vector((0,1,0))).normalized().z,4),-round((rig.matrix_world.to_3x3()@pb.matrix.to_3x3()@Vector((0,1,0))).normalized().y,4)]
  samples.append(row)
 motion[key]={'duration':round(duration,4),'frames':samples};report['clips'][key]={'source':str(path.relative_to(CACHE)),'duration':duration,'frames':len(samples)}
 print('CLIP',key,duration,flush=True)
(ROOT/'shared/ferro/motion.json').write_text(json.dumps(motion,separators=(',',':')))
(ROOT/'docs/agent-work/ferro-2/conversion.json').write_text(json.dumps(report,indent=2))
print('CONVERSION COMPLETE',flush=True)
