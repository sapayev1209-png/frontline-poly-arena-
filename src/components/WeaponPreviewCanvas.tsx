import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createWeaponMesh } from '../game/models';
import { WeaponFinishId, WeaponId } from '../types/game';

interface WeaponPreviewCanvasProps {
  weaponId: WeaponId;
  finishId?: WeaponFinishId;
}

export const WeaponPreviewCanvas: React.FC<WeaponPreviewCanvasProps> = ({
  weaponId,
  finishId = 'default',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const weaponGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      alpha: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(
      isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(
      container.clientWidth || 380,
      container.clientHeight || 200
    );
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || 380) /
        Math.max(1, container.clientHeight || 200),
      0.05,
      20
    );
    camera.position.set(0.82, 0.28, 0.82);
    camera.lookAt(0, 0, 0.05);

    const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.5);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.6);
    keyLight.position.set(2, 3, 2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-2, 1, -2);
    scene.add(rimLight);

    const ringGeo = new THREE.RingGeometry(0.42, 0.45, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = -0.22;
    scene.add(ringMesh);

    let rafId = 0;
    let last = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (weaponGroupRef.current) {
        weaponGroupRef.current.rotation.y += dt * 0.85;
      }
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(animate);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 380;
      const h = Math.max(1, container.clientHeight || 200);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (weaponGroupRef.current) {
      scene.remove(weaponGroupRef.current);
      weaponGroupRef.current.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material))
            m.material.forEach((mt) => mt.dispose());
          else m.material.dispose();
        }
      });
    }

    const { group } = createWeaponMesh(weaponId, finishId);
    group.scale.setScalar(1.18);
    group.rotation.y = -Math.PI / 4;
    scene.add(group);
    weaponGroupRef.current = group;
  }, [weaponId, finishId]);

  return (
    <div
      ref={mountRef}
      className="w-full h-44 sm:h-52 rounded-lg bg-slate-950/90 border border-slate-800 relative overflow-hidden"
    />
  );
};
