"""Restore local review galleries after Vite cleans dist; no gameplay/source changes."""
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1];docs=root/'docs/agent-work';dist=root/'dist';out=docs/'backrooms-2'
if 'built in' not in (out/'build.log').read_text(encoding='utf-8',errors='replace'):raise SystemExit('Final build must succeed before restoring galleries')
v=json.loads((out/'verification.json').read_text(encoding='utf-8'));v['status']='passed';v['typecheck']='passed, npm run build starts with tsc --noEmit';v['build']='passed, see build.log';(out/'verification.json').write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
p=out/'README.md';p.write_text(p.read_text(encoding='utf-8').replace('Typecheck/build: stato e log in `verification.json` e `build.log`.','Typecheck e build finale superati (`npm run build`: `tsc --noEmit && vite build`). Log in `build.log`.'),encoding='utf-8')
folders='ribaltati-3 rainbow-glide glide-polish map-voting rainbow-1-3 ribaltati-1-4 sydney-sprint primo-karting nuketown track-corrections terminal-conversion terminal-2 fps-weapons terminal-fixes fps-arsenal terminal-2-1 terminal-2-2 terminal-2-3 terminal-2-4 sparatoria-3 trentuno-2 trentuno-italiano cornicione-2 minigolf minigolf-2 minigolf-redesign minigolf-gravity minigolf-3'.split()
count=0
for name in folders:
 src=docs/name
 if not src.is_dir():continue
 dest=dist/name;dest.mkdir(exist_ok=True)
 for p in src.iterdir():
  if p.is_file() and p.suffix.lower() in {'.html','.md','.png','.jpg','.jpeg','.webm','.json','.log'}:shutil.copy2(p,dest/p.name)
 count+=1
files=['index.html','README.md','verification.json','build.log','audio.json','rules.json','browser.json','performance-before.json','performance-after.json','hazmat.png','bacteria.png','partygoer.png','smiler.png','first-two.png','split-five.png']
dest=dist/'backrooms-2';dest.mkdir(exist_ok=True)
for name in files:shutil.copy2(out/name,dest/name)
gallery=dist/'fps-weapons/gallery.html'
if gallery.is_file():shutil.copy2(gallery,gallery.parent/'index.html')
print(f'Restored {count} prior local galleries plus Backrooms 2.0 (six representative images).')
