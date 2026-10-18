import * as THREE from 'three';
import { ARENA_HALF_SIZE, getTerrainHeight } from './mapData';
import {
  ObjectiveState,
  SOLDIER_CLASSES,
  SoldierClassId,
  StructureCollider,
  WEAPON_FINISHES,
  WEAPONS,
  WeaponFinishId,
  WeaponId,
} from '../types/game';

export type WeaponAnimationCategory =
  | 'pistol'
  | 'smg'
  | 'rifle'
  | 'lmg_heavy'
  | 'sniper_shotgun';

export interface WeaponMeshResult {
  group: THREE.Group;
  muzzlePoint: THREE.Object3D;
  magMesh: THREE.Object3D;
  magHomePos: THREE.Vector3;
  magHomeRot: THREE.Euler;
  boltMesh: THREE.Object3D;
  boltHomePos: THREE.Vector3;
  muzzleFlash: THREE.Mesh;
  sightOffsetY: number;
  categoryPose: WeaponAnimationCategory;
}

export interface FirstPersonRig {
  root: THREE.Group;
  poseGroup: THREE.Group;
  recoilGroup: THREE.Group;
  weaponMount: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftSleeveMat: THREE.MeshStandardMaterial;
  rightSleeveMat: THREE.MeshStandardMaterial;
  leftCuffMat: THREE.MeshStandardMaterial;
  rightCuffMat: THREE.MeshStandardMaterial;
  equippedWeaponId: WeaponId | null;
  equippedFinishId: WeaponFinishId | null;
  weaponData: WeaponMeshResult | null;
  // Smoothed animation state
  adsAlpha: number;
  sprintAlpha: number;
  crouchAlpha: number;
  bobPhase: number;
  swayX: number;
  swayY: number;
  recoilZ: number;
  recoilPitch: number;
  recoilRoll: number;
  muzzleFlashTimer: number;
  jumpVelImpulse: number;
  landDip: number;
}

export interface SoldierRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  weaponSocket: THREE.Group;
  muzzlePoint: THREE.Object3D;
  hitMeshes: THREE.Mesh[];
  teamMaterial: THREE.MeshStandardMaterial;
  visorMaterial: THREE.MeshStandardMaterial;
  baseTeamColor: THREE.Color;
  equippedWeaponId: WeaponId;
}

export interface ObjectiveRig {
  group: THREE.Group;
  ringMat: THREE.MeshStandardMaterial;
  coreMesh: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  beamMat: THREE.MeshBasicMaterial;
  flagMesh: THREE.Mesh;
}

let cachedContactShadowTex: THREE.Texture | null = null;

export function getContactShadowTexture(): THREE.Texture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  if (typeof document === 'undefined') {
    const data = new Uint8Array([2, 6, 23, 160]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    cachedContactShadowTex = tex;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.65)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.28)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedContactShadowTex = tex;
  return tex;
}

