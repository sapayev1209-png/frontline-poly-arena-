import {
  PRIMARY_WEAPON_LIST,
  SIDEARM_WEAPON_LIST,
  SOLDIER_CLASSES,
  SoldierClassId,
  StructureCollider,
  WEAPONS,
  WeaponCategoryProfile,
  WeaponId,
} from '../types/game';

/**
 * Documented Coordinate & Scale Conventions for External 3D Asset Integration (glTF 2.0 / GLB).
 */
export const ASSET_COORDINATE_CONVENTIONS = {
  upAxis: '+Y',
  forwardAxisWorld: '-Z',
  forwardAxisWeaponLocal: '+Z (rotated Math.PI on FPS mount so muzzle faces camera -Z)',
  unitScale: '1.0 Three.js unit = 1.0 meter',
  characterRootOrigin: 'Bottom of feet at (0, 0, 0)',
  standingHeightMeters: 1.88,
  crouchingHeightMeters: 1.25,
  firstPersonEyeHeightStanding: 1.62,
  firstPersonEyeHeightCrouching: 1.14,
  weaponAttachmentPivot: 'Primary right-hand pistol grip / receiver center at (0, 0, 0)',
} as const;

export type AssetCategory =
  | 'first_person_arms'
  | 'third_person_soldier'
  | 'weapon_primary'
  | 'weapon_sidearm'
  | 'weapon_attachment'
  | 'environment_terrain'
  | 'environment_building'
  | 'environment_structure'
  | 'environment_vegetation'
  | 'environment_vehicle'
  | 'prop'
  | 'animation'
  | 'audio';

export type CollisionStrategy =
  | 'aabb_static'
  | 'cylinder_dynamic'
  | 'character_capsule'
  | 'non_colliding'
  | 'none';

export type LicenseVerificationStatus =
  | 'procedural_builtin'
  | 'verified_external'
  | 'pending_verification'
  | 'rejected_unlicensed';

export interface AssetLicenseRecord {
  licenseName: string; // e.g., 'CC0 1.0', 'CC-BY 4.0', 'Procedural Built-in'
  sourceUrl: string;
  author: string;
  attributionText: string;
  requiresAttribution: boolean;
  allowRedistribution: boolean;
  allowModification: boolean;
  verificationStatus: LicenseVerificationStatus;
}

export interface FirstPersonWeaponCalibration {
  categoryProfile: WeaponCategoryProfile;
  hipPosition: [number, number, number];
  adsPosition: [number, number, number];
  sprintPosition: [number, number, number];
  sightOffsetY: number;
  muzzleOffset: [number, number, number];
  leftHandOffset: [number, number, number];
  rightHandOffset: [number, number, number];
  recoilPivotOffset: [number, number, number];
  magNodeName?: string;
  boltNodeName?: string;
  reloadAmmoTransferRatio: number; // Point in reload progress (0..1) where magazine ammo is authoritatively transferred
}

export interface CharacterBoneMapping {
  root: string;
  pelvis: string;
  spine: string;
  head: string;
  leftArm: string;
  rightArm: string;
  leftLeg: string;
  rightLeg: string;
  weaponSocket: string;
}

export type CharacterClipState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'crouch'
  | 'jump'
  | 'land'
  | 'aim'
  | 'fire'
  | 'reload'
  | 'defeat';

export interface AssetManifestEntry {
  assetId: string;
  category: AssetCategory;
  localPath: string;
  lodPaths?: {
    low?: string;
    medium?: string;
    high?: string;
  };
  format: 'glb' | 'gltf' | 'wav' | 'ogg' | 'procedural';
  intendedRole: string;
  /**
   * Set to true only when the external GLB/glTF file has been placed in `public/assets/...`
   * and its license has been verified (`verificationStatus === 'verified_external'`).
   * When false or if loading fails, the engine seamlessly uses the procedural model builder.
   */
  useExternalAsset: boolean;
  defaultScale: [number, number, number];
  rootOffset: [number, number, number];
  rootRotationEuler: [number, number, number];
  collisionStrategy: CollisionStrategy;
  fpWeaponCalibration?: FirstPersonWeaponCalibration;
  boneMapping?: CharacterBoneMapping;
  animationClipMapping?: Partial<Record<CharacterClipState, string>>;
  license: AssetLicenseRecord;
}

