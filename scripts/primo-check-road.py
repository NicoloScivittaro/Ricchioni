"""Check the runtime sampled corridor against the actual low barrier triangles."""
import json,pathlib,numpy as np,cv2
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/agent-work/primo-karting';data=np.load(OUT/'collision-field.npz');mask=data['mask'];dist=data['distance'];probes=json.loads((OUT/'route-probes.json').read_text());errors=[];tested=0;minimum=999
for q in probes:
    p=np.array(q['p']);r=np.array(q['r'])
    for lat in [0,-q['width']/2-.55,q['width']/2+.55]:
        v=p+r*lat;x,z=v[[0,2]]/5;px,pz=int((x+60)*35),int((z+18)*35);tested+=1
        clearance=float(dist[pz,px]);minimum=min(minimum,clearance)
        if mask[pz,px]>0:errors.append({'s':q['s'],'lat':lat,'world':v.tolist()})
report={'samples':tested,'minimumRawClearance':minimum,'errors':errors,'method':'Runtime spline centre and both collision envelope edges against projected original plastic/tyre/wall/cone triangles'}
(OUT/'road-support.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if errors:raise SystemExit(1)
