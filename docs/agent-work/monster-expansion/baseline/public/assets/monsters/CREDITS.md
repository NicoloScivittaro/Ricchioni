# Monster System — local source/provenance

Warrok and Mutant animations were supplied by the user in local FBX files.
Principal file: `Warrok W Kurniawan.fbx` (artist name as supplied in filename;
not independently confirmed). Eight clips: Mutant Breathing Idle, Walking,
Idle, Jumping, Run, Roaring, Punch and Dying. The additional Jump Attack and
Swiping FBX were inspected but are not part of the requested runtime clip set.

The sources contain a Mixamo-named rig and embedded bear_diffuse, bear_normal
and bear_specular images. Names and embedded paths do not establish a license.
No license document or original publication URL accompanied these files.
Verify the respective model, animation and texture licenses before publication.
No publication was performed during this work.

Offline conversion: Blender 5.2.1, one Warrok mesh/skin, eight named clips,
embedded textures limited to 1024px. Horizontal root motion removed; jump
height driven by gameplay. Original FBX files unchanged. Source hashes and
the compatibility inspection are in docs/agent-work/monster-system/fbx-audit.json.

Hazmat and Partygoer retain the original Backrooms mesh, material, textures,
skin weights, inverse bind matrices and hierarchy. Offline animation-only
retargeting was added; original files remain untouched. Their original source
attributions and licensing notes remain in [Backrooms credits](../backrooms/CREDITS.md).

Audio accents are original Web Audio synthesis through the game's existing
mixer. No recordings from commercial games were copied.
