"""Read-only source audit, FK/contact candidates and FBX inventory. No retarget/compression."""
import bisect, hashlib, json, math, pathlib, struct, zlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).parent
SOURCE = pathlib.Path.home() / 'Downloads/detailed+character+3d+model (1).glb'
# Reuse the already reviewed structural auditor with isolated output/source.
old = (OUT.parent / 'goblin-tripo-pilot/analyze_glb.py').read_text(encoding='utf-8')
old = old.replace('SOURCE = pathlib.Path(r"C:\\Users\\niluf.PC-NIKO\\Downloads\\green+goblin+3d+model.glb")', 'SOURCE = NEW_SOURCE')
old = old.replace('OUT = pathlib.Path(__file__).parent', 'OUT = NEW_OUT')
old = old[:old.rfind('print(json.dumps')]
old = old.replace('image = g["images"][0]', "image = next(i for i in g['images'] if i['mimeType']=='image/jpeg')")
env = {'NEW_SOURCE': SOURCE, 'NEW_OUT': OUT}
exec(compile(old, 'structural-auditor', 'exec'), env)
g, accessor = env['g'], env['accessor']
textures=[]
for image in g['images']:
    view=g['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0)
    data=env['binary'][offset:offset+view['byteLength']]
    dimensions=list(struct.unpack_from('>II',data,16)) if image['mimeType']=='image/png' else env['jpeg_size'](data)
    textures.append({'name':image['name'],'mime':image['mimeType'],'dimensions':dimensions,'bytes':len(data),'rgba8MipMiB':dimensions[0]*dimensions[1]*4*4/3/2**20})
(OUT/'textures.json').write_text(json.dumps(textures,indent=2),encoding='utf-8')
print({k:env["report"][k] for k in ("sha256","vertices","triangles","joints","animations")})
