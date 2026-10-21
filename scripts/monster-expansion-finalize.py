"""Local evidence gallery only. No commit, deployment or external upload."""
from pathlib import Path
import json,shutil,subprocess,sys,html,hashlib
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/monster-expansion'
read=lambda name:json.loads((out/name).read_text(encoding='utf8'))
assets=read('asset-checks.json');logic=read('logic-tests.json');browser=read('browser.json');production=read('production.json')
assert all(r['status']=='passed'for r in [assets,logic,browser,production]);assert 'built in' in(out/'build.log').read_text(errors='replace',encoding='utf8')
frames=browser['benchmark'];assert len(frames)==12 and all(s['views']==5 for s in frames)
for asset in assets['assets']:
    name=asset['kind']+'.glb';assert hashlib.sha256((root/'dist/assets/monsters'/name).read_bytes()).hexdigest()==asset['sha256']
summary={'status':'passed','models':[{'kind':a['kind'],'clips':len(a['clips']),'names':a['clips'],'bones':a['bones'],'triangles':a['triangles'],'bytes':a['bytes']}for a in assets['assets']],
 'warrok':'Single logical/model definition, visual normalization +20.75% (2.65 → 3.2); local collision radius .82, height 3.2, base HP 900 and base damage 40; old geometry/materials/eight clips preserved exactly.',
 'roles':{'warrok':'Heavy assault miniboss, max two living, wave 6+; punch, heavy swipe, roar and short clear-route Jump Attack.','zombiegirl':'Fast flanker, wave 3+, max five living; own Swipe/Run/Death.','yaku':'Lateral hunter, wave 8+, max three living; brief visible-target sprint, warned bounded Jump Attack with recovery.','pumpkinhulk':'One boss on waves 10,20,…; heavy frontal Swipe, taunt, faster attack/movement below 40% HP. Macellaio retained at intervening boss waves.'},
 'attacks':'Per-creature rates/ranges/damage/cooldowns, source clip impact markers; visible preparation, front cone/height/LOS/live target, one hit per action, full animation recovery; swept clear-route leap and grounded landing, no homing through cover; death cancels offense immediately.',
 'backrooms':'Runner now uses Zombiegirl; Stalker uses Yaku, loaded only if these roles are selected. Existing creatures: +5% patrol speed, +7% chase capped at 6.8, +12% hearing, +2s search, reaction time ×0.88. Partygoer burst 2.3s and rest 4.3s. Original LOS/noise-memory, spawn grace, immunity, hiding, two lives, puzzles, captures and escape remain. Warrok and Pumpkinhulk are Orda-only because of door/corridor clearance.',
 'performance':{'fps':round(browser['fps'],1),'gpu':browser['gpu'],'seconds':6,'views':5,'window':[1920,1080],'internal':[frames[0]['width'],frames[0]['height']],'scale':frames[0]['scale'],'livingEnemies':[min(f['alive']for f in frames),max(f['alive']for f in frames)],'harness':'Actual wave-10 scheduler/AI/rendering, two human identities + three bots; replenished HP to 1000 solely to keep five cameras alive. Single development sample before the capture-turn priority fix; no repeated benchmark. Not a controlled comparison to earlier lower-population samples.'},
 'optimisation':'Offline FBX→GLB; 1024px embedded textures; one geometry/skin per creature with named unique clips; immutable geometry/material/texture/Animation data shared between clones; independent skeleton/clocks; unused replaced clip buffers pruned; existing bounded actor pool, conservative culling and 30Hz/20Hz visual update budgets; active enemy cap remains 22.',
 'tests':{'assets':assets['status'],'logic':logic['checks'],'development':browser['checks'],'production':production['checks'],'javascriptErrors':production['errors'],'typecheck':'passed, also included in final build','build':'passed'},
 'limits':['Original author/license grants were not provided with the four archives or standalone FBX; provenance/hashes retained, verify rights before publication.','No long endurance/balance session or physical controller session; targeted checks only.','An end-of-match scene transition can truncate remaining corpse animation.','No new Backrooms combat HP or arbitrary long-range captures were added.'],
 'screenshots':['01-trial.png','02-mixed-wave.png','03-jump-attack.png','04-backrooms.png'],'git':'No staging, commit, push or deploy.','execution':'Direct Sol; no delegated inference/provider call.'}
