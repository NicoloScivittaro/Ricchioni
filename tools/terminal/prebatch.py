"""Prepare Terminal's existing spatial batches and GPU instances offline.

No collision changes or triangle simplification. EXT_mesh_gpu_instancing is
supported by the installed Babylon loader; all source transforms are preserved.
"""
from collections import defaultdict
import json, struct
import numpy as np
from prepare_arena import ROOT, Packed, access

def quaternion(m):
    # Eigenvector formulation avoids unstable divisions around 180 degrees.
    xx,xy,xz=m[0];yx,yy,yz=m[1];zx,zy,zz=m[2]
    k=np.array([[xx-yy-zz,xy+yx,xz+zx,zy-yz],
                [xy+yx,yy-xx-zz,yz+zy,xz-zx],
                [xz+zx,yz+zy,zz-xx-yy,yx-xy],
                [zy-yz,xz-zx,yx-xy,xx+yy+zz]])/3
    _,v=np.linalg.eigh(k);q=v[:,-1]
    return q if q[3]>=0 else -q

def run():
    raw=(ROOT/'public/assets/fps/terminal/terminal-play.glb').read_bytes()
    size=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+size]);b=raw[28+size:]
    out=Packed(d);out.d['extensionsUsed']=['EXT_mesh_gpu_instancing'];out.d['extensionsRequired']=['EXT_mesh_gpu_instancing']
    # Copy only the images used by the compact atlases, not source image buffers.
    for im in out.d['images']:
        v=d['bufferViews'][im['bufferView']];im['bufferView']=out.view(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
    props=defaultdict(list);static=defaultdict(list);total=0
    def attrs(pr):return {k:access(d,b,a) for k,a in pr['attributes'].items()}
    def transformed(a,m):
        r={k:v.copy() for k,v in a.items()};r['POSITION']=a['POSITION']@m[:3,:3].T+m[:3,3]
        n=a['NORMAL']@np.linalg.inv(m[:3,:3]);r['NORMAL']=n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-10)
        return r
    def add_static(a,ix,mat):
        keys=np.floor(a['POSITION'][ix].mean(1)[:,[0,2]]/64).astype(int)
        for key in np.unique(keys,axis=0):
            sub=ix[np.all(keys==key,axis=1)];verts,indices=np.unique(sub.flatten(),return_inverse=True)
            static[(mat,*key)].append(({k:v[verts] for k,v in a.items()},indices))
    for node in d['nodes']:
        if 'mesh'not in node:continue
        m=np.array(node.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T
        for pi,pr in enumerate(d['meshes'][node['mesh']]['primitives']):
            a=attrs(pr);ix=access(d,b,pr['indices']).reshape(-1,3);total+=len(ix)
            if node['name'].startswith('terminalZone/'):
                add_static(transformed(a,m),ix,pr['material'])
            else:
                p=a['POSITION']@m[:3,:3].T+m[:3,3];c=(p.min(0)+p.max(0))/2
                props[(node['mesh'],pi,pr['material'],*np.floor(c[[0,2]]/32).astype(int))].append(m)
    def mesh(name,pr):
        mi=len(out.d['meshes']);out.d['meshes'].append({'name':name,'primitives':[pr]});return mi
    def node(n):out.d['nodes'][0]['children'].append(len(out.d['nodes']));out.d['nodes'].append(n)
    def packed(arr,kind):
        if kind=='COLOR_0':
            v=np.uint8(np.clip(np.round(arr*255),0,255));rec={'bufferView':out.view(v.tobytes(),34962),'componentType':5121,'normalized':True,'count':len(v),'type':'VEC4'}
        elif kind=='indices'and int(arr.max())<65536:
            v=np.asarray(arr,dtype='<u2').flatten();rec={'bufferView':out.view(v.tobytes(),34963),'componentType':5123,'count':len(v),'type':'SCALAR'}
        else:return out.acc(arr.flatten(),True)if kind=='indices'else out.acc(arr)
        out.d['accessors'].append(rec);return len(out.d['accessors'])-1
    def primitive(a,ix,mat):return {'attributes':{k:packed(v,k) for k,v in a.items()},'indices':packed(ix,'indices'),'material':mat,'mode':4}
    geometries={};instances=0;groups=0;max_error=0
    for (mi,pi,mat,cx,cz),matrices in props.items():
        pr=d['meshes'][mi]['primitives'][pi];a=attrs(pr);ix=access(d,b,pr['indices']).reshape(-1,3)
        if len(matrices)<4:
            for m in matrices:add_static(transformed(a,m),ix,mat)
            continue
        key=(mi,pi);name=f'terminalInstances/{mi}/{pi}/{cx}/{cz}'
        if key not in geometries:geometries[key]=mesh(name,primitive(a,ix,mat))
        translations=[];rotations=[];scales=[]
        for m in matrices:
            scale=np.linalg.norm(m[:3,:3],axis=0);rot=m[:3,:3]/scale
            if np.linalg.det(rot)<0:scale[0]*=-1;rot[:,0]*=-1
            if not np.allclose(rot.T@rot,np.eye(3),atol=1e-5):raise ValueError('Sheared source instance cannot be represented by TRS')
            q=quaternion(rot);x,y,z,w=q
            rebuilt=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                              [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                              [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
            max_error=max(max_error,float(abs(rebuilt@np.diag(scale)-m[:3,:3]).max()))
            translations.append(m[:3,3]);rotations.append(q);scales.append(scale)
        if max_error>1e-5:raise ValueError('Instance transform mismatch')
        node({'name':name,'mesh':geometries[key],'extensions':{'EXT_mesh_gpu_instancing':{'attributes':{'TRANSLATION':out.acc(translations),'ROTATION':out.acc(rotations),'SCALE':out.acc(scales)}}}})
        instances+=len(matrices);groups+=1
    for (mat,cx,cz),parts in static.items():
        a={k:np.concatenate([p[k]for p,_ in parts])for k in parts[0][0]};ix=[];offset=0
        for p,i in parts:ix.append(i+offset);offset+=len(p['POSITION'])
        name=f'terminalBatch/{cx}/{cz}/{mat}';node({'name':name,'mesh':mesh(name,primitive(a,np.concatenate(ix),mat))})
    out.d['nodes'][0]['extras']={'prebatched':True,'triangles':total,'staticBatchMeters':64,'instances':instances,'instanceGroups':groups,'staticBatches':len(static)}
    out.d['buffers']=[{'byteLength':len(out.bin)}];js=json.dumps(out.d,separators=(',',':')).encode();js+=b' '*((-len(js))%4);out.bin.extend(bytes((-len(out.bin))%4));total_bytes=28+len(js)+len(out.bin)
    (ROOT/'public/assets/fps/terminal/terminal-fast.glb').write_bytes(struct.pack('<4sII',b'glTF',2,total_bytes)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(out.bin),b'BIN\0')+out.bin)
    collision=json.loads((ROOT/'public/assets/fps/terminal/arena.json').read_text(encoding='utf8'))
    (ROOT/'public/assets/fps/terminal/render-config.json').write_text(json.dumps({k:collision[k]for k in ('barriers','accessSteps')},separators=(',',':')),encoding='utf8')
    report={**out.d['nodes'][0]['extras'],'bytes':total_bytes,'maxTransformError':max_error,'collisionDataChanged':False}
    (ROOT/'docs/agent-work/terminal-2-4/prebatch.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))

if __name__=='__main__':run()
