"""Verify final local build and restore galleries; no upload or Git operation."""
from pathlib import Path
import hashlib, json, shutil, subprocess, sys

root = Path(__file__).resolve().parents[1]
out = root / 'docs/agent-work/orda-box-polish'
read = lambda name: json.loads((out / name).read_text(encoding='utf8'))
logic, browser, asset, sound = [read(name) for name in ['logic.json', 'browser.json', 'asset.json', 'audio.json']]
assert logic['status'] == browser['status'] == 'passed' and not browser['errors']
assert 'built in' in (out / 'build.log').read_text(encoding='utf8', errors='replace')
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(Path.home() / 'Downloads/call_of_duty_black_ops_mystery_box.glb') == asset['sourceSha256']
assert sha(root / 'public/assets/orda/mystery-box.glb') == sha(root / 'dist/assets/orda/mystery-box.glb') == asset['sha256']
assert asset['removed'] == [{'material': 'blinn12SG', 'vertices': 24}] and asset['meshes'] == 8
for cue in sound:
    assert .01 < cue['rms'] < .15 and 0 < cue['peak'] < .8
    name = cue['name'] + '.wav'
    assert sha(root / 'public/assets/orda/audio' / name) == sha(root / 'dist/assets/orda/audio' / name)
summary = {
    'status': 'passed',
    'visual': 'Original body and lid, articulated rear hinge: .6s opening, 105 degrees, .65s closing; three shared roulette models and final owned reward. No new dynamic lights.',
    'removed': asset['removed'],
    'assetBytes': asset['bytes'],
    'sourceUnchanged': True,
    'controls': 'Xbox X / PlayStation Square near box buys or retrieves; away reloads. Same standard left-face binding, no RB. Phone CASSA retained.',
    'sound': {'origin': 'Original procedural music-box arpeggio, mechanism clicks, reward chime and wood impact. No copied CoD recording.',
              'cues': sound, 'mixer': 'Existing SFX bus, one voice shared across local views, distance attenuation, pause/resume and disposal.',
              'closingImpactSeconds': .65},
    'tests': {'logic': logic['checks'], 'browser': browser['checks'],
              'audioOutputPeak': browser['audio']['peak'], 'pauseStopsSource': browser['audio']['stopped'],
              'cleanup': browser['cleanup'], 'typecheck': 'passed', 'build': 'passed', 'visual': 'Three actual renderer screenshots inspected.'},
    'limits': 'Gamepad input verified with Xbox/DualSense browser mocks through the real mapping; no physical controller session or new FPS benchmark.',
    'screenshots': ['closed.png', 'opening.png', 'reward.png'],
}
(out / 'verification.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf8')
(out / 'README.md').write_text('''# Orda — cassa animata

Coperchio originale separato e animato sulla cerniera: apertura 0,6 s a 105°, chiusura 0,65 s; roulette con tre modelli condivisi e premio finale. Rimosso soltanto il foglio interno blinn12SG (24 vertici). Modello da 8,06 MB, originale Downloads intatto.

Interazione: Quadrato su PlayStation / X su Xbox compra o ritira vicino alla cassa. Lontano, lo stesso tasto ricarica; nessuna doppia azione. RB rimosso dalla cassa. Telefono CASSA preservato. Restano +50 punti per uccisione, prezzo 950, tre colpi per morire e le regole precedenti.

Audio originale sintetizzato: carillon inquietante di 2,5 s, scatti del meccanismo, premio, chiusura con impatto sincronizzato al contatto del coperchio a 0,65 s. Stile Mystery Box, senza registrazioni di CoD. Mixer SFX esistente, attenuazione per distanza, una voce per scena, arresto in pausa e cleanup.

Passati typecheck, build finale, test di interazione contestuale, pad Xbox e DualSense simulati attraverso il mapping reale, cinque visuali, cerniera durante apertura/chiusura, assenza del cartello, premio esclusivo, output audio non nullo, pausa e rilascio della sorgente. Tre screenshot controllati nel renderer reale. Nessun nuovo benchmark FPS, commit, push o deploy.
''', encoding='utf8')
figures = ''.join(f'<figure><img src="{name}.png" alt="{label}"><figcaption>{label}</figcaption></figure>' for name, label in [('closed', 'Cassa chiusa · modello originale'), ('opening', 'Apertura sulla cerniera · cartello rimosso'), ('reward', 'Premio pronto · Quadrato / X per ritirare')])
sounds = ''.join(f'<div><b>{label}</b><audio controls preload="none" src="/assets/orda/audio/{name}.wav"></audio></div>' for name, label in [('roll', 'Estrazione · carillon e meccanismo'), ('ready', 'Arma pronta'), ('close', 'Chiusura · impatto a 0,65 s')])
page = '''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Orda · Cassa animata</title><style>body{margin:0;background:#101b1b;color:#ece9dc;font:17px/1.6 system-ui}main{max-width:1250px;margin:auto;padding:28px}h1,a,strong{color:#e5bb72}figure{margin:25px 0;border:1px solid #51615a}img{display:block;width:100%}figcaption{padding:12px}p{max-width:1000px}.sounds{display:flex;gap:25px;flex-wrap:wrap}.sounds div{display:grid;gap:10px}audio{max-width:100%}</style><main><h1>La Mystery Box prende vita</h1><p>Apertura e chiusura sulla cerniera, roulette delle armi e luce interna. Il foglio è stato rimosso. Premi <strong>Quadrato / X</strong> vicino alla cassa per acquistare o ritirare; lontano, lo stesso tasto ricarica.</p><p><strong>50 punti per uccisione · cassa a 950 · tre colpi per morire.</strong> Regole e armi preservate. Test mirati, cinque visuali, typecheck e build superati.</p><p>Suoni originali ispirati allo stile Mystery Box: carillon, meccanismo, premio e chiusura sincronizzata.</p><div class="sounds">''' + sounds + '</div>' + figures + '<p><a href="verification.json">Verifiche</a> · <a href="/">Party Game</a></p><p>Modello: Navillus360, CC BY 4.0. Nessun commit, push o deploy.</p></main></html>'
(out / 'index.html').write_text(page, encoding='utf8')
subprocess.run([sys.executable, str(root / 'scripts/fps-pack-finalize.py')], cwd=root, check=True)
# Preserve the previous Orda evidence as a historical snapshot too.
for folder, names in [('orda-zombies', ['index.html', 'verification.json', 'mystery-box.png']),
                      ('orda-box-polish', ['index.html', 'verification.json', *summary['screenshots']])]:
    dest = root / 'dist' / folder
    dest.mkdir(parents=True, exist_ok=True)
    for name in names:
        shutil.copy2(root / 'docs/agent-work' / folder / name, dest / name)
print('Animated Mystery Box: final asset/audio verified and local preview restored.')
