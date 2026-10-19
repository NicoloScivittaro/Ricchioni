# Terminal source conversion (phase 1)

This directory is independent of Sparatoria. It reads the user's actual Radiant
geometry and CoD4 binary assets; it does not generate replacement buildings,
spawns, gameplay colliders, bots, weapons or a map-selection entry.

## Inputs

The original ZIP and RAR remain untouched in Downloads. For this run they were
extracted to the ignored `docs/agent-work/terminal-conversion/source/` directory:

- `zip/map_source/mp_mw2_terminal.map` and `zip/map_source/prefabs/**`.
- `rar/mp_mw2_terminal_map_source_full/raw/{xmodel,xmodelparts,xmodelsurfs,materials,material_properties,images}/**`.
- `rar/mp_mw2_terminal_map_source_full/map_source/**` as a fallback/reference.

All 129 ZIP map files match their counterparts in the original RAR byte for
byte. Archive paths were checked before extraction; included scripts/binaries
were not executed. The installed WinRAR UnRAR extracted the data.

## Reproduce

Python 3.12, numpy and Pillow were already installed. No game dependencies or
global Blender add-ons were added. From the repository root:

```powershell
python tools/terminal/convert.py
python tools/terminal/validate_geometry.py
npx vite --host 127.0.0.1 --port 5184
```

Open `/docs/agent-work/terminal-conversion/preview.html` on port 5184. For the
single renderer check (uses the repository's existing puppeteer-core helper):

```powershell
$env:GOBLIN_GPU='1'
node tools/terminal/preview-check.mjs
```

Output: `public/assets/fps/terminal/terminal.glb`; reports and dependency lists
are written under `docs/agent-work/terminal-conversion/`.

## Format and limits

- iwmap 4 brush planes are clipped against the whole convex brush; mesh grids
  retain their authored vertices; quadratic curves are tessellated at eight
  samples per span. Prefabs expand recursively with composed pitch/yaw/roll,
  origin and scale matrices. Brush coordinates already belong to their map
  coordinate system; entity origin is not added twice.
- Binary XModel/XModelSurf version 25 is decoded in its static bind pose. LOD0
  geometry/material order is verified. Model meshes are shared between glTF
  nodes, preserving the position and transform of each available instance.
- Material texture associations come from binary offsets and channel names.
  IWI v6 DXT1/3/5 and uncompressed formats decode to lossless PNG. DXT5 normals
  are unpacked from alpha/green into tangent-space normal maps. Specular uses
  KHR_materials_specular; blend/cutout materials retain their techset category.
  Original detail shaders, baked lighting and CoD-specific effects are not
  equivalent to core glTF PBR and are recorded in material extras.
- Source Z-up is rotated to right-handed Y-up, with 0.0254 metres per unit.
  Only the scene's horizontal origin is recentered. Relative transforms remain
  unchanged. Camera presets derive from authored geometry, never spawn data.
- Missing models are omitted, never replaced by boxes. Missing materials use
  an explicitly labelled neutral fallback on the original geometry. Original
  caulk/clip/trigger/portal/sky and shadow-only helpers are excluded from the
  visual model and counted separately. They are not replaced by gameplay
  collision systems.

The GLB is explicitly partial. Consult REPORT.md and the inventories before
integrating it into any game mode. This preview has free inspection controls;
it does not validate gameplay walking/collision or multiplayer behaviour.

## Source licenses

The conversion scripts in this directory are GPL-3.0-or-later because the
CoD4 binary layout reader adapts cod-asset-importer; see THIRD_PARTY.md and
GPL-3.0.txt. This code license does not relicense the user's game assets.
