"""Read-only source audit, FK/contact candidates and FBX inventory. No retarget/compression."""
import bisect, hashlib, json, math, pathlib, struct, zlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).parent
SOURCE = pathlib.Path.home() / 'Downloads/detailed+character+3d+model (2).glb'
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
mapping={0: 'buttafuori.soccerInstepCandidate', 1: 'buttafuori.hitHead', 2: 'buttafuori.hitSide', 3: 'buttafuori.soccerKickCandidate', 4: 'buttafuori.ballCatch', 5: 'buttafuori.frontKick2', 6: 'buttafuori.cry', 7: 'buttafuori.genericPunch', 8: 'buttafuori.frontKick', 9: 'buttafuori.jab', 10: 'buttafuori.royalStrike', 11: 'buttafuori.boxing1', 12: 'buttafuori.hook', 13: 'buttafuori.hitBodyA', 14: 'buttafuori.fall', 15: 'buttafuori.dodge', 16: 'buttafuori.boxing3', 17: 'buttafuori.walk', 18: 'buttafuori.victory', 19: 'buttafuori.zeusStrike', 20: 'buttafuori.frontKick1', 21: 'buttafuori.uppercut', 22: 'buttafuori.defeat', 23: 'buttafuori.ko', 24: 'buttafuori.run', 25: 'buttafuori.hitBodyB', 26: 'buttafuori.soccerLegsCandidate', 27: 'buttafuori.footballSave', 28: 'buttafuori.soccerPowerCandidate', 29: 'buttafuori.heartPose', 30: 'buttafuori.boxing2', 31: 'buttafuori.idle', 32: 'buttafuori.jump', 33: 'buttafuori.grab', 34: 'buttafuori.ballThrow', 35: 'buttafuori.dash', 36: 'buttafuori.pickup', 37: 'buttafuori.roundhouse', 38: 'buttafuori.judoThrow', 39: 'buttafuori.knockback', 40: 'buttafuori.heavy', 41: 'buttafuori.block', 42: 'buttafuori.footballCatch'}
limbs={7: ['RightHand', 'LeftHand'], 9: ['RightHand', 'LeftHand'], 10: ['RightHand', 'LeftHand'], 11: ['RightHand', 'LeftHand'], 12: ['RightHand', 'LeftHand'], 16: ['RightHand', 'LeftHand'], 19: ['RightHand', 'LeftHand'], 21: ['RightHand', 'LeftHand'], 30: ['RightHand', 'LeftHand'], 33: ['RightHand', 'LeftHand'], 34: ['RightHand', 'LeftHand'], 36: ['RightHand', 'LeftHand'], 38: ['RightHand', 'LeftHand'], 40: ['RightHand', 'LeftHand'], 41: ['RightHand', 'LeftHand'], 4: ['RightHand', 'LeftHand'], 0: ['RightFoot', 'LeftFoot'], 3: ['RightFoot', 'LeftFoot'], 5: ['RightFoot', 'LeftFoot'], 8: ['RightFoot', 'LeftFoot'], 20: ['RightFoot', 'LeftFoot'], 26: ['RightFoot', 'LeftFoot'], 28: ['RightFoot', 'LeftFoot'], 37: ['RightFoot', 'LeftFoot'], 23: ['Head'], 39: ['Head']}
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
        if ix==36: score=-min(poses[names['mixamorig:'+name]][0][1] for name in targets)
        if ix==21: score=max(poses[names['mixamorig:'+name]][0][1]-hp[1] for name in targets)
        if ix in (9,8,37,40,12,34): score=max(poses[names['mixamorig:'+name]][0][2]-hp[2] for name in targets)
        if ix==8:
            low_kick_scores.append(max((poses[names['mixamorig:'+name]][0][2]-hp[2] for name in targets if poses[names['mixamorig:'+name]][0][1]<=.32),default=-float('inf')) if low<=t<=high else -float('inf'))
        scores.append(score if low<=t<=high else -float('inf'))
    contact=ts[max(range(len(scores)),key=lambda j:scores[j])] if ix in limbs else None
    hips=tracks[names['mixamorig:Hips'],'translation'][1]
    range_xyz=[max(v[k] for v in hips)-min(v[k] for v in hips) for k in range(3)]
    first,last=fk(start),fk(end)
    endpoint=max(2*math.acos(min(1,abs(sum(x*y for x,y in zip(first[i][1],last[i][1]))))) for i in g['skins'][0]['joints'])
    low_contact=ts[max(range(len(low_kick_scores)),key=lambda j:low_kick_scores[j])] if low_kick_scores else None
    row={'index':ix,'original':anim['name'],'internal':mapping.get(ix),'duration':round(end-start,6),'start':start,'end':end,'channels':len(anim['channels']),'bonesTracked':len({c['target']['node'] for c in anim['channels']}),'trackedBoneNames':sorted(g['nodes'][c['target']['node']].get('name','') for c in anim['channels'] if c['target']['path']=='rotation'),'hipsRange':range_xyz,'hipsFirst':hips[0],'hipsLast':hips[-1],'endpointMaxAngleDeg':round(math.degrees(endpoint),2),'loop':ix in (31,24,17),'energyRange':[round(low,4),round(high,4)],'contactCandidate':round(contact,4) if contact else None,'lowKickContact':round(low_contact,4) if low_contact else None,'contactMethod':'FK: forward reach for punches/kicks/throw; maximum hand elevation for uppercut; lowest hand for pickup; low kick limits foot height to 0.32 model units. Candidates require visual acceptance.','use':'excluded: soccer clip not accepted' if ix in (0,3,26,28) else 'mapped' if ix in mapping else 'audit only: no corresponding gameplay action'}
    clips.append(row)
