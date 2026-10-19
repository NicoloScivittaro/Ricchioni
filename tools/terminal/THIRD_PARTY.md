# Format references

- [RadiantMapToWavefrontObj](https://github.com/CptWesley/RadiantMapToWavefrontObj), MIT. Tested on a literal Terminal iwmap 4 sample. The stock parser rejects its header; its grammar does not implement the `mesh`/`curve` constructs in this source. It is not used as a converter for the full map.
- [cod-asset-importer](https://github.com/mauserzjeh/cod-asset-importer), GPL-3.0, by mauserzjeh and contributors. `cod4_assets.py` adapts its CoD4 version-25 XModel/XModelSurf and material-offset layouts; IWI images use the same DXT format identification and are decoded by the installed Pillow DDS decoder. The copied license is `GPL-3.0.txt`. No Blender add-on is installed globally.
- [CoD4 mod tools entity definitions](https://github.com/promod/CoD4-Mod-Tools/blob/master/bin/cod4.def) describe `misc_model`, uniform `modelscale`, and `misc_prefab` references.

The game assets originate solely from the two archives supplied by the user. No gameplay scripts from the archives are executed. Original materials and object names are preserved for the missing-assets inventory.
