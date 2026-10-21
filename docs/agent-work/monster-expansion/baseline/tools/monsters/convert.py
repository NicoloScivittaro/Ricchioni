"""Offline Blender conversion; source FBX untouched. Run with Blender --background."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];DEST=ROOT/'public/assets/monsters';OUT=ROOT/'docs/agent-work/monster-system'
CLIPS={'WALK':'Walking','ATTACK':'Punch','IDLE':'Idle','BREATHING_IDLE':'Breathing Idle','RUN':'Run','JUMP':'Jumping','ROAR':'Roaring','DEATH':'Dying'}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath='C:/Users/niluf.PC-NIKO/Downloads/Warrok W Kurniawan.fbx')
base=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');base.name='WarrokRig'
base.animation_data_clear();baseObjects=set(bpy.context.scene.objects);meta={}
for key,suffix in CLIPS.items():
    before=set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath='C:/Users/niluf.PC-NIKO/Downloads/Mutant '+suffix+'.fbx')
    imported=set(bpy.data.objects)-before;rig=next(o for o in imported if o.type=='ARMATURE')
    action=rig.animation_data.action.copy();action.name=key;action.use_fake_user=True
    # Exact rest matrices/hierarchy were checked by audit.py. No retarget guesswork here.
    assert len(rig.data.bones)==len(base.data.bones)
    for b in base.data.bones:
        other=rig.data.bones[b.name]
        assert max(abs(v-w)for r,s in zip(b.matrix_local,other.matrix_local)for v,w in zip(r,s))<1e-5
    base.animation_data_create();base.animation_data.action=action;base.animation_data.action_slot=action.slots[0]
    start,end=map(int,action.frame_range);hips=base.pose.bones['mixamorig:Hips'] if 'mixamorig:Hips' in base.pose.bones else next(b for b in base.pose.bones if b.name.endswith('Hips'))
    bpy.context.scene.frame_set(start);first=hips.location.copy()
    rotation=base.matrix_world.to_3x3()@hips.bone.matrix_local.to_3x3();inverse=rotation.inverted()
    samples=[]
    for frame in range(start,end+1):
        bpy.context.scene.frame_set(frame);samples.append(hips.location.copy())
    travel=rotation@(samples[-1]-first)
    for frame,value in zip(range(start,end+1),samples):
        bpy.context.scene.frame_set(frame);delta=rotation@(value-first)
        # Blender Z is up. Navigation drives horizontal movement; jump physics also drives height.
        delta.z=delta.z if key=='JUMP' else 0
        hips.location=value-inverse@delta
        hips.keyframe_insert(data_path='location',frame=frame,group=hips.name)
    base.animation_data.action=None
    track=base.animation_data.nla_tracks.new();track.name=key
    strip=track.strips.new(key,start,action);strip.action_slot=action.slots[0];strip.extrapolation='NOTHING'
    meta[key]={'frames':[start,end],'seconds':(end-start)/bpy.context.scene.render.fps,'rootTravelBlender':list(travel)}
    for ob in imported:bpy.data.objects.remove(ob,do_unlink=True)
    print('CLIP '+key+' '+json.dumps(meta[key]),flush=True)
    if key=='ATTACK':
        # Small two-clip trial before processing the remaining six.
        bpy.ops.object.select_all(action='DESELECT')
        for ob in baseObjects:ob.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT/'warrok-trial.glb'),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_cameras=False,export_lights=False,export_morph=False)
for image in bpy.data.images:
    if image.size[0] and max(image.size)>1024:
        image.scale(1024,1024)
        if image.packed_file:image.pack()
bpy.ops.object.select_all(action='DESELECT')
for ob in baseObjects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(DEST/'warrok.glb'),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_cameras=False,export_lights=False,export_morph=False,export_anim_slide_to_zero=True)
(OUT/'clips.json').write_text(json.dumps(meta,indent=2))
print('CONVERSION COMPLETE',flush=True)
