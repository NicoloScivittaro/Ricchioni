"""Derive an articulated box from the supplied open variant; leave the source intact."""
from pathlib import Path
import copy, hashlib, io, json, math, sys
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'monsters'))
from gltf import load, save, accessor, add, globalize, parents, trs

root = Path(__file__).resolve().parents[2]
source = Path.home() / 'Downloads/call_of_duty_black_ops_mystery_box.glb'
g, b = load(source)
world = globalize([trs(n) for n in g['nodes']], parents(g))
parts = []
for i, node in enumerate(g['nodes']):
    if 'mesh' not in node:
        continue
    for primitive in g['meshes'][node['mesh']]['primitives']:
        p = copy.deepcopy(primitive)
        m = world[i]
        v = accessor(g, b, p['attributes']['POSITION'])
        v = (m @ np.c_[v, np.ones(len(v))].T).T[:, :3]
        if v[:, 0].mean() > 0:  # Authored open variant is on the right.
            parts.append((p, v, m, g['materials'][p['material']]['name']))
all_vertices = np.concatenate([v for _, v, _, _ in parts])
lo, hi = all_vertices.min(0), all_vertices.max(0)
scale = 2.2 / (hi[0] - lo[0])
origin = np.array([(lo[0] + hi[0]) / 2, lo[1], 0])
# Two exact lid edge vertices identify the hinge. The supplied lid is open 105 degrees.
lid_vertices = next(v for _, v, _, mat in parts if mat == 'blinn9SG')
lid_vertices = (lid_vertices - origin) * scale
edge = lid_vertices[np.argmax(lid_vertices[:, 2])]
hinge = np.array([0, edge[1], edge[2]])
angle = math.radians(105)
c, s = math.cos(angle), math.sin(angle)
closed_rotation = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
nodes, meshes, body = [], [], []
lid = None
removed = []
for p, v, m, mat in parts:
    if mat == 'blinn12SG':  # The separate rectangular paper sign inside the lid.
        removed.append({'material': mat, 'vertices': len(v)})
        continue
    is_lid = mat == 'blinn9SG'
    v = (v - origin) * scale
    if is_lid:
        v = (v - hinge) @ closed_rotation.T
    index = add(g, b, v, 'VEC3')
    g['accessors'][index].update(min=v.min(0).tolist(), max=v.max(0).tolist())
    p['attributes']['POSITION'] = index
    if 'NORMAL' in p['attributes']:
        n = accessor(g, b, p['attributes']['NORMAL']) @ np.linalg.inv(m[:3, :3])
        if is_lid:
            n = n @ closed_rotation.T
        n /= np.linalg.norm(n, axis=1)[:, None]
        p['attributes']['NORMAL'] = add(g, b, n, 'VEC3')
    if 'TANGENT' in p['attributes']:
        t = accessor(g, b, p['attributes']['TANGENT']).copy()
        t[:, :3] = t[:, :3] @ m[:3, :3].T
        if is_lid:
            t[:, :3] = t[:, :3] @ closed_rotation.T
        t[:, :3] /= np.linalg.norm(t[:, :3], axis=1)[:, None]
        t[:, 3] *= np.sign(np.linalg.det(m[:3, :3]))
        p['attributes']['TANGENT'] = add(g, b, t, 'VEC4')
    meshes.append({'name': mat, 'primitives': [p]})
    nodes.append({'name': 'MysteryBox_lid' if is_lid else 'MysteryBox_body_' + mat, 'mesh': len(meshes) - 1})
    if is_lid:
        lid = len(nodes) - 1
    else:
        body.append(len(nodes) - 1)
assert len(removed) == 1 and removed[0]['vertices'] == 24 and lid is not None
body_index = len(nodes)
nodes.append({'name': 'body', 'children': body})
hinge_index = len(nodes)
nodes.append({'name': 'lidHinge', 'translation': hinge.tolist(), 'children': [lid], 'extras': {'openAngle': -angle}})
g['nodes'], g['meshes'] = nodes, meshes
g['scenes'], g['scene'] = [{'nodes': [body_index, hinge_index]}], 0
# Keep only the textures actually used by this variant, then resize and compact the binary.
used_materials = sorted({p['primitives'][0]['material'] for p in meshes})
material_map = {old: new for new, old in enumerate(used_materials)}
g['materials'] = [g['materials'][i] for i in used_materials]
for mesh in meshes:
    mesh['primitives'][0]['material'] = material_map[mesh['primitives'][0]['material']]
