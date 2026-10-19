"""Focused geometry/axis/dependency checks; no multiplayer or gameplay checks."""
from pathlib import Path
import json
import struct
import hashlib
import numpy as np
from iwmap import read_map, entity_matrix, transform, geometry
from cod4_assets import load_xmodel, load_surfs
from convert import AXIS, SCALE, technical, RAW

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/agent-work/terminal-conversion'
report=json.loads((OUT/'conversion.json').read_text())
center=np.array(report['sourceOriginOffset'])


def point(p):
    return ((np.array(p)-center)@AXIS.T*SCALE).tolist()


def geometry_bounds(file):
    rows=[]
    for entity in read_map(OUT/'source/zip/map_source'/file):
        for block in entity.children:
            if not block.children:
                # Plane points are not polygon bounds, so use clipped faces.
                names=[line.split(')',3)[-1].split()[0]for line in block.lines if line.startswith('(')and line.count(')')>=3]
                if names and all(technical(n)for n in names):continue
            try:
                for name,p,*_ in geometry(block):
                    if not technical(name):rows.extend(p)
            except ValueError:
                continue  # source-invalid blocks are listed in geometry-failures
    data=np.array(rows)
    return data.min(0),data.max(0)


def accessor(doc,bin_data,index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    dtype={5126:'<f4',5125:'<u4'}[a['componentType']]
    start=v.get('byteOffset',0)+a.get('byteOffset',0)
    arr=np.frombuffer(bin_data,dtype=dtype,count=a['count']*dim,offset=start)
    return arr.reshape((-1,dim))


def run():
    path=ROOT/'public/assets/fps/terminal/terminal.glb';blob=path.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',blob)
    assert magic==b'glTF'and version==2 and length==len(blob)
    js_len,kind=struct.unpack_from('<I4s',blob,12);assert kind==b'JSON'
    doc=json.loads(blob[20:20+js_len]);start=20+js_len;bin_len,kind=struct.unpack_from('<I4s',blob,start);assert kind==b'BIN\0';binary=blob[start+8:]
    assert len(binary)==bin_len
    triangles=0;normals_off=0;mesh_triangles=[]
    for mesh in doc['meshes']:
        count=0
        for primitive in mesh['primitives']:
            p=accessor(doc,binary,primitive['attributes']['POSITION']);n=accessor(doc,binary,primitive['attributes']['NORMAL']);uv=accessor(doc,binary,primitive['attributes']['TEXCOORD_0']);ix=accessor(doc,binary,primitive['indices']).flatten()
            assert np.isfinite(p).all()and np.isfinite(n).all()and np.isfinite(uv).all()
            assert len(ix)%3==0 and ix.max(initial=0)<len(p)
            assert len(n)==len(p)==len(uv)
            assert np.max(abs(np.linalg.norm(n,axis=1)-1))<1e-4
            a=doc['accessors'][primitive['attributes']['POSITION']]
            assert np.allclose(p.min(0),a['min'],atol=1e-4)and np.allclose(p.max(0),a['max'],atol=1e-4)
            count+=len(ix)//3
        mesh_triangles.append(count);triangles+=count
    assert triangles==report['glbCounts']['uniqueTriangles']
    scene_triangles=sum(mesh_triangles[n['mesh']]for n in doc['nodes']if'mesh'in n)
    # Check actual exported instance matrices against the recovered source
    # placements, including glTF's column-major storage and root recentering.
    placed={v['source']:v for v in json.loads((OUT/'model-instances.json').read_text())}
    root_translation=np.array(doc['nodes'][0]['translation']);placements_checked=0
    for node in doc['nodes']:
        source=node.get('extras',{}).get('source')
        if source not in placed:continue
        source_matrix=np.array(placed[source]['sourceTransform'])
        matrix=np.array(node['matrix']).reshape((4,4)).T
        assert np.allclose(matrix[:3,3]+root_translation,source_matrix[:3,3]@AXIS.T*SCALE+root_translation,atol=1e-6)
        # Local X/Y/Z basis points establish rotation/scale, not just origin.
        for basis in np.eye(3):
            local=basis@AXIS.T*SCALE
            actual=matrix[:3,:3]@local+matrix[:3,3]+root_translation
            expected=(source_matrix[:3,:3]@basis+source_matrix[:3,3])@AXIS.T*SCALE+root_translation
            assert np.allclose(actual,expected,atol=1e-6)
        placements_checked+=1
    assert placements_checked==report['counts']['modelInstancesRecovered']
    # Check the authored Quake angles independently against a known quarter turn.
    m=entity_matrix({'origin':'10 20 30','angles':'0 90 0','modelscale':'2'})
    assert np.allclose(transform([[1,0,0]],m),[[10,22,30]],atol=1e-8)
    assert np.isclose(np.linalg.det(AXIS),1)
    assert np.allclose(np.array([0,0,64])@AXIS.T*SCALE,[0,1.6256,0])
    lod=load_xmodel(RAW/'xmodel/727_coach_seat01')[0]
    surfaces=load_surfs(RAW/'xmodelsurfs'/lod['name'],lod['materials'])
    p=np.concatenate([s[1]for s in surfaces]);seat_size=(p.max(0)-p.min(0))*SCALE
    assert .7<seat_size[0]<1.1 and 1.1<seat_size[2]<1.5
    for image in doc['images']:
        v=doc['bufferViews'][image['bufferView']];at=v.get('byteOffset',0)
        assert binary[at:at+8]==b'\x89PNG\r\n\x1a\n'
    presets={'airport':{'target':point([1500,6500,200]),'radius':150,'alpha':-.8,'beta':.75},
             'overview':{'target':point(center+[0,0,150]),'radius':680,'beta':.6}}
    for key,file in [('plane','prefabs/mp_terminal/bldg/airliner_flying.map'),('stairs','prefabs/mp_terminal/props/moving_stairs.map')]:
        lo,hi=geometry_bounds(file);presets[key]={'target':point((lo+hi)/2),'radius':float(max(hi-lo)*SCALE*(.9 if key=='plane' else 1.1)),'alpha':-.8,'beta':1.05}
        print(key,json.dumps({'sourceBounds':[lo.tolist(),hi.tolist()],'view':presets[key]}))
    checks={'validGLB':True,'sha256':hashlib.sha256(blob).hexdigest(),'uniqueTriangles':triangles,'sceneTrianglesWithInstances':scene_triangles,
            'images':len(doc['images']),'finiteGeometry':True,'validIndices':True,'unitNormals':True,'prefabRotationProbe':True,'properAxisRotation':True,
            'metersPerSourceUnit':SCALE,'measuredSeatMetersSourceXYZ':seat_size.tolist(),'actualPlacementsChecked':placements_checked,'spawnDataUsedAsProof':False}
    (OUT/'geometry-checks.json').write_text(json.dumps(checks,indent=2),encoding='utf8')
    (OUT/'inspection.json').write_text(json.dumps({'presets':presets,'cameraSource':'authored geometry bounds; no spawn data'},indent=2),encoding='utf8')
    print(json.dumps(checks))


if __name__=='__main__':run()
