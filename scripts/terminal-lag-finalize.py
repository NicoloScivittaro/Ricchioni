"""Restore previous galleries and publish only accepted Terminal evidence."""
from pathlib import Path
import json, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1]
out=root/'docs/agent-work/terminal-lag'
a=json.loads((out/'acceptance.json').read_text())
assert a['status']=='passed'
assert 'built in' in (out/'build.log').read_text(encoding='utf-8',errors='replace')
samples=a['paired']['samples']
before=[s for s in samples if not s['optimized']]
after=[s for s in samples if s['optimized']]
mean=lambda rows,key:sum(s[key] for s in rows)/len(rows)
result={'status':'passed','scope':'Terminal renderer only; simulation and other arenas unchanged',
 'conditions':{k:v for k,v in a['paired'].items() if k!='samples'},
 'before':{k:mean(before,k) for k in ['fps','renderMs','candidatesPerFrame','uniform4UploadsPerFrame']},
 'after':{k:mean(after,k) for k in ['fps','renderMs','candidatesPerFrame','uniform4UploadsPerFrame']},
 'visibility':a['visibility'],'feedback':a['feedback'],'typecheck':'passed','build':'passed',
 'limitations':'Short headless samples varied widely between runs. Native five-view FPS remain low; no stable 60 FPS claim.',
 'commitPushDeploy':'none'}
prod=out/'production.json'
assert prod.exists(),'Compiled game check required'
result['production']=json.loads(prod.read_text())
assert result['production']['status']=='passed'
(out/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
(out/'README.md').write_text('''# Terminal: cinque visuali

Due correzioni nel renderer condiviso di Terminal: selezione delle mesh per layer prima delle valutazioni costose e cache degli atlanti per programma GPU. Nessuna modifica a geometria, texture, risoluzione, armi, danni o collisioni.

Confronto alternato A/B nella stessa scena Full HD, qualità alta, scala 1, cinque personaggi e armi importati. Mesh candidate per fotogramma: 3433 → 2366 (-31%); invii uniform4 degli atlanti/materiali: 197 → 55 (-72%). FPS e condizioni complete in verification.json: i campioni headless variano molto e restano bassi a risoluzione nativa; questa correzione non dimostra 60 FPS stabili.

Superati typecheck, build, confronto degli oggetti visibili su quattro orientamenti per tutte e cinque le camere, sei modelli di arma, ADS, ricarica, colpo/danno, eliminazione e respawn. Prova compilata in production.json.
''',encoding='utf-8')
(out/'index.html').write_text('''<!doctype html><meta charset="utf-8"><title>Terminal · 5 visuali</title><style>body{margin:32px;background:#111827;color:#e2e8f0;font:17px system-ui}main{max-width:1200px;margin:auto}img{width:100%;border-radius:12px}a{color:#67e8f9}pre{white-space:pre-wrap}h1{color:#67e8f9}</style><main><h1>Terminal · cinque visuali</h1><p>Stessa geometria e qualità: -31% mesh candidate, -72% invii uniform4. FPS nativi ancora bassi e variabili nel benchmark headless.</p><p><a href="verification.json">Risultati</a> · <a href="README.md">Note</a></p><img src="final.png" alt="Terminal con cinque visuali"><img src="production.png" alt="Prova nella partita compilata"></main>''',encoding='utf-8')
subprocess.run([sys.executable,str(root/'scripts/litorale-finalize.py')],cwd=root,check=True)
dst=root/'dist/terminal-lag';dst.mkdir(exist_ok=True)
for name in ['index.html','README.md','verification.json','acceptance.json','production.json','build.log','final.png','production.png']:
 if (out/name).exists():shutil.copy2(out/name,dst/name)
print('Terminal evidence and previous galleries restored.')
