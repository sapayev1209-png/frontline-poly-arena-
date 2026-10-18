import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  ASSET_MANIFEST,
  AssetManifestEntry,
  CharacterClipState,
  getAssetManifestEntry,
} from './assetRegistry';
import { GraphicsQuality } from '../types/game';

export interface LoadedGltfTemplate {
  assetId: string;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface AssetLoaderDiagnostics {
  cachedCount: number;
  errorCount: number;
  lastError: string | null;
}

class CentralAssetLoader {
  private gltfLoader: GLTFLoader | null = null;
  private cache: Map<string, LoadedGltfTemplate> = new Map();
  private inFlight: Map<string, Promise<LoadedGltfTemplate | null>> = new Map();
  private loadErrors: Map<string, string> = new Map();

  private getLoader(): GLTFLoader {
    if (!this.gltfLoader) {
      this.gltfLoader = new GLTFLoader();
    }
    return this.gltfLoader;
  }

  public getDiagnostics(): AssetLoaderDiagnostics {
    const errors = Array.from(this.loadErrors.values());
    return {
      cachedCount: this.cache.size,
      errorCount: this.loadErrors.size,
      lastError: errors.length > 0 ? errors[errors.length - 1] : null,
    };
  }

  public clearRuntimeErrors() {
    this.loadErrors.clear();
  }

  /**
   * Resolves the appropriate file path for an asset entry taking graphics quality LOD into account.
   */
  public resolveAssetPath(
    entry: AssetManifestEntry,
    quality: GraphicsQuality = 'medium'
  ): string {
    if (entry.lodPaths) {
      if (quality === 'low' && entry.lodPaths.low) return entry.lodPaths.low;
      if (quality === 'high' && entry.lodPaths.high) return entry.lodPaths.high;
      if (entry.lodPaths.medium) return entry.lodPaths.medium;
    }
    return entry.localPath;
  }

  /**
   * Asynchronously loads a GLB/glTF asset if `entry.useExternalAsset` is enabled.
   * If `useExternalAsset` is false or loading fails, returns `null` so the caller uses
   * its procedural fallback model without blocking gameplay.
   */
  public async loadGltfTemplate(
    assetId: string,
    quality: GraphicsQuality = 'medium'
  ): Promise<LoadedGltfTemplate | null> {
    const entry = getAssetManifestEntry(assetId);
    if (!entry) {
      this.loadErrors.set(assetId, `Not found in ASSET_MANIFEST: ${assetId}`);
      return null;
    }

    if (!entry.useExternalAsset || entry.format === 'procedural') {
      return null;
    }

    const cacheKey = `${assetId}_${quality}`;
    const existing = this.cache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const path = this.resolveAssetPath(entry, quality);

    const promise = new Promise<LoadedGltfTemplate | null>((resolve) => {
      try {
        this.getLoader().load(
          path,
          (gltf: GLTF) => {
            const template: LoadedGltfTemplate = {
              assetId,
              scene: gltf.scene,
              animations: gltf.animations || [],
            };
            this.cache.set(cacheKey, template);
            this.inFlight.delete(cacheKey);
            resolve(template);
          },
          undefined,
          (err: unknown) => {
            const msg =
              err instanceof Error ? err.message : `Failed to load ${path}`;
            this.loadErrors.set(assetId, `${assetId}: ${msg}`);
            this.inFlight.delete(cacheKey);
            resolve(null);
          }
        );
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : `Exception loading ${path}`;
        this.loadErrors.set(assetId, `${assetId}: ${msg}`);
        this.inFlight.delete(cacheKey);
        resolve(null);
      }
    });

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  /**
   * Instantiates an asset by ID:
   * - Always returns the procedural fallback synchronously so gameplay never stalls.
   * - If `entry.useExternalAsset === true`, loads the GLB/glTF template in the background
   *   (or clones it immediately from cache using `SkeletonUtils.clone`) and swaps it into
   *   the container group while preserving documented scale and root offset conventions.
   */
  public instantiateWithFallback(
    assetId: string,
    proceduralFactory: () => THREE.Group,
    quality: GraphicsQuality = 'medium',
    onExternalSwapped?: (instance: THREE.Group, clips: THREE.AnimationClip[]) => void
  ): THREE.Group {
    const entry = ASSET_MANIFEST[assetId];
    const fallbackGroup = proceduralFactory();

    if (!entry || !entry.useExternalAsset) {
      return fallbackGroup;
    }

    const cacheKey = `${assetId}_${quality}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const cloned = this.cloneTemplateInstance(cached, entry);
      if (onExternalSwapped) {
        onExternalSwapped(cloned, cached.animations);
      }
      return cloned;
    }

    // Return procedural immediately and swap in place once GLB finishes loading
    const container = fallbackGroup;
    this.loadGltfTemplate(assetId, quality).then((loaded) => {
      if (!loaded) return;
      const cloned = this.cloneTemplateInstance(loaded, entry);
      while (container.children.length > 0) {
        container.remove(container.children[0]);
      }
      container.add(cloned);
      if (onExternalSwapped) {
        onExternalSwapped(cloned, loaded.animations);
      }
    });

    return container;
  }

  private cloneTemplateInstance(
    template: LoadedGltfTemplate,
    entry: AssetManifestEntry
  ): THREE.Group {
    const clonedRoot = SkeletonUtils.clone(template.scene) as THREE.Group;
    clonedRoot.scale.set(
      entry.defaultScale[0],
      entry.defaultScale[1],
      entry.defaultScale[2]
    );
    clonedRoot.position.set(
      entry.rootOffset[0],
      entry.rootOffset[1],
      entry.rootOffset[2]
    );
    clonedRoot.rotation.set(
      entry.rootRotationEuler[0],
      entry.rootRotationEuler[1],
      entry.rootRotationEuler[2]
    );
    return clonedRoot;
  }
}

export const assetLoader = new CentralAssetLoader();

/**
 * Adapter that bridges external glTF character AnimationClips (`AnimationMixer`)
 * with procedural limb fallback so any character model works even if clips are missing.
 */
export class CharacterAnimationAdapter {
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<CharacterClipState, THREE.AnimationAction> = new Map();
  private activeState: CharacterClipState | null = null;

  constructor(
    root: THREE.Object3D,
    clips: THREE.AnimationClip[] = [],
    clipMapping?: Partial<Record<CharacterClipState, string>>
  ) {
    if (clips.length > 0 && clipMapping) {
      this.mixer = new THREE.AnimationMixer(root);
      for (const [state, clipName] of Object.entries(clipMapping) as Array<
        [CharacterClipState, string]
      >) {
        const found = THREE.AnimationClip.findByName(clips, clipName);
        if (found) {
          this.actions.set(state, this.mixer.clipAction(found));
        }
      }
    }
  }

  public hasClip(state: CharacterClipState): boolean {
    return this.actions.has(state);
  }

  public transitionTo(state: CharacterClipState, fadeSeconds = 0.15): boolean {
    const nextAction = this.actions.get(state);
    if (!nextAction) return false;

    if (this.activeState === state) return true;

    const prevAction = this.activeState
      ? this.actions.get(this.activeState)
      : null;
    nextAction.reset().play();
    if (prevAction) {
      prevAction.crossFadeTo(nextAction, fadeSeconds, false);
    }
    this.activeState = state;
    return true;
  }

  public update(dt: number) {
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }
}
