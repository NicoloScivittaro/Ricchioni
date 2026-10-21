from gltf import *
import hashlib
OUT=ROOT/'docs/agent-work/monster-expansion'
archives=json.loads((OUT/'archives.json').read_text());cache=Path('C:/Users/niluf.PC-NIKO/.cache/party-monsters/expansion-1.2')
for package in archives:
    path=Path('C:/Users/niluf.PC-NIKO/Downloads')/package['archive'];assert hashlib.sha256(path.read_bytes()).hexdigest()==package['sha256']
    for f in package['files']:assert hashlib.sha256((cache/package['id']/f['name']).read_bytes()).hexdigest()==f['sha256']
old,ob=load(OUT/'baseline/public/assets/monsters/warrok.glb');new,nb=load(DEST/'warrok.glb')
for key in ['nodes','meshes','skins','materials','images','textures']:assert old[key]==new[key],key
for a in old['animations']:assert a==next(b for b in new['animations']if b['name']==a['name']),a['name']
assert ob==nb[:len(ob)],'Existing Warrok geometry/texture bytes changed'
results=[]
for kind,count in [('warrok',13),('zombiegirl',10),('yaku',11),('pumpkinhulk',10)]:
    path=DEST/(kind+'.glb');g,b=load(path);names=[a['name']for a in g['animations']];assert len(names)==len(set(names))==count;assert len(g['skins'])==1
    assert all(n in names for n in ['IDLE','BREATHING_IDLE','WALK','RUN','SWIPE','DEATH','TURN_LEFT','TURN_RIGHT','TAUNT'])
    triangles=0;weighted=0
    for mesh in g['meshes']:
        for p in mesh['primitives']:
            triangles+=g['accessors'][p['indices']]['count']//3
            if 'JOINTS_0'in p['attributes']:
                weighted+=1;assert 'WEIGHTS_0'in p['attributes']
                weights=accessor(g,b,p['attributes']['WEIGHTS_0']);assert np.isfinite(weights).all()and np.allclose(weights.sum(axis=1),1,atol=.015)
    assert weighted>0
    for a in g['animations']:
        for s in a['samplers']:
            times=accessor(g,b,s['input']);values=accessor(g,b,s['output']);assert np.isfinite(values).all()and np.isfinite(times).all();assert (np.diff(times[:,0])>=0).all()
    results.append({'kind':kind,'clips':names,'meshes':len(g['meshes']),'bones':len(g['skins'][0]['joints']),'triangles':triangles,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'skinWeights':'normalised','keyframes':'finite'})
result={'status':'passed','archivesUnchanged':True,'warrokExistingGeometrySkinMaterialsAndEightClips':'preserved exactly','duplicateLogicalWarroks':False,'assets':results,'retargeting':'Source audit found different rest matrices in package clips; baked per target rig, using world rotation deltas and preserving target bone lengths; Yaku Jump Attack mapped from supplied Warrok clip.'}
(OUT/'asset-checks.json').write_text(json.dumps(result,indent=2));print('PASS source hashes, preserved Warrok, unique clips, four skins, normalised weights and finite curves.')
