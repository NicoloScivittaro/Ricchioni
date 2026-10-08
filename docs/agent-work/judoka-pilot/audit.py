"""Read-only source audit, FK/contact candidates and FBX inventory. No retarget/compression."""
import bisect, hashlib, json, math, pathlib, struct, zlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).parent
SOURCE = pathlib.Path.home() / 'Downloads/judo+figure+3d+model.glb'
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
def qmul(a,b):
    x,y,z,w=a; X,Y,Z,W=b
    return (w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z)
def rotate(q,v):
    r=qmul(qmul(q,(*v,0)),(-q[0],-q[1],-q[2],q[3]))
    return r[:3]
def lerp(a,b,t): return tuple(x+(y-x)*t for x,y in zip(a,b))
def sample(ts,vs,t,quat=False):
    j=min(len(ts)-1,bisect.bisect_right(ts,t)); i=max(0,j-1)
    k=(t-ts[i])/(ts[j]-ts[i]) if ts[j]!=ts[i] else 0
    a,b=vs[i],vs[j]
    if quat and sum(x*y for x,y in zip(a,b))<0: b=tuple(-x for x in b)
    v=lerp(a,b,k)
    if quat:
        norm=math.sqrt(sum(x*x for x in v)) or 1; v=tuple(x/norm for x in v)
    return v
parents={child:i for i,n in enumerate(g['nodes']) for child in n.get('children',[])}
names={n.get('name',''):i for i,n in enumerate(g['nodes'])}
mapping={0:'judoka.ballThrow',2:'judoka.fall',3:'judoka.frontKick',4:'judoka.hitBodyA',7:'judoka.uppercut',8:'judoka.pickup',9:'judoka.judoThrow',11:'judoka.idle',12:'judoka.heavy',13:'judoka.roundhouse',16:'judoka.defeat',18:'judoka.hook',19:'judoka.dash',20:'judoka.hitStomach',21:'judoka.knockback',22:'judoka.grab',23:'judoka.hitBodyB',24:'judoka.block',26:'judoka.jab',27:'judoka.run',29:'judoka.hitSide',30:'judoka.hitHead',31:'judoka.ballCatch',32:'judoka.dodge',33:'judoka.bow',34:'judoka.ko',36:'judoka.victory'}
limbs={26:['RightHand','LeftHand'],18:['RightHand','LeftHand'],7:['RightHand','LeftHand'],12:['RightHand','LeftHand'],3:['RightFoot','LeftFoot'],13:['RightFoot','LeftFoot'],8:['RightHand','LeftHand'],31:['RightHand','LeftHand'],0:['RightHand','LeftHand'],22:['RightHand','LeftHand'],9:['RightHand','LeftHand'],21:['Head'],34:['Head']}
clips=[]
for ix,anim in enumerate(g['animations']):
    tracks={}
    for c in anim['channels']:
        s=anim['samplers'][c['sampler']]
        tracks[c['target']['node'],c['target']['path']]=([v[0] for v in accessor(s['input'])],accessor(s['output']))
    start=min(ts[0] for ts,vs in tracks.values()); end=max(ts[-1] for ts,vs in tracks.values())
    ts=sorted(set(t for times,vs in tracks.values() for t in times))
    def fk(t):
        result={}
        def pose(i):
            if i in result: return result[i]
            n=g['nodes'][i]
            tr=tracks.get((i,'translation')); qr=tracks.get((i,'rotation'))
            p=sample(*tr,t) if tr else n.get('translation',(0,0,0))
            q=sample(*qr,t,True) if qr else n.get('rotation',(0,0,0,1))
            if i in parents:
                pp,pq=pose(parents[i]); v=rotate(pq,p)
                p=tuple(a+b for a,b in zip(pp,v)); q=qmul(pq,q)
            result[i]=(p,q); return p,q
        for i in g['skins'][0]['joints']: pose(i)
        return result
    energies=[]
    for j in range(1,len(ts)):
        e=0
        for (node,path),(times,vs) in tracks.items():
            name=g['nodes'][node].get('name','')
            if path!='rotation' or 'Hand' in name: continue
            a=sample(times,vs,ts[j-1],True); b=sample(times,vs,ts[j],True)
            e+=2*math.acos(min(1,abs(sum(x*y for x,y in zip(a,b)))))
        energies.append(e)
    total=sum(energies); cum=0; low=start; high=end
    for j,e in enumerate(energies):
        prev=cum; cum+=e
        if prev<total*.03<=cum: low=ts[max(0,j-1)]
        if prev<total*.97<=cum: high=ts[min(len(ts)-1,j+2)]
    scores=[]; low_kick_scores=[]
    for t in ts:
        poses=fk(t); hp=poses[names['mixamorig:Hips']][0]
        targets=limbs.get(ix,[])
        # Candidate only: limb extension relative to hips, neutralizing root translation.
        score=max((math.hypot(poses[names['mixamorig:'+name]][0][0]-hp[0],poses[names['mixamorig:'+name]][0][2]-hp[2]) for name in targets),default=0)
        if ix==8: score=-min(poses[names['mixamorig:'+name]][0][1] for name in targets)
        if ix==7: score=max(poses[names['mixamorig:'+name]][0][1]-hp[1] for name in targets)
        if ix in (26,3,13,12,18,0): score=max(poses[names['mixamorig:'+name]][0][2]-hp[2] for name in targets)
        if ix==3:
            low_kick_scores.append(max((poses[names['mixamorig:'+name]][0][2]-hp[2] for name in targets if poses[names['mixamorig:'+name]][0][1]<=.32),default=-float('inf')) if low<=t<=high else -float('inf'))
        scores.append(score if low<=t<=high else -float('inf'))
    contact=ts[max(range(len(scores)),key=lambda j:scores[j])] if ix in limbs else None
    hips=tracks[names['mixamorig:Hips'],'translation'][1]
    range_xyz=[max(v[k] for v in hips)-min(v[k] for v in hips) for k in range(3)]
    first,last=fk(start),fk(end)
    endpoint=max(2*math.acos(min(1,abs(sum(x*y for x,y in zip(first[i][1],last[i][1]))))) for i in g['skins'][0]['joints'])
    low_contact=ts[max(range(len(low_kick_scores)),key=lambda j:low_kick_scores[j])] if low_kick_scores else None
    row={'index':ix,'original':anim['name'],'internal':mapping.get(ix),'duration':round(end-start,6),'start':start,'end':end,'channels':len(anim['channels']),'bonesTracked':len({c['target']['node'] for c in anim['channels']}),'trackedBoneNames':sorted(g['nodes'][c['target']['node']].get('name','') for c in anim['channels'] if c['target']['path']=='rotation'),'hipsRange':range_xyz,'hipsFirst':hips[0],'hipsLast':hips[-1],'endpointMaxAngleDeg':round(math.degrees(endpoint),2),'loop':ix in (11,27),'energyRange':[round(low,4),round(high,4)],'contactCandidate':round(contact,4) if contact else None,'lowKickContact':round(low_contact,4) if low_contact else None,'contactMethod':'FK: forward reach for punches/kicks/throw; maximum hand elevation for uppercut; lowest hand for pickup; low kick limits foot height to 0.32 model units. Candidates require visual acceptance.','use':'excluded: soccer clip not accepted' if ix in (5,14,15,28) else 'mapped' if ix in mapping else 'audit only: no corresponding gameplay action'}
    clips.append(row)
