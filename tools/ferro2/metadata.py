"""Preserve original attribution in derivative GLBs and inventory every supplied FBX."""
import hashlib,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/assets/ferro2';DOC=ROOT/'docs/agent-work/ferro-2';SRC=Path('C:/Users/niluf.PC-NIKO/Downloads');CACHE=ROOT/'.cache/ferro-2'
inventory=json.loads((DOC/'asset-inventory.json').read_text(encoding='utf8'))
mapping={'crystal':'shattered_crystal_sword.glb','steampunk':'free__steampunk_da_vincis_sword_game-ready.glb','autumn':'autumn_sword.glb','victory':'the_sword_of_victory.glb','hell':'hell_arena.glb','geonosis':'geonosis_arena.glb','scutum':'scutum.glb','medieval':'medieval_shield.glb','bow':'bow_and_arrow.glb','arrow':'bow_and_arrow.glb','longinus':'lance_of_longinus.glb','dagger':'Human Melee Animations FREE.zip','warhammer':'Human Melee Animations FREE.zip'}
ledger=[]
for output,source in mapping.items():
 meta=inventory[source].get('asset',{}).get('extras',{'author':'Kevin Iglesias','license':'Standard Unity Asset Store EULA, per supplied documentation','source':'https://www.keviniglesias.com/','title':'Human Melee Animations FREE prop'})
 meta={**meta,'sourceFile':source,'sourceSha256':hashlib.sha256((SRC/source).read_bytes()).hexdigest(),'modifications':'Local derivative: baked transforms, normalized scale/grip/axes; selected components separated. Runtime material adaptation; original source retained locally.'}
 if output in ['dagger','warhammer']:meta['modifications']+=' Original supplied HumanAnimations_ColorPalette.png associated with the authored UVs; source FBX has no assigned materials.'
 if output=='bow' or output=='arrow':meta['restriction']='CC BY-NC-SA 4.0. Noncommercial local derivative; ShareAlike conditions apply. No commercial clearance asserted.'
 if output=='scutum':meta['restriction']='Standard license metadata only; acquisition/license entitlement not independently verified. No publication/commercial clearance asserted.'
 if output in ['longinus','geonosis']:meta['restriction']='Author license metadata does not establish clearance of underlying franchise IP.'
 path=OUT/(output+'.glb');raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+size]);data['asset']['extras']=meta;data['asset']['generator']=data['asset']['generator'].split('; Ferro2 local normalization')[0]+'; Ferro2 local normalization'
 encoded=json.dumps(data,separators=(',',':'),ensure_ascii=True).encode();encoded+=b' '*((-len(encoded))%4);tail=raw[20+size:];path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
 ledger.append({'output':path.name,**meta,'bytes':path.stat().st_size})
(OUT/'CREDITS.json').write_text(json.dumps(ledger,indent=2),encoding='utf8')
fbx=[]
for tag in ['archer','melee']:
 for path in (CACHE/tag).rglob('*.fbx'):
  raw=path.read_bytes();binary=raw.startswith(b'Kaydara FBX Binary  \x00\x1a\x00');version=struct.unpack_from('<I',raw,23)[0] if binary else None
  if not binary or version not in [7300,7400,7500,7600,7700]:raise ValueError(f'Unsupported source header: {path}')
  fbx.append({'file':str(path.relative_to(CACHE)),'bytes':len(raw),'version':version,'sha256':hashlib.sha256(raw).hexdigest()})
(DOC/'fbx-inventory.json').write_text(json.dumps(fbx,indent=2),encoding='utf8')
conversion=json.loads((DOC/'conversion.json').read_text());conversion['assets']=[{'output':a['output'],'source':a['sourceFile'],'sha256':a['sourceSha256']}for a in ledger];conversion['fbxFilesInventoried']=len(fbx);(DOC/'conversion.json').write_text(json.dumps(conversion,indent=2),encoding='utf8')
lines=['# Ferro e Furia 2.0 — provenance and adaptation','','Local supplied assets; no publication or commercial clearance asserted. Sources, exact licenses, modifications and SHA-256 hashes are embedded in each derivative GLB and in `public/assets/ferro2/CREDITS.json`.','']
for a in ledger:lines.append(f"- **{a['output']}** — {a['author']}. {a['license']}. Source: {a['source']}."+(f" **{a['restriction']}**" if 'restriction' in a else ''))
lines+=['','## Animation data','Human Melee Animations FREE / Human Archer Animations FREE by Kevin Iglesias. Supplied documentation states the standard Unity Asset Store EULA, commercial use with compliant projects and no standalone resale. Actual supplied FBX curves are sampled at30Hz, normalized (Archer source centimeters), retimed and retargeted onto the existing named cartoon characters. No new anonymous character replaces them.','', 'Exact sampled source files:']
for key,a in conversion['clips'].items():lines.append(f"- `{key}`: `{a['source']}` ({a['frames']} samples, {a['duration']:.3f}s source).")
lines+=['','## Authored adaptation','Three guard stances, directional strike correction, two-link hand IK, heavy-feint blend, parry deflection/feedback, guard-break/counter push and dodge layers are original procedural/additive work. The packs have no dedicated parry, guard-break, feint or dodge clips. Source hips/chest/legs/hurt/death are also used; these are sampled motion curves, not runtime imported FBX skeletons.','', 'Bow load, hold and release use the authored source clips. The projectile event occurs0.10s into the release and is governed by the same shared state machine as the hand animation.','', 'The original Colosseum, axe, UI illustration system, effects and synthesized Web Audio remain original project work. Daggers and hammer come from the supplied Melee pack. Victory scabbard and spare bow/quiver/arrow components remain in the local source but are deliberately excluded from held meshes.','', 'Hell retains90403 triangles (only its12-triangle enclosing background box is excluded); Geonosis retains201223. Ground/navigation/collision are0.4m geometric proxies sampled from the original triangles, not spawn-derived validation. This approximation is not pixel-exact collision for every decorative edge.']
(ROOT/'src/minigames/ferro/CREDITS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print('Embedded credits:',len(ledger),'FBX inventory:',len(fbx))
