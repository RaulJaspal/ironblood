// Stage construction: HDRI environment, PBR floor, cinematic lighting, props.
import * as THREE from 'three';
import { loadHDRI, loadFloorSet } from './assets.js';

export async function buildStage(scene, renderer, stageCfg) {
  const group = new THREE.Group();
  group.name = 'stage';

  const [hdri, floor] = await Promise.all([
    loadHDRI(stageCfg.hdri),
    loadFloorSet(stageCfg.floor),
  ]);

  scene.environment = hdri;
  scene.environmentIntensity = stageCfg.envIntensity;
  scene.background = hdri;
  scene.backgroundIntensity = stageCfg.bgIntensity ?? stageCfg.envIntensity * 0.85;
  scene.backgroundBlurriness = 0.0;
  scene.fog = new THREE.FogExp2(stageCfg.fog, stageCfg.fogDensity);

  // floor
  const rep = stageCfg.floorRepeat;
  for (const t of [floor.diff, floor.nor, floor.rough]) t.repeat.set(rep, rep);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floor.diff, normalMap: floor.nor, roughnessMap: floor.rough,
    roughness: 1.0, metalness: 0.02,
  });
  const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(24, 48), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // fight-zone ring marking (subtle emissive circle)
  const ringGeo = new THREE.RingGeometry(6.1, 6.35, 96);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  group.add(ring);

  // lighting
  const key = new THREE.DirectionalLight(stageCfg.key.color, stageCfg.key.intensity);
  key.position.set(...stageCfg.key.pos);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 25;
  key.shadow.bias = -0.0015;
  key.shadow.radius = 4;
  group.add(key);

  const rim = new THREE.DirectionalLight(stageCfg.rim.color, stageCfg.rim.intensity);
  rim.position.set(...stageCfg.rim.pos);
  group.add(rim);

  const fill = new THREE.DirectionalLight(stageCfg.fill.color, stageCfg.fill.intensity);
  fill.position.set(...stageCfg.fill.pos);
  group.add(fill);

  const hemi = new THREE.HemisphereLight(0x8899bb, 0x221a14, 0.35);
  group.add(hemi);

  // corner accent point lights (arena vibe)
  const accents = [
    [-6.5, 2.4, -3, stageCfg.rim.color, 6],
    [6.5, 2.4, -3, stageCfg.key.color, 6],
  ];
  for (const [x, y, z, color, intensity] of accents) {
    const pl = new THREE.PointLight(color, intensity, 14, 1.8);
    pl.position.set(x, y, z);
    group.add(pl);
  }

  addProps(group, stageCfg);
  addDustMotes(group, stageCfg);

  scene.add(group);
  return group;
}

// Simple silhouette props to ground the arena (kept dark; HDRI carries the look)
function addProps(group, stageCfg) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.9, metalness: 0.3 });

  if (stageCfg.props === 'pit') {
    // chain-link style pillars around the ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 8), dark);
      post.position.set(Math.cos(a) * 7.2, 1.7, Math.sin(a) * 7.2);
      post.castShadow = true;
      group.add(post);
      const lampGeo = new THREE.SphereGeometry(0.09, 8, 8);
      const lamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xffaa66 }));
      lamp.position.set(Math.cos(a) * 7.2, 3.45, Math.sin(a) * 7.2);
      group.add(lamp);
    }
  } else if (stageCfg.props === 'metro') {
    // overhead beam + hanging light cones
    const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 0.5), dark);
    beam.position.set(0, 4.4, -1.5);
    group.add(beam);
    for (let x = -6; x <= 6; x += 4) {
      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.4, 0.35, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x222228, emissive: 0x66ffee, emissiveIntensity: 0.7, side: THREE.DoubleSide })
      );
      cone.position.set(x, 4.15, -1.5);
      group.add(cone);
    }
  } else if (stageCfg.props === 'court') {
    // broken columns
    for (const [x, z, h] of [[-6.8, -2.5, 2.6], [6.8, -2.8, 3.2], [-5.5, -4.5, 1.6], [5.2, -4.8, 2.1]]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, h, 12), new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.85 }));
      col.position.set(x, h / 2, z);
      col.castShadow = true;
      group.add(col);
    }
  }
}

function addDustMotes(group, stageCfg) {
  const count = 220;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = Math.random() * 4 + 0.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffcc, size: 0.02, transparent: true, opacity: 0.35,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'dust';
  points.userData.update = (t) => {
    points.rotation.y = t * 0.01;
    points.position.y = Math.sin(t * 0.3) * 0.1;
  };
  group.add(points);
}