(OUT/'clip-audit.json').write_text(json.dumps(clips,indent=2),encoding='utf-8')
# Original clip names live only in this central manifest. Runtime ranges do not mutate the GLB.
runtime=[]
for r in clips:
    if not r['internal']: continue
    a,b=r['energyRange'] if not r['loop'] else [r['start'],r['end']]
    if r['internal']=='judoka.jump': a,b=.041667,.708333
    if r['internal']=='judoka.fall': a,b=.25,.875 # aerial segment before the ground collapse
    if r['internal']=='judoka.jumpDown': a,b=.416667,1.25
    duration={'judoka.jab':.23,'judoka.hook':.31,'judoka.uppercut':.31,'judoka.heavy':.84,'judoka.frontKick':.3,'judoka.roundhouse':.9,'judoka.dash':.3,'judoka.dodge':.3,'judoka.pickup':.24,'judoka.ballThrow':.36,'judoka.ballCatch':.26,'judoka.hitHead':.28,'judoka.hitSide':.28,'judoka.hitBodyA':.28,'judoka.hitBodyB':.32,'judoka.hitStomach':.32,'judoka.knockback':.45,'judoka.ko':.8}.get(r['internal'],b-a)
    runtime.append({'name':r['internal'],'index':r['index'],'original':r['original'],'originalDuration':r['duration'],'from':a,'to':b,'contact':r['contactCandidate'],'lowContact':r['lowKickContact'],'duration':duration,'loop':r['loop'],'fps':60,'contactVerified':False})
(ROOT/'src/minigames/characters/judokaClips.json').write_text(json.dumps(runtime,indent=2),encoding='utf-8')
lines=['# Judoka clip audit','','| # | Original | Internal | Duration s | Bones/channels | Hips xyz range | Useful range | Contact candidate |','|---|---|---|---|---|---|---|---|']
for r in clips:
    name=r['original'].replace(chr(10),' ').replace('|','/')
    lines.append(f"| {r['index']} | {name} | {r['internal'] or 'audit only'} | {r['duration']:.3f} | {r['bonesTracked']}/{r['channels']} | {r['hipsRange']} | {r['energyRange']} | {r['contactCandidate']} |")
(OUT/'CLIP-AUDIT.md').write_text('\n'.join(lines),encoding='utf-8')
print(f"Judoka: {len(clips)} audited, {len(runtime)} mapped")
