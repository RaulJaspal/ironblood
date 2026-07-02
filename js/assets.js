// Asset manager: caches character GLBs, animation sets, HDRIs, floor textures.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const gltfLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();
const texLoader = new THREE.TextureLoader();

const cache = new Map();

async function once(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export function loadCharacter(id) {
  return once(`char:${id}`, () => gltfLoader.loadAsync(`assets/characters/${id}.glb`));
}

export function loadAnims(gender) {
  return once(`anims:${gender}`, async () => {
    const gltf = await gltfLoader.loadAsync(`assets/anims/anims_${gender}.glb`);
    const clips = new Map();
    for (const clip of gltf.animations) clips.set(clip.name, clip);
    return clips;
  });
}

export function loadHDRI(path) {
  return once(`hdri:${path}`, async () => {
    const tex = await rgbeLoader.loadAsync(path);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  });
}

export function loadFloorSet(slug) {
  return once(`floor:${slug}`, async () => {
    const [diff, nor, rough] = await Promise.all([
      texLoader.loadAsync(`assets/env/${slug}_diff_1k.jpg`),
      texLoader.loadAsync(`assets/env/${slug}_nor_gl_1k.jpg`),
      texLoader.loadAsync(`assets/env/${slug}_rough_1k.jpg`),
    ]);
    diff.colorSpace = THREE.SRGBColorSpace;
    for (const t of [diff, nor, rough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
    return { diff, nor, rough };
  });
}

// Instantiate a fresh skinned character scene (clone via SkeletonUtils-style deep clone)
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

import { applyCostume } from './costumes.js';

export async function instantiateCharacter(id) {
  const gltf = await loadCharacter(id);
  const scene = skeletonClone(gltf.scene);
  scene.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false; // skinned bounds are unreliable mid-animation
      // per-instance materials so freeze tints / teleport fades never leak
      // across fighters (mirror matches share the base GLTF materials)
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    }
  });
  applyCostume(scene, id);
  return scene;
}
