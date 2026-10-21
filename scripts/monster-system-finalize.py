"""Restore existing local galleries and publish only three Monster System screenshots."""
import json,shutil,subprocess,sys,html
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/monster-system'
read=lambda name:json.loads((out/name).read_text(encoding='utf8'))
assets=read('asset-checks.json');browser=read('browser.json');logic=read('logic-tests.json');production=read('production.json')
assert all(r['status']=='passed' for r in [assets,browser,logic,production])
assert 'built in' in (out/'build.log').read_text(encoding='utf8',errors='replace')
assert all(abs(r['clock']-r['expected'])<.005 for r in production['meleeSync'])
summary={'status':'passed','warrok':'Integrated in Orda from wave 6, at most two living Warroks; search/run/roar/clear-route hop/punch/hit feedback/death',
 'clips':['IDLE','BREATHING_IDLE','WALK','RUN','JUMP','ROAR','ATTACK','DEATH'],
 'runtime':'Cached GLBs, shared geometry/materials/textures/Animation objects, independent skeletons and clocks, blended manual sampling, pooled actors, 30Hz host/20Hz phone animation budget, conservative animation bounds',
 'retarget':{'hazmat':'66 joints; 65 mapped; Infetto/Colosso and masked Backrooms Imitator','partygoer':'69 joints; 22 main humanoid joints mapped; original twist branches and bone lengths retained; Orda Corridore and Backrooms Partygoer'},
 'specificAnimation':'Bacteria has no skeleton; Smiler has a non-humanoid 22-joint rig. Stalker, Backrooms Runner, revealed Imitator, Hound, Watcher and Howler are procedural meshes, not compatible skinned humanoid rigs. Their existing specific animations remain.',
 'attack':'Warrok source fist trace peaks at 0.30s; authoritative damage only at 0.27–0.37s, front cone/distance/height/LOS/living target/single-hit checks; full 1.1s clip then 0.7s cooldown. Existing humanoid attack preparation stretched visually to their original damage timing.',
 'death':'Once, offensive AI disabled immediately, corpse retained for 4.6s clip plus 0.2s; dead actors do not block next wave. Match-end scene transition can end a corpse visual earlier.',
 'performance':{'fps':round(browser['fps'],1),'gpu':browser['gpu'],**browser['conditions'],'warroks':2},
 'tests':{'assetChecks':assets['status'],'logic':logic['checks'],'renderer':'Eight clips on three rigs, ten independent Warrok skeletons, one shared geometry; compiled two-Warrok scene confirms shared Animation references; actual punch preparation/damage, advancing death pose; existing humanoid attack sync; compiled Partygoer capture and scare clip',
 'backrooms':'First capture/recovery/second elimination checked; no HP introduced. Partygoer tested in actual lobby and compiled garage; Imitator hook implemented but not exercised in a natural reveal sequence.','typecheck':'passed, including final npm run build','build':'passed','javascriptErrors':production['errors']},
 'limits':['Unknown source licenses: confirm model, animations and textures before publication. User-provided source FBX unchanged.','No long natural-wave or physical-controller endurance run; only requested short checks.','Brief FPS development sample, 6–13 living enemies including two Warroks; not a guarantee at the 22-enemy cap. Final audio/cadence/culling tweaks were not re-benchmarked, as requested.'],
 'screenshots':['trial.png','orda-five.png','backrooms.png'],'git':'No staging, commit, push or deployment.','execution':'Direct Sol; no routed inference or worker provider used.'}
