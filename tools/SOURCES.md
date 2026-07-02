# Asset sources (to repopulate tools/src/)

All sources are public and properly licensed. `tools/src/` layout:

```
tools/src/ual/UAL1_Standard.glb        # Quaternius Universal Animation Library (CC0)
tools/src/ual/UAL2_Standard.glb        # Quaternius Universal Animation Library 2 (CC0)
tools/src/chars/<alias>/<Name>_raw.glb # FBX2glTF conversion of Rocketbox avatar FBX
tools/src/chars/<alias>/tex/*.jpg|png  # converted from Rocketbox 2K TGAs (sips)
tools/src/chars/<alias>/preview.png    # Rocketbox preview render
```

## Quaternius UAL (CC0)
Free downloads (Standard tier) from:
- https://quaternius.itch.io/universal-animation-library
- https://quaternius.itch.io/universal-animation-library-2
Use the `Unreal-Godot/UAL*_Standard.glb` (non-root-motion) files.

## Microsoft Rocketbox (MIT)
https://github.com/microsoft/Microsoft-Rocketbox — avatar aliases used:

| alias | avatar |
|---|---|
| brawler | Professions/Sports_Male_01 |
| heroine | Professions/Sports_Female_02 |
| soldier_m | Professions/Military_Male_02 |
| soldier_f | Professions/Military_Female_01 |
| agent | Professions/Business_Male_03 |
| bruiser | Professions/Construction_Male_02 |
| enforcer | Professions/Security_Male_01 |
| street | Adults/Male_Adult_04 |

Per avatar: `Export/<Name>.fbx`, `Textures/*_color*.tga` + `*_normal.tga`, `<Name>.png`.
Convert FBX with FBX2glTF v0.9.7 (`--binary`), textures with `sips` (color: 2K JPEG q80,
normals: 1K JPEG q85, opacity: 1K PNG).

## Poly Haven (CC0) — already committed in web/assets/env
HDRIs (2k .hdr): dikhololo_night, metro_noord, courtyard_night
Textures (1k jpg diff/nor_gl/rough): concrete_floor_02, asphalt_02, cobblestone_floor_08
