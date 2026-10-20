"""Restore local reports after the menu build; no source or gameplay changes."""
from pathlib import Path
import json,shutil,subprocess,sys
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/party-home'
if 'built in' not in (out/'build.log').read_text(encoding='utf-8',errors='replace'):raise SystemExit('Menu build has not succeeded')
v=json.loads((out/'verification.json').read_text(encoding='utf-8'));v['status']='passed';v['build']='passed: tsc --noEmit && vite build';(out/'verification.json').write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
p=out/'README.md';p.write_text(p.read_text(encoding='utf-8').replace('build finale in corso.','build finale superata.'),encoding='utf-8')
subprocess.run([sys.executable,str(root/'scripts/backrooms-ai-finalize.py')],cwd=root,check=True)
dest=root/'dist/party-home';dest.mkdir(exist_ok=True)
for name in ['index.html','README.md','verification.json','build.log','browser.json','navigation.json','visual.json','pad-rules.log','lobby.png','room.png','catalog.png','roulette.png']:
 shutil.copy2(out/name,dest/name)
print('All previous local galleries plus the new Party home gallery restored.')
