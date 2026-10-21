from pathlib import Path
from html import escape
import json, shutil, subprocess, sys

root=Path(__file__).resolve().parents[1]
out=root/'docs/agent-work/ferro-furia'
read=lambda name:json.loads((out/name).read_text(encoding='utf-8'))
logic=read('logic.json'); visual=read('visual.json'); integration=read('integration.json'); loading=read('loading.json'); weapons=read('weapon-loading.json'); stamina=read('stamina.json')
assert all(v.get('status')=='passed' for v in [logic,visual,integration,loading,weapons,stamina])
summary={
 'status':'passed','feature':'FERRO E FURIA — L’ULTIMO GUERRIERO',
 'mode':'2–5 participants, three rounds, seven selectable weapons, survival-first scoring, actual tiebreak duels',
 'controls':'TV mouse, per-player gamepad profile, phone weapon selection and touch combat',
 'animation':'Original procedural registered-character rigs with articulated two-link arms; shared grip/blade pose sampler, no authored medieval clips',
 'assets':'Original procedural Colosseum, weapons, previews, textures, pooled FX and synthesized Web Audio. Existing registered character identities.',
 'tests':['Deterministic physical melee/parry/guard/dodge/bow/specials/walls/three-round and tiebreak checks','Actual two-human Socket.IO session, one simulated Xbox pad and one controller.html client','Phone independent selection, charge/release hit, blur cancellation without shooting, scene and phone cleanup','Five-camera renderer, all seven weapon models, six-second RTX3050 sample','Delayed GLB downloads keep minigolf covered, controls gated and match time zero; reveal only after final actors and shaders are ready','Sparatoria final weapon asset loading and scene readiness','Backrooms shorter sprint, exhaustion latch and recovery','Typecheck and final Vite build'],
 'benchmark':{'gpu':visual['hardware']['gpu'],'views':5,'width':1920,'height':1080,'seconds':visual['sample']['seconds'],'fps':visual['sample']['fps'],'renderMs':visual['sample']['renderMs'],'scope':'Local renderer + real combat simulation fixture. All five participants retained at fixture-only 1000HP. One six-second measurement; not a network or physical-pad benchmark.'},
 'loading':'Shared opaque progress screen, instance-attachment promises, texture/shader preparation and covered warm render; gameplay gated. Weapon source caches warmed before combat and temporary block guns never displayed. No fixed fake five-second delay.',
 'backrooms':{'previousSprintSeconds':7,'sprintSeconds':4,'fullRecoverySeconds':5,'restartThreshold':.3},
 'limits':['No physical gamepad test; pad mapping verified through navigator.getGamepads simulation.','Combat animation is procedural, not motion capture.','Loading verified on representative real minigolf and Sparatoria scenes; all other games were not individually replayed.','FPS depend on hardware and gameplay; no new general FPS improvement claim.'],
 'git':'No commit, push or deploy',
 'images':['selection.png','arena.png','sword-spear.png','bow.png']}
