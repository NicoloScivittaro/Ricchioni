"""Publish verified evidence to the local dist gallery only."""
from pathlib import Path
import hashlib, json, shutil, subprocess, sys

root = Path(__file__).resolve().parents[1]
out = root / 'docs/agent-work/orda-zombies'
read = lambda name: json.loads((out / name).read_text(encoding='utf8'))
logic, browser, asset = [read(name) for name in ['logic.json', 'browser.json', 'asset.json']]
assert logic['status'] == browser['status'] == 'passed'
assert not browser['errors']
assert 'built in' in (out / 'build.log').read_text(encoding='utf8', errors='replace')
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
source = Path.home() / 'Downloads/call_of_duty_black_ops_mystery_box.glb'
model = root / 'public/assets/orda/mystery-box.glb'
assert sha(source) == asset['sourceSha256']
assert sha(model) == sha(root / 'dist/assets/orda/mystery-box.glb')
summary = {
    'status': 'passed',
    'rules': {'killPoints': 50, 'boxCost': 950, 'startingPoints': 0,
              'hitsToDie': 3, 'contactGraceSeconds': .65,
              'rollSeconds': 2.5, 'claimSeconds': 10,
              'firstAid': 'Existing health supply restores one accepted hit; no passive regeneration.'},
    'box': {'sourceSha256': asset['sourceSha256'], 'sha256': sha(model),
            'bytes': asset['bytes'], 'originalBytes': asset['sourceBytes'],
            'variants': 'Both original closed/open variants; no authored animation clips.',
            'reward': 'Random existing weapon excluding current, full magazine plus four reserve magazines; owner-only pickup.',
            'expiry': 'Unclaimed reward expires without refund. Owner death releases the box.'},
    'controls': 'RB / R1 on pad; CASSA on phone. Explicit proximity interaction, same floor and line of sight.',
    'tests': {'logic': logic['checks'], 'browser': list(dict.fromkeys(browser['checks'])),
              'typecheck': 'passed', 'build': 'passed', 'visual': 'Original open box and floating reward inspected in actual Orda renderer.'},
    'scope': 'Existing waves, last-survivor win condition and other games preserved. No fresh performance benchmark requested or claimed.',
    'limits': ['Pad verification used mapped mock gamepad input; no physical gamepad session.'],
    'screenshots': ['mystery-box.png'],
}
(out / 'verification.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf8')
(out / 'README.md').write_text('''# Orda — Mystery Box

Modello fornito integrato con entrambe le varianti originali, chiusa e aperta. Derivato ottimizzato da 39,0 a 16,1 MB; originale Downloads invariato. Crediti Navillus360, CC BY 4.0, in public/assets/orda/CREDITS.md.

Ogni uccisione confermata assegna 50 punti personali. La cassa costa 950 punti (19 uccisioni da zero), estrae in 2,5 secondi e riserva il ritiro per 10 secondi al giocatore che ha pagato. Premi RB/R1 o CASSA sul telefono, prima per acquistare e poi per ritirare. Dieci armi esistenti nel pool, esclusa quella già equipaggiata. Nessun acquisto automatico al passaggio; saldo visibile nell’HUD. Anche i bot rispettano prezzo e interazione.

Terzo impatto valido: morte. Protezione di 0,65 secondi dopo un impatto per evitare conteggi ripetuti dello stesso contatto. Nessuna rigenerazione passiva; il pronto soccorso esistente restituisce un colpo di resistenza. La vecchia cassa gratuita è sostituita dalla Mystery Box. Ondate e vittoria dell’ultimo vivo restano invariate.

Verificati premio univoco, 949/950 punti, concorrenza, ritiro esclusivo, scadenza, morte del proprietario, cure, bot, cinque visuali, acquisto tramite input pad mappato e pulsante telefono attraverso socket. Verifica visiva nel renderer reale, typecheck e build finale superati. Nessun nuovo benchmark prestazionale; nessun commit, push o deploy.
''', encoding='utf8')
(out / 'index.html').write_text('''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Orda · Mystery Box</title><style>body{margin:0;background:#101b1b;color:#ece9dc;font:17px/1.6 system-ui}main{max-width:1250px;margin:auto;padding:28px}h1,a{color:#e5bb72}img{display:block;width:100%;border:1px solid #51615a}p{max-width:980px}strong{color:#e5bb72}</style><main><h1>Orda · Mystery Box</h1><p><strong>50 punti per uccisione · 950 punti per estrazione · tre colpi per morire.</strong> La cassa usa il modello fornito, nelle versioni originali chiusa e aperta. Il giocatore che paga ha dieci secondi per ritirare l’arma casuale.</p><p>Avvicinati e premi <strong>RB / R1</strong> sul pad o <strong>CASSA</strong> sul telefono. Lo stesso comando serve per ritirare l’arma. Saldo e colpi rimasti sono visibili nell’HUD.</p><img src="mystery-box.png" alt="Mystery Box aperta nel renderer Orda, arma sospesa e comando di ritiro"><p>Test logica, input pad e telefono, cinque visuali, verifica visiva, typecheck e build superati. <a href="verification.json">Dettagli verifiche</a> · <a href="/">Party Game</a></p><p>Modello: Navillus360, CC BY 4.0. Nessun commit, push o deploy.</p></main></html>''', encoding='utf8')
# Vite clears dist: restore the existing verified local galleries without rerunning their tests.
subprocess.run([sys.executable, str(root / 'scripts/fps-pack-finalize.py')], cwd=root, check=True)
dest = root / 'dist/orda-zombies'
dest.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'verification.json', *summary['screenshots']]:
    shutil.copy2(out / name, dest / name)
print('Orda Mystery Box: local gallery ready; source unchanged and built asset verified.')
