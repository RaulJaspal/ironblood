# IRONBLOOD

**A realistic 3D fighting game that runs in your browser.** Eight photorealistic fighters, motion-captured combat, best-of-three rounds, arcade ladder and local 2-player versus. Built with three.js — no engine download, no install, just a URL.

*Champions never die.*

## Play

Open the live site, press **ENTER**, pick **ARCADE** (vs CPU) or **VERSUS** (two players, one keyboard/two gamepads).

### Controls

| | Player 1 | Player 2 | Gamepad |
|---|---|---|---|
| Move / jump / crouch | W A S D | Arrow keys | D-pad / left stick |
| Jab | U | B | Square |
| Heavy punch (chain ×4) | I | N | Triangle |
| Kick | J | M | Cross |
| Roundhouse | K | , | Circle |
| Special 1 (energy bolt) | O | . | R1 |
| Special 2 (charge / uppercut) | L | / | L1 |
| SUPER (full meter) | P | ' | R2 |
| Pause | ESC | ESC | Options |

- Hold **back** to block; **crouch-block** low sweeps.
- **Crouch + kick** = sweep knockdown. **Double-tap toward** = dash; **double-tap away** = evade roll (brief invulnerability).
- Heavy punch chains into a 4-hit target combo on hit. Uppercut launches for juggles.
- Supers require a full (flashing) meter and deal chip damage through block.

## How it was built

- **Renderer:** three.js (WebGL) — ACES tone mapping, HDRI environment lighting, PBR floors, soft shadows, particle FX, synthesized WebAudio SFX/music.
- **Characters:** [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) avatar library (MIT license) — game-quality rigged realistic humans, converted FBX→glTF with FBX2glTF and re-textured for web (2K color / 1K normals).
- **Animations:** [Quaternius Universal Animation Library 1 & 2](https://quaternius.com) (CC0) — motion clips retargeted offline from the UE-mannequin rig onto the Rocketbox Biped skeleton with a custom canonical-T-pose retargeting pipeline (`tools/lib/retarget.js`), plus hand-keyed kicks/sweep/uppercut layered on a mocap guard pose (`tools/lib/moves.js`).
- **Environments:** [Poly Haven](https://polyhaven.com) HDRIs and floor textures (CC0).
- **Combat:** frame-data driven (startup/active/recovery), high/low/overhead block rules, hitstop, damage scaling, super meter, juggle launchers, projectiles, KO slow-mo cinematics.

## Development

```bash
npm install                    # three, gltf-transform, playwright (dev)
node tools/build-characters.js # rebuild character GLBs from tools/src
node tools/build-anims.js      # re-run animation retarget/bake
node tools/portraits.js        # re-render character portraits
node tools/e2e.js out/         # headless smoke test with screenshots
npx http-server web            # serve locally
```

`tools/src/` (source FBX/GLB assets, ~50MB) is not committed; the pipeline scripts
document the exact public sources, and `web/assets/` contains everything the game needs.

## Credits & licenses

This is a free, non-commercial fan project. All assets are properly licensed:

| Asset | Source | License |
|---|---|---|
| Character models & textures | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) | MIT |
| Animation clips | [Quaternius Universal Animation Library 1+2](https://quaternius.itch.io/universal-animation-library) | CC0 |
| HDRI environments & floor textures | [Poly Haven](https://polyhaven.com) | CC0 |
| three.js | [threejs.org](https://threejs.org) | MIT |
| Game code, retarget pipeline, hand-keyed animation | this repository | MIT |

Sound effects and music are synthesized at runtime with WebAudio (no audio assets).

IRONBLOOD is an original work. It is not affiliated with, or endorsed by, the publishers
of any commercial fighting game franchise.