export function createBattlefieldGroundTexture(
  maxAnisotropy: number
): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([59, 66, 50, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Rich European wartime earth & olive turf base
  ctx.fillStyle = '#3b4232';
  ctx.fillRect(0, 0, 512, 512);

  // Soil & grass organic mottling
  for (let i = 0; i < 3600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random();
    ctx.fillStyle =
      r > 0.62
        ? 'rgba(89, 104, 70, 0.20)'
        : r > 0.25
        ? 'rgba(44, 38, 29, 0.24)'
        : 'rgba(120, 113, 108, 0.14)';
    ctx.fillRect(x, y, 3 + (i % 4), 3 + (i % 3));
  }

  // Subtle tactical sector grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function getWeaponCategoryPose(
  weaponId: WeaponId
): WeaponAnimationCategory {
  const spec = WEAPONS[weaponId];
  if (spec.slot === 'secondary') return 'pistol';
  if (
    weaponId === 'lm28_bastion' ||
    weaponId === 'lm31_titan'
  ) {
    return 'lmg_heavy';
  }
  if (
    weaponId === 's12_falcon' ||
    weaponId === 'd22_longview' ||
    weaponId === 'r41_sentinel' ||
    weaponId === 't17_thunder' ||
    weaponId === 'k17_breaker'
  ) {
    return 'sniper_shotgun';
  }
  if (
    weaponId === 'k9_raptor' ||
    weaponId === 'px9_swift' ||
    weaponId === 'f8_ember'
  ) {
    return 'smg';
  }
  return 'rifle';
}

/**
 * Builds a detailed multi-part 3D weapon model with articulated magazine, bolt/slide,
 * optical/iron sight alignment metadata, and 3D muzzle flash.
 */
export function createWeaponMesh(
  weaponId: WeaponId,
  finishId: WeaponFinishId = 'default'
): WeaponMeshResult {
  const spec = WEAPONS[weaponId];
  const cfg = spec.modelConfig;
  const finish = WEAPON_FINISHES[finishId] || WEAPON_FINISHES.default;
  const group = new THREE.Group();

  const bodyHex = finish.bodyTintHex ?? cfg.bodyHex;
  const gripHex = finish.gripTintHex ?? cfg.woodOrGripHex;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyHex,
    roughness: Math.min(0.92, Math.max(0.15, 0.34 + finish.roughnessOffset)),
    metalness: Math.min(0.95, Math.max(0.1, 0.78 + finish.metalnessOffset)),
  });
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.42,
    metalness: 0.85,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: gripHex,
    roughness: Math.min(0.95, Math.max(0.3, 0.68 + finish.roughnessOffset)),
    metalness: Math.max(0.05, 0.14 + finish.metalnessOffset * 0.5),
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: cfg.accentHex,
    emissive: cfg.accentHex,
    emissiveIntensity: 0.42,
    roughness: 0.22,
    metalness: 0.75,
  });

  // 1. Upper & Lower Receiver Assembly
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.082, cfg.receiverHeight, cfg.receiverLength),
    bodyMat
  );
  receiver.castShadow = true;
  group.add(receiver);

  const upperRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.058, 0.024, cfg.receiverLength * 0.88),
    darkSteelMat
  );
  upperRail.position.set(0, cfg.receiverHeight * 0.5 + 0.01, 0);
  group.add(upperRail);

  // Handguard / Forend
  const hgLen = cfg.handguardLength ?? cfg.barrelLength * 0.48;
  if (spec.slot === 'primary' && hgLen > 0.08) {
    const handguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.074, cfg.receiverHeight * 0.76, hgLen),
      gripMat
    );
    handguard.position.set(
      0,
      -cfg.receiverHeight * 0.04,
      cfg.receiverLength * 0.5 + hgLen * 0.46
    );
    handguard.castShadow = true;
    group.add(handguard);
  }

  // 2. Precision Barrel & Muzzle Device
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(
      cfg.barrelRadius,
      cfg.barrelRadius * 1.08,
      cfg.barrelLength,
      10
    ),
    darkSteelMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(
    0,
    cfg.receiverHeight * 0.18,
    cfg.receiverLength * 0.5 + cfg.barrelLength * 0.46
  );
  group.add(barrel);

  const muzzleBrake = new THREE.Mesh(
    new THREE.CylinderGeometry(
      cfg.barrelRadius * 1.35,
      cfg.barrelRadius * 1.25,
      0.065,
      8
    ),
    bodyMat
  );
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(
    0,
    cfg.receiverHeight * 0.18,
    cfg.receiverLength * 0.5 + cfg.barrelLength * 0.92
  );
  group.add(muzzleBrake);

  // 3. Reciprocating Bolt / Slide / Charging Handle (Animated during firing & reload)
  const boltMesh = new THREE.Group();
  const boltCarrier = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.036, cfg.receiverLength * 0.36),
    darkSteelMat
  );
  const chargingKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.048, 8),
    accentMat
  );
  chargingKnob.rotation.z = Math.PI / 2;
  chargingKnob.position.set(-0.038, 0, 0.02);
  boltMesh.add(boltCarrier, chargingKnob);
  boltMesh.position.set(0.028, cfg.receiverHeight * 0.22, 0.03);
  const boltHomePos = boltMesh.position.clone();
  group.add(boltMesh);

  // 4. Stock / Grip Variation
  if (cfg.stockStyle === 'full' || cfg.stockStyle === 'heavy') {
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.074,
        cfg.stockStyle === 'heavy' ? 0.165 : 0.135,
        0.29
      ),
      gripMat
    );
    stock.position.set(0, -0.028, -cfg.receiverLength * 0.5 - 0.125);
    group.add(stock);

    const buttpad = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.078,
        cfg.stockStyle === 'heavy' ? 0.17 : 0.14,
        0.025
      ),
      darkSteelMat
    );
    buttpad.position.set(0, -0.028, -cfg.receiverLength * 0.5 - 0.27);
    group.add(buttpad);
  } else if (cfg.stockStyle === 'folding' || cfg.stockStyle === 'carbine') {
    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.052, 0.23),
      darkSteelMat
    );
    strut.position.set(0, -0.01, -cfg.receiverLength * 0.5 - 0.105);
    group.add(strut);
  }

  // Ergonomic Pistol Grip + Trigger Guard
  const pistolGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.062, 0.155, 0.078),
    gripMat
  );
  pistolGrip.position.set(0, -cfg.receiverHeight * 0.65, -0.055);
  pistolGrip.rotation.x = -0.26;
  group.add(pistolGrip);

  const triggerGuard = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.045, 0.085),
    darkSteelMat
  );
  triggerGuard.position.set(0, -cfg.receiverHeight * 0.52, 0.01);
  group.add(triggerGuard);

  // 5. Detachable / Animated Magazine Group
  const magMesh = new THREE.Group();
  if (cfg.magazineStyle === 'drum') {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.118, 0.118, 0.095, 14),
      bodyMat
    );
    drum.rotation.x = Math.PI / 2;
    magMesh.add(drum);
    magMesh.position.set(0, -cfg.receiverHeight * 0.62, 0.085);
  } else if (cfg.magazineStyle === 'box_heavy') {
    const boxMag = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.18, 0.12),
      gripMat
    );
    magMesh.add(boxMag);
    magMesh.position.set(-0.04, -cfg.receiverHeight * 0.58, 0.07);
  } else if (
    cfg.magazineStyle === 'curved' ||
    cfg.magazineStyle === 'straight'
  ) {
    const magBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.056, 0.215, 0.088),
      darkSteelMat
    );
    magBody.rotation.x = cfg.magazineStyle === 'curved' ? 0.26 : 0.05;
    magMesh.add(magBody);
    magMesh.position.set(0, -cfg.receiverHeight * 0.82, 0.095);
  } else if (cfg.magazineStyle === 'tube') {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, cfg.barrelLength * 0.82, 8),
      darkSteelMat
    );
    tube.rotation.x = Math.PI / 2;
    const shellCarrier = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.045, 0.09),
      accentMat
    );
    shellCarrier.position.set(0, -0.02, -0.12);
    magMesh.add(tube, shellCarrier);
    magMesh.position.set(
      0,
      -cfg.receiverHeight * 0.18,
      cfg.receiverLength * 0.5 + cfg.barrelLength * 0.34
    );
  } else {
    // Pistol magazine or internal clip
    const clip = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.14, 0.062),
      darkSteelMat
    );
    clip.rotation.x = -0.24;
    magMesh.add(clip);
    magMesh.position.set(
      0,
      -cfg.receiverHeight * 0.68,
      cfg.magazineStyle === 'pistol_mag' ? -0.055 : 0.04
    );
  }
  const magHomePos = magMesh.position.clone();
  const magHomeRot = magMesh.rotation.clone();
  group.add(magMesh);

  // 6. Optic / Iron Sight Assembly & Sight Offset Calculation
  let sightOffsetY = cfg.receiverHeight * 0.68;
  if (cfg.opticStyle === 'scope') {
    sightOffsetY = cfg.receiverHeight * 0.74;
    const scopeMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.045, 0.18),
      darkSteelMat
    );
    scopeMount.position.set(0, cfg.receiverHeight * 0.56, 0.03);
    group.add(scopeMount);

    const scopeTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.034, 0.29, 12),
      bodyMat
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, sightOffsetY, 0.03);
    group.add(scopeTube);

    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.015, 10),
      accentMat
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, sightOffsetY, 0.175);
    group.add(lens);
  } else if (cfg.opticStyle === 'reflex') {
    sightOffsetY = cfg.receiverHeight * 0.68;
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.064, 0.062, 0.115),
      darkSteelMat
    );
    housing.position.set(0, sightOffsetY, 0.025);
    group.add(housing);

    const reticleDot = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.014, 0.014),
      accentMat
    );
    reticleDot.position.set(0, sightOffsetY + 0.005, 0.04);
    group.add(reticleDot);
  } else {
    sightOffsetY = cfg.receiverHeight * 0.64;
    // Rear aperture/notch + glowing front sight post
    const rearSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.038, 0.024),
      darkSteelMat
    );
    rearSight.position.set(
      0,
       cfg.receiverHeight * 0.58,
      -cfg.receiverLength * 0.36
    );
    group.add(rearSight);

    const frontPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.048, 0.02),
      accentMat
    );
    frontPost.position.set(
      0,
      cfg.receiverHeight * 0.58,
      cfg.receiverLength * 0.5 + cfg.barrelLength * 0.76
    );
    group.add(frontPost);
  }

  // 7. Muzzle Point & 3D Star Muzzle Flash Mesh
  const muzzleZ = cfg.receiverLength * 0.5 + cfg.barrelLength + 0.04;
  const muzzleY = cfg.receiverHeight * 0.18;

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, muzzleY, muzzleZ);
  group.add(muzzlePoint);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.26, 6),
    flashMat
  );
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.position.set(0, muzzleY, muzzleZ + 0.09);
  muzzleFlash.visible = false;
  group.add(muzzleFlash);

  return {
    group,
    muzzlePoint,
    magMesh,
    magHomePos,
    magHomeRot,
    boltMesh,
    boltHomePos,
    muzzleFlash,
    sightOffsetY,
    categoryPose: getWeaponCategoryPose(weaponId),
  };
}

