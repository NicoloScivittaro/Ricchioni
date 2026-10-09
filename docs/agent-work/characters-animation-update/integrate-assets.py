"""Preserve previous action contracts and add native preview clips to versioned assets."""
import json, pathlib, shutil, hashlib
OUT=pathlib.Path(__file__).parent
ROOT=OUT.parents[2]
for ns, dest, names in [
    ('buttafuori','detailed-tripo/detailed_character_casacarbo.glb',{1:'interactionA',3:'slip',10:'bucketWalk',13:'getUp',14:'squeegee',22:'scoopA',23:'fallBackward',24:'scoopB',33:'bucketEmpty',46:'floodBlock',49:'interactionB'}),
    ('goblin','goblin-tripo/green_goblin_casacarbo.glb',{4:'scared',5:'defeatAlternate',6:'interactionA',10:'dribbleCandidate',11:'squeegee',13:'footballPassCandidate',15:'regalAttackCandidate',16:'diveCandidate',18:'getUp',21:'jumpRopeCandidate',22:'scoopA',26:'bucketWalk',27:'fallBackward',28:'bucketEmpty',30:'slip',32:'box3Candidate',33:'soccerLegsCandidate',37:'interactionB',39:'walkCandidate',40:'scoopB',44:'box2Candidate',46:'waveGoodbye',48:'frontKick2Candidate',50:'frontKick1Candidate'}),
    ('judoka','judoka-tripo/judo_figure_casacarbo.glb',{1:'box2Candidate',5:'soccerInstepCandidate',6:'box1Candidate',7:'interactionA',11:'regalAttackCandidate',15:'soccerPowerCandidate',16:'floodBarrier',17:'bucketEmpty',18:'soccerKickCandidate',20:'spellCandidate',21:'squeegee',23:'bucketWalk',27:'scoopA',30:'fallBackward',31:'floodBlock',33:'interactionB',34:'regalAnticipationCandidate',35:'getUp',38:'scoopB',39:'soccerLegsCandidate',46:'punchCandidate',48:'slip'})
]:
    folder=OUT/ns
    report=json.loads((folder/'comparison.json').read_text())
    assert all(report[k] for k in ['sameGeometryAndSkinAttributes','sameTextures','sameBindMatrices','sameBoneNames','sameMaterialParameters','sameNodeTransforms'])
    assert not report['missingPreviousClips']
    assert all(c['unchanged'] is not False for c in report['clips'])
    rows={c['original']:c for c in report['clips']}
    previous=json.loads((folder/'previous-clips.json').read_text())
    clips=[]
    for c in previous:
        assert c['original'] in rows
        clips.append({**c,'index':rows[c['original']]['index']})
    included={c['index'] for c in clips}
    for r in report['clips']:
        if r['index'] in included: continue
        name=names[r['index']]
        clips.append({'name':f'{ns}.{name}','index':r['index'],'original':r['original'],'originalDuration':r['end']-r['start'],'from':r['start'],'to':r['end'],'contact':None,'lowContact':None,'duration':r['end']-r['start'],'loop':name in ('squeegee','bucketWalk','scoopA','scoopB','floodBlock'),'fps':60,'contactVerified':False})
    assert len({c['name'] for c in clips})==len(clips)
    assert len({c['index'] for c in clips})==len(report['clips'])
    (ROOT/f'src/minigames/characters/{ns}Clips.json').write_text(json.dumps(clips,indent=2)+'\n',encoding='utf-8')
    (folder/'runtime-clips.json').write_text(json.dumps(clips,indent=2)+'\n',encoding='utf-8')
    target=ROOT/'public/models'/dest
    shutil.copyfile(report['source'],target)
    assert hashlib.sha256(target.read_bytes()).hexdigest()==report['sha256']
    print(ns,len(report['clips']),'native clips;',len(clips),'semantic clips; original byte-identical')
