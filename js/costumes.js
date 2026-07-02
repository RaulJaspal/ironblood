// Costume accessories positioned from *measured* bind-pose bone coordinates
// (probed offline from the skeleton: eyes ±0.032,1.686,0.094; head bone at
// y=1.587; hand at ±0.588,1.046,0.081 ...) then re-parented onto bones with
// Object3D.attach() so they follow the animation.
import * as THREE from 'three';

const M = {
  clothRed: () => new THREE.MeshStandardMaterial({ color: 0xbb1f1f, roughness: 0.85 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd8a838, roughness: 0.3, metalness: 0.95 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0x555c66, roughness: 0.35, metalness: 0.9 }),
  darkSteel: () => new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.4, metalness: 0.85 }),
  ice: () => new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.6, emissive: 0x1a4a66, emissiveIntensity: 0.5 }),
  glow: (color, intensity = 2.2) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.4 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.08, metalness: 0.9 }),
};

// attach in bind-pose world space. offset = [x,y,z] from the bone's bind world
// position. Either `rot` (world euler) or `align` (unit dir the mesh's +Y axis
// should point along; for rings the +Z normal) orients the mesh.
function attachW(root, boneName, mesh, offset = [0, 0, 0], { rot = null, alignY = null, alignZ = null } = {}) {
  const bone = root.getObjectByName(boneName);
  if (!bone) { console.warn('costume: bone missing', boneName); return null; }
  const p = bone.getWorldPosition(new THREE.Vector3());
  mesh.position.set(p.x + offset[0], p.y + offset[1], p.z + offset[2]);
  if (rot) mesh.rotation.set(...rot);
  if (alignY) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...alignY).normalize());
  if (alignZ) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...alignZ).normalize());
  mesh.castShadow = true;
  bone.add(mesh); // temporary: attach computes proper local transform
  bone.remove(mesh);
  bone.attach(mesh);
  return mesh;
}

// bind-pose direction along the left forearm (elbow -> wrist); mirror x for right
const FOREARM_DIR = [0.63, -0.67, 0.37];