/**
 * Creates the dedicated First-Person Viewmodel Rig attached to the player camera.
 * Features articulated sleeves, class insignia cuffs, tactical gloves, finger segments,
 * and coordinated weapon/hand sockets.
 */
export function createFirstPersonRig(
  soldierClass: SoldierClassId,
  initialWeapon: WeaponId,
  finishId: WeaponFinishId = 'default'
): FirstPersonRig {
  const root = new THREE.Group();
  const poseGroup = new THREE.Group();
  const recoilGroup = new THREE.Group();
  const weaponMount = new THREE.Group();

  root.add(poseGroup);
  poseGroup.add(recoilGroup);
  recoilGroup.add(weaponMount);

  // Subtle viewmodel light so FPS arms & receiver details stay readable in any shadow
  const viewLight = new THREE.PointLight(0xfffbeb, 0.55, 2.5);
  viewLight.position.set(0.15, 0.25, -0.15);
  root.add(viewLight);

  const classSpec = SOLDIER_CLASSES[soldierClass];

  const leftSleeveMat = new THREE.MeshStandardMaterial({
    color: classSpec.sleeveColorHex,
    roughness: 0.78,
    metalness: 0.08,
  });
  const rightSleeveMat = leftSleeveMat.clone();

  const leftCuffMat = new THREE.MeshStandardMaterial({
    color: classSpec.cuffAccentHex,
    roughness: 0.52,
    metalness: 0.28,
  });
  const rightCuffMat = leftCuffMat.clone();

  const gloveLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.62,
    metalness: 0.18,
  });
  const knuckleGuardMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    roughness: 0.42,
    metalness: 0.55,
  });

  const buildArticulatedArm = (
    isLeft: boolean,
    sleeveMat: THREE.MeshStandardMaterial,
    cuffMat: THREE.MeshStandardMaterial
  ): THREE.Group => {
    const armRoot = new THREE.Group();

    // Forearm military tunic sleeve
    const forearm = new THREE.Mesh(
      new THREE.BoxGeometry(0.088, 0.088, 0.34),
      sleeveMat
    );
    forearm.position.set(0, 0, 0.16);
    armRoot.add(forearm);

    // Reinforced wrist cuff with class color band
    const cuff = new THREE.Mesh(
      new THREE.BoxGeometry(0.092, 0.092, 0.055),
      cuffMat
    );
    cuff.position.set(0, 0, 0.01);
    armRoot.add(cuff);

    // Tactical combat glove palm
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.082, 0.078, 0.095),
      gloveLeatherMat
    );
    palm.position.set(0, -0.004, -0.055);
    armRoot.add(palm);

    // Hard carbon/steel knuckle guard
    const knuckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.084, 0.025, 0.055),
      knuckleGuardMat
    );
    knuckle.position.set(0, 0.036, -0.062);
    armRoot.add(knuckle);

    // Articulated thumb + gripped finger block
    const thumb = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.028, 0.065),
      gloveLeatherMat
    );
    thumb.position.set(isLeft ? 0.042 : -0.042, 0.018, -0.075);
    thumb.rotation.y = isLeft ? -0.45 : 0.45;
    armRoot.add(thumb);

    const fingers = new THREE.Mesh(
      new THREE.BoxGeometry(0.074, 0.058, 0.062),
      gloveLeatherMat
    );
    fingers.position.set(0, -0.012, -0.115);
    armRoot.add(fingers);

    return armRoot;
  };

  const leftArmGroup = buildArticulatedArm(true, leftSleeveMat, leftCuffMat);
  const rightArmGroup = buildArticulatedArm(false, rightSleeveMat, rightCuffMat);

  recoilGroup.add(leftArmGroup, rightArmGroup);

  const fpRig: FirstPersonRig = {
    root,
    poseGroup,
    recoilGroup,
    weaponMount,
    leftArmGroup,
    rightArmGroup,
    leftSleeveMat,
    rightSleeveMat,
    leftCuffMat,
    rightCuffMat,
    equippedWeaponId: null,
    equippedFinishId: null,
    weaponData: null,
    adsAlpha: 0,
    sprintAlpha: 0,
    crouchAlpha: 0,
    bobPhase: 0,
    swayX: 0,
    swayY: 0,
    recoilZ: 0,
    recoilPitch: 0,
    recoilRoll: 0,
    muzzleFlashTimer: 0,
    jumpVelImpulse: 0,
    landDip: 0,
  };

  equipFirstPersonWeapon(fpRig, initialWeapon, soldierClass, finishId);
  return fpRig;
}

/**
 * Equips or updates the active weapon on the FirstPersonRig without creating duplicate meshes.
 */
export function equipFirstPersonWeapon(
  fpRig: FirstPersonRig,
  weaponId: WeaponId,
  soldierClass: SoldierClassId,
  finishId: WeaponFinishId = 'default'
) {
  const classSpec = SOLDIER_CLASSES[soldierClass];
  fpRig.leftSleeveMat.color.setHex(classSpec.sleeveColorHex);
  fpRig.rightSleeveMat.color.setHex(classSpec.sleeveColorHex);
  fpRig.leftCuffMat.color.setHex(classSpec.cuffAccentHex);
  fpRig.rightCuffMat.color.setHex(classSpec.cuffAccentHex);

  if (
    fpRig.equippedWeaponId === weaponId &&
    fpRig.equippedFinishId === finishId &&
    fpRig.weaponData
  ) {
    return;
  }

  // Cleanly dispose previous weapon mesh & materials
  while (fpRig.weaponMount.children.length > 0) {
    const child = fpRig.weaponMount.children[0];
    child.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
        else m.material.dispose();
      }
    });
    fpRig.weaponMount.remove(child);
  }

  const weaponData = createWeaponMesh(weaponId, finishId);
  // Orient weapon so muzzle (+Z in local builder) points forward along camera -Z
  weaponData.group.rotation.y = Math.PI;
  fpRig.weaponMount.add(weaponData.group);

  fpRig.weaponData = weaponData;
  fpRig.equippedWeaponId = weaponId;
  fpRig.equippedFinishId = finishId;
}