(out/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
fps=visual['sample']['fps']
(out/'README.md').write_text(f'''# Ferro e Furia e caricamento definitivo

Implementato FERRO E FURIA nel catalogo e nel rullo:2–5 partecipanti, tre round, selezione indipendente prima di ogni round e spareggi reali. Una visuale per ciascun umano; i bot rimangono nel mondo e non creano finestre.

| Arma | Combattimento | Special |
|---|---|---|
| Spada | Leggero, pesante, combo di tre pose | Contrattacco dopo parry |
| Lancia | Affondi stretti con punta attiva e distanza utile | Carica bloccata dalle coperture |
| Arco | Tensione e rilascio, frecce fisiche con gravità, dieci frecce recuperabili nel tempo | Perfora fino a tre bersagli, mai i muri |
| Ascia | Fendenti ampi e recupero visibile | Rotazione, un impatto per avversario |
| Martello | Colpi lenti e pesanti | Onda a terra con linea di vista |
| Doppie lame | Due finestre distinte, portata corta | Scatto e due fendenti |
| Spada e scudo | Difesa frontale con stamina, vulnerabile alle spalle | Colpo di scudo con interruzione breve |

Hitbox percorse nelle sole finestre attive, parry130ms, schivata direzionale con breve invulnerabilità e recupero. Arena originale con tribune, colonne, cancelli, coperture e sei griglie di fuoco preannunciate. Dopo90s il cerchio si restringe senza assegnare arbitrariamente il vincitore. La sopravvivenza vale più delle eliminazioni; anche le doppie eliminazioni finali e le parità di punteggio si risolvono in duello.

Camera terza persona con inseguimento fluido, collisione sui muri/colonne e mira sulla spalla per l’arco. La targhetta del proprio personaggio è nascosta nella propria camera; quando un ostacolo costringe la camera a stringere, il proprio corpo sfuma per lasciare leggibile il bersaglio. Bot con percezione ritardata, memoria limitata, navigazione, gestione della distanza e delle stesse risorse dei giocatori. Effetti riutilizzati, geometria statica raggruppata, materiali condivisi e audio originale limitato nel numero di voci.

Identità e accessori dei cinque personaggi registrati preservati, senza bonus statistici nascosti. Animazioni procedurali mirate con braccia articolate e impugnature dedicate: non sono clip professionali o motion capture.

## Caricamento e Backrooms, richiesti successivamente

Barra di attesa sopra canvas e HUD fino al completamento degli asset definitivi, dell’aggancio dei personaggi e della preparazione di texture/shader. Controlli, fisica e countdown vengono trattenuti durante la preparazione. Tutte le piste di Ribaltati attendono anche i piloti; Sparatoria e Orda precaricano le sorgenti delle armi, senza mostrare le armi provvisorie al cambio. Inizializzata anche una texture popup vuota che altrimenti impediva alla scena di diventare pronta. Se una risorsa richiesta fallisce rimane disponibile il recupero del caricamento, senza promuovere silenziosamente il modello di ripiego.

Nelle Backrooms lo sprint continuo passa da circa7 a4secondi; recupero completo5secondi e ripartenza dopo almeno30% di barra per evitare il passo intermittente a resistenza esaurita. Nessuna modifica ai mostri.

## Verifiche

Passati test mirati della logica, transizioni dei tre round e spareggi; sessione reale con due umani attraverso Socket.IO, selezione con pad simulato e telefono, freccia fisica con danno, annullamento su blur senza sparare e cleanup; cinque visuali e sette modelli; minigolf con download GLB deliberatamente trattenuti; disponibilità delle armi finali in Sparatoria; resistenza Backrooms; typecheck e build.

**{fps:.1f}FPS**, cinque visuali,1920×1080,RTX3050, singolo campione di circa6secondi. È una misura della fixture con renderer e simulazione reali e HP aumentati solo per mantenere cinque combattenti durante la misura; non è un benchmark multiplayer di rete né una garanzia su altri PC.

Limiti: nessun controller fisico provato; animazioni procedurali. Il caricamento è stato provato su scene rappresentative, senza ripetere tutti gli altri minigiochi. Nessun commit, push o deploy.
''',encoding='utf-8')
captions=['Scelta indipendente delle sette armi','Il Colosseo del Ferro','Spada contro lancia: impugnature e finestre di attacco','Arco: tensione, mira e traiettoria']
figures=''.join(f'<figure><img src="{name}" alt="{escape(cap)}"><figcaption>{escape(cap)}</figcaption></figure>' for name,cap in zip(summary['images'],captions))
(out/'index.html').write_text('''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Party Game · Ferro e Furia</title><style>body{margin:0;background:#111923;color:#dce4e7;font:17px/1.65 system-ui}main{max-width:1320px;margin:auto;padding:28px}h1,h2,a,strong{color:#e4c084}h1{font-size:clamp(28px,5vw,52px)}figure{margin:30px 0;background:#1c2935;border:1px solid #46535d;border-radius:10px;overflow:hidden}img{display:block;width:100%}figcaption{padding:14px 20px}.badge{display:inline-block;padding:8px 15px;background:#243b39;color:#bce0ba;border-radius:5px}p{max-width:1060px}</style><main><h1>FERRO E FURIA</h1><p class="badge">L’ULTIMO GUERRIERO · SETTE ARMI · TRE ROUND</p><p>2–5 partecipanti nel Colosseo del Ferro. Spada, lancia, arco, ascia, martello, doppie lame e spada con scudo: ogni arma ha tempi, portata, difesa e special differenti. Parate al momento giusto, schivate direzionali e frecce fisiche. Sopravvivenza e spareggi reali, senza vincitori casuali.</p><p>Scelta individuale con pad o telefono. Camera in terza persona e mira sulla spalla per l’arco. Soltanto gli umani hanno una visuale, mentre i bot partecipano con gli stessi attributi. Modelli, arena, effetti e audio originali; animazioni procedurali articolate, senza clip medievali professionali.</p>'''+f'<p><strong>{fps:.1f}FPS con cinque visuali</strong> · RTX3050 ·1920×1080 · campione locale di6secondi. Fixture con renderer e simulazione reali; non è una garanzia su altri PC.</p>'+figures+'''<h2>Caricamento definitivo e Backrooms</h2><p>Barra di attesa finché modelli, texture e shader sono pronti. Il countdown rimane fermo e le armi provvisorie non vengono mostrate. Verificato anche con download GLB rallentati. Nelle Backrooms sprint ridotto da circa7 a4secondi, con recupero e soglia di ripartenza.</p><p>Test mirati, sessione con due umani, pad simulato e telefono, cinque visuali, caricamento rallentato, typecheck e build. Nessun controller fisico provato. Nessun commit, push o deploy.</p><p><a href="verification.json">Verifiche</a> · <a href="/">Apri il gioco</a></p></main></html>''',encoding='utf-8')
# Restore existing local preview galleries after Vite emptied dist.
subprocess.run([sys.executable,str(root/'scripts/shared-weapons-finalize.py')],cwd=root,check=True)
dest=root/'dist/ferro-furia';dest.mkdir(parents=True,exist_ok=True)
for name in ['index.html','verification.json',*summary['images']]:shutil.copy2(out/name,dest/name)
print('Ferro e Furia: local gallery and verified evidence ready.')
