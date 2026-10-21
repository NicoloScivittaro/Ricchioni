"""Local evidence and four selected screenshots only; no upload, commit or deployment."""
from pathlib import Path
import json,sys,subprocess,shutil,hashlib,html
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/fps-weapon-pack'
read=lambda name:json.loads((out/name).read_text(encoding='utf8'))
clips=read('clips.json');games=read('games.json');logic=read('logic.json');audit=read('audit.json');asset_checks=read('assets.json')
assert all(v['status']=='passed'for v in [clips,games,logic,asset_checks]);assert 'built in' in(out/'build.log').read_text(encoding='utf8',errors='replace')
assets=[]
for name,row in audit.items():
 source=Path.home()/'Downloads'/row['file'];assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sha256']
 p=root/'public/assets/fps/animated'/(name+'.glb');dist=root/'dist/assets/fps/animated'/p.name;assert hashlib.sha256(p.read_bytes()).hexdigest()==hashlib.sha256(dist.read_bytes()).hexdigest();assets.append({'id':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'clips':len(row['clips'])})
assert len(clips['clips'])==28;frames=games['samples'];summary={'status':'passed','assets':assets,'clips':28,'oldWeapons':'Six existing IDs and stats preserved; four added to the same rotation/crates.','reload':'Host-owned insertion clocks; Glock and AK normal/empty variants; Remington Start → individual shell contacts → End. No interruption before close; existing Goblin perfect-reload ability still applies.','hands':'Original independent rigs (Glock has two skins), no retargeting between guns; shared material/texture/geometry caches and separate per-camera masks. Hand-free shotgun worldmodel; other new weapons reuse coherent old rifle/pistol opponent models.','ads':'Four calibrated per-weapon offsets; Remington and AK pitch/yaw derived from front/rear sight points. Existing sniper scope unchanged. Authored fire recoil, cosmetic camera kick only; no double damage event.','fallbacks':'Glock Idle is an authored constant pose. Shotgun has no Idle/Walk/Run clip: ready pose from Shoot at zero plus procedural movement. Glock/AK locomotion is procedural. Inspect/Holster states available to the shared controller for clips that exist; no new inspect binding added.','tests':{'logic':logic['checks'],'browser':list(dict.fromkeys(games['checks'])),'clips':clips['status'],'errors':games['errors'],'typecheck':'passed','build':'passed'},'performance':{'fps':round(games['fps'],1),'seconds':6,'views':5,'game':'Orda Finale','gpu':games['gpu'],'window':[1920,1080],'internal':[frames[0]['width'],frames[0]['height']],'livingEnemies':[min(f['enemies']for f in frames),max(f['enemies']for f in frames)],'conditions':games['conditions'],'limit':'One short development sample; not a maximum-horde or Terminal benchmark, and not a long-session guarantee.'},'limits':['Glock17 source/author/license absent from supplied GLB; verify original listing before publication. No publication performed.','Sparatoria smoke used Cantiere, two local views; five-view benchmark used actual Orda rendering.','No physical-pad or long endurance session.'], 'screenshots':['acr.png','glock.png','shotgun.png','ak74u.png']}
(out/'verification.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf8')
text=f'''# Realistic FPS Weapon Pack 4.0

ACR, Glock 17, Remington 870 e AK-74U aggiunte a Sparatoria e Orda Finale. Le sei armi precedenti restano disponibili con le statistiche originali.

28 clip originali verificate. Mani e rig indipendenti; ricariche reali e due varianti Glock/AK, cartucce Remington inserite singolarmente dall'host. ADS calibrato sulle quattro nuove armi; ottica sniper preservata. Walk/Run procedurali solo dove le clip mancano. Shotgun Idle dalla posa pronta di Shoot; Glock Idle è una posa costante. Inspect/Holster supportati dal controller, senza nuovo comando dedicato.

Test: typecheck, build, caricamento quattro GLB, 28 clip, verifica visiva di ricariche/ADS, danni e munizioni reali, ricarica parziale e abilità Goblin, Sparatoria Cantiere e Orda. Cinque rig/layer distinti; materiali/geometrie ACR condivisi tra due giocatori.

{games['fps']:.1f} FPS nel singolo campione di 6 secondi, Orda con cinque visuali, RTX 3050, finestra 1920×1080 e interno 1669×939; {summary['performance']['livingEnemies'][0]}–{summary['performance']['livingEnemies'][1]} nemici vivi durante il campione. HP 1000 solo nella fixture per mantenere attive le camere. Non è un benchmark di Terminal o dell'orda massima.

Correzioni ai derivati: pesi corrotti del caricatore ACR; scala delle mesh rigide Remington e posizione del bossolo nel bind; intervalli assoluti delle clip Glock. Originali Downloads invariati. Nessuna modifica a Backrooms o agli altri minigiochi.

Limite: autore/fonte/licenza Glock assenti dal file, da verificare prima di pubblicare. Nessun commit, push o deploy. Quattro screenshot reali di ricarica nel renderer Orda.
'''
(out/'README.md').write_text(text,encoding='utf8')
figures=''.join(f'<figure><img src="{name}.png" alt="{name.upper()} — ricarica con mani originali"><figcaption>{label}</figcaption></figure>'for name,label in [('acr','ACR · cambio caricatore'),('glock','Glock 17 · ricarica a vuoto'),('shotgun','Remington 870 · cartuccia singola'),('ak74u','AK-74U · cambio caricatore')])
page=f'''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Realistic FPS Weapon Pack 4.0</title><style>body{{margin:0;background:#101820;color:#ecede8;font:16px/1.6 system-ui}}main{{max-width:1300px;margin:auto;padding:35px 24px}}h1{{color:#ecc790;font-size:40px}}p{{max-width:1000px}}figure{{margin:24px 0;border:1px solid #42525b;background:#1b2831}}img{{width:100%;display:block}}figcaption{{padding:12px 18px}}a{{color:#ecc790}}</style><main><h1>Quattro armi. Mani vere. Ricariche originali.</h1><p>ACR, Glock 17, Remington 870 e AK-74U in Sparatoria e Orda Finale; sei armi precedenti preservate. 28 clip, rig indipendenti e ricarica a cartucce autoritativa.</p><p><b>{games['fps']:.1f} FPS</b> nel campione breve Orda a cinque visuali, RTX 3050 e interno 1669×939. {summary['performance']['livingEnemies'][0]}–{summary['performance']['livingEnemies'][1]} nemici vivi; HP aumentati solo nella fixture. <a href="verification.json">Test e limiti</a> · <a href="/">Party Game</a></p>{figures}<p>Licenza Glock da verificare prima della pubblicazione. Nessun commit, push o deploy.</p></main></html>'''
(out/'index.html').write_text(page,encoding='utf8')
subprocess.run([sys.executable,str(root/'scripts/monster-expansion-finalize.py')],cwd=root,check=True)
dest=root/'dist/fps-weapon-pack';dest.mkdir(parents=True,exist_ok=True)
for name in ['index.html','verification.json',*summary['screenshots']]:shutil.copy2(out/name,dest/name)
print('FPS weapon pack: local gallery and four screenshots ready.')