/**
 * Updates the First-Person Viewmodel Rig every frame with delta-time-aware animations:
 * Idle breathing, Walk/Run Lissajous bob, Sprint carry pose, ADS sight alignment,
 * Recoil & bolt kickback, Jump/Land inertia, Weapon switching, and 5-Stage Category Reloads.
 */
export function updateFirstPersonRigAnimation(
  fpRig: FirstPersonRig,
  params: {
    dt: number;
    alive: boolean;
    horizSpeed: number;
    vy: number;
    grounded: boolean;
    crouching: boolean;
    sprinting: boolean;
    aiming: boolean;
    reloading: boolean;
    reloadProgress: number; // 0..1
    switchTimer: number;
    switchDuration: number;
    lookDeltaX: number;
    lookDeltaY: number;
    emptyClickTimer?: number;
  }
) {
  const { dt, alive } = params;
  fpRig.root.visible = alive;
  if (!alive || !fpRig.weaponData) return;

  const wData = fpRig.weaponData;
  const cat = wData.categoryPose;

  // 1. Smooth state blend alphas
  const targetAds =
    params.aiming && !params.reloading && params.switchTimer <= 0 ? 1 : 0;
  const targetSprint =
    params.sprinting &&
    !params.aiming &&
    !params.reloading &&
    params.grounded &&
    params.horizSpeed > 3.5
      ? 1
      : 0;
  const targetCrouch = params.crouching ? 1 : 0;

  fpRig.adsAlpha = THREE.MathUtils.damp(fpRig.adsAlpha, targetAds, 16, dt);
  fpRig.sprintAlpha = THREE.MathUtils.damp(
    fpRig.sprintAlpha,
    targetSprint,
    12,
    dt
  );
  fpRig.crouchAlpha = THREE.MathUtils.damp(
    fpRig.crouchAlpha,
    targetCrouch,
    12,
    dt
  );

  // 2. Category-specific Hip-Fire vs ADS vs Sprint base positions
  const hipPos =
    cat === 'pistol'
      ? { x: 0.19, y: -0.21, z: -0.38 }
      : cat === 'smg'
      ? { x: 0.21, y: -0.22, z: -0.42 }
      : cat === 'lmg_heavy'
      ? { x: 0.24, y: -0.25, z: -0.46 }
      : cat === 'sniper_shotgun'
      ? { x: 0.22, y: -0.22, z: -0.46 }
      : { x: 0.22, y: -0.23, z: -0.44 };

  // Sight-aligned ADS position places optical/iron sight directly at screen center (x = 0)
  const adsPos = {
    x: 0.0,
    y: -wData.sightOffsetY - 0.012,
    z: cat === 'pistol' ? -0.32 : cat === 'sniper_shotgun' ? -0.31 : -0.34,
  };

  // Sprint compact chest carry pose
  const sprintPos = {
    x: 0.11,
    y: -0.29,
    z: -0.38,
  };

  let baseX = THREE.MathUtils.lerp(hipPos.x, adsPos.x, fpRig.adsAlpha);
  let baseY = THREE.MathUtils.lerp(hipPos.y, adsPos.y, fpRig.adsAlpha);
  let baseZ = THREE.MathUtils.lerp(hipPos.z, adsPos.z, fpRig.adsAlpha);

  baseX = THREE.MathUtils.lerp(baseX, sprintPos.x, fpRig.sprintAlpha);
  baseY = THREE.MathUtils.lerp(baseY, sprintPos.y, fpRig.sprintAlpha);
  baseZ = THREE.MathUtils.lerp(baseZ, sprintPos.z, fpRig.sprintAlpha);

  // Subtle cant when crouching in hip-fire
  const crouchRoll = -0.08 * fpRig.crouchAlpha * (1 - fpRig.adsAlpha);

  let rotX = THREE.MathUtils.lerp(0, -0.18, fpRig.sprintAlpha);
  let rotY = THREE.MathUtils.lerp(0, 0.52, fpRig.sprintAlpha);
  let rotZ = THREE.MathUtils.lerp(crouchRoll, 0.24, fpRig.sprintAlpha);

  // Empty ammunition dry-fire trigger twitch
  if (params.emptyClickTimer && params.emptyClickTimer > 0) {
    const twitch = Math.sin(params.emptyClickTimer * Math.PI * 8) * 0.018;
    rotZ += twitch;
    baseZ += Math.abs(twitch) * 0.35;
  }

  // 3. Movement Bob (Distinct Idle breathing -> Walk -> Run -> Sprint)
  const swayScale = THREE.MathUtils.lerp(1.0, 0.2, fpRig.adsAlpha);
  let bobOffsetX = 0;
  let bobOffsetY = 0;
  let bobRoll = 0;

  if (params.grounded && params.horizSpeed > 0.35) {
    const isRunningPace = params.horizSpeed > 4.6;
    const freq = params.sprinting ? 11.5 : isRunningPace ? 8.6 : 6.2;
    fpRig.bobPhase += dt * freq * Math.min(1.4, params.horizSpeed / 7.5);
    const amp =
      Math.min(1.0, params.horizSpeed / 9.5) *
      (params.sprinting ? 0.022 : isRunningPace ? 0.013 : 0.0075) *
      swayScale;
    bobOffsetX = Math.cos(fpRig.bobPhase) * amp;
    bobOffsetY = Math.abs(Math.sin(fpRig.bobPhase * 2)) * amp * -1.15;
    bobRoll = Math.sin(fpRig.bobPhase) * amp * 1.4;
  } else {
    // Idle breathing
    fpRig.bobPhase += dt * 1.8;
    bobOffsetX = Math.cos(fpRig.bobPhase * 0.5) * 0.0022 * swayScale;
    bobOffsetY = Math.sin(fpRig.bobPhase) * 0.0032 * swayScale;
  }

  // 4. Rotational Look Sway & Jump/Landing Inertia
  fpRig.swayX = THREE.MathUtils.damp(
    fpRig.swayX,
    -params.lookDeltaX * 0.00045 * swayScale,
    12,
    dt
  );
  fpRig.swayY = THREE.MathUtils.damp(
    fpRig.swayY,
    params.lookDeltaY * 0.00045 * swayScale,
    12,
    dt
  );

  const airOffset = params.grounded
    ? 0
    : THREE.MathUtils.clamp(-params.vy * 0.0035, -0.032, 0.032);
  fpRig.jumpVelImpulse = THREE.MathUtils.damp(
    fpRig.jumpVelImpulse,
    airOffset,
    10,
    dt
  );
  fpRig.landDip = THREE.MathUtils.damp(fpRig.landDip, 0, 14, dt);

  // 5. Weapon Switch Holster & Draw Transition
  let switchDropY = 0;
  let switchPitchX = 0;
  if (params.switchTimer > 0 && params.switchDuration > 0) {
    const norm = params.switchTimer / params.switchDuration; // 1 -> 0
    const wave = Math.sin(norm * Math.PI);
    switchDropY = -0.26 * wave;
    switchPitchX = -0.55 * wave;
  }

  // 6. Default Hand Placement on Equipped Weapon (Right hand on grip, Left hand on forend)
  const rightHomePos = new THREE.Vector3(0.015, -0.11, -0.12);
  const rightHomeRot = new THREE.Euler(0.18, -0.08, 0);

  const leftHomePos =
    cat === 'pistol'
      ? new THREE.Vector3(-0.035, -0.115, -0.14)
      : cat === 'smg'
      ? new THREE.Vector3(-0.045, -0.085, -0.28)
      : cat === 'lmg_heavy'
      ? new THREE.Vector3(-0.06, -0.105, -0.34)
      : new THREE.Vector3(-0.048, -0.075, -0.34);
  const leftHomeRot =
    cat === 'pistol'
      ? new THREE.Euler(0.22, 0.28, -0.1)
      : new THREE.Euler(0.28, 0.36, -0.18);

  fpRig.rightArmGroup.position.copy(rightHomePos);
  fpRig.rightArmGroup.rotation.copy(rightHomeRot);
  fpRig.leftArmGroup.position.copy(leftHomePos);
  fpRig.leftArmGroup.rotation.copy(leftHomeRot);

  // Reset magazine and bolt to home before applying reload/firing excursions
  wData.magMesh.position.copy(wData.magHomePos);
  wData.magMesh.rotation.copy(wData.magHomeRot);
  wData.boltMesh.position.copy(wData.boltHomePos);

  // 7. Complete 5-Stage Per-Category Reload Choreography
  if (params.reloading) {
    const p = THREE.MathUtils.clamp(params.reloadProgress, 0, 1);

    // Stage envelope weights
    const inspectTilt =
      p < 0.16
        ? p / 0.16
        : p > 0.86
        ? Math.max(0, (1 - p) / 0.14)
        : 1.0;

    // Tilt weapon into reload inspection position (varies by weapon category)
    const tiltRoll = cat === 'pistol' ? -0.38 : cat === 'lmg_heavy' ? -0.25 : -0.46;
    const tiltPitch = cat === 'pistol' ? 0.22 : 0.18;
    const tiltYaw = cat === 'pistol' ? 0.18 : 0.26;

    rotX += tiltPitch * inspectTilt;
    rotY += tiltYaw * inspectTilt;
    rotZ += tiltRoll * inspectTilt;
    baseY += -0.035 * inspectTilt;
    baseX += -0.04 * inspectTilt;

    // Stage 2 & 3 (0.16 .. 0.68): Left support hand extracts empty magazine & seats fresh magazine
    if (p >= 0.14 && p < 0.70) {
      const magPhase = (p - 0.14) / 0.56; // 0..1
      // Outward/downward excursion peaks at magPhase = 0.5
      const pullCurve = Math.sin(magPhase * Math.PI);
      const dropDist = cat === 'pistol' ? 0.22 : cat === 'lmg_heavy' ? 0.26 : 0.28;

      wData.magMesh.position.y = wData.magHomePos.y - dropDist * pullCurve;
      wData.magMesh.position.x = wData.magHomePos.x - 0.05 * pullCurve;
      wData.magMesh.rotation.z = -0.35 * pullCurve;

      // Left hand tracks the magazine down to the pouch and back into the receiver
      fpRig.leftArmGroup.position.set(
        leftHomePos.x - 0.04 * pullCurve,
        leftHomePos.y - (dropDist * 0.85) * pullCurve,
        leftHomePos.z + 0.14 * Math.sin(Math.min(1, magPhase * 1.4) * Math.PI)
      );
      fpRig.leftArmGroup.rotation.x = leftHomeRot.x - 0.55 * pullCurve;
    } else if (p >= 0.70 && p < 0.88) {
      // Stage 4 (0.70 .. 0.88): Left hand reaches up to rack bolt / slide / charging handle
      const boltPhase = (p - 0.70) / 0.18; // 0..1
      const rackPulse = Math.sin(boltPhase * Math.PI);

      // Note: weaponData.group is rotated by Math.PI, so local -Z in builder is rearward
      wData.boltMesh.position.z = wData.boltHomePos.z - 0.095 * rackPulse;

      fpRig.leftArmGroup.position.set(
        leftHomePos.x + 0.03 * rackPulse,
        leftHomePos.y + 0.09 * rackPulse,
        leftHomePos.z + 0.16 * rackPulse
      );
      fpRig.leftArmGroup.rotation.z = leftHomeRot.z + 0.35 * rackPulse;

      // Subtle weapon rock as bolt slams home
      rotX -= 0.09 * rackPulse;
    }
  }

  // 8. Firing Recoil, Bolt Reciprocation & Muzzle Flash Decay
  fpRig.recoilZ = THREE.MathUtils.damp(fpRig.recoilZ, 0, 18, dt);
  fpRig.recoilPitch = THREE.MathUtils.damp(fpRig.recoilPitch, 0, 16, dt);
  fpRig.recoilRoll = THREE.MathUtils.damp(fpRig.recoilRoll, 0, 18, dt);

  if (fpRig.recoilZ > 0.002 && !params.reloading) {
    wData.boltMesh.position.z =
      wData.boltHomePos.z - Math.min(0.085, fpRig.recoilZ * 2.4);
  }

  if (fpRig.muzzleFlashTimer > 0) {
    fpRig.muzzleFlashTimer -= dt;
    wData.muzzleFlash.visible = fpRig.muzzleFlashTimer > 0;
    wData.muzzleFlash.rotation.z += dt * 45;
  } else {
    wData.muzzleFlash.visible = false;
  }

  // Apply composed transforms to poseGroup and recoilGroup
  fpRig.poseGroup.position.set(
    baseX + bobOffsetX + fpRig.swayX,
    baseY + bobOffsetY + fpRig.swayY + fpRig.jumpVelImpulse - fpRig.landDip + switchDropY,
    baseZ
  );
  fpRig.poseGroup.rotation.set(
    rotX + switchPitchX - fpRig.landDip * 1.8,
    rotY,
    rotZ + bobRoll
  );

  fpRig.recoilGroup.position.set(0, 0, fpRig.recoilZ);
  fpRig.recoilGroup.rotation.set(fpRig.recoilPitch, 0, fpRig.recoilRoll);
}