const COSTUMES = {
  // KANE — Ryu vibes: red forehead band + tails, red fist wraps
  brawler(root) {
    const band = M.clothRed();
    attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.102, 0.04, 20, 1, true), band), [0, 0.152, 0.018]);
    for (const dx of [-0.022, 0.022]) {
      attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.19, 0.01), band), [dx, 0.05, -0.085], { rot: [0.4, 0, dx > 0 ? -0.28 : 0.28] });
    }
    for (const s of [1, -1]) {
      attachW(root, s > 0 ? 'Bip01_L_Hand' : 'Bip01_R_Hand', new THREE.Mesh(new THREE.SphereGeometry(0.057, 12, 10), M.clothRed()), [s * 0.045, -0.055, 0.025]);
      attachW(root, s > 0 ? 'Bip01_L_Forearm' : 'Bip01_R_Forearm', new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.11, 12, 1, true), M.clothRed()), [s * 0.13, -0.14, 0.075], { alignY: [s * FOREARM_DIR[0], FOREARM_DIR[1], FOREARM_DIR[2]] });
    }
  },

  // DANTE — street king: gold chain + glowing knuckle gauntlets
  street(root) {
    attachW(root, 'Bip01_Spine2', new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.013, 10, 26), M.gold()), [0, 0.12, 0.115], { rot: [1.25, 0, 0] });
    attachW(root, 'Bip01_Spine2', new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.01, 6), M.gold()), [0, 0.06, 0.165], { rot: [Math.PI / 2, 0, 0] });
    for (const s of [1, -1]) {
      const fb = s > 0 ? 'Bip01_L_Forearm' : 'Bip01_R_Forearm';
      const dir = [s * FOREARM_DIR[0], FOREARM_DIR[1], FOREARM_DIR[2]];
      attachW(root, fb, new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.054, 0.1, 12), M.darkSteel()), [s * 0.125, -0.135, 0.07], { alignY: dir });
      attachW(root, fb, new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 8, 18), M.glow(0xff8822)), [s * 0.145, -0.155, 0.082], { alignZ: dir });
    }
  },

  // SGT. STONE — spec-ops: dark shoulder domes + tactical eye piece
  soldier_m(root) {
    for (const s of [1, -1]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.086, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), M.darkSteel());
      attachW(root, s > 0 ? 'Bip01_L_UpperArm' : 'Bip01_R_UpperArm', dome, [s * 0.02, 0.05, 0], { rot: [0, 0, s * -0.35] });
    }
    attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.02), M.glow(0x44ff77, 1.6)), [0.045, 0.1, 0.098]);
  },

  // VALKYRIE — war machine: glowing cyan visor + pauldrons
  soldier_f(root) {
    attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.02), M.glow(0x33eeff, 2.6)), [0, 0.1, 0.096]);
    for (const s of [1, -1]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), M.steel());
      attachW(root, s > 0 ? 'Bip01_L_UpperArm' : 'Bip01_R_UpperArm', dome, [s * 0.02, 0.05, 0], { rot: [0, 0, s * -0.35] });
    }
  },

  // MAYA — huntress: gold bracers, armbands, circlet with gem
  heroine(root) {
    for (const s of [1, -1]) {
      const fb = s > 0 ? 'Bip01_L_Forearm' : 'Bip01_R_Forearm';
      const dir = [s * FOREARM_DIR[0], FOREARM_DIR[1], FOREARM_DIR[2]];
      attachW(root, fb, new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.049, 0.13, 12, 1, true), M.gold()), [s * 0.12, -0.13, 0.07], { alignY: dir });
      attachW(root, s > 0 ? 'Bip01_L_UpperArm' : 'Bip01_R_UpperArm', new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.009, 8, 18), M.gold()), [s * 0.08, -0.075, 0], { alignZ: [s * 0.72, -0.69, 0.02] });
    }
    attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.008, 8, 26), M.gold()), [0, 0.148, 0.015], { rot: [Math.PI / 2 + 0.05, 0, 0] });
    attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), M.glow(0xffcc44, 1.8)), [0, 0.148, 0.108]);
  },

  // MR. SLATE — syndicate: cyber shades with red glow edge
  agent(root) {
    attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.034, 0.016), M.glass()), [0, 0.099, 0.1]);
    attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.BoxGeometry(0.133, 0.006, 0.017), M.glow(0xff2233, 2.2)), [0, 0.114, 0.1]);
    for (const dx of [-0.066, 0.066]) {
      attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.09), M.glass()), [dx, 0.099, 0.05]);
    }
  },

  // DOZER — demolition: heavy pauldrons + metal jaw guard
  bruiser(root) {
    for (const s of [1, -1]) {
      const ua = s > 0 ? 'Bip01_L_UpperArm' : 'Bip01_R_UpperArm';
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.098, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), M.steel());
      attachW(root, ua, dome, [s * 0.02, 0.055, 0], { rot: [0, 0, s * -0.35] });
      attachW(root, ua, new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 8, 18), M.glow(0xff9922, 1.2)), [s * 0.02, 0.05, 0], { rot: [Math.PI / 2, 0, 0] });
    }
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), M.steel());
    jaw.scale.set(1.02, 0.58, 0.92);
    attachW(root, 'Bip01_Head', jaw, [0, 0.035, 0.07]);
  },

  // WARDEN — frost enforcer: ice half-mask, glowing eyes, frost spikes
  enforcer(root) {
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), M.ice());
    mask.scale.set(1.05, 0.62, 0.95);
    attachW(root, 'Bip01_Head', mask, [0, 0.005, 0.055]);
    for (const dx of [-0.032, 0.032]) {
      attachW(root, 'Bip01_Head', new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), M.glow(0x66ddff, 3)), [dx, 0.099, 0.098]);
    }
    for (const s of [1, -1]) {
      attachW(root, s > 0 ? 'Bip01_L_UpperArm' : 'Bip01_R_UpperArm', new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.1, 8), M.ice()), [s * 0.02, 0.1, 0], { rot: [0, 0, s * -0.3] });
    }
  },
};

export function applyCostume(root, id) {
  const fn = COSTUMES[id];
  if (!fn) return;
  root.updateMatrixWorld(true);
  fn(root);
}