(OUT/'clip-audit.json').write_text(json.dumps(clips,indent=2),encoding='utf-8')
# Every source clip remains previewable; unaccepted sports candidates are not gameplay mappings.
# Original clip names live only in this central manifest. Runtime ranges do not mutate the GLB.
runtime=[]
for r in clips:
    if not r['internal']: continue
    a,b=r['energyRange'] if not r['loop'] else [r['start'],r['end']]
    if r['internal']=='buttafuori.jump': a,b=.041667,.708333
    if r['internal']=='buttafuori.fall': a,b=.25,.875 # aerial segment before the ground collapse
    if r['internal']=='buttafuori.jumpDown': a,b=.416667,1.25
    duration={'buttafuori.jab':.23,'buttafuori.hook':.31,'buttafuori.uppercut':.31,'buttafuori.heavy':.84,'buttafuori.frontKick':.3,'buttafuori.roundhouse':.9,'buttafuori.dash':.3,'buttafuori.dodge':.3,'buttafuori.pickup':.24,'buttafuori.ballThrow':.36,'buttafuori.ballCatch':.26,'buttafuori.hitHead':.28,'buttafuori.hitSide':.28,'buttafuori.hitBodyA':.28,'buttafuori.hitBodyB':.32,'buttafuori.hitStomach':.32,'buttafuori.knockback':.45,'buttafuori.ko':.8}.get(r['internal'],b-a)
    runtime.append({'name':r['internal'],'index':r['index'],'original':r['original'],'originalDuration':r['duration'],'from':a,'to':b,'contact':r['contactCandidate'],'lowContact':r['lowKickContact'],'duration':duration,'loop':r['loop'],'fps':60,'contactVerified':False})
# No dedicated stomach reaction: explicit alias to the authored body reaction.
alias=next(c for c in runtime if c['name']=='buttafuori.hitBodyB').copy();alias['name']='buttafuori.hitStomach';runtime.append(alias)
(ROOT/'src/minigames/characters/buttafuoriClips.json').write_text(json.dumps(runtime,indent=2),encoding='utf-8')
lines=['# Buttafuori clip audit','','| # | Original | Internal | Duration s | Bones/channels | Hips xyz range | Useful range | Contact candidate |','|---|---|---|---|---|---|---|---|']
for r in clips:
    name=r['original'].replace(chr(10),' ').replace('|','/')
    lines.append(f"| {r['index']} | {name} | {r['internal'] or 'audit only'} | {r['duration']:.3f} | {r['bonesTracked']}/{r['channels']} | {r['hipsRange']} | {r['energyRange']} | {r['contactCandidate']} |")
(OUT/'CLIP-AUDIT.md').write_text('\n'.join(lines),encoding='utf-8')
print(f"Buttafuori: {len(clips)} audited, {len(runtime)} mapped")
