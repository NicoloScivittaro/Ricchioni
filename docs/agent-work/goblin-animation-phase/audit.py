"""Read-only source audit, FK/contact candidates and FBX inventory. No retarget/compression."""
import bisect, hashlib, json, math, pathlib, struct, zlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).parent
SOURCE = pathlib.Path.home() / 'Downloads/green+goblin+3d+model (2).glb'
# Reuse the already reviewed structural auditor with isolated output/source.
old = (OUT.parent / 'goblin-tripo-pilot/analyze_glb.py').read_text(encoding='utf-8')
old = old.replace('SOURCE = pathlib.Path(r"C:\\Users\\niluf.PC-NIKO\\Downloads\\green+goblin+3d+model.glb")', 'SOURCE = NEW_SOURCE')
old = old.replace('OUT = pathlib.Path(__file__).parent', 'OUT = NEW_OUT')
old = old[:old.rfind('print(json.dumps')]
env = {'NEW_SOURCE': SOURCE, 'NEW_OUT': OUT}
exec(compile(old, 'structural-auditor', 'exec'), env)
g, accessor = env['g'], env['accessor']
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
mapping={0:'goblin.jumpDown',1:'goblin.grab',2:'goblin.hitHead',3:'goblin.jab',4:'goblin.frontKick',5:'goblin.dash',6:'goblin.pickup',8:'goblin.roundhouse',9:'goblin.uppercut',12:'goblin.victory',13:'goblin.judoThrow',14:'goblin.heavy',16:'goblin.idle',17:'goblin.hitSide',18:'goblin.jump',19:'goblin.hitBodyB',20:'goblin.knockback',23:'goblin.block',24:'goblin.run',25:'goblin.hitBodyA',26:'goblin.hitStomach',27:'goblin.ballCatch',28:'goblin.defeat',29:'goblin.fall',31:'goblin.hook',33:'goblin.dodge',34:'goblin.ballThrow',35:'goblin.ko'}
limbs={3:['RightHand','LeftHand'],31:['RightHand','LeftHand'],9:['RightHand','LeftHand'],14:['RightHand','LeftHand'],4:['RightFoot','LeftFoot'],8:['RightFoot','LeftFoot'],6:['RightHand','LeftHand'],27:['RightHand','LeftHand'],34:['RightHand','LeftHand'],1:['RightHand','LeftHand'],13:['RightHand','LeftHand'],20:['Head'],35:['Head']}
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
        if ix==6: score=-min(poses[names['mixamorig:'+name]][0][1] for name in targets)
        if ix==9: score=max(poses[names['mixamorig:'+name]][0][1]-hp[1] for name in targets)
        if ix in (3,4,8,14,31,34): score=max(poses[names['mixamorig:'+name]][0][2]-hp[2] for name in targets)
        if ix==4:
            low_kick_scores.append(max((poses[names['mixamorig:'+name]][0][2]-hp[2] for name in targets if poses[names['mixamorig:'+name]][0][1]<=.32),default=-float('inf')) if low<=t<=high else -float('inf'))
        scores.append(score if low<=t<=high else -float('inf'))
    contact=ts[max(range(len(scores)),key=lambda j:scores[j])] if ix in limbs else None
    hips=tracks[names['mixamorig:Hips'],'translation'][1]
    range_xyz=[max(v[k] for v in hips)-min(v[k] for v in hips) for k in range(3)]
    first,last=fk(start),fk(end)
    endpoint=max(2*math.acos(min(1,abs(sum(x*y for x,y in zip(first[i][1],last[i][1]))))) for i in g['skins'][0]['joints'])
    low_contact=ts[max(range(len(low_kick_scores)),key=lambda j:low_kick_scores[j])] if low_kick_scores else None
    row={'index':ix,'original':anim['name'],'internal':mapping.get(ix),'duration':round(end-start,6),'start':start,'end':end,'channels':len(anim['channels']),'bonesTracked':len({c['target']['node'] for c in anim['channels']}),'trackedBoneNames':sorted(g['nodes'][c['target']['node']].get('name','') for c in anim['channels'] if c['target']['path']=='rotation'),'hipsRange':range_xyz,'hipsFirst':hips[0],'hipsLast':hips[-1],'endpointMaxAngleDeg':round(math.degrees(endpoint),2),'loop':ix in (16,24),'energyRange':[round(low,4),round(high,4)],'contactCandidate':round(contact,4) if contact else None,'lowKickContact':round(low_contact,4) if low_contact else None,'contactMethod':'FK: forward reach for punches/kicks/throw; maximum hand elevation for uppercut; lowest hand for pickup; low kick limits foot height to 0.32 model units. Candidates require visual acceptance.','use':'excluded: wrong soccer kick' if ix==22 else 'mapped' if ix in mapping else 'audit only: no corresponding gameplay action'}
    clips.append(row)
