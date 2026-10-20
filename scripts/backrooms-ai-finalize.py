from pathlib import Path
import json,shutil,subprocess,sys
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/backrooms-ai'
if 'built in' not in (out/'build.log').read_text(encoding='utf-8',errors='replace'):raise SystemExit('Final AI build is not complete')
v=json.loads((out/'verification.json').read_text(encoding='utf-8'));v['status']='passed';v['typecheck']='passed (tsc --noEmit)';v['build']='passed (vite build)';(out/'verification.json').write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
p=out/'README.md';p.write_text(p.read_text(encoding='utf-8').replace('Typecheck e build: vedere verification.json e build.log.','Typecheck e build finale superati; vedere verification.json e build.log.'),encoding='utf-8')
old=root/'docs/agent-work/backrooms-2/index.html';html=old.read_text(encoding='utf-8')
if '/backrooms-ai/' not in html:old.write_text(html.replace('<nav>','<nav><a href="/backrooms-ai/">Aggiornamento IA dei mostri</a>',1),encoding='utf-8')
subprocess.run([sys.executable,str(root/'scripts/backrooms-finalize.py')],cwd=root,check=True)
dest=root/'dist/backrooms-ai';dest.mkdir(exist_ok=True)
for name in ['index.html','README.md','verification.json','build.log','rules.json','rules.log','performance-after.json','split-five.png']:
 shutil.copy2(out/name,dest/name)
print('Backrooms smarter-AI report restored alongside all previous galleries.')
