# FRONTLINE: POLYGON ARENA — 3D ASSET IMPORT & LICENSING PIPELINE

Ushbu katalog **FRONTLINE: POLYGON ARENA** o‘yinida protsedurali 3D modellarni tashqi **glTF 2.0 / GLB** modellari bilan almashtirish uchun mo‘ljallangan.

## 1. Kataloglar tuzilmasi (Directory Structure)

- `public/assets/characters/first-person-arms/` — 1-shaxs kamera qo‘llari, yenglari va qo‘lqoplari (`fp_arms_rig.glb`)
- `public/assets/characters/third-person-soldiers/` — 3-shaxs AI askar modellari (`soldier_assault.glb`, `soldier_medic.glb`, `soldier_support.glb`, `soldier_recon.glb`)
- `public/assets/weapons/primary/` — 14 ta asosiy qurol GLB modellari (`ar42_vanguard.glb` va boshqalar)
- `public/assets/weapons/sidearms/` — 6 ta to‘pponcha GLB modellari (`p6_courier.glb` va boshqalar)
- `public/assets/weapons/attachments/` — Optik nishonlar, kollimatorlar va qo‘shimcha qismlar
- `public/assets/environments/terrain/` — Relyef qismlari
- `public/assets/environments/buildings/` — Qishloq uylari, ma’muriy binolar va omborxonalar
- `public/assets/environments/structures/` — Bunkerlar, minoralar, ko‘prik ustunlari va transheyalar
- `public/assets/environments/vegetation/` — Daraxtlar va butalar
- `public/assets/environments/vehicles/` — Harbiy texnika vayronalari
- `public/assets/props/` — Taktik ta’minot qutilari, bochkalar va qum qoplari
- `public/assets/animations/` — Umumiy animatsiya kliplari (`Idle_Ready`, `Walk_Patrol`, `Run_Combat`, `Sprint_Tactical`, `Reload_Standard` va h.k.)
- `public/assets/materials/` — PBR materiallar
- `public/assets/textures/` — Teksturalar
- `public/assets/audio/` — Tashqi audio fayllar (`footstep_earth.ogg`, `gunshot_*.ogg` va h.k.)

## 2. Koordinata va o‘lcham standartlari (Coordinate Conventions)

- **Yuqori o‘q (Up Axis)**: `+Y`
- **Oldinga yo‘nalish (Forward Axis)**: `-Z`
- **Masshtab (Scale)**: `1.0 birlik = 1.0 metr`
- **Askar tayanch nuqtasi (Character Root)**: Oyoq tagi markazi `(0, 0, 0)`
- **Qurol tayanch nuqtasi (Weapon Grip Pivot)**: Qurol dastagi/tutqichi `(0, 0, 0)`

## 3. Protsedurali modelni GLB modelga almashtirish tartibi

1. Tegishli `.glb` faylni yuqoridagi katalogga joylashtiring (masalan: `public/assets/weapons/primary/ar42_vanguard.glb`).
2. `src/assets/assetRegistry.ts` faylida `ASSET_MANIFEST['weapon_ar42_vanguard']` yozuvini toping.
3. Litsenziya ma’lumotlarini (`license.licenseName`, `license.sourceUrl`, `license.author`, `license.verificationStatus = 'verified-cc0'` yoki `'verified-cc-by'`) to‘ldiring.
4. `sourceMode: 'external-glb'` qiymatiga o‘tkazing.
5. Agar fayl topilmasa yoki yuklashda xatolik yuz bersa, `assetLoader` avtomatik ravishda `src/game/models.ts` dagi protsedurali modelga qaytadi (`procedural-fallback`) va o‘yin to‘xtab qolmaydi.