(OUT/'clip-audit.json').write_text(json.dumps(clips,indent=2),encoding='utf-8')
# Original clip names live only in this central manifest. Runtime ranges do not mutate the GLB.
runtime=[]
for r in clips:
    if not r['internal']: continue
    a,b=r['energyRange'] if not r['loop'] else [r['start'],r['end']]
    if r['internal']=='goblin.jump': a,b=.041667,.708333
    if r['internal']=='goblin.fall': a,b=.25,.875 # aerial segment before the ground collapse
    if r['internal']=='goblin.jumpDown': a,b=.416667,1.25
    duration={'goblin.jab':.23,'goblin.hook':.31,'goblin.uppercut':.31,'goblin.heavy':.84,'goblin.frontKick':.3,'goblin.roundhouse':.9,'goblin.dash':.3,'goblin.dodge':.3,'goblin.pickup':.24,'goblin.ballThrow':.36,'goblin.ballCatch':.26,'goblin.hitHead':.28,'goblin.hitSide':.28,'goblin.hitBodyA':.28,'goblin.hitBodyB':.32,'goblin.hitStomach':.32,'goblin.knockback':.45,'goblin.ko':.8}.get(r['internal'],b-a)
    runtime.append({'name':r['internal'],'index':r['index'],'original':r['original'],'originalDuration':r['duration'],'from':a,'to':b,'contact':r['contactCandidate'],'lowContact':r['lowKickContact'],'duration':duration,'loop':r['loop'],'fps':60,'contactVerified':False})
(ROOT/'src/minigames/characters/goblinClips.json').write_text(json.dumps(runtime,indent=2),encoding='utf-8')
# Binary FBX node/property reader: inventory only. No animation conversion or retarget.
def inspect_fbx(p):
    data=p.read_bytes(); version=struct.unpack_from('<I',data,23)[0]; wide=version>=7500
    fmt='<QQQB' if wide else '<IIIB'; header=struct.calcsize(fmt); nodes=[]
    def prop(off):
        kind=chr(data[off]);off+=1
        scalar={'Y':'h','C':'?','I':'i','F':'f','D':'d','L':'q'}
        if kind in scalar:
            f='<'+scalar[kind]; return struct.unpack_from(f,data,off)[0],off+struct.calcsize(f)
        if kind in ('S','R'):
            n=struct.unpack_from('<I',data,off)[0];off+=4; b=data[off:off+n]
            return b.decode('utf8','replace') if kind=='S' else None,off+n
        if kind in ('f','d','l','i','b','c'):
            n,enc,size=struct.unpack_from('<III',data,off);off+=12
            b=data[off:off+size]; b=zlib.decompress(b) if enc==1 else b
            code={'f':'f','d':'d','l':'q','i':'i','b':'?','c':'B'}[kind]
            return list(struct.unpack('<'+code*n,b)),off+size
        raise ValueError(kind)
    def node(off):
        end,n,length,nlen=struct.unpack_from(fmt,data,off)
        if end==0: return off+header
        off+=header; name=data[off:off+nlen].decode();off+=nlen; values=[]
        for _ in range(n):
            val,off=prop(off);values.append(val)
        nodes.append((name,values))
        while off<end-header: off=node(off)
        return end
    off=27
    while off<len(data)-header:
        if not any(data[off:off+header]):break
        off=node(off)
    times=[v for name,vs in nodes if name=='KeyTime' for arr in vs if isinstance(arr,list) for v in arr]
    models=[vs[1] for name,vs in nodes if name=='Model' and len(vs)>1]
    return {'file':p.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'version':version,'models':models,'animationStacks':[vs[1] for name,vs in nodes if name=='AnimationStack'],'durationSeconds':(max(times)-min(times))/46186158000 if times else None,'keyCount':len(times),'status':'inventory only; not loaded, converted or retargeted'}
fbx=[inspect_fbx(SOURCE.parent/name) for name in ('Soccer Spin.fbx','Kick Soccerball (1).fbx','Kick Soccerball.fbx','Soccer Tackle.fbx')]
(OUT/'fbx-audit.json').write_text(json.dumps(fbx,indent=2),encoding='utf-8')
lines=['# GLB clip audit','', '| # | Original name | Internal | Duration s | Bones/channels | Loop | Hips Δ xyz | Energy range s | Contact candidate s | Use |','|---|---|---|---|---|---|---|---|---|---|']
for r in clips:
    name=r['original'].replace('\n',' '); name=name.replace('|','/')
    lines.append(f"| {r['index']} | {name} | {r['internal'] or '—'} | {r['duration']:.3f} | {r['bonesTracked']}/{r['channels']} | {r['loop']} | {', '.join(f'{x:.3f}' for x in r['hipsRange'])} | {r['energyRange']} | {r['contactCandidate']} | {r['use']} |")
lines+=['','Energy range is 3–97% of integrated major-joint angular movement, padded by one sample. Contact is a numerical candidate, not proof of contact with the gameplay target. Root translation never drives gameplay. Loop designation is semantic; endpoint angle measures the actual seam.','', 'FBX files are inventoried in fbx-audit.json; legacy soccer animations stay in use.']
(OUT/'CLIP-AUDIT.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps([{'i':r['index'],'name':r['internal'],'energy':r['energyRange'],'contact':r['contactCandidate'],'hips':r['hipsRange'],'seam':r['endpointMaxAngleDeg']} for r in clips],indent=2))
