"""Ferro-only copies: retain original skin/geometry/textures, strip unused embedded clips.
No recompression, mesh simplification or texture conversion. Only unreachable buffer data is removed.
"""
import json,struct,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PROFILES={'goblin':'goblin-tripo/green_goblin_casacarbo.glb','buttafuori':'detailed-tripo/detailed_character_casacarbo.glb','judoka':'judoka-tripo/judo_figure_casacarbo.glb','ciro':'man-tripo/man_animated.glb'}
def digest(b):return hashlib.sha256(b).hexdigest()
report={}
for name,relative in PROFILES.items():
    source=ROOT/'public/models'/relative;raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:]
    assert len(g['buffers'])==1
    assert not any(e in g.get('extensionsUsed',[]) for e in ['KHR_draco_mesh_compression','EXT_meshopt_compression'])
    clips=len(g.pop('animations',[]));refs=[]
    for mesh in g['meshes']:
        for primitive in mesh['primitives']:
            refs.extend((primitive['attributes'],key) for key in primitive['attributes'])
            if 'indices' in primitive:refs.append((primitive,'indices'))
            for target in primitive.get('targets',[]):refs.extend((target,key) for key in target)
    refs.extend((skin,'inverseBindMatrices') for skin in g.get('skins',[]) if 'inverseBindMatrices' in skin)
    used=sorted({obj[key] for obj,key in refs});accessor_map={old:i for i,old in enumerate(used)}
    for obj,key in refs:obj[key]=accessor_map[obj[key]]
    g['accessors']=[g['accessors'][i] for i in used]
    view_refs=[]
    for accessor in g['accessors']:
        if 'bufferView' in accessor:view_refs.append((accessor,'bufferView'))
        for item in accessor.get('sparse',{}).values():
            if isinstance(item,dict) and 'bufferView' in item:view_refs.append((item,'bufferView'))
    view_refs.extend((image,'bufferView') for image in g.get('images',[]) if 'bufferView' in image)
    views=sorted({obj[key] for obj,key in view_refs});view_map={old:i for i,old in enumerate(views)};packed=bytearray();retained=[]
    for i in views:
        view=dict(g['bufferViews'][i]);start=view.get('byteOffset',0);payload=binary[start:start+view['byteLength']]
        assert len(payload)==view['byteLength'];packed+=b'\0'*((-len(packed))%4);view['byteOffset']=len(packed);view['buffer']=0;packed+=payload;retained.append(view)
        # Exact retained bytes cover vertex/index streams, bind matrices and encoded images.
        assert packed[view['byteOffset']:view['byteOffset']+view['byteLength']]==payload
    for obj,key in view_refs:obj[key]=view_map[obj[key]]
    g['bufferViews']=retained;g['buffers'][0]['byteLength']=len(packed)
    g.setdefault('asset',{}).setdefault('extras',{})['ferroSource']={'path':'public/models/'+relative,'sha256':digest(raw),'removedAnimationClips':clips,'preserved':'Original geometry, weights, inverse bind matrices, materials and encoded texture bytes'}
    encoded=json.dumps(g,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);packed+=b'\0'*((-len(packed))%4)
    output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(packed))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(packed),0x004e4942)+packed
    destination=ROOT/'public/assets/ferro2'/('skin-'+name+'.glb');destination.write_bytes(output)
    report[name]={'source':str(source.relative_to(ROOT)),'sourceSha256':digest(raw),'sourceBytes':len(raw),'outputBytes':len(output),'removedClips':clips,'retainedBufferViews':len(views),'allRetainedBytesVerified':True}
    print(name,len(raw),'->',len(output),'removed clips',clips,flush=True)
(ROOT/'docs/agent-work/ferro-load-fix/skin-models.json').write_text(json.dumps(report,indent=2))
