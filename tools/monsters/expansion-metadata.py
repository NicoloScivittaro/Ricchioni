"""Append only new Warrok clip data; inspect keyframe trajectories, publish per-model metadata."""
from gltf import *
import copy
OUT=ROOT/'docs/agent-work/monster-expansion';HEIGHTS={'warrok':3.2,'zombiegirl':1.85,'yaku':2.25,'pumpkinhulk':3.5}
def compact(g,b):
    used=set()
    for m in g['meshes']:
        for p in m['primitives']:
            used.update(p['attributes'].values())
            if 'indices'in p:used.add(p['indices'])
            for t in p.get('targets',[]):used.update(t.values())
    for s in g.get('skins',[]):
        if 'inverseBindMatrices'in s:used.add(s['inverseBindMatrices'])
    for a in g['animations']:
        for s in a['samplers']:used.update([s['input'],s['output']])
    mapping={old:new for new,old in enumerate(sorted(used))};g['accessors']=[g['accessors'][i]for i in sorted(used)]
    for m in g['meshes']:
        for p in m['primitives']:
            p['attributes']={k:mapping[v]for k,v in p['attributes'].items()}
            if 'indices'in p:p['indices']=mapping[p['indices']]
            for t in p.get('targets',[]):
                for k in t:t[k]=mapping[t[k]]
    for s in g.get('skins',[]):
        if 'inverseBindMatrices'in s:s['inverseBindMatrices']=mapping[s['inverseBindMatrices']]
    for a in g['animations']:
        for s in a['samplers']:
            for k in ['input','output']:s[k]=mapping[s[k]]
    views=set(a['bufferView']for a in g['accessors'])|set(i['bufferView']for i in g.get('images',[])if 'bufferView'in i);vm={old:new for new,old in enumerate(sorted(views))};data=bytearray();newViews=[]
    for i in sorted(views):
        view=dict(g['bufferViews'][i]);start=view.get('byteOffset',0);data+=b'\0'*((-len(data))%4);view['byteOffset']=len(data);data+=b[start:start+view['byteLength']];newViews.append(view)
    for a in g['accessors']:a['bufferView']=vm[a['bufferView']]
    for image in g.get('images',[]):
        if 'bufferView'in image:image['bufferView']=vm[image['bufferView']]
    g['bufferViews']=newViews;return g,data
base,bb=load(OUT/'baseline/public/assets/monsters/warrok.glb');extra,eb=load(OUT/'warrok-additions.glb');nodeByName={n.get('name'):i for i,n in enumerate(base['nodes'])};existing={a['name']for a in base['animations']}
for animation in extra['animations']:
    assert animation['name']not in existing
    a=copy.deepcopy(animation);converted={}
    for s in a['samplers']:
        for k in ['input','output']:
            ix=s[k]
            if ix not in converted:converted[ix]=add(base,bb,accessor(extra,eb,ix),extra['accessors'][ix]['type'])
            s[k]=converted[ix]
    for c in a['channels']:c['target']['node']=nodeByName[extra['nodes'][c['target']['node']]['name']]
    base['animations'].append(a)
save(DEST/'warrok.glb',base,bb)
for kind in HEIGHTS:
    fix=OUT/(kind+'-jump-fix.glb')
    if not fix.exists():continue
    g,b=load(DEST/(kind+'.glb'));sg,sb=load(fix);nodes={n.get('name'):i for i,n in enumerate(g['nodes'])};updates={a['name']for a in sg['animations']};g['animations']=[a for a in g['animations']if a['name']not in updates]
    for source in sg['animations']:
        a=copy.deepcopy(source);converted={}
        for s in a['samplers']:
            for key in ['input','output']:
                ix=s[key]
                if ix not in converted:converted[ix]=add(g,b,accessor(sg,sb,ix),sg['accessors'][ix]['type'])
                s[key]=converted[ix]
        for c in a['channels']:c['target']['node']=nodes[sg['nodes'][c['target']['node']]['name']]
        g['animations'].append(a)
    g,b=compact(g,b);save(DEST/(kind+'.glb'),g,b)
