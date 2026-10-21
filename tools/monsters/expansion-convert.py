"""Blender offline rest-space retarget. One geometry per creature, immutable originals.
Warrok's existing eight verified clips are preserved by the subsequent append stage.
"""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];CACHE=Path('C:/Users/niluf.PC-NIKO/.cache/party-monsters/expansion-1.2');OUT=ROOT/'docs/agent-work/monster-expansion';DEST=ROOT/'public/assets/monsters'
MODELS={'warrok':'Warrok W Kurniawan','zombiegirl':'Zombiegirl W Kurniawan','yaku':'Yaku J Ignite','pumpkinhulk':'Pumpkinhulk L Shaw'}
CLIPS={'WALK':'mutant walking','SWIPE':'mutant swiping','IDLE':'mutant idle','BREATHING_IDLE':'mutant breathing idle','RUN':'mutant run','JUMP':'mutant jumping','TURN_LEFT':'mutant left turn 45','TURN_RIGHT':'mutant right turn 45 (2)','TAUNT':'mutant flexing muscles','DEATH':'mutant dying'}
records=[];trial='--trial'in sys.argv;jumpsOnly='--jumps-only'in sys.argv
for kind,model in MODELS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path=Path('C:/Users/niluf.PC-NIKO/Downloads/Warrok W Kurniawan.fbx')if kind=='warrok'else CACHE/kind/(model+'.fbx')
    bpy.ops.import_scene.fbx(filepath=str(path),use_anim=True);base=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');base.name=kind+'Rig';base.animation_data_clear();baseObjects=set(bpy.context.scene.objects)
    for p in base.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update();rest={b.name:b.matrix_local.copy()for b in base.data.bones};ordered=list(base.data.bones);meta={}
    selection=dict(CLIPS)
    if kind=='warrok':selection={k:v for k,v in selection.items()if k in ['TURN_LEFT','TURN_RIGHT','TAUNT']};selection.update(SWIPE='@Mutant Swiping',JUMP_ATTACK='@Mutant Jump Attack')
    if kind=='yaku':selection['JUMP_ATTACK']='@Mutant Jump Attack'
    if trial:selection={k:v for k,v in selection.items()if k in ['WALK','SWIPE','JUMP_ATTACK']}
    if jumpsOnly:selection={k:v for k,v in selection.items()if k in ['JUMP','JUMP_ATTACK']}
    for key,name in selection.items():
        before=set(bpy.data.objects);srcPath=Path('C:/Users/niluf.PC-NIKO/Downloads')/(name[1:]+'.fbx')if name.startswith('@')else CACHE/kind/(name+'.fbx')
        bpy.ops.import_scene.fbx(filepath=str(srcPath),use_anim=True);imported=set(bpy.data.objects)-before;src=next(o for o in imported if o.type=='ARMATURE');sourceAction=src.animation_data.action;start,end=map(int,sourceAction.frame_range)
        common=set(rest)&set(src.data.bones.keys());assert all(k in common for k in ['mixamorig:Hips','mixamorig:Head','mixamorig:LeftArm','mixamorig:RightArm','mixamorig:LeftUpLeg','mixamorig:RightUpLeg'])
        hierarchy=all((b.parent.name if b.parent else None)==(src.data.bones[b.name].parent.name if src.data.bones[b.name].parent else None)for b in ordered if b.name in common)
        # Missing terminal/facial bones are left in the target rest pose. Core parent hierarchy must match.
        assert hierarchy,(kind,key,'incompatible parent chain')
        action=bpy.data.actions.new(kind+'_'+key);base.animation_data_create();base.animation_data.action=action
        ratio=(rest['mixamorig:Head'].translation-rest['mixamorig:Hips'].translation).length/(src.data.bones['mixamorig:Head'].head_local-src.data.bones['mixamorig:Hips'].head_local).length
        srcRest={b.name:b.matrix_local.copy()for b in src.data.bones};srot=src.matrix_world.to_3x3();inv=base.matrix_world.to_3x3().inverted();first=None;footFloor=None;previous={};trace=[]
        for frame in range(start,end+1):
            bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();desired={}
            hipsDelta=srot@(src.pose.bones['mixamorig:Hips'].matrix.translation-srcRest['mixamorig:Hips'].translation)
            if first is None:first=hipsDelta.copy()
            # Navigation owns horizontal displacement and physical jumps. Preserve natural vertical breathing/death.
            hipsDelta.x=hipsDelta.y=0
            if key in ['JUMP','JUMP_ATTACK']:
                feet=min((src.matrix_world@src.pose.bones['mixamorig:'+foot].matrix.translation).z for foot in ['LeftFoot','RightFoot'])
                if footFloor is None:footFloor=feet
                # Keep crouch/landing compression, remove only airborne lift; gameplay replaces that lift.
                hipsDelta.z-=max(0,feet-footFloor)
            for b in ordered:
                name=b.name;parent=b.parent
                if name in common:
                    q=src.pose.bones[name].matrix.to_quaternion()@srcRest[name].to_quaternion().inverted()@rest[name].to_quaternion()
                else:q=(desired[parent.name].to_quaternion()@rest[parent.name].to_quaternion().inverted()@rest[name].to_quaternion())if parent else rest[name].to_quaternion()
                pos=(desired[parent.name]@rest[parent.name].inverted()@rest[name]).translation if parent else rest[name].translation.copy()
                if name=='mixamorig:Hips':pos=rest[name].translation+inv@hipsDelta*ratio
                matrix=Matrix.Translation(pos)@q.to_matrix().to_4x4();desired[name]=matrix
                localRest=rest[parent.name].inverted()@rest[name]if parent else rest[name]
                basis=localRest.inverted()@(desired[parent.name].inverted()@matrix if parent else matrix)
                pb=base.pose.bones[name];pb.rotation_quaternion=basis.to_quaternion()
                if name in previous and pb.rotation_quaternion.dot(previous[name])<0:pb.rotation_quaternion.negate()
                previous[name]=pb.rotation_quaternion.copy();pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=name)
                if not parent:pb.location=basis.translation;pb.keyframe_insert(data_path='location',frame=frame,group=name)
            trace.append(list(hipsDelta))
        base.animation_data.action=None;track=base.animation_data.nla_tracks.new();track.name=key;strip=track.strips.new(key,start,action);strip.action_slot=action.slots[0];strip.extrapolation='NOTHING'
        meta[key]={'source':str(srcPath),'frames':[start,end],'seconds':(end-start)/30,'mappedBones':len(common),'hierarchy':hierarchy,'restSpaceRetarget':True,'proportionRatio':ratio}
        for ob in imported:bpy.data.objects.remove(ob,do_unlink=True)
        print('BAKED',kind,key,meta[key],flush=True)
    for p in base.pose.bones:p.matrix_basis=Matrix.Identity(4)
    for image in bpy.data.images:
        if image.size[0] and max(image.size)>1024:
            factor=1024/max(image.size);image.scale(round(image.size[0]*factor),round(image.size[1]*factor))
            if image.packed_file:image.pack()
    bpy.ops.object.select_all(action='DESELECT')
    for ob in baseObjects:ob.select_set(True)
    target=OUT/(kind+('-trial'if trial else '-additions')+'.glb')if kind=='warrok'or trial else DEST/(kind+'.glb')
    if jumpsOnly:target=OUT/(kind+'-jump-fix.glb')
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_cameras=False,export_lights=False,export_morph=False,export_anim_slide_to_zero=True)
    records.append({'kind':kind,'clips':meta,'output':str(target),'bytes':target.stat().st_size});(OUT/('jump-conversion.json'if jumpsOnly else 'trial-conversion.json'if trial else 'conversion.json')).write_text(json.dumps(records,indent=2))
print('EXPANSION CONVERSION COMPLETE',flush=True)
