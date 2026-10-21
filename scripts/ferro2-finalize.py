from pathlib import Path
from html import escape
import json,shutil,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/agent-work/ferro-2'
read=lambda file:json.loads((OUT/file).read_text(encoding='utf8'))
rules=read('rules.json');integration=read('integration.json');visual=read('visual.json');conversion=read('conversion.json')
assert all(r['status']=='passed' for r in [rules,integration,visual])
assert 'built in' in (OUT/'build.log').read_text(encoding='utf8')
metrics=visual['maps'];assert {m['map']for m in metrics}=={'hell','geonosis'}
summary={
 'status':'passed','feature':'FERRO E FURIA 2.0 — HONOR & STEEL',
 'assets':'All ten supplied GLBs converted; two local animation packs inventoried (244 FBX files). Four sword cosmetics, two shields, bow plus separated arrow, Longinus; Melee pack dagger/hammer. Original axe retained because no new axe was supplied.',
 'maps':'Colosseum retained; Hell and Geonosis added to the existing server-authorized vote registry. Original geometry/UVs retained. Hell enclosing12-triangle background box excluded; collision, floor and navigation derived from original geometry on0.4m proxies.',
 'lock':'Held LT; visible live targets within14m, smooth facing and strafe, R3 cycle, release/transfer on death and LOS loss. Free camera otherwise; bow uses LT aim.',
 'guards':'Top/left/right via locked right stick or phone buttons; immutable attack direction, exact defender-space mirror helper shared with incoming HUD cues. Blade poses and authoritative active-window sweeps use the same sampler.',
 'defence':'130ms fresh-input parry, directional block and stamina costs; heavy-windup-only feint with blend; close guard-break and270ms counter; physical dodge, stamina recovery delay, delayed fair bot reactions.',
 'animationClips':conversion['clips'],
 'adaptation':'Actual authored FBX hand/body motion sampled and retargeted to registered cartoon rigs. Additive directional strikes/guards, two-link hand IK, feint blend, parry deflection, break/counter push and dodge layers are original; no dedicated pack clips falsely claimed.',
 'bow':'Load/hold/release/recovery source clips; projectile at0.10s of release, synchronized ammo/charge/stamina; held arrow and bow follow aim pitch. Cancel/blur never releases a shot.',
 'fivePlayers':'Five characters remain active; only human participants receive viewports. Tenacity charges only from distinct recent attackers and briefly reduces stagger, with no automatic damage or invulnerability.',
 'optimization':'Shared geometry/materials, exact equivalent-material merging, removal of unused imported texture channels, pooled effects/projectiles and covered GPU warm draw. Geonosis uses1600x900 internal rendering with3–5 views on a1920x1080 canvas; HUD remains native resolution.',
 'benchmark':metrics,
 'benchmarkConditions':'Local Chrome ANGLE/D3D11 RTX3050, five active viewports, fixture HP1000 only to keep all actors alive.90 rendered warmup frames, one final6s sample per new map. sampledFps is measured frames/elapsed wall time; engine FPS is diagnostic only. Not a network or physical-pad benchmark; earlier startup-affected samples are not treated as comparable before/after proof.',
 'checks':rules['checks'],
 'integration':'Real Socket.IO session, two human identities, actual controller.html, simulated Xbox profile: map vote, weapon selection, three phone guards, held LT/right-stick, RT damage, B feint, bow charge/cancel/release hit and cleanup passed.',
 'validation':['TypeScript typecheck passed','Final Vite production build passed','Targeted current and legacy Ferro rules passed','Visual asset/model/camera verification','Two-human phone/pad integration','Brief5-view combat fixture and final6s samples'],
 'limits':['No physical controller connected/tested.','Geometric0.4m collision proxy is not pixel-perfect for every decorative edge or stacked surface.','Bow is declared CC BY-NC-SA4.0; Scutum Standard entitlement and underlying franchise IP clearance remain unverified. Sources/licenses/modifications are preserved in each GLB and CREDITS.json. No publication clearance asserted.','Performance is measured locally and is not guaranteed on other devices.'],
 'production':read('production.json'),
 'git':'No commit, push or deploy','screenshots':['guard-duel.png','hell-arena.png','geonosis-five.png']
}
(OUT/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
table='\n'.join(f"| {m['map']} | {m['sampledFps']:.1f} | {m['width']}×{m['height']} | {m['seconds']:.2f}s |"for m in metrics)
text=f'''# Ferro e Furia 2.0 — Honor & Steel

- Importati tutti i10GLB. Quattro spade cosmetiche con statistiche identiche, due scudi, Longinus, arco e freccia separati. Daghe e martello dal pack Melee; ascia originale conservata.
- Tre mappe nel voto esistente: Colosseo, Hell e Geonosis. Geometria originale preservata; proxy geometrici di terreno/collisione/navigazione da0,4m.
- LT aggancia un bersaglio vivo e visibile entro14m; movimento laterale e camera fluida, R3 cambia bersaglio. Il rilascio di LT libera la camera.
- Guardia alto/sinistra/destra con RS o telefono, specchiata correttamente nello spazio del difensore. Direzione fissata all’avvio del colpo; impugnature e sweep condivisi durante le sole finestre attive.
- Parry130ms su nuova pressione, finte dei soli pesanti in preparazione, presa ravvicinata con270ms per contrastare, schivata fisica e recupero stamina ritardato. Nessun danno gratuito dalla presa.
- 15 clip FBX reali campionate, adattate ai personaggi originali. Guardia, deviazione, finta, presa/contrasto e schivata sono layer originali, non clip dichiarate presenti nei pack. Elenco esatto in CREDITS.md e conversion.json.
- Arco LOAD→HOLD→RELEASE→RECOVERY; freccia fisica al decimo di secondo del rilascio. Mira verticale coerente con arco/freccia impugnata; perdita del tocco annulla senza sparare.
- Cinque partecipanti, visuali dei soli umani, tre manche e spareggi preservati. Bot con percezione ritardata, risorse comuni, direzioni e finte. Tenacia temporanea contro aggressori diversi: riduce lo stordimento senza invulnerabilità.
- Materiali equivalenti e geometria condivisi, texture importate inutilizzate rilasciate, effetti riutilizzati e primo rendering preparato sotto il caricamento. Con3–5 visuali Geonosis rende internamente a1600×900; HUD a1920×1080.

| Mappa | FPS misurati | Rendering interno | Campione |
|---|---:|---|---|
{table}

RTX3050, Chrome ANGLE/D3D11, cinque visuali attive, canvas1920×1080.90frame di preparazione prima di ciascun campione finale; FPS=frame/tempo effettivo. HP1000 soltanto nella fixture per mantenere cinque attori. Non è una prova di rete o un confronto garantito con i primi campioni di avvio, risultati variabili.

Passati typecheck, build finale, verifiche mirate nuove e precedenti della logica, visualizzazione degli asset, due umani con interfaccia controller.html e Xbox simulato, tre guardie sul telefono, danno/finta col pad, arco e annullamento su blur, cleanup e prove con cinque visuali. Nessun gamepad fisico dichiarato verificato. Nessun test degli altri minigiochi.

Limiti: collisioni approssimate dai proxy; prestazioni dipendenti dal dispositivo. Arco CC BY-NC-SA4.0; Scutum Standard e diritti su proprietà intellettuali da verificare prima di pubblicare. Crediti e modifiche conservati in ogni GLB e public/assets/ferro2/CREDITS.json. Nessun commit, push o deploy.
'''
(OUT/'README.md').write_text(text,encoding='utf8')
cards=''.join('<figure><img src="'+name+'" alt="'+escape(caption)+'"><figcaption>'+escape(caption)+'</figcaption></figure>' for name,caption in zip(summary['screenshots'],['Guardia direzionale e duello con i modelli importati','Hell Arena: geometria originale','Geonosis: cinque visuali attive']))
rows=''.join(f"<tr><td>{m['map'].title()}</td><td>{m['sampledFps']:.1f}</td><td>{m['width']}×{m['height']}</td></tr>"for m in metrics)
(OUT/'index.html').write_text('''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ferro e Furia 2.0</title><style>body{margin:0;background:#111b24;color:#dfe7e8;font:16px/1.65 system-ui}main{max-width:1280px;padding:28px;margin:auto}h1,h2,a{color:#e9ca8c}h1{font-size:clamp(30px,5vw,52px)}figure{margin:28px 0;border:1px solid #546169;border-radius:10px;overflow:hidden}img{display:block;width:100%}figcaption{padding:12px 18px;background:#22313b}table{border-collapse:collapse}td,th{padding:10px 24px 10px 0;text-align:left;border-bottom:1px solid #52616a}p{max-width:1080px}</style><main><h1>FERRO E FURIA2.0</h1><h2>HONOR & STEEL</h2><p>Tre arene e sette categorie: aggancio, tre direzioni di guardia, colpi fisici, parry a tempo, finte e prese contrastabili. Quattro spade cosmetiche, due scudi e animazioni FBX adattate ai personaggi originali. L’arco ha caricamento, tensione, rilascio sincronizzato e recupero.</p><p>Colosseo, Hell e Geonosis nel voto esistente. Tre manche, classifica e spareggi preservati. Bot con percezione ritardata, visuali riservate agli umani e tenacia limitata contro più aggressori.</p><table><tr><th>Cinque visuali</th><th>FPS effettivi</th><th>Rendering interno</th></tr>'''+rows+'''</table><p>RTX3050 · Chrome ANGLE/D3D11 · canvas1920×1080 ·90frame di preparazione e campioni finali di6secondi. Fixture con HP aumentati per mantenere cinque combattenti; nessuna garanzia su altri PC e nessun controller fisico dichiarato verificato.</p>'''+cards+'''<p>Typecheck, build, regole, sessione reale con telefono e pad simulato, verifica degli asset e prove con cinque visuali passati. Collisioni su proxy geometrici da0,4m; non tutte le decorazioni hanno collisione esatta.</p><p>Uso locale. Arco CC BY-NC-SA4.0; licenza Scutum Standard e diritti su proprietà intellettuali da verificare prima della pubblicazione. Nessun commit, push o deploy.</p><p><a href="verification.json">Verifiche complete</a> · <a href="/assets/ferro2/CREDITS.json">Fonti e licenze</a> · <a href="/">Apri il gioco</a></p></main></html>''',encoding='utf8')
# Preserve historical local galleries when Vite empties dist. These scripts restore artifacts, not tests.
subprocess.run([sys.executable,str(ROOT/'scripts/ferro-finalize.py')],cwd=ROOT,check=True)
dest=ROOT/'dist/ferro-2';dest.mkdir(parents=True,exist_ok=True)
for name in ['index.html','verification.json',*summary['screenshots']]:shutil.copy2(OUT/name,dest/name)
print('Ferro2 gallery restored; final evidence ready.')
