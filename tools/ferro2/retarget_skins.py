"""Bake Ferro clips against the four ORIGINAL skin rests. Meshes/textures stay untouched."""
import sys,json,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/monsters'))
from gltf import load,parents,trs,globalize,rotation,matquat
source=json.loads((ROOT/'.cache/ferro-2/skin-source.json').read_text())
profiles={'goblin':'goblin-tripo/green_goblin_casacarbo.glb','buttafuori':'detailed-tripo/detailed_character_casacarbo.glb','judoka':'judoka-tripo/judo_figure_casacarbo.glb','ciro':'man-tripo/man_animated.glb'}
mapping={'Hips':'B-hips','Spine':'B-spine','Spine1':'B-chest','Spine2':'B-chest','Neck':'B-neck','Head':'B-head'}
for side,suffix in [('Left','L'),('Right','R')]:
    for target,bone in [('Shoulder','shoulder'),('Arm','upperArm'),('ForeArm','forearm'),('Hand','hand'),('UpLeg','thigh'),('Leg','shin'),('Foot','foot'),('ToeBase','toe')]:mapping[side+target]='B-'+bone+'.'+suffix
    for finger,bone in [('Index','indexFinger'),('Middle','middleFinger'),('Ring','ringFinger'),('Pinky','pinky'),('Thumb','thumb')]:
        for joint in range(1,4):mapping[side+'Hand'+finger+str(joint)]='B-'+bone+str(joint).zfill(2)+'.'+suffix
def basis(p,hip,head,left,right):
    up=p[head][:3,3]-p[hip][:3,3];up/=np.linalg.norm(up)
    r=p[right][:3,3]-p[left][:3,3];r-=up*np.dot(r,up);r/=np.linalg.norm(r)
    return np.column_stack([r,up,np.cross(r,up)])
manifest={}
for profile,file in profiles.items():
    path=ROOT/'public/models'/file;g,b=load(path);par=parents(g);local=[trs(n)for n in g['nodes']];rest=globalize(local,par)
    names={n.get('name','').replace('mixamorig:','').replace('mixamorig',''):i for i,n in enumerate(g['nodes'])}
    # Spine1/Spine2 cannot both receive the complete chest rotation; map chest to Spine2,
    # leaving the intermediate bone at bind so rotations are not applied twice.
    actual={name:bone for name,bone in mapping.items() if name in names and name!='Spine1'}
    indices={names[name]:bone for name,bone in actual.items()}
    tracks={}
    max_error=0
    for key,clip in source.items():
        sr={name:np.array(m).reshape(4,4) for name,m in clip['rest'].items()}
        assert all(bone in sr for bone in actual.values()),(profile,key,set(actual.values())-sr.keys())
        align=basis(rest,names['Hips'],names['Head'],names['LeftUpLeg'],names['RightUpLeg'])@basis(sr,'B-hips','B-head','B-thigh.L','B-thigh.R').T
        ratio=np.linalg.norm(rest[names['Head']][:3,3]-rest[names['Hips']][:3,3])/np.linalg.norm(sr['B-head'][:3,3]-sr['B-hips'][:3,3])
        frames=[];previous={}
        for raw in clip['frames']:
            pose={name:np.array(m).reshape(4,4) for name,m in raw.items()};world={};qs={}
            def visit(i):
                if i in world:return world[i]
                parent=visit(par[i]) if i in par else np.eye(4);m=parent@local[i]
                if i in indices:
                    bone=indices[i];desired=align@rotation(pose[bone])@rotation(sr[bone]).T@align.T@rotation(rest[i])
                    q=matquat(np.linalg.inv(rotation(parent))@desired)
                    if i in previous and np.dot(q,previous[i])<0:q=-q
                    previous[i]=q;qs[g['nodes'][i]['name']]=np.round(q,6).tolist()
                    m[:3,:3]=desired@np.diag(np.linalg.norm(m[:3,:3],axis=0))
                    if bone=='B-hips':
                        delta=align@(pose[bone][:3,3]-sr[bone][:3,3])*ratio;delta[0]=delta[2]=0
                        pos=np.linalg.inv(parent)@np.append(rest[i][:3,3]+delta,1)
                        m[:3,3]=rest[i][:3,3]+delta;qs['hips']=np.round(pos[:3],6).tolist()
                world[i]=m;return m
            for i in range(len(local)):visit(i)
            assert all(abs(np.linalg.norm(q)-1)<.00001 for n,q in qs.items() if n!='hips')
            frames.append(qs)
        tracks[key]={'duration':round(clip['duration'],5),'frames':frames}
    out=ROOT/'public/assets/ferro2'/('skin-'+profile+'.json');out.write_text(json.dumps(tracks,separators=(',',':')))
    manifest[profile]={'model':'/models/'+file,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mappedBones':len(actual),'clips':list(tracks),'animationBytes':out.stat().st_size,'method':'global rest-space rotation deltas; original target bone lengths; vertical hips only'}
    print('RETARGET',profile,len(actual),len(tracks),out.stat().st_size,flush=True)
(ROOT/'docs/agent-work/ferro-2/skins-retarget.json').write_text(json.dumps(manifest,indent=2))
