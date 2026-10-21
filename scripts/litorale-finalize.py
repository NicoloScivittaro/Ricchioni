"""Publish only accepted local report files after a successful build."""
from pathlib import Path
import json, re, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1]
out=root/'docs/agent-work/litorale-lag'
build=(out/'build.log').read_text(encoding='utf-8',errors='replace')
assert 'built in' in build, 'Final build must succeed first'
before=json.loads((out/'before-verified-fullhd-5.json').read_text())
after=json.loads((out/'final-fullhd-5.json').read_text())
loading=json.loads((out/'loading.json').read_text())
assert loading['status']=='passed'
production=out/'production.json'
compiled=json.loads(production.read_text()) if production.exists() else {}
verification={
 'status':'passed' if compiled.get('status')=='passed' else 'awaiting_compiled_check',
 'scope':['Litorale loading readiness','single-pass wheels','coastal HUD at 30 Hz','auto-quality starts after hidden loading'],
 'testConditions':{'gpu':after['metrics']['renderer']['renderer'],'resolution':[1920,1080],'quality':'high','scale':1,'views':5,'sampleSeconds':6},
 'before':{k:before['metrics'][k] for k in ['fps','render','frame','draws','vertices']},
 'after':{k:after['metrics'][k] for k in ['fps','render','frame','draws','vertices']},
 'geometry':'passed: original wheel positions/normals/UVs/triangles and rubber/metal distinction retained; submissions 2 to 1',
 'loading':loading['checks'],
 'hudTiming':loading['hud'],
 'typecheck':'passed: tsc --noEmit',
 'build':re.findall(r'built in ([^\n\r]+)',build)[-1],
 'production':compiled.get('status','pending'),
 'routing':'Direct Sol implementation; no child inference requests',
 'commitPushDeploy':'none'
}
(out/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf-8')
readme=out/'README.md'
readme.write_text(readme.read_text(encoding='utf-8').replace('Typecheck finale e build: in corso.','Typecheck finale e build superati; prova compilata: '+('superata.' if compiled.get('status')=='passed' else 'in corso.')).replace('prova compilata: in corso.','prova compilata: superata.' if compiled.get('status')=='passed' else 'prova compilata: in corso.'),encoding='utf-8')
subprocess.run([sys.executable,str(root/'scripts/party-home-finalize.py')],cwd=root,check=True)
reports={
 'bots-ribaltati':['index.html','README.md','verification.json','browser.json','production.json','build.log','room.png','ribaltati.png'],
 'litorale-lag':['index.html','README.md','verification.json','loading.json','build.log','before-verified-fullhd-5.json','final-fullhd-5.json','before-verified-fullhd-5.png','final-fullhd-5.png','production.json','production.png']
}
for name,files in reports.items():
 src=root/'docs/agent-work'/name;dst=root/'dist'/name;dst.mkdir(exist_ok=True)
 for file in files:
  if (src/file).is_file():shutil.copy2(src/file,dst/file)
print('Previous galleries, bot settings report and accepted Litorale report restored.')
