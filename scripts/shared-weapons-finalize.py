from pathlib import Path
from html import escape
import json, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/shared-weapons'
read=lambda name:json.loads((out/name).read_text(encoding='utf8'))
catalog=read('catalog.json');browser=read('browser.json')
assert catalog['status']==browser['status']=='passed' and not browser['errors']
assert len(set(browser['rotation']['ids']))==11 and browser['model']['vertices']>1000
assert browser['chain']['hp']==[1000,400,935,935,1000] and len(browser['chain']['trace'])==3
assert browser['cover']['hp']==browser['height']['hp']==[1000,400,1000,1000,1000]
assert browser['reload']['ammo']==3 and not browser['reload']['reloading']
assert 'built in' in(out/'build.log').read_text(encoding='utf8',errors='replace')
summary={'status':'passed','catalog':catalog,'browser':browser,'changes':['ACR, Glock17, Remington870 and AK74U were already available in both modes.','Wunderwaffe DG2 added to the Sparatoria shuffle bag, with existing imported model, ADS, blue electrical shot and reload audio.','Sparatoria:3round magazine,6sreload,600directdamage,at most2secondary65damage targets within5m per link, existing world occlusion and damage authority.','Orda: same eleven unique weapons, no duplicated box weighting;600/1200 boss damage and ten-enemy chain/Pack rules preserved.','One red Ray Gun remains in each mode; no other weapon stats changed.'],'validation':['Catalog: eleven unique matching weapon IDs, one Ray Gun.','Actual FpsScene/renderer: eleven-weapon shuffle, electrical damage chain, one-ammo debit, cover and elevation blocking, miss, automatic six-second reload, imported model16786vertices, blue pooled tracers, one human viewport.','Existing animated pack and Orda perk/Pack/chain regression scripts passed.','Typecheck and final build passed.','Single screenshot visually inspected.'],'limits':['Targeted Cantiere gameplay/renderer fixture, not a full network multiplayer session.','No new FPS benchmark.'],'screenshot':'sparatoria-wunderwaffe.png'}
(out/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
(out/'README.md').write_text('''# Armi in entrambe le modalità

Undici armi uniche in Sparatoria e Orda. ACR, Glock17, Remington870 e AK74U erano già in entrambe. Aggiunta la Wunderwaffe alla rotazione casuale di Sparatoria, con modello originale, scariche blu e suoni dedicati. Un solo esemplare nel pool di Orda, senza cambiare probabilità o danni originali. Una sola Ray Gun rossa.

Sparatoria:3munizioni,ricarica6s,600danni diretti;scarica fino a due ulteriori avversari per65danni ciascuno,5m per collegamento, coperture e altezza rispettate. In Orda restano catena fino a10mostri,600/1200danni boss e Pack-a-Punch.

Passati catalogo, regressioni del weapon pack e perk Orda, prova di FpsScene reale per estrazione/sparo/catena/coperture/dislivelli/ricarica, modello e render, typecheck e build. Nessuna nuova misurazione FPS o prova multiplayer completa. Nessun commit, push o deploy eseguito da questo intervento.
''',encoding='utf8')
rows=''.join(f'<tr><td>{escape(w["name"])}</td><td>✓</td><td>✓</td></tr>' for w in catalog['sparatoria'])
(out/'index.html').write_text('''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Party Game · Armi condivise</title><style>body{margin:0;background:#101d27;color:#e8eee9;font:17px/1.6 system-ui}main{max-width:1200px;margin:auto;padding:30px}h1,strong,a{color:#e7c17e}table{border-collapse:collapse;width:100%;max-width:850px}td,th{text-align:left;padding:10px 16px;border-bottom:1px solid #3e5969}td:not(:first-child){color:#98d8b5}img{display:block;width:100%}figure{margin:30px 0;border:1px solid #3e5969}figcaption{padding:12px 18px}</style><main><h1>Le armi in Sparatoria e Orda</h1><p><strong>11 armi uniche in entrambe.</strong> ACR, Glock17, Remington870 e AK74U erano già presenti. La Wunderwaffe entra anche nella rotazione di Sparatoria; Orda conserva le sue regole e la Mystery Box. Una sola Ray Gun rossa.</p><table><tr><th>Arma</th><th>Sparatoria</th><th>Orda</th></tr>'''+rows+'''</table><figure><img src="sparatoria-wunderwaffe.png" alt="Wunderwaffe e scarica elettrica nel renderer reale di Sparatoria"><figcaption>Sparatoria · Wunderwaffe DG-2, modello originale e catena elettrica</figcaption></figure><p>Sparatoria: tre colpi, ricarica di sei secondi, fino a tre bersagli; la catena rispetta coperture, altezza e distanza. Orda mantiene catena fino a dieci nemici e Pack-a-Punch. Test mirati, typecheck e build superati. Nessun nuovo benchmark FPS. <a href="verification.json">Verifiche</a> · <a href="/">Apri il gioco</a></p></main></html>''',encoding='utf8')
subprocess.run([sys.executable,str(root/'scripts/human-views-finalize.py')],cwd=root,check=True)
dest=root/'dist/shared-weapons';dest.mkdir(parents=True,exist_ok=True)
for name in ['index.html','verification.json','sparatoria-wunderwaffe.png']:shutil.copy2(out/name,dest/name)
print('Shared weapons: eleven per mode, local gallery ready.')
