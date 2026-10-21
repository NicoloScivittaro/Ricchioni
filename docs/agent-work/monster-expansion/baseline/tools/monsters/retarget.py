"""Offline rest-space retargeting. Helpers in gltf.py have no import side effects."""
from gltf import *
sg,sb=load(DEST/'warrok.glb');sp=parents(sg);sl=[trs(n)for n in sg['nodes']];sr=globalize(sl,sp)
source={n.get('name','').replace('mixamorig:','').replace('mixamorig',''):i for i,n in enumerate(sg['nodes'])}
clips={};manifest={'clips':{},'profiles':{}}
for a in sg['animations']:
    duration=max(float(accessor(sg,sb,s['input'])[-1,0])for s in a['samplers']);frames=round(duration*30)+1;times=np.linspace(0,duration,frames);poses=[]
    channels=[]
    for c in a['channels']:
        s=a['samplers'][c['sampler']];channels.append((c['target']['node'],c['target']['path'],accessor(sg,sb,s['input'])[:,0],accessor(sg,sb,s['output'])))
    for t in times:
        nodes=[dict(n)for n in sg['nodes']]
        for i,path,ts,vs in channels:
            k=max(0,min(len(ts)-2,int(np.searchsorted(ts,t)-1)));u=float(np.clip((t-ts[k])/max(1e-9,ts[k+1]-ts[k]),0,1));v=vs[k].copy();v2=vs[k+1].copy()
            if path=='rotation' and np.dot(v,v2)<0:v2=-v2
            v=v*(1-u)+v2*u
            if path=='rotation':v/=np.linalg.norm(v)
            nodes[i].pop('matrix',None);nodes[i][path]=v.tolist()
        poses.append(globalize([trs(n)for n in nodes],sp))
    clips[a['name']]=(times,poses)
    contacts=[]
    if a['name']in ['WALK','RUN']:
        for foot in ['LeftFoot','RightFoot']:
            ys=np.array([p[source[foot]][1,3]for p in poses]);zs=np.array([p[source[foot]][2,3]for p in poses]);ground=ys.min()+max(.002,(ys.max()-ys.min())*.14)
            # Heel strike is the forward-most low foot, not the arbitrary minimum in a flat stance.
            candidates=np.where(ys<=ground)[0];index=int(candidates[np.argmax(zs[candidates])]);contacts.append(round(index/max(1,frames-1),4))
    manifest['clips'][a['name']]={'seconds':duration,'contacts':contacts}
    if a['name']=='ATTACK':
        reach=[max(p[source[h]][2,3]-p[source['Hips']][2,3]for h in ['LeftHand','RightHand'])for p in poses]
        manifest['clips'][a['name']]['peakReachSeconds']=round(float(times[int(np.argmax(reach))]),4)
def basis(rest,names):
    up=rest[names['Head']][:3,3]-rest[names['Hips']][:3,3];up/=np.linalg.norm(up)
    right=rest[names['RightUpLeg']][:3,3]-rest[names['LeftUpLeg']][:3,3];right-=up*np.dot(right,up);right/=np.linalg.norm(right);return np.column_stack([right,up,np.cross(right,up)])
for profile,file in [('hazmat','escape_the_backrooms_hazmat'),('partygoer','partygoer_from_backrooms_updated')]:
    tg,tb=load(ROOT/'public/assets/backrooms'/(file+'.glb'));tp=parents(tg);tl=[trs(n)for n in tg['nodes']];tr=globalize(tl,tp);names={n.get('name','').rsplit('_',1)[0] if n.get('name','').rsplit('_',1)[-1].isdigit() else n.get('name',''):i for i,n in enumerate(tg['nodes'])}
    mapping={}
    if profile=='hazmat':mapping={key:names[key]for key in source if key in names}
    else:
        main={'Hips':'Hip','Spine':'Waist','Spine1':'Spine01','Spine2':'Spine02','Neck':'NeckTwist01','Head':'Head'}
        for side,prefix in [('Left','L'),('Right','R')]:
            for s,t in [('UpLeg','Thigh'),('Leg','Calf'),('Foot','Foot'),('ToeBase','ToeBase'),('Shoulder','Clavicle'),('Arm','Upperarm'),('ForeArm','Forearm'),('Hand','Hand')]:main[side+s]=prefix+'_'+t
        mapping={s:names['CC_Base_'+t]for s,t in main.items()if 'CC_Base_'+t in names}
    assert all(k in mapping for k in ['Hips','Head','LeftArm','RightArm','LeftUpLeg','RightUpLeg'])
    align=basis(tr,mapping)@basis(sr,source).T;ratio=np.linalg.norm(tr[mapping['Head']][:3,3]-tr[mapping['Hips']][:3,3])/np.linalg.norm(sr[source['Head']][:3,3]-sr[source['Hips']][:3,3]);reverse={v:k for k,v in mapping.items()};tg['animations']=[]
    for key,(times,poses)in clips.items():
        if '--trial'in sys.argv and key not in ['WALK','ATTACK']:continue
        rotations={i:[]for i in mapping.values()};hips=[]
        for pose in poses:
            world={}
            def visit(i):
                if i in world:return world[i]
                parent=visit(tp[i])if i in tp else np.eye(4);m=parent@tl[i]
                if i in reverse:
                    s=source[reverse[i]];desired=align@rotation(pose[s])@rotation(sr[s]).T@align.T@rotation(tr[i]);local=np.linalg.inv(rotation(parent))@desired;rotations[i].append(matquat(local).tolist());m[:3,:3]=desired@np.diag(np.linalg.norm(m[:3,:3],axis=0))
                    if reverse[i]=='Hips':
                        delta=align@(pose[s][:3,3]-sr[s][:3,3])*ratio;delta[0]=delta[2]=0
                        pos=np.linalg.inv(parent)@np.append(tr[i][:3,3]+delta,1);hips.append(pos[:3].tolist());m[:3,3]=tr[i][:3,3]+delta
                world[i]=m;return m
            for i in range(len(tl)):visit(i)
        ti=add(tg,tb,times,'SCALAR');a={'name':key,'samplers':[],'channels':[]}
        for i,qs in rotations.items():
            # Sign continuity prevents long-path interpolation at pi.
            for k in range(1,len(qs)):
                if np.dot(qs[k],qs[k-1])<0:qs[k]=(-np.array(qs[k])).tolist()
            idx=add(tg,tb,qs,'VEC4');a['channels'].append({'sampler':len(a['samplers']),'target':{'node':i,'path':'rotation'}});a['samplers'].append({'input':ti,'output':idx,'interpolation':'LINEAR'})
        idx=add(tg,tb,hips,'VEC3');a['channels'].append({'sampler':len(a['samplers']),'target':{'node':mapping['Hips'],'path':'translation'}});a['samplers'].append({'input':ti,'output':idx,'interpolation':'LINEAR'});tg['animations'].append(a)
    save(DEST/(profile+'-animated.glb'),tg,tb);manifest['profiles'][profile]={'mappedBones':len(mapping),'map':mapping,'scaleRatio':ratio,'alignment':align.tolist(),'clips':[a['name']for a in tg['animations']]};print(profile,len(mapping),'bones',len(tg['animations']),'clips',flush=True)
manifest['profiles']['warrok']={'compatibility':'exact-rest-hierarchy','bones':81}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2));(OUT/'retarget.json').write_text(json.dumps(manifest,indent=2))