const BUILTIN_PROCEDURAL_LICENSE: AssetLicenseRecord = {
  licenseName: 'Apache-2.0 (Project Built-in Procedural Geometry)',
  sourceUrl: 'local://procedural-generator',
  author: 'Frontline Polygon Arena Engine',
  attributionText: 'Ichki protsedurali 3D generator (attribution talab qilinmaydi)',
  requiresAttribution: false,
  allowRedistribution: true,
  allowModification: true,
  verificationStatus: 'procedural_builtin',
};

const DEFAULT_BONE_MAPPING: CharacterBoneMapping = {
  root: 'Root',
  pelvis: 'Pelvis',
  spine: 'Spine',
  head: 'Head',
  leftArm: 'LeftArm',
  rightArm: 'RightArm',
  leftLeg: 'LeftLeg',
  rightLeg: 'RightLeg',
  weaponSocket: 'WeaponSocket_R',
};

const DEFAULT_CLIP_MAPPING: Record<CharacterClipState, string> = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  sprint: 'Sprint',
  crouch: 'Crouch_Idle',
  jump: 'Jump_Start',
  land: 'Jump_Land',
  aim: 'Aim_Rifle',
  fire: 'Fire_Rifle',
  reload: 'Reload_Rifle',
  defeat: 'Defeat_Fall',
};

/**
 * Resolves the specific animation & reload category profile for any of the 20 weapons.
 */
export function getWeaponCategoryProfile(weaponId: WeaponId): WeaponCategoryProfile {
  const spec = WEAPONS[weaponId];
  if (spec.slot === 'secondary') return 'pistol';
  if (spec.fireMode === 'spread') return 'shotgun';
  if (
    weaponId === 'smg9_vector' ||
    weaponId === 'k7_stinger' ||
    weaponId === 'pdw45_viper' ||
    weaponId === 'smg40_storm'
  ) {
    return 'smg';
  }
  if (weaponId === 'lm28_bastion' || weaponId === 'lm31_titan') {
    return 'lmg_heavy';
  }
  if (
    weaponId === 'sr24_polaris' ||
    weaponId === 'amr50_colossus' ||
    weaponId === 'dm14_hawk' ||
    weaponId === 'dm21_eclipse'
  ) {
    return 'sniper';
  }
  return 'rifle_carbine';
}

/**
 * Returns calibrated First-Person weapon transforms, hand offsets, sight alignment,
 * and authoritative reload ammunition transfer timing for each weapon.
 */
export function getFirstPersonWeaponCalibration(
  weaponId: WeaponId
): FirstPersonWeaponCalibration {
  const spec = WEAPONS[weaponId];
  const cfg = spec.modelConfig;
  const profile = getWeaponCategoryProfile(weaponId);

  const sightOffsetY =
    cfg.SightType === 'scope'
      ? 0.088
      : cfg.SightType === 'reflex'
      ? 0.078
      : 0.064;

  const hipPosition: [number, number, number] =
    profile === 'pistol'
      ? [0.19, -0.21, -0.38]
      : profile === 'smg'
      ? [0.21, -0.22, -0.42]
      : profile === 'lmg_heavy'
      ? [0.24, -0.25, -0.46]
      : profile === 'sniper' || profile === 'shotgun'
      ? [0.22, -0.22, -0.46]
      : [0.22, -0.23, -0.44];

  const adsPosition: [number, number, number] = [
    0.0,
    -sightOffsetY - 0.012,
    profile === 'pistol'
      ? -0.32
      : profile === 'sniper' || profile === 'shotgun'
      ? -0.31
      : -0.34,
  ];

  const sprintPosition: [number, number, number] = [0.11, -0.29, -0.38];

  const leftHandOffset: [number, number, number] =
    profile === 'pistol'
      ? [-0.035, -0.115, -0.14]
      : profile === 'smg'
      ? [-0.045, -0.085, -0.28]
      : profile === 'lmg_heavy'
      ? [-0.06, -0.105, -0.34]
      : [-0.048, -0.075, -0.34];

  const rightHandOffset: [number, number, number] = [0.015, -0.11, -0.12];

  const muzzleZ = 0.14 + cfg.receiverLength * 0.5 + cfg.barrelLength + 0.09;

  // Authoritative point in reload progress (0..1) where magazine is seated
  const reloadAmmoTransferRatio =
    profile === 'pistol'
      ? 0.62
      : profile === 'smg'
      ? 0.64
      : profile === 'shotgun'
      ? 0.68
      : profile === 'lmg_heavy'
      ? 0.72
      : profile === 'sniper'
      ? 0.70
      : 0.66;

  return {
    categoryProfile: profile,
    hipPosition,
    adsPosition,
    sprintPosition,
    sightOffsetY,
    muzzleOffset: [0, 0.024, muzzleZ],
    leftHandOffset,
    rightHandOffset,
    recoilPivotOffset: [0, 0, 0],
    magNodeName: 'Magazine_Mesh',
    boltNodeName: 'Bolt_Mesh',
    reloadAmmoTransferRatio,
  };
}

