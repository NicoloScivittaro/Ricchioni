"""Read-only source audit, FK/contact candidates and FBX inventory. No retarget/compression."""
import bisect, hashlib, json, math, pathlib, struct, zlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).parent
SOURCE = pathlib.Path.home() / 'Downloads/man+3d+model.glb'
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
mapping={0: 'ciro.soccerKickCandidate', 1: 'ciro.zeusStrike', 2: 'ciro.jump', 3: 'ciro.run', 4: 'ciro.uppercut', 5: 'ciro.block', 6: 'ciro.royalStrike', 7: 'ciro.hitBodyB', 8: 'ciro.hitSide', 9: 'ciro.boxing2', 10: 'ciro.hitStomach', 11: 'ciro.ballThrow', 12: 'ciro.frontKick1', 13: 'ciro.knockback', 14: 'ciro.wait', 15: 'ciro.jab', 16: 'ciro.heavy', 17: 'ciro.boxing1', 18: 'ciro.boxing3', 19: 'ciro.soccerInstepCandidate', 20: 'ciro.frontKick', 21: 'ciro.footballCatch', 22: 'ciro.frightened', 23: 'ciro.ballCatch', 24: 'ciro.hitHead', 25: 'ciro.defeat', 26: 'ciro.hitBodyA', 27: 'ciro.victory', 28: 'ciro.roundhouse', 29: 'ciro.defeat2', 30: 'ciro.dodge', 31: 'ciro.soccerLegsCandidate', 32: 'ciro.hook', 33: 'ciro.footballPass', 34: 'ciro.judoThrow', 35: 'ciro.dash', 36: 'ciro.grab', 37: 'ciro.ko', 38: 'ciro.pickup', 39: 'ciro.walk', 40: 'ciro.fall', 41: 'ciro.frontKick2', 42: 'ciro.idle', 43: 'ciro.soccerPowerCandidate', 44: 'ciro.footballSave', 45: 'ciro.genericPunch'}
limbs={1: ['RightHand', 'LeftHand'], 4: ['RightHand', 'LeftHand'], 5: ['RightHand', 'LeftHand'], 6: ['RightHand', 'LeftHand'], 9: ['RightHand', 'LeftHand'], 11: ['RightHand', 'LeftHand'], 15: ['RightHand', 'LeftHand'], 16: ['RightHand', 'LeftHand'], 17: ['RightHand', 'LeftHand'], 18: ['RightHand', 'LeftHand'], 23: ['RightHand', 'LeftHand'], 32: ['RightHand', 'LeftHand'], 34: ['RightHand', 'LeftHand'], 36: ['RightHand', 'LeftHand'], 38: ['RightHand', 'LeftHand'], 45: ['RightHand', 'LeftHand'], 0: ['RightFoot', 'LeftFoot'], 12: ['RightFoot', 'LeftFoot'], 19: ['RightFoot', 'LeftFoot'], 20: ['RightFoot', 'LeftFoot'], 28: ['RightFoot', 'LeftFoot'], 31: ['RightFoot', 'LeftFoot'], 41: ['RightFoot', 'LeftFoot'], 43: ['RightFoot', 'LeftFoot'], 13: ['Head'], 37: ['Head']}
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
        if mapping[ix]=='ciro.pickup': score=-min(poses[names['mixamorig:'+name]][0][1] for name in targets)
        if mapping[ix]=='ciro.uppercut': score=max(poses[names['mixamorig:'+name]][0][1]-hp[1] for name in targets)
        if mapping[ix] in ('ciro.jab','ciro.frontKick','ciro.roundhouse','ciro.heavy','ciro.hook','ciro.ballThrow'): score=max(poses[names['mixamorig:'+name]][0][2]-hp[2] for name in targets)
        if mapping[ix]=='ciro.frontKick':
            low_kick_scores.append(max((poses[names['mixamorig:'+name]][0][2]-hp[2] for name in targets if poses[names['mixamorig:'+name]][0][1]<=.32),default=-float('inf')) if low<=t<=high else -float('inf'))
        scores.append(score if low<=t<=high else -float('inf'))
    contact=ts[max(range(len(scores)),key=lambda j:scores[j])] if ix in limbs else None
    hips=tracks[names['mixamorig:Hips'],'translation'][1]
    range_xyz=[max(v[k] for v in hips)-min(v[k] for v in hips) for k in range(3)]
    first,last=fk(start),fk(end)
    endpoint=max(2*math.acos(min(1,abs(sum(x*y for x,y in zip(first[i][1],last[i][1]))))) for i in g['skins'][0]['joints'])
    low_contact=ts[max(range(len(low_kick_scores)),key=lambda j:low_kick_scores[j])] if low_kick_scores else None
    row={'index':ix,'original':anim['name'],'internal':mapping.get(ix),'duration':round(end-start,6),'start':start,'end':end,'channels':len(anim['channels']),'bonesTracked':len({c['target']['node'] for c in anim['channels']}),'trackedBoneNames':sorted(g['nodes'][c['target']['node']].get('name','') for c in anim['channels'] if c['target']['path']=='rotation'),'hipsRange':range_xyz,'hipsFirst':hips[0],'hipsLast':hips[-1],'endpointMaxAngleDeg':round(math.degrees(endpoint),2),'loop':mapping[ix] in ('ciro.idle','ciro.run','ciro.walk'),'energyRange':[round(low,4),round(high,4)],'contactCandidate':round(contact,4) if contact else None,'lowKickContact':round(low_contact,4) if low_contact else None,'contactMethod':'FK: forward reach for punches/kicks/throw; maximum hand elevation for uppercut; lowest hand for pickup; low kick limits foot height to 0.32 model units. Candidates require visual acceptance.','use':'excluded: soccer clip not accepted' if 'Candidate' in mapping[ix] else 'mapped' if ix in mapping else 'audit only: no corresponding gameplay action'}
    clips.append(row)
