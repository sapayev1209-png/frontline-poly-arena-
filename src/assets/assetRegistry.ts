import {
  SoldierClassId,
  WEAPONS,
  WeaponId,
  WeaponReloadProfileId,
} from '../types/game';

/**
 * Documented 3D coordinate & unit conventions for external GLB/glTF integration (Section 8.5).
 */
export const ASSET_CONVENTIONS = {
  upAxis: '+Y',
  forwardAxis: '-Z',
  rightAxis: '+X',
  unitsPerMeter: 1.0,
  characterRootOrigin: 'feet_ground_center (0, 0, 0)',
  weaponRootOrigin: 'receiver_grip_pivot (0, 0, 0)',
  firstPersonCameraNearPlane: 0.05,
  preferredFormats: ['glb', 'gltf'] as const,
} as const;

export type AssetCategory =
  | 'characters/first-person-arms'
  | 'characters/third-person-soldiers'
  | 'weapons/primary'
  | 'weapons/sidearms'
  | 'weapons/attachments'
  | 'environments/terrain'
  | 'environments/buildings'
  | 'environments/structures'
  | 'environments/vegetation'
  | 'environments/vehicles'
  | 'props'
  | 'animations'
  | 'materials'
  | 'textures'
  | 'audio';

export type CollisionStrategy =
  | 'keep-authoritative-aabb'
  | 'custom-box'
  | 'cylinder'
  | 'non-colliding';

export type LicenseVerificationStatus =
  | 'procedural-internal'
  | 'verified-cc0'
  | 'verified-cc-by'
  | 'pending-verification'
  | 'restricted-do-not-ship';

export interface AssetLicenseMetadata {
  licenseName: string;
  sourceUrl: string;
  author: string;
  attributionRequired: boolean;
  attributionText: string;
  redistributionAllowed: boolean;
  modificationAllowed: boolean;
  verificationStatus: LicenseVerificationStatus;
}

export interface AnimationStateMapping {
  idle: string;
  walk: string;
  run: string;
  sprint: string;
  crouch: string;
  jump: string;
  land: string;
  aim: string;
  fire: string;
  reload: string;
  defeat: string;
}

export interface HumanoidBoneMapping {
  root: string;
  hips: string;
  spine: string;
  chest: string;
  head: string;
  leftUpperArm: string;
  leftForearm: string;
  leftHand: string;
  rightUpperArm: string;
  rightForearm: string;
  rightHand: string;
  leftThigh: string;
  leftCalf: string;
  rightThigh: string;
  rightCalf: string;
  weaponSocket: string;
}

export const STANDARD_HUMANOID_BONE_MAP: HumanoidBoneMapping = {
  root: 'Root',
  hips: 'Hips',
  spine: 'Spine',
  chest: 'Chest',
  head: 'Head',
  leftUpperArm: 'LeftArm',
  leftForearm: 'LeftForeArm',
  leftHand: 'LeftHand',
  rightUpperArm: 'RightArm',
  rightForearm: 'RightForeArm',
  rightHand: 'RightHand',
  leftThigh: 'LeftUpLeg',
  leftCalf: 'LeftLeg',
  rightThigh: 'RightUpLeg',
  rightCalf: 'RightLeg',
  weaponSocket: 'RightHandWeaponSocket',
};

export const STANDARD_ANIMATION_CLIP_MAP: AnimationStateMapping = {
  idle: 'Idle_Ready',
  walk: 'Walk_Patrol',
  run: 'Run_Combat',
  sprint: 'Sprint_Tactical',
  crouch: 'Crouch_Idle',
  jump: 'Jump_Start',
  land: 'Jump_Land',
  aim: 'Aim_Down_Sights',
  fire: 'Fire_Primary',
  reload: 'Reload_Standard',
  defeat: 'Defeat_Fall',
};

export interface FirstPersonWeaponCalibration {
  weaponId: WeaponId;
  reloadProfile: WeaponReloadProfileId;
  ammoTransferNormalizedTime: number; // 0..1 point in reload when ammo transfers
  hipPosition: [number, number, number];
  adsPosition: [number, number, number];
  sprintPosition: [number, number, number];
  sprintRotation: [number, number, number];
  leftHandOffset: [number, number, number];
  rightHandOffset: [number, number, number];
  sightAlignmentOffsetY: number;
  muzzleOffset: [number, number, number];
  recoilPivotOffset: [number, number, number];
  modelScale: number;
}

export interface AssetManifestEntry {
  assetId: string;
  nameUz: string;
  category: AssetCategory;
  localPath: string;
  lowDetailPath?: string;
  format: 'glb' | 'gltf' | 'procedural';
  sourceMode: 'procedural-fallback' | 'external-glb';
  intendedRole: string;
  defaultScale: [number, number, number];
  rootOffset: [number, number, number];
  rootRotationEuler: [number, number, number];
  collisionStrategy: CollisionStrategy;
  animationClips?: Partial<AnimationStateMapping>;
  boneMap?: Partial<HumanoidBoneMapping>;
  license: AssetLicenseMetadata;
}