/**
 * Triggers a first-person firing impulse on the viewmodel rig.
 */
export function triggerFirstPersonFireImpulse(
  fpRig: FirstPersonRig,
  recoilKick: number,
  aiming: boolean
) {
  const mult = aiming ? 0.62 : 1.0;
  fpRig.recoilZ = Math.min(0.065, fpRig.recoilZ + (0.022 + recoilKick * 0.45) * mult);
  fpRig.recoilPitch = Math.min(
    0.16,
    fpRig.recoilPitch + (0.035 + recoilKick * 0.9) * mult
  );
  fpRig.recoilRoll = (Math.random() - 0.5) * 0.04 * mult;
  fpRig.muzzleFlashTimer = 0.042;
}

/**
 * Updates the visible 3D weapon attached to a 3rd-person AI SoldierRig without leaking old meshes.
 */
export function equipWeaponOnRig(
  rig: SoldierRig,
  weaponId: WeaponId,
  finishId: WeaponFinishId = 'default'
) {
  if (rig.equippedWeaponId === weaponId && rig.weaponSocket.children.length > 0) {
    return;
  }
  while (rig.weaponSocket.children.length > 0) {
    const child = rig.weaponSocket.children[0];
    child.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
        else m.material.dispose();
      }
    });
    rig.weaponSocket.remove(child);
  }

  const { group, muzzlePoint } = createWeaponMesh(weaponId, finishId);
  rig.weaponSocket.add(group);
  rig.muzzlePoint = muzzlePoint;
  rig.equippedWeaponId = weaponId;
}