(OUT/'clip-audit.json').write_text(json.dumps(clips,indent=2),encoding='utf-8')
# Associated with Ciro, explicitly corrected by the user.
# Every source clip remains previewable; unaccepted sports candidates are not gameplay mappings.
# Original clip names live only in this central manifest. Runtime ranges do not mutate the GLB.
runtime=[]
for r in clips:
    if not r['internal']: continue
    a,b=r['energyRange'] if not r['loop'] else [r['start'],r['end']]
    if r['internal']=='ciro.jump': a,b=.041667,.708333
    if r['internal']=='ciro.fall': a,b=.25,.875 # aerial segment before the ground collapse
    if r['internal']=='ciro.jumpDown': a,b=.416667,1.25
    duration={'ciro.jab':.23,'ciro.hook':.31,'ciro.uppercut':.31,'ciro.heavy':.84,'ciro.frontKick':.3,'ciro.roundhouse':.9,'ciro.dash':.3,'ciro.dodge':.3,'ciro.pickup':.24,'ciro.ballThrow':.36,'ciro.ballCatch':.26,'ciro.hitHead':.28,'ciro.hitSide':.28,'ciro.hitBodyA':.28,'ciro.hitBodyB':.32,'ciro.hitStomach':.32,'ciro.knockback':.45,'ciro.ko':.8}.get(r['internal'],b-a)
    runtime.append({'name':r['internal'],'index':r['index'],'original':r['original'],'originalDuration':r['duration'],'from':a,'to':b,'contact':r['contactCandidate'],'lowContact':r['lowKickContact'],'duration':duration,'loop':r['loop'],'fps':60,'contactVerified':False})
(ROOT/'src/minigames/characters/ciroClips.json').write_text(json.dumps(runtime,indent=2),encoding='utf-8')
(OUT/'clips.json').write_text(json.dumps([{**c,'name':c['name'].replace('ciro.','man.')} for c in runtime],indent=2),encoding='utf-8')
lines=['# Ciro clip audit','','| # | Original | Internal | Duration s | Bones/channels | Hips xyz range | Useful range | Contact candidate |','|---|---|---|---|---|---|---|---|']
for r in clips:
    name=r['original'].replace(chr(10),' ').replace('|','/')
    lines.append(f"| {r['index']} | {name} | {r['internal'] or 'audit only'} | {r['duration']:.3f} | {r['bonesTracked']}/{r['channels']} | {r['hipsRange']} | {r['energyRange']} | {r['contactCandidate']} |")
(OUT/'CLIP-AUDIT.md').write_text('\n'.join(lines),encoding='utf-8')
print(f"Man: {len(clips)} audited, {len(runtime)} mapped")