const PROCEDURAL_INTERNAL_LICENSE: AssetLicenseMetadata = {
  licenseName: 'Internal Procedural Geometry (Apache-2.0)',
  sourceUrl: 'local://procedural/models.ts',
  author: 'Frontline Polygon Arena Engine',
  attributionRequired: false,
  attributionText: 'Procedural fallback geometry generated in-engine.',
  redistributionAllowed: true,
  modificationAllowed: true,
  verificationStatus: 'procedural-internal',
};

/**
 * Determines the distinct reload animation profile for each of the 20 weapons.
 */
export function getWeaponReloadProfile(weaponId: WeaponId): WeaponReloadProfileId {
  const spec = WEAPONS[weaponId];
  if (spec.slot === 'secondary') return 'pistol_sidearm';
  if (spec.fireMode === 'spread') return 'shotgun_shell';
  if (
    weaponId === 'lm28_bastion' ||
    weaponId === 'lm31_titan'
  ) {
    return 'lmg_heavy';
  }
  if (
    weaponId === 'r41_sentinel' ||
    weaponId === 'd22_longview' ||
    weaponId === 'v14_striker'
  ) {
    return 'sniper_precision';
  }
  if (
    weaponId === 'k9_raptor' ||
    weaponId === 'px9_swift' ||
    weaponId === 'f8_ember'
  ) {
    return 'smg_compact';
  }
  return 'rifle_standard';
}

/**
 * Per-weapon First-Person calibration table for all 20 weapons (Section 8.7).
 */
export const WEAPON_FPS_CALIBRATIONS: Record<
  WeaponId,
  FirstPersonWeaponCalibration
> = (Object.keys(WEAPONS) as WeaponId[]).reduce((acc, wid) => {
  const spec = WEAPONS[wid];
  const profile = getWeaponReloadProfile(wid);
  const sightY =
    spec.modelConfig.opticStyle === 'scope'
      ? 0.088
      : spec.modelConfig.opticStyle === 'reflex'
      ? 0.082
      : 0.072;

  const hipPos: [number, number, number] =
    profile === 'pistol_sidearm'
      ? [0.185, -0.205, -0.375]
      : profile === 'smg_compact'
      ? [0.205, -0.215, -0.415]
      : profile === 'lmg_heavy'
      ? [0.235, -0.245, -0.455]
      : profile === 'sniper_precision' || profile === 'shotgun_shell'
      ? [0.218, -0.218, -0.455]
      : [0.218, -0.226, -0.435];

  const adsZ =
    profile === 'pistol_sidearm'
      ? -0.315
      : profile === 'sniper_precision'
      ? -0.305
      : -0.335;

  acc[wid] = {
    weaponId: wid,
    reloadProfile: profile,
    ammoTransferNormalizedTime: 0.85,
    hipPosition: hipPos,
    adsPosition: [0.0, -sightY - 0.012, adsZ],
    sprintPosition: [0.105, -0.285, -0.375],
    sprintRotation: [-0.18, 0.52, 0.24],
    leftHandOffset:
      profile === 'pistol_sidearm'
        ? [-0.035, -0.115, -0.14]
        : profile === 'smg_compact'
        ? [-0.045, -0.085, -0.28]
        : profile === 'lmg_heavy'
        ? [-0.06, -0.105, -0.34]
        : [-0.048, -0.075, -0.34],
    rightHandOffset: [0.015, -0.11, -0.12],
    sightAlignmentOffsetY: sightY,
    muzzleOffset: [0, 0.04, 0.16 + spec.modelConfig.barrelLength],
    recoilPivotOffset: [0, -0.03, 0.08],
    modelScale: 1.0,
  };
  return acc;
}, {} as Record<WeaponId, FirstPersonWeaponCalibration>);

/**
 * Central Asset Manifest covering weapons, characters, first-person arms, buildings,
 * props, vegetation, and audio (Sections 8.2, 8.3 & 8.8).
 * Defaults to 'procedural-fallback' so the game runs with zero missing-file errors
 * while allowing immediate drop-in replacement with external GLB/glTF files.
 */
