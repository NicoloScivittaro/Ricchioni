"""Read the iwmap 4 constructs actually present in Terminal. Source units/Z-up.

Brushes are clipped convex planes; mesh grids are linear; curve grids are
piecewise quadratic Bezier patches. Nothing is replaced with proxy boxes.
"""
from dataclasses import dataclass, field
from pathlib import Path
import math
import re
import numpy as np


@dataclass
class Block:
    line: int
    lines: list = field(default_factory=list)
    children: list = field(default_factory=list)

    def properties(self):
        return dict(re.findall(r'^"([^"]+)"\s+"([^"]*)"', '\n'.join(self.lines), re.M))


def read_map(path):
    text = Path(path).read_text(encoding='utf-8-sig')
    if not text.startswith('iwmap 4'):
        raise ValueError(f'unsupported map header: {path}')
    root, stack = Block(0), []
    stack.append(root)
    for i, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('//'):
            continue
        if line == '{':
            b = Block(i)
            stack[-1].children.append(b)
            stack.append(b)
        elif line == '}':
            if len(stack) == 1:
                raise ValueError(f'unmatched brace {path}:{i}')
            stack.pop()
        else:
            stack[-1].lines.append(line)
    if len(stack) != 1:
        raise ValueError(f'unclosed block {path}')
    return root.children


def entity_matrix(properties):
    p = properties
    origin = np.fromstring(p.get('origin', '0 0 0'), sep=' ')
    angles = np.fromstring(p.get('angles', '0 '+p.get('angle', '0')+' 0'), sep=' ')
    if len(origin) != 3 or len(angles) != 3:
        raise ValueError(f'invalid transform: {p}')
    pitch, yaw, roll = np.radians(angles)
    cp, sp, cy, sy, cr, sr = math.cos(pitch), math.sin(pitch), math.cos(yaw), math.sin(yaw), math.cos(roll), math.sin(roll)
    # Quake/CoD angles are pitch/yaw/roll. Basis: forward, -right, up.
    rotation = np.array([[cp*cy, sr*sp*cy-cr*sy, cr*sp*cy+sr*sy],
                         [cp*sy, sr*sp*sy+cr*cy, cr*sp*sy-sr*cy],
                         [-sp, sr*cp, cr*cp]])
    scale = np.fromstring(p.get('modelscale_vec', p.get('modelscale', '1')), sep=' ')
    if len(scale) == 1:
        scale = np.repeat(scale, 3)
    if len(scale) != 3 or np.any(abs(scale) < 1e-8):
        raise ValueError(f'invalid scale: {p}')
    m = np.eye(4)
    m[:3, :3] = rotation @ np.diag(scale)
    m[:3, 3] = origin
    return m


def transform(points, matrix):
    return np.asarray(points) @ matrix[:3, :3].T + matrix[:3, 3]


def clip(poly, normal, distance):
    out = []
    for i, a in enumerate(poly):
        b = poly[(i+1) % len(poly)]
        da, db = np.dot(a, normal)-distance, np.dot(b, normal)-distance
        if da <= 1e-5:
            out.append(a)
        if (da <= 1e-5) != (db <= 1e-5):
            out.append(a+(b-a)*(da/(da-db)))
    return out


