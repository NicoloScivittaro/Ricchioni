"""Publish local evidence without changing Git or gameplay assets."""
from pathlib import Path
import json, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/human-views'
read=lambda name:json.loads((out/name).read_text(encoding='utf8'))
before=read('before-5.json');after={n:read(f'after-{n}.json') for n in [1,3,5]};cases=read('renderers.json');visual=read('visual.json')
assert cases['status']==visual['status']=='passed' and len(cases['cases'])==9
for case in cases['cases']:
 assert len(case['owners'])==len(case['cameras'])==case['panels'] and case['owners']==case['humans'] and case['actors']==case['participants']==5
for item in [before,*after.values()]:
 assert item['status']=='passed' and not item['errors']
 for key in ['gpu','width','height','scale','enemies','participants']:assert item['hardware'][key]==before['hardware'][key]
assert after[1]['sample']['fps']>before['sample']['fps']
assert all(after[n]['hardware']['views']==n for n in after)
assert 'built in' in (out/'build.log').read_text(encoding='utf8',errors='replace')
report={'status':'passed','before':before,'after':after,'tests':{'typecheck':'passed','build':'passed','selection':'1–5 humans, interleaved bots, stable roster order, phone/pad parity, no overlapping viewports','renderers':cases,'visual':visual},'conditions':'RTX 3050. 6-second Orda renderer samples after warmup, 22 animated monsters and 5 participants, fixed 1669x939 framebuffer in 1920x1080 window. Before: 5 cameras. After: 1, 3, 5 human cameras. No full AI/network/game simulation in benchmark. Native solo application rendering still uses scaling 1; fixed 1.15 is benchmark-only to compare equal pixel budgets.','changes':['Human-only view ownership shared by Orda, Backrooms, Sparatoria, Ribaltati; bots remain in simulation, avatars and results.','Solo owns a full-screen viewport. Friends using phone or pad own their own viewport.','Backrooms cameras, masks, jumpscares, spectator selection and stereo pan mapped to human identities, without creating bot-only UI/scare actors.','Orda no longer creates bot viewmodels/HUD/cameras; the solo first-person avatar is not instantiated when invisible to every camera.','Cached split layouts and unused pointer picking disabled; original graphics preserved.','Shared-camera and turn-based games retain their single world camera.'],'limits':['Short renderer benchmark, not a guarantee of multiplayer session FPS.','No automatic model/provider switch or delegation: current root is Sol, installed workflow requires Astra; previous explicit Sol preference retained.'],'screenshots':['orda-1.png','backrooms-3.png','fps-3.png']}
(out/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
fps=lambda item:f"{item['sample']['fps']:.1f}"
(out/'README.md').write_text(f'''# Visuali dei soli giocatori umani

Da solo: una visuale a schermo intero. Con amici: una visuale ciascuno (pad o telefono), senza riquadri dei bot. Tutti i partecipanti restano nella simulazione, nel mondo e nelle classifiche. Minigolf e altri giochi con camera condivisa conservano la singola camera.

Orda, confronto breve a risoluzione interna invariata1669×939,22 mostri animati,5 partecipanti: precedente5 visuali **{fps(before)} FPS**; ora1 visuale **{fps(after[1])} FPS**,3 visuali **{fps(after[3])} FPS**,5 visuali **{fps(after[5])} FPS**. RTX3050, campioni6s dopo riscaldamento. Misura del renderer, senza simulazione completa IA/rete. Il test forza1.15per confrontare lo stesso numero di pixel; il gioco in solo conserva il rendering nativo1.

Typecheck, build, verifica visiva e nove casi del renderer reale (Backrooms/Sparatoria/Ribaltati,1/3/5umani) superati. Controllati mascheramento avatar, jumpscare umano con bot intercalati, cattura bot senza creazione di visuale, spettatore su umani e ridimensionamento. Selettore/layout coperti da1a5umani. Nessun commit, push o deploy.
''',encoding='utf8')
html=f'''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Party Game · Le vostre visuali</title><style>body{{margin:0;background:#101b24;color:#e6ede8;font:17px/1.6 system-ui}}main{{max-width:1250px;margin:auto;padding:30px}}h1,strong,a{{color:#e9c57f}}.metrics{{display:flex;flex-wrap:wrap;gap:20px;margin:25px 0}}.metrics div{{background:#20323e;border-left:3px solid #84cbbf;padding:18px 24px;border-radius:0 10px 10px 0}}.metrics b{{display:block;font-size:30px;color:#b6e0c0}}img{{width:100%;display:block}}figure{{margin:30px 0;border:1px solid #3f5560}}figcaption{{padding:12px 16px}}p{{max-width:1100px}}</style><main><h1>Solo le vostre visuali</h1><p>Da solo hai tutto lo schermo. Con gli amici ogni giocatore umano ha la propria visuale, con pad o telefono. I bot restano avversari nel mondo, senza occupare riquadri. I giochi a camera condivisa mantengono il proprio funzionamento.</p><div class="metrics"><div><b>{fps(before)} → {fps(after[1])} FPS</b>Orda · da cinque visuali alla tua</div><div><b>{fps(after[3])} FPS</b>Tre umani, due bot</div><div><b>22 mostri · 5 partecipanti</b>Stessa risoluzione nel confronto</div></div><p>RTX3050, campioni di6secondi del renderer reale. Finestra1920×1080, interno1669×939 invariato. Il test non include l'intera simulazione multiplayer. Nessuna riduzione della qualità per ottenere questi risultati.</p><p>Typecheck e build superati; verificati1,3e5umani nei renderer di Backrooms, Sparatoria e Ribaltati, oltre ai campioni Orda. <a href="verification.json">Dati e verifiche</a> · <a href="/">Apri il gioco</a></p>'''
for name,title in [('orda-1.png','Orda · una visuale, gli altri quattro partecipanti restano nel mondo'),('backrooms-3.png','Backrooms · tre umani e due bot, soltanto tre riquadri'),('fps-3.png','Sparatoria · tre visuali umane con HUD e armi separati')]:html+=f'<figure><img src="{name}" alt="{title}"><figcaption>{title}</figcaption></figure>'
html+='</main></html>';(out/'index.html').write_text(html,encoding='utf8')
subprocess.run([sys.executable,str(root/'scripts/orda-graphics-finalize.py')],cwd=root,check=True)
dest=root/'dist/human-views';dest.mkdir(parents=True,exist_ok=True)
for name in ['index.html','verification.json',*report['screenshots']]:shutil.copy2(out/name,dest/name)
print('Human-only views: local gallery and verification ready.')
