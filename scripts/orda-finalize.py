"""Restore existing local galleries and publish the four accepted Orda screenshots locally."""
from pathlib import Path
import json, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1]
out=root/'docs/agent-work/orda-finale'
browser=json.loads((out/'browser.json').read_text(encoding='utf8'))
logic=json.loads((out/'logic-tests.json').read_text(encoding='utf8'))
assert browser['status']=='passed' and browser['url']=='http://localhost:3012'
assert len(browser['screenshots'])==4
assert logic['status']=='passed'
assert 'built in' in (out/'build.log').read_text(encoding='utf8',errors='replace')
perf=browser['benchmarkSummary']
manifest=json.loads((root/'public/audio/narrator/manifest.json').read_text(encoding='utf8'))
clips={k:v for k,v in manifest.items() if k.startswith('game-orda-')}
summary={'status':'passed','game':'ORDA FINALE','arena':'Il Deposito Infetto','participants':'2–5, pad e telefono; bot opzionali del sistema esistente',
 'enemies':['Infetto','Corridore','Colosso','Assalitore','Cacciatore'],'boss':'Macellaio ogni 5 ondate: carica, colpo a terra, onda d’urto, fase sotto 40% HP',
 'weapons':[r['id'] for r in browser['weaponModels']],'winner':'Ultimo vivo; morte permanente, nessun respawn o fuoco amico. Morti simultanee: tempo impatto, uccisioni, danni, ID stabile.',
 'performance':perf,'gpu':browser['gpu'],'tests':logic['checks'],'naturalBotMatch':logic['simulation'],'browser':'Tre umani + due bot, pad simulati, vero controller telefono, invio classifica al server, nessun errore JS',
 'typecheck':'passed','build':'passed','narratorClips':clips,'limits':['Un boss implementato; nessun secondo boss opzionale.', 'Modelli riutilizzati da Backrooms con varianti uniformi, non nuovi personaggi modellati.', 'Eliminati: scheda risultati e visuali 3D spente, nessuna camera spettatore navigabile.', 'Pad provati attraverso il percorso reale con hardware simulato, non controller fisici.', 'Campione FPS breve, risoluzione interna ridotta esplicitamente di 1.15; non equivale a 1080p nativo o a una garanzia FPS. Il solo harness ripristina gli HP per mantenere cinque visuali durante il campione.', 'Non sono state giocate intere partite degli altri minigiochi. Sparatoria e Backrooms rimangono nel catalogo e la logica esistente non è stata modificata.'],
 'commitPushDeploy':'none','delegation':'none — Sol, come richiesto'}
(out/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
text=f'''# Orda Finale — L’ultimo vivo vince

Giocabile dal catalogo del Party Game, 2–5 partecipanti, pad o telefono, con bot opzionali. Arena originale **Il Deposito Infetto**: container, corridoi laterali, coperture, otto ingressi e passerella con due rampe raggiungibili anche dai mostri.

Cinque archetipi (Infetto, Corridore, Colosso, Assalitore, Cacciatore) e Macellaio ogni cinque ondate. Crescita progressiva con statistiche limitate, massimo 22 mostri attivi e spawn in coda. Sei armi del registro attuale, munizioni finite, depositi rinnovabili, cure e cassa con benefici temporanei. Nessun fuoco amico.

La morte è definitiva. Vittoria fissata al termine dello stesso passo logico quando resta un vivo; combattimento fermo durante la breve celebrazione. In caso di morti simultanee: tempo reale dell’impatto, poi mostri uccisi, danni effettivi e ID stabile. Classifica inviata al server e punti assegnati dal sistema esistente.

Verifiche: typecheck e build; controlli mirati del motore (rampe, collisioni/visibilità, armi, ammo, spawn, boss e archetipi, indipendenza dagli FPS, eliminazione/spareggi); partita naturale con cinque bot conclusa all’ondata {logic['simulation']['wave']}; prova compilata con tre umani e due bot, controller telefono, pad simulati, sei modelli GLB e classifica reale. Quattro screenshot, nessun video. Due nuovi annunci del narratore; catalogo audio completo decodificato correttamente.

**Cinque visuali: {perf['fps']:.1f} FPS medi**, {perf['render']} interni, RTX 3050/D3D11, campione di {perf['seconds']} s con {perf['enemies'][0]}–{perf['enemies'][1]} mostri. Finestra 1920×1080, scala 1,15. Il solo harness ripristina gli HP per conservare tutte e cinque le camere: AI, attacchi, movimento e rendering restano attivi. Non è un benchmark a 1080p nativo né una garanzia su tutta la partita.

Limiti: un solo boss, modelli Backrooms riutilizzati, schede degli eliminati al posto di un osservatore navigabile, nessuna prova con pad fisici. Gli altri minigiochi non hanno ricevuto test di partita completi. Nessun commit, push, deploy, Flash o dipendenza aggiunta.
'''
(out/'README.md').write_text(text,encoding='utf8')
cards=''.join(f'<figure><img loading="lazy" src="{name}" alt="{label}"><figcaption>{label}</figcaption></figure>' for name,label in zip(browser['screenshots'],['Prima ondata · cinque visuali','Ondata avanzata · Il Macellaio','Armi e ottica del cecchino','Ultimo vivo · vittoria']))
(out/'index.html').write_text(f'''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orda Finale</title><style>body{{margin:0;padding:32px;background:#102022;color:#e8e4d6;font:17px/1.55 system-ui}}main{{max-width:1400px;margin:auto}}h1,a{{color:#dec084}}small{{color:#a5beb2}}.gallery{{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px}}figure{{margin:0;background:#1b3031;border:1px solid #53615a;border-radius:12px;overflow:hidden}}img{{display:block;width:100%}}figcaption{{padding:12px}}@media(max-width:600px){{body{{padding:15px}}.gallery{{grid-template-columns:1fr}}}}</style><main><small>PARTY GAME · NUOVO MINIGIOCO</small><h1>ORDA FINALE</h1><p>L’ULTIMO VIVO VINCE · Il Deposito Infetto · 2–5 giocatori</p><p>Cinque archetipi, Macellaio ogni cinque ondate, sei armi, rifornimenti e nessuna seconda vita.</p><p><strong>{perf['fps']:.1f} FPS · cinque visuali</strong> a {perf['render']} interni su RTX 3050. Campione controllato di sei secondi; dettagli e limiti nel report.</p><p><a href="README.md">Report breve</a> · <a href="verification.json">Verifiche</a> · <a href="/">Apri Party Game</a></p><div class="gallery">{cards}</div></main></html>''',encoding='utf8')
subprocess.run([sys.executable,str(root/'scripts/narrator-voice-finalize.py')],cwd=root,check=True)
dst=root/'dist/orda-finale';dst.mkdir(exist_ok=True)
for name in ['index.html','README.md','verification.json',*browser['screenshots']]:shutil.copy2(out/name,dst/name)
failure=out/'failure.png'
if failure.exists():failure.unlink()  # Only the transient screenshot created by this task's failed QA runs.
print(f"Orda Finale verificato: {perf['fps']:.1f} FPS, quattro screenshot, gallerie precedenti ripristinate.")