def brush_faces(block):
    planes = []
    for line in block.lines:
        if not line.startswith('('):
            continue
        groups = re.findall(r'\(\s*([^()]*)\)', line)
        if len(groups) < 3:
            raise ValueError(f'invalid plane at line {block.line}')
        a, b, c = [np.fromstring(v, sep=' ') for v in groups[:3]]
        n = -np.cross(b-a, c-a)
        length = np.linalg.norm(n)
        if length < 1e-9:
            raise ValueError(f'degenerate source plane at line {block.line}')
        n /= length
        tail = line[line.find(')', line.find(')', line.find(')')+1)+1)+1:].split()
        material = tail[0]
        params = [float(v) for v in tail[1:7]]
        planes.append((n, np.dot(n, a), material, params))
    if len(planes) < 4:
        raise ValueError(f'not a convex brush at line {block.line}')
    result = []
    for i, (n, d, material, params) in enumerate(planes):
        axis = np.array([0., 0., 1.]) if abs(n[2]) < .9 else np.array([0., 1., 0.])
        u = np.cross(axis, n); u /= np.linalg.norm(u)
        v = np.cross(n, u)
        center = n*d
        poly = [center+131072*(u*x+v*y) for x, y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        for j, (nn, dd, _, _) in enumerate(planes):
            if j != i and poly:
                poly = clip(poly, nn, dd)
        clean = []
        for point in poly:
            if not clean or np.linalg.norm(point-clean[-1]) > .001:
                clean.append(point)
        if len(clean) > 2 and np.linalg.norm(clean[0]-clean[-1]) < .001:
            clean.pop()
        if len(clean) < 3:
            continue  # redundant clipping plane, not a missing surface
        points = np.array(clean)
        if np.max(abs(points)) > 130000:
            raise ValueError(f'unbounded brush at line {block.line}')
        # CoD iwmap texture sizes are map units per repeat, followed by shifts,
        # rotation and surface flags. Keep source texture projection per face.
        major = np.argmax(abs(n))
        su, sv = ([0,1,0],[0,0,-1]) if major == 0 else (([1,0,0],[0,0,-1]) if major == 1 else ([1,0,0],[0,-1,0]))
        uv = points @ np.array([su, sv]).T
        w, h, shift_u, shift_v, rotation, flags = params
        theta = math.radians(rotation)
        uv = uv @ np.array([[math.cos(theta), math.sin(theta)],[-math.sin(theta),math.cos(theta)]]).T
        uv = (uv+np.array([shift_u,shift_v]))/np.array([w or 1,h or 1])
        triangles = np.array([[0,j,j+1] for j in range(1,len(points)-1)],dtype=np.uint32)
        result.append((material, points, triangles, uv, np.tile(n,(len(points),1)), None))
    if not result:
        raise ValueError(f'empty convex brush at line {block.line}')
    return result


def grid_faces(block, subdivisions=8):
    kind = block.lines[0]
    assert kind in ['mesh', 'curve'] and len(block.children) == 1
    lines = block.children[0].lines
    dimension_line = next(i for i,s in enumerate(lines) if re.fullmatch(r'\d+\s+\d+\s+\d+\s+\d+',s))
    material = [s for s in lines[:dimension_line] if len(s.split())==1 and not s.endswith(';')][0]
    width, height, *_ = map(int, lines[dimension_line].split())
    rows = []
    for line in lines[dimension_line+1:]:
        if not line.startswith('v '):
            continue
        pos = np.fromstring(line[2:].split(' t ')[0].split(' c ')[0], sep=' ')
        uv = np.fromstring(line.split(' t ')[1].split(' f ')[0], sep=' ')[:2]/1024.
        color = np.ones(4)
        if ' c ' in line:
            color = np.fromstring(line.split(' c ')[1].split(' t ')[0],sep=' ')[:4]/255.
        rows.append(np.r_[pos, uv, color])
    if len(rows) != width*height:
        raise ValueError(f'grid size mismatch at line {block.line}: {width}*{height}!={len(rows)}')
    control = np.array(rows).reshape((width,height,9))
    if kind == 'mesh':
        data = control
    else:
        if width%2 != 1 or height%2 != 1:
            raise ValueError(f'non-quadratic source curve at line {block.line}')
        data = np.zeros((((width-1)//2)*subdivisions+1,((height-1)//2)*subdivisions+1,9))
        for i in range(0,width-2,2):
            for j in range(0,height-2,2):
                patch = control[i:i+3,j:j+3]
                for x in range(subdivisions+1):
                    u = x/subdivisions; bu = np.array([(1-u)**2,2*u*(1-u),u*u])
                    for y in range(subdivisions+1):
                        v = y/subdivisions; bv = np.array([(1-v)**2,2*v*(1-v),v*v])
                        data[i//2*subdivisions+x,j//2*subdivisions+y] = np.einsum('i,j,ijk->k',bu,bv,patch)
    w,h,_=data.shape
    indices=[]
    for i in range(w-1):
        for j in range(h-1):
            a=i*h+j;b=(i+1)*h+j
            indices.extend([[a,b,a+1],[a+1,b,b+1]])
    points=data[:,:,:3].reshape((-1,3));uv=data[:,:,3:5].reshape((-1,2))
    normals=np.zeros_like(points);triangles=np.array(indices,dtype=np.uint32)
    for tri in triangles:
        a,b,c=points[tri];normal=np.cross(b-a,c-a)
        for k in tri:normals[k]+=normal
    lengths=np.linalg.norm(normals,axis=1);normals/=np.maximum(lengths[:,None],1e-12)
    return [(material,points,triangles,uv,normals,data[:,:,5:9].reshape((-1,4)))]


def geometry(block):
    if block.lines and block.lines[0] in ['mesh','curve']:
        return grid_faces(block)
    return brush_faces(block)
