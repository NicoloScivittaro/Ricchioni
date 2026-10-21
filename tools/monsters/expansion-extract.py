from pathlib import Path
from zipfile import ZipFile
import hashlib,json,shutil,subprocess
root=Path(__file__).resolve().parents[2];out=root/'docs/agent-work/monster-expansion';out.mkdir(parents=True,exist_ok=True);cache=Path('C:/Users/niluf.PC-NIKO/.cache/party-monsters/expansion-1.2');cache.mkdir(parents=True,exist_ok=True)
if not(out/'baseline.json').exists():
    files=[p for folder in ['src/monsters','src/minigames/orda','shared/orda','src/minigames/backrooms','tools/monsters','public/assets/monsters']for p in (root/folder).rglob('*')if p.is_file() and '__pycache__'not in p.parts]
    manifest={}
    for p in files:
        rel=p.relative_to(root);dst=out/'baseline'/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst);manifest[str(rel)]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    (out/'baseline.json').write_text(json.dumps({'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True,cwd=root).strip(),'files':manifest},indent=2))
archives=[]
for i,key in enumerate(['warrok','zombiegirl','yaku','pumpkinhulk']):
    name='Creature NPC Pack'+(' ('+str(i)+')'if i else '')+'.zip';p=Path('C:/Users/niluf.PC-NIKO/Downloads')/name;folder=cache/key;folder.mkdir(exist_ok=True)
    with ZipFile(p)as z:
        for f in z.infolist():
            target=(folder/f.filename).resolve();assert target.is_relative_to(folder.resolve())
            if not f.is_dir():target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(f))
    files=[{'name':f.name,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}for f in folder.glob('*.fbx')]
    archives.append({'id':key,'archive':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'files':files})
(out/'archives.json').write_text(json.dumps(archives,indent=2));print('Saved prior Monster System baseline; safely extracted four archives to task cache.')
