import json, pathlib, statistics
OUT=pathlib.Path(__file__).parent
ROOT=OUT.parents[2]
def mean(v): return statistics.mean(v) if v else 0
def p95(v): return sorted(v)[min(len(v)-1,int(len(v)*.95))] if v else 0
clips=json.loads((ROOT/'src/minigames/characters/goblinClips.json').read_text())
lines=['# Trim / speed / mapping','', 'Ranges are runtime seconds (Babylon frames = seconds × 60). Original files are unchanged. Preview speed is selectable; gameplay uses the actual authoritative move duration. Attack contact is piecewise warped into startup + 35% of the existing active interval.','', '| Original | Internal | Source duration s | Used seconds / frames | Default effective s | Mean speed ratio | Contact source s | Loop |','|---|---|---|---|---|---|---|---|']
for c in clips:
    lines.append(f"| {c['original'].replace(chr(10),' ')} | {c['name']} | {c['originalDuration']:.3f} | {c['from']:.3f}–{c['to']:.3f} / {c['from']*60:.1f}–{c['to']*60:.1f} | {c['duration']:.3f} | {(c['to']-c['from'])/c['duration']:.2f} | {c['contact']} | {c['loop']} |")
lines+=['','Jump/fall use only their aerial segments; authored hips Y is suppressed while airborne. Idle/run loops have a 0.10 s seam blend. Victory/defeat play once and hold the tail. KO adapts to the existing 0.45 s FPS death presentation. Pickup/throw/catch events begin at the selected contact sample, with no blend delay. Contact candidates remain marked `contactVerified:false` until a manual art acceptance pass. Temporal alignment is automatically tested; anatomical reach and motion quality remain separate review criteria.']
(OUT/'ANIMATION-MAPPING.md').write_text('\n'.join(lines),encoding='utf-8')
lines=['# Performance measurements','', 'Local DEV, Chrome headless, 1280×720. Hardware run: ANGLE Direct3D11, NVIDIA GeForce RTX 3050. Software run: ANGLE Vulkan SwiftShader, kept separate. Original 4096 texture and original geometry, no compression or generated LOD. Draw calls are per frame from SceneInstrumentation, not the engine cumulative counter. Frame interval includes scheduling/GPU waits; SceneInstrumentation frame CPU time has a narrower scope.','']
for prefix,title in [('hardware-','RTX 3050 — Gallery 1 / 2 / 5'),('','SwiftShader — Gallery 1 / 2 / 5')]:
    if not (OUT/f'{prefix}gallery-performance.json').exists():continue
    data=json.loads((OUT/f'{prefix}gallery-performance.json').read_text())
    lines+=['',f'## {title}','']
    lines+=['| Gallery | Frame rolling mean ms | FPS mean | Draw calls mean | Sampler CPU mean ms | Skeletons | Active mapped tracks | Original triangles |','|---|---|---|---|---|---|---|---|']
    for name,s in data.items():
        rows=s['rows'];n=int(name.split('-')[0]);new=name.endswith('new')
        lines.append(f"| {name} | {mean([r['perf']['frameMsAvg'] for r in rows]):.2f} | {mean([r['perf']['fps'] for r in rows]):.2f} | {mean([r['perf']['drawCalls'] for r in rows]):.2f} | {mean([r['cost']['samplerMs'] for r in rows]):.3f} | {rows[-1]['stats']['skeletons']} | {195*n if new else 0} | {s['triangles'] or 'legacy geometry'} |")
for prefix,title in [('hardware-','RTX 3050 — real game scenes, five actors'),('','SwiftShader — real game scenes, five actors')]:
    if not (OUT/f'{prefix}context-performance.json').exists():continue
    data=json.loads((OUT/f'{prefix}context-performance.json').read_text())
    lines+=['',f'## {title}','']
    lines+=['','| Context (5 Goblins) | Frame interval mean / p95 ms | Scene CPU mean ms | Render CPU mean ms | Draw calls mean | Sampler mean ms | Skeleton.prepare mean ms | Skeletons | Active tracks | Scene materials / textures |','|---|---|---|---|---|---|---|---|---|---|']
    for name,rows in data.items():
        if not isinstance(rows,list) or not rows or 'dt' not in rows[0]:continue
        lines.append(f"| {name} | {mean([r['dt'] for r in rows]):.2f} / {p95([r['dt'] for r in rows]):.2f} | {mean([r['frameMs'] for r in rows]):.2f} | {mean([r['renderMs'] for r in rows]):.2f} | {mean([r['drawCalls'] for r in rows]):.2f} | {mean([r['samplerMs'] for r in rows]):.3f} | {mean([r.get('skeletonPrepareMs',0) for r in rows]):.3f} | {rows[-1]['skeletons']} | {rows[-1]['activeTracks']} | {rows[-1]['materials']} / {rows[-1]['textures']} |")
lines+=['','Each Tripo instance: 35,624 triangles, 33,613 vertices, 65 bones, 195 sampled tracks; five actors: 178,120 unique triangles, 325 bones, 975 active tracks. FPS renders visible actors per viewport, so submitted triangle count depends on masks/frustum and may exceed unique geometry.','', 'One shared original base-color texture per scene: estimated RGBA8 64 MiB, ~85.33 MiB with a full mip chain. This is an estimate, not queried driver allocation. Geometry and material are shared; skeletons and controller state are independent. Asset download: 9,302,908 bytes.','', 'Skeleton.prepare timing, when present in raw data, wraps actual prepare calls in the test only and sums them per engine frame. It includes transform/matrix work, not isolated GPU skinning. Sampler timings exclude skeleton.prepare. Mesh/material totals include retained hidden legacy fallback, HUD, world and effects. All 36 animation groups remain instance-owned data; only the chosen 195 tracks are evaluated.','', 'Hardware contexts sustain about 60 FPS at this resolution in the loaded steady scenes. Five-viewport FPS is measured with actual camera masks. These are not five humans fighting/shooting simultaneously with maximum VFX. Auto-quality remains the existing game policy; the tests do not pin every quality/resolution mode. Gallery frameMsAvg is a rolling window that includes startup/import warm-up, whereas the contextual dt samples are measured after loading. VSync near 60 FPS hides spare GPU headroom.','', 'SwiftShader does not meet a normal gameplay frame budget and is not evidence of RTX performance. Before definitive replacement, measure an active five-player session at the launch display resolution and quality, and inspect contact readability. No 2048/1024 variants were generated or compared; no destructive optimization was performed.']
(OUT/'PERFORMANCE.md').write_text('\n'.join(lines),encoding='utf-8')
fbx=json.loads((OUT/'fbx-audit.json').read_text())
lines=['# FBX inventory','', '| File | Bytes | FBX | Duration s | Key count | Stack |','|---|---|---|---|---|---|']
for f in fbx:lines.append(f"| {f['file']} | {f['bytes']} | {f['version']} | {f['durationSeconds']:.3f} | {f['keyCount']} | {', '.join(f['animationStacks']).replace(chr(0),'')} |")
lines+=['','No conversion/retarget is performed in this phase. Files have distinct SHA256 hashes (see JSON), including the two Kick Soccerball exports. Mixamo bone inventory is recorded, but bind/axis compatibility is not a retarget acceptance. The existing procedural soccer kick/charge/tackle remains authoritative visually.']
(OUT/'FBX-AUDIT.md').write_text('\n'.join(lines),encoding='utf-8')
print('mapping, performance and FBX tables generated')