(out/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
text=f'''# Monster System 1.0

Warrok è integrato in Orda Finale dalla sesta ondata, massimo due vivi contemporaneamente. GLB unico: 12.626 triangoli, 81 ossa, tre texture incorporate e otto clip: Idle, Breathing Idle, Walking, Run, Jumping, Roaring, Punch e Dying.

Rig FBX: gerarchia, matrici di riposo e trasformazioni identiche negli undici file ispezionati; hash degli originali invariati. Gli 81 elementi importati sono ossa effettive, distinti dal nodo Armature. Jump Attack e Swiping sono stati verificati ma non aggiunti alle otto clip richieste.

Il sistema condiviso usa cache GLB, dati delle clip/geometria/materiali condivisi e rig/clock indipendenti. Blending fra pose, cadenza adattata a velocità e proporzioni, root motion orizzontale rimosso, salto governato dalle collisioni. Passi ricavati dai contatti delle clip; ruggito, swing, impatto valido e morte usano sintesi audio originale nel mixer esistente. Pool limitato, aggiornamento animazioni 30Hz host/20Hz telefono, bounds conservativi per evitare sparizioni ai bordi della camera.

Pugno Warrok: preparazione, impatto 0,27–0,37s (picco della mano verificato nel renderer a 0,30s), recupero fino a 1,1s e cooldown 0,7s. Verificati distanza, altezza, orientamento, bersaglio vivo, ostacoli e un solo danno. Gli altri umanoidi mantengono i propri tempi di combattimento: cambia soltanto la sincronizzazione della posa. Dying una volta sola, AI/danni fermati subito, corpo conservato per 4,8s salvo cambio scena a fine partita.

| Modello / ruolo | Animazione |
|---|---|
| Warrok | Otto clip native sul rig identico |
| Infetto / Colosso | Hazmat, retarget offline: 65 ossa mappate su 66 joint |
| Corridore di Orda / Partygoer di Backrooms | Partygoer, 22 joint principali mappati su 69; proporzioni, bind e rami twist originali preservati |
| Imitatore mascherato | Hazmat retarget; hook implementato, sequenza naturale di rivelazione non provata |
| Bacteria / Cacciatore / Macellaio | Parti rigide senza scheletro: animazione specifica conservata |
| Smiler / Assalitore | Anatomia non umanoide a 22 joint: procedurale specifica conservata |
| Stalker, Corridore Backrooms, Imitatore rivelato, Hound, Watcher, Howler | Creature procedurali prive di rig skinnato compatibile: mantenuta animazione dedicata |

Test: asset e root motion; sei controlli logici mirati; otto clip su tre rig; dieci Warrok con scheletri/clock indipendenti e geometria condivisa; prova compilata con cinque visuali e due Warrok, modelli arma reali, preparazione/impatto/morte e sincronizzazione umanoidi. Backrooms: Partygoer, cattura/recupero/prima e seconda vita, nessun HP aggiunto; nella versione compilata anche animazione della cattura. Typecheck e build riusciti, nessun errore JavaScript rilevato.

Prestazioni: **{browser['fps']:.1f} FPS medi** nel singolo campione di sviluppo di 6 secondi, RTX 3050, cinque visuali, risoluzione interna 1669×939 (schermo 1920×1080, scala 1,15), 6–13 nemici vivi fra cui due Warrok. Solo l'harness ripristina gli HP per mantenere cinque camere; AI e rendering reali. Campione precedente agli ultimi ritocchi a eventi/cadenza/bounds, non ripetuto come richiesto. Nessuna promessa per ondate al limite di 22 nemici o confronto diretto con misure precedenti.

Limiti: licenze dei nuovi FBX da verificare prima di pubblicare; non sono stati forniti documenti di licenza. Non eseguite prove prolungate o con pad fisici. Nessun altro problema bloccante osservato nei controlli mirati. Nessun commit, push o deploy. Esecuzione diretta con Sol.

Configurazione: `src/monsters/MonsterAnimator.ts`; bilanciamento locale: `shared/orda/warrok.ts`; pipeline offline: `tools/monsters/`. Provenienza: `public/assets/monsters/CREDITS.md`.
'''
(out/'README.md').write_text(text,encoding='utf8')
figures=''.join(f'<figure><img src="{name}" alt="{html.escape(caption)}"><figcaption>{html.escape(caption)}</figcaption></figure>'for name,caption in zip(summary['screenshots'],['Otto clip su Warrok, Hazmat e Partygoer — posa campionata, non una prova del movimento da sola','Warrok nella versione compilata di Orda — cinque visuali e modelli arma reali','Partygoer nella versione compilata di Backrooms — regole originali preservate']))
page=f'''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Monster System 1.0</title><style>body{{margin:0;background:#11191d;color:#e8e4d9;font:16px/1.6 system-ui}}main{{max-width:1300px;margin:auto;padding:40px 24px}}h1{{font-size:42px;margin:0;color:#d4b27a}}p{{max-width:1000px}}figure{{margin:36px 0;background:#1c282c;border:1px solid #465254}}img{{display:block;width:100%}}figcaption{{padding:14px 20px}}a{{color:#d4b27a}}.tag{{color:#9ed7be}}</style><main><span class="tag">ORDA FINALE + BACKROOMS · BUILD E VERIFICA COMPILATA SUPERATE</span><h1>Warrok è arrivato.</h1><p>Un modello, otto animazioni, istanze indipendenti. Ruggito, salto breve, pugno con impatto verificato e morte completa. Dalla sesta ondata, massimo due Warrok vivi.</p><p>Retarget offline su Hazmat e Partygoer; creature non umanoidi conservate. Campione di sviluppo: <b>{browser['fps']:.1f} FPS</b>, cinque visuali, RTX 3050, 1669×939, 6–13 nemici inclusi due Warrok. Ultimi ritocchi non rimisurati. <a href="verification.json">Verifiche e limiti</a> · <a href="/">Apri Party Game</a></p>{figures}<p>Nessun commit, push o deploy. Provenienza conservata; licenze dei FBX da verificare prima di pubblicare.</p></main></html>'''
(out/'index.html').write_text(page,encoding='utf8')
subprocess.run([sys.executable,str(root/'scripts/orda-finalize.py')],cwd=root,check=True)
dest=root/'dist/monster-system';dest.mkdir(parents=True,exist_ok=True)
for name in ['index.html','verification.json',*summary['screenshots']]:shutil.copy2(out/name,dest/name)
print('Monster System: restored existing galleries; published three local screenshots and compact verification.')
