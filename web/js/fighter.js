// Fighter: skinned character + animation state machine + movement physics.
import * as THREE from 'three';
import { instantiateCharacter, loadAnims } from './assets.js';
import { MOVES, KITS, FIGHT } from './config.js';

const S = {
  IDLE: 'idle', WALK_F: 'walk_f', WALK_B: 'walk_b', DASH: 'dash', EVADE: 'evade',
  JUMP: 'jump', CROUCH: 'crouch', ATTACK: 'attack', HIT: 'hit', BLOCK: 'block',
  LAUNCHED: 'launched', DOWN: 'down', GETUP: 'getup', KO: 'ko', VICTORY: 'victory', INTRO: 'intro',
};
export const STATE = S;

export class Fighter {
  constructor(charCfg, side) {
    this.cfg = charCfg;
    this.kit = KITS[charCfg.id];
    this.side = side; // 1 = left player (faces +X), -1 = right player
    this.root = new THREE.Group();
    this.x = side === 1 ? -1.9 : 1.9;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
    this.facing = side; // +1 faces +X
    this.state = S.IDLE;
    this.health = charCfg.health;
    this.maxHealth = charCfg.health;
    this.meter = 0;
    this.combo = 0;
    this.comboDmg = 0;
    this.stateTime = 0;
    this.move = null;      // current attack move data
    this.moveHit = false;  // already connected this activation
    this.multihitIdx = 0;
    this.blocking = false;
    this.crouching = false;
    this.wantBlockDir = 0;
    this.chainWindow = 0;  // allow chain follow-up when > 0
    this.chainIndex = 0;
    this.projectile = null;
    this.hitstunUntil = 0;
    this.opponent = null;
    this.ai = null;
    this.actions = new Map();
    this.current = null;
    this.roundsWon = 0;
  }

