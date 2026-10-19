# SPDX-License-Identifier: GPL-3.0-or-later
# CoD4 binary layouts adapted from mauserzjeh/cod-asset-importer (GPL-3.0).
# See THIRD_PARTY.md and GPL-3.0.txt. Only static bind-pose geometry is exported.
from pathlib import Path
import struct
import io
import numpy as np
from PIL import Image


class Reader:
    def __init__(self, path):
        self.path=Path(path);self.data=self.path.read_bytes();self.offset=0

    def read(self, fmt):
        fmt='<'+fmt;size=struct.calcsize(fmt)
        if self.offset+size>len(self.data):raise ValueError(f'truncated {self.path.name} at {self.offset}')
        values=struct.unpack_from(fmt,self.data,self.offset);self.offset+=size
        return values[0]if len(values)==1 else values

    def skip(self, size):
        self.offset+=size
        if not 0<=self.offset<=len(self.data):raise ValueError(f'invalid offset in {self.path.name}')

    def string(self, offset=None):
        if offset is not None:
            old=self.offset;self.offset=offset
        end=self.data.find(b'\0',self.offset)
        if end<self.offset:raise ValueError(f'unterminated string in {self.path.name}')
        text=self.data[self.offset:end].decode('ascii');self.offset=end+1
        if offset is not None:self.offset=old
        return text


def load_xmodel(path):
    r=Reader(path);version=r.read('H')
    if version!=25:raise ValueError(f'unsupported xmodel version {version}')
    r.skip(25);r.string();lods=[]
    for _ in range(4):
        distance=r.read('f');name=r.string()
        if name:lods.append({'name':name,'distance':distance})
    r.skip(4)
    for _ in range(r.read('I')):
        count=r.read('I');r.skip(count*48+36)
    for lod in lods:
        lod['materials']=[r.string()for _ in range(r.read('H'))]
    if not lods:raise ValueError(f'no LOD in {path}')
    return lods


def load_surfs(path, materials):
    r=Reader(path);version=r.read('H')
    if version!=25:raise ValueError(f'unsupported xmodelsurfs version {version}')
    count=r.read('H');surfaces=[]
    if count!=len(materials):raise ValueError(f'surface/material count mismatch {path}: {count}!={len(materials)}')
    for index in range(count):
        r.skip(3);nv,nt,nv2=r.read('3H')
        if nv!=nv2:
            r.skip(2)
            if nv2:
                while r.read('H')!=0:pass
                r.skip(2)
        else:r.skip(4)
        points=[];normals=[];uv=[];colors=[]
        for _ in range(nv):
            normal=r.read('3f');color=r.read('4B');tex=r.read('2f');r.skip(24)
            weights=0
            if nv!=nv2:weights=r.read('B');r.read('H')
            pos=r.read('3f');r.skip(weights*4)
            points.append(pos);normals.append(normal);uv.append(tex);colors.append(color)
        triangles=np.array([r.read('3H')for _ in range(nt)],dtype=np.uint32)[:,[0,2,1]]
        if triangles.max(initial=0)>=nv:raise ValueError(f'out-of-range vertex index in {path}')
        points=np.array(points,dtype=np.float64)
        if not np.isfinite(points).all()or abs(points).max(initial=0)>1e7:raise ValueError(f'invalid vertex in {path}')
        surfaces.append((materials[index],points,triangles,np.array(uv),np.array(normals),np.array(colors)/255.))
    if r.offset!=len(r.data):raise ValueError(f'unread surface data {path}: {len(r.data)-r.offset} bytes')
    return surfaces


def load_material(path):
    r=Reader(path);name_offset=r.read('I');r.skip(44);count=r.read('H');r.skip(2);techset_offset,textures_offset=r.read('2I')
    result={'name':r.string(name_offset),'techset':r.string(techset_offset),'textures':[]}
    r.offset=textures_offset
    for _ in range(count):
        kind,flags,name=r.read('3I')
        result['textures'].append({'kind':r.string(kind),'flags':flags,'name':r.string(name)})
    return result


def load_iwi(path):
    r=Reader(path)
    if r.data[:3]!=b'IWi' or r.data[3]!=6:raise ValueError(f'unsupported IWI header {path}')
    fmt,usage,w,h,depth=struct.unpack_from('<BBHHH',r.data,4)
    if depth!=1:raise ValueError(f'non-2D IWI {path}: depth={depth}')
    if usage&4:raise ValueError(f'cubemap IWI not a 2D diffuse map: {path}')
    size=((w+3)//4)*((h+3)//4)*({11:8,12:16,13:16}.get(fmt,0))
    # IWI mipmaps are stored smallest first, highest-resolution image last.
    if fmt in [11,12,13]:
        fourcc={11:b'DXT1',12:b'DXT3',13:b'DXT5'}[fmt]
        header=struct.pack('<7I',124,0x81007,h,w,size,0,1)+bytes(44)
        header+=struct.pack('<II4sIIIII',32,4,fourcc,0,0,0,0,0)+struct.pack('<5I',0x1000,0,0,0,0)
        if len(r.data)<28+size:raise ValueError(f'truncated IWI {path}')
        return Image.open(io.BytesIO(b'DDS '+header+r.data[-size:])).convert('RGBA')
    if fmt in [1,2,3,4]:
        channels={1:4,2:3,3:2,4:1}[fmt];data=r.data[-w*h*channels:]
        if fmt in [1,2]:return Image.frombytes('RGBA'if fmt==1 else'RGB',(w,h),data,'raw','BGRA'if fmt==1 else'BGR').convert('RGBA')
        if fmt==3:return Image.frombytes('LA',(w,h),data).convert('RGBA')
        return Image.frombytes('L',(w,h),data).convert('RGBA')
    raise ValueError(f'unsupported IWI format {fmt}: {path}')
