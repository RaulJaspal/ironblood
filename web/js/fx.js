// Visual effects: hit sparks, impact bursts, projectiles, screen shake.
import * as THREE from 'three';

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.shake = 0;
    this.shakeVec = new THREE.Vector3();
    this.flash = null;
    this.flashLight = new THREE.PointLight(0xffffff, 0, 8, 2);
    scene.add(this.flashLight);
  }

  // additive particle burst at position
  burst(pos, color, kind = 'med') {
    const cfg = {
      small: { n: 14, size: 0.05, speed: 2.4, life: 0.28, gravity: 3 },
      med: { n: 24, size: 0.06, speed: 3.4, life: 0.35, gravity: 4 },
      big: { n: 40, size: 0.075, speed: 4.6, life: 0.45, gravity: 5 },
      energy: { n: 36, size: 0.07, speed: 3.8, life: 0.5, gravity: 0.5 },
      super: { n: 70, size: 0.09, speed: 6, life: 0.6, gravity: 2 },
      dust: { n: 16, size: 0.09, speed: 1.2, life: 0.5, gravity: -0.4 },
      blood: { n: 20, size: 0.05, speed: 2.8, life: 0.4, gravity: 6 },
    }[kind] || { n: 20, size: 0.06, speed: 3, life: 0.35, gravity: 4 };

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(cfg.n * 3);
    const velocities = [];
    for (let i = 0; i < cfg.n; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
      const s = cfg.speed * (0.4 + Math.random() * 0.8);
      velocities.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + cfg.speed * 0.25, Math.sin(a) * Math.cos(b) * s * 0.4));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size: cfg.size, transparent: true, opacity: 1,
      depthWrite: false, blending: kind === 'blood' ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push({ points, velocities, life: cfg.life, t: 0, gravity: cfg.gravity });

    // flash light
    this.flashLight.position.copy(pos);
    this.flashLight.color.set(color);
    this.flashLight.intensity = kind === 'super' ? 60 : kind === 'big' ? 30 : 14;
  }

  addShake(amount) { this.shake = Math.min(0.5, this.shake + amount); }

  makeProjectileMesh(color) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const light = new THREE.PointLight(color, 18, 6, 2);
    group.add(core, shell, light);
    group.userData.baseScale = 1;
    return group;
  }

  tickProjectile(mesh, dt) {
    const s = 1 + Math.sin(performance.now() * 0.02) * 0.15;
    mesh.scale.setScalar(s);
  }

  update(dt, camera) {
    // particle bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      const alpha = 1 - b.t / b.life;
      if (alpha <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose(); b.points.material.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const arr = b.points.geometry.attributes.position.array;
      for (let j = 0; j < b.velocities.length; j++) {
        const v = b.velocities[j];
        v.y -= b.gravity * dt;
        arr[j * 3] += v.x * dt; arr[j * 3 + 1] += v.y * dt; arr[j * 3 + 2] += v.z * dt;
        if (arr[j * 3 + 1] < 0.02) arr[j * 3 + 1] = 0.02;
      }
      b.points.geometry.attributes.position.needsUpdate = true;
      b.points.material.opacity = alpha;
    }
    // flash decay
    this.flashLight.intensity *= Math.max(0, 1 - dt * 12);
    // shake decay
    this.shake *= Math.max(0, 1 - dt * 6);
    if (camera && this.shake > 0.001) {
      this.shakeVec.set(
        (Math.random() - 0.5) * this.shake * 0.14,
        (Math.random() - 0.5) * this.shake * 0.1,
        0
      );
      camera.position.add(this.shakeVec);
    }
  }
}
