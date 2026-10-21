"""Compare like-for-like renderer evidence and restore local galleries only."""
from pathlib import Path
import json, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/orda-graphics'
read=lambda name:json.loads((out/name).read_text(encoding='utf8'))
before,after=[read(name)for name in ['before.json','after.json']]
assert before['status']==after['status']=='passed' and not before['errors'] and not after['errors']
assert before['hardware']==after['hardware']
assert after['hardware']['views']==5 and after['hardware']['enemies']==22
assert after['sample']['fps']>before['sample']['fps']
assert all(a['vertices']==15648 and a['meshes']==4 and len(a['pivots'])==3 for a in after['integrity']['bacteria'])
assert after['integrity']['contacts']==27 and not after['integrity']['ramps']
assert len({a['vm']for a in after['integrity']['privateLayers']})==5
assert 'built in' in(out/'build.log').read_text(encoding='utf8',errors='replace')
gain=(after['sample']['fps']/before['sample']['fps']-1)*100
summary={'status':'passed','hardware':after['hardware'],'before':before['sample'],'after':after['sample'],'fpsGainPercent':round(gain,1),'conditions':'Two six-second samples after warmup. Same real Orda renderer, 22 animated enemies, five cameras, five different viewmodels, same camera sweep, same framebuffer1669x939 at1920x1080 window. Fixed presentation fixture; no AI/network/full combat simulation.','graphics':['Sharper concrete seams, grain and wear; cooler ambient fill with warmer directional light.','Shared baked-style contact shading under cover, soft instanced contact shadows for27 actors, warm floor light pools, cyan/amber wall guides. No extra dynamic lights or shadow maps.','Smaller premium station plates and compact translucent HUD; bounded boss bar.','Bacteria body uses one wet organic material instead of many near-black materials. Every original vertex and all three head/arm pivots retained; four meshes per actor. Other monster shapes and skins retained.'],'optimizations':['Batched rigid Bacteria parts by material/layout:952 to652 average draws per frame.','Static monster and station materials frozen; unused pointer picking disabled; no preserved framebuffer copy.','Actor contact shadows use one instanced draw per camera rather than one draw per creature.'],'tests':{'renderer':'passed','visual':'Five-view scene and close-up inspected','verticesAndPivots':'15648 source vertices retained per Bacteria actor; Head/LeftArm/RightArm preserved','viewmodelLayers':'Five separate masks preserved','ramps':'Original double-sided ramp material retained','typecheck':'passed','build':'passed'},'limits':['One short before/after renderer comparison on RTX3050; not a long-session or full multiplayer FPS guarantee.','Final actor shadows consume about one draw per camera; final result39.2FPS supersedes an intermediate41.8FPS sample.','Scope is Orda; other minigames, shared gameplay rules and original Downloads assets were not changed.'],'screenshots':['before.png','after.png','detail.png']}
(out/'verification.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf8')
(out/'README.md').write_text(f'''# Orda — grafica e fluidità

Nel confronto breve del renderer: **{before['sample']['fps']:.1f} → {after['sample']['fps']:.1f} FPS**, +{gain:.0f}%. RTX3050,5 visuali,22 mostri animati, finestra1920×1080 e interno1669×939 invariati. Circa952→652 disegni per fotogramma. Campioni di6s dopo riscaldamento, fixture visiva ripetibile con le armi reali; nessuna simulazione completa di IA/rete. Non è una garanzia di FPS in ogni partita.

Grafica: pavimento più dettagliato, luce ambientale fredda e direzionale calda, ombre di contatto per mostri e ripari, zone di luce precalcolate, guide luminose, cartelli più curati e HUD meno invasivo. Nessun nuovo ostacolo o luce dinamica. Le ombre degli attori sono27 istanze di una sola mesh.

Ottimizzazione principale: Bacteria e Macellaio condividono un materiale organico scuro e le parti rigide vengono unite. Tutti i15648 vertici originali e i pivot di testa e braccia restano presenti, quattro mesh per attore. Materiali statici congelati, picking inutile disabilitato e framebuffer non conservato. Altre sagome e animazioni preservate.

Verificati renderer reale,5 visuali e layer separati delle armi, geometria/pivot, rampe a doppia faccia, controllo visivo, typecheck e build finale. Prezzi, danni, perk, fisica e comandi non modificati. Nessun commit, push o deploy.
''',encoding='utf8')
page=f'''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Orda · Grafica e fluidità</title><style>body{{margin:0;background:#0c171f;color:#e7e9e3;font:17px/1.6 system-ui}}main{{max-width:1320px;margin:auto;padding:30px}}h1,a,strong{{color:#e8c287}}.metrics{{display:flex;gap:30px;flex-wrap:wrap;margin:25px 0}}.metrics div{{padding:18px 26px;background:#172a35;border-left:3px solid #77c7d0;border-radius:0 10px 10px 0}}.metrics b{{display:block;font-size:32px;color:#a7dfbf}}img{{display:block;width:100%}}figure{{margin:25px 0;border:1px solid #40545e}}figcaption{{padding:12px 18px}}p{{max-width:1100px}}</style><main><h1>Orda · Più leggibile, più fluido</h1><div class="metrics"><div><b>{before['sample']['fps']:.1f} → {after['sample']['fps']:.1f} FPS</b>Confronto breve del renderer</div><div><b>5 visuali ·22 mostri</b>Risoluzione interna invariata1669×939</div><div><b>952 →652</b>Disegni medi per fotogramma</div></div><p>Pavimento più curato, illuminazione calda/fredda, ombre morbide di contatto, dettagli luminosi e HUD compatto. Il corpo dei Bacteria conserva tutti i vertici e le articolazioni, con molte meno parti da disegnare. Regole, acquisti e danni restano invariati.</p><p>RTX3050, finestra1920×1080. Due campioni di6s dopo riscaldamento, stessa fixture del renderer reale. Questa prova misura la presentazione grafica, senza il carico completo di IA, rete e combattimento multiplayer. <a href="verification.json">Condizioni e verifiche</a> · <a href="/">Party Game</a></p>'''
for name,label in [('before.png','Prima · campione con cinque visuali'),('after.png','Dopo · nuove superfici e ombre, stessa risoluzione'),('detail.png','Dettaglio · Mystery Box, arma e arena')]:page+=f'<figure><img src="{name}" alt="{label}"><figcaption>{label}</figcaption></figure>'
page+='<p>Typecheck e build superati. Nessun commit, push o deploy.</p></main></html>'
(out/'index.html').write_text(page,encoding='utf8')
subprocess.run([sys.executable,str(root/'scripts/orda-perks-finalize.py')],cwd=root,check=True)
dest=root/'dist/orda-graphics';dest.mkdir(parents=True,exist_ok=True)
for name in ['index.html','verification.json',*summary['screenshots']]:shutil.copy2(out/name,dest/name)
print(f'Orda graphics: {before["sample"]["fps"]:.1f} -> {after["sample"]["fps"]:.1f} FPS; local gallery ready.')
