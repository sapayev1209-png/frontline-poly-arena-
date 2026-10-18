import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  ASSET_MANIFEST,
  AssetManifestEntry,
  isAssetLicenseVerified,
} from './assetRegistry';
import {
  SoldierRig,
  WeaponMeshResult,
  createSoldierModel,
  createStructureGroup,
  createWeaponMesh,
} from '../game/models';
import {
  SoldierClassId,
  StructureCollider,
  WeaponFinishId,
  WeaponId,
} from '../types/game';

/**
 * Centralized 3D Asset Loader & Adapter Service (Section 8.4).
 * - Caches loaded GLTF/GLB assets so models are never fetched twice.
 * - Verifies license status before loading external assets.
 * - Automatically falls back to the procedural geometry builders in `src/game/models.ts`
 *   when `sourceMode === 'procedural-fallback'` or if an external `.glb` fails to load.
 * - Tracks load errors for real-time inspection in the F3 Diagnostics overlay.
 */
class AssetLoaderManager {
  private gltfLoader: GLTFLoader;
  private cache: Map<string, GLTF> = new Map();
  private inFlight: Map<string, Promise<GLTF | null>> = new Map();
  private loadErrors: string[] = [];

  constructor() {
    this.gltfLoader = new GLTFLoader();
    try {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/assets/decoders/draco/');
      this.gltfLoader.setDRACOLoader(dracoLoader);
    } catch {
      // Optional Draco decoder initialization; non-compressed GLBs work without it
    }
  }

  public getLoadErrors(): string[] {
    return [...this.loadErrors];
  }

  public clearLoadErrors() {
    this.loadErrors = [];
  }

  public getPipelineModeSummary(): string {
    const entries = Object.values(ASSET_MANIFEST);
    const extCount = entries.filter((e) => e.sourceMode === 'external-glb').length;
    if (extCount === 0) {
      return `PROCEDURAL-FALLBACK (${entries.length} REGISTR)`;
    }
    return `HYBRID (${extCount} GLB / ${entries.length - extCount} PROC)`;
  }

  /**
   * Loads and caches an external GLB/glTF asset if configured and license-verified.
   * Returns null (triggering procedural fallback) if missing or set to procedural mode.
   */
  public async preloadExternalAsset(assetId: string): Promise<GLTF | null> {
    const entry: AssetManifestEntry | undefined = ASSET_MANIFEST[assetId];
    if (!entry || entry.sourceMode === 'procedural-fallback') {
      return null;
    }

    if (!isAssetLicenseVerified(entry)) {
      this.recordError(
        `[${assetId}] Litsenziya tasdiqlanmagan (${entry.license.verificationStatus})`
      );
      return null;
    }

    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }
    if (this.inFlight.has(assetId)) {
      return this.inFlight.get(assetId)!;
    }

    const promise = new Promise<GLTF | null>((resolve) => {
      this.gltfLoader.load(
        entry.localPath,
        (gltf) => {
          this.cache.set(assetId, gltf);
          this.inFlight.delete(assetId);
          resolve(gltf);
        },
        undefined,
        () => {
          this.recordError(
            `[${assetId}] GLB yuklanmadi (${entry.localPath}) -> Procedural fallback`
          );
          this.inFlight.delete(assetId);
          resolve(null);
        }
      );
    });

    this.inFlight.set(assetId, promise);
    return promise;
  }

  /**
   * Builds a weapon model by stable `weaponId`, using a cached external GLB if available
   * and verified, or seamlessly falling back to `createWeaponMesh`.
   */
  public buildWeaponInstance(
    weaponId: WeaponId,
    finishId: WeaponFinishId = 'default'
  ): WeaponMeshResult {
    const assetId = `weapon_${weaponId}`;
    const entry = ASSET_MANIFEST[assetId];
    const cached = entry ? this.cache.get(assetId) : undefined;

    // Always construct the authoritative procedural weapon structure first so
    // magMesh, boltMesh, muzzlePoint, and muzzleFlash sockets are guaranteed to exist
    const baseWeapon = createWeaponMesh(weaponId, finishId);

    if (cached && entry && entry.sourceMode === 'external-glb') {
      const clonedScene = cached.scene.clone(true);
      clonedScene.scale.set(...entry.defaultScale);
      clonedScene.position.set(...entry.rootOffset);
      clonedScene.rotation.set(...entry.rootRotationEuler);
      baseWeapon.group.add(clonedScene);
    }

    return baseWeapon;
  }

  /**
   * Builds a third-person soldier rig for AI combatants, applying external GLB visual meshes
   * if cached, or using the procedural articulated soldier model.
   */
  public buildSoldierInstance(
    team: 'blue' | 'red',
    weaponId: WeaponId,
    soldierClass: SoldierClassId = 'assault',
    _finishId: WeaponFinishId = 'default'
  ): SoldierRig {
    const rig = createSoldierModel(team, soldierClass, weaponId);
    const assetId = `soldier_${soldierClass}`;
    const entry = ASSET_MANIFEST[assetId];
    const cached = entry ? this.cache.get(assetId) : undefined;

    if (cached && entry && entry.sourceMode === 'external-glb') {
      const cloned = cached.scene.clone(true);
      cloned.scale.set(...entry.defaultScale);
      cloned.position.set(...entry.rootOffset);
      rig.bodyGroup.add(cloned);
    }

    return rig;
  }

  /**
   * Builds a battlefield structure visual group while keeping gameplay AABB collisions
   * and objective coordinates strictly decoupled from visual geometry (Section 9).
   */
  public buildStructureInstance(collider: StructureCollider): THREE.Group {
    const group = createStructureGroup(collider);
    const assetId = collider.assetId || `env_${collider.type}`;
    const entry = ASSET_MANIFEST[assetId];
    const cached = entry ? this.cache.get(assetId) : undefined;

    if (cached && entry && entry.sourceMode === 'external-glb') {
      const cloned = cached.scene.clone(true);
      cloned.scale.set(...entry.defaultScale);
      cloned.position.set(...entry.rootOffset);
      cloned.rotation.set(...entry.rootRotationEuler);
      group.add(cloned);
    }

    return group;
  }

  private recordError(msg: string) {
    if (!this.loadErrors.includes(msg)) {
      this.loadErrors.push(msg);
      if (this.loadErrors.length > 8) {
        this.loadErrors.shift();
      }
    }
  }
}

export const assetLoader = new AssetLoaderManager();