  async load() {
    this.model = await instantiateCharacter(this.cfg.id);
    this.clips = await loadAnims(this.cfg.gender);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const [name, clip] of this.clips) {
      const action = this.mixer.clipAction(clip);
      this.actions.set(name, action);
    }
    this.root.position.set(this.x, 0, 0);
    this.setFacing(this.side, true);
    this.play('guard', { loop: true, fade: 0 });
  }

  // ---------- animation helpers ----------
  play(name, { loop = false, fade = 0.18, speed = 1, from = 0, clamp = false } = {}) {
    const action = this.actions.get(name);
    if (!action) { console.warn('no clip', name); return null; }
    if (this.current === action && loop) return action;
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = clamp;
    action.timeScale = speed;
    action.time = from;
    if (this.current && this.current !== action) {
      action.crossFadeFrom(this.current, fade, false);
    }
    action.play();
    this.current = action;
    return action;
  }

  clipDuration(name) {
    const c = this.clips.get(name);
    return c ? c.duration : 1;
  }

  setFacing(dir, snap = false) {
    this.facing = dir;
    this.targetRotY = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (snap) this.root.rotation.y = this.targetRotY;
  }

  // ---------- state transitions ----------
  setState(state, animOpts = {}) {
    this.state = state;
    this.stateTime = 0;
    switch (state) {
      case S.IDLE: this.play('guard', { loop: true, ...animOpts }); break;
      case S.WALK_F: this.play('walk', { loop: true, speed: 1.25 * this.cfg.speed, ...animOpts }); break;
      case S.WALK_B: this.play('walk', { loop: true, speed: -1.05 * this.cfg.speed, from: this.clipDuration('walk') - 0.01, ...animOpts }); break;
      case S.CROUCH: this.play('crouch', { loop: true, ...animOpts }); break;
      case S.BLOCK: this.play('block', { loop: false, clamp: true, speed: 2.2, ...animOpts }); break;
      case S.DASH: this.play('dash', { loop: true, speed: 1.35, fade: 0.08 }); break;
      case S.EVADE: this.play('roll', { loop: false, speed: 1.6, fade: 0.08 }); break;
      case S.KO: this.play('ko', { loop: false, clamp: true, speed: 1.1, fade: 0.12 }); break;
      case S.VICTORY: this.play(Math.random() < 0.5 ? 'victory_dance' : 'victory_yes', { loop: true, fade: 0.3 }); break;
      case S.INTRO: this.play('taunt', { loop: true, fade: 0.1 }); break;
      case S.DOWN: break;
      default: break;
    }
  }

  // ---------- actions (called by input router / AI) ----------
  canAct(now) {
    return ![S.ATTACK, S.HIT, S.LAUNCHED, S.DOWN, S.GETUP, S.KO, S.VICTORY, S.EVADE].includes(this.state)
      && now >= this.hitstunUntil;
  }

  tryAttack(moveName, now) {
    const move = MOVES[moveName];
    if (!move) return false;
    // chain follow-ups are allowed out of an in-progress attack
    if (this.state === S.ATTACK) {
      if (this.chainWindow > 0 && this.chainNext(moveName)) {
        this.startAttack(this.chainNext(moveName), now);
        return true;
      }
      return false;
    }
    if (!this.canAct(now)) return false;
    if (this.state === S.JUMP) {
      if (move.air || moveName === 'kick_front' || moveName === 'kick_round') {
        this.startAttack('air_kick', now);
        return true;
      }
      return false;
    }
    if (moveName === 'super' && this.meter < FIGHT.maxMeter) return false;
    this.startAttack(moveName, now);
    return true;
  }

  chainNext(requested) {
    // HP chains: cross -> strike_a -> strike_b -> strike_c
    if (['cross', 'strike_a', 'strike_b', 'hook'].includes(this.move?.name)) {
      if (requested === 'cross' || requested === 'hook') {
        const order = { cross: 'strike_a', hook: 'strike_a', strike_a: 'strike_b', strike_b: 'strike_c' };
        return order[this.move.name] || null;
      }
      if (requested === 'jab') return null;
    }
    if (this.move?.name === 'jab' && (requested === 'jab' || requested === 'cross')) {
      return requested === 'jab' ? 'jab' : 'cross';
    }
    return null;
  }

  startAttack(moveName, now) {
    const move = { ...MOVES[moveName], name: moveName };
    this.move = move;
    this.moveHit = false;
    this.multihitIdx = 0;
    this.chainWindow = 0;
    this.state = S.ATTACK;
    this.stateTime = 0;
    const clipDur = this.clipDuration(move.anim);
    const speed = clipDur / move.total;
    this.play(move.anim, { loop: false, speed, fade: 0.07, clamp: true });
    if (moveName === 'super') this.meter = 0;
    if (move.air) this.airAttack = true;
    return true;
  }

  tryJump(dirX, now) {
    if (!this.canAct(now) || this.state === S.JUMP || this.crouching) return;
    this.state = S.JUMP;
    this.stateTime = 0;
    this.vy = FIGHT.jumpVel;
    this.vx = dirX * FIGHT.jumpDriftX;
    this.play('jump_start', { loop: false, speed: 1.6, fade: 0.08 });
    this._jumpPhase = 'rise';
  }

  tryDash(dir, now) {
    if (!this.canAct(now) || this.state === S.JUMP) return;
    if (dir === this.facing) {
      this.state = S.DASH;
      this.stateTime = 0;
      this.vx = dir * FIGHT.dashSpeed;
      this.setState(S.DASH);
    } else {
      // back evade roll (brief invulnerability)
      this.state = S.EVADE;
      this.stateTime = 0;
      this.vx = dir * FIGHT.dashSpeed * 0.85;
      this.play('roll', { loop: false, speed: 1.7, fade: 0.06 });
      this.invulnUntil = now + 0.32;
    }
  }

  // ---------- receiving hits ----------
  isInvulnerable(now) {
    return now < (this.invulnUntil || 0) || this.state === S.DOWN || this.state === S.GETUP || this.state === S.KO;
  }

  isBlockingAgainst(move) {
    if (!this.blocking) return false;
    if (this.y > 0.05) return false; // no blocking mid-air
    if (move.height === 'low' && !this.crouching) return false;
    if (move.height === 'overhead' && this.crouching) return false;
    return true;
  }

  receiveHit(move, attacker, now) {
    const blocked = this.isBlockingAgainst(move);
    const power = attacker.cfg.power;
    if (blocked) {
      const chip = (move.chip || 0);
      this.health = Math.max(0.01, this.health - chip); // chip cannot KO
      this.meter = Math.min(FIGHT.maxMeter, this.meter + 3);
      this.hitstunUntil = now + move.blockstun;
      this.vx = -this.facing * move.push * 2.2;
      this.setState(S.BLOCK);
      return { blocked: true, dmg: chip };
    }
    // damage scaling by combo depth
    const scale = Math.max(0.5, 1 - 0.12 * attacker.combo);
    const dmg = move.dmg * power * scale;
    this.health = Math.max(0, this.health - dmg);
    this.meter = Math.min(FIGHT.maxMeter, this.meter + dmg * 0.7);
    attacker.meter = Math.min(FIGHT.maxMeter, attacker.meter + dmg * 1.0 + (move.meterGain || 0));
    attacker.combo += 1;
    attacker.comboDmg += dmg;
    this.hitstunUntil = now + move.hitstun;

    if (this.health <= 0) {
      this.setState(S.KO);
      this.vx = -this.facing * 1.6;
      return { ko: true, dmg };
    }
    if (move.launcher || this.y > 0.1) {
      // launchers pop the target up; any hit on an airborne target knocks it down
      this.state = S.LAUNCHED;
      this.stateTime = 0;
      this.vy = move.launcher ? 4.2 : Math.min(this.vy, 1.2);
      this.vx = -this.facing * 1.8;
      this.airAttack = false;
      this.move = null;
      this.play('launched', { loop: false, speed: 1.15, clamp: true, fade: 0.06 });
    } else if (move.knockdown) {
      this.state = S.LAUNCHED;
      this.stateTime = 0;
      this.vy = 2.4;
      this.vx = -this.facing * (1.2 + move.push);
      this.play('launched', { loop: false, speed: 1.3, clamp: true, fade: 0.06 });
    } else {
      this.state = S.HIT;
      this.stateTime = 0;
      this.vx = -this.facing * move.push * 3.2;
      this.play(move.hitAnim === 'hit_body' ? 'hit_body' : 'hit_head', { loop: false, speed: 1.7, fade: 0.05 });
    }
    return { dmg };
  }

  // ---------- per-frame update ----------
  update(dt, now, input) {
    this.stateTime += dt;
    const op = this.opponent;

    // face opponent (only when grounded & not mid-action)
    if (op && [S.IDLE, S.WALK_F, S.WALK_B, S.CROUCH].includes(this.state)) {
      const want = op.x > this.x ? 1 : -1;
      if (want !== this.facing) this.setFacing(want);
    }
    // smooth turn
    this.root.rotation.y += (this.targetRotY - this.root.rotation.y) * Math.min(1, dt * 14);

    // input-driven locomotion
    if (input && this.canAct(now) && ![S.JUMP, S.DASH, S.EVADE, S.ATTACK].includes(this.state)) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.crouching = !!input.down;
      const backDir = -this.facing;
      this.blocking = dir === backDir;

      if (this.crouching) {
        if (this.state !== S.CROUCH) this.setState(S.CROUCH);
        this.vx = 0;
      } else if (dir !== 0) {
        const fwd = dir === this.facing;
        const speed = (fwd ? FIGHT.walkSpeed : FIGHT.backSpeed) * this.cfg.speed;
        this.vx = dir * speed;
        const target = fwd ? S.WALK_F : S.WALK_B;
        if (this.state !== target) this.setState(target);
      } else {
        this.vx = 0;
        if (this.state !== S.IDLE) this.setState(S.IDLE);
      }
      if (input.jump) this.tryJump((input.right ? 1 : 0) - (input.left ? 1 : 0), now);
    }

    // state machine progression
    switch (this.state) {
      case S.JUMP: {
        this.vy -= FIGHT.gravity * dt;
        this.y += this.vy * dt;
        if (this._jumpPhase === 'rise' && this.vy < 0.5) {
          this._jumpPhase = 'fall';
          if (!this.airAttack) this.play('jump_loop', { loop: true, fade: 0.15 });
        }
        if (this.y <= 0) {
          this.y = 0; this.vy = 0; this.airAttack = false; this.move = null;
          this.state = S.IDLE;
          this.play('jump_land', { loop: false, speed: 1.8, fade: 0.06 });
          setTimeout(() => { if (this.state === S.IDLE) this.setState(S.IDLE); }, 200);
        }
        break;
      }
      case S.DASH:
        if (this.stateTime > FIGHT.dashTime) { this.vx = 0; this.setState(S.IDLE); }
        break;
      case S.EVADE:
        this.vx *= 1 - Math.min(1, dt * 6);
        if (this.stateTime > 0.45) { this.vx = 0; this.setState(S.IDLE); }
        break;
      case S.ATTACK: {
        const m = this.move;
        // scripted forward motion
        if (m.dash && this.stateTime > m.startup * 0.5 && this.stateTime < m.startup + m.active) {
          this.vx = this.facing * m.dash;
        } else if (m.lunge && this.stateTime < m.startup + m.active) {
          this.vx = this.facing * m.lunge;
        } else {
          this.vx *= 1 - Math.min(1, dt * 10);
        }
        if (this.airAttack) {
          this.vy -= FIGHT.gravity * dt;
          this.y += this.vy * dt;
          if (this.y <= 0) { this.y = 0; this.vy = 0; this.airAttack = false; this.move = null; this.setState(S.IDLE); this.play('jump_land', { loop: false, speed: 1.8 }); break; }
        }
        // chain window after active phase connects/ends
        this.chainWindow = (this.stateTime > m.startup + m.active && this.stateTime < m.total - 0.05 && this.moveHit) ? 1 : 0;
        if (this.stateTime >= m.total) {
          this.move = null;
          this.setState(this.airAttack ? S.JUMP : S.IDLE, { fade: 0.22 });
        }
        break;
      }
      case S.HIT:
        this.vx *= 1 - Math.min(1, dt * 5);
        if (now >= this.hitstunUntil) { this.setState(S.IDLE, { fade: 0.25 }); }
        break;
      case S.BLOCK:
        this.vx *= 1 - Math.min(1, dt * 6);
        if (now >= this.hitstunUntil) {
          this.setState(S.IDLE, { fade: 0.2 });
        }
        break;
      case S.LAUNCHED: {
        this.vy -= FIGHT.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0 && this.vy < 0) {
          this.y = 0; this.vy = 0;
          this.state = S.DOWN;
          this.stateTime = 0;
          this.vx = 0;
        }
        break;
      }
      case S.DOWN:
        if (this.stateTime > 0.55 && this.health > 0) {
          this.state = S.GETUP;
          this.stateTime = 0;
          this.play('crouch', { loop: true, fade: 0.4 });
        }
        break;
      case S.GETUP:
        if (this.stateTime > 0.42) { this.setState(S.IDLE, { fade: 0.25 }); this.invulnUntil = now + 0.3; }
        break;
      case S.KO:
        this.vx *= 1 - Math.min(1, dt * 4);
        break;
      default: break;
    }

    // safety net: gravity applies in ANY state that ends up airborne (a hit or
    // block interrupting a jump would otherwise freeze the fighter mid-air)
    if (this.y > 0 && ![S.JUMP, S.LAUNCHED].includes(this.state) && !this.airAttack) {
      this.vy -= FIGHT.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        if (![S.KO, S.DOWN, S.HIT, S.BLOCK].includes(this.state)) this.setState(S.IDLE, { fade: 0.15 });
      }
    }

    // integrate x
    this.x += this.vx * dt;
    this.x = THREE.MathUtils.clamp(this.x, -FIGHT.stageHalfWidth, FIGHT.stageHalfWidth);

    // pushbox vs opponent
    if (op && this.state !== S.KO && op.state !== S.KO && this.y < 0.6 && op.y < 0.6) {
      const overlap = FIGHT.pushboxRadius * 2 - Math.abs(this.x - op.x);
      if (overlap > 0) {
        const dir = this.x < op.x ? -1 : 1;
        this.x += dir * overlap * 0.5;
        op.x -= dir * overlap * 0.5;
        this.x = THREE.MathUtils.clamp(this.x, -FIGHT.stageHalfWidth, FIGHT.stageHalfWidth);
        op.x = THREE.MathUtils.clamp(op.x, -FIGHT.stageHalfWidth, FIGHT.stageHalfWidth);
      }
    }

    this.root.position.set(this.x, this.y, 0);
    this.mixer.update(dt);
  }

  resetForRound(side) {
    this.health = this.maxHealth;
    this.meter = Math.min(this.meter, 40);
    this.combo = 0; this.comboDmg = 0;
    this.x = side === 1 ? -1.9 : 1.9;
    this.y = 0; this.vx = 0; this.vy = 0;
    this.move = null;
    this.state = S.IDLE;
    this.hitstunUntil = 0;
    this.setFacing(side, true);
    this.root.position.set(this.x, 0, 0);
    this.setState(S.IDLE, { fade: 0 });
  }
}
