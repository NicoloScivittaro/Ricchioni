import bpy,json
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath='C:/Users/niluf.PC-NIKO/Downloads/ray_gun_-_call_of_duty.glb')
for ob in bpy.context.scene.objects:
 if ob.type=='MESH':print('MESH_AUDIT',json.dumps({'name':ob.name,'mesh':ob.data.name,'verts':len(ob.data.vertices),'hideRender':ob.hide_render,'hideViewport':ob.hide_viewport,'hideGet':ob.hide_get(),'display':ob.display_type,'materials':[m.name if m else None for m in ob.data.materials],'collections':[c.name for c in ob.users_collection]}))