manifest=json.loads((OUT/'baseline/public/assets/monsters/manifest.json').read_text());manifest.setdefault('sets',{});catalog={};report=[]
for kind,height in HEIGHTS.items():
    g,b=load(DEST/(kind+'.glb'));par=parents(g);rest=globalize([trs(n)for n in g['nodes']],par);names={n.get('name','').replace('mixamorig:',''):i for i,n in enumerate(g['nodes'])};clips={};traces={}
    # Authored position-accessor bounds, transformed through node world matrices (column vectors).
    minimum=np.array([np.inf]*3);maximum=-minimum
    for i,n in enumerate(g['nodes']):
        if 'mesh'not in n:continue
        for p in g['meshes'][n['mesh']]['primitives']:
            a=g['accessors'][p['attributes']['POSITION']];lo=np.array(a['min']);hi=np.array(a['max']);corners=np.array([[x,y,z,1]for x in [lo[0],hi[0]]for y in [lo[1],hi[1]]for z in [lo[2],hi[2]]]);points=(rest[i]@corners.T).T[:,:3];minimum=np.minimum(minimum,points.min(0));maximum=np.maximum(maximum,points.max(0))
    # glTF skinned nodes can carry a bind-space scale; renderer applies the normalized visual size.
    # Bone-length based cadence is more stable than the non-skinned accessor bounds.
    leg=sum(np.linalg.norm(rest[names[k]][:3,3]-rest[names[j]][:3,3])for j,k in [('LeftUpLeg','LeftLeg'),('LeftLeg','LeftFoot')])
    for a in g['animations']:
        duration=max(float(accessor(g,b,s['input'])[-1,0])for s in a['samplers']);times=np.linspace(0,duration,round(duration*30)+1);poses=[];channels=[]
        for c in a['channels']:
            s=a['samplers'][c['sampler']];channels.append((c['target']['node'],c['target']['path'],accessor(g,b,s['input'])[:,0],accessor(g,b,s['output'])))
        for t in times:
            nodes=[dict(n)for n in g['nodes']]
            for i,path,ts,vs in channels:
                if len(ts)==1:v=vs[0]
                else:
                    k=max(0,min(len(ts)-2,int(np.searchsorted(ts,t)-1)));u=float(np.clip((t-ts[k])/max(1e-9,ts[k+1]-ts[k]),0,1));v=vs[k];v2=vs[k+1]
                    if path=='rotation'and np.dot(v,v2)<0:v2=-v2
                    v=v*(1-u)+v2*u
                    if path=='rotation':v=v/np.linalg.norm(v)
                nodes[i].pop('matrix',None);nodes[i][path]=v.tolist()
            poses.append(globalize([trs(n)for n in nodes],par))
        row={'seconds':round(duration,5),'contacts':[]}
        if a['name']in ['WALK','RUN']:
            for foot in ['LeftFoot','RightFoot']:
                ys=np.array([p[names[foot]][1,3]for p in poses]);zs=np.array([p[names[foot]][2,3]for p in poses]);ix=np.where(ys<=ys.min()+max(.002,np.ptp(ys)*.14))[0];row['contacts'].append(round(int(ix[np.argmax(zs[ix])])/max(1,len(times)-1),4))
        if a['name']in ['ATTACK','SWIPE','JUMP_ATTACK']:
            trace=[]
            for p in poses:
                hip=p[names['Hips']][:3,3];hands=[p[names[h]][:3,3]-hip for h in ['LeftHand','RightHand']];trace.append(max(v[2]-.25*abs(v[0])for v in hands))
            valid=np.arange(max(1,round(len(trace)*.14)),max(2,round(len(trace)*.85)));peak=int(valid[np.argmax(np.array(trace)[valid])]);row['impact']=round(float(times[peak]),5);traces[a['name']]={'time':times.tolist(),'handReachScore':trace}
        if a['name']=='JUMP_ATTACK':row.update(impact=1.7,takeoff=.5,landing=1.6) # Original FBX foot/hip ground contacts, jump-motion.json.
        clips[a['name']]=row
    # Cadence based on authored stride length relative to leg length, then normalized actor height.
    # Mutant walk/run root travel is ~1.89m / 2.08m on the original Warrok (0.71m leg).
    sourceHeight={'warrok':2.383,'zombiegirl':1.8,'yaku':1.94,'pumpkinhulk':2.5}[kind]
    for key,travel in [('WALK',1.894),('RUN',2.081)]:
        if key in clips:clips[key]['speed']=round(travel*(leg/.70967)*(height/sourceHeight)/clips[key]['seconds'],4)
    clips.pop('_EXPORT',None);setName='mutant-v1'if kind=='warrok'else kind+'-v1';manifest['sets'][setName]={'clips':clips}
    if kind=='warrok':manifest['sets']['warrok-v1']=manifest['sets'].pop('mutant-v1')
    catalog[kind]={'height':height,'clips':clips}
    report.append({'kind':kind,'bytes':(DEST/(kind+'.glb')).stat().st_size,'meshes':len(g['meshes']),'bones':len(g['skins'][0]['joints']),'clips':list(clips),'clipInfo':clips,'attackTraces':traces,'restLegLength':leg})
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2));(ROOT/'shared/monsterClips.json').write_text(json.dumps(catalog,indent=2));(OUT/'asset-metadata.json').write_text(json.dumps(report,indent=2))
print('Preserved Warrok mesh/skin and eight clips; appended unique additions.')
for r in report:print(r['kind'],r['bones'],'bones',len(r['clips']),'clips',[(k,v.get('impact'))for k,v in r['clipInfo'].items()if 'impact'in v])
