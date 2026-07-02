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

    // projectile spawn
    if (m.projectile && !attacker.moveHit && t >= m.startup) {
      attacker.moveHit = true;
      this.spawnProjectile(attacker);
      return;
    }
    if (m.projectile) return;

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

  spawnProjectile(attacker) {
    if (this.projectiles.some((p) => p.owner === attacker)) return; // one per fighter
    const color = new THREE.Color(attacker.cfg.accent);
    const group = this.fx.makeProjectileMesh(color);
    group.position.set(attacker.x + attacker.facing * 0.7, 1.25, 0);
    this.scene.add(group);
    this.projectiles.push({
      owner: attacker, mesh: group, vx: attacker.facing * 7.5,
      born: performance.now() / 1000, moveData: attacker.move,
    });
    this.audio.play('fire');
  }

  updateProjectiles(fighters, dt, now) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.rotation.z += dt * 8;
      this.fx.tickProjectile(p.mesh, dt);

      const defender = p.owner.opponent;
      let dead = Math.abs(p.mesh.position.x) > FIGHT.stageHalfWidth + 3;

      if (defender && !defender.isInvulnerable(now)) {
        const dx = Math.abs(defender.x - p.mesh.position.x);
        const dy = Math.abs((defender.y + 1.2) - p.mesh.position.y);
        if (dx < 0.55 && dy < 0.9) {
          const m = p.moveData;
          const result = defender.receiveHit(m, p.owner, now);
          this.events.push({
            type: result.blocked ? 'block' : (result.ko ? 'ko' : 'hit'),
            attacker: p.owner, defender, move: m,
            pos: p.mesh.position.clone(), dmg: result.dmg, isFinal: true,
          });
          dead = true;
        }
      }
      if (dead) {
        this.fx.burst(p.mesh.position, new THREE.Color(p.owner.cfg.accent), 'energy');
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  clearProjectiles() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles.length = 0;
  }
}
