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

## Monster Expansion 1.2

Four user-supplied local archives: Creature NPC Pack.zip, (1).zip, (2).zip,
and (3).zip. Model filenames: Warrok W Kurniawan, Zombiegirl W Kurniawan,
Yaku J Ignite, Pumpkinhulk L Shaw. These names are provenance clues from the
files, not verified authorship or a grant of rights. No license text accompanied
the archives; verify the respective model, embedded texture and animation rights
before publication. No external upload, publication or deployment was performed.

Archive and extracted-file hashes and rig comparisons are retained in
docs/agent-work/monster-expansion. Originals were not modified. Distinct
package animation data was retargeted offline in Blender through rest-space
rotation deltas onto each model's own proportions. Redundant turn variants
were inspected; one left turn and one short right turn are selected per model.

The existing Warrok geometry, rig, materials and eight clips remain byte/data
identical; only five unique clips were appended: Swipe, Jump Attack, Turn Left,
Turn Right, Taunt. The standalone supplied Mutant Jump Attack and Mutant Swiping
were used on the verified Warrok rig. Jump Attack was also retargeted onto Yaku.
Other creatures retain their own package walk/run/swipe/death clips. No full
mesh is duplicated per clip. Airborne root lift is replaced by collision-aware
game physics, retaining crouch/landing compression; horizontal root movement
is removed. Textures are embedded and limited to 1024px for these local assets.

Zombiegirl and Yaku provide visuals for the existing Backrooms runner/stalker
roles. Warrok and Pumpkinhulk are exclusive to Orda: their enlarged silhouettes
do not suit the existing Backrooms doors and corridors.
