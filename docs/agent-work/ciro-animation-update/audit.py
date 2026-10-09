"""Read-only structural audit plus comparison of the previous Ciro and the new export."""
import hashlib, json, pathlib, struct
OUT = pathlib.Path(__file__).parent
ROOT = OUT.parents[2]
SOURCE = pathlib.Path(r'C:/Users/niluf.PC-NIKO/Downloads/man+3d+model (1).glb')
base = (OUT.parent / 'goblin-tripo-pilot/analyze_glb.py').read_text(encoding='utf-8')
base = base.replace('SOURCE = pathlib.Path(r"C:\\Users\\niluf.PC-NIKO\\Downloads\\green+goblin+3d+model.glb")', 'SOURCE = NEW_SOURCE')
base = base.replace('OUT = pathlib.Path(__file__).parent', 'OUT = NEW_OUT')
base = base[:base.rfind('print(json.dumps')]
base = base.replace('image = g["images"][0]', "image = next(i for i in g['images'] if i['mimeType']=='image/jpeg')")
env = {'NEW_SOURCE': SOURCE, 'NEW_OUT': OUT}
exec(compile(base, 'structural-auditor', 'exec'), env)
def read(path):
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    g = json.loads(raw[20:20+size])
    return g, raw[28+size:], raw
def view(g, binary, ix):
    v = g['bufferViews'][ix]; off = v.get('byteOffset', 0)
    return binary[off:off+v['byteLength']]
def acc(g, binary, ix):
    a = g['accessors'][ix]; v = g['bufferViews'][a['bufferView']]
    size = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]
    count = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    off = v.get('byteOffset',0)+a.get('byteOffset',0)
    stride = v.get('byteStride',size*count)
    return b''.join(binary[off+i*stride:off+i*stride+size*count] for i in range(a['count']))
def animhash(g,binary,a):
    tracks = []
    for c in a['channels']:
        s = a['samplers'][c['sampler']]
        tracks.append((g['nodes'][c['target']['node']]['name'],c['target']['path'],s.get('interpolation','LINEAR'),acc(g,binary,s['input']),acc(g,binary,s['output'])))
    return hashlib.sha256(repr(sorted(tracks)).encode()).hexdigest()
old, ob, oldraw = read(ROOT/'public/models/man-tripo/man.glb')
new, nb, newraw = read(SOURCE)
old_anims = {a['name']:animhash(old,ob,a) for a in old['animations']}
spec_path = OUT/'previous-clips.json'
if not spec_path.exists(): spec_path = ROOT/'src/minigames/characters/ciroClips.json'
old_specs = {c['original']:c for c in json.loads(spec_path.read_text())}
rows = []
for i,a in enumerate(new['animations']):
    starts = [new['accessors'][s['input']]['min'][0] for s in a['samplers']]
    ends = [new['accessors'][s['input']]['max'][0] for s in a['samplers']]
    rows.append({'index':i,'original':a['name'],'start':min(starts),'end':max(ends),'channels':len(a['channels']),'bones':len({c['target']['node'] for c in a['channels']}),'existing':old_specs.get(a['name'],{}).get('name'),'unchanged':old_anims.get(a['name'])==animhash(new,nb,a) if a['name'] in old_anims else None})
mesh_data = lambda g,b: [[{k:hashlib.sha256(acc(g,b,i)).hexdigest() for k,i in p['attributes'].items()} | {'indices':hashlib.sha256(acc(g,b,p['indices'])).hexdigest()} for p in m['primitives']] for m in g['meshes']]
textures = lambda g,b: [hashlib.sha256(view(g,b,i['bufferView'])).hexdigest() for i in g['images']]
report = {'source':str(SOURCE),'bytes':len(newraw),'sha256':hashlib.sha256(newraw).hexdigest(),'oldSha256':hashlib.sha256(oldraw).hexdigest(),'sameGeometryAndSkinAttributes':mesh_data(old,ob)==mesh_data(new,nb),'sameTextures':textures(old,ob)==textures(new,nb),'sameBindMatrices':acc(old,ob,old['skins'][0]['inverseBindMatrices'])==acc(new,nb,new['skins'][0]['inverseBindMatrices']),'sameBoneNames':[[old['nodes'][i]['name'] for i in s['joints']] for s in old['skins']]==[[new['nodes'][i]['name'] for i in s['joints']] for s in new['skins']],'clips':rows}
material_parameters = lambda g: [{k:v for k,v in m.items() if k!='name'} for m in g['materials']]
report['sameMaterialParameters'] = material_parameters(old)==material_parameters(new) and old['textures']==new['textures'] and old.get('samplers')==new.get('samplers')
report['materialNamesChanged'] = [m.get('name') for m in old['materials']] != [m.get('name') for m in new['materials']]
(OUT/'comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='clips'},indent=2))
print(f"Clips: {len(rows)}, existing unchanged: {sum(r['unchanged'] is True for r in rows)}, new: {sum(r['unchanged'] is None for r in rows)}")
