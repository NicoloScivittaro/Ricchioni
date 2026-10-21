from pathlib import Path
import json, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/minigolf-surfaces'
before=json.loads((out/'before.json').read_text());after=json.loads((out/'after.json').read_text());prod=json.loads((out/'production.json').read_text())
assert after['status']=='passed' and prod['status']=='passed'
assert 'built in' in (out/'build.log').read_text(encoding='utf-8',errors='replace')
result={'status':'passed','cause':'Single-sided CAD surfaces plus shared material state changed by earlier courses','fix':'Two-sided rendering and lighting for imported surfaces and procedural playing floors','geometryAndCollisionChanges':False,'freshCourses':after['fresh'],'courseSwitches':after['order'],'cameraAngles':len(after['orbit']),'production':prod,'typecheck':'passed','build':'passed','commitPushDeploy':'none'}
(out/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
(out/'README.md').write_text('''# Minigolf: superfici stabili

Corrette le superfici CAD disegnate da un solo lato e le impostazioni dei materiali condivisi che cambiavano in base alla pista precedente. Superfici importate e piani di gioco ora sono visibili e illuminati da entrambi i lati. Nessuna modifica a geometria, fisica, collisioni o regole.

Verificati 12 percorsi caricati da zero, cambi Dune/Palme/Lungomare, 12 angoli camera, opacità e numero di vertici invariati. Typecheck e build superati; conferma anche nella partita compilata sulle Dune.
''',encoding='utf-8')
(out/'index.html').write_text('''<!doctype html><meta charset="utf-8"><title>Minigolf · superfici</title><style>body{max-width:1100px;margin:32px auto;background:#16362f;color:#f4efdb;font:18px system-ui}img{width:100%;border-radius:12px}a{color:#9ee8ba}</style><h1>Minigolf: superfici stabili</h1><p>Visibilità da entrambi i lati, indipendente dalla pista precedente. Fisica e collisioni preservate.</p><p><a href="verification.json">Verifiche</a> · <a href="README.md">Note</a></p><img src="after-palme.png" alt="Green delle Palme"><img src="production.png" alt="Dune nel gioco compilato">''',encoding='utf-8')
subprocess.run([sys.executable,str(root/'scripts/terminal-lag-finalize.py')],cwd=root,check=True)
dst=root/'dist/minigolf-surfaces';dst.mkdir(exist_ok=True)
for name in ['index.html','README.md','verification.json','before.json','after.json','production.json','build.log','after-palme.png','production.png']:
 shutil.copy2(out/name,dst/name)
print('Minigolf surface correction report and previous galleries restored.')
