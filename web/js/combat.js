// Combat resolution: hit windows, projectiles, damage events.
import * as THREE from 'three';
import { STATE } from './fighter.js';
import { FIGHT } from './config.js';

const HURT_RADIUS = 0.38;

export class Combat {
  constructor(scene, fx, audio) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.projectiles = [];
    this.events = []; // consumed by game loop for hit-stop/shake/UI
  }

  update(fighters, dt, now) {
    this.events.length = 0;
    for (const f of fighters) {
      if (f.state === STATE.ATTACK && f.move) this.resolveAttack(f, now);
    }
    this.updateProjectiles(fighters, dt, now);
    for (const f of fighters) {
      // combo ends when opponent leaves hit states
      const op = f.opponent;
      if (f.combo > 0 && op && ![STATE.HIT, STATE.LAUNCHED, STATE.DOWN].includes(op.state) && f.state !== STATE.ATTACK) {
        this.events.push({ type: 'combo_end', fighter: f, hits: f.combo, dmg: f.comboDmg });
        f.combo = 0; f.comboDmg = 0;
      }
    }
  }

  resolveAttack(attacker, now) {
    const m = attacker.move;
    const t = attacker.stateTime;

    // projectile spawns (possibly multiple, e.g. dart volleys)
    if (m.projectile) {
      const times = m.projectile.times || [m.startup];
      while (attacker.multihitIdx < times.length && t >= times[attacker.multihitIdx]) {
        attacker.multihitIdx++;
        this.spawnProjectile(attacker, m);
      }
      return;
    }

    // multihit supers
    if (m.multihit) {
      const idx = attacker.multihitIdx;
      if (idx < m.multihit.length && t >= m.multihit[idx]) {
        attacker.multihitIdx++;
        this.tryConnect(attacker, { ...m, dmg: m.dmg / m.multihit.length, name: m.name }, now, idx === m.multihit.length - 1);
      }
      return;
    }

    if (attacker.moveHit) return;
    if (t < m.startup || t > m.startup + m.active) return;
    if (this.tryConnect(attacker, m, now, true)) attacker.moveHit = true;
  }

  tryConnect(attacker, m, now, isFinal) {
    const defender = attacker.opponent;
    if (!defender || defender.isInvulnerable(now)) return false;
    const dx = (defender.x - attacker.x) * attacker.facing; // >0 = in front
    const dy = Math.abs(defender.y - attacker.y);
    if (dx < -0.2 || dx > m.range + HURT_RADIUS) return false;
    if (dy > 1.0) return false;
    // crouchers dodge nothing for mid in this ruleset (keep it simple & readable)
    if (defender.y > 0.9 && m.height === 'low') return false;

    const result = defender.receiveHit(m, attacker, now);
    const hitPos = new THREE.Vector3(
      attacker.x + attacker.facing * Math.min(m.range, Math.max(0.5, dx)) * 0.8,
      (m.height === 'low' ? 0.35 : m.hitAnim === 'hit_head' ? 1.55 : 1.15) + defender.y,
      0
    );
    this.events.push({
      type: result.blocked ? 'block' : (result.ko ? 'ko' : 'hit'),
      attacker, defender, move: m, pos: hitPos, dmg: result.dmg, isFinal,
    });
    return !result.blocked;
  }

  spawnProjectile(attacker, m) {
    const cfg = m.projectile;
    const maxLive = (cfg.times || [0]).length;
    if (this.projectiles.filter((p) => p.owner === attacker).length >= maxLive) return;
    const color = new THREE.Color(cfg.color || attacker.cfg.accent);
    const group = this.fx.makeProjectileMesh(color, cfg.size || 0.2);
    const y0 = cfg.ground ? 0.18 : 1.25;
    group.position.set(attacker.x + attacker.facing * 0.7, y0, 0);
    this.scene.add(group);
    this.projectiles.push({
      owner: attacker, mesh: group, cfg, color,
      vx: attacker.facing * (cfg.speed || 7.5),
      vy: cfg.arc ? cfg.arc.vy : 0,
      moveData: { ...m },
    });
    if (cfg.ground) this.fx.burst(group.position.clone(), new THREE.Color('#b9a58a'), 'dust');
    this.audio.play(m.sfx || 'fire');
  }

  updateProjectiles(fighters, dt, now) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const cfg = p.cfg || {};
      p.mesh.position.x += p.vx * dt;
      if (cfg.arc) {
        p.vy -= cfg.arc.g * dt;
        p.mesh.position.y += p.vy * dt;
      }
      p.mesh.rotation.z += dt * 8;
      this.fx.tickProjectile(p.mesh, dt);

      const defender = p.owner.opponent;
      let dead = Math.abs(p.mesh.position.x) > FIGHT.stageHalfWidth + 3;

      // grenade: explode on ground contact with area damage
      if (cfg.arc && p.mesh.position.y <= 0.15) {
        const m = p.moveData;
        this.fx.impact(p.mesh.position.clone(), p.color, 'super');
        this.fx.burst(p.mesh.position.clone(), new THREE.Color('#b9a58a'), 'dust');
        this.events.push({ type: 'boom', pos: p.mesh.position.clone(), move: m });
        if (defender && !defender.isInvulnerable(now)) {
          const dist = Math.abs(defender.x - p.mesh.position.x);
          if (dist < (cfg.explode || 1.0) + 0.4 && defender.y < 1.0) {
            const result = defender.receiveHit(m, p.owner, now);
            this.events.push({
              type: result.blocked ? 'block' : (result.ko ? 'ko' : 'hit'),
              attacker: p.owner, defender, move: m,
              pos: new THREE.Vector3(defender.x, 1.0, 0), dmg: result.dmg, isFinal: true,
              shatter: result.shatter, frozen: result.frozen,
            });
          }
        }
        this.removeProjectile(i);
        continue;
      }

      if (defender && !defender.isInvulnerable(now)) {
        const dx = Math.abs(defender.x - p.mesh.position.x);
        const defCenterY = cfg.ground ? defender.y + 0.25 : defender.y + 1.2;
        const dy = Math.abs(defCenterY - p.mesh.position.y);
        const hitW = 0.4 + (cfg.size || 0.2);
        if (dx < hitW && dy < 0.9 && !(cfg.ground && defender.y > 0.35)) {
          const m = p.moveData;
          const result = defender.receiveHit(m, p.owner, now);
          this.events.push({
            type: result.blocked ? 'block' : (result.ko ? 'ko' : 'hit'),
            attacker: p.owner, defender, move: m,
            pos: p.mesh.position.clone(), dmg: result.dmg, isFinal: true,
            shatter: result.shatter, frozen: result.frozen,
          });
          dead = true;
        }
      }
      if (dead) {
        this.fx.burst(p.mesh.position, p.color, 'energy');
        this.removeProjectile(i);
      }
    }
  }

  removeProjectile(i) {
    this.scene.remove(this.projectiles[i].mesh);
    this.projectiles.splice(i, 1);
  }

  clearProjectiles() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles.length = 0;
  }
}
