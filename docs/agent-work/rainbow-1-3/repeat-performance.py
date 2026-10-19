from pathlib import Path
import json,os,subprocess,zipfile,time
root=Path(__file__).resolve().parents[3]
os.chdir(root)
r=Path('docs/agent-work/rainbow-1-3')
with zipfile.ZipFile(r/'baseline.zip') as z:
    names=z.namelist()
    current={n:Path(n).read_bytes() for n in names}
    if not (r/'before/performance-original.json').exists():
        (r/'before/performance-original.json').write_bytes((r/'before/arcobaleno-performance.json').read_bytes())
    def run(stage,pair):
        env=os.environ.copy();env.update(GOBLIN_GPU='1',R13_STAGE=stage)
        result=subprocess.run(['node','scripts/e2e/rainbow-13-performance.mjs'],env=env,capture_output=True,text=True,encoding='utf-8')
        (r/f'{stage}/performance-run-{pair}.log').write_text(result.stdout+result.stderr,encoding='utf-8')
        if result.returncode: raise RuntimeError(f'{stage} pair {pair} failed: {result.stderr[-600:]}')
        p=r/f'{stage}/arcobaleno-performance.json'; data=json.loads(p.read_text())
        assert data['metrics']['variant']['cosmos']==(stage=='after')
        assert data['metrics']['variant']['abilityCooldown']==(stage=='after')
        try:
            gpu=subprocess.check_output(['nvidia-smi','--query-gpu=timestamp,temperature.gpu,utilization.gpu,power.draw,clocks.gr','--format=csv,noheader'],text=True).strip()
            data['hardwareAfterSample']=gpu
        except Exception: pass
        (r/f'{stage}/performance-run-{pair}.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
        print(json.dumps({'pair':pair,'stage':stage,'fps':data['metrics']['fps'],'frame':data['metrics']['frameTime'],'gpu':data.get('hardwareAfterSample')}),flush=True)
    for pair in [1,2]:
        try:
            for n in names: Path(n).write_bytes(z.read(n))
            run('before',pair)
        finally:
            for n,data in current.items(): Path(n).write_bytes(data)
            print('FINAL SOURCES RESTORED',flush=True)
        run('after',pair)
summary={}
for stage in ['before','after']:
    rows=[json.loads((r/f'{stage}/performance-run-{i}.json').read_text())['metrics'] for i in [1,2]]
    summary[stage]={'fpsMean':sum(x['fps'] for x in rows)/len(rows),'fpsRange':[min(x['fps'] for x in rows),max(x['fps'] for x in rows)],'frameMeanMs':sum(x['frameTime']['mean'] for x in rows)/len(rows),'frameP95Ms':[x['frameTime']['p95'] for x in rows],'renderMeanMs':sum(x['render']['mean'] for x in rows)/len(rows),'renderP95Ms':[x['render']['p95'] for x in rows],'draws':[x['draw'] for x in rows],'meshes':[x['meshes'] for x in rows],'materials':[x['materials'] for x in rows]}
(r/'after/performance-pairs.json').write_text(json.dumps({'protocol':'Two alternating before/after pairs, same script and GPU, no build/encoding/other browser tests concurrent, full samples kept',**summary},indent=2),encoding='utf-8')
print('COMPARISON '+json.dumps(summary),flush=True)