(out/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
text=f'''# Monster Expansion 1.2

Quattro modelli integrati. Warrok ingrandito del **20,75%**, riferimento visivo 2,65 → 3,2 e hitbox/collisioni locali adeguate; 900 HP e 40 danni base. Gli altri nemici comuni di Orda hanno statistiche più forti senza cambiare il registro delle sei armi o Sparatoria.

| Creatura | Clip | Ruolo e introduzione |
|---|---:|---|
| Warrok | 13 | Bruto, dalla sesta ondata, massimo due vivi; Punch, Swipe pesante, Roar, Jump Attack |
| Zombiegirl | 10 | Cacciatrice rapida sui fianchi, dalla terza, massimo cinque vive; Swipe |
| Yaku | 11 | Predatore laterale, dall'ottava, massimo tre; scatto breve e Jump Attack |
| Pumpkinhulk | 10 | Boss alle ondate 10/20/30…, uno; Swipe frontale, intimidazione e fase sotto 40% HP |

Tutti: Idle, Breathing Idle, Walk, Run, Jump, Turn Left, Turn Right, Swipe, Taunt/Flex, Death. Warrok conserva anche Punch e Roar; Warrok e Yaku hanno Jump Attack. Le otto clip precedenti e geometria/skin/materiali di Warrok sono preservati esattamente; nessun secondo Warrok. I quattro archivi hanno rig e pose di riposo differenti: conversione offline e adattamento delle rotazioni sulla posa di riposo del singolo modello, conservando le lunghezze delle ossa. Le varianti di svolta ridondanti non vengono caricate.

Gli attacchi usano tempi, danni, portate, velocità e recupero differenti. Swipe ha impatto nel punto ricavato dalla clip; Jump Attack segue i contatti del file sorgente (decollo circa 0,5s, atterraggio 1,6s, impatto 1,7s, adattati al rate di ciascun mostro). Preparazione segnalata, destinazione bloccata, percorso controllato a piccoli passi; niente salto attraverso muri o coperture e niente inseguimento magnetico in aria. Un solo danno per azione, con controllo di distanza, altezza, orientamento, ostacoli e bersaglio vivo. Morte prioritaria, offesa interrotta e corpo conservato per la clip.

**Backrooms:** Zombiegirl dà il modello al Corridore, Yaku allo Stalker. Asset extra caricati soltanto se il ruolo è presente. Pattuglia +5%, inseguimento +7% con limite 6,8, udito +12%, ricerca +2s e reazione più rapida del 12%; Partygoer mantiene il comportamento di inganno, con scatto 2,3s e riposo 4,3s. Restano invariati visibilità/ostacoli, memoria sensoriale, protezione iniziale, immunità, nascondigli, due vite, puzzle, catture e fuga. Warrok e Pumpkinhulk rimangono esclusivi di Orda per non forzarli attraverso porte e corridoi.

**Prestazioni:** {browser['fps']:.1f} FPS medi nel singolo campione di sviluppo di 6s, RTX 3050, cinque visuali, interno {frames[0]['width']}×{frames[0]['height']} su 1920×1080 (scala {frames[0]['scale']}). {min(f['alive']for f in frames)}–{max(f['alive']for f in frames)} nemici vivi, ondata mista con boss. Solo l'harness rifornisce gli HP a 1000 per mantenere cinque camere; non è una modifica del gioco. Campione precedente alla correzione della priorità cattura/svolta, non ripetuto. Carico diverso dalle vecchie prove: nessun confronto diretto fra questi FPS e i precedenti.

**Test eseguiti:** archivi/hash invariati; dati precedenti di Warrok preservati; skin weights normalizzati e curve finite; sette gruppi logici mirati (quattro attacchi, danni singoli/ostacoli, Jump Attack, morte, ondate e boss, sei armi e vittoria, Backrooms); quattro modelli con Idle/Walk/Run/Swipe/Death osservati a tre fasi; rig e tempi indipendenti con geometria condivisa; ondata reale mista e boss; salto e atterraggio nel renderer; Backrooms con i due nuovi modelli e cattura Swipe. Typecheck e build finali; prova della versione compilata senza errori JavaScript. Ripetuta soltanto la verifica pertinente dopo il problema cattura/svolta.

**Ottimizzazioni:** un GLB per creatura, niente FBX runtime o mesh per clip, texture incorporate a 1024px, geometria/materiali/clip condivisi, rig indipendenti, buffer delle clip sostituite rimossi, pool e culling esistenti, cap 22 nemici e aggiornamento grafico 30Hz host/20Hz telefono. Nessuna dipendenza aggiunta.

Limiti: licenze non allegate, da verificare prima di pubblicare; nessuna sessione prolungata o con pad fisici. Un cambio scena a fine partita può interrompere un cadavere ancora in animazione. Nessun altro blocco osservato nei controlli mirati. Nessun commit, push o deploy.
'''
(out/'README.md').write_text(text,encoding='utf8')
captions=['Quattro creature e cinque pose campionate per ciascuna: Idle, Walk, Run, Swipe, Death','Ondata mista con Warrok più grande e Pumpkinhulk — cinque visuali; HP riforniti esclusivamente dal test','Yaku: salto d’attacco nel renderer, con atterraggio segnalato; fixture di controllo del combattimento','Backrooms: Zombiegirl/Corridore e Yaku/Stalker, regole originali di cattura']
figures=''.join(f'<figure><img src="{name}" alt="{html.escape(caption)}"><figcaption>{html.escape(caption)}</figcaption></figure>'for name,caption in zip(summary['screenshots'],captions))
page=f'''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Monster Expansion 1.2</title><style>body{{margin:0;background:#11191d;color:#e8e4d9;font:16px/1.6 system-ui}}main{{max-width:1300px;margin:auto;padding:40px 24px}}h1{{font-size:44px;margin:0;color:#e0b37e}}p{{max-width:1000px}}figure{{margin:32px 0;background:#1c282c;border:1px solid #465254}}img{{display:block;width:100%}}figcaption{{padding:14px 20px}}a{{color:#e0b37e}}.tag{{color:#9ed7be}}</style><main><span class="tag">ORDA FINALE + BACKROOMS · MONSTER EXPANSION 1.2</span><h1>Più grandi. Più pericolosi.</h1><p>Warrok +20,75%, Zombiegirl rapida, Yaku predatore e Pumpkinhulk boss. Quattro modelli, 13/10/11/10 clip, attacchi distinti e animazioni indipendenti. In Backrooms: nuovi modelli per Corridore e Stalker, inseguimenti più incisivi e due vite preservate.</p><p><b>{browser['fps']:.1f} FPS</b> nel campione breve a cinque visuali, RTX 3050, interno 1669×939 e 20–22 nemici. Test con HP riforniti per mantenere attive le camere; ultimi ritocchi non rimisurati. <a href="verification.json">Verifiche e limiti</a> · <a href="/">Party Game</a></p>{figures}<p>Licenze dei file forniti da verificare prima di una pubblicazione. Nessun commit, push o deploy.</p></main></html>'''
(out/'index.html').write_text(page,encoding='utf8')
subprocess.run([sys.executable,str(root/'scripts/monster-system-finalize.py')],cwd=root,check=True)
dest=root/'dist/monster-expansion';dest.mkdir(parents=True,exist_ok=True)
for name in ['index.html','verification.json',*summary['screenshots']]:shutil.copy2(out/name,dest/name)
shutil.copy2(root/'public/assets/monsters/CREDITS.md',root/'dist/assets/monsters/CREDITS.md')
print('Monster Expansion 1.2: restored previous local galleries, four screenshots and verification published locally.')