/**
 * Builds an articulated 12-part WWII-inspired low-poly soldier rig pivoted at y = 0 for AI combatants.
 */
export function createSoldierModel(
  team: 'blue' | 'red',
  soldierClass: SoldierClassId = 'assault',
  initialWeapon: WeaponId = 'ar42_vanguard'
): SoldierRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const isBlue = team === 'blue';
  const baseTeamHex = isBlue ? 0x2563eb : 0xb91c1c;
  const uniformClothHex = isBlue ? 0x334155 : 0x3f3f46;
  const visorHex = isBlue ? 0x38bdf8 : 0xf87171;

  const armorMat = new THREE.MeshStandardMaterial({
    color: baseTeamHex,
    roughness: 0.52,
    metalness: 0.22,
  });

  const darkClothMat = new THREE.MeshStandardMaterial({
    color: uniformClothHex,
    roughness: 0.82,
    metalness: 0.06,
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.68,
    metalness: 0.15,
  });

  const gearWebbingMat = new THREE.MeshStandardMaterial({
    color: 0x57534e,
    roughness: 0.65,
    metalness: 0.25,
  });

  const visorMaterial = new THREE.MeshStandardMaterial({
    color: visorHex,
    emissive: visorHex,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.8,
  });

  const hitMeshes: THREE.Mesh[] = [];

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const createLeg = (sideOffset: number): THREE.Group => {
    const legGroup = new THREE.Group();
    legGroup.position.set(sideOffset, 0.76, 0);

    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.42, 0.24),
      darkClothMat
    );
    thigh.position.set(0, -0.21, 0);
    thigh.castShadow = true;
    legGroup.add(thigh);
    hitMeshes.push(thigh);

    const kneePad = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.13, 0.26),
      gearWebbingMat
    );
    kneePad.position.set(0, -0.4, 0.02);
    legGroup.add(kneePad);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.34, 0.3),
      bootMat
    );
    boot.position.set(0, -0.59, 0.02);
    boot.castShadow = true;
    legGroup.add(boot);
    hitMeshes.push(boot);

    return legGroup;
  };

  const leftLeg = createLeg(-0.16);
  const rightLeg = createLeg(0.16);
  bodyGroup.add(leftLeg, rightLeg);

  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.18, 0.33),
    gearWebbingMat
  );
  pelvis.position.set(0, 0.82, 0);
  bodyGroup.add(pelvis);

  const torsoWidth = soldierClass === 'support' ? 0.66 : 0.6;
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(torsoWidth, 0.58, 0.36),
    armorMat
  );
  torso.position.set(0, 1.18, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);
  hitMeshes.push(torso);

  const chestRig = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.36, 0.41),
    gearWebbingMat
  );
  chestRig.position.set(0, 1.18, 0);
  bodyGroup.add(chestRig);

  const packHeight = soldierClass === 'support' ? 0.54 : 0.42;
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, packHeight, 0.24),
    gearWebbingMat
  );
  backpack.position.set(0, 1.18, -0.26);
  backpack.castShadow = true;
  bodyGroup.add(backpack);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.48, 0);
  bodyGroup.add(headGroup);

  const headCube = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.36, 0.36),
    darkClothMat
  );
  headCube.position.set(0, 0.19, 0);
  headCube.castShadow = true;
  headCube.userData.isHead = true;
  headGroup.add(headCube);
  hitMeshes.push(headCube);

  const helmetBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.08, 10),
    armorMat
  );
  helmetBrim.position.set(0, 0.31, 0);
  helmetBrim.userData.isHead = true;
  headGroup.add(helmetBrim);

  const helmetDome = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.2, 0.42),
    armorMat
  );
  helmetDome.position.set(0, 0.36, 0);
  helmetDome.castShadow = true;
  helmetDome.userData.isHead = true;
  headGroup.add(helmetDome);
  hitMeshes.push(helmetDome);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.08),
    visorMaterial
  );
  visor.position.set(0, 0.21, 0.17);
  headGroup.add(visor);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.41, 1.38, 0);
  const leftPauldron = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.26),
    armorMat
  );
  const leftLimb = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.48, 0.17),
    darkClothMat
  );
  leftLimb.position.set(0.06, -0.18, 0.16);
  leftLimb.rotation.x = -Math.PI / 3;
  leftLimb.rotation.z = -0.25;
  leftArm.add(leftPauldron, leftLimb);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.41, 1.38, 0);
  const rightPauldron = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.26),
    armorMat
  );
  const rightLimb = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.46, 0.17),
    darkClothMat
  );
  rightLimb.position.set(-0.04, -0.16, 0.18);
  rightLimb.rotation.x = -Math.PI / 2.4;
  rightArm.add(rightPauldron, rightLimb);
  bodyGroup.add(rightArm);

  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(0.28, 1.22, 0.34);
  bodyGroup.add(weaponSocket);

  const { group: initialWeaponGroup, muzzlePoint } =
    createWeaponMesh(initialWeapon);
  weaponSocket.add(initialWeaponGroup);

  return {
    root,
    bodyGroup,
    headGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    weaponSocket,
    muzzlePoint,
    hitMeshes,
    teamMaterial: armorMat,
    visorMaterial,
    baseTeamColor: new THREE.Color(baseTeamHex),
    equippedWeaponId: initialWeapon,
  };
}

/**
 * Builds composite multi-part structures grounded at getTerrainHeight(s.x, s.z).
 * Includes architectural window frames, timber supports, bunker embrasures, and roofs.
 */
