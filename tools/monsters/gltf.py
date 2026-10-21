"""Rest-space offline humanoid retarget. Keeps target mesh, bind matrices and bone lengths.
No commercial assets fetched. No third party runtime retargeting dependency.
"""
import json,struct,math,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2];DEST=ROOT/'public/assets/monsters';OUT=ROOT/'docs/agent-work/monster-system'
def load(path):
    data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];return json.loads(data[20:20+n]),bytearray(data[28+n:])
def save(path,g,b):
    g['buffers'][0]['byteLength']=len(b);j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b)
def accessor(g,b,index):
    a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    return np.frombuffer(b,dtype='<f4',count=a['count']*width,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width).copy()
def quatmat(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def matquat(m):
    # Symmetric eigenproblem is stable at rotations near pi.
    x=m;K=np.array([[x[0,0]-x[1,1]-x[2,2],x[0,1]+x[1,0],x[0,2]+x[2,0],x[2,1]-x[1,2]],[x[0,1]+x[1,0],x[1,1]-x[0,0]-x[2,2],x[1,2]+x[2,1],x[0,2]-x[2,0]],[x[0,2]+x[2,0],x[1,2]+x[2,1],x[2,2]-x[0,0]-x[1,1],x[1,0]-x[0,1]],[x[2,1]-x[1,2],x[0,2]-x[2,0],x[1,0]-x[0,1],x[0,0]+x[1,1]+x[2,2]]])/3
    _,v=np.linalg.eigh(K);q=v[:,-1];return q if q[3]>=0 else -q
def trs(n):
    if 'matrix'in n:return np.array(n['matrix']).reshape(4,4).T
    a=np.eye(4);a[:3,:3]=quatmat(n.get('rotation',[0,0,0,1]))@np.diag(n.get('scale',[1,1,1]));a[:3,3]=n.get('translation',[0,0,0]);return a
def rotation(m):
    a=m[:3,:3];return a/np.linalg.norm(a,axis=0)
def parents(g):return{c:i for i,n in enumerate(g['nodes'])for c in n.get('children',[])}
def globalize(local,par):
    result={}
    def get(i):
        if i not in result:result[i]=get(par[i])@local[i] if i in par else local[i]
        return result[i]
    for i in range(len(local)):get(i)
    return result
def add(g,b,values,kind):
    arr=np.asarray(values,dtype='<f4');b+=b'\0'*((-len(b))%4);off=len(b);b+=arr.tobytes();g.setdefault('bufferViews',[]).append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes});a={'bufferView':len(g['bufferViews'])-1,'componentType':5126,'count':len(arr),'type':kind}
    if kind=='SCALAR':a.update(min=[float(arr.min())],max=[float(arr.max())])
    g['accessors'].append(a);return len(g['accessors'])-1
