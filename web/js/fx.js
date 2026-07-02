// Visual effects: hit sparks, impact bursts, projectiles, screen shake.
import * as THREE from 'three';

// --- canvas-generated impact sprites (no asset files) ---
function makeRadialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeRingTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 7;
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 16;
  g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.stroke();
  return new THREE.CanvasTexture(c);
}

function makeStarTex() {
  // anime-style spiky burst
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.fillStyle = 'rgba(255,255,255,1)';
  const spikes = 9;
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 124 : 34 + Math.random() * 14;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  // hot core
  const grad = g.createRadialGradient(0, 0, 2, 0, 0, 46);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.sprites = []; // animated impact sprites
    this.shake = 0;
    this.punch = 0; // camera punch-in amount
    this.shakeVec = new THREE.Vector3();
    this.flashLight = new THREE.PointLight(0xffffff, 0, 8, 2);
    scene.add(this.flashLight);
    this.texFlash = makeRadialTex();
    this.texRing = makeRingTex();
    this.texStar = makeStarTex();
    this.screenFlashEl = document.getElementById('screenflash');
  }

  spawnSprite(tex, pos, color, { size = 1, life = 0.18, spin = 0, grow = 1.6, opacity = 1 } = {}) {
    const mat = new THREE.SpriteMaterial({
      map: tex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.position.z += 0.3; // bias toward camera so it reads over the bodies
    sprite.scale.setScalar(size * 0.4);
    sprite.material.rotation = Math.random() * Math.PI * 2;
    this.scene.add(sprite);
    this.sprites.push({ sprite, t: 0, life, size, spin, grow, o0: opacity });
    return sprite;
  }

  // layered impact: flash core + optional ring + optional star
  impact(pos, color, kind = 'med') {
    const col = new THREE.Color(color);
    if (kind === 'small') {
      this.spawnSprite(this.texFlash, pos, col, { size: 0.55, life: 0.14 });
      this.burst(pos, col, 'small');
    } else if (kind === 'med') {
      this.spawnSprite(this.texFlash, pos, col, { size: 0.85, life: 0.16 });
      this.spawnSprite(this.texRing, pos, col, { size: 0.5, life: 0.24, grow: 3.2, opacity: 0.8 });
      this.burst(pos, col, 'med');
    } else if (kind === 'big') {
      this.spawnSprite(this.texFlash, pos, 0xffffff, { size: 1.15, life: 0.16 });
      this.spawnSprite(this.texStar, pos, col, { size: 1.5, life: 0.22, spin: 2 });
      this.spawnSprite(this.texRing, pos, col, { size: 0.6, life: 0.3, grow: 4.5, opacity: 0.9 });
      this.burst(pos, col, 'big');
      this.punch = Math.min(1, this.punch + 0.55);
    } else if (kind === 'launcher') {
      // the classic yellow uppercut burst
      this.spawnSprite(this.texStar, pos, 0xffdd44, { size: 2.1, life: 0.28, spin: 3 });
      this.spawnSprite(this.texFlash, pos, 0xffffff, { size: 1.2, life: 0.15 });
      this.spawnSprite(this.texRing, pos, 0xffcc33, { size: 0.7, life: 0.34, grow: 5.5, opacity: 1 });
      this.burst(pos, new THREE.Color(0xffcc55), 'big');
      this.punch = Math.min(1, this.punch + 0.7);
      this.screenFlash(0.22);
    } else if (kind === 'energy') {
      this.spawnSprite(this.texFlash, pos, col, { size: 1.0, life: 0.2 });
      this.spawnSprite(this.texRing, pos, col, { size: 0.5, life: 0.3, grow: 4, opacity: 0.9 });
      this.burst(pos, col, 'energy');
    } else if (kind === 'super') {
      this.spawnSprite(this.texStar, pos, 0xff4433, { size: 2.6, life: 0.3, spin: 4 });
      this.spawnSprite(this.texFlash, pos, 0xffffff, { size: 1.6, life: 0.18 });
      this.spawnSprite(this.texRing, pos, 0xff6644, { size: 0.8, life: 0.4, grow: 7, opacity: 1 });
      this.burst(pos, col, 'super');
      this.punch = Math.min(1.2, this.punch + 0.9);
      this.screenFlash(0.35);
    }
  }

  screenFlash(strength = 0.25) {
    if (!this.screenFlashEl) return;
    this.screenFlashEl.style.transition = 'none';
    this.screenFlashEl.style.opacity = String(strength);
    requestAnimationFrame(() => {
      this.screenFlashEl.style.transition = 'opacity 0.28s ease-out';
      this.screenFlashEl.style.opacity = '0';
    });
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
      color, size: cfg.size, transparent: true, opacity: 1, map: this.texFlash,
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

  makeProjectileMesh(color, size = 0.2) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.62, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(size, 16, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const light = new THREE.PointLight(color, 10 + size * 45, 6, 2);
    group.add(core, shell, light);
    group.userData.baseScale = 1;
    return group;
  }

  tickProjectile(mesh, dt) {
    const s = 1 + Math.sin(performance.now() * 0.02) * 0.15;
    mesh.scale.setScalar(s);
  }

  update(dt, camera) {
    // impact sprites
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i];
      s.t += dt;
      const a = s.t / s.life;
      if (a >= 1) {
        this.scene.remove(s.sprite);
        s.sprite.material.dispose();
        this.sprites.splice(i, 1);
        continue;
      }
      // pop out fast, fade
      const scale = s.size * (0.55 + a * s.grow);
      s.sprite.scale.setScalar(scale);
      s.sprite.material.opacity = s.o0 * (1 - a * a);
      if (s.spin) s.sprite.material.rotation += s.spin * dt;
    }
    // camera punch-in decay
    this.punch *= Math.max(0, 1 - dt * 7);

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