export function createStructureGroup(s: StructureCollider): THREE.Group {
  const group = new THREE.Group();
  const groundY = getTerrainHeight(s.x, s.z);
  group.position.set(s.x, groundY, s.z);

  const palette = {
    slate: { main: 0x475569, trim: 0x1e293b, accent: 0x38bdf8 },
    sand: { main: 0xa8a29e, trim: 0x57534e, accent: 0xf59e0b },
    steel: { main: 0x52525b, trim: 0x27272a, accent: 0x38bdf8 },
    accent: { main: 0x44403c, trim: 0x1c1917, accent: 0xf59e0b },
    brick: { main: 0x7c2d12, trim: 0x3f2e26, accent: 0xd97706 },
    wood: { main: 0x78350f, trim: 0x451a03, accent: 0xf59e0b },
    olive: { main: 0x3f6212, trim: 0x1a2e05, accent: 0x84cc16 },
  }[s.colorVariant || 'slate'];

  const mainMat = new THREE.MeshStandardMaterial({
    color: palette.main,
    roughness: 0.78,
    metalness: 0.14,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: palette.trim,
    roughness: 0.62,
    metalness: 0.28,
  });

  const darkRecessMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.9,
    metalness: 0.1,
  });

  if (s.type === 'tree_trunk') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(
        s.width * 0.28,
        s.width * 0.44,
        s.height * 0.55,
        7
      ),
      mainMat
    );
    trunk.position.y = s.height * 0.275;
    trunk.castShadow = true;
    group.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.85,
      metalness: 0.05,
    });
    for (let layer = 0; layer < 3; layer++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(3.7 - layer * 0.72, 3.5, 7),
        foliageMat
      );
      cone.position.y = s.height * 0.48 + layer * 1.9;
      cone.castShadow = true;
      group.add(cone);
    }
    return group;
  }

  if (s.type === 'truck_wreck') {
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(s.width, 0.72, s.depth),
      trimMat
    );
    chassis.position.y = 0.65;
    chassis.castShadow = true;
    group.add(chassis);

    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(s.width * 0.34, s.height - 0.7, s.depth * 0.92),
      mainMat
    );
    cab.position.set(-s.width * 0.28, 0.7 + (s.height - 0.7) * 0.5, 0);
    cab.castShadow = true;
    group.add(cab);

    const cargoBed = new THREE.Mesh(
      new THREE.BoxGeometry(
        s.width * 0.6,
        (s.height - 0.7) * 0.78,
        s.depth * 0.96
      ),
      mainMat
    );
    cargoBed.position.set(s.width * 0.18, 0.7 + (s.height - 0.7) * 0.39, 0);
    cargoBed.castShadow = true;
    group.add(cargoBed);

    // 4 low-poly wheels grounded at y=0.38
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 8);
    wheelGeo.rotateX(Math.PI / 2);
    for (const wx of [-s.width * 0.32, s.width * 0.28]) {
      for (const wz of [-s.depth * 0.48, s.depth * 0.48]) {
        const wMesh = new THREE.Mesh(wheelGeo, darkRecessMat);
        wMesh.position.set(wx, 0.42, wz);
        group.add(wMesh);
      }
    }
    return group;
  }

  const plinthHeight = Math.min(0.42, s.height * 0.14);
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(s.width, plinthHeight, s.depth),
    trimMat
  );
  plinth.position.y = plinthHeight * 0.5;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const coreHeight = Math.max(0.4, s.height - plinthHeight - 0.3);
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(s.width * 0.96, coreHeight, s.depth * 0.96),
    mainMat
  );
  core.position.y = plinthHeight + coreHeight * 0.5;
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  // Add architectural window frames / bunker firing slits for first-person visual depth
  if (
    s.type === 'village_house' ||
    s.type === 'ruined_hall' ||
    s.type === 'warehouse'
  ) {
    const winBand = new THREE.Mesh(
      new THREE.BoxGeometry(s.width * 0.98, 0.95, s.depth * 0.72),
      darkRecessMat
    );
    winBand.position.y = plinthHeight + coreHeight * 0.58;
    group.add(winBand);

    // Corner timber/stone pilasters
    for (const cx of [-0.46, 0.46]) {
      for (const cz of [-0.46, 0.46]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, coreHeight, 0.45),
          trimMat
        );
        pillar.position.set(
          cx * s.width,
          plinthHeight + coreHeight * 0.5,
          cz * s.depth
        );
        group.add(pillar);
      }
    }
  } else if (s.type === 'bunker' || s.type === 'tower') {
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(s.width * 0.99, 0.42, s.depth * 0.82),
      darkRecessMat
    );
    slit.position.y = s.height * 0.68;
    group.add(slit);
  }

  if (s.type === 'village_house') {
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(s.width, s.depth) * 0.68, 2.3, 4),
      trimMat
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = s.height + 0.85;
    roof.castShadow = true;
    group.add(roof);
  } else {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(s.width, 0.32, s.depth),
      trimMat
    );
    cap.position.y = s.height - 0.16;
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
  }

  return group;
}

/**
 * Builds the 500x500 G'arb Fronti — Temir Qishloq terrain mesh, river water surface,
 * walkable stone-and-timber bridge deck, wooden trench duckboards, and outer valley mountains.
 */