def texture_refs(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                yield child
            else:
                yield from texture_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from texture_refs(child)
refs = list(texture_refs(g['materials']))
used_textures = sorted({ref['index'] for ref in refs})
texture_map = {old: new for new, old in enumerate(used_textures)}
g['textures'] = [g['textures'][i] for i in used_textures]
for ref in refs:
    ref['index'] = texture_map[ref['index']]
used_images = sorted({texture['source'] for texture in g['textures']})
image_map = {old: new for new, old in enumerate(used_images)}
g['images'] = [g['images'][i] for i in used_images]
for texture in g['textures']:
    texture['source'] = image_map[texture['source']]
colors = {g['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
          for m in g['materials'] if 'baseColorTexture' in m.get('pbrMetallicRoughness', {})}
for i, image in enumerate(g['images']):
    view = g['bufferViews'][image['bufferView']]
    raw = bytes(b[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])
    im = Image.open(io.BytesIO(raw))
    size = im.size
    limit = 1024 if i in colors else 512
    im.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    if im.size == size:
        continue
    output = io.BytesIO()
    jpeg = image['mimeType'] == 'image/jpeg'
    im.save(output, format='JPEG' if jpeg else 'PNG', **({'quality': 92, 'optimize': True} if jpeg else {'optimize': True}))
    raw = output.getvalue()
    b += b'\0' * (-len(b) % 4)
    g['bufferViews'].append({'buffer': 0, 'byteOffset': len(b), 'byteLength': len(raw)})
    b += raw
    image['bufferView'] = len(g['bufferViews']) - 1
used_accessors = sorted({i for mesh in meshes for p in mesh['primitives'] for i in [*p['attributes'].values(), *([p['indices']] if 'indices' in p else [])]})
accessor_map = {old: new for new, old in enumerate(used_accessors)}
g['accessors'] = [g['accessors'][i] for i in used_accessors]
for mesh in meshes:
    for p in mesh['primitives']:
        p['attributes'] = {k: accessor_map[i] for k, i in p['attributes'].items()}
        if 'indices' in p:
            p['indices'] = accessor_map[p['indices']]
used_views = sorted({a['bufferView'] for a in g['accessors']} | {i['bufferView'] for i in g['images']})
new, views, mapping = bytearray(), [], {}
for i in used_views:
    view = copy.deepcopy(g['bufferViews'][i])
    start = view.get('byteOffset', 0)
    new += b'\0' * (-len(new) % 4)
    view['byteOffset'] = len(new)
    new += b[start:start + view['byteLength']]
    mapping[i] = len(views)
    views.append(view)
g['bufferViews'] = views
for a in g['accessors']:
    a['bufferView'] = mapping[a['bufferView']]
for image in g['images']:
    image['bufferView'] = mapping[image['bufferView']]
g['extras'] = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'width': 2.2, 'removed': removed, 'hinge': hinge.tolist(), 'openAngle': -angle}
dest = root / 'public/assets/orda/mystery-box.glb'
save(dest, g, new)
report = {**g['extras'], 'bytes': dest.stat().st_size, 'meshes': len(meshes), 'textures': len(g['images']), 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()}
(root / 'docs/agent-work/orda-box-polish/asset.json').write_text(json.dumps(report, indent=2), encoding='utf8')
credits = root / 'public/assets/orda/CREDITS.md'
text = credits.read_text(encoding='utf8').split('\n## Articulated derivative')[0]
credits.write_text(text + '\n## Articulated derivative\n\nUses the original open variant body and lid, articulated at its rear hinge. Only the separate interior paper sign (blinn12SG, 24 vertices) is removed. Lid is rebased to a closed pose for runtime animation. Unused variant materials/textures are omitted. Original Downloads file unchanged.\n', encoding='utf8')
print(json.dumps(report))
