"""Publish the accepted voice refresh without committing or deploying."""
from pathlib import Path
import json, shutil, subprocess, sys
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/narrator-voice'
browser=json.loads((out/'browser.json').read_text(encoding='utf8'));prod=json.loads((out/'production.json').read_text(encoding='utf8'));assets=json.loads((out/'asset-tests.json').read_text(encoding='utf8'));durations=json.loads((out/'durations.json').read_text(encoding='utf8'))
assert browser['status']=='passed' and prod['status']=='passed'
assert 'built in' in (out/'build.log').read_text(encoding='utf8',errors='replace')
summary={'status':'passed','clips':assets['clips'],'bytes':assets['bytes'],'peakDb':assets['maxPeakDb'],'durationChecks':durations,'browser':browser,'production':prod,'typecheck':'passed','build':'passed','synthesis':'Offline Kokoro im_nicola, natural-sarcasm-v2; no pitch transposition or time stretch on encoded speech','limits':'Synthetic Italian voice; automatic transcription and technical playback checks do not certify human acting or listener preference.','commitPushDeploy':'none'}
(out/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
(out/'README.md').write_text('''# Narratore: voce più naturale e tagliente

Rigenerate le 132 clip attive: 25 rullo, 25 risultati, 50 personali e 32 annunci per i 16 minigiochi. Tolti abbassamento artificiale del pitch e accelerazione successiva; velocità di sintesi 0,99–1,04, pause diverse fra commenti e annunci, titoli pronunciati senza maiuscole integrali. Presenza moderata sulle consonanti e normalizzazione a −17 LUFS. Riscritti i 25 rulli, i 25 risultati e due frecciate personali per ciascuno dei cinque personaggi.

Nessun cambiamento a selettore, condizioni dei risultati, anti-ripetizione, mixer, comandi, sincronizzazione dei sottotitoli, finestre temporali o cache. Tutta la sintesi avviene offline durante la preparazione; la partita riproduce OGG mono a 24 kHz come prima.

Verifiche: 132 file decodificati con FFmpeg e manifest coerenti, picco massimo −1,2 dBFS, tutte le durate entro le finestre esistenti (rullo 3,573 s, annunci 3,8 s, risultati 4 s al massimo). 372 controlli di catalogo e selezione; quattro clip riprodotte fino a fine dal player reale con sottotitoli e rilascio del budget voce. Trascrizione automatica locale dei tre campioni coerente col testo. Typecheck, build e rullo reale nella partita compilata superati.

Resta una voce sintetica italiana: il risultato artistico, l'accento e il sarcasmo non equivalgono a un doppiatore umano. Gli esempi consentono di giudicare direttamente il timbro. Il modello e la banca voci sono strumenti locali esterni al repository; nessun servizio TTS cloud e nessuna inferenza durante il gioco.
''',encoding='utf8')
(out/'index.html').write_text('''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Narratore · voce aggiornata</title><style>body{max-width:850px;margin:40px auto;padding:20px;background:#111827;color:#f8fafc;font:18px system-ui}section{padding:20px;margin:18px 0;background:#1e293b;border-radius:14px}audio{width:100%}h1,a{color:#fbbf24}p{line-height:1.55}</style><h1>Il Narratore Bastardo</h1><p>Voce sintetica italiana: timbro meno alterato, pause e frecciate più secche. 132 clip aggiornate, riprodotte localmente durante il gioco.</p><section><h2>Sarcasmo</h2><p>Boschi ultimo. Fai più paura al portone che agli avversari.</p><audio controls src="demo-sarcasm.ogg"></audio></section><section><h2>Rullo</h2><p>La ruota gira. Il cervello vostro, un po' meno.</p><audio controls src="demo-roller.ogg"></audio></section><section><h2>Vittoria</h2><p>Goblin primo. Hai creato il gioco: il dubbio rimane.</p><audio controls src="demo-victory.ogg"></audio></section><p><a href="verification.json">Verifiche</a> · <a href="README.md">Note e limiti</a></p></html>''',encoding='utf8')
subprocess.run([sys.executable,str(root/'scripts/minigolf-surfaces-finalize.py')],cwd=root,check=True)
dst=root/'dist/narrator-voice';dst.mkdir(exist_ok=True)
for name in ['index.html','README.md','verification.json','asset-tests.json','logic-tests.json','durations.json','transcription.json','browser.json','production.json','build.log','esempio.wav']:
 shutil.copy2(out/name,dst/name)
for name in ['demo-sarcasm.ogg','demo-roller.ogg','demo-victory.ogg']:
 shutil.copy2(root/'public/audio/narrator'/name,dst/name)
print('Voice refresh evidence and previous galleries restored.')