export function createBattlefieldEnvironment(
  maxAnisotropy: number
): THREE.Group {
  const envGroup = new THREE.Group();

  const size = ARENA_HALF_SIZE * 2;
  const segments = 120;
  const terrainGeo = new THREE.PlaneGeometry(size, size, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors: number[] = [];
  const c = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    let vy = getTerrainHeight(vx, vz);
    if (Math.abs(vz - 120) < 22 && Math.abs(vx) <= 12) {
      vy = -1.45 * Math.cos(((vz - 120) / 24) * (Math.PI * 0.5));
    }
    posAttr.setY(i, vy);

    if (vy < -0.6) {
      c.setHex(0x453829);
    } else if (Math.abs(vz) < 16 && vx > -145 && vx < 145) {
      c.setHex(0x574c3f);
    } else if (Math.abs(vx) < 11 && vz > -15 && vz < 160) {
      c.setHex(0x645b4f);
    } else if (Math.abs(vx) < 55 && Math.abs(vz) < 55) {
      c.setHex(0x52525b); // Village stone cobble tint
    } else if (vz < -75) {
      c.setHex(0x365314);
    } else {
      c.setHex(0x4d593c);
    }
    colors.push(c.r, c.g, c.b);
  }

  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const groundTex = createBattlefieldGroundTexture(maxAnisotropy);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.06,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  envGroup.add(terrainMesh);

  // 2. Southern River Water Surface (z = 120)
  const waterGeo = new THREE.PlaneGeometry(size, 34);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0c4a6e,
    roughness: 0.18,
    metalness: 0.65,
    transparent: true,
    opacity: 0.84,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, -0.78, 120);
  envGroup.add(waterMesh);

  // 3. Southern Traversable Stone & Timber Bridge Deck + Low Curbs
  const bridgeGroup = new THREE.Group();
  const bridgeMat = new THREE.MeshStandardMaterial({
    color: 0x57534e,
    roughness: 0.75,
    metalness: 0.2,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.8,
    metalness: 0.1,
  });

  const numPlanks = 24;
  for (let i = 0; i < numPlanks; i++) {
    const zPos = 97 + (i / (numPlanks - 1)) * 46;
    const yPos = getTerrainHeight(0, zPos);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(21, 0.45, 2.2), timberMat);
    seg.position.set(0, yPos - 0.2, zPos);
    seg.receiveShadow = true;
    seg.castShadow = true;
    bridgeGroup.add(seg);
  }
  for (const pierZ of [108, 120, 132]) {
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(22, 3.2, 2.4),
      bridgeMat
    );
    pier.position.set(0, -0.7, pierZ);
    bridgeGroup.add(pier);
  }
  envGroup.add(bridgeGroup);

  // 4. Western Trench Wooden Duckboards (visual planks along x = -126 and z = -12)
  const duckboardGeo = new THREE.BoxGeometry(2.6, 0.12, 3.2);
  const duckboardInst = new THREE.InstancedMesh(duckboardGeo, timberMat, 36);
  const dummy = new THREE.Object3D();
  let dbIdx = 0;
  for (let z = -44; z <= 38; z += 4.2) {
    if (dbIdx >= 36) break;
    dummy.position.set(-126, getTerrainHeight(-126, z) + 0.04, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    duckboardInst.setMatrixAt(dbIdx++, dummy.matrix);
  }
  for (let x = -152; x <= -92; x += 4.2) {
    if (dbIdx >= 36) break;
    dummy.position.set(x, getTerrainHeight(x, -12) + 0.04, -12);
    dummy.rotation.set(0, Math.PI / 2, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    duckboardInst.setMatrixAt(dbIdx++, dummy.matrix);
  }
  duckboardInst.instanceMatrix.needsUpdate = true;
  envGroup.add(duckboardInst);

  // 5. Instanced Northern Woodland Trees & Perimeter Rocks
  const treeTrunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 4.5, 6);
  const treeFoliageGeo = new THREE.ConeGeometry(2.8, 6.5, 6);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.9,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x1e3f20,
    roughness: 0.85,
  });

  const treeCount = 90;
  const instancedTrunks = new THREE.InstancedMesh(
    treeTrunkGeo,
    trunkMat,
    treeCount
  );
  const instancedLeaves = new THREE.InstancedMesh(
    treeFoliageGeo,
    leafMat,
    treeCount
  );

  for (let i = 0; i < treeCount; i++) {
    const tx = -210 + ((i * 47) % 420);
    const tz = -108 - ((i * 31) % 115);
    const ty = getTerrainHeight(tx, tz);
    const scale = 0.85 + (i % 5) * 0.12;

    dummy.position.set(tx, ty + 2.2 * scale, tz);
    dummy.rotation.set(0, (i * 1.1) % Math.PI, 0);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    instancedTrunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, ty + 5.8 * scale, tz);
    dummy.updateMatrix();
    instancedLeaves.setMatrixAt(i, dummy.matrix);
  }
  instancedTrunks.instanceMatrix.needsUpdate = true;
  instancedLeaves.instanceMatrix.needsUpdate = true;
  instancedTrunks.computeBoundingSphere();
  instancedLeaves.computeBoundingSphere();
  envGroup.add(instancedTrunks, instancedLeaves);

  // Outer perimeter mountain ridge silhouettes
  const rockCount = 64;
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x44403c,
    roughness: 0.9,
    metalness: 0.08,
  });
  const rockInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2;
    const dist = ARENA_HALF_SIZE + 18 + (i % 3) * 12;
    const sx = 14 + (i % 5) * 4;
    const sy = 12 + (i % 4) * 6;
    const sz = 14 + ((i + 2) % 5) * 4;

    dummy.position.set(
      Math.cos(angle) * dist,
      sy * 0.35,
      Math.sin(angle) * dist
    );
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rockInstanced.setMatrixAt(i, dummy.matrix);
  }
  rockInstanced.instanceMatrix.needsUpdate = true;
  rockInstanced.computeBoundingSphere();
  envGroup.add(rockInstanced);

  return envGroup;
}

/**
 * Builds an Objective Control Point Beacon & Animated Flag grounded at getTerrainHeight(obj.x, obj.z).
 */
export function createObjectiveBeacon(obj: ObjectiveState): ObjectiveRig {
  const group = new THREE.Group();
  const baseY = getTerrainHeight(obj.x, obj.z);
  group.position.set(obj.x, baseY, obj.z);

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.5,
    metalness: 0.65,
  });

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const ringGeo = new THREE.RingGeometry(obj.radius - 0.45, obj.radius, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.25;
  group.add(ringMesh);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.6, 0.4, 8),
    baseMat
  );
  pedestal.position.y = 0.2;
  group.add(pedestal);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 8.5, 8),
    baseMat
  );
  pole.position.y = 4.25;
  pole.castShadow = true;
  group.add(pole);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.5,
  });

  const flagMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.35, 0.08),
    coreMat
  );
  flagMesh.position.set(1.2, 7.4, 0);
  flagMesh.castShadow = true;
  group.add(flagMesh);

  const coreMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    coreMat
  );
  coreMesh.position.y = 8.9;
  group.add(coreMesh);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.85, 22, 12, 1, true),
    beamMat
  );
  beamMesh.position.y = 11.0;
  group.add(beamMesh);

  return { group, ringMat, coreMesh, coreMat, beamMat, flagMesh };
}

/**
 * Creates a lightweight 3D mesh for dynamic physics props (barrels and small field crates).
 */
export function createDynamicPropMesh(kind: 'barrel' | 'small_crate'): THREE.Group {
  const group = new THREE.Group();
  if (kind === 'barrel') {
    const drumMat = new THREE.MeshStandardMaterial({
      color: 0x365314,
      roughness: 0.55,
      metalness: 0.45,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.65,
    });
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 1.12, 12),
      drumMat
    );
    drum.position.y = 0.56;
    drum.castShadow = true;
    drum.receiveShadow = true;

    const ringTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.07, 12),
      bandMat
    );
    ringTop.position.y = 0.88;
    const ringBot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.07, 12),
      bandMat
    );
    ringBot.position.y = 0.26;
    group.add(drum, ringTop, ringBot);
  } else {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.82,
      metalness: 0.08,
    });
    const strapMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.55,
    });
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.78, 0.85),
      woodMat
    );
    box.position.y = 0.39;
    box.castShadow = true;
    box.receiveShadow = true;

    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.12, 0.88),
      strapMat
    );
    strap.position.y = 0.39;
    group.add(box, strap);
  }
  return group;
}