/**
 * Central Asset Registry mapping every replaceable character, weapon, structure, and prop
 * to its documented future path under `public/assets/...` and license metadata.
 */
export const ASSET_MANIFEST: Record<string, AssetManifestEntry> = {
  // 1. First-Person Viewmodel Arms
  fp_arms_default: {
    assetId: 'fp_arms_default',
    category: 'first_person_arms',
    localPath: '/assets/characters/first-person-arms/fp_arms_rig.glb',
    format: 'glb',
    intendedRole: 'Birinchi shaxs qo‘l, yeng va taktik qo‘lqop karkasi',
    useExternalAsset: false,
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'none',
    license: BUILTIN_PROCEDURAL_LICENSE,
  },
};

// 2. Register all 4 Soldier Classes (3rd-Person Soldiers)
(Object.keys(SOLDIER_CLASSES) as SoldierClassId[]).forEach((classId) => {
  const assetId = `soldier_${classId}`;
  ASSET_MANIFEST[assetId] = {
    assetId,
    category: 'third_person_soldier',
    localPath: `/assets/characters/third-person-soldiers/soldier_${classId}.glb`,
    lodPaths: {
      low: `/assets/characters/third-person-soldiers/soldier_${classId}_lod_low.glb`,
      medium: `/assets/characters/third-person-soldiers/soldier_${classId}.glb`,
      high: `/assets/characters/third-person-soldiers/soldier_${classId}_lod_high.glb`,
    },
    format: 'glb',
    intendedRole: `3-shaxs askar modeli (${SOLDIER_CLASSES[classId].name})`,
    useExternalAsset: false,
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'character_capsule',
    boneMapping: DEFAULT_BONE_MAPPING,
    animationClipMapping: DEFAULT_CLIP_MAPPING,
    license: BUILTIN_PROCEDURAL_LICENSE,
  };
});

// 3. Register all 14 Primary Weapons
PRIMARY_WEAPON_LIST.forEach((w) => {
  const assetId = `weapon_${w.id}`;
  ASSET_MANIFEST[assetId] = {
    assetId,
    category: 'weapon_primary',
    localPath: `/assets/weapons/primary/${w.id}.glb`,
    lodPaths: {
      low: `/assets/weapons/primary/${w.id}_low.glb`,
      high: `/assets/weapons/primary/${w.id}.glb`,
    },
    format: 'glb',
    intendedRole: `Asosiy qurol: ${w.name} (${w.subtitle})`,
    useExternalAsset: false,
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, Math.PI, 0],
    collisionStrategy: 'none',
    fpWeaponCalibration: getFirstPersonWeaponCalibration(w.id),
    license: BUILTIN_PROCEDURAL_LICENSE,
  };
});

// 4. Register all 6 Sidearms
SIDEARM_WEAPON_LIST.forEach((w) => {
  const assetId = `weapon_${w.id}`;
  ASSET_MANIFEST[assetId] = {
    assetId,
    category: 'weapon_sidearm',
    localPath: `/assets/weapons/sidearms/${w.id}.glb`,
    format: 'glb',
    intendedRole: `Yordamchi to‘pponcha: ${w.name} (${w.subtitle})`,
    useExternalAsset: false,
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, Math.PI, 0],
    collisionStrategy: 'none',
    fpWeaponCalibration: getFirstPersonWeaponCalibration(w.id),
    license: BUILTIN_PROCEDURAL_LICENSE,
  };
});

