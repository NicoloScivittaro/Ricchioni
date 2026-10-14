"""Controlla realmente ogni clip OGG con FFmpeg; non richiede il modello TTS."""
import hashlib, json, re, subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'public/audio/narrator/manifest.json').read_text(encoding='utf-8'))
assert manifest==json.loads((root/'src/audio/narrator/audio-manifest.json').read_text(encoding='utf-8'))
results=[]
for line,meta in manifest.items():
    path=root/'public'/meta['asset'].lstrip('/')
    assert path.stat().st_size==meta['bytes']
    test=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True)
    peak=float(re.search(r'max_volume: ([-\d.]+) dB',test.stderr).group(1))
    mean=float(re.search(r'mean_volume: ([-\d.]+) dB',test.stderr).group(1))
    assert peak<0 and -23<mean<-12,(line,peak,mean)
    results.append(dict(id=line,bytes=meta['bytes'],duration=meta['duration'],peakDb=peak,meanDb=mean,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
summary=dict(clips=len(results),bytes=sum(x['bytes'] for x in results),durationSeconds=round(sum(x['duration'] for x in results),3),maxPeakDb=max(x['peakDb'] for x in results),minMeanDb=min(x['meanDb'] for x in results),maxMeanDb=max(x['meanDb'] for x in results),sourceManifestMatchesPublic=True,allDecoded=True,results=results)
(root/'docs/agent-work/narrator/asset-tests.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(f"NARRATORE ASSET: {len(results)} clip, {summary['bytes']} byte, picco {summary['maxPeakDb']} dBFS; tutte decodificate.")
