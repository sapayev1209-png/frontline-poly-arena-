# FRONTLINE: POLYGON ARENA — 3D ASSET INTEGRATION & LICENSING PIPELINE

This directory structure is prepared for replacing procedural placeholder models with external **glTF 2.0 / GLB** assets without modifying the core gameplay, physics, or combat engine.

## 1. Directory Organization (`public/assets/...`)

- `public/assets/characters/first-person-arms/` — First-person viewmodel arms, sleeves, and gloves (`fp_arms_rig.glb`)
- `public/assets/characters/third-person-soldiers/` — Third-person soldier rigs per class (`soldier_assault.glb`, `soldier_medic.glb`, `soldier_support.glb`, `soldier_recon.glb`)
- `public/assets/weapons/primary/` — 14 primary weapons (`ar42_vanguard.glb`, `smg9_vector.glb`, etc.)
- `public/assets/weapons/sidearms/` — 6 sidearms (`p6_courier.glb`, `rev357_ironclad.glb`, etc.)
- `public/assets/weapons/attachments/` — Optional optics, suppressors, magazines
- `public/assets/environments/terrain/` — Optional terrain detail meshes
- `public/assets/environments/buildings/` — Replaceable village & industrial buildings (`village_house.glb`, `ruined_hall.glb`, `warehouse.glb`)
- `public/assets/environments/structures/` — Bunkers, watchtowers, depots, walls, sandbags, bridge piers
- `public/assets/environments/vegetation/` — Trees and rock outcrops (`tree_trunk.glb`, `rock_outcrop.glb`)
- `public/assets/environments/vehicles/` — Military vehicle wrecks (`truck_wreck.glb`)
- `public/assets/props/` — Supply stations, crates, barrels, village well
- `public/assets/animations/` — Standalone or shared glTF animation clips
- `public/assets/materials/` — Material presets
- `public/assets/textures/` — PBR albedo/normal/roughness textures
- `public/assets/audio/` — Optional `.ogg`/`.wav` sound effects

## 2. Coordinate & Scale Conventions (`src/game/assetRegistry.ts`)

- **Up Axis**: `+Y` (`[0, 1, 0]`)
- **World Forward Axis**: `-Z` in camera view space (`+Z` in local weapon space prior to `Math.PI` mount rotation)
- **Scale**: `1.0 Three.js unit = 1.0 meter`
- **Character Root Origin**: Bottom of feet at `(0, 0, 0)`; standing height `1.88m`, crouching height `1.25m`
- **Weapon Grip Origin**: Primary right-hand grip at `(0, 0, 0)` with optional `Magazine_Mesh` and `Bolt_Mesh` child nodes

## 3. How to Enable an External GLB Model

1. Place the verified `.glb` file in its designated folder under `public/assets/...`.
2. In `src/game/assetRegistry.ts`, update the corresponding `ASSET_MANIFEST` entry (or call `registerExternalAsset(...)`):
   - Set `license.verificationStatus = 'verified_external'` and record `licenseName`, `sourceUrl`, `author`, and `attributionText`.
   - Set `useExternalAsset = true`.
   - Adjust `defaultScale`, `rootOffset`, or `fpWeaponCalibration` if the imported asset uses a different pivot.
3. If the file is missing or fails to load, `assetLoader` logs the diagnostic warning in the `F3` overlay and automatically falls back to the built-in procedural model.