// 5. Register Battlefield Buildings, Fortifications, Vegetation, Vehicles & Props
const STRUCTURE_ASSET_DEFS: Array<{
  type: StructureCollider['type'];
  category: AssetCategory;
  folder: string;
  roleUz: string;
}> = [
  { type: 'village_house', category: 'environment_building', folder: 'environments/buildings', roleUz: 'Qishloq uyi' },
  { type: 'ruined_hall', category: 'environment_building', folder: 'environments/buildings', roleUz: 'Vayrona zal binosi' },
  { type: 'warehouse', category: 'environment_building', folder: 'environments/buildings', roleUz: 'Sanoat ombori' },
  { type: 'bunker', category: 'environment_structure', folder: 'environments/structures', roleUz: 'Temir-beton dot/bunker' },
  { type: 'tower', category: 'environment_structure', folder: 'environments/structures', roleUz: 'Kuzatuv minorasi' },
  { type: 'depot', category: 'environment_structure', folder: 'environments/structures', roleUz: 'Ta’minot omborxonasi' },
  { type: 'wall', category: 'environment_structure', folder: 'environments/structures', roleUz: 'Himoya devori' },
  { type: 'pillar', category: 'environment_structure', folder: 'environments/structures', roleUz: 'Tosh ustun' },
  { type: 'bridge_pier', category: 'environment_structure', folder: 'environments/structures', roleUz: 'Ko‘prik tayanchi' },
  { type: 'sandbag', category: 'environment_structure', folder: 'environments/structures', roleUz: 'Qum qoplari to‘sig‘i' },
  { type: 'supply_station', category: 'prop', folder: 'props', roleUz: 'O‘q-dori ta’minot stansiyasi' },
  { type: 'village_well', category: 'prop', folder: 'props', roleUz: 'Qishloq tosh qudug‘i' },
  { type: 'crate', category: 'prop', folder: 'props', roleUz: 'Yog‘och o‘q-dori qutisi' },
  { type: 'rock_outcrop', category: 'environment_vegetation', folder: 'environments/vegetation', roleUz: 'Qoya tosh' },
  { type: 'tree_trunk', category: 'environment_vegetation', folder: 'environments/vegetation', roleUz: 'Shimoliy o‘rmon daraxti' },
  { type: 'truck_wreck', category: 'environment_vehicle', folder: 'environments/vehicles', roleUz: 'Ishdan chiqqan harbiy yuk mashinasi' },
];

STRUCTURE_ASSET_DEFS.forEach((def) => {
  const assetId = `structure_${def.type}`;
  ASSET_MANIFEST[assetId] = {
    assetId,
    category: def.category,
    localPath: `/assets/${def.folder}/${def.type}.glb`,
    format: 'glb',
    intendedRole: def.roleUz,
    useExternalAsset: false,
    defaultScale: [1, 1, 1],
    rootOffset: [0, 0, 0],
    rootRotationEuler: [0, 0, 0],
    collisionStrategy: 'aabb_static',
    license: BUILTIN_PROCEDURAL_LICENSE,
  };
});

export function getAssetManifestEntry(assetId: string): AssetManifestEntry | null {
  return ASSET_MANIFEST[assetId] ?? null;
}

/**
 * Registers or updates an external asset in the manifest at runtime or configuration time.
 * Enforces license verification before enabling external loading.
 */
export function registerExternalAsset(entry: AssetManifestEntry): void {
  if (
    entry.useExternalAsset &&
    entry.license.verificationStatus !== 'verified_external' &&
    entry.license.verificationStatus !== 'procedural_builtin'
  ) {
    console.warn(
      `[AssetRegistry] Asset "${entry.assetId}" license is "${entry.license.verificationStatus}". Falling back to procedural model until verified.`
    );
    entry.useExternalAsset = false;
  }
  ASSET_MANIFEST[entry.assetId] = entry;
}