export const ASSET_MANIFEST: Record<string, AssetManifestEntry> = {
  // First-person arms rig
  fp_arms_default: {
    assetId: 'fp_arms_default',
    nameUz: '1-Shaxs Taktik Qo‘l va Qo‘lqop Karkasi',
    category: 'characters/first-person-arms',
    localPath: '/assets/characters/first-person-arms/fp_arms_rig.glb',
    format: 'glb',
    sourceMode: 'procedural-fallback',
    intendedRole: 'First-person articulated arms, sleeves, cuffs, and gloves',
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'non-colliding',
    animationClips: STANDARD_ANIMATION_CLIP_MAP,
    license: PROCEDURAL_INTERNAL_LICENSE,
  },

  // Third-person soldier classes
  ...(['assault', 'medic', 'support', 'recon'] as SoldierClassId[]).reduce(
    (acc, cid) => {
      acc[`soldier_${cid}`] = {
        assetId: `soldier_${cid}`,
        nameUz: `3-Shaxs Askar Modeli (${cid.toUpperCase()})`,
        category: 'characters/third-person-soldiers',
        localPath: `/assets/characters/third-person-soldiers/soldier_${cid}.glb`,
        lowDetailPath: `/assets/characters/third-person-soldiers/soldier_${cid}_lod1.glb`,
        format: 'glb',
        sourceMode: 'procedural-fallback',
        intendedRole: `Third-person AI combatant rig for ${cid}`,
        defaultScale: [1, 1, 1],
        rootOffset: [0, 0, 0],
        rootRotationEuler: [0, 0, 0],
        collisionStrategy: 'cylinder',
        animationClips: STANDARD_ANIMATION_CLIP_MAP,
        boneMap: STANDARD_HUMANOID_BONE_MAP,
        license: PROCEDURAL_INTERNAL_LICENSE,
      };
      return acc;
    },
    {} as Record<string, AssetManifestEntry>
  ),

  // All 20 Weapons (14 Primary + 6 Sidearms)
  ...(Object.keys(WEAPONS) as WeaponId[]).reduce((acc, wid) => {
    const spec = WEAPONS[wid];
    const folder =
      spec.slot === 'primary' ? 'weapons/primary' : 'weapons/sidearms';
    acc[`weapon_${wid}`] = {
      assetId: `weapon_${wid}`,
      nameUz: `${spec.name} (${spec.categoryUz})`,
      category: folder,
      localPath: `/assets/${folder}/${wid}.glb`,
      lowDetailPath: `/assets/${folder}/${wid}_lod1.glb`,
      format: 'glb',
      sourceMode: 'procedural-fallback',
      intendedRole: `3D Weapon mesh for ${spec.name}`,
      defaultScale: [1, 1, 1],
      rootOffset: [0, 0, 0],
      rootRotationEuler: [0, Math.PI, 0],
      collisionStrategy: 'non-colliding',
      license: PROCEDURAL_INTERNAL_LICENSE,
    };
    return acc;
  }, {} as Record<string, AssetManifestEntry>),

  // Environment Buildings & Structures
  env_bunker: {
    assetId: 'env_bunker',
    nameUz: 'Temir-Beton Mudofaa Bunkeri',
    category: 'environments/structures',
    localPath: '/assets/environments/structures/bunker_fortified.glb',
    format: 'glb',
    sourceMode: 'procedural-fallback',
    intendedRole: 'Fortified command & defensive pillbox bunker',
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'keep-authoritative-aabb',
    license: PROCEDURAL_INTERNAL_LICENSE,
  },
  env_village_house: {
    assetId: 'env_village_house',
    nameUz: 'Temir Qishloq Vayrona Uyi',
    category: 'environments/buildings',
    localPath: '/assets/environments/buildings/village_house_ruined.glb',
    format: 'glb',
    sourceMode: 'procedural-fallback',
    intendedRole: 'Two-story ruined European village house',
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'keep-authoritative-aabb',
    license: PROCEDURAL_INTERNAL_LICENSE,
  },
  env_ruined_hall: {
    assetId: 'env_ruined_hall',
    nameUz: 'Markaziy Ma’muriy Bino Vayronasi',
    category: 'environments/buildings',
    localPath: '/assets/environments/buildings/ruined_municipal_hall.glb',
    format: 'glb',
    sourceMode: 'procedural-fallback',
    intendedRole: 'Central village landmark hall',
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'keep-authoritative-aabb',
    license: PROCEDURAL_INTERNAL_LICENSE,
  },
  env_warehouse: {
    assetId: 'env_warehouse',
    nameUz: 'Sharqiy Sanoat Omborxonasi',
    category: 'environments/buildings',
    localPath: '/assets/environments/buildings/industrial_warehouse.glb',
    format: 'glb',
    sourceMode: 'procedural-fallback',
    intendedRole: 'Eastern industrial depot warehouse',
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'keep-authoritative-aabb',
    license: PROCEDURAL_INTERNAL_LICENSE,
  },
  env_truck_wreck: {
    assetId: 'env_truck_wreck',
    nameUz: 'Ishdan Chiqqan Harbiy Yuk Mashinasi',
    category: 'environments/vehicles',
    localPath: '/assets/environments/vehicles/military_truck_wreck.glb',
    format: 'glb',
    sourceMode: 'procedural-fallback',
    intendedRole: 'Convoy cover vehicle',
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'keep-authoritative-aabb',
    license: PROCEDURAL_INTERNAL_LICENSE,
  },
  prop_supply_crate: {
    assetId: 'prop_supply_crate',
    nameUz: 'Taktik O‘q-Dori va Ta’minot Qutisi',
    category: 'props',
    localPath: '/assets/props/tactical_supply_crate.glb',
    format: 'glb',
    sourceMode: 'procedural-fallback',
    intendedRole: 'Destructible or interactive field crate',
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'keep-authoritative-aabb',
    license: PROCEDURAL_INTERNAL_LICENSE,
  },
};

/**
 * Helper to validate whether an asset entry has a verified open license before enabling external loading.
 */
export function isAssetLicenseVerified(entry: AssetManifestEntry): boolean {
  const status = entry.license.verificationStatus;
  return (
    status === 'procedural-internal' ||
    status === 'verified-cc0' ||
    status === 'verified-cc-by'
  );
}
