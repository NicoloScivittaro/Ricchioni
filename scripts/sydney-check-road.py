"""Independent triangle support check of the runtime spline, including its edges."""
import json,pathlib,numpy as np
__file__=str(pathlib.Path(__file__).with_name('sydney-route.py'))
exec(pathlib.Path(__file__).read_text().split('# Clockwise')[0])
checks=json.loads((OUT/'checks.json').read_text());probes=json.loads((OUT/'route-probes.json').read_text());errors=[];tested=0;connectors=0
route=np.array(json.loads((ROOT/'src/minigames/kart-race/sydneyRoute.json').read_text()))
for probe in probes:
    if probe['air']:continue
    p=np.array(probe['p']);near=route[np.argmin(np.sum((route[:,:3]-p)**2,axis=1))];t=near[4]
    if 6.04<=t<=6.96 or 11.96<=t<=12.72:connectors+=1;continue
    for lateral in [0,-probe['width']/2,probe['width']/2]:
        q=p+np.array(probe['r'])*lateral;x,h,z=q/.65;y=ground(x,z,h);tested+=1
        if y is None or abs(y-h)>.9:errors.append({'s':round(probe['s'],2),'t':t,'lat':round(lateral,2),'heightDelta':None if y is None else round((h-y)*.65,3)})
report={'groundSamples':tested,'connectorSamples':connectors,'errors':errors}
(OUT/'road-support.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if errors:raise SystemExit(1)
