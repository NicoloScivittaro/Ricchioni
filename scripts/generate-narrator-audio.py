"""Asset vocali offline: Kokoro ONNX italiano + compressione/normalizzazione FFmpeg.

Modelli locali: NARRATOR_MODEL_DIR. Nessuna chiamata API o inferenza online.
--prototype produce soltanto tre clip; --all usa il catalogo export JSON.
"""
import argparse, hashlib, json, os, subprocess, tempfile, wave
from pathlib import Path
import numpy as np
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--prototype',action='store_true');parser.add_argument('--all',action='store_true');args=parser.parse_args()
model=Path(os.environ.get('NARRATOR_MODEL_DIR',str(Path.home()/'.cache'/'party-game-tts')))
kokoro=Kokoro(str(model/'kokoro-v1.0.onnx'),str(model/'voices-v1.0.bin'))
out=ROOT/'public'/'audio'/'narrator';out.mkdir(parents=True,exist_ok=True)
if args.prototype:
    lines=[dict(id='demo-sarcasm',text="Boschi ultimo! Tutta 'sta potenza e poi perdi contro un menù!",speed=.99),dict(id='demo-roller',text="Ao', gira 'sto rullo. Qualcuno deve ancora rosicà!",speed=1.12),dict(id='demo-victory',text="Goblin primo! Che strano, quello che ha creato er gioco!",speed=1.08)]
else:
    lines=json.loads((ROOT/'docs'/'agent-work'/'narrator'/'catalog.json').read_text(encoding='utf-8'))
manifest={}
for i,line in enumerate(lines):
    text=line.get('spokenText',line['text']);speed=line.get('speed',1.08)
    signature=hashlib.sha256((text+str(speed)+'kokoro-im_nicola-radio-v1').encode()).hexdigest()
    dest=out/(line['id']+'.ogg');metadata=out/(line['id']+'.json')
    if metadata.exists() and dest.exists() and json.loads(metadata.read_text()).get('signature')==signature:
        data=json.loads(metadata.read_text());manifest[line['id']]=data;continue
    samples,rate=kokoro.create(text,'im_nicola',speed=speed,lang='it',sentence_pause=.18,clause_pause=.10)
    if len(samples)<rate*.5 or not np.isfinite(samples).all():raise RuntimeError('Audio non valido '+line['id'])
    with tempfile.NamedTemporaryFile(suffix='.wav',delete=False) as handle:temp=Path(handle.name)
    try:
        with wave.open(str(temp),'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(rate);wav.writeframes((np.clip(samples,-1,1)*32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(temp),'-af','asetrate=22560,aresample=24000,atempo=1.0638298,highpass=f=70,loudnorm=I=-17:TP=-1.5:LRA=7','-ar','24000','-ac','1','-c:a','libvorbis','-q:a','4',str(dest)],check=True)
    finally:temp.unlink(missing_ok=True)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(dest)]))
    data=dict(asset='/audio/narrator/'+dest.name,duration=round(float(probe['format']['duration']),3),bytes=dest.stat().st_size,signature=signature,voice='Kokoro im_nicola · radio originale',sampleRate=24000)
    metadata.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');manifest[line['id']]=data
    print(f"{i+1}/{len(lines)} {line['id']} {data['duration']}s",flush=True)
(out/('prototype-manifest.json' if args.prototype else 'manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Catalogo audio pronto',flush=True)
